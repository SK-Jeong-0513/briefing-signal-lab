# 작업 방식 (Contributing)

이 사이트는 **하나의 repo에서 브랜치로 작업**합니다. 다른 폴더에서 만들어 복사/마이그레이션하지 않습니다 — git이 병합을 대신합니다.

## 원칙

- **단일 소스:** `github.com/SK-Jeong-0513/briefing-signal-lab` (로컬 작업 폴더 = `BrieSigLab/`).
- **배포 대상:** `public/` 폴더만. `main`에 push되면 GitHub Actions가 자동배포 → **https://brevislab.com** (커스텀 도메인, 배포 소스=`sk-jeong-0513.github.io/briefing-signal-lab`)
- **콘텐츠는 데이터:** 브리핑 추가/수정은 코드가 아니라 `public/assets/content/<카테고리>.js` 데이터 편집.

## 브랜치 규칙

| 목적 | 브랜치 이름 |
|---|---|
| 탭/카테고리 콘텐츠 | `feat/tab-tech`, `feat/tab-finance`, `feat/tab-economy` |
| 대시보드 | `feat/dashboard` |
| 서재 | `feat/library` |
| 디자인/구조 | `chore/...`, `refactor/...` |
| 버그 수정 | `fix/...` |

## 절차 (탭 하나 작업 → 배포)

```bash
git switch -c feat/tab-tech          # 브랜치 생성
# public/assets/content/tech.js 편집 (브리핑 항목 추가)
node --check public/assets/content/tech.js   # 문법 확인
git add -A && git commit -m "content(tech): 브리핑 추가"
git push -u origin feat/tab-tech     # 브랜치 push (아직 라이브 아님)

# 검토 후 라이브 반영:
git switch main && git merge feat/tab-tech
git push origin main                 # → Actions 자동배포
```

- 라이브 전 미리보기: `public/index.html`을 브라우저로 직접 열면 됨(서버 불필요).
- 여러 세션이 동시에 작업하면 **서로 다른 브랜치**를 쓴다. 충돌 최소화.

## 데이터 파일 구조

```
public/assets/content/
  tech.js      → const BRIEFINGS_TECH = [ ... ]      (기술 탭)
  finance.js   → const BRIEFINGS_FINANCE = [ ... ]   (금융 탭, disclaimer:true 지원)
  economy.js   → const BRIEFINGS_ECONOMY = [ ... ]   (경제 탭)
  site.js      → UI 카피 · INDICATORS · LIBRARY · LINKS · BRIEFINGS 합치기
```

### 새 브리핑 항목 필드 (Briefing Issue)
```js
{
  id: "tech-2026-07-10",          // 카테고리-날짜 형식 권장
  date: "2026-07-10",
  category: "tech",                // tech | finance | economy
  label: { ko: "기술", en: "Tech" },
  title: { ko: "...", en: "..." },
  summary: { ko: ["3줄", "요약", "..."], en: ["3 lines", "...", "..."] },
  tags: ["...", "..."],
  sources: [{ name: "...", note: { ko: "...", en: "..." } }],
  access_level: "free",            // free(무료 축약) | paid(유료 전체)
  disclaimer: true,                // (선택) 금융 카드 "투자 조언 아님" 배지
  spark: [4,5,6,...]               // 미니 스파크라인용 시계열(샘플)
}
```

### 새 카테고리 추가
1. `public/assets/content/<name>.js` 생성 → `const BRIEFINGS_<NAME> = [ ... ]`
2. `public/index.html`의 script 목록에 추가 (site.js보다 먼저)
3. `site.js` 맨 아래 `BRIEFINGS` 합치기에 `BRIEFINGS_<NAME>` 편입

## 세션 인수인계

세션을 마칠 때 [docs/HANDOFF.md](docs/HANDOFF.md) 템플릿을 채워 커밋하면, 다음 세션이 브랜치·진행상황을 바로 이어받는다. (또는 Claude Code `/hand-off`·`/context-save` 사용)

## 하지 말 것

- 다른 폴더에서 만들어 이 폴더로 파일 복사(마이그레이션) — 브랜치 병합으로 대체.
- `plan.md`·`CLAUDE.md`·`agents/` 커밋 (이미 `.gitignore` 처리됨, 로컬 전용).
- 결제/로그인/DB/투자 조언 문구 추가 (Phase 1 범위 밖).
