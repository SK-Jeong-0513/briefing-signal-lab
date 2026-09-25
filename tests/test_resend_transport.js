// 발송 수단 전환(Gmail → Resend, 2026-09-23) 불변식.
// 근거: 개인 Gmail 한도 100(롤링 24h)에서 매일 발송의 구독자 상한이 49명인데 54명이 됐다.
// 설계 문서: docs/mailer-resend-migration.md
//
// ⚠️ 이 파일은 sendMail_ 을 직접 호출한다 — 발송 루프(sendDailyMarket 등)를 돌리지 않는다.
//    저장소본 CFG.TEST_MODE 가 true 라 루프를 돌리면 운영자 1통으로 break 하는 가지를 타고,
//    라이브(TEST_MODE:false)에서 실제로 도는 경로는 검사되지 않은 채 통과한다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync('mailer/Code.gs', 'utf8');

// ── 실제 동작: 스텁을 끼워 sendMail_ 이 무엇을 보내는지 본다 ──────────────────────
function run(scriptProps) {
  const calls = { fetch: [], gmail: [], slept: [] };
  let response = { code: 200, body: '{"id":"stub"}' };
  const ctx = vm.createContext({
    console,
    Logger: { log: () => {} },
    Utilities: {
      formatDate: () => 'x', sleep: (ms) => calls.slept.push(ms),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_alg, s) => Array.from(require('crypto').createHash('sha256').update(s).digest()),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (scriptProps || {})[k] || null }),
    },
    GmailApp: { sendEmail: (...a) => calls.gmail.push(a) },
    MailApp: { getRemainingDailyQuota: () => 100 },
    UrlFetchApp: {
      fetch: (url, opts) => {
        calls.fetch.push({ url, opts });
        const r = typeof response === 'function' ? response(calls.fetch.length) : response;
        return { getResponseCode: () => r.code, getContentText: () => r.body };
      },
    },
  });
  vm.runInContext(SRC, ctx);
  return {
    calls,
    ctx,
    setResponse: (r) => { response = r; },
    send: (...a) => vm.runInContext('sendMail_', ctx)(...a),
    quotaOk: (n, l) => vm.runInContext('mailQuotaOk_', ctx)(n, l),
    quotaWarn: (n, l) => vm.runInContext('mailQuotaWarn_', ctx)(n, l),
  };
}

// ── 키가 없으면 기존 Gmail 경로 그대로 (되돌리기가 속성 삭제 한 번이어야 한다) ──
{
  const t = run({});
  t.send('a@b.com', '제목', '평문', '<p>html</p>');
  assert.strictEqual(t.calls.gmail.length, 1, '키 없으면 GmailApp 으로 간다');
  assert.strictEqual(t.calls.fetch.length, 0, '키 없으면 Resend 를 부르지 않는다');
}

// ── 키가 있으면 Resend 로 가고, Gmail 은 한 번도 안 불린다 ──────────────────────
{
  const t = run({ RESEND_API_KEY: 're_test_key' });
  t.send('sub@naver.com', '[일일 시황] 2026-09-29', '평문 본문', '<p>본문</p>');
  assert.strictEqual(t.calls.fetch.length, 1, 'Resend 를 1회 호출한다');
  assert.strictEqual(t.calls.gmail.length, 0, '⚠️ Resend 경로에서 GmailApp 이 불리면 안 된다');

  const { url, opts } = t.calls.fetch[0];
  assert.strictEqual(url, 'https://api.resend.com/emails');
  assert.strictEqual(opts.method, 'post');
  assert.strictEqual(opts.headers.Authorization, 'Bearer re_test_key');

  const body = JSON.parse(opts.payload);
  assert.deepStrictEqual(body.to, ['sub@naver.com']);
  assert.strictEqual(body.subject, '[일일 시황] 2026-09-29');
  assert.strictEqual(body.text, '평문 본문');
  assert.strictEqual(body.html, '<p>본문</p>');
  // 발신이 noreply@ 라 reply_to 가 없으면 구독자 회신이 사라진다(2026-09-22 W39 실제 회신 있음).
  assert.strictEqual(body.reply_to, 'paun.jeong@gmail.com', 'reply_to 가 운영자 주소여야 한다');
  assert(/^.+ <noreply@brevislab\.com>$/.test(body.from), 'from 은 "이름 <검증도메인>" 형식: ' + body.from);

  // List-Unsubscribe 는 푸터 버튼과 같은 확인 페이지 URL 이어야 한다(수신자 토큰 포함).
  const expectHref = vm.runInContext('unsubHref_(token_("sub@naver.com"))', t.ctx);
  assert(/[?&]a=unsubscribe/.test(expectHref), '확인 페이지 URL: ' + expectHref);
  assert.strictEqual(body.headers['List-Unsubscribe'], '<' + expectHref + '>');
  // ⚠️ One-Click 금지 — POST 한 번으로 해지되면 2단계 해지 설계가 깨진다.
  assert(!('List-Unsubscribe-Post' in body.headers), 'List-Unsubscribe-Post 를 넣지 않는다');
}

