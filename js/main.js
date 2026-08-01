/**
 * 住まいの設備屋さん — 共通JS (main.js)
 * ---------------------------------------------------------------
 * フレームワーク不使用の素のJavaScript。
 * 全ページで <script src="js/main.js" defer></script> を
 * </body>直前（またはhead内にdefer付き）で読み込んでください。
 *
 * 現在の役割:
 *   1. ハンバーガーメニューの開閉
 *   2. メニュー内リンクをクリックしたら自動で閉じる
 *   3. 画面幅がPC表示（960px以上）に変わったらメニュー状態をリセット
 *   4. Escapeキーでメニューを閉じる
 *   5. メニュー外クリックで閉じる
 *
 * 依存するHTML構造（partials_header_footer_reference.html 参照）:
 *   <button class="hamburger" id="hamburger-btn"
 *           aria-expanded="false" aria-controls="site-nav"
 *           aria-label="メニューを開く"> ... </button>
 *   <nav class="site-nav" id="site-nav"> ... </nav>
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var hamburger = document.getElementById("hamburger-btn");
    var nav = document.getElementById("site-nav");

    if (!hamburger || !nav) {
      return;
    }

    var OPEN_LABEL = "メニューを開く";
    var CLOSE_LABEL = "メニューを閉じる";
    var DESKTOP_BREAKPOINT = 960;

    function openMenu() {
      nav.classList.add("is-open");
      hamburger.setAttribute("aria-expanded", "true");
      hamburger.setAttribute("aria-label", CLOSE_LABEL);
    }

    function closeMenu() {
      nav.classList.remove("is-open");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("aria-label", OPEN_LABEL);
    }

    function toggleMenu() {
      if (nav.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    hamburger.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu();
    });

    // メニュー内のリンクをクリックしたら閉じる（同一ページ内遷移も含む）
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeMenu();
      });
    });

    // メニュー外をクリックしたら閉じる
    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) {
        return;
      }
      var isClickInsideNav = nav.contains(event.target);
      var isClickOnHamburger = hamburger.contains(event.target);
      if (!isClickInsideNav && !isClickOnHamburger) {
        closeMenu();
      }
    });

    // Escapeキーで閉じる
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        closeMenu();
        hamburger.focus();
      }
    });

    // PC幅にリサイズされたら開閉状態をリセット（CSS側は960px以上で常時表示に切替）
    var mql = window.matchMedia("(min-width: " + DESKTOP_BREAKPOINT + "px)");
    function handleBreakpointChange(e) {
      if (e.matches) {
        closeMenu();
      }
    }
    if (mql.addEventListener) {
      mql.addEventListener("change", handleBreakpointChange);
    } else if (mql.addListener) {
      // Safari旧バージョン互換
      mql.addListener(handleBreakpointChange);
    }
  });
})();
