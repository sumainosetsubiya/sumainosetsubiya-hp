# 商品画像の取得元一覧（images/products/）

このフォルダの画像はすべて、各メーカーの公式サイト（商品ページ・製品画像）から取得したものです。
自社で撮影した施工写真ではなく、メーカーが自社サイトに掲載している商品画像を、販売代理店として
商品紹介目的で使用しています。後日メーカーから問い合わせがあった場合に備え、取得元URLと取得日、
型番の一致状況を以下に記録します。

取得日: 2026-08-03
取得方法: 各メーカー公式サイトへPlaywrightでアクセスし、商品ページに掲載されている画像を保存

---

## ① トイレ

| ファイル名 | メーカー | 掲載型番 | services.html上の対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| toilet_toto_neorest.jpg | TOTO | ネオレスト（タンクレストイレ） | プレミアム「TOTO ネオレスト等タンクレス」 | https://jp.toto.com/catalogue/details/325/ （ネオレストカタログページ掲載画像 14012606M504-KIRI_14011912S002_web001） | 型番完全一致（ネオレストシリーズの実写真） |
| toilet_toto_combination.jpg | TOTO | 組み合わせ便器（タンク＋ボウル型、型番不明） | スタンダード「TOTO CS232B+SH232BA+CH951SWS」／ハイグレード「TOTO CS232B+SH232BA+TCF6624」 | https://jp.toto.com/catalogue/details/325/ （同カタログページ掲載画像 14012606M010_web001、タンク付き便器の一般的な形状カット） | **型番は近似**。CS232B（ピュアレストQR）そのものの商品写真は公式サイト上で発見できなかったため、同社サイトに掲載されている一般的なタンク付き組み合わせ便器の写真で代用。実際の商品と細部の形状が異なる場合があります。 |

## ② 温水洗浄便座単体

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| washlet_toto_ss1_tcf6624.jpg | TOTO | ウォシュレット SS1 | ミドル「TOTO SS1 TCF6624」 | https://jp.toto.com/products/toilet/s/ （SSB_00112506S101_web00_v03.jpg、SS1/SS3比較図の右側SS1部分をトリミング） | 型番完全一致 |
| washlet_toto_apricot_tcf4714.jpg | TOTO | ウォシュレット アプリコット F1 | ハイグレード「TOTO アプリコットF1 TCF4714」 | https://jp.toto.com/products/toilet/apricot/ （apricot_main_PC_00112306S101-Rv3.png） | 型番完全一致 |

Panasonic CH951SPF（スタンダード）は、panasonic.jpの一般消費者向けページに単独の商品写真ページが
見つからなかったため（オープン価格品でVカタ会員限定の可能性）、画像なし・既存アイコン表示のままとしています。

## ③ 蛇口

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| faucet_toto_kitchen_gg.jpg | TOTO | キッチン水栓（GGシリーズ相当） | キッチン水栓「TOTO GGシリーズ TKS05301J」／キッチン水栓（上位）「TKS05305JA」 | https://jp.toto.com/products/faucetkitchen/ （faucetkitchen_list_Main_HP2026A037_web001.png） | **型番は近似**。キッチン水栓ラインナップページの代表画像。TKS05301J/TKS05305JA単体の商品写真ページは未発見。 |
| faucet_toto_bath_shower.jpg | TOTO | 浴室台付きシャワー水栓（GGシリーズ相当） | 浴室水栓「TOTO GGシリーズ TBV03445J1」 | https://jp.toto.com/products/faucetbath/showerstand2hole/ （01542004D010_faucet_main_web002.jpg） | **型番は近似**。浴室台付き水栓カテゴリページの代表画像。 |
| faucet_toto_washbasin_1hole.jpg | TOTO | 洗面水栓（ワンホールタイプ） | 洗面水栓（ワンホール）「TOTO TLC32ER」 | https://jp.toto.com/products/faucetgroom/stand1holeg/ （1hole01.jpg） | **型番は近似**。洗面台付き1穴水栓カテゴリページの代表画像。画像内の「reddot winner 2020」バッジ部分はトリミングで除去済み。 |

洗面水栓（コンビネーション）TLS05301J／TLG05301Jは、上記ワンホールタイプの画像で水栓の
デザイン系統（GGシリーズ）を代表させています。

## ④ ビルトイン食洗機

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| dishwasher_panasonic_9series.jpg | Panasonic | ビルトイン食器洗い乾燥機 9シリーズ | ミドル「Panasonic NP-45MS9S」／ハイグレード「NP-45MD9S」 | https://sumai.panasonic.jp/dishwasher/m9series/ （img/main_pc.jpg、右側の設置写真部分をトリミング） | 型番はシリーズ一致（9シリーズのメインビジュアル。NP-45MS9S/NP-45MD9Sはこのページで紹介されている商品） |
| dishwasher_mitsubishi_ew45rd1.jpg | 三菱電機 | EW-45RD1シリーズ | スタンダード「三菱電機 EW-45R2S」 | https://www.mitsubishielectric.co.jp/home/builtin-dishwasher/ （img/img_ew-45rd1.jpg） | **型番は後継機種で代替**。EW-45R2Sは生産終了品のため、公式サイト現行ラインナップの後継シリーズ「EW-45RD1」の画像を使用。 |

