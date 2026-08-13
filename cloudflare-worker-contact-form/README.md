# お問い合わせフォーム送信プロキシ（Cloudflare Worker + Resend）

このフォルダには、`contact.html` のお問い合わせフォームから送信された内容を受け取り、
メール送信API「[Resend](https://resend.com/)」経由で依頼主のGmail
（`sumainosetsubiya@gmail.com`）宛にメールを送るためのコード一式が入っています。

これまで使っていた外部フォーム送信サービス「Formspree」を廃止し、自前のWorkerに
置き換えるためのものです。

- `worker.js` … Workerの本体コード（このままコピー、または`wrangler deploy`で使用）
- `wrangler.toml` … wrangler CLIでデプロイする場合の設定ファイル

デプロイ方法は次の2通りです。**どちらか一方だけ**実施すれば十分です。
IT作業に慣れていない場合は「方法B（ダッシュボードで貼り付け）」の方が簡単です。

---

## 事前に必要なもの

- Cloudflareアカウント（無料プランで可。サイトのドメイン `sumainosetsubiya.com` の
  DNS管理をすでにCloudflareで行っていること）
- Resendアカウントと、Resend APIキー
  （まだお持ちでない場合は、下の「Resend側の準備（ドメイン検証）」を先に行ってください）

このWorkerだけを単体でデプロイしても、Resend側の設定（ドメイン検証・APIキー発行）が
終わっていないとメール送信は動作しません。両方セットで完了させる必要があります。

---

## Resend側の準備（ドメイン検証）

Resendでは、Gmail等の一般的な無料メールアドレスを「送信元」に使うことはできません。
自分が所有し、DNS認証（SPF/DKIM）を済ませたドメインだけが送信元として使えます。
このWorkerでは、本番サイトのドメイン（`sumainosetsubiya.com`）とは別に、
メール送信専用の**サブドメイン**（`send.sumainosetsubiya.com`）を使う想定にしています
（Resend公式が推奨する構成です。サイト本体の評判とメール送信の評判を分けることで、
万一メールが迷惑メール扱いされてもサイト本体には影響しないようにするためです）。

1. https://resend.com/ でアカウントを作成する（まだの場合）。
2. Resendダッシュボードの左メニューから「Domains（ドメイン）」を開き、
   「Add Domain（ドメインを追加）」を押す。
3. ドメイン名として `send.sumainosetsubiya.com` と入力して追加する
   （本体ドメインの `sumainosetsubiya.com` ではなく、頭に `send.` を付けた
   サブドメインを入力する点に注意）。
4. 追加すると、Resendの画面に**いくつかのDNSレコード**（種類・ホスト名・値の一覧。
   通常はMXレコードとTXTレコード〔SPF用〕、TXTレコード〔DKIM用〕など）が表示される。
   この画面はそのまま開いておく。
5. 別タブで https://dash.cloudflare.com/ にログインし、`sumainosetsubiya.com` の
   ドメインを選択、左メニューの「DNS」→「Records（レコード）」を開く。
6. 手順4でResendに表示された内容を、Cloudflareの「Add record（レコードを追加）」
   から**1つずつ**、種類・名前（ホスト名）・値をそのまま転記して追加していく
   （プロキシ状態のスイッチは「DNS only（グレーの雲マーク）」にしておく。
   オレンジ色の「Proxied」にするとメール認証がうまく機能しない場合があるため）。
7. すべて追加したら、Resendのドメイン追加画面に戻り「Verify DNS Records
   （DNSレコードを検証）」のようなボタンを押す。DNSの反映には数分〜最大72時間
   ほどかかることがあるため、すぐに緑色の「Verified（検証済み）」にならなくても
   焦らず時間をおいて再確認する。
8. ドメインが検証済みになったら、ダッシュボード左メニューの「API Keys」を開き、
   「Create API Key（APIキーを作成）」を押してAPIキーを発行する。
   **表示されたキーはこの画面でしか確認できないため、必ずこの場でコピーして
   安全な場所に控えておく**（次の手順でCloudflare側に登録する）。

---

## 方法A: wrangler CLI を使う方法

1. Node.js がインストールされていることを確認する（ターミナルで `node -v` を実行）。
2. このフォルダに移動する。
   ```
   cd cloudflare-worker-contact-form
   ```
3. Cloudflareにログインする（ブラウザが開くので、Cloudflareアカウントで認証する）。
   ```
   npx wrangler login
   ```
4. Workerをデプロイする。
   ```
   npx wrangler deploy
   ```
   成功すると、ターミナルに `https://contact-form-handler.あなたのサブドメイン.workers.dev`
   のようなURLが表示されます。これが「Worker URL」です。控えておいてください。
5. 環境変数（シークレット）を設定する。実行し、聞かれたら Resend で発行した
   APIキーを貼り付けて Enter。
   ```
   npx wrangler secret put RESEND_API_KEY
   ```
6. 控えておいた「Worker URL」を、`contact.html` の `<form>` タグの `action` に
   書き換える（詳しくは下の「contact.htmlの書き換え」を参照）。

以上でデプロイは完了です。

---

## 方法B: Cloudflareダッシュボードから直接貼り付けてデプロイする方法

wrangler CLIやNode.jsを使いたくない場合は、こちらの方法でも同じものがデプロイできます。

1. https://dash.cloudflare.com/ にログインする。
2. 左メニューの「Workers & Pages」を開き、「Create（作成）」→「Workers」→
   「Create Worker（Workerを作成）」を選ぶ。
3. Worker名を入力する（例: `contact-form-handler`）。そのまま「Deploy（デプロイ）」を押す
   （この時点では中身は空のテンプレートのままでよい）。
4. デプロイ後の画面で「Edit code（コードを編集）」を押す。
5. エディタの中身をすべて削除し、この中の `worker.js` の中身を全文コピーして貼り付ける。
6. 右上の「Deploy（デプロイ）」を押して保存する。
7. 画面上部などに表示される、このWorkerの公開URL
   （`https://contact-form-handler.あなたのサブドメイン.workers.dev` の形式）を控えておく。
   これが「Worker URL」です。
8. Workerの管理画面で「Settings（設定）」タブ →
   「Variables and Secrets（変数とシークレット）」を開く。
9. 「Add（追加）」から、以下を追加する。
   - 変数名: `RESEND_API_KEY` / 値: Resendで発行したAPIキー / タイプ: **Secret（暗号化）**
10. 「Save（保存）」または「Deploy」を押して反映する。
11. 控えておいた「Worker URL」を、`contact.html` の `<form>` タグの `action` に
    書き換える（詳しくは下の「contact.htmlの書き換え」を参照）。

以上でデプロイは完了です。

---

## contact.htmlの書き換え

`contact.html` の `<form>` タグは、現時点では次のようなプレースホルダーになっています。

```html
<form class="card" action="https://contact-form-handler.YOUR-SUBDOMAIN.workers.dev" method="POST" enctype="multipart/form-data">
```

`YOUR-SUBDOMAIN` の部分を、上の手順で控えた実際のWorker URLのサブドメイン部分に
書き換えてください（例: `https://contact-form-handler.abc123.workers.dev`）。
書き換え後、`git add` → `git commit` → `git push` してサイトに反映すれば、
以降のお問い合わせはこのWorker経由でメール送信されるようになります。

**注意:** この書き換えを行うまでは、`contact.html` はまだ実際に送信できる宛先が
設定されていない状態です（プレースホルダーのURLにはPOSTしても届きません）。
Resendのドメイン検証・APIキー発行・Workerデプロイ・この書き換えの4つが
すべて揃って初めて本番運用できます。

---

## 動作確認

Worker URL（例: `https://contact-form-handler.xxxx.workers.dev`）に
ブラウザでアクセスし、「お問い合わせフォーム送信プロキシ」というページが
表示されれば、Worker自体は正常に動いています。

実際のメール送信の確認は、`RESEND_API_KEY` の設定と `contact.html` の
`action` 書き換えが終わった後、実際にテスト送信を行って確認してください。
届かない場合は、下の「トラブルが起きた場合」を参照してください。

---

## このWorkerの仕組み（技術メモ）

- `POST /`（Worker URLへの直接POST） … `contact.html` のフォームから送信された
  `multipart/form-data` を受け取り、`Request.formData()`（Cloudflare Workers標準機能）
  で自動的にパースする。独自のmultipartパーサーは実装していない。
- ハニーポット（スパム対策）: フォーム内の隠しフィールド `_gotcha`
  （人間には見えないが、フォームを機械的に解析するボットが埋めがちなフィールド）に
  値が入っていた場合、メール送信を行わずに完了ページへリダイレクトする
  （＝送信者からは成功したように見えるが、実際には何も送られない）。
- メール送信は Resend API（`https://api.resend.com/emails`）へのPOSTで行う。
  件名・本文（HTML/テキスト両方）・返信先（`reply_to` にお客様のメールアドレスを設定し、
  依頼主がメールにそのまま返信すればお客様に届くようにしている）を組み立てて送信する。
- 添付画像（`添付画像` フィールド、複数可）は `File.arrayBuffer()` でバイナリを取得し、
  Base64文字列に変換したうえで、Resendの `attachments` パラメータに載せて送信する。
  合計サイズが大きすぎる場合（目安25MB超）はエラーメッセージを返し送信を中止する。
- `RESEND_API_KEY` はWorkerのサーバー側だけで使われ、ブラウザ側に渡ることはない。
- 送信成功時・ハニーポット検知時のいずれも `https://www.sumainosetsubiya.com/contact-thanks.html`
  へ302リダイレクトする。送信失敗時は日本語のエラーメッセージを含むHTMLページを返す。
- CORS（`OPTIONS`メソッドへの応答、`Access-Control-Allow-Origin`等のヘッダー）にも
  対応済み。通常のHTMLフォーム送信（ページ遷移）ではCORS制約自体を受けないが、
  将来fetch/XHRベースの送信に変更する場合にも対応できるようにしている。
- KVやデータベースなどの追加リソースは一切使わない、ステートレスな実装。

トラブルが起きた場合は、以下の2箇所を確認してください。

- Cloudflareダッシュボードの当該Worker → 「Logs（ログ）」からリアルタイムの
  エラーを確認できる（Workerが正しく起動しているか、RESEND_API_KEYが
  設定されているか等）。
- Resendダッシュボードの「Logs（ログ）」または「Emails」から、実際に
  送信リクエストが届いているか、Resend側でエラーになっていないか
  （ドメイン未検証、APIキーが無効、等）を確認できる。
