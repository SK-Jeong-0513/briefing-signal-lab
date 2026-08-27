const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = vm.createContext({ console, Utilities: { formatDate: () => "2026,7,28" } });
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
