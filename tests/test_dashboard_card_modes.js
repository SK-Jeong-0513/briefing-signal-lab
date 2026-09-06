// 대시보드 카드의 변화 표시 — 지표 유형별 계산(chgByMode).
//
// 여기 잠그는 것은 '값은 나오는데 뜻이 틀린' 종류다. 화면은 멀쩡하고 콘솔도 조용하다.
//   · yoy 가 v[n-12] 를 보면 12개월이 아니라 11개월 전과 비교된다
//   · baseline100 의 부호가 뒤집히면 낙관이 비관으로 읽힌다
//   · 모드를 못 알아들으면 pctChg(v[n-22]) 로 떨어져 월간 시리즈가
//     22개월 전 대비를 "~1M" 이라 찍는다 — 아무도 눈치채지 못한다
//
// dashboard.js 는 IIFE 라 내부 함수를 밖에서 못 잡는다. 이름으로 떼어내 평가한다.
// 함수 이름을 바꾸면 여기서 먼저 깨진다 — 의도한 것이다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync('public/assets/dashboard.js', 'utf8');

// 중괄호 균형으로 named function 하나를 잘라낸다.
function extract(name) {
  const head = SRC.indexOf('function ' + name + '(');
  assert(head >= 0, name + ' 을(를) dashboard.js 에서 찾지 못했다 — 이름이 바뀌었나');
  let i = SRC.indexOf('{', head), depth = 0;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (!depth) return SRC.slice(head, j + 1); }
  }
  throw new Error(name + ' 의 본문이 닫히지 않았다');
}

const ctx = vm.createContext({ Math, Number });
vm.runInContext(extract('fmtNum') + '\n' + extract('chgByMode'), ctx);
const chg = (v, mode) => vm.runInContext('chgByMode(' + JSON.stringify(v) + ',' + JSON.stringify(mode) + ')', ctx);

// ── yoy — 전년동월비. 13번째 뒤를 봐야 12개월 전이다 ──
const yoy = Array(11).fill(105).concat([110]);   // 길이 12 → 아직 부족
assert.strictEqual(chg(yoy, 'yoy'), null, '13개월이 안 되면 yoy 를 계산하면 안 된다');

const yoy13 = [100].concat(Array(11).fill(105)).concat([110]);  // 길이 13, v[0]=100
let r = chg(yoy13, 'yoy');
assert.strictEqual(r.text, '+10.0% YoY', '12개월 전(v[n-13]) 대비여야 한다: ' + JSON.stringify(r));
assert(r.val > 0);

// ── mom — 전월비 ──
r = chg([100, 103], 'mom');
assert.strictEqual(r.text, '+3.0% 전월비');
r = chg([100, 97], 'mom');
assert.strictEqual(r.text, '-3.0% 전월비');
assert(r.val < 0, '하락은 dir 이 down 이어야 한다');

// ── diff — 전월 대비 절대차. BSI·경상수지처럼 % 가 무의미하거나 부호가 바뀌는 것 ──
r = chg([75, 77], 'diff');
assert(/^\+2\b/.test(r.text) && /전월차$/.test(r.text), 'diff 표기: ' + r.text);
r = chg([49730.4, 42078], 'diff');
assert(r.val < 0, '경상수지 감소는 음수여야 한다');

// ── baseline100 — 기준선 100 대비. CSI·ESI·선행지수순환변동치 전용 ──
r = chg([104.5], 'baseline100');
assert.strictEqual(r.text, '+4.5 기준선');
r = chg([96.7], 'baseline100');
assert.strictEqual(r.text, '-3.3 기준선');

// ⚠️ BSI 에 baseline100 을 쓰면 평년 수준 77 이 '기준선 -23' 으로 읽힌다.
// 실측 평균이 75.3(범위 51~95)이라 100 은 BSI 의 기준선이 아니다.
r = chg([77], 'baseline100');
assert.strictEqual(r.text, '-23.0 기준선',
  'baseline100 자체는 맞게 계산된다 — BSI 에 이 모드를 쓰면 안 된다는 것이 요점(test_dashboard_pairs.py 가 잠근다)');

// ── 모르는 모드는 null 로 떨어뜨려 호출부가 기존 계산을 쓰게 한다 ──
assert.strictEqual(chg([1, 2, 3], 'nope'), null);
assert.strictEqual(chg([1, 2, 3], ''), null);

// ── 0 나눗셈 방어 — 지수가 0 인 달이 섞이면 Infinity 가 화면에 찍힌다 ──
assert.strictEqual(chg([0, 5], 'mom'), null, '분모가 0 이면 계산하지 않는다');
const zeroBase = [0].concat(Array(11).fill(105)).concat([110]);
assert.strictEqual(chg(zeroBase, 'yoy'), null, 'yoy 분모가 0 이면 계산하지 않는다');

// ── vcCard 가 mode 를 실제로 넘겨받는지(연결 확인) ──
assert(/function vcCard\(name, unit, v, manual, period, mode\)/.test(SRC),
  'vcCard 가 mode 인자를 받지 않으면 카드가 조용히 pctChg 로 떨어진다');
assert(/vcCard\(s\.name, s\.unit, s\.v, false, s\.period, s\.mode\)/.test(SRC),
  'renderKrMacro 가 series 의 mode/period 를 넘기지 않는다');

console.log('test_dashboard_card_modes.js OK');
