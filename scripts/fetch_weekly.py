#!/usr/bin/env python3
"""주간 브리핑 초안 수집기 (5단계 확정안 ①②③ — 반자동).

도메인(밸류체인 테마)별 소스(기본 Google News RSS; arXiv 어댑터는 유지·기본 미사용) -> 헤드라인 수집
-> LLM이 '선행 신호 후보 카드'만 생성(자동요약·투자판단 금지) -> §6 린트
-> WEEKLY_WEBAPP_URL 있으면 '주간-초안' Sheet에 status=draft로 POST, 없으면 dry-run.

※ 소스 경계(혼동 주의): 이 파이프라인은 '종목설정' 탭(시장-종목 파이프, fetch_market.py)이나
  설문/구독자 시트(BizSignal Labs, mailer)와 무관하다. 소스는 아래 DOMAINS의 도메인 키워드로
  검색한 뉴스뿐이며, 기업명은 그 뉴스에서 '관찰'로 추출될 뿐 사전 종목 리스트가 아니다.

산출물은 '초안'이다. draft->approved는 편집 승인일 뿐 공개 게이트가 아니다.
공개는 관리자 수동 예약 또는 prepare_weekly_release.py의 조건부 자동 검수 후 발행 원장을 거친다.

'주간-초안' 탭 컬럼(헤더 정확히):
    분야 · 발행주 · 유형 · 제목ko · 제목en · 한줄ko · 한줄en · 밸류체인 · 출처URL · 원문제목 · 원문일시 · 수집일시 · 생성엔진 · 선행도 · status

Actions/로컬 환경변수:
    DEEPSEEK_API_KEY / GEMINI_API_KEY   (lib/ai.py)
    WEEKLY_WEBAPP_URL                   Apps Script 쓰기 웹앱 URL (선택, 없으면 dry-run)
    WEEKLY_WEBAPP_TOKEN                 웹앱 공유 토큰 (선택)
    WEEKLY_COLLECT_DAYS                 수집 기간(일, 기본 7). 발행 게이트 freshness(10일)보다 짧아야 한다.
    WEEKLY_DRAFT_CSV                    '주간-초안' 게시 CSV (선택). 지난 주 수집분 재수집 방지.
    WEEKLY_RELEASE_ITEMS_CSV            '주간-발행항목' 게시 CSV (선택). 이미 발행된 기사 재수집 방지.
실행: python3 scripts/fetch_weekly.py [--dry] [--limit=N]

소스 확장: DOMAINS[*]["feeds"]에 ("gnews", 쿼리) 또는 ("arxiv", 쿼리)를 추가.
1차 소스(실적콜·특허 RSS 등)는 검증 후 같은 feeds 리스트에 어댑터를 붙여 확장한다.
"""
import csv
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import ai      # noqa: E402
import guard   # noqa: E402
import toggle  # noqa: E402

UA = "Mozilla/5.0 (BriefingSignalLab/1.0)"
ATOM = {"a": "http://www.w3.org/2005/Atom"}

# 수집 기간(일). Google News RSS는 관련도순이라 기간을 안 주면 수개월 전 기사가 상위에 남는다.
# 일요일 수집 → 화요일 발행이므로 발행 게이트 freshness(WEEKLY_FRESH_DAYS=10)보다 짧아야 한다.
COLLECT_DAYS = int(os.environ.get("WEEKLY_COLLECT_DAYS", "7"))

# 시트 헤더 순서(웹앱이 헤더명으로 매핑하므로 시트 첫 행과 정확히 일치해야 함).
HEADER = ["분야", "발행주", "유형", "제목ko", "제목en", "한줄ko", "한줄en",
          "밸류체인", "출처URL", "원문제목", "원문일시", "수집일시", "생성엔진", "선행도", "status"]

