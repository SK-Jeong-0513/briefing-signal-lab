/* Briefing Signal Lab — script.js
 * i18n(KO/EN) 토글 · 동적 렌더링 · 스파크라인 · 절제된 모션.
 * 의존: content.js (UI, BRIEFINGS, INDICATORS, LIBRARY, LINKS)
 */
(function () {
  "use strict";

  var lang = "ko";

  /* 점(.) 경로로 UI 객체 탐색 → {ko,en} 노드 반환 */
  function node(path) {
    return path.split(".").reduce(function (o, k) { return o && o[k]; }, UI);
  }
  function t(v) { return v && v[lang] != null ? v[lang] : ""; }

  /* 정적 텍스트/HTML i18n 적용 */
  function applyStaticI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(node(el.getAttribute("data-i18n")));
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = node(el.getAttribute("data-i18n-html"));
      el.innerHTML = v && v[lang] != null ? v[lang] : "";
    });
  }

  /* 외부 링크 주입 */
  function applyLinks() {
    document.querySelectorAll("[data-link]").forEach(function (el) {
      el.setAttribute("href", LINKS[el.getAttribute("data-link")] || "#");
    });
  }

  /* 스파크라인 path (values → viewBox 0..100 x 0..40) */
  function sparkPath(values) {
    if (!values || !values.length) return "";
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var span = max - min || 1;
    var w = 100, h = 40, pad = 4;
    return values.map(function (v, i) {
      var x = (i / (values.length - 1)) * w;
      var y = h - pad - ((v - min) / span) * (h - pad * 2);
      return (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
  }

  function tickSvg() {
    return '<svg class="point__tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  }
  function markSvg(on) {
    return on
      ? '<svg class="mk mk--on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg class="mk mk--off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14"/></svg>';
  }

  /* WHAT 포인트 */
  function renderPoints() {
    var el = document.getElementById("points");
    if (!el) return;
    el.innerHTML = UI.what.points.map(function (p) {
      return '<li class="point">' + tickSvg() + "<span>" + t(p) + "</span></li>";
    }).join("");
  }

  /* 샘플 브리핑 카드 — 랜딩 티저: 카테고리별 대표 1건(최신) */
  function renderBriefings() {
    var host = document.getElementById("briefings");
    if (!host) return;
    var s = UI.samples;
    var reps = ["tech", "finance", "economy"].map(function (c) {
      return BRIEFINGS.filter(function (b) { return b.category === c; })[0];
    }).filter(Boolean);
    host.innerHTML = reps.map(function (b) {
      var summary = b.summary[lang].map(function (line) { return "<li>" + line + "</li>"; }).join("");
      var tags = b.tags.map(function (x) { return '<span class="tag">#' + x + "</span>"; }).join("");
      var srcNames = b.sources.map(function (x) { return x.name; }).join(" · ");
      var disc = b.disclaimer
        ? '<span class="disclaimer-inline">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>' +
          (lang === "ko" ? "정보 제공 · 투자 조언 아님" : "Info only · not advice") + "</span>"
        : "";
      return (
        '<article class="card reveal">' +
          '<div class="card__top"><span class="chip">' + t(b.label) + '</span>' +
            '<span class="badge-sample">' + t(s.sampleBadge) + "</span></div>" +
          '<svg class="card__spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="' + sparkPath(b.spark) + '"/></svg>' +
          '<h3 class="card__title">' + b.title[lang] + "</h3>" +
          '<ul class="card__summary">' + summary + "</ul>" +
          disc +
          '<div class="card__meta">' + tags + "</div>" +
          '<p class="card__sources">' + t(s.sourcesLabel) + ": " + srcNames + "</p>" +
          '<div class="card__locked">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
            t(s.lockedLabel) + "</div>" +
        "</article>"
      );
    }).join("");
  }

  /* 무료/유료 비교 */
  function renderCompare() {
    var host = document.getElementById("compare");
    if (!host) return;
    var c = UI.compare;
    function plan(kind) {
      var paid = kind === "paid";
      var rows = c.rows.map(function (r) {
        var on = paid ? r.paid : r.free;
        return '<div class="plan__row' + (on ? "" : " plan__row--off") + '">' + markSvg(on) + "<span>" + t(r.label) + "</span></div>";
      }).join("");
      return (
        '<div class="plan' + (paid ? " plan--paid" : "") + '">' +
          '<div class="plan__name">' + t(paid ? c.paidTitle : c.freeTitle) + "</div>" +
          '<div class="plan__price">' + t(paid ? c.paidPrice : c.freePrice) + "</div>" +
          '<div class="plan__list">' + rows + "</div>" +
          '<a class="btn ' + (paid ? "btn--primary" : "btn--ghost") + '" href="' +
            (LINKS[paid ? "paidForm" : "freeForm"] || "#") + '" target="_blank" rel="noopener">' +
            t(paid ? c.paidCta : c.freeCta) + "</a>" +
        "</div>"
      );
    }
    host.innerHTML = plan("free") + plan("paid");
  }

  /* 지표 카드 */
  function renderIndicators() {
    var host = document.getElementById("indicators");
    if (!host) return;
    var d = UI.dashboard;
    host.innerHTML = INDICATORS.map(function (i) {
      var lock = i.locked ? '<span class="ind__lock">' + t(d.locked) + "</span>" : "";
      return (
        '<div class="ind' + (i.locked ? " ind--locked" : "") + '">' + lock +
          '<div class="ind__label">' + t(i.label) + "</div>" +
          '<div class="ind__value">' + i.value + "</div>" +
          '<div class="ind__change ind__change--' + i.dir + '">' + i.change + "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* 서재 */
  function renderLibrary() {
    var host = document.getElementById("library-list");
    if (!host) return;
    var m = UI.library.readMore;
    host.innerHTML = LIBRARY.map(function (n) {
      var tags = n.tags.map(function (x) { return '<span class="tag">#' + x + "</span>"; }).join("");
      return (
        '<article class="lib reveal">' +
          '<h3 class="lib__title">' + n.title[lang] + "</h3>" +
          '<p class="lib__sum">' + n.summary[lang] + "</p>" +
          '<div class="card__meta">' + tags + "</div>" +
          '<span class="lib__more">' + t(m) + " →</span>" +
        "</article>"
      );
    }).join("");
  }

  /* 기술 브리핑 피드 (tech.html) — 무료 공개, 날짜순, 잠금 배지 없음 */
  function renderTechFeed() {
    var host = document.getElementById("tech-feed");
    if (!host) return;
    var s = UI.samples;
    var items = BRIEFINGS.filter(function (b) { return b.category === "tech"; });
    host.innerHTML = items.map(function (b) {
      var summary = b.summary[lang].map(function (line) { return "<li>" + line + "</li>"; }).join("");
      var tags = b.tags.map(function (x) { return '<span class="tag">#' + x + "</span>"; }).join("");
      var srcNames = b.sources.map(function (x) { return x.name; }).join(" · ");
      var disc = b.disclaimer
        ? '<span class="disclaimer-inline">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>' +
          (lang === "ko" ? "정보 제공 · 투자 조언 아님" : "Info only · not advice") + "</span>"
        : "";
      return (
        '<article class="card reveal">' +
          '<div class="card__top"><span class="chip">' + t(b.label) + '</span>' +
            '<span class="badge-sample">' + b.date + " · " + t(s.sampleBadge) + "</span></div>" +
          '<svg class="card__spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="' + sparkPath(b.spark) + '"/></svg>' +
          '<h3 class="card__title">' + b.title[lang] + "</h3>" +
          '<ul class="card__summary">' + summary + "</ul>" +
          disc +
          '<div class="card__meta">' + tags + "</div>" +
          '<p class="card__sources">' + t(s.sourcesLabel) + ": " + srcNames + "</p>" +
        "</article>"
      );
    }).join("");
  }

  /* 유료 키워드 예시 칩 (tech.html) */
  function renderTopicChips() {
    var host = document.getElementById("topic-chips");
    if (!host || typeof TOPICS === "undefined") return;
    host.innerHTML = TOPICS.map(function (k) {
      return '<span class="topic-chip">' + t(k) + "</span>";
    }).join("");
  }

  function renderAll() {
    applyStaticI18n();
    renderPoints();
    renderBriefings();
    renderCompare();
    renderIndicators();
    renderLibrary();
    renderTechFeed();
    renderTopicChips();
    observeReveals();
  }

  /* 언어 전환 */
  function setLang(next) {
    lang = next;
    document.documentElement.setAttribute("lang", next);
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === next));
    });
    renderAll();
    try { localStorage.setItem("bsl-lang", next); } catch (e) {}
  }

  /* 스크롤 리빌 */
  var io = null;
  function observeReveals() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var els = document.querySelectorAll(".reveal:not(.is-in)");
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    }
    els.forEach(function (el) { io.observe(el); });
  }

  /* 히어로 라인 draw-in: 실제 길이로 dasharray 설정 */
  function initSignalLine() {
    document.querySelectorAll(".hero__signal .signal-line").forEach(function (p) {
      try {
        var len = Math.ceil(p.getTotalLength());
        p.style.setProperty("--len", len);
      } catch (e) {}
    });
  }

  /* init */
  function init() {
    document.documentElement.classList.add("js");
    try { var saved = localStorage.getItem("bsl-lang"); if (saved === "en" || saved === "ko") lang = saved; } catch (e) {}
    applyLinks();
    setLang(lang);
    initSignalLine();
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
