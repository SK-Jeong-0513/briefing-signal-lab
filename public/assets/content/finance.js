/* 금융(Finance) 브리핑 데이터 — 최신순.
 * 탭 작업 = 이 배열에 항목 추가/교체. Briefing Issue 필드(plan.md) 준수.
 * 금융 항목은 disclaimer: true 를 넣으면 카드에 "정보 제공·투자 조언 아님" 인라인 배지가 붙는다.
 * 주의: 수치·종목은 형식 검증용 "샘플·예시" 데이터.
 */
const BRIEFINGS_FINANCE = [
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
    id: "finance-2026-07-01",
    date: "2026-07-01",
    category: "finance",
    label: { ko: "금융", en: "Finance" },
    title: {
      ko: "반도체 업황 바닥론, 실적 눈높이 재조정 국면",
      en: "Chip-cycle trough talk: earnings estimates get reset",
    },
    summary: {
      ko: [
        "메모리 가격 반등 신호가 나오며 반도체 업황 바닥론에 힘이 실림.",
        "다만 실적 추정치 상향은 아직 제한적이라 밸류에이션 부담이 병존.",
        "관전 포인트: 재고 정상화 속도와 하반기 수요 가이던스.",
      ],
      en: [
        "Signs of a memory-price rebound add weight to the chip-cycle trough thesis.",
        "Yet upward earnings revisions remain limited, so valuation concerns coexist.",
        "Watch: pace of inventory normalization and second-half demand guidance.",
      ],
    },
    tags: ["반도체", "실적", "메모리"],
    sources: [
      { name: "Sector Note", note: { ko: "섹터 관찰", en: "Sector note" } },
      { name: "Broker Comment", note: { ko: "증권가 코멘트", en: "Broker comment" } },
    ],
    access_level: "free",
    disclaimer: true,
    spark: [7, 6, 6, 5, 6, 7, 7, 9, 8, 10],
  },
  {
    id: "finance-2026-06-30",
    date: "2026-06-30",
    category: "finance",
    label: { ko: "금융", en: "Finance" },
    title: {
      ko: "환율·금리 동반 움직임, 수출주 수급에 영향",
      en: "FX and rates move together, shaping exporter flows",
    },
    summary: {
      ko: [
        "원화 약세와 장기 금리 변동이 겹치며 수출주·성장주 수급이 엇갈림.",
        "외국인 순매수/순매도 전환이 지수 방향의 단기 변수로 부각.",
        "관전 포인트: 환율 레벨과 외국인 수급의 방향 일치 여부.",
      ],
      en: [
        "A weaker won alongside long-rate swings splits flows between exporters and growth names.",
        "A flip in foreign net buying/selling becomes a short-term driver of the index.",
        "Watch: whether the FX level and foreign flows point the same way.",
      ],
    },
    tags: ["환율", "금리", "수급"],
    sources: [
      { name: "Macro Desk", note: { ko: "매크로 데스크", en: "Macro desk" } },
      { name: "Flow Data", note: { ko: "수급 데이터", en: "Flow data" } },
    ],
    access_level: "free",
    disclaimer: true,
    spark: [9, 10, 8, 9, 7, 8, 6, 7, 8, 6],
  },
  {
    id: "finance-2026-06-27",
    date: "2026-06-27",
    category: "finance",
    label: { ko: "금융", en: "Finance" },
    title: {
      ko: "배당·밸류업 테마, 정책 기대에 재부각",
      en: "Dividend & value-up themes back in focus on policy hopes",
    },
    summary: {
      ko: [
        "주주환원 확대·밸류업 정책 기대가 저PBR 업종 관심으로 이어짐.",
        "배당 수익률과 자사주 정책이 종목 선별의 기준으로 다시 언급됨.",
        "관전 포인트: 정책 구체화 여부와 실제 환원 규모의 확인.",
      ],
      en: [
        "Hopes for bigger shareholder returns and value-up policy revive interest in low-PBR sectors.",
        "Dividend yield and buyback policy are again cited as stock-selection criteria.",
        "Watch: whether policy gets concrete and how large actual returns turn out.",
      ],
    },
    tags: ["배당주", "밸류업", "정책"],
    sources: [
      { name: "Policy Brief", note: { ko: "정책 브리프", en: "Policy brief" } },
      { name: "Strategy Note", note: { ko: "전략 관찰", en: "Strategy note" } },
    ],
    access_level: "free",
    disclaimer: true,
    spark: [5, 6, 6, 7, 7, 8, 8, 9, 10, 11],
  },
];
