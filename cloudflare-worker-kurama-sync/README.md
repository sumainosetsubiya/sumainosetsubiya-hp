# くらしのマーケット予約 → Googleカレンダー同期Worker（Cloudflare Worker）

このフォルダには、「くらしのマーケット」の事業者管理画面から予約データを
定期的に取得し、Googleカレンダーに「予定あり」として反映するための
Cloudflare Worker（Cron Triggerによる定期実行バッチ）一式が入っています。

- `worker.js` … Workerの本体コード（このままコピー、または`wrangler deploy`で使用）
- `wrangler.toml` … wrangler CLIでデプロイする場合の設定ファイル（Cron Trigger設定を含む）

Googleカレンダー側に反映されるのは**「予定あり」ということだけ**です。
工事内容などの詳細（お客様情報・依頼内容）は一切転記されません
（プライバシー・情報漏洩リスクを避けるための方針です）。

---

## 重要：認証情報の取り扱いについて

このWorkerには、くらしのマーケットのログイン情報とGoogleの認証情報という、
**非常に機密性の高い情報**を設定する必要があります。

- これらの値は、**必ずCloudflareダッシュボードの「Secret（暗号化）」欄に直接入力**してください。
- チャット（Claude等のAIとの会話）や、メール・チャットツールなど、
  **いかなる第三者にもこれらの値を共有しないでください**。AIアシスタントに
  「これを設定して」と貼り付けて依頼することも避けてください。
- パスワードやトークンは、この`README.md`や`wrangler.toml`、`worker.js`など
  **コード中に直接書き込まないでください**（Gitリポジトリに残ってしまいます）。

---

## 事前に必要なもの

1. Cloudflareアカウント（無料プランで可）
2. くらしのマーケット事業者アカウントのログインメールアドレス・パスワード
3. Google Cloud Platform（GCP）でのOAuthクライアント（Client ID / Client Secret）と、
   Googleカレンダーへの書き込み権限を持つ「リフレッシュトークン」
4. 予定を反映する先のGoogleカレンダーの「カレンダーID」

2〜4の取得方法は以下で説明します。

---

## 事前準備1: Google Cloud Platform側の設定

### 1-1. プロジェクトの作成とCalendar APIの有効化

1. https://console.cloud.google.com/ にアクセスし、Googleアカウントでログインする。
2. 画面上部のプロジェクト選択から「新しいプロジェクト」を作成する（例: `kurama-calendar-sync`）。
3. 左メニュー「APIとサービス」→「ライブラリ」を開き、「Google Calendar API」を検索して
   「有効にする」を押す。

### 1-2. OAuth同意画面の設定

1. 左メニュー「APIとサービス」→「OAuth 同意画面」を開く。
2. User Type は「外部」を選択（個人のGoogleアカウントで使う場合）。
3. アプリ名（例: `kurama-calendar-sync`）、ユーザーサポートメール、
   デベロッパーの連絡先情報を入力して保存する。
4. 「テストユーザー」の追加画面で、実際にGoogleカレンダーを使う
   Googleアカウント（依頼主のGmailアドレス）を追加しておく
   （公開審査を受けない「テスト」状態のまま使い続けられます）。

### 1-3. OAuthクライアントIDの作成

1. 左メニュー「APIとサービス」→「認証情報」を開く。
2. 「認証情報を作成」→「OAuth クライアント ID」を選択する。
3. アプリケーションの種類は「デスクトップアプリ」を選ぶ（リフレッシュトークンを
   手動取得する用途に最も簡単な設定のため）。
4. 作成後に表示される **クライアントID** と **クライアントシークレット** を控えておく
   （これが `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` になります）。

### 1-4. リフレッシュトークンの取得（Google OAuth Playgroundを使う方法）

このWorkerは「一度だけ手動で取得したリフレッシュトークン」を使い続けて
アクセストークンを更新する方式です。取得には Google公式の
「[OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)」
を使うのが最も簡単です。

1. https://developers.google.com/oauthplayground/ を開く。
2. 右上の歯車アイコン（設定）をクリックし、「Use your own OAuth credentials」に
   チェックを入れ、1-3で控えた `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を入力する。
3. 画面左の「Step 1」欄に、Calendar APIのスコープを入力する。
   - `https://www.googleapis.com/auth/calendar.events`
   （カレンダーの予定の読み書きのみに絞ったスコープ。予定の作成・更新・削除・
   一覧取得に必要な権限がこれで足ります）
