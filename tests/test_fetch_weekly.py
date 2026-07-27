import importlib.util
import pathlib
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("fetch_weekly", ROOT / "scripts" / "fetch_weekly.py")
fetch_weekly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_weekly)

class FetchWeeklyTests(unittest.TestCase):
    def test_sunday_targets_next_tuesday_issue(self):
        self.assertEqual(fetch_weekly.week_kst(datetime(2026, 7, 26, 6, tzinfo=timezone.utc)), "2026-W31")

    def test_google_news_preserves_source_metadata(self):
        xml = "<rss><channel><item><title>HBM update</title><link>https://example.com/hbm</link><pubDate>Sun, 26 Jul 2026 00:00:00 GMT</pubDate></item></channel></rss>"
        with patch.object(fetch_weekly, "_fetch", return_value=xml):
            row = fetch_weekly.feed_gnews("HBM", 1)[0]
        self.assertEqual(row[:3], ("HBM update", "https://example.com/hbm", "뉴스"))
        self.assertTrue(row[3].startswith("2026-07-26T00:00:00"))

if __name__ == "__main__":
    unittest.main()
