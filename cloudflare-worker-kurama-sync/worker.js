/**
 * ================================================================
 * くらしのマーケット予約 → Googleカレンダー同期Worker（Cron Trigger）
 * ================================================================
 *
 * これは何か:
 *   「くらしのマーケット」の事業者管理画面から予約（依頼）データを定期的に
 *   取得し、Googleカレンダーに「予定あり」として反映するだけの、
 *   最小限の情報だけを転記するバッチ処理です。Cloudflareの Cron Trigger
 *   （定期実行の仕組み）を使い、1日に数回自動で実行されます。
 *
 * 全体の流れ（scheduledハンドラ内の runSync()）:
 *   1. くらしのマーケットのログインページ(GET)から _csrf トークンを取得する
 *   2. email / password / _csrf をPOSTしてログインし、
 *      Set-CookieヘッダーからセッションCookieを取得する
 *      （curama.jp/shop/login はログイン失敗時もHTTP 200でログインページを
 *      再描画するだけのため、レスポンス本文にエラー文言・ログインフォームが
 *      残っていないかを確認し、さらに認証必須ページ(/shop/)への
 *      アクセスで/shop/loginへリダイレクトされないかを確認する、
 *      二段階のチェックで成否を判定する）
 *   3. 取得したCookieを使い、今日から60日後までの予約イベントを
 *      くらしのマーケットのAPIから取得する
 *   4. eventTypeId === 2（実際の予約）のイベントだけを抽出する
 *      （calendarTypeId: 1側の営業時間テンプレート等は無視する）
 *   5. Googleカレンダー側の「このWorkerが過去に作成した」イベント一覧を、
 *      extendedProperties.private の目印（kurama_sync=true）を使って取得する
 *   6. くらしのマーケット側のイベントID（kurama_event_id）を軸に差分を計算し、
 *      新規は作成・消えた予約は削除・時間が変わっていれば更新する
 *   7. 件数の集計結果を console.log に出力する
 *      （Cloudflareダッシュボードの「Logs」から確認できる）
 *
 * プライバシーへの配慮:
 *   Googleカレンダー側には「予定あり」ということだけが分かれば十分という
 *   依頼主の方針により、工事内容などの詳細（くらしのマーケット側の title）は
 *   一切転記しません。作成するGoogleカレンダーのイベントタイトルは、
 *   常に固定文言（GOOGLE_EVENT_TITLE）です。
 *
 * ----------------------------------------------------------------
 * ▼▼▼ 重要：Cloudflareの管理画面で必ず設定してください ▼▼▼
 * ----------------------------------------------------------------
 * このWorkerをデプロイした後、Cloudflareダッシュボードの
 *   Workers & Pages → （このWorkerを選択）→ Settings（設定）
 *   → Variables and Secrets（変数とシークレット）
 * から、以下をすべて「Secret（暗号化された環境変数）」として登録してください。
 * コード中に直接書き込まないでください（GitHubにコードを公開しても漏れない
 * ようにするため）。
 *
 *   KURAMA_EMAIL          … くらしのマーケット事業者アカウントのログインメールアドレス
 *   KURAMA_PASSWORD        … くらしのマーケット事業者アカウントのログインパスワード
 *   GOOGLE_CLIENT_ID        … Google OAuth クライアントID
 *   GOOGLE_CLIENT_SECRET    … Google OAuth クライアントシークレット
 *   GOOGLE_REFRESH_TOKEN    … Google OAuth リフレッシュトークン（一度だけ手動取得したもの）
 *   GOOGLE_CALENDAR_ID      … 反映先のGoogleカレンダーID
 *   MANUAL_TRIGGER_TOKEN    … 手動テスト実行用の秘密トークン（任意の推測されにくい文字列）
 *
 * wrangler CLIを使う場合は、デプロイ後に次のコマンドで設定できます。
 *   npx wrangler secret put KURAMA_EMAIL
 *   npx wrangler secret put KURAMA_PASSWORD
 *   npx wrangler secret put GOOGLE_CLIENT_ID
 *   npx wrangler secret put GOOGLE_CLIENT_SECRET
 *   npx wrangler secret put GOOGLE_REFRESH_TOKEN
 *   npx wrangler secret put GOOGLE_CALENDAR_ID
 *   npx wrangler secret put MANUAL_TRIGGER_TOKEN
 *
 * 詳しい手順（Google OAuthリフレッシュトークンの取得方法を含む）は、
 * 同じフォルダ内の README.md を参照してください。
 * ----------------------------------------------------------------
 */

