# 검색 유입 + 애드센스 전제 — 로드맵

> 작성 2026-09-14. **로드맵 단계이며 구현 전이다.** 착수 순서와 각 단계의 검증 방법을 정한다.
> 이 문서의 "현재 상태" 값은 전부 2026-09-14 저장소 실측이다. 추정치가 아니다.
>
> 출발점은 "brevislab.com 을 애드센스 수익화 사이트로 운영할 수 있는가" 였다. 답은
> "지금 구조로는 불가, 전제 작업을 끝내면 가능" 이고, 그 전제 작업이 handoff 5번 13항
> (검색 기반 유입)과 같은 작업이라 하나의 로드맵으로 묶었다.

## 1. 왜 하는가

사이트가 "메일 랜딩" 이다. 소비 지점은 메일이고 사이트는 구독 전환용이다. 애드센스는
사이트 페이지뷰에만 붙고 메일에는 붙지 않으므로, 사이트가 "검색으로 들어와 읽는
아카이브" 로 바뀌지 않으면 수익화 대상 트래픽 자체가 없다.

같은 이유로 검색 유입도 0에 가깝다. 아래 실측이 두 문제의 공통 원인이다.

## 2. 현재 상태 (2026-09-14 실측)

| 항목 | 실측 | 영향 |
|---|---|---|
| 정적 텍스트 | `index.html` 의 모든 문장이 `data-i18n` 빈 요소. JS 없이 남는 텍스트는 푸터 이메일과 KO/EN 버튼뿐 | 크롤러가 볼 본문이 없다 |
| 주간 브리핑 본문 | 저장소에 없음. `script.js:910` 이 docs.google.com 게시 CSV 를 런타임 cross-origin fetch | JS 실행 + 외부 fetch 완료까지 기다려야 보인다 |
| 호별 URL | 없음. `script.js:939-941` 이 최신 호 하나만 렌더. 지난 호는 사라진다 | 콘텐츠가 쌓이지 않는다 |
| 일일 시황 | `market.js:8` 이 시장-일일 CSV 를 런타임 fetch. 날짜별 URL 없음 | 위와 같음 |
| 서재 | 리포트 2건 + 노트 1건. `read.html?r=<id>` 로 클라이언트 렌더 | 페이지 수 3 |
| 필수 페이지 | 개인정보처리방침·소개·연락처 페이지 없음(푸터 mailto 만) | 애드센스 약관상 개인정보처리방침은 의무 |
| 크롤 파일 | robots.txt·sitemap.xml·ads.txt 없음 | — |
| HTML 파일 수 | 9개 (`index` `tech` `finance` `economy` `market` `dashboard` `library` `read` `calendar`) | 심사관 기준 "본문 있는 페이지" 는 6개 남짓 |
| 배포 | `deploy-pages.yml` — main push 시 `inject_weekly_release_csv.py` 로 CSV URL 주입 → `public/` 업로드. 빌드 단계 없음 | 프리렌더 단계를 여기에 끼운다 |

콘텐츠 정책 쪽은 문제가 없다. 금융 콘텐츠는 금지 대상이 아니고, 투자조언 금지·면책이
이미 있으며, LLM 초안 + 사람 선별 구조는 허용 범위다(단 소개 페이지에 편집 과정을 적는다).

## 3. 성공 기준

전체 로드맵의 종료 조건. 각 단계의 검증은 §4 에 있다.

```
□ 모든 공개 페이지가 JS 없이 본문 텍스트를 담는다 (curl 로 태그 제거 후 확인)
□ 주간 호·일일 시황·서재 리포트에 영구 URL 이 있고 sitemap.xml 에 실린다
□ 소개(편집 과정·연락처 포함)·개인정보처리방침 페이지가 있고 모든 페이지 푸터에서 링크된다
□ Search Console 에 색인된 페이지 수가 아카이브 생성 전보다 늘었다 (Phase 0 기준선 대비)
□ 관리자 콘솔 ④ referrer 에 google 유입이 관측된다
□ 애드센스 심사 통과 → 아카이브 페이지에만 광고가 뜨고 랜딩에는 안 뜬다
```

