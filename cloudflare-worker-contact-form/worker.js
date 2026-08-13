/**
 * ================================================================
 * お問い合わせフォーム送信用プロキシ（Cloudflare Worker + Resend）
 * ================================================================
 *
 * これは何か:
 *   contact.html のお問い合わせフォームが送信された内容を受け取り、
 *   メール送信API「Resend」を使って、依頼主のGmail宛にメールを送る
 *   ための中継サーバーです。
 *   これまで使っていたFormspree（外部フォーム送信サービス）を廃止し、
 *   自前のWorker + Resendの組み合わせに置き換えるためのものです。
 *
 * 全体の流れ:
 *   1. 依頼主のサイト（contact.html）のフォームが、このWorkerのURLへ
 *      multipart/form-data形式でPOSTされる
 *      （お名前・メールアドレス・電話番号・ご相談内容・詳細メッセージ・
 *        添付画像（複数可）・ハニーポット用の隠しフィールド _gotcha）
 *   2. このWorkerが送信内容を読み取り、_gotcha（ハニーポット）に
 *      値が入っていればボットからの送信とみなし、メール送信をせずに
 *      成功したフリをして完了ページへリダイレクトする
 *   3. 添付画像があればbase64化し、Resend APIの添付ファイル仕様に
 *      合わせて整形する
 *   4. Resend API（https://api.resend.com/emails）に、整形したメール
 *      本文・添付ファイルをPOSTし、依頼主のGmail宛にメールを送信する
 *      （このときRESEND_API_KEYを使う）
 *   5. 送信に成功したら、完了ページ（contact-thanks.html）へ302リダイレクト
 *      する。失敗した場合は、分かりやすい日本語のエラーメッセージを返す
 *
 * ----------------------------------------------------------------
 * ▼▼▼ 重要：Cloudflareの管理画面で必ず設定してください ▼▼▼
 * ----------------------------------------------------------------
 * このWorkerをデプロイした後、Cloudflareダッシュボードの
 *   Workers & Pages → （このWorkerを選択）→ Settings（設定）
 *   → Variables and Secrets（変数とシークレット）
 * から、以下を「Secret（暗号化された環境変数）」として登録してください。
 * コード中に直接書き込まないでください（GitHubにコードを公開しても
 * 漏れないようにするため）。
 *
 *   RESEND_API_KEY  … Resendダッシュボードで発行するAPIキー
 *
 * wrangler CLIを使う場合は、デプロイ後に次のコマンドで設定できます。
 *   npx wrangler secret put RESEND_API_KEY
 *
 * 詳しい手順（Resend側でのドメイン検証手順を含む）は、同じフォルダ内の
 * README.md を参照してください。
 * ----------------------------------------------------------------
 */

// Resend のメール送信エンドポイント
const RESEND_API_URL = "https://api.resend.com/emails";

// 送信先（依頼主のGmail）。メールの宛先はここだけで管理する。
const TO_EMAIL = "sumainosetsubiya@gmail.com";

// 送信元メールアドレス。
// Resendでは Gmail 等の一般的な無料メールアドレスを「送信元」に指定することは
// できません。自分が所有し、SPF/DKIM等のDNS認証を済ませたドメインのみが
// 送信元として使えます。
// また、本番運用ドメイン（sumainosetsubiya.com）を直接メール送信に使うと、
// 万一のトラブル時にサイト本体の評判（メール到達率）まで巻き込むリスクがあるため、
// Resendが推奨する構成にならい、メール送信専用の「サブドメイン」
// （例: send.sumainosetsubiya.com）を切り出して使う想定にしている。
// このサブドメインをResendダッシュボードで「Domain」として追加し、
// 表示されるDNSレコード（SPF/DKIM等）をCloudflareのDNS設定に追加することで
// 送信できるようになる（詳しい手順はREADME.mdを参照）。
const FROM_EMAIL =
  "住まいの設備屋さん お問い合わせフォーム <contact@send.sumainosetsubiya.com>";

// 送信完了後にユーザーを誘導する完了ページ
const THANKS_URL = "https://www.sumainosetsubiya.com/contact-thanks.html";

// ハニーポット用フィールド名（contact.html の隠しフィールドと必ず一致させること）
const HONEYPOT_FIELD_NAME = "_gotcha";

