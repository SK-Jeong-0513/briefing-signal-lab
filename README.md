# Briefing Signal Lab

기술·금융·경제 신호를 매일 선별해 하나의 브리핑으로 제공하는 구독형 플랫폼. 현재는 일일 시황·주간 브리핑·스페셜 리포트를 **전부 무료**로 발송하며, 약 1년간 운영·개선 후 유료 구독 도입을 검토한다.

정적 사이트(HTML/CSS/JS, 빌드 도구 없음). **GitHub Pages + GitHub Actions 자동배포.**
라이브: **https://brevislab.com** (커스텀 도메인·HTTPS). 배포 소스=`sk-jeong-0513.github.io/briefing-signal-lab`.
운영: 반자동 주간 파이프(로봇 크롤+LLM 초안 → 운영자 콘솔 승인 → 사이트) + 시장 일일·대시보드·경제캘린더 자동화 + 운영자 관리자 콘솔(`admin/`, 별도 BSL_admin Apps Script).

## 구조

배포 대상은 `public/`만. (`.git`, README 등은 배포 제외 — Actions가 `public/` 업로드)

```
public/index.html          랜딩 (샘플 3카드 대표 + 카테고리 진입 칩)
public/tech.html           기술 브리핑 페이지 (분야 메뉴 + 주간 다이제스트/헤드라이너 + 유료 분야 구독)
public/finance.html        금융 브리핑 페이지
public/economy.html        경제 브리핑 페이지
public/calendar.html       경제 캘린더 (격자/리스트, 지역·분류·영향도 필터)
public/assets/style.css    디자인 토큰 + 레이아웃
public/assets/script.js    KO/EN 토글, 동적 렌더, 캘린더 모듈, 시트 로더
public/assets/content/tech.js       기술: 주간·분야 모델(TECH_DOMAINS, TECH_WEEKLY) + 랜딩용 BRIEFINGS_TECH 파생
public/assets/content/finance.js|economy.js   카테고리별 브리핑 데이터(BRIEFINGS_*, 일간 flat)
public/assets/content/site.js       UI 카피·각 페이지 i18n·SUBSCRIBE_FORM·LINKS·시트 CSV URL(주간/서재/방문) + BRIEFINGS 합치기
public/assets/data/quotes.json      일일 메일 '주요 시장 지표' 스냅샷(fetch_dashboard.py 생성, 21개 2열 11행)
public/assets/content/calendar.js   캘린더 이벤트(CAL_EVENTS) + 구글 시트 URL(CAL_SHEET_URL)
```

- 기술·금융·경제 주간 이슈는 `renderWeekly(cfg)` 하나가 공용 렌더. 기술=`data-tech-menu`+`data-tech-weekly`, 금융=`data-finance-menu`+`data-finance-weekly`, 경제=`data-economy-weekly`(단일 매크로). 분야 칩 전환은 `data-weekly-domain`.
- 경제 캘린더는 `CAL_SHEET_URL`(구글 시트 웹게시 CSV)이 있으면 시트가 소스, 없으면 `CAL_EVENTS` 샘플.

콘텐츠 추가/수정과 브랜치→배포 절차는 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

## 로컬 확인

`public/index.html`을 브라우저로 열면 됩니다. 서버 불필요.

## 수정 후 배포

`public/assets/content/`의 데이터를 수정하고 `git push` → GitHub Actions가 자동 배포합니다.

- 구독: `public/assets/content/site.js`의 `SUBSCRIBE_FORM`(구독 전용 폼 id·entry). 유료 문의 링크만 `LINKS.paidForm`.

## 랜딩 구독 안내 개편 (2026-08-18)

일일 시황·주간 브리핑·스페셜 리포트가 전부 무료 구독자에게 나가는데 랜딩은 여전히 유료 전제로 쓰여 있었다. 일부는 사실과도 달랐다 — 비교표가 '이메일 발송'을 유료 전용으로 적고 있었다.

- **멤버십 섹션**: 2열 비교표 → 무료 카드(받는 것 7가지 전부 체크) + 유료 카드(그레이 로드맵)
- **강조를 뒤집었다**: primary 테두리·그림자가 유료 쪽에 있었는데, 지금 실제로 쓸 수 있는 쪽은 무료다. 유료는 `canvas` 배경 + 점선 + `muted`로 가라앉혔다
- **샘플 카드 배지**: 자물쇠 + "전체 브리핑은 유료 구독" → 메일 아이콘 + "전체 브리핑은 무료 구독 메일로". 전부 무료인데 카드마다 잠금이 붙어 있으면 정반대 신호다
- 히어로·하단 CTA·메타 설명(og·twitter 포함 3곳)도 무료 기준으로 교체. 메타는 검색·SNS 공유의 첫인상이라 함께 고쳤다