## 4. 단계별 계획

순서가 곧 우선순위다. Phase 1 은 작고 지금 해도 되며, Phase 3 이 본체다.

### Phase 0 — 기준선 (반나절)

측정 없이 시작하면 §3 의 "늘었다" 를 증명할 수 없다.

- Google Search Console 에 brevislab.com 등록. 소유확인은 DNS TXT (Cloudflare 에 이미
  google-site-verification 이 있다 — Workspace 용이라 Search Console 에서 재사용되는지 확인).
- 현재 색인 페이지 수·노출·클릭을 기록한다(이 문서 §7 에 적는다).
- 관리자 콘솔 ④ 유입 경로 현황을 기록한다.

검증: §7 에 날짜 붙은 숫자가 들어간다.

### Phase 1 — 필수 페이지 + 크롤 기본 (1일, 애드센스와 무관하게 지금 가능)

새 파일 4개, 기존 HTML 9개의 푸터에 링크 2개 추가.

| 파일 | 내용 |
|---|---|
| `public/about.html` | 무엇을 하는 서비스인지, **편집 과정**(1차 소스 수집 → LLM 초안 → 사람 선별 → 투자판단 표현 가드 → 발행), 운영자 연락처(이메일) |
| `public/privacy.html` | 구독 폼에서 받는 이메일의 목적·보관·수신거부 방법, 방문 기록 비콘(localStorage 익명 ID, 쿠키·PII 없음 — `script.js:1152` 실측), **제3자 광고 쿠키 고지 자리**(Phase 6 에서 채운다) |
| `public/robots.txt` | 전체 허용 + sitemap 위치 |
| `public/sitemap.xml` | 정적 8 + 신규 2 = 10. `read.html` 은 `?r=` 없이는 빈 페이지이고 canonical 이 `read.html` 이라 넣지 않는다(Phase 4 정적 서재 페이지가 대신한다). Phase 3 부터는 빌드가 생성한다 |

- 두 페이지의 **본문(`<main>`)은 `data-i18n` 없이 KO 정적 HTML** 이다. EN 은 후순위다.
  헤더·푸터는 기존 페이지와 같은 `data-i18n` 마크업이되 KO 텍스트를 미리 채운다 — JS 가
  같은 값으로 덮어쓰므로 동작은 같고, JS 없이도 내비·링크 텍스트가 남는다.
- 푸터 링크는 `.footer__meta` 의 오른쪽 span 하나에 소개 · 개인정보처리방침 · mailto 를 묶는다
  (flex 항목 수를 늘리지 않아 새 CSS 가 필요 없다). 링크 텍스트는 `site.js` `UI.footer.about/privacy`
  로 EN 토글을 따른다.
- 랜딩 서비스 정의(`site.js` 의 `what.*`)와 소개 페이지 문구가 어긋나지 않게 한다.
- 개인정보처리방침의 사실 관계는 코드에서 확인한 것만 적는다 — 구독 폼(`SUBSCRIBE_FORM`: 이메일·
  동의), 방문 비콘(`logVisit` → `analytics/Code.gs`: KST 일시·페이지·referrer·localStorage 익명 ID,
  쿠키·IP 없음), 수신거부 2단계, 해시 토큰. 광고 항목은 "현재 없음" 으로 두고 Phase 6 에서 갱신한다.

검증:
- `tests/test_footer_links.js` — 11개 HTML 전부의 푸터에 두 링크가 정적 텍스트로 있다, 두 페이지
  `<main>` 에 `data-i18n` 이 없고 본문이 1,000/1,500자 이상이다, robots/sitemap 이 정합하다.
- `curl -s https://brevislab.com/about.html | sed 's/<[^>]*>//g'` 에 본문이 있다(배포 후).
- Search Console URL 검사에서 두 페이지가 "색인 생성 가능"(배포 후).

### Phase 2 — 랜딩·카테고리 페이지 KO 프리렌더 (1~2일)

