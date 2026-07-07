/* 경제(Economy) 브리핑 데이터 — 주간 · 단일 매크로 다이제스트(샘플).
 * 거시(Macro): 정책·실물(금리 결정·물가·고용·무역/환율). 분야로 나누지 않고 한 다이제스트로.
 * 경계: 경제=매크로·정책, 금융=자산·시장 가격. (금리 '결정'은 경제, 채권/금리 '시장'은 금융)
 * 주의: 수치는 형식 검증용 "샘플" 데이터. 정보 제공이며 투자 조언 아님.
 */

const ECONOMY_WEEKLY = {
  week: { ko: "2026년 7월 1주", en: "Jul, Week 1 · 2026" },
  date: "2026-07-03",
  label: { ko: "경제 매크로", en: "Macro" },
  tagline: { ko: "금리 결정·물가·고용·무역/환율 (거시)", en: "Rate decisions, inflation, jobs, trade/FX (macro)" },
  signals: [
    { title: { ko: "통화정책 회의에 시선 집중", en: "Eyes on the policy meeting" }, lede: { ko: "주요국 통화정책 결정이 금리 경로 기대를 다시 잡는다.", en: "Major-economy policy decisions reset rate-path expectations." }, tag: "금리" },
    { title: { ko: "물가 지표 발표 대기", en: "Inflation prints due" }, lede: { ko: "물가 둔화 속도가 정책 전환 시점 논쟁의 핵심.", en: "The pace of disinflation is central to the pivot-timing debate." }, tag: "물가" },
    { title: { ko: "고용·성장 신호 점검", en: "Jobs and growth check" }, lede: { ko: "고용 강도가 연착륙 여부를 가르는 변수로 남는다.", en: "Labor-market strength remains the swing factor for a soft landing." }, tag: "고용" },
    { title: { ko: "환율·무역수지 동향", en: "FX and trade balance" }, lede: { ko: "달러 방향과 무역 흐름이 신흥국·수출주 심리에 영향.", en: "Dollar direction and trade flows sway EM and exporter sentiment." }, tag: "환율" },
  ],
  headliner: {
    title: { ko: "이번 주 매크로: 금리 경로가 자산 방향을 가른다", en: "Macro this week: the rate path steers asset direction" },
    summary: {
      ko: ["통화정책 결정과 물가 지표가 겹치며 금리 기대가 재조정되는 주.", "금리 경로는 채권·환율은 물론 성장주 밸류에이션까지 연결된다.", "관전 포인트: 지표가 '둔화 지속'을 확인하는지, 되돌리는지."],
      en: ["Policy decisions and inflation prints overlap, repricing rate expectations.", "The rate path links bonds and FX to growth-stock valuations.", "Watch: whether data confirms continued disinflation or reverses it."],
    },
    tags: ["금리", "물가", "환율"],
    sources: [{ name: "Central Bank", note: { ko: "정책", en: "Policy" } }, { name: "Statistics", note: { ko: "지표", en: "Data" } }],
    spark: [6, 6, 5, 7, 7, 8, 7, 9, 8, 9],
    valueChain: { ko: "영향 자산: 국채·환율 → 성장주·수출주", en: "Assets in play: govvies·FX → growth·exporters" },
    watch: { ko: "지표가 정책 전환 시점을 앞당기는지 늦추는지.", en: "Whether data pulls the policy pivot earlier or later." },
  },
};

/* 랜딩 티저 계약 유지 — 헤드라이너에서 파생(단일 이슈) */
const BRIEFINGS_ECONOMY = [{
  id: "economy-2026-W27", date: ECONOMY_WEEKLY.date, category: "economy", label: { ko: "경제", en: "Economy" },
  title: ECONOMY_WEEKLY.headliner.title, summary: ECONOMY_WEEKLY.headliner.summary,
  tags: ECONOMY_WEEKLY.headliner.tags, sources: ECONOMY_WEEKLY.headliner.sources,
  access_level: "free", spark: ECONOMY_WEEKLY.headliner.spark,
}];
