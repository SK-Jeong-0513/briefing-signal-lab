// 모바일(세로) 레이아웃의 두 가지 — 둘 다 데스크톱에서는 멀쩡해 보여서 오래 방치됐다.
//
//  (1) 헤더 내비게이션이 좁은 화면에서 통째로 사라져 다른 페이지로 갈 수 없었다.
//  (2) 시장 페이지에서 종목 카드가 본문(일일 브리핑)보다 앞에 있어 본문이 아래로 밀렸다.
//
// 둘 다 2026-08-17 에 사용자 제보로 발견됐다. 데스크톱 확인만으로는 못 잡으므로 여기서 잠근다.
const assert = require('assert');
const fs = require('fs');

const css = fs.readFileSync('public/assets/style.css', 'utf8');
const pages = ['index', 'tech', 'finance', 'economy', 'market', 'dashboard', 'library', 'calendar'];

// ── (1) 모바일에서 내비게이션이 사라지지 않는다 ──────────────────────
// 좁은 화면 미디어쿼리 블록만 떼어 본다. 전역에 .nav{display:none} 이 없어도
// 미디어쿼리 안에 있으면 모바일에서만 사라져 데스크톱 확인을 통과해 버린다.
// ⚠️ 같은 폭의 @media 블록이 여러 개다(라이브러리 레일용 · 전역 반응형용).
//    indexOf 로 첫 개만 보면 엉뚱한 블록을 검사하고 조용히 통과한다 — 전부 모은다.
const mq = (maxWidth) => {
  const needle = '@media (max-width: ' + maxWidth + 'px)';
  const blocks = [];
  for (let at = css.indexOf(needle); at >= 0; at = css.indexOf(needle, at + 1)) {
    const open = css.indexOf('{', at);
    let depth = 0, i = open;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) break;
    }
    blocks.push(css.slice(open + 1, i));
  }
  assert(blocks.length, maxWidth + 'px 미디어쿼리를 못 찾음');
  return blocks.join('\n');
};
const narrow = mq(620);
assert(!/\.nav\s*\{[^}]*display\s*:\s*none/.test(narrow),
  '모바일에서 .nav 를 숨기면 기술·경제·금융·시장으로 갈 방법이 사라진다');
// 링크가 헤더 폭을 넘을 때 잘려서 접근 불가가 되면 숨긴 것과 같다 — 흐르게 둔다.
assert(/\.nav\s*\{[^}]*overflow-x\s*:\s*auto/.test(narrow),
  '좁은 화면에서 nav 는 가로로 흐를 수 있어야 한다');
assert(/\.nav\s*\{[^}]*width\s*:\s*100%/.test(narrow), 'nav 는 제 줄을 차지한다(2단 헤더)');

// 헤더 높이가 고정이면 2단이 잘린다.
assert(/\.header,\s*\.header__inner\s*\{[^}]*height\s*:\s*auto/.test(narrow),
  '2단 헤더는 고정 높이를 풀어야 아래 줄이 잘리지 않는다');

// 모든 페이지가 같은 헤더를 쓴다 — 한 곳만 고쳐서는 의미가 없다.
pages.forEach((p) => {
  const html = fs.readFileSync('public/' + p + '.html', 'utf8');
  const nav = html.slice(html.indexOf('<nav class="nav"'), html.indexOf('</nav>'));
  assert(nav.length > 0, p + '.html 에 헤더 nav 가 없다');
  ['tech.html', 'economy.html', 'finance.html', 'market.html'].forEach((href) =>
    assert(nav.includes('href="' + href + '"'), p + '.html nav 에 ' + href + ' 링크 누락'));
});

// ── (2) 시장 페이지는 일일 브리핑이 종목 카드보다 먼저 ────────────────
// 이 페이지의 본문은 일일 브리핑이다. 종목 카드가 앞서면 모바일에서 본문이
// 화면 몇 개 아래로 밀려 "카드만 있는 페이지"로 읽힌다.
const market = fs.readFileSync('public/market.html', 'utf8');
const daily = market.indexOf('data-market-daily');
const tickers = market.indexOf('data-market-tickers');
assert(daily > 0 && tickers > 0, '시장 페이지 섹션을 못 찾음');
assert(daily < tickers, '일일 브리핑이 설정 종목 카드보다 위에 있어야 한다');

// 본문이 강조 밴드에 오는지 — 순서만 바꾸고 band--surface 를 종목 쪽에 두면
// 시각적으로는 여전히 카드가 주인공이 된다.
const dailySection = market.lastIndexOf('<section', daily);
assert(/band--surface/.test(market.slice(dailySection, daily)),
  '일일 브리핑 섹션이 band--surface(강조 밴드)여야 한다');

console.log('mobile layout: 모든 검증 통과');
