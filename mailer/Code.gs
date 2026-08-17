/**
 * Briefing Signal Lab — 주간 통합 브리핑 메일러 (Google Apps Script)
 * 3개 카테고리(기술/금융/경제)를 한 통에. 카테고리별 선호도 시트로 분야 필터.
 *   - RESP_SHEET(설문지 응답): 신원·동의 원천. 읽기 전용.
 *   - PREF: 관심분야(기술)/관심분야(금융)/관심분야(경제) — 구독 상태. 읽기/쓰기, 헤더 자동생성.
 *
 * [설치] 응답 시트에서 확장 프로그램→Apps Script→이 파일 붙여넣기(bound 아니면 CFG.SHEET_ID).
 *   CFG의 SALT·MARKET_SHEET_ID 확인 → 웹앱 재배포 → TEST_MODE 미리보기 → createWeeklyTriggers() 1회.
 * [발송] 월요일 09:00 sendWeekly(). 콘텐츠는 BSL_market 주간-발행/주간-발행항목 rev.1에서 읽는다.
 * [개인정보] 이메일은 링크에 넣지 않음(해시 토큰만). 수신거부 필수.
 *
 * [일일 시황 메일 — Stage 4] sendDailyMarket(): 텔레그램 파이프가 '시장' 스프레드시트의
 *   시장-일일 탭에 적재한 그날 경제/금융/기술 시황을 동의한 전체 구독자에게 아침 1회 발송.
 *   시장 데이터는 별도 스프레드시트라 CFG.MARKET_SHEET_ID로 openById 읽기.
 *   설치: CFG.MARKET_SHEET_ID 채우기 → createDailyTrigger() 1회 실행.
 *   발송 시각은 관리자 콘솔 설정(settings.daily_send_time, KST). 미설정 시 CFG.DAILY_SEND_TIME.
 *   콘솔에서 시각을 바꾸면 새벽 03:00 syncDailySchedule()이 트리거를 다음 날부터 자동 반영한다.
 */

// ===== CONFIG — 여기만 수정 =====
const CFG = {
  TEST_MODE: true,
  BASE: "https://brevislab.com/",
  WEBAPP_URL: "https://script.google.com/macros/s/AKfycbxZlLlqMIjzOR9545l1f-pe29X4XFV6NCqKzVs0aL7kETCR3fKXt7uH6FWWSN7rxi0/exec",
  SENDER_NAME: "Briefing Signal Lab",
  SUBJECT: "[주간 브리핑] 기술 · 금융 · 경제 신호",
  WEEK: "2026년 7월 1주",
  OPERATOR_EMAIL: "paun.jeong@gmail.com",
  SALT: "bsl-CHANGE-ME-token-salt",     // 이미 고정했다면 그 값 유지.
  SHEET_ID: "",
  // 구독 전용 폼('Briefing Signal Lab 구독') 응답 탭. 옛 'Biz Signal Lab' 폼(시트1)에서 이전.
  // ⚠️ 열 이름은 폼 질문 제목 그대로 만들어진다 — 질문을 고쳐도 기존 열 제목은 안 바뀐다.
  //    바꿀 일이 생기면 시트의 실제 헤더를 보고 여기를 맞출 것.
  RESP_SHEET: "설문지 응답 시트2",
  RESP_COL: { email: "이메일 주소(E-Mail Address)", consent: "메일 수신 동의", keywords: "관심 키워드" },
  PREF_COL: { email: "이메일", domains: "관심 분야", status: "상태", updated: "갱신" },
  CONSENT_TRUE_INCLUDES: "동의",
  // 일일 시황 메일(Stage 4) — '시장' 스프레드시트는 구독자 시트와 다름
  MARKET_SHEET_ID: "",              // '시장' 스프레드시트 ID(시트 URL의 /d/<여기>/edit)
  MARKET_TAB: "시장-일일",
  MARKET_BODY_TAB: "시장-본문",       // 텔레그램 상세 요약(날짜·시간대·본문)
  SETTINGS_TAB: "settings",          // 관리자 콘솔이 쓰는 key·value 탭(BSL_market)
  DAILY_SEND_TIME: "07:40",          // settings의 daily_send_time 미설정·오류 시 폴백(KST)
  WEEKLY_LEDGER_TAB: "주간-발행",
  WEEKLY_ITEM_TAB: "주간-발행항목",
  WEEKLY_DELIVERY_TAB: "주간-발송로그",
  DAILY_CATS: ["경제", "금융", "기술"],   // 메일에 담을 순서
  DAILY_SUBJECT: "[일일 시황]",       // 뒤에 날짜가 붙음
};

