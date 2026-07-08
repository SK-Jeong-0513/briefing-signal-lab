#!/usr/bin/env python3
"""시장 종목 브리핑 수집기 (IonQ 네이티브 재구축).

종목설정(CSV) 또는 시드 바스켓 -> 종목별 Google News 헤드라인 -> AI 요약(+§6 린트)
-> MARKET_WEBAPP_URL 있으면 시장-종목 Sheet에 POST, 없으면 dry-run(출력). stdlib만.

Actions 환경변수:
    DEEPSEEK_API_KEY / GEMINI_API_KEY  (ai.py)
    MARKET_CONFIG_CSV   종목설정 published CSV URL (선택, 없으면 시드)
    MARKET_WEBAPP_URL   Apps Script 쓰기 웹앱 URL (선택, 없으면 dry-run)
    MARKET_WEBAPP_TOKEN 웹앱 공유 토큰 (선택)
실행: python3 scripts/fetch_market.py [--dry] [--limit=N]
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import ai      # noqa: E402
import guard   # noqa: E402

UA = "Mozilla/5.0 (BriefingSignalLab/1.0)"
SEED = [
    ("005930", "삼성전자"), ("000660", "SK하이닉스"), ("042700", "한미반도체"),
    ("036930", "주성엔지니어링"), ("058470", "리노공업"),
]


def today_kst():
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 9 * 3600))


def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def load_config():
    url = os.environ.get("MARKET_CONFIG_CSV", "").strip()
    if not url:
        print("[cfg] MARKET_CONFIG_CSV 없음. 시드 바스켓 사용")
        return SEED
    try:
        rows = [r.split(",") for r in get(url).strip().splitlines()]
        if len(rows) < 2:
            return SEED
        H = [h.strip().lower() for h in rows[0]]
        def idx(names):
            for i, h in enumerate(H):
                if h in names:
                    return i
            return -1
        it, ino, ia = idx(["티커", "ticker"]), idx(["이름", "name"]), idx(["활성", "active"])
        if it < 0 or ino < 0:
            return SEED
        out = []
        for r in rows[1:]:
            tk = (r[it] if it < len(r) else "").strip()
            nm = (r[ino] if ino < len(r) else "").strip()
            active = (r[ia] if (0 <= ia < len(r)) else "1").strip()
            if tk and nm and active not in ("0", "false", "FALSE", "N", "n"):
                out.append((tk, nm))
        print("[cfg] 종목설정 CSV %d개 로드" % len(out))
        return out or SEED
    except Exception as e:
        print("[cfg] 실패 %s. 시드 사용" % e)
        return SEED


def news(name, n=3):
    """Google News RSS 헤드라인 [(title, link)]. 503/차단 대비 재시도."""
    url = "https://news.google.com/rss/search?q=%s&hl=ko&gl=KR&ceid=KR:ko" % urllib.parse.quote(name)
    root = None
    for attempt in range(3):
        try:
            root = ET.fromstring(get(url))
            break
        except Exception as e:
            print("[news] %s 시도%d: %s" % (name, attempt + 1, e))
            if attempt < 2:
                time.sleep(3 + attempt * 3)
    if root is None:
        return []
    out = []
    for it in root.findall(".//item")[:n]:
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        if title:
            out.append((title, link))
    return out


def brief_one(ticker, name):
    heads = news(name)
    if not heads:
        print("[skip] %s(%s): 뉴스 없음" % (name, ticker))
        return None
    headlines = "\n".join("- " + h[0] for h in heads)
    user = (
        "다음은 '%s(%s)' 관련 최근 뉴스 헤드라인입니다. 투자판단(매수·매도·목표가·비중 등) 없이, "
        "관찰·메커니즘 중심으로 한국어 2문장 요약과 핵심 근거 1줄을 아래 JSON 형식으로만 출력하세요.\n"
        '형식: {"요약":"...","근거":"..."}\n\n헤드라인:\n%s' % (name, ticker, headlines)
    )
    text, engine = ai.chat(ai.GUARD_SYSTEM, user, max_tokens=400)
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        s = s.strip("`")
    try:
        obj = json.loads(s[s.find("{"): s.rfind("}") + 1])
    except Exception:
        obj = {"요약": text.strip(), "근거": ""}
    summary = (obj.get("요약") or "").strip()
    basis = (obj.get("근거") or "").strip()
    clean, hits = guard.screen(summary + " " + basis)
    if not clean:
        print("[drop] %s(%s) §6 위반: %s" % (name, ticker, hits))
        return None
    return {"날짜": today_kst(), "티커": ticker, "이름": name,
            "요약": summary, "근거": basis, "출처URL": heads[0][1], "access": "free"}


def post_rows(rows):
    url = os.environ.get("MARKET_WEBAPP_URL", "").strip()
    if not url:
        print("[write] MARKET_WEBAPP_URL 없음. dry-run(출력만)")
        for r in rows:
            print("  ", json.dumps(r, ensure_ascii=False))
        return
    payload = {"token": os.environ.get("MARKET_WEBAPP_TOKEN", ""), "tab": "시장-종목", "rows": rows}
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
    cfg = load_config()
    if limit:
        cfg = cfg[:limit]
    print("[market] 종목 %d개 처리" % len(cfg))
    rows = []
    for i, (tk, nm) in enumerate(cfg):
        if i:
            time.sleep(2)  # 버스트 방지(뉴스 소스 rate-limit 완화)
        r = brief_one(tk, nm)
        if r:
            rows.append(r)
            print("[ok] %s(%s): %s" % (nm, tk, r["요약"][:40]))
    print("[market] 생성 %d행" % len(rows))
    if dry:
        for r in rows:
            print("  ", json.dumps(r, ensure_ascii=False))
    else:
        post_rows(rows)


if __name__ == "__main__":
    main()