// ---- くらしのマーケット側の設定 ------------------------------------------

const KURAMA_LOGIN_URL = "https://curama.jp/shop/login";

// ログイン成功/失敗を最終確認するための、認証必須の画面系ページ（ダッシュボード）。
// curama.jpは未認証の場合、画面系ルート(/shop/...)は302で/shop/login/へ
// リダイレクトする一方、APIルート(/v1/api/...)は404を返す仕様のため、
// 判定には画面系ページを使う。
const KURAMA_DASHBOARD_URL = "https://curama.jp/shop/";

// 依頼主の店舗コード（このWorker専用。URLに直接埋め込まれている固定値）。
const KURAMA_STORE_CODE = "451904803";
const KURAMA_EVENTS_API_URL = `https://curama.jp/v1/api/calendars/stores/${KURAMA_STORE_CODE}/calendars/events/`;

// 実際の予約（顧客からの依頼）を表すイベントの eventTypeId。
// calendarTypeId: 1 側（営業時間テンプレート等と推測される）は無視する。
const KURAMA_RESERVATION_EVENT_TYPE_ID = 2;

// 一部のサイトはUser-Agentが無い/不自然なリクエストをボットとして弾くことがあるため、
// 一般的なブラウザのUser-Agentを明示しておく。
const REQUEST_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// 取得するイベントの期間（今日から何日先まで）。
// くらしのマーケット側の予約可能期間の仕様に合わせて60日としている。
const SYNC_RANGE_DAYS = 60;

// ---- Googleカレンダー側の設定 ---------------------------------------------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// Googleカレンダー側に作成するイベントのタイトル。
// 依頼主の方針により、工事内容などの詳細は一切載せず、常にこの固定文言にする。
const GOOGLE_EVENT_TITLE = "予約あり（くらしのマーケット）";

// 重複防止・差分検出用に、作成したGoogleイベントの extendedProperties.private に
// 埋め込む値のキー名。
//   KURAMA_EVENT_ID_KEY … くらしのマーケット側のイベントID（1件ずつのユニークキー）
//   SYNC_MARKER_KEY      … 「このWorkerが作成したイベントである」という目印。
//                            Google Calendar APIの privateExtendedProperty
//                            フィルタは完全一致（key=value）のみ対応しており、
//                            「kurama_event_id が何かしら設定されている」という
//                            ワイルドカード検索はできないため、絞り込み専用の
//                            固定値キーを別途用意している。
const KURAMA_EVENT_ID_KEY = "kurama_event_id";
const SYNC_MARKER_KEY = "kurama_sync";
const SYNC_MARKER_VALUE = "true";

// ================================================================
// くらしのマーケット側の処理
// ================================================================

/**
 * ログインページのHTMLから <input name="_csrf" value="..."> の値を抜き出す。
 * 属性の順序（name/valueどちらが先か等）に依存しないよう、まず _csrf を含む
 * <input>タグ全体を取り出してから、その中の value 属性を読む2段階の正規表現にしている。
 */