**⚠️ 유료 카드에 기능 목록을 적지 않는다.** 무엇을 유료로 할지 아직 정해지지 않았고, 지금 무료로 주는 항목을 유료 칸에 옮겨 적으면 왼쪽 카드와 정면으로 모순된다(옛 비교표가 정확히 그 상태였다). 도입 시점과 사전 안내 약속만 적는다.

**⚠️ 유료 CTA는 링크가 비면 `<a>`가 아니라 `<span aria-disabled="true">`로 그린다.** 옛 결함이 "유료 문의를 눌렀더니 브리핑과 무관한 컨설팅 설문이 열린다"였으므로, 갈 곳이 없을 때는 클릭도 탭 이동도 되면 안 된다. `LINKS.paidForm`에 URL을 넣으면 그대로 진짜 버튼이 된다 — 약 1년 뒤 유료 전환 시 그 한 줄이면 복구된다.

## 엔진 응답 검증 (2026-08-18)

`gemini-2.0-flash` EOS를 `3.5-flash`로 교체했더니 **더 나쁜 실패**가 나왔다. 추론 토큰을 쓰는 모델이라 `max_tokens`를 사고 과정에 써버리고 답변은 꼬리만 22~41자 남겼고, `Draft 1:` 같은 자기 초안 조각이 종목 카드에 그대로 실렸다. 404는 게이트가 잡았지만 절단된 쓰레기는 통과했다.

구멍이 두 층이었다.

- `ai.chat()`이 **"비어 있지 않으면 성공"**으로 처리 → `min_chars` 인자 추가. 기대보다 짧으면 다음 엔진으로 넘긴다(`fetch_market` 80 · `prepare_weekly_release` 60)
- `fetch_market.py`가 **JSON 파싱 실패 시 원문을 그대로 요약에 저장** → 이게 실제 오염 경로다. 파싱 실패 = 생성 실패이므로 버린다
- `fetch_weekly.py`는 정상적인 "해당 없음"이 `[]` 2자라 길이로 구분할 수 없어 **배열 유무**를 본다. 빈 배열(정상)과 배열 없음(실패)이 같은 `후보 0건`으로 찍혀, gemini가 맡은 7개 도메인이 통째로 빈 것이 안 보였다

**`ai.py --test`가 엔진을 하나씩 친다.** 예전에는 `chat()`을 한 번 부르고 끝내 주력이 답하는 순간 통과라 폴백 고장이 구조적으로 안 보였다 — gemini 404가 몇 주간 숨은 이유다. 검수 게이트는 생성 엔진을 제외하므로 폴백만 남는 경로가 실제로 있다.

**모델 id는 `GEMINI_MODEL` 워크플로 env다**(기본 `gemini-3.5-flash-lite`). EOS는 또 오므로 코드 배포 없이 바꾼다.

**종목 카드 중복**: 국내 종목코드는 6자리인데 시트가 숫자로 인식해 앞자리 0을 떨어뜨린다(`005930` → `5930`). 옛 행과 새 행의 중복 제거 키가 갈려 7월 카드가 8월 카드와 나란히 떴다. 숫자 코드는 6자리로 채워 키를 만든다.

## 지표 대시보드 확장 (2026-08-18)

관계 페어를 6→12개로, 미 섹터 카드 11개를 새 섹션으로 추가했다. 요청 14개 중 3개(미 채권금리↔지수·MSCI 한국·국내 수출)는 이미 있었고, 4개(수급·외국인·공매도·시간대별 거래량)는 데이터 소스가 없거나 일봉 모델이 아니라 보류했다.

| 신규 페어 | 좌축 | 우축 드롭다운 |
|---|---|---|
| M2 통화량 ↔ 주가지수 | FRED `WM2NS` | S&P500 · 나스닥 |
| 은행 준비금 ↔ 주가지수 | FRED `WRESBAL` | S&P500 · 나스닥 |
| 금 ↔ 비트코인 | `GC=F` | `BTC-USD` |
| WTI ↔ 미 국채금리 | `CL=F` | `DGS2` · `DGS3` · `DGS10` |
| 거래량 (한국 ↔ 선택) | KOSPI 20일평균 대비 | 미국 거래량 · KOSPI · S&P500 · 나스닥 |
| 시장폭 ↔ 미국 지수 | `RSP/SPY` | S&P500 · 나스닥 · 다우 |

