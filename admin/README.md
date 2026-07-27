# 운영자 관리자 콘솔 (BSL_admin)

기획: [../docs/admin-console-plan.md](../docs/admin-console-plan.md)

흩어진 운영 수작업(주간 초안 승인 · 서재 업로드 · 방문 통계 · 대시보드 수동 카드 · 파이프 토글)을
**인증된 콘솔 하나**로 수렴한다. 스택 = Apps Script + Sheets(₩0, 임시 관리 레이어). 공개 사이트와 독립.

- `Code.gs` — 서버 함수(인증·시트 read/write). 시트ID·비밀은 스크립트 속성으로만.
- `index.html` — HtmlService 콘솔 SPA(DESIGN.md 토큰). `google.script.run`으로 서버 호출.

## 인증 모델

배포를 **"액세스: 나만(only myself)"**으로 하면 Google이 본인 외 접근을 차단한다 → 로그인이 곧 인증(TOKEN·비밀번호 불필요).
선택적 이중 확인: 스크립트 속성 `ADMIN_EMAILS`(콤마구분)에 허용 계정을 넣으면 코드가 대조한다.
(기존 market/analytics 웹앱은 "모든 사용자" 공개 엔드포인트라 TOKEN이 필요했지만, 사람이 로그인해 쓰는 콘솔엔 Google 계정 인증이 더 강하고 단순하다.)

## 설치

1. **script.google.com → 새 프로젝트** (이름 예: `BSL_admin`, standalone).
2. `Code.gs` 내용을 붙여넣고, **파일 추가 → HTML → `index`** 로 `index.html` 내용을 붙여넣는다(파일명 `index`).
3. **프로젝트 설정(⚙) → 스크립트 속성**:
   | 속성 | 값 |
   |---|---|
   | `MARKET_ID` | BSL_market 스프레드시트 ID (주간-초안·주간-발행·주간-발행항목·주간-발송로그·서재·대시보드-수동·settings 탭) |
   | `ANALYTICS_ID` | BSL_analytics 스프레드시트 ID (방문로그 탭) |
   | `ADMIN_EMAILS` | 본인 gmail (선택; 비우면 "액세스: 나만"에만 의존) |

   > 스프레드시트 ID = 시트 URL의 `/d/` 와 `/edit` 사이 문자열.
4. **배포 → 새 배포 → 유형: 웹 앱** → **실행: 나(me)**, **액세스: 나만(Only myself)** → 배포 → URL 북마크(공개 링크 아님).
5. 최초 실행 시 권한 승인 팝업(스프레드시트 접근) 1회 허용.

## 필요한 시트 탭 (BSL_market)

콘솔이 읽고 쓰는 탭. 헤더 첫 행이 정확해야 한다(웹앱이 헤더명으로 매핑).

| 탭 | 헤더 | 비고 |
|---|---|---|
| `주간-초안` | 분야·발행주·유형·제목ko·제목en·한줄ko·한줄en·밸류체인·출처URL·원문제목·원문일시·수집일시·생성엔진·선행도·status | 기존 탭에 원문제목·원문일시·수집일시·생성엔진 열 추가 |
| `서재` | id·유형·분류·발행일·제목·요약·태그·본문·access | 이미 존재(서재 업로드) |
| `대시보드-수동` | 카드키·라벨·단위·주기·출처·시각·값 | **신설 필요** (모듈 ②) |
| `settings` | key·value | **자동 생성**(첫 토글 시 콘솔이 만듦) |
| `방문로그` (BSL_analytics) | 날짜시각·페이지·referrer·방문자ID | 이미 존재(비콘) |

## 4개 모듈

1. **주간 초안 승인** — 발행주·상태 필터, `status draft↔approved` 토글, `유형` headliner 지정, 옛 주 draft 선택 삭제. 현재 W29/W30 혼재·누적 정리를 여기서.
2. **서재 업로드** — 리포트/노트 폼 → `서재` 탭 append. 사이트는 다음 로드 시 반영.
3. **방문 통계** — 페이지뷰·순방문·날짜별·페이지별. `beacon-test` 등 테스트 행 삭제.
4. **대시보드 수동** — `대시보드-수동` 탭에 데이터 점 추가/삭제(카드키 그룹, 행 순서=시계열).

