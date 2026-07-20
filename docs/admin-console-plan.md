# 운영자 관리자 콘솔 (Admin Console) 구현 스펙 — 확정본 (2026-07-20 grill)

Phase 2 핵심 산출물. 지금 흩어진 운영 수작업(주간 초안 승인·대시보드 수동 카드·서재 업로드·방문 통계)을 **인증된 단일 콘솔 하나**로 수렴한다.
다음 세션은 이 문서대로 구현한다. 아래 결정은 2026-07-20 grill에서 사용자가 확정함.

## 확정된 설계 결정

1. **스택 = Apps Script + Sheets 유지 (₩0).** 새 백엔드·DB·호스팅 도입 안 함. 시트=DB, Apps Script=백엔드. 유료 사이트 이전 시 버릴 **임시 스택**임을 명시(mailer/README 톤과 동일).
2. **범위 = 관리자 콘솔만.** 운영자(본인) 1인용 내부 도구. 유료 구독자 로그인·결제·회원 DB는 **이후 Phase로 분리**(이번 범위 밖).
3. **인증 = Apps Script 웹앱 "액세스: 나만(only myself)".** Google 로그인이 곧 인증 — 별도 비밀번호·TOKEN 불필요. 코드에서 `Session.getActiveUser().getEmail()`을 allowlist(현재 1개)와 대조해 이중 확인. **기존 쓰기 웹앱들의 TOKEN 방식과 다른 이유:** 그것들은 "모든 사용자" 공개 엔드포인트라 TOKEN이 유일 방어선이지만, 콘솔은 사람이 로그인해 쓰는 UI라 Google 계정 인증이 더 강하고 단순하다.
4. **형태 = HtmlService 단일 페이지 콘솔.** Apps Script 프로젝트 하나가 콘솔 HTML을 서빙하고, `google.script.run`으로 서버 함수(시트 읽기/쓰기) 호출. 공개 랜딩과 **완전 독립**(별도 URL) — 프로젝트 CLAUDE.md §5(관리자 기능은 공개 랜딩에 미포함) 준수.
5. **웹 게시 순서 = 콘솔 배포 → 커스텀 도메인 → 유료 이전 준비.** 콘솔은 공개 사이트와 독립이라 이후 도메인 연결·유료 이전에 영향받지 않음. 콘솔이 데이터를 전부 Sheets로 모으므로, 유료 이전 시 "Sheets → 진짜 DB export" 단일 경로만 남는다.

## 아키텍처

```
[운영자 브라우저]
     │  Google 로그인 (액세스: 나만)
     ▼
[BSL_admin  Apps Script 웹앱]  ── HtmlService 콘솔 SPA + google.script.run 서버함수
     │
     ├── openById(BSL_market)   → 주간-초안 · 서재 · 대시보드-수동(신설) 탭 읽기/쓰기
     └── openById(BSL_analytics)→ 방문로그 탭 읽기(집계)
```

- **BSL_admin** = 신규 Apps Script 프로젝트(standalone 권장 — 특정 시트에 bound 안 되게, 두 시트를 `openById`로 접근). 스크립트 속성에 `MARKET_ID` / `ANALYTICS_ID` 저장(하드코딩 금지, 전역 CLAUDE.md 규칙).
- 콘솔은 기존 3개 웹앱(market/analytics/mailer)을 **대체하지 않는다** — 그것들은 로봇·비콘·메일 파이프의 자동 엔드포인트로 유지. 콘솔은 사람이 쓰는 별도 관리 레이어.

## 4개 모듈 (탭)

콘솔 = 좌측 nav 4개 섹션. 전부 기존 시트를 소스로 하며, 지금 손으로 하는 시트 작업을 UI로 대체한다.

### ① 주간 초안 승인 (BSL_market · 주간-초안 탭)
현재 가장 아픈 수작업(W29·W30 혼재, ~100행 누적 정리)을 정조준.
- 스키마: `분야·발행주·유형·제목ko·제목en·한줄ko·한줄en·밸류체인·출처URL·선행도·status`
- 기능: 발행주·분야별 필터 → draft 행 목록 → **status draft→approved 토글**, 유형=headliner 지정, **옛 주 draft 일괄 삭제**(한 주 통으로 승인 후 정리하는 운영 규율을 버튼화).
- 게이트 성격 보존: 승인은 여전히 사람 판단. 콘솔은 그 판단을 빠르고 안전하게 만들 뿐(자동 승인 없음).