// 添付画像の合計サイズの上限（目安）。
// Resend APIの添付ファイルはメール全体で40MB程度が上限とされているため、
// Base64化によるサイズ増加（約1.37倍）も見込んで余裕を持たせている。
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB

// フォームを設置するサイトのオリジン。CORSで許可するオリジンをこれに限定する。
const ALLOWED_ORIGIN = "https://www.sumainosetsubiya.com";

function corsHeaders(origin) {
  // フォームは通常のHTMLフォーム送信（ページ遷移）のためCORS制約自体は
  // 受けないが、将来fetch/XHRベースの送信に変更された場合に備えて
  // 許可オリジンからのアクセスをきちんと通せるようにしておく。
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** わかりやすい日本語エラーメッセージを返すためのシンプルなHTMLレスポンス */
function errorResponse(message, status, origin) {
  return new Response(
    `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>送信エラー - 住まいの設備屋さん</title></head>
<body>
  <h1>送信に失敗しました</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="https://www.sumainosetsubiya.com/contact.html">お問い合わせフォームに戻る</a></p>
</body>
</html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        ...corsHeaders(origin),
      },
    }
  );
}

/** 送信成功時 / ハニーポット検知時に完了ページへ302リダイレクトする */
function redirectToThanks(origin) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: THANKS_URL,
      ...corsHeaders(origin),
    },
  });
}

/** ArrayBuffer を Base64 文字列に変換する（Resendの添付ファイル仕様に合わせる） */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // 一度に処理するバイト数（スタックオーバーフロー回避）
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** フォーム内容から、依頼主宛メールのHTML本文を組み立てる */
function buildEmailHtml({ name, email, tel, topic, message }) {
  const rows = [
    ["お名前", name],
    ["メールアドレス", email],
    ["電話番号", tel || "（未入力）"],
    ["ご相談内容", topic],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><th style="text-align:left;padding:4px 12px 4px 0;white-space:nowrap;vertical-align:top;">${escapeHtml(
          label
        )}</th><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="ja">
<body style="font-family:sans-serif;line-height:1.7;color:#222;">
  <p>住まいの設備屋さんのお問い合わせフォームから、新しいお問い合わせが届きました。</p>
  <table style="border-collapse:collapse;margin:16px 0;">${rowsHtml}</table>
  <p style="margin-top:16px;"><strong>詳細メッセージ</strong></p>
  <p style="white-space:pre-wrap;border-left:3px solid #ccc;padding-left:12px;">${escapeHtml(
    message
  )}</p>
  <p style="margin-top:24px;color:#666;font-size:0.9em;">
    このメールに返信すると、お客様（${escapeHtml(email)}）宛に直接届きます。
  </p>
</body>
</html>`;
}

/** メールクライアントがHTMLを表示できない場合のプレーンテキスト版本文 */
function buildEmailText({ name, email, tel, topic, message }) {
  return [
    "住まいの設備屋さんのお問い合わせフォームから、新しいお問い合わせが届きました。",
    "",
    `お名前: ${name}`,
    `メールアドレス: ${email}`,
    `電話番号: ${tel || "（未入力）"}`,
    `ご相談内容: ${topic}`,
    "",
    "詳細メッセージ:",
    message,
  ].join("\n");
}

async function handlePost(request, env) {
  const origin = request.headers.get("Origin") || "";

  let formData;
  try {
    // Cloudflare Workers の Request.formData() は multipart/form-data を
    // 自動でパースしてくれるため、独自のパーサーを実装する必要はない。
    formData = await request.formData();
  } catch (err) {
    return errorResponse(
      "送信内容の読み取りに失敗しました。お手数ですがブラウザを更新し、もう一度フォームを送信してください。",
      400,
      origin
    );
  }

  // ---- ハニーポット判定 -------------------------------------------------
  // 隠しフィールド（人間には見えない）に何か入力されていた場合、
  // ボットによる自動送信とみなし、メールは送らずに「成功したフリ」をして
  // 完了ページへ静かに誘導する（ボットに「弾かれた」と悟らせないため）。
  const honeypotValue = formData.get(HONEYPOT_FIELD_NAME);
  if (honeypotValue) {
    return redirectToThanks(origin);
  }

  const name = String(formData.get("お名前") || "").trim();
  const email = String(formData.get("メールアドレス") || "").trim();
  const tel = String(formData.get("電話番号") || "").trim();
  const topic = String(formData.get("ご相談内容") || "").trim();
  const message = String(formData.get("詳細メッセージ") || "").trim();

  if (!name || !email || !topic || !message) {
    return errorResponse(
      "お名前・メールアドレス・ご相談内容・詳細メッセージは必須項目です。入力内容をご確認のうえ、もう一度送信してください。",
      400,
      origin
    );
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "サーバー設定エラー: RESEND_API_KEY が設定されていません。運営者へお問い合わせいただくか、時間をおいて再度お試しください。",
      500,
      origin
    );
  }

  // ---- 添付画像の取得とBase64化 -----------------------------------------
  const photoFiles = formData
    .getAll("添付画像")
    .filter((value) => value instanceof File && value.size > 0);

  const totalSize = photoFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) {
    return errorResponse(
      "添付画像の合計サイズが大きすぎます。お手数ですが枚数を減らすか、サイズを小さくしたうえで再度お試しください。",
      400,
      origin
    );
  }

  let attachments;
  try {
    attachments = await Promise.all(
      photoFiles.map(async (file) => ({
        filename: file.name || "attachment",
        content: arrayBufferToBase64(await file.arrayBuffer()),
      }))
    );
  } catch (err) {
    return errorResponse(
      "添付画像の処理に失敗しました。お手数ですが添付なしで再度お試しいただくか、時間をおいて再度お試しください。",
      500,
      origin
    );
  }

  // ---- Resend APIへ送信 --------------------------------------------------
  const resendPayload = {
    from: FROM_EMAIL,
    to: [TO_EMAIL],
    // 返信先をお客様のメールアドレスにしておくことで、依頼主はメールに
    // そのまま「返信」するだけでお客様へ直接返信できる。
    reply_to: email,
    subject: `【お問い合わせ】${topic}（${name}様）`,
    html: buildEmailHtml({ name, email, tel, topic, message }),
    text: buildEmailText({ name, email, tel, topic, message }),
  };
  if (attachments.length > 0) {
    resendPayload.attachments = attachments;
  }

  let resendRes;
  try {
    resendRes = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });
  } catch (err) {
    return errorResponse(
      `メール送信サービスへの接続に失敗しました。お手数ですが時間をおいて再度お試しいただくか、直接 ${TO_EMAIL} 宛にご連絡ください。`,
      502,
      origin
    );
  }

  if (!resendRes.ok) {
    let detail = "";
    try {
      const errJson = await resendRes.json();
      detail = errJson && (errJson.message || JSON.stringify(errJson));
    } catch (_) {
      // レスポンスがJSONでない場合は詳細なしで続行
    }
    return errorResponse(
      `メールの送信に失敗しました。お手数ですが時間をおいて再度お試しいただくか、直接 ${TO_EMAIL} 宛にご連絡ください。${
        detail ? `（詳細: ${detail}）` : ""
      }`,
      502,
      origin
    );
  }

  return redirectToThanks(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // CORSのプリフライトリクエスト（fetch/XHRベースの送信に変更した場合に備えて対応）
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "POST") {
      try {
        return await handlePost(request, env);
      } catch (err) {
        return errorResponse(
          "予期しないエラーが発生しました。お手数ですが時間をおいて再度お試しください。",
          500,
          origin
        );
      }
    }

    // それ以外（動作確認用のトップページ）
    return new Response(
      `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>お問い合わせフォーム送信プロキシ</title></head>
<body>
  <h1>お問い合わせフォーム送信プロキシ</h1>
  <p>このWorkerは「住まいの設備屋さん」サイトのお問い合わせフォームから送信された
  内容を受け取り、Resend経由でメール送信するためのものです。このページが
  表示されていればWorkerは正常に動作しています。</p>
  <p>URLパス: ${escapeHtml(url.pathname)}</p>
</body>
</html>`,
      {
        headers: { "content-type": "text/html; charset=UTF-8", ...corsHeaders(origin) },
      }
    );
  },
};
