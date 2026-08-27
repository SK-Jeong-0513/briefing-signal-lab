const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = vm.createContext({
  console,
  Utilities: { formatDate: () => "2026,7,28" },
  Logger: { log() {} },   // Apps Script 전역 — 딥다이브 조인이 진단 로그를 남긴다
});
vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), context);

const cats = vm.runInContext("weeklyReleaseCats_([{분야:'semicon',유형:'signal',제목ko:'공급망 변화',한줄ko:'병목 관찰'}])", context);
const tech = cats.filter(c => c.key === 'tech')[0];
assert.deepStrictEqual(Array.from(tech.issues.semicon.signals, x => x.t), ['공급망 변화']);
assert.strictEqual(tech.issues['ai-infra'], undefined, '정적 CATS 콘텐츠가 발행 스냅샷에 섞이면 안 됨');

// ── 헤드라이너 강등 (2026-08-27) ──
// 분야당 1개만 렌더되는데, 종전에는 두 번째부터 signals 에서도 빠져 통째로 사라졌다.
// W35 semicon 에 headliner 2건이 있어 실제로 1건이 소실 중이었다(경고 없음).
function catsOf(rows, key) {
  const out = vm.runInContext('weeklyReleaseCats_(' + JSON.stringify(rows) + ')', context);
  return out.filter(c => c.key === key)[0];
}
const H = (t) => ({ 분야: 'semicon', 유형: 'headliner', 제목ko: t, 한줄ko: t + ' 요약' });
const S = (t) => ({ 분야: 'semicon', 유형: 'signal', 제목ko: t, 한줄ko: t + ' 요약' });

let two = catsOf([H('첫 헤드'), S('신호A'), H('둘째 헤드'), S('신호B')], 'tech').issues.semicon;
assert.strictEqual(two.head.title, '첫 헤드', '첫 헤드라이너가 head 로');
assert.deepStrictEqual(Array.from(two.signals, x => x.t), ['신호A', '둘째 헤드', '신호B'],
  '두 번째 헤드라이너는 버리지 말고 신호로 강등 + 원래 행 순서 유지');

let one = catsOf([H('유일 헤드'), S('신호A')], 'tech').issues.semicon;
assert.strictEqual(one.head.title, '유일 헤드');
assert.deepStrictEqual(Array.from(one.signals, x => x.t), ['신호A'], '헤드라이너 1개면 종전과 동일');

// 헤드라이너가 없으면 종전 동작 그대로 — rows[0] 이 head 이자 signal 로 남는다
let none = catsOf([S('신호A'), S('신호B')], 'tech').issues.semicon;
assert.strictEqual(none.head.title, '신호A');
assert.deepStrictEqual(Array.from(none.signals, x => x.t), ['신호A', '신호B'], '헤드라이너 부재 경로는 불변');

// 헤드라이너만 여러 개면 첫 개는 head, 나머지는 signals
let allHead = catsOf([H('h1'), H('h2'), H('h3')], 'tech').issues.semicon;
assert.strictEqual(allHead.head.title, 'h1');
assert.deepStrictEqual(Array.from(allHead.signals, x => x.t), ['h2', 'h3'], '나머지 헤드라이너가 전부 살아야 함');

// ── 주간 메일 딥다이브 (2026-08-27, 핸드오프 6번) ──────────────────────
// 메일러는 CSV 가 아니라 시트를 직접 읽는다. 그래서 사이트와 함정이 정반대다:
//   사이트 mktRows 는 헤더를 toLowerCase 해서 '출처url',
//   메일러 weeklyTable_ 은 원본 그대로라 '출처URL'.
// 한쪽 코드를 복사해 오면 조인이 에러 없이 통째로 빈다.
const mailerSrc = fs.readFileSync('mailer/Code.gs', 'utf8');
const ddFn = mailerSrc.slice(mailerSrc.indexOf('function weeklyDeepdiveByCat_'),
                             mailerSrc.indexOf('function weeklyReleaseCats_'));
assert(/r\['출처URL'\]/.test(ddFn), "메일러는 헤더를 그대로 읽는다 — '출처URL' 대문자");
assert(!/출처url/.test(ddFn), "사이트용 소문자 키를 복사해 오면 조인이 조용히 빈다");
assert(/딥다이브ko/.test(ddFn), '딥다이브 본문 열을 읽어야 한다');

// 조인: 이번 호에 실제로 나가는 항목의 딥다이브만 싣는다.
const ITEMS = [
  { 분야: 'semicon', 유형: 'headliner', 제목ko: 'HBM4 램프', 한줄ko: '한 줄', 출처URL: 'u1' },
  { 분야: 'semicon', 유형: 'signal', 제목ko: 'CPO 상용화', 한줄ko: '한 줄', 출처URL: 'u2' },
  { 분야: 'kr-equity', 유형: 'headliner', 제목ko: '외국인 수급', 한줄ko: '한 줄', 출처URL: 'u5' },
];
const DEEP_ROWS = [
  { issue_key: 'W36', revision: 1, 출처URL: 'u2', 영향도: 70, 딥다이브ko: '본문-U2', 관전포인트: '관전-U2' },
  { issue_key: 'W36', revision: 1, 출처URL: 'u1', 영향도: 90, 딥다이브ko: '본문-U1', 관전포인트: '관전-U1' },
  { issue_key: 'W36', revision: 1, 출처URL: 'u5', 영향도: 85, 딥다이브ko: '본문-U5', 관전포인트: '' },
  // ↓ 이번 호 items 에 없는 출처 — 본문에 없는 기사의 해설이 붙으면 안 된다
  { issue_key: 'W36', revision: 1, 출처URL: 'GHOST', 영향도: 99, 딥다이브ko: '본문-유령', 관전포인트: '' },
  // ↓ 다른 호
  { issue_key: 'W35', revision: 1, 출처URL: 'u1', 영향도: 99, 딥다이브ko: '본문-지난호', 관전포인트: '' },
];
context.__ss = {
  getSheetByName: () => ({ getName: () => '주간-딥다이브' }),
};
context.__items = ITEMS;
context.__deepRows = DEEP_ROWS;
// weeklyTable_ 을 픽스처로 대체(시트 접근 없이 조인 로직만 본다)
vm.runInContext('var __realTable = weeklyTable_; weeklyTable_ = function () { return { rows: __deepRows }; };', context);
const byCat = vm.runInContext('weeklyDeepdiveByCat_(__ss, "W36", 1, __items)', context);
vm.runInContext('weeklyTable_ = __realTable;', context);

