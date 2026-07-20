/**
 * Briefing Signal Lab — 방문 기록 웹앱 (Apps Script).
 * 사이트 script.js의 이미지 비콘(GET)이 방문 1건을 '방문로그' 탭에 append 한다.
 * 쿠키/PII 없음: 저장값 = KST 날짜시각 · 페이지 · referrer · 익명 방문자ID.
 *
 * '방문로그' 탭 첫 행(헤더):  날짜시각 · 페이지 · referrer · 방문자ID
 *
 * 설치:
 *  1) 새 구글 시트(예: BSL_analytics) 또는 script가 없는 시트 → 확장 → Apps Script → 이 코드 붙여넣기
 *     (BSL_market은 이미 market/Code.gs가 bound돼 있어 별도 시트 권장)
 *  2) 시트에 '방문로그' 탭 만들고 위 헤더 입력
 *  3) 배포 → 새 배포 → 웹 앱 → 실행: 나, 액세스: 모든 사용자 → URL 복사
 *  4) 그 URL을 site.js의 VISITS_WEBAPP_URL 에 입력 → 커밋·푸시
 *
 * 순방문(대략): '방문자ID' 열의 고유값 개수. 페이지뷰: 행 수. (피벗/COUNTUNIQUE로 집계)
 * 주의: 토큰 없는 공개 GET이라 이론상 스팸 가능(소규모 사이트엔 무해). 트래픽 커지면 GoatCounter 등으로 이전.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};

  // (1) 카운트 조회: ?count=1[&callback=fn] → JSONP fn({views,visitors}) 또는 JSON. (사이트 푸터 카운터용)
  if (p.count) {
    var out = { views: 0, visitors: 0 };
    try {
      var shc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('방문로그');
      if (shc) {
        var last = shc.getLastRow();
        out.views = Math.max(0, last - 1);            // 헤더 제외 = 페이지뷰
        if (last > 1) {
          var ids = shc.getRange(2, 4, last - 1, 1).getValues();  // D열 방문자ID
          var seen = {};
          for (var i = 0; i < ids.length; i++) { if (ids[i][0]) seen[ids[i][0]] = 1; }
          out.visitors = Object.keys(seen).length;    // 고유 방문자
        }
      }
    } catch (errc) { /* 무시 */ }
    var body = p.callback ? (p.callback + "(" + JSON.stringify(out) + ")") : JSON.stringify(out);
    return ContentService.createTextOutput(body)
      .setMimeType(p.callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  // (2) 방문 기록(비콘): ?p=페이지&r=referrer&id=방문자ID → '방문로그' append.
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('방문로그');
    if (sh && p.p) {
      var kst = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      sh.appendRow([kst, String(p.p).slice(0, 200), String(p.r || '').slice(0, 200), String(p.id || '').slice(0, 60)]);
    }
  } catch (err) { /* 비콘은 조용히 실패 */ }
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}