## ⑤ ビルトインコンロ

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| cooktop_noritz_metaltop.jpg | ノーリツ | メタルトップシリーズ | スタンダード「ノーリツ メタルトップ相当」 | https://www.noritz.co.jp/product/kitchen01/builtin/metal.html （img/img_01.png） | 型番はシリーズ一致 |
| cooktop_rinnai_sence.jpg | リンナイ | SENCE（センス） | ミドル「リンナイ センス相当」 | https://rinnai.jp/products/kitchen/built-in-gas-conro/sence/lineup/ （lineup_01_01.webp、フラットグレー） | 型番はシリーズ一致 |
| cooktop_rinnai_delicia.jpg | リンナイ | DELICIA（デリシア） | ハイグレード「リンナイ デリシア相当」 | https://rinnai.jp/products/kitchen/built-in-gas-conro/delicia/ （color_01.webp） | 型番はシリーズ一致 |

## ⑥ レンジフード

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| rangehood_panasonic_smartsquare.jpg | Panasonic | スマートスクエアフード（FY-7HZC5-S相当） | スタンダード「Panasonicスマートスクエアフード」／ミドル「Panasonic上位シリーズ」 | https://panasonic.jp/rangehood/products/FY-9HZC5-S.html （panasonicjp.scene7.com/is/image/panasonicjp/FY-7HZC5-S） | 型番はシリーズ一致（スマートスクエアフード全体の代表画像として両グレードに使用） |

## ⑦ IHクッキングヒーター

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| ih_panasonic_kzj1h6ak.jpg | Panasonic | KZ-J1H6AK | スタンダード「Panasonic Jシリーズ KZ-J1H6AK」 | https://panasonic.jp/ih/products/KZ-J1H6AK.html （panasonicjp.scene7.com/is/image/panasonicjp/KZ-J1H6AK-11C-EC） | 型番完全一致 |
| ih_mitsubishi_csa8.jpg | 三菱電機 | CROSS+TOPシリーズ CS-A8 | ミドル「三菱電機 CS-A8」 | https://www.mitsubishielectric.co.jp/home/ih_cooking/product/a8/feature/design/index.html （img_section01_01_01.jpg） | 型番完全一致（デザイン説明用の画像のため、画面内に説明キャプションを含む） |
| ih_panasonic_aseries_kza1t6s.jpg | Panasonic | Aシリーズ | ハイグレード「Panasonic Aシリーズ KZ-A1T6S」 | https://sumai.panasonic.jp/ihcook/lineup/ （assets/img/product/a_series_kv.png） | 型番はシリーズ一致（Aシリーズのキービジュアル） |

## ⑧ 浴室乾燥機

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| bathdryer_mitsubishi_v141bz5.jpg | 三菱電機 | V-141BZ | スタンダード「三菱電機 ロスナイ V-141BZ5+P-141SW5」 | https://www.mitsubishielectric.co.jp/ldg/wink/ssl/displayProduct.do?pid=197371 （三菱電機WIN2K内 商品写真サムネイル、V-141BZ.jpg） | 型番はほぼ一致（V-141BZ5の型番違いバリエーション表記。WIN2K内に小サイズのサムネイル画像のみ存在したため解像度が低い） |
| bathdryer_panasonic_series.jpg | Panasonic | 電気ヒーター式バス換気乾燥機シリーズ | ミドル「Panasonic FY-13UG6V」 | https://sumai.panasonic.jp/air/kanki/bathkan/01.html （img/01/recommend/01_photo@2x.png） | **型番は近似**。FY-13UG6V単体の商品写真は未発見のため、同カテゴリ代表機種の画像で代用。 |
| bathdryer_max_bs161h.jpg | MAX | ドライファン BS-161H-CX-2 | ハイグレード「MAX ドライファン BS-161H-CX-2」 | https://www.max-ltd.co.jp/product/dry-fan/bathroom_dryer/01/BS-161H-2.html （bs-161_261h_-cx_-2_h.jpg） | 型番完全一致 |

## ⑨ 換気扇

| ファイル名 | メーカー | 掲載型番 | 対応商品 | 取得元URL | 備考 |
|---|---|---|---|---|---|
| ventfan_panasonic_fy17s7.jpg | Panasonic | FY-17S7 | 1室換気「Panasonic FY-17S7」 | https://www2.panasonic.biz/scvb/a2A/opnItemDetail?item_cd=FY-17S7 （Vカタ/VAソリューションカタログ内 商品写真、ideacontout/CL/jp/sumai/dgazou/bicon/P_FY-17S7.jpg） | 型番完全一致 |
| ventfan_mitsubishi_vd15zfvc7.jpg | 三菱電機 | VD-15ZFVC7 | 2室換気「三菱電機 VD-15ZFVC7相当」 | https://www.mitsubishielectric.co.jp/ldg/wink/ssl/displayProduct.do?pid=333615 （三菱電機WIN2K内 商品写真サムネイル、VD-15ZFVC7.jpg） | 型番完全一致（WIN2K内の小サイズサムネイル画像のみ存在したため解像度が低い） |

---

## 画像が見つからず未掲載の商品（既存SVGアイコン表示のまま）

- Panasonic CH951SPF（温水洗浄便座単体・スタンダード）
- TOTO TLS05301J／TLG05301J（洗面水栓・コンビネーションタイプ、TLC32ERの画像で代替済み）

## 補足

- 画像はすべて `python (Pillow)` でJPEG形式に変換・リサイズ（最大幅900px）・圧縮（quality=84前後）して保存しています。
- 「型番は近似」「シリーズ一致」と記載した画像は、完全に同一型番の商品写真が各社公式サイト上で
  確認できなかったため、同一シリーズ・類似グレードの商品画像で代用したものです。services.html側の
  alt属性にも同様の注記を入れています。
- 本一覧は自社サイトでの商品紹介目的の利用記録であり、メーカーへの正式な利用許諾を得たものでは
  ありません。メーカーからの削除・修正依頼があった場合は速やかに対応してください。
