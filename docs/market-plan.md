# 시장(주식) 탭 + AI 브리핑 워크플로 — 구현 스펙 (2026-07-08 grill 확정)

기존 Telegram 자동화 · IonQ 프로젝트를 현재 정적 사이트에 맞게 보완 반영하고,
AI API 워크플로로 콘텐츠 생성을 점진 통합하는 작업의 확정 스펙.
아래 결정은 grill 세션에서 사용자가 항목별로 확정함. 다음 세션은 이 문서대로 단계 구현한다.

## 확정된 설계 결정 (grill Q1~6)

1. **아키텍처 = C 하이브리드.** 주식뉴스(IonQ)는 BrieSigLab에 **네이티브 재구축**(GitHub Actions Python). Telegram은 **기존 서버(crontab) 유지** + 출력만 사이트로 파이프.
2. **발행 = A 완전 자동(무인).** 사용자가 업무상 매일 승인 불가 → 사람 게이트 없음. 대신 §6는 **코드로** 강제(아래 3).
3. **가드레일 = B.** ① 프롬프트 §6 가드(매수·매도·목표가·비중 금지, 관찰·메커니즘·출처 강제) ② **결정적 §6 린트**(발행 직전 금지어 스캔 → 위반 항목 자동 제외/마스킹 + 로그) ③ "AI 자동 생성 · 정보 제공, 투자 조언 아님" 라벨 + 출처 링크 ④ 팩트 앵커링(단정·목표가 없음).
4. **범위 = C 단계적.** ① 시장(신규, 지킬 레거시 없음)부터 자동+린트 검증 → ② 금융·경제(현재 샘플)를 자동으로 교체(순수 개선) → ③ 기술은 **AI 초안 보조**로만 쓰고 선행신호·1차 소스 큐레이션 유지(차별화 보호). *기술은 주간이라 사람 손 여지 있으나, 못 하면 자동+린트로 폴백.*
5. **AI 엔진 = B.** deepseek 주력 + Gemini 폴백(비용 우선). Telegram `engine.py`의 pluggable 엔진 추상화(OpenAI-호환) 이식 — deepseek는 OpenAI-호환이라 그대로 붙음. 키는 Actions Secret.
6. **종목 = B 설정형.** Google Sheet에서 티커 편집. 시드 = 반도체 바스켓 5(삼성전자·SK하이닉스·한미반도체·주성엔지니어링·리노공업). 시세·차트는 대시보드 Yahoo 데이터 재사용.

## 데이터 스파인

- **Google Sheet 워크북 1개**, 탭 구성:
  - `시장-일일` — Telegram 파생 일일 시장 브리핑 (컬럼: 날짜·제목·한줄·출처URL·access)
  - `시장-종목` — 종목별 브리핑 (컬럼: 날짜·티커·이름·요약·근거·출처URL·access)
  - `종목설정` — 티커·이름·활성 (설정형 종목 리스트)
  - (이후) `금융`·`경제`·`기술` 탭 추가로 확장
- 사이트는 각 탭을 **published CSV(gviz/CSV)로 읽어 렌더** — 캘린더 `loadCalSheet` 패턴 재사용.
- 무인(A)이라 **status/승인 컬럼 없음.** §6 린트를 **Sheet 쓰기 직전 파이프라인에서** 적용 → 깨끗한 행만 적재. `access`(free/paid) 컬럼은 예약.

## 파이프라인

**IonQ 네이티브 (Actions):**
- `scripts/fetch_market.py`(신규) — Actions 크론. `종목설정` 읽기 → 종목별 데이터(대시보드 Yahoo 시세 + 뉴스) 수집 → deepseek→Gemini 요약 → **§6 린트** → `시장-종목` 탭 append. 기존 IonQ repo는 로직 참조용.
- **종목 브리핑은 §6 최고위험** → 팩트-포워드(가격 변동 + 이유, 단정·목표가 없음) 강제.
- 제목/성격: 뉴스 대시보드 → **"설정 종목 브리핑"** 으로 변경.

