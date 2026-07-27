const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = vm.createContext({ console, Utilities: { formatDate: () => "2026,7,28" } });
vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), context);

const cats = vm.runInContext("weeklyReleaseCats_([{분야:'semicon',유형:'signal',제목ko:'공급망 변화',한줄ko:'병목 관찰'}])", context);
const tech = cats.filter(c => c.key === 'tech')[0];
assert.deepStrictEqual(Array.from(tech.issues.semicon.signals, x => x.t), ['공급망 변화']);
assert.strictEqual(tech.issues['ai-infra'], undefined, '정적 CATS 콘텐츠가 발행 스냅샷에 섞이면 안 됨');

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
console.log('weekly mailer/public safety tests: OK');
