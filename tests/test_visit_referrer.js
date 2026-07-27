// 방문 통계 유입 경로(referrer) 집계 검증.
// referrer 원본은 전체 URL이라 그대로 세면 같은 채널이 흩어진다 → 호스트로 묶는다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const c = vm.createContext({ console });
vm.runInContext(fs.readFileSync('admin/Code.gs', 'utf8'), c);
const label = (s) => vm.runInContext('_refLabel_(' + JSON.stringify(s) + ')', c);

// ── 외부 채널은 호스트로 묶인다 ──
assert.strictEqual(label('https://t.me/some_channel/123'), 't.me');
assert.strictEqual(label('https://www.google.com/search?q=반도체+브리핑'), 'google.com', 'www. 제거');
assert.strictEqual(label('https://search.naver.com/search.naver?query=x'), 'search.naver.com');
assert.strictEqual(label('https://cafe.naver.com/boardlist.nhn'), 'cafe.naver.com');
assert.strictEqual(label('http://M.Blog.Naver.COM/post/1'), 'm.blog.naver.com', '소문자 정규화');
assert.strictEqual(label('https://t.co/abc'), 't.co');

// 같은 채널의 다른 경로는 한 줄로 합쳐져야 한다
assert.strictEqual(label('https://t.me/ch/1'), label('https://t.me/ch/999'));

// ── 자기 사이트 이동은 외부 유입이 아니다 ──
['https://brevislab.com/tech.html', 'https://www.brevislab.com/', 'https://sk-jeong-0513.github.io/briefing-signal-lab/']
  .forEach((u) => assert.strictEqual(label(u), '사이트 내 이동', u));

// ── referrer 없음 ──
['', null, undefined, '   '].forEach((u) => assert.strictEqual(label(u), '직접 방문·알 수 없음'));

// ── 외부 유입 카운트는 내부·직접을 빼고 센다 ──
const rows = [
  ['2026-07-27T10:00:00Z', '/', 'https://t.me/ch/1', 'a'],
  ['2026-07-27T10:01:00Z', '/tech.html', 'https://brevislab.com/', 'a'],   // 내부 이동
  ['2026-07-27T10:02:00Z', '/', '', 'b'],                                   // 직접
  ['2026-07-28T09:00:00Z', '/', 'https://cafe.naver.com/x', 'c'],
  ['2026-07-28T09:01:00Z', '/', 'https://t.me/ch/2', 'd'],
];
c.SHEET = {
  getLastRow: () => rows.length + 1,
  getRange: (r, cc, n) => ({ getValues: () => rows.slice(r - 2, r - 2 + n) }),
};
vm.runInContext('function _assertAuth_(){} function _openAnalytics_(){return{getSheetByName:function(){return SHEET;}};}' +
                'function _norm_(v){return v;}', c);
const s = vm.runInContext('visitStats()', c);
assert.strictEqual(s.views, 5);
assert.strictEqual(s.visitors, 4, '익명ID 기준 순방문');
assert.strictEqual(s.external, 3, '외부 유입만: t.me 2 + cafe.naver.com 1');
assert.deepStrictEqual(JSON.parse(JSON.stringify(s.byRef)), [
  { ref: 't.me', count: 2 },
  { ref: '사이트 내 이동', count: 1 },
  { ref: '직접 방문·알 수 없음', count: 1 },
  { ref: 'cafe.naver.com', count: 1 },
], '건수 내림차순');

// ── 콘솔 배선 ──
const html = fs.readFileSync('admin/index.html', 'utf8');
assert(html.includes("miniTable(s.byRef,'ref','count')"), '유입 경로 표 렌더');
assert(html.includes('id="v-ref"'), '유입 경로 패널');
assert(html.includes('s.external'), '외부 유입 수치 표시');

console.log('visit referrer tests: OK');
