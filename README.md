# Briefing Signal Lab

기술·금융·경제 신호를 매일 선별해 무료 샘플과 유료 전체 브리핑으로 제공하는 구독형 브리핑 플랫폼.

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
public/assets/content/site.js       UI 카피·각 페이지 i18n·LINKS·시트 CSV URL(주간/서재/방문) + BRIEFINGS 합치기
public/assets/content/calendar.js   캘린더 이벤트(CAL_EVENTS) + 구글 시트 URL(CAL_SHEET_URL)
```

- 기술·금융·경제 주간 이슈는 `renderWeekly(cfg)` 하나가 공용 렌더. 기술=`data-tech-menu`+`data-tech-weekly`, 금융=`data-finance-menu`+`data-finance-weekly`, 경제=`data-economy-weekly`(단일 매크로). 분야 칩 전환은 `data-weekly-domain`.
- 경제 캘린더는 `CAL_SHEET_URL`(구글 시트 웹게시 CSV)이 있으면 시트가 소스, 없으면 `CAL_EVENTS` 샘플.

콘텐츠 추가/수정과 브랜치→배포 절차는 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

## 로컬 확인

`public/index.html`을 브라우저로 열면 됩니다. 서버 불필요.

## 수정 후 배포

`public/assets/content/`의 데이터를 수정하고 `git push` → GitHub Actions가 자동 배포합니다.

- 구독/문의 링크: `public/assets/content/site.js`의 `LINKS.freeForm` / `LINKS.paidForm`.
