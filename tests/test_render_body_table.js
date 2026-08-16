// 메일 본문 렌더러의 마크다운 표 지원.
//
// 사이트는 marked 로 표를 그리는데 메일러는 손으로 만든 미니 렌더러라, 13F 정리처럼
// 표가 든 리포트를 보내면 메일에만 파이프(|)가 날것으로 찍혔다(2026-08-16 실제 발생).
// LLM 이 쓰는 "\-41.44%" 의 이스케이프도 사이트에서는 풀리지만 메일에는 백슬래시가 남았다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('mailer/Code.gs', 'utf8');
const from = src.indexOf('function boldMd_');
const to = src.indexOf('// ===== 재구독 복구 =====');
assert(from > 0 && to > from, '렌더러 블록을 못 찾음');

const ctx = vm.createContext({
  console,
  C: { text: '#17202A', muted: '#5F6B7A', border: '#D8DEE8' },
  esc_: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
});
vm.runInContext(src.slice(from, to), ctx);
['renderBody_', 'mdTable_', 'mdUnescape_', 'isMdRow_', 'isMdSep_', 'mdAlign_'].forEach((f) =>
  assert.strictEqual(vm.runInContext('typeof ' + f, ctx), 'function', f + ' 로드 실패'));

const render = (md) => ctx.renderBody_(md);

// ── 표가 HTML 표로 나온다 ────────────────────────────────────────────
const table = [
  '| 종목명 (티커) | 전분기 보유량 | 변화(증감율) |',
  '| :---- | ----: | :----: |',
  '| Micron Technology (MU) | 1,665,000 주 | \\-41.44% |',
  '| Amazon.com (AMZN) | 4,320,000 주 | \\+15.74% |',
].join('\n');
let html = render(table);

assert(html.includes('<table'), '표가 HTML table 로 렌더돼야 한다');
assert(!/\|\s*Micron/.test(html), '파이프가 날것으로 남으면 안 된다');
assert(html.includes('Micron Technology (MU)'), '셀 내용 보존');
assert(html.includes('1,665,000 주'), '숫자 셀 보존');

// 이스케이프 해제 — 백슬래시가 메일에 찍히면 안 된다.
assert(!html.includes('\\-'), '\\- 가 그대로 남으면 안 된다');
assert(!html.includes('\\+'), '\\+ 가 그대로 남으면 안 된다');
assert(html.includes('-41.44%') && html.includes('+15.74%'), '부호는 살아 있어야 한다');

// 구분행 자체는 출력되지 않는다(:---- 가 셀로 보이면 표 위에 쓰레기 줄이 생긴다).
assert(!html.includes(':----'), '구분행이 렌더되면 안 된다');

// 정렬은 구분행의 콜론을 따른다 — marked 와 같은 규칙이라 사이트와 같게 보인다.
assert.strictEqual(ctx.mdAlign_(':----'), 'left');
assert.strictEqual(ctx.mdAlign_('----:'), 'right');
assert.strictEqual(ctx.mdAlign_(':---:'), 'center');
assert.strictEqual(ctx.mdAlign_('-----'), 'left', '콜론이 없으면 왼쪽');
assert(/text-align:right/.test(html), '두 번째 열은 오른쪽 정렬');
assert(/text-align:center/.test(html), '세 번째 열은 가운데 정렬');

// 헤더 행은 굵게, 본문 행과 구분선이 다르다.
assert(/border-bottom:2px[^"]*"[^>]*>[^<]*종목명/.test(html) || html.includes('font-weight:700'),
  '헤더 행은 굵게');

// ── 표가 아닌 것을 표로 오인하지 않는다 ──────────────────────────────
// 구분행이 없으면 그냥 문장이다. 파이프 하나로 표를 만들면 본문이 깨진다.
const notTable = '| 이건 표가 아니라 그냥 파이프가 든 문장 |';
assert(!render(notTable).includes('<table'), '구분행 없으면 표가 아니다');
assert.strictEqual(ctx.isMdSep_('| :---- | ----: |'), true);
assert.strictEqual(ctx.isMdSep_('| 값 | 값 |'), false, '내용이 있으면 구분행이 아니다');
assert.strictEqual(ctx.isMdSep_('| : | : |'), false, '하이픈이 없으면 구분행이 아니다');

// ── 기존 동작은 그대로 ───────────────────────────────────────────────
const plain = render('## 토픽별 통합 브리핑\n\n**강조** 문장입니다.\n\n---\n\n마지막 줄');
assert(plain.includes('토픽별 통합 브리핑'), '헤더 유지');
assert(!plain.includes('##'), '헤더 기호는 제거');
assert(plain.includes('<b>강조</b>'), '볼드 유지');
assert(plain.includes('상세 브리핑'), '래퍼 제목 유지');

// HTML 이스케이프가 살아 있어야 한다 — 본문의 < 가 태그로 새면 메일이 깨진다.
const injected = render('| a | b |\n| :-- | :-- |\n| <script>x</script> | & |');
assert(injected.includes('&lt;script&gt;'), '셀 안의 태그는 이스케이프');
assert(!injected.includes('<script>'), '태그가 그대로 새면 안 된다');
assert(injected.includes('&amp;'), '앰퍼샌드 이스케이프');

// 볼드는 이스케이프 뒤에 처리돼야 <b> 가 살아난다(순서가 뒤집히면 &lt;b&gt; 가 된다).
assert(render('| a |\n| :-- |\n| **굵게** |').includes('<b>굵게</b>'), '셀 안 볼드');

// ── 빈 입력 ──────────────────────────────────────────────────────────
assert.strictEqual(render(''), '');
assert.strictEqual(render('   '), '');

// ── 평문 경로에도 이스케이프가 남지 않는다 ───────────────────────────
assert(/mdUnescape_\(body\.replace/.test(src), '평문 본문도 이스케이프를 푼다');

console.log('renderBody table/escape: 모든 검증 통과');
