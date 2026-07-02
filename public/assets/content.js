/* Briefing Signal Lab — 콘텐츠 데이터
 * 모든 카피는 {ko, en} 구조. 브리핑은 plan.md의 Briefing Issue 필드에 맞춤.
 * 실데이터(IonQ/Telegram) 연동 시 BRIEFINGS 배열만 교체하면 됨.
 * 주의: 아래 수치·종목은 전부 형식 검증용 "샘플·예시" 데이터. 실제 시장 데이터 아님.
 */

/* ── UI 카피 (i18n) ───────────────────────────────────── */
const UI = {
  brand: { ko: "브리핑 시그널 랩", en: "Briefing Signal Lab" },
  nav: {
    tech: { ko: "기술", en: "Tech" },
    finance: { ko: "금융", en: "Finance" },
    economy: { ko: "경제", en: "Economy" },
    dashboard: { ko: "대시보드", en: "Dashboard" },
    library: { ko: "서재", en: "Library" },
    subscribe: { ko: "무료 구독", en: "Subscribe" },
  },
  hero: {
    kicker: { ko: "매일 아침, 신호를 읽습니다", en: "Read the signal, every morning" },
    title: {
      ko: "흩어진 기술·금융·경제 신호를<br>매일 하나의 브리핑으로.",
      en: "Scattered tech, finance & economy signals —<br>into one daily briefing.",
    },
    sub: {
      ko: "뉴스와 지표를 매일 선별해 읽기 쉬운 브리핑으로 압축합니다. 무료 구독자는 샘플을, 유료 구독자는 전체 브리핑과 아카이브를 받습니다.",
      en: "We curate news and indicators into a briefing you can read in minutes. Free members get samples; paid members get the full briefing and archive.",
    },
    ctaPrimary: { ko: "무료로 구독하기", en: "Subscribe free" },
    ctaSecondary: { ko: "샘플 브리핑 보기", en: "See sample briefings" },
  },
  what: {
    heading: { ko: "WHAT WE DO", en: "WHAT WE DO" },
    title: { ko: "요약이 아니라, 연결된 신호.", en: "Not just summaries — connected signals." },
    body: {
      ko: "단순 뉴스 요약이 아닙니다. 기술 변화, 금융 시장, 경제지표를 서로 연결해 '오늘 무엇을 봐야 하는지'를 짚습니다. 매일 같은 시간, 같은 형식으로 도착해 습관이 됩니다.",
      en: "This isn't a news digest. We connect technology shifts, market moves, and macro indicators to tell you what actually matters today — delivered at the same time, in the same shape, every day.",
    },
    points: [
      { ko: "매일 선별", en: "Curated daily" },
      { ko: "3분 안에 읽기", en: "Read in 3 minutes" },
      { ko: "출처 표기", en: "Sources cited" },
      { ko: "아카이브 검색", en: "Searchable archive" },
    ],
  },
  samples: {
    heading: { ko: "TODAY'S SIGNALS", en: "TODAY'S SIGNALS" },
    title: { ko: "오늘의 샘플 브리핑", en: "Today's sample briefings" },
    sub: {
      ko: "무료 구독자가 받는 축약 버전입니다. 전체 브리핑·근거 링크·과거 아카이브는 유료 구독자에게 제공됩니다.",
      en: "This is the free short version. Full briefings, source links, and the archive are for paid members.",
    },
    sampleBadge: { ko: "샘플", en: "SAMPLE" },
    lockedLabel: { ko: "전체 브리핑은 유료 구독", en: "Full briefing — paid" },
    sourcesLabel: { ko: "출처", en: "Sources" },
  },
  compare: {
    heading: { ko: "MEMBERSHIP", en: "MEMBERSHIP" },
    title: { ko: "무료로 확인하고, 유료로 전부 받으세요", en: "Try it free, get everything on paid" },
    freeTitle: { ko: "무료 구독", en: "Free" },
    freePrice: { ko: "₩0 · 기간 제한 없음", en: "₩0 · no time limit" },
    paidTitle: { ko: "유료 구독", en: "Paid" },
    paidPrice: { ko: "가격 추후 공개 · 현재 대기자 등록", en: "Pricing soon · join waitlist" },
    rows: [
      { label: { ko: "오늘의 샘플 브리핑", en: "Daily sample briefing" }, free: true, paid: true },
      { label: { ko: "핵심 요약 3줄", en: "3-line key summary" }, free: true, paid: true },
      { label: { ko: "전체 브리핑(기술·금융·경제)", en: "Full briefing (all categories)" }, free: false, paid: true },
      { label: { ko: "근거 링크·상세 해석", en: "Source links & analysis" }, free: false, paid: true },
      { label: { ko: "경제지표 대시보드 전체", en: "Full indicator dashboard" }, free: false, paid: true },
      { label: { ko: "브리핑 아카이브 검색", en: "Searchable briefing archive" }, free: false, paid: true },
      { label: { ko: "이메일 발송", en: "Email delivery" }, free: false, paid: true },
    ],
    freeCta: { ko: "무료로 구독하기", en: "Subscribe free" },
    paidCta: { ko: "유료 대기자 등록", en: "Join paid waitlist" },
  },
  dashboard: {
    heading: { ko: "INDICATOR DASHBOARD", en: "INDICATOR DASHBOARD" },
    title: { ko: "경제지표를 한 화면에", en: "Macro indicators at a glance" },
    sub: {
      ko: "브리핑과 연결된 경제지표 대시보드. 아래는 샘플 카드이며, 전체 지표와 과거 스냅샷은 유료 구독자에게 제공됩니다.",
      en: "An indicator dashboard connected to the briefing. Cards below are samples; the full set and historical snapshots are for paid members.",
    },
    sampleNote: { ko: "샘플 데이터 · 실시간 아님", en: "Sample data · not real-time" },
    locked: { ko: "유료", en: "Paid" },
  },
  library: {
    heading: { ko: "PERSONAL LIBRARY", en: "PERSONAL LIBRARY" },
    title: { ko: "누가, 왜 만드는가", en: "Who builds this, and why" },
    sub: {
      ko: "운영자의 관점과 자동화 구축 기록입니다. 상품이 아니라, 이 플랫폼을 누가 운영하는지 보여주는 신뢰 보강 글입니다.",
      en: "Notes from the operator on building the automation behind this. Not a product — context on who runs this platform.",
    },
    readMore: { ko: "읽기", en: "Read" },
  },
  cta: {
    title: { ko: "매일 아침, 신호를 놓치지 마세요", en: "Don't miss the morning signal" },
    sub: {
      ko: "무료 구독은 샘플 브리핑을 매일 받습니다. 유료 전체 브리핑은 현재 대기자 등록으로 수요를 확인하고 있습니다.",
      en: "Free members get sample briefings daily. The full paid briefing is currently in waitlist validation.",
    },
    freeCta: { ko: "무료로 구독하기", en: "Subscribe free" },
    paidCta: { ko: "유료 문의 / 대기자 등록", en: "Paid inquiry / waitlist" },
  },
  footer: {
    disclaimerTitle: { ko: "면책 안내", en: "Disclaimer" },
    disclaimer: {
      ko: "본 서비스의 모든 브리핑은 정보 제공과 관찰 노트를 목적으로 하며 투자 조언이 아닙니다. 특정 종목의 매수·매도를 권유하지 않습니다. 데이터의 실시간성과 정확성을 보장하지 않으며, 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다. 현재 페이지의 수치·종목은 형식 검증용 샘플 데이터입니다.",
      en: "All briefings are for information and observation only and are not investment advice. We do not recommend buying or selling any security. We do not guarantee real-time accuracy; investment decisions and outcomes are the user's own responsibility. Figures and tickers on this page are sample data for format validation.",
    },
    sourceNote: {
      ko: "기사 전문을 복사하지 않으며 제목·링크·짧은 요약·자체 해석 중심으로 구성합니다.",
      en: "We do not copy full articles; content is built from titles, links, short summaries, and our own analysis.",
    },
    rights: { ko: "© 2026 Briefing Signal Lab. All rights reserved.", en: "© 2026 Briefing Signal Lab. All rights reserved." },
  },
};

