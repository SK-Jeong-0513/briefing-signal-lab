/* 기술(Tech) 브리핑 데이터 — 주간(weekly) · 분야(밸류체인 테마) 구조.
 * 콘텐츠 전략(2026-07-03 확정, docs/HANDOFF.md):
 *   - 독자=투자자 겸 기술 관찰자. 차별화=선행 신호(1차 소스)+메커니즘→밸류체인 연결.
 *   - 주기=주간. 구조=분야 메뉴(티어=선택 분야 수). 런칭 앵커 2개(AI 인프라·반도체 공급망) + 로드맵 3개.
 *   - 이슈 그릇=다이제스트(선행 신호 3~5) + 헤드라이너 딥다이브 1.
 *   - 무료=신호 리스트(제목+1줄)+헤드라이너 요약 / 유료=신호 전문+딥다이브+밸류체인 기업+아카이브.
 *   - 투자 수위=밸류체인 기업 명시 O, 투자 판단(매수·매도·목표가) X + 면책.
 * 콘텐츠 상태: 1호는 공개 출처 리서치 기반 초안(2026-07 시점). 에디터 검증 후 확정. Phase 1은 실제 페이월 없음(잠금은 표시용).
 *   수치·종목은 관찰 목적이며 투자 조언이 아님. 밸류체인 기업은 공개 출처에 근거한 관찰 대상으로만 명시.
 * 탭 작업 = TECH_WEEKLY에 분야별 최신 이슈 추가/교체. 랜딩 티저는 헤드라이너에서 자동 파생.
 */

/* ── 분야(밸류체인 테마) 메뉴: live=가동, soon=곧 공개(로드맵) ── */
const TECH_DOMAINS = [
  {
    id: "ai-infra",
    label: { ko: "AI 인프라", en: "AI Infra" },
    status: "live",
    tagline: {
      ko: "가속기 시스템·서버·데이터센터·네트워크·전력·추론 (시스템 계층)",
      en: "Accelerator systems, servers, datacenters, networking, power, inference (system layer)",
    },
  },
  {
    id: "semicon",
    label: { ko: "반도체 공급망", en: "Semis Supply Chain" },
    status: "live",
    tagline: {
      ko: "칩·패키징·소재·장비·파운드리 (물리 계층)",
      en: "Chips, packaging, materials, equipment, foundry (physical layer)",
    },
  },
  {
    id: "power",
    label: { ko: "전력·에너지", en: "Power & Energy" },
    status: "soon",
    tagline: { ko: "AI 전력수요·원전·SMR·전력망·냉각", en: "AI power demand, nuclear, SMR, grid, cooling" },
  },
  {
    id: "space",
    label: { ko: "우주·방산", en: "Space & Defense" },
    status: "soon",
    tagline: { ko: "LEO 위성통신·발사·방산 전자", en: "LEO comms, launch, defense electronics" },
  },
  {
    id: "bio",
    label: { ko: "바이오", en: "Bio" },
    status: "soon",
    tagline: { ko: "임상·플랫폼·헬스테크", en: "Clinical, platforms, healthtech" },
  },
];

/* ── 주간 이슈: 분야별 최신 1편(2026-07 리서치 초안) ──
 * signals: 그 주 선행 신호(무료=제목+1줄). headliner: 헤드라이너 딥다이브(무료=요약, 유료=밸류체인·관전·전문).
 */
