# 画像素材 出典・ライセンス 統合台帳（IMAGE_SOURCES_MASTER.md）

このドキュメントは `images/` 以下に存在する全画像ファイルについて、出典・権利関係・
サイト上での表示義務対応状況を1ファイルに統合したものです。複数のサブエージェントが
別々のタイミングで収集した画像が混在しているため、後日の棚卸し・メーカー問い合わせ対応・
著作権リスク確認のための一次資料として作成しました。

作成日: 2026-08-04
点検方法: `images/` 以下の全ファイルを列挙し、既存記録（`images/products/SOURCES.md`,
`images/area-map-CREDITS.md`）と各HTMLファイル（`index.html` / `services.html` /
`works.html` / `content/works.json` / `js/works.js`）の実際の記述を突き合わせて確認。

参照元の個別記録ファイル（詳細はこちらにも残る）:
- `images/products/SOURCES.md`（メーカー商品画像の型番・取得元URL詳細）
- `images/area-map-CREDITS.md`（地図SVGのライセンス詳細・加工内容）

---

## 1. カテゴリ別サマリー

| カテゴリ | フォルダ/ファイル | 件数 | 出典 | 権利関係 | 表示義務 |
|---|---|---|---|---|---|
| 施工実績写真（旧Wixブログ流用） | `images/works/uploads/*.jpg`（01〜09番） | 18枚 | 依頼主自身が運営していたWixブログから流用 | 依頼主自身の著作物 | なし |
| 施工実績写真（依頼主が直接アップロード） | `images/works/uploads/img_2695.jpeg`, `img_2698.jpeg` | 2枚 | 依頼主が管理画面(Decap CMS)から直接アップロード | 依頼主自身の著作物（スマホ撮影オリジナル） | なし |
| プレースホルダー | `images/works/uploads/_placeholder.svg` | 1枚 | サイト内で自作したダミーアイコン | 自社制作物 | なし |
| トップページ施工実績写真（旧Wixブログ流用） | `images/home/*.jpg`（10〜13番） | 8枚 | 依頼主自身が運営していたWixブログから流用 | 依頼主自身の著作物 | なし |
| メーカー商品画像 | `images/products/*.jpg` | 21枚 | TOTO・Panasonic・三菱電機・リンナイ・ノーリツ・MAX各社公式サイト | メーカー画像の商慣行利用（正式許諾なし） | 法的表示義務なし（商慣行）※詳細は本書4章参照 |
| 地図イラスト（東京都部分） | `images/area-map.svg`（東京都データ） | 1枚（合成の一部） | Wikimedia Commons "Tokyo special wards map ja.svg" | パブリックドメイン | なし |
| 地図イラスト（埼玉県部分） | `images/area-map.svg`（埼玉県データ） | 1枚（合成の一部） | Wikimedia Commons "Growth rate map of municipalities of Saitama prefecture, Japan.svg"（User:Ow00wo） | CC BY-SA 3.0 | **あり**（表示義務・確認結果は3章参照） |
| OGP画像 | `images/ogp-default.jpg` | 1枚 | サイト独自CSSから合成生成 | 自社制作物（素材借用なし） | なし |

合計ファイル数: 52ファイル（画像51枚 + `_placeholder.svg`を含む）+ 記録用Markdown 2ファイル
（`images/products/SOURCES.md`, `images/area-map-CREDITS.md`）

---

## 2. ファイル別詳細一覧

### 2-1. 施工実績写真（依頼主自身の著作物）— `images/works/uploads/`

旧Wixブログ（依頼主自身が運営していたサイト）から流用した施工実績写真、および依頼主が
直接アップロードした写真。依頼主自身が撮影・保有する写真であり、第三者の著作物ではないため
権利上の問題はなし。表示義務もなし。

