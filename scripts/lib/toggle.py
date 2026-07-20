"""파이프라인 실행 토글 — BSL_market 'settings' 탭의 pipeline_enabled 값 확인.

운영자 관리자 콘솔(admin/Code.gs)이 'settings' 탭에 pipeline_enabled를 쓰고,
수집 파이프(fetch_weekly.py / fetch_market.py)가 진입부에서 이 값을 읽어 중지 여부를 판단한다.
전역 CLAUDE.md §15(수집·발송 자동화 Stop/Run 토글) 준수.

fail-open 원칙: env SETTINGS_CSV 미설정 · 네트워크 실패 · 키 부재는 모두 '활성'으로 간주한다.
오직 pipeline_enabled 값이 정확히 '0'일 때만 중지한다.
(콘솔 admin/Code.gs의 getPipelineEnabled와 동일 규칙: 미설정 != '0' → 활성)

설정: 'settings' 탭을 웹게시(CSV) → 그 URL을 Actions Secret SETTINGS_CSV로.
'settings' 탭 헤더: key · value  (콘솔이 자동 생성).
"""
import csv
import io
import os
import urllib.request

UA = "Mozilla/5.0 (BriefingSignalLab/1.0)"


def pipeline_enabled():
    """수집 파이프 실행 가능 여부. fail-open(불확실하면 True)."""
    url = os.environ.get("SETTINGS_CSV", "").strip()
    if not url:
        return True  # 미설정 = 활성
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            txt = r.read().decode("utf-8", "replace")
    except Exception:
        return True  # 못 읽으면 활성(fail-open)
    rows = list(csv.reader(io.StringIO(txt)))
    if not rows:
        return True
    header = [c.strip().lower() for c in rows[0]]
    try:
        ki, vi = header.index("key"), header.index("value")
    except ValueError:
        ki, vi = 0, 1  # 헤더 없는 단순 2열도 허용
    for row in rows[1:]:
        if len(row) > max(ki, vi) and row[ki].strip() == "pipeline_enabled":
            return row[vi].strip() != "0"
    return True  # 키 없으면 활성
