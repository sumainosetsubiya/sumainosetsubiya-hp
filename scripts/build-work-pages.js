#!/usr/bin/env node
/**
 * scripts/build-work-pages.js
 * ---------------------------------------------------------------
 * 施工実績 1件 = 1ページ の詳細記事（works/<slug>.html）を生成する
 * ビルドスクリプト。あわせて sitemap.xml のマーカー区間を書き換える。
 *
 * 【呼び出され方】
 *   Cloudflare Pages のビルドコマンドは
 *     node scripts/build-works-index.js
 *   のまま変更しない方針のため、build-works-index.js の末尾から
 *   このモジュールの build() が呼ばれる。単体でも実行できる:
 *     node scripts/build-work-pages.js
 *
 * 【slug】
 *   content/works/<slug>.json のファイル名（拡張子なし）をそのまま
 *   URL の slug に使う。CMS 側の slug 設定
 *   （"{{fields.date}}-{{fields.category}}"）で一意性が担保されており、
 *   既存エントリのファイル名を変えない限り URL も変わらない。
 *
 * 【出力先が works/ で良い理由】
 *   Cloudflare Pages のアセットルーターは「ファイルの一覧」に対して
 *     1) 完全一致  2) パス + ".html"  3) パス + "/index.html"
 *   の順で解決するため、works.html と works/ ディレクトリは共存できる。
 *   wrangler pages dev（本番と同一のアセットルーター実装）で実測し、
 *     /works                -> 200 works.html
 *     /works/<slug>         -> 200 works/<slug>.html
 *     /works/<slug>.html    -> 308 -> /works/<slug>
 *     /works/               -> 308 -> /works
 *   となることを確認済み（works/index.html は生成しない）。
 *
 * 【薄いページ（thin content）対策】
 *   JSON の項目をそのまま流し込むだけだと、ほぼ同一構造のページが
 *   並ぶだけになってしまう。そのため:
 *     - 施工前後の実写真を大きく主役として配置
 *     - カテゴリごとに書き下ろした解説（工事の流れ／所要時間の目安／
 *       事前に確認しておきたいこと）を差し込む（CATEGORY_GUIDES）
 *     - 同じエリア・同じカテゴリの他事例への相互リンク
 *   を必ず含める。
 *   なお解説文は「一般的にこういう流れになります」という一般論に
 *   とどめており、この事業者が実際に何をしたか・商品の仕様が
 *   どうであるかを推測して書くことは一切していない（虚偽記載防止）。
 */

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WORKS_JSON_DIR = path.join(PROJECT_ROOT, "content", "works");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "works");
const SITEMAP_PATH = path.join(PROJECT_ROOT, "sitemap.xml");

const SITE_ORIGIN = "https://www.sumainosetsubiya.com";
const SITE_NAME = "住まいの設備屋さん";
const GA_MEASUREMENT_ID = "G-VQEPCXD7CP";
const GSC_VERIFICATION = "BLigKNepnl03dsWxHHFms129EPP3t4me6O16HdEBha8";
const OGP_FALLBACK_PATH = "/images/ogp-default.jpg";
const PLACEHOLDER_IMAGE = "/images/works/uploads/_placeholder.svg";

const SITEMAP_START = "<!-- WORKS:START -->";
const SITEMAP_END = "<!-- WORKS:END -->";

// エリアの値が「その他」の場合、地域名としては使えない（実際の市区が
// 特定できない）ため、タイトル・H1・関連リンクから地域名を外す。
const AREA_UNKNOWN = "その他";

const RELATED_LIMIT = 6;

/* =====================================================================
   カテゴリ別 解説コンテンツ
   ---------------------------------------------------------------------
   works.html のフィルターと同じ 9 カテゴリ分を用意している
   （現在データが存在するのは 7 カテゴリだが、CMS の選択肢は 9 種類
   あるため、後から追加されても解説が出るようにしておく）。

   ★執筆方針（重要）★
   - すべて「一般的な交換工事はこういう流れになる」という一般論。
     この事業者が実際にどう作業したかは書かない。
   - メーカー・品番ごとの仕様は手元にデータが無いため一切書かない。
   - 所要時間も「一般的な目安」とし、実際の作業時間は各事例の
     データ（duration）を見てもらう導線にする。
   ===================================================================== */
