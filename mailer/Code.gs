/**
 * Briefing Signal Lab — 주간 통합 브리핑 메일러 (Google Apps Script)
 * 3개 카테고리(기술/금융/경제)를 한 통에. 카테고리별 선호도 시트로 분야 필터.
 *   - RESP_SHEET(설문지 응답): 신원·동의 원천. 읽기 전용.
 *   - PREF: 관심분야(기술)/관심분야(금융)/관심분야(경제) — 구독 상태. 읽기/쓰기, 헤더 자동생성.
 *
 * [설치] 응답 시트에서 확장 프로그램→Apps Script→이 파일 붙여넣기(bound 아니면 CFG.SHEET_ID).
 *   CFG의 SALT 교체·탭 이름 확인 → 웹앱 배포→WEBAPP_URL → sendWeekly 실행(TEST_MODE=true=나에게만).
 * [발송] sendWeekly(). [매주] 각 CATS[].issues만 갱신(사이트 content/*.js 무료 부분과 동일).
 * [개인정보] 이메일은 링크에 넣지 않음(해시 토큰만). 수신거부 필수.
 */

// ===== CONFIG — 여기만 수정 =====
const CFG = {
  TEST_MODE: true,
  BASE: "https://sk-jeong-0513.github.io/briefing-signal-lab/",
  WEBAPP_URL: "https://script.google.com/macros/s/AKfycbxZlLlqMIjzOR9545l1f-pe29X4XFV6NCqKzVs0aL7kETCR3fKXt7uH6FWWSN7rxi0/exec",
  SENDER_NAME: "Briefing Signal Lab",
  SUBJECT: "[주간 브리핑] 기술 · 금융 · 경제 신호",
  WEEK: "2026년 7월 1주",
  OPERATOR_EMAIL: "paun.jeong@gmail.com",
  SALT: "bsl-CHANGE-ME-token-salt",     // 이미 고정했다면 그 값 유지.
  SHEET_ID: "",
  RESP_SHEET: "설문지 응답 시트1",
  RESP_COL: { email: "이메일 주소", consent: "메일 수신 동의", keywords: "관심 키워드" },
  PREF_COL: { email: "이메일", domains: "관심 분야", status: "상태", updated: "갱신" },
  CONSENT_TRUE_INCLUDES: "동의",
};