// ===== 카테고리 정의 + 이번 주 무료 콘텐츠(KO). 매주 issues만 교체. =====
const CATS = [
  {
    key: "tech", label: "기술", prefSheet: "관심분야(기술)", page: "tech.html",
    domains: [{ id: "ai-infra", label: "AI 인프라" }, { id: "semicon", label: "반도체 공급망" }, { id: "power", label: "전력·에너지" }, { id: "space", label: "우주·방산" }, { id: "bio", label: "바이오" }],
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
    domains: [{ id: "kr-equity", label: "국내 증시" }, { id: "us-equity", label: "미국 증시" }, { id: "bond", label: "채권·금리 시장" }, { id: "commodity", label: "원자재·대체" }, { id: "flows", label: "펀드·자금흐름" }],
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

const C = { primary: "#2454D6", soft: "#E8EEFF", text: "#17202A", muted: "#5F6B7A", border: "#D8DEE8", canvas: "#F7F8FA", surface: "#FFFFFF", success: "#12733E", danger: "#C9342F" };

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
  var iE = idx_(t.header, CFG.PREF_COL.email), iD = idx_(t.header, CFG.PREF_COL.domains), iS = idx_(t.header, CFG.PREF_COL.status), iU = idx_(t.header, CFG.PREF_COL.updated);
  var map = {};
  t.rows.forEach(function (r) {
    var em = String(r.cells[iE] || "").trim().toLowerCase();
    if (!em) return;
    map[em] = { email: String(r.cells[iE] || "").trim(), domains: String(r.cells[iD] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean), status: String(r.cells[iS] || "구독").trim(), updated: iU >= 0 ? r.cells[iU] : "" };
  });
  return map;
}
function prefUpsert_(name, email, domainLabels, status) {
  var t = prefTable_(name);
  var iE = idx_(t.header, CFG.PREF_COL.email), iD = idx_(t.header, CFG.PREF_COL.domains), iS = idx_(t.header, CFG.PREF_COL.status), iU = idx_(t.header, CFG.PREF_COL.updated);
  // 재구독 판정이 '같은 날 해지→재신청'을 구분해야 해서 시각까지 남긴다.
  // 옛 날짜-only 행도 계속 읽힌다(unsubTime_ 가 그날 끝으로 해석).
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
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

// ===== 원장 기반 주간 발송 =====
function weeklyMarketSs_() {
  if (!CFG.MARKET_SHEET_ID) throw new Error("CFG.MARKET_SHEET_ID를 채우세요.");
  return SpreadsheetApp.openById(CFG.MARKET_SHEET_ID);
}
function weeklyTable_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error("주간 탭 없음: " + name);
  var values = sh.getDataRange().getValues(), header = (values[0] || []).map(function (h) { return String(h).trim(); }), rows = [];
  for (var r = 1; r < values.length; r++) { var o = { _row: r + 1 }; for (var c = 0; c < header.length; c++) o[header[c]] = values[r][c]; rows.push(o); }
  return { sh: sh, header: header, rows: rows };
}
function weeklyAppend_(table, item) { table.sh.appendRow(table.header.map(function (h) { return item[h] != null ? item[h] : ""; })); }
function weeklyNow_() { return Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function weeklyIsoIssue_(addDays) {
  var p = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy,M,d").split(",").map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + (addDays || 0)));
  var day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  var year = d.getUTCFullYear(), start = new Date(Date.UTC(year, 0, 1));
  var week = Math.ceil((((d - start) / 86400000) + 1) / 7);
  return year + "-W" + (week < 10 ? "0" : "") + week;
}
function weeklyLatestBundle_(issueKey) {
  var ss = weeklyMarketSs_(), ledger = weeklyTable_(ss, CFG.WEEKLY_LEDGER_TAB), chosen = null;
  for (var i = ledger.rows.length - 1; i >= 0; i--) {
    var row = ledger.rows[i], state = String(row.state || ""), rev = Number(row.revision || 0);
    if (String(row.issue_key) === String(issueKey) && rev === 1 && ["manual_ready","auto_ready","published","email_partial","emailed"].indexOf(state) >= 0) { chosen = row; break; }
  }
  if (!chosen || String(chosen.state) === "emailed") return null;
  var items = weeklyTable_(ss, CFG.WEEKLY_ITEM_TAB);
  var itemSeen = {};
  var selected = items.rows.filter(function (r) {
    if (String(r.issue_key) !== String(chosen.issue_key) || Number(r.revision || 0) !== 1 || ["ready","published"].indexOf(String(r['상태'] || "")) < 0) return false;
    var key = String(r['출처URL'] || "") + "|" + String(r['제목ko'] || "");
    if (itemSeen[key]) return false; itemSeen[key] = 1; return true;
  });
  if (!selected.length) return null;
  return { ss: ss, ledger: ledger, itemTable: items, ledgerRow: chosen, issueKey: String(chosen.issue_key), revision: 1, items: selected };
}
function weeklyPublish_(bundle) {
  if (String(bundle.ledgerRow.state) === "published" || String(bundle.ledgerRow.state) === "email_partial") return;
  var now = weeklyNow_(), h = bundle.itemTable.header, iState = h.indexOf("상태") + 1, iPub = h.indexOf("published_at") + 1, iUpd = h.indexOf("updated_at") + 1;
  bundle.items.forEach(function (r) {
    bundle.itemTable.sh.getRange(r._row, iState).setValue("published");
    if (iPub > 0) bundle.itemTable.sh.getRange(r._row, iPub).setValue(now);
    if (iUpd > 0) bundle.itemTable.sh.getRange(r._row, iUpd).setValue(now);
    r['상태'] = "published"; r.published_at = now; r.updated_at = now;
  });
  weeklyAppend_(bundle.ledger, { issue_key: bundle.issueKey, state: "published", revision: 1, manual_confirmed: bundle.ledgerRow.manual_confirmed, auto_mode: bundle.ledgerRow.auto_mode, published_at: now, emailed_at: "", content_hash: bundle.ledgerRow.content_hash, updated_at: now, message: "20:00 공개; 주간 메일 발송 시작" });
}
function weeklyReleaseCats_(items) {
  var byDomain = {};
  items.forEach(function (r) { var d = String(r['분야'] || ""); if (!d) return; (byDomain[d] = byDomain[d] || []).push(r); });
  return CATS.map(function (base) {
    var cat = { key: base.key, label: base.label, prefSheet: base.prefSheet, page: base.page, domains: base.domains, issues: {} };
    base.domains.forEach(function (d) {
      var rows = byDomain[d.id] || []; if (!rows.length) return;
      var signals = rows.filter(function (r) { return String(r['유형'] || "signal").toLowerCase() !== "headliner"; }).map(function (r) { return { t: String(r['제목ko'] || ""), l: String(r['한줄ko'] || ""), tag: "" }; });
      var headRow = rows.filter(function (r) { return String(r['유형'] || "").toLowerCase() === "headliner"; })[0] || rows[0];
      cat.issues[d.id] = { signals: signals.length ? signals : [{ t: String(headRow['제목ko'] || ""), l: String(headRow['한줄ko'] || ""), tag: "" }], head: { title: String(headRow['제목ko'] || ""), sum: [String(headRow['한줄ko'] || "")] } };
    });
    return cat;
  });
}
function weeklyDelivery_() {
  var ss = weeklyMarketSs_(), sh = ss.getSheetByName(CFG.WEEKLY_DELIVERY_TAB);
  if (!sh) { sh = ss.insertSheet(CFG.WEEKLY_DELIVERY_TAB); sh.appendRow(["issue_key","revision","recipient_hash","status","attempted_at","error"]); }
  return weeklyTable_(ss, CFG.WEEKLY_DELIVERY_TAB);
}
function weeklySentMap_(table, issue, revision) {
  var out = {}; table.rows.forEach(function (r) { if (String(r.issue_key) === issue && Number(r.revision || 0) === revision && String(r.status) === "sent") out[String(r.recipient_hash)] = 1; }); return out;
}
function weeklyLog_(table, issue, revision, hash, status, error) { weeklyAppend_(table, { issue_key: issue, revision: revision, recipient_hash: hash, status: status, attempted_at: weeklyNow_(), error: error || "" }); }
function weeklySafeError_(e, email) { return String(e || "").split(email).join("[recipient]").slice(0, 300); }

function sendWeekly() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log("[주간] 다른 발송 실행 중 — 중복 실행 생략"); return; }
  try { return sendWeeklyUnlocked_(); } finally { lock.releaseLock(); }
}
function sendWeeklyUnlocked_() {
  var issueKey = weeklyIsoIssue_(0), bundle = weeklyLatestBundle_(issueKey);
  if (!bundle) { Logger.log("[주간 " + issueKey + "] 발송 가능한 rev.1 원장/항목 없음 또는 이미 완료 — 생략"); return; }
  if (!CFG.TEST_MODE) weeklyPublish_(bundle);
  CFG.WEEK = bundle.issueKey + " · rev.1";
  var releaseCats = weeklyReleaseCats_(bundle.items);
  var rt = tableOf_(CFG.RESP_SHEET), iE = idx_(rt.header, CFG.RESP_COL.email), iC = idx_(rt.header, CFG.RESP_COL.consent), iK = idx_(rt.header, CFG.RESP_COL.keywords);
  if (iE < 0 || iC < 0) throw new Error("응답 시트 컬럼 확인: '" + CFG.RESP_COL.email + "' / '" + CFG.RESP_COL.consent + "'");
  syncResubscribes_();          // 재신청자를 먼저 '구독'으로 되돌린 뒤 선호도를 읽는다
  var maps = {}; releaseCats.forEach(function (c) { maps[c.key] = prefMap_(c.prefSheet); });
  var delivery = weeklyDelivery_(), sentMap = weeklySentMap_(delivery, bundle.issueKey, 1);
  var sent = 0, skipped = 0, failed = 0, seen = {};
  for (var i = 0; i < rt.rows.length; i++) {
    var cells = rt.rows[i].cells, email = String(cells[iE] || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0 || seen[email] || !consented_(cells[iC])) { skipped++; continue; }
    seen[email] = 1;
    var hash = token_(email); if (sentMap[hash]) { skipped++; continue; }
    var perCat = [];
    releaseCats.forEach(function (c) {
      var p = maps[c.key][email], available = c.domains.filter(function (d) { return !!c.issues[d.id]; }), domIds;
      if (p && p.status === "수신거부") return;
      domIds = p ? available.filter(function (d) { return p.domains.indexOf(d.label) >= 0; }).map(function (d) { return d.id; }) : available.map(function (d) { return d.id; });
      if (!p && available.length) prefUpsert_(c.prefSheet, email, c.domains.map(function (d) { return d.label; }), "구독");
      if (domIds.length) perCat.push({ cat: c, domIds: domIds });
    });
    if (!perCat.length) { skipped++; continue; }
    var kw = iK >= 0 ? String(cells[iK] || "").trim() : "", recipient = CFG.TEST_MODE ? CFG.OPERATOR_EMAIL : email;
    try {
      sendMail_(recipient, CFG.SUBJECT + " · " + bundle.issueKey, plain_(perCat, kw), html_(email, kw, perCat));
      sent++;
      if (!CFG.TEST_MODE) { weeklyLog_(delivery, bundle.issueKey, 1, hash, "sent", ""); sentMap[hash] = 1; }
      if (CFG.TEST_MODE) break;
    } catch (e) { failed++; if (!CFG.TEST_MODE) weeklyLog_(delivery, bundle.issueKey, 1, hash, "failed", weeklySafeError_(e, email)); Logger.log("[ERROR] recipient_hash=" + hash + " " + weeklySafeError_(e, email)); }
  }
  if (!CFG.TEST_MODE) {
    var state = failed ? "email_partial" : "emailed", now = weeklyNow_();
    weeklyAppend_(bundle.ledger, { issue_key: bundle.issueKey, state: state, revision: 1, manual_confirmed: bundle.ledgerRow.manual_confirmed, auto_mode: bundle.ledgerRow.auto_mode, published_at: bundle.items[0].published_at || now, emailed_at: failed ? "" : now, content_hash: bundle.ledgerRow.content_hash, updated_at: now, message: "발송 성공 " + sent + " · 실패 " + failed + " · 생략 " + skipped });
  }
  Logger.log((CFG.TEST_MODE ? "[TEST] " : "") + "[주간 " + bundle.issueKey + "] 발송 " + sent + " · 건너뜀 " + skipped + " · 실패 " + failed);
}

// ===== 스페셜 리포트 발송 =====
// 서재 항목 하나를 골라 구독자에게 보낸다. 관리자 콘솔이 '스페셜-발송' 탭에 예약 행을 쓰고,
// 여기 15분 트리거가 시각이 지난 행을 집어 발송한다.
//
// 왜 콘솔이 직접 보내지 않는가: 구독자 목록·동의 판정·수신거부·중복방지가 전부 이 파일에 있다.
// 콘솔에 복제하면 규칙이 갈라지고, 갈라진 쪽이 통과시킨 사람에게 메일이 나간다.
//
// 수신자별 기록은 주간-발송로그를 그대로 쓴다(issue_key = "special:<발송id>").
// 새 탭·새 헬퍼 없이 weeklySentMap_ · weeklyLog_ 가 재사용되고, 중간에 끊겨도 이어서 보낸다.
var SPECIAL_TAB = "스페셜-발송";
var SPECIAL_HEADER = ["발송id", "서재id", "메일제목", "리드", "대상카테고리", "예약시각",
                      "상태", "발송수", "실패수", "created_at", "updated_at", "message"];
var SPECIAL_LIBRARY_TAB = "서재";
// 상태 전이: 대기 → 발송중 → 완료 / 부분 / (운영자가) 취소
var SPECIAL_PENDING = "대기";

function specialTable_(name) { return weeklyTable_(weeklyMarketSs_(), name); }

/** '스페셜-발송' 행 + 서재 항목을 묶어 발송 단위로 만든다. 못 찾으면 null. */
function specialBundle_(row) {
  var libId = String(row["서재id"] || "").trim();
  if (!libId) return null;
  var lib = specialTable_(SPECIAL_LIBRARY_TAB).rows.filter(function (r) {
    return String(r["id"] || "").trim() === libId;
  })[0];
  if (!lib) return null;
  return { row: row, lib: lib, id: String(row["발송id"] || "").trim() };
}

/** 대상 카테고리 라벨 목록 → 받을 이메일 목록.
 *
 * 동의 게이트는 무조건 적용한다. 카테고리는 OR — 하나라도 구독중이면 받는다.
 * 운영자가 "이 리포트는 두 분야 모두에 해당한다"고 판단해 고른 것이므로 그 의도에 맞고,
 * AND 로 하면 고를수록 수신자가 줄어드는 거꾸로 된 동작이 된다.
 */