# 런칭 앵커 2개(가동 분야). 로드맵/타 카테고리는 아래에 도메인 항목을 append 해 확장.
# 소스: 현재 Google News RSS만 기본 사용(온타깃 검증됨). arXiv 어댑터(feed_arxiv)는 유지하나
#   all: 검색이 최신순으로 무관 논문을 섞어 노이즈가 커서 기본에서 제외.
#   재투입 시 카테고리로 좁힐 것 — 예: ("arxiv", "cat:cs.AR AND all:chiplet").
DOMAINS = [
    {
        "id": "ai-infra",
        "label": {"ko": "AI 인프라", "en": "AI Infra"},
        "feeds": [
            ("gnews", "AI 데이터센터 capex 반도체"),
            ("gnews", "co-packaged optics 광집적 실리콘 포토닉스"),
            ("gnews", "hyperscaler custom silicon ASIC 가속기"),
            ("gnews", "AI 서버 전력 냉각 데이터센터 병목"),
        ],
    },
    {
        "id": "semicon",
        "label": {"ko": "반도체 공급망", "en": "Semis Supply Chain"},
        "feeds": [
            ("gnews", "HBM4 본딩 패키징 후공정"),
            ("gnews", "advanced packaging CoWoS 유리기판 substrate"),
            ("gnews", "반도체 파운드리 장비 소재 공급망"),
            ("gnews", "HBM SK하이닉스 삼성 마이크론 공급"),
        ],
    },
    {
        "id": "power",
        "label": {"ko": "전력·에너지", "en": "Power & Energy"},
        "feeds": [
            ("gnews", "AI 데이터센터 전력 수요 전력망"),
            ("gnews", "SMR 소형모듈원전 원전 전력"),
            ("gnews", "데이터센터 냉각 액침냉각"),
            ("gnews", "전력 인프라 송전 변압기 그리드"),
        ],
    },
    {
        "id": "space",
        "label": {"ko": "우주·방산", "en": "Space & Defense"},
        "feeds": [
            ("gnews", "저궤도 위성통신 LEO 위성"),
            ("gnews", "우주 발사체 로켓 발사"),
            ("gnews", "방산 전자 레이더 무기체계 수출"),
        ],
    },
    {
        "id": "bio",
        "label": {"ko": "바이오", "en": "Bio"},
        "hint": "임상 단계 진입·허가·기술이전·CDMO 수주 등 파이프라인과 생산 밸류체인의 구조 변화를 시사하는 항목",
        "feeds": [
            ("gnews", "바이오 임상시험 신약 개발"),
            ("gnews", "AI 신약개발 디지털치료제"),
            ("gnews", "바이오시밀러 CDMO 위탁생산"),
        ],
    },
    # ── 금융(finance) — 분야 id는 finance.js FINANCE_DOMAINS와 일치 ──
    {
        "id": "kr-equity",
        "label": {"ko": "국내 증시", "en": "KR Equities"},
        "hint": "수급(외국인·기관)·실적·밸류에이션·주도주 순환 등 국내 증시의 구조·국면 변화를 시사하는 항목",
        "feeds": [
            ("gnews", "코스피 외국인 기관 수급 증시"),
            ("gnews", "국내 증시 실적 시즌 반도체 주도주"),
            ("gnews", "코스피 밸류업 배당 자사주"),
        ],
    },
    {
        "id": "us-equity",
        "label": {"ko": "미국 증시", "en": "US Equities"},
        "hint": "빅테크 실적·성장주 밸류에이션·금리 민감도·AI capex 수혜 확산 등 미 증시의 구조·국면 변화를 시사하는 항목",
        "feeds": [
            ("gnews", "미국 증시 빅테크 실적 S&P 나스닥"),
            ("gnews", "성장주 밸류에이션 금리 민감"),
            ("gnews", "AI capex 반도체 데이터센터 수혜"),
        ],
    },
    {
        "id": "bond",
        "label": {"ko": "채권·금리 시장", "en": "Rates & Credit"},
        "hint": "국채 금리·크레딧 스프레드·수익률곡선 등 채권·금리 시장의 국면 변화를 시사하는 항목",
        "feeds": [
            ("gnews", "국고채 금리 수익률 채권시장"),
            ("gnews", "미국 국채 장단기 금리 스프레드"),
            ("gnews", "회사채 크레딧 신용 스프레드"),
        ],
    },
    {
        "id": "commodity",
        "label": {"ko": "원자재·대체", "en": "Commodities & Alts"},
        "hint": "에너지·금속·원자재 가격·수급 등 원자재/대체자산의 국면 변화를 시사하는 항목",
        "feeds": [
            ("gnews", "국제유가 원유 에너지 가격"),
            ("gnews", "구리 금 은 금속 원자재 가격"),
            ("gnews", "천연가스 LNG 원자재 수급"),
        ],
    },
    {
        "id": "flows",
        "label": {"ko": "펀드·자금흐름", "en": "Funds & Flows"},
        "hint": "ETF 자금유출입·기관 수급·패시브/액티브 포지셔닝 등 자금흐름의 국면 변화를 시사하는 항목",
        "feeds": [
            ("gnews", "ETF 자금 유입 유출 수급"),
            ("gnews", "펀드 자금흐름 기관 포지셔닝"),
            ("gnews", "외국인 수급 패시브 액티브 자금"),
        ],
    },
    # ── 경제(economy) — 단일 매크로 다이제스트. 분야 id="macro"(site.js economy sheetDomain) ──
    {
        "id": "macro",
        "label": {"ko": "경제 매크로", "en": "Macro"},
        "hint": "금리 결정·물가·고용·정책 전환·환율/무역 등 매크로 국면 변화와 그것이 어느 자산에 영향인지를 시사하는 항목",
        "feeds": [
            ("gnews", "한국은행 기준금리 통화정책"),
            ("gnews", "미국 CPI 물가 연준 금리"),
            ("gnews", "고용 지표 경기 성장률"),
            ("gnews", "환율 무역수지 달러 원화"),
        ],
    },
]


