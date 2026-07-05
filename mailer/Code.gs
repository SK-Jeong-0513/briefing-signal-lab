/**
 * Briefing Signal Lab — 주간 기술 브리핑 메일러 (Google Apps Script)
 * ------------------------------------------------------------------
 * 발송: sendWeekly() 수동 실행(에디터 상단 ▶ 또는 트리거).
 * 선호도/수신거부: 이메일 링크 → doGet(웹앱)이 응답 시트에 반영.
 *
 * [설치]
 * 1) 폼 응답 구글 시트 열기 → 확장 프로그램 → Apps Script → 이 파일 전체 붙여넣기.
 * 2) 아래 CFG 확인(컬럼명·SITE_URL·SALT). SALT는 아무 문자열로 바꿀 것.
 * 3) 배포 → 새 배포 → 유형: 웹 앱 → 실행 계정: 나, 액세스: 모든 사용자.
 *    → 배포 URL을 CFG.WEBAPP_URL에 붙여넣고 저장.  (비우면 수신거부는 mailto로 대체)
 * 4) sendWeekly() 실행 → 최초 권한 승인. CFG.TEST_MODE=true면 나에게만 발송(미리보기).
 * 5) 미리보기 OK면 CFG.TEST_MODE=false 로 바꾸고 다시 실행 → 수신동의자 전원 발송.
 *
 * [매주 갱신] ISSUE 객체만 그 주 내용으로 교체(무료 부분 = 사이트 tech.js와 동일).
 * [주의] 개인정보(이메일)는 시트 밖으로 유출 금지. 이메일 링크에는 이메일 대신 해시 토큰만 사용.
 */

// ===== CONFIG — 여기만 수정 =====
const CFG = {
  TEST_MODE: true,                    // true=나에게만 발송(미리보기). 검증 후 false.
  SITE_URL:  "https://sk-jeong-0513.github.io/briefing-signal-lab/",
  TECH_URL:  "https://sk-jeong-0513.github.io/briefing-signal-lab/tech.html",
  WEBAPP_URL: "",                     // 웹앱 배포 후 exec URL 붙여넣기. 비우면 수신거부=mailto.
  SENDER_NAME: "Briefing Signal Lab",
  SUBJECT:   "[기술 브리핑] 이번 주 신호 — AI 인프라 · 반도체 공급망",
  OPERATOR_EMAIL: "paun.jeong@gmail.com", // TEST_MODE 수신지 + 수신거부 mailto
  SALT: "bsl-CHANGE-ME-token-salt",   // 토큰 생성용. 아무 문자열로 교체.
  SHEET_ID: "",                       // 시트에 연결(bound)된 스크립트면 비워둠. 독립(standalone) 프로젝트면 시트 URL의 /d/<여기>/edit ID를 넣을 것.
  SHEET_NAME: "",                     // 응답 시트 이름. 비우면 첫 시트.
  COL: {                              // 시트 헤더와 정확히 일치
    email:    "이메일",
    keywords: "관심 키워드",
    consent:  "메일 수신 동의",
    domains:  "관심 분야",            // 없으면 스크립트가 자동 생성해 사용
  },
  CONSENT_TRUE_INCLUDES: "동의",      // consent 셀에 이 문자열 포함 시 수신 동의로 간주
};

// 가동 분야(사이트와 동일). soon 분야는 여기서 제외.
const LIVE_DOMAINS = [
  { id: "ai-infra", label: "AI 인프라" },
  { id: "semicon",  label: "반도체 공급망" },
];