// ===== 카테고리 정의 + 이번 주 무료 콘텐츠(KO). 매주 issues만 교체. =====
const CATS = [
  {
    key: "tech", label: "기술", prefSheet: "관심분야(기술)", page: "tech.html",
    domains: [{ id: "ai-infra", label: "AI 인프라" }, { id: "semicon", label: "반도체 공급망" }],
    issues: {
      "ai-infra": {
        signals: [
          { t: "하이퍼스케일러 capex 상향, '부품 가격'을 명시", l: "메타가 2026 capex 가이던스를 상향하며 부품 가격·데이터센터 비용을 이유로 들었다.", tag: "capex" },
          { t: "CPO(광집적), 상용화 검증 국면 진입", l: "엔비디아 실리콘 포토닉스 스위치와 브로드컴 Bailly가 2026–27 첫 대규모 검증에 들어간다.", tag: "CPO" },
          { t: "병목은 칩이 아니라 전력·냉각으로", l: "capex는 급증하지만 전력·냉각이 실제 제약으로 지목된다.", tag: "전력" },
          { t: "하이퍼스케일러 자체 칩(ASIC) 가속", l: "아마존 자체 칩 사업이 연매출 런레이트 규모로 올라선다.", tag: "자체칩" },
        ],
        head: { title: "CPO, AI 네트워크 병목을 광(光)으로 푼다", sum: ["GPU 간 대역폭·전력 병목에 광집적(CPO) 스위치 채택 논의가 본격화.", "엔비디아·브로드컴이 서로 다른 전략으로 2026–27 첫 대규모 검증에 진입.", "관전 포인트: 스케일업 선채택 뒤 스케일아웃 확산 시점과 수율."] },
      },
      "semicon": {
        signals: [
          { t: "HBM4, 본딩 방식이 세대 경쟁축으로", l: "삼성은 하이브리드 본딩, SK하이닉스는 MR-MUF 16단에 TSMC 로직 다이를 결합한다.", tag: "HBM4" },
          { t: "SK하이닉스, 첫 미국 후공정 투자", l: "미국 내 2.5D 패키징 라인 투자로 후공정 지역 밸류체인이 재편된다.", tag: "후공정" },
          { t: "유리기판, 소규모 상업 출하 진입", l: "SK Absolics 양산 목표·인텔 EMIB+글래스 코어 샘플·TSMC CoWoS-G 미니라인이 겹친다.", tag: "유리기판" },
          { t: "선단 패키징·CoWoS 캐파, 구조적 병목", l: "선단 패키징과 HBM 수요가 캐파를 앞서 2027까지 리드타임·가격 압력이 이어질 전망.", tag: "캐파" },
        ],
        head: { title: "HBM4, 병목은 셀이 아니라 '본딩'에 있다", sum: ["차세대 HBM 경쟁의 축이 셀에서 후공정 본딩으로 이동한다.", "삼성은 하이브리드 본딩, SK하이닉스는 MR-MUF+TSMC 로직 다이로 갈렸다.", "관전 포인트: 하이브리드 본딩 전환 시점과 열 관리가 세대 속도를 가른다."] },
      },
    },
  },
  {
    key: "finance", label: "금융", prefSheet: "관심분야(금융)", page: "finance.html",
    domains: [{ id: "kr-equity", label: "국내 증시" }, { id: "us-equity", label: "미국 증시" }],
    issues: {
      "kr-equity": {
        signals: [
          { t: "외국인·기관 수급 방향", l: "반도체 대형주 중심 수급이 지수 방향을 좌우.", tag: "수급" },
          { t: "실적 시즌 진입", l: "가이던스와 재고 사이클이 업종별 온도차를 만든다.", tag: "실적" },
          { t: "주도주 순환 조짐", l: "반도체 외 이차전지·바이오로 순환 매수 시도.", tag: "순환" },
          { t: "밸류업 정책 모멘텀", l: "주주환원 확대 기대가 저PBR 업종에 재부각.", tag: "밸류업" },
        ],
        head: { title: "국내 증시: 수급과 실적이 주도주를 가른다", sum: ["반도체 대형주 수급이 지수 방향을 잡는 가운데 실적 시즌이 겹친다.", "가이던스·재고 사이클이 업종별 차별화를 키운다.", "관전 포인트: 주도주가 반도체에 집중되는지, 순환이 넓어지는지."] },
      },
      "us-equity": {
        signals: [
          { t: "빅테크 실적 기대", l: "AI capex 사이클이 실적 눈높이를 끌어올린다.", tag: "빅테크" },
          { t: "성장주 밸류에이션 부담", l: "금리 민감도가 높은 고밸류 성장주에 변동성.", tag: "밸류에이션" },
          { t: "금리 민감도 재부각", l: "장기금리 변동이 성장주·리츠 심리를 흔든다.", tag: "금리민감" },
          { t: "AI capex 수혜 확산", l: "칩 밖으로 전력·네트워크·데이터센터로 수혜가 번진다.", tag: "AIcapex" },
        ],
        head: { title: "미국 증시: AI capex가 실적 기대를 끌어올린다", sum: ["하이퍼스케일러 capex 상향이 관련 실적 기대를 끌어올린다.", "고밸류 성장주는 금리 민감도가 변동성의 원천으로 남는다.", "관전 포인트: capex 수혜가 칩 밖 전력·네트워크로 넓어지는 속도."] },
      },
    },
  },
  {
    key: "economy", label: "경제", prefSheet: "관심분야(경제)", page: "economy.html",
    domains: [{ id: "macro", label: "경제 매크로" }],
    issues: {
      "macro": {
        signals: [
          { t: "통화정책 회의에 시선 집중", l: "주요국 통화정책 결정이 금리 경로 기대를 다시 잡는다.", tag: "금리" },
          { t: "물가 지표 발표 대기", l: "물가 둔화 속도가 정책 전환 시점 논쟁의 핵심.", tag: "물가" },
          { t: "고용·성장 신호 점검", l: "고용 강도가 연착륙 여부를 가르는 변수로 남는다.", tag: "고용" },
          { t: "환율·무역수지 동향", l: "달러 방향과 무역 흐름이 신흥국·수출주 심리에 영향.", tag: "환율" },
        ],
        head: { title: "이번 주 매크로: 금리 경로가 자산 방향을 가른다", sum: ["통화정책 결정과 물가 지표가 겹치며 금리 기대가 재조정되는 주.", "금리 경로는 채권·환율은 물론 성장주 밸류에이션까지 연결된다.", "관전 포인트: 지표가 '둔화 지속'을 확인하는지, 되돌리는지."] },
      },
    },
  },
];

