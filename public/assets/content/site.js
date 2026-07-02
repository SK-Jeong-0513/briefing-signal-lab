/* Briefing Signal Lab — 사이트 공통 콘텐츠.
 * UI 카피(i18n) · 대시보드 지표 · 서재 · 외부 링크.
 * 브리핑 데이터는 카테고리별 파일(tech.js / finance.js / economy.js)에서 정의되고,
 * 이 파일 맨 아래에서 BRIEFINGS로 합쳐진다. (index.html은 카테고리 파일 → site.js → script.js 순으로 로드)
 * 새 카테고리 추가: content/<name>.js 만들고 index.html에 script 추가, 아래 BRIEFINGS 합치기에 편입.
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
    techMore: { ko: "기술 브리핑 전체 보기 →", en: "See all tech briefings →" },
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
  techPage: {
    backHome: { ko: "← 홈", en: "← Home" },
    eyebrow: { ko: "TECH BRIEFING", en: "TECH BRIEFING" },
    title: { ko: "기술 브리핑", en: "Tech Briefing" },
    intro: {
      ko: "반도체·AI·소재·우주 등 기술 신호를 매일 선별해 요약합니다. 아래는 무료 공개 요약이며, 전체 심층본과 키워드 맞춤 브리핑은 유료(이메일)로 제공됩니다.",
      en: "We curate daily tech signals across chips, AI, materials, and space. Below are the free public summaries; full deep-dives and keyword-tailored briefings are paid (by email).",
    },
    feedHeading: { ko: "최근 기술 브리핑", en: "Latest tech briefings" },
    paidEyebrow: { ko: "PAID · 키워드 맞춤", en: "PAID · CUSTOM KEYWORDS" },
    paidTitle: { ko: "원하는 키워드로, 매일 이메일 브리핑", en: "Your keywords, briefed to your inbox daily" },
    paidBody: {
      ko: "관심 키워드를 고르면 해당 주제만 선별해 매일 이메일로 브리핑을 보내드립니다. 아래는 예시 키워드입니다.",
      en: "Pick your keywords and we send a daily email briefing curated to just those topics. Examples below.",
    },
    topicsLabel: { ko: "예시 키워드", en: "Example keywords" },
    paidCta: { ko: "유료 키워드 브리핑 신청", en: "Request paid keyword briefing" },
    paidNote: {
      ko: "정보 제공·투자 조언 아님. 개인화 이메일 발송은 순차 오픈 예정이며, 현재 콘텐츠는 샘플입니다.",
      en: "Information only, not investment advice. Personalized email delivery rolls out in stages; current content is sample data.",
    },
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

/* 유료 키워드 예시 칩 (설명용). 새 키워드는 여기 추가 */
const TOPICS = [
  { ko: "CPO", en: "CPO" },
  { ko: "Glass Substrate", en: "Glass Substrate" },
  { ko: "우주", en: "Space" },
  { ko: "메모리", en: "Memory" },
  { ko: "HBM", en: "HBM" },
  { ko: "이차전지", en: "Battery" },
  { ko: "로봇", en: "Robotics" },
  { ko: "양자", en: "Quantum" },
];

/* 외부 링크 — Google Form (사전 채움: 무료 버튼→무료 선택, 유료 버튼→유료 선택) */
const LINKS = {
  freeForm: "https://docs.google.com/forms/d/e/1FAIpQLSfHbfam4SIVNT7QNqSyQA8wM9iCLr86ti13PpDC8XW5VplenQ/viewform?usp=pp_url&entry.1513874908=%EB%AC%B4%EB%A3%8C+%EC%83%98%ED%94%8C+%EA%B5%AC%EB%8F%85",
  paidForm: "https://docs.google.com/forms/d/e/1FAIpQLSfHbfam4SIVNT7QNqSyQA8wM9iCLr86ti13PpDC8XW5VplenQ/viewform?usp=pp_url&entry.1513874908=%EC%9C%A0%EB%A3%8C+%EC%A0%84%EC%B2%B4+%EB%B8%8C%EB%A6%AC%ED%95%91+%EB%AC%B8%EC%9D%98",
};

/* ── 브리핑 합치기 — 카테고리 파일들을 하나의 BRIEFINGS로 (없는 카테고리는 안전하게 건너뜀) ── */
const BRIEFINGS = [].concat(
  typeof BRIEFINGS_TECH !== "undefined" ? BRIEFINGS_TECH : [],
  typeof BRIEFINGS_FINANCE !== "undefined" ? BRIEFINGS_FINANCE : [],
  typeof BRIEFINGS_ECONOMY !== "undefined" ? BRIEFINGS_ECONOMY : []
);