function extractCsrfToken(html) {
  const inputTagMatch = html.match(/<input\b[^>]*name=["']_csrf["'][^>]*>/i);
  if (!inputTagMatch) return null;
  const valueMatch = inputTagMatch[0].match(/value=["']([^"']*)["']/i);
  return valueMatch ? valueMatch[1] : null;
}

/**
 * ログインPOSTのレスポンス本文（HTML）に、ログイン失敗を示す兆候が
 * 含まれているかどうかを判定する。
 *
 * curama.jp/shop/login はログイン失敗時もHTTP 200を返し、ログインページを
 * そのまま再描画するだけ（302リダイレクトにならない）という挙動が実機で
 * 確認されているため、ステータスコードだけでは成否を判定できない。
 *
 * 判定方法は2段構え:
 *   1. 既知のエラー文言（「メールアドレスかパスワードが異なります」等）が
 *      本文に含まれていないか
 *   2. （文言がサイト側の変更で変わった場合の保険として）ログインフォーム
 *      自体、つまり _csrf の隠しフィールドがまだ本文に存在していないか
 *      ※ ログイン成功時はダッシュボード等へ遷移し、ログインフォームは
 *        含まれないはずなので、まだ存在する＝ログインページの再描画＝失敗
 *        とみなせる。
 */
function loginPostIndicatesFailure(html) {
  const KNOWN_LOGIN_ERROR_PHRASES = [
    "メールアドレスかパスワードが異なります",
    "メールアドレスまたはパスワードが正しくありません",
    "メールアドレスかパスワードが間違っています",
  ];
  if (KNOWN_LOGIN_ERROR_PHRASES.some((phrase) => html.includes(phrase))) {
    return true;
  }
  if (extractCsrfToken(html)) {
    return true;
  }
  return false;
}

/**
 * Fetch Responseから Set-Cookie ヘッダーを（複数ある場合は複数とも）取り出す。
 * 標準の Headers.get("set-cookie") は複数値をカンマ結合してしまい、Cookieの値
 * 自体にカンマや日付が含まれるケースと区別がつかず壊れることがあるため、
 * Cloudflare Workers / undici が実装している Headers.getSetCookie()
 * （Fetch標準の拡張）を優先して使う。念のため未対応環境向けのフォールバックも
 * 用意しておく（その場合は複数Cookieが1本に結合されてしまう可能性がある）。
 */
function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const combined = response.headers.get("set-cookie");
  return combined ? [combined] : [];
}

/** Set-Cookie文字列群を、簡易Cookieジャー（Map）にマージする */
function mergeCookiesIntoJar(jar, setCookieStrings) {
  for (const setCookie of setCookieStrings) {
    const firstPart = setCookie.split(";")[0].trim();
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex === -1) continue;
    const name = firstPart.slice(0, eqIndex).trim();
    const value = firstPart.slice(eqIndex + 1).trim();
    if (name) jar.set(name, value);
  }
}

