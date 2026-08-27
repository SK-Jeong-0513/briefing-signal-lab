// 주간 딥다이브 렌더 — 사이트(공개) 쪽.
//
// ⚠️ 이 테스트가 지키는 핵심 불변식은 하나다: **published 에 조인되지 않은 딥다이브는 그리지 않는다.**
//    채점(월 06:00)이 발송(월 09:00)보다 3시간 빠르다. 조인 없이 딥다이브 CSV 만으로 그리면
//    아직 공개되지 않은 호의 딥다이브가 사이트에 3시간 미리 샌다. 정적 검사로는 증명이 안 되므로
//    실제로 렌더를 돌려 결과 HTML 을 본다.
//
// 두 번째로 지키는 것은 헤더 소문자 함정이다. mktRows 가 헤더를 toLowerCase 하므로
// '출처URL' 은 '출처url' 로 들어온다. 대문자로 읽으면 undefined 라 조인이 **통째로 조용히**
// 빈다(에러 없음, 섹션만 안 보임). 이 프로젝트가 같은 유형으로 이미 여러 번 당했다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ITEMS_URL = 'test://items.csv';
const DEEP_URL = 'test://deep.csv';

// ── 픽스처 ────────────────────────────────────────────────────────────────
// 발행항목: 최신 호는 2026-W36 rev.1. W35 는 지난 호(섞여 들어오면 안 된다).
const ITEMS_CSV = [
  '상태,issue_key,revision,분야,유형,제목ko,제목en,한줄ko,한줄en,출처URL,published_at,updated_at',
  'published,2026-W36,1,semicon,headliner,HBM4 램프,HBM4 ramp,한 줄,one line,https://e.com/u1,2026-08-31,2026-08-31',
  'published,2026-W36,1,semicon,signal,CPO 상용화,CPO ship,한 줄,one line,https://e.com/u2,2026-08-31,2026-08-31',
  'published,2026-W36,1,semicon,signal,장비 리드타임,Tool lead time,한 줄,one line,https://e.com/u3,2026-08-31,2026-08-31',
  'published,2026-W36,1,semicon,signal,후공정 증설,OSAT capex,한 줄,one line,https://e.com/u4,2026-08-31,2026-08-31',
  'published,2026-W36,1,kr-equity,headliner,외국인 수급,Foreign flows,한 줄,one line,https://e.com/u5,2026-08-31,2026-08-31',
  'published,2026-W35,1,semicon,signal,지난 호 신호,Last issue,한 줄,one line,https://e.com/old,2026-08-24,2026-08-24',
].join('\n');

// 딥다이브: 조인되는 5건 + 조인 안 되는 2건(반드시 버려져야 한다).
const DEEP_CSV = [
  'issue_key,revision,분야,출처URL,영향도,선행성,파급범위,딥다이브ko,관전포인트,근거,엔진,created_at',
  '2026-W36,1,semicon,https://e.com/u2,70,80,60,본문-U2,관전-U2,근거-U2,gemini,2026-08-31',
  '2026-W36,1,semicon,https://e.com/u1,90,95,85,본문-U1,관전-U1,근거-U1,gemini,2026-08-31',
  '2026-W36,1,semicon,https://e.com/u3,50,55,45,본문-U3,관전-U3,근거-U3,gemini,2026-08-31',
  '2026-W36,1,semicon,https://e.com/u4,40,45,35,본문-U4,관전-U4,근거-U4,gemini,2026-08-31',
  '2026-W36,1,kr-equity,https://e.com/u5,85,80,90,본문-U5,관전-U5,근거-U5,gemini,2026-08-31',
  // ↓ published 에 없는 출처 — 미공개분이 새는 경로
  '2026-W36,1,semicon,https://e.com/LEAK,99,99,99,본문-누출,관전-누출,근거-누출,gemini,2026-08-31',
  // ↓ 아직 발행되지 않은 다음 호 — 3시간 선행 유출 경로
  '2026-W37,1,semicon,https://e.com/u1,99,99,99,본문-차주,관전-차주,근거-차주,gemini,2026-09-07',
].join('\n');

