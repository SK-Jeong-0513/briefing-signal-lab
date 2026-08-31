#!/usr/bin/env python3
"""주간 호의 ready 항목을 채점해 카테고리별 딥다이브 상위 N건을 만든다.

왜 별도 단계인가(2026-08-27 결정):
  게이트(prepare_weekly_release)에만 붙이면 대부분의 주에 안 돈다 — 운영자가 04:00 전에
  발행 예약을 누르면 게이트가 no-op 하고 '검수점수'가 통째로 비어 있다(W35 205건 전부 공란).
  여기서는 자동·수동 어느 경로든 같은 상태인 **상태='ready'** 를 대상으로 삼는다.
  ⚠️ 'published' 는 월요일 09:00 발송 **직전**에 찍히므로 그때 채점하면 늦는다.

왜 별도 탭인가:
  Python 이 시트에 쓰는 유일한 경로(market/Code.gs 웹앱)가 **append 전용**이라 기존 행에
  컬럼을 채워 넣을 수 없다. '주간-발행항목' 이 원래 수정 없이 리비전을 append 하는
  감사 로그라는 설계와도 맞는다. 렌더 시점에 (issue_key, revision, 출처URL) 로 조인한다.
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import ai

KST = timezone(timedelta(hours=9))
DEEPDIVE_TAB = "주간-딥다이브"
DEEPDIVE_FIELDS = ["issue_key", "revision", "분야", "출처URL", "영향도", "선행성", "파급범위",
                   "딥다이브ko", "관전포인트", "근거", "엔진", "created_at"]

# ⚠️ mailer/Code.gs 의 CATS 와 동기 유지. 도메인을 늘리면 양쪽을 같이 고친다.
CATEGORIES = {
    "tech": ["ai-infra", "semicon", "power", "space", "bio"],
    "finance": ["kr-equity", "us-equity", "bond", "commodity", "flows"],
    "economy": ["macro"],
}
DOMAIN_CATEGORY = {d: c for c, ds in CATEGORIES.items() for d in ds}

PER_CATEGORY = int(os.environ.get("DEEPDIVE_PER_CATEGORY", "3"))
BATCH = int(os.environ.get("DEEPDIVE_BATCH", "25"))

# 두 축은 제품 한 문장에서 나온다 — "경제지 헤드라인보다 먼저 잡은 선행 신호를,
# 어느 밸류체인 기업으로 이어지는가까지". 축을 더 늘리면 LLM 점수가 평균으로 뭉개진다.
RUBRIC = """선행성(lead) = 이 정보가 아직 가격에 반영되지 않았을 가능성.
  90~100  대중 보도가 아직 없거나 1차 소스에서만 확인되는 구조적 변화
  60~89   보도는 됐으나 파급 경로가 아직 정리되지 않은 초기 단계
  30~59   이미 널리 보도된 사실의 후속·해설
  0~29    지수 등락·수급 같은 반복되는 시황
파급범위(reach) = 이 변화가 밸류체인을 따라 퍼지는 폭.
  90~100  산업 구조나 여러 산업의 원가·수요를 바꾼다
  60~89   한 산업의 여러 단계(소재·부품·장비·완성)에 영향
  30~59   특정 기업군에 한정
  0~29    단일 기업의 일회성 사건
