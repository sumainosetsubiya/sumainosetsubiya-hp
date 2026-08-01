/**
 * ================================================================
 * Decap CMS 用 GitHub OAuth プロキシ（Cloudflare Worker）
 * ================================================================
 *
 * これは何か:
 *   Decap CMS（backend: github）がGitHubにログインするために必要な
 *   「認可コード → アクセストークン」の交換を代行する、小さな中継サーバーです。
 *   GitHubのOAuthは、トークン交換の際に「Client Secret」という
 *   絶対に外部に漏らしてはいけない秘密情報を使う必要があり、これを
 *   ブラウザ上で直接動くDecap CMSのコードに埋め込むことはできません。
 *   そのため、このWorkerをブラウザとGitHubの間に立て、Client Secretは
 *   Worker側だけが知っている状態で安全にトークン交換を行います。
 *
 * 全体の流れ:
 *   1. 管理画面（/admin）で「GitHubでログイン」ボタンを押す
 *   2. Decap CMSがこのWorkerの `/auth?provider=github` を開く（別ウィンドウ）
 *   3. このWorkerがGitHubの認可画面へリダイレクトする
 *   4. 依頼主がGitHub上で「許可する」を押す
 *   5. GitHubがこのWorkerの `/callback` に認可コード(code)を渡して戻ってくる
 *   6. このWorkerがGitHubにcodeを送り、アクセストークンと交換する
 *      （ここでGITHUB_CLIENT_SECRETを使う）
 *   7. 取得したトークンを、window.postMessage を使って
 *      管理画面（元のウィンドウ）に安全に渡す
 *   8. Decap CMSがそのトークンを使ってGitHubリポジトリを直接読み書きする
 *
 * ----------------------------------------------------------------
 * ▼▼▼ 重要：Cloudflareの管理画面で必ず設定してください ▼▼▼
 * ----------------------------------------------------------------
 * このWorkerをデプロイした後、Cloudflareダッシュボードの
 *   Workers & Pages → （このWorkerを選択）→ Settings（設定）
 *   → Variables and Secrets（変数とシークレット）
 * から、以下の2つを「Secret（暗号化された環境変数）」として登録してください。
 * コード中に直接書き込まないでください（GitHubにコードを公開しても漏れないようにするため）。
 *
 *   GITHUB_CLIENT_ID      … GitHub OAuth AppのClient ID
 *   GITHUB_CLIENT_SECRET  … GitHub OAuth AppのClient Secret
 *
 * wrangler CLIを使う場合は、デプロイ後に次のコマンドで設定できます。
 *   npx wrangler secret put GITHUB_CLIENT_ID
 *   npx wrangler secret put GITHUB_CLIENT_SECRET
 *
 * 詳しい手順は同じフォルダ内の README.md を参照してください。
 * ----------------------------------------------------------------
 */

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

// GitHubに要求する権限範囲（スコープ）。
// "repo" はプライベートリポジトリも含めて読み書きできる権限、
// "user" はログインユーザー情報の取得権限です。
// リポジトリをPublic（公開）にした場合でもこのスコープのままで問題なく動作します
// （Publicリポジトリのみで運用することが確定していれば "public_repo,user" に
//  絞ることもできますが、必須の対応ではありません）。
const GITHUB_OAUTH_SCOPE = "repo,user";

function randomState() {
  // CSRF対策用の使い捨てランダム文字列（簡易実装）。
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=UTF-8" },
  });
}

/**
 * /auth?provider=github
 * Decap CMSの「ログイン」ボタンから最初に開かれるエンドポイント。
 * GitHubの認可画面へリダイレクトする。
 */
async function handleAuth(url, env) {
  const provider = url.searchParams.get("provider");
  if (provider !== "github") {
    return new Response("provider は github を指定してください", { status: 400 });
  }

  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response(
      "サーバー設定エラー: 環境変数 GITHUB_CLIENT_ID が設定されていません。" +
        "Cloudflareダッシュボードの Settings → Variables and Secrets から設定してください。",
      { status: 500 }
    );
  }

  // 戻り先（callback）のURLは、このWorker自身のオリジン（自分のURL）を使う。
  // GitHub OAuth AppのAuthorization callback URLに登録したものと
  // 完全に一致している必要がある。
  const redirectUri = `${url.origin}/callback`;

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
  authorizeUrl.searchParams.set("state", randomState());

  return Response.redirect(authorizeUrl.toString(), 302);
}

