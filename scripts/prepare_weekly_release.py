#!/usr/bin/env python3
"""화요일 마감 후 주간 호를 조건부 자동 준비한다."""
import csv
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import ai
import guard

KST = timezone(timedelta(hours=9))
MIN_SCORE = float(os.environ.get("WEEKLY_MIN_SCORE", "85"))
MIN_CONFIDENCE = float(os.environ.get("WEEKLY_MIN_CONFIDENCE", "0.85"))
FRESH_DAYS = int(os.environ.get("WEEKLY_FRESH_DAYS", "10"))
# 30초는 짧았다 — 2026-08-31 에 88행 POST 가 응답 대기 중 끊겼다(시트에는 기록됨).
# 발송까지 버퍼가 몇 시간 있으므로 넉넉히 기다리는 편이 반쪽 상태로 죽는 것보다 낫다.
POST_TIMEOUT = int(os.environ.get("WEEKLY_POST_TIMEOUT", "120"))
READY_STATES = {"manual_ready", "auto_ready", "published", "email_partial", "emailed", "skipped"}
ITEM_FIELDS = ["issue_key", "revision", "분야", "발행주", "유형", "제목ko", "제목en", "한줄ko", "한줄en", "밸류체인", "출처URL", "원문제목", "원문일시", "검수점수", "검수사유", "상태", "published_at", "updated_at"]


def issue_key_kst(now=None):
    now = now or datetime.now(KST)
    days = (1 - now.weekday()) % 7
    return (now + timedelta(days=days)).strftime("%G-W%V")


def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "BriefingSignalLab/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        text = response.read().decode("utf-8-sig", "replace")
    return list(csv.DictReader(io.StringIO(text)))


def parse_dt(value):
    value = (value or "").strip()
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def title_key(value):
    return re.sub(r"[^0-9a-z가-힣]+", "", (value or "").lower())


def base_gates(row, now):
    reasons = []
    url = (row.get("출처URL") or "").strip()
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        reasons.append("source_url")
    if not (row.get("원문제목") or "").strip():
        reasons.append("source_title")
    source_dt = parse_dt(row.get("원문일시"))
    if not source_dt:
        reasons.append("source_date")
    else:
        if source_dt.tzinfo is None:
            source_dt = source_dt.replace(tzinfo=timezone.utc)
        if source_dt < now.astimezone(timezone.utc) - timedelta(days=FRESH_DAYS) or source_dt > now.astimezone(timezone.utc) + timedelta(days=1):
            reasons.append("freshness")
    blob = " ".join(str(row.get(k) or "") for k in ("제목ko", "제목en", "한줄ko", "한줄en", "밸류체인"))
    clean, hits = guard.screen(blob)
    if not clean:
        reasons.append("guard:" + ",".join(hits))
    if not (row.get("생성엔진") or "").strip():
        reasons.append("generator_engine")
    return reasons


def parse_object(text):
    text = (text or "").strip()
    if text.startswith("~~~"):
        text = text.strip("~")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        obj = json.loads(text[start:end + 1])
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def evaluate_row(row):
    generator = (row.get("생성엔진") or "").strip()
    system = ("당신은 생성기와 독립된 주간 브리핑 검수자입니다. 원문 제목과 후보 카드만 비교합니다. "
              "추측하지 말고 JSON 객체만 반환하세요. score는 0~100, classification_confidence는 0~1입니다.")
    user = json.dumps({
        "domain": row.get("분야"), "source_title": row.get("원문제목"),
        "candidate_title": row.get("제목ko"), "candidate_line": row.get("한줄ko"),
        "value_chain": row.get("밸류체인"),
        "required": {"score": "0..100", "critical": "boolean", "fact_match": "boolean", "predicted_domain": "one domain id", "classification_confidence": "0..1", "reason": "short"}
    }, ensure_ascii=False)
    # min_chars: 요구한 JSON 객체(score·critical·fact_match·predicted_domain·confidence·reason)는
    # 최소 60자다. 그보다 짧으면 잘린 것이라 파싱에 실패해 independent_evaluator 로 떨어지는데,
    # 그러면 '검수 엔진 고장'과 '내용 탈락'이 같은 사유로 뭉개진다. 짧으면 다음 엔진에 넘긴다.
    text, engine = ai.chat(system, user, max_tokens=350, temperature=0,
                           exclude_engines={generator}, min_chars=60)
    obj = parse_object(text)
    if not obj or not engine or engine == generator:
        return None, "independent_evaluator"
    try:
        score = float(obj.get("score", 0))
        confidence = float(obj.get("classification_confidence", 0))
    except (TypeError, ValueError):
        return None, "invalid_evaluation"
    predicted = str(obj.get("predicted_domain", "")).strip()
    passed = (score >= MIN_SCORE and confidence >= MIN_CONFIDENCE and obj.get("fact_match") is True
              and obj.get("critical") is False and predicted == str(row.get("분야") or "").strip())
    obj["score"] = score
    obj["classification_confidence"] = confidence
    obj["evaluator_engine"] = engine
    return obj, "" if passed else "evaluation_gate"