def week_kst(now=None):
    """다음 화요일 발행호의 ISO 키. 일요일 생성분이 다음 주 호로 들어가게 한다."""
    kst = now or (datetime.now(timezone.utc) + timedelta(hours=9))
    days = (1 - kst.weekday()) % 7
    return (kst + timedelta(days=days)).strftime("%G-W%V")


def get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _fetch(url, timeout=25):
    """503/차단 대비 3회 재시도. 실패 시 None."""
    for attempt in range(3):
        try:
            return get(url, timeout)
        except Exception as e:
            print("[feed] 시도%d 실패: %s" % (attempt + 1, e))
            if attempt < 2:
                time.sleep(3 + attempt * 3)
    return None


def feed_gnews(query, n=6, now=None):
    """최근 COLLECT_DAYS일 기사만. when: 연산자로 좁히고 pubDate로 한 번 더 거른다."""
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=COLLECT_DAYS)
    q = "%s when:%dd" % (query, COLLECT_DAYS)
    url = "https://news.google.com/rss/search?q=%s&hl=ko&gl=KR&ceid=KR:ko" % urllib.parse.quote(q)
    xml = _fetch(url)
    if not xml:
        return []
    try:
        root = ET.fromstring(xml)
    except Exception as e:
        print("[gnews] 파싱 실패(%s): %s" % (query, e))
        return []
    out = []
    for it in root.findall(".//item")[:n]:
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        try:
            dt = parsedate_to_datetime((it.findtext("pubDate") or "").strip()).astimezone(timezone.utc)
        except Exception:
            dt = None
        # 일시 불명·기간 밖 기사는 여기서 제외. 발행 게이트 freshness에서 어차피 걸린다.
        if title and dt and dt >= cutoff:
            out.append((title, link, "뉴스", dt.isoformat()))
    return out


def feed_arxiv(query, n=2):
    url = ("http://export.arxiv.org/api/query?search_query=all:%s"
           "&sortBy=submittedDate&sortOrder=descending&max_results=%d"
           % (urllib.parse.quote(query), n))
    xml = _fetch(url)
    if not xml:
        return []
    try:
        root = ET.fromstring(xml)
    except Exception as e:
        print("[arxiv] 파싱 실패(%s): %s" % (query, e))
        return []
    out = []
    for e in root.findall("a:entry", ATOM)[:n]:
        title = " ".join((e.findtext("a:title", "", ATOM) or "").split())
        link = (e.findtext("a:id", "", ATOM) or "").strip()
        published = (e.findtext("a:published", "", ATOM) or "").strip()
        if title:
            out.append((title, link, "arXiv 논문", published))
    return out


def title_key(value):
    """제목 정규화 키(공백·기호·매체명 표기 차이 흡수). prepare_weekly_release.title_key와 동일 규칙."""
    return re.sub(r"[^0-9a-z가-힣]+", "", (value or "").lower())