const CATEGORY_GUIDES = {
  "トイレ交換": {
    filterSlug: "toilet",
    servicesAnchor: "#cat-toilet",
    lead:
      "トイレ交換は、既存の便器・タンクを撤去したうえで、床の排水芯（排水管の位置）に合う新しい便器を据え付ける工事です。" +
      "便器そのものの入れ替えに加えて、給水管まわりの部品や、便器を外した跡の床材をどうするかまで含めて検討することが一般的です。",
    flow: [
      "止水栓を閉め、タンク内・便器内の水を抜く",
      "給水管を取り外し、既存の便器とタンクを撤去・搬出する",
      "床の排水芯の位置と状態、給水の位置を確認し、周囲を清掃する",
      "新しい便器を据え付け、水平を調整して固定する",
      "給水管を接続し、通水して各接続部から水漏れがないか確認する",
      "洗浄・止水の動作確認を行い、撤去した機器を搬出する"
    ],
    duration:
      "一般的には2〜4時間程度が目安とされます。組み合わせ便器を同等品へ入れ替える場合は1.5〜2時間前後、" +
      "タンクレストイレへの変更や、クッションフロアの張り替えを同時に行う場合は3〜4時間程度かかることもあります。",
    checkpoints: [
      "排水芯（壁排水なら床からの高さ、床排水なら壁から排水管中心までの距離）。ここが合わないと取り付けられる便器の種類が変わります",
      "給水の位置（床給水か壁給水か）と、止水栓の状態",
      "便器を搬入・搬出できる通路の幅、階段や段差の有無",
      "タンクレストイレを検討する場合は、必要な水圧が確保できるかと、電源コンセントの有無",
      "便器を外した跡の床材の状態（同じタイミングで張り替えるかどうか）"
    ]
  },

  "温水洗浄便座交換": {
    filterSlug: "washlet",
    servicesAnchor: "#cat-washlet",
    lead:
      "温水洗浄便座（ウォシュレット等）だけの交換は、便器はそのまま残し、便座部分のみを新しいものに付け替える工事です。" +
      "便器の状態がまだ良く、洗浄機能の不具合や経年劣化だけが気になる場合に選ばれることが多い工事です。",
    flow: [
      "止水栓を閉め、既存の便座への給水を止める",
      "電源プラグを抜き、既存の温水洗浄便座を便器から取り外す",
      "便器側の取付穴のピッチや形状、給水まわりの状態を確認する",
      "新しい便座のベースプレートを便器に固定し、本体を取り付ける",
      "分岐金具を介して給水ホースを接続する",
      "通水・通電し、水漏れがないことと洗浄動作を確認する"
    ],
    duration:
      "一般的には1時間前後が目安です。止水栓や分岐金具が劣化していて部品交換が必要な場合や、" +
      "既存の便座の固定ボルトが固着している場合には、もう少し時間がかかることもあります。",
    checkpoints: [
      "便器の取付穴のピッチと便器のサイズ規格に、取り付けたい機種が適合するか",
      "トイレ内にアース付きコンセントがあるか、位置は電源コードが届く範囲か",
      "既存の止水栓・分岐金具の状態（劣化していると同時交換が必要になることがあります）",
      "便器の形状（タンクと便器が一体になったタイプなど、便座単体では交換できない場合があります）",
      "設置スペースの奥行き（機種によって本体寸法が異なります）"
    ]
  },

  "蛇口交換": {
    filterSlug: "faucet",
    servicesAnchor: "#cat-faucet",
    lead:
      "蛇口（水栓）の交換は、キッチン・浴室・洗面など設置場所によって取り付け方式が大きく異なるため、" +
      "既存の取り付け方に合った水栓を選ぶところから始まります。水漏れやレバーの固さ、湯温が安定しないといった症状は、" +
      "内部部品の劣化が原因で本体ごと交換したほうが結果的に早いケースもあります。",
    flow: [
      "止水栓（見当たらない場合は宅内の元栓）を閉め、水が出ないことを確認する",
      "既存の水栓を取り外す（壁付なら壁の給水口から、台付ならシンク下・洗面台下から）",
      "取り付け部（ネジ山・座金・パッキン）の清掃と状態確認を行う",
      "新しい水栓を、向きと締め付け具合を調整しながら取り付ける",
      "給水・給湯を接続し、通水して接続部やシンク下から水漏れがないか確認する",
      "吐水・止水、湯温の切り替え、シャワー切替などの動作を確認する"
    ],
    duration:
      "一般的には1時間前後が目安です。壁付水栓・台付水栓のいずれの場合も、" +
      "既存の水栓が固着している場合や、シンク下の作業スペースが狭い場合には前後します。",
    checkpoints: [
      "取り付け方式（壁付か台付か、台付ならワンホールかツーホールか）",
      "台付の場合は取付穴の径と穴数、およびシンク下・洗面台下の作業スペース",
      "壁付の場合は給水・給湯の芯々の寸法（左右の給水口の間隔）",
      "浄水器・シャワーホース・食洗機用分岐など、付随して必要な機能の有無",
      "止水栓が固く回らない場合は元栓での止水が必要になり、その間は家全体の水が使えなくなること"
    ]
  },

  "ビルトイン食洗機交換": {
    filterSlug: "dishwasher",
    servicesAnchor: "#cat-dishwasher",
    lead:
      "ビルトイン食洗機の交換は、キッチンキャビネットの開口部に本体を納める工事です。" +
      "既存機と同じ幅・同じタイプ（浅型／深型）への入れ替えであれば、比較的短時間で作業が完了することが多い工事でもあります。",
    flow: [
      "電源とアースを外し、分岐水栓からの給水を止める",
      "扉材（ドアパネル）を外し、既存の食洗機を引き出して撤去する",
      "開口部の寸法と、給排水・電源の位置や状態を確認する",
      "新しい食洗機を挿入し、レールやアジャスターで高さ・水平を調整して固定する",
      "給水ホース・排水ホース・電源・アースを接続する",
      "試運転を行い、給排水の状態と扉の開閉を確認する"
    ],
    duration:
      "一般的には1〜2時間程度が目安です。同じ幅・同じタイプへの入れ替えであれば短く済みますが、" +
      "扉材の付け替えや開口部まわりの調整が必要な場合には長くなります。",
    checkpoints: [
      "既存機の幅（45cm／60cm）とタイプ（浅型・ミドル・深型）",
      "キャビネット開口部の高さと奥行きの寸法",
      "分岐水栓の有無と型式、排水ホースの取り回し",
      "専用回路とアースが確保されているか",
      "扉材（ドアパネル）を流用するのか、新しい面材を用意するのか"
    ]
  },

  "ビルトインコンロ交換": {
    filterSlug: "cooktop",
    servicesAnchor: "#cat-cooktop",
    lead:
      "ビルトインコンロの交換は、キッチン天板の開口部（一般的に幅60cmまたは75cm）に納まる機種を選び、" +
      "ガス接続をやり直す工事です。ガス機器のため、ガス種別の適合確認と接続後の確認が特に重要になります。",
    flow: [
      "ガスの元栓を閉め、既存コンロの電源（乾電池等）を外す",
      "ガス接続を外し、既存のコンロを天板から取り出して搬出する",
      "開口部の寸法、ガス栓やコンセントの位置を確認し、天板まわりを清掃する",
      "新しいコンロを開口部に納め、前後左右の位置を調整する",
      "ガス接続を行い、接続部にガス漏れがないことを確認する",
      "各バーナーとグリルの点火、および安全装置の動作を確認する"
    ],
    duration:
      "一般的には1〜2時間程度が目安です。同じサイズの機種への入れ替えであれば1時間前後で完了することも多く、" +
      "天板の状態や設置環境によって前後します。",
    checkpoints: [
      "ガス種別（都市ガス13Aかプロパンガス〈LPG〉か）。種別が違う機種はそのまま使用できません",
      "天板の開口幅（幅60cm／75cm）と奥行き、コンロ台の内寸",
      "電源を必要とする機種の場合、近くにコンセントがあるか",
      "天板の仕上げ（ガラストップ／ステンレスなど）の希望",
      "ガス可とう管接続具の接続口の位置と状態"
    ]
  },

  "レンジフード交換": {
    filterSlug: "rangehood",
    servicesAnchor: "#cat-rangehood",
    lead:
      "レンジフードの交換は、既存のフードを取り外し、同じ幅（一般的に60cm・75cm・90cm）の新しいフードを" +
      "壁面や吊戸棚に固定して、排気ダクトと電源を接続する工事です。" +
      "油汚れが落ちにくくなった、運転音が大きくなった、といった経年の症状をきっかけに検討されることが多い工事です。",
    flow: [
      "ブレーカーを落とし、電源を遮断する",
      "整流板・フィルター・ファンなどを外し、既存のフード本体を取り外す",
      "排気ダクトの位置と径、下地や取付金具の状態を確認する",
      "新しいフードの取付金具を固定し、本体を据え付ける",
      "排気ダクトを接続し、隙間をふさぐ",
      "電源を接続し、風量切替と照明の動作を確認する"
    ],
    duration:
      "一般的には2〜3時間程度が目安です。幕板の加工が必要な場合や、既存フードと新しいフードの形状が" +
      "大きく異なる場合には長くなることがあります。",
    checkpoints: [
      "既存フードの幅（60cm／75cm／90cm）と高さ、吊戸棚との位置関係",
      "排気ダクトの位置（横排気か上排気か）と径",
      "電源の取り方（コンセントか直結か）",
      "幕板（前幕板・横幕板）を既存のまま使えるか、新しく用意する必要があるか",
      "プロペラファン型からシロッコファン型へ変更する場合など、方式が変わるときは追加工事が必要になることがあります"
    ]
  },

  "IHクッキングヒーター交換": {
    filterSlug: "ih-cooktop",
    servicesAnchor: "#cat-ih",
    lead:
      "IHクッキングヒーターの交換は、キッチン天板の開口部に本体を納め、専用の200V回路へ接続する工事です。" +
      "既存もIHであれば入れ替えは比較的シンプルですが、ガスコンロからの入れ替えでは電気工事が別途必要になります。",
    flow: [
      "専用ブレーカーを落として通電を止める",
      "既存機の電源接続を外し、本体を天板から取り出す",
      "開口部の寸法と、電源の結線方式・容量を確認する",
      "新しい本体を開口部に納め、位置と水平を調整する",
      "電源を結線し、絶縁の状態を確認する",
      "通電して各ヒーターとグリルの動作を確認する"
    ],
    duration:
      "一般的には1〜2時間程度が目安です。既存もIHで同じ幅・同じ電源仕様であれば短く済みますが、" +
      "ガスコンロからの入れ替えの場合は、電気工事とガス栓の処置が別途必要になります。",
    checkpoints: [
      "200Vの専用回路が来ているか、ブレーカーの容量は足りているか",
      "天板の開口幅（幅60cm／75cm）と奥行き",
      "ガスコンロからの入れ替えの場合は、ガス栓の閉栓・撤去と電気工事が別途必要になること",
      "現在お使いの鍋・フライパンがIHに対応しているか",
      "分電盤に空き回路があるか"
    ]
  },

  "浴室乾燥機交換": {
    filterSlug: "bathroom-dryer",
    servicesAnchor: "#cat-bathdryer",
    lead:
      "浴室暖房乾燥機（浴室換気乾燥機）の交換は、浴室天井の開口部に本体を納め、" +
      "排気ダクト・電源・リモコン配線を接続する工事です。天井裏での作業になるため、点検口や作業スペースの有無が" +
      "作業のしやすさを左右します。",
    flow: [
      "ブレーカーを落とし、電源を遮断する",
      "化粧グリル（パネル）を外し、既存の本体を天井から取り外す",
      "天井開口の寸法、ダクトの径と経路、電源とリモコン配線を確認する",
      "新しい本体を天井裏の下地に固定する",
      "ダクト・電源・リモコン線を接続する",
      "通電し、換気・乾燥・暖房・涼風など各運転とリモコン表示を確認する"
    ],
    duration:
      "一般的には1〜3時間程度が目安です。同等品への入れ替えであれば短く済みますが、" +
      "換気のみの機種から乾燥機能付きへ変更する場合や、1室換気から2室・3室換気へ変更する場合には長くなります。",
    checkpoints: [
      "天井点検口の有無と、天井裏に確保できる作業スペース",
      "天井開口の寸法（既存機の外形寸法）",
      "電源方式（100Vか200Vか）と、専用回路の有無",
      "換気の対象室数（1室換気・2室換気・3室換気）",
      "排気ダクトの径と、屋外へ抜けるルート"
    ]
  },

  "換気扇交換": {
    filterSlug: "vent-fan",
    servicesAnchor: "#cat-ventfan",
    lead:
      "換気扇の交換は、トイレや洗面所などの天井または壁に設置された換気扇を、" +
      "開口寸法とダクト径の合う機種へ入れ替える工事です。運転音が大きくなった、風量が落ちたといった症状が" +
      "検討のきっかけになることが多い工事です。",
    flow: [
      "ブレーカーを落として電源を遮断する",
      "化粧グリルを外し、既存の換気扇本体を取り外す",
      "開口寸法・ダクト径・電源の取り方を確認する",
      "新しい本体を下地に固定する",
      "ダクトと電源を接続する",
      "通電して運転音と排気の状態を確認する"
    ],
    duration:
      "一般的には1時間前後が目安です。開口寸法の調整やダクトの補修が必要な場合には長くなります。",
    checkpoints: [
      "天井（または壁）の開口寸法と、既存機の外形寸法",
      "排気ダクトの径と接続方向",
      "電源の取り方（コンセントか直結か）とスイッチの位置",
      "必要な換気風量（間取りや使用状況に応じて変わります）",
      "天井裏に本体を納めるだけの高さがあるか"
    ]
  }
};

