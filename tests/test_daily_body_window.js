// 일일 메일 3슬롯 창 — 상세 본문(시장-본문)과 신호 카드(시장-일일) 양쪽.
//
// 왜 이 파일이 있는가: 2026-08-03 에 장전 슬롯이 통째로 빠지자 그날 상세 브리핑이
// 메일에서 사라졌다. 장중 775자가 시트에 멀쩡히 있었는데도다. marketBody_ 가
// '장전'만 보는 단일 실패점이었기 때문이다. 창을 3슬롯으로 넓힌 게 이 변경이고,
// 여기서 잠그는 건 "한 슬롯이 빠져도 그날이 구제되는가"다.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync('mailer/Code.gs', 'utf8');
const DAY = 86400000;

// KST(UTC+9) yyyy-MM-dd. Apps Script Utilities.formatDate 대역 — 날짜 산술이
// 걸린 코드라 문자열을 잘라 흉내내면 자정 경계에서 조용히 틀린다.
function kstYmd(date) {
  return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

// now = 발송 시각(UTC ISO). bodyRows = 시장-본문 탭 값(헤더 포함) 또는 null(탭 없음).
function ctx(now, bodyRows) {
  const RealDate = Date;
  const fixed = new RealDate(now).getTime();
  const c = vm.createContext({
    console,
    Utilities: { formatDate: (d, tz, fmt) => kstYmd(d) },
    Logger: { log: () => {} },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => (bodyRows ? { getDataRange: () => ({ getValues: () => bodyRows }) } : null),
      }),
    },
    Date: class extends RealDate {
      constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(fixed); }
      static now() { return fixed; }
    },
  });
  vm.runInContext(SRC, c);
  vm.runInContext('CFG.MARKET_SHEET_ID = "sheet-id"', c);
  return c;
}

const HEAD = ['날짜', '시간대', '본문'];
const run = (c, expr) => vm.runInContext(expr, c);
const runJ = (c, expr) => JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', c));

// 2026-08-04(화) 07:40 KST = 2026-08-03T22:40Z
const NOW = '2026-08-03T22:40:00Z';
const TODAY = '2026-08-04';
const YDAY = '2026-08-03';

// 실제 파이프 출력 모양 — 토픽 섹션 + 채널 섹션.
const FULL = [
  '### 📌 토픽별 통합 브리핑',
  '**[반도체]** HBM4 양산 일정이 앞당겨졌다.',
  '',
  '### 📰 채널별 요약',
  '**[반도체 공급망]** 후공정 병목 관련 보도.',
].join('\n');

// ── 창 정의 ────────────────────────────────────────────────────────────────
{
  const c = ctx(NOW, [HEAD]);
  const win = runJ(c, 'dailyWindow_()');
  assert.deepStrictEqual(win.map((w) => w.date + '|' + w.period),
    [`${TODAY}|장전`, `${YDAY}|마감`, `${YDAY}|장중`], '창은 당일 장전 + 전일 마감·장중');
  assert.strictEqual(win[0].full, true, '장전만 전문');
  assert.strictEqual(win[1].full, false);
  assert.strictEqual(win[2].full, false);
}

// ── 핵심 회귀: 장전이 빠져도 그날 상세가 살아남는다 (2026-08-03 재현) ──────
{
  const c = ctx(NOW, [HEAD, [YDAY, '장중', FULL], [YDAY, '마감', FULL]]);
  const body = run(c, 'marketBody_()');
  assert(body.length > 0, '장전이 없어도 전일 슬롯으로 본문이 나와야 한다 — 옛 코드는 여기서 "" 였다');
  assert(body.includes('마감'), '마감 슬롯 헤더');
  assert(body.includes('장중'), '장중 슬롯 헤더');
}

// ── 슬롯별 밀도: 장전 전문, 전일분은 토픽만 ────────────────────────────────
{
  const c = ctx(NOW, [HEAD, [YDAY, '장중', FULL], [TODAY, '장전', FULL]]);
  const body = run(c, 'marketBody_()');
  const head = body.indexOf('## 장전'), tail = body.indexOf('## 장중');
  assert(head >= 0 && tail > head, '최신(장전) 먼저 — 사이트 mktPeriodRank 와 같은 방향');
  const jangjung = body.slice(tail);
  assert(!jangjung.includes('채널별'), '전일 장중은 채널별 요약을 싣지 않는다');
  assert(body.slice(head, tail).includes('채널별'), '당일 장전은 전문');
}

// ── 창 밖은 안 담는다 ──────────────────────────────────────────────────────
{
  const c = ctx(NOW, [HEAD, [YDAY, '장전', FULL], ['2026-07-30', '마감', FULL]]);
  assert.strictEqual(run(c, 'marketBody_()'), '',
    '전일 장전(어제 이미 나감)과 이틀 전은 창 밖이다');
}

// ── 같은 슬롯 중복 기록이면 최신이 이긴다 ──────────────────────────────────
{
  const c = ctx(NOW, [HEAD, [TODAY, '장전', '먼저 쓴 것'], [TODAY, '장전', '나중 쓴 것']]);
  assert(run(c, 'marketBody_()').includes('나중 쓴 것'));
}

