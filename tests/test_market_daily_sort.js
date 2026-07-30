// 일일 시황 목록 정렬·표시 한도.
// 파이프가 카테고리당 최대 3건(시간대별)을 쓰게 바뀌면 하루 9행이 되어
// 정렬 순서와 cap 이 실제로 드러난다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('public/assets/script.js', 'utf8');

// IIFE 내부라 mktCol ~ renderMarket 사이 블록(헬퍼 전부)을 떼어 평가한다.
const ctx = vm.createContext({ console });
const from = src.indexOf('function mktCol'), to = src.indexOf('function renderMarket');
assert(from > 0 && to > from, '헬퍼 블록을 못 찾음');
vm.runInContext(src.slice(from, to), ctx);
['mktCol', 'mktPeriodRank', 'mktDailySort'].forEach((f) =>
  assert.strictEqual(vm.runInContext('typeof ' + f, ctx), 'function', f + ' 로드 실패'));
const rank = (title) => vm.runInContext('mktPeriodRank(' + JSON.stringify({ '제목': title }) + ')', ctx);

// ── 시간대 순위는 제목 접두사에서 나온다 ──
assert.strictEqual(rank('[장전] 매파 연준·유가 급등'), 1);
assert.strictEqual(rank('[장중] 중동 리스크 확대'), 2);
assert.strictEqual(rank('[마감] 사상 초유 서킷브레이커'), 3);
assert.strictEqual(rank('접두사 없는 레거시 행'), 0, '레거시 행은 0');
assert.strictEqual(rank('[알수없음] 미래 라벨'), 0, '모르는 라벨도 0');
assert.strictEqual(rank(''), 0);
assert.strictEqual(rank('  [마감]  공백 허용'), 3, '앞 공백 허용');

// ── 정렬: 날짜 최신순, 같은 날은 마감 → 장중 → 장전 ──
const rows = [
  { '날짜': '2026-07-29', '제목': '[장전] 29일 아침' },
  { '날짜': '2026-07-30', '제목': '[장전] 30일 아침' },
  { '날짜': '2026-07-29', '제목': '[마감] 29일 마감' },
  { '날짜': '2026-07-29', '제목': '[장중] 29일 장중' },
  { '날짜': '2026-07-28', '제목': '레거시' },
];
const sorted = vm.runInContext('(' + JSON.stringify(rows) + ').sort(mktDailySort)', ctx);
assert.deepStrictEqual(Array.from(sorted, (r) => r['제목']), [
  '[장전] 30일 아침',
  '[마감] 29일 마감',
  '[장중] 29일 장중',
  '[장전] 29일 아침',
  '레거시',
], '날짜 최신순 + 하루 안에서도 최신순');

// 종전 버그: 날짜만 비교하면 같은 날이 입력 순서(장전 먼저)로 남아 뒤집힌다
const dateOnly = Array.from(
  vm.runInContext('(' + JSON.stringify(rows) + ').sort(function(a,b){return (b["날짜"]||"").localeCompare(a["날짜"]||"");})', ctx),
  (r) => r['제목']);
assert.notDeepStrictEqual(dateOnly, Array.from(sorted, (r) => r['제목']),
  '날짜만 비교하는 옛 정렬과 결과가 달라야 함(그게 이번 수정의 요점)');

// ── 표시 한도 ──
assert(src.includes('.slice(0, 45)'), 'cap 45');
assert(!/\.slice\(0, 15\)/.test(src.slice(src.indexOf('data-market-daily'), src.indexOf('data-market-daily') + 900)),
  '옛 cap 15 가 남아 있으면 안 됨');
// 카테고리당 하루 최대 9행(3시간대 × 3건) → 45는 약 5일분
assert.strictEqual(Math.floor(45 / 9), 5);

console.log('market daily sort tests: OK');
