// 일일 메일 '오늘의 주요 일정' 블록 — 경제 캘린더 CSV 에서 오늘(KST) 행만, 실패는 블록 생략 + 운영자 알림.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Utilities.parseCsv 대역(따옴표·줄바꿈 포함 필드). 실제 Apps Script 는 내장 파서를 쓴다.
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const HEAD = '날짜,지역,분류,영향도,제목,설명,title_en,note_en\n';
const CSV = HEAD + [
  '2026-10-21,미국,실적,높음,테슬라 3분기 실적,어제 일정,,',
  '2026-10-22,중국,경제지표,보통,중국 산업생산,"시간: 21:45\n시간 21:45 | 외화 CNY | 국가 중국 | 이전 51.7",,',
  '2026-10-22,유럽,통화정책 (금리결정),높음,ECB 통화정책회의,유로존 금리 결정 확인,,',
  '2026-10-22,유럽,실적,높음,ECB publishes indicative operational calendars,"the Eurosystem&#x27;s reserve <b>",,',
  '2026-10-22,유럽,통화정책 (금리결정),높음,ECB 통화정책회의,중복행,,',
  '2026-10-23,한국,실적,보통,SK하이닉스 3분기 실적,내일 일정,,',
].join('\n') + '\n';

function ctx(fetchImpl) {
  const logs = [], mails = [];
  const c = vm.createContext({
    console,
    Utilities: { formatDate: () => '2026-10-22', parseCsv },
    Logger: { log: (m) => logs.push(String(m)) },
    UrlFetchApp: { fetch: (url) => fetchImpl(url) },
    MailApp: { sendEmail: (...a) => mails.push(a) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  });
  vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), c);
  return { c, logs, mails };
}
const ok = (body) => () => ({ getResponseCode: () => 200, getContentText: () => body });

// ── 오늘 행만, 중복 제거, 높음 먼저, 시각 메타 설명 제거, 엔티티 해제 ──
let t = ctx(ok(CSV));
let s = vm.runInContext('todaySchedule_()', t.c);
assert.strictEqual(s.today, '2026-10-22');
assert.deepStrictEqual(JSON.parse(JSON.stringify(s.items.map((o) => o.title))),  // vm 컨텍스트 배열은 프로토타입이 달라 JSON 으로 비교
  ['ECB 통화정책회의', 'ECB publishes indicative operational calendars', '중국 산업생산'],
  '오늘 것만 · 같은 제목 1건 · 높음 → 보통(같은 영향도는 시트 순서)');
assert.strictEqual(s.items[0].note, '유로존 금리 결정 확인', '중복행은 첫 행이 이긴다');
assert.strictEqual(s.items[2].note, '', "'시간:' 으로 시작하는 메타 설명은 싣지 않는다(시간대 불명)");
assert(s.items[1].note.includes("Eurosystem's"), '&#x27; 엔티티를 풀어야 함');
assert(t.logs.some((l) => l.includes('[일정] 2026-10-22 3건')), '건수를 로그에 남긴다');

let html = vm.runInContext('scheduleHtml_(todaySchedule_())', t.c);
assert(html.includes('오늘의 주요 일정 · 10-22'), '제목에 날짜');
assert(html.includes('유럽 · 통화정책 (금리결정) · 높음'), '지역·분류·영향도 메타');
assert(html.includes('&lt;b&gt;') && !html.includes('<b>'), '해제한 텍스트는 다시 이스케이프해야 함');
assert(!html.includes('21:45'), '시각은 메일에 없다');
let plain = vm.runInContext('schedulePlain_(todaySchedule_()).join("\\n")', t.c);
assert(plain.includes('[오늘의 주요 일정 · 10-22]') && plain.includes('- ECB 통화정책회의 (유럽 · 통화정책 (금리결정) · 높음) : 유로존 금리 결정 확인'), '평문 누락');

// ── 긴 설명은 120자에서 자른다 ──
t = ctx(ok(HEAD + '2026-10-22,미국,통화정책,높음,FOMC,' + 'x'.repeat(300) + ',,\n'));
assert.strictEqual(vm.runInContext('todaySchedule_()', t.c).items[0].note, 'x'.repeat(120) + ' …', '설명 120자 상한');

// ── 0건: 안내 한 줄(블록은 유지) ──
t = ctx(ok(HEAD + '2026-10-23,한국,실적,보통,내일 일정,,,\n'));
s = vm.runInContext('todaySchedule_()', t.c);
assert.strictEqual(s.items.length, 0);
assert(vm.runInContext('scheduleHtml_(todaySchedule_())', t.c).includes('오늘 예정된 주요 일정이 없습니다.'), '0건 안내(HTML)');
assert(vm.runInContext('schedulePlain_(todaySchedule_()).join("\\n")', t.c).includes('오늘 예정된 주요 일정이 없습니다.'), '0건 안내(평문)');

// ── 상한: 10건 + '외 N건' 캘린더 링크 ──
const many = HEAD + Array.from({ length: 13 }, (_, i) => `2026-10-22,미국,경제지표,${i === 12 ? '높음' : '보통'},지표 ${i},,,`).join('\n') + '\n';
t = ctx(ok(many));
s = vm.runInContext('todaySchedule_()', t.c);
assert.strictEqual(s.items.length, 10); assert.strictEqual(s.more, 3);
assert.strictEqual(s.items[0].title, '지표 12', '상한을 자르기 전에 영향도로 정렬해야 함');
html = vm.runInContext('scheduleHtml_(todaySchedule_())', t.c);
assert(html.includes('외 3건') && html.includes('calendar.html'), '넘친 건수와 캘린더 링크');

// ── 실패 경로: null → 블록 생략 ──
[
  ['HTTP 500', () => ({ getResponseCode: () => 500, getContentText: () => '' })],
  ['헤더 없음', ok('a,b\n1,2\n')],
  ['네트워크 예외', () => { throw new Error('DNS'); }],
].forEach(([name, impl]) => {
  const x = ctx(impl);
  assert.strictEqual(vm.runInContext('todaySchedule_()', x.c), null, name + ' → null');
  assert(x.logs.some((l) => l.startsWith('[일정]')), name + ' → [일정] 로그');
  assert.strictEqual(vm.runInContext('scheduleHtml_(null)', x.c), '', name + ' → HTML 생략');
  assert.strictEqual(vm.runInContext('schedulePlain_(null).length', x.c), 0, name + ' → 평문 생략');
});

// ── 배선: 발송당 1회 조회, 실패하면 운영자 알림(로그만 남기면 아무도 안 본다) ──
const src = fs.readFileSync('mailer/Code.gs', 'utf8');
assert(src.includes('var sched = todaySchedule_();') && src.includes('if (!sched) alertScheduleMissing_(dg.today);'), '조회 직후 실패 알림');
assert(src.indexOf('var sched = todaySchedule_();') < src.indexOf('for (var n = 0; n < targets.length; n++)'), '수신자 루프 밖에서 1회');
assert(!/CAL_CSV_URL/.test(src.slice(src.indexOf('const CFG'), src.indexOf('const CATS'))), 'CFG 밖에 둔다(52행~끝 교체 배포)');

console.log('daily today-events block tests: OK');
