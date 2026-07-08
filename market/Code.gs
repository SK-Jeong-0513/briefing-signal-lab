/**
 * Briefing Signal Lab — 시장 탭 쓰기 웹앱 (Apps Script, "시장" 구글 시트에 bound).
 * fetch_market.py(종목) / Telegram 파이프(일일)가 POST하면 지정 탭에 행을 append 한다.
 * 헤더 행을 읽어 열 순서에 맞춰 매핑하므로, 어떤 탭이든(시장-종목/시장-일일) 동작한다.
 *
 * 설치:
 *  1) "시장" 구글 시트 → 확장 프로그램 → Apps Script → 이 코드 전체 붙여넣기
 *  2) 프로젝트 설정(톱니) → 스크립트 속성 → 속성 추가: TOKEN = <임의 시크릿 문자열>
 *  3) 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나, 액세스 권한: 모든 사용자 → 배포 → URL 복사
 *  4) GitHub repo Secrets(Actions): MARKET_WEBAPP_URL = URL, MARKET_WEBAPP_TOKEN = TOKEN
 *
 * POST body(JSON): { "token": "...", "tab": "시장-종목", "rows": [ {헤더:값, ...}, ... ] }
 * 응답: { "ok": true, "added": N }
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (token && body.token !== token) {
      return _json({ ok: false, error: 'unauthorized' });
    }
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(body.tab);
    if (!sh) return _json({ ok: false, error: 'tab not found: ' + body.tab });
    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    var added = 0;
    (body.rows || []).forEach(function (row) {
      sh.appendRow(header.map(function (h) { return row[h] != null ? row[h] : ''; }));
      added++;
    });
    return _json({ ok: true, added: added });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function doGet() { return _json({ ok: true, service: 'market-webapp' }); }

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
