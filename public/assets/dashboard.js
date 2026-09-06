/* Briefing Signal Lab — 대시보드(관계 오버레이 + 산업 밸류체인 지표).
 * assets/data/dashboard.json(자동 실데이터) + valuechain_manual.json(수동 핵심) 로드.
 * 페어 태그 클릭 → uPlot 이중 Y축. 페어5는 우축 종목 드롭다운(기본 삼성전자). 의존: uPlot(vendor).
 */
(function () {
  "use strict";
  if (typeof uPlot === "undefined") return;
  var host = document.querySelector("[data-dash]");
  if (!host) return;

  var LEFT = "#2454D6", RIGHT = "#8A5300", MUTED = "#5F6B7A", BORDER = "#D8DEE8";
  var RANGES = [{ k: "6M", d: 182 }, { k: "1Y", d: 365 }, { k: "3Y", d: 100000 }];
  var state = { data: null, manual: null, pairId: null, rangeDays: 365, rightOverride: {}, chart: null };

  function fmtNum(v) {
    if (v == null) return "";
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  function spark(values) {
    var v = values.slice(-90);
    if (!v.length) return "";
    var max = Math.max.apply(null, v), min = Math.min.apply(null, v), span = max - min || 1, w = 100, h = 40, pad = 4;
    return v.map(function (x, i) {
      var X = (i / (v.length - 1)) * w, Y = h - pad - ((x - min) / span) * (h - pad * 2);
      return (i ? "L" : "M") + X.toFixed(1) + " " + Y.toFixed(1);
    }).join(" ");
  }
  function pctChg(v) { if (v.length < 2) return 0; var back = v[Math.max(0, v.length - 22)]; return (v[v.length - 1] / back - 1) * 100; }

  function pairById(id) { return state.data.pairs.filter(function (p) { return p.id === id; })[0]; }
  function effRight(pair) { return state.rightOverride[pair.id] || pair.right; }

  /* 두 시계열을 공통 UTC 일 단위로 정렬 → [xs, yL, yR] */
  function aligned(pair) {
    var s = state.data.series, L = s[pair.left], R = s[effRight(pair)];
    var mapR = {}; for (var i = 0; i < R.t.length; i++) mapR[Math.floor(R.t[i] / 86400)] = R.v[i];
    var cutoffDay = state.rangeDays >= 100000 ? 0 : Math.floor((Date.now() / 1000 - state.rangeDays * 86400) / 86400);
    var xs = [], yl = [], yr = [];
    for (var j = 0; j < L.t.length; j++) {
      var day = Math.floor(L.t[j] / 86400);
      if (day < cutoffDay || mapR[day] == null) continue;
      xs.push(day * 86400); yl.push(L.v[j]); yr.push(mapR[day]);
    }
    return { data: [xs, yl, yr], L: L, R: R };
  }

  function renderRightSelect(pair) {
    var box = document.querySelector("[data-dash-right]");
    if (!box) return;
    if (!pair.rightOptions || !pair.rightOptions.length) { box.innerHTML = ""; return; }
    var cur = effRight(pair);
    box.innerHTML = '<label class="dash-select">우축 종목 <select data-right-select>' +
      pair.rightOptions.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
      "</select></label>";
  }

  function renderChart() {
    var pair = pairById(state.pairId);
    if (!pair) return;
    renderRightSelect(pair);
    var box = document.getElementById("dash-chart");
    var al = aligned(pair);
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    box.innerHTML = "";
    if (al.data[0].length < 2) { box.innerHTML = '<p class="section-sub">데이터를 불러오는 중이거나 부족합니다.</p>'; return; }
    var opts = {
      width: box.clientWidth || 800, height: 360,
      cursor: { y: false }, legend: { live: true },
      scales: { x: { time: true }, L: {}, R: {} },
      series: [
        {},
        { label: al.L.name + (al.L.unit ? " (" + al.L.unit + ")" : ""), stroke: LEFT, width: 2, scale: "L", value: function (u, v) { return fmtNum(v); } },
        { label: al.R.name + (al.R.unit ? " (" + al.R.unit + ")" : ""), stroke: RIGHT, width: 2, scale: "R", value: function (u, v) { return fmtNum(v); } },
      ],
      axes: [
        { stroke: MUTED, grid: { stroke: BORDER, width: 1 }, ticks: { stroke: BORDER } },
        { scale: "L", stroke: LEFT, grid: { stroke: BORDER, width: 1 }, ticks: { stroke: BORDER }, values: function (u, s) { return s.map(fmtNum); } },
        { scale: "R", side: 1, stroke: RIGHT, grid: { show: false }, values: function (u, s) { return s.map(fmtNum); } },
      ],
    };
    state.chart = new uPlot(opts, al.data, box);
  }

  function renderChips() {
    document.querySelector("[data-dash-pairs]").innerHTML = state.data.pairs.map(function (p) {
      return '<button class="tech-chip" type="button" data-pair="' + p.id + '" aria-pressed="' + (p.id === state.pairId) + '">' + p.label + "</button>";
    }).join("");
    document.querySelector("[data-dash-range]").innerHTML = RANGES.map(function (r) {
      return '<button type="button" data-range="' + r.d + '" aria-pressed="' + (r.d === state.rangeDays) + '">' + r.k + "</button>";
    }).join("");
  }

  /* 지표 유형별 변화 표시. 통일하면 어느 한쪽이 반드시 오독된다 —
     CPI 전월비는 독자가 보는 숫자가 아니고, 심리지수는 변화율보다 기준선 대비가 정보다.
     mode 는 fetch_dashboard.py 의 KR_MACRO 가 실어 보낸다. */
  function chgByMode(v, mode) {
    var n = v.length, last = v[n - 1];
    if (mode === "yoy" && n >= 13 && v[n - 13]) {
      var y = (last / v[n - 13] - 1) * 100;
      return { val: y, text: (y >= 0 ? "+" : "") + y.toFixed(1) + "% YoY" };
    }
    if (mode === "mom" && n >= 2 && v[n - 2]) {
      var m = (last / v[n - 2] - 1) * 100;
      return { val: m, text: (m >= 0 ? "+" : "") + m.toFixed(1) + "% 전월비" };
    }
    if (mode === "diff" && n >= 2) {
      var d = last - v[n - 2];
      return { val: d, text: (d >= 0 ? "+" : "") + fmtNum(d) + " 전월차" };
    }
    if (mode === "baseline100") {
      var b = last - 100;
      return { val: b, text: (b >= 0 ? "+" : "") + b.toFixed(1) + " 기준선" };
    }
    return null;                       // 모드를 못 알아들으면 기존 계산으로 떨어진다
  }

  /* ⚠️ pctChg 는 v[len-22] 를 본다 — 거래일 22일 ≈ 1개월을 노린 값이라 **일간 시리즈 전용**이다.
     월간 시리즈에 쓰면 22개월 전 대비가 계산되는데 라벨은 "~1M" 이라 아무도 눈치채지 못한다.
     그래서 월간 카드는 반드시 mode 를 넘겨야 한다.
     manual 은 '수동 입력 배지'만 담당한다 — 예전엔 계산 방식까지 겸했다. */
  function vcCard(name, unit, v, manual, period, mode) {
    var byMode = mode ? chgByMode(v, mode) : null;
    var chg = byMode ? byMode.val
      : ((manual && v.length >= 2) ? (v[v.length - 1] / v[v.length - 2] - 1) * 100 : pctChg(v));
    var text = byMode ? byMode.text : ((chg >= 0 ? "+" : "") + chg.toFixed(1) + "%");
    var last = v[v.length - 1], dir = chg >= 0 ? "up" : "down", per = period || "~1M";
    var suffix = (unit && unit !== "$" && unit !== "pt" && unit !== "원") ? " " + unit : "";
    return '<div class="vc-card">' +
      '<div class="vc-card__label">' + name + (manual ? '<span class="vc-tag">수동</span>' : "") + "</div>" +
      '<svg class="card__spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="' + spark(v) + '"/></svg>' +
      '<div class="vc-card__val">' + fmtNum(last) + suffix + "</div>" +
      '<div class="vc-card__chg vc-' + dir + '">' + text + ' <span>' + per + '</span></div></div>';
  }
  function renderValueChain() {
    var hostv = document.querySelector("[data-dash-vc]");
    if (!hostv) return;
    var cards = [];
    (state.data.valuechain || []).forEach(function (k) { var s = state.data.series[k]; if (s && s.v.length) cards.push(vcCard(s.name, s.unit, s.v, false)); });
    if (state.manual && state.manual.items) state.manual.items.forEach(function (it) { if (it.v && it.v.length) cards.push(vcCard(it.label, it.unit, it.v, true, it.period)); });
    hostv.innerHTML = cards.join("") || '<p class="section-sub">밸류체인 지표를 준비 중입니다.</p>';
  }

  /* 미 섹터 — 카드로 나란히. "어느 섹터가 앞서나"는 2계열 오버레이로는 볼 수 없다
     (드롭다운을 11번 갈아끼워야 한다). vcCard 를 그대로 재사용한다. */
  function renderSectors() {
    var host2 = document.querySelector("[data-dash-sectors]");
    if (!host2) return;
    var cards = (state.data.sectors || []).map(function (k) {
      var s = state.data.series[k];
      return (s && s.v.length) ? vcCard(s.name, s.unit, s.v, false) : "";
    }).join("");
    host2.innerHTML = cards || '<p class="section-sub">섹터 지표를 준비 중입니다.</p>';
  }

  /* 한국 매크로 — 월간이라 페어 차트가 아니라 카드다. 발표 지연이 7~37일이라 차트로 그리면
     오른쪽이 늘 비어 보이는데, 카드는 기준 시점(2026.08)을 라벨로 찍어 그 문제가 없다.
     변화 표시는 지표마다 다르다 — series 의 mode 를 그대로 넘긴다. */
  function renderKrMacro() {
    var host3 = document.querySelector("[data-dash-krmacro]");
    if (!host3) return;
    var cards = (state.data.krmacro || []).map(function (k) {
      var s = state.data.series[k];
      return (s && s.v && s.v.length) ? vcCard(s.name, s.unit, s.v, false, s.period, s.mode) : "";
    }).join("");
    host3.innerHTML = cards || '<p class="section-sub">한국 매크로 지표를 준비 중입니다.</p>';
  }

  function setPair(id) { state.pairId = id; renderChips(); renderChart(); }
  function setRange(d) { state.rangeDays = d; renderChips(); renderChart(); }

  function boot(json) {
    state.data = json;
    if (!json.pairs || !json.pairs.length) { host.innerHTML = '<p class="section-sub">대시보드 데이터를 준비 중입니다.</p>'; return; }
    state.pairId = json.pairs[0].id;
    var meta = document.querySelector("[data-dash-updated]");
    // 수집이 일부 실패해도 직전 데이터가 보존되어 그림은 멀쩡해 보인다. 그 상태를 사람이
    // 알 방법이 화면 말고 없으므로, 결손이 있을 때만 한 조각 끼운다(평소엔 아무것도 안 보임).
    var cov = json.coverage, gap = "";
    if (cov && (cov.pairs < cov.pairsExpected || cov.sectors < cov.sectorsExpected ||
                (cov.krmacroExpected && cov.krmacro < cov.krmacroExpected))) {
      gap = " · 지표 " + cov.pairs + "/" + cov.pairsExpected + "(일부 출처 지연)";
    }
    if (meta) meta.textContent = "업데이트: " + json.updated + gap +
      " · 출처: Yahoo Finance · 미 재무부 · FRED · 한국은행 · 정보 제공(투자 조언 아님)";
    renderChips();
    renderChart();
    renderValueChain();
    renderSectors();
    renderKrMacro();
    host.addEventListener("click", function (e) {
      var pc = e.target.closest("[data-pair]");
      if (pc) { setPair(pc.getAttribute("data-pair")); return; }
      var rc = e.target.closest("[data-range]");
      if (rc) { setRange(parseInt(rc.getAttribute("data-range"), 10)); }
    });
    host.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-right-select]");
      if (sel) { state.rightOverride[state.pairId] = sel.value; renderChart(); }
    });
    var to;
    window.addEventListener("resize", function () { clearTimeout(to); to = setTimeout(renderChart, 150); });
  }

  fetch("assets/data/valuechain_manual.json?cb=" + Date.now()).then(function (r) { return r.json(); }).then(function (m) { state.manual = m; }).catch(function () {}).then(function () {
    return fetch("assets/data/dashboard.json?cb=" + Date.now()).then(function (r) { return r.json(); });
  }).then(boot).catch(function () {
    host.innerHTML = '<p class="section-sub">대시보드 데이터를 불러오지 못했습니다.</p>';
  });
})();