/* =====================================================================
   小さなユーティリティ
   ===================================================================== */

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// XML（sitemap.xml）用。属性値は使わないので最小限。
function escapeXml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * JSON-LD を <script> の中に安全に埋め込む。
 * "</script>" で早期に閉じられてしまう事故を防ぐため "<" をエスケープする。
 * （< は JSON の文字列としては "<" と等価なのでパース結果は変わらない）
 */
function toJsonLd(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, "\\u003c");
}

/**
 * content/works/*.json の画像パスは "images/..." と "/images/..." が
 * 混在している（CMSの public_folder 変更前後のデータが混ざっているため）。
 * 詳細ページはサブディレクトリ works/ に置かれるので、相対パスのままだと
 * /works/images/... を見に行って壊れる。必ずルート絶対パスに正規化する。
 */
function normalizeImagePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return PLACEHOLDER_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.charAt(0) === "/" ? raw : "/" + raw;
}

function toAbsoluteUrl(pathOrUrl) {
  const value = String(pathOrUrl || "");
  if (/^https?:\/\//i.test(value)) return value;
  return SITE_ORIGIN + (value.charAt(0) === "/" ? value : "/" + value);
}

function isRealPhoto(imagePath) {
  const value = String(imagePath || "");
  return Boolean(value) && !/_placeholder\.svg$/i.test(value);
}

/**
 * 検索エンジンに登録してよい事例かどうか。
 * ビフォー・アフターともプレースホルダー画像の場合、独自コンテンツが実質ゼロの
 * 「内容の薄いページ」になるため、noindex を付けて sitemap からも除外する。
 * (写真が用意されて再ビルドされれば、自動的に登録対象へ戻る)
 */
function isIndexableWork(work) {
  return isRealPhoto(work.before_image) || isRealPhoto(work.after_image);
}

function parseDateToTime(dateStr) {
  if (!dateStr) return null;
  const time = new Date(dateStr).getTime();
  return isNaN(time) ? null : time;
}

/** "2024-05-11" -> "2024年5月11日"。空・不正な値は "" を返す。 */
function formatDateJa(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return "";
  return year + "年" + month + "月" + day + "日";
}

/** "2024-05-11" -> "2024年5月"。タイトル重複時の識別子に使う。 */
function formatYearMonthJa(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length < 2) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return "";
  return year + "年" + month + "月";
}

