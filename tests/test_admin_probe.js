// checkAdminProps 의 MAILER_URL 연결 확인 — 응답을 자른 뒤 검사하지 않는지 잠근다.
// 배경(2026-08-27): probe 응답을 slice(0, 400) 한 뒤 마커를 찾고 있었다. Apps Script
// HtmlService 출력은 Google 샌드박스 셸이 앞에 7천 자 넘게 붙어 실제 내용이 그 뒤에 오므로,
// URL 이 정확해도 이 분기는 구조적으로 항상 ⚠️ 를 냈다. 진짜 고장(2주간 unauthorized)은
// 아무 경고도 안 냈는데 멀쩡한 URL 이 경고를 내던 상태였다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// 실제 응답 모양: 샌드박스 셸 → 한참 뒤 본문. 마커를 400자 밖에 둔다.
const SHELL = '<!doctype html><html><head><script nonce="x">window[\'ppConfig\'] = {productName: \'' + 'a'.repeat(600) + '\'};</script></head><body>';
const MAILER_BODY = SHELL + '<div>BRIEFING SIGNAL LAB</div><p>잘못된 요청입니다.</p></body></html>';
const MARKET_BODY = '{"ok":false,"error":"tab not found","app":"market-webapp"}';

function run(bodyText, props) {
  const logs = [];
  const store = Object.assign({ MARKET_ID: 'm', ANALYTICS_ID: 'a', MAILER_TOKEN: 't'.repeat(40) }, props);
  const c = vm.createContext({
    console,
    Logger: { log: (m) => logs.push(String(m)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in store ? store[k] : null),
        getKeys: () => Object.keys(store),
      }),
    },
    UrlFetchApp: {
      fetch: () => ({ getResponseCode: () => 200, getContentText: () => bodyText }),
    },
  });
  vm.runInContext(fs.readFileSync('admin/Code.gs', 'utf8'), c);
  vm.runInContext('checkAdminProps()', c);
  return logs.join('\n');
}

const URL_OK = 'https://script.google.com/macros/s/AKfycb' + 'x'.repeat(60) + '/exec';

// ── 핵심 회귀: 마커가 400자 뒤에 있어도 찾아야 한다 ──
assert(MAILER_BODY.indexOf('BRIEFING SIGNAL LAB') > 400, '테스트 전제: 마커가 400자 밖');
let out = run(MAILER_BODY, { MAILER_URL: URL_OK });
assert(out.includes('✅ MAILER_URL 이 메일러 웹앱에 연결됩니다'), '정상 URL 인데 ✅ 가 안 나옴:\n' + out);
assert(!out.includes('⚠️ 응답이 메일러 같지 않습니다'), '정상 URL 에 오탐이 뜨면 안 된다');

// ── 잘못된 웹앱은 여전히 잡아야 한다 ──
out = run(MARKET_BODY, { MAILER_URL: URL_OK });
assert(out.includes('"시장" 웹앱을 가리킵니다'), '시장 웹앱 오지정을 못 잡음:\n' + out);

// ── 정체불명 응답은 경고 + 앞 120자 ──
out = run('<html>' + 'z'.repeat(2000) + '</html>', { MAILER_URL: URL_OK });
assert(out.includes('⚠️ 응답이 메일러 같지 않습니다'), '알 수 없는 응답은 경고해야 함');
assert(!/z{130}/.test(out), '로그는 120자까지만 — 전문을 쏟지 않는다');

// ── /exec 가 아니면 연결 확인 전에 형식으로 거른다 ──
out = run(MAILER_BODY, { MAILER_URL: 'https://script.google.com/macros/s/AKfycbx/dev' });
assert(out.includes('/exec 로 끝나지 않습니다'), '/dev URL 은 형식 단계에서 잡아야 함');

// ── 토큰 값은 절대 찍지 않는다(실행 기록에 평문으로 남는다) ──
out = run(MAILER_BODY, { MAILER_URL: URL_OK });
assert(!out.includes('t'.repeat(40)), '토큰 값이 로그에 노출됨');
assert(out.includes('MAILER_TOKEN : 설정됨 (40자)'), '자릿수만 찍어야 함');

// ── 구조 잠금: 자른 값으로 판정하지 않는다 ──
const src = fs.readFileSync('admin/Code.gs', 'utf8');
assert(!/slice\(0,\s*400\)/.test(src), 'slice(0, 400) 로 자른 뒤 검사하면 안 된다(항상 ⚠️ 가 된다)');
assert(/var body = probe\.getContentText\(\);/.test(src), '판정은 응답 전문으로');

console.log('admin probe tests: OK');