def prior_keys(items, issue_key):
    """지난 호에 이미 발행된 기사 키(출처URL·정규화 원문제목). 같은 기사의 주 넘김 재게재를 막는다."""
    keys = set()
    for row in items:
        if (row.get("issue_key") or "").strip() == issue_key:
            continue
        url = (row.get("출처URL") or "").strip().lower()
        if url:
            keys.add(url)
        key = title_key(row.get("원문제목"))
        if key:
            keys.add(key)
    return keys


def select_candidates(rows, issue_key, now=None, evaluator=evaluate_row, prior=None):
    now = now or datetime.now(KST)
    prior = prior or set()
    candidates = [r for r in rows if (r.get("발행주") or "").strip() == issue_key and (r.get("status") or "draft").strip().lower() != "rejected"]
    seen_url, seen_title, accepted, rejected = set(), set(), [], []
    for row in candidates:
        reasons = base_gates(row, now)
        url = (row.get("출처URL") or "").strip().lower()
        title = title_key(row.get("원문제목") or row.get("제목ko"))
        if url in seen_url or (title and title in seen_title):
            reasons.append("duplicate")
        if (url and url in prior) or (title and title in prior):
            reasons.append("duplicate_prior_issue")
        seen_url.add(url)
        if title:
            seen_title.add(title)
        evaluation = None
        if not reasons:
            evaluation, reason = evaluator(row)
            if reason:
                reasons.append(reason)
        if reasons:
            rejected.append({"title": row.get("제목ko", ""), "reasons": reasons})
            continue
        accepted.append((row, evaluation))
    return accepted, rejected


def tally(values):
    """'키 n, 키 n' 요약 문자열. 운영자가 원장 message만 보고 분야/탈락사유를 파악하게 한다."""
    counts = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return ", ".join("%s %d" % (k, counts[k]) for k in sorted(counts))


def content_hash(items):
    payload = json.dumps(items, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def stamped_rows(csv_url, issue_key, stamp):
    """게시 CSV 에서 (issue_key, updated_at=stamp) 인 행 수. 조회 실패는 -1."""
    try:
        rows = fetch_csv(csv_url)
    except Exception as e:                                  # noqa: BLE001 - 조회 실패와 0건은 다르다
        print("[verify] CSV 조회 실패: %s" % e)
        return -1
    return sum(1 for r in rows
               if (r.get("issue_key") or "").strip() == issue_key
               and (r.get("updated_at") or "").strip() == stamp)


def written_despite_timeout(csv_url, issue_key, stamp, expected, attempts=6, wait=30):
    """타임아웃 뒤 실제 기록 여부를 게시 CSV 로 확인한다.

    ⚠️ 게시 CSV 스냅샷은 몇 분 늦게 갱신된다. 한 번 보고 0건이라고 판단하면 안 된다.
    updated_at 을 이번 실행의 stamp 로 맞춰 세므로 과거 행이나 중복 재실행분이 섞이지 않는다.
    """
    for i in range(attempts):
        time.sleep(15 if i == 0 else wait)
        n = stamped_rows(csv_url, issue_key, stamp)
        print("[verify] %s %s: %s건 / 기대 %d건 (%d/%d)"
              % (issue_key, stamp, "조회실패" if n < 0 else n, expected, i + 1, attempts))
        if n >= expected:
            return True
    return False


def post_rows(tab, rows, verify=None):
    """시트 탭에 append 한다.

    verify=(csv_url, issue_key, stamp, expected) 를 주면 **타임아웃일 때만** 실제 기록
    여부를 확인한다.

    ⚠️ 타임아웃은 "안 써졌다"가 아니다. Apps Script 가 다 쓰고 응답만 늦는 경우가 있다.
       2026-08-31 W36 에서 항목 88행이 시트에 기록됐는데 30초에 끊겨 스크립트가 죽었고,
       뒤따르는 원장 POST 가 아예 실행되지 못했다. 그 결과 '항목만 있고 원장이 없는' 반쪽
       상태가 됐는데, 그게 하필 mailer 의 weeklyLatestBundle_ 이 조용히 null 을 반환하는
       조건이라 그 호가 통째로 사라질 뻔했다(운영자가 발행 예약을 눌러 수습).
       그래서 타임아웃에 **재전송하지 않는다** — 재전송하면 같은 행이 두 번 들어간다.
       확인해서 기록됐으면 그대로 다음 단계로 넘어가고, 정말 안 됐을 때만 실패시킨다.
    """
    url = os.environ.get("WEEKLY_WEBAPP_URL", "").strip()
    if not url:
        raise RuntimeError("WEEKLY_WEBAPP_URL 없음")
    payload = {"token": os.environ.get("WEEKLY_WEBAPP_TOKEN", ""), "tab": tab, "rows": rows}
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=POST_TIMEOUT) as response:
            body = response.read().decode("utf-8", "replace")
            if response.status >= 300:
                raise RuntimeError("POST %s %s" % (response.status, body[:200]))
            print("[write] %s: %s" % (tab, body[:160]))
            return
    except (TimeoutError, urllib.error.URLError) as e:
        if not verify:
            raise
        print("[write] %s 응답 없음(%s) — 기록 여부 확인" % (tab, e))
        if not written_despite_timeout(*verify):
            raise
        print("[write] %s: 응답은 없었지만 기록 확인됨 — 재전송 없이 계속" % tab)


