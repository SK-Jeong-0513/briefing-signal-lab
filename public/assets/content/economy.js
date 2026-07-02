/* 경제(Economy) 브리핑 데이터 — 최신순.
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
  {
    id: "economy-2026-07-01",
    date: "2026-07-01",
    category: "economy",
    label: { ko: "경제", en: "Economy" },
    title: {
      ko: "물가 둔화 속도, 통화정책 경로의 핵심 변수로",
      en: "Pace of disinflation becomes the key variable for policy path",
    },
    summary: {
      ko: [
        "물가 둔화가 완만해지며 금리 인하 시점에 대한 기대가 재조정됨.",
        "서비스 물가와 임금 지표가 정책 결정의 무게중심으로 부각.",
        "관전 포인트: 다음 물가·고용 지표가 인하 기대의 방향을 결정.",
      ],
      en: [
        "As disinflation slows, expectations for rate-cut timing get repriced.",
        "Services inflation and wage data move to the center of policy decisions.",
        "Watch: the next inflation and jobs prints will steer cut expectations.",
      ],
    },
    tags: ["물가", "금리", "통화정책"],
    sources: [
      { name: "CPI Note", note: { ko: "물가 관찰", en: "CPI note" } },
      { name: "Policy Brief", note: { ko: "정책 브리프", en: "Policy brief" } },
    ],
    access_level: "free",
    spark: [11, 10, 10, 9, 9, 8, 8, 7, 7, 6],
  },
  {
    id: "economy-2026-06-30",
    date: "2026-06-30",
    category: "economy",
    label: { ko: "경제", en: "Economy" },
    title: {
      ko: "고용·소비 지표, 연착륙 서사의 시험대",
      en: "Jobs and consumption data test the soft-landing narrative",
    },
    summary: {
      ko: [
        "고용은 견조하나 증가 속도 둔화 신호가 나오며 연착륙 논쟁이 재점화.",
        "소비 지표가 서비스 중심으로 유지되는지가 성장 경로의 관건.",
        "관전 포인트: 실질임금과 저축률이 소비 지속성을 가늠.",
      ],
      en: [
        "Jobs stay firm but signs of slower gains reignite the soft-landing debate.",
        "Whether consumption holds up, led by services, is key to the growth path.",
        "Watch: real wages and the savings rate gauge consumption durability.",
      ],
    },
    tags: ["고용", "소비", "성장률"],
    sources: [
      { name: "Labor Note", note: { ko: "고용 관찰", en: "Labor note" } },
      { name: "Macro Desk", note: { ko: "매크로 데스크", en: "Macro desk" } },
    ],
    access_level: "free",
    spark: [8, 8, 9, 8, 8, 7, 8, 7, 7, 7],
  },
  {
    id: "economy-2026-06-27",
    date: "2026-06-27",
    category: "economy",
    label: { ko: "경제", en: "Economy" },
    title: {
      ko: "유가·무역수지, 대외 변수로 다시 부상",
      en: "Oil and trade balance resurface as external variables",
    },
    summary: {
      ko: [
        "유가 변동성이 커지며 물가 경로와 무역수지에 미치는 영향이 재조명됨.",
        "수출 회복 여부가 경상수지와 환율 안정의 전제 조건으로 언급.",
        "관전 포인트: 에너지 가격과 교역 조건이 대외 건전성을 좌우.",
      ],
      en: [
        "Rising oil volatility renews focus on its impact on the inflation path and trade balance.",
        "An export recovery is cited as a precondition for the current account and FX stability.",
        "Watch: energy prices and terms of trade will shape external soundness.",
      ],
    },
    tags: ["유가", "무역수지", "환율"],
    sources: [
      { name: "Energy Brief", note: { ko: "에너지 브리프", en: "Energy brief" } },
      { name: "Trade Note", note: { ko: "교역 관찰", en: "Trade note" } },
    ],
    access_level: "free",
    spark: [7, 8, 6, 9, 7, 10, 8, 9, 7, 10],
  },
];
