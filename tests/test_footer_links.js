// 필수 페이지 + 크롤 기본 — docs/seo-adsense-plan.md Phase 1.
// 배경(2026-09-14): 사이트의 모든 본문이 data-i18n 빈 요소라 JS 없이는 텍스트가 없고,
// 소개·개인정보처리방침·robots·sitemap 이 없어 검색 유입과 애드센스 심사 둘 다 막혀 있었다.
// 이 테스트는 (1) 모든 페이지 푸터에 두 링크가 정적 텍스트로 있다, (2) 두 페이지 본문이
// data-i18n 없이 정적 KO 다, (3) robots/sitemap 이 정합하다 — 세 가지를 잠근다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PUB = 'public';
const pages = fs.readdirSync(PUB).filter((f) => /\.html$/.test(f));   // .bak 제외
assert(pages.length >= 11, 'HTML 페이지가 11개(기존 9 + about + privacy) 이상이어야 함: ' + pages.length);
assert(pages.includes('about.html') && pages.includes('privacy.html'), 'about.html · privacy.html 이 있어야 함');

const site = fs.readFileSync(path.join(PUB, 'assets/content/site.js'), 'utf8');
const stripTags = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const between = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); assert(i >= 0 && j > i, a + ' … ' + b + ' 구간 없음'); return s.slice(i, j); };

// ── (1) 푸터 링크 — 모든 페이지, 정적 텍스트 ───────────────────────────────
for (const f of pages) {
  const html = fs.readFileSync(path.join(PUB, f), 'utf8');
  const footer = between(html, '<footer', '</footer>');
  const about = footer.match(/<a href="about\.html"[^>]*>([^<]*)<\/a>/);
  const privacy = footer.match(/<a href="privacy\.html"[^>]*>([^<]*)<\/a>/);
  assert(about, f + ': 푸터에 about.html 링크가 없다');
  assert(privacy, f + ': 푸터에 privacy.html 링크가 없다');
  // data-i18n 요소지만 KO 를 미리 채운다 — JS 없이도 링크 텍스트가 보여야 크롤러가 따라간다.
  assert(about[1].trim().length > 0, f + ': 소개 링크 텍스트가 비었다(정적 KO 를 채울 것)');
  assert(privacy[1].trim().length > 0, f + ': 개인정보처리방침 링크 텍스트가 비었다');
  assert(footer.includes('mailto:paun.jeong@gmail.com'), f + ': 연락처 mailto 가 사라졌다');
}
// EN 토글이 링크 텍스트도 바꾸도록 사전에 키가 있어야 한다(없으면 applyStaticI18n 이 빈 문자열로 덮는다).
const footerDict = between(site, '  footer: {', '\n};');
for (const k of ['about', 'privacy']) {
  const m = footerDict.match(new RegExp('\\n\\s*' + k + ':\\s*\\{\\s*ko:\\s*"([^"]+)",\\s*en:\\s*"([^"]+)"'));
  assert(m, 'site.js UI.footer.' + k + ' 에 ko/en 이 있어야 함');
}

// ── (2) 소개·개인정보처리방침 — 본문은 정적 KO, data-i18n 금지 ──────────────
function staticPage(f, minChars, mustHave) {
  const html = fs.readFileSync(path.join(PUB, f), 'utf8');
  assert(html.includes('<html lang="ko">'), f + ': lang=ko');
  assert(html.includes('<link rel="canonical" href="https://brevislab.com/' + f + '" />'), f + ': canonical 이 자기 URL 이어야 함');
  const main = between(html, '<main', '</main>');
  assert(!/data-i18n/.test(main), f + ': 본문(<main>)에 data-i18n 을 쓰면 JS 없이 텍스트가 사라진다');
  const text = stripTags(main);
  assert(text.length >= minChars, f + ': 본문 정적 텍스트가 ' + minChars + '자 이상이어야 함(현재 ' + text.length + ')');
  for (const s of mustHave) assert(text.includes(s), f + ': 본문에 "' + s + '" 가 있어야 함');
  assert(main.includes('mailto:paun.jeong@gmail.com'), f + ': 연락처가 본문에 있어야 함');
  return text;
}
staticPage('about.html', 1000, ['수집', '초안', '선별', '검수', '발행', '투자 조언이 아닙니다', '무료']);
// 개인정보처리방침의 사실 관계는 코드와 맞아야 한다 — 방문 비콘은 localStorage 익명 ID · 쿠키 없음(script.js logVisit),
// 수신거부는 확인 페이지 2단계(mailer doGet), 광고는 현재 없음(Phase 6 에서 갱신).
staticPage('privacy.html', 1500, ['이메일 주소', 'localStorage', '쿠키를 사용하지 않습니다', '구독 취소', '광고', '삭제']);

// ── (3) robots.txt · sitemap.xml ─────────────────────────────────────────────
const robots = fs.readFileSync(path.join(PUB, 'robots.txt'), 'utf8');
assert(/^User-agent: \*$/m.test(robots) && /^Allow: \/$/m.test(robots), 'robots.txt 는 전체 허용');
assert(robots.includes('Sitemap: https://brevislab.com/sitemap.xml'), 'robots.txt 에 sitemap 위치');

const sitemap = fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert(locs.length >= 10, 'sitemap 에 URL 이 10개 이상: ' + locs.length);
for (const u of locs) {
  assert(u.startsWith('https://brevislab.com/'), 'sitemap URL 은 https://brevislab.com/ 로 시작: ' + u);
  const rel = u.replace('https://brevislab.com/', '') || 'index.html';
  assert(fs.existsSync(path.join(PUB, rel)), 'sitemap 의 파일이 public/ 에 없다: ' + rel);
  assert(!/\.bak$/.test(rel), 'sitemap 에 .bak 이 들어가면 안 된다');
}
assert(locs.includes('https://brevislab.com/about.html') && locs.includes('https://brevislab.com/privacy.html'), 'sitemap 에 about · privacy');
// read.html 은 ?r= 없이는 빈 페이지이고 canonical 이 read.html 이라 목록에 넣지 않는다(Phase 4 에서 정적 서재 페이지로 대체).
assert(!locs.some((u) => /read\.html/.test(u)), 'sitemap 에 read.html 을 넣지 않는다');

console.log('test_footer_links: ok (' + pages.length + ' pages, ' + locs.length + ' sitemap urls)');
