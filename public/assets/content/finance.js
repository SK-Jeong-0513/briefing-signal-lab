/* 금융(Finance) 브리핑 데이터.
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
];
