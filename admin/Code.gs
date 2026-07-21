/**
 * Briefing Signal Lab — 운영자 관리자 콘솔 (Apps Script, standalone).
 * 흩어진 운영 수작업(주간 초안 승인·서재 업로드·방문 통계·대시보드 수동 카드·파이프 토글)을
 * 인증된 콘솔 하나로 수렴한다. 공개 사이트와 독립(별도 URL). 상세: docs/admin-console-plan.md.
 *
 * 인증 = 배포 시 "액세스: 나만(only myself)". Google 로그인이 곧 인증(TOKEN 불필요).
 *   선택적 이중 확인: 스크립트 속성 ADMIN_EMAILS(콤마구분)에 허용 계정을 넣으면 대조.
 *
 * 설치:
 *  1) script.google.com → 새 프로젝트(예: BSL_admin) → 이 파일(Code.gs) + index.html 추가
 *  2) 프로젝트 설정(톱니) → 스크립트 속성:
 *       MARKET_ID    = BSL_market 스프레드시트 ID (주간-초안·서재·대시보드-수동·settings 탭)
 *       ANALYTICS_ID = BSL_analytics 스프레드시트 ID (방문로그 탭)
 *       ADMIN_EMAILS = 본인 gmail (선택, 비우면 배포 "액세스: 나만"에만 의존)
 *  3) 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나, 액세스: 나만(only myself) → URL 북마크
 *
 * 시트ID·비밀은 스크립트 속성으로만(하드코딩 금지).
 */

// ───────────────────────── 탭 이름 ─────────────────────────
var WEEKLY_TAB   = '주간-초안';        // 분야·발행주·유형·제목ko·제목en·한줄ko·한줄en·밸류체인·출처URL·선행도·status
var LIBRARY_TAB  = '서재';             // id·유형·분류·발행일·제목·요약·태그·본문·access
var VISIT_TAB    = '방문로그';          // 날짜시각·페이지·referrer·방문자ID  (BSL_analytics)
var DASH_TAB     = '대시보드-수동';      // 카드키·라벨·단위·주기·출처·시각·값 (신설)
var SETTINGS_TAB = 'settings';         // key·value (없으면 자동 생성)

// ───────────────────────── config / auth ─────────────────────────
function _prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function _openMarket_() {
  var id = _prop_('MARKET_ID');
  if (!id) throw new Error('스크립트 속성 MARKET_ID 없음');
  return SpreadsheetApp.openById(id);
}
function _openAnalytics_() {
  var id = _prop_('ANALYTICS_ID');
  if (!id) throw new Error('스크립트 속성 ANALYTICS_ID 없음');
  return SpreadsheetApp.openById(id);
}

/** 로그인 계정 반환. ADMIN_EMAILS가 설정돼 있으면 대조(불일치 시 throw). */
function _assertAuth_() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  var allow = (_prop_('ADMIN_EMAILS') || '').split(',')
    .map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  if (allow.length && allow.indexOf(email) < 0) {
    throw new Error('권한 없음: ' + (email || '(로그인 계정 확인 불가)'));
  }
  return email;
}

// HtmlService 콘솔 서빙
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('BSL 운영자 콘솔')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSession() {
  var email = _assertAuth_();
  return { email: email, hasAllowlist: !!(_prop_('ADMIN_EMAILS') || '') };
}

// ───────────────────────── 시트 헬퍼 ─────────────────────────
function _norm_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  return v;
}

/** 탭 → { header:[...], rows:[{_row, <헤더>:값, ...}, ...] }. Date는 KST yyyy-MM-dd 문자열로. */
function _readTab_(ss, tabName) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error('탭 없음: ' + tabName + ' (시트에 먼저 생성하세요)');
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var header = lastCol
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];
  var rows = [];
  if (lastRow > 1 && lastCol) {
    var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < data.length; i++) {
      var obj = { _row: i + 2 };
      for (var c = 0; c < header.length; c++) { obj[header[c]] = _norm_(data[i][c]); }
      rows.push(obj);
    }
  }
  return { header: header, rows: rows };
}

function _colIndex_(sh, name) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var idx = header.indexOf(name);
  if (idx < 0) throw new Error('열 없음: ' + name);
  return idx + 1;
}

/** 하단부터 삭제해 인덱스 무결성 유지. */
function _deleteRows_(sh, rows) {
  (rows || []).slice().sort(function (a, b) { return b - a; })
    .forEach(function (r) { if (r >= 2) sh.deleteRow(r); });
  return (rows || []).length;
}

function _appendByHeader_(sh, item) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  sh.appendRow(header.map(function (h) { return item[h] != null ? item[h] : ''; }));
}

