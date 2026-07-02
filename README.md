# Briefing Signal Lab

기술·금융·경제 신호를 매일 선별해 무료 샘플과 유료 전체 브리핑으로 제공하는 구독형 브리핑 플랫폼의 랜딩 페이지.

정적 사이트(HTML/CSS/JS, 빌드 도구 없음). Cloudflare Pages로 배포.

## 구조

배포 대상은 `public/`만. (`.git`, README 등은 배포에서 제외 — Cloudflare Pages build output directory = `public`)

```
public/index.html              랜딩 마크업 + 시그널 라인 SVG
public/assets/style.css        디자인 토큰 + 레이아웃
public/assets/script.js        KO/EN 토글, 동적 렌더, 스크롤 리빌
public/assets/content/tech.js       기술 브리핑 데이터
public/assets/content/finance.js    금융 브리핑 데이터
public/assets/content/economy.js    경제 브리핑 데이터
public/assets/content/site.js       UI 카피·지표·서재·링크 + BRIEFINGS 합치기
```

콘텐츠 추가/수정과 브랜치→배포 절차는 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

## 로컬 확인

`public/index.html`을 브라우저로 열면 됩니다. 서버 불필요.

## 수정 후 배포

`public/assets/content/`의 데이터를 수정하고 `git push` → GitHub Actions가 자동 배포합니다.

- 구독/문의 링크: `public/assets/content/site.js`의 `LINKS.freeForm` / `LINKS.paidForm`.