/* ── 샘플 브리핑 (Briefing Issue 구조) ────────────────────
 * access_level: 'free' = 무료 축약 공개 / 'paid' = 유료 전체
 * spark: 미니 스파크라인용 샘플 시계열(장식/데이터 시각 요소, 실데이터 아님)
 */
const BRIEFINGS = [
  {
    id: "tech-2026-07-02",
    date: "2026-07-02",
    category: "tech",
    label: { ko: "기술", en: "Tech" },
    title: {
      ko: "온디바이스 추론이 다음 반도체 수요를 만든다",
      en: "On-device inference is shaping the next chip demand",
    },
    summary: {
      ko: [
        "저전력 NPU를 얹은 신형 모바일 칩 발표가 이어지며 온디바이스 추론 경쟁이 본격화.",
        "클라우드 비용 부담이 커지자 엣지 추론으로 워크로드를 옮기려는 움직임이 관찰됨.",
        "관전 포인트: 메모리 대역폭과 전력 효율이 실제 채택 속도를 가른다.",
      ],
      en: [
        "A wave of new mobile chips with low-power NPUs pushes on-device inference into real competition.",
        "Rising cloud costs are nudging workloads toward edge inference.",
        "Watch: memory bandwidth and power efficiency will decide adoption speed.",
      ],
    },
    tags: ["AI", "반도체", "온디바이스"],
    sources: [
      { name: "Vendor Keynote", note: { ko: "제품 발표", en: "Product keynote" } },
      { name: "Industry Note", note: { ko: "업계 관찰", en: "Industry note" } },
    ],
    access_level: "free",
    spark: [4, 5, 5, 6, 8, 7, 9, 11, 10, 13],
  },
  {
    id: "finance-2026-07-02",
    date: "2026-07-02",
    category: "finance",
    label: { ko: "금융", en: "Finance" },
    title: {
      ko: "AI·전력 테마, 실적 시즌 앞두고 변동성 확대",
      en: "AI & power themes: volatility widens ahead of earnings",
    },
    summary: {
      ko: [
        "데이터센터 전력 수요 서사가 이어지며 관련 테마의 거래량이 늘어남.",
        "실적 발표를 앞두고 기대와 차익 실현이 엇갈려 일중 변동성이 커짐.",
        "관전 포인트: 가이던스 톤과 설비투자 계획이 방향을 좌우.",
      ],
      en: [
        "The data-center power-demand narrative keeps volume elevated in related names.",
        "Ahead of earnings, expectation vs. profit-taking widens intraday swings.",
        "Watch: guidance tone and capex plans will set direction.",
      ],
    },
    tags: ["실적", "전력", "AI 테마"],
    sources: [
      { name: "Market Wrap", note: { ko: "시황 요약", en: "Market wrap" } },
      { name: "Filing Note", note: { ko: "공시 관찰", en: "Filing note" } },
    ],
    access_level: "free",
    disclaimer: true,
    spark: [12, 11, 13, 10, 9, 12, 8, 11, 7, 9],
  },
  {
    id: "economy-2026-07-02",
    date: "2026-07-02",
    category: "economy",
    label: { ko: "경제", en: "Economy" },
    title: {
      ko: "금리·환율·원자재, 오늘 볼 3개의 매크로 신호",
      en: "Rates, FX, commodities: three macro signals for today",
    },
    summary: {
      ko: [
        "장기 금리 흐름이 성장주 밸류에이션에 미치는 압력이 다시 주목됨.",
        "환율 변동이 수출 섹터와 외국인 수급 심리에 반영되는 구간.",
        "관전 포인트: 금·원유 등 원자재가 인플레 기대의 방향타 역할.",
      ],
      en: [
        "Long-end rates are back in focus for growth-stock valuations.",
        "FX moves are feeding through to exporters and foreign-flow sentiment.",
        "Watch: gold and oil act as a compass for inflation expectations.",
      ],
    },
    tags: ["금리", "환율", "원자재"],
    sources: [
      { name: "Macro Brief", note: { ko: "매크로 브리프", en: "Macro brief" } },
      { name: "Rates Desk", note: { ko: "금리 관찰", en: "Rates desk" } },
    ],
    access_level: "free",
    spark: [6, 6, 7, 7, 6, 8, 9, 8, 10, 9],
  },
];