function specialRecipients_(catLabels) {
  var cats = CATS.filter(function (c) { return catLabels.indexOf(c.label) >= 0; });
  if (!cats.length) cats = CATS;                       // 대상 미지정이면 전 카테고리 기준
  syncResubscribes_();                                  // 재구독자를 먼저 되살린 뒤 상태를 읽는다
  var maps = cats.map(function (c) { return prefMap_(c.prefSheet); });
  var rt = tableOf_(CFG.RESP_SHEET);
  var iE = idx_(rt.header, CFG.RESP_COL.email), iC = idx_(rt.header, CFG.RESP_COL.consent);
  if (iE < 0 || iC < 0) throw new Error("응답 시트 컬럼 확인: '" + CFG.RESP_COL.email + "'");
  var out = [], seen = {};
  rt.rows.forEach(function (r) {
    var email = String(r.cells[iE] || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0 || seen[email]) return;
    seen[email] = 1;
    if (!consented_(r.cells[iC])) return;
    // 고른 카테고리 중 하나라도 '수신거부'가 아니면 받는다. 선호도 행이 아직 없는 사람은
    // 해지한 적이 없다는 뜻이므로 받는 쪽이다(주간의 기본 동작과 같다).
    var live = maps.some(function (m) { var p = m[email]; return !p || p.status !== "수신거부"; });
    if (live) out.push(email);
  });
  return out;
}

function specialPlain_(lib, lead) {
  var lines = [String(lib["제목"] || "").trim(), ""];
  if (lead) lines.push(lead, "");
  var body = String(lib["본문"] || "").trim();
  // 평문에서는 표를 파이프 그대로 둔다(그 편이 읽힌다). 다만 헤더 기호·볼드·
  // 마크다운 이스케이프는 지운다 — "\-41.44%" 의 백슬래시가 그대로 보이면 안 된다.
  if (body) lines.push(mdUnescape_(body.replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "")), "");
  lines.push("사이트에서 보기: " + CFG.BASE + "read.html?id=" + encodeURIComponent(String(lib["id"] || "")),
             "", "정보 제공·투자 조언 아님.");
  return lines.join("\n");
}

function specialHtml_(email, lib, lead) {
  var tok = token_(email);
  var url = CFG.BASE + "read.html?id=" + encodeURIComponent(String(lib["id"] || ""));
  var unsub = CFG.WEBAPP_URL ? link_(tok, "unsubscribe", "", "", "수신거부")
    : '<a href="mailto:' + CFG.OPERATOR_EMAIL + '" style="color:' + C.muted + '">수신거부</a>';
  var leadHtml = lead
    ? '<p style="margin:0 0 16px;font-size:14px;color:' + C.text + ';line-height:1.7">' + esc_(lead) + "</p>"
    : "";
  // 본문은 서재 항목에서만 관리한다 — renderBody_ 가 일일 상세 브리핑과 같은 렌더러다.
  var body = renderBody_(String(lib["본문"] || ""));
  return [
    '<div style="margin:0;padding:0;background:' + C.canvas + '">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.canvas + '"><tr><td align="center" style="padding:24px 12px">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:' + C.surface + ';border:1px solid ' + C.border + ';border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:' + C.text + '">',
    '<tr><td style="padding:20px 24px;border-bottom:1px solid ' + C.border + '">',
      '<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:' + C.primary + '">BRIEFING SIGNAL LAB · 스페셜 리포트</div>',
      '<div style="font-size:20px;font-weight:700;margin-top:4px">' + esc_(String(lib["제목"] || "")) + "</div>",
    "</td></tr>",
    '<tr><td style="padding:20px 24px">', leadHtml, body,
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 4px"><tr><td style="border-radius:8px;background:' + C.primary + '">',
        '<a href="' + url + '" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#fff;text-decoration:none">사이트에서 전체 보기 →</a>',
      "</td></tr></table>",
    "</td></tr>",
    '<tr><td style="padding:16px 24px;border-top:1px solid ' + C.border + ';font-size:12px;color:' + C.muted + ';line-height:1.6">',
      "정보 제공·투자 조언 아님. 종목·자산은 공개 출처 기반 관찰로만 명시하며 매수·매도·목표가를 권유하지 않습니다.<br>",
      '<a href="' + CFG.BASE + '" style="color:' + C.muted + '">Briefing Signal Lab</a> &nbsp;·&nbsp; ' + unsub,
    "</td></tr>",
    "</table></td></tr></table></div>",
  ].join("");
}

function specialSet_(table, row, patch) {
  Object.keys(patch).forEach(function (k) {
    var col = table.header.indexOf(k);
    if (col >= 0) table.sh.getRange(row._row, col + 1).setValue(patch[k]);
  });
}

/** 예약 시각이 지난 '대기' 행 하나를 발송한다. 반환 = 결과 요약 문자열. */
function specialSendRow_(table, row) {
  var bundle = specialBundle_(row);
  if (!bundle) {
    specialSet_(table, row, { "상태": "실패", updated_at: weeklyNow_(),
      message: "서재 id 를 찾지 못함: " + String(row["서재id"] || "") });
    return "서재 항목 없음";
  }
  // 크래시로 '발송중'에 멈추면 다음 폴링이 다시 집지 않는다 — 중복 발송보다 멈추는 쪽이 낫다.
  // 운영자가 상태를 '대기'로 되돌리면 발송로그 덕에 받은 사람은 건너뛰고 이어서 보낸다.
  specialSet_(table, row, { "상태": "발송중", updated_at: weeklyNow_() });

  var prevSent = Number(row["발송수"] || 0), sent = 0, failed = 0;
  try {
    var cats = String(row["대상카테고리"] || "").split(/[,·]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var lead = String(row["리드"] || "").trim();
    var subject = String(row["메일제목"] || "").trim() || ("[스페셜 리포트] " + String(bundle.lib["제목"] || ""));
    var issueKey = "special:" + bundle.id;
    var delivery = weeklyDelivery_(), sentMap = weeklySentMap_(delivery, issueKey, 1);

    var targets = specialRecipients_(cats).filter(function (em) { return !sentMap[token_(em)]; });
    // 주간과 같다 — 발송로그가 있으므로 부분 발송을 허용한다. 한도로 끊겨도 다음에 이어서 간다.
    //
    // ⚠️ 한도 조회는 경고 로그 전용이다. 발송을 막지 않는다. 그런데 MailApp 은 GmailApp 과
    //    OAuth 스코프가 달라, 트리거가 새 스코프를 승인받기 전이면 이 줄에서 통째로 죽는다
    //    (2026-08-17 스페셜·일일이 정확히 여기서 멈췄다). 진단이 발송을 죽이면 안 된다.
    var left = null;
    try { left = MailApp.getRemainingDailyQuota(); }
    catch (e) { Logger.log("[WARN] 스페셜 " + bundle.id + " 잔여 한도 조회 실패 — 경고 생략: " + e); }
    if (targets.length && left != null && left < targets.length) {
      Logger.log("[WARN] 스페셜 " + bundle.id + " 한도 부족 — 필요 " + targets.length + " · 잔여 " + left + " (부분 발송 후 이어서 진행)");
    }

    for (var i = 0; i < targets.length; i++) {
      var email = targets[i], hash = token_(email);
      var recipient = CFG.TEST_MODE ? CFG.OPERATOR_EMAIL : email;
      try {
        sendMail_(recipient, subject, specialPlain_(bundle.lib, lead), specialHtml_(email, bundle.lib, lead));
        sent++;
        if (!CFG.TEST_MODE) weeklyLog_(delivery, issueKey, 1, hash, "sent", "");
        if (CFG.TEST_MODE) break;
      } catch (e) {
        failed++;
        if (!CFG.TEST_MODE) weeklyLog_(delivery, issueKey, 1, hash, "failed", weeklySafeError_(e, email));
        Logger.log("[ERROR] special recipient_hash=" + hash + " " + weeklySafeError_(e, email));
      }
    }
    // 실패가 남으면 '부분'으로 두어 운영자가 보고 판단하게 한다. 자동 재시도는 하지 않는다 —
    // 실패 원인이 한도면 같은 날 다시 시도해도 같은 결과다.
    var state = failed ? "부분" : "완료";
    specialSet_(table, row, {
      "상태": state, "발송수": prevSent + sent, "실패수": Number(row["실패수"] || 0) + failed,
      updated_at: weeklyNow_(),
      message: "발송 " + sent + " · 실패 " + failed + " · 이미받음 " + (specialRecipients_(cats).length - targets.length),
    });
    return bundle.id + " " + state + " (발송 " + sent + " · 실패 " + failed + ")";
  } catch (e) {
    // 여기까지 오면 발송 루프 밖에서 죽은 것이다. 사유를 행에 남기지 않으면 운영자에게는
    // '발송중 · 0건 · message 공란'만 보이고, 실행 기록을 뒤져야 원인을 안다
    // (2026-08-17 에 실제로 그렇게 찾았다). 상태는 '실패'로 두어 폴링이 다시 집지 않게 한다 —
    // 운영자가 재시도를 누르면 발송로그가 이미 받은 사람을 걸러 이어서 간다.
    specialSet_(table, row, {
      "상태": "실패", "발송수": prevSent + sent, "실패수": Number(row["실패수"] || 0) + failed,
      updated_at: weeklyNow_(), message: "중단: " + String(e).slice(0, 250),
    });
    Logger.log("[ERROR] 스페셜 " + bundle.id + " 중단(발송 " + sent + "건까지): " + e);
    return bundle.id + " 실패 (" + String(e).slice(0, 120) + ")";
  }
}

/** 15분 트리거 진입점. 예약 시각이 지난 '대기' 행을 순서대로 발송한다. */
function sendSpecialDue() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log("[스페셜] 다른 발송 실행 중 — 생략"); return; }
  try {
    var table = specialTable_(SPECIAL_TAB);
    var now = new Date().getTime();
    var due = table.rows.filter(function (r) {
      if (String(r["상태"] || "").trim() !== SPECIAL_PENDING) return false;
      var t = toTime_(r["예약시각"], false);
      return t != null && t <= now;
    });
    if (!due.length) return;
    // 한 번에 하나씩만 보낸다. Apps Script 실행 시간 상한(6분)을 넘기면 통째로 죽는데,
    // 여러 건을 몰아 보내면 어디까지 갔는지가 상태에 안 남는다. 나머지는 15분 뒤에 간다.
    Logger.log("[스페셜] 발송 대상 " + due.length + "건 — 이번 회차 1건 처리");
    Logger.log("[스페셜] " + specialSendRow_(table, due[0]));
  } finally { lock.releaseLock(); }
}