// ===== 이번 주 무료 콘텐츠 — 매주 이 객체만 갱신(tech.js 무료 부분과 동일) =====
const ISSUE = {
  week: "2026년 7월 1주",
  domains: {
    "ai-infra": {
      label: "AI 인프라",
      signals: [
        { t: "하이퍼스케일러 capex 상향, '부품 가격'을 명시", l: "메타가 2026 capex 가이던스를 상향하며 부품 가격·데이터센터 비용을 이유로 들었다.", tag: "capex" },
        { t: "CPO(광집적), 상용화 검증 국면 진입", l: "엔비디아 실리콘 포토닉스 스위치와 브로드컴 Bailly가 2026–27 첫 대규모 검증에 들어간다.", tag: "CPO" },
        { t: "병목은 칩이 아니라 전력·냉각으로", l: "capex는 급증하지만 전력·냉각이 실제 제약으로 지목된다.", tag: "전력" },
        { t: "하이퍼스케일러 자체 칩(ASIC) 가속", l: "아마존 자체 칩 사업이 연매출 런레이트 규모로 올라선다.", tag: "자체칩" },
      ],
      headliner: {
        title: "CPO, AI 네트워크 병목을 광(光)으로 푼다",
        summary: [
          "AI 클러스터의 GPU 간 대역폭·전력 병목에 광집적(CPO) 스위치 채택 논의가 본격화.",
          "엔비디아(실리콘 포토닉스)와 브로드컴(개방형 Bailly)이 서로 다른 전략으로 2026–27 첫 대규모 검증에 진입.",
          "관전 포인트: 스케일업에서 먼저 채택된 뒤 스케일아웃으로 확산되는 시점과 수율.",
        ],
      },
    },
    "semicon": {
      label: "반도체 공급망",
      signals: [
        { t: "HBM4, 본딩 방식이 세대 경쟁축으로", l: "삼성은 하이브리드 본딩, SK하이닉스는 MR-MUF 16단에 TSMC 로직 다이를 결합한다.", tag: "HBM4" },
        { t: "SK하이닉스, 첫 미국 후공정 투자", l: "미국 내 2.5D 패키징 라인 투자로 후공정 지역 밸류체인이 재편된다.", tag: "후공정" },
        { t: "유리기판, 소규모 상업 출하 진입", l: "SK Absolics 양산 목표·인텔 EMIB+글래스 코어 샘플·TSMC CoWoS-G 미니라인이 겹친다.", tag: "유리기판" },
        { t: "선단 패키징·CoWoS 캐파, 구조적 병목", l: "선단 패키징과 HBM 수요가 캐파를 앞서 2027까지 리드타임·가격 압력이 이어질 전망.", tag: "캐파" },
      ],
      headliner: {
        title: "HBM4, 병목은 셀이 아니라 '본딩'에 있다",
        summary: [
          "차세대 HBM 경쟁의 축이 셀에서 후공정 본딩으로 이동한다.",
          "삼성은 하이브리드 본딩, SK하이닉스는 MR-MUF+TSMC 로직 다이로 서로 다른 경로를 택했다.",
          "관전 포인트: 하이브리드 본딩 전환 시점과 열 관리(스택 단수)가 세대 속도를 가른다.",
        ],
      },
    },
  },
};

// ===== 색 토큰(DESIGN.md) =====
const C = { primary: "#2454D6", soft: "#E8EEFF", text: "#17202A", muted: "#5F6B7A", border: "#D8DEE8", canvas: "#F7F8FA", surface: "#FFFFFF" };

// ===== 시트 헬퍼 =====
function sheet_() {
  var ss = CFG.SHEET_ID ? SpreadsheetApp.openById(CFG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("스프레드시트를 못 찾음. 시트에 연결된 스크립트가 아니면(독립 프로젝트) CFG.SHEET_ID에 시트 ID를 넣으세요. (시트 URL의 /d/<ID>/edit)");
  return CFG.SHEET_NAME ? ss.getSheetByName(CFG.SHEET_NAME) : ss.getSheets()[0];
}
function readRows_() {
  var sh = sheet_();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { sh: sh, header: [], rows: [] };
  var header = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) rows.push({ rowIndex: r + 1, cells: values[r] });
  return { sh: sh, header: header, rows: rows };
}
function colIndex_(header, name) { return header.indexOf(name); }
function ensureDomainsCol_(sh, header) {
  var idx = header.indexOf(CFG.COL.domains);
  if (idx >= 0) return idx;
  sh.getRange(1, header.length + 1).setValue(CFG.COL.domains);
  return header.length; // 0-based index of new col
}
function token_(email) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email).toLowerCase().trim() + CFG.SALT);
  return raw.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("").slice(0, 16);
}
function consented_(v) { return String(v || "").indexOf(CFG.CONSENT_TRUE_INCLUDES) >= 0; }