`data-i18n` 요소를 빌드 시점에 KO 텍스트로 채운다. JS 는 지금처럼 다시 덮어쓰므로
동작·EN 토글은 그대로다.

- `scripts/prerender_i18n.js` (Node — 테스트가 이미 Node 라 새 런타임이 아니다):
  `site.js`·`content/*.js` 의 사전을 읽어 `public/*.html` 의 `data-i18n` / `data-i18n-html`
  요소에 KO 문자열을 넣은 사본을 만든다.
- `deploy-pages.yml` 의 inject 단계 뒤에 실행한다. **저장소 파일은 건드리지 않는다** —
  배포 사본만 바꾼다(inject 와 같은 원칙).
- `.reveal` 은 `.js .reveal { opacity: 0 }` 이라(`style.css:536`) JS 가 없으면 보인다 —
  프리렌더 텍스트가 숨겨질 위험은 없다.

검증:
- `tests/test_prerender_i18n.js` — 픽스처 HTML 에 사전을 적용하면 빈 요소가 0개.
- 빌드 산출물 `index.html` 에서 태그를 걷어낸 텍스트 길이가 현재 값(수십 자)에서 수천 자로 는다.
- 기존 JS 테스트 전부 통과(`node --test tests/`).
- 라이브에서 JS 끄고 랜딩을 열어 본문이 보인다.

### Phase 3 — 주간 브리핑 아카이브 (본체, 3~5일)

호별 영구 URL 을 정적 HTML 로 만든다. 최신 호를 그리는 `tech/finance/economy.html` 은
지금처럼 두고(런타임 fetch), **아카이브만 빌드 산출물**로 더한다.

```
public/weekly/index.html              호 목록
public/weekly/<issue_key>/index.html  호 하나 = 분야별 섹션(헤드라이너·신호·딥다이브)
```

- `scripts/build_weekly_archive.py` — `WEEKLY_RELEASE_ITEMS_CSV`(Secret) 를 읽어
  **published 행만** 호·리비전·분야로 묶어 HTML 을 쓴다. 딥다이브는
  `WEEKLY_DEEPDIVE_CSV` 를 (issue_key, revision, 출처URL) 로 조인 — `script.js` 와
  같은 규칙이다. 리비전은 호당 최신 하나만 그린다.
- sitemap.xml 도 이 스크립트가 생성한다(Phase 1 의 정적 sitemap 을 대체).
- 템플릿은 `style.css` 를 그대로 쓰고 헤더·푸터는 기존 페이지와 같다. KO 정적, EN 없음.
- **생성 파일은 저장소에 커밋하지 않는다.** 아티팩트에만 있다. CSV 가 source of truth 이고,
  매 빌드가 전체를 다시 만든다(호가 수십 개여도 CSV 한 번 읽기다). Actions 자동 커밋과의
  rebase 충돌을 하나 더 만들지 않기 위해서다.

재빌드 트리거 — 발송 뒤에 빌드가 한 번 더 돌아야 그 주 호가 아카이브에 들어간다.
`deploy-pages.yml` 은 지금 push 전용이다.
- `weekly-send.yml` 완료 시 `workflow_run` 으로 `deploy-pages.yml` 을 발화한다. 딥다이브가
  게이트에 물린 것과 같은 패턴이다. Apps Script 09:00 트리거가 실제 발송자이고
  weekly-send 는 1~2시간 뒤 no-op 백스톱이지만, 그 시점에는 원장이 이미 published 라
  빌드가 그 호를 집는다.
- 메일러(Apps Script)는 건드리지 않는다. dispatch 메커니즘(`GH_DISPATCH_TOKEN`)이 있지만
  함수 단위 수동 배포가 필요한 경로라 쓰지 않는다.
- 발송 시각 4곳 연동(weekly-send·weekly-release·sendWeekly 트리거·알림 3개)은 **손대지
  않는다.** 빌드는 발송 뒤에 붙을 뿐이다.

유출 방지 — 채점(월 06:00)과 발송(월 09:00) 사이에 push 가 나면 빌드가 돌지만, published
필터가 미공개 호를 걸러낸다. 사이트 조인과 같은 규칙이라 새 위험이 아니다.