**Telegram 파이프 (서버 유지):**
- Telegram 프로젝트에 `notifier/sheets.py` 추가(또는 기존 Apps Script 웹앱 재사용) → 매일 요약을 `시장-일일` 탭에 BrieSigLab 양식(제목·1줄·출처·날짜)으로 append + §6 린트.
- 현재 "브리핑 유무만" 설정을 → **자동 일일 브리핑 생성**으로.

**공용 §6 린트:**
- `scripts/lib/guard.py`(신규) — 금지어(비중·매수·매도·목표가·베팅·뇌관·필수적·순환 배치·매수세 등) 정규식 스캔. 위반 항목 제외 또는 마스킹 + 로그. IonQ 수집기·Telegram 파이프가 공용으로 호출.

## Nav / IA

- 순서: **기술 · 경제 · 금융 · 시장(주식) · 대시보드 · 서재 · 경제캘린더**
- "오늘의 브리핑"(#samples)은 랜딩 내부 앵커로만 두고 nav에서 제외.
- 신규 `market.html`(시장 탭) = 상단 일일 브리핑 다이제스트(`시장-일일`) + 하단 종목 카드(`시장-종목`). 기존 주간 렌더(`renderWeekly`) 재사용 검토.

## 단계 구현 (권장 순서)

1. **시장 탭 스캐폴드** — `market.html` + nav 추가 + `시장-일일`/`시장-종목` CSV 렌더러(빈 상태 우아하게). Sheet는 수동 시드 몇 행으로 먼저 검증.
2. **§6 린트 모듈** — `scripts/lib/guard.py` + 단위 테스트(이번 세션 위반 문구를 케이스로).
3. **IonQ 네이티브 수집기** — `fetch_market.py` + Actions 워크플로. deepseek/Gemini 키 필요.
4. **Telegram 파이프** — Telegram 프로젝트에 Sheets 라이터 추가.
5. **금융·경제 자동 교체** → **기술 AI 초안 보조**.

## 사용자 선행 셋업 (구현 전 필요)

- **API 키**: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY` → BrieSigLab Actions Secrets.
- **Google Sheet**: 워크북 생성 + 위 탭. 사이트 읽기용 **published CSV URL**(캘린더와 동일). Actions 쓰기용 경로 결정 = **서비스 계정(gspread)** vs **Apps Script 웹앱**(메일러 재사용). 추천 = Apps Script 웹앱(이미 사용 중, 시크릿 관리 단순).
- **Telegram**: 기존 서버가 계속 떠 있어야 함(무인 지속). 세션 만료 시 재인증은 사람 개입 필요.

## 제약 / 주의

- §6(투자판단 금지)는 무인이라 **코드가 유일한 방어선** — 린트 없이는 발행 금지.
- 종목별 매일 AI 브리핑은 §6·환각 위험 최고 → 팩트-포워드 + 린트 + "AI 생성" 라벨 필수.
- 정적 사이트 원칙 유지: 수집·AI는 Actions/서버, 사이트는 CSV/JSON 렌더만.
- keep-alive 워크플로 + `permissions: contents: write` + `.gitattributes` + Actions Secrets 규약 준수.
- 비용: deepseek 주력이라 매일 돌려도 저렴하나, 종목 수·빈도로 비용 관리.
- 브라우저 직접 업로드(서재)는 별개 — 정적 호스팅이라 쓰기 경로(GitHub API + 서버리스 프록시 + 인증)가 필요. 시장 탭의 Sheets/Apps Script 인프라를 세운 뒤 같은 인프라로 얹는 게 효율적(현재는 git push가 충분).

---

## C단계 이후 — Telegram 일일 파이프 재구성 (2026-07-09 확정)

C단계(Telegram→시장-일일 시트, 전체 요약 첫 라인)를 다음 방향으로 재구성한다. 사용자 확정(4결정):

1. **일일 메일 발송처 = BSL Apps Script 메일러.** 구독자 목록·시장-일일 시트가 이미 BSL/Apps Script 안에 있으므로 `mailer/Code.gs`를 확장 + 시간 트리거로 하루 1통. Telegram 서버는 시트 write까지만.
2. **Telegram 자체 이메일 = 완전 OFF.** 개인 모니터링은 telegram '저장된 메시지' + 웹 히스토리로. (BSL 일일 메일 가동 확인 후 마지막에 끈다 — 무발송 공백 방지.)
3. **시장 탭 = 경제/금융/기술 서브탭.** 설정종목 브리핑 아래에 카테고리별 일일 리스트. 채널 카테고리 기반 분류.
4. **수집 주기 = 3회를 장전·장중·마감으로 매핑.** 장전=전일 미국 시황, 마감=금일 국내 시황 등 시장 리듬. crontab 3회는 유지, period 라벨·프롬프트만 시황 구조형으로.

**중요 구분:** "기술/금융/경제"가 두 곳에 생긴다 — 상위 nav의 **주간 앵커(사람 큐레이션)** vs 시장 탭 안의 **일일 텔레그램 리스트(자동·갈무리)**. 라벨을 구분한다(시장 탭 쪽 = "일일 시황 · 경제/금융/기술").

**카테고리 매핑(기본값):** 경제→경제, 금융→금융, IT/기술→기술. 바이오·국제·정치·사회·기타는 시장 탭 미노출(telegram 자체 브리핑엔 그대로). 필요 시 조정.

### 단계 (권장 순서)

- **Stage 0 (완료 2026-07-09):** deploy.ps1 배포 목록에 notifier/sheets.py·guard.py 추가(C단계 import 배포 갭 수정).
- **Stage 1 (완료 2026-07-09) — 카테고리 파이프(telegram 코드):** `sheets.group_summaries(channels, summaries)`가 채널 category(경제/금융/IT/기술)→시장 카테고리(경제/금융/기술)로 묶고 나머지 제외. `write_market_daily(cat_summaries, period)`가 카테고리당 1행 append(컬럼 `날짜·분류·제목·한줄·출처URL·access`, 제목=`{오전/오후/저녁} · {cat} 시황`, 한줄=카테고리 요약 첫 §6-통과 라인). 웹앱 헤더매핑이라 `분류` 컬럼 없어도 나머지는 정상 기록(비파괴). 검증: group 매핑·다채널 병합·§6 skip→next 통과. **프롬프트 장전/장중/마감 시황 구조형은 Stage 3에서.** *사용자 셋업: 시장-일일 시트 헤더에 `분류` 컬럼 추가(경제/금융/기술 필터·Stage 2 서브탭용).*
- **Stage 2 (완료 2026-07-09) — 시장 탭 서브탭 UI(BSL 코드):** market.html 재배치(설정종목 위로, 그 아래 "일일 시황" 섹션에 `[data-market-cattabs]` + `[data-market-daily]`). script.js `renderMarket`에 경제/금융/기술 탭(`.tech-chip` 재사용, 이벤트 위임 1회 바인딩) + `분류` 컬럼 필터(레거시=분류 없으면 전부 표시 폴백) + 최신순·15cap. site.js i18n(catEcon/catFin/catTech, dailyHeading "일일 시황"). style.css `.mkt-cattabs`(기존 토큰만). 검증: node --check + 필터/폴백/정렬 시뮬레이션 통과.
- **Stage 3 (완료 2026-07-09) — 주기 매핑(telegram 코드):** sheets.py `_PERIOD_LABELS`→장전/장중/마감(시트 제목 "장전 · 경제 시황"). prompt.py에 시간대별 시황 강조 힌트 *추가*(장전=전일 미국, 장중·마감=금일 국내 — 기존 요약 형식·period_label 문구는 유지, 가역적). crontab 스케줄 불변. deploy.ps1에 summarizer/prompt.py 추가. 검증: build_prompt 힌트+형식 유지·빈입력, 라벨 매핑 통과. **깊은 시황 프롬프트 튜닝은 실채널 데이터 흐른 뒤로 보류.**
- **Stage 4 (완료 2026-07-09) — BSL 일일 메일러(Apps Script):** mailer/Code.gs에 `sendDailyMarket()`(시장-일일을 openById로 읽어 그날 경제/금융/기술 시황을 동의 전체 구독자에게 발송, 수신거부 제외, TEST_MODE 지원) + `createDailyTrigger()`(매일 08:00 KST, 장전 파이프 07:00 이후) + `dailyHtml_`/`dailyPlain_` + `marketRows_`/`dailyGroups_`/`ymd_`/`unsubSet_`. CFG에 `MARKET_SHEET_ID`(구독자 시트와 별개)·`MARKET_TAB`·`DAILY_CATS`·`DAILY_SUBJECT` 추가. 오늘 행 없으면 발송 생략, 분류 없는 레거시는 단일 그룹 폴백. 검증: node 문법 + 그룹핑/날짜필터/폴백 시뮬. *사용자 셋업: (1) mailer/Code.gs 붙여넣기+저장(웹앱 재배포 불필요 — doGet 불변, 트리거는 최신 저장 코드 실행), (2) CFG.MARKET_SHEET_ID에 '시장' 스프레드시트 ID, (3) **TEST_MODE=true로 sendDailyMarket 수동 실행** — 이때 openById(다른 스프레드시트 접근)+GmailApp 확장 권한 동의 화면이 뜨므로 반드시 승인(트리거만으론 권한 프롬프트 없이 unauthorized 실패), (4) 미리보기 확인 후 TEST_MODE=false, (5) createDailyTrigger() 1회 실행.*
  - **알려진 제약/진단:** ⓐ TEST_MODE는 sendWeekly·sendDailyMarket 공용 — false로 바꾸면 주간도 실발송 무장됨(트리거를 TEST_MODE=true인 채 걸면 운영자에게 매일 테스트 메일). ⓑ 일일 메일의 수신거부 링크는 기존 doGet과 동일 → 주간까지 함께 해지됨(단일 수신거부 모델, v1 허용). ⓒ "행 없음 발송생략" 로그가 오늘 행이 있는데도 뜨면 '시장' 스프레드시트 타임존이 KST보다 앞선 경우(Asia/Seoul·GMT·미국존은 정상).
- **Stage 5 (완료 2026-07-09) — Telegram 이메일 OFF:** summarizer.py에서 `send_email` import·`_emails_raw`/`_recipients`·이메일 Notify 블록 제거. 텔레그램 자체 메일 발송 중단 → BSL 일일 메일로 일원화. 개인 모니터는 텔레그램 저장메시지 유지. (`notifier/email.py`·config.validate()의 GMAIL 요건은 미사용이나 잔존 — 무해.) **⚠️ 재배포 시 BSL 메일러가 실운영(TEST_MODE=false+trigger)이어야 무발송 공백 없음.**
- **상세 잘림 수정 (2026-07-09):** 상세 브리핑 잘림 원인=텔레그램 full_summary 생성이 엔진 `max_tokens=2048`에서 잘림. `Config.MAX_OUTPUT_TOKENS`(기본 4096, .env로 조정 가능) 추가 → engine.py 두 엔진 모두 사용. config.py/engine.py/.env.example 반영.

### 실배포 노트 (2026-07-09, 라이브 전환 중 발견)

- **첫줄 추출 → LLM 시황 생성으로 교체(갈무리):** 첫줄 복사는 메타 서문·오프토픽 문장이 그대로 뽑혀 "타이틀≠내용" 문제 발생(실사이트 확인). 채널 분류가 채널 성격 기반이라 경제 채널도 지정학·사회 내용을 올림 → 근본적 한계. 해결: `sheets.market_prompt(cat,text,period)`로 카테고리별 요약을 LLM에 다시 넣어 `{제목,한줄}` 시황 생성(시장 무관하면 빈값 유도), `parse_signal`이 JSON 파싱+§6 린트, `write_market_daily(summarize, cat_summaries, period)`가 async로 카테고리당 시황 생성 후 append. 제목=`[장전/장중/마감] 헤드라인`. 엔진=summarizer `summarize`(deepseek→gemini 폴백) 주입. 카테고리당 LLM 1회(3회/run). 검증: parse_signal 4케이스·오프토픽 생략·async 흐름 통과. **summarizer.py 훅 `await write_market_daily(summarize, ...)`.**
- **deepseek 401:** 서버 `.env`의 DEEPSEEK_API_KEY가 옛 키(sk-321…)라 401 → 실제 키(sk-36f3e…)로 교체. 그동안 gemini 폴백으로 가려져 있었음. BSL은 별도 신규 키 사용(같은 계정, 키 여러 개 무방).
- **.env 브래킷 함정:** `MARKET_WEBAPP_URL=<...>`처럼 안내한 placeholder `<>`를 값에 그대로 입력 → URL 깨져 404. 값에 꺾쇠 금지.
- **죽은 웹앱 URL:** 서버에 넣은 market 웹앱 URL(AKfycby04L7…)이 존재하지 않는 배포라 404. 살아있는 URL은 브라우저로 열어 `{"ok":true,"service":"market-webapp"}` 확인(현재 유효=AKfycbyfK0…). GitHub Actions Secret도 동일 URL로 맞출 것.
- **GitHub Secret vs .env 형식:** Secret은 이름/값 칸 분리(등호·prefix 없이 값만), .env는 `KEY=VALUE` 한 줄.
- **분류 컬럼:** 시장-일일 헤더에 `분류`가 없으면 사이트 서브탭 필터 미작동(레거시 폴백으로 전체 표시). 헤더에 `분류` 추가 필요(웹앱은 이름 매핑이라 위치 무관).

### 일일 메일에 상세 요약 첨부 (2026-07-09, Stage 5 이전 선행)

Stage 5(텔레그램 자체 메일 OFF) 시 상세 요약이 사라지는 문제 → BSL 일일 메일에 통합. **결정: 전체 구독자 · 아침 1회(장전 상세)**.
- **텔레그램**: `sheets.write_market_body(full_summary, period)`가 `full_summary`를 **§6 마스킹**(`guard.mask`) 후 시장 시트 새 탭 **`시장-본문`(날짜·시간대·본문)** 에 append. `_post`에 tab 파라미터 추가. summarizer.py 훅에서 `write_market_body(full_summary, period)` 호출. guard.py에 `mask()` 복원.
- **메일러**: `marketBody_()`가 그날 `장전` 본문을 openById로 읽고, `renderBody_()`(마크다운풍→HTML: `#`헤더·`**볼드**`·이스케이프)가 렌더. `sendDailyMarket`이 시황 헤드라인 아래 "상세 브리핑" 섹션으로 첨부. dailyHtml_/dailyPlain_에 detail 인자 추가. CFG `MARKET_BODY_TAB`.
- 검증: guard.mask(금지어만 […]), write_market_body(시장-본문·장전·마스킹), renderBody_(볼드/헤더/이스케이프), GAS 문법 통과.
- **사용자 셋업: 시장 시트에 `시장-본문` 탭 생성(헤더 `날짜·시간대·본문`) → 텔레그램 재배포·재실행 → mailer Code.gs 갱신(재붙여넣기, CFG 값 보존).**

### 배포/제약 메모

- Telegram 프로젝트는 git 아님. Oracle 서버(152.69.238.53, ~/tg_summarizer)에 `deploy/deploy.ps1`(scp) + `systemctl restart fastapi_app`로 배포. **웹 UI(routes.py/templates) 수정 시 deploy.ps1 $FILES에 추가 필요**(현재 web/ 미포함).
- 시황 코멘트는 §6 최고위험 — 린트·팩트포워드 필수.
- 시장-일일 시트에 분류 컬럼 추가 시 렌더러(script.js mktCol)·webapp 헤더매핑은 자동 대응(헤더 읽어 매핑).