// ===== 발송 =====
function sendWeekly() {
  var data = readRows_();
  if (!data.rows.length) { Logger.log("구독자 없음"); return; }
  var iEmail = colIndex_(data.header, CFG.COL.email);
  var iKw    = colIndex_(data.header, CFG.COL.keywords);
  var iCon   = colIndex_(data.header, CFG.COL.consent);
  var iDom   = colIndex_(data.header, CFG.COL.domains); // -1 가능(미발송 필터엔 불필요)
  if (iEmail < 0 || iCon < 0) { throw new Error("필수 컬럼 없음: '" + CFG.COL.email + "' / '" + CFG.COL.consent + "' 확인"); }

  var sent = 0, skipped = 0, failed = 0;
  for (var i = 0; i < data.rows.length; i++) {
    var cells = data.rows[i].cells;
    var email = String(cells[iEmail] || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0) { skipped++; continue; }
    if (!consented_(cells[iCon])) { skipped++; continue; }

    // 관심 분야 필터: 값 있으면 그 분야만, 없으면 가동 분야 전체
    var domIds = LIVE_DOMAINS.map(function (d) { return d.id; });
    if (iDom >= 0) {
      var domCell = String(cells[iDom] || "").trim();
      if (domCell) {
        var picked = LIVE_DOMAINS.filter(function (d) { return domCell.indexOf(d.label) >= 0; }).map(function (d) { return d.id; });
        if (picked.length) domIds = picked;
      }
    }

    var recipient = CFG.TEST_MODE ? CFG.OPERATOR_EMAIL : email;
    var kw = iKw >= 0 ? String(cells[iKw] || "").trim() : "";
    try {
      GmailApp.sendEmail(recipient, CFG.SUBJECT, plainFallback_(domIds, kw), {
        name: CFG.SENDER_NAME,
        htmlBody: buildHtml_(email, kw, domIds),
      });
      sent++;
      if (CFG.TEST_MODE) break; // 테스트는 1통만
    } catch (e) { failed++; Logger.log("[ERROR] " + email + " → " + e); }
  }
  Logger.log((CFG.TEST_MODE ? "[TEST] " : "") + "발송 " + sent + " · 건너뜀 " + skipped + " · 실패 " + failed);
}