## 대시보드 수동 카드 ↔ 사이트 연결 (모듈 ②)

콘솔은 `대시보드-수동` 탭에만 쓴다. 사이트 반영은 **기존 대시보드 크론**이 담당하므로 `dashboard.js`는 변경하지 않는다:

1. `대시보드-수동` 탭을 **웹에 게시(파일 → 공유 → 웹에 게시 → 해당 탭 CSV)** → CSV URL 복사.
2. GitHub repo **Actions Secret `DASH_MANUAL_CSV`** = 그 CSV URL.
3. 이후 `dashboard-data.yml` 크론이 `scripts/fetch_dashboard.py`로 CSV를 읽어 `public/assets/data/valuechain_manual.json`을 재생성·커밋·배포.
   - `DASH_MANUAL_CSV` 미설정이면 재생성하지 않고 **기존 파일을 그대로 보존**(fail-safe) → 라이브 대시보드 무손상.
   - 기존 DRAM 카드를 옮기려면 탭에 `dram` 행 3개(점)를 넣으면 된다.

## 파이프라인 토글 (Stop/Run, 전역 CLAUDE.md §15)

콘솔 상단 버튼이 `settings` 탭의 `pipeline_enabled`(1/0)을 토글한다. 수집 파이프가 진입부에서 확인:

- **읽기 경로:** `대시보드-수동`과 같은 방식으로 `settings` 탭을 **CSV 게시** → Actions Secret **`SETTINGS_CSV`** 에 URL.
- `scripts/lib/toggle.py`가 이 CSV를 읽어 `pipeline_enabled=="0"`이면 `fetch_weekly.py`·`fetch_market.py`가 **early-exit**.
- **fail-open:** `SETTINGS_CSV` 미설정·네트워크 실패·키 부재는 모두 **활성**으로 간주(오직 `0`일 때만 중지) → 실수로 파이프가 멈추지 않는다.
- ⚠️ **텔레그램 서버(별도 repo)는 아직 이 토글을 안 읽는다.** 그쪽 일일 파이프까지 멈추려면 텔레그램 서버에도 동일 가드를 추가해야 한다(후속).

## LLM 엔진 선택 (⑤ 탭)

주간 초안·시장 종목 생성에 쓰는 LLM 엔진을 콘솔에서 고른다. 파이프 토글과 같은 store(`settings` 탭)를 쓴다.

- 콘솔 ⑤ 탭에서 **주력 엔진** 선택 → `settings` 탭 `llm_primary` 기록.
- `scripts/lib/ai.py`가 실행 시 `SETTINGS_CSV`에서 `llm_primary`를 읽어 그 엔진을 **맨 앞(주력)**에 세우고 나머지는 **폴백**으로 유지. 미설정·오류·모르는 값이면 기본 순서(deepseek 주력) — fail-open.
- `SETTINGS_CSV` 시크릿이 이미 등록돼 있으면 추가 셋업 없음. **다음 크론 실행부터** 적용.

### 새 LLM provider 추가 (예: OpenAI GPT, Claude 등)
"주력 선택"만으론 새 provider가 안 생긴다. 3가지가 함께 필요:
1. **Secret 등록** — GitHub Settings → Secrets → Actions (예: `OPENAI_API_KEY`).
2. **`scripts/lib/ai.py`의 `ENGINES`에 한 줄 추가** — `(이름, base_url, 기본모델, 키_env이름)`. (OpenAI 호환 `/chat/completions` 엔드포인트여야 함.)
3. **`admin/Code.gs`의 `LLM_ENGINES` 배열에 이름 추가** + Apps Script 재붙여넣기·재배포 (콘솔 드롭다운에 노출).
4. **워크플로 env** — `weekly-draft.yml`·`market-data.yml`의 해당 스텝 env에 `<키_env이름>: ${{ secrets.<Secret> }}` 추가 (Actions는 .yml에 명시한 시크릿만 주입).

## 유지보수

- 매주: 주간 초안 승인 탭에서 한 주 배치 승인 → 발행 후 옛 주 draft 선택 삭제.
- 분기: 대시보드 수동 탭에 계약가 지수 점 1개 추가.
- 리포트 게시 시: 서재 업로드 폼 사용.
- **정식 유료 이전 시:** 이 콘솔·시트를 진짜 백엔드/DB로 대체하고 폐기(임시 스택).