def _csv_rows(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8-sig", "replace"))))


def used_keys():
    """이미 초안/발행에 쓴 기사 키(출처URL·정규화 원문제목) 집합.

    같은 기사가 관련도 상위에 몇 주간 남아 W29·W30·W31에 반복 게재되던 문제의 방어선.
    CSV 미설정·조회 실패는 fail-open(수집은 계속) — 중복이 완전 차단만 안 될 뿐이다.
    """
    keys = set()
    for env_name in ("WEEKLY_DRAFT_CSV", "WEEKLY_RELEASE_ITEMS_CSV"):
        url = os.environ.get(env_name, "").strip()
        if not url:
            print("[dedup] %s 미설정 - 과거분 대조 생략" % env_name)
            continue
        try:
            rows = _csv_rows(url)
        except Exception as e:
            print("[dedup] %s 조회 실패(계속 진행): %s" % (env_name, e))
            continue
        for row in rows:
            link = (row.get("출처URL") or "").strip().lower()
            if link:
                keys.add(link)
            key = title_key(row.get("원문제목"))
            if key:
                keys.add(key)
        print("[dedup] %s: %d행 반영" % (env_name, len(rows)))
    return keys


def collect(domain, used=None):
    """도메인 feeds에서 헤드라인 수집 → 이번 실행 내 중복 + 과거 사용분 제거, 최대 12건."""
    used = used or set()
    heads, seen, skipped = [], set(), 0
    for kind, query in domain["feeds"]:
        items = feed_gnews(query) if kind == "gnews" else feed_arxiv(query)
        for title, link, src, published in items:
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            if link.strip().lower() in used or title_key(title) in used:
                skipped += 1
                continue
            heads.append((title, link, src, published))
        time.sleep(1)  # 소스 rate-limit 완화
    if skipped:
        print("[dedup] %s: 과거 사용 기사 %d건 제외" % (domain["id"], skipped))
    return heads[:12]


def _parse_cards(text):
    """LLM 응답에서 JSON 배열 추출. 실패 시 []."""
    s = (text or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s[:4].lower() == "json":
            s = s[4:]
    a, b = s.find("["), s.rfind("]")
    if a < 0 or b < 0:
        return []
    try:
        arr = json.loads(s[a:b + 1])
        return arr if isinstance(arr, list) else []
    except Exception as e:
        print("[card] JSON 파싱 실패: %s" % e)
        return []


def draft_domain(domain, week, used=None):
    heads = collect(domain, used)
    if not heads:
        print("[skip] %s: 헤드라인 없음" % domain["id"])
        return []
    block = "\n".join("[%d] %s (%s)" % (i + 1, h[0], h[2]) for i, h in enumerate(heads))
    # 카테고리별 '선행 신호' 정의(hint). 없으면 tech 기본(밸류체인 병목).
    hint = domain.get("hint", "경제지 헤드라인보다 앞서 밸류체인 압력·병목·구조 변화를 시사하는 항목")
    user = (
        "다음은 '%s' 분야 관련 최근 헤드라인입니다(번호·출처유형 포함).\n"
        "이 중 '선행 신호'(%s)가 될 만한 것을 최대 5개 고르고, 각각을 후보 신호 카드로 만드세요. "
        "일반 뉴스여도 위 관점으로 재해석할 수 있으면 신호로 만드세요. 전문 요약이 아니라 후보만 만듭니다.\n"
        "규칙: 투자판단(매수·매도·목표가·비중) 표현 절대 금지. 관련 기업/자산은 '관찰'로만. 모르면 비워두세요.\n"
        "  '매수세·매도세·목표가·비중·베팅·저가 매수'는 단어 자체를 쓰지 마세요(자동 린트에서 카드가 통째로 버려집니다). "
        "자금 흐름은 '순매수·순매도·순유입·순유출·수급' 같은 사실 표현으로 쓰세요.\n"
        "아래 JSON 배열로만 출력(설명·코드펜스 없이):\n"
        '[{"출처n": <헤드라인 번호>, "제목ko": "...", "제목en": "...", '
        '"한줄ko": "메커니즘/관찰 1줄", "한줄en": "...", '
        '"밸류체인": "관련 밸류체인/종목/자산 후보", "선행도": <1~5, 경제지보다 앞선 정도>}]\n'
        "선행 신호가 없으면 [] 만 출력.\n\n헤드라인:\n%s" % (domain["label"]["ko"], hint, block)
    )
    text, engine = ai.chat(ai.GUARD_SYSTEM, user, max_tokens=1200)
    if not text:
        print("[skip] %s: LLM 응답 없음" % domain["id"])
        return []
    cards = _parse_cards(text)
    rows = []
    for c in cards:
        try:
            n = int(c.get("출처n", 0))
        except Exception:
            n = 0
        source = heads[n - 1] if 1 <= n <= len(heads) else ("", "", "", "")
        row = {
            "분야": domain["id"],
            "발행주": week,
            "유형": "signal",
            "제목ko": (c.get("제목ko") or "").strip(),
            "제목en": (c.get("제목en") or "").strip(),
            "한줄ko": (c.get("한줄ko") or "").strip(),
            "한줄en": (c.get("한줄en") or "").strip(),
            "밸류체인": (c.get("밸류체인") or "").strip(),
            "출처URL": source[1],
            "원문제목": source[0],
            "원문일시": source[3],
            "수집일시": datetime.now(timezone.utc).isoformat(),
            "생성엔진": engine,
            "선행도": str(c.get("선행도", "")).strip(),
            "status": "draft",
        }
        if not row["제목ko"]:
            continue
        blob = " ".join([row["제목ko"], row["제목en"], row["한줄ko"], row["한줄en"], row["밸류체인"]])
        clean, hits = guard.screen(blob)
        if not clean:
            print("[drop] %s §6 위반: %s | %s" % (domain["id"], hits, row["제목ko"][:30]))
            continue
        soft = guard.soft_scan(blob)
        if soft:
            print("[soft] %s: %s | %s" % (domain["id"], ", ".join(soft), row["제목ko"][:30]))
        rows.append(row)
    print("[ok] %s: 후보 %d건(%s)" % (domain["id"], len(rows), engine))
    return rows


def post_rows(rows):
    """초안을 시트에 쓴다. 성공하면 True.

    ⚠️ 예전엔 실패를 print 만 하고 넘어가 **워크플로가 초록불로 끝났다**.
    2026-08-02 실제로 `[write] 실패: The read operation timed out` 이 나고도
    run 이 success 로 남아, 2026-W32 초안 40행이 통째로 유실된 걸 다음 주에야
    알았다. 40행 append 는 Apps Script 쪽이 30초를 넘길 때가 있어 재시도가 필요하다.
    """
    url = os.environ.get("WEEKLY_WEBAPP_URL", "").strip()
    if not url:
        print("[write] WEEKLY_WEBAPP_URL 없음. dry-run(출력만)")
        for r in rows:
            print("  ", json.dumps(r, ensure_ascii=False))
        return True
    payload = {"token": os.environ.get("WEEKLY_WEBAPP_TOKEN", ""), "tab": "주간-초안", "rows": rows}
    last = ""
    for attempt in range(1, 4):
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                print("[write] POST %s: %s" % (r.status, r.read().decode("utf-8", "replace")[:120]))
                return True
        except Exception as e:
            last = str(e)
            print("[write] 시도 %d/3 실패: %s" % (attempt, last))
            if attempt < 3:
                time.sleep(10 * attempt)
    # 타임아웃이어도 시트에는 들어갔을 수 있다 — 재시도가 중복 append 를 만들 수 있으니
    # 실패로 끝났으면 시트를 눈으로 확인하고 필요하면 중복 행을 지우라고 알린다.
    print("[ERROR] 초안 %d행 쓰기 3회 실패: %s" % (len(rows), last))
    print("[ERROR] '주간-초안' 탭을 확인하세요 — 타임아웃이라도 일부/중복 기록됐을 수 있습니다.")
    return False


def main():
    dry = "--dry" in sys.argv
    if not dry and not toggle.pipeline_enabled():
        print("[pipeline] paused - settings.pipeline_enabled=0, 이번 실행 건너뜀")
        return
    limit = None
    for a in sys.argv:
        if a.startswith("--limit="):
            limit = int(a.split("=")[1])
    domains = DOMAINS[:limit] if limit else DOMAINS
    week = week_kst()
    print("[weekly] 발행주 %s · 도메인 %d개 처리 · 최근 %d일 기사만" % (week, len(domains), COLLECT_DAYS))
    used = used_keys()
    rows, empty = [], []
    for i, d in enumerate(domains):
        if i:
            time.sleep(2)
        made = draft_domain(d, week, used)
        if not made:
            empty.append(d["id"])
        rows.extend(made)
    print("[weekly] 초안 %d행 생성" % len(rows))
    if empty:
        # 분야가 통째로 비면 그 주 사이트에 '준비 중'으로만 뜬다 — 운영자가 로그에서 바로 보게 남긴다.
        print("[weekly] 초안 0건 분야(%d): %s" % (len(empty), ", ".join(empty)))
    if dry:
        for r in rows:
            print("  ", json.dumps(r, ensure_ascii=False))
        return 0
    # 쓰기 실패는 반드시 빨간 run 으로 끝낸다 — 초록불이면 초안이 없는 걸 아무도 모른다.
    return 0 if post_rows(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