4. 「Authorize APIs」を押し、反映先のGoogleカレンダーを持つGoogleアカウントで
   ログインし、アクセスを許可する。
5. 「Step 2」画面で「Exchange authorization code for tokens」を押す。
6. 表示される **Refresh token** の値を控えておく（これが `GOOGLE_REFRESH_TOKEN` になります）。
   Access tokenの方は控える必要はありません（Workerが自動で取得し直します）。

**注意:** OAuth同意画面が「テスト」状態のままだと、リフレッシュトークンの
有効期限が7日程度に制限される場合があります。長期間安定して動かすには、
OAuth同意画面を「本番」に公開する（個人利用のみなら審査不要な範囲で公開できることが
多いです）か、期限切れた場合は本手順を再実施してリフレッシュトークンを
取り直してください。

### 1-5. Googleカレンダー ID の確認

1. Google カレンダー（https://calendar.google.com/）を開く。
2. 予定を反映したいカレンダーの左側の「⋮」（その他のメニュー）→
   「設定と共有」を開く。
3. 「カレンダーの統合」欄にある **カレンダー ID** を控える
   （自分のメインカレンダーの場合は自分のGmailアドレスがそのままIDになっていることが多く、
   別途作成したカレンダーの場合は `xxxxxxxx@group.calendar.google.com` の形式になります）。
   これが `GOOGLE_CALENDAR_ID` になります。

---

## 事前準備2: 手動テスト用トークンを決める

`MANUAL_TRIGGER_TOKEN` は、このWorker自身が発行する値ではなく、
**依頼主が好きな文字列を決めて登録するもの**です。第三者に推測されにくい、
ランダムな英数字の文字列（20文字程度）を決めてください。
（例えばパスワード生成ツールで生成したものでも構いません。)

---

## 方法A: wrangler CLI を使う方法

1. Node.js がインストールされていることを確認する（ターミナルで `node -v` を実行）。
2. このフォルダに移動する。
   ```
   cd cloudflare-worker-kurama-sync
   ```
3. Cloudflareにログインする（ブラウザが開くので、Cloudflareアカウントで認証する）。
   ```
   npx wrangler login
   ```
4. Workerをデプロイする（`wrangler.toml`のCron Trigger設定も同時に反映されます）。
   ```
   npx wrangler deploy
   ```
   成功すると、ターミナルに `https://kurama-calendar-sync.あなたのサブドメイン.workers.dev`
   のようなURLが表示されます。これが「Worker URL」です。控えておいてください。
5. 環境変数（シークレット）を1つずつ設定する。実行し、聞かれたら値を貼り付けて Enter。
   ```
   npx wrangler secret put KURAMA_EMAIL
   npx wrangler secret put KURAMA_PASSWORD
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put GOOGLE_REFRESH_TOKEN
   npx wrangler secret put GOOGLE_CALENDAR_ID
   npx wrangler secret put MANUAL_TRIGGER_TOKEN
   ```

以上でデプロイは完了です。Cron Triggerは`wrangler.toml`の設定
（6時間おき）が自動的に反映されています。

---

## 方法B: Cloudflareダッシュボードから直接貼り付けてデプロイする方法

wrangler CLIやNode.jsを使いたくない場合は、こちらの方法でも同じものが
デプロイできます。ただし、この方法では**Cron Triggerを手動で追加設定する
必要があります**（下記手順11を参照）。

1. https://dash.cloudflare.com/ にログインする。
2. 左メニューの「Workers & Pages」を開き、「Create（作成）」→「Workers」→
   「Create Worker（Workerを作成）」を選ぶ。
3. Worker名を入力する（例: `kurama-calendar-sync`）。そのまま「Deploy（デプロイ）」を押す
   （この時点では中身は空のテンプレートのままでよい）。
