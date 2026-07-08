# 세션 핸드오프

세션을 마칠 때 아래를 채우고 커밋하세요. 다음 세션(또는 사람)이 그대로 이어받습니다.

---

## 현재 상태 (최근 세션이 갱신)

- **마지막 갱신:** 2026-07-08
- **작업 브랜치:** main
- **라이브:** https://sk-jeong-0513.github.io/briefing-signal-lab/ (정상)
- **완료:** 랜딩 + 기술/금융/경제 페이지(각 샘플 4건 + 유료 키워드 칩) + 경제 캘린더(격자/리스트·필터). 데이터 주도 구조. 헤더 nav 정리("오늘의 브리핑"→#samples, 기술/금융/경제→각 페이지). 구독은 Google Form 사전채움(무료/유료). 경제 캘린더는 구글 시트(CSV) 실시간 연동 + 중복 방어.
- **기술 브리핑 콘텐츠 전략(2026-07-03 확정):** 독자=투자자 겸 기술 관찰자(삼성·하이닉스·미국 성장주 투자, 기술을 돈 흐름·병목으로 읽음). 차별화=선행 신호(1차 소스에서 경제지 헤드라인보다 먼저)+메커니즘→밸류체인 연결. 주기=주간. 구조=분야(밸류체인 테마) 메뉴, 티어=선택 분야 수(저가 1/고가 2~3). 런칭 앵커 2개=AI 인프라(시스템 계층: 가속기 시스템·서버·DC·네트워크·전력·추론)+반도체 공급망(물리 계층: 칩~패키지·소재·장비·파운드리), 경계=물리 vs 시스템. 로드맵 3개(전력·에너지/우주·방산/바이오)는 수요 보고 순차 개방(전력 개방 시 AI 인프라에서 전력 접점 이사). 이슈 그릇=다이제스트(선행 신호 3~5개)+헤드라이너 딥다이브 1개. 무료=신호 리스트(제목+1줄)+헤드라이너 요약 / 유료=각 신호 전문+딥다이브+종목·근거+아카이브. 소싱=완전 수동 시작(2~3호)→검증 후 반자동. 투자 수위=밸류체인 기업 명시 O, 투자판단(매수·매도·목표가) X + 면책.
- **약속 문장:** "기술을 돈의 흐름으로 읽는 투자자에게, 매주 1차 소스에서 경제지보다 먼저 잡은 선행 신호를, 어느 밸류체인 기업으로 이어지는가까지 연결해 주는 브리핑."
- **현재 상태(2026-07-07):** 기술 주간·분야 전환 + 앵커 1호 + 경제·금융 확장 + 3-카테고리 통합 메일러(수신동의 7명 실발송) + 지표 대시보드(P1·P2·P3) 전부 라이브 완료. 대시보드=6페어(금리·TGA·달러·구리·EWY·수출)+밸류체인, 자동 파이프라인(Yahoo·미 재무부·관세청 수출 API). 
- **★ 현재 상태(2026-07-08):** 위 대시보드 3건 + **서재(Library) 재구축 라이브**(8번) + **시장(주식) 종목 브리핑 무인 자동 발행 라이브**(9번) 완료. 시장=AI(deepseek→gemini)+§6 린트가 매일 자동 생성. nav=기술·경제·금융·시장·대시보드·서재·경제캘린더.
- **★ 다음 세션 우선순위(최신):** **① 시장 워크플로 C단계 = Telegram 일일 파이프**([docs/market-plan.md](market-plan.md), 9번 참조 — `시장-일일` 탭에 Telegram 서버가 일일 브리핑 write, 같은 `market/Code.gs` 웹앱 `tab:"시장-일일"` 재사용). Telegram 프로젝트=`!01. Vibe Coding/Telegram 자동화`(Telethon+engine.py). ② 금융·경제 AI 자동 교체(D, 같은 엔진) ③ 기술 AI 초안 보조(E) ④ 기술·금융·경제 실리서치본·발행 루틴 ⑤ 유료 폼 관심분야 문항 + 로드맵 분야 개방 ⑥ (선택) 상관계수 배지·수출 일별 해상도.
- **★ 시장 파이프라인 정리 항목:** `시장-종목` 탭 **B(티커)열 텍스트 서식**(현재 앞자리 0 떨어짐, 표시용) · 시장-종목 오래된 행 pruning(append 누적이나 사이트는 종목별 최신 1건 dedup으로 무해) · Google News 간헐 503(재시도로 완화, 나쁜 날엔 0행이라 사이트는 직전 유지).
- **★ 완료 상세(2026-07-08):** ① 티커=현재값 확정(BASKET·KRSEMI_OPTIONS: 삼성·하이닉스·한미·주성·리노 + 동일가중 바스켓, 코드변경 없음). ② HBM 카드→DRAM 계약가 지수로 용도변경 — TrendForce DRAM 스팟가 차트는 사용불가(유료·API없음, DDR5이지 HBM아님)로 판정, HBM은 스팟거래 없어 공개가격 부재. 대신 `valuechain_manual.json`을 TrendForce 분기 계약가 상승폭(QoQ, 1Q26 +90~95%·2Q26 +58~63%)을 직전분기=100으로 지수화한 실데이터로 교체(v=[100,192,307], 출처 note 표기). dashboard.js `vcCard`에 `period`/QoQ 변동 지원 추가 + 태그 "수동·샘플"→"수동". **에디터는 매 분기 발표 시 t/v 한 점씩 추가.** ③ 랜딩 `index.html` #dashboard: 가짜 6카드(INDICATORS)+"유료 구독자 제공" 오카피 제거 → 무료 대시보드 설명 카피 + `dashboard.html` CTA 버튼. 고아 코드 정리(INDICATORS 상수·renderIndicators·`.ind*` CSS·sampleNote/locked i18n). `.ind-grid`/`.sample-note`는 dashboard.html에서 재사용 중이라 유지.
- **★ 제약 메모(대시보드):** data.go.kr 인증키를 **재발급하면 활성화까지 수 분~수십 분** 걸려 그 사이 수출 API가 403을 반환함(정상). 키는 Actions Secret `DATA_GO_KR_KEY`. 파이프라인은 **이번 수집에서 빠진 시리즈를 직전 dashboard.json에서 보존**하므로 일시 실패로 페어가 사라지지 않음. 데이터 워크플로는 GITHUB_TOKEN 푸시가 배포를 자동 트리거 못 해 `gh workflow run deploy-pages.yml`로 명시 트리거함.
- **기술 페이지 구조 변경 완료(2026-07-06):** tech.js를 주간·분야 모델로 재작성(`TECH_DOMAINS` 5개=live 2+soon 3, `TECH_WEEKLY` 분야별 이슈={signals[] 다이제스트 + headliner 딥다이브}). `BRIEFINGS_TECH`는 헤드라이너에서 파생해 랜딩 계약 유지(무손상). tech.html=분야 메뉴(`data-tech-menu`)+주간 이슈(`data-tech-weekly`), 유료 섹션은 분야 티어 카피로 정합화. script.js=`techState`(module-level)+`renderTechWeekly`+`data-tech-domain` 위임 핸들러(전역 lang 리스너와 분리). style.css=`.tech-chip`/`.sig`/`.deep-lock` 등 신규(기존 토큰만). 검증: node 문법+파생+렌더 로직(분야 토글·KO/EN) 통과. 유료 body는 표시용 잠금(Phase 1, 실제 페이월 없음).
- **앵커 2개 1호 작성 완료(2026-07-06):** 공개 출처 리서치 기반 초안. AI 인프라=신호 4(capex 부품가·CPO 상용화·전력냉각 병목·자체칩) + 헤드라이너 "CPO, AI 네트워크 병목을 광으로". 반도체=신호 4(HBM4 본딩 분기·SK하이닉스 미국 후공정·유리기판 상업출하·CoWoS 캐파병목) + 헤드라이너 "HBM4, 병목은 셀이 아니라 본딩". 밸류체인 기업 실명 반영(엔비디아·브로드컴·TSMC·삼성·SK하이닉스·인텔·SK Absolics 등, 관찰·면책). 출처: SemiAnalysis/IDTechEx/TrendForce/EE Times/Tom's Hardware/CNBC. **주의: 배지·푸터의 "샘플" 문구는 실내용과 불일치 — 정식 오픈 시 tech용 배지를 "리서치 초안/검증본"으로 교체 권장(전역 문구라 미변경).**

## 다음에 할 일 (우선순위)

1. ~~기술 페이지 구조 변경~~ **완료(2026-07-06).**
2. ~~앵커 2개 1호 작성~~ **완료(2026-07-06, 리서치 초안).**
3. **주간 발행 파이프라인(반자동) 착수** — 아래 5단계 확정안. 콘텐츠 수요가 확인되면 ①②③ 자동화부터.
4. **무료 구독자 메일링 — 메일러 완성·end-to-end 검증 완료(2026-07-06). 실전 발송(TEST_MODE=false)만 사용자 판단 대기.** 검증됨: 발송+렌더+개인화(관심 키워드)+토글/수신거부 링크 클릭→`관심분야(기술)` 시트 반영까지. 웹앱 배포·SALT 고정 완료. 경로=**Google Apps Script**(사이트 호스팅과 독립, 정식 도메인 이관 시 버릴 임시). 코드=`mailer/Code.gs`(+README). **2-시트 모델:** `설문지 응답 시트1`(신원·동의 원천, 읽기 전용: `이메일 주소`/`메일 수신 동의`/`관심 키워드`) + `관심분야(기술)`(선호도 상태, 읽기/쓰기, 헤더 자동생성: 이메일·관심 분야·상태·갱신). `sendWeekly()` 수동 발송 + `doGet` 웹앱이 이메일 링크→`관심분야(기술)`에 upsert(분야 토글/수신거부). 최초 구독자=가동분야 전체 seed, 이후 토글로 좁힘. 수신거부는 응답 시트 안 건드리고 pref 상태=수신거부. **남은 것(사용자):** 시트에서 Apps Script 열기→Code.gs 붙여넣기(bound 아니면 SHEET_ID)→SALT/탭이름 확인→웹앱 배포→WEBAPP_URL 설정→TEST_MODE로 미리보기→false 전원. 매주=ISSUE만 갱신. GmailApp ~100/일. 정식은 도메인 인증 ESP로.
5. **로드맵 분야 개방** — 전력·에너지 / 우주·방산 / 바이오. 전력 개방 시 AI 인프라에서 전력 접점 이사.
   - **경제·금융 샘플 배포 완료(2026-07-06).** 렌더 제네릭화(`renderWeekly(cfg)`가 tech/finance/economy 공용). **금융**=자산군 분야 모델(FINANCE_DOMAINS: 국내 증시·미국 증시 live + 채권/원자재/펀드 soon, FINANCE_WEEKLY). **경제**=단일 매크로 다이제스트(ECONOMY_WEEKLY, 분야 메뉴 없음). 경계=경제(매크로·정책)/금융(자산·시장)/기술(산업 메커니즘). 콘텐츠는 "샘플" 배지. 랜딩 티저도 각 헤드라이너에서 파생. 메일러는 여전히 기술 전용. **주의: `renderCategoryFeeds`/`renderTopicChips`/`TOPICS`는 이제 미사용(dead) — 3개 페이지에서 data-feed-category/data-topics 제거됨. 정리 대상.**
6. 유료 폼 문항(관심 분야 선택 = 티어 매핑) 추가 — 사용자 몫. 대시보드 실데이터, 커스텀 도메인은 선택.
8. ~~**서재(Library) 재구축**~~ **완료·라이브(2026-07-08).** [library.html](../public/library.html)(필터+리포트 그리드+운영자 노트 스트립) + [read.html](../public/read.html)(`?r=id`, marked CDN 렌더+인라인 면책+선두 H1 제거). `.md`+프런트매터 주기 업로드: `scripts/build_library_manifest.py`(stdlib) + `.github/workflows/library-manifest.yml`가 `library.json` 자동 생성·배포. 렌더러는 script.js에 통합(캘린더 패턴). nav "서재"→library.html(6페이지), 랜딩 티저(최신3)+CTA, tech/finance/economy "심층 리포트" 스트립. 시드=CPO·우주 SCM 리포트 + 도서 노트(svg). §6 투자판단 문구 최소 완화+면책. 상세 [docs/library-plan.md](library-plan.md). **후속(선택):** 노트 캡션 개인화(notes/2026-07-book-bird-language.md), 라이브 픽셀 점검, 금융·경제 리포트 추가 시 스트립 자동 노출.
7. **무료 구독자 관심 분야 "weight" 반영(향후)** — 무료 구독자가 폼에서 고른 관심 분야를 집계해 주간 콘텐츠 우선순위/노출에 반영. 2~3호 발행하며 데이터 쌓인 뒤.
9. **시장(주식) 탭 + AI 브리핑 워크플로 — 스펙 확정(2026-07-08 grill), [docs/market-plan.md](market-plan.md) 참조.**
   - **진척(2026-07-08): ①§6 린트 `scripts/lib/guard.py` ②시장 탭 `market.html`+렌더러(구글 시트 CSV: 시장-일일 gid=0/시장-종목 gid=2102188761) ③nav 재정리 ④AI 엔진 `scripts/lib/ai.py`(deepseek→gemini, OpenAI호환) ⑤종목 수집기 `scripts/fetch_market.py`(종목설정/시드 → Google News RSS → AI 요약 JSON → §6 린트 → 웹앱 POST) ⑥쓰기 웹앱 `market/Code.gs`(Apps Script, 헤더매핑 append, TOKEN) — 전부 완료·검증. ⑦`market-data.yml` cron 평일 07:00 KST **자동 발행 라이브**. 렌더러=종목별 최신 1건.** 키 시크릿: `DATA_GO_DEEPSEEK`/`DATA_GO_GEMINI`(워크플로서 DEEPSEEK/GEMINI_API_KEY로 매핑) + `MARKET_WEBAPP_URL`/`MARKET_WEBAPP_TOKEN`. **Stop=Actions 워크플로 Disable.** **남은 것: (C) Telegram 일일 파이프(시장-일일, notifier→웹앱 tab="시장-일일") → (D) 금융·경제 자동 교체 → (E) 기술 AI 초안 보조. 정리: 시트 티커열 텍스트 서식(005930), 시장-종목 오래된 행 pruning(현재 append 누적, 사이트는 dedup으로 무해), (선택) 종목설정 CSV 게시→MARKET_CONFIG_CSV.** AI 키 검증용 `market-ai-test.yml` 있음. C 하이브리드(IonQ=Actions 네이티브 재구축, Telegram=서버 유지+Sheet 파이프). 무인 완전자동 + **§6 결정적 린트**(코드가 유일 방어선) + AI 라벨. 엔진=deepseek 주력/Gemini 폴백(engine.py 이식). 종목=Sheet 설정형(시드 반도체 바스켓). Google Sheet 워크북(시장-일일/시장-종목/종목설정) CSV 렌더. 범위 단계적(시장→금융·경제 샘플 교체→기술 초안 보조). Nav=기술·경제·금융·시장·대시보드·서재·경제캘린더. **선행 셋업(사용자): DEEPSEEK/GEMINI 키 Actions Secret + Google Sheet + 쓰기 경로(Apps Script 웹앱 추천).** 다음: 시장 탭 스캐폴드 + §6 린트 모듈부터.

**메일러 3-카테고리 확장(2026-07-06):** `mailer/Code.gs`를 기술+금융+경제 **통합 1통** 발송으로 재작성. 시트=응답 1(신원·동의) + 선호도 3(관심분야(기술)/(금융)/(경제), 스키마 이메일·관심 분야·상태·갱신 자동생성). 구독자당 구독 카테고리·분야 섹션만 담아 발송, 최초는 각 카테고리 가동분야 전체 seed. 이메일 링크=분야 토글(c/d)+전역 수신거부. **재설치 주의: SALT는 기존 값 유지, doGet 변경으로 웹앱 새 버전 재배포 필요.** 발송은 사용자가 Apps Script에서 실행(어시스턴트는 실행 불가). dead code(renderCategoryFeeds/renderTopicChips/TOPICS) 제거 완료.

**완료(2026-07-06 추가분):** tech 헤드라이너 배지 "샘플"→"무료 공개"(techPage.freeBadge), 푸터 면책 마지막 문장을 tech=공개출처 관찰/그 외=샘플로 정확화, 푸터 이메일(paun.jeong@gmail.com) 5개 페이지 mailto 링크화. 금융/경제/대시보드는 tech 수요 검증 후 진행(사용자 확인). 1호 내용은 사용자가 "충분히 좋음"으로 승인(에디터 검증 완료).

## 지표 대시보드 (2026-07-07 P1 완성)

**조직 원리:** 관계·상관 오버레이(태그 클릭→두 지표 이중Y축 겹침) + 산업 밸류체인 지표. investing.com과 차별화=데이터 폭이 아니라 선별된 관계. **전부 무료(미끼), 수익화는 브리핑 구독.**
- **dashboard.html** + `assets/dashboard.js`(uPlot 이중축 렌더) + `assets/vendor/uPlot.*`(self-host, 50KB). nav "대시보드"를 dashboard.html로 재지정(전 페이지).
- **데이터: 자동 실데이터 파이프라인** — `scripts/fetch_dashboard.py`(무키: Yahoo v8 chart + 미 재무부 DTS) → `public/assets/data/dashboard.json`. `.github/workflows/dashboard-data.yml`(평일 21:30 UTC 크론, 커밋·푸시). stdlib만(pip 불필요).
- **P1 페어 4개(실데이터):** 금리(^TNX)↔S&P(^GSPC), 달러(DX-Y.NYB)↔KOSPI(^KS11), 구리(HG=F)↔금리, EWY↔반도체 바스켓(삼성·하이닉스·한미·주성·리노 동일가중, rebase100). 정렬=UTC 일 버킷.
- **TGA↔지수 페어:** 코드 있으나 재무부 API가 로컬 샌드박스에서 차단돼 미수집 → **Actions 첫 실행 때 채워질 예정(account_type 필터 확인 필요).**
- **차트:** 이중 Y축(좌 primary, 우 warning), 6M/1Y/3Y 토글. 상관계수 없음(향후).
- **P2 완성(2026-07-07):** ① 페어5 우축을 **드롭다운**으로(기본 삼성전자 + SK하이닉스·한미·주성·리노·동일가중 바스켓). ② **산업 밸류체인 지표 섹션** — 자동 프록시 카드(SOXX·SMH·MU·TSM·SOX, 최근추세+~1M%) + 수동 핵심(`valuechain_manual.json`의 HBM 스팟가격, **수동·샘플** 배지, 에디터 주간 갱신). ③ TGA도 정상(878pts). 데이터 워크플로가 GITHUB_TOKEN 푸시 후 배포 자동 트리거하도록 수정.
- **P3 수출 완료(2026-07-07):** 관세청 수출 주요국가별 10일 잠정치 API(`apis.data.go.kr/1220000/cntyMmUtPrviExpAcrs/getCntyMmUtPrviExpAcrs`, https). 필수 파라미터=`strtYymm`/`endYymm`(YYYYMM 6자리). 키=Actions Secret `DATA_GO_KR_KEY`(fetch 스텝 env로 매핑). 응답 item{priodYear,priodMon,priodDt("01~10"),itemUsdAmt00=총계·01~10=주요국}. **월별 총액(10일 3구간 합산) 66개월 실데이터** → `exports` series + **`export-krsemi`(수출↔반도체 종목) 6번째 페어**. ⚠️ 사용자가 실키를 채팅에 노출 → 재발급 권고함.
- **남은 것:** ~~① 티커 확정~~ **완료(2026-07-08).** ~~② 수동 지표 실수치·출처 교체~~ **완료(2026-07-08, DRAM 계약가 지수).** ~~③ 랜딩 #dashboard 티저 정리~~ **완료(2026-07-08).** ④ (선택) 상관계수 배지 ⑤ 수출은 월별(66점)이라 종목(일별) 오버레이 시 월 해상도 — 필요시 개선.

## 주간 발행 파이프라인 (2026-07-06 확정안)

별도 상시 서버 불필요 — GitHub Actions 크론 러너 + 구글시트(캘린더의 CSV 패턴 재사용). **사람 선별(④)이 유일한 발행 스위치.**

1. **수집** — Actions 주간 크론 + Python(IonQ 자산 재사용). 분야별 소스 어댑터. 1차 소스 우선(실적콜 트랜스크립트·컨퍼런스 IEDM/ISSCC/GTC·특허 RSS USPTO/KIPRIS·arXiv), 보조 전문매체 RSS(SemiAnalysis/TrendForce).
2. **초안** — LLM 체인(Gemini 우선/Claude 폴백, Telegram 자산 재사용)으로 raw→"제목+1줄+메커니즘 후보+밸류체인 후보+출처+선행도" 후보 카드까지만(자동요약 금지).
3. **정리** — 구글 시트 append. 컬럼: 분야·발행주·유형(signal/headliner)·제목ko/en·한줄ko/en·밸류체인·출처URL·선행도·status(draft).
4. **선별(사람)** — status draft→approved, 헤드라이너 지정, 선행도·각도 판단, 밸류체인 실명 확정, 투자판단 표현 제거. 핵심 게이트.
5. **발행** — approved 행만 site.js가 CSV로 읽어 렌더(loadCalSheet 복제). 무료/유료는 access 컬럼.

방어: keep-alive 워크플로우 + `permissions: contents: write` + `.gitattributes`, 시크릿은 Actions Secrets/`st.secrets`, CSV PUT 시 `sha` 캐싱, 미검증은 status로 격리, 투자판단 표현 린트.

## 결정/제약 메모

- Phase 1 = 결제·로그인·DB 없이 폼으로 수요 검증. 투자 조언 문구 금지(밸류체인 기업 명시는 OK, 매수·매도·목표가·수급 판단은 금지, 면책 필수).
- 기술 브리핑은 **주간**. 금융/경제 주기는 별도 결정(이번 grill 범위 밖 — 기술만 확정).
- 분야는 소싱 파이프라인 단위 = 독자가 원하는 게 고정 분야 밖이면 소싱이 무너짐. 그래서 분야 메뉴로 고정하고 티어=분야 수.
- 배포는 `main` push → GitHub Actions 자동. `public/`만 서빙.
- **Pages 배포 stuck 이슈(2026-07-06 발생·해결):** upload는 성공하나 마지막 "Deploy"만 "Deployment failed, try again later"로 지속 실패(7/3~7/5). 원인=코드/워크플로/전역장애 아님, **레포별 Pages 백엔드 상태가 막힘**. 해결=Pages 소스 토글로 리셋 — `gh api -X PUT repos/OWNER/REPO/pages -f source[branch]=main -f source[path]=/` (legacy로) 후 즉시 `-f build_type=workflow`로 복귀 → 재배포 트리거하면 성공. 재발 시 이 순서로. (Settings→Pages 소스 토글 UI와 동일 효과)
- 기존 IonQ/Telegram 자동화는 향후 "주식종목브리핑"용 — 현재 기술/금융/경제 브리핑엔 미사용.
- 캘린더 뷰토글에 `class="lang"` 쓰지 말 것(전역 KO/EN 리스너 하이재킹). `.cal-viewtoggle` 사용.

---

## 핸드오프 작성 템플릿 (복사해서 위 "현재 상태"를 갱신)

```
- 마지막 갱신: YYYY-MM-DD
- 작업 브랜치: feat/...
- 진행 중: (무엇을 어디까지 했는지 1~3줄)
- 다음 단계: (바로 이어서 할 것)
- 막힌 점/주의: (있으면)
```
