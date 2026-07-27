// 일일 메일 '주요 시장 지표' 블록 — 조회 실패·낡음 처리와 렌더 검증.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const SNAPSHOT = {
  asof: '2026-07-24', updated: '2026-07-27', note: 'x',
  rows: [
    { label: '나스닥', value: '24,975.82', change: '-0.6%', dir: -1 },
    { label: 'S&P500', value: '7,411.98', change: '+0.0%', dir: 0 },
    { label: 'US10Y', value: '4.679%', change: '+3bp', dir: 1 },
  ],
};

// now = 메일 발송 시각(고정). fetch = quotes.json 응답 스텁.
function ctx(now, fetchImpl) {
  const logs = [];
  const RealDate = Date;
  const c = vm.createContext({
    console,
    Utilities: { formatDate: () => '2026,7,28' },
    Logger: { log: (m) => logs.push(String(m)) },
    UrlFetchApp: { fetch: fetchImpl },
    Date: class extends RealDate {
      constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(now); }
      static now() { return new RealDate(now).getTime(); }
    },
  });
  vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), c);
  return { c, logs };
}
const ok = (body) => () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(body) });

// ── 정상 렌더 ──
let { c } = ctx('2026-07-27T00:00:00Z', ok(SNAPSHOT));
let q = vm.runInContext('quotes_()', c);
assert.strictEqual(q.asof, '2026-07-24');
let html = vm.runInContext('quotesHtml_(' + JSON.stringify(SNAPSHOT) + ')', c);
assert((html.match(/<tr>/g) || []).length === 2, '3행이면 2열 2행(마지막은 한 칸)');
assert((html.match(/<td/g) || []).length === 4, '홀수 행은 빈 칸으로 채워야 함');
assert(html.includes('미 증시 07-24 마감 기준'), '기준 거래일을 명시해야 함');
assert(html.includes('#C9342F') && html.includes('-0.6%'), '하락은 danger 색');
assert(html.includes('#12733E') && html.includes('+3bp'), '상승은 success 색');
assert(html.includes('#5F6B7A') && html.includes('+0.0%'), '보합은 muted 색');
assert(!html.includes('font-size:13px') && html.includes('font-size:12px'), '지표는 본문보다 작은 12px');
// 부호는 색과 무관하게 항상 남아야 한다(색맹·다크모드 방어선)
SNAPSHOT.rows.forEach((r) => assert(/^[+-]/.test(r.change), '부호 항상 표기: ' + r.change));

// ── 실패 경로: 전부 블록 생략, 메일은 정상 ──
const skip = [
  ['HTTP 404', () => ({ getResponseCode: () => 404, getContentText: () => '' })],
  ['깨진 JSON', () => ({ getResponseCode: () => 200, getContentText: () => 'not json' })],
  ['빈 rows', ok({ asof: '2026-07-24', rows: [] })],
  ['asof 없음', ok({ rows: SNAPSHOT.rows })],
  ['네트워크 예외', () => { throw new Error('DNS'); }],
];
skip.forEach(([name, impl]) => {
  const t = ctx('2026-07-27T00:00:00Z', impl);
  assert.strictEqual(vm.runInContext('quotes_()', t.c), null, name + ' → null 이어야 함');
  assert(t.logs.length > 0, name + ' → 로그를 남겨야 함');
  assert.strictEqual(vm.runInContext('quotesHtml_(null)', t.c), '', name + ' → 블록 생략');
});

// ── 신선도: 연휴는 통과, 파이프 고장은 차단 ──
const staleCases = [
  ['2026-07-27T00:00:00Z', 3, true],   // 월요일 아침의 금요일 마감 = 정상
  ['2026-07-29T00:00:00Z', 5, true],   // 연휴 5일 = 통과
  ['2026-07-30T00:00:00Z', 6, false],  // 6일 = 파이프 고장으로 보고 차단
];
staleCases.forEach(([now, days, shouldPass]) => {
  const t = ctx(now, ok(SNAPSHOT));
  const got = vm.runInContext('quotes_()', t.c);
  assert.strictEqual(!!got, shouldPass, days + '일 전 asof → ' + (shouldPass ? '통과' : '차단'));
});

// ── 평문 메일에도 지표가 들어가야 한다 ──
const plain = vm.runInContext('quotesPlain_(' + JSON.stringify(SNAPSHOT) + ').join("\\n")', c);
assert(plain.includes('나스닥 24,975.82 -0.6%') && plain.includes('07-24'), '평문 누락');
assert.strictEqual(vm.runInContext('quotesPlain_(null).length', c), 0, 'null이면 평문도 비어야 함');

// ── 배선: 지표가 시황 카드보다 위, 상세 브리핑은 그대로 ──
const src = fs.readFileSync('mailer/Code.gs', 'utf8');
assert(src.includes('quotesHtml_(quotes), body, renderBody_(detail)'), '지표 → 시황 → 상세 순서');
assert(src.includes('dailyPlain_(dg, detail, quotes)') && src.includes('dailyHtml_(email, dg, detail, quotes)'),
  'HTML·평문 양쪽에 스냅샷 전달');
assert(src.includes('var quotes = quotes_();'), '발송당 1회만 조회');

console.log('daily quotes block tests: OK');