## 주간 발행 원장 및 예약 발행

주간 행 승인과 호 발행은 분리한다. `approved` 행은 공개되지 않으며 운영자가 “이번 호 발행 예약”을 실행하거나 자동 검수가 완료돼야 발행 원장에 준비 상태가 생긴다.

추가 탭:

| 탭 | 헤더 |
|---|---|
| `주간-발행` | issue_key·state·revision·manual_confirmed·auto_mode·published_at·emailed_at·content_hash·updated_at·message |
| `주간-발행항목` | issue_key·revision·분야·발행주·유형·제목ko·제목en·한줄ko·한줄en·밸류체인·출처URL·원문제목·원문일시·검수점수·검수사유·상태·published_at·updated_at |
| `주간-발송로그` | issue_key·revision·recipient_hash·status·attempted_at·error |

운영 일정은 일요일 06:00 생성, 화요일 17:00 마감, 17:05 자동 검수, 20:00 발행이다. 늦은 승인분은 웹판 리비전을 올리되 주간 이메일은 다시 보내지 않는다.

설정 순서:

1. 관리자 콘솔을 한 번 열어 위 3개 탭을 자동 생성하거나 헤더를 수동으로 정확히 만든다.
2. `주간-발행`과 `주간-발행항목` 탭을 각각 CSV로 웹 게시한다.
3. GitHub Actions Secret `WEEKLY_DRAFT_CSV`에는 `주간-초안`, `WEEKLY_RELEASE_CSV`에는 `주간-발행` CSV URL을 넣는다. 메일러 고정 호출용 `WEEKLY_MAILER_URL`과 `WEEKLY_MAILER_TOKEN`도 등록한다.
4. GitHub Actions Secret `WEEKLY_RELEASE_ITEMS_CSV`에는 `주간-발행항목` CSV URL을 넣는다. `deploy-pages.yml`이 배포 사본의 `site.js`에 주입하며 raw 초안 CSV를 넣으면 안 된다.
5. `admin/Code.gs`와 `admin/index.html`을 Apps Script에 다시 붙여넣고 재배포한다.

## ⑤ 엔진·발송시각 탭

주력 LLM 엔진(`settings.llm_primary`)과 **일일 시황 발송 시각**(`settings.daily_send_time`, `HH:MM` KST)을 지정한다.

발송 시각은 저장만 하면 되고, 메일러(별도 Apps Script)의 새벽 03:00 `syncDailySchedule()`이 **다음 날부터 트리거에 자동 반영**한다. 서머타임 전환 때도 이 값만 고치면 된다. 미지정이면 메일러 폴백 `07:40`이 쓰이며, 콘솔은 "(기본값 — 아직 지정 안 함)"으로 표시한다.

⚠️ Apps Script 시간 트리거는 **±15분 오차**가 있어 정확한 시각 지정은 불가하다. KRX 장전 단일가(08:30) 전 도착이 목적이면 여유를 두고, 텔레그램 `장전` 요약 생성(07:00 KST) 이후로 지정한다. 자세한 동작은 [mailer/README.md](../mailer/README.md) 참고.

## ④ 방문 통계 — 유입 경로 (2026-07-28)

`방문로그`의 `referrer`는 계속 수집되고 있었으나 표시되지 않아 "어느 채널이 실제로 작동했나"를 알 수 없었다. 구독자 증가의 병목이 유통인지 전환인지 판단하려면 이 숫자가 먼저 필요하다.

- `_refLabel_`이 전체 URL을 **호스트로 묶는다**(`www.` 제거·소문자화). 같은 채널의 다른 글이 수십 줄로 흩어지는 것을 막는다.
- 자기 도메인(`brevislab.com`·옛 GitHub Pages)에서 온 이동은 `사이트 내 이동`으로 분리하고, 상단 **외부 유입** 수치는 내부·직접을 뺀 값이다.
- `직접 방문·알 수 없음`에는 북마크·주소 직접 입력·앱 내 링크·HTTPS→HTTP 이동이 섞인다. 0이 아니라고 해서 유입이 없는 것은 아니다.

`admin/` 변경은 Apps Script에 다시 붙여넣고 재배포해야 한다.