const C = { primary: "#2454D6", soft: "#E8EEFF", text: "#17202A", muted: "#5F6B7A", border: "#D8DEE8", canvas: "#F7F8FA", surface: "#FFFFFF" };

// ===== 시트 헬퍼 =====
function ss_() {
  var ss = CFG.SHEET_ID ? SpreadsheetApp.openById(CFG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("스프레드시트를 못 찾음. 독립 프로젝트면 CFG.SHEET_ID를 채우세요.");
  return ss;
}
function sheetByName_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error("시트 탭 '" + name + "'을(를) 찾을 수 없습니다. CFG 확인.");
  return sh;
}
function tableOf_(name) {
  var sh = sheetByName_(name), values = sh.getDataRange().getValues();
  var header = (values[0] || []).map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) rows.push({ rowIndex: r + 1, cells: values[r] });
  return { sh: sh, header: header, rows: rows };
}
function idx_(header, name) { return header.indexOf(name); }
function consented_(v) { return String(v || "").indexOf(CFG.CONSENT_TRUE_INCLUDES) >= 0; }
function token_(email) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email).toLowerCase().trim() + CFG.SALT);
  return raw.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("").slice(0, 16);
}

// ===== 선호도 시트(카테고리별) — 헤더 자동생성 · map · upsert =====
function prefTable_(name) {
  var t = tableOf_(name);
  if (t.header.length === 0 || idx_(t.header, CFG.PREF_COL.email) < 0) {
    var want = [CFG.PREF_COL.email, CFG.PREF_COL.domains, CFG.PREF_COL.status, CFG.PREF_COL.updated];
    t.sh.getRange(1, 1, 1, want.length).setValues([want]);
    t = tableOf_(name);
  }
  return t;
}
function prefMap_(name) {
  var t = prefTable_(name);
  var iE = idx_(t.header, CFG.PREF_COL.email), iD = idx_(t.header, CFG.PREF_COL.domains), iS = idx_(t.header, CFG.PREF_COL.status);
  var map = {};
  t.rows.forEach(function (r) {
    var em = String(r.cells[iE] || "").trim().toLowerCase();
    if (!em) return;
    map[em] = { domains: String(r.cells[iD] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean), status: String(r.cells[iS] || "구독").trim() };
  });
  return map;
}
function prefUpsert_(name, email, domainLabels, status) {
  var t = prefTable_(name);
  var iE = idx_(t.header, CFG.PREF_COL.email), iD = idx_(t.header, CFG.PREF_COL.domains), iS = idx_(t.header, CFG.PREF_COL.status), iU = idx_(t.header, CFG.PREF_COL.updated);
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var low = String(email).trim().toLowerCase(), rowIndex = 0;
  for (var i = 0; i < t.rows.length; i++) { if (String(t.rows[i].cells[iE] || "").trim().toLowerCase() === low) { rowIndex = t.rows[i].rowIndex; break; } }
  if (!rowIndex) rowIndex = t.sh.getLastRow() + 1;
  t.sh.getRange(rowIndex, iE + 1).setValue(email);
  t.sh.getRange(rowIndex, iD + 1).setValue(domainLabels.join(", "));
  t.sh.getRange(rowIndex, iS + 1).setValue(status || "구독");
  t.sh.getRange(rowIndex, iU + 1).setValue(today);
}
function catByKey_(key) { return CATS.filter(function (c) { return c.key === key; })[0]; }
function domById_(cat, id) { return cat.domains.filter(function (d) { return d.id === id; })[0]; }

