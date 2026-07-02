/* 기술(Tech) 브리핑 데이터.
 * 탭 작업 = 이 배열에 항목 추가/교체. Briefing Issue 필드(plan.md) 준수.
 * access_level: 'free'=무료 축약 / 'paid'=유료 전체. spark=미니 스파크라인용 샘플 시계열.
 * 주의: 수치·종목은 형식 검증용 "샘플·예시" 데이터.
 */
const BRIEFINGS_TECH = [
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
];