// ── 운영자 알림에는 List-Unsubscribe 를 붙이지 않는다(구독 메일이 아니다) ─────────
{
  const t = run({ RESEND_API_KEY: 'k' });
  t.send('Paun.Jeong@gmail.com', '[BSL] 알림', '평문', '');
  const body = JSON.parse(t.calls.fetch[0].opts.payload);
  assert(!('headers' in body), '운영자 주소(대소문자 무관)에는 헤더 없음');
}

// ── 평문 전용 발송(운영자 알림)은 html 키를 넣지 않는다 ────────────────────────
{
  const t = run({ RESEND_API_KEY: 'k' });
  t.send('op@x.com', '알림', '평문만', '');
  const body = JSON.parse(t.calls.fetch[0].opts.payload);
  assert(!('html' in body), '빈 htmlBody 는 html 키 자체를 넣지 않는다(백지 메일 방지)');
}

// ── 비-BMP 제거가 Resend 경로에도 걸린다 ──────────────────────────────────────
{
  const t = run({ RESEND_API_KEY: 'k' });
  t.send('a@b.com', '### 📌 제목', '📌 평문', '<p>📌</p>');
  const body = JSON.parse(t.calls.fetch[0].opts.payload);
  assert.strictEqual(body.subject, '###  제목');
  assert.strictEqual(body.text, ' 평문');
  assert.strictEqual(body.html, '<p></p>');
}

// ── 실패는 삼키지 않고 던진다. 절대 Gmail 로 되돌아가지 않는다 ─────────────────
{
  const t = run({ RESEND_API_KEY: 'k' });
  t.setResponse({ code: 422, body: '{"message":"domain not verified"}' });
  assert.throws(() => t.send('a@b.com', 's', 'p', ''), /Resend 422/, '4xx 는 예외로 올린다');
  assert.strictEqual(t.calls.gmail.length, 0, '⚠️ 실패해도 Gmail 로 폴백하지 않는다');
}

// ── 429 는 한 번 쉬었다 재시도, 두 번째도 429 면 던진다 ────────────────────────
{
  const t = run({ RESEND_API_KEY: 'k' });
  t.setResponse((n) => (n === 1 ? { code: 429, body: 'rate' } : { code: 200, body: '{}' }));
  t.send('a@b.com', 's', 'p', '');
  assert.strictEqual(t.calls.fetch.length, 2, '429 면 1회 재시도');
  assert.strictEqual(t.calls.slept.length, 1, '재시도 전에 쉰다');

  const t2 = run({ RESEND_API_KEY: 'k' });
  t2.setResponse({ code: 429, body: 'rate' });
  assert.throws(() => t2.send('a@b.com', 's', 'p', ''), /Resend 429/, '재시도도 429 면 던진다');
  assert.strictEqual(t2.calls.fetch.length, 2, '무한 재시도하지 않는다');
}

