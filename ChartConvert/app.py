#!/usr/bin/env python3
"""ChartConvert 로컬 앱. 원고 .md 를 올려 미리보기하고 서재에 공개한다.

127.0.0.1 전용. POST 는 Host·Origin 이 이 앱일 때만 받는다. 브라우저에서 다른 사이트가
공개 API 를 호출하지 못하게 하기 위해서다.
"""
import base64
import json
import os
import pathlib
import re
import socket
import sys
import threading
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import convert

HERE = pathlib.Path(__file__).resolve().parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
PORT = int(os.environ.get("CHARTCONVERT_PORT", CONFIG["port"]))
SITE_URL = CONFIG["site_url"].rstrip("/")
MAX_BODY = 2 * 1024 * 1024  # 원고는 수십 KB 다. 그보다 훨씬 크면 잘못 올린 파일이다.
PUBLISH_LOCK = threading.Lock()
STATIC = {
    "/": ("app.html", "text/html; charset=utf-8"),
    "/favicon.svg": ("favicon.svg", "image/svg+xml"),
}


def suggest_slug(filename):
    """파일 이름에서 후보를 만든다. 한글 이름이면 빈 값이고 사용자가 채운다."""
    stem = pathlib.PurePath(filename or "").stem.lower()
    return re.sub(r"[^a-z0-9]+", "-", stem).strip("-") if stem.isascii() else ""


def preview(data):
    text = data.get("text") or ""
    if not text.strip():
        raise convert.ConvertError("빈 파일입니다.")
    front, body = convert.check_draft(text)
    blocks = convert.find_blocks(body)
    pngs = convert.render_png(blocks) if blocks else []
    h1 = re.search(r"^#\s+(.+)$", body, re.M)
    title = convert.front_value(front, "title") or (h1.group(1).strip() if h1 else "")
    if not title:
        raise convert.ConvertError("제목이 없습니다. 원고 맨 위에 # 제목 을 넣어 주세요.")
    abstract = convert.front_value(front, "abstract")
    if not abstract:
        try:
            abstract = convert.front_value(convert.build_front_matter(body, "경제", "", []), "abstract")
        except convert.ConvertError:
            abstract = ""
    tags = convert.front_value(front, "tags").strip("[]")
    doc_type = convert.front_value(front, "type") or "report"
    warnings = []
    if not blocks:
        warnings.append("mermaid 차트가 없습니다. 글만 공개됩니다.")
    if doc_type == "report" and "출처" not in body:
        warnings.append("원고에 '출처'가 없습니다. 수치의 근거를 적어 두세요.")
    return {
        "title": title, "abstract": abstract, "category": convert.front_value(front, "category"),
        "doc_type": doc_type, "tags": tags, "has_front": front is not None,
        "slug": suggest_slug(data.get("filename")),
        "charts": len(pngs), "warnings": warnings,
        "images": ["data:image/png;base64," + base64.b64encode(p).decode() for p in pngs],
    }


def publish(data):
    if data.get("confirmed") is not True:
        raise convert.ConvertError("원고의 수치와 출처를 확인했다는 항목을 체크해 주세요.")
    tags = [t.strip() for t in (data.get("tags") or "").split(",") if t.strip()]
    job = convert.prepare(data.get("text") or "", data.get("slug"), data.get("category"), tags,
                          allow_no_charts=True, doc_type=data.get("doc_type") or "report")
    taken = convert.taken_files(job)
    if taken and data.get("overwrite") is not True:
        return 409, {"needs_overwrite": True, "files": taken}
    if not PUBLISH_LOCK.acquire(blocking=False):
        raise convert.ConvertError("다른 공개 작업이 진행 중입니다.")
    try:
        pngs = convert.render_png(job["blocks"]) if job["blocks"] else []
        convert.preflight()
        convert.write_outputs(job, pngs)
        convert.publish([job["report"]] + job["images"], job["stem"])
    finally:
        PUBLISH_LOCK.release()
    return 200, {"id": job["stem"], "url": "%s/read.html?r=%s" % (SITE_URL, job["stem"])}


def is_live(report_id):
    req = urllib.request.Request("%s/assets/data/library.json" % SITE_URL,
                                 headers={"Cache-Control": "no-cache", "User-Agent": "ChartConvert"})
    with urllib.request.urlopen(req, timeout=15) as r:
        items = json.load(r).get("items", [])
    return any(it.get("id") == report_id for it in items)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[app] " + fmt % args, flush=True)

    def host_ok(self):
        return self.headers.get("Host") in ("127.0.0.1:%d" % PORT, "localhost:%d" % PORT)

    def origin_ok(self):
        return self.headers.get("Origin") in ("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.host_ok():
            return self.send_json(403, {"error": "허용되지 않은 요청입니다."})
        url = urlparse(self.path)
        if url.path == "/api/live":
            report_id = parse_qs(url.query).get("id", [""])[0]
            try:
                return self.send_json(200, {"live": is_live(report_id)})
            except OSError as e:
                return self.send_json(200, {"live": False, "note": str(e)})
        if url.path not in STATIC:
            return self.send_json(404, {"error": "없는 주소입니다."})
        name, ctype = STATIC[url.path]
        body = (HERE / name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not (self.host_ok() and self.origin_ok()):
            return self.send_json(403, {"error": "허용되지 않은 요청입니다."})
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            return self.send_json(415, {"error": "JSON 요청만 받습니다."})
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            return self.send_json(413, {"error": "파일이 너무 큽니다(2MB 이하)."})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            if self.path == "/api/preview":
                return self.send_json(200, preview(data))
            if self.path == "/api/publish":
                return self.send_json(*publish(data))
            return self.send_json(404, {"error": "없는 주소입니다."})
        except convert.ConvertError as e:
            return self.send_json(400, {"error": str(e)})
        except (ValueError, UnicodeDecodeError):
            return self.send_json(400, {"error": "요청을 읽지 못했습니다."})


def main():
    with socket.socket() as s:  # 윈도우는 중복 바인딩을 허용하므로 직접 확인한다
        if s.connect_ex(("127.0.0.1", PORT)) == 0:
            print("[ERROR] port %d is already in use" % PORT, file=sys.stderr)
            return 1
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = "http://127.0.0.1:%d/" % PORT
    print("ChartConvert PID %d %s listen 127.0.0.1:%d" % (os.getpid(), url, PORT), flush=True)
    if os.environ.get("CHARTCONVERT_NO_BROWSER") != "1":
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
