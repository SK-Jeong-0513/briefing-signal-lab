// 스페셜 리포트 발송 — 수신자 해석 · 한도 가드 · 테스트 발송 경로의 안전 경계.
//
// 이 기능은 되돌릴 수 없는 발송을 다룬다. 잘못 보내면 회수할 방법이 없으므로
// "구독자에게 갈 수 없어야 하는 경로가 정말 갈 수 없는지"를 구조로 잠근다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const mailer = fs.readFileSync('mailer/Code.gs', 'utf8');
const admin = fs.readFileSync('admin/Code.gs', 'utf8');

const block = (src, from, to, what) => {
  const a = src.indexOf(from), b = src.indexOf(to);
  assert(a > 0 && b > a, what + ' 블록을 못 찾음');
  return src.slice(a, b);
};

// ── 수신자 해석: 동의 게이트 + 카테고리 OR ────────────────────────────
// 카테고리를 여러 개 고를수록 수신자가 줄어들면(AND) 거꾸로 된 동작이다.
function recipients(catLabels, rows, prefs) {
  const ctx = vm.createContext({
    console,
    CFG: { RESP_SHEET: 'resp', RESP_COL: { email: '이메일', consent: '동의' }, CONSENT_TRUE_INCLUDES: '동의' },
    CATS: [
      { key: 'tech', label: '기술', prefSheet: 'p-tech' },
      { key: 'finance', label: '금융', prefSheet: 'p-fin' },
      { key: 'economy', label: '경제', prefSheet: 'p-eco' },
    ],
    syncResubscribes_: () => 0,
    prefMap_: (sheet) => prefs[sheet] || {},
    tableOf_: () => ({
      header: ['이메일', '동의'],
      rows: rows.map((r) => ({ cells: [r.email, r.consent] })),
    }),
    idx_: (header, name) => header.indexOf(name),
    consented_: (v) => String(v || '').indexOf('동의') >= 0,
  });
  vm.runInContext(block(mailer, 'function specialRecipients_', 'function specialPlain_', 'specialRecipients_'), ctx);
  return JSON.parse(vm.runInContext(
    'JSON.stringify(specialRecipients_(' + JSON.stringify(catLabels) + '))', ctx));
}

const people = [
  { email: 'a@x.com', consent: '동의' },
  { email: 'b@x.com', consent: '동의' },
  { email: 'c@x.com', consent: '' },          // 미동의
  { email: 'a@x.com', consent: '동의' },      // 중복 행
];

// 동의하지 않은 사람은 어떤 경우에도 빠진다.
assert.deepStrictEqual(recipients(['금융'], people, {}), ['a@x.com', 'b@x.com'], '미동의·중복 제외');

// 금융만 해지한 사람도 경제를 구독중이면 받는다(OR).
const partial = { 'p-fin': { 'b@x.com': { status: '수신거부', domains: [] } } };
assert.deepStrictEqual(recipients(['금융', '경제'], people, partial), ['a@x.com', 'b@x.com'],
  '한쪽만 해지 = 여전히 수신');
// 그 사람만 놓고 금융 단독으로 보내면 빠진다.
assert.deepStrictEqual(recipients(['금융'], people, partial), ['a@x.com'], '해당 카테고리 단독이면 제외');

// 고른 카테고리를 전부 해지한 사람은 빠진다.
const allOff = {
  'p-fin': { 'b@x.com': { status: '수신거부', domains: [] } },
  'p-eco': { 'b@x.com': { status: '수신거부', domains: [] } },
};
assert.deepStrictEqual(recipients(['금융', '경제'], people, allOff), ['a@x.com'], '전부 해지면 제외');

// 선호도 행이 아직 없는 사람 = 해지한 적 없음 → 받는다(주간과 같은 기본 동작).
assert.deepStrictEqual(recipients(['기술'], people, {}), ['a@x.com', 'b@x.com'], '선호도 미기록은 수신');

// 대상 미지정이면 전 카테고리 기준으로 본다(빈 목록이 '아무에게도 안 보냄'이 되면 안 된다).
assert.deepStrictEqual(recipients([], people, {}), ['a@x.com', 'b@x.com'], '대상 미지정 = 전체 기준');

