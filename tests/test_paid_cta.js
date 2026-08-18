// 유료 CTA — 링크가 비면 버튼을 감춘다.
// 배경(2026-08-03): LINKS.paidForm 이 freeForm 과 폼 ID가 같은 옛 'Biz Signal Lab'
// (AI 사업 진단, 필수 15문항) 폼을 가리켜, 유료 문의를 누른 사람이 브리핑과 무관한
// 컨설팅 설문을 만나고 있었다. 유료 대기자 폼이 생길 때까지 버튼을 감춘다.
const assert = require('assert');
const fs = require('fs');

const site = fs.readFileSync('public/assets/content/site.js', 'utf8');
const script = fs.readFileSync('public/assets/script.js', 'utf8');
const css = fs.readFileSync('public/assets/style.css', 'utf8');

const linkVal = (k) => (site.match(new RegExp('\\n\\s*' + k + ':\\s*"([^"]*)"')) || [])[1];
const formId = (url) => ((url || '').match(/\/forms\/d\/e\/([\w-]+)/) || [])[1];

// ── 핵심 회귀 방어: 무료·유료가 같은 폼을 가리키면 안 된다 ────────────────────
// 유료 폼을 새로 만들어 URL을 넣은 뒤에도 이 검사는 유효하다.
const free = linkVal('freeForm'), paid = linkVal('paidForm');
assert.notStrictEqual(free, undefined, 'LINKS.freeForm 이 있어야 함');
assert.notStrictEqual(paid, undefined, 'LINKS.paidForm 키는 남겨 둔다(값만 비움)');
if (paid) {
  assert.notStrictEqual(formId(paid), formId(free),
    '유료 문의가 무료 구독과 같은 폼으로 가면 안 된다 — 이게 원래 결함이었다');
}

// ── 비었을 때 감추는 규칙 ────────────────────────────────────────────────
// data-link 버튼(랜딩 CTA + 기술/금융/경제 유료 섹션)
const apply = script.slice(script.indexOf('function applyLinks()'),
                           script.indexOf('function hideEmptyActions()'));
assert(apply.includes('el.hidden = !url'), '링크가 비면 버튼을 감춘다');
assert(apply.includes('removeAttribute("href")'), '감춘 버튼은 href를 떼어 탭 이동에서 빠진다');

// 멤버십 카드는 innerHTML로 그리므로 CTA 자체를 안 그려야 한다
const cmp = script.slice(script.indexOf('function renderCompare()'),
                         script.indexOf('function renderCompare()') + 1800);
assert(/url\s*\?/.test(cmp),
  '멤버십 카드도 같은 규칙을 쓴다 — 링크가 비면 CTA 문자열 자체를 만들지 않는다');

// ── 2026-08-18: 랜딩에서 유료 열을 걷어냈다 ─────────────────────────────
// 지금은 일일·주간·스페셜이 전부 무료 구독자에게 나간다. 옛 비교표는 '이메일 발송'을
// 유료 전용으로 적고 있어 사실과 달랐고, 잠긴 항목을 나열하는 것이 구독 전환을 막았다.
// 유료 계획 자체는 감추지 않는다 — 목록 아래 note 한 줄로 남긴다.
assert(!/plan\("paid"\)/.test(script), '랜딩 멤버십에 유료 열을 다시 그리지 않는다');
assert(/UI\.compare/.test(script) && /c\.note/.test(script), '유료 전환 예고(note)를 화면에 남긴다');
// ⚠️ 끝 앵커는 반드시 시작점 뒤에서 찾을 것. 파일 앞쪽에 같은 문자열이 또 있어
//    indexOf 를 그냥 쓰면 블록이 빈 문자열이 되고 아래 검사가 전부 헛돈다.
const cmpStart = site.indexOf('  compare: {');
const cmpBlock = site.slice(cmpStart, site.indexOf('  dashboard: {', cmpStart));
assert(!/paid:/.test(cmpBlock), 'compare.rows 에 paid 플래그가 남으면 안 된다');
assert(/note:/.test(cmpBlock), 'compare.note 가 있어야 유료 전환 계획이 화면에 노출된다');
assert(cmpBlock.split('free: true').length - 1 >= 5, '무료로 받는 항목을 충분히 나열한다');

// 자물쇠 배지는 '전부 무료' 와 정반대 신호라 걷어냈다.
assert(!/lockedLabel/.test(site) && !/lockedLabel/.test(script), '자물쇠 라벨이 남아 있으면 안 된다');
assert(/deliveryLabel/.test(site) && /deliveryLabel/.test(script), '대신 구독 안내 라벨을 쓴다');
assert(/\?[\s\S]*'<a class="btn/.test(cmp) && cmp.includes(': "";'), '링크가 비면 CTA를 그리지 않는다');
assert(!/href="' \+\s*\(LINKS\[[^\]]+\] \|\| "#"\)/.test(cmp), '빈 링크를 "#"로 대체하면 죽은 버튼이 남는다');

// ── 감춤이 실제로 먹으려면 CSS가 필요하다 ────────────────────────────────
// 작성자 스타일의 display 가 브라우저 기본 [hidden] 을 이긴다(2026-07-28 실제 버그).
assert(/\.btn\[hidden\]\s*\{\s*display:\s*none/.test(css), '.btn[hidden] 규칙');
assert(/\.cta__actions\[hidden\]\s*\{\s*display:\s*none/.test(css),
  '.cta__actions 는 display:flex 라 [hidden] 만으로는 안 감춰진다');

// ── 빈 액션 줄은 컨테이너까지 감춘다(여백만 남는 것 방지) ──────────────────
assert(script.includes('function hideEmptyActions()'), '빈 액션 줄 처리');
// 줄바꿈(CRLF/LF)에 의존하지 않게 호출부 문자열로만 찾는다.
// 'function initSubscribe() {' 는 세미콜론이 없어 호출부만 잡힌다.
const initAt = script.indexOf('initSubscribe();');
const hideAt = script.indexOf('hideEmptyActions();', initAt);
assert(initAt > 0 && hideAt > initAt,
  'initSubscribe 가 중복 무료 버튼을 감춘 뒤에 실행돼야 판정이 정확하다');

// ── 유료 진입점이 전부 data-link 로 덮이는지(빠뜨린 버튼이 없어야 감춤이 완결) ──
const pages = fs.readdirSync('public').filter((f) => f.endsWith('.html'));
const paidPages = pages.filter((f) => fs.readFileSync('public/' + f, 'utf8').includes('data-link="paidForm"'));
assert(paidPages.includes('index.html'), '랜딩 CTA');
['tech.html', 'finance.html', 'economy.html'].forEach((f) =>
  assert(paidPages.includes(f), '유료 섹션 CTA 누락: ' + f));
// 하드코딩된 유료 폼 링크가 남아 있으면 감춤을 우회한다
pages.forEach((f) => {
  const h = fs.readFileSync('public/' + f, 'utf8');
  assert(!/docs\.google\.com\/forms/.test(h), f + ' 에 폼 URL 하드코딩 금지(LINKS 로만)');
});

// ── 무료 구독 경로는 살아 있어야 한다(통과 기준: 구독할 방법이 사라지지 않음) ──
assert(free, '유료를 감추면서 무료 구독까지 끊으면 안 된다');

console.log('paid CTA tests: OK');
