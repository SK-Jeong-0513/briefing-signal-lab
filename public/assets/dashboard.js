/* Briefing Signal Lab — 대시보드(관계·상관 오버레이).
 * assets/data/dashboard.json 로드 → 페어 태그 칩 → 클릭 시 uPlot 이중 Y축 오버레이.
 * 데이터는 자동 파이프라인(scripts/fetch_dashboard.py)이 갱신. 의존: uPlot(vendor).
 */
(function () {
  "use strict";
  if (typeof uPlot === "undefined") return;
  var host = document.querySelector("[data-dash]");
  if (!host) return;

  var LEFT = "#2454D6", RIGHT = "#8A5300", MUTED = "#5F6B7A", BORDER = "#D8DEE8";
  var RANGES = [{ k: "6M", d: 182 }, { k: "1Y", d: 365 }, { k: "3Y", d: 100000 }];
  var state = { data: null, pairId: null, rangeDays: 365, chart: null };

  function fmtNum(v) {
    if (v == null) return "";
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  /* 두 시계열을 공통 '일(UTC day)'로 정렬 → [xs, yL, yR].
   * 거래소별 종가 타임스탬프가 초 단위로 달라 정확 매칭이 안 되므로 일 단위 버킷팅. */
  function aligned(pair) {
    var s = state.data.series, L = s[pair.left], R = s[pair.right];
    var mapR = {}; for (var i = 0; i < R.t.length; i++) mapR[Math.floor(R.t[i] / 86400)] = R.v[i];
    var cutoffDay = state.rangeDays >= 100000 ? 0 : Math.floor((Date.now() / 1000 - state.rangeDays * 86400) / 86400);
    var xs = [], yl = [], yr = [];
    for (var j = 0; j < L.t.length; j++) {
      var day = Math.floor(L.t[j] / 86400);
      if (day < cutoffDay) continue;
      if (mapR[day] == null) continue;
      xs.push(day * 86400); yl.push(L.v[j]); yr.push(mapR[day]);
    }
    return { data: [xs, yl, yr], L: L, R: R };
  }

  function renderChart() {
    var pair = state.data.pairs.filter(function (p) { return p.id === state.pairId; })[0];
    if (!pair) return;
    var box = document.getElementById("dash-chart");
    var al = aligned(pair);
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    box.innerHTML = "";
    if (al.data[0].length < 2) { box.innerHTML = '<p class="section-sub">데이터를 불러오는 중이거나 부족합니다.</p>'; return; }
    var w = box.clientWidth || 800;
    var opts = {
      width: w, height: 360,
      cursor: { y: false },
      legend: { live: true },
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
    var wrap = document.querySelector("[data-dash-pairs]");
    wrap.innerHTML = state.data.pairs.map(function (p) {
      return '<button class="tech-chip" type="button" data-pair="' + p.id + '" aria-pressed="' + (p.id === state.pairId) + '">' + p.label + "</button>";
    }).join("");
    var rng = document.querySelector("[data-dash-range]");
    rng.innerHTML = RANGES.map(function (r) {
      return '<button type="button" data-range="' + r.d + '" aria-pressed="' + (r.d === state.rangeDays) + '">' + r.k + "</button>";
    }).join("");
  }

  function setPair(id) { state.pairId = id; renderChips(); renderChart(); }
  function setRange(d) { state.rangeDays = d; renderChips(); renderChart(); }

  fetch("assets/data/dashboard.json?cb=" + Date.now()).then(function (r) { return r.json(); }).then(function (json) {
    state.data = json;
    if (!json.pairs || !json.pairs.length) { host.innerHTML = '<p class="section-sub">대시보드 데이터를 준비 중입니다.</p>'; return; }
    state.pairId = json.pairs[0].id;
    var meta = document.querySelector("[data-dash-updated]");
    if (meta) meta.textContent = "업데이트: " + json.updated + " · 출처: Yahoo Finance · 미 재무부 · 정보 제공(투자 조언 아님)";
    renderChips();
    renderChart();
    host.addEventListener("click", function (e) {
      var pc = e.target.closest("[data-pair]");
      if (pc) { setPair(pc.getAttribute("data-pair")); return; }
      var rc = e.target.closest("[data-range]");
      if (rc) { setRange(parseInt(rc.getAttribute("data-range"), 10)); }
    });
    var to;
    window.addEventListener("resize", function () { clearTimeout(to); to = setTimeout(renderChart, 150); });
  }).catch(function () {
    host.innerHTML = '<p class="section-sub">대시보드 데이터를 불러오지 못했습니다.</p>';
  });
})();