function todayIso() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + mm + "-" + dd;
}

/** メーカー + 品番 を js/works.js と同じ体裁で結合する。 */
function buildProductLabel(work) {
  const manufacturer = String(work.manufacturer || "").trim();
  const model = String(work.model || "").trim();
  if (manufacturer && model) return manufacturer + " " + model;
  return model || manufacturer || "";
}

/** メーカー名が "不明" のときは商品名として前に出さない。 */
function buildProductLabelForTitle(work) {
  const manufacturer = String(work.manufacturer || "").trim();
  const model = String(work.model || "").trim();
  if (!manufacturer || manufacturer === "不明") return model;
  return buildProductLabel(work);
}

function hasArea(work) {
  const area = String(work.area || "").trim();
  return Boolean(area) && area !== AREA_UNKNOWN;
}

/* =====================================================================
   データの読み込み・整形
   ===================================================================== */

/**
 * content/works/*.json を読み、slug（ファイル名から拡張子を除いたもの）を
 * 付与した配列を返す。build-works-index.js から呼ばれる場合は
 * すでに slug 付きの配列が渡されるため、この関数は使われない。
 */
function readWorksFromDir() {
  const fileNames = fs
    .readdirSync(WORKS_JSON_DIR)
    .filter(function (name) {
      return name.toLowerCase().endsWith(".json");
    })
    .sort();

  return fileNames.map(function (fileName) {
    const filePath = path.join(WORKS_JSON_DIR, fileName);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    parsed.slug = fileName.replace(/\.json$/i, "");
    return parsed;
  });
}

function sortByDateDesc(works) {
  return works.slice().sort(function (a, b) {
    const timeA = parseDateToTime(a.date);
    const timeB = parseDateToTime(b.date);
    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeB - timeA;
  });
}

/**
 * ページの見出し（H1 / <title> の主部）に使う短い名前を作る。
 * 例: 「埼玉県川口市の蛇口交換」／エリア不明時は「蛇口交換」
 */
function buildShortName(work) {
  const category = String(work.category || "施工事例").trim();
  return hasArea(work) ? work.area + "の" + category : category;
}

/**
 * <title> を組み立てる。
 * 「{エリア}の{カテゴリ}事例｜{メーカー} {品番}｜住まいの設備屋さん」
 *
 * 同じエリア・同じカテゴリ・同じ品番の事例が複数ある場合は
 * これだけでは重複するため、後段の dedupeTitles() で段階的に
 * 施工年月 → 施工日 → slug を付け足して一意にする。
 */
function buildBaseTitle(work) {
  const product = buildProductLabelForTitle(work);
  const head = buildShortName(work) + "事例";
  return product ? head + "｜" + product : head;
}

/**
 * タイトルの重複を解消する。
 * 重複したグループにだけ識別子を付けるので、衝突していないタイトルは
 * 余計な文字が付かず簡潔なまま保たれる。
 */
function dedupeTitles(entries) {
  const suffixBuilders = [
    function (entry) {
      return formatYearMonthJa(entry.work.date);
    },
    function (entry) {
      return formatDateJa(entry.work.date);
    },
    function (entry) {
      return entry.work.slug;
    }
  ];

  for (let pass = 0; pass <= suffixBuilders.length; pass++) {
    const groups = new Map();
    entries.forEach(function (entry) {
      const list = groups.get(entry.headTitle) || [];
      list.push(entry);
      groups.set(entry.headTitle, list);
    });

    const collisions = [];
    groups.forEach(function (list) {
      if (list.length > 1) collisions.push(list);
    });
    if (collisions.length === 0) return;

    if (pass === suffixBuilders.length) {
      throw new Error(
        "施工実績ページのタイトルが重複したまま解消できませんでした: " +
          collisions[0].map(function (e) { return e.work.slug; }).join(", ")
      );
    }

    const build = suffixBuilders[pass];
    collisions.forEach(function (list) {
      list.forEach(function (entry) {
        const suffix = build(entry);
        if (suffix) {
          entry.headTitle = entry.baseTitle + "（" + suffix + "施工）";
        }
      });
    });
  }
}

/* =====================================================================
   HTML パーツ
   ===================================================================== */

const NAV_ITEMS = [
  { href: "/", label: "トップ" },
  { href: "/services", label: "サービス・料金" },
  { href: "/reserve", label: "ご予約" },
  { href: "/works", label: "施工実績" },
  { href: "/area", label: "対応エリア" },
  { href: "/faq", label: "よくある質問" },
  { href: "/about", label: "会社概要" },
  { href: "/contact", label: "お問い合わせ", cta: true }
];

/**
 * 詳細ページは works/ サブディレクトリに置かれるため、既存ページの
 * ような相対パス（"index.html" / "css/style.css"）はそのまま使えない。
 * すべてルート絶対パス、かつサイトの正規表記に合わせた拡張子なしURLにする
 * （拡張子ありだと Cloudflare Pages が 308 リダイレクトを返すため、
 * 内部リンクからは無駄なリダイレクトを1段挟むことになる）。
 */
