# Decap CMS 用 GitHub OAuth プロキシ（Cloudflare Worker）

このフォルダには、Decap CMS（管理画面）がGitHubへログインするために必要な
「OAuthプロキシ」を Cloudflare Workers 上で動かすためのコード一式が入っています。

- `worker.js` … Workerの本体コード（このままコピー、または`wrangler deploy`で使用）
- `wrangler.toml` … wrangler CLIでデプロイする場合の設定ファイル

デプロイ方法は次の2通りです。**どちらか一方だけ**実施すれば十分です。
IT作業に慣れていない場合は「方法B（ダッシュボードで貼り付け）」の方が簡単です。

---

## 事前に必要なもの

- Cloudflareアカウント（無料プランで可）
- GitHub OAuth App の **Client ID** と **Client Secret**
  （`MIGRATION_GUIDE.md` の手順4で取得したもの）

このWorkerだけを単体でデプロイしても、まだ動作確認はできません。
GitHub OAuth Appの「Authorization callback URL」に、このWorkerのURL + `/callback`
を設定して初めて一連の流れが繋がります（`MIGRATION_GUIDE.md` 手順4・7を参照）。

---

## 方法A: wrangler CLI を使う方法

1. Node.js がインストールされていることを確認する（ターミナルで `node -v` を実行）。
2. このフォルダに移動する。
   ```
   cd cloudflare-worker-oauth
   ```
3. Cloudflareにログインする（ブラウザが開くので、Cloudflareアカウントで認証する）。
   ```
   npx wrangler login
   ```
4. Workerをデプロイする。
   ```
   npx wrangler deploy
   ```
   成功すると、ターミナルに `https://decap-cms-oauth-proxy.あなたのサブドメイン.workers.dev`
   のようなURLが表示されます。これが「Worker URL」です。控えておいてください。
5. 環境変数（シークレット）を設定する。1つずつ実行し、聞かれたら値を貼り付けて Enter。
   ```
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```

以上でデプロイは完了です。

---

## 方法B: Cloudflareダッシュボードから直接貼り付けてデプロイする方法

wrangler CLIやNode.jsを使いたくない場合は、こちらの方法でも同じものがデプロイできます。

1. https://dash.cloudflare.com/ にログインする。
2. 左メニューの「Workers & Pages」を開き、「Create（作成）」→「Workers」→
   「Create Worker（Workerを作成）」を選ぶ。
3. Worker名を入力する（例: `decap-cms-oauth-proxy`）。そのまま「Deploy（デプロイ）」を押す
   （この時点では中身は空のテンプレートのままでよい）。
4. デプロイ後の画面で「Edit code（コードを編集）」を押す。
5. エディタの中身をすべて削除し、この中の `worker.js` の中身を全文コピーして貼り付ける。
6. 右上の「Deploy（デプロイ）」を押して保存する。
7. 画面上部などに表示される、このWorkerの公開URL
   （`https://decap-cms-oauth-proxy.あなたのサブドメイン.workers.dev` の形式）を控えておく。
   これが「Worker URL」です。
8. Workerの管理画面で「Settings（設定）」タブ →
   「Variables and Secrets（変数とシークレット）」を開く。
9. 「Add（追加）」から、以下の2つを追加する。
   - 変数名: `GITHUB_CLIENT_ID` / 値: GitHub OAuth AppのClient ID / タイプ: **Secret（暗号化）**
   - 変数名: `GITHUB_CLIENT_SECRET` / 値: GitHub OAuth AppのClient Secret / タイプ: **Secret（暗号化）**
10. 「Save（保存）」または「Deploy」を押して反映する。

以上でデプロイは完了です。

---

## 動作確認

Worker URL（例: `https://decap-cms-oauth-proxy.xxxx.workers.dev`）に
ブラウザでアクセスし、「Decap CMS 用 GitHub OAuth プロキシ」というページが
表示されれば、Worker自体は正常に動いています（この時点ではGitHub連携の
設定が済んでいなくても表示されます）。

実際のログイン動作の確認は、GitHub OAuth Appの設定と `admin/config.yml` の
書き換えが終わった後、`MIGRATION_GUIDE.md` の該当手順で行います。

---

## このWorkerの仕組み（技術メモ）

- `GET /auth?provider=github` … GitHubの認可画面へリダイレクトする
- `GET /callback` … GitHubから認可コード(code)を受け取り、
  `GITHUB_CLIENT_ID` と `GITHUB_CLIENT_SECRET` を使ってアクセストークンに交換し、
  `window.postMessage` でDecap CMS（管理画面のウィンドウ）にトークンを渡す
- `GITHUB_CLIENT_SECRET` はWorkerのサーバー側だけで使われ、ブラウザ側に渡ることはない
- KVやデータベースなどの追加リソースは一切使わない、ステートレスな実装

トラブルが起きた場合は、Cloudflareダッシュボードの当該Worker →
「Logs（ログ）」からリアルタイムのエラーを確認できます。
