// 재구독 복구 검증 — 수신거부자가 구독 폼으로 다시 신청하면 발송이 재개돼야 한다.
// 배경(2026-07-28 발견): pref 상태가 '수신거부'로 남아 unsubSet_() 와 주간 루프가
// 영구 차단했다. 구독 폼은 '메일 수신 동의'가 필수라 재제출 = 새로운 명시적 동의로 본다.
// 방어선: 판별 불가(타임스탬프 없음·파싱 실패·동률)는 반드시 '수신거부 유지'여야 한다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('mailer/Code.gs', 'utf8');
const c = vm.createContext({
  console,
  Utilities: { formatDate: () => '2026-08-03 10:00:00' },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  Logger: { log: () => {} },
});
vm.runInContext(src, c);
const run = (expr) => vm.runInContext(expr, c);
// vm 컨텍스트의 객체·배열은 프로토타입이 달라 deepStrictEqual 이 실패한다 — JSON 으로 건너온다.
const runJ = (expr) => JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', c));
const call = (fn, ...args) => run(`${fn}(${args.map((a) => JSON.stringify(a)).join(',')})`);

const T = (y, mo, d, h, mi, s) => new Date(y, mo - 1, d, h || 0, mi || 0, s || 0).getTime();

// ── toTime_ / unsubTime_ : 시각 없는 값의 해석이 핵심 ─────────────────────────
assert.strictEqual(call('toTime_', '2026-07-28 14:00:00', false), T(2026, 7, 28, 14, 0, 0));
assert.strictEqual(call('toTime_', '2026-07-28', false), T(2026, 7, 28, 0, 0, 0), '시각 없으면 자정');
assert.strictEqual(call('unsubTime_', '2026-07-28'), T(2026, 7, 28, 0, 0, 0) + 86399999,
  '옛 날짜-only 해지는 그날 끝으로 봐야 같은 날 응답이 나중으로 오판되지 않는다');
assert.strictEqual(call('unsubTime_', '2026-07-28 14:00:00'), T(2026, 7, 28, 14, 0, 0),
  '시각이 있으면 그대로 쓴다');
assert.strictEqual(call('toTime_', '', false), null);
assert.strictEqual(call('toTime_', null, false), null);
assert.strictEqual(call('toTime_', '알 수 없음', false), null, '파싱 실패는 null');
assert.strictEqual(call('unsubTime_', ''), null);

// 시트가 날짜를 Date 객체로 돌려주는 경우(자정 = 날짜만 입력된 옛 행)
run('globalThis.__d0 = new Date(2026, 6, 28, 0, 0, 0);');
run('globalThis.__d1 = new Date(2026, 6, 28, 14, 30, 0);');
assert.strictEqual(run('unsubTime_(__d0)'), T(2026, 7, 28, 0, 0, 0) + 86399999, '자정 Date = 날짜만 → 그날 끝');
assert.strictEqual(run('unsubTime_(__d1)'), T(2026, 7, 28, 14, 30, 0), '시각 있는 Date 는 그대로');
assert.strictEqual(run('toTime_(__d1, false)'), T(2026, 7, 28, 14, 30, 0));

// ── resubscribed_ : 실제로 판단이 갈리는 지점 ────────────────────────────────
const unsubOld = { status: '수신거부', updated: '2026-07-28' };            // 시각 도입 전 행
const unsubNew = { status: '수신거부', updated: '2026-07-28 14:00:00' };   // 시각 도입 후 행

const resub = (pref, ts) => run(`resubscribed_(${JSON.stringify(pref)}, ${ts})`);

assert.strictEqual(resub(unsubOld, T(2026, 7, 28, 9, 0, 0)), false,
  '★ 옛 행 + 같은 날 먼저 낸 응답 → 복구하면 안 된다(수신거부했는데 또 오는 사고)');
assert.strictEqual(resub(unsubOld, T(2026, 7, 29, 9, 0, 0)), true, '다음날 재신청 → 복구');
assert.strictEqual(resub(unsubNew, T(2026, 7, 28, 15, 0, 0)), true, '같은 날이라도 해지보다 뒤면 복구');
assert.strictEqual(resub(unsubNew, T(2026, 7, 28, 9, 0, 0)), false, '해지보다 앞선 응답은 복구 아님');
assert.strictEqual(resub(unsubNew, T(2026, 7, 28, 14, 0, 0)), false, '동률은 수신거부 유지');
assert.strictEqual(resub({ status: '구독', updated: '2026-07-28' }, T(2026, 7, 29)), false,
  '수신거부 상태가 아니면 대상 아님');
