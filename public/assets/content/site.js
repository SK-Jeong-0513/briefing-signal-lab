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
    samples: { ko: "오늘의 브리핑", en: "Today's briefing" },
    tech: { ko: "기술", en: "Tech" },
    finance: { ko: "금융", en: "Finance" },
    economy: { ko: "경제", en: "Economy" },
    market: { ko: "시장", en: "Market" },
    dashboard: { ko: "대시보드", en: "Dashboard" },
    library: { ko: "서재", en: "Library" },
    calendar: { ko: "경제 캘린더", en: "Calendar" },
    subscribe: { ko: "무료 구독", en: "Subscribe" },
  },
  hero: {
    kicker: { ko: "매일 아침, 신호를 읽습니다", en: "Read the signal, every morning" },
    title: {
      ko: "흩어진 기술·금융·경제 신호를<br>매일 하나의 브리핑으로.",
      en: "Scattered tech, finance & economy signals —<br>into one daily briefing.",
    },
    sub: {
      ko: "뉴스와 지표를 매일 선별해 읽기 쉬운 브리핑으로 압축합니다. 무료 구독을 신청하면 일일 브리핑, 시황 브리핑, 주간 브리핑, 스페셜 보고서를 받을 수 있습니다.",
      en: "We curate news and indicators into a briefing you can read in minutes. A free subscription gets you the daily briefing, market briefing, weekly briefing, and special reports.",
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
      ko: "매일 발행하는 브리핑에서 고른 오늘의 샘플입니다. 전체 브리핑과 근거 링크는 무료 구독 메일로 받아보실 수 있습니다.",
      en: "A sample from today's briefings. The full briefing and source links arrive in your free subscription email.",
    },
    sampleBadge: { ko: "샘플", en: "SAMPLE" },
    deliveryLabel: { ko: "전체 브리핑은 무료 구독 메일로", en: "Full briefing arrives by free email" },
    sourcesLabel: { ko: "출처", en: "Sources" },
    techMore: { ko: "기술 브리핑 전체 보기 →", en: "See all tech briefings →" },
  },
  compare: {
    heading: { ko: "MEMBERSHIP", en: "MEMBERSHIP" },
    title: { ko: "지금은 전부 무료입니다", en: "Everything is free right now" },
    freeTitle: { ko: "무료 구독", en: "Free subscription" },
    freePrice: { ko: "₩0 · 기간 제한 없음", en: "₩0 · no time limit" },
    // 무료 구독자가 실제로 받는 것만 적는다. 잠긴 항목을 나열하는 비교표보다
    // 전부 체크된 목록이 가치 제시가 강하다(전환 목적).
    rows: [
      { label: { ko: "일일 시황 브리핑 (매일 아침 메일)", en: "Daily market briefing (every morning)" }, free: true },
      { label: { ko: "주간 브리핑 — 기술·금융·경제 (월요일 메일)", en: "Weekly briefing — tech, finance, economy (Mondays)" }, free: true },
      { label: { ko: "스페셜 리포트 (심층 분석, 비정기)", en: "Special reports (in-depth, occasional)" }, free: true },
      { label: { ko: "지표 대시보드 — 관계 오버레이·섹터", en: "Indicator dashboard — overlays & sectors" }, free: true },
      { label: { ko: "서재 — 리포트·노트 전문", en: "Library — full reports and notes" }, free: true },
      { label: { ko: "경제 캘린더", en: "Economic calendar" }, free: true },
      { label: { ko: "근거·출처 링크", en: "Source links" }, free: true },
    ],
    freeCta: { ko: "무료로 구독하기", en: "Subscribe free" },
    // 유료 카드는 로드맵 표시용이라 그레이로 둔다.
    // ⚠️ 유료 전용 기능 목록을 적지 않는다 — 아직 정해지지 않았고, 지어내면 없는 사실을
    //    적는 것이며, 지금 무료로 주는 항목을 유료 칸에 옮겨 적으면 왼쪽 카드와 모순된다.
    paidTitle: { ko: "유료 구독", en: "Paid subscription" },
    paidBadge: { ko: "향후 진행", en: "Coming later" },
    paidPrice: { ko: "도입 시기·가격 추후 안내", en: "Timing and pricing to be announced" },
    paidBody: {
      ko: "서비스를 다듬는 동안 모든 브리핑을 무료로 제공합니다. 약 1년간 운영하며 개선한 뒤 유료 구독 도입을 검토할 예정이며, 도입하게 되면 미리 안내드립니다.",
      en: "Everything stays free while we refine the service. After about a year of operation and improvement we may introduce a paid tier — with notice well in advance.",
    },
    paidCta: { ko: "준비 중", en: "Coming later" },
  },
  dashboard: {
    heading: { ko: "INDICATOR DASHBOARD", en: "INDICATOR DASHBOARD" },
    title: { ko: "경제지표를 한 화면에", en: "Macro indicators at a glance" },
    sub: {
      ko: "금리↔주가, 달러↔KOSPI, 구리↔금리처럼 함께 움직이거나 반대로 가는 지표를 이중축으로 겹쳐 봅니다. 공개 데이터로 자동 갱신되는 무료 대시보드입니다.",
      en: "See indicators that move together — or opposite — overlaid on a dual axis: rates↔index, dollar↔KOSPI, copper↔rates. A free dashboard, auto-updated from public data.",
    },
    cta: { ko: "대시보드 열기", en: "Open the dashboard" },
  },
  library: {
    heading: { ko: "LIBRARY", en: "LIBRARY" },
    title: { ko: "서재 — 심층 리포트", en: "Library — deep-dive reports" },
    sub: {
      ko: "기술·금융·경제 밸류체인을 다룬 심층 리서치. 최근 리포트를 미리 봅니다.",
      en: "In-depth research across the tech, finance, and macro value chains. A preview of the latest reports.",
    },
    readMore: { ko: "리포트 읽기 →", en: "Read →" },
    cta: { ko: "서재 전체 보기 →", en: "Browse the library →" },
    empty: { ko: "리포트를 준비 중입니다.", en: "Reports coming soon." },
  },
  libraryPage: {
    backHome: { ko: "← 홈으로", en: "← Home" },
    eyebrow: { ko: "LIBRARY", en: "LIBRARY" },
    title: { ko: "서재", en: "Library" },
    sub: {
      ko: "기술·금융·경제 밸류체인을 다룬 심층 리서치 리포트와 운영자의 관심 노트. 전부 무료 공개이며, 정보 제공이지 투자 조언이 아닙니다.",
      en: "In-depth research reports across the tech, finance, and macro value chains, plus the operator's personal notes. All free — information only, not investment advice.",
    },
    filterAll: { ko: "전체", en: "All" },
    notesHeading: { ko: "운영자의 서가", en: "The operator's shelf" },
    notesSub: {
      ko: "이 플랫폼을 누가·어떤 관심으로 운영하는지 보여주는 개인 노트.",
      en: "Personal notes on who runs this and what they're into.",
    },
    emptyReports: { ko: "리포트를 준비 중입니다.", en: "Reports coming soon." },
    emptyNotes: { ko: "노트를 준비 중입니다.", en: "Notes coming soon." },
    read: { ko: "리포트 읽기 →", en: "Read →" },
    noteRead: { ko: "열어보기 →", en: "Open →" },
    cats: {
      "기술": { ko: "기술", en: "Tech" },
      "금융": { ko: "금융", en: "Finance" },
      "경제": { ko: "경제", en: "Economy" },
    },
  },
  libraryStrip: {
    eyebrow: { ko: "LIBRARY", en: "LIBRARY" },
    title: { ko: "이 분야 심층 리포트", en: "Deep-dive reports in this field" },
    cta: { ko: "서재에서 더 보기 →", en: "More in the library →" },
  },
  readPage: {
    loading: { ko: "불러오는 중…", en: "Loading…" },
    back: { ko: "← 서재로", en: "← Back to library" },
    error: { ko: "리포트를 불러오지 못했습니다.", en: "Could not load this report." },
    notFound: { ko: "요청한 리포트를 찾을 수 없습니다.", en: "Report not found." },
    koOnly: { ko: "본문은 한국어로 제공됩니다.", en: "The full text is provided in Korean." },
    disclaimer: {
      ko: "정보 제공을 위한 리서치이며 투자 조언이 아닙니다. 밸류체인 기업 언급은 관찰이며 매수·매도·목표가 판단이 아닙니다.",
      en: "Research for information only, not investment advice. Company mentions are observations, not buy/sell/target calls.",
    },
  },
  marketPage: {
    backHome: { ko: "← 홈으로", en: "← Home" },
    eyebrow: { ko: "MARKET", en: "MARKET" },
    title: { ko: "시장(주식)", en: "Market" },
    sub: {
      ko: "뉴스에 잘 안 나오는 일일 시장 신호와, 설정한 종목 위주의 브리핑. AI가 자동 생성하며 정보 제공이지 투자 조언이 아닙니다.",
      en: "Daily market signals beyond the headlines, plus briefings on your configured tickers. AI-generated, information only, not investment advice.",
    },
    aiLabel: {
      ko: "AI 자동 생성 · 정보 제공, 투자 조언 아님",
      en: "AI-generated · information only, not investment advice",
    },
    dailyHeading: { ko: "일일 시황", en: "Daily market briefing" },
    tickersHeading: { ko: "설정 종목 브리핑", en: "Configured-ticker briefings" },
    catEcon: { ko: "경제", en: "Economy" },
    catFin: { ko: "금융", en: "Finance" },
    catTech: { ko: "기술", en: "Tech" },
    empty: { ko: "시장 브리핑을 준비 중입니다.", en: "Market briefings coming soon." },
    source: { ko: "출처", en: "Source" },
  },
  cta: {
    title: { ko: "매일 아침, 신호를 놓치지 마세요", en: "Don't miss the morning signal" },
    sub: {
      ko: "일일 시황·주간 브리핑·스페셜 리포트를 무료로 받아보세요. 언제든 메일 하단 링크로 해지할 수 있습니다.",
      en: "Get the daily market, weekly briefing, and special reports — free. Unsubscribe anytime from the link in each email.",
    },
    freeCta: { ko: "무료로 구독하기", en: "Subscribe free" },
    emailPlaceholder: { ko: "이메일 주소", en: "Email address" },
    consent: {
      ko: "브리핑 메일 수신에 동의합니다. 언제든 메일 하단 링크로 해지할 수 있습니다.",
      en: "I agree to receive the briefing email. You can unsubscribe anytime via the link in each email.",
    },
    submit: { ko: "무료 구독", en: "Subscribe" },
    sending: { ko: "신청 중…", en: "Sending…" },
    done: {
      ko: "구독 신청이 접수됐습니다. 다음 브리핑부터 받아보실 수 있습니다.",
      en: "You're subscribed. You'll receive the next briefing.",
    },
    errEmail: { ko: "이메일 주소를 확인해 주세요.", en: "Please check your email address." },
    errConsent: { ko: "수신 동의가 필요합니다.", en: "Please agree to receive the email." },
    errSend: {
      ko: "신청에 실패했습니다. 잠시 후 다시 시도하거나 아래 링크로 신청해 주세요.",
      en: "Something went wrong. Please retry or use the form link below.",
    },
    formFallback: { ko: "폼으로 신청하기", en: "Use the form instead" },
    already: {
      ko: "이미 이 브라우저에서 구독을 신청하셨습니다.",
      en: "You've already subscribed from this browser.",
    },
    again: { ko: "다른 주소로 구독하기", en: "Use a different address" },
    paidCta: { ko: "유료 문의 / 대기자 등록", en: "Paid inquiry / waitlist" },
  },
  techPage: {
    backHome: { ko: "← 홈", en: "← Home" },
    eyebrow: { ko: "TECH BRIEFING", en: "TECH BRIEFING" },
    title: { ko: "기술 브리핑", en: "Tech Briefing" },
    intro: {
      ko: "기술을 돈의 흐름으로 읽는 투자자를 위한 주간 브리핑입니다. 1차 소스에서 경제지 헤드라인보다 먼저 잡은 선행 신호를, 어느 밸류체인 기업으로 이어지는가까지 연결합니다. 분야를 골라 구독하세요 — 아래는 무료 공개 요약이며, 신호 전문과 딥다이브는 유료입니다.",
      en: "A weekly briefing for investors who read technology as a flow of capital. We catch leading signals from primary sources before the headlines and connect them to the value chain. Pick a domain to follow — the summaries below are free; full signals and deep-dives are paid.",
    },
    feedHeading: { ko: "이번 주 브리핑", en: "This week's briefing" },
    freeBadge: { ko: "무료 공개", en: "Free" },
    menuLabel: { ko: "분야 선택", en: "Choose a domain" },
    soonBadge: { ko: "곧", en: "Soon" },
    weekSuffix: { ko: "· 주간 다이제스트", en: "· weekly digest" },
    digestHeading: { ko: "이번 주 선행 신호", en: "Leading signals this week" },
    signalLock: { ko: "각 신호 전문 + 근거 링크는 유료 구독", en: "Full signal text + source links are paid" },
    headBadge: { ko: "헤드라이너 딥다이브", en: "Headliner deep-dive" },
    deepLockTitle: { ko: "유료 딥다이브", en: "Paid deep-dive" },
    valueChainLabel: { ko: "밸류체인", en: "Value chain" },
    watchLabel: { ko: "관전 포인트", en: "Watch" },
    deepLockDesc: {
      ko: "메커니즘 전문 · 밸류체인 기업 명시 · 과거 아카이브는 유료 구독에서 제공됩니다.",
      en: "Full mechanism, named value-chain companies, and the archive are provided in the paid subscription.",
    },
    soonBody: {
      ko: "이 분야는 곧 공개됩니다. 먼저 가동 중인 분야를 둘러보거나, 무료 구독으로 오픈 소식을 받아보세요.",
      en: "This domain opens soon. Explore a live domain, or subscribe free to hear when it launches.",
    },
    paidEyebrow: { ko: "PAID · 분야 구독", en: "PAID · DOMAIN SUBSCRIPTION" },
    paidTitle: { ko: "고른 분야 수만큼, 매주 전체 브리핑", en: "Full weekly briefing — priced by how many domains you pick" },
    paidBody: {
      ko: "유료 구독은 고른 분야 수로 나뉩니다. 각 분야의 선행 신호 전문 + 헤드라이너 딥다이브(밸류체인 기업·관전 포인트) + 과거 아카이브를 매주 받습니다.",
      en: "Paid tiers are set by how many domains you choose. Each domain gives you full leading signals, the headliner deep-dive (named value-chain companies and watch points), and the archive — every week.",
    },
    paidCta: { ko: "유료 분야 구독 문의", en: "Request paid domain subscription" },
    paidNote: {
      ko: "정보 제공·투자 조언 아님. 밸류체인 기업은 관찰 대상으로 명시하며 매수·매도·목표가를 권유하지 않습니다. 현재 콘텐츠는 샘플이며, 유료 발송은 순차 오픈 예정입니다.",
      en: "Information only, not investment advice. Value-chain companies are named as observation targets; we do not recommend buying or selling. Current content is sample data; paid delivery rolls out in stages.",
    },
  },
  financePage: {
    eyebrow: { ko: "FINANCE BRIEFING", en: "FINANCE BRIEFING" },
    title: { ko: "금융 브리핑", en: "Finance Briefing" },
    intro: {
      ko: "종목·자산·수급을 보는 투자자를 위한 주간 금융 브리핑입니다. 자산군(분야)을 골라 구독하세요 — 아래는 무료 공개 요약이며, 신호 전문과 딥다이브는 유료입니다. 정보 제공이며 투자 조언이 아닙니다. 현재 콘텐츠는 샘플입니다.",
      en: "A weekly finance briefing for investors watching names, assets, and flows. Pick an asset-class domain — summaries below are free; full signals and deep-dives are paid. Information only, not investment advice. Current content is sample.",
    },
    feedHeading: { ko: "이번 주 브리핑", en: "This week's briefing" },
    menuLabel: { ko: "자산군 선택", en: "Choose an asset class" },
    soonBadge: { ko: "곧", en: "Soon" },
    weekSuffix: { ko: "· 주간 다이제스트", en: "· weekly digest" },
    digestHeading: { ko: "이번 주 신호", en: "Signals this week" },
    signalLock: { ko: "각 신호 전문 + 근거 링크는 유료 구독", en: "Full signal text + source links are paid" },
    headBadge: { ko: "헤드라이너 딥다이브", en: "Headliner deep-dive" },
    deepLockTitle: { ko: "유료 딥다이브", en: "Paid deep-dive" },
    valueChainLabel: { ko: "관련 자산", en: "Linked assets" },
    watchLabel: { ko: "관전 포인트", en: "Watch" },
    deepLockDesc: {
      ko: "관련 종목/자산 · 근거 · 과거 아카이브는 유료 구독에서 제공됩니다. 투자 조언 아님.",
      en: "Linked names/assets, sources, and the archive are in the paid subscription. Not investment advice.",
    },
    soonBody: {
      ko: "이 자산군은 곧 공개됩니다. 먼저 가동 중인 자산군을 둘러보거나, 무료 구독으로 오픈 소식을 받아보세요.",
      en: "This asset class opens soon. Explore a live one, or subscribe free to hear when it launches.",
    },
    paidEyebrow: { ko: "PAID · 자산군 구독", en: "PAID · ASSET-CLASS SUBSCRIPTION" },
    paidTitle: { ko: "고른 자산군 수만큼, 매주 전체 브리핑", en: "Full weekly briefing — priced by asset classes you pick" },
    paidBody: {
      ko: "유료 구독은 고른 자산군 수로 나뉩니다. 각 자산군의 신호 전문 + 헤드라이너 딥다이브(관련 종목·관전 포인트) + 과거 아카이브를 매주 받습니다.",
      en: "Paid tiers are set by how many asset classes you choose. Each gives full signals, the headliner deep-dive, and the archive weekly.",
    },
    paidCta: { ko: "유료 자산군 구독 문의", en: "Request paid subscription" },
    paidNote: {
      ko: "정보 제공·투자 조언 아님. 종목·자산은 관찰 대상으로 명시하며 매수·매도·목표가를 권유하지 않습니다. 현재 콘텐츠는 샘플입니다.",
      en: "Information only, not investment advice. Names/assets are named as observation targets; no buy/sell recommendation. Current content is sample.",
    },
  },
  economyPage: {
    eyebrow: { ko: "ECONOMY BRIEFING", en: "ECONOMY BRIEFING" },
    title: { ko: "경제 브리핑", en: "Economy Briefing" },
    intro: {
      ko: "금리 결정·물가·고용·무역/환율 등 매크로를 한 번에 읽는 주간 경제 브리핑입니다. 아래는 무료 공개 요약이며, 전체 해석과 딥다이브는 유료입니다. 정보 제공이며 투자 조언이 아닙니다. 현재 콘텐츠는 샘플입니다.",
      en: "A weekly macro briefing reading rate decisions, inflation, jobs, and trade/FX in one place. Summaries below are free; full analysis and the deep-dive are paid. Information only, not investment advice. Current content is sample.",
    },
    feedHeading: { ko: "이번 주 매크로 브리핑", en: "This week's macro briefing" },
    weekSuffix: { ko: "· 주간 다이제스트", en: "· weekly digest" },
    digestHeading: { ko: "이번 주 매크로 신호", en: "Macro signals this week" },
    signalLock: { ko: "각 신호 전문 + 근거 링크는 유료 구독", en: "Full signal text + source links are paid" },
    headBadge: { ko: "헤드라이너 딥다이브", en: "Headliner deep-dive" },
    deepLockTitle: { ko: "유료 딥다이브", en: "Paid deep-dive" },
    valueChainLabel: { ko: "영향 자산", en: "Assets in play" },
    watchLabel: { ko: "관전 포인트", en: "Watch" },
    deepLockDesc: {
      ko: "지표 해석 전문 · 영향 자산 · 과거 아카이브는 유료 구독에서 제공됩니다. 투자 조언 아님.",
      en: "Full indicator analysis, assets in play, and the archive are in the paid subscription. Not investment advice.",
    },
    paidEyebrow: { ko: "PAID · 매크로 구독", en: "PAID · MACRO SUBSCRIPTION" },
    paidTitle: { ko: "매주 전체 매크로 브리핑", en: "Full weekly macro briefing" },
    paidBody: {
      ko: "유료 구독은 전체 매크로 신호 전문 + 헤드라이너 딥다이브(영향 자산·관전 포인트) + 과거 아카이브를 매주 제공합니다.",
      en: "Paid gives full macro signals, the headliner deep-dive (assets in play, watch points), and the archive every week.",
    },
    paidCta: { ko: "유료 매크로 구독 문의", en: "Request paid macro subscription" },
    paidNote: {
      ko: "정보 제공·투자 조언 아님. 지표·자산은 관찰 대상으로 명시하며 매수·매도를 권유하지 않습니다. 현재 콘텐츠는 샘플입니다.",
      en: "Information only, not investment advice. Indicators/assets are named as observation targets; no buy/sell recommendation. Current content is sample.",
    },
  },
  dashboardPage: {
    eyebrow: { ko: "INDICATOR DASHBOARD", en: "INDICATOR DASHBOARD" },
    title: { ko: "관계로 읽는 지표 대시보드", en: "A dashboard that reads relationships" },
    intro: {
      ko: "숫자 나열이 아니라 '무엇이 무엇과 함께, 또는 반대로 움직이나'를 봅니다. 두 지표를 이중축으로 겹쳐 관계를 읽는 대시보드입니다 — 금리↔지수, 달러↔KOSPI, 구리↔금리 등. 공개 출처 실데이터로 자동 갱신됩니다. 정보 제공이며 투자 조언이 아닙니다.",
      en: "Not a wall of numbers — this reads what moves together, or opposite. Two indicators overlaid on a dual axis: rates↔index, dollar↔KOSPI, copper↔rates, and more. Auto-updated from public data. Information only, not investment advice.",
    },
    pairsHeading: { ko: "관계 오버레이", en: "Relationship overlays" },
    pairsLabel: { ko: "관계 페어 선택", en: "Choose a pair" },
    readNote: {
      ko: "이중 Y축은 좌·우 눈금이 다릅니다. 절대 수준보다 '같이/반대로 움직이는 방향'을 보세요. 페어에 따라 우축 종목을 드롭다운으로 바꿀 수 있습니다. 상관계수는 향후 추가 예정.",
      en: "The two Y-axes use different scales. Read the direction (together vs opposite), not absolute levels. For some pairs you can switch the right-axis name via the dropdown. Correlation is coming next.",
    },
    secHeading: { ko: "미 섹터별 지표", en: "US sector indicators" },
    secIntro: {
      ko: "S&P 11개 섹터 ETF의 최근 추세와 약 1개월 변화입니다. 오버레이는 두 지표의 관계를 보지만, 섹터는 '어느 쪽이 앞서나'를 나란히 놓고 봐야 읽힙니다. 정보 제공이며 투자 조언이 아닙니다.",
      en: "Recent trend and ~1-month change for the 11 S&P sector ETFs. Overlays read a relationship between two series; sectors need to sit side by side to show which is leading. Information only, not investment advice.",
    },
    vcHeading: { ko: "산업 밸류체인 지표", en: "Value-chain indicators" },
    vcIntro: {
      ko: "반도체 밸류체인을 주가·ETF로 근사한 자동 프록시 + 무료 API가 없는 핵심 지표(수동). 각 카드는 최근 추세와 약 1개월 변화를 보여줍니다. 정보 제공이며 투자 조언이 아닙니다.",
      en: "Auto proxies (ETFs/names) approximating the semi value chain, plus key indicators with no free API (manual). Each card shows the recent trend and ~1-month change. Information only, not investment advice.",
    },
  },
  calendarPage: {
    backHome: { ko: "← 홈", en: "← Home" },
    eyebrow: { ko: "ECONOMIC CALENDAR", en: "ECONOMIC CALENDAR" },
    title: { ko: "경제 캘린더", en: "Economic Calendar" },
    intro: {
      ko: "국내·글로벌 주요 경제 일정과 내 일정을 한 곳에서. 지역·분류·영향도로 필터링하고, 격자(월간)와 리스트를 전환해 보세요. 날짜는 형식 검증용 샘플입니다.",
      en: "Domestic and global economic events plus your own, in one place. Filter by region, category, and impact; switch between grid (month) and list. Dates are sample data.",
    },
    viewGrid: { ko: "격자", en: "Grid" },
    viewList: { ko: "리스트", en: "List" },
    today: { ko: "오늘", en: "Today" },
    prev: { ko: "이전 달", en: "Prev" },
    next: { ko: "다음 달", en: "Next" },
    lblRegion: { ko: "지역", en: "Region" },
    lblCategory: { ko: "분류", en: "Category" },
    lblImportance: { ko: "영향도", en: "Impact" },
    all: { ko: "전체", en: "All" },
    empty: { ko: "해당 조건의 일정이 없습니다.", en: "No events match the filters." },
    moreSuffix: { ko: "건 더", en: "more" },
    regions: {
      kr: { ko: "한국", en: "Korea" },
      us: { ko: "미국", en: "US" },
      cn: { ko: "중국", en: "China" },
      eu: { ko: "유럽", en: "Europe" },
      etc: { ko: "기타", en: "Other" },
    },
    categories: {
      indicator: { ko: "경제지표", en: "Indicators" },
      policy: { ko: "통화정책", en: "Policy" },
      bond: { ko: "채권·입찰", en: "Bonds" },
      earnings: { ko: "실적", en: "Earnings" },
      event: { ko: "컨퍼런스·이벤트", en: "Events" },
      mine: { ko: "내 일정", en: "Mine" },
    },
    importances: {
      high: { ko: "높음", en: "High" },
      mid: { ko: "보통", en: "Med" },
      low: { ko: "낮음", en: "Low" },
    },
    weekdays: { ko: ["일", "월", "화", "수", "목", "금", "토"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    months: {
      ko: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
      en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    },
  },
  soon: {
    badge: { ko: "준비 중", en: "COMING SOON" },
    suffix: { ko: "브리핑 · 준비 중", en: "Briefing · coming soon" },
    body: {
      ko: "이 카테고리 브리핑 화면을 준비하고 있습니다. 먼저 기술 브리핑을 둘러보거나, 무료 구독으로 오픈 소식을 받아보세요.",
      en: "We're preparing this category's briefing screen. Meanwhile, explore the tech briefing or subscribe free to hear when it opens.",
    },
    seeTech: { ko: "기술 브리핑 보기 →", en: "See tech briefing →" },
  },
  footer: {
    disclaimerTitle: { ko: "면책 안내", en: "Disclaimer" },
    disclaimer: {
      ko: "본 서비스의 모든 브리핑은 정보 제공과 관찰 노트를 목적으로 하며 투자 조언이 아닙니다. 특정 종목의 매수·매도를 권유하지 않습니다. 데이터의 실시간성과 정확성을 보장하지 않으며, 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다. 기술 브리핑은 공개 출처 기반 관찰이며, 그 외 카테고리의 수치·종목은 형식 검증용 샘플입니다.",
      en: "All briefings are for information and observation only and are not investment advice. We do not recommend buying or selling any security. We do not guarantee real-time accuracy; investment decisions and outcomes are the user's own responsibility. The tech briefing is observation based on public sources; figures and tickers in other categories are sample data for format validation.",
    },
    sourceNote: {
      ko: "기사 전문을 복사하지 않으며 제목·링크·짧은 요약·자체 해석 중심으로 구성합니다.",
      en: "We do not copy full articles; content is built from titles, links, short summaries, and our own analysis.",
    },
    rights: { ko: "© 2026 Briefing Signal Lab. All rights reserved.", en: "© 2026 Briefing Signal Lab. All rights reserved." },
  },
};

/* 사이트 안에서 바로 구독받기 위한 설정.
 * 브리핑 구독 전용 Google Form에 직접 POST한다(새 탭 이동 없음).
 *
 * ⚠️ formId가 비어 있으면 인라인 폼을 숨기고 기존 LINKS.freeForm 버튼으로 폴백한다.
 *    (폼을 만들기 전에 배포돼도 구독 경로가 끊기지 않게 하기 위함)
 *
 * 설정 방법: 질문 3개짜리 폼을 만들고 응답을 메일러가 읽는 스프레드시트에 연결한 뒤,
 *   폼 URL을 열어 각 질문의 entry ID를 채운다. 질문 제목은 메일러 CFG.RESP_COL과
 *   정확히 같아야 한다 — '이메일 주소' · '메일 수신 동의' · '관심 키워드'.
 *   consent 값은 메일러가 '동의' 포함 여부로 판정한다(CFG.CONSENT_TRUE_INCLUDES). */
const SUBSCRIBE_FORM = {
  // 'Briefing Signal Lab 구독' 폼 (2026-07-28 연결)
  formId: "1FAIpQLSeR6wZ2WbX-l1gEr7-CMkCUfTJnZplcuIU_KoT90BKFUIpWJw",
  emailEntry: "entry.971071144",                    // '이메일 주소(E-Mail Address)'
  consentEntry: "entry.1751406240",                 // '메일 수신 동의'
  consentValue: "동의합니다(Email Subscription)",     // 보기 문구와 한 글자도 달라선 안 됨
  keywordEntry: "",                                 // '관심 키워드'(entry.718041000)는 체크박스라 미전송
};

/* 외부 링크 — Google Form (사전 채움: 무료 버튼→무료 선택, 유료 버튼→유료 선택) */
const LINKS = {
  freeForm: "https://docs.google.com/forms/d/e/1FAIpQLSfHbfam4SIVNT7QNqSyQA8wM9iCLr86ti13PpDC8XW5VplenQ/viewform?usp=pp_url&entry.1513874908=%EB%AC%B4%EB%A3%8C+%EC%83%98%ED%94%8C+%EA%B5%AC%EB%8F%85",
  // 유료 문의 폼은 비워 둔다(2026-08-03). 여기 있던 URL은 freeForm 과 폼 ID가 같은
  // 옛 'Biz Signal Lab'(AI 사업 진단, 필수 15문항) 폼이라, 유료 문의를 누른 사람이
  // 브리핑과 무관한 컨설팅 설문을 만나고 있었다. 잘못된 곳으로 보내느니 감춘다.
  // ⚠️ 비어 있으면 유료 CTA가 전부 숨겨진다(랜딩 CTA·기술/금융/경제 유료 섹션·요금제 비교).
  //    유료 대기자 폼을 만들면 여기에 URL만 넣으면 버튼이 그대로 다시 나타난다.
  paidForm: "",
};

/* 공개 주간 발행 스냅샷: BSL_market의 '주간-발행항목' 탭 게시 CSV.
 * deploy-pages.yml이 WEEKLY_RELEASE_ITEMS_CSV Secret을 배포 사본에 주입한다.
 * 비어 있으면 안전하게 정적 샘플을 유지하며 승인 초안을 공개하지 않는다. */
const WEEKLY_RELEASE_ITEMS_CSV = "";

/* 서재(Library) 업로드 경로: '서재' 탭 게시 CSV. 비우면 library.json(.md)만 사용.
 * 채우면 시트 행이 리포트로 병합됨(본문 md를 셀에 담아 .md 파일 없이 업로드).
 * 열: id · 유형(report/note) · 분류(기술/금융/경제) · 발행일 · 제목 · 요약 · 태그 · 본문 · access */
const LIBRARY_SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR9qlZFl78TiUcCCKApDu7dD_4rkGF8tlYWpyV2dzaTQg6WFtd9DJoNMyjyPa-dn21JzQ1ivAVKPd31/pub?gid=1244768960&single=true&output=csv";

/* 방문 기록 비콘: Apps Script 웹앱(analytics/Code.gs)의 /exec URL. 비우면 기록 안 함.
 * 이미지 비콘(GET)이라 CORS 없음. '방문로그' 탭에 [날짜시각·페이지·referrer·방문자ID] append.
 * 방문자ID=localStorage 익명 난수(쿠키·PII 아님, 대략적 순방문 추정용). */
const VISITS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxjk9S4iX05szMJXP0f13rDA9eUQsho1jaURa2PNxsG_gETp65CsihFWjQ5WzRR2xeNXQ/exec";

/* ── 브리핑 합치기 — 카테고리 파일들을 하나의 BRIEFINGS로 (없는 카테고리는 안전하게 건너뜀) ── */
const BRIEFINGS = [].concat(
  typeof BRIEFINGS_TECH !== "undefined" ? BRIEFINGS_TECH : [],
  typeof BRIEFINGS_FINANCE !== "undefined" ? BRIEFINGS_FINANCE : [],
  typeof BRIEFINGS_ECONOMY !== "undefined" ? BRIEFINGS_ECONOMY : []
);
