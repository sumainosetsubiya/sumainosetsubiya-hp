# images/area-map.svg の出典・ライセンス

`images/area-map.svg`（トップページ「対応エリア」セクションの地図イラスト）は、以下の2つの
Wikimedia Commons 公開ファイルを元データとして加工・合成したものです。

## 1. 東京都23区部分

- ファイル: [Tokyo special wards map ja.svg](https://commons.wikimedia.org/wiki/File:Tokyo_special_wards_map_ja.svg)
- 直接リンク: https://upload.wikimedia.org/wikipedia/commons/0/06/Tokyo_special_wards_map_ja.svg
- 作者: Tokyoship（原作）, Minajike（日本語版への改変）, Peka（更新）
- ライセンス: パブリックドメイン（著作権者により放棄）
- 法的な表示義務: なし（念のため出典を本ファイルに記録）

## 2. 埼玉県市区町村部分

- ファイル: [Growth rate map of municipalities of Saitama prefecture, Japan.svg](https://commons.wikimedia.org/wiki/File:Growth_rate_map_of_municipalities_of_Saitama_prefecture,_Japan.svg)
- 直接リンク: https://upload.wikimedia.org/wikipedia/commons/0/0a/Growth_rate_map_of_municipalities_of_Saitama_prefecture%2C_Japan.svg
- 作者: User:Ow00wo
- ライセンス: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)（表示 - 継承 3.0 非移植）
- 法的な表示義務: あり（作者表示・ライセンス表示・改変を行った旨の明示）
  - 本ページ末尾および `images/area-map.svg` 内の小さな注記に
    「地図データ: Wikimedia Commons（埼玉県区分＝CC BY-SA 3.0 Ow00wo, 改変あり）」と記載することで対応。

## 加工内容（両ファイル共通）

1. 各市区町村（東京都:23区／埼玉県:さいたま市・川口市など全66市区町村＋旧鳩ヶ谷市）の
   塗り色を、元データの人口増減率の色分け（Growth rate）や区別用の配色から、
   本サイトのブランドカラーに置き換え：
   - 対応エリア（下記リスト）: `#108470`（サイトのブランドカラー / `--color-primary`）
   - 対応エリア外: `#e2e8e6`（薄いグレー、`--color-bg-alt` 系統）
2. 東京都ファイルに含まれていた23区分のラベル（テキストをパス化したもの）のうち、
   対応エリア外の18区分のラベルは視認性を優先して削除し、対応エリア5区分のラベルのみ
   白色に着色して残した。装飾用の縮尺バー（10km表記）と、データと無関係な線状の
   飾り線2本も削除。
3. 埼玉県ファイルには市区町村名のラベルが無かったため、主要な対応エリア
   （さいたま市・川口市・上尾市・越谷市・草加市）の名称ラベルを新規に追加。
   元ファイルの各市区町村シェイプに設定されていたWikipedia外部リンク（`<a xlink:href>`）は、
   埋め込み画像として意図しない遷移を避けるため削除。
   末尾にあった元データの縮尺バー（50km）を含む凡例帯（フッター領域）も削除。
4. 東京都・埼玉県の2パネルを1つのSVGに並べて配置し、パネル見出し・凡例
   （対応エリア／対応エリア外）・出典表記・area.html誘導文を追加。

## 対応エリア（塗り分け対象）として teal 色にした区市町村コード

- 東京都: 足立区(13121)・荒川区(13118)・板橋区(13119)・北区(13117)・練馬区(13120)
- 埼玉県（JIS地方公共団体コード）:
  さいたま市(11100・西区/北区/大宮区/見沼区/中央区/桜区/浦和区/南区/緑区/岩槻区の全10区を含む)、
  川口市(11203)、上尾市(11219)、朝霞市(11227)、桶川市(11231)、越谷市(11222)、
  志木市(11228)、草加市(11221)、戸田市(11224)、新座市(11230)、富士見市(11235)、
  ふじみ野市(11245)、和光市(11229)、蕨市(11223)。
  ※ 元データ作成時点（2005〜2010年国勢調査ベース）では鳩ヶ谷市(11226)が川口市と
  別の独立市であったため、元データ上は別コードとして塗り分け対象に含めた。
  鳩ヶ谷市は2011年10月11日に川口市へ編入合併されており、現在は川口市の一部。

作成日: 2026-08-03
