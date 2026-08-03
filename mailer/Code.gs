/**
 * Briefing Signal Lab — 주간 통합 브리핑 메일러 (Google Apps Script)
 * 3개 카테고리(기술/금융/경제)를 한 통에. 카테고리별 선호도 시트로 분야 필터.
 *   - RESP_SHEET(설문지 응답): 신원·동의 원천. 읽기 전용.
 *   - PREF: 관심분야(기술)/관심분야(금융)/관심분야(경제) — 구독 상태. 읽기/쓰기, 헤더 자동생성.
 *
 * [설치] 응답 시트에서 확장 프로그램→Apps Script→이 파일 붙여넣기(bound 아니면 CFG.SHEET_ID).
 *   CFG의 SALT·MARKET_SHEET_ID 확인 → 웹앱 재배포 → TEST_MODE 미리보기 → createWeeklyTriggers() 1회.
 * [발송] 화요일 20:00 sendWeekly(). 콘텐츠는 BSL_market 주간-발행/주간-발행항목 rev.1에서 읽는다.
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
      GmailApp.sendEmail(recipient, CFG.SUBJECT + " · " + bundle.issueKey, mailSafe_(plain_(perCat, kw)), { name: CFG.SENDER_NAME, htmlBody: mailSafe_(html_(email, kw, perCat)) });
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

function weeklyAlert_(label, addDays) {
  var issueKey = weeklyIsoIssue_(addDays || 0), bundle = weeklyLatestBundle_(issueKey);
  var msg = bundle ? bundle.issueKey + " 상태 " + bundle.ledgerRow.state + " · " + bundle.items.length + "건" : issueKey + " 발행 준비 원장 없음";
  GmailApp.sendEmail(CFG.OPERATOR_EMAIL, "[BSL 주간 승인 알림] " + label, msg + "\n관리자 콘솔에서 승인/발행 예약 상태를 확인하세요.");
}
function weeklyAlertSunday() { weeklyAlert_("일요일 09:00", 1); }
function weeklyAlertMonday() { weeklyAlert_("월요일 18:00", 0); }
function weeklyAlertTuesday() { weeklyAlert_("화요일 12:00", 0); }
function createWeeklyTriggers() {
  var names = ["weeklyAlertSunday","weeklyAlertMonday","weeklyAlertTuesday","sendWeekly"];
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (names.indexOf(tr.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("weeklyAlertSunday").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).nearMinute(0).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("weeklyAlertMonday").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(18).nearMinute(0).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("weeklyAlertTuesday").timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(12).nearMinute(0).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("sendWeekly").timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(20).nearMinute(0).inTimezone("Asia/Seoul").create();
  Logger.log("주간 알림 3개 + 화요일 20:00 발송 트리거 생성");
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
// 그날 시장-일일 행을 경제/금융/기술 순으로 그룹핑. 없으면 [].
function dailyGroups_() {
  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  var rows = marketRows_().filter(function (o) { return o.date === today && o.title; });
  var groups = [];
  CFG.DAILY_CATS.forEach(function (cat) {
    var items = rows.filter(function (o) { return o.cat === cat; });
    if (items.length) groups.push({ label: cat, items: items });
  });
  // 분류가 하나도 안 채워진 레거시 시트면 카테고리 없이 전체를 한 그룹으로.
  if (!groups.length && rows.length) groups.push({ label: "", items: rows });
  return { today: today, groups: groups };
}
// 그날 '장전' 상세 본문(텔레그램 요약, §6 마스킹됨). 없으면 "".
function marketBody_() {
  if (!CFG.MARKET_SHEET_ID) return "";
  var sh = SpreadsheetApp.openById(CFG.MARKET_SHEET_ID).getSheetByName(CFG.MARKET_BODY_TAB);
  if (!sh) return "";
  var values = sh.getDataRange().getValues();
  var H = (values[0] || []).map(function (h) { return String(h).trim(); });
  var iDt = H.indexOf("날짜"), iPd = H.indexOf("시간대"), iBd = H.indexOf("본문");
  if (iBd < 0) return "";
  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  var body = "";
  for (var r = 1; r < values.length; r++) {
    var c = values[r];
    if (ymd_(c[iDt]) === today && (iPd < 0 || String(c[iPd]).trim() === "장전")) {
      body = String(c[iBd] || "");  // 마지막(최신) 장전 본문
    }
  }
  return body;
}
function boldMd_(s) { return s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }
// 마크다운풍 상세 본문 → 이메일 HTML(헤더/볼드/줄바꿈).
function renderBody_(text) {
  if (!text || !text.trim()) return "";
  var lines = text.split(/\r?\n/).map(function (raw) {
    var line = raw.trim();
    if (!line || line === "---") return '<div style="height:6px"></div>';
    if (/^#{1,6}\s/.test(line)) {
      return '<div style="font-size:13px;font-weight:700;color:' + C.text + ';margin:14px 0 4px">' +
        boldMd_(esc_(line.replace(/^#{1,6}\s*/, ""))) + "</div>";
    }
    return '<div style="font-size:13px;color:' + C.text + ';line-height:1.6;margin:2px 0">' + boldMd_(esc_(line)) + "</div>";
  }).join("");
  return '<div style="margin-top:8px;padding-top:16px;border-top:1px solid ' + C.border + '">' +
    '<div style="font-size:13px;font-weight:700;color:' + C.text + ';border-left:3px solid ' + C.muted + ';padding-left:8px;margin:0 0 10px">상세 브리핑</div>' +
    lines + "</div>";
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
  if (!Object.keys(resp).length) return 0;
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

  var sent = 0, skipped = 0, failed = 0, seen = {};
  for (var i = 0; i < rt.rows.length; i++) {
    var cells = rt.rows[i].cells;
    var email = String(cells[iE] || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0) { skipped++; continue; }
    if (seen[email]) continue; seen[email] = 1;
    if (!consented_(cells[iC]) || unsub[email]) { skipped++; continue; }

    var recipient = CFG.TEST_MODE ? CFG.OPERATOR_EMAIL : email;
    try {
      GmailApp.sendEmail(recipient, subject, mailSafe_(dailyPlain_(dg, detail, quotes)), { name: CFG.SENDER_NAME, htmlBody: mailSafe_(dailyHtml_(email, dg, detail, quotes)) });
      sent++;
      if (CFG.TEST_MODE) break;
    } catch (e) { failed++; Logger.log("[ERROR] " + email + " → " + e); }
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

// ===== GitHub Actions 고정시각 호출(화요일 20:00 KST) =====
function doPost(e) {
  var expected = PropertiesService.getScriptProperties().getProperty("WEEKLY_CRON_TOKEN") || "";
  var data = {};
  try { data = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {}
  if (!expected || String(data.token || "") !== expected) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" })).setMimeType(ContentService.MimeType.JSON);
  }
  if (String(data.action || "") !== "send_weekly") {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unknown_action" })).setMimeType(ContentService.MimeType.JSON);
  }
  sendWeekly();
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
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
