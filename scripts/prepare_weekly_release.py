#!/usr/bin/env python3
"""화요일 마감 후 주간 호를 조건부 자동 준비한다."""
import csv
import hashlib
import io
import json
import os
import re
import sys
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
    text, engine = ai.chat(system, user, max_tokens=350, temperature=0, exclude_engines={generator})
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


def post_rows(tab, rows):
    url = os.environ.get("WEEKLY_WEBAPP_URL", "").strip()
    if not url:
        raise RuntimeError("WEEKLY_WEBAPP_URL 없음")
    payload = {"token": os.environ.get("WEEKLY_WEBAPP_TOKEN", ""), "tab": tab, "rows": rows}
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read().decode("utf-8", "replace")
        if response.status >= 300:
            raise RuntimeError("POST %s %s" % (response.status, body[:200]))
        print("[write] %s: %s" % (tab, body[:160]))


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
        post_rows("주간-발행", [ledger_row])
        print("[release] %s skipped" % issue)
        return 0
    items = []
    for row, ev in accepted:
        item = {k: row.get(k, "") for k in ITEM_FIELDS}
        item.update({"issue_key": issue, "revision": "1", "검수점수": str(int(ev["score"])), "검수사유": str(ev.get("reason", "")), "상태": "ready", "published_at": "", "updated_at": now})
        items.append(item)
    digest = content_hash(items)
    post_rows("주간-발행항목", items)
    ledger_row = {"issue_key": issue, "state": "auto_ready", "revision": "1", "manual_confirmed": "false", "auto_mode": "true", "published_at": "", "emailed_at": "", "content_hash": digest, "updated_at": now, "message": "자동 검수 통과 %d건 [%s]; 제외 %d건 (%s)" % (len(items), tally([i["분야"] for i in items]), len(rejected), reasons)}
    post_rows("주간-발행", [ledger_row])
    print("[release] %s auto_ready %d건 [%s]" % (issue, len(items), tally([i["분야"] for i in items])))
    print("[release] 제외 %d건 (%s)" % (len(rejected), reasons))
    return 0


if __name__ == "__main__":
    sys.exit(main())