// ── DOM 스텁 ──────────────────────────────────────────────────────────────
function FakeEl(sel) {
  this._sel = sel || '';
  this.innerHTML = '';
  this.textContent = '';
  this.hidden = false;
  this.classList = { add() {}, remove() {}, contains() { return false; } };
  this.style = {};
  this.__section = null;
  this.children = [];
  this.scrollLeft = 0;
  this.clientWidth = 0;
  this.offsetWidth = 0;
}
// 서재 레일 등 이 테스트와 무관한 렌더러가 조상을 타고 올라간다 — 무해한 껍데기를 준다.
Object.defineProperty(FakeEl.prototype, 'parentElement', {
  get() {
    if (!this.__parent) this.__parent = new FakeEl('parent-of:' + this._sel);
    return this.__parent;
  },
});
FakeEl.prototype.closest = function (sel) {
  if (sel === '[data-deepdive-section]') {
    if (!this.__section) this.__section = new FakeEl(sel);
    return this.__section;
  }
  return null;
};
FakeEl.prototype.addEventListener = function () {};
FakeEl.prototype.appendChild = function (c) { this.children.push(c); return c; };
FakeEl.prototype.removeChild = function (c) { return c; };
FakeEl.prototype.remove = function () {};
FakeEl.prototype.insertBefore = function (c) { return c; };
FakeEl.prototype.removeAttribute = function () {};
FakeEl.prototype.setAttribute = function () {};
FakeEl.prototype.getAttribute = function () { return null; };
FakeEl.prototype.querySelector = function () { return null; };
FakeEl.prototype.querySelectorAll = function () { return []; };
FakeEl.prototype.contains = function () { return false; };

const els = {};
const el = (sel) => (els[sel] = els[sel] || new FakeEl(sel));

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  String,
  Number,
  Object,
  Array,
  encodeURIComponent,
  URLSearchParams,
  location: { search: '', pathname: '/tech.html', href: 'https://brevislab.com/tech.html' },
  document: {
    documentElement: new FakeEl('html'),
    readyState: 'complete',
    addEventListener() {},
    getElementById() { return null; },
    createElement: (tag) => new FakeEl('<' + tag + '>'),
    head: new FakeEl('head'),
    body: new FakeEl('body'),
    querySelector: (sel) => el(sel),
    querySelectorAll: () => [],
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  Image: function () {},
  IntersectionObserver: function () { this.observe = function () {}; this.unobserve = function () {}; },
  fetch: (url) => {
    const body = url === ITEMS_URL ? ITEMS_CSV : url === DEEP_URL ? DEEP_CSV : '';
    return Promise.resolve({ text: () => Promise.resolve(body) });
  },
};
sandbox.window = sandbox;
sandbox.window.matchMedia = () => ({ matches: false });
sandbox.window.addEventListener = () => {};

const ctx = vm.createContext(sandbox);
const read = (p) => fs.readFileSync(p, 'utf8');

['tech', 'finance', 'economy'].forEach((c) =>
  vm.runInContext(read('public/assets/content/' + c + '.js'), ctx));

// site.js 의 CSV 상수는 const 라 나중에 못 바꾼다 — 로드 전에 테스트 URL 로 갈아끼운다.
let site = read('public/assets/content/site.js');
site = site.replace('const WEEKLY_RELEASE_ITEMS_CSV = "";', 'const WEEKLY_RELEASE_ITEMS_CSV = "' + ITEMS_URL + '";');
site = site.replace('const WEEKLY_DEEPDIVE_CSV = "";', 'const WEEKLY_DEEPDIVE_CSV = "' + DEEP_URL + '";');
assert(site.includes(ITEMS_URL), '발행항목 CSV 상수를 찾지 못했다 — site.js 선언이 바뀌었나');
assert(site.includes(DEEP_URL), '딥다이브 CSV 상수를 찾지 못했다 — site.js 선언이 바뀌었나');
vm.runInContext(site, ctx);
vm.runInContext(read('public/assets/script.js'), ctx);

