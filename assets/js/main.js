/* SIDRA STUDIO — site behaviour (no dependencies) */
(function () {
  "use strict";

  /* ---- 0-a. JavaScript が動いていることを CSS に伝える ----
     スクロール表示（.reveal）は要素をいったん透明にするので、
     このファイルが読めなかったときに本文が消えないよう、
     隠す指定は html.js が付いているときだけ効くようにしてある。
     defer で読み込んでいるため、最初の描画より前にここが走る。 */
  document.documentElement.classList.add("js");

  /* ---- 0-b. Webフォントの適用 ----
     head では media="print" にして描画を止めないようにしてある。
     読み込みは先に始まっているので、ここで全メディアに切り替えるだけ。
     HTML 側に onload を書かずに済むので、Content-Security-Policy を
     script-src 'self' のまま運用できる。 */
  Array.prototype.forEach.call(document.querySelectorAll("link[data-webfont]"), function (link) {
    link.media = "all";
  });

  /* ---- 1. モバイルナビゲーション ---- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("global-nav");

  if (toggle && nav) {
    var isOpen = function () {
      return toggle.getAttribute("aria-expanded") === "true";
    };

    var closeNav = function (returnFocus) {
      var wasOpen = isOpen();
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "メニューを開く");
      nav.classList.remove("is-open");
      document.body.classList.remove("is-nav-open");
      // Escape で閉じたときは、開くボタンに戻す（どこにいるか分からなくならないように）
      if (wasOpen && returnFocus) toggle.focus();
    };

    var openNav = function () {
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "メニューを閉じる");
      nav.classList.add("is-open");
      // ヘッダーの backdrop-filter を切って、ドロワーをビューポート全体に広げる
      document.body.classList.add("is-nav-open");
    };

    toggle.addEventListener("click", function () {
      if (isOpen()) closeNav();
      else openNav();
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeNav(true);
        return;
      }

      /* ドロワーは画面全体を覆うので、開いている間の Tab は
         「開閉ボタン＋メニュー内のリンク」の中だけを回す。
         そうしないと、見えていない本文へフォーカスが抜けてしまう。 */
      if (e.key !== "Tab" || !isOpen()) return;

      var focusable = [toggle].concat(
        Array.prototype.filter.call(nav.querySelectorAll("a[href], button:not([disabled])"), function (el) {
          return el.offsetParent !== null || el.getClientRects().length > 0;
        })
      );
      if (focusable.length < 2) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var here = document.activeElement;

      if (focusable.indexOf(here) === -1) {
        // ドロワーの外にいるなら、端へ引き戻す
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && here === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && here === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // デスクトップ幅に戻したときは必ず閉じた状態に戻す
    window.matchMedia("(min-width: 861px)").addEventListener("change", function (ev) {
      if (ev.matches) closeNav();
    });
  }

  /* ---- 2. スクロールでヘッダーに境界線を出す ---- */
  var header = document.querySelector(".header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- 3. スクロール連動フェードイン ---- */
  var targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();
