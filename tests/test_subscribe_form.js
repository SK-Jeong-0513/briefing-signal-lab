// 사이트 내 구독 폼 — 설정 전/후 동작과 배선 검증.
// 핵심: SUBSCRIBE_FORM 미설정 상태로 배포돼도 구독 경로가 끊기면 안 된다.
const assert = require('assert');
const fs = require('fs');

const site = fs.readFileSync('public/assets/content/site.js', 'utf8');
const script = fs.readFileSync('public/assets/script.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/assets/style.css', 'utf8');

// ── 설정 블록 ──
assert(/const SUBSCRIBE_FORM = \{/.test(site), 'SUBSCRIBE_FORM 설정 블록');
['formId', 'emailEntry', 'consentEntry', 'consentValue', 'keywordEntry']
  .forEach((k) => assert(site.includes(k + ':'), '설정 키 누락: ' + k));
// 설정 정합성: formId 만 채우고 entry 를 빠뜨리면 subConfigured()가 false 라
// 폼이 조용히 숨겨진다(장애를 눈치채기 어렵다) → 셋이 함께 채워져야 한다.
const cfg = (k) => (site.match(new RegExp(k + ':\\s*"([^"]*)"')) || [])[1];
const trio = ['formId', 'emailEntry', 'consentEntry'].map(cfg);
assert(trio.every((v) => v === '') || trio.every((v) => v),
  'formId·emailEntry·consentEntry 는 모두 비거나 모두 채워져야 함: ' + JSON.stringify(trio));
if (cfg('formId')) {
  assert(/^entry\.\d+$/.test(cfg('emailEntry')), 'emailEntry 형식');
  assert(/^entry\.\d+$/.test(cfg('consentEntry')), 'consentEntry 형식');
  // 메일러 consented_() 는 '동의' 포함 여부로 판정한다(CFG.CONSENT_TRUE_INCLUDES)
  assert(cfg('consentValue').indexOf('동의') >= 0, "동의 보기 문구에 '동의'가 있어야 메일러가 구독으로 인식");
}

// ── 폴백: 미설정이면 폼을 숨기고 외부 버튼을 남긴다 ──
assert(/<form class="sub" id="subscribe" hidden/.test(html), '기본 hidden');
assert(script.includes('if (!subConfigured()) return;'), '미설정이면 조기 반환');
assert(html.includes('data-link="freeForm"'), '폴백 버튼 유지');
// 설정됐을 때만 중복 버튼을 숨겨야 한다 — 순서가 뒤바뀌면 미설정 시 구독 경로가 사라진다
const early = script.indexOf('if (!subConfigured()) return;');
const hideBtn = script.indexOf('if (freeBtn) freeBtn.hidden = true;');
assert(early > 0 && hideBtn > early, '폴백 반환이 버튼 숨김보다 먼저여야 함');

// ── 무료 구독 버튼은 전부 인라인 폼으로 향해야 한다(외부 폼과 혼선 방지) ──
assert(script.includes('function wireSubscribeLinks('), '버튼 재배선 함수');
assert(script.includes('el.removeAttribute("target")'), '새 탭 열기 제거');
assert(script.includes('"index.html#subscribe"'), '폼 없는 페이지는 랜딩으로 보냄');
assert(script.includes('location.hash === "#subscribe"'), '넘어온 뒤 포커스');
assert(script.includes('preventScroll: true'), '포커스가 스크롤을 튀게 하면 안 됨');
// 미설정이면 재배선하지 않아야 기존 외부 링크 폴백이 살아있다
const wireAt = script.indexOf('wireSubscribeLinks(true)');
assert(wireAt > early, '재배선은 subConfigured() 통과 후에만');
// freeForm 버튼이 있는 모든 페이지가 재배선 대상인지(랜딩 외 페이지 포함)
const pages = fs.readdirSync('public').filter((f) => f.endsWith('.html'));
const withBtn = pages.filter((f) => fs.readFileSync('public/' + f, 'utf8').includes('data-link="freeForm"'));
assert(withBtn.length >= 8, '구독 버튼이 여러 페이지에 있음: ' + withBtn.length);
assert(withBtn.includes('index.html'), '랜딩 포함');
// 폼은 랜딩에만 있다 — 다른 페이지에서 '#subscribe' 로 보내면 아무 데도 안 간다
const others = withBtn.filter((f) => f !== 'index.html');
others.forEach((f) => assert(!fs.readFileSync('public/' + f, 'utf8').includes('id="subscribe"'),
  f + ' 에 폼이 없으므로 index.html#subscribe 로 보내야 함'));

// ── 제출 ──
assert(script.includes('mode: "no-cors"'), 'Forms는 CORS 헤더가 없어 no-cors 필요');
assert(script.includes('/formResponse'), 'formResponse 엔드포인트');
assert(script.includes('SUBSCRIBE_FORM.emailEntry') && script.includes('SUBSCRIBE_FORM.consentEntry'),
  '이메일·동의 전송');
assert(script.includes('e.preventDefault()'), '기본 제출 차단(페이지 이탈 방지)');
assert(/btn\.dataset\.busy === "1"\) return;/.test(script), '중복 제출 차단');