게시 CSV 엣지 캐시 — 같은 URL 이 옛 스냅샷을 번갈아 준다(handoff 6번 실측). 빌드가 한
번 읽고 끝내면 최신 호가 빠질 수 있다. 여러 번 받아 `updated_at` 최대인 응답을 취한다.

검증:
- `tests/test_build_weekly_archive.py` — 픽스처 CSV 로 (a) published 만 그려진다, (b) 같은
  호의 리비전은 최신 하나, (c) 딥다이브 조인이 헤더 대소문자와 무관하게 성립,
  (d) 캐시 스냅샷 3개 중 `updated_at` 최대를 취한다.
- 빌드 로그에 **생성 호 수**를 찍는다. 0 이면 WARNING 이다(전역 §18 — 파싱 0건을
  성공으로 넘기지 않는다).
- 라이브에서 `weekly/<지난 호>/` 가 열리고 JS 없이 본문이 있다.
- 다음 월요일 발송 뒤 그 호가 아카이브에 자동으로 들어온다 — **첫 회차 성공은 검증이
  아니다.** 2주 연속 확인한다.
- 소급 범위는 발행항목 시트에 published 로 남은 호 수만큼이다(몇 호인지 미확인 — 빌드
  로그로 안다).

### Phase 4 — 일일 시황·서재 정적화 (2~3일)

같은 빌더 패턴을 두 곳에 더 적용한다.

일일 시황 — `public/market/<YYYY-MM-DD>.html`. 시장-일일(gid 0)·시장-본문(603388577)
CSV 에서 날짜별로 만든다. `market-data.yml` 이 매일 데이터를 커밋하므로 push 트리거로
재빌드가 이미 매일 돈다 — 새 트리거가 필요 없다. 다만 시황 본문이 시트에 써지는 시점과
커밋 시점의 순서, 그리고 엣지 캐시 때문에 **당일 페이지가 다음 날 빌드에서야 들어올 수
있다.** 하루 지연은 허용한다(아카이브 목적이지 당일 배포가 아니다).

서재 — `public/library/<id>.html`. 서재 탭 인라인 본문 또는 `.md` 파일을 빌드 시 HTML 로
바꾼다. 클라이언트는 CDN `marked@12.0.2` 로 렌더한다(`read.html`) — 빌드에서 같은 `marked`
를 Node 로 쓰면 결과가 클라이언트와 같아진다(패키지 추가는 사전 고지 후). Python 에 최소
변환기를 두는 대안은 리포트 2건(45KB·62KB)에 표·인용이 섞여 있어 권하지 않는다. `read.html?r=<id>` 는 그대로 두고 정적 페이지로 301 대신 링크만
바꾼다(GitHub Pages 는 서버 리다이렉트가 없다).

검증: Phase 3 과 같은 패턴 — 픽스처 테스트, 생성 건수 로그, JS 없이 본문 확인.

### Phase 5 — 유입 관측 게이트 (4주 이상, 기다리는 단계)

애드센스 신청 조건이다. 수치는 Phase 0 기준선을 본 뒤 정하되 **제안값**은 아래다.

```
□ Search Console 색인 페이지 ≥ 20 (아카이브 포함)
□ 검색 클릭이 4주 연속 0 이 아니다
□ 관리자 콘솔 ④ 에 google referrer 가 있다
```

이 기간에 콘텐츠 쪽 할 일은 없다 — 매주 호가 쌓이는 것 자체가 콘텐츠다. 기다리는
동안 handoff 의 유통 항목(공개 채널 빈도·링크 목적지)을 진행한다.

### Phase 6 — 애드센스 신청·설정 (심사 대기 포함)

- 신청 → `<head>` 소유확인 스니펫. 빌드 템플릿 한 곳에 넣으면 아카이브 전 페이지에 들어간다.
  정적 9개는 각각 넣는다. `public/ads.txt` 추가.
