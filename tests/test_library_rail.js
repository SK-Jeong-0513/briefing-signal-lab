// 서재 캐러셀 — 화살표 표시 경계와 이동 폭 검증.
//
// 이 두 가지가 틀리면 증상이 조용하다. 끝에 닿았는데 화살표가 남아 있으면 눌러도
// 아무 일이 없어 고장으로 읽히고, 이동 폭이 어긋나면 카드가 반쯤 걸쳐 멈춘다.
// 브라우저 자동화·jsdom 없이 돌리려고 script.js 에서 두 함수만 떼어 vm 으로 실행한다
// (기존 테스트들과 같은 방식). 함수 이름이 바뀌면 여기서 먼저 깨진다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'script.js'), 'utf8');

function extract(name) {
  const start = SRC.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' 를 script.js 에서 찾지 못했습니다');
  let depth = 0, i = SRC.indexOf('{', start);
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(start, j + 1);
  }
  throw new Error(name + ' 본문 파싱 실패');
}

function load(gap) {
  const ctx = vm.createContext({
    getComputedStyle: () => ({ columnGap: gap === undefined ? '24px' : gap }),
  });
  vm.runInContext(extract('railStep') + '\n' + extract('refreshRail'), ctx);
  return ctx;
}

/* 최소 DOM 스텁 — querySelector/closest/hidden 만 쓴다. */
function makeRail(opts) {
  const prev = { hidden: false };
  const next = { hidden: false };
  const rail = {
    querySelector: (sel) => (sel.indexOf('prev') >= 0 ? prev : next),
  };
  const card = opts.cardWidth === null ? null
    : { getBoundingClientRect: () => ({ width: opts.cardWidth }) };
  const grid = {
    scrollLeft: opts.scrollLeft || 0,
    scrollWidth: opts.scrollWidth || 0,
    clientWidth: opts.clientWidth || 0,
    querySelector: () => card,
    closest: () => (opts.detached ? null : rail),
  };
  return { grid, prev, next };
}

let pass = 0;
function check(label, fn) { fn(); pass++; console.log('  ok  ' + label); }

console.log('railStep — 카드 1장 + 간격');
{
  const ctx = load('24px');
  check('카드 폭 + 간격', () => {
    const { grid } = makeRail({ cardWidth: 320 });
    assert.strictEqual(ctx.railStep(grid), 344);
  });
  check('간격을 못 읽으면 0으로 두고 카드 폭만', () => {
    const c2 = load('normal');   // grid gap 이 'normal' 로 오는 브라우저가 있다
    const { grid } = makeRail({ cardWidth: 320 });
    assert.strictEqual(c2.railStep(grid), 320);
  });
  check('카드가 없으면 한 화면만큼', () => {
    const { grid } = makeRail({ cardWidth: null, clientWidth: 900 });
    assert.strictEqual(ctx.railStep(grid), 900);
  });
}

console.log('refreshRail — 화살표 표시 경계');
{
  const ctx = load();
  check('맨 왼쪽이면 이전 화살표를 감춘다', () => {
    const { grid, prev, next } = makeRail({ scrollLeft: 0, scrollWidth: 2000, clientWidth: 1000 });
    ctx.refreshRail(grid);
    assert.strictEqual(prev.hidden, true);
    assert.strictEqual(next.hidden, false);
  });
  check('맨 오른쪽이면 다음 화살표를 감춘다', () => {
    const { grid, prev, next } = makeRail({ scrollLeft: 1000, scrollWidth: 2000, clientWidth: 1000 });
    ctx.refreshRail(grid);
    assert.strictEqual(prev.hidden, false);
    assert.strictEqual(next.hidden, true);
  });
  check('중간이면 양쪽 다 보인다', () => {
    const { grid, prev, next } = makeRail({ scrollLeft: 500, scrollWidth: 2000, clientWidth: 1000 });
    ctx.refreshRail(grid);
    assert.strictEqual(prev.hidden, false);
    assert.strictEqual(next.hidden, false);
  });
  check('소수점 스크롤 잔여를 끝으로 인정한다', () => {
    // 브라우저가 999.6 같은 값을 남긴다. 1px 여유가 없으면 '끝인데 끝이 아닌' 상태가 되어
    // 눌러도 안 움직이는 화살표가 남는다.
    const { grid, next } = makeRail({ scrollLeft: 999.6, scrollWidth: 2000, clientWidth: 1000 });
    ctx.refreshRail(grid);
    assert.strictEqual(next.hidden, true);
  });
  check('카드가 3장 이하라 넘길 곳이 없으면 양쪽 다 감춘다', () => {
    const { grid, prev, next } = makeRail({ scrollLeft: 0, scrollWidth: 1000, clientWidth: 1000 });
    ctx.refreshRail(grid);
    assert.strictEqual(prev.hidden, true);
    assert.strictEqual(next.hidden, true);
  });
  check('레일 밖 그리드는 건드리지 않는다', () => {
    const { grid } = makeRail({ detached: true, scrollWidth: 2000, clientWidth: 1000 });
    assert.doesNotThrow(() => ctx.refreshRail(grid));
  });
}

console.log('\n' + pass + ' passed');