| ファイルパス | 出典 | 権利関係 | サイト上の使用箇所 | 表示義務 | 対応状況 |
|---|---|---|---|---|---|
| images/works/uploads/01_dishwasher_kawaguchi_before.jpg / after.jpg | 旧Wixブログ流用 | 依頼主著作物 | content/works.json → works.html（動的表示） | なし | 対応不要 |
| images/works/uploads/02_faucet_bath_kawaguchi_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/03_toilet_kita_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/04_faucet_kitchen_saitama_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/05_cooktop_nerima_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/06_rangehood_urawa_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/07_washlet_adachi_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/08_toilet_koshigaya_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/09_dishwasher_kitamoto_before.jpg / after.jpg | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/img_2695.jpeg（施工前） | 依頼主が管理画面から直接アップロード（コミット `77d45b4`、著者 `sumainosetsubiya`） | 依頼主著作物（スマホ撮影オリジナル） | content/works.json → works.html | なし | 対応不要 |
| images/works/uploads/img_2698.jpeg（施工後） | 同上 | 依頼主著作物 | 同上 | なし | 対応不要 |
| images/works/uploads/_placeholder.svg | サイト制作時の自作ダミーアイコン | 自社制作物 | works.json内の一部エントリ（浴室乾燥機/練馬区、写真未着分のフォールバック）、js/works.jsのデフォルトsrc | なし | 対応不要 |

備考: `img_2695.jpeg` / `img_2698.jpeg` は、01〜09番の「Wixブログから移設」した写真とは
取得経路が異なり、コミット履歴上は依頼主のメールアカウント（`sumainosetsubiya@gmail.com`）が
2026-08-03に管理画面(Decap CMS)から直接アップロードしたもの。いずれにせよ依頼主自身が
撮影・保有する施工写真である点は01〜09番と同じで、権利上の扱いに差はない。

### 2-2. トップページ施工実績写真（依頼主自身の著作物）— `images/home/`

| ファイルパス | 出典 | 権利関係 | サイト上の使用箇所 | 表示義務 | 対応状況 |
|---|---|---|---|---|---|
| images/home/10_toilet_nerima_after.jpg | 旧Wixブログ流用 | 依頼主著作物 | index.html 134行目（施工実績プレビュー） | なし | 対応不要 |
| images/home/10_toilet_nerima_before.jpg | 同上 | 依頼主著作物 | **未使用**（現状どのHTMLからも参照なし） | なし | — |
| images/home/11_faucet_kitchen_adachi_after.jpg | 同上 | 依頼主著作物 | index.html 373行目 | なし | 対応不要 |
| images/home/11_faucet_kitchen_adachi_before.jpg | 同上 | 依頼主著作物 | **未使用** | なし | — |
| images/home/12_rangehood_toda_after.jpg | 同上 | 依頼主著作物 | index.html 379行目 | なし | 対応不要 |
| images/home/12_rangehood_toda_before.jpg | 同上 | 依頼主著作物 | **未使用** | なし | — |
| images/home/13_dishwasher_warabi_after.jpg | 同上 | 依頼主著作物 | index.html 385行目 | なし | 対応不要 |
| images/home/13_dishwasher_warabi_before.jpg | 同上 | 依頼主著作物 | **未使用** | なし | — |

備考: `_before` 系の4枚は現状どのページからも参照されていない（`images/home/` 内に
保管されているのみ）。権利上の問題はない（依頼主自身の著作物）ため放置しても問題ないが、
不要ファイルの整理という観点では、before/after比較セクションを追加する用途に使うか、
使わないなら削除して整理してもよい（今回は権利チェックが主目的のため削除は行っていない）。

### 2-3. メーカー商品画像 — `images/products/`

全21枚。詳細な取得元URL・型番一致状況は `images/products/SOURCES.md` に記載済み。
ここではサマリーのみ記載する。