- 심사 기간은 Google 이 고정하지 않는다. 거절되면 사유를 이 문서 §7 에 적고 고친 뒤 재신청한다.
- 승인 뒤:
  - **광고 배치 원칙** — 아카이브(`weekly/` `market/` `library/`)에만. 랜딩(`index.html`)과
    구독 CTA 가 있는 페이지는 제외한다. BSL/CLAUDE.md 가 "병목은 전환" 이라 못박은 상태에서
    전환율을 깎지 않기 위해서다.
  - EEA/UK 방문자용 동의 배너 — 애드센스 콘솔 "개인정보 보호 및 메시지" 의 Google 인증 CMP.
    한국 사이트라도 EEA 방문자에게 광고를 띄우면 필수다.
  - `privacy.html` 에 제3자 광고 쿠키 고지를 채운다(Phase 1 에서 자리만 만든 것).
  - 민감 카테고리 차단 — "금융" 을 차단할지는 §6 의 결정 사항이다.

검증: 광고가 아카이브 페이지에서만 보인다(랜딩에서 0). CMP 는 EEA 위치로 시뮬레이션한다.

## 5. 제약

- 저장소가 public 이라 CSV URL 은 배포 사본에만 주입한다(기존 `inject` 원칙). 빌더도
  Secret 에서 읽고, 생성 HTML 은 커밋하지 않는다.
- Python 빌더는 stdlib 만 쓴다(`fetch_dashboard.py` 와 같은 원칙). 외부 라이브러리가
  필요해지면 사전 고지 후 진행한다.
- `mailer/Code.gs` 는 이 로드맵에서 수정하지 않는다. SALT·CFG 를 건드릴 경로를 만들지 않는다.
- 발송 시각과 4곳 연동은 손대지 않는다.
- 애드센스는 1년 후 유료 구독 계획을 대체하지 않는다. 유료 도입 시 광고를 거둘지는 그때 정한다.
- 수치는 실측만 적는다. 애드센스 수익 예상치는 근거가 없으므로 적지 않는다.

## 6. 열린 결정 (착수 전 확인)

| # | 결정 | 추천 | 이유 |
|---|---|---|---|
| 1 | 아카이브 언어 | KO 정적, EN 없음 | EN 은 런타임 토글이라 프리렌더 대상이 아니다. 검색 유입은 KO 가 목표다 |
| 2 | 생성 페이지 커밋 여부 | 커밋하지 않음(아티팩트 전용) | Actions 자동 커밋과의 rebase 충돌을 늘리지 않는다 |
| 3 | 주간 재빌드 트리거 | `workflow_run` on weekly-send | 메일러 수정 없음. 딥다이브와 같은 패턴 |
| 4 | Phase 5 게이트 수치 | §4 제안값 | Phase 0 기준선 뒤 확정 |
| 5 | 금융 광고 카테고리 차단 | 차단 | 면책 원칙과 시각적으로 충돌한다. 단가 하락은 감수 |
| 6 | 광고 배치 | 아카이브 전용 | 랜딩 전환율 보호 |

## 7. 실행 기록

| 날짜 | 내용 |
|---|---|
| 2026-09-14 | 로드맵 작성. Phase 0 기준선 미기록 |
| 2026-09-14 | **Phase 1 완료 — 커밋 a690f77, 라이브 배포 확인.** `about.html`(본문 1,600자) · `privacy.html`(1,819자) · `robots.txt` · `sitemap.xml`(10 URL) 신규. 9개 HTML 푸터에 소개·개인정보처리방침 링크, `site.js` `UI.footer.about/privacy` 추가. `tests/test_footer_links.js` 신설 → JS 24/24 통과, `test_inject_weekly_release_csv.py` 통과, sitemap XML well-formed. 라이브: 4개 파일 HTTP 200, `about.html` 이 JS 없이 본문을 담고, 랜딩 푸터에 두 링크가 있으며 sitemap `<loc>` 10개. **남은 검증: Search Console URL 검사(Phase 0 등록 뒤).** 발견: `public/library.html.bak` 이 Pages 에 그대로 배포되고 있다(이번 범위 밖, 정리 대상) |
