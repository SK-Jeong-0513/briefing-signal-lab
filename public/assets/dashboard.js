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

  function vcCard(name, unit, v, manual, period) {
    var chg = (manual && v.length >= 2) ? (v[v.length - 1] / v[v.length - 2] - 1) * 100 : pctChg(v);
    var last = v[v.length - 1], dir = chg >= 0 ? "up" : "down", per = period || "~1M";
    var suffix = (unit && unit !== "$" && unit !== "pt" && unit !== "원") ? " " + unit : "";
    return '<div class="vc-card">' +
      '<div class="vc-card__label">' + name + (manual ? '<span class="vc-tag">수동</span>' : "") + "</div>" +
      '<svg class="card__spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="' + spark(v) + '"/></svg>' +
      '<div class="vc-card__val">' + fmtNum(last) + suffix + "</div>" +
      '<div class="vc-card__chg vc-' + dir + '">' + (chg >= 0 ? "+" : "") + chg.toFixed(1) + '% <span>' + per + '</span></div></div>';
  }
  function renderValueChain() {
    var hostv = document.querySelector("[data-dash-vc]");
    if (!hostv) return;
    var cards = [];
    (state.data.valuechain || []).forEach(function (k) { var s = state.data.series[k]; if (s && s.v.length) cards.push(vcCard(s.name, s.unit, s.v, false)); });
    if (state.manual && state.manual.items) state.manual.items.forEach(function (it) { if (it.v && it.v.length) cards.push(vcCard(it.label, it.unit, it.v, true, it.period)); });
    hostv.innerHTML = cards.join("") || '<p class="section-sub">밸류체인 지표를 준비 중입니다.</p>';
  }

  function setPair(id) { state.pairId = id; renderChips(); renderChart(); }
  function setRange(d) { state.rangeDays = d; renderChips(); renderChart(); }

  function boot(json) {
    state.data = json;
    if (!json.pairs || !json.pairs.length) { host.innerHTML = '<p class="section-sub">대시보드 데이터를 준비 중입니다.</p>'; return; }
    state.pairId = json.pairs[0].id;
    var meta = document.querySelector("[data-dash-updated]");
    if (meta) meta.textContent = "업데이트: " + json.updated + " · 출처: Yahoo Finance · 미 재무부 · 정보 제공(투자 조언 아님)";
    renderChips();
    renderChart();
    renderValueChain();
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