/** 설치 진단 — 콘솔에서 "unauthorized" 나 연결 오류가 날 때 여기서 실행한다.
 *
 * 콘솔 쪽 checkAdminProps 와 짝이다. 양쪽 길이를 맞대보면 토큰이 잘렸는지 다른 값인지
 * 바로 갈린다 — 값을 눈으로 비교하려 들면 27자짜리 난수라 절대 못 찾는다.
 *
 * ⚠️ 이름 끝에 _ 를 붙이지 말 것 — Apps Script 는 _ 로 끝나는 함수를 실행 드롭다운에서 숨긴다.
 * ⚠️ 토큰 값 자체는 찍지 않는다. 실행 기록에 평문으로 남는다.
 */
function checkMailerProps() {
  var token = PropertiesService.getScriptProperties().getProperty("WEEKLY_CRON_TOKEN");
  if (token == null) {
    Logger.log("[진단] WEEKLY_CRON_TOKEN : 없음");
    Logger.log("  ❌ 이 값이 없으면 doPost 가 **모든** 요청을 거부합니다 — 콘솔 테스트 발송뿐 아니라");
    Logger.log("     GitHub Actions 의 월요일 주간 발송도 실패합니다. 값을 만들어 양쪽에 같이 넣으세요.");
  } else if (String(token).trim() === "") {
    Logger.log("[진단] WEEKLY_CRON_TOKEN : 있으나 빈 값 — 위와 같은 결과입니다");
  } else {
    Logger.log("[진단] WEEKLY_CRON_TOKEN : 설정됨 (" + String(token).length + "자)"
      + (String(token) !== String(token).trim() ? "  ⚠️ 앞뒤 공백 있음 — 복사할 때 딸려온 것" : ""));
    Logger.log("  → 콘솔 checkAdminProps 의 MAILER_TOKEN 자릿수와 같아야 합니다. 다르면 잘렸거나 다른 값입니다.");
  }

  // CFG.WEBAPP_URL 은 손으로 유지하는 상수라 실제 배포와 어긋날 수 있다.
  // 어긋나면 구독자 메일의 수신거부·분야변경 링크가 엉뚱한 곳으로 간다.
  //
  // ⚠️ 자동 비교는 불가능하다. getService().getUrl() 은 **편집기에서 부르면 /dev**(개발용)를
  //    돌려주고 그 배포 ID 는 운영 /exec 와 애초에 다르다. 비교하면 항상 불일치로 나온다
  //    (2026-08-16 실제로 오탐을 냈다). 형식만 보고, 실물 확인은 사람이 브라우저로 한다.
  if (!CFG.WEBAPP_URL) {
    Logger.log("[진단] ⚠️ CFG.WEBAPP_URL 이 비어 있습니다 — 수신거부가 mailto 폴백으로 나갑니다");
  } else if (CFG.WEBAPP_URL.indexOf("/exec") < 0) {
    Logger.log("[진단] ❌ CFG.WEBAPP_URL 이 /exec 가 아닙니다 — 수신거부 링크가 깨집니다: " + CFG.WEBAPP_URL);
  } else {
    Logger.log("[진단] CFG.WEBAPP_URL = " + CFG.WEBAPP_URL);
    Logger.log("  → 확인법: 이 주소를 브라우저에 붙여넣어 'BRIEFING SIGNAL LAB / 잘못된 요청입니다' 가 나오면 정상입니다.");
    Logger.log("     JSON 이나 다른 화면이 나오면 시장·방문로그 웹앱을 가리키는 것이라 수신거부가 깨집니다.");
  }

  Logger.log("[진단] CFG.TEST_MODE = " + CFG.TEST_MODE
    + (CFG.TEST_MODE ? "  ⚠️ true 면 구독자 대신 운영자에게만 1통 갑니다" : ""));
  Logger.log("[진단] CFG.MARKET_SHEET_ID " + (CFG.MARKET_SHEET_ID ? "설정됨" : "❌ 비어 있음 — 주간·일일·스페셜 전부 멈춥니다"));
  Logger.log("[진단] CFG.SALT " + (CFG.SALT && CFG.SALT.indexOf("CHANGE-ME") < 0 ? "설정됨" : "⚠️ 기본값 그대로 — 수신거부 토큰이 바뀌면 기존 링크가 죽습니다"));

  var names = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).sort();
  Logger.log("[진단] 설치된 트리거: [" + names.join(", ") + "]");
  if (names.indexOf("sendSpecialDue") < 0) {
    Logger.log("  ⚠️ sendSpecialDue 트리거가 없습니다 — createSpecialTrigger() 를 1회 실행하세요(예약해도 안 나갑니다)");
  }
}

/** 15분 폴링 트리거 생성(1회 실행). 기존 동명 트리거는 지우고 다시 만든다. */
function createSpecialTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === "sendSpecialDue") ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger("sendSpecialDue").timeBased().everyMinutes(15).create();
  Logger.log("스페셜 발송 폴링 트리거 생성(15분)");
}

function weeklyAlert_(label, addDays) {
  var issueKey = weeklyIsoIssue_(addDays || 0), bundle = weeklyLatestBundle_(issueKey);
  var msg = bundle ? bundle.issueKey + " 상태 " + bundle.ledgerRow.state + " · " + bundle.items.length + "건" : issueKey + " 발행 준비 원장 없음";
  sendMail_(CFG.OPERATOR_EMAIL, "[BSL 주간 승인 알림] " + label, msg + "\n관리자 콘솔에서 승인/발행 예약 상태를 확인하세요.", "");
}
// addDays 는 weeklyIsoIssue_ 의 기준일 보정이다. ISO 주는 월~일이라 **일요일은 끝나는 주**에
// 속한다 — 일요일 알림에서 0을 쓰면 지난 호를 조회한다. 그래서 일요일만 +1(월요일)로 민다.
function weeklyAlertDraft()    { weeklyAlert_("일요일 09:00 · 초안 확인", 1); }
function weeklyAlertDeadline() { weeklyAlert_("일요일 20:00 · 승인 마감 8시간 전", 1); }
function weeklyAlertResult()   { weeklyAlert_("월요일 10:00 · 발송 결과", 0); }
function createWeeklyTriggers() {
  // 옛 이름을 목록에 남겨둔다 — 빼면 화요일 트리거가 사라진 함수를 계속 호출해
  // 매주 Apps Script 오류 메일이 온다(재설치해도 자기 이름만 지우므로 고아가 된다).
  var names = ["weeklyAlertDraft","weeklyAlertDeadline","weeklyAlertResult","sendWeekly",
               "weeklyAlertSunday","weeklyAlertMonday","weeklyAlertTuesday"];
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (names.indexOf(tr.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("weeklyAlertDraft").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).nearMinute(0).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("weeklyAlertDeadline").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).nearMinute(0).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("weeklyAlertResult").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).nearMinute(0).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("sendWeekly").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).nearMinute(0).inTimezone("Asia/Seoul").create();
  Logger.log("주간 알림 3개 + 월요일 09:00 발송 트리거 생성");
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
// GmailApp.sendEmail이 비-BMP(서로게이트 쌍) 문자를 깨뜨린다. 시트·Apps Script 읽기까지는
// 정상인데(진단: U+D83D U+DCCC 확인) 수신 메일에서만 replacement 문자로 나온다.
// 한글은 BMP라 무사하고 이모지만 깨지므로, 메일에 넘기기 직전 astral 문자를 제거한다.
// LLM이 만든 본문·제목에 이모지가 섞여 들어오는 경로가 여럿이라 발송 직전 한 곳에서 막는다.
function mailSafe_(s) { return String(s == null ? "" : s).replace(/[\uD800-\uDFFF]/g, ""); }

// ===== 발송 단일 지점 =====
// 모든 발송이 여기 한 곳을 지난다. 이유가 둘이다.
//  (1) mailSafe_ 를 호출부마다 기억해 붙일 필요가 없다 — 빠뜨리면 이모지가 깨진 채 나간다.
//  (2) Gmail 이 아닌 발송 수단으로 옮길 때 고칠 자리가 여기 하나다. 지금은 GmailApp 이지만
//      한도(개인 계정 하루 100명)가 좁아 Workspace 나 전용 발송 서비스로 옮기게 된다.
function sendMail_(to, subject, plain, htmlBody) {
  var options = { name: CFG.SENDER_NAME };
  // 빈 htmlBody 를 넘기면 Gmail 이 그 빈 HTML 을 본문으로 써서 메일이 백지로 간다.
  // 운영자 알림처럼 평문만 있는 발송이 있으므로 여기서 걸러낸다.
  if (htmlBody) options.htmlBody = mailSafe_(htmlBody);
  GmailApp.sendEmail(mailSafe_(to), mailSafe_(subject), mailSafe_(plain), options);
}

