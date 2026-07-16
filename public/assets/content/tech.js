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

/* ⑤ 발행: '주간-초안' 탭의 "웹에 게시(CSV)" URL. 비우면 정적(아래 TECH_WEEKLY) 유지.
 * 채우면 status=approved · 유형=signal 행이 도메인별 최신 발행주로 '이번 주 신호' 목록을 대체.
 * 헤드라이너 딥다이브는 그대로 정적(TECH_WEEKLY)에서 사람이 유지. (Phase 1: 시트 선별은 임시,
 * 웹서비스 이전 시 관리자 화면으로 대체될 별개 작업.) */
const WEEKLY_SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR9qlZFl78TiUcCCKApDu7dD_4rkGF8tlYWpyV2dzaTQg6WFtd9DJoNMyjyPa-dn21JzQ1ivAVKPd31/pub?gid=530467230&single=true&output=csv";

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
    id: "ai-infra-2026-W29",
    domain: "ai-infra",
    week: { ko: "2026년 7월 3주", en: "Jul, Week 3 · 2026" },
    date: "2026-07-16",
    signals: [
      {
        title: { ko: "삼성, 데이터센터 '빛 전쟁' 참전 — 실리콘 포토닉스 파운드리 공식화", en: "Samsung enters the datacenter 'light war' — silicon-photonics foundry formalized" },
        lede: {
          ko: "실리콘 포토닉스 파운드리 공식화는 AI 데이터센터 광연결 병목 해소를 겨눈 밸류체인 이동 신호.",
          en: "A formal silicon-photonics foundry signals a value-chain shift toward easing optical-interconnect bottlenecks in AI datacenters.",
        },
        tag: "실리콘포토닉스",
      },
      {
        title: { ko: "GPU보다 전력이 부족하다 — AI 데이터센터 전력 확보 4대 전선", en: "Power scarcer than GPUs — four fronts in the AI-datacenter power race" },
        lede: {
          ko: "전력 부족이 GPU 공급을 제치고 AI 인프라의 실제 병목으로 부상, 전력 확보 경쟁이 심화된다.",
          en: "Power shortage overtakes GPU supply as the real AI-infra bottleneck, intensifying the scramble for power.",
        },
        tag: "전력",
      },
      {
        title: { ko: "ARM 기반 CPU, 2029년 AI ASIC 서버 90% 전망 — x86 구도 흔들리나", en: "ARM CPUs projected to 90% of AI ASIC servers by 2029 — x86 dominance in question" },
        lede: {
          ko: "ARM CPU의 AI 서버 점유 급증 전망은 x86 대비 아키텍처 전환 구조 변화 관찰.",
          en: "A projected surge in ARM's AI-server share points to an architectural shift away from x86.",
        },
        tag: "자체칩",
      },
      {
        title: { ko: "포토니솔, 광 아이솔레이터 칩 개발 — 실리콘 포토닉스 부품 병목 겨냥", en: "Photonisol develops an optical-isolator chip — targeting a silicon-photonics component bottleneck" },
        lede: {
          ko: "광 아이솔레이터 칩 개발은 실리콘 포토닉스 내 핵심 부품 병목 해소 관찰.",
          en: "An optical-isolator chip is observed as easing a key component bottleneck within silicon photonics.",
        },
        tag: "광부품",
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
    id: "semicon-2026-W29",
    domain: "semicon",
    week: { ko: "2026년 7월 3주", en: "Jul, Week 3 · 2026" },
    date: "2026-07-15",
    signals: [
      {
        title: { ko: "차세대 HBM 게임체인저 — K-패키징, '하이브리드 본딩'에 소매 걷다", en: "Next-gen HBM game-changer — Korean packaging leaders move on hybrid bonding" },
        lede: {
          ko: "HBM4에 도입될 하이브리드 본딩에 국내 패키징 업체들이 본격 진출, 기존 TC 본딩 대비 공정 전환 관찰.",
          en: "Domestic packagers move into hybrid bonding for HBM4 — a process shift away from TC bonding.",
        },
        tag: "HBM4",
      },
      {
        title: { ko: "유리기판, TSMC CoWoS를 대체하나 — 기판 재료 전환 조짐", en: "Could glass substrates replace TSMC CoWoS? — signs of a substrate-material shift" },
        lede: {
          ko: "유리기판이 CoWoS를 대체할 잠재적 구조 변화로 지목되며 기판 재료 전환이 관찰됨.",
          en: "Glass substrates are cited as a potential structural replacement for CoWoS, signaling a material transition.",
        },
        tag: "유리기판",
      },
      {
        title: { ko: "SPHBM4 등장에 흔들리는 HBM 패키징 판 — TSMC CoWoS 의존 재편 조짐", en: "SPHBM4 shakes the HBM packaging landscape — TSMC CoWoS dependence in question" },
        lede: {
          ko: "SPHBM4 도입으로 HBM 패키징 구조 변화 가능성, CoWoS 독점 체제 재편이 관찰됨.",
          en: "SPHBM4 may reshape HBM packaging, with the CoWoS-centric structure potentially loosening.",
        },
        tag: "패키징",
      },
      {
        title: { ko: "'80년대 영광 되찾자' — 日 반도체, 공급망 재편 틈타 전방위 공세", en: "Japan's semis go on the offensive amid a supply-chain reshuffle" },
        lede: {
          ko: "일본이 공급망 재편을 활용해 설계·제조·패키징 전방위 투자 확대, 글로벌 밸류체인 재편 관찰.",
          en: "Japan expands across design, manufacturing and packaging, reshaping the global value chain.",
        },
        tag: "공급망",
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
