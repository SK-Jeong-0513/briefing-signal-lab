// 랜딩 '오늘의 샘플 브리핑' 섹션 — 카테고리 바로가기 칩과 카드 소스.
const assert = require('assert');
const fs = require('fs');

const script = fs.readFileSync('public/assets/script.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');

// ── 카테고리 바로가기 칩: 대시보드 → 시장 ──
const nav = html.slice(html.indexOf('class="samples-nav"'), html.indexOf('</nav>', html.indexOf('class="samples-nav"')));
['tech.html', 'finance.html', 'economy.html', 'market.html'].forEach((h) =>
  assert(nav.includes('href="' + h + '"'), '칩 링크 누락: ' + h));
assert(!nav.includes('dashboard.html'), '이 섹션의 칩은 대시보드가 아니라 시장');
['nav.tech', 'nav.finance', 'nav.economy', 'nav.market'].forEach((k) =>
  assert(nav.includes('data-i18n="' + k + '"'), 'i18n 키 누락: ' + k));
// 칩 4개뿐인지(누락·중복 방지)
assert.strictEqual((nav.match(/<a /g) || []).length, 4, '칩은 4개');

// 헤더 nav 의 대시보드 링크는 그대로 살아 있어야 한다(섹션 칩만 바뀐 것)
const header = html.slice(html.indexOf('<nav class="nav"'), html.indexOf('</nav>', html.indexOf('<nav class="nav"')));
assert(header.includes('href="dashboard.html"'), '헤더의 대시보드 진입점은 유지');

// ── 카드는 정적 BRIEFINGS 를 쓴다 ──
// 2026-07-28: 주간 발행 헤드라이너로 교체했으나 요약이 한 줄뿐이라 카드가 어색해
// 되돌림(4c06dd4 revert). 대책이 서기 전까지 이 상태를 유지한다.
const fn = script.slice(script.indexOf('function renderBriefings()'),
                        script.indexOf('function renderBriefings()') + 600);
assert(fn.includes('BRIEFINGS.filter'), '카드 소스는 정적 BRIEFINGS');
assert(!script.includes('liveHeadlinerCard'), '라이브 헤드라이너 경로는 제거된 상태');
assert(fn.includes('["tech", "finance", "economy"]'), '카테고리 대표 3장');

console.log('landing samples tests: OK');