/**
 * /callback
 * GitHubの認可画面で「許可する」を押した後に、GitHubから戻ってくるエンドポイント。
 * 受け取った認可コード(code)をGitHubに送り、アクセストークンと交換する。
 */
async function handleCallback(url, env) {
  const code = url.searchParams.get("code");
  if (!code) {
    return renderResultPage(
      "error",
      { message: "GitHubからの認可コード(code)が見つかりませんでした。" },
      400
    );
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return renderResultPage(
      "error",
      {
        message:
          "サーバー設定エラー: GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET が設定されていません。",
      },
      500
    );
  }

  const redirectUri = `${url.origin}/callback`;

  let tokenJson;
  try {
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenJson = await tokenRes.json();
  } catch (err) {
    return renderResultPage(
      "error",
      { message: "GitHubへのトークン交換リクエストに失敗しました: " + err.message },
      502
    );
  }

  if (tokenJson.error) {
    return renderResultPage(
      "error",
      { message: tokenJson.error_description || tokenJson.error },
      400
    );
  }

  if (!tokenJson.access_token) {
    return renderResultPage(
      "error",
      { message: "GitHubからアクセストークンを取得できませんでした。" },
      502
    );
  }

  return renderResultPage("success", {
    token: tokenJson.access_token,
    provider: "github",
  });
}

/**
 * Decap CMS（管理画面側のウィンドウ）へ、window.postMessage を使って
 * 認証結果（成功時はトークン、失敗時はエラーメッセージ）を送り返すためのHTML。
 * これはDecap CMSが期待している標準的なハンドシェイク方式に合わせている:
 *   1. このポップアップが親ウィンドウへ "authorizing:github" を送る
 *   2. 親ウィンドウ（Decap CMS）がそれを受け取り、確認の返信メッセージを送る
 *   3. その返信を受け取ったら、このポップアップが本番のメッセージ
 *      "authorization:github:success:{...}" または
 *      "authorization:github:error:{...}" を送り、ウィンドウを閉じる
 */
function renderResultPage(status, payload, httpStatus = 200) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;

  return htmlResponse(
    `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>GitHub認証 - 住まいの設備屋さん</title></head>
<body>
  <p>${status === "success" ? "認証が完了しました。ウィンドウを閉じています…" : "認証に失敗しました。"}</p>
  ${status === "error" ? `<p>${escapeHtml(payload.message || "")}</p>` : ""}
  <script>
    (function () {
      function receiveMessage(message) {
        window.opener.postMessage(
          ${JSON.stringify(message)},
          "*"
        );
        window.removeEventListener("message", receiveMessage, false);
      }
      window.addEventListener("message", receiveMessage, false);
      // 親ウィンドウ（Decap CMS）へ、認証処理中であることを知らせる。
      // 親からの返信メッセージを受け取ったら、上の receiveMessage が
      // 本番の認証結果メッセージを送信する。
      window.opener.postMessage("authorizing:github", "*");
    })();
  </script>
</body>
</html>`,
    httpStatus
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/auth") {
        return await handleAuth(url, env);
      }
      if (url.pathname === "/callback") {
        return await handleCallback(url, env);
      }
    } catch (err) {
      return new Response("内部エラーが発生しました: " + err.message, { status: 500 });
    }

    // それ以外のパス（動作確認用のトップページ）
    return htmlResponse(
      `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>Decap CMS OAuth プロキシ</title></head>
<body>
  <h1>Decap CMS 用 GitHub OAuth プロキシ</h1>
  <p>このWorkerは「住まいの設備屋さん」サイトの管理画面（Decap CMS）が、
  GitHubへログインするために使う中継サーバーです。このページが表示されていれば
  Workerは正常に動作しています。</p>
</body>
</html>`
    );
  },
};