function buildHeader() {
  const navHtml = NAV_ITEMS.map(function (item) {
    const isCurrent = item.href === "/works";
    const cls = item.cta ? ' class="nav-cta"' : "";
    const current = isCurrent ? ' aria-current="page"' : "";
    return (
      '        <li><a href="' + item.href + '"' + cls + current + ">" +
      escapeHtml(item.label) +
      "</a></li>"
    );
  }).join("\n");

  return [
    '<header class="site-header">',
    '  <div class="container header-inner">',
    '    <a href="/" class="logo" aria-label="住まいの設備屋さん トップページへ">',
    '      <span class="logo-mark" aria-hidden="true">住</span>',
    '      <span class="logo-text">',
    '        <span class="logo-text-main">住まいの設備屋さん</span>',
    '        <span class="logo-text-sub">住宅設備 交換専門</span>',
    "      </span>",
    "    </a>",
    "",
    '    <button type="button" class="hamburger" id="hamburger-btn" aria-expanded="false" aria-controls="site-nav" aria-label="メニューを開く">',
    "      <span></span><span></span><span></span>",
    "    </button>",
    "",
    '    <nav class="site-nav" id="site-nav" aria-label="グローバルナビゲーション">',
    "      <ul>",
    navHtml,
    "      </ul>",
    "    </nav>",
    "  </div>",
    "</header>"
  ].join("\n");
}

function buildFooter() {
  const navHtml = NAV_ITEMS.map(function (item) {
    return '        <li><a href="' + item.href + '">' + escapeHtml(item.label) + "</a></li>";
  }).join("\n");

  return [
    '<footer class="site-footer">',
    '  <div class="container footer-inner">',
    '    <div class="footer-brand">',
    '      <a href="/" class="logo" aria-label="住まいの設備屋さん トップページへ">',
    '        <span class="logo-mark" aria-hidden="true">住</span>',
    '        <span class="logo-text">',
    '          <span class="logo-text-main">住まいの設備屋さん</span>',
    '          <span class="logo-text-sub">住宅設備 交換専門</span>',
    "        </span>",
    "      </a>",
    "      <p>東京・埼玉の一部対応エリアにて、トイレ・温水洗浄便座・蛇口・ビルトイン食洗機・ビルトインコンロ・レンジフード・IHクッキングヒーター・浴室乾燥機・換気扇の交換工事を専門に行っています。対応地域と対応商品を絞ることで、明朗な低価格と正確な施工を両立しています。</p>",
    "    </div>",
    "",
    '    <nav class="footer-nav" aria-label="サイト内リンク">',
    '      <p class="footer-heading">サイトメニュー</p>',
    "      <ul>",
    navHtml,
    "      </ul>",
    "    </nav>",
    "",
    '    <div class="footer-contact">',
    '      <p class="footer-heading">お問い合わせ</p>',
    "      <p>メールでのお問い合わせのみとなります。</p>",
    '      <p><a class="text-link" href="mailto:sumainosetsubiya@gmail.com">sumainosetsubiya@gmail.com</a></p>',
    '      <a href="/contact" class="btn btn-primary">お問い合わせフォームへ</a>',
    "    </div>",
    "  </div>",
    "",
    '  <div class="footer-bottom">',
    "    <p>&copy; 2026 住まいの設備屋さん All Rights Reserved.</p>",
    "  </div>",
    "</footer>"
  ].join("\n");
}

/**
 * 関連事例（同エリア／同カテゴリ）のカード。
 * 一覧ページのカードとトーンを揃えつつ、詳細ページでは施工後写真1枚だけの
 * コンパクトなカードにして、本文の読みやすさを優先する。
 */
function buildRelatedCard(work) {
  const area = String(work.area || "").trim();
  const category = String(work.category || "").trim();
  const product = buildProductLabel(work);
  const dateJa = formatDateJa(work.date);
  const afterImage = normalizeImagePath(work.after_image);
  const alt =
    (hasArea(work) ? area + "での" : "") +
    (category || "設備交換") +
    "工事" +
    (product ? "（" + product + "）" : "") +
    "、施工後の様子";

  const metaLines = [];
  if (dateJa) metaLines.push("施工日: " + dateJa);
  if (area) metaLines.push("エリア: " + area);

  return [
    '        <a class="card-link" href="/works/' + escapeHtml(work.slug) + '">',
    '          <div class="card">',
    '            <img class="work-photo" src="' + escapeHtml(afterImage) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" width="800" height="600">',
    '            <span class="tag" style="margin-top: var(--spacing-sm);">' + escapeHtml(category) + "</span>",
    '            <h3 class="card-title">' + escapeHtml(product || category) + "</h3>",
    '            <p class="card-text">' + escapeHtml(metaLines.join(" / ")) + "</p>",
    '            <p class="card-text mt-sm" style="color: var(--color-primary); font-weight: 700;">この事例の詳細を見る &rarr;</p>',
    "          </div>",
    "        </a>"
  ].join("\n");
}

