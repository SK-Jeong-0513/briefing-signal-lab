// 관리자 콘솔 ① 주간 초안 — 목록 정렬 + 체크 일괄 처리.
//
// 운영자가 승인·headliner 를 행마다 눌러야 해서 한 호(48건) 처리에 시간이 오래
// 걸렸다. 일괄 처리는 "체크된 것 전부"를 한 번에 바꾸고, 정렬은 무엇을 체크할지
// 고르는 비용을 줄인다. 둘 다 목록이 커질수록 값어치가 커지는 기능이라
// 경계(빈 값·동률·범위 밖 행)를 여기서 잠근다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// ── 클라이언트: 정렬 헬퍼 ──────────────────────────────────────────────
const html = fs.readFileSync('admin/index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

const ctx = vm.createContext({
  console,
  renderWeekly() {},                                  // 정렬 함수가 부르는 재렌더 — 여기선 무관
  esc: (s) => String(s == null ? '' : s),
});
const from = js.indexOf('var W_SORT_COLS'), to = js.indexOf('function wSelectedRows');
assert(from > 0 && to > from, '정렬 헬퍼 블록을 못 찾음');
vm.runInContext(js.slice(from, to), ctx);
['wSort', 'wSortReset', 'wSortRows', 'wTh'].forEach((f) =>
  assert.strictEqual(vm.runInContext('typeof ' + f, ctx), 'function', f + ' 로드 실패'));

const setSort = (key, dir) => vm.runInContext(`_wSort={key:${JSON.stringify(key)},dir:${JSON.stringify(dir)}}`, ctx);
// vm 안에서 만든 배열은 프로토타입이 달라 deepStrictEqual 이 걸린다 — JSON 으로 넘긴다.
const sortRows = (rows) =>
  JSON.parse(vm.runInContext('JSON.stringify(wSortRows(' + JSON.stringify(rows) + '))', ctx));

// 기본 정렬(key='')은 시트 순서를 그대로 둔다 — 되돌리기가 이 상태다.
setSort('', 'asc');
const given = [{ _row: 4, '분야': 'semicon' }, { _row: 2, '분야': 'ai-infra' }, { _row: 3, '분야': 'macro' }];
assert.deepStrictEqual(sortRows(given).map((r) => r._row), [4, 2, 3], '기본 정렬은 원래 순서 유지');

// 텍스트 열: 오름/내림
setSort('분야', 'asc');
assert.deepStrictEqual(sortRows(given).map((r) => r['분야']), ['ai-infra', 'macro', 'semicon']);
setSort('분야', 'desc');
assert.deepStrictEqual(sortRows(given).map((r) => r['분야']), ['semicon', 'macro', 'ai-infra']);

// 숫자 열은 사전순이 아니라 크기순 — '10' < '9' 가 되면 선행도 정렬이 뒤집힌다.
const lead = [{ _row: 2, '선행도': '9' }, { _row: 3, '선행도': '10' }, { _row: 4, '선행도': '2' }];
setSort('선행도', 'asc');
assert.deepStrictEqual(sortRows(lead).map((r) => r['선행도']), ['2', '9', '10'], '숫자 크기순');

// 빈 값은 방향과 무관하게 항상 뒤로. 오름차순에서만 뒤로 가면 내림차순 첫 화면이
// 빈 행으로 덮여 정작 볼 것이 안 보인다.
const holes = [{ _row: 2, '제목ko': '나' }, { _row: 3, '제목ko': '' }, { _row: 4, '제목ko': '가' }];
setSort('제목ko', 'asc');
assert.deepStrictEqual(sortRows(holes).map((r) => r._row), [4, 2, 3], '오름차순: 빈 값 뒤로');
setSort('제목ko', 'desc');
assert.deepStrictEqual(sortRows(holes).map((r) => r._row), [2, 4, 3], '내림차순에서도 빈 값 뒤로');

// 안정 정렬 — 동률은 시트 순서를 유지한다.
const ties = [{ _row: 2, 'status': 'draft' }, { _row: 3, 'status': 'draft' }, { _row: 4, 'status': 'draft' }];
setSort('status', 'asc');
assert.deepStrictEqual(sortRows(ties).map((r) => r._row), [2, 3, 4], '동률은 원래 순서');

// 화이트리스트 — 목록 밖 열 이름은 정렬 상태를 바꾸지 못한다(임의 컬럼 주입 차단).
setSort('', 'asc');
vm.runInContext('wSort("본문")', ctx);
assert.strictEqual(vm.runInContext('_wSort.key', ctx), '', '화이트리스트 밖 열은 무시');
vm.runInContext('wSort("분야")', ctx);
assert.strictEqual(vm.runInContext('_wSort.key', ctx), '분야');
vm.runInContext('wSort("분야")', ctx);
assert.strictEqual(vm.runInContext('_wSort.dir', ctx), 'desc', '같은 열 재클릭 = 방향 토글');
vm.runInContext('wSortReset()', ctx);
assert.strictEqual(vm.runInContext('_wSort.key', ctx), '', '되돌리기는 기본 정렬로');

// ── 정렬 기호는 첫 로드부터 항상 보여야 한다 ─────────────────────────
// 아무 표시가 없으면 정렬 가능한 줄 모르고 지나친다(전역 규약).
setSort('', 'asc');
let th = vm.runInContext('wTh("분야","분야")', ctx);
assert(th.includes('⇅'), '비활성 열에도 중립 기호가 보여야 한다');
assert(!th.includes('sortable on'), '비활성 열은 활성 표시가 없다');
setSort('분야', 'asc');
assert(vm.runInContext('wTh("분야","분야")', ctx).includes('▲'), '오름차순 기호');
setSort('분야', 'desc');
th = vm.runInContext('wTh("분야","분야")', ctx);
assert(th.includes('▼'), '내림차순 기호');
assert(th.includes('sortable on'), '활성 열은 강조 클래스');
assert(!vm.runInContext('wTh("액션","")', ctx).includes('⇅'), '정렬 불가 열엔 기호 없음');

// CSS 가 규약대로인지 — 비활성은 흐리게, 활성은 굵게.
assert(/th\.sortable i\.sort\{[^}]*opacity:\.35/.test(html), '비활성 기호는 흐리게');
assert(/th\.sortable\.on i\.sort\{[^}]*font-weight:700/.test(html), '활성 기호는 굵게');

// ── 서버: 일괄 열 쓰기 ────────────────────────────────────────────────
const gs = fs.readFileSync('admin/Code.gs', 'utf8');
const gsFrom = gs.indexOf('function _weeklySetColumnBatch_');
const gsTo = gs.indexOf('function weeklySetStatusBatch');
assert(gsFrom > 0 && gsTo > gsFrom, '_weeklySetColumnBatch_ 를 못 찾음');

// 시트 스텁: 2행부터 status 열 하나. setValues 호출 횟수를 센다.
function makeSheet(values) {
  const state = { values: values.slice(), writes: 0, reads: 0 };
  const sheet = {
    getLastRow: () => state.values.length + 1,
    getRange(row, col, numRows) {
      return {
        getValues() { state.reads++; return state.values.slice(row - 2, row - 2 + numRows).map((v) => [v]); },
        // Array.from 으로 호스트 realm 배열을 만든다(vm 배열이면 deepStrictEqual 이 걸린다).
        setValues(v) { state.writes++; state.values = Array.from(v, (x) => x[0]); },
      };
    },
  };
  return { sheet, state };
}
function runBatch(values, rows, value) {
  const { sheet, state } = makeSheet(values);
  const c = vm.createContext({
    console,
    _openMarket_: () => ({ getSheetByName: () => sheet }),
    _colIndex_: () => 1,
    WEEKLY_TAB: '주간-초안',
  });
  vm.runInContext(gs.slice(gsFrom, gsTo), c);
  const changed = c._weeklySetColumnBatch_(rows, 'status', value);
  return { changed, values: state.values, writes: state.writes, reads: state.reads };
}

// 흩어진 행을 골라도 읽기 1회·쓰기 1회. 행마다 왕복하면 48건에 48회가 나간다.
let out = runBatch(['draft', 'draft', 'draft', 'draft'], [2, 4, 5], 'approved');
assert.deepStrictEqual(out.values, ['approved', 'draft', 'approved', 'approved']);
assert.strictEqual(out.changed, 3);
assert.strictEqual(out.writes, 1, '쓰기는 1회');
assert.strictEqual(out.reads, 1, '읽기는 1회');

// 이미 같은 값이면 changed 에 세지 않는다 — 토스트가 "3건 변경"이라 해놓고
// 실제로 아무것도 안 바뀌면 운영자가 결과를 믿을 수 없다.
out = runBatch(['approved', 'draft'], [2, 3], 'approved');
assert.strictEqual(out.changed, 1, '이미 같은 값은 변경으로 세지 않음');
assert.deepStrictEqual(out.values, ['approved', 'approved']);

// 범위 밖·헤더 행은 무시한다. 1행을 쓰면 헤더가 날아가 탭 전체가 깨진다.
out = runBatch(['draft', 'draft'], [1, 2, 99], 'approved');
assert.deepStrictEqual(out.values, ['approved', 'draft'], '헤더(1)·범위 밖(99) 무시');

// 선택이 비면 시트를 건드리지 않는다.
out = runBatch(['draft'], [], 'approved');
assert.strictEqual(out.writes, 0, '빈 선택은 쓰기 없음');
assert.strictEqual(out.changed, 0);

// ── 일괄 함수는 허용 값만 받는다 ─────────────────────────────────────
// status/유형에 오타가 들어가면 게이트가 그 행을 통째로 떨어뜨린다.
assert(/\['draft', 'approved'\]\.indexOf\(String\(status\)\) < 0/.test(gs), 'status 화이트리스트');
assert(/\['signal', 'headliner'\]\.indexOf\(String\(type\)\) < 0/.test(gs), '유형 화이트리스트');

// ── 체크 상태가 재렌더를 견디는가 ────────────────────────────────────
// 정렬하면 표를 다시 그린다. 그때 체크가 풀리면 '전체 선택 → 정렬 → 일괄 처리'가
// 불가능해져 일괄 기능 자체가 무의미해진다.
assert(/_wChecked\[r\._row\]\?' checked':''/.test(js), '재렌더 시 체크 복원');
assert(/onchange="wCheck\(this\)"/.test(js), '체크 변경이 상태에 기록됨');
assert(/function wFilterChanged\(\)\{_wChecked=\{\};/.test(js), '필터 변경 시 선택 초기화');
assert(/function loadWeekly\(\)\{\s*_wChecked=\{\};/.test(js), '새로고침 시 선택 초기화');

console.log('admin weekly bulk/sort: 모든 검증 통과');