/** Cookieジャーから、後続リクエストの Cookie ヘッダー用の文字列を組み立てる */
function buildCookieHeader(jar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * くらしのマーケットにログインし、後続のAPIリクエストで使うセッションCookie
 * ヘッダー文字列を返す。
 *
 * 【Cloudflare Workersでのセッション管理についての注意】
 * ブラウザと違い、Workers の fetch() はCookieを自動的に保存・送信してくれない
 * （リクエストをまたいだ状態は一切保持されない）。そのため、
 *   1. GETレスポンスのSet-Cookie（CSRF保護用のセッションCookie等）を手動で拾い、
 *   2. それをPOSTリクエストのCookieヘッダーに手動で載せて送り、
 *   3. POSTレスポンスのSet-Cookie（ログイン後の本セッションCookie）を
 *      さらに手動で拾って合成し、
 *   4. 以降のAPIリクエストのCookieヘッダーとして手動で使い回す
 * という形で、自前のCookieジャー（Map）を使って一連の流れを実装している。
 * `redirect: "manual"` を指定してリダイレクトを自動追跡させず、
 * リダイレクトレスポンス自体のSet-Cookieを確実に取得できるようにしている。
 * mergeCookiesIntoJar() は同名のCookieを Map.set() で上書きするため、
 * POSTレスポンスのSet-Cookieで古い値が残ることはない。
 *
 * 【ログイン成否判定について（実機検証済みの重要な注意）】
 * curama.jp/shop/login は、ログイン失敗時もHTTP 200を返し、ログインページを
 * そのまま再描画するだけで302リダイレクトにはならないことが実機で確認されて
 * いる。そのため、ステータスコードが400未満かどうかだけでは成否を判定できず、
 * 以前の実装ではその判定不備により、未認証のセッションCookieのまま後続の
 * APIアクセスを行っていた（結果としてAPI側が404を返していた。curama.jpの
 * APIルート(/v1/api/...)は未認証時にエラーを隠すためあえて404を返す設計で
 * あるのに対し、画面系ルート(/shop/...)は未認証時302で/shop/login/へ
 * リダイレクトする）。
 *
 * このため、ログイン成否は以下の2段階で判定する。
 *   A. ログインPOSTのレスポンス本文に、ログイン失敗の兆候
 *      （エラー文言、またはログインフォームの再描画）がないか確認する
 *      （loginPostIndicatesFailure()）。
 *   B. さらに最終確認として、取得したCookieで認証必須ページ
 *      （KURAMA_DASHBOARD_URL = https://curama.jp/shop/）へ
 *      `redirect: "manual"` でGETし、/shop/login へリダイレクトされないか
 *      確認する。リダイレクトされた場合は未認証（＝ログイン失敗）と確定する。
 */
async function loginToKurama(env) {
  const jar = new Map();

  // 1. ログインページをGETし、_csrfトークンとCSRF保護用Cookie(あれば)を取得する。
  const loginPageRes = await fetch(KURAMA_LOGIN_URL, {
    method: "GET",
    headers: { "user-agent": REQUEST_USER_AGENT },
  });
  mergeCookiesIntoJar(jar, getSetCookieHeaders(loginPageRes));

  if (!loginPageRes.ok) {
    throw new Error(
      `[login_page_fetch_failed] ログインページの取得に失敗しました(HTTP ${loginPageRes.status})`
    );
  }

  const html = await loginPageRes.text();
  const csrfToken = extractCsrfToken(html);
  if (!csrfToken) {
    throw new Error(
      "[login_page_no_csrf] ログインページから_csrfトークンを取得できませんでした（HTML構造が変わった可能性があります）"
    );
  }

  // 2. email / password / _csrf をPOSTしてログインする。
  const postBody = new URLSearchParams({
    email: env.KURAMA_EMAIL,
    password: env.KURAMA_PASSWORD,
    _csrf: csrfToken,
  });

  const postHeaders = {
    "content-type": "application/x-www-form-urlencoded",
    "user-agent": REQUEST_USER_AGENT,
  };
  // GET時にCSRF保護用のCookieが発行されていた場合のみ、Cookieヘッダーを付与する
  // （空文字列の Cookie ヘッダーを送ると一部のサーバーで挙動が不安定になり得るため）。
  const cookieForLoginPost = buildCookieHeader(jar);
  if (cookieForLoginPost) postHeaders.cookie = cookieForLoginPost;

  const loginRes = await fetch(KURAMA_LOGIN_URL, {
    method: "POST",
    headers: postHeaders,
    body: postBody.toString(),
    // Set-Cookieを自前で拾いたいため、リダイレクトは自動追跡させない。
    redirect: "manual",
  });
  // 既存Cookie（GET時に発行されたもの）と同名のCookieがPOSTレスポンスの
  // Set-Cookieに含まれていれば、mergeCookiesIntoJar()内のjar.set()により
  // 新しい値で上書きされ、古い値が残ることはない。
  mergeCookiesIntoJar(jar, getSetCookieHeaders(loginRes));

  // 4xx/5xxは明確な失敗として扱う。
  if (loginRes.status >= 400) {
    throw new Error(
      `[login_post_http_error] くらしのマーケットへのログインPOSTがエラーを返しました(HTTP ${loginRes.status})。` +
        "メールアドレス・パスワードが正しいか確認してください。"
    );
  }

  if (loginRes.status >= 300 && loginRes.status < 400) {
    // リダイレクトされた場合、その行き先がログインページ自身であれば失敗と確定する。
    const redirectLocation = loginRes.headers.get("location") || "";
    if (redirectLocation.includes("/shop/login")) {
      throw new Error(
        "[login_post_redirect_to_login] くらしのマーケットへのログインに失敗しました" +
          "（ログインPOSTが/shop/loginへリダイレクトされました）。メールアドレス・パスワードが正しいか確認してください。"
      );
    }
    // ログインページ以外へのリダイレクトであれば、この時点では成功と推測されるが、
    // 下記の二段階チェック（認証必須ページへのアクセス）で最終確認する。
  } else {
    // 200番台: curama.jpはログイン失敗時もHTTP 200でログインページを
    // 再描画するだけなので、本文の中身を見て失敗の兆候がないか確認する。
    // ※ パスワード等の機密情報は変数にもログにも一切出力しない。
    const loginPostHtml = await loginRes.text();
    if (loginPostIndicatesFailure(loginPostHtml)) {
      throw new Error(
        "[login_post_form_redisplayed] くらしのマーケットへのログインに失敗しました" +
          "（ログインPOST後もエラー文言またはログインフォームが返されました）。" +
          "メールアドレス・パスワードが正しいか確認してください。"
      );
    }
  }

  const cookieHeader = buildCookieHeader(jar);
  if (!cookieHeader) {
    throw new Error(
      "[login_no_cookie] ログイン処理後にセッションCookieを取得できませんでした（レスポンス形式が想定と異なる可能性があります）"
    );
  }

  // 3. 二段階チェック（最終確認）: 認証必須ページ（ダッシュボード）へアクセスし、
  //    実際にログイン済みとして扱われるかどうかを確認する。
  //    curama.jpの画面系ルート(/shop/...)は未認証の場合302で/shop/login/へ
  //    リダイレクトするため、これを確実な成否判定として利用する。
  const verifyRes = await fetch(KURAMA_DASHBOARD_URL, {
    method: "GET",
    headers: {
      cookie: cookieHeader,
      "user-agent": REQUEST_USER_AGENT,
    },
    redirect: "manual",
  });
  // ここで新たに発行されたCookieがあれば、念のため取り込んでおく
  // （同名Cookieは上書きされ、古い値は残らない）。
  mergeCookiesIntoJar(jar, getSetCookieHeaders(verifyRes));

  if (verifyRes.status >= 300 && verifyRes.status < 400) {
    const verifyLocation = verifyRes.headers.get("location") || "";
    if (verifyLocation.includes("/shop/login")) {
      throw new Error(
        `[dashboard_redirect_to_login] くらしのマーケットへのログインに失敗しました` +
          `（認証必須ページ ${KURAMA_DASHBOARD_URL} へのアクセスが /shop/login へ` +
          "リダイレクトされ、未認証のセッションであることが確認されました）。" +
          "メールアドレス・パスワードが正しいか確認してください。"
      );
    }
    // /shop/login 以外へのリダイレクトは、認証自体は成功しており単に別ページへ
    // 誘導されているだけと判断し、成功として扱う。
  } else if (!verifyRes.ok) {
    // 200番台でもなく、/shop/loginへのリダイレクトでもない想定外のステータス
    // （例: 500番台など）。判定はできないが、安全側に倒して失敗として扱う。
    throw new Error(
      `[dashboard_unexpected_status] 認証必須ページ(${KURAMA_DASHBOARD_URL})への` +
        `アクセスで想定外のステータスが返されました(HTTP ${verifyRes.status})。` +
        "ログインに失敗している可能性があります。"
    );
  }
  // ここまで到達すれば、200番台での正常応答、またはログインページ以外への
  // リダイレクトが確認できたため、ログイン成功と確定する。

  return buildCookieHeader(jar);
}

/**
 * 2つの日時文字列が同じ瞬間を指しているかどうかを判定する。
 * くらしのマーケット側は常に "+00:00" のオフセット付き文字列を返すが、
 * Googleカレンダー側はイベント作成時に渡した表記そのままではなく、
 * カレンダーのタイムゾーン（例: "+09:00"）に変換した文字列で返してくることが
 * あるため、単純な文字列比較ではなく実際の時刻（エポックミリ秒）で比較する。
 * こうしないと、実際には変更が無いのに毎回「更新」と誤検知してしまう。
 */
function isSameInstant(dateTimeA, dateTimeB) {
  if (!dateTimeA || !dateTimeB) return false;
  const a = Date.parse(dateTimeA);
  const b = Date.parse(dateTimeB);
  if (Number.isNaN(a) || Number.isNaN(b)) return dateTimeA === dateTimeB;
  return a === b;
}

/** YYYY-MM-DD 形式の日付文字列を作る（UTC基準） */
function formatDateYYYYMMDD(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * くらしのマーケットの予約イベント取得APIを叩き、
 * eventTypeId === 2（実際の予約）のイベントだけを抽出して返す。
 * 念のため calendars配列を全件走査する（calendarTypeIdによらず、
 * イベント側のeventTypeIdで判定する）。
 */
async function fetchKuramaReservations(cookieHeader, startDate, endDate) {
  const url = `${KURAMA_EVENTS_API_URL}?start_date=${startDate}&end_date=${endDate}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      cookie: cookieHeader,
      "user-agent": REQUEST_USER_AGENT,
      accept: "application/json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `くらしのマーケットAPIが認証エラーを返しました(HTTP ${res.status})。セッションCookieが無効になっている可能性があります`
    );
  }
  if (!res.ok) {
    throw new Error(`くらしのマーケットの予約データ取得に失敗しました(HTTP ${res.status})`);
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error(
      "くらしのマーケットAPIのレスポンスをJSONとして解析できませんでした: " + err.message
    );
  }

  const calendars = Array.isArray(json.calendars) ? json.calendars : [];
  const reservations = [];
  for (const calendar of calendars) {
    const events = Array.isArray(calendar.events) ? calendar.events : [];
    for (const ev of events) {
      if (ev && ev.eventTypeId === KURAMA_RESERVATION_EVENT_TYPE_ID) {
        reservations.push(ev);
      }
    }
  }
  return reservations;
}

// ================================================================
// Googleカレンダー側の処理
// ================================================================

/** リフレッシュトークンから都度アクセストークンを取得する */
async function getGoogleAccessToken(env) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.access_token) {
    const detail = json && (json.error_description || json.error);
    throw new Error(
      `Googleアクセストークンの取得に失敗しました(HTTP ${res.status})` +
        (detail ? `: ${detail}` : "")
    );
  }
  return json.access_token;
}

/**
 * このWorkerが過去に作成した（SYNC_MARKER_KEY=trueの目印が付いた）
 * Googleカレンダーイベントを、指定期間内から全件取得する（ページング対応）。
 */
async function listSyncedGoogleEvents(accessToken, calendarId, timeMin, timeMax) {
  const events = [];
  let pageToken;

  do {
    const url = new URL(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("maxResults", "2500");
    // privateExtendedPropertyは完全一致(key=value)のみ対応のため、
    // 「このWorkerが作成したイベントである」ことを示す固定の目印で絞り込む。
    url.searchParams.set("privateExtendedProperty", `${SYNC_MARKER_KEY}=${SYNC_MARKER_VALUE}`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      throw new Error(`Googleカレンダーの既存イベント取得に失敗しました(HTTP ${res.status})`);
    }

    for (const item of json.items || []) {
      events.push(item);
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return events;
}

/** Googleカレンダーに作成/更新するイベント本体を組み立てる（詳細情報は含めない） */
function buildGoogleEventPayload(kuramaEvent) {
  return {
    summary: GOOGLE_EVENT_TITLE,
    start: { dateTime: kuramaEvent.start },
    end: { dateTime: kuramaEvent.end },
    extendedProperties: {
      private: {
        [KURAMA_EVENT_ID_KEY]: kuramaEvent.id,
        [SYNC_MARKER_KEY]: SYNC_MARKER_VALUE,
      },
    },
  };
}

async function createGoogleEvent(accessToken, calendarId, kuramaEvent) {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(buildGoogleEventPayload(kuramaEvent)),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`イベント作成に失敗しました(HTTP ${res.status}): ${errText}`);
  }
  return res.json();
}

async function updateGoogleEvent(accessToken, calendarId, googleEventId, kuramaEvent) {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(buildGoogleEventPayload(kuramaEvent)),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`イベント更新に失敗しました(HTTP ${res.status}): ${errText}`);
  }
  return res.json();
}

async function deleteGoogleEvent(accessToken, calendarId, googleEventId) {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  // Googleは既に削除済み/存在しないイベントに404や410を返すことがあるが、
  // 「Googleカレンダー上に存在しない」という目的自体は達成されているため、
  // これらはエラー扱いにしない。
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const errText = await res.text().catch(() => "");
    throw new Error(`イベント削除に失敗しました(HTTP ${res.status}): ${errText}`);
  }
}

// ================================================================
// 同期処理本体
// ================================================================

/**
 * 同期処理を1回実行する。
 * 途中の各ステップ（ログイン／予約取得／Google認証／Google既存イベント取得）で
 * 失敗した場合は、その時点で処理を中断し、Googleカレンダー側へは一切書き込みを
 * 行わない（部分的な失敗でデータを壊さないようにするため）。
 * 個々のイベントの作成/更新/削除でエラーが起きた場合は、そのイベントだけ
 * スキップして他のイベントの処理は続行する。
 */
async function runSync(env) {
  const summary = { created: 0, updated: 0, deleted: 0, unchanged: 0, errors: [] };

  const requiredEnvVars = [
    "KURAMA_EMAIL",
    "KURAMA_PASSWORD",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_CALENDAR_ID",
  ];
  const missingEnvVars = requiredEnvVars.filter((key) => !env[key]);
  if (missingEnvVars.length > 0) {
    const message = `必須の環境変数が未設定です: ${missingEnvVars.join(", ")}`;
    console.error("[kurama-sync] " + message);
    return { ok: false, stage: "env_check", error: message, ...summary };
  }

  // ---- 1. くらしのマーケットへログイン -----------------------------------
  let cookieHeader;
  try {
    cookieHeader = await loginToKurama(env);
  } catch (err) {
    console.error("[kurama-sync] ログイン処理でエラーが発生したため中断します: " + err.message);
    return { ok: false, stage: "login", error: err.message, ...summary };
  }
  console.log("[kurama-sync] くらしのマーケットへのログインに成功しました");

  // ---- 2. 予約データ取得（今日から60日後まで） ----------------------------
  const today = new Date();
  const rangeEndDate = new Date(today.getTime() + SYNC_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const startDateStr = formatDateYYYYMMDD(today);
  const endDateStr = formatDateYYYYMMDD(rangeEndDate);

  let kuramaReservations;
  try {
    kuramaReservations = await fetchKuramaReservations(cookieHeader, startDateStr, endDateStr);
  } catch (err) {
    console.error("[kurama-sync] 予約データ取得でエラーが発生したため中断します: " + err.message);
    return { ok: false, stage: "fetch_reservations", error: err.message, ...summary };
  }
  console.log(
    `[kurama-sync] くらしのマーケットから予約イベントを${kuramaReservations.length}件取得しました（期間: ${startDateStr}〜${endDateStr}）`
  );

  // ---- 3. Googleアクセストークン取得 --------------------------------------
  let accessToken;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (err) {
    console.error("[kurama-sync] Googleアクセストークン取得でエラーが発生したため中断します: " + err.message);
    return { ok: false, stage: "google_token", error: err.message, ...summary };
  }

  // ---- 4. Google側の既存の同期済みイベントを取得 ---------------------------
  const calendarId = env.GOOGLE_CALENDAR_ID;
  // 少し余裕を持たせて前後1日分を含めて取得する（時差やタイミングのずれ対策）。
  const timeMin = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(rangeEndDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();

  let existingGoogleEvents;
  try {
    existingGoogleEvents = await listSyncedGoogleEvents(accessToken, calendarId, timeMin, timeMax);
  } catch (err) {
    console.error("[kurama-sync] Googleカレンダーの既存イベント取得でエラーが発生したため中断します: " + err.message);
    return { ok: false, stage: "list_google_events", error: err.message, ...summary };
  }
  console.log(
    `[kurama-sync] Googleカレンダー側の同期済みイベントを${existingGoogleEvents.length}件取得しました`
  );

  // kurama_event_id -> Googleイベント のマップを構築する
  const googleEventByKuramaId = new Map();
  for (const item of existingGoogleEvents) {
    const kuramaId =
      item.extendedProperties &&
      item.extendedProperties.private &&
      item.extendedProperties.private[KURAMA_EVENT_ID_KEY];
    if (kuramaId) {
      googleEventByKuramaId.set(kuramaId, item);
    }
  }

  const currentKuramaIds = new Set(kuramaReservations.map((ev) => ev.id));

  // ---- 5. 新規作成 / 更新 --------------------------------------------------
  for (const kuramaEvent of kuramaReservations) {
    const existing = googleEventByKuramaId.get(kuramaEvent.id);

    if (!existing) {
      try {
        await createGoogleEvent(accessToken, calendarId, kuramaEvent);
        summary.created++;
      } catch (err) {
        console.error(
          `[kurama-sync] イベント作成でエラー(kurama_event_id=${kuramaEvent.id}): ` + err.message
        );
        summary.errors.push(`create:${kuramaEvent.id}:${err.message}`);
      }
      continue;
    }

    const startChanged = !isSameInstant(existing.start && existing.start.dateTime, kuramaEvent.start);
    const endChanged = !isSameInstant(existing.end && existing.end.dateTime, kuramaEvent.end);
    const wasCancelled = existing.status === "cancelled";

    if (startChanged || endChanged || wasCancelled) {
      try {
        await updateGoogleEvent(accessToken, calendarId, existing.id, kuramaEvent);
        summary.updated++;
      } catch (err) {
        console.error(
          `[kurama-sync] イベント更新でエラー(kurama_event_id=${kuramaEvent.id}): ` + err.message
        );
        summary.errors.push(`update:${kuramaEvent.id}:${err.message}`);
      }
    } else {
      summary.unchanged++;
    }
  }

  // ---- 6. 削除（くらしのマーケット側から無くなった予約） ---------------------
  for (const [kuramaId, googleEvent] of googleEventByKuramaId.entries()) {
    if (currentKuramaIds.has(kuramaId)) continue;
    // 既にキャンセル済み(status: cancelled)のイベントは重ねて削除操作をしない。
    if (googleEvent.status === "cancelled") continue;

    try {
      await deleteGoogleEvent(accessToken, calendarId, googleEvent.id);
      summary.deleted++;
    } catch (err) {
      console.error(`[kurama-sync] イベント削除でエラー(kurama_event_id=${kuramaId}): ` + err.message);
      summary.errors.push(`delete:${kuramaId}:${err.message}`);
    }
  }

  const resultMessage =
    `[kurama-sync] 同期完了: 作成${summary.created}件 / 更新${summary.updated}件 / ` +
    `削除${summary.deleted}件 / 変更なし${summary.unchanged}件` +
    (summary.errors.length > 0 ? ` / エラー${summary.errors.length}件` : "");
  console.log(resultMessage);

  return { ok: summary.errors.length === 0, stage: "done", ...summary };
}

// ================================================================
// エントリーポイント
// ================================================================

export default {
  /** Cron Triggerによって定期的に呼び出されるハンドラ */
  async scheduled(event, env, ctx) {
    console.log(`[kurama-sync] Cron Triggerにより起動しました（cron: ${event.cron}）`);
    // scheduled内の非同期処理が完了する前にWorkerが終了しないよう、
    // ctx.waitUntil() で処理の完了をCloudflareに伝える。
    ctx.waitUntil(runSync(env));
  },

  /**
   * 手動テスト用のHTTPエンドポイント。
   * 本番運用ではCron Triggerが自動実行するため通常は不要だが、導入直後の
   * 動作確認や、トラブル時に即座に同期をやり直したい場合のために用意している。
   * 誤操作・第三者による無断実行を防ぐため、環境変数 MANUAL_TRIGGER_TOKEN と
   * 一致するクエリパラメータ ?token=... が無い限り、同期処理は実行しない。
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (url.searchParams.has("token")) {
      const token = url.searchParams.get("token");
      if (!env.MANUAL_TRIGGER_TOKEN || token !== env.MANUAL_TRIGGER_TOKEN) {
        return new Response("認証エラー: token が正しくありません。", { status: 403 });
      }

      let result;
      try {
        result = await runSync(env);
      } catch (err) {
        // runSync内で想定済みのエラーはすべてcatchされ { ok:false, ... } が
        // 返る設計だが、念のため予期しない例外にも備えておく。
        console.error("[kurama-sync] 手動実行中に予期しないエラー: " + err.message);
        return new Response(
          JSON.stringify({ ok: false, stage: "unexpected", error: err.message }, null, 2),
          { status: 500, headers: { "content-type": "application/json; charset=UTF-8" } }
        );
      }

      return new Response(JSON.stringify(result, null, 2), {
        status: result.ok ? 200 : 500,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    // トークンが無い場合は、同期処理を一切実行せず動作確認用ページのみ表示する。
    return new Response(
      `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>くらしのマーケット予約同期Worker</title></head>
<body>
  <h1>くらしのマーケット予約 → Googleカレンダー同期Worker</h1>
  <p>このWorkerは、くらしのマーケットの予約データを定期的に取得し、
  Googleカレンダーへ「予定あり」として反映するためのものです。
  このページが表示されていればWorker自体は正常に動作しています。</p>
  <p>通常はCron Triggerが自動的に実行するため、このページを操作する必要はありません。</p>
</body>
</html>`,
      { headers: { "content-type": "text/html; charset=UTF-8" } }
    );
  },
};