assert.strictEqual(resub(unsubNew, null), false, '응답 시각을 모르면 복구하지 않는다');
assert.strictEqual(resub({ status: '수신거부', updated: '' }, T(2026, 7, 29)), false,
  '해지 시각을 못 읽으면 복구하지 않는다');
assert.strictEqual(resub({ status: '수신거부', updated: '언젠가' }, T(2026, 7, 29)), false,
  '파싱 실패도 복구하지 않는다');
assert.strictEqual(run('resubscribed_(null, 1)'), false);

// ── respTsIdx_ : 폼 응답 시트의 타임스탬프 열 찾기 ────────────────────────────
assert.strictEqual(call('respTsIdx_', ['타임스탬프', '이메일 주소(E-Mail Address)']), 0);
assert.strictEqual(call('respTsIdx_', ['Timestamp', '이메일 주소(E-Mail Address)']), 0, '영문 로케일');
assert.strictEqual(call('respTsIdx_', ['이메일 주소(E-Mail Address)', '타임스탬프']), 1, '열 순서가 달라도 이름으로');
assert.strictEqual(call('respTsIdx_', ['A', 'B']), 0, '이름이 없으면 1열로 폴백(폼 시트는 1열이 항상 타임스탬프)');

// ── respLatestTs_ : 이메일별 '가장 최근' 응답 ────────────────────────────────
// ⚠️ 발송 루프는 seen[email] 로 첫(=가장 오래된) 행만 취하므로 여기서 최댓값을 따로 구해야 한다.
function stubResp(header, rows) {
  vm.runInContext(
    'tableOf_ = function () { return { header: ' + JSON.stringify(header) +
    ', rows: ' + JSON.stringify(rows.map((cells) => ({ cells }))) + ' }; };', c);
}
stubResp(['타임스탬프', '이메일 주소(E-Mail Address)'], [
  ['2026-07-20 09:00:00', 'a@x.com'],
  ['2026-07-29 11:00:00', 'A@X.com'],   // 재신청(대소문자 다름) — 이게 최신
  ['2026-07-25 10:00:00', 'b@x.com'],
  ['', 'c@x.com'],                       // 시각 없는 행은 무시
  ['2026-07-26 10:00:00', ''],           // 이메일 없는 행은 무시
]);
let latest = runJ('respLatestTs_()');
assert.strictEqual(latest['a@x.com'], T(2026, 7, 29, 11, 0, 0), '같은 이메일은 최신 응답을 취한다');
assert.strictEqual(latest['b@x.com'], T(2026, 7, 25, 10, 0, 0));
assert.ok(!('c@x.com' in latest), '시각을 못 읽은 행은 제외');
assert.strictEqual(Object.keys(latest).length, 2);

// 타임스탬프 열이 없어 1열 폴백도 실패하면 → 빈 맵 = 복구 없이 현행 동작 유지
stubResp(['이메일 주소(E-Mail Address)', '메일 수신 동의'], [['a@x.com', '동의합니다']]);
assert.strictEqual(Object.keys(runJ('respLatestTs_()')).length, 0, '판별 불가면 아무도 복구하지 않는다');

// ── syncResubscribes_ : 실제 시트 쓰기 ──────────────────────────────────────
const sheets = runJ('CATS.map(function (c) { return c.prefSheet; })');
assert.ok(sheets.length >= 2, '카테고리 pref 시트가 여러 개인 전제');

function stubSync(prefBySheet, respMap) {
  vm.runInContext('globalThis.__ups = [];', c);
  vm.runInContext(
    'prefMap_ = function (name) { return (' + JSON.stringify(prefBySheet) + ')[name] || {}; };' +
    'prefUpsert_ = function (name, email, doms, status) { __ups.push({ name: name, email: email, doms: doms, status: status }); };' +
    'respLatestTs_ = function () { return ' + JSON.stringify(respMap) + '; };', c);
}

// 재구독자 1명 + 유지되어야 할 수신거부자 1명 + 일반 구독자 1명
stubSync({
  [sheets[0]]: {
    'back@x.com': { email: 'Back@X.com', domains: ['AI 인프라'], status: '수신거부', updated: '2026-07-28 14:00:00' },
    'stay@x.com': { email: 'stay@x.com', domains: ['반도체 공급망'], status: '수신거부', updated: '2026-07-28 14:00:00' },
    'ok@x.com': { email: 'ok@x.com', domains: ['AI 인프라'], status: '구독', updated: '2026-07-01' },
  },
}, {
  'back@x.com': T(2026, 7, 29, 9, 0, 0),   // 해지 이후 재신청
  'stay@x.com': T(2026, 7, 20, 9, 0, 0),   // 해지 전 응답뿐
  'ok@x.com': T(2026, 7, 29, 9, 0, 0),
});
assert.strictEqual(run('syncResubscribes_()'), 1, '재구독자만 1명 복구');
let ups = runJ('__ups');
assert.strictEqual(ups.length, 1);
assert.strictEqual(ups[0].status, '구독');
assert.strictEqual(ups[0].email, 'Back@X.com', '시트에 있던 원래 대소문자를 보존한다');
assert.deepStrictEqual(ups[0].doms, ['AI 인프라'], '고르던 분야를 유지한다');