// ───────────────────────── ① 주간 초안 승인 ─────────────────────────
function weeklyList() {
  _assertAuth_();
  return _readTab_(_openMarket_(), WEEKLY_TAB);
}
function weeklySetStatus(row, status) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(WEEKLY_TAB);
  sh.getRange(row, _colIndex_(sh, 'status')).setValue(status);
  return { ok: true };
}
function weeklySetType(row, type) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(WEEKLY_TAB);
  sh.getRange(row, _colIndex_(sh, '유형')).setValue(type);
  return { ok: true };
}
function weeklyDeleteRows(rows) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(WEEKLY_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

// ───────────────────────── ③ 서재 업로드 ─────────────────────────
function libraryList() {
  _assertAuth_();
  return _readTab_(_openMarket_(), LIBRARY_TAB);
}
/** item = { id, 유형, 분류, 발행일, 제목, 요약, 태그, 본문, access } */
function libraryAdd(item) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(LIBRARY_TAB);
  if (!sh) throw new Error('탭 없음: ' + LIBRARY_TAB);
  if (!item || !String(item['id'] || '').trim() || !String(item['제목'] || '').trim()) {
    throw new Error('id와 제목은 필수입니다');
  }
  _appendByHeader_(sh, item);
  return { ok: true };
}
/** 기존 행 수정. item에 있는 열만 덮어쓰고 나머지 열은 보존. */
function libraryUpdate(row, item) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(LIBRARY_TAB);
  if (!sh) throw new Error('탭 없음: ' + LIBRARY_TAB);
  if (!item || !String(item['id'] || '').trim() || !String(item['제목'] || '').trim()) {
    throw new Error('id와 제목은 필수입니다');
  }
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var existing = sh.getRange(row, 1, 1, header.length).getValues()[0];
  var values = header.map(function (h, i) {
    return (item.hasOwnProperty(h) && item[h] != null) ? item[h] : existing[i];
  });
  sh.getRange(row, 1, 1, header.length).setValues([values]);
  return { ok: true };
}
function libraryDeleteRows(rows) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(LIBRARY_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

// ───────────────────────── ④ 방문 통계 ─────────────────────────
function visitStats() {
  _assertAuth_();
  var sh = _openAnalytics_().getSheetByName(VISIT_TAB);
  if (!sh) throw new Error('탭 없음: ' + VISIT_TAB);
  var out = { views: 0, visitors: 0, byDate: [], byPage: [], testRows: [] };
  var last = sh.getLastRow();
  if (last <= 1) return out;
  var data = sh.getRange(2, 1, last - 1, 4).getValues();  // 날짜시각·페이지·referrer·방문자ID
  var seen = {}, dateMap = {}, pageMap = {};
  for (var i = 0; i < data.length; i++) {
    var ts = String(_norm_(data[i][0]) || ''), page = String(data[i][1] || ''), id = String(data[i][3] || '');
    out.views++;
    if (id) seen[id] = 1;
    var d = ts.slice(0, 10);
    if (d) dateMap[d] = (dateMap[d] || 0) + 1;
    if (page) pageMap[page] = (pageMap[page] || 0) + 1;
    if (page.indexOf('beacon-test') >= 0) out.testRows.push(i + 2);
  }
  out.visitors = Object.keys(seen).length;
  out.byDate = Object.keys(dateMap).sort().map(function (k) { return { date: k, count: dateMap[k] }; });
  out.byPage = Object.keys(pageMap).sort(function (a, b) { return pageMap[b] - pageMap[a]; })
    .map(function (k) { return { page: k, count: pageMap[k] }; });
  return out;
}
function visitDeleteRows(rows) {
  _assertAuth_();
  var sh = _openAnalytics_().getSheetByName(VISIT_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

// ───────────────────────── ② 대시보드 수동 카드 ─────────────────────────
// 시트 = 데이터 점 1개당 1행(카드키로 그룹, 행 순서 = 시계열 순서).
// fetch_dashboard.py가 이 탭 CSV를 읽어 valuechain_manual.json 재생성(dashboard.js 무변경).
function dashList() {
  _assertAuth_();
  return _readTab_(_openMarket_(), DASH_TAB);
}
/** point = { 카드키, 라벨, 단위, 주기, 출처, 시각, 값 } */
function dashAdd(point) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(DASH_TAB);
  if (!sh) throw new Error('탭 없음: ' + DASH_TAB + ' (헤더: 카드키·라벨·단위·주기·출처·시각·값)');
  if (!point || !String(point['카드키'] || '').trim() || String(point['값'] || '') === '') {
    throw new Error('카드키와 값은 필수입니다');
  }
  _appendByHeader_(sh, point);
  return { ok: true };
}
function dashDeleteRows(rows) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(DASH_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

// ───────────────────────── 파이프라인 토글 (settings) ─────────────────────────
function _settingsSheet_() {
  var ss = _openMarket_();
  var sh = ss.getSheetByName(SETTINGS_TAB);
  if (!sh) { sh = ss.insertSheet(SETTINGS_TAB); sh.appendRow(['key', 'value']); }
  return sh;
}
function _getSetting_(key) {
  var sh = _settingsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var data = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) return String(data[i][1]).trim();
  }
  return null;
}
function _setSetting_(key, value) {
  var sh = _settingsSheet_();
  var last = sh.getLastRow();
  var keys = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) { sh.getRange(i + 2, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}
// 미설정 = 활성(fail-open). '0'일 때만 중지. Python 파이프도 동일 규칙(scripts/lib/toggle.py).
function getPipelineEnabled() { _assertAuth_(); return _getSetting_('pipeline_enabled') !== '0'; }
function setPipelineEnabled(on) {
  _assertAuth_();
  _setSetting_('pipeline_enabled', on ? '1' : '0');
  return { ok: true, enabled: !!on };
}