// fetch 두 단계(발행항목 → 딥다이브)가 끝날 때까지 마이크로태스크를 흘려보낸다.
const settle = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  for (let i = 0; i < 20; i++) await settle();

  const tech = el('[data-tech-deepdive]');
  const finance = el('[data-finance-deepdive]');
  const economy = el('[data-economy-deepdive]');

  // ── ⭐ 유출 방지: 조인 안 된 딥다이브는 어디에도 없어야 한다 ──────────────
  const all = tech.innerHTML + finance.innerHTML + economy.innerHTML;
  assert(!all.includes('본문-누출'),
    'published 에 없는 출처URL 의 딥다이브가 렌더됐다 — 조인 가드가 뚫렸다');
  assert(!all.includes('본문-차주'),
    '아직 발행되지 않은 다음 호(W37) 딥다이브가 렌더됐다 — 발송 3시간 전 유출 경로');

  // ── 조인된 것은 그려진다(빈 테스트 방지 — 위 두 줄이 "아무것도 안 그려서" 통과하면 안 된다) ──
  assert(tech.innerHTML.includes('본문-U1'), 'U1 딥다이브가 렌더돼야 한다');
  assert(tech.innerHTML.includes('본문-U2'), 'U2 딥다이브가 렌더돼야 한다');
  assert(tech.innerHTML.includes('본문-U3'), 'U3 딥다이브가 렌더돼야 한다');

  // ── 카테고리당 3건 상한 ────────────────────────────────────────────────
  assert(!tech.innerHTML.includes('본문-U4'), '카테고리당 3건까지만 — 4번째는 잘려야 한다');
  assert.strictEqual((tech.innerHTML.match(/<article class="card deep-card">/g) || []).length, 3,
    '기술 딥다이브 카드는 3장');

  // ── 영향도 내림차순 ────────────────────────────────────────────────────
  const at = (s) => tech.innerHTML.indexOf(s);
  assert(at('본문-U1') < at('본문-U2') && at('본문-U2') < at('본문-U3'),
    '영향도 90 > 70 > 50 순으로 정렬돼야 한다');

  // ── 카테고리 분리: 금융 딥다이브가 기술 페이지에 섞이지 않는다 ─────────
  assert(finance.innerHTML.includes('본문-U5'), 'kr-equity 딥다이브는 금융 페이지로');
  assert(!tech.innerHTML.includes('본문-U5'), '금융 딥다이브가 기술 페이지에 섞였다');

  // ── 제목은 딥다이브 CSV 가 아니라 published 항목에서 온다(조인의 목적) ──
  assert(tech.innerHTML.includes('HBM4 램프'), '카드 제목은 published 발행항목에서 가져온다');

  // ── 딥다이브는 잠금이 아니다: blur 를 푸는 변형 클래스가 붙어야 한다 ────
  assert(tech.innerHTML.includes('deep-row--open'),
    '.deep-row__v 기본값이 blur 라 --open 없이는 본문이 흐리게 나온다');
  const css = read('public/assets/style.css');
  assert(/\.deep-row--open\s+\.deep-row__v\s*\{[^}]*filter:\s*none/.test(css),
    'style.css 에 .deep-row--open 의 blur 해제가 있어야 한다');

  // ── 딥다이브 없는 카테고리는 섹션을 감춘다(빈 상자 금지) ────────────────
  assert.strictEqual(economy.innerHTML, '', '경제는 딥다이브가 없으니 비어야 한다');
  assert.strictEqual(economy.closest('[data-deepdive-section]').hidden, true,
    '딥다이브 없는 카테고리는 섹션째 감춘다');
  assert.strictEqual(tech.closest('[data-deepdive-section]').hidden, false,
    '딥다이브 있는 카테고리는 섹션이 보여야 한다');

  // ── 소문자 헤더 함정 회귀 방어 ─────────────────────────────────────────
  const script = read('public/assets/script.js');
  const fn = script.slice(script.indexOf('function loadWeeklyDeepdive()'),
                          script.indexOf('function deepCardHtml('));
  assert(fn.includes('"출처url"'),
    'mktRows 가 헤더를 소문자화한다 — 출처URL 로 읽으면 조인이 조용히 빈다');
  assert(!/o\["출처URL"\]/.test(fn), '대문자 출처URL 로 읽으면 undefined 다');

  // ── 정적 구조: 3개 페이지에 호스트와 섹션이 있고 기본은 hidden ──────────
  [['tech', 'tech'], ['finance', 'finance'], ['economy', 'economy']].forEach(([page, key]) => {
    const html = read('public/' + page + '.html');
    assert(html.includes('data-' + key + '-deepdive'), page + '.html 에 딥다이브 호스트가 없다');
    const sec = html.slice(html.indexOf('data-deepdive-section') - 40,
                           html.indexOf('data-deepdive-section') + 40);
    assert(sec.includes('hidden'),
      page + '.html 딥다이브 섹션은 기본 hidden — 딥다이브 없는 주에 빈 제목만 남으면 안 된다');
  });

  console.log('test_weekly_deepdive_render.js: 모든 검사 통과');
})().catch((e) => { console.error(e); process.exit(1); });