// 분야를 모두 끈 뒤 해지한 경우 → 가동 분야 전체로 되살린다(빈 분야면 메일이 안 가므로)
const allLabels = runJ(`CATS.filter(function (c) { return c.prefSheet === ${JSON.stringify(sheets[0])}; })[0].domains.map(function (d) { return d.label; })`);
stubSync({
  [sheets[0]]: { 'empty@x.com': { email: 'empty@x.com', domains: [], status: '수신거부', updated: '2026-07-28 14:00:00' } },
}, { 'empty@x.com': T(2026, 7, 29, 9, 0, 0) });
assert.strictEqual(run('syncResubscribes_()'), 1);
assert.deepStrictEqual(runJ('__ups')[0].doms, allLabels, '빈 분야는 가동 분야 전체로 복원');

// 응답 맵이 비면 아무것도 쓰지 않는다(타임스탬프 열을 못 찾은 경우 등)
// — 안전하게 건너뛰되, 기능이 죽은 걸 모르고 지나가지 않게 로그는 남겨야 한다.
vm.runInContext('globalThis.__logs = []; Logger = { log: function (m) { __logs.push(String(m)); } };', c);
stubSync({ [sheets[0]]: { 'back@x.com': { email: 'back@x.com', domains: [], status: '수신거부', updated: '2026-07-28' } } }, {});
assert.strictEqual(run('syncResubscribes_()'), 0);
assert.strictEqual(runJ('__ups').length, 0, '판별 불가면 쓰기 0회');
assert.ok(runJ('__logs').some((m) => m.indexOf('[재구독]') === 0),
  '조용히 넘어가면 복구가 통째로 죽어도 알 수 없다 — 로그 필수');

// ── 배선: 두 발송 경로 모두에서 차단 목록/선호도를 읽기 전에 돌아야 한다 ──────
const daily = src.slice(src.indexOf('function sendDailyMarket('));
assert.ok(daily.indexOf('syncResubscribes_()') >= 0 &&
  daily.indexOf('syncResubscribes_()') < daily.indexOf('unsubSet_()'),
  '일일: syncResubscribes_() 가 unsubSet_() 보다 먼저');
const weekly = src.slice(src.indexOf('function sendWeeklyUnlocked_('));   // 실제 발송 루프
assert.ok(weekly.indexOf('syncResubscribes_()') >= 0 &&
  weekly.indexOf('syncResubscribes_()') < weekly.indexOf('prefMap_(c.prefSheet)'),
  '주간: syncResubscribes_() 가 prefMap_ 조회보다 먼저');

// 갱신 기록에 시각이 남아야 앞으로의 '같은 날 해지→재신청'을 구분할 수 있다
assert.ok(src.includes('"yyyy-MM-dd HH:mm:ss"'), 'prefUpsert_ 는 날짜+시각을 저장해야 한다');

// ── 운영자 진단 checkResubscribe() ──────────────────────────────────────────
// 이름에 _ 가 붙으면 Apps Script 실행 드롭다운에서 사라져 운영자가 쓸 수 없다.
assert.ok(/\nfunction checkResubscribe\(\)/.test(src), '실행 가능한 이름이어야 한다(끝에 _ 금지)');
const diag = src.slice(src.indexOf('function checkResubscribe()'));
const diagBody = diag.slice(0, diag.indexOf('\nfunction '));
assert.ok(diagBody.indexOf('prefUpsert_') < 0 && diagBody.indexOf('syncResubscribes_') < 0,
  '진단은 읽기 전용이어야 한다 — 쓰기 함수를 부르면 안 된다');

// 실제로 돌려서 예외 없이 완주하는지(시트는 위 stubSync 의 스텁을 그대로 쓴다)
vm.runInContext('globalThis.__logs = [];', c);
stubSync({
  [sheets[0]]: { 'back@x.com': { email: 'back@x.com', domains: [], status: '수신거부', updated: '2026-07-28 14:00:00' } },
}, { 'back@x.com': T(2026, 7, 29, 9, 0, 0) });
run('checkResubscribe()');
assert.strictEqual(runJ('__ups').length, 0, '진단은 시트에 쓰지 않는다');
assert.ok(runJ('__logs').some((m) => m.indexOf('복구대상=true') >= 0), '복구 대상을 표시한다');

console.log('resubscribe tests: OK');
