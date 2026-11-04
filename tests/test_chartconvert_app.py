"""ChartConvert 앱의 요청 차단과 공개 전 규칙. git·렌더 없이 돈다.
실행: python tests/test_chartconvert_app.py
"""
import http.client
import json
import os
import pathlib
import socket
import sys
import threading
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "ChartConvert"))
with socket.socket() as s:  # 실제 앱과 겹치지 않는 빈 포트
    s.bind(("127.0.0.1", 0))
    os.environ["CHARTCONVERT_PORT"] = str(s.getsockname()[1])
import app  # noqa: E402
import convert  # noqa: E402

MD = """# 제목

첫 문단.
"""
SELF = "http://127.0.0.1:%d" % app.PORT


def start():
    server = ThreadingHTTPServer(("127.0.0.1", app.PORT), app.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def call(path, body=None, headers=None, method="POST"):
    conn = http.client.HTTPConnection("127.0.0.1", app.PORT, timeout=10)
    sent = {"Content-Type": "application/json", "Origin": SELF, "Host": "127.0.0.1:%d" % app.PORT}
    sent.update(headers or {})
    data = json.dumps(body or {}).encode() if method == "POST" else None
    conn.request(method, path, data, sent)
    res = conn.getresponse()
    raw = res.read()
    conn.close()
    return res.status, raw


def test_other_site_cannot_post():
    assert call("/api/publish", {"confirmed": True}, {"Origin": "https://evil.example"})[0] == 403


def test_missing_origin_cannot_post():
    conn = http.client.HTTPConnection("127.0.0.1", app.PORT, timeout=10)
    conn.request("POST", "/api/publish", b"{}", {"Content-Type": "application/json"})
    assert conn.getresponse().status == 403
    conn.close()


def test_rebinding_host_is_refused():
    assert call("/", headers={"Host": "evil.example"}, method="GET")[0] == 403


def test_form_post_is_refused():
    assert call("/api/publish", {}, {"Content-Type": "text/plain"})[0] == 415


def test_oversized_upload_is_refused():
    conn = http.client.HTTPConnection("127.0.0.1", app.PORT, timeout=10)
    conn.putrequest("POST", "/api/preview", skip_host=True)
    conn.putheader("Host", "127.0.0.1:%d" % app.PORT)
    conn.putheader("Origin", SELF)
    conn.putheader("Content-Type", "application/json")
    conn.putheader("Content-Length", str(app.MAX_BODY + 1))
    conn.endheaders()
    assert conn.getresponse().status == 413
    conn.close()


def test_page_and_favicon_load():
    status, body = call("/", method="GET")
    assert status == 200 and "ChartConvert".encode() in body
    assert call("/favicon.svg", method="GET")[0] == 200


def test_preview_without_charts_warns():
    status, raw = call("/api/preview", {"text": MD, "filename": "report_2026.md"})
    data = json.loads(raw)
    assert status == 200
    assert data["title"] == "제목" and data["abstract"] == "첫 문단."
    assert data["slug"] == "report-2026" and data["charts"] == 0
    assert len(data["warnings"]) == 2


def test_empty_file_is_an_error():
    status, raw = call("/api/preview", {"text": "  ", "filename": "a.md"})
    assert status == 400 and "빈 파일" in json.loads(raw)["error"]


def test_korean_filename_gives_empty_slug():
    assert app.suggest_slug("미국 재정.md") == ""


def test_publish_needs_confirmation():
    status, raw = call("/api/publish", {"text": MD, "slug": "x", "category": "경제"})
    assert status == 400 and "체크" in json.loads(raw)["error"]


def test_publish_rejects_bad_slug_before_any_write():
    before = set(convert.REPORTS.iterdir())
    status, _ = call("/api/publish", {"text": MD, "slug": "../x", "category": "경제", "confirmed": True})
    assert status == 400 and set(convert.REPORTS.iterdir()) == before


def test_publish_requires_category_without_front_matter():
    status, raw = call("/api/publish", {"text": MD, "slug": "x", "category": "", "confirmed": True})
    assert status == 400 and "category" in json.loads(raw)["error"]


def test_existing_report_needs_overwrite():
    name = next(convert.REPORTS.glob("*.md")).stem
    month, slug = name[:7], name[8:]
    real = convert.datetime.datetime
    fm = "---\ntitle: t\ncategory: 경제\n---\n# t\n"

    class Fixed(real):
        @classmethod
        def now(cls, tz=None):
            return real(int(month[:4]), int(month[5:]), 15, tzinfo=tz)

    convert.datetime.datetime = Fixed
    try:
        status, raw = call("/api/publish", {"text": fm, "slug": slug, "category": "경제", "confirmed": True})
    finally:
        convert.datetime.datetime = real
    assert status == 409 and json.loads(raw)["needs_overwrite"] is True


if __name__ == "__main__":
    server = start()
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    server.shutdown()
    print("%d passed" % len(tests))