// ── 한도 가드 ─────────────────────────────────────────────────────────
function quota(left, needed) {
  const sent = [];
  const ctx = vm.createContext({
    console, Logger: { log() {} },
    CFG: { OPERATOR_EMAIL: 'op@x.com', SENDER_NAME: 'BSL' },
    // left 에 함수를 주면 그 예외까지 흉내낸다(스코프 미승인 재현).
    MailApp: { getRemainingDailyQuota: () => (typeof left === 'function' ? left() : left) },
    GmailApp: { sendEmail: (to, subj) => sent.push({ to, subj }) },
    mailSafe_: (s) => String(s == null ? '' : s),   // 추출 블록 밖에 정의돼 있다
  });
  vm.runInContext(block(mailer, 'function sendMail_', 'function ymd_', 'sendMail_/mailQuotaOk_'), ctx);
  return { ok: ctx.mailQuotaOk_(needed, '일일 시황'), alerts: sent };
}
assert.strictEqual(quota(100, 21).ok, true, '여유가 있으면 통과');
assert.strictEqual(quota(21, 21).ok, true, '정확히 맞아도 통과');
let short = quota(10, 21);
assert.strictEqual(short.ok, false, '부족하면 차단');
assert.strictEqual(short.alerts.length, 1, '차단하면 운영자에게 알린다');
assert(/한도 부족/.test(short.alerts[0].subj), '알림 제목에 사유');
// needed 를 모를 때(0)는 가드가 발송을 막는 주체가 되면 안 된다.
assert.strictEqual(quota(0, 0).ok, true, 'needed 미상이면 통과(fail-open)');
// 한도 조회 자체가 실패해도 마찬가지다. MailApp 은 GmailApp 과 스코프가 달라 트리거가
// 새 스코프를 승인받기 전이면 예외가 나는데, 2026-08-17 에 그게 일일 발송을 통째로 죽였다.
const denied = quota(() => { throw new Error('does not have permission to call MailApp'); }, 21);
assert.strictEqual(denied.ok, true, '한도 조회가 예외를 던져도 발송은 진행(fail-open)');
assert.strictEqual(denied.alerts.length, 0, '조회 실패는 한도 부족이 아니므로 알림도 없다');

// 빈 htmlBody 를 그대로 넘기면 Gmail 이 백지 메일을 보낸다.
const opts = [];
const ctxOpt = vm.createContext({
  console, CFG: { SENDER_NAME: 'BSL' },
  GmailApp: { sendEmail: (to, s, b, o) => opts.push(o) },
  mailSafe_: (s) => String(s == null ? '' : s),
});
vm.runInContext(block(mailer, 'function sendMail_', 'function ymd_', 'sendMail_'), ctxOpt);
ctxOpt.sendMail_('a@x.com', 's', 'plain', '');
assert.strictEqual('htmlBody' in opts[0], false, '빈 htmlBody 는 옵션에서 빠져야 한다');
ctxOpt.sendMail_('a@x.com', 's', 'plain', '<b>x</b>');
assert.strictEqual(opts[1].htmlBody, '<b>x</b>');