4. デプロイ後の画面で「Edit code（コードを編集）」を押す。
5. エディタの中身をすべて削除し、この中の `worker.js` の中身を全文コピーして貼り付ける。
6. 右上の「Deploy（デプロイ）」を押して保存する。
7. 画面上部などに表示される、このWorkerの公開URL
   （`https://kurama-calendar-sync.あなたのサブドメイン.workers.dev` の形式）を控えておく。
   これが「Worker URL」です。
8. Workerの管理画面で「Settings（設定）」タブ →
   「Variables and Secrets（変数とシークレット）」を開く。
9. 「Add（追加）」から、以下をすべて追加する（タイプは必ず **Secret（暗号化）** を選択）。
   - `KURAMA_EMAIL` … くらしのマーケットのログインメールアドレス
   - `KURAMA_PASSWORD` … くらしのマーケットのログインパスワード
   - `GOOGLE_CLIENT_ID` … Google OAuth クライアントID
   - `GOOGLE_CLIENT_SECRET` … Google OAuth クライアントシークレット
   - `GOOGLE_REFRESH_TOKEN` … Google OAuth リフレッシュトークン
   - `GOOGLE_CALENDAR_ID` … 反映先のGoogleカレンダーID
   - `MANUAL_TRIGGER_TOKEN` … 手動テスト実行用に決めた秘密の文字列
10. 「Save（保存）」または「Deploy」を押して反映する。
11. **Cron Triggerを設定する。** Workerの管理画面で「Settings（設定）」タブ →
    「Triggers（トリガー）」を開き、「Cron Triggers」欄の「Add Cron Trigger」を押す。
    cron式に `0 */6 * * *`（6時間おき）を入力して保存する。

以上でデプロイは完了です。

---

## 動作確認（手動テスト）

Cron Triggerによる自動実行を待たずに、今すぐ同期処理を試したい場合は、
ブラウザで次のURLにアクセスしてください（`MANUAL_TRIGGER_TOKEN`に設定した値に
書き換えてください）。

```
https://kurama-calendar-sync.あなたのサブドメイン.workers.dev/?token=あなたが設定したMANUAL_TRIGGER_TOKENの値
```

正常に動作すれば、作成・更新・削除件数などをまとめたJSONがブラウザに表示されます。
`token`を付けずにWorker URLへアクセスした場合や、`token`の値が間違っている場合は、
同期処理は一切実行されず、簡単な案内ページ（または403エラー）が表示されるだけです。

より詳しいログ（何件のイベントを取得したか、途中でどんなエラーが起きたか等）は、
Cloudflareダッシュボードの当該Worker → 「Logs（ログ）」（リアルタイムログ）
または「Logs」タブの実行履歴から確認できます。

---

## このWorkerの仕組み（技術メモ）

- `scheduled`ハンドラ … Cron Triggerにより6時間おきに自動実行され、同期処理
  （`runSync()`）を実行する。
- `fetch`ハンドラ … `?token=...`が`MANUAL_TRIGGER_TOKEN`と一致した場合のみ、
  手動で同期処理を実行できる（動作確認・トラブル時の即時再同期用）。
- 同期処理の流れ:
  1. `https://curama.jp/shop/login` にGETし、HTML中の`_csrf`トークンを正規表現で抽出する。
  2. `email` / `password` / `_csrf` をPOSTしてログインし、レスポンスの
     `Set-Cookie`ヘッダーからセッションCookieを取得する。
  3. 取得したCookieを使い、今日から60日後までの予約イベントをAPIから取得する。
  4. `eventTypeId === 2`（実際の予約）のイベントだけを抽出する
     （`calendarTypeId: 1`側の営業時間テンプレート等は無視する）。
  5. Googleカレンダー側の、このWorkerが過去に作成したイベント一覧
     （`extendedProperties.private.kurama_sync = "true"`という目印で絞り込み）を取得する。
  6. くらしのマーケット側のイベントID（`extendedProperties.private.kurama_event_id`）を
     軸に差分を計算し、新規は作成・消えた予約は削除・日時が変わっていれば更新する。
  7. 作成/更新/削除/変更なしの件数を`console.log`で出力する。

### Cookie/セッション管理について（Cloudflare Workers特有の注意点）

ブラウザと違い、Workersの`fetch()`はCookieを自動的に保存・送信してくれません
（リクエストをまたいだ状態は一切保持されない、ステートレスな実行環境のため）。
そのため、このWorkerでは自前の簡易Cookieジャー（`Map`）を実装し、