// ===== 발송 =====
function sendWeekly() {
  var rt = tableOf_(CFG.RESP_SHEET);
  var iE = idx_(rt.header, CFG.RESP_COL.email), iC = idx_(rt.header, CFG.RESP_COL.consent), iK = idx_(rt.header, CFG.RESP_COL.keywords);
  if (iE < 0 || iC < 0) throw new Error("응답 시트 컬럼 확인: '" + CFG.RESP_COL.email + "' / '" + CFG.RESP_COL.consent + "'");
  var maps = {}; CATS.forEach(function (c) { maps[c.key] = prefMap_(c.prefSheet); });

  var sent = 0, skipped = 0, failed = 0, seen = {};
  for (var i = 0; i < rt.rows.length; i++) {
    var cells = rt.rows[i].cells;
    var email = String(cells[iE] || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0) { skipped++; continue; }
    if (seen[email]) continue; seen[email] = 1;
    if (!consented_(cells[iC])) { skipped++; continue; }

    var perCat = [];   // { cat, domIds }
    CATS.forEach(function (c) {
      var p = maps[c.key][email], domIds;
      if (p) {
        if (p.status === "수신거부") { return; }
        domIds = c.domains.filter(function (d) { return p.domains.indexOf(d.label) >= 0; }).map(function (d) { return d.id; });
      } else {
        domIds = c.domains.map(function (d) { return d.id; });
        prefUpsert_(c.prefSheet, email, c.domains.map(function (d) { return d.label; }), "구독"); // seed
      }
      if (domIds.length) perCat.push({ cat: c, domIds: domIds });
    });
    if (!perCat.length) { skipped++; continue; }

    var kw = iK >= 0 ? String(cells[iK] || "").trim() : "";
    var recipient = CFG.TEST_MODE ? CFG.OPERATOR_EMAIL : email;
    try {
      GmailApp.sendEmail(recipient, CFG.SUBJECT, plain_(perCat, kw), { name: CFG.SENDER_NAME, htmlBody: html_(email, kw, perCat) });
      sent++;
      if (CFG.TEST_MODE) break;
    } catch (e) { failed++; Logger.log("[ERROR] " + email + " → " + e); }
  }
  Logger.log((CFG.TEST_MODE ? "[TEST] " : "") + "발송 " + sent + " · 건너뜀 " + skipped + " · 실패 " + failed);
}