// ── 테스트 발송은 구조적으로 구독자에게 닿을 수 없어야 한다 ──────────
// 수신자를 인자·요청 본문에서 받으면 토큰이 새는 순간 남의 메일함으로 갈 수 있다.
assert(/var to = CFG\.OPERATOR_EMAIL/.test(mailer), '테스트 수신자는 코드에 고정');
assert(!/sendSpecialTest\s*\([^)]*\bto\b/.test(mailer), 'sendSpecialTest 는 수신자를 인자로 받지 않는다');
const doPost = block(mailer, 'function doPost', 'function sendSpecialTest', 'doPost');
assert(/sendSpecialTest\(String\(data\.libId/.test(doPost), 'doPost 는 libId·lead·subject 만 넘긴다');
// \b 없이 쓰면 data.token 의 앞부분이 data.to 로 걸린다.
assert(!/data\.(to|recipient|email)\b/.test(doPost), 'doPost 가 수신자를 요청에서 읽으면 안 된다');

// 구독자 발송 경로는 폴링 하나뿐이다.
assert(/function sendSpecialDue\(\)/.test(mailer), '폴링 진입점 존재');
assert(/LockService\.getScriptLock/.test(block(mailer, 'function sendSpecialDue', 'function createSpecialTrigger', 'sendSpecialDue')),
  '폴링은 락으로 중복 실행을 막는다');

// ── 발송 단일 지점 ────────────────────────────────────────────────────
// GmailApp 직접 호출은 래퍼 안 1곳뿐이어야 한다(주석 줄 제외).
const directSends = mailer.split('\n').filter((l) => /GmailApp\.sendEmail\(/.test(l) && !/^\s*\/\//.test(l));
assert.strictEqual(directSends.length, 1, 'GmailApp 직접 호출은 sendMail_ 안 1곳뿐: ' + directSends.length);

// ── 발송로그 재사용 ───────────────────────────────────────────────────
const sendRow = block(mailer, 'function specialSendRow_', 'function sendSpecialDue', 'specialSendRow_');
assert(/"special:" \+ bundle\.id/.test(sendRow), 'issue_key 는 special:<발송id>');
assert(/weeklySentMap_/.test(sendRow) && /weeklyLog_/.test(sendRow), '주간 발송로그 헬퍼 재사용');
assert(/!sentMap\[token_\(em\)\]/.test(sendRow), '이미 받은 사람은 제외');
assert(/"상태": "발송중"/.test(sendRow), '발송 전에 상태를 잠근다');
// 크래시가 시트에 흔적을 남겨야 한다. 안 남기면 운영자에게는 '발송중 · 0건 · message 공란'만
// 보이고 실행 기록을 뒤져야 원인을 안다 — 2026-08-17 에 실제로 그렇게 찾았다.
assert(/message: "중단: " \+ String\(e\)/.test(sendRow), '루프 밖 크래시 사유를 행에 기록한다');
assert(/"상태": "실패"[^]*중단/.test(sendRow), '크래시는 실패로 두어 폴링이 다시 집지 않게 한다');
// 한도 조회는 경고 로그 전용이므로 발송을 죽이면 안 된다.
assert(/try \{ left = MailApp\.getRemainingDailyQuota\(\); \}\s*\n\s*catch/.test(sendRow),
  '한도 조회 실패가 스페셜 발송을 죽이지 않는다');

// ── 콘솔: 예약 입력 검증 ──────────────────────────────────────────────
const sched = block(admin, 'function specialSchedule', 'function specialCancel', 'specialSchedule');
assert(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\[ T\]\\d\{2\}:\\d\{2\}\$/.test(sched), '예약시각 형식 검증');
assert(/SPECIAL_CATEGORIES\.indexOf\(s\) >= 0/.test(sched), '카테고리 화이트리스트');
assert(/if \(!cats\.length\) throw/.test(sched), '대상이 비면 거부');
const cancel = block(admin, 'function specialCancel', 'function specialRequeue', 'specialCancel');
assert(/state !== '대기'/.test(cancel), '이미 나간 건은 취소 불가');

// 콘솔에 발송 로직이 복제되지 않았는지 — 구독자 목록·동의 판정이 여기 있으면 규칙이 갈라진다.
assert(!/GmailApp|MailApp/.test(admin), '콘솔은 직접 메일을 보내지 않는다');
assert(!/consented_|prefMap_|RESP_SHEET/.test(admin), '콘솔은 수신자 판정을 하지 않는다');

// ── 콘솔 화면: 정렬 기호는 항상 보인다 ────────────────────────────────
const html = fs.readFileSync('admin/index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const spCtx = vm.createContext({ console, spRender() {}, esc: (s) => String(s == null ? '' : s) });
vm.runInContext(block(js, 'var SP_SORT_COLS', 'function loadSpecial', '스페셜 정렬 헬퍼'), spCtx);
vm.runInContext('_spSort={key:"",dir:"asc"}', spCtx);
assert(vm.runInContext('spTh("상태","상태")', spCtx).includes('⇅'), '비활성 열에도 기호가 보인다');
vm.runInContext('spSort("상태")', spCtx);
assert(vm.runInContext('spTh("상태","상태")', spCtx).includes('▲'), '오름차순 기호');
vm.runInContext('spSort("상태")', spCtx);
assert(vm.runInContext('spTh("상태","상태")', spCtx).includes('▼'), '재클릭 시 방향 토글');
vm.runInContext('spSort("본문")', spCtx);
assert.strictEqual(vm.runInContext('_spSort.key', spCtx), '상태', '화이트리스트 밖 열은 무시');

console.log('special send: 모든 검증 통과');