function buildRelatedSection(heading, lead, works, extraLinkHtml) {
  if (works.length === 0) return "";
  return [
    '  <section class="section section-alt">',
    '    <div class="container">',
    '      <div class="section-header" style="margin-bottom: var(--spacing-md);">',
    '        <h2 class="section-title" style="font-size: 1.4rem;">' + escapeHtml(heading) + "</h2>",
    '        <p class="section-lead">' + escapeHtml(lead) + "</p>",
    "      </div>",
    '      <div class="grid grid-3">',
    works.map(buildRelatedCard).join("\n"),
    "      </div>",
    extraLinkHtml ? '      <p class="mt-md">' + extraLinkHtml + "</p>" : "",
    "    </div>",
    "  </section>"
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * カテゴリ解説セクション。ここが「1件あたりの独自情報が少ない」問題への
 * 中心的な対策になる（写真とあわせて、ページに読む価値のある本文を持たせる）。
 */
function buildCategoryGuideSection(category, guide) {
  if (!guide) return "";

  const flowHtml = guide.flow
    .map(function (step) {
      return '          <li class="step-item">' + escapeHtml(step) + "</li>";
    })
    .join("\n");

  const checkHtml = guide.checkpoints
    .map(function (item) {
      return "          <li>" + escapeHtml(item) + "</li>";
    })
    .join("\n");

  return [
    '  <section class="section">',
    '    <div class="container">',
    '      <div style="max-width: 900px; margin-inline: auto;">',
    '        <h2 class="section-title" style="font-size: 1.4rem; text-align: left;">' +
      escapeHtml(category) + "について（一般的な工事の内容）</h2>",
    '        <p class="text-muted" style="font-size: 0.85rem;">',
    "          ここから下は、" + escapeHtml(category) +
      "の一般的な工事内容をまとめたものです。実際の作業手順・所要時間は、",
    "          お住まいの状況や既存設備の状態によって異なります。この事例で実際にかかった時間は、",
    "          上の「作業時間」欄をご覧ください。",
    "        </p>",
    "        <p>" + escapeHtml(guide.lead) + "</p>",
    "",
    '        <h3 class="mt-lg">工事の流れ（一般的な例）</h3>',
    '        <ol class="step-list">',
    flowHtml,
    "        </ol>",
    "",
    '        <h3 class="mt-lg">所要時間の目安</h3>',
    "        <p>" + escapeHtml(guide.duration) + "</p>",
    "",
    '        <h3 class="mt-lg">事前に確認しておきたいこと</h3>',
    '        <ul style="display: grid; gap: 0.5em; color: var(--color-text-light);">',
    checkHtml,
    "        </ul>",
    "",
    '        <p class="mt-lg">',
    '          <a class="text-link" href="/services' + escapeHtml(guide.servicesAnchor) + '">' +
      escapeHtml(category.replace(/交換$/, "")) + "の商品グレードと料金を見る &rarr;</a>",
    "        </p>",
    "      </div>",
    "    </div>",
    "  </section>"
  ].join("\n");
}

/* =====================================================================
   1ページ分のHTMLを組み立てる
   ===================================================================== */

function renderPage(entry, allWorks) {
  const work = entry.work;
  const slug = work.slug;
  const area = String(work.area || "").trim();
  const category = String(work.category || "").trim();
  const manufacturer = String(work.manufacturer || "").trim();
  const model = String(work.model || "").trim();
  const duration = String(work.duration || "").trim();
  const note = String(work.note || "").trim();
  const product = buildProductLabel(work);
  const dateJa = formatDateJa(work.date);
  const shortName = buildShortName(work);
  const guide = CATEGORY_GUIDES[category] || null;

  const pageUrl = SITE_ORIGIN + "/works/" + slug;
  const beforeImage = normalizeImagePath(work.before_image);
  const afterImage = normalizeImagePath(work.after_image);

  // OGP画像は実写真を優先。写真がまだ用意できていない（プレースホルダー）
  // エントリでは、SVGを共有画像に使っても意味がないので既定のOGP画像に退避する。
  const ogImage = toAbsoluteUrl(
    isRealPhoto(afterImage) ? afterImage : OGP_FALLBACK_PATH
  );

  const title = entry.headTitle + "｜" + SITE_NAME;

  const descriptionParts = [];
  descriptionParts.push(
    (dateJa ? dateJa + "に" : "") +
      (hasArea(work) ? area + "で" : "") +
      "行った" +
      (category || "設備交換") +
      "の施工事例です。"
  );
  if (product) descriptionParts.push("取付商品は" + product + "。");
  if (duration) descriptionParts.push("作業時間は約" + duration + "。");
  descriptionParts.push(
    "施工前後の写真と、" + (category || "設備交換") + "工事の一般的な流れ・事前の確認ポイントをご紹介します。"
  );
  const description = descriptionParts.join("");

  const altBefore =
    (hasArea(work) ? area + "での" : "") +
    (category || "設備交換") +
    "工事" +
    (product ? "（" + product + "）" : "") +
    "、施工前の様子";
  const altAfter =
    (hasArea(work) ? area + "での" : "") +
    (category || "設備交換") +
    "工事" +
    (product ? "（" + product + "）" : "") +
    "、施工後の様子";

  /* ---------------- 構造化データ ---------------- */

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "トップ", item: SITE_ORIGIN + "/" },
      { "@type": "ListItem", position: 2, name: "施工実績", item: SITE_ORIGIN + "/works" },
      { "@type": "ListItem", position: 3, name: shortName + "事例", item: pageUrl }
    ]
  };

  // Article: 施工事例の記事ページとして妥当なスキーマ。
  // date が空のエントリ（1件存在する）では datePublished / dateModified を
  // 出力すると不正な値になるため、キーごと省く。
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    headline: entry.headTitle,
    description: description,
    inLanguage: "ja",
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN + "/" },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN + "/" }
  };

  const ldImages = [];
  if (isRealPhoto(beforeImage)) ldImages.push(toAbsoluteUrl(beforeImage));
  if (isRealPhoto(afterImage)) ldImages.push(toAbsoluteUrl(afterImage));
  if (ldImages.length > 0) articleLd.image = ldImages;

  if (work.date && parseDateToTime(work.date) !== null) {
    articleLd.datePublished = work.date;
    articleLd.dateModified = work.date;
  }
  if (category) articleLd.about = category;
  if (hasArea(work)) articleLd.contentLocation = { "@type": "Place", name: area };

  /* ---------------- 関連事例 ---------------- */

  const sameArea = hasArea(work)
    ? allWorks
        .filter(function (other) {
          return other.slug !== slug && other.area === area;
        })
        .slice(0, RELATED_LIMIT)
    : [];

  const sameAreaSlugs = new Set(
    sameArea.map(function (other) {
      return other.slug;
    })
  );

  const sameCategory = allWorks
    .filter(function (other) {
      return (
        other.slug !== slug &&
        other.category === category &&
        !sameAreaSlugs.has(other.slug)
      );
    })
    .slice(0, RELATED_LIMIT);

  const areaSectionHtml = buildRelatedSection(
    area + "の他の施工事例",
    area + "で承った他の交換工事の事例です。",
    sameArea,
    '<a class="text-link" href="/area">対応エリアの一覧を見る &rarr;</a>'
  );

  const categorySectionHtml = buildRelatedSection(
    "他のエリアの" + (category || "施工") + "事例",
    "同じ" + (category || "カテゴリ") + "の施工事例です。設置環境による違いもあわせてご覧ください。",
    sameCategory,
    guide
      ? '<a class="text-link" href="/works#' + escapeHtml(guide.filterSlug) + '">' +
        escapeHtml(category) + "の事例をすべて見る &rarr;</a>"
      : '<a class="text-link" href="/works">施工実績の一覧を見る &rarr;</a>'
  );

  /* ---------------- 工事概要テーブル ---------------- */

  const specRows = [];
  if (dateJa) specRows.push(["施工日", escapeHtml(dateJa)]);
  if (area) {
    specRows.push([
      "施工エリア",
      hasArea(work)
        ? '<a class="text-link" href="/area">' + escapeHtml(area) + "</a>"
        : escapeHtml(area)
    ]);
  }
  if (category) {
    specRows.push([
      "カテゴリ",
      guide
        ? '<a class="text-link" href="/works#' + escapeHtml(guide.filterSlug) + '">' +
          escapeHtml(category) + "</a>"
        : escapeHtml(category)
    ]);
  }
  if (manufacturer) specRows.push(["メーカー", escapeHtml(manufacturer)]);
  if (model) specRows.push(["品番", escapeHtml(model)]);
  if (duration) specRows.push(["作業時間", "約" + escapeHtml(duration)]);

  const specRowsHtml = specRows
    .map(function (row) {
      return (
        "            <tr><th scope=\"row\">" + escapeHtml(row[0]) + "</th><td>" + row[1] + "</td></tr>"
      );
    })
    .join("\n");

  // note は14件しか入っていないため、空の場合は枠ごと出さない
  // （「コメントなし」のような空虚な表示を作らない）。
  const noteHtml = note
    ? [
        '        <div class="form-note mb-lg">',
        "          <strong>この事例について</strong>",
        "          <p style=\"margin-bottom: 0;\">" + escapeHtml(note) + "</p>",
        "        </div>"
      ].join("\n")
    : "";

  const html = [
    "<!DOCTYPE html>",
    '<html lang="ja">',
    "<head>",
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>" + escapeHtml(title) + "</title>",
    '  <meta name="description" content="' + escapeHtml(description) + '">',
    '  <link rel="canonical" href="' + escapeHtml(pageUrl) + '">',
    isIndexableWork(entry.work)
      ? null
      : '  <meta name="robots" content="noindex, follow">',
    '  <meta name="google-site-verification" content="' + GSC_VERIFICATION + '">',
    "",
    "  <!-- OGP（SNS等でシェアされた際の表示設定） -->",
    '  <meta property="og:type" content="article">',
    '  <meta property="og:site_name" content="' + SITE_NAME + '">',
    '  <meta property="og:title" content="' + escapeHtml(entry.headTitle) + '">',
    '  <meta property="og:description" content="' + escapeHtml(description) + '">',
    '  <meta property="og:url" content="' + escapeHtml(pageUrl) + '">',
    '  <meta property="og:image" content="' + escapeHtml(ogImage) + '">',
    '  <meta name="twitter:card" content="summary_large_image">',
    "",
    '  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIyIiBmaWxsPSIjMGY3YTZjIi8+PHRleHQgeD0iNTAiIHk9IjcxIiBmb250LXNpemU9IjU4IiBmaWxsPSIjZmZmZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPuS9jzwvdGV4dD48L3N2Zz4K">',
    '  <link rel="stylesheet" href="/css/style.css">',
    '  <script src="/js/main.js" defer></script>',
    "",
    "  <!-- 構造化データ（JSON-LD / BreadcrumbList） -->",
    '  <script type="application/ld+json">',
    toJsonLd(breadcrumbLd),
    "  </script>",
    "",
    "  <!-- 構造化データ（JSON-LD / Article） -->",
    '  <script type="application/ld+json">',
    toJsonLd(articleLd),
    "  </script>",
    "",
    "  <!-- Google tag (gtag.js) -->",
    '  <script async src="https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID + '"></script>',
    "  <script>",
    "    window.dataLayer = window.dataLayer || [];",
    "    function gtag(){dataLayer.push(arguments);}",
    "    gtag('js', new Date());",
    "    gtag('config', '" + GA_MEASUREMENT_ID + "');",
    "  </script>",
    "",
    "</head>",
    "<body>",
    "",
    '<a class="skip-link" href="#main-content">本文へスキップ</a>',
    "",
    buildHeader(),
    "",
    '<main id="main-content">',
    "",
    '  <nav class="breadcrumb container" aria-label="パンくずリスト">',
    '    <a href="/">トップ</a><span class="sep">&gt;</span><a href="/works">施工実績</a><span class="sep">&gt;</span><span>' +
      escapeHtml(shortName) + "事例</span>",
    "  </nav>",
    "",
    "  <!-- ===================== ページヘッダー ===================== -->",
    '  <section class="section" style="padding-top: var(--spacing-md); padding-bottom: var(--spacing-md);">',
    '    <div class="container">',
    '      <div style="max-width: 900px; margin-inline: auto;">',
    '        <span class="tag">' + escapeHtml(category) + "</span>",
    '        <h1 class="section-title" style="text-align: left; margin-top: var(--spacing-sm);">' +
      escapeHtml(entry.headTitle) + "</h1>",
    '        <p class="section-lead" style="text-align: left; margin-inline: 0;">',
    "          " + escapeHtml(description),
    "        </p>",
    "      </div>",
    "    </div>",
    "  </section>",
    "",
    "  <!-- ===================== 施工前後の写真（このページの主役） ===================== -->",
    '  <section class="section" style="padding-top: 0;">',
    '    <div class="container">',
    '      <div style="max-width: 900px; margin-inline: auto;">',
    '        <div class="grid grid-2" style="gap: var(--spacing-md);">',
    "          <figure>",
    '            <img class="work-photo" src="' + escapeHtml(beforeImage) + '" alt="' + escapeHtml(altBefore) + '" width="800" height="600" decoding="async">',
    '            <figcaption class="product-photo-caption" style="border: none; padding-inline: 0;"><strong>施工前</strong>' +
      escapeHtml(shortName) + "の交換前の状態です。</figcaption>",
    "          </figure>",
    "          <figure>",
    '            <img class="work-photo" src="' + escapeHtml(afterImage) + '" alt="' + escapeHtml(altAfter) + '" width="800" height="600" decoding="async">',
    '            <figcaption class="product-photo-caption" style="border: none; padding-inline: 0;"><strong>施工後</strong>' +
      escapeHtml(product ? product + "に交換した状態です。" : "交換後の状態です。") + "</figcaption>",
    "          </figure>",
    "        </div>",
    "",
    noteHtml,
    "",
    '        <h2 class="mt-lg" style="font-size: 1.25rem;">この事例の詳細</h2>',
    '        <div class="table-wrap">',
    '          <table class="price-table" aria-label="' + escapeHtml(shortName) + '事例の詳細">',
    "            <tbody>",
    specRowsHtml,
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="text-muted mt-sm" style="font-size: 0.85rem;">',
    "          作業時間は当日の状況により前後します。表示している時間はこの事例で実際にかかった時間です。",
    "        </p>",
    "",
    '        <div class="btn-group mt-md">',
    '          <a href="/reserve" class="btn btn-primary">同じような工事のご予約はこちら</a>',
    '          <a href="/contact" class="btn btn-outline">まずは相談・見積り依頼</a>',
    "        </div>",
    "      </div>",
    "    </div>",
    "  </section>",
    "",
    "  <!-- ===================== カテゴリ解説 ===================== -->",
    buildCategoryGuideSection(category, guide),
    "",
    "  <!-- ===================== 関連する施工事例 ===================== -->",
    areaSectionHtml,
    categorySectionHtml,
    "",
    "  <!-- ===================== CTA ===================== -->",
    '  <section class="section">',
    '    <div class="container">',
    '      <div class="cta-section">',
    "        <h2>" + escapeHtml((hasArea(work) ? area + "の" : "") + (category || "設備交換")) + "のご相談を承っています</h2>",
    "        <p>",
    "          東京都・埼玉県の対応エリア内で、住宅設備の交換工事を専門に行っています。",
    "          現地の状況を確認したうえでのお見積りも可能です。まずはお気軽にご相談ください。",
    "        </p>",
    '        <div class="cta-actions">',
    '          <a href="/reserve" class="btn btn-primary btn-lg">ご予約はこちら</a>',
    '          <a href="/contact" class="btn btn-outline-inverse btn-lg">お問い合わせはこちら</a>',
    "        </div>",
    "      </div>",
    '      <p class="text-center mt-md">',
    '        <a class="text-link" href="/works">施工実績の一覧に戻る</a>',
    "      </p>",
    "    </div>",
    "  </section>",
    "",
    "</main>",
    "",
    buildFooter(),
    "",
    "</body>",
    "</html>",
    ""
  ]
    .filter(function (line) {
      // 条件付きで出力しない行（noindex など）は null を入れているため取り除く
      return line !== null;
    })
    .join("\n");

  return html;
}