// ── 빈 본문 행은 슬롯을 차지하지 않는다 ────────────────────────────────────
{
  const c = ctx(NOW, [HEAD, [TODAY, '장전', '   '], [YDAY, '마감', FULL]]);
  const body = run(c, 'marketBody_()');
  assert(!body.includes('## 장전'), '공백만 있는 행은 슬롯 없음으로 취급');
  assert(body.includes('## 마감'), '나머지 슬롯은 살아야 한다');
}

// ── 탭·열 없음은 조용히 "" (메일은 카드만으로 나간다) ──────────────────────
{
  assert.strictEqual(run(ctx(NOW, null), 'marketBody_()'), '', '탭 없음');
  assert.strictEqual(run(ctx(NOW, [['날짜', '시간대']]), 'marketBody_()'), '', '본문 열 없음');
}

// ── 시간대 열이 없는 레거시 시트는 옛 동작으로 물러난다 ────────────────────
{
  const c = ctx(NOW, [['날짜', '본문'], [YDAY, '어제분'], [TODAY, '오늘분']]);
  assert.strictEqual(run(c, 'marketBody_()'), '오늘분');
}

// ── topicPart_: 옛 '채널별'과 새 '분야별' 을 둘 다 받는다 ──────────────────
// 2026-08-04 에 프롬프트가 핸들 노출을 막으려 채널별 → 분야별로 바뀌었다.
// 창이 어제 행까지 읽으므로 전환 기간엔 두 문구가 섞인다. 하나만 보면 그 슬롯이
// 통째로 전문으로 실려 Gmail 잘림에 걸린다.
{
  const c = ctx(NOW, [HEAD]);
  const NEW = FULL.replace('채널별', '분야별');
  assert.strictEqual(run(c, 'topicPart_(' + JSON.stringify(NEW) + ')').includes('분야별'), false,
    "새 '분야별' 마커에서 잘려야 한다");
  assert(run(c, 'topicPart_(' + JSON.stringify(NEW) + ')').includes('토픽별'), '토픽 섹션은 남는다');
  assert.strictEqual(run(c, 'topicPart_(' + JSON.stringify(FULL) + ')').includes('채널별'), false,
    "옛 '채널별' 행도 계속 잘려야 한다");
  const long = 'x'.repeat(2000);
  const cut = run(c, 'topicPart_(' + JSON.stringify(long) + ')');
  assert(cut.length < 1300 && cut.endsWith('…'),
    '빈 응답 폴백 본문은 헤더가 없다 — 통째로 실으면 Gmail 102KB 잘림에 걸린다');
  assert.strictEqual(run(c, 'topicPart_("짧은 글")'), '짧은 글', '짧으면 그대로');
}

// ── slotOf_ ────────────────────────────────────────────────────────────────
{
  const c = ctx(NOW, [HEAD]);
  assert.strictEqual(run(c, 'slotOf_("[장전] 제목")'), '장전');
  assert.strictEqual(run(c, 'slotOf_("  [마감] 앞 공백")'), '마감', '앞 공백 허용');
  assert.strictEqual(run(c, 'slotOf_("접두사 없는 레거시")'), '');
  assert.strictEqual(run(c, 'slotOf_("[알수없음] 미래 라벨")'), '');
}

// ── 카드도 같은 창을 쓴다 ──────────────────────────────────────────────────
{
  const c = ctx(NOW, [HEAD]);
  const ROWS = [
    { date: '2026-07-30', cat: '경제', title: '[장전] 이틀 전', line: 'x' },
    { date: YDAY, cat: '경제', title: '[장전] 어제 아침', line: 'x' },
    { date: YDAY, cat: '경제', title: '[장중] 어제 오후', line: 'x' },
    { date: YDAY, cat: '금융', title: '[마감] 어제 저녁', line: 'x' },
    { date: TODAY, cat: '경제', title: '[장전] 오늘 아침', line: 'x' },
  ];
  vm.runInContext('marketRows_ = function () { return ' + JSON.stringify(ROWS) + '; }', c);
  const dg = runJ(c, 'dailyGroups_()');
  const titles = dg.groups.reduce((a, g) => a.concat(g.items.map((i) => i.title)), []);

  assert(!titles.some((t) => t.includes('이틀 전')), '창 밖');
  assert(!titles.some((t) => t.includes('어제 아침')), '어제 장전은 어제 이미 나갔다');
  assert(titles.some((t) => t.includes('오늘 아침')));
  assert(titles.some((t) => t.includes('어제 오후')), '전일 장중이 이제 실린다');
  assert(titles.some((t) => t.includes('어제 저녁')), '전일 마감이 이제 실린다');
  assert.strictEqual(dg.today, TODAY, '제목줄 날짜는 당일이어야 한다');

  const econ = dg.groups.find((g) => g.label === '경제').items.map((i) => i.title);
  assert(econ[0].includes('오늘 아침'), '같은 카테고리 안에서 최신 날짜가 먼저');
}

// ── 오늘 카드가 없어도 전일분으로 메일이 나간다 ────────────────────────────
{
  const c = ctx(NOW, [HEAD]);
  vm.runInContext('marketRows_ = function () { return ' + JSON.stringify([
    { date: YDAY, cat: '기술', title: '[마감] 어제 저녁', line: 'x' },
  ]) + '; }', c);
  const dg = runJ(c, 'dailyGroups_()');
  assert.strictEqual(dg.groups.length, 1, 'sendDailyMarket 이 "행 없음"으로 발송을 생략하지 않아야 한다');
}

console.log('test_daily_body_window.js OK');
