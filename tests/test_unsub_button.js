// 구독 취소 버튼 (2026-09-13) — 세 메일(일일·주간·스페셜) 푸터의 해지 경로.
//
// 종전에는 12px 회색 텍스트 링크 '수신거부' 하나였다. 버튼으로 바꾸되 아래를 잠근다:
//   · 링크 목적지는 그대로(?t=<토큰>&a=unsubscribe) — doGet 분기를 건드리지 않는다
//   · 웹앱 URL 이 비면 운영자 mailto 폴백 — 어느 경우에도 해지 경로가 사라지지 않는다
//   · 세 템플릿이 전부 같은 헬퍼를 쓴다 — 한 곳만 고치면 다른 메일이 옛 링크로 남는다
//   · DESIGN.md 토큰만 쓴다 — danger 색을 버튼에 쓰지 않는다(상태 배지 전용)
//   · astral 문자 없음 — GmailApp.sendEmail 이 깨뜨린다
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('mailer/Code.gs', 'utf8');
const context = vm.createContext({
  console,
  Utilities: { formatDate: () => '2026,9,13' },
  Logger: { log() {} },
});
vm.runInContext(src, context);

// ── 헬퍼 출력 ──────────────────────────────────────────────────────────
vm.runInContext('CFG.WEBAPP_URL = "https://script.google.com/macros/s/X/exec"; CFG.OPERATOR_EMAIL = "op@x.com";', context);
const btn = vm.runInContext('unsubButton_("tok123")', context);

assert(btn.indexOf('href="https://script.google.com/macros/s/X/exec?t=tok123&a=unsubscribe"') >= 0,
  '목적지는 종전 링크와 같아야 한다(doGet 의 a=unsubscribe 분기)');
assert(btn.indexOf('구독 취소') >= 0, '버튼 라벨');
assert(/<table role="presentation"/.test(btn) && /display:inline-block/.test(btn),
  '이메일 호환 버튼 — 테이블 래퍼 + inline-block 앵커');
assert(btn.indexOf('border:1px solid #D8DEE8') >= 0 && btn.indexOf('background:#FFFFFF') >= 0,
  '테두리형(surface + border) — 주 CTA 의 primary 채움과 구분');
assert(btn.indexOf('color:#5F6B7A') >= 0, '텍스트는 muted 토큰');
assert(btn.indexOf('#C9342F') < 0, 'danger 색은 버튼에 쓰지 않는다(DESIGN.md: 상태 배지 전용)');
assert(btn.indexOf('border-radius:8px') >= 0, '버튼 radius 는 md(8px)');
assert(!/[\uD800-\uDFFF]/.test(btn), 'astral 문자 없음');

// 웹앱 URL 이 비면 mailto 폴백 — 해지 경로가 사라지면 안 된다
vm.runInContext('CFG.WEBAPP_URL = "";', context);
const fallback = vm.runInContext('unsubButton_("tok123")', context);
assert(fallback.indexOf('href="mailto:op@x.com?subject=') >= 0, '웹앱 URL 없으면 운영자 mailto');
assert(fallback.indexOf('구독 취소') >= 0, '폴백에도 같은 라벨');
assert(fallback.indexOf('a=unsubscribe') < 0, '폴백은 웹앱 링크를 만들지 않는다');

// ── 세 템플릿이 전부 헬퍼를 쓴다 ──────────────────────────────────────
const fn = (name, next) => {
  const a = src.indexOf('function ' + name + '('), b = src.indexOf('function ' + next + '(');
  assert(a > 0 && b > a, name + ' 블록을 못 찾음');
  return src.slice(a, b);
};
[
  ['specialHtml_', 'specialSet_'],
  ['html_', 'catSection_'],
  ['dailyHtml_', 'dailyPlain_'],
].forEach(([name, next]) => {
  const body = fn(name, next);
  assert(body.indexOf('unsubButton_(tok)') >= 0, name + ' 는 unsubButton_(tok) 을 써야 한다');
  assert(body.indexOf('link_(tok, "unsubscribe"') < 0, name + ' 에 옛 텍스트 링크가 남아 있다');
  assert(body.indexOf('var tok = token_(email)') >= 0, name + ' 는 토큰을 만들어야 버튼이 동작한다');
});