1. ログインページGETのレスポンスから`Set-Cookie`を手動で拾い、
2. それをログインPOSTリクエストのCookieヘッダーに手動で載せて送り、
3. ログインPOSTレスポンスの`Set-Cookie`（本セッションCookie）をさらに拾って合成し、
4. 以降の予約データ取得APIリクエストのCookieヘッダーとして使い回す

という流れを手動で行っています。また、ログイン成功時はリダイレクト（3xx）が
返ると推測されるため、`redirect: "manual"`を指定してリダイレクトを自動追跡させず、
リダイレクトレスポンス自体の`Set-Cookie`を確実に取得できるようにしています。
複数の`Set-Cookie`を正しく読み取るため、Cloudflare Workersが対応している
`Headers.getSetCookie()`（Fetch標準の拡張API）を使用しています。

### 差分同期（重複防止）のロジック

Googleカレンダー側に作成するイベントには、`extendedProperties.private`に
以下の2つの値を埋め込んでいます。

- `kurama_event_id` … くらしのマーケット側のイベントID（1件ごとのユニークキー）。
  これを軸に「くらしのマーケット側の予約」と「Googleカレンダー側のイベント」を
  1対1で突き合わせる。
- `kurama_sync` … 常に`"true"`固定。「このWorkerが作成したイベントである」ことを
  示す目印。Google Calendar APIの`privateExtendedProperty`フィルタは
  完全一致（`key=value`）検索のみに対応しており、「`kurama_event_id`が何かしら
  設定されている」というワイルドカード検索はできないため、絞り込み専用の
  固定値キーを別途用意している。

毎回の同期では、この目印を使ってGoogleカレンダー側の「このWorkerが管理している
イベント一覧」を取得し、くらしのマーケット側の最新の予約一覧と突き合わせて、

- くらしのマーケット側にあってGoogle側に無い → 新規作成
- 両方にあるが開始/終了日時が変わっている → 更新
- Google側にあってくらしのマーケット側に無くなった（キャンセル等） → 削除

を行います。ユーザーが他の予定と間違って手動で削除した場合や、他の目的で
作成したイベントは対象外です（`kurama_sync`の目印が付いていないため）。

---

## 未検証・不確実な部分について（正直な報告）

実際のくらしのマーケットのログイン情報・GoogleのOAuth認証情報がまだ無いため、
**実際のログイン・API呼び出しは一度もテストできていません**。
コードは開発者ツールで確認された仕様書通りに実装し、構文チェック
（`node --check worker.js`）とロジックの妥当性のセルフレビューのみ行っています。
実際に稼働させる際は、特に以下の点で調整が必要になる可能性があります。

- **ログイン成功時のレスポンス形式**: ステータスコード（302等と推測）や
  `Set-Cookie`が実際にどう返るか未確認です。想定と異なる形式だった場合、
  `loginToKurama()`内のステータスコード判定やCookie抽出処理の調整が必要になる
  可能性があります。
- **ログイン失敗時のレスポンス**: パスワード誤り等の失敗時にどのような
  ステータスコード・HTML（エラーメッセージ）が返るか未確認です。現状は
  「HTTP 400番台ならログイン失敗」という単純な判定にしています。
- **CSRF保護の仕組み**: ログインページGET時に発行される可能性のある
  CSRF保護用Cookieの有無・名前は未確認です。現状は「GETレスポンスの
  Set-Cookieをすべて後続リクエストに引き継ぐ」という一般的な作りにしています。
- **API側のセッション切れの挙動**: 予約取得APIがセッション切れ時に
  401/403以外のステータス（例えば200でログインページのHTMLを返す等）を
  返す可能性も考えられ、その場合はエラー検知ロジックの追加が必要になるかもしれません。

実際の認証情報を設定した後、まずは手動テスト用URL（`?token=...`）で1回実行し、
Cloudflareダッシュボードの「Logs」でエラーが出ていないか、Googleカレンダーに
正しく「予定あり」のイベントが作成されるかを確認することを推奨します。
うまく動かない場合は、そのときのログメッセージを教えていただければ調整します。
