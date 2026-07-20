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
   | `MARKET_ID` | BSL_market 스프레드시트 ID (주간-초안·서재·대시보드-수동·settings 탭) |
   | `ANALYTICS_ID` | BSL_analytics 스프레드시트 ID (방문로그 탭) |
   | `ADMIN_EMAILS` | 본인 gmail (선택; 비우면 "액세스: 나만"에만 의존) |

   > 스프레드시트 ID = 시트 URL의 `/d/` 와 `/edit` 사이 문자열.
4. **배포 → 새 배포 → 유형: 웹 앱** → **실행: 나(me)**, **액세스: 나만(Only myself)** → 배포 → URL 북마크(공개 링크 아님).
5. 최초 실행 시 권한 승인 팝업(스프레드시트 접근) 1회 허용.

## 필요한 시트 탭 (BSL_market)

콘솔이 읽고 쓰는 탭. 헤더 첫 행이 정확해야 한다(웹앱이 헤더명으로 매핑).

| 탭 | 헤더 | 비고 |
|---|---|---|
| `주간-초안` | 분야·발행주·유형·제목ko·제목en·한줄ko·한줄en·밸류체인·출처URL·선행도·status | 이미 존재(주간 파이프) |
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

## 유지보수

- 매주: 주간 초안 승인 탭에서 한 주 배치 승인 → 발행 후 옛 주 draft 선택 삭제.
- 분기: 대시보드 수동 탭에 계약가 지수 점 1개 추가.
- 리포트 게시 시: 서재 업로드 폼 사용.
- **정식 유료 이전 시:** 이 콘솔·시트를 진짜 백엔드/DB로 대체하고 폐기(임시 스택).