// ── 확인 페이지 (2026-09-13) ─────────────────────────────────────────────
// 메일 링크(GET)만으로는 해지하지 않는다. 버튼 오클릭과 메일 클라이언트의 safe-link
// 사전 열람이 구독자를 조용히 지우는 경로라, 확인 폼 제출(confirm=1)에서만 반영한다.
const calls = [];
context.HtmlService = { createHtmlOutput: (h) => ({ getContent: () => h }) };
context.__calls = calls;
vm.runInContext([
  'CFG.WEBAPP_URL = "https://script.google.com/macros/s/X/exec"; CFG.BASE = "https://brevislab.com/";',
  'tableOf_ = function () { return { header: [CFG.RESP_COL.email], rows: [{ cells: ["a@x.com"] }] }; };',
  'idx_ = function (h, n) { return h.indexOf(n); };',
  'token_ = function (em) { return em === "a@x.com" ? "tokA" : "other"; };',
  'prefMap_ = function () { return {}; };',
  'prefUpsert_ = function (sheet, email, domains, status) { __calls.push({ sheet, email, status }); };',
].join('\n'), context);
const get = (params) => vm.runInContext('doGet(' + JSON.stringify({ parameter: params }) + ').getContent()', context);
const nCats = vm.runInContext('CATS.length', context);

// 1) 링크 클릭(확인 없음) → 확인 페이지만, 시트 쓰기 0
let html = get({ t: 'tokA', a: 'unsubscribe' });
assert.strictEqual(calls.length, 0, '확인 전에는 아무것도 쓰면 안 된다');
assert(html.indexOf('해지할까요') >= 0, '확인 문구');
assert(/<form method="get" action="https:\/\/script\.google\.com\/macros\/s\/X\/exec" target="_top"/.test(html),
  '폼은 웹앱 exec URL 로, iframe 밖(_top)으로 제출');
assert(html.indexOf('name="t" value="tokA"') >= 0 && html.indexOf('name="a" value="unsubscribe"') >= 0
  && html.indexOf('name="confirm" value="1"') >= 0, '폼이 토큰·액션·confirm=1 을 그대로 실어야 한다');
assert(html.indexOf('구독 취소') >= 0, '확인 버튼 라벨은 메일 버튼과 같다');
assert(html.indexOf('#C9342F') < 0, '확인 버튼에도 danger 색을 쓰지 않는다');

// 2) confirm=1 → 전 카테고리 수신거부 + 완료 문구
html = get({ t: 'tokA', a: 'unsubscribe', confirm: '1' });
assert.strictEqual(calls.length, nCats, '카테고리(' + nCats + ')마다 prefUpsert_ 1회');
assert(calls.every((c) => c.email === 'a@x.com' && c.status === '수신거부'), '전부 같은 구독자를 수신거부로');
assert(html.indexOf('해지되었습니다') >= 0, '완료 문구');
assert(html.indexOf('<form') < 0, '완료 페이지에는 폼이 없다');

// 3) confirm 값이 1 이 아니면 확인 페이지로 되돌린다(스캐너가 파라미터를 변조해도 못 지운다)
calls.length = 0;
html = get({ t: 'tokA', a: 'unsubscribe', confirm: 'yes' });
assert.strictEqual(calls.length, 0, 'confirm=yes 는 확인으로 치지 않는다');
assert(html.indexOf('해지할까요') >= 0);

// 4) 토큰이 안 맞으면 종전과 같이 거절(회귀)
html = get({ t: 'nope', a: 'unsubscribe', confirm: '1' });
assert.strictEqual(calls.length, 0, '모르는 토큰으로는 아무것도 쓰지 않는다');
assert(html.indexOf('구독자를 찾을 수 없습니다') >= 0);

console.log('test_unsub_button: OK');
