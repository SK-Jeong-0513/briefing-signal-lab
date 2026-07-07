# 서재(Library) 구현 스펙 — 확정본 (2026-07-08 grill)

nav "서재"를 랜딩 섹션(`#library`)에서 **독립 페이지 + 주기 업로드 리포트 아카이브**로 승격하는 작업의 확정 스펙.
다음 세션은 이 문서대로 구현한다. 아래 결정은 grill 세션에서 사용자가 항목별로 확정함.

## 확정된 설계 결정 (grill Q1~Q10)

1. **정체성 = 하이브리드(C).** 서재 = "리서치 리포트(전면) + 운영자 개인 노트(후면)". 기존 가짜 3카드(자동화/LLM/대시보드 노트)는 폐기.
2. **구조 = 독립 페이지(A).** `library.html` 신설. 랜딩 `#library`는 최근 리포트 티저 + "서재 전체 보기 →" CTA로 축소.
3. **렌더 형식 = D.** 리포트 1개 = 온브랜드 페이지(상단 초록·메타·비주얼 = 무료 미끼 / 하단 본문). PDF 불필요(본문도 HTML).
4. **렌더 메커니즘 = Path 2.** `.md`를 드롭하면 공용 렌더러가 클라이언트에서 마크다운 렌더. 매번 Claude 안 거침.
5. **목록 유지 = B.** `.md` 프런트매터 + GitHub Action이 `library.json` 자동 생성. 업로드 = `.md` 하나 드롭 + push.
6. **게이팅 = C.** 리포트 전량 무료(미끼·SEO·구독 퍼널). `access` 필드만 스키마 예약(향후 페이월 전환용). .md가 공개라 "유료 잠금"은 가짜가 되므로 하지 않음(정직성).
7. **분류 = A.** 3대 카테고리(기술/금융/경제) 1차 필터 + 자유 태그 2차. 카테고리 페이지(tech/finance/economy)에 "이 분야 심층 리포트 →" 스트립으로 서재 연결.
8. **비주얼 = A.** 텍스트 중심 카드 + 본문 내 비주얼 임베드. 커버는 선택(절제, 풀블리드 금지), 없으면 시그널 라인 폴백. 디자인 규약(이미지 히어로 금지) 준수.
9. **개인 아티팩트(svg) = `type` 구분 + 주기 추가.** `type: report|note`. note(개인 관심·"도서 소개" svg 등)는 "운영자의 서가" 스트립. note도 리포트와 같은 `.md` 파이프라인(svg는 본문 임베드).
10. **언어 = A.** 리포트 본문 KO 전용, UI 크롬만 KO/EN. `title_en`/`abstract_en` 필드 예약.
- 마크다운 lib = **marked.js**(경량, self-host). 프런트매터 파서 = **최소 stdlib**(단순 `key: value` + 인라인 리스트), pip 불필요.

## 콘텐츠 모델

모든 항목 = `.md` + YAML 프런트매터. 통일 파이프라인(note도 .md, svg는 본문 임베드).

프런트매터 스키마:
```yaml
---
title: 우주 산업 서플라이 체인 기업 분석
type: report            # report | note
category: 기술           # 기술|금융|경제 (report 필수, note는 생략 가능)
tags: [우주·방산, SCM]
date: 2026-07-08
abstract: 한두 줄 요약 (무료 미끼·SEO)
access: free            # free | paid (예약, 현재 전량 free)
cover:                  # 선택 (절제된 헤더 비주얼 경로)
title_en:               # 예약 (선택 영문화)
abstract_en:            # 예약
---
(본문 마크다운. svg/도표는 library/assets/ 에 두고 임베드)
```

## 업로드 흐름 (무마찰)

1. `library/reports/<slug>.md` (또는 `library/notes/<slug>.md`) 작성 → push
2. Action(`scripts/build_library_manifest.py`)이 모든 `.md` 프런트매터 스캔 → `public/assets/data/library.json` 재생성·커밋
3. 배포 자동 트리거 → 목록·페이지 반영

`id` = 파일 슬러그(예: `2026-07-space-scm`). 정렬 = date 최신순.

## 페이지 / 렌더

- `library.html` — 카테고리 칩 필터(기술/금융/경제, tech-chip/캘린더 필터 재사용) + 리포트 그리드(최신순) + 하단 "운영자의 서가" note 스트립. `assets/library.js`가 manifest 렌더. 빈 상태 "리포트를 준비 중입니다."
- `read.html?r=<id>` — `.md` fetch → 프런트매터 스트립 → 온브랜드 헤더(제목·날짜·카테고리·초록·태그) + 본문(marked.js). report·note 공용. EN 모드 시 "본문은 한국어로 제공" 안내.
- 랜딩 `#library` — 가짜 `LIBRARY` 제거 → manifest 최신 리포트 3개 티저 + "서재 전체 보기 →" CTA.
- tech/finance/economy — 하단 "이 분야 심층 리포트 →" 스트립(manifest를 category로 필터).
- 페이지네이션 없음(초기 소량, 나중에 "더 보기").

## 파일 범위

신규:
- `public/library.html`, `public/read.html`
- `public/assets/library.js`, `public/assets/read.js`
- `public/assets/vendor/marked.min.js` (self-host)
- `public/library/reports/*.md`, `public/library/notes/*.md`, `public/library/assets/*`
- `public/assets/data/library.json` (Action 생성)
- `.github/workflows/library-manifest.yml`
- `scripts/build_library_manifest.py`

수정:
- 6개 페이지(index/tech/finance/economy/dashboard/calendar) nav "서재": `#library` → `library.html`
- 랜딩 `#library` 섹션(index.html) + `assets/content/site.js`의 `LIBRARY`/`library` UI 문자열
- `assets/script.js`의 `renderLibrary()` → manifest 티저 렌더로 교체
- tech/finance/economy 하단 스트립 + 관련 렌더 로직
- `assets/style.css` 서재/카드/필터/스트립 스타일(기존 토큰만)

## 이관 대상(초기 시드)

프로젝트 루트 `Archive/` 3개:
- `우주 산업 서플라이 체인 기업 분석 (1).docx` → `library/reports/` (type: report, category 기술, tags [우주·방산, SCM]) — 마크다운 변환 필요
- `CPO 기술 동향 및 SCM 분석.docx` → `library/reports/` (type: report, category 기술, tags [반도체, CPO, 밸류체인]) — 마크다운 변환 필요
- `code_artifact (1).svg` → `library/notes/` (type: note, 개인 관심/도서 소개) — `.md`에서 svg 임베드

## 주의 / 제약

- 디자인 규약: 이미지 히어로·풀블리드 이미지·다크·blob 금지. 시그널 라인 모티프·절제된 타이포 유지. 새 색/폰트/여백/radius 생성 금지(DESIGN.md 토큰).
- 콘텐츠 리스크: 투자 조언 금지(밸류체인 기업 명시 OK, 매수·매도·목표가 금지, 면책). 기사 전문 복사 금지.
- 마크다운은 단일 작성자(운영자) 신뢰 콘텐츠 전제 — 현 단계 XSS 새니타이즈 최소. 외부 기여 받게 되면 재검토.
- Action은 stdlib만(pip 불필요) 유지, `.gitattributes` LF, `permissions: contents: write`, keep-alive 워크플로 규약 준수.
- 기존 수정 파일은 `.bak` 백업 후 진행.