/* =====================================================================
   sitemap.xml の更新
   ===================================================================== */

/**
 * sitemap.xml の <!-- WORKS:START --> 〜 <!-- WORKS:END --> の間だけを
 * 置き換える。マーカーの外側（手書きの固定ページ8件）には一切触れない。
 */
function updateSitemap(entries) {
  if (!fs.existsSync(SITEMAP_PATH)) {
    throw new Error("sitemap.xml が見つかりません: " + SITEMAP_PATH);
  }

  const original = fs.readFileSync(SITEMAP_PATH, "utf8");
  const startIndex = original.indexOf(SITEMAP_START);
  const endIndex = original.indexOf(SITEMAP_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      "sitemap.xml に施工実績の自動生成マーカーが見つかりません。\n" +
        "  " + SITEMAP_START + " と " + SITEMAP_END + " を </urlset> の直前に追加してください。"
    );
  }

  const fallbackLastmod = todayIso();
  // 写真が未登録の事例は noindex にしているため sitemap からも外す
  const indexableEntries = entries.filter(function (entry) {
    return isIndexableWork(entry.work);
  });
  const body = indexableEntries
    .map(function (entry) {
      const lastmod =
        entry.work.date && parseDateToTime(entry.work.date) !== null
          ? entry.work.date
          : fallbackLastmod;
      return [
        "",
        "  <url>",
        "    <loc>" + escapeXml(SITE_ORIGIN + "/works/" + entry.work.slug) + "</loc>",
        "    <lastmod>" + escapeXml(lastmod) + "</lastmod>",
        "    <changefreq>monthly</changefreq>",
        "    <priority>0.6</priority>",
        "  </url>"
      ].join("\n");
    })
    .join("\n");

  const updated =
    original.slice(0, startIndex + SITEMAP_START.length) +
    body +
    "\n\n  " +
    original.slice(endIndex);

  if (updated !== original) {
    fs.writeFileSync(SITEMAP_PATH, updated, "utf8");
  }
  return indexableEntries.length;
}