- **FRED가 새 소스**다(API 키 불필요). 요청받은 `M2SL`·`TOTRESNS`는 월별·발표지연 78일이라 같은 개념의 주간판(`WM2NS`·`WRESBAL`, 지연 43일/6일)으로 바꿨다. 국채 3년물은 Yahoo에 지수 심볼이 없어(404) FRED가 유일한 경로다.
- **⚠️ FRED는 `Accept` 헤더가 없으면 연결을 끊는다.** 20초 매달렸다 실패해 네트워크 문제처럼 보이는데 헤더 한 줄이면 0.2초에 200이 온다. `_get_text()`에 박아뒀다.
- **⚠️ FRED는 전체 역사를 준다**(`DGS10`은 1962년부터 16,140행). `_range_days()`로 `RANGE` 창에 맞춰 자르지 않으면 파일이 1,134KB로 불어난다.
- **거래량은 정규화해서 담는다.** Yahoo의 KOSPI 거래량은 천주, 미국은 주 단위로 와 약 1000배 차이가 난다. 원본을 겹치면 한국 선이 바닥에 붙는다.
- **시장폭은 비율로 담는다.** RSP와 SPY를 좌우축에 나란히 두면 이중축이 각자 자동 스케일링해 두 선이 포개져 발산이 안 보인다.
- **섹터는 페어가 아니라 카드다.** "어느 섹터가 앞서나"는 2계열 오버레이로 볼 수 없다. `vcCard`를 재사용하며, 카드는 마지막 90개만 읽으므로(`spark()`의 `slice(-90)`) 섹터 시리즈는 90일치만 저장한다.
- 용량 266KB → **434KB**(gzip 67 → 111KB). 저장소 이력은 델타 압축이 먹어 비문제다.
- 한 페어 안에서 데이터 소스를 섞지 않는다 — FRED(1~4일 지연)와 Yahoo(당일)를 같은 드롭다운에 두면 옵션을 바꿀 때마다 차트 끝 날짜가 달라진다.

### 수집 실패를 보이게

페어가 죽어도 fail-safe로 직전 데이터가 남아 화면은 멀쩡해 보인다. 배포는 계속하되(수집 실패로 배포를 막으면 멀쩡한 나머지 지표까지 낡는다) 흔적을 남긴다.

- `fetch_dashboard.py`가 마지막 줄에 `SCORE 페어 N/M · 섹터 X/Y`를 찍고 **워크플로가 커밋 제목에 넣는다** → 매일 남는 커밋 이력만 훑어도 언제부터 틀어졌는지 날짜가 잡힌다
- `dashboard.json`의 `coverage` 필드를 화면 하단이 읽어 **결손이 있을 때만** `지표 9/12(일부 출처 지연)`를 표시한다
- 워크플로에 `set -o pipefail` — `tee`가 종료코드를 삼켜 스크립트 크래시가 초록불이 되는 것을 막는다
- 이 장치가 **첫 실행에서 바로 FRED 5개 누락을 잡았다**(위 `Accept` 헤더 문제)

검증: 로컬 실행으로 시리즈 43 · 페어 12/12 · 섹터 11/11 확인 후 커밋(`aee3b4c`). `tests/test_dashboard_pairs.py` 17건 신규.

## 모바일 세로 화면 (2026-08-17)

- **헤더 내비게이션 복구.** 620px 이하에서 `.nav { display: none }`이라 브랜드·언어·구독만 남아 다른 페이지로 갈 방법이 아예 없었다. 헤더를 2단으로 쌓고 링크를 제 줄에 깐다(좁으면 가로 스크롤). 햄버거 대신 링크 줄을 택한 이유는 탭이 한 번 적고 열고 닫는 상태·포커스 트랩이 필요 없어서다.
- **시장 페이지 순서.** 설정 종목 카드가 일일 브리핑보다 앞에 있어 모바일에서 본문이 화면 몇 개 아래로 밀렸다. 순서를 바꾸고 `band--surface`(강조 밴드)는 본문 쪽에 남겨 시각적 주인공도 함께 옮겼다.
- 둘 다 **데스크톱 확인만으로는 못 잡는** 종류라 `tests/test_mobile_layout.js`가 잠근다. 8개 페이지 전부의 헤더 nav도 함께 검사한다.
- ⚠️ `style.css`에 `@media (max-width: 620px)` 블록이 **두 개**다. `indexOf`로 첫 개만 보면 엉뚱한 블록을 검사하고 조용히 통과한다.

## 일일 시황 지표 당일 아침 갱신 (2026-07-31)

07:40 KST 일일 메일보다 먼저 최신 미국장 마감 지표를 준비하도록 별도 경량 파이프라인을 추가했다.

