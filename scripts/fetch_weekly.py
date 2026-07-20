#!/usr/bin/env python3
"""주간 브리핑 초안 수집기 (5단계 확정안 ①②③ — 반자동).

도메인(밸류체인 테마)별 소스(기본 Google News RSS; arXiv 어댑터는 유지·기본 미사용) -> 헤드라인 수집
-> LLM이 '선행 신호 후보 카드'만 생성(자동요약·투자판단 금지) -> §6 린트
-> WEEKLY_WEBAPP_URL 있으면 '주간-초안' Sheet에 status=draft로 POST, 없으면 dry-run.

※ 소스 경계(혼동 주의): 이 파이프라인은 '종목설정' 탭(시장-종목 파이프, fetch_market.py)이나
  설문/구독자 시트(BizSignal Labs, mailer)와 무관하다. 소스는 아래 DOMAINS의 도메인 키워드로
  검색한 뉴스뿐이며, 기업명은 그 뉴스에서 '관찰'로 추출될 뿐 사전 종목 리스트가 아니다.

산출물은 '초안'이다. 사람이 시트에서 draft->approved로 선별하고 헤드라이너 딥다이브를
직접 작성하는 것이 유일한 발행 게이트다(④). 이 스크립트는 ④⑤에 관여하지 않는다.

'주간-초안' 탭 컬럼(헤더 정확히):
    분야 · 발행주 · 유형 · 제목ko · 제목en · 한줄ko · 한줄en · 밸류체인 · 출처URL · 선행도 · status

Actions/로컬 환경변수:
    DEEPSEEK_API_KEY / GEMINI_API_KEY   (lib/ai.py)
    WEEKLY_WEBAPP_URL                   Apps Script 쓰기 웹앱 URL (선택, 없으면 dry-run)
    WEEKLY_WEBAPP_TOKEN                 웹앱 공유 토큰 (선택)
실행: python3 scripts/fetch_weekly.py [--dry] [--limit=N]

소스 확장: DOMAINS[*]["feeds"]에 ("gnews", 쿼리) 또는 ("arxiv", 쿼리)를 추가.
1차 소스(실적콜·특허 RSS 등)는 검증 후 같은 feeds 리스트에 어댑터를 붙여 확장한다.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import ai      # noqa: E402
import guard   # noqa: E402

UA = "Mozilla/5.0 (BriefingSignalLab/1.0)"
ATOM = {"a": "http://www.w3.org/2005/Atom"}

# 시트 헤더 순서(웹앱이 헤더명으로 매핑하므로 시트 첫 행과 정확히 일치해야 함).
HEADER = ["분야", "발행주", "유형", "제목ko", "제목en", "한줄ko", "한줄en",
          "밸류체인", "출처URL", "선행도", "status"]

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


def week_kst():
    """발행주 라벨(ISO): 'YYYY-Www'. KST(UTC+9) 기준."""
    kst = datetime.now(timezone.utc) + timedelta(hours=9)
    return kst.strftime("%G-W%V")


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


def feed_gnews(query, n=4):
    url = "https://news.google.com/rss/search?q=%s&hl=ko&gl=KR&ceid=KR:ko" % urllib.parse.quote(query)
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
        if title:
            out.append((title, link, "뉴스"))
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
        if title:
            out.append((title, link, "arXiv 논문"))
    return out


def collect(domain):
    """도메인 feeds에서 헤드라인 수집 → 제목 기준 중복 제거, 최대 12건."""
    heads, seen = [], set()
    for kind, query in domain["feeds"]:
        items = feed_gnews(query) if kind == "gnews" else feed_arxiv(query)
        for title, link, src in items:
            key = title.lower()
            if key not in seen:
                seen.add(key)
                heads.append((title, link, src))
        time.sleep(1)  # 소스 rate-limit 완화
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


def draft_domain(domain, week):
    heads = collect(domain)
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
        src = heads[n - 1][1] if 1 <= n <= len(heads) else ""
        row = {
            "분야": domain["id"],
            "발행주": week,
            "유형": "signal",
            "제목ko": (c.get("제목ko") or "").strip(),
            "제목en": (c.get("제목en") or "").strip(),
            "한줄ko": (c.get("한줄ko") or "").strip(),
            "한줄en": (c.get("한줄en") or "").strip(),
            "밸류체인": (c.get("밸류체인") or "").strip(),
            "출처URL": src,
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
    url = os.environ.get("WEEKLY_WEBAPP_URL", "").strip()
    if not url:
        print("[write] WEEKLY_WEBAPP_URL 없음. dry-run(출력만)")
        for r in rows:
            print("  ", json.dumps(r, ensure_ascii=False))
        return
    payload = {"token": os.environ.get("WEEKLY_WEBAPP_TOKEN", ""), "tab": "주간-초안", "rows": rows}
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print("[write] POST %s: %s" % (r.status, r.read().decode("utf-8", "replace")[:120]))
    except Exception as e:
        print("[write] 실패: %s" % e)


def main():
    dry = "--dry" in sys.argv
    limit = None
    for a in sys.argv:
        if a.startswith("--limit="):
            limit = int(a.split("=")[1])
    domains = DOMAINS[:limit] if limit else DOMAINS
    week = week_kst()
    print("[weekly] 발행주 %s · 도메인 %d개 처리" % (week, len(domains)))
    rows = []
    for i, d in enumerate(domains):
        if i:
            time.sleep(2)
        rows.extend(draft_domain(d, week))
    print("[weekly] 초안 %d행 생성" % len(rows))
    if dry:
        for r in rows:
            print("  ", json.dumps(r, ensure_ascii=False))
    else:
        post_rows(rows)


if __name__ == "__main__":
    main()
