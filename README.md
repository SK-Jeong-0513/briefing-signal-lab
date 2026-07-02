# Briefing Signal Lab

기술·금융·경제 신호를 매일 선별해 무료 샘플과 유료 전체 브리핑으로 제공하는 구독형 브리핑 플랫폼의 랜딩 페이지.

정적 사이트(HTML/CSS/JS, 빌드 도구 없음). Cloudflare Pages로 배포.

## 구조

배포 대상은 `public/`만. (`.git`, README 등은 배포에서 제외 — Cloudflare Pages build output directory = `public`)

```
public/index.html          랜딩 마크업 + 시그널 라인 SVG
public/assets/style.css    디자인 토큰 + 레이아웃
public/assets/script.js    KO/EN 토글, 동적 렌더, 스크롤 리빌
public/assets/content.js   샘플 브리핑 데이터 + i18n 카피
```

## 로컬 확인

`public/index.html`을 브라우저로 열면 됩니다. 서버 불필요.

## 수정 후 배포

`content.js`의 `BRIEFINGS` / `UI` / `LINKS`를 수정하고 `git push` → Cloudflare Pages가 자동 배포합니다.

- 구독/문의 링크: `assets/content.js`의 `LINKS.freeForm` / `LINKS.paidForm`을 실제 Google Form URL로 교체.