assert.deepStrictEqual(Array.from(byCat.tech || [], (d) => d.body), ['본문-U1', '본문-U2'],
  '기술 딥다이브는 영향도 내림차순(90 > 70)');
assert.deepStrictEqual(Array.from(byCat.finance || [], (d) => d.body), ['본문-U5'],
  'kr-equity 딥다이브는 금융 카테고리로');
const allBodies = Object.keys(byCat).reduce((a, k) => a.concat(byCat[k].map((d) => d.body)), []);
assert(!allBodies.includes('본문-유령'), '이번 호 items 에 없는 출처의 딥다이브가 실렸다 — 조인 실패');
assert(!allBodies.includes('본문-지난호'), '지난 호(W35) 딥다이브가 이번 호 메일에 실렸다');
// 제목은 딥다이브 행이 아니라 발행항목에서 온다(조인의 목적)
assert.strictEqual(byCat.tech[0].title, 'HBM4 램프', '카드 제목은 발행항목에서 가져온다');

// 딥다이브 탭이 없으면 발송을 막지 않는다 — 부가물이라 없어도 메일은 나가야 한다.
// ⚠ vm 안에서 만든 객체는 프로토타입 realm 이 달라 deepStrictEqual 이 값과 무관하게 실패한다.
//    키 개수로 본다.
context.__noSs = { getSheetByName: () => null };
const empty = vm.runInContext('weeklyDeepdiveByCat_(__noSs, "W36", 1, __items)', context);
assert.strictEqual(Object.keys(empty).length, 0,
  '딥다이브 탭이 없으면 빈 맵 — 예외를 던져 발송을 막으면 안 된다');

// 구독자가 고른 분야것만 싣는다(안 고른 분야 해설이 붙으면 본문 없는 참조가 된다).
const catsWithDeep = vm.runInContext(
  'weeklyReleaseCats_(' + JSON.stringify(ITEMS) + ', ' + JSON.stringify(byCat) + ')', context);
const techCat = catsWithDeep.filter((c) => c.key === 'tech')[0];
assert.strictEqual(techCat.deepdive.length, 2, 'cat.deepdive 가 붙어야 한다');
assert.strictEqual(vm.runInContext('deepSection_(' + JSON.stringify(techCat) + ', [])', context), '',
  '고른 분야가 없으면 딥다이브 블록 자체를 안 낸다');
const secAll = vm.runInContext('deepSection_(' + JSON.stringify(techCat) + ', ["semicon"])', context);
assert(secAll.includes('본문-U1') && secAll.includes('이번 주 딥다이브'), 'semicon 구독자는 딥다이브를 본다');
// weeklyReleaseCats_ 는 인자 1개로도 종전처럼 동작해야 한다(호출부가 하나뿐이지만 계약 유지)
assert.strictEqual(
  vm.runInContext('weeklyReleaseCats_(' + JSON.stringify(ITEMS) + ')', context)
    .filter((c) => c.key === 'tech')[0].deepdive.length, 0, '딥다이브 인자 없으면 빈 배열');

const sent = vm.runInContext("weeklySentMap_({rows:[{issue_key:'2026-W31',revision:1,recipient_hash:'a',status:'sent'},{issue_key:'2026-W31',revision:1,recipient_hash:'b',status:'failed'},{issue_key:'2026-W30',revision:1,recipient_hash:'c',status:'sent'}]},'2026-W31',1)", context);
assert.strictEqual(sent.a, 1);
assert.strictEqual(sent.b, undefined);
assert.strictEqual(sent.c, undefined);
assert.strictEqual(vm.runInContext('weeklyIsoIssue_(0)', context), '2026-W31');

const mailer = fs.readFileSync('mailer/Code.gs', 'utf8');
assert(mailer.includes('if (!CFG.TEST_MODE) weeklyPublish_(bundle);'), 'TEST_MODE가 발행 원장을 변경하면 안 됨');
assert(mailer.includes('LockService.getScriptLock()'), '동시 트리거가 중복 발송하면 안 됨');
const publicScript = fs.readFileSync('public/assets/script.js', 'utf8');
assert(publicScript.includes('!== "published"'), '공개 렌더는 published만 허용해야 함');
assert(!publicScript.includes('WEEKLY_SHEET_CSV'), 'raw approved CSV 참조가 남아 있으면 안 됨');
assert(publicScript.includes('var isHead = (o["유형"] || o["type"] || "").toLowerCase() === "headliner";'),
  '사이트 렌더러도 헤드라이너 판정을 먼저 하고');
assert(publicScript.includes('if (isHead && !bucket.headliner) {'),
  '두 번째 헤드라이너는 else if 로 흘러 신호가 돼야 함');
assert(!publicScript.includes('if (!bucket.headliner) bucket.headliner = {'),
  '옛 중첩 분기(두 번째 헤드라이너를 버리는 형태)가 남아 있으면 안 된다');
console.log('weekly mailer/public safety tests: OK');
