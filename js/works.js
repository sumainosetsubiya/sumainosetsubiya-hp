/**
 * 住まいの設備屋さん — 施工実績ページ (works.html) 専用JS
 * ---------------------------------------------------------------
 * フレームワーク不使用の素のJavaScript。works.html からのみ
 * <script src="js/works.js" defer></script> で読み込まれます。
 *
 * 役割:
 *   content/works.json（Decap CMSが編集する単一JSONファイル）を
 *   fetch() で取得し、works.html の #works-grid 内に
 *   これまでハードコードされていたものと同じ HTML構造・CSSクラス
 *   （.card / .work-photo / .tag / .card-title 等）で
 *   施工実績カードを動的に生成する。
 *
 * 依存するHTML構造（works.html 参照）:
 *   <div class="grid grid-3" id="works-grid" aria-live="polite"> ... </div>
 *   <p id="works-error" style="display:none;"> ... </p>
 *
 * content/works.json のデータ構造:
 *   { "works": [
 *       {
 *         "date": "2024-05-11",            // 施工日（ISO形式 "YYYY-MM-DD"、未定の場合は ""）
 *         "area": "埼玉県川口市",           // 施工エリア
 *         "category": "ビルトイン食洗機交換", // カテゴリ（タグ表示に使用）
 *         "product": "Panasonic NP-45MS9S", // 取付商品（型番など）
 *         "duration": "1.5時間",            // 作業時間（"約"は表示側で付与）
 *         "before_image": "images/works/uploads/....jpg",
 *         "after_image": "images/works/uploads/....jpg",
 *         "note": ""                        // 任意の一言コメント（空文字可）
 *       }, ...
 *   ] }
 */
(function () {
  "use strict";

  var WORKS_JSON_PATH = "content/works.json";

  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("works-grid");
    var errorBox = document.getElementById("works-error");

    if (!grid) {
      return;
    }

    fetch(WORKS_JSON_PATH, { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("works.json の取得に失敗しました（HTTP " + response.status + "）");
        }
        return response.json();
      })
      .then(function (data) {
        var works = data && Array.isArray(data.works) ? data.works : null;
        if (!works || works.length === 0) {
          throw new Error("works.json に施工実績データが見つかりませんでした。");
        }
        renderWorks(grid, works);
      })
      .catch(function (error) {
        // eslint-disable-next-line no-console
        console.error("施工実績の読み込みに失敗しました:", error);
        grid.innerHTML = "";
        if (errorBox) {
          errorBox.style.display = "";
        }
      });
  });

  /**
   * 施工実績データの配列から .card 要素を生成し、コンテナに描画する。
   */
  function renderWorks(container, works) {
    container.innerHTML = "";

    sortWorksByDateDesc(works).forEach(function (work) {
      container.appendChild(buildWorkCard(work));
    });
  }

  /**
   * 施工実績を施工日の新しい順（降順）に並び替えた新しい配列を返す。
   * date が空・不正な値（new Date() でパースできない）のエントリは
   * 日付で比較できないため、常に配列の一番最後に回す。
   */
  function sortWorksByDateDesc(works) {
    return works.slice().sort(function (a, b) {
      var timeA = parseDateToTime(a.date);
      var timeB = parseDateToTime(b.date);

      var invalidA = timeA === null;
      var invalidB = timeB === null;

      if (invalidA && invalidB) {
        return 0;
      }
      if (invalidA) {
        return 1; // a を後ろへ
      }
      if (invalidB) {
        return -1; // b を後ろへ
      }

      return timeB - timeA; // 新しい日付が先頭に来るよう降順
    });
  }

  /**
   * 日付文字列を new Date() でパースし、タイムスタンプ(ms)を返す。
   * 空文字・パース不能な値の場合は null を返す。
   */
  function parseDateToTime(dateStr) {
    if (!dateStr) {
      return null;
    }
    var time = new Date(dateStr).getTime();
    return isNaN(time) ? null : time;
  }

  function buildWorkCard(work) {
    var area = work.area || "";
    var category = work.category || "";
    var product = work.product || "";
    var duration = work.duration || "";
    var note = work.note || "";

    var card = document.createElement("div");
    card.className = "card";

    // --- 施工前後の写真 ---
    var photoGrid = document.createElement("div");
    photoGrid.className = "grid grid-2";
    photoGrid.style.gap = "var(--spacing-sm)";
    photoGrid.style.marginBottom = "var(--spacing-sm)";

    var beforeImg = document.createElement("img");
    beforeImg.className = "work-photo";
    beforeImg.src = work.before_image || "images/works/uploads/_placeholder.svg";
    beforeImg.alt = area && category
      ? area + "での" + category + "工事、施工前の様子"
      : "施工前の様子";

    var afterImg = document.createElement("img");
    afterImg.className = "work-photo";
    afterImg.src = work.after_image || "images/works/uploads/_placeholder.svg";
    afterImg.alt = area && category
      ? area + "での" + category + "工事、施工後の様子"
      : "施工後の様子";

    photoGrid.appendChild(beforeImg);
    photoGrid.appendChild(afterImg);
    card.appendChild(photoGrid);

    // --- カテゴリタグ ---
    var tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = category;
    card.appendChild(tag);

    // --- 取付商品（カードタイトル） ---
    var title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = product;
    card.appendChild(title);

    // --- 詳細リスト ---
    var list = document.createElement("ul");
    list.style.fontSize = "0.9rem";
    list.style.color = "var(--color-text-light)";
    list.style.display = "grid";
    list.style.gap = "0.35em";

    list.appendChild(buildListItem("施工日:", formatDate(work.date, note)));
    list.appendChild(buildListItem("施工エリア:", area));
    list.appendChild(buildListItem("取付商品:", product));
    list.appendChild(buildListItem("作業時間:", duration ? "約" + duration : ""));

    card.appendChild(list);

    return card;
  }

  function buildListItem(label, value) {
    var li = document.createElement("li");

    var strong = document.createElement("strong");
    strong.style.color = "var(--color-text)";
    strong.textContent = label;

    li.appendChild(strong);
    li.appendChild(document.createTextNode(" " + value));

    return li;
  }

  /**
   * ISO形式("YYYY-MM-DD")の日付文字列を「YYYY年M月D日」形式に変換する。
   * date が空の場合は note（例:「施工事例を随時更新予定」）を代わりに表示する。
   */
  function formatDate(dateStr, note) {
    if (!dateStr) {
      return note || "施工事例を随時更新予定";
    }

    var parts = dateStr.split("-");
    if (parts.length !== 3) {
      return dateStr;
    }

    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return dateStr;
    }

    return year + "年" + month + "月" + day + "日";
  }
})();