- `.github/workflows/daily-quotes.yml`: 평일 06:10 KST에 `python3 scripts/fetch_dashboard.py --quotes-only` 실행
- `quotes.json`: 한국 기준 브리핑 날짜 `briefing_date`와 실제 미국장 기준일 `asof`를 분리
- 메일러: GitHub Pages 캐시를 우회하고 `briefing_date`가 한국 기준 당일이 아니면 전일 지표 블록을 생략
- 표시: `MM-DD 아침 기준 · 미 증시 MM-DD 마감`
- 검증: Python 31건, JS 8개 테스트 파일, YAML 파싱, `git diff --check`, Yahoo 실데이터 21/21 수집 통과
- 반영 커밋: `95c379c` (`main`, 원격 푸시 완료)

⚠️ 저장소의 `mailer/Code.gs`는 운영 Apps Script에 자동 반영되지 않는다. 운영본의 실제 `CFG`를 보존하고 지표 블록만 수동 교체해야 하며, 자세한 절차는 [mailer/README.md](mailer/README.md)를 따른다.

## 구독 경로 (2026-07-28)

랜딩 CTA에서 **이메일 + 수신동의**만 받아 구독 전용 Google Form에 직접 POST한다(새 탭 이동 없음).

- 설정: `site.js`의 `SUBSCRIBE_FORM` — `formId` · `emailEntry` · `consentEntry` · `consentValue`.
- **폴백:** `formId`가 비면 인라인 폼을 숨기고 기존 외부 링크 버튼을 남긴다. 셋 중 하나만 빠져도 폼이 조용히 숨으므로 테스트가 "모두 비거나 모두 채워짐"을 강제한다.
- Forms는 CORS 헤더를 주지 않아 `no-cors`로 보낸다 → 응답을 읽을 수 없어 성공은 낙관 표시한다.
- 무료 구독 버튼(nav·히어로)은 전부 인라인 폼으로 향한다. 폼은 랜딩에만 있어 다른 페이지는 `index.html#subscribe`로 보낸다.
- 같은 브라우저 반복 신청은 `localStorage`로 막는다(메일러가 이메일 기준 dedup하므로 중복 행이 있어도 메일은 한 번만 간다).
- **폼 질문 제목이 곧 응답 시트 열 이름**이며, 질문을 고쳐도 기존 열 제목은 따라오지 않는다. 메일러 `CFG.RESP_COL`은 시트의 **실제 헤더**에 맞춘다.
- 새 색·여백을 만들지 않는다. 스타일은 `DESIGN.md` 토큰만 사용하며 테스트가 새 색상값 0개를 강제한다.

⚠️ `.btn`처럼 `display`를 지정한 클래스는 브라우저 기본 `[hidden]`을 이긴다. JS로 `el.hidden = true`를 걸 요소에는 `[hidden] { display: none }` 규칙을 함께 둘 것.

## 주간 발행 수명주기 (2026-07-27)

주간 초안의 `approved`는 편집 승인이고 공개 상태가 아니다. 공개 사이트와 주간 메일은 `BSL_market`의 발행 원장을 기준으로 한다.

- 일요일 06:00 초안 생성
- 일요일 24:00 수동 마감, 월요일 04:00 조건부 자동 승인
- 월요일 09:00 고정 공개·메일 발송 (2026-08-03 화→월 이동)
- 자동 검수 통과 1건 이상 발행, 0건 `skipped`
- 발행 후 늦은 승인분은 웹판 `rev.2+`로 추가하며 이메일은 재발송하지 않음
- 일일 브리핑 파이프는 별도이며 변경하지 않음

라이브 운영에는 Actions Secret `WEEKLY_DRAFT_CSV`(초안), `WEEKLY_RELEASE_CSV`(발행 원장), `WEEKLY_RELEASE_ITEMS_CSV`(발행항목)가 필요하다. Pages 배포가 발행항목 CSV를 `site.js`의 공개 설정에 주입한다. 메일러는 Apps Script 속성 `WEEKLY_CRON_TOKEN`과 동일한 Actions Secret `WEEKLY_MAILER_TOKEN`, 웹 앱 주소 `WEEKLY_MAILER_URL`을 사용한다. 월요일 09:00 정시 발송은 Apps Script 트리거가 담보하고, `weekly-send.yml`은 백스톱이다(GitHub Actions cron 은 상시 1~2시간 지연된다).

### 운영 검증 현황

- 2026-07-27: `2026-W31 · manual_ready · rev.1` 48건 발행 스냅샷 생성
- 운영자 미리보기 후 운영 모드에서 실제 발송 21명 성공·0명 실패, 최종 상태 `emailed`
- Apps Script 주간 알림 3개와 화요일 20시 보조 발송 트리거 생성; 기존 일일 발송 트리거 유지
- GitHub Actions `Weekly briefing publish and email` 연결 테스트 성공(run `30247525471`)
- `emailed` 호는 이후 GitHub Actions 또는 Apps Script가 다시 호출돼도 재발송하지 않음
