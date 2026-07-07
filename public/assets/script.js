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
  function lockSvg() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  }
  function discSvg() {
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>';
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

  /* ── 경제 캘린더 (calendar.html) ── */
  var calState = { view: "grid", y: null, m: null, region: "all", category: "all", importance: "all", bound: false };
  var calData = (typeof CAL_EVENTS !== "undefined") ? CAL_EVENTS.slice() : [];

  /* 구글 시트(CSV) 연동 — CAL_SHEET_URL 있으면 시트가 소스, 실패/공백이면 샘플 유지 */
  function calParseCSV(text) {
    var rows = [], row = [], cur = "", i = 0, inQ = false;
    for (; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function calMap(v, map, dflt) { v = (v || "").trim(); return map[v] || v.toLowerCase() || dflt; }
  function loadCalSheet() {
    if (typeof CAL_SHEET_URL !== "string" || !CAL_SHEET_URL) return;
    var REG = { "한국": "kr", "미국": "us", "중국": "cn", "유럽": "eu", "기타": "etc" };
    var CAT = { "경제지표": "indicator", "통화정책": "policy", "채권·입찰": "bond", "채권입찰": "bond", "실적": "earnings", "컨퍼런스·이벤트": "event", "이벤트": "event", "내 일정": "mine", "내일정": "mine" };
    var IMP = { "높음": "high", "보통": "mid", "낮음": "low" };
    fetch(CAL_SHEET_URL).then(function (r) { return r.text(); }).then(function (text) {
      var rows = calParseCSV(text);
      if (rows.length < 2) return;
      var H = rows[0].map(function (h) { return h.trim().toLowerCase(); });
      var idx = function (names) { for (var i = 0; i < H.length; i++) if (names.indexOf(H[i]) >= 0) return i; return -1; };
      var iD = idx(["날짜", "date"]), iR = idx(["지역", "region"]), iC = idx(["분류", "category"]),
        iI = idx(["영향도", "impact", "importance"]), iT = idx(["제목", "title", "title_ko"]),
        iN = idx(["설명", "note", "note_ko"]), iTe = idx(["title_en"]), iNe = idx(["note_en"]);
      if (iD < 0 || iT < 0) return;
      var out = [];
      for (var r = 1; r < rows.length; r++) {
        var row = rows[r];
        if (!row || !(row[iD] || "").trim()) continue;
        var rawCat = iC >= 0 ? (row[iC] || "").trim() : "";
        var cat = calMap(rawCat.split("(")[0], CAT, "event"); // 괄호 앞 기본 분류로 매핑
        var tk = (row[iT] || "").trim(), nk = iN >= 0 ? (row[iN] || "").trim() : "";
        out.push({
          date: (row[iD] || "").trim(),
          region: calMap(iR >= 0 ? row[iR] : "", REG, "etc"),
          category: cat,
          catRaw: rawCat,
          importance: calMap(iI >= 0 ? row[iI] : "", IMP, "mid"),
          mine: cat === "mine",
          title: { ko: tk, en: (iTe >= 0 && (row[iTe] || "").trim()) || tk },
          note: { ko: nk, en: (iNe >= 0 && (row[iNe] || "").trim()) || nk },
        });
      }
      // 중복 방어: 같은 날짜+제목은 1건만 (시트 중복행/게시 캐시 대비)
      var seen = {}, deduped = [];
      out.forEach(function (e) { var k = e.date + "|" + e.title.ko; if (!seen[k]) { seen[k] = 1; deduped.push(e); } });
      if (deduped.length) { calData = deduped; renderCalendar(); }
    }).catch(function () { /* 실패 시 샘플 유지 */ });
  }

  function calYmd(d) {
    var mm = ("0" + (d.getMonth() + 1)).slice(-2), dd = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + mm + "-" + dd;
  }
  function calFiltered() {
    return calData.filter(function (e) {
      if (calState.region !== "all" && e.region !== calState.region) return false;
      if (calState.category !== "all" && e.category !== calState.category) return false;
      if (calState.importance !== "all" && e.importance !== calState.importance) return false;
      return true;
    });
  }
  function calChip(group, val, label, active) {
    return '<button class="cal-chip" type="button" data-cal-' + group + '="' + val + '" aria-pressed="' + active + '">' + label + "</button>";
  }
  function calFilterRow(labelText, group, current, options) {
    var chips = calChip(group, "all", t(UI.calendarPage.all), current === "all");
    chips += Object.keys(options).map(function (k) {
      return calChip(group, k, t(options[k]), current === k);
    }).join("");
    return '<div class="cal-filter-row"><span class="cal-lbl">' + labelText + '</span><div class="cal-chips">' + chips + "</div></div>";
  }
  function calPill(e) {
    return '<span class="cal-ev cal-ev--' + e.importance + '" title="' + e.title[lang] + '">' + e.title[lang] + "</span>";
  }
  function renderCalGrid(events) {
    var cp = UI.calendarPage, wds = cp.weekdays[lang];
    var startDow = new Date(calState.y, calState.m, 1).getDay();
    var todayYmd = calYmd(new Date());
    var byDate = {};
    events.forEach(function (e) { (byDate[e.date] = byDate[e.date] || []).push(e); });
    var head = wds.map(function (w) { return '<div class="cal-weekday">' + w + "</div>"; }).join("");
    var cells = "";
    for (var i = 0; i < 42; i++) {
      var d = new Date(calState.y, calState.m, 1 - startDow + i);
      var ymd = calYmd(d);
      var evs = byDate[ymd] || [];
      var pills = evs.slice(0, 3).map(calPill).join("");
      var more = evs.length > 3 ? '<div class="cal-more">+' + (evs.length - 3) + " " + t(cp.moreSuffix) + "</div>" : "";
      cells += '<div class="cal-cell' + (d.getMonth() === calState.m ? "" : " cal-cell--out") + (ymd === todayYmd ? " cal-cell--today" : "") + '">' +
        '<div class="cal-cell__num">' + d.getDate() + "</div>" + pills + more + "</div>";
    }
    return '<div class="cal-grid">' + head + cells + "</div>";
  }
  function renderCalAgenda(events) {
    var cp = UI.calendarPage;
    var list = events.filter(function (e) {
      var p = e.date.split("-");
      return parseInt(p[0], 10) === calState.y && parseInt(p[1], 10) === calState.m + 1;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!list.length) return '<p class="cal-empty">' + t(cp.empty) + "</p>";
    return '<div class="cal-agenda">' + list.map(function (e) {
      var rtag = cp.regions[e.region] ? '<span class="tag">' + t(cp.regions[e.region]) + "</span>" : "";
      var catLabel = (lang === "ko" && e.catRaw) ? e.catRaw : (cp.categories[e.category] ? t(cp.categories[e.category]) : "");
      var ctag = catLabel ? '<span class="tag">' + catLabel + "</span>" : "";
      var itag = '<span class="cal-imp cal-imp--' + e.importance + '">' + t(cp.importances[e.importance]) + "</span>";
      return '<article class="cal-item">' +
        '<div class="cal-item__date">' + e.date.slice(5) + "</div>" +
        '<div class="cal-item__body">' +
          '<h3 class="cal-item__title">' + e.title[lang] + "</h3>" +
          '<p class="cal-item__note">' + e.note[lang] + "</p>" +
          '<div class="card__meta">' + rtag + ctag + itag + "</div>" +
        "</div>" +
      "</article>";
    }).join("") + "</div>";
  }
  function renderCalendar() {
    var host = document.getElementById("calendar");
    if (!host) return;
    var cp = UI.calendarPage;
    if (calState.y === null) { var now = new Date(); calState.y = now.getFullYear(); calState.m = now.getMonth(); }
    var months = cp.months[lang];
    var monthLabel = lang === "ko" ? (calState.y + "년 " + months[calState.m]) : (months[calState.m] + " " + calState.y);
    var events = calFiltered();
    var toolbar =
      '<div class="cal-toolbar">' +
        '<div class="cal-nav">' +
          '<button class="cal-btn" type="button" data-cal-nav="prev" aria-label="' + t(cp.prev) + '">‹</button>' +
          '<span class="cal-month">' + monthLabel + "</span>" +
          '<button class="cal-btn" type="button" data-cal-nav="next" aria-label="' + t(cp.next) + '">›</button>' +
          '<button class="cal-btn cal-btn--today" type="button" data-cal-nav="today">' + t(cp.today) + "</button>" +
        "</div>" +
        '<div class="cal-viewtoggle">' +
          '<button type="button" data-cal-view="grid" aria-pressed="' + (calState.view === "grid") + '">' + t(cp.viewGrid) + "</button>" +
          '<button type="button" data-cal-view="list" aria-pressed="' + (calState.view === "list") + '">' + t(cp.viewList) + "</button>" +
        "</div>" +
      "</div>";
    var filters =
      '<div class="cal-filters">' +
        calFilterRow(t(cp.lblRegion), "region", calState.region, cp.regions) +
        calFilterRow(t(cp.lblCategory), "category", calState.category, cp.categories) +
        calFilterRow(t(cp.lblImportance), "importance", calState.importance, cp.importances) +
      "</div>";
    host.innerHTML = toolbar + filters + (calState.view === "grid" ? renderCalGrid(events) : renderCalAgenda(events));
    if (!calState.bound) {
      calState.bound = true;
      host.addEventListener("click", function (e) {
        var el = e.target.closest("[data-cal-view],[data-cal-nav],[data-cal-region],[data-cal-category],[data-cal-importance]");
        if (!el || !host.contains(el)) return;
        if (el.hasAttribute("data-cal-view")) calState.view = el.getAttribute("data-cal-view");
        else if (el.hasAttribute("data-cal-nav")) {
          var n = el.getAttribute("data-cal-nav");
          if (n === "prev") { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } }
          else if (n === "next") { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } }
          else { var now = new Date(); calState.y = now.getFullYear(); calState.m = now.getMonth(); }
        }
        else if (el.hasAttribute("data-cal-region")) calState.region = el.getAttribute("data-cal-region");
        else if (el.hasAttribute("data-cal-category")) calState.category = el.getAttribute("data-cal-category");
        else if (el.hasAttribute("data-cal-importance")) calState.importance = el.getAttribute("data-cal-importance");
        renderCalendar();
      });
    }
  }

  /* ── 주간 브리핑 렌더 — tech/finance=분야 모델, economy=단일 다이제스트. 공용. ── */
  var weeklyState = {};
  function weeklyCfgs() {
    var cfgs = [];
    if (typeof TECH_DOMAINS !== "undefined")
      cfgs.push({ key: "tech", ui: UI.techPage, mode: "domains", domains: TECH_DOMAINS, weekly: TECH_WEEKLY, badge: UI.techPage.freeBadge, menuSel: "[data-tech-menu]", hostSel: "[data-tech-weekly]" });
    if (typeof FINANCE_DOMAINS !== "undefined")
      cfgs.push({ key: "finance", ui: UI.financePage, mode: "domains", domains: FINANCE_DOMAINS, weekly: FINANCE_WEEKLY, badge: UI.samples.sampleBadge, menuSel: "[data-finance-menu]", hostSel: "[data-finance-weekly]" });
    if (typeof ECONOMY_WEEKLY !== "undefined")
      cfgs.push({ key: "economy", ui: UI.economyPage, mode: "single", single: ECONOMY_WEEKLY, badge: UI.samples.sampleBadge, hostSel: "[data-economy-weekly]" });
    return cfgs;
  }
  function weeklyDomainById(cfg, id) { return (cfg.domains || []).filter(function (d) { return d.id === id; })[0] || null; }
  function weeklyFirstLive(cfg) { var d = (cfg.domains || []).filter(function (x) { return x.status === "live"; })[0]; return d ? d.id : null; }
  function weeklyIssueOf(cfg, id) { return (cfg.weekly || []).filter(function (w) { return w.domain === id; })[0] || null; }
  function weeklyMenuHtml(cfg) {
    var st = weeklyState[cfg.key], ui = cfg.ui;
    return cfg.domains.map(function (d) {
      if (d.status === "live") {
        return '<button class="tech-chip" type="button" data-weekly-domain="' + d.id + '" aria-pressed="' + (d.id === st.domain) + '">' + t(d.label) + "</button>";
      }
      return '<button class="tech-chip tech-chip--soon" type="button" disabled aria-disabled="true">' +
        t(d.label) + '<span class="tech-chip__soon">' + t(ui.soonBadge) + "</span></button>";
    }).join("");
  }
  function weeklyIssueHtml(cfg, issue, headLabel, tagline) {
    var ui = cfg.ui, s = UI.samples;
    var sigs = issue.signals.map(function (sig) {
      return '<li class="sig"><div class="sig__main">' +
        '<span class="sig__title">' + sig.title[lang] + "</span>" +
        '<span class="sig__lede">' + sig.lede[lang] + "</span></div>" +
        '<span class="tag">#' + sig.tag + "</span></li>";
    }).join("");
    var digest =
      '<h3 class="tech-sub">' + t(ui.digestHeading) + " · " + issue.signals.length + "</h3>" +
      '<ul class="sig-list">' + sigs + "</ul>" +
      '<div class="card__locked">' + lockSvg() + t(ui.signalLock) + "</div>";
    var h = issue.headliner;
    var summary = h.summary[lang].map(function (l) { return "<li>" + l + "</li>"; }).join("");
    var tags = h.tags.map(function (x) { return '<span class="tag">#' + x + "</span>"; }).join("");
    var srcNames = h.sources.map(function (x) { return x.name; }).join(" · ");
    var head =
      '<article class="card headliner">' +
        '<div class="card__top"><span class="badge-head">' + t(ui.headBadge) + "</span>" +
          '<span class="badge-sample">' + t(cfg.badge) + "</span></div>" +
        '<svg class="card__spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="' + sparkPath(h.spark) + '"/></svg>' +
        '<h3 class="card__title">' + h.title[lang] + "</h3>" +
        '<ul class="card__summary">' + summary + "</ul>" +
        '<span class="disclaimer-inline">' + discSvg() + (lang === "ko" ? "정보 제공 · 투자 조언 아님" : "Info only · not advice") + "</span>" +
        '<div class="card__meta">' + tags + "</div>" +
        '<p class="card__sources">' + t(s.sourcesLabel) + ": " + srcNames + "</p>" +
        '<div class="deep-lock">' +
          '<div class="deep-lock__head">' + lockSvg() + t(ui.deepLockTitle) + "</div>" +
          '<div class="deep-row"><span class="deep-row__k">' + t(ui.valueChainLabel) + '</span><span class="deep-row__v">' + h.valueChain[lang] + "</span></div>" +
          '<div class="deep-row"><span class="deep-row__k">' + t(ui.watchLabel) + '</span><span class="deep-row__v">' + h.watch[lang] + "</span></div>" +
          '<p class="deep-lock__desc">' + t(ui.deepLockDesc) + "</p>" +
        "</div>" +
      "</article>";
    var head2 = '<div class="tech-issue__head"><span class="chip">' + headLabel + "</span>" +
      '<span class="tech-issue__week">' + t(issue.week) + " " + t(ui.weekSuffix) + "</span></div>";
    var tl = tagline ? '<p class="tech-tagline section-sub">' + tagline + "</p>" : "";
    return '<div class="tech-issue">' + head2 + tl + digest + head + "</div>";
  }
  function renderWeekly(cfg) {
    var host = document.querySelector(cfg.hostSel);
    if (!host) return;
    if (!weeklyState[cfg.key]) weeklyState[cfg.key] = { domain: null, bound: false };
    var st = weeklyState[cfg.key];
    if (cfg.mode === "single") {
      var iss = cfg.single;
      host.innerHTML = weeklyIssueHtml(cfg, iss, t(iss.label), iss.tagline ? t(iss.tagline) : "");
      return;
    }
    if (st.domain === null) st.domain = weeklyFirstLive(cfg);
    var menu = document.querySelector(cfg.menuSel);
    if (menu) menu.innerHTML = weeklyMenuHtml(cfg);
    var dom = weeklyDomainById(cfg, st.domain), issue = weeklyIssueOf(cfg, st.domain);
    host.innerHTML = (dom && issue)
      ? weeklyIssueHtml(cfg, issue, t(dom.label), t(dom.tagline))
      : '<p class="section-sub" style="margin-top:var(--s-xl)">' + t(cfg.ui.soonBody) + "</p>";
    if (menu && !st.bound) {
      st.bound = true;
      menu.addEventListener("click", function (e) {
        var el = e.target.closest("[data-weekly-domain]");
        if (!el || !menu.contains(el)) return;
        st.domain = el.getAttribute("data-weekly-domain");
        menu.innerHTML = weeklyMenuHtml(cfg);
        var d2 = weeklyDomainById(cfg, st.domain), i2 = weeklyIssueOf(cfg, st.domain);
        host.innerHTML = (d2 && i2)
          ? weeklyIssueHtml(cfg, i2, t(d2.label), t(d2.tagline))
          : '<p class="section-sub" style="margin-top:var(--s-xl)">' + t(cfg.ui.soonBody) + "</p>";
      });
    }
  }
  function renderAllWeekly() { weeklyCfgs().forEach(function (cfg) { renderWeekly(cfg); }); }

  function renderAll() {
    applyStaticI18n();
    renderPoints();
    renderBriefings();
    renderCompare();
    renderIndicators();
    renderLibrary();
    renderAllWeekly();
    renderCalendar();
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
    if (document.getElementById("calendar")) loadCalSheet();
    initSignalLine();
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