// ===== 이메일 HTML (테이블 기반·인라인·SVG 없음 — CLAUDE.md §11) =====
function buildHtml_(email, keywords, domIds) {
  var tok = token_(email);
  var blocks = domIds.map(function (id) { return domainBlock_(id); }).join("");
  var kwLine = keywords
    ? '<p style="margin:0 0 16px;font-size:13px;color:' + C.muted + '">관심 키워드: <b style="color:' + C.text + '">' + esc_(keywords) + "</b></p>"
    : "";
  var togglesRow = LIVE_DOMAINS.map(function (d) {
    var on = domIds.indexOf(d.id) >= 0;
    return actionLink_(tok, "toggle", d.id, (on ? "✓ " : "+ ") + d.label);
  }).join(" &nbsp; ");
  var prefRow = CFG.WEBAPP_URL
    ? '<p style="margin:12px 0 0;font-size:12px;color:' + C.muted + '">받는 분야 변경: ' + togglesRow + "</p>"
    : "";
  var unsub = CFG.WEBAPP_URL
    ? actionLink_(tok, "unsubscribe", "", "수신거부")
    : '<a href="mailto:' + CFG.OPERATOR_EMAIL + '?subject=' + encodeURIComponent("기술 브리핑 수신거부") + '" style="color:' + C.muted + '">수신거부</a>';

  return [
    '<div style="margin:0;padding:0;background:' + C.canvas + '">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.canvas + '"><tr><td align="center" style="padding:24px 12px">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:' + C.surface + ';border:1px solid ' + C.border + ';border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:' + C.text + '">',
    // 헤더
    '<tr><td style="padding:20px 24px;border-bottom:1px solid ' + C.border + '">',
      '<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:' + C.primary + '">TECH BRIEFING · ' + esc_(ISSUE.week) + "</div>",
      '<div style="font-size:20px;font-weight:700;margin-top:4px">이번 주 기술 신호</div>',
    "</td></tr>",
    '<tr><td style="padding:20px 24px">',
      kwLine,
      blocks,
      // CTA
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="border-radius:8px;background:' + C.primary + '">',
        '<a href="' + CFG.TECH_URL + '" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#fff;text-decoration:none">사이트에서 전체 보기 →</a>',
      "</td></tr></table>",
      prefRow,
    "</td></tr>",
    // 푸터
    '<tr><td style="padding:16px 24px;border-top:1px solid ' + C.border + ';font-size:12px;color:' + C.muted + ';line-height:1.6">',
      "정보 제공·투자 조언 아님. 밸류체인 기업은 공개 출처 기반 관찰로만 명시하며 매수·매도·목표가를 권유하지 않습니다.<br>",
      '<a href="' + CFG.SITE_URL + '" style="color:' + C.muted + '">Briefing Signal Lab</a> &nbsp;·&nbsp; ' + unsub,
    "</td></tr>",
    "</table></td></tr></table></div>",
  ].join("");
}
function domainBlock_(id) {
  var d = ISSUE.domains[id];
  if (!d) return "";
  var sigs = d.signals.map(function (s) {
    return '<tr><td style="padding:8px 0;border-top:1px solid ' + C.border + '">' +
      '<div style="font-size:14px;font-weight:600;color:' + C.text + '">' + esc_(s.t) + "</div>" +
      '<div style="font-size:13px;color:' + C.muted + ';margin-top:2px">' + esc_(s.l) + ' <span style="color:' + C.primary + '">#' + esc_(s.tag) + "</span></div>" +
      "</td></tr>";
  }).join("");
  var sum = d.headliner.summary.map(function (l) {
    return '<li style="margin:0 0 4px;font-size:13px;color:' + C.text + '">' + esc_(l) + "</li>";
  }).join("");
  return [
    '<div style="margin:0 0 20px">',
    '<div style="display:inline-block;font-size:12px;font-weight:700;color:' + C.primary + ';background:' + C.soft + ';padding:3px 10px;border-radius:999px">' + esc_(d.label) + "</div>",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">' + sigs + "</table>",
    '<div style="margin-top:12px;padding:12px 14px;background:' + C.canvas + ';border:1px solid ' + C.border + ';border-radius:8px">',
      '<div style="font-size:11px;font-weight:700;color:' + C.muted + '">헤드라이너</div>',
      '<div style="font-size:15px;font-weight:700;margin:4px 0 6px">' + esc_(d.headliner.title) + "</div>",
      '<ul style="margin:0;padding-left:18px">' + sum + "</ul>",
    "</div>",
    "</div>",
  ].join("");
}
function actionLink_(tok, action, domain, label) {
  var url = CFG.WEBAPP_URL + "?t=" + tok + "&a=" + action + (domain ? "&d=" + domain : "");
  return '<a href="' + url + '" style="color:' + C.primary + ';text-decoration:none">' + esc_(label) + "</a>";
}
function plainFallback_(domIds, kw) {
  var lines = ["이번 주 기술 브리핑 (" + ISSUE.week + ")", ""];
  domIds.forEach(function (id) {
    var d = ISSUE.domains[id]; if (!d) return;
    lines.push("[" + d.label + "]");
    d.signals.forEach(function (s) { lines.push("- " + s.t); });
    lines.push("헤드라이너: " + d.headliner.title, "");
  });
  lines.push("전체 보기: " + CFG.TECH_URL, "정보 제공·투자 조언 아님.");
  return lines.join("\n");
}
function esc_(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ===== 선호도/수신거부 링크 처리 (웹앱) =====
function doGet(e) {
  var t = e && e.parameter ? e.parameter.t : "";
  var a = e && e.parameter ? e.parameter.a : "";
  var d = e && e.parameter ? e.parameter.d : "";
  if (!t || !a) return page_("잘못된 요청입니다.");

  var data = readRows_();
  var iEmail = colIndex_(data.header, CFG.COL.email);
  var iCon   = colIndex_(data.header, CFG.COL.consent);
  var iDom   = ensureDomainsCol_(data.sh, data.header);
  if (iEmail < 0) return page_("구성 오류(이메일 컬럼).");

  var target = null;
  for (var i = 0; i < data.rows.length; i++) {
    var em = String(data.rows[i].cells[iEmail] || "").trim();
    if (em && token_(em) === t) { target = data.rows[i]; break; }
  }
  if (!target) return page_("구독자를 찾을 수 없습니다. 이미 처리되었을 수 있습니다.");

  if (a === "unsubscribe") {
    data.sh.getRange(target.rowIndex, iCon + 1).setValue("수신거부");
    return page_("수신이 해지되었습니다. 그동안 감사했습니다.");
  }
  if (a === "toggle" && d) {
    var dm = LIVE_DOMAINS.filter(function (x) { return x.id === d; })[0];
    if (!dm) return page_("알 수 없는 분야입니다.");
    var cur = String(target.cells[iDom] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var pos = cur.indexOf(dm.label);
    if (pos >= 0) cur.splice(pos, 1); else cur.push(dm.label);
    data.sh.getRange(target.rowIndex, iDom + 1).setValue(cur.join(", "));
    return page_(dm.label + (pos >= 0 ? " 수신을 껐습니다." : " 수신을 켰습니다.") + " 현재: " + (cur.join(", ") || "없음"));
  }
  return page_("처리할 수 없는 요청입니다.");
}
function page_(msg) {
  var html = '<div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;color:#17202A">' +
    '<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#2454D6">BRIEFING SIGNAL LAB</div>' +
    '<p style="font-size:16px;margin:12px 0 20px">' + esc_(msg) + "</p>" +
    '<a href="' + CFG.SITE_URL + '" style="color:#2454D6">사이트로 →</a></div>';
  return HtmlService.createHtmlOutput(html);
}