⚠️ 두 점수는 **절대 기준**이다. 이 묶음 안에서 상대 비교하지 말 것 —
   묶음 전체가 시시하면 전부 낮게 매겨라. 묶음이 달라도 같은 뜻의 점수여야 한다."""


def issue_key_kst(now=None):
    """다음 화요일 기준 ISO 주. prepare_weekly_release 와 같은 규칙.

    ⚠️ 월요일에 실행될 때만 '이번 호'가 된다((1-weekday)%7 = 다음 화요일).
       그래서 호 선택에는 쓰지 않고, 데이터가 예상과 다를 때 경고하는 용도로만 쓴다
       — 수동 실행(workflow_dispatch)은 아무 요일에나 일어난다.
    """
    now = now or datetime.now(KST)
    days = (1 - now.weekday()) % 7
    return (now + timedelta(days=days)).strftime("%G-W%V")


def pick_issue(rows):
    """아직 발송되지 않은 호의 ready 행. (호, 리비전, 행들).

    시계가 아니라 데이터에서 고른다 — 수동 실행은 아무 요일에나 일어난다.

    ⚠️ **published 행이 있는 호·리비전은 제외한다.** ready 는 과도 상태처럼 보이지만
       실제로는 발송 뒤에도 남는다 — weeklyLatestBundle_ 이 (출처URL|제목ko) 중복을
       selected 에서 걸러내는데 weeklyPublish_ 는 그 selected 만 published 로 바꾸므로,
       걸러진 행은 영원히 ready 다(2026-08-27 실측: W35 published 205 · **ready 59**).
       이걸 안 막으면 발송 끝난 호의 잔여물을 이번 호로 착각해 채점한다.
    """
    def key(r):
        return (str(r.get("issue_key", "")).strip(), int(str(r.get("revision") or 1)))

    ready, sent = {}, set()
    for r in rows:
        state = str(r.get("상태", "")).strip()
        if state == "ready":
            ready.setdefault(key(r), []).append(r)
        elif state == "published":
            sent.add(key(r))
    live = sorted(k for k in ready if k not in sent)
    if not live:
        if ready:
            print("[deepdive] ready 행이 있으나 이미 발송된 호의 잔여물뿐 — 생략")
        return "", 0, []
    if len(live) > 1:
        print("[deepdive] 미발송 호가 여럿(%s) — 최신 것만 본다"
              % ", ".join("%s rev%d" % k for k in live))
    issue, revision = live[-1]
    return issue, revision, ready[(issue, revision)]


def _fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "BriefingSignalLab/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8-sig", "replace")


def fetch_csv(url):
    return list(csv.DictReader(io.StringIO(_fetch_text(url))))


def fetch_header(url):
    """행이 하나도 없어도 헤더는 봐야 한다 — DictReader 는 빈 탭에서 아무것도 안 준다."""
    rows = csv.reader(io.StringIO(_fetch_text(url)))
    return next(rows, [])


def parse_object(text):
    """LLM 응답에서 JSON 객체만 뽑는다. 코드펜스·앞뒤 잡담을 견딘다."""
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except ValueError:
        return None
    return obj if isinstance(obj, dict) else None


def clamp(value):
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, n))


def score_batch(domain, batch, chat=None):
    """한 묶음 채점 → {묶음 내 인덱스: 점수}. 전 항목이 채점돼야 성공.

    부분 결과를 받아들이면 '점수를 못 받은 항목'과 '낮게 받은 항목'이 구분되지 않아
    선정에서 조용히 빠진다. 실패는 실패로 두고 그 묶음만 통째로 건너뛴다.
    """
    chat = chat or ai.chat
    system = ("당신은 주간 투자 브리핑의 편집자입니다. 각 후보의 선행성과 파급범위를 "
              "정해진 절대 기준으로 채점합니다. 추측하지 말고 JSON 객체만 반환하세요.\n\n" + RUBRIC)
    user = json.dumps({
        "domain": domain,
        "items": [{"i": n, "title": r.get("제목ko", ""), "line": r.get("한줄ko", ""),
                   "source_title": r.get("원문제목", ""), "value_chain": r.get("밸류체인", "")}
                  for n, r in enumerate(batch)],
        "required": {"scores": [{"i": "int", "lead": "0..100", "reach": "0..100", "why": "20자 이내 한국어"}]},
    }, ensure_ascii=False)
    text, engine = chat(system, user, max_tokens=120 * len(batch) + 300, temperature=0,
                        min_chars=30 * len(batch))
    obj = parse_object(text)
    raw = (obj or {}).get("scores")
    if not isinstance(raw, list) or not engine:
        print("[deepdive] %s 묶음 채점 실패(응답 형식) — 건너뜀" % domain)
        return {}
    out = {}
    for item in raw:
        if not isinstance(item, dict):
            continue
        idx, lead, reach = clamp(item.get("i")), clamp(item.get("lead")), clamp(item.get("reach"))
        if idx is None or lead is None or reach is None:
            continue
        out[idx] = {"lead": lead, "reach": reach,
                    "why": str(item.get("why", ""))[:60], "engine": engine}
    if set(out) != set(range(len(batch))):
        print("[deepdive] %s 묶음 채점 불완전(%d/%d) — 건너뜀" % (domain, len(out), len(batch)))
        return {}
    return out


def score_rows(rows, chat=None):
    """{행 인덱스: 점수}. 도메인별로 묶어 부른다 — 같은 분야끼리 봐야 기준이 선다."""
    scores = {}
    by_domain = {}
    for i, r in enumerate(rows):
        by_domain.setdefault((r.get("분야") or "").strip(), []).append(i)
    for domain, idxs in sorted(by_domain.items()):
        if domain not in DOMAIN_CATEGORY:
            print("[deepdive] 알 수 없는 분야 '%s' %d건 — 건너뜀" % (domain, len(idxs)))
            continue
        for start in range(0, len(idxs), BATCH):
            chunk = idxs[start:start + BATCH]
            got = score_batch(domain, [rows[i] for i in chunk], chat)
            for n, i in enumerate(chunk):
                if n in got:
                    scores[i] = got[n]
    return scores


def dedupe_key(row):
    """같은 기사인지 판정. 출처URL 이 원칙이고, 없으면 제목으로 떨어진다."""
    url = (row.get("출처URL") or "").strip().lower()
    return url or ("t:" + (row.get("제목ko") or "").strip())


def select(rows, scores, per_category=None):
    """카테고리별 상위 N. 동점은 원래 행 순서(파이썬 sort 는 안정정렬).

    ⚠️ 같은 기사를 두 번 뽑지 않는다. 발행항목에는 실제로 중복 행이 있다
       (2026-08-27 실측: W35 published 안에 같은 출처URL 이 2종·각 2회).
       중복을 그대로 두면 딥다이브 9칸 중 두 칸을 같은 글이 먹는다.
    """
    per_category = PER_CATEGORY if per_category is None else per_category
    picked, seen = [], set()
    for category in ("tech", "finance", "economy"):
        pool = [i for i in sorted(scores)
                if DOMAIN_CATEGORY.get((rows[i].get("분야") or "").strip()) == category]
        pool.sort(key=lambda i: -(scores[i]["lead"] + scores[i]["reach"]))
        taken = 0
        for i in pool:
            if taken >= per_category:
                break
            key = dedupe_key(rows[i])
            if key in seen:
                continue
            seen.add(key)
            picked.append(i)
            taken += 1
    return picked


# '1줄: ' 같은 형식 라벨. 콜론을 반드시 요구한다 — 없으면 '3줄 요약을 보면...' 같은
# 정상 문장의 앞머리를 잘라먹는다.
_FORMAT_LABEL = re.compile(r"^\s*(?:[-*•]\s*)?(?:\d\s*줄|line\s*\d)\s*[:：]\s*", re.I)


def strip_format_label(text):
    """모델이 본문 앞에 붙인 형식 라벨을 걷어낸다.

    ⚠️ 프롬프트 스키마에 ["1줄","2줄","3줄"] 이라고 적어 뒀더니 모델이 그 라벨을 값 앞에
       그대로 붙여 내보내는 회차가 있었다(2026-08-31 W36: 9건 중 2건이 '1줄: ...').
       각 카테고리 1순위 카드라 눈에 띄는 자리였고 손으로 지워서 발송했다.
       스키마 문구는 아래에서 고쳤지만 **형식은 회차마다 흔들리므로** 파싱에서도 막는다.
    """
    return _FORMAT_LABEL.sub("", str(text or "")).strip()


def build_deepdive(row, chat=None):
    """선정된 1건 → (3줄 요약, 관전 포인트). 실패하면 ('', '') — 점수만 남는다."""
    chat = chat or ai.chat
    system = ("당신은 주간 투자 브리핑의 애널리스트입니다. 주어진 신호의 **메커니즘**을 3줄로 "
              "설명하고, 다음 주에 확인할 관전 포인트를 1줄로 씁니다. 원문에 없는 수치·기업명을 "
              "지어내지 마세요. 매수·매도·목표가를 권유하지 마세요. JSON 객체만 반환하세요. "
              "각 값에 '1줄:' 같은 번호·라벨을 붙이지 말고 문장만 쓰세요.")
    user = json.dumps({
        "domain": row.get("분야", ""), "title": row.get("제목ko", ""), "line": row.get("한줄ko", ""),
        "source_title": row.get("원문제목", ""), "value_chain": row.get("밸류체인", ""),
        # ⚠️ 여기에 ["1줄","2줄","3줄"] 처럼 **따라 쓸 수 있는 라벨**을 두지 않는다.
        #    모델이 그것을 값의 일부로 착각해 본문 앞에 붙인다(2026-08-31 실제).
        "required": {"lines": "메커니즘을 설명하는 문장 3개의 배열",
                     "watch": "다음 주에 확인할 관전 포인트 한 문장"},
    }, ensure_ascii=False)
    text, engine = chat(system, user, max_tokens=700, temperature=0.2, min_chars=120)
    obj = parse_object(text)
    if not obj or not engine:
        print("[deepdive] 본문 생성 실패: %s" % str(row.get("제목ko", ""))[:30])
        return "", ""
    lines = [s for s in (strip_format_label(x) for x in (obj.get("lines") or [])) if s]
    return "\n".join(lines[:3]), strip_format_label(obj.get("watch", ""))


def post_rows(tab, rows):
    url = os.environ.get("WEEKLY_WEBAPP_URL", "").strip()
    if not url:
        raise RuntimeError("WEEKLY_WEBAPP_URL 없음")
    payload = {"token": os.environ.get("WEEKLY_WEBAPP_TOKEN", ""), "tab": tab, "rows": rows}
    req = urllib.request.Request(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as response:
        body = response.read().decode("utf-8", "replace")
    if '"ok":true' not in body.replace(" ", ""):
        raise RuntimeError("webapp %s" % body[:200])
    return body


def check_header(header):
    """시트 헤더가 DEEPDIVE_FIELDS 와 같은지. 다르면 사유 문자열, 같으면 ''.

    ⚠️ market/Code.gs 웹앱은 헤더 이름으로 매핑하므로(row[h]), 이름이 한 글자라도
       다르면 그 열만 **조용히 빈 채로** 기록된다. 에러도 경고도 없다.
       실제로 첫 생성 때 '딥다이브KO' 로 만들어져 있었다(2026-08-27).
    """
    if not header:
        return "헤더를 읽지 못했다(탭이 비었거나 게시가 안 됨)"
    missing = [f for f in DEEPDIVE_FIELDS if f not in header]
    extra = [h for h in header if h and h not in DEEPDIVE_FIELDS]
    if missing or extra:
        return "시트 헤더 불일치 — 없음:[%s] 예상밖:[%s]" % (", ".join(missing), ", ".join(extra))
    return ""


def already_done(existing, issue, revision):
    """이 호·리비전이 이미 채점됐나. 한 호에 한 번만 돈다(재실행 안전)."""
    return any(str(r.get("issue_key", "")).strip() == issue
               and str(r.get("revision", "")).strip() == str(revision) for r in existing)


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="선정 결과만 출력하고 시트에 쓰지 않는다")
    parser.add_argument("--force", action="store_true", help="이미 채점된 호도 다시 채점한다")
    args = parser.parse_args(argv)

    items_csv = os.environ.get("WEEKLY_RELEASE_ITEMS_CSV", "").strip()
    if not items_csv:
        print("[ERROR] WEEKLY_RELEASE_ITEMS_CSV 없음")
        return 2

    issue, revision, rows = pick_issue(fetch_csv(items_csv))
    if not rows:
        print("[deepdive] ready 항목 없음 — 생략(발행 예약 전이거나 이미 발송됨)")
        return 0
    expected = issue_key_kst()
    if issue != expected:
        print("[deepdive] ⚠️ 데이터의 호 %s 가 오늘 기준 예상 호 %s 와 다름 — 데이터를 따른다"
              % (issue, expected))

    deepdive_csv = os.environ.get("WEEKLY_DEEPDIVE_CSV", "").strip()
    if not deepdive_csv:
        # 여기서 멈추면 기능이 아예 안 돌므로 통과시키되(fail-open), 조용히 넘어가지 않는다 —
        # 재실행 때마다 같은 호가 다시 채점돼 시트에 중복 행이 쌓인다.
        print("[deepdive] ⚠️ WEEKLY_DEEPDIVE_CSV 미설정 — 재실행 방지 없이 진행한다")
    existing = fetch_csv(deepdive_csv) if deepdive_csv else []
    if deepdive_csv:
        # 채점을 다 하고 나서 빈 열을 발견하면 LLM 호출이 통째로 낭비된다. 먼저 본다.
        problem = check_header(list(existing[0].keys()) if existing else fetch_header(deepdive_csv))
        if problem:
            print("[ERROR] %s" % problem)
            print("        웹앱은 헤더 이름으로 매핑해서 이름이 다르면 그 열이 조용히 빈다.")
            return 2
    if not args.force and already_done(existing, issue, revision):
        print("[deepdive] %s rev%s 이미 채점됨 — 생략(--force 로 재실행)" % (issue, revision))
        return 0

    scores = score_rows(rows)
    if not scores:
        print("[ERROR] %s 채점 결과 0건 — 시트에 쓰지 않는다" % issue)
        return 1
    picked = select(rows, scores)
    print("[deepdive] %s rev%s 채점 %d/%d건 · 선정 %d건"
          % (issue, revision, len(scores), len(rows), len(picked)))

    now = datetime.now(KST).isoformat(timespec="seconds")
    out = []
    for i in picked:
        row, s = rows[i], scores[i]
        body, watch = ("", "") if args.dry_run else build_deepdive(row)
        out.append({
            "issue_key": issue, "revision": str(revision), "분야": row.get("분야", ""),
            "출처URL": row.get("출처URL", ""),
            "영향도": str(round((s["lead"] + s["reach"]) / 2)),
            "선행성": str(s["lead"]), "파급범위": str(s["reach"]),
            "딥다이브ko": body, "관전포인트": watch, "근거": s["why"],
            "엔진": s["engine"], "created_at": now,
        })
        print("  [%-9s] 영향도 %s (선행 %d · 파급 %d) %s"
              % (row.get("분야", ""), out[-1]["영향도"], s["lead"], s["reach"],
                 str(row.get("제목ko", ""))[:34]))
    if args.dry_run:
        print("[deepdive] dry-run — 시트에 쓰지 않음")
        return 0
    post_rows(DEEPDIVE_TAB, out)
    print("[deepdive] %s 딥다이브 %d건 기록" % (issue, len(out)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
