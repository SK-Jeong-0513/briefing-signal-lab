#!/usr/bin/env python3
"""GitHub Pages 배포 사본에 공개 시트 CSV URL 을 주입한다.

저장소는 public 이라 URL 을 비워 두고 배포 사본에만 넣는다. 딥다이브는 발송(월 09:00)
보다 3시간 앞선 06:00 에 채점되므로, 렌더는 published 항목에 조인된 것만 그린다
— 그래야 아직 공개되지 않은 호가 미리 새지 않는다."""
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


def inject(path, url, name="WEEKLY_RELEASE_ITEMS_CSV"):
    if not validate_csv_url(url):
        raise ValueError("%s 는 docs.google.com 게시 CSV URL이어야 합니다" % name)
    marker = 'const %s = "";' % name
    text = path.read_text(encoding="utf-8")
    if marker not in text:
        raise ValueError("site.js 에서 %s 주입 지점을 찾지 못했습니다" % name)
    path.write_text(text.replace(marker, "const %s = %s;" % (name, json.dumps(url))), encoding="utf-8")


def main():
    url = os.environ.get("WEEKLY_RELEASE_ITEMS_CSV", "").strip()
    if not url:
        print("[ERROR] WEEKLY_RELEASE_ITEMS_CSV Secret 없음")
        return 2
    site = pathlib.Path("public/assets/content/site.js")
    inject(site, url)
    print("[pages] weekly release items CSV injected")

    # 딥다이브는 선택이다 — 없으면 사이트가 딥다이브 섹션만 조용히 감춘다(발행은 정상).
    deepdive = os.environ.get("WEEKLY_DEEPDIVE_CSV", "").strip()
    if deepdive:
        inject(site, deepdive, "WEEKLY_DEEPDIVE_CSV")
        print("[pages] weekly deepdive CSV injected")
    else:
        print("[pages] WEEKLY_DEEPDIVE_CSV 없음 — 딥다이브 섹션 없이 배포")
    return 0


if __name__ == "__main__":
    sys.exit(main())
