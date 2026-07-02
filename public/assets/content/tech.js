/* 기술(Tech) 브리핑 데이터 — 최신순.
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
  {
    id: "tech-2026-07-01",
    date: "2026-07-01",
    category: "tech",
    label: { ko: "기술", en: "Tech" },
    title: {
      ko: "HBM 세대 전환, 병목은 이제 '패키징'으로",
      en: "HBM generation shift: the bottleneck moves to packaging",
    },
    summary: {
      ko: [
        "차세대 HBM 수요가 견조한 가운데 경쟁의 축이 셀에서 후공정(패키징)으로 이동.",
        "선단 패키징 캐파와 수율이 공급 병목으로 지목되며 장비·소재 밸류체인이 주목받음.",
        "관전 포인트: 스택 단수 확대와 열 관리가 세대 전환 속도를 좌우.",
      ],
      en: [
        "With next-gen HBM demand firm, the competitive axis moves from the cell to advanced packaging.",
        "Advanced-packaging capacity and yield are cited as the supply bottleneck, spotlighting the equipment/materials chain.",
        "Watch: higher stack counts and thermal management will set the pace of the generation shift.",
      ],
    },
    tags: ["HBM", "패키징", "메모리"],
    sources: [
      { name: "Supply Chain Note", note: { ko: "공급망 관찰", en: "Supply-chain note" } },
      { name: "Earnings Call", note: { ko: "실적 발언", en: "Earnings remarks" } },
    ],
    access_level: "free",
    spark: [3, 4, 4, 6, 7, 9, 8, 10, 12, 12],
  },
  {
    id: "tech-2026-06-30",
    date: "2026-06-30",
    category: "tech",
    label: { ko: "기술", en: "Tech" },
    title: {
      ko: "유리기판(Glass Substrate), 시제품에서 양산 논의로",
      en: "Glass substrate: from prototype to volume-production talk",
    },
    summary: {
      ko: [
        "고성능 패키지용 유리기판이 시제품 단계를 지나 양산 로드맵 논의로 넘어가는 신호.",
        "미세 배선·평탄도 장점이 부각되지만 취성·수율·검사 표준이 상용화 관문으로 남음.",
        "관전 포인트: 초기 채택처(고부가 AI 가속기)와 장비 표준화 속도.",
      ],
      en: [
        "Glass substrates for high-performance packages are moving past prototypes toward volume-production roadmaps.",
        "Fine-line and flatness advantages stand out, but brittleness, yield, and inspection standards remain the hurdles.",
        "Watch: early adopters (high-value AI accelerators) and the pace of equipment standardization.",
      ],
    },
    tags: ["Glass Substrate", "패키징", "소재"],
    sources: [
      { name: "Tech Roadmap", note: { ko: "로드맵 관찰", en: "Roadmap note" } },
      { name: "Materials Brief", note: { ko: "소재 브리프", en: "Materials brief" } },
    ],
    access_level: "free",
    spark: [2, 3, 3, 4, 5, 5, 7, 6, 8, 10],
  },
  {
    id: "tech-2026-06-27",
    date: "2026-06-27",
    category: "tech",
    label: { ko: "기술", en: "Tech" },
    title: {
      ko: "우주·위성, 저궤도 통신이 데이터 인프라 축으로",
      en: "Space & satellites: LEO comms as a data-infrastructure axis",
    },
    summary: {
      ko: [
        "저궤도(LEO) 위성통신 확장이 지상망 사각지대와 재난·해상 연결 수요를 흡수.",
        "발사 비용 하락과 위성 대량생산이 맞물려 서비스 단가 경쟁이 시작되는 국면.",
        "관전 포인트: 단말·안테나 원가와 지상 게이트웨이 규제가 확산 속도를 결정.",
      ],
      en: [
        "Expanding low-Earth-orbit (LEO) satellite comms absorbs demand from terrestrial dead zones and disaster/maritime connectivity.",
        "Falling launch costs plus mass-produced satellites are kicking off service-price competition.",
        "Watch: terminal/antenna cost and ground-gateway regulation will decide the diffusion speed.",
      ],
    },
    tags: ["우주", "위성", "통신"],
    sources: [
      { name: "Space Brief", note: { ko: "우주 브리프", en: "Space brief" } },
      { name: "Telecom Note", note: { ko: "통신 관찰", en: "Telecom note" } },
    ],
    access_level: "free",
    spark: [5, 5, 6, 6, 7, 7, 8, 9, 9, 11],
  },
];