// ===== 일일 발송 한도 가드 =====
// 한도는 '하루 수신자 수'이고 계정 단위로 모든 스크립트가 같은 풀을 쓴다. 개인 계정은 100명.
// 일일 시황이 매일 전 구독자에게 나가므로 주간과 겹치는 월요일이 2N 으로 병목이다(상한 50명).
//
// ⚠️ 부족하면 **보내지 않고 알린다.** 절반만 나가는 쪽이 더 나쁘다 — 일일 발송은 수신자별
//    로그가 없어 누가 받았는지 알 수 없고, 재발송하면 받은 사람이 두 번 받는다.
//    needed 를 모를 때(0)는 통과시킨다(fail-open) — 가드가 발송을 막는 주체가 되면 안 된다.
//
// ⚠️ 한도 조회 자체가 실패해도 같은 원칙으로 통과시킨다. MailApp 은 GmailApp 과 OAuth
//    스코프가 달라 트리거가 새 스코프를 승인받기 전이면 여기서 예외가 나는데,
//    2026-08-17 에 그 예외가 일일 시황 발송을 통째로 죽였다(가드가 발송을 막은 셈).
function mailQuotaOk_(needed, label) {
  var left;
  try { left = MailApp.getRemainingDailyQuota(); }
  catch (e) { Logger.log("[WARN] " + label + " 잔여 한도 조회 실패 — 가드 생략하고 발송 진행: " + e); return true; }
  if (!needed || left >= needed) return true;
  Logger.log("[ERROR] " + label + " 발송 한도 부족 — 필요 " + needed + " · 잔여 " + left);
  try {
    sendMail_(CFG.OPERATOR_EMAIL, "[BSL] 발송 한도 부족 — " + label + " 발송 보류",
      label + " 발송에 " + needed + "명이 필요하나 오늘 남은 한도가 " + left + "명입니다.\n\n" +
      "절반만 나가면 누가 받았는지 알 수 없어 재발송이 불가능하므로 발송하지 않았습니다.\n" +
      "한도는 자정(태평양 표준시 기준)에 초기화됩니다. 반복되면 Google Workspace 계정으로 옮겨야 합니다(한도 1,500명).", "");
  } catch (e) { Logger.log("[ERROR] 한도 부족 알림도 실패: " + e); }
  return false;
}

// ===== 일일 시황 메일 (Stage 4) =====
// '시장' 스프레드시트(구독자 시트와 별개)의 시장-일일 탭을 openById로 읽는다.
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Seoul", "yyyy-MM-dd");
  return String(v || "").trim().slice(0, 10);
}
function marketRows_() {
  if (!CFG.MARKET_SHEET_ID) throw new Error("CFG.MARKET_SHEET_ID를 채우세요('시장' 스프레드시트 ID).");
  var sh = SpreadsheetApp.openById(CFG.MARKET_SHEET_ID).getSheetByName(CFG.MARKET_TAB);
  if (!sh) throw new Error("시장 탭 '" + CFG.MARKET_TAB + "'을(를) 찾을 수 없습니다.");
  var values = sh.getDataRange().getValues();
  var H = (values[0] || []).map(function (h) { return String(h).trim(); });
  var iDt = H.indexOf("날짜"), iCat = H.indexOf("분류"), iTi = H.indexOf("제목"), iLn = H.indexOf("한줄"), iSrc = H.indexOf("출처URL");
  if (iTi < 0 || iLn < 0) throw new Error("시장-일일 헤더에 '제목'/'한줄'이 필요합니다.");
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var c = values[r];
    out.push({
      date: ymd_(c[iDt]),
      cat: iCat >= 0 ? String(c[iCat] || "").trim() : "",
      title: String(c[iTi] || "").trim(),
      line: String(c[iLn] || "").trim(),
      src: iSrc >= 0 ? String(c[iSrc] || "").trim() : "",
    });
  }
  return out;
}
// ── 일일 메일이 담는 3슬롯 창 ──────────────────────────────────────────────
//
// 07:40 발송 시점엔 그날 07:00(장전) 슬롯만 존재한다. '오늘'만 보면 하루 산출물의
// 1/3만 나가고 전날 13:00·19:00 분은 시트에 쌓인 채 아무도 읽지 않는다.
//
// 더 중요한 건 단일 실패점 제거다. 2026-08-03 에 장전 슬롯이 통째로 빠지자
// (텔레그램쪽 full_summary 가 비어 write_market_body 가 no-op) 장중 775자가
// 시트에 멀쩡히 있는데도 메일엔 상세 브리핑이 아예 안 붙었다.
// 세 슬롯을 보면 하나가 빠져도 나머지가 그날을 구제한다.
//
// 순서는 최신 먼저 — 사이트 시장 탭의 mktPeriodRank 와 같은 방향이다.
function dailyWindow_() {
  var tz = "Asia/Seoul", now = new Date().getTime();
  var d = function (days) {
    return Utilities.formatDate(new Date(now + days * 86400000), tz, "yyyy-MM-dd");
  };
  return [
    { date: d(0),  period: "장전", full: true  },   // 당일 아침 — 전문
    { date: d(-1), period: "마감", full: false },   // 전일 저녁 — 토픽만
    { date: d(-1), period: "장중", full: false }    // 전일 오후 — 토픽만
  ];
}

// 시장-일일 제목 접두사에서 시간대를 뽑는다. 파이프가 "[장전] 제목" 으로 쓰고
// 별도 컬럼이 없다(접두사가 시간대 표시이자 사이트 정렬 키). 접두사 없는 레거시
// 행은 "" — 오늘 것이면 그대로 싣고 어제 것만 걸러낸다.
function slotOf_(title) {
  var m = String(title || "").match(/^\s*\[(장전|장중|마감)\]/);
  return m ? m[1] : "";
}

// 상세 본문에서 '토픽별 통합 브리핑' 부분만 남긴다(하위 요약 헤더에서 자름).
// 마커가 없으면 — 빈 응답 폴백으로 만들어진 본문에는 헤더가 없다 — 앞부분만 잘라
// 길이를 묶는다. 3슬롯을 통째로 실으면 Gmail 잘림(102KB)에 걸린다.
//
// '채널별'과 '분야별'을 **둘 다** 받는다. 2026-08-04 에 텔레그램 프롬프트가
// 채널 핸들 노출을 막으려 '채널별 요약' → '분야별 요약'으로 바뀌었는데, 이 창은
// 어제 행까지 읽으므로 전환 기간엔 옛 문구가 섞인다. 하나만 보면 그 슬롯이
// 통째로 전문으로 실려 Gmail 잘림에 걸린다.
function topicPart_(text) {
  var s = String(text || "");
  var i = s.search(/^#{1,6}\s*[^\n]*(채널별|분야별)/m);
  if (i > 0) return s.slice(0, i).trim();
  return s.length > 1200 ? s.slice(0, 1200).trim() + " …" : s;
}

// 3슬롯 창의 시장-일일 행을 경제/금융/기술 순으로 그룹핑. 없으면 [].
function dailyGroups_() {
  var win = dailyWindow_(), today = win[0].date, yday = win[1].date;
  var rows = marketRows_().filter(function (o) {
    if (!o.title) return false;
    if (o.date === today) return true;                       // 오늘 것은 시간대 불문 전부
    if (o.date === yday) return slotOf_(o.title) !== "장전";  // 어제 장전은 어제 이미 나갔다
    return false;
  }).sort(function (a, b) {
    return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); // 날짜 최신 먼저(같은 날은 시트 순서)
  });
  var groups = [];
  CFG.DAILY_CATS.forEach(function (cat) {
    var items = rows.filter(function (o) { return o.cat === cat; });
    if (items.length) groups.push({ label: cat, items: items });
  });
  // 분류가 하나도 안 채워진 레거시 시트면 카테고리 없이 전체를 한 그룹으로.
  if (!groups.length && rows.length) groups.push({ label: "", items: rows });
  return { today: today, groups: groups };
}
// 3슬롯 상세 본문(텔레그램 요약, §6 마스킹됨). 장전은 전문, 전일 오후·저녁은 토픽만.
// 창에 든 슬롯이 하나도 없으면 "".
function marketBody_() {
  if (!CFG.MARKET_SHEET_ID) return "";
  var sh = SpreadsheetApp.openById(CFG.MARKET_SHEET_ID).getSheetByName(CFG.MARKET_BODY_TAB);
  if (!sh) return "";
  var values = sh.getDataRange().getValues();
  var H = (values[0] || []).map(function (h) { return String(h).trim(); });
  var iDt = H.indexOf("날짜"), iPd = H.indexOf("시간대"), iBd = H.indexOf("본문");
  if (iBd < 0) return "";

  // 시간대 열이 없는 레거시 시트면 옛 동작(그날 마지막 행)으로 물러난다.
  if (iPd < 0) {
    var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd"), legacy = "";
    for (var k = 1; k < values.length; k++) {
      if (ymd_(values[k][iDt]) === today) legacy = String(values[k][iBd] || "");
    }
    return legacy;
  }

  // 같은 (날짜, 시간대) 가 두 번 기록될 수 있다 — 뒤(최신)가 이긴다. 빈 본문은 무시한다.
  var pick = {};
  for (var r = 1; r < values.length; r++) {
    var c = values[r], t = String(c[iBd] || "");
    if (t.trim()) pick[ymd_(c[iDt]) + "|" + String(c[iPd] || "").trim()] = t;
  }

  var out = [];
  dailyWindow_().forEach(function (w) {
    var t = pick[w.date + "|" + w.period];
    if (!t) return;
    out.push("## " + w.period + " · " + w.date);
    out.push(w.full ? t.trim() : topicPart_(t));
  });
  return out.join("\n\n");
}
function boldMd_(s) { return s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }

// 마크다운 이스케이프 해제. LLM 이 표 안의 증감률을 "\-41.44%" 처럼 써 보내는데,
// 사이트는 marked 가 해제해 주지만 여기서 안 하면 백슬래시가 그대로 메일에 찍힌다.
function mdUnescape_(s) { return String(s).replace(/\\([\\`*_{}\[\]()#+\-.!|~>])/g, "$1"); }

// 셀 내용 → 이메일 HTML. 순서가 중요하다: 이스케이프 해제 → HTML 이스케이프 → 볼드.
// 뒤집으면 <b> 태그가 다시 이스케이프되거나 사용자 입력의 <  가 태그로 샌다.
function mdInline_(s) { return boldMd_(esc_(mdUnescape_(s))); }

function mdRowCells_(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
    .map(function (c) { return c.trim(); });
}
function isMdRow_(line) { return /^\s*\|.*\|\s*$/.test(line || ""); }
// 구분행: | :--- | ---: | 처럼 하이픈과 콜론만 있는 줄. 이게 있어야 표로 본다.
function isMdSep_(line) { return isMdRow_(line) && /^[\s|:\-]+$/.test(line) && line.indexOf("-") >= 0; }

// 구분행의 콜론 위치 → 정렬. marked 와 같은 규칙이라 사이트와 메일이 같게 보인다.
function mdAlign_(cell) {
  var left = cell.charAt(0) === ":", right = cell.charAt(cell.length - 1) === ":";
  return (left && right) ? "center" : (right ? "right" : "left");
}

/** 마크다운 표 블록 → 이메일 HTML 표.
 *
 * 메일에서는 CSS 클래스·미디어쿼리를 못 쓰므로 전부 인라인 스타일이다.
 * 폭은 100%로 두고 폰트를 12px 로 낮춘다 — 600px 본문에 4열까지가 한계다.
 * 그 이상은 어차피 어느 메일 클라이언트에서도 읽기 어려워 사이트 링크가 답이다.
 */
function mdTable_(block) {
  var align = mdRowCells_(block[1]).map(mdAlign_);
  var head = mdRowCells_(block[0]).map(function (c, i) {
    return '<td style="padding:6px 8px;border-bottom:2px solid ' + C.border +
      ';font-size:12px;font-weight:700;color:' + C.muted + ';text-align:' + (align[i] || "left") +
      ';white-space:nowrap">' + mdInline_(c) + "</td>";
  }).join("");
  var body = block.slice(2).map(function (line) {
    return "<tr>" + mdRowCells_(line).map(function (c, i) {
      return '<td style="padding:6px 8px;border-bottom:1px solid ' + C.border +
        ';font-size:12px;color:' + C.text + ';text-align:' + (align[i] || "left") + '">' +
        mdInline_(c) + "</td>";
    }).join("") + "</tr>";
  }).join("");
  return '<table width="100%" cellpadding="0" cellspacing="0" ' +
    'style="width:100%;border-collapse:collapse;margin:10px 0">' +
    "<tr>" + head + "</tr>" + body + "</table>";
}

// 마크다운풍 상세 본문 → 이메일 HTML(헤더/볼드/표/줄바꿈).
//
// ⚠️ 사이트는 marked 를 쓰고 여기는 손으로 만든 미니 렌더러다. 둘을 완전히 맞추려면
//    메일러에 마크다운 라이브러리를 들여야 하는데, 메일러는 수동 붙여넣기 배포라
//    외부 의존을 넣지 않는다. 실제 리포트에 나오는 구성만 지원한다.
function renderBody_(text) {
  if (!text || !text.trim()) return "";
  var lines = String(text).split(/\r?\n/);
  var out = [], i = 0;
  while (i < lines.length) {
    // 표는 여러 줄을 한 덩어리로 먹으므로 줄 단위 map 이 아니라 while 로 훑는다.
    if (isMdRow_(lines[i]) && i + 1 < lines.length && isMdSep_(lines[i + 1])) {
      var block = [];
      while (i < lines.length && isMdRow_(lines[i])) { block.push(lines[i]); i++; }
      out.push(mdTable_(block));
      continue;
    }
    var line = lines[i].trim();
    i++;
    if (!line || line === "---") { out.push('<div style="height:6px"></div>'); continue; }
    if (/^#{1,6}\s/.test(line)) {
      out.push('<div style="font-size:13px;font-weight:700;color:' + C.text + ';margin:14px 0 4px">' +
        mdInline_(line.replace(/^#{1,6}\s*/, "")) + "</div>");
      continue;
    }
    out.push('<div style="font-size:13px;color:' + C.text + ';line-height:1.6;margin:2px 0">' +
      mdInline_(line) + "</div>");
  }
  return '<div style="margin-top:8px;padding-top:16px;border-top:1px solid ' + C.border + '">' +
    '<div style="font-size:13px;font-weight:700;color:' + C.text + ';border-left:3px solid ' + C.muted + ';padding-left:8px;margin:0 0 10px">상세 브리핑</div>' +
    out.join("") + "</div>";
}
// ===== 재구독 복구 =====
// 수신거부자가 구독 폼으로 다시 신청해도 pref 상태가 '수신거부'로 남아 영구 차단되던 문제.
// 구독 폼은 '메일 수신 동의' 체크가 필수라 재제출 = 새로운 명시적 동의로 본다.
// 판별이 불가능한 경우(타임스탬프 열 없음·파싱 실패·동률)는 수신거부를 유지한다 — 안전 쪽.

// 폼 응답 시트의 타임스탬프 열. 로케일에 따라 제목이 다르고 질문 제목이 바뀌어도
// 1열은 항상 폼이 만든 타임스탬프라 마지막에 0열로 폴백한다.
// (0열이 타임스탬프가 아니면 toTime_ 가 전부 null → 복구 없이 현행 동작 유지)
function respTsIdx_(header) {
  var names = ["타임스탬프", "Timestamp"];
  for (var i = 0; i < names.length; i++) { var k = idx_(header, names[i]); if (k >= 0) return k; }
  return 0;
}
// 시트 값 → epoch ms. Date 객체 / "yyyy-MM-dd" / "yyyy-MM-dd HH:mm:ss" 모두 받는다.
// 시각이 없으면 endOfDay=true 일 때 그날 끝으로 본다(수신거부 시각용).
function toTime_(v, endOfDay) {
  if (v instanceof Date) {
    var t = v.getTime();
    if (isNaN(t)) return null;
    // 옛 행은 날짜만 저장돼 시트가 자정 Date 로 바꿔 놓는다 — 그날 끝으로 해석.
    if (endOfDay && v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0) return t + 86399999;
    return t;
  }
  var s = String(v || "").trim();
  if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) { var p = Date.parse(s); return isNaN(p) ? null : p; }
  var hasTime = m[4] != null;
  var d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return (endOfDay && !hasTime) ? d.getTime() + 86399999 : d.getTime();
}
// 수신거부 시각. 시각 도입 전 행은 날짜만 있어 그날 끝으로 본다 —
// 같은 날 먼저 제출된 응답이 해지보다 나중이라고 잘못 판정되는 것을 막는다.
function unsubTime_(v) { return toTime_(v, true); }
// 응답 시트의 이메일별 '가장 최근' 제출 시각.
// ⚠️ 발송 루프는 seen[email] 로 첫(=가장 오래된) 행만 취하므로 여기서 따로 최댓값을 구한다.
function respLatestTs_() {
  var rt = tableOf_(CFG.RESP_SHEET);
  var iE = idx_(rt.header, CFG.RESP_COL.email), iT = respTsIdx_(rt.header);
  var map = {};
  if (iE < 0 || iT < 0) return map;
  rt.rows.forEach(function (r) {
    var em = String(r.cells[iE] || "").trim().toLowerCase();
    if (!em) return;
    var ts = toTime_(r.cells[iT], false);
    if (ts != null && (map[em] == null || ts > map[em])) map[em] = ts;
  });
  return map;
}
// 수신거부 이후에 폼을 다시 제출했는가.
function resubscribed_(pref, respTs) {
  if (!pref || pref.status !== "수신거부" || respTs == null) return false;
  var u = unsubTime_(pref.updated);
  return u == null ? false : respTs > u;
}
// 재구독자를 pref 시트에서 '구독'으로 되돌린다. 발송 직전에 한 번 돌려
// 시트를 실제 상태와 맞춘다(이후 unsubSet_·주간 루프는 그대로 읽기만 한다).
function syncResubscribes_() {
  var resp = respLatestTs_(), n = 0;
  // 응답 시각을 하나도 못 읽었다 = 타임스탬프 열을 못 찾았거나 형식이 바뀐 것.
  // 안전하게 복구를 건너뛰되, 기능이 통째로 죽은 걸 모르고 지나가지 않도록 남긴다.
  if (!Object.keys(resp).length) { Logger.log("[재구독] 응답 타임스탬프를 읽지 못해 복구 판정 생략 — 시트 1열 확인 필요"); return 0; }
  CATS.forEach(function (c) {
    var m = prefMap_(c.prefSheet);
    Object.keys(m).forEach(function (em) {
      if (!resubscribed_(m[em], resp[em])) return;
      // 분야를 모두 끈 뒤 해지한 경우가 있어, 비어 있으면 가동 분야 전체로 되살린다.
      var doms = m[em].domains.length ? m[em].domains : c.domains.map(function (d) { return d.label; });
      prefUpsert_(c.prefSheet, m[em].email || em, doms, "구독");
      n++;
    });
  });
  if (n) Logger.log("[재구독] 수신거부 해제 " + n + "건");
  return n;
}

// 운영자 진단 — "구독했는데 메일이 안 와요" 문의가 오면 이걸 실행한다.
// 그 사람이 차단 상태인지, 재구독 복구 대상인지, 응답 시각을 읽고 있는지 한 번에 보여준다.
// ⚠️ 읽기 전용이다. 상태를 실제로 되돌리는 것은 발송 직전의 syncResubscribes_() 몫.
// ⚠️ 이름 끝에 _ 를 붙이지 말 것 — Apps Script 는 _ 로 끝나는 함수를 private 으로 취급해
//    실행 드롭다운에 표시하지 않는다(트리거·google.script.run 도 불가).
function checkResubscribe() {
  var resp = respLatestTs_();
  Logger.log("[진단] 응답 시각을 읽은 이메일: " + Object.keys(resp).length + "명");
  var found = 0;
  CATS.forEach(function (c) {
    var m = prefMap_(c.prefSheet);
    Object.keys(m).forEach(function (em) {
      if (m[em].status !== "수신거부") return;
      found++;
      Logger.log("[진단] " + c.prefSheet + " | " + em
        + " | 해지=" + m[em].updated
        + " | 최근응답=" + (resp[em] ? Utilities.formatDate(new Date(resp[em]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : "없음")
        + " | 복구대상=" + resubscribed_(m[em], resp[em]));
    });
  });
  Logger.log("[진단] 수신거부 상태 " + found + "명 — 복구대상=true 만 다음 발송부터 재개된다");
}

// 일일 메일에 '상세 브리핑'이 안 붙을 때 30초 진단(읽기 전용).
//
// marketBody_()가 ""를 돌려주는 원인은 셋 중 하나인데 눈으로는 구분이 안 된다.
//   (a) 시장-본문 탭에 행 자체가 없다        → 텔레그램쪽 쓰기 문제
//   (b) 행은 있는데 오늘 날짜가 없다          → 그날 파이프가 안 돌았거나 no-op
//   (c) 오늘 행은 있는데 시간대가 '장전'이 아님 → 읽기 필터 문제
// 이름에 밑줄을 붙이지 말 것 — Apps Script는 _로 끝나는 함수를 실행 드롭다운에서 숨긴다.
function checkMarketBody() {
  if (!CFG.MARKET_SHEET_ID) { Logger.log("[진단] CFG.MARKET_SHEET_ID 가 비어 있다 — 여기서 끝"); return; }
  var sh = SpreadsheetApp.openById(CFG.MARKET_SHEET_ID).getSheetByName(CFG.MARKET_BODY_TAB);
  if (!sh) { Logger.log("[진단] 탭 '" + CFG.MARKET_BODY_TAB + "' 없음 — 원인 확정"); return; }

  var values = sh.getDataRange().getValues();
  var H = (values[0] || []).map(function (h) { return String(h).trim(); });
  Logger.log("[진단] 탭 OK · 헤더=[" + H.join(" | ") + "] · 데이터 " + Math.max(0, values.length - 1) + "행");

  var iDt = H.indexOf("날짜"), iPd = H.indexOf("시간대"), iBd = H.indexOf("본문");
  if (iBd < 0) { Logger.log("[진단] '본문' 열이 없다 — marketBody_ 가 즉시 \"\" 반환. 원인 확정"); return; }

  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  Logger.log("[진단] 오늘(KST)=" + today);

  // 최근 것부터 12행 — 날짜·시간대 값이 기대와 같은지, 본문에 내용이 있는지 본다.
  var shown = 0, todayRows = 0;
  for (var r = values.length - 1; r >= 1 && shown < 12; r--) {
    var c = values[r];
    var d = ymd_(c[iDt]), p = iPd < 0 ? "(열없음)" : String(c[iPd] || "").trim();
    var n = String(c[iBd] || "").length;
    if (d === today) todayRows++;
    Logger.log("[진단] " + r + "행 | 날짜='" + d + "' | 시간대='" + p + "' | 본문 " + n + "자"
      + (d === today && p === "장전" ? "  <-- marketBody_ 가 집는 행" : ""));
    shown++;
  }
  Logger.log("[진단] 오늘 날짜 행 " + todayRows + "개");

  var body = marketBody_();
  Logger.log("[진단] marketBody_() 반환 " + body.length + "자"
    + (body ? " — 정상. 메일에 상세 브리핑이 붙어야 한다" : " — 비어 있음(위 표에서 원인 확인)"));
  if (body) Logger.log("[진단] 앞 120자: " + body.slice(0, 120).replace(/\n/g, " "));
}

// 수신거부(모든 pref 시트 상태=수신거부)한 이메일 집합.
function unsubSet_() {
  var set = {};
  CATS.forEach(function (c) {
    var m = prefMap_(c.prefSheet);
    Object.keys(m).forEach(function (em) { if (m[em].status === "수신거부") set[em] = 1; });
  });
  return set;
}
function sendDailyMarket() {
  var dg = dailyGroups_();
  if (!dg.groups.length) { Logger.log("[일일] " + dg.today + " 시장-일일 행 없음 — 발송 생략"); return; }

  var rt = tableOf_(CFG.RESP_SHEET);
  var iE = idx_(rt.header, CFG.RESP_COL.email), iC = idx_(rt.header, CFG.RESP_COL.consent);
  if (iE < 0 || iC < 0) throw new Error("응답 시트 컬럼 확인: '" + CFG.RESP_COL.email + "' / '" + CFG.RESP_COL.consent + "'");
  syncResubscribes_();          // 재신청자를 먼저 '구독'으로 되돌린 뒤 차단 목록을 만든다
  var unsub = unsubSet_();
  var subject = CFG.DAILY_SUBJECT + " " + dg.today;
  var detail = marketBody_();   // 그날 장전 상세 요약(있으면 메일 하단에 첨부)
  var quotes = quotes_();       // 주요 시장 지표(실패·낡음이면 null → 블록만 생략)

  // 대상을 먼저 확정한다 — 한도를 보려면 몇 명인지 알아야 한다.
  var targets = [], skipped = 0, seen = {};
  for (var i = 0; i < rt.rows.length; i++) {
    var cells = rt.rows[i].cells;
    var email = String(cells[iE] || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0) { skipped++; continue; }
    if (seen[email]) continue; seen[email] = 1;
    if (!consented_(cells[iC]) || unsub[email]) { skipped++; continue; }
    targets.push(email);
  }
  // 일일만 하드 차단이다. 주간·스페셜은 발송로그가 있어 부분 발송 후 이어서 보낼 수 있지만,
  // 일일은 수신자별 로그가 없어 절반만 나가면 누가 받았는지 알 수 없다 — 재발송도 못 한다.
  if (!CFG.TEST_MODE && !mailQuotaOk_(targets.length, "일일 시황")) return;

  var sent = 0, failed = 0;
  for (var n = 0; n < targets.length; n++) {
    var to = targets[n], recipient = CFG.TEST_MODE ? CFG.OPERATOR_EMAIL : to;
    try {
      sendMail_(recipient, subject, dailyPlain_(dg, detail, quotes), dailyHtml_(to, dg, detail, quotes));
      sent++;
      if (CFG.TEST_MODE) break;
    } catch (e) { failed++; Logger.log("[ERROR] " + to + " → " + e); }
  }
  Logger.log((CFG.TEST_MODE ? "[TEST] " : "") + "[일일 " + dg.today + "] 발송 " + sent + " · 건너뜀 " + skipped + " · 실패 " + failed);
}
// ── 일일 발송 시각 (관리자 콘솔 settings.daily_send_time) ──────────────────────
// 서머타임 등으로 적정 시각이 바뀌므로 코드가 아니라 설정으로 둔다.
// ⚠️ Apps Script 시간 트리거는 지정 시각 ±15분 오차가 있다(정확한 시각 지정 불가).
//    KRX 장전 단일가(08:30) 전 도착이 목적이면 그만큼 여유를 두고 지정할 것.
var DAILY_TIME_PROP = "daily_send_time_applied";   // 마지막으로 트리거에 반영한 값

// BSL_market의 settings 탭에서 key 조회. 미설정·오류는 null(호출부가 기본값 폴백).
function marketSetting_(key) {
  if (!CFG.MARKET_SHEET_ID) return null;
  try {
    var sh = SpreadsheetApp.openById(CFG.MARKET_SHEET_ID).getSheetByName(CFG.SETTINGS_TAB);
    if (!sh || sh.getLastRow() < 2) return null;
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) return String(data[i][1]).trim();
    }
  } catch (e) {
    Logger.log("[설정] " + key + " 조회 실패(기본값 사용): " + e);
  }
  return null;
}
// "HH:MM" → {h, m, label}. 미설정·형식 오류는 CFG.DAILY_SEND_TIME으로 폴백(fail-open).
function dailySendTime_() {
  var raw = marketSetting_("daily_send_time") || CFG.DAILY_SEND_TIME;
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(raw).trim());
  var h = m ? Number(m[1]) : -1, mi = m ? Number(m[2]) : -1;
  if (!(h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) {
    Logger.log("[설정] daily_send_time 형식 오류('" + raw + "') → 기본값 " + CFG.DAILY_SEND_TIME);
    m = /^(\d{1,2}):(\d{2})$/.exec(CFG.DAILY_SEND_TIME);
    h = Number(m[1]); mi = Number(m[2]);
  }
  return { h: h, m: mi, label: ("0" + h).slice(-2) + ":" + ("0" + mi).slice(-2) };
}
// 설정 시각으로 발송 트리거 재생성. 여러 번 실행해도 트리거는 항상 1개(멱등).
function applyDailySchedule() {
  var t = dailySendTime_();
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === "sendDailyMarket") ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger("sendDailyMarket").timeBased()
    .atHour(t.h).nearMinute(t.m).everyDays(1).inTimezone("Asia/Seoul").create();
  PropertiesService.getScriptProperties().setProperty(DAILY_TIME_PROP, t.label);
  Logger.log("일일 트리거 적용: 매일 " + t.label + " KST sendDailyMarket (±15분)");
  return t.label;
}
// 매일 새벽 실행. 콘솔에서 시각을 바꾸면 다음 날부터 자동 반영된다.
function syncDailySchedule() {
  var want = dailySendTime_().label;
  var applied = PropertiesService.getScriptProperties().getProperty(DAILY_TIME_PROP);
  var live = ScriptApp.getProjectTriggers().some(function (tr) {
    return tr.getHandlerFunction() === "sendDailyMarket";
  });
  if (applied === want && live) return;
  Logger.log("[일일] 발송 시각 " + (applied || "미기록") + " → " + want + (live ? "" : " (트리거 없음)"));
  applyDailySchedule();
}
// 설치 1회: 발송 트리거 + 새벽 03:00 동기화 트리거.
function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === "syncDailySchedule") ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger("syncDailySchedule").timeBased()
    .atHour(3).nearMinute(0).everyDays(1).inTimezone("Asia/Seoul").create();
  return applyDailySchedule();
}
// ── 주요 시장 지표 (quotes.json) ────────────────────────────────────────────
// 표시 문자열은 fetch_dashboard.py가 이미 만들어 둔다. 메일러는 읽어 그리기만 한다
// (메일러는 수동 붙여넣기 배포라 티커·라벨·포맷 변경이 여기 닿지 않게 함).
// 실패·낡음은 전부 블록 생략으로 처리 — 지표 하나 때문에 브리핑이 안 나가면 안 된다.
var QUOTES_PATH = "assets/data/quotes.json";  // CFG.BASE 기준 상대 경로(fetch_dashboard.py가 생성)
var QUOTES_STALE_DAYS = 5;                    // asof가 이보다 오래면 블록만 생략(연휴 3~4일은 통과)

function quotes_() {
  try {
    // GitHub Pages는 최대 10분 캐시한다. 발송 직전에는 고유 쿼리로 최신 배포본을 강제 조회한다.
    var res = UrlFetchApp.fetch(CFG.BASE + QUOTES_PATH + "?v=" + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) {
      Logger.log("[지표] HTTP " + res.getResponseCode() + " — 블록 생략");
      return null;
    }
    var q = JSON.parse(res.getContentText());
    if (!q || !q.rows || !q.rows.length || !q.asof) {
      Logger.log("[지표] 빈 스냅샷 — 블록 생략");
      return null;
    }
    var todayKst = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
    if (!q.briefing_date || q.briefing_date !== todayKst) {
      Logger.log("[지표] 브리핑일 " + (q.briefing_date || "없음") + " ≠ " + todayKst + " — 전일 데이터 차단");
      return null;
    }
    // asof는 '어느 장의 숫자인가'다. 월요일 아침에 금요일 마감이 찍히는 건 정상이므로
    // 발송일과 다르다는 이유로 막지 않고, 연휴를 넘는 공백(파이프 고장)만 막는다.
    var days = Math.floor((new Date().getTime() - new Date(q.asof + "T00:00:00Z").getTime()) / 86400000);
    if (isNaN(days) || days > QUOTES_STALE_DAYS) {
      Logger.log("[지표] asof " + q.asof + " (" + days + "일 전) — 낡아서 블록 생략");
      return null;
    }
    return q;
  } catch (e) {
    Logger.log("[지표] 조회 실패 — 블록 생략: " + e);
    return null;
  }
}
function quoteCell_(r) {
  if (!r) return '<td width="50%"></td>';
  var color = r.dir > 0 ? C.success : (r.dir < 0 ? C.danger : C.muted);
  return '<td width="50%" style="padding:3px 0;font-size:12px;color:' + C.muted + ';white-space:nowrap">' +
    esc_(r.label) + ' <span style="color:' + C.text + ';font-weight:600">' + esc_(r.value) + "</span> " +
    '<span style="color:' + color + '">' + esc_(r.change) + "</span></td>";
}
function quotesHtml_(q) {
  if (!q) return "";
  var rows = "";
  for (var i = 0; i < q.rows.length; i += 2) {
    rows += "<tr>" + quoteCell_(q.rows[i]) + quoteCell_(q.rows[i + 1]) + "</tr>";
  }
  var basis = q.briefing_date
    ? esc_(q.briefing_date.slice(5)) + " 아침 기준 · 미 증시 " + esc_(q.asof.slice(5)) + " 마감"
    : "미 증시 " + esc_(q.asof.slice(5)) + " 마감 기준";
  return '<div style="margin:0 0 16px">' +
    '<div style="font-size:12px;color:' + C.muted + ';margin:0 0 6px">주요 시장 지표 · ' +
      basis + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + rows + "</table>" +
    '<div style="border-top:1px solid ' + C.border + ';margin:14px 0 0"></div></div>';
}
function quotesPlain_(q) {
  if (!q) return [];
  var basis = q.briefing_date
    ? q.briefing_date.slice(5) + " 아침 기준 · 미 증시 " + q.asof.slice(5) + " 마감"
    : "미 증시 " + q.asof.slice(5) + " 마감 기준";
  return ["[주요 시장 지표 · " + basis + "]"]
    .concat(q.rows.map(function (r) { return "- " + r.label + " " + r.value + " " + r.change; }))
    .concat([""]);
}

function dailyHtml_(email, dg, detail, quotes) {
  var tok = token_(email);
  var body = dg.groups.map(function (g) {
    var sigs = g.items.map(function (o) {
      var srcLink = /^https?:\/\//i.test(o.src) ? ' <a href="' + o.src + '" style="color:' + C.primary + ';text-decoration:none">출처</a>' : "";
      return '<tr><td style="padding:8px 0;border-top:1px solid ' + C.border + '"><div style="font-size:14px;font-weight:600;color:' + C.text + '">' + esc_(o.title) + "</div>" +
        '<div style="font-size:13px;color:' + C.muted + ';margin-top:2px">' + esc_(o.line) + srcLink + "</div></td></tr>";
    }).join("");
    var head = g.label ? '<div style="font-size:13px;font-weight:700;color:' + C.text + ';border-left:3px solid ' + C.primary + ';padding-left:8px;margin:4px 0 8px">' + esc_(g.label) + " 시황</div>" : "";
    return '<div style="margin:0 0 16px">' + head + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + sigs + "</table></div>";
  }).join("");
  var unsubLink = CFG.WEBAPP_URL ? link_(tok, "unsubscribe", "", "", "수신거부") : '<a href="mailto:' + CFG.OPERATOR_EMAIL + '?subject=' + encodeURIComponent("브리핑 수신거부") + '" style="color:' + C.muted + '">수신거부</a>';

  return [
    '<div style="margin:0;padding:0;background:' + C.canvas + '">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.canvas + '"><tr><td align="center" style="padding:24px 12px">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:' + C.surface + ';border:1px solid ' + C.border + ';border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:' + C.text + '">',
    '<tr><td style="padding:20px 24px;border-bottom:1px solid ' + C.border + '">',
      '<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:' + C.primary + '">BRIEFING SIGNAL LAB · ' + esc_(dg.today) + " 장전</div>",
      '<div style="font-size:20px;font-weight:700;margin-top:4px">일일 시황</div>',
    "</td></tr>",
    '<tr><td style="padding:20px 24px">', quotesHtml_(quotes), body, renderBody_(detail),
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 4px"><tr><td style="border-radius:8px;background:' + C.primary + '">',
        '<a href="' + CFG.BASE + 'market.html" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#fff;text-decoration:none">시장 탭에서 전체 보기 →</a>',
      "</td></tr></table>",
    "</td></tr>",
    '<tr><td style="padding:16px 24px;border-top:1px solid ' + C.border + ';font-size:12px;color:' + C.muted + ';line-height:1.6">',
      "AI 자동 생성 · 정보 제공이지 투자 조언이 아닙니다. 종목·자산은 공개 출처 기반 관찰로만 명시하며 매수·매도·목표가를 권유하지 않습니다.<br>",
      '<a href="' + CFG.BASE + '" style="color:' + C.muted + '">Briefing Signal Lab</a> &nbsp;·&nbsp; ' + unsubLink,
    "</td></tr>",
    "</table></td></tr></table></div>",
  ].join("");
}
function dailyPlain_(dg, detail, quotes) {
  var lines = ["일일 시황 (" + dg.today + " 장전)", ""].concat(quotesPlain_(quotes));
  dg.groups.forEach(function (g) {
    if (g.label) lines.push("[" + g.label + "]");
    g.items.forEach(function (o) { lines.push("- " + o.title + " : " + o.line); });
    lines.push("");
  });
  if (detail && detail.trim()) {
    lines.push("── 상세 브리핑 ──", "", detail.trim(), "");
  }
  lines.push("시장 탭: " + CFG.BASE + "market.html", "AI 자동 생성 · 정보 제공, 투자 조언 아님.");
  return lines.join("\n");
}

// ===== GitHub Actions 고정시각 호출(월요일 09:00 KST) =====
function doPost(e) {
  var expected = PropertiesService.getScriptProperties().getProperty("WEEKLY_CRON_TOKEN") || "";
  var data = {};
  try { data = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {}
  if (!expected || String(data.token || "") !== expected) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" })).setMimeType(ContentService.MimeType.JSON);
  }
  var action = String(data.action || "");
  if (action === "send_weekly") {
    sendWeekly();
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }
  // 스페셜 리포트 미리보기. 구독자 발송은 오직 sendSpecialDue() 폴링 경로 하나이고,
  // 이건 운영자 본인에게 1통 보내 실제 Gmail 렌더링을 눈으로 보는 용도다.
  //
  // ⚠️ 수신자를 요청 본문에서 받지 않는다. CFG.OPERATOR_EMAIL 로 코드에 고정돼 있어
  //    이 경로로는 구독자에게 보낼 수 없다 — 토큰이 새더라도 남의 메일함에 닿지 않는다.
  if (action === "send_special_test") {
    try {
      var result = sendSpecialTest(String(data.libId || ""), String(data.lead || ""), String(data.subject || ""));
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err).slice(0, 300) })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unknown_action" })).setMimeType(ContentService.MimeType.JSON);
}

/** 운영자에게만 1통. 발송로그에 남기지 않는다 — 테스트가 실제 발송을 막으면 안 된다.
 *  이름 끝에 _ 를 붙이지 말 것: Apps Script 는 _ 로 끝나는 함수를 숨겨 실행 드롭다운에
 *  나오지 않는다(운영자가 편집기에서 직접 돌려볼 수 있어야 한다). */
function sendSpecialTest(libId, lead, subject) {
  var lib = specialTable_(SPECIAL_LIBRARY_TAB).rows.filter(function (r) {
    return String(r["id"] || "").trim() === String(libId || "").trim();
  })[0];
  if (!lib) throw new Error("서재 id 를 찾지 못했습니다: " + libId);
  var to = CFG.OPERATOR_EMAIL;                       // 고정 — 인자로 받지 않는다
  var subj = String(subject || "").trim() || ("[스페셜 리포트] " + String(lib["제목"] || ""));
  sendMail_(to, "[테스트] " + subj, specialPlain_(lib, lead), specialHtml_(to, lib, lead));
  return { ok: true, to: to, subject: subj };
}

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
