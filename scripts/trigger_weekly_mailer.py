#!/usr/bin/env python3
"""GitHub Actions에서 Apps Script 주간 메일러를 고정시각 호출한다."""
import json
import os
import sys
import urllib.request

url = os.environ.get("WEEKLY_MAILER_URL", "").strip()
token = os.environ.get("WEEKLY_MAILER_TOKEN", "").strip()
if not url or not token:
    print("[ERROR] WEEKLY_MAILER_URL/WEEKLY_MAILER_TOKEN 필요")
    sys.exit(2)
payload = json.dumps({"token": token, "action": "send_weekly"}).encode("utf-8")
request = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(request, timeout=360) as response:
    body = response.read().decode("utf-8", "replace")
    if response.status >= 300 or '"ok":true' not in body.replace(" ", ""):
        raise RuntimeError("mailer response %s: %s" % (response.status, body[:200]))
    print("[weekly-mailer] %s" % body[:200])
