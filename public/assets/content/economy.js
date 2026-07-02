/* 경제(Economy) 브리핑 데이터.
 * 탭 작업 = 이 배열에 항목 추가/교체. Briefing Issue 필드(plan.md) 준수.
 * 주의: 수치·종목은 형식 검증용 "샘플·예시" 데이터.
 */
const BRIEFINGS_ECONOMY = [
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