const TECH_WEEKLY = [
  {
    id: "ai-infra-2026-W27",
    domain: "ai-infra",
    week: { ko: "2026년 7월 1주", en: "Jul, Week 1 · 2026" },
    date: "2026-07-02",
    signals: [
      {
        title: { ko: "하이퍼스케일러 capex 상향, '부품 가격'을 명시", en: "Hyperscaler capex revised up — 'component pricing' cited" },
        lede: {
          ko: "메타가 2026 capex 가이던스를 상향하며 부품 가격·데이터센터 비용을 이유로 들었다. 총액보다 이 코멘트가 밸류체인 압력 신호.",
          en: "Meta raised 2026 capex guidance citing component pricing and datacenter costs — a value-chain pressure signal beyond the headline total.",
        },
        tag: "capex",
      },
      {
        title: { ko: "CPO(광집적), 상용화 검증 국면 진입", en: "Co-packaged optics enters commercial validation" },
        lede: {
          ko: "엔비디아 실리콘 포토닉스 스위치와 브로드컴 Bailly가 2026–27 첫 대규모 검증에 들어간다. 전력 효율이 채택을 가른다.",
          en: "Nvidia's silicon-photonics switches and Broadcom's Bailly enter first large-scale validation in 2026–27; power efficiency decides adoption.",
        },
        tag: "CPO",
      },
      {
        title: { ko: "병목은 칩이 아니라 전력·냉각으로", en: "The bottleneck shifts from chips to power and cooling" },
        lede: {
          ko: "capex는 급증하지만 전력·냉각이 실제 제약으로 지목되며 AI 인프라 밸류체인이 전력 쪽으로 확장된다.",
          en: "Even as capex surges, power and cooling are cited as the real constraint, extending the value chain toward power.",
        },
        tag: "전력",
      },
      {
        title: { ko: "하이퍼스케일러 자체 칩(ASIC) 가속", en: "Hyperscaler custom silicon accelerates" },
        lede: {
          ko: "아마존 자체 칩 사업이 연매출 런레이트 규모로 올라서며 범용 가속기 외 자체 실리콘 축이 커진다.",
          en: "Amazon's in-house chip business scales to a multibillion revenue run-rate, growing the custom-silicon axis alongside merchant accelerators.",
        },
        tag: "자체칩",
      },
    ],
    headliner: {
      title: {
        ko: "CPO, AI 네트워크 병목을 광(光)으로 푼다",
        en: "Co-packaged optics: solving the AI-network bottleneck with light",
      },
      summary: {
        ko: [
          "AI 클러스터의 GPU 간 대역폭·전력 병목에 광집적(CPO) 스위치 채택 논의가 본격화.",
          "엔비디아(실리콘 포토닉스)와 브로드컴(개방형 Bailly)이 서로 다른 전략으로 2026–27 첫 대규모 검증에 진입.",
          "관전 포인트: 스케일업(가속기 간)에서 먼저 채택된 뒤 스케일아웃으로 확산되는 시점과 수율.",
        ],
        en: [
          "Bandwidth and power limits between GPUs push co-packaged optics (CPO) into serious adoption talk.",
          "Nvidia (silicon photonics) and Broadcom (open Bailly) enter first large-scale validation in 2026–27 with different strategies.",
          "Watch: whether CPO lands in scale-up first, then diffuses to scale-out — and at what yield.",
        ],
      },
      tags: ["CPO", "네트워크", "AI"],
      sources: [
        { name: "SemiAnalysis", note: { ko: "분석", en: "Analysis" } },
        { name: "IDTechEx", note: { ko: "리서치", en: "Research" } },
      ],
      spark: [4, 5, 5, 6, 8, 7, 9, 11, 10, 13],
      /* 유료 딥다이브 — 밸류체인은 공개 출처 기반 관찰. Phase 1은 표시용 잠금. */
      valueChain: {
        ko: "스위치 ASIC(브로드컴) → 실리콘 포토닉스(엔비디아) → 3D 하이브리드 본딩 패키징(TSMC SoIC)",
        en: "Switch ASIC (Broadcom) → silicon photonics (Nvidia) → 3D hybrid-bonding packaging (TSMC SoIC)",
      },
      watch: {
        ko: "전력 효율(pJ/bit)과 패키징 수율이 스케일아웃 확산 속도를 가른다.",
        en: "Power efficiency (pJ/bit) and packaging yield set the pace of scale-out diffusion.",
      },
    },
  },
  {
    id: "semicon-2026-W27",
    domain: "semicon",
    week: { ko: "2026년 7월 1주", en: "Jul, Week 1 · 2026" },
    date: "2026-07-01",
    signals: [
      {
        title: { ko: "HBM4, 본딩 방식이 세대 경쟁축으로", en: "HBM4: the bonding method becomes the competitive axis" },
        lede: {
          ko: "삼성은 하이브리드 본딩(범프리스 Cu-Cu)을 앞세우고, SK하이닉스는 MR-MUF 16단에 TSMC 로직 다이를 결합한다.",
          en: "Samsung leads with hybrid bonding (bumpless Cu-Cu); SK hynix pairs MR-MUF 16-high with a TSMC logic die.",
        },
        tag: "HBM4",
      },
      {
        title: { ko: "SK하이닉스, 첫 미국 후공정 투자", en: "SK hynix's first U.S. back-end investment" },
        lede: {
          ko: "미국 내 2.5D 패키징 라인 투자로 후공정 지역 밸류체인이 재편되는 신호.",
          en: "A 2.5D packaging line in the U.S. signals a reshaping of the back-end regional value chain.",
        },
        tag: "후공정",
      },
      {
        title: { ko: "유리기판, 소규모 상업 출하 진입", en: "Glass substrate reaches small-volume commercial shipment" },
        lede: {
          ko: "SK Absolics 양산 목표와 인텔 EMIB+글래스 코어 샘플, TSMC CoWoS-G 미니라인이 겹치며 상용화 관문에 접근.",
          en: "SK Absolics' production target, Intel's EMIB+glass-core sample, and TSMC's CoWoS-G mini line converge toward commercialization.",
        },
        tag: "유리기판",
      },
      {
        title: { ko: "선단 패키징·CoWoS 캐파, 구조적 병목", en: "Advanced packaging / CoWoS capacity: a structural bottleneck" },
        lede: {
          ko: "선단 패키징과 HBM 수요가 캐파를 앞서며 2027까지 리드타임·가격 압력이 이어질 전망.",
          en: "Advanced-packaging and HBM demand outrun capacity, implying lead-time and pricing pressure into 2027.",
        },
        tag: "캐파",
      },
    ],
    headliner: {
      title: {
        ko: "HBM4, 병목은 셀이 아니라 '본딩'에 있다",
        en: "HBM4: the bottleneck is bonding, not the cell",
      },
      summary: {
        ko: [
          "차세대 HBM 경쟁의 축이 셀에서 후공정 본딩으로 이동한다.",
          "삼성은 하이브리드 본딩, SK하이닉스는 MR-MUF+TSMC 로직 다이로 서로 다른 경로를 택했다.",
          "관전 포인트: 하이브리드 본딩 전환 시점과 열 관리(스택 단수)가 세대 속도를 가른다.",
        ],
        en: [
          "The competitive axis of next-gen HBM moves from the cell to back-end bonding.",
          "Samsung bets on hybrid bonding; SK hynix pairs MR-MUF with a TSMC logic die — divergent paths.",
          "Watch: hybrid-bonding timing and thermal handling (stack count) set the generational pace.",
        ],
      },
      tags: ["HBM4", "본딩", "패키징"],
      sources: [
        { name: "TrendForce", note: { ko: "리서치", en: "Research" } },
        { name: "EE Times", note: { ko: "보도", en: "Report" } },
      ],
      spark: [3, 4, 4, 6, 7, 9, 8, 10, 12, 12],
      valueChain: {
        ko: "본딩 장비(하이브리드/TC) → 선단 패키징 소재 → 웨이퍼 검사·테스트",
        en: "Bonding tools (hybrid/TC) → advanced-packaging materials → wafer inspection/test",
      },
      watch: {
        ko: "하이브리드 본딩 양산 전환 시점과 열 관리가 HBM4 세대 속도를 가른다.",
        en: "Hybrid-bonding ramp timing and thermal handling set the HBM4 generational pace.",
      },
    },
  },
];

/* ── 랜딩 티저 계약 유지 — 주간 헤드라이너를 flat BRIEFINGS_TECH로 파생(단일 소스).
 * index.html renderBriefings()는 category==="tech" 대표 1건(title/summary[]/spark/tags/sources)을 읽는다. */
const BRIEFINGS_TECH = TECH_WEEKLY
  .filter(function (w) {
    return TECH_DOMAINS.some(function (d) { return d.id === w.domain && d.status === "live"; });
  })
  .map(function (w) {
    return {
      id: w.id,
      date: w.date,
      category: "tech",
      label: { ko: "기술", en: "Tech" },
      title: w.headliner.title,
      summary: w.headliner.summary,
      tags: w.headliner.tags,
      sources: w.headliner.sources,
      access_level: "free",
      spark: w.headliner.spark,
    };
  });
