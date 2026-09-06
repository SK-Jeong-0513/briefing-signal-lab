// 일일 시황 월요일 생략 — 발송 한도(롤링 24시간) 확보 장치.
// 월요일에 일일과 주간이 함께 나가면 그 두 배치가 화요일 아침 창에 남아 다음 일일을 막는다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// kstDate: Utilities.formatDate 가 돌려줄 "yyyy,M,d" 문자열(KST 기준 날짜).
function mailerContext(kstDate) {
  const state = { logs: [], opened: 0 };
  const context = vm.createContext({
    console,
    Utilities: { formatDate: () => kstDate },
    Logger: { log: (m) => state.logs.push(String(m)) },
    // 가드를 통과하면 반드시 여기까지 온다 — 통과 여부의 관측 지점이다.
    SpreadsheetApp: {
      openById: () => { state.opened++; throw new Error('stop-after-guard'); },
      getActiveSpreadsheet: () => { state.opened++; throw new Error('stop-after-guard'); },
    },
  });
  vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), context);
  vm.runInContext('CFG.MARKET_SHEET_ID = "market-id";', context);
  return { context, state };
}

function runDaily(kstDate) {
  const m = mailerContext(kstDate);
  try { vm.runInContext('sendDailyMarket();', m.context); } catch (e) {
    assert(/stop-after-guard/.test(e.message), '예상 밖 예외: ' + e.message);
  }
  return m.state;
}

const SKIP = (logs) => logs.some((l) => l.includes('월요일'));

// 2026-09-07 은 월요일 — 생략하고 시트를 열지 않는다.
let s = runDaily('2026,9,7');
assert(SKIP(s.logs), '월요일은 생략 로그를 남겨야 함');
assert.strictEqual(s.opened, 0, '월요일은 시트를 열기 전에 반환해야 함');

// 2026-09-08 화요일 · 09-06 일요일 — 생략하지 않고 본 경로로 들어간다.
for (const [d, name] of [['2026,9,8', '화요일'], ['2026,9,6', '일요일'], ['2026,9,4', '금요일']]) {
  s = runDaily(d);
  assert(!SKIP(s.logs), name + '은 생략하면 안 됨');
  assert(s.opened > 0, name + '은 본 경로로 진입해야 함');
}

// 월 경계 — 2026-10-05 도 월요일이다(자릿수 파싱 회귀 방지).
s = runDaily('2026,10,5');
assert(SKIP(s.logs), '두 자리 월도 월요일로 판정해야 함');

console.log('test_daily_monday_skip.js OK');
