/* 금융(Finance) 브리핑 데이터 — 주간 · 자산군(분야) 모델. 미시(Micro): 종목·자산 가격·수급·실적.
 * 구조는 기술(tech.js)과 동일: FINANCE_DOMAINS(분야) + FINANCE_WEEKLY(분야별 주간 이슈).
 * 경계: 경제=매크로·정책, 금융=자산·시장·기업(종목/수급). 기술=산업 메커니즘, 금융=종목·주가.
 * 주의: 수치·종목은 형식 검증용 "샘플" 데이터. 정보 제공이며 투자 조언 아님.
 */

const FINANCE_DOMAINS = [
  { id: "kr-equity", label: { ko: "국내 증시", en: "KR Equities" }, status: "live",
    tagline: { ko: "코스피·수급·종목·실적", en: "KOSPI, flows, names, earnings" } },
  { id: "us-equity", label: { ko: "미국 증시", en: "US Equities" }, status: "live",
    tagline: { ko: "빅테크·성장주·밸류에이션", en: "Big tech, growth, valuation" } },
  { id: "bond", label: { ko: "채권·금리 시장", en: "Rates & Credit" }, status: "live",
    tagline: { ko: "국채·크레딧·스프레드", en: "Govvies, credit, spreads" } },
  { id: "commodity", label: { ko: "원자재·대체", en: "Commodities & Alts" }, status: "live",
    tagline: { ko: "에너지·금속·대체자산", en: "Energy, metals, alts" } },
  { id: "flows", label: { ko: "펀드·자금흐름", en: "Funds & Flows" }, status: "soon",
    tagline: { ko: "수급·ETF·포지셔닝", en: "Flows, ETFs, positioning" } },
];

const FINANCE_WEEKLY = [
  {
    id: "kr-equity-2026-W27", domain: "kr-equity", week: { ko: "2026년 7월 1주", en: "Jul, Week 1 · 2026" }, date: "2026-07-03",
    signals: [
      { title: { ko: "외국인·기관 수급 방향", en: "Foreign/institutional flows" }, lede: { ko: "반도체 대형주 중심 수급이 지수 방향을 좌우.", en: "Flows into large-cap semis steer the index." }, tag: "수급" },
      { title: { ko: "실적 시즌 진입", en: "Earnings season kicks off" }, lede: { ko: "가이던스와 재고 사이클이 업종별 온도차를 만든다.", en: "Guidance and inventory cycles split sectors." }, tag: "실적" },
      { title: { ko: "주도주 순환 조짐", en: "Leadership rotation signs" }, lede: { ko: "반도체 외 이차전지·바이오로 순환 매수 시도.", en: "Rotation attempts beyond semis into batteries and bio." }, tag: "순환" },
      { title: { ko: "밸류업 정책 모멘텀", en: "Value-up policy momentum" }, lede: { ko: "주주환원 확대 기대가 저PBR 업종에 재부각.", en: "Buyback/dividend hopes revisit low-PBR sectors." }, tag: "밸류업" },
    ],
    headliner: {
      title: { ko: "국내 증시: 수급과 실적이 주도주를 가른다", en: "KR equities: flows and earnings decide the leaders" },
      summary: {
        ko: ["반도체 대형주 수급이 지수 방향을 잡는 가운데 실적 시즌이 겹친다.", "가이던스·재고 사이클이 업종별 차별화를 키운다.", "관전 포인트: 주도주가 반도체에 집중되는지, 순환이 넓어지는지."],
        en: ["Large-cap semi flows set index direction as earnings season overlaps.", "Guidance and inventory cycles widen sector dispersion.", "Watch: whether leadership stays in semis or rotation broadens."],
      },
      tags: ["수급", "실적", "밸류업"],
      sources: [{ name: "Exchange Flows", note: { ko: "수급", en: "Flows" } }, { name: "Earnings", note: { ko: "실적", en: "Earnings" } }],
      spark: [5, 6, 6, 7, 6, 8, 7, 9, 8, 10],
      valueChain: { ko: "관련: 반도체 대형주 → 소부장 → 밸류업 저PBR", en: "Linked: large-cap semis → materials/parts → low-PBR value-up" },
      watch: { ko: "수급 쏠림과 실적 가이던스가 주도주 지속성을 가른다.", en: "Flow concentration and guidance decide leadership durability." },
    },
  },
  {
    id: "us-equity-2026-W27", domain: "us-equity", week: { ko: "2026년 7월 1주", en: "Jul, Week 1 · 2026" }, date: "2026-07-02",
    signals: [
      { title: { ko: "빅테크 실적 기대", en: "Big-tech earnings bar" }, lede: { ko: "AI capex 사이클이 실적 눈높이를 끌어올린다.", en: "The AI capex cycle lifts the earnings bar." }, tag: "빅테크" },
      { title: { ko: "성장주 밸류에이션 부담", en: "Growth valuation stretch" }, lede: { ko: "금리 민감도가 높은 고밸류 성장주에 변동성.", en: "Rate-sensitive high-multiple names see volatility." }, tag: "밸류에이션" },
      { title: { ko: "금리 민감도 재부각", en: "Rate sensitivity back in focus" }, lede: { ko: "장기금리 변동이 성장주·리츠 심리를 흔든다.", en: "Long-end moves swing growth and REIT sentiment." }, tag: "금리민감" },
      { title: { ko: "AI capex 수혜 확산", en: "AI capex beneficiaries broaden" }, lede: { ko: "칩 밖으로 전력·네트워크·데이터센터로 수혜가 번진다.", en: "Beyond chips, benefits spread to power, networking, datacenters." }, tag: "AIcapex" },
    ],
    headliner: {
      title: { ko: "미국 증시: AI capex가 실적 기대를 끌어올린다", en: "US equities: AI capex lifts the earnings bar" },
      summary: {
        ko: ["하이퍼스케일러 capex 상향이 관련 실적 기대를 끌어올린다.", "고밸류 성장주는 금리 민감도가 변동성의 원천으로 남는다.", "관전 포인트: capex 수혜가 칩 밖 전력·네트워크로 넓어지는 속도."],
        en: ["Rising hyperscaler capex lifts related earnings expectations.", "High-multiple growth stays rate-sensitive, a source of volatility.", "Watch: how fast capex benefits broaden beyond chips to power and networking."],
      },
      tags: ["빅테크", "AIcapex", "금리민감"],
      sources: [{ name: "Earnings Call", note: { ko: "실적", en: "Earnings" } }, { name: "Market Note", note: { ko: "시장", en: "Market" } }],
      spark: [6, 7, 7, 8, 9, 8, 10, 11, 10, 12],
      valueChain: { ko: "관련: 가속기 → 전력·네트워크 → 데이터센터 리츠", en: "Linked: accelerators → power/networking → datacenter REITs" },
      watch: { ko: "금리 경로와 capex 지속성이 성장주 방향을 가른다.", en: "The rate path and capex durability steer growth stocks." },
    },
  },
];

/* 랜딩 티저 계약 유지 — 가동 분야 헤드라이너에서 파생 */
const BRIEFINGS_FINANCE = FINANCE_WEEKLY
  .filter(function (w) { return FINANCE_DOMAINS.some(function (d) { return d.id === w.domain && d.status === "live"; }); })
  .map(function (w) {
    return { id: w.id, date: w.date, category: "finance", label: { ko: "금융", en: "Finance" },
      title: w.headliner.title, summary: w.headliner.summary, tags: w.headliner.tags,
      sources: w.headliner.sources, access_level: "free", spark: w.headliner.spark };
  });