// ── 한도 가드는 수단과 짝을 맞춘다 ────────────────────────────────────────────
// Gmail 한도를 보는 가드가 Resend 경로에 남으면, 특히 fail-closed 인 mailQuotaOk_ 가
// Gmail 잔여 바닥일 때 Resend 에 여유가 있어도 일일을 통째로 막는다.
{
  const g = run({});
  assert.strictEqual(g.quotaOk(50, '일일 시황'), true, 'Gmail 경로: 잔여 100 ≥ 50 이면 통과');
  assert.strictEqual(g.quotaOk(150, '일일 시황'), false, 'Gmail 경로: 잔여 100 < 150 이면 차단(기존 동작)');

  const r = run({ RESEND_API_KEY: 'k' });
  assert.strictEqual(r.quotaOk(150, '일일 시황'), true, 'Resend 경로: Gmail 잔여와 무관하게 통과');
  assert.strictEqual(r.calls.gmail.length, 0, 'Resend 경로 가드는 알림 메일도 보내지 않는다');
  r.quotaWarn(150, '주간 W40');
  assert.strictEqual(r.calls.fetch.length, 0, 'Resend 경로 가드는 발송 자체를 하지 않는다');
}

// ── 소스 불변식: 단일 통로가 유지되는가 ───────────────────────────────────────
const live = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l));

// MailApp 호출이 resendKey_ 단락보다 뒤에 있어야 한다. 앞이면 Resend 발송에 Gmail 스코프가
// 다시 얽히고, 2026-08-17 에 일일을 통째로 죽였던 OAuth 예외 경로가 되살아난다.
// ※ 주석을 지운 줄(live)로 비교한다 — 주석에도 "MailApp" 이라는 낱말이 나오므로
//    원문에서 위치를 재면 주석을 집어 잘못 통과/실패한다.
['mailQuotaWarn_', 'mailQuotaOk_'].forEach((fn) => {
  const start = live.findIndex((l) => l.indexOf('function ' + fn) >= 0);
  assert(start >= 0, fn + ' 를 찾지 못함');
  const guard = live.slice(start).findIndex((l) => /resendKey_\(\)/.test(l));
  const mail = live.slice(start).findIndex((l) => /MailApp\./.test(l));
  assert(guard >= 0, fn + ' 에 Resend 단락이 있어야 한다');
  assert(mail >= 0, fn + ' 에 MailApp 호출이 있어야 한다(Gmail 경로는 그대로 유지)');
  assert(guard < mail, fn + ': resendKey_ 단락이 MailApp 호출보다 앞이어야 한다');
});

// ※ 파일 전체의 UrlFetchApp.fetch 를 세면 안 된다 — quotesFetch_ · dispatchQuotes_ 가
//    quotes.json 을 받아오느라 따로 쓴다(발송과 무관). Resend 로 가는 호출만 센다.
const resendFetches = live.filter((l) => /UrlFetchApp\.fetch\(\s*RESEND_ENDPOINT/.test(l));
assert.strictEqual(resendFetches.length, 1, 'Resend 발송 호출은 1곳뿐: ' + resendFetches.length);
const gmails = live.filter((l) => /GmailApp\.sendEmail\(/.test(l));
assert.strictEqual(gmails.length, 1, 'GmailApp.sendEmail 도 1곳뿐: ' + gmails.length);

// sendMail_ 을 우회하는 발송이 생기면 그 경로만 조용히 다른 수단으로 나간다.
const senderFns = live
  .map((l, i) => [l, i])
  .filter(([l]) => /GmailApp\.sendEmail\(|UrlFetchApp\.fetch\(\s*RESEND_ENDPOINT/.test(l))
  .map(([, i]) => {
    for (let j = i; j >= 0; j--) if (/^function /.test(live[j])) return live[j].match(/function (\w+)/)[1];
    return '?';
  });
assert.deepStrictEqual(senderFns.sort(), ['resendSend_', 'sendMail_'],
  '발송은 sendMail_ 과 resendSend_ 안에서만 일어나야 한다: ' + senderFns);

// 엔드포인트·발신 도메인을 오타로 바꾸면 전부 실패하는데 로그로는 안 보인다.
assert(/RESEND_ENDPOINT\s*=\s*"https:\/\/api\.resend\.com\/emails"/.test(SRC), '엔드포인트 고정');
assert(/RESEND_FROM\s*=\s*"noreply@brevislab\.com"/.test(SRC), '발신 주소는 검증된 도메인');

console.log('resend transport tests: OK');
