// 지표 사전 점검(preflightQuotes) — 크론 지연 시 워크플로 자가 발화와 운영자 알림 검증.
// 배경: 2026-08-27 GitHub 예약 크론이 3시간 29분 늦어 발송 시점 quotes.json 이 전일자였고,
//       당일 게이트가 '주요 시장 지표' 블록을 통째로 생략했다(조용히 — 로그만 남았다).
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const FRESH = { asof: '2026-08-26', briefing_date: '2026-08-27', rows: [{ label: '나스닥', value: '1', change: '+0.1%', dir: 1 }] };
const STALE = Object.assign({}, FRESH, { briefing_date: '2026-08-26' });

// snapshots = quotes.json 응답을 호출 순서대로. 목록을 다 쓰면 마지막 값이 계속 나온다.
function ctx(opts) {
  opts = opts || {};
  const state = { logs: [], mails: [], dispatches: [], sleeps: [], reads: 0, urls: [] };
  const snapshots = opts.snapshots || [FRESH];
  const RealDate = Date;
  const c = vm.createContext({
    console,
    Utilities: {
      formatDate: () => opts.today || '2026-08-27',
      sleep: (ms) => state.sleeps.push(ms),
    },
    Logger: { log: (m) => state.logs.push(String(m)) },
    GmailApp: { sendEmail: (to, subject, plain) => state.mails.push({ to, subject, plain }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (opts.props && k in opts.props ? opts.props[k] : null),
        setProperty: () => {},
      }),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        if (String(url).indexOf('api.github.com') >= 0) {
          state.dispatches.push({ url: String(url), options: options });
          const code = opts.dispatchCode === undefined ? 204 : opts.dispatchCode;
          return { getResponseCode: () => code, getContentText: () => '{"message":"denied"}' };
        }
        state.urls.push(String(url));
        const snap = snapshots[Math.min(state.reads, snapshots.length - 1)];
        state.reads++;
        if (snap === 'http500') return { getResponseCode: () => 500, getContentText: () => '' };
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(snap) };
      },
    },
    Date: class extends RealDate {
      constructor(...a) { return a.length ? new RealDate(...a) : new RealDate('2026-08-27T00:00:00Z'); }
      static now() { return 1756252800000; }
    },
  });
  vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), c);
  return { c, state };
}

// ── 최신이면 아무것도 하지 않는다(평소 경로 — 매일 여기로 지나간다) ──
let t = ctx({ snapshots: [FRESH], props: { GH_DISPATCH_TOKEN: 'tok' } });
vm.runInContext('preflightQuotes()', t.c);
assert.strictEqual(t.state.dispatches.length, 0, '최신이면 워크플로를 발화하지 않는다');
assert.strictEqual(t.state.mails.length, 0, '최신이면 알리지 않는다');
assert.strictEqual(t.state.sleeps.length, 0, '최신이면 기다리지 않는다');
assert(t.state.logs.some((l) => l.includes('최신 — 조치 없음')), '판단 근거를 로그로 남긴다');
assert(/\?v=\d+$/.test(t.state.urls[0]), 'GitHub Pages 10분 캐시를 우회해야 함');

// ── 낡으면 발화하고, 반영되면 조용히 끝난다 ──
t = ctx({ snapshots: [STALE, FRESH], props: { GH_DISPATCH_TOKEN: 'tok' } });
vm.runInContext('preflightQuotes()', t.c);
assert.strictEqual(t.state.dispatches.length, 1, '낡으면 워크플로를 발화한다');
const d = t.state.dispatches[0];
assert(d.url.includes('/repos/SK-Jeong-0513/briefing-signal-lab/actions/workflows/daily-quotes.yml/dispatches'), 'dispatch 엔드포인트: ' + d.url);
assert.strictEqual(d.options.method, 'post');
assert.strictEqual(JSON.parse(d.options.payload).ref, 'main', 'main 브랜치에서 실행');
assert.strictEqual(d.options.headers.Authorization, 'Bearer tok', '스크립트 속성의 PAT를 쓴다');
assert.strictEqual(d.options.muteHttpExceptions, true, '예외 대신 코드로 판단');
assert.strictEqual(t.state.mails.length, 0, '복구되면 알리지 않는다');
assert.strictEqual(t.state.sleeps.length, 1, '반영되면 남은 재시도를 건너뛴다');
assert(t.state.logs.some((l) => l.includes('복구 완료')), '복구를 로그로 남긴다');

