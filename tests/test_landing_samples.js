// 랜딩 '오늘의 브리핑' 3카드 — 주간 발행 헤드라이너 우선, 없으면 정적 폴백.
const assert = require('assert');
const fs = require('fs');

const script = fs.readFileSync('public/assets/script.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');

// ── 카테고리 바로가기 칩 ──
const nav = html.slice(html.indexOf('class="samples-nav"'), html.indexOf('</nav>', html.indexOf('class="samples-nav"')));
['tech.html', 'finance.html', 'economy.html', 'market.html'].forEach((h) =>
  assert(nav.includes('href="' + h + '"'), '칩 링크 누락: ' + h));
assert(!nav.includes('dashboard.html'), '대시보드 칩은 시장으로 교체됨');
['nav.tech', 'nav.finance', 'nav.economy', 'nav.market'].forEach((k) =>
  assert(nav.includes('data-i18n="' + k + '"'), 'i18n 키 누락: ' + k));

// ── 라이브 헤드라이너 우선 ──
assert(script.includes('function liveHeadlinerCard('), '헤드라이너 카드 생성기');
assert(script.includes('liveHeadlinerCard(c) || BRIEFINGS.filter'), '라이브 우선, 정적 폴백');
// 발행 스냅샷이 없으면(CSV 미설정·fetch 실패) 반드시 null 을 돌려 정적 카드를 살려야 한다
assert(script.includes('if (!weeklySheet || !Object.keys(weeklySheet).length) return null'), '스냅샷 없으면 폴백');
assert(script.includes('if (!head || !head.title || !head.summary) return null'), '헤드라이너 없으면 폴백');
// 스냅샷은 fetch 후 도착하므로 다시 그려야 화면에 반영된다
const loader = script.slice(script.indexOf('weeklySheet = out;'), script.indexOf('weeklySheet = out;') + 200);
assert(loader.includes('renderBriefings()'), '스냅샷 도착 후 랜딩 재렌더');

// ── 카테고리별 해석 경로 ──
assert(script.includes('weeklyResolveSingle(cfg)') && script.includes('weeklyResolveIssue(cfg, best.id)'),
  '경제=single, 기술·금융=domains');
assert(script.includes('weeklyBestDomain(cfg)'), '콘텐츠 있는 도메인을 고름');

// ── 출처는 실제 원문이어야 한다(정적 샘플의 옛 출처가 남으면 안 됨) ──
assert(script.includes('source: { name: (o["원문제목"]'), '파서가 원문 출처 보존');
assert(script.includes('(head.source && head.source.name)'), '라이브 카드가 그 출처를 사용');

// ── 라이브는 '샘플' 배지가 아니어야 한다 ──
assert(script.includes('b.live ? t(UI.techPage.freeBadge) : t(s.sampleBadge)'), '라이브=무료 공개 배지');

// ── 빈 값이 빈 껍데기로 렌더되면 안 된다 ──
assert(script.includes('(tags ? \'<div class="card__meta">\''), '태그 없으면 블록 생략');
assert(script.includes('(srcNames ? \'<p class="card__sources">\''), '출처 없으면 줄 생략');
assert(script.includes('(b.spark && b.spark.length'), '스파크 없으면 SVG 생략');

// ── 밸류체인 → 태그 변환 ──
const split = (chain) => chain.split(/[,·/]/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
assert.deepStrictEqual(split('SK하이닉스·한미반도체·TSMC·삼성'), ['SK하이닉스', '한미반도체', 'TSMC'], '최대 3개');
assert.deepStrictEqual(split('엔비디아, 브로드컴'), ['엔비디아', '브로드컴']);
assert.deepStrictEqual(split(''), []);
assert.deepStrictEqual(split('  ·  '), [], '구분자만 있으면 빈 배열');
assert(script.includes('.slice(0, 3)'), '태그 개수 제한');

console.log('landing samples tests: OK');
