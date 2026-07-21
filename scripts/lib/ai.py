#!/usr/bin/env python3
"""Briefing Signal Lab — AI 엔진 (DeepSeek 주력 → Gemini 폴백).

OpenAI 호환 chat/completions 엔드포인트로 두 엔진을 통일 호출. stdlib(urllib)만 사용.
키는 환경변수에서 읽는다(워크플로에서 DATA_GO_DEEPSEEK/DATA_GO_GEMINI를 아래 이름으로 매핑):
    DEEPSEEK_API_KEY, GEMINI_API_KEY
모델은 환경변수로 덮어쓸 수 있다: DEEPSEEK_MODEL, GEMINI_MODEL

사용:
    from lib.ai import chat
    text, engine = chat(system, user)   # 실패 시 (None, None)

키 동작 확인(Actions에서):
    python scripts/lib/ai.py --test
"""
import csv
import io
import json
import os
import sys
import urllib.request
import urllib.error

# (이름, base_url, 기본 모델, 키 환경변수)
ENGINES = [
    ("deepseek", "https://api.deepseek.com", os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"), "DEEPSEEK_API_KEY"),
    ("gemini", "https://generativelanguage.googleapis.com/v1beta/openai", os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"), "GEMINI_API_KEY"),
]

# §6 무인 가드레일 시스템 프롬프트(모든 시장/종목 생성에 공용).
GUARD_SYSTEM = (
    "당신은 한국어 금융·기술 브리핑 어시스턴트입니다. 반드시 지킬 것:\n"
    "1) 투자 조언 금지: 매수·매도·목표가·비중·매집·베팅 등 투자판단 표현을 절대 쓰지 마세요.\n"
    "2) 밸류체인 기업 언급은 '관찰'로만. 주가 방향·수급 단정 금지.\n"
    "3) 사실·메커니즘·출처 중심. 모르면 지어내지 말고 비워두세요.\n"
    "4) 간결하게. 정보 제공이며 투자 조언이 아닙니다."
)


def _post(url, key, payload, timeout=40):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _get_primary():
    """settings 탭 CSV(env SETTINGS_CSV)에서 llm_primary 읽기. 운영자 콘솔이 씀.
    없거나 실패하면 None(기본 순서=ENGINES 그대로, deepseek 주력). fail-open."""
    url = os.environ.get("SETTINGS_CSV", "").strip()
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BriefingSignalLab/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            rows = list(csv.reader(io.StringIO(r.read().decode("utf-8", "replace"))))
    except Exception:
        return None
    if not rows:
        return None
    header = [c.strip().lower() for c in rows[0]]
    ki, vi = (header.index("key"), header.index("value")) if ("key" in header and "value" in header) else (0, 1)
    for row in rows[1:]:
        if len(row) > max(ki, vi) and row[ki].strip() == "llm_primary":
            return row[vi].strip() or None
    return None


_ORDER = None


def _engines_ordered():
    """콘솔 선택(llm_primary)을 주력으로 앞세운 엔진 목록. 프로세스당 1회만 settings 읽음."""
    global _ORDER
    if _ORDER is None:
        primary = _get_primary()
        if primary and any(e[0] == primary for e in ENGINES):
            _ORDER = ([e for e in ENGINES if e[0] == primary] +
                      [e for e in ENGINES if e[0] != primary])
            print("[ai] 주력 엔진 = %s (운영자 콘솔 선택)" % primary)
        else:
            _ORDER = list(ENGINES)
    return _ORDER


def chat(system, user, max_tokens=700, temperature=0.3):
    """엔진 순서대로 시도. (text, engine_name) 반환. 전부 실패면 (None, None)."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    for name, base, model, keyvar in _engines_ordered():
        key = os.environ.get(keyvar, "").strip()
        if not key:
            print("[ai] %s 키(%s) 없음. 건너뜀" % (name, keyvar))
            continue
        try:
            j = _post(base + "/chat/completions", key, {
                "model": model, "messages": messages,
                "max_tokens": max_tokens, "temperature": temperature,
            })
            text = (j.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
            if text:
                print("[ai] %s(%s) 응답 %d자" % (name, model, len(text)))
                return text, name
            print("[ai] %s 빈 응답. 폴백" % name)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:200]
            print("[ai] %s HTTP %s: %s" % (name, e.code, body))
        except Exception as e:
            print("[ai] %s 실패: %s" % (name, e))
    return None, None


def _test():
    # guard는 같은 폴더에 있음(scripts/lib). 실행 시 sys.path[0]=scripts/lib.
    try:
        import guard
    except Exception:
        guard = None
    user = ("다음 사실을 2문장으로 요약해 주세요(투자판단 표현 없이, 관찰·메커니즘 중심): "
            "삼성전자가 OFC 2026에서 실리콘 포토닉스 파운드리 진입을 발표했고 224Gbps 변조기를 시연했다.")
    text, engine = chat(GUARD_SYSTEM, user)
    if not text:
        print("TEST FAIL: 두 엔진 모두 응답 없음 (키/모델/네트워크 확인)")
        return 1
    print("--- 엔진:", engine, "---")
    print(text)
    if guard:
        clean, hits = guard.screen(text)
        print("--- §6 린트: clean=%s hits=%s ---" % (clean, hits))
    print("TEST OK")
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        sys.exit(_test())
    print("usage: ai.py --test")