| ファイルパス | メーカー | services.html上での使用 | 型番一致状況 |
|---|---|---|---|
| toilet_toto_neorest.jpg | TOTO | ○（184行目ほか） | 完全一致 |
| toilet_toto_combination.jpg | TOTO | ○（88, 180行目） | 近似（代表画像） |
| washlet_toto_ss1_tcf6624.jpg | TOTO | ○（230行目） | 完全一致 |
| washlet_toto_apricot_tcf4714.jpg | TOTO | ○（96, 234行目） | 完全一致 |
| faucet_toto_kitchen_gg.jpg | TOTO | ○（104, 280行目） | 近似（代表画像） |
| faucet_toto_bath_shower.jpg | TOTO | ○（284行目） | 近似（代表画像） |
| faucet_toto_washbasin_1hole.jpg | TOTO | ○（288行目） | 近似（代表画像） |
| dishwasher_panasonic_9series.jpg | Panasonic | ○（112, 341行目） | シリーズ一致 |
| dishwasher_mitsubishi_ew45rd1.jpg | 三菱電機 | ○（337行目） | 後継機種で代替 |
| cooktop_noritz_metaltop.jpg | ノーリツ | ○（387行目） | シリーズ一致 |
| cooktop_rinnai_sence.jpg | リンナイ | ○（391行目） | シリーズ一致 |
| cooktop_rinnai_delicia.jpg | リンナイ | ○（120, 395行目） | シリーズ一致 |
| rangehood_panasonic_smartsquare.jpg | Panasonic | ○（128, 441行目） | シリーズ一致 |
| ih_panasonic_kzj1h6ak.jpg | Panasonic | ○（136, 486行目） | 完全一致 |
| ih_mitsubishi_csa8.jpg | 三菱電機 | ○（490行目） | 完全一致 |
| ih_panasonic_aseries_kza1t6s.jpg | Panasonic | ○（494行目） | シリーズ一致 |
| bathdryer_mitsubishi_v141bz5.jpg | 三菱電機 | ○（540行目） | ほぼ一致 |
| bathdryer_panasonic_series.jpg | Panasonic | ○（544行目） | 近似（代表画像） |
| bathdryer_max_bs161h.jpg | MAX | ○（144, 548行目） | 完全一致 |
| ventfan_panasonic_fy17s7.jpg | Panasonic | ○（152, 594行目） | 完全一致 |
| ventfan_mitsubishi_vd15zfvc7.jpg | 三菱電機 | ○（598行目） | 完全一致 |

21枚すべてが `services.html` 内で実際に使用されていることを確認済み（未使用ファイルなし）。
「型番は近似」「シリーズ一致」の画像は、alt属性内にもその旨の注記があることを確認済み
（例: `alt="TOTO キッチン水栓（GGシリーズ相当）の商品写真、型番は近似"`）。

### 2-4. 地図イラスト — `images/area-map.svg`

| 元データ | 出典 | ライセンス | 表示義務 | サイト上での表記状況 |
|---|---|---|---|---|
| 東京都23区部分 | Wikimedia Commons "Tokyo special wards map ja.svg" | パブリックドメイン | なし | （義務はないが）SVG内に出典注記あり |
| 埼玉県市区町村部分 | Wikimedia Commons "Growth rate map of municipalities of Saitama prefecture, Japan.svg"（作者: User:Ow00wo） | CC BY-SA 3.0 | **あり**（作者表示・ライセンス表示・改変の明示） | ○ 対応済み（下記参照） |

**表示義務の充足状況を確認した結果: 問題なし。**

`images/area-map.svg` ファイル自体の中に、以下のテキストが埋め込まれていることを
`grep`で確認した。

```
Wikimedia Commons（東京都区分＝Public Domain／埼玉県区分＝CC BY-SA 3.0 Ow00wo, 改変あり）— 詳細は area-map-CREDITS.md
```

この地図はSVG画像として `index.html`（347〜356行目）に埋め込まれており、画像を表示すると
このクレジット注記も画面上に表示される（=画像そのものに出典表記が焼き込まれている）ため、
CC BY-SA 3.0が求める「作者表示・ライセンス表示・改変の明示」の3要件を満たしている。
`index.html` 側にも `<!-- 対応エリア地図を追加(2026-08-03)。地図データの出典・ライセンスは
images/area-map-CREDITS.md 参照 -->` というHTMLコメント（開発者向け）があり、
`images/area-map-CREDITS.md` に詳細な加工履歴・ライセンス全文リンクも記録済み。

### 2-5. OGP画像 — `images/ogp-default.jpg`

| ファイルパス | 出典 | 権利関係 | 使用箇所 | 表示義務 |
|---|---|---|---|---|
| images/ogp-default.jpg | サイト独自CSSのデザインから合成生成（外部素材の借用なし） | 自社制作物 | 全8ページの `<meta property="og:image">`（index/services/works/reserve/about/area/contact/faq、およびリファレンス用partials） | なし |

---

## 3. 表示義務チェック結果（監査サマリー）