/* =====================================================================
   エントリポイント
   ===================================================================== */

/**
 * @param {Array<Object>} works slug 付きの施工実績配列。省略時は
 *                              content/works/*.json から読み直す。
 */
function build(works) {
  const source = Array.isArray(works) && works.length > 0 ? works : readWorksFromDir();

  const missingSlug = source.filter(function (work) {
    return !work.slug;
  });
  if (missingSlug.length > 0) {
    throw new Error(
      "slug が設定されていない施工実績があります（" + missingSlug.length + "件）。" +
        "build-works-index.js が slug を付与しているか確認してください。"
    );
  }

  const sorted = sortByDateDesc(source);

  const entries = sorted.map(function (work) {
    const baseTitle = buildBaseTitle(work);
    return { work: work, baseTitle: baseTitle, headTitle: baseTitle };
  });

  dedupeTitles(entries);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const expectedFiles = new Set(
    entries.map(function (entry) {
      return entry.work.slug + ".html";
    })
  );

  // CMSから施工実績が削除された場合に、古い詳細ページが残り続けないよう
  // 生成対象に含まれない .html を掃除する。安全のため、このディレクトリ内の
  // .html 以外のファイルには一切触れない。
  fs.readdirSync(OUTPUT_DIR).forEach(function (name) {
    if (!name.toLowerCase().endsWith(".html")) return;
    if (expectedFiles.has(name)) return;
    fs.unlinkSync(path.join(OUTPUT_DIR, name));
    console.log("[build-work-pages] 不要になった詳細ページを削除しました: works/" + name);
  });

  entries.forEach(function (entry) {
    const html = renderPage(entry, sorted);
    fs.writeFileSync(path.join(OUTPUT_DIR, entry.work.slug + ".html"), html, "utf8");
  });

  const sitemapCount = updateSitemap(entries);

  console.log(
    "[build-work-pages] " + entries.length + " 件の施工実績詳細ページを works/ に生成しました" +
      "（sitemap.xml へ " + sitemapCount + " 件を反映）。"
  );

  return entries.length;
}

module.exports = { build: build, CATEGORY_GUIDES: CATEGORY_GUIDES };

// 単体実行された場合のみ即実行する（require されただけでは動かさない）。
if (require.main === module) {
  build();
}