/* ── 대시보드 티저 지표 카드 (샘플 데이터) ─────────────── */
const INDICATORS = [
  { key: "kospi", label: { ko: "KOSPI", en: "KOSPI" }, value: "2,7xx.x", change: "+0.6%", dir: "up", locked: false },
  { key: "us-fut", label: { ko: "미국 선물", en: "US Futures" }, value: "+0.3%", change: "야간", dir: "up", locked: false },
  { key: "us10y", label: { ko: "미국 10년 금리", en: "US 10Y" }, value: "4.xx%", change: "-2bp", dir: "down", locked: false },
  { key: "gold", label: { ko: "금", en: "Gold" }, value: "$2,xxx", change: "+0.4%", dir: "up", locked: true },
  { key: "btc", label: { ko: "비트코인", en: "Bitcoin" }, value: "$xx,xxx", change: "-1.1%", dir: "down", locked: true },
  { key: "foreign", label: { ko: "외국인 수급", en: "Foreign flow" }, value: "순매수", change: "샘플", dir: "up", locked: true },
];

/* ── 서재 티저 글 ──────────────────────────────────────── */
const LIBRARY = [
  {
    id: "lib-1",
    title: { ko: "브리핑 엔진을 GitHub Actions로 매일 돌리기", en: "Running a briefing engine daily on GitHub Actions" },
    summary: {
      ko: "뉴스 수집·요약·발송을 무인으로 굴리며 마주친 크론 안정성과 비용 이야기.",
      en: "Lessons on cron reliability and cost from running unattended collect–summarize–send.",
    },
    tags: ["자동화", "인프라"],
  },
  {
    id: "lib-2",
    title: { ko: "LLM 요약 체인: 무엇을 신뢰하고 무엇을 검수하는가", en: "LLM summary chains: what to trust, what to review" },
    summary: {
      ko: "Gemini·Claude 폴백 구조에서 품질을 지키기 위한 검수 단계 설계.",
      en: "Designing a review step to keep quality in a Gemini/Claude fallback chain.",
    },
    tags: ["LLM", "품질"],
  },
  {
    id: "lib-3",
    title: { ko: "지표를 신호로 바꾸는 대시보드 설계 노트", en: "Turning indicators into signals: a dashboard note" },
    summary: {
      ko: "수십 개 지표 중 매일 무엇을 앞에 둘지 고르는 기준에 대하여.",
      en: "On choosing which of dozens of indicators deserves the front row each day.",
    },
    tags: ["대시보드", "설계"],
  },
];

/* 외부 링크 — Google Form (사전 채움: 무료 버튼→무료 선택, 유료 버튼→유료 선택) */
const LINKS = {
  freeForm: "https://docs.google.com/forms/d/e/1FAIpQLSfHbfam4SIVNT7QNqSyQA8wM9iCLr86ti13PpDC8XW5VplenQ/viewform?usp=pp_url&entry.1513874908=%EB%AC%B4%EB%A3%8C+%EC%83%98%ED%94%8C+%EA%B5%AC%EB%8F%85",
  paidForm: "https://docs.google.com/forms/d/e/1FAIpQLSfHbfam4SIVNT7QNqSyQA8wM9iCLr86ti13PpDC8XW5VplenQ/viewform?usp=pp_url&entry.1513874908=%EC%9C%A0%EB%A3%8C+%EC%A0%84%EC%B2%B4+%EB%B8%8C%EB%A6%AC%ED%95%91+%EB%AC%B8%EC%9D%98",
};