// ===== 이메일 HTML (테이블·인라인·SVG 없음) =====
function html_(email, keywords, perCat) {
  var tok = token_(email);
  var body = perCat.map(function (pc) { return catSection_(pc.cat, pc.domIds); }).join("");
  var kwLine = keywords ? '<p style="margin:0 0 16px;font-size:13px;color:' + C.muted + '">관심 키워드: <b style="color:' + C.text + '">' + esc_(keywords) + "</b></p>" : "";
  var toggles = CATS.map(function (c) {
    var on = {}; perCat.forEach(function (pc) { if (pc.cat.key === c.key) pc.domIds.forEach(function (id) { on[id] = 1; }); });
    var links = c.domains.map(function (d) { return link_(tok, "toggle", c.key, d.id, (on[d.id] ? "✓ " : "+ ") + d.label); }).join(" ");
    return '<span style="white-space:nowrap">' + c.label + ": " + links + "</span>";
  }).join(" &nbsp;·&nbsp; ");
  var prefRow = CFG.WEBAPP_URL ? '<p style="margin:12px 0 0;font-size:12px;color:' + C.muted + '">받는 항목 변경: ' + toggles + "</p>" : "";
  var unsub = CFG.WEBAPP_URL ? link_(tok, "unsubscribe", "", "", "수신거부") : '<a href="mailto:' + CFG.OPERATOR_EMAIL + '?subject=' + encodeURIComponent("브리핑 수신거부") + '" style="color:' + C.muted + '">수신거부</a>';

  return [
    '<div style="margin:0;padding:0;background:' + C.canvas + '">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.canvas + '"><tr><td align="center" style="padding:24px 12px">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:' + C.surface + ';border:1px solid ' + C.border + ';border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:' + C.text + '">',
    '<tr><td style="padding:20px 24px;border-bottom:1px solid ' + C.border + '">',
      '<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:' + C.primary + '">BRIEFING SIGNAL LAB · ' + esc_(CFG.WEEK) + "</div>",
      '<div style="font-size:20px;font-weight:700;margin-top:4px">이번 주 브리핑</div>',
    "</td></tr>",
    '<tr><td style="padding:20px 24px">', kwLine, body,
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="border-radius:8px;background:' + C.primary + '">',
        '<a href="' + CFG.BASE + '" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#fff;text-decoration:none">사이트에서 전체 보기 →</a>',
      "</td></tr></table>", prefRow,
    "</td></tr>",
    '<tr><td style="padding:16px 24px;border-top:1px solid ' + C.border + ';font-size:12px;color:' + C.muted + ';line-height:1.6">',
      "정보 제공·투자 조언 아님. 종목·자산은 공개 출처 기반 관찰로만 명시하며 매수·매도·목표가를 권유하지 않습니다.<br>",
      '<a href="' + CFG.BASE + '" style="color:' + C.muted + '">Briefing Signal Lab</a> &nbsp;·&nbsp; ' + unsub,
    "</td></tr>",
    "</table></td></tr></table></div>",
  ].join("");
}
function catSection_(cat, domIds) {
  var blocks = domIds.map(function (id) { return domainBlock_(cat, id); }).join("");
  return '<div style="margin:0 0 8px"><div style="font-size:13px;font-weight:700;color:' + C.text + ';border-left:3px solid ' + C.primary + ';padding-left:8px;margin:4px 0 12px">' + esc_(cat.label) + " 브리핑</div>" + blocks + "</div>";
}
function domainBlock_(cat, id) {
  var iss = cat.issues[id], dm = domById_(cat, id);
  if (!iss) return "";
  var sigs = iss.signals.map(function (s) {
    return '<tr><td style="padding:8px 0;border-top:1px solid ' + C.border + '"><div style="font-size:14px;font-weight:600;color:' + C.text + '">' + esc_(s.t) + "</div>" +
      '<div style="font-size:13px;color:' + C.muted + ';margin-top:2px">' + esc_(s.l) + ' <span style="color:' + C.primary + '">#' + esc_(s.tag) + "</span></div></td></tr>";
  }).join("");
  var sum = iss.head.sum.map(function (l) { return '<li style="margin:0 0 4px;font-size:13px;color:' + C.text + '">' + esc_(l) + "</li>"; }).join("");
  return [
    '<div style="margin:0 0 18px">',
    '<div style="display:inline-block;font-size:12px;font-weight:700;color:' + C.primary + ';background:' + C.soft + ';padding:3px 10px;border-radius:999px">' + esc_(dm.label) + "</div>",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">' + sigs + "</table>",
    '<div style="margin-top:12px;padding:12px 14px;background:' + C.canvas + ';border:1px solid ' + C.border + ';border-radius:8px">',
      '<div style="font-size:11px;font-weight:700;color:' + C.muted + '">헤드라이너</div>',
      '<div style="font-size:15px;font-weight:700;margin:4px 0 6px">' + esc_(iss.head.title) + "</div>",
      '<ul style="margin:0;padding-left:18px">' + sum + "</ul>",
    "</div></div>",
  ].join("");
}
function link_(tok, action, cat, domain, label) {
  var url = CFG.WEBAPP_URL + "?t=" + tok + "&a=" + action + (cat ? "&c=" + cat : "") + (domain ? "&d=" + domain : "");
  return '<a href="' + url + '" style="color:' + C.primary + ';text-decoration:none">' + esc_(label) + "</a>";
}
function plain_(perCat, kw) {
  var lines = ["이번 주 브리핑 (" + CFG.WEEK + ")", ""];
  perCat.forEach(function (pc) {
    lines.push("[" + pc.cat.label + "]");
    pc.domIds.forEach(function (id) {
      var iss = pc.cat.issues[id], dm = domById_(pc.cat, id);
      lines.push("· " + dm.label);
      iss.signals.forEach(function (s) { lines.push("  - " + s.t); });
      lines.push("  헤드라이너: " + iss.head.title);
    });
    lines.push("");
  });
  lines.push("전체 보기: " + CFG.BASE, "정보 제공·투자 조언 아님.");
  return lines.join("\n");
}
function esc_(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ===== 링크 처리(웹앱) — 카테고리별 선호도 시트에 반영 =====
function doGet(e) {
  var t = e && e.parameter ? e.parameter.t : "", a = e && e.parameter ? e.parameter.a : "",
      cKey = e && e.parameter ? e.parameter.c : "", d = e && e.parameter ? e.parameter.d : "";
  if (!t || !a) return page_("잘못된 요청입니다.");
  var rt = tableOf_(CFG.RESP_SHEET), iE = idx_(rt.header, CFG.RESP_COL.email);
  var email = null;
  for (var i = 0; i < rt.rows.length; i++) { var em = String(rt.rows[i].cells[iE] || "").trim(); if (em && token_(em) === t) { email = em; break; } }
  if (!email) return page_("구독자를 찾을 수 없습니다.");

  if (a === "unsubscribe") {
    CATS.forEach(function (c) { var p = prefMap_(c.prefSheet)[email.toLowerCase()]; prefUpsert_(c.prefSheet, email, p ? p.domains : c.domains.map(function (d) { return d.label; }), "수신거부"); });
    return page_("모든 브리핑 수신이 해지되었습니다. 그동안 감사했습니다.");
  }
  if (a === "toggle" && cKey && d) {
    var cat = catByKey_(cKey); if (!cat) return page_("알 수 없는 카테고리입니다.");
    var dm = domById_(cat, d); if (!dm) return page_("알 수 없는 분야입니다.");
    var cur = prefMap_(cat.prefSheet)[email.toLowerCase()] || { domains: cat.domains.map(function (x) { return x.label; }), status: "구독" };
    var arr = cur.domains.slice(), pos = arr.indexOf(dm.label);
    if (pos >= 0) arr.splice(pos, 1); else arr.push(dm.label);
    prefUpsert_(cat.prefSheet, email, arr, "구독");
    return page_("[" + cat.label + "] " + dm.label + (pos >= 0 ? " 수신을 껐습니다." : " 수신을 켰습니다.") + " 현재: " + (arr.join(", ") || "없음"));
  }
  return page_("처리할 수 없는 요청입니다.");
}
function page_(msg) {
  var html = '<div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;color:#17202A">' +
    '<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#2454D6">BRIEFING SIGNAL LAB</div>' +
    '<p style="font-size:16px;margin:12px 0 20px">' + esc_(msg) + "</p>" +
    '<a href="' + CFG.BASE + '" style="color:#2454D6">사이트로 →</a></div>';
  return HtmlService.createHtmlOutput(html);
}