// ── 토큰이 없으면 호출조차 하지 않고 운영자에게 알린다 ──
t = ctx({ snapshots: [STALE] });
vm.runInContext('preflightQuotes()', t.c);
assert.strictEqual(t.state.dispatches.length, 0, '토큰 없이 GitHub를 부르지 않는다');
assert.strictEqual(t.state.mails.length, 1, '발화 못 했으면 알린다');
assert(t.state.mails[0].subject.includes('발화 실패'), t.state.mails[0].subject);
assert(t.state.mails[0].plain.includes('GH_DISPATCH_TOKEN'), '고칠 자리를 본문에 적는다');

// ── 발화가 거부되면(권한 부족 등) 기다리지 않고 바로 알린다 ──
t = ctx({ snapshots: [STALE], props: { GH_DISPATCH_TOKEN: 'tok' }, dispatchCode: 403 });
vm.runInContext('preflightQuotes()', t.c);
assert.strictEqual(t.state.mails.length, 1);
assert(t.state.mails[0].subject.includes('발화 실패'));
assert.strictEqual(t.state.sleeps.length, 0, '발화 실패면 기다릴 이유가 없다');
assert(t.state.logs.some((l) => l.includes('발화 HTTP 403')), '응답 코드를 로그로 남긴다');

// ── 발화했는데 제때 안 들어오면 '빠진 채 나갈 것'을 미리 알린다 ──
t = ctx({ snapshots: [STALE], props: { GH_DISPATCH_TOKEN: 'tok' } });
vm.runInContext('preflightQuotes()', t.c);
const tries = vm.runInContext('QUOTES_TRIES', t.c);
assert.strictEqual(t.state.sleeps.length, tries, '설정한 횟수만큼 재확인');
assert.strictEqual(t.state.dispatches.length, 1, '발화는 1회만');
assert.strictEqual(t.state.mails.length, 1);
assert(t.state.mails[0].subject.includes('블록 생략 예상'), t.state.mails[0].subject);

// ── quotes.json 자체가 죽어도 낡음으로 보고 발화한다 ──
t = ctx({ snapshots: ['http500'], props: { GH_DISPATCH_TOKEN: 'tok' } });
vm.runInContext('preflightQuotes()', t.c);
assert.strictEqual(t.state.dispatches.length, 1, '조회 실패도 복구 대상');

// ── 사전 점검이 실패해도 발송은 살아 있어야 한다(게이트는 그대로) ──
t = ctx({ snapshots: [STALE], props: { GH_DISPATCH_TOKEN: 'tok' } });
assert.strictEqual(vm.runInContext('quotes_()', t.c), null, '전일 스냅샷은 여전히 차단');
t = ctx({ snapshots: [FRESH] });
assert(vm.runInContext('quotes_()', t.c), '당일 스냅샷은 통과');

// ── 블록이 빠진 날은 발송 경로에서 알린다 ──
t = ctx({ snapshots: [FRESH] });
vm.runInContext('alertQuotesMissing_("2026-08-27")', t.c);
assert.strictEqual(t.state.mails.length, 1);
assert.strictEqual(t.state.mails[0].to, 'paun.jeong@gmail.com', 'CFG.OPERATOR_EMAIL로 간다');
assert(t.state.mails[0].subject.includes('주요 시장 지표'), t.state.mails[0].subject);
assert(t.state.mails[0].plain.includes('daily-quotes.yml'), '수동 조치 경로를 본문에 적는다');

// ── 알림이 실패해도 호출부를 죽이지 않는다(발송이 알림 때문에 멈추면 안 된다) ──
t = ctx({ snapshots: [FRESH] });
vm.runInContext('GmailApp.sendEmail = function () { throw new Error("quota"); };', t.c);
assert.doesNotThrow(() => vm.runInContext('alertQuotesMissing_("2026-08-27")', t.c), '알림 실패는 삼킨다');

// ── 배선: 발송에서 블록이 빠지면 반드시 알림을 태운다 ──
const src = fs.readFileSync('mailer/Code.gs', 'utf8');
assert(src.includes('if (!quotes) alertQuotesMissing_(dg.today);'), '발송 경로에 알림 배선 필요');
assert(src.indexOf('var quotes = quotes_();') < src.indexOf('if (!quotes) alertQuotesMissing_'), '조회 직후에 판단');
assert((src.match(/function preflightQuotes\(\)/g) || []).length === 1, '사전 점검 진입점은 1개');

console.log('quotes preflight tests: OK');
