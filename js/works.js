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
 *   さらに #works-filter-tabs 内に、カテゴリ別の絞り込みタブ
 *   （「すべて」+9カテゴリ、実件数バッジ付き）を動的生成し、
 *   クリックで表示中のカードを絞り込む。日付降順ソートは
 *   絞り込み後も維持する。URLハッシュ（例: #toilet）でカテゴリを
 *   直接指定して開けるように、簡易的なディープリンクにも対応する。
 *
 * 依存するHTML構造（works.html 参照）:
 *   <div class="filter-tabs" id="works-filter-tabs"></div>
 *   <div class="grid grid-3" id="works-grid" aria-live="polite"> ... </div>
 *   <p id="works-error" style="display:none;"> ... </p>
 *
 * content/works.json のデータ構造:
 *   { "works": [
 *       {
 *         "date": "2024-05-11",            // 施工日（ISO形式 "YYYY-MM-DD"、未定の場合は ""）
 *         "area": "埼玉県川口市",           // 施工エリア
 *         "category": "ビルトイン食洗機交換", // カテゴリ（タグ表示・フィルターに使用）
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
  var ALL_SLUG = "all";

  // カテゴリの表示順・ハッシュ用スラッグ。件数が0件のカテゴリでも
  // ボタン自体は常に表示する（依頼主が指定した9カテゴリの固定リスト）。
  var CATEGORIES = [
    { slug: "toilet", label: "トイレ交換" },
    { slug: "washlet", label: "温水洗浄便座交換" },
    { slug: "faucet", label: "蛇口交換" },
    { slug: "dishwasher", label: "ビルトイン食洗機交換" },
    { slug: "cooktop", label: "ビルトインコンロ交換" },
    { slug: "rangehood", label: "レンジフード交換" },
    { slug: "ih-cooktop", label: "IHクッキングヒーター交換" },
    { slug: "bathroom-dryer", label: "浴室乾燥機交換" },
    { slug: "vent-fan", label: "換気扇交換" }
  ];

  var sortedWorks = [];
  var currentSlug = ALL_SLUG;
  var gridEl = null;
  var filterBarEl = null;

  document.addEventListener("DOMContentLoaded", function () {
    gridEl = document.getElementById("works-grid");
    var errorBox = document.getElementById("works-error");
    filterBarEl = document.getElementById("works-filter-tabs");

    if (!gridEl) {
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

        sortedWorks = sortWorksByDateDesc(works);
        currentSlug = resolveSlugFromHash(location.hash);

        if (filterBarEl) {
          buildFilterTabs(filterBarEl, sortedWorks, currentSlug);
        }
        renderFiltered(currentSlug);

        // ブラウザの戻る/進むや、他ページからの #category リンクにも追従する。
        window.addEventListener("hashchange", function () {
          var slug = resolveSlugFromHash(location.hash);
          if (slug === currentSlug) {
            return;
          }
          currentSlug = slug;
          if (filterBarEl) {
            updateActiveTab(filterBarEl, currentSlug);
          }
          renderFiltered(currentSlug);
        });
      })
      .catch(function (error) {
        // eslint-disable-next-line no-console
        console.error("施工実績の読み込みに失敗しました:", error);
        gridEl.innerHTML = "";
        if (errorBox) {
          errorBox.style.display = "";
        }
      });
  });

  /* ===================== カテゴリフィルター ===================== */

  /**
   * URLハッシュ（例: "#toilet"）から有効なカテゴリスラッグを取り出す。
   * 該当なし・空・不正な値の場合は ALL_SLUG（すべて表示）を返す。
   */
  function resolveSlugFromHash(hash) {
    var raw = (hash || "").replace(/^#/, "");
    if (!raw || raw === ALL_SLUG) {
      return ALL_SLUG;
    }
    return slugToLabel(raw) ? raw : ALL_SLUG;
  }

  /**
   * スラッグに対応するカテゴリ表示名を返す。該当なしの場合は null。
   */
  function slugToLabel(slug) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].slug === slug) {
        return CATEGORIES[i].label;
      }
    }
    return null;
  }

  /**
   * 「すべて」+ 9カテゴリのフィルタータブボタンを構築し、コンテナに描画する。
   * 各カテゴリの件数は、渡された works（fetch済みの全件データ）から
   * その場で集計するため、content/works.json 側の更新だけで
   * バッジの数字も自動的に追従する。
   */
  function buildFilterTabs(container, works, activeSlug) {
    container.innerHTML = "";

    var counts = {};
    works.forEach(function (work) {
      var category = work.category || "";
      counts[category] = (counts[category] || 0) + 1;
    });

    container.appendChild(
      buildTabButton(ALL_SLUG, "すべて", works.length, activeSlug === ALL_SLUG)
    );

    CATEGORIES.forEach(function (cat) {
      var count = counts[cat.label] || 0;
      container.appendChild(
        buildTabButton(cat.slug, cat.label, count, activeSlug === cat.slug)
      );
    });
  }

  function buildTabButton(slug, label, count, isActive) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-tab" + (isActive ? " is-active" : "");
    btn.setAttribute("data-slug", slug);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");

    var labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);

    var countSpan = document.createElement("span");
    countSpan.className = "filter-tab-count";
    countSpan.textContent = "(" + count + ")";
    btn.appendChild(countSpan);

    btn.addEventListener("click", function () {
      handleTabClick(slug);
    });

    return btn;
  }

  function handleTabClick(slug) {
    if (slug === currentSlug) {
      return;
    }
    currentSlug = slug;

    if (filterBarEl) {
      updateActiveTab(filterBarEl, slug);
    }
    renderFiltered(slug);

    // URLハッシュに反映し、カテゴリ絞り込み状態を直接リンクできるようにする。
    // ここで発生する hashchange は currentSlug との一致チェックにより
    // 二重描画にはならない（"すべて" のときは replaceState でハッシュを消す
    // ため hashchange 自体が発火しない）。
    if (slug === ALL_SLUG) {
      if (location.hash) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    } else {
      location.hash = slug;
    }
  }

  function updateActiveTab(container, activeSlug) {
    var buttons = container.querySelectorAll(".filter-tab");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var isActive = btn.getAttribute("data-slug") === activeSlug;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  /**
   * 現在選択中のスラッグに応じて sortedWorks を絞り込み、描画する。
   */
  function renderFiltered(slug) {
    if (!gridEl) {
      return;
    }

    var label = slug === ALL_SLUG ? null : slugToLabel(slug);
    var filtered = label
      ? sortedWorks.filter(function (work) {
          return work.category === label;
        })
      : sortedWorks;

    renderWorks(gridEl, filtered);
  }

  /* ===================== カード描画 ===================== */

  /**
   * 施工実績データの配列（既にソート・フィルタ済み）から .card 要素を
   * 生成し、コンテナに描画する。該当0件の場合は案内文を表示する。
   */
  function renderWorks(container, works) {
    container.innerHTML = "";

    if (works.length === 0) {
      var emptyMsg = document.createElement("p");
      emptyMsg.className = "section-lead";
      emptyMsg.textContent = "該当する施工実績がありません。";
      container.appendChild(emptyMsg);
      return;
    }

    works.forEach(function (work) {
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
