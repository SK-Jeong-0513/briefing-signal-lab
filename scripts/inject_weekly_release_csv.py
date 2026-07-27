#!/usr/bin/env python3
"""GitHub Pages 배포 사본에 공개 주간 발행항목 CSV URL을 주입한다."""
import json
import os
import pathlib
import sys
import urllib.parse


def validate_csv_url(url):
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    return (parsed.scheme == "https" and parsed.netloc == "docs.google.com"
            and parsed.path.endswith("/pub") and query.get("output") == ["csv"])


def inject(path, url):
    if not validate_csv_url(url):
        raise ValueError("WEEKLY_RELEASE_ITEMS_CSV는 docs.google.com 게시 CSV URL이어야 합니다")
    marker = 'const WEEKLY_RELEASE_ITEMS_CSV = "";'
    text = path.read_text(encoding="utf-8")
    if marker not in text:
        raise ValueError("site.js 주입 지점을 찾지 못했습니다")
    path.write_text(text.replace(marker, "const WEEKLY_RELEASE_ITEMS_CSV = %s;" % json.dumps(url)), encoding="utf-8")


def main():
    url = os.environ.get("WEEKLY_RELEASE_ITEMS_CSV", "").strip()
    if not url:
        print("[ERROR] WEEKLY_RELEASE_ITEMS_CSV Secret 없음")
        return 2
    inject(pathlib.Path("public/assets/content/site.js"), url)
    print("[pages] weekly release items CSV injected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