def main():
    draft_url = os.environ.get("WEEKLY_DRAFT_CSV", "").strip()
    ledger_url = os.environ.get("WEEKLY_RELEASE_CSV", "").strip()
    if not draft_url or not ledger_url:
        print("[ERROR] WEEKLY_DRAFT_CSV/WEEKLY_RELEASE_CSV 필요(원장 미확인 시 fail-closed)")
        return 2
    issue = issue_key_kst()
    ledger = fetch_csv(ledger_url)
    current = [r for r in ledger if (r.get("issue_key") or "").strip() == issue]
    if any((r.get("state") or "").strip() in READY_STATES for r in current):
        print("[release] %s 이미 준비/처리됨 - no-op" % issue)
        return 0
    prior = set()
    items_url = os.environ.get("WEEKLY_RELEASE_ITEMS_CSV", "").strip()
    if items_url:
        try:
            prior = prior_keys(fetch_csv(items_url), issue)
        except Exception as e:
            print("[release] 발행항목 조회 실패(과거 호 중복 대조 생략): %s" % e)
    else:
        print("[release] WEEKLY_RELEASE_ITEMS_CSV 미설정 - 과거 호 중복 대조 생략")
    accepted, rejected = select_candidates(fetch_csv(draft_url), issue, prior=prior)
    now = datetime.now(KST).isoformat(timespec="seconds")
    reasons = tally([r for x in rejected for r in x["reasons"]])
    if not accepted:
        ledger_row = {"issue_key": issue, "state": "skipped", "revision": "1", "manual_confirmed": "false", "auto_mode": "true", "published_at": "", "emailed_at": "", "content_hash": "", "updated_at": now, "message": "통과 0건; 제외 %d건 (%s)" % (len(rejected), reasons)}
        post_rows("주간-발행", [ledger_row], verify=(ledger_url, issue, now, 1))
        print("[release] %s skipped" % issue)
        return 0
    items = []
    for row, ev in accepted:
        item = {k: row.get(k, "") for k in ITEM_FIELDS}
        item.update({"issue_key": issue, "revision": "1", "검수점수": str(int(ev["score"])), "검수사유": str(ev.get("reason", "")), "상태": "ready", "published_at": "", "updated_at": now})
        items.append(item)
    digest = content_hash(items)
    # ⚠️ 항목 → 원장 순서이고, 항목에서 죽으면 원장이 안 써져 그 호가 조용히 사라진다.
    #    (mailer weeklyLatestBundle_ 이 rev.1 원장을 못 찾으면 null 을 반환하고 발송을 생략한다)
    #    그래서 항목 POST 는 타임아웃 시 재확인까지 하고 넘어간다.
    post_rows("주간-발행항목", items,
              verify=(items_url, issue, now, len(items)) if items_url else None)
    ledger_row = {"issue_key": issue, "state": "auto_ready", "revision": "1", "manual_confirmed": "false", "auto_mode": "true", "published_at": "", "emailed_at": "", "content_hash": digest, "updated_at": now, "message": "자동 검수 통과 %d건 [%s]; 제외 %d건 (%s)" % (len(items), tally([i["분야"] for i in items]), len(rejected), reasons)}
    post_rows("주간-발행", [ledger_row], verify=(ledger_url, issue, now, 1))
    print("[release] %s auto_ready %d건 [%s]" % (issue, len(items), tally([i["분야"] for i in items])))
    print("[release] 제외 %d건 (%s)" % (len(rejected), reasons))
    return 0


if __name__ == "__main__":
    sys.exit(main())