// ── 검증: 이메일 형식 + 동의 필수(정보통신망법상 사전 동의) ──
const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
assert(script.includes(re.source), '이메일 정규식이 코드와 동일해야 함');
['a@b.co', 'paun.jeong@gmail.com', 'x_y+z@sub.domain.kr'].forEach((v) => assert(re.test(v), '통과해야: ' + v));
['', 'a@b', 'a@b.c', 'no-at.com', 'a b@c.com', '@b.co'].forEach((v) => assert(!re.test(v), '막아야: ' + v));
assert(script.includes('errConsent'), '동의 미체크 시 차단');
assert(html.includes('name="consent"') && html.includes('required'), '동의 체크박스 필수');

// ── i18n: 하드코딩 문구가 아니라 UI 사전에서 와야 한다 ──
['emailPlaceholder', 'consent', 'submit', 'sending', 'done', 'errEmail', 'errConsent', 'errSend']
  .forEach((k) => assert(site.includes(k + ':'), 'i18n 키 누락: ' + k));
assert(script.includes('subText();'), '언어 전환 시 폼 문구 갱신');
const renderAll = script.slice(script.indexOf('function renderAll()'), script.indexOf('function renderAll()') + 220);
assert(renderAll.includes('subText()'), 'renderAll에서 갱신해야 KO/EN 토글이 반영됨');

// ── 접근성 ──
assert(html.includes('aria-live="polite"'), '상태 메시지 aria-live');
assert(html.includes('aria-label="이메일 주소"'), '입력 레이블');

// ── hidden 이 실제로 먹어야 한다 ──
// .btn { display:inline-flex } 같은 작성자 스타일은 브라우저 기본 [hidden] 을 이긴다.
// 이게 없으면 el.hidden = true 를 걸어도 중복 버튼이 그대로 보인다.
const displayed = (css.match(/^\.[\w-]+\s*\{[^}]*display:\s*(?!none)/gm) || [])
  .map((m) => m.slice(0, m.indexOf('{')).trim());
['.btn', '.sub'].forEach((sel) => {
  if (displayed.some((d) => d.split(/[\s,]/)[0] === sel)) {
    assert(css.includes(sel + '[hidden]'), sel + ' 은 display 를 지정하므로 [hidden] 규칙이 필요');
  }
});
assert(css.includes('.btn[hidden] { display: none; }'), '.btn[hidden] 규칙 필수');

// ── DESIGN.md 토큰만 사용 (새 색·여백 생성 금지) ──
const subCss = css.slice(css.indexOf('/* 사이트 내 구독 폼'), css.indexOf('/* ── 푸터'));
const hex = subCss.match(/#[0-9a-fA-F]{3,8}/g) || [];
assert.deepStrictEqual(hex, [], '새 색상값을 만들면 안 됨(토큰만): ' + hex.join(', '));
['var(--surface)', 'var(--border)', 'var(--r-md)', 'var(--s-sm)', 'var(--s-md)', 'var(--s-xl)']
  .forEach((v) => assert(subCss.includes(v), '토큰 사용 확인: ' + v));

console.log('subscribe form tests: OK');