### ② 대시보드 수동 카드 (BSL_market · 대시보드-수동 탭 = 신설)
현재 `public/assets/data/valuechain_manual.json`(레포 파일)이라 편집에 git commit이 필요 → **시트 탭으로 이관**해 콘솔이 GitHub API 없이 편집.
- **구현 시 채택안(dashboard.js 무변경):** 렌더 경로는 그대로 두고, 기존 대시보드 크론 `fetch_dashboard.py`가 `대시보드-수동` 탭 CSV(env `DASH_MANUAL_CSV`)를 읽어 `valuechain_manual.json`을 **재생성**한다. 기존 파이프 패턴(Action이 시트→repo JSON 생성, 사이트는 JSON만 읽음)에 맞고, `dashboard.js`를 전혀 건드리지 않아 더 안전. `DASH_MANUAL_CSV` 미설정 시 재생성 안 함(기존 JSON 보존 = fail-safe). 나머지 3모듈도 사이트 코드 변경 0.
- 시트 스키마: `카드키·라벨·단위·주기·출처·시각·값`(카드키로 그룹, 행 순서 = 시계열). 기능: DRAM 계약가 지수 등 분기 점 한 개씩 추가/삭제. 분기 1회 작업.

### ③ 서재 업로드 (BSL_market · 서재 탭)
2026-07-20에 이미 "시트 행 추가 = 업로드" 경로가 라이브 → 그 행 추가를 **폼 UI**로 대체.
- 스키마: `id·유형(report/note)·분류·발행일·제목·요약·태그·본문·access`
- 기능: 리포트/노트 작성 폼 → append. 본문(마크다운) 인라인. IonQ 에너지 리포트 같은 정리본을 붙여넣기 한 번으로 게시.

### ④ 방문 통계 (BSL_analytics · 방문로그 탭 · 읽기 전용)
- analytics/Code.gs의 집계 로직 재사용: 페이지뷰(행 수), 순방문(방문자ID 고유 수).
- 기능: 기간별 추세 + 페이지별 분포 표. `/beacon-test` 등 테스트 행 삭제 버튼(현 잔여 수작업 흡수).

## 파이프라인 토글 (전역 CLAUDE.md §15)

콘솔 상단에 **기존 `briefing_enabled` 토글**을 노출(🟢 실행 중 / 🔴 중지됨). 파이프는 이미 이 토글로 early-exit하므로 신규 구현 불필요 — 콘솔은 그 스위치를 눈에 띄는 곳에 올리기만 한다. ⚠️ 이 토글은 BSL 일일 메일까지 멈추는 전체 스위치라, 의미를 라벨에 명시.

## 구현 순서 (다음 세션)

1. `admin/Code.gs` + `admin/index.html`(HtmlService) 스캐폴드 — 로그인 게이트(`Session.getActiveUser` allowlist) + 4탭 셸.
2. 모듈 ① 주간 초안 승인 (읽기 → 토글 → 삭제). 실데이터로 W29/W30 정리까지 검증.
3. 모듈 ③ 서재 업로드 폼.
4. 모듈 ④ 방문 통계 (읽기 전용, 가장 단순).
5. 모듈 ② 대시보드 수동 — `dashboard.js` 무변경. `fetch_dashboard.py`가 `대시보드-수동` CSV→`valuechain_manual.json` 재생성(위 채택안).
6. 파이프라인 토글 노출.
7. 배포: 새 배포 → 웹 앱 → 실행: 나, **액세스: 나만** → URL 북마크(공개 링크 아님).

> **구현 완료(2026-07-20):** 위 1~6 코드 전부 작성·문법/기능 검증 통과. 산출물 = `admin/Code.gs`·`admin/index.html`·`admin/README.md`(설치·배포 안내) + 파이프 배선(`scripts/lib/toggle.py`, `fetch_dashboard.py` 재생성, `fetch_weekly.py`·`fetch_market.py` 가드, 워크플로 env). **남은 것 = 사용자 셋업**: (a) `대시보드-수동` 탭 신설, (b) BSL_admin 프로젝트에 두 파일 붙여넣기·스크립트 속성·배포(액세스: 나만), (c) `settings`/`대시보드-수동` 탭 CSV 게시 → Actions Secret `SETTINGS_CSV`/`DASH_MANUAL_CSV`. 상세는 `admin/README.md`.

## 통과 기준

- 콘솔 URL이 본인 Google 계정에서만 열림(타 계정·비로그인 차단 확인).
- 4모듈 각각 실제 시트에 읽기/쓰기 반영 확인. 특히 ①이 현 W29/W30 혼재를 통으로 정리.
- 공개 랜딩·기존 3웹앱·로봇 파이프 무손상(콘솔은 순수 추가).
- 비밀값·시트ID 하드코딩 없음(스크립트 속성).

## 결정/제약 메모

- **임시 스택 선언**: Apps Script + Sheets는 유료 이전 전까지의 관리 레이어. 유료 이전 시 콘솔·시트를 진짜 백엔드/DB로 대체하고 폐기. 지금 스키마를 명확히 두는 것이 이전 비용을 낮춘다.
- 콘솔은 수집·발송을 **하지 않음**(순수 관리 UI) — 전역 §15 토글 대상은 파이프 자체이고, 콘솔은 그 토글을 노출만.
- 이후 Phase(범위 밖): 유료 구독자 로그인·결제·회원 DB, 커스텀 도메인 연결, 다중 운영자(allowlist 확장 or 도메인 제한).