| # | 表示義務対象 | 必要な表記内容 | サイト上の実際の表記 | 判定 |
|---|---|---|---|---|
| 1 | 埼玉県地図データ（CC BY-SA 3.0, Ow00wo） | 作者表示・ライセンス表示・改変の明示 | area-map.svg内に埋め込みテキストとして記載（2-4章参照） | **問題なし** |
| 2 | 東京都地図データ（パブリックドメイン） | 法的義務なし（念のため出典記録） | area-map.svg内・CREDITSファイルに記録あり | 問題なし（義務自体なし） |
| 3 | メーカー商品画像（メーカー各社） | 法的な表示義務なし（商慣行） | SOURCES.mdに記録、alt属性に型番注記あり | 問題なし（4章の注意事項を参照） |
| 4 | 依頼主自身の施工写真（Wix流用・直接アップロード） | 表示義務なし（自己著作物） | — | 問題なし |
| 5 | OGP画像 | 表示義務なし（自社制作） | — | 問題なし |

**結論: 表示義務が発生する項目（埼玉県地図データ / CC BY-SA 3.0）について、サイト上での
表記漏れは見つからなかった。** 追加の修正対応は不要と判断した。

---

## 4. メーカー商品画像の利用に関する重要な注意事項（要再確認）

`images/products/` 内の21枚の商品画像は、TOTO・Panasonic・三菱電機・リンナイ・ノーリツ・MAX
各社の公式サイトに掲載されている商品画像を、住宅設備の販売・工事代理店として商品紹介目的で
そのまま使用しているものです。この利用形態について、以下の点を改めて明記します。

- **これは業界の商慣行として広く行われている利用であり、法律上の権利侵害には当たりにくいと
  考えられますが、各メーカーから個別に「使用してよい」という正式な許諾（ライセンス契約・
  利用同意書等）を取得したものではありません。**
- 型番が完全一致しない画像（「型番は近似」「シリーズ一致」等と注記されたもの）は、
  同一シリーズ・類似グレードの商品画像で代用しているため、実際に取り付ける商品と
  細部の意匠が異なる場合があります。
- 万が一、依頼主が本利用について将来的に気になる場合、以下のいずれかの対応が可能です。
  1. **メーカーに個別に問い合わせて、正式な利用許諾（画像使用許可）を得る**
     （代理店・取扱店としての利用であることを伝えれば、許諾が得られるケースも多い）
  2. **画像を撤去し、既存のSVGアイコン表示（カテゴリアイコン）に戻す**
     （`images/products/SOURCES.md` に記載の「画像が見つからず未掲載の商品」と同様の
     取り扱いにする）
  3. メーカーから削除・修正の連絡があった場合は、速やかに該当画像を差し替え・削除する
     （`images/products/SOURCES.md` 末尾にも同様の記載あり）

現時点では商慣行の範囲内の利用と考えられるため、緊急に対応が必要な状態ではありませんが、
サイト公開後にメーカーから連絡があった場合に備え、上記の対応方針を関係者間で共有しておくこと
を推奨します。

---

## 5. 未使用ファイルに関する補足（権利上の問題ではなく整理のメモ）

以下のファイルは、現状どのHTML/JS/JSONからも参照されていないことを確認した（権利上の
問題はないが、将来のフォルダ整理の参考情報として記録）。

- `images/home/10_toilet_nerima_before.jpg`
- `images/home/11_faucet_kitchen_adachi_before.jpg`
- `images/home/12_rangehood_toda_before.jpg`
- `images/home/13_dishwasher_warabi_before.jpg`

いずれも依頼主自身の著作物（旧Wixブログ流用の施工前写真）であるため、放置しても
権利上のリスクはない。将来的にトップページで「施工前後」の比較表示を追加する場合の
素材として、そのまま保管しておいてよい。

---

## 6. まとめ

- 表示義務のある唯一の項目（埼玉県地図データ、CC BY-SA 3.0）は、`images/area-map.svg`
  ファイル自体に出典・ライセンス・改変の明示が埋め込まれており、サイト上で正しく
  表示される状態になっていることを確認した。**追加対応は不要。**
- 依頼主自身の施工実績写真（旧Wixブログ流用18枚＋トップページ用8枚＋直接アップロード2枚）は
  依頼主自身の著作物であり、権利上の問題はない。
- メーカー商品画像21枚は商慣行の範囲内の利用であり、正式な許諾は得ていない旨を
  `images/products/SOURCES.md` および本ドキュメント4章に明記した。将来的にメーカーへの
  問い合わせ・画像撤去という選択肢があることも記載した。
- OGP画像は自社制作物のため問題なし。
- 未使用の施工前写真4枚（`images/home/`内）を発見したが、権利上の問題はなく、
  整理の要否は依頼主の判断に委ねる。
