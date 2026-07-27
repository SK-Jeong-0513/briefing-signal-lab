"""일일 메일 '주요 시장 지표' 스냅샷(quotes.json) 생성 검증."""
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("fetch_dashboard", ROOT / "scripts" / "fetch_dashboard.py")
fd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fd)

DAY = 86400
# 2026-07-23 / 07-24 / 07-27 00:00 UTC
D23, D24, D27 = 1784764800, 1784764800 + DAY, 1784764800 + 4 * DAY


def chart(points):
    return {"chart": {"result": [{"timestamp": [p[0] for p in points],
                                  "indicators": {"quote": [{"close": [p[1] for p in points]}]}}]}}


class QuotesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = str(pathlib.Path(self.tmp.name) / "quotes.json")
        self.patcher = patch.object(fd, "OUT_QUOTES", self.out)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def run_with(self, quotes, responses):
        with patch.object(fd, "QUOTES", quotes), patch.object(fd, "get", side_effect=lambda url: responses(url)):
            fd.quotes_snapshot()
        path = pathlib.Path(self.out)
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    def test_percent_change_and_thousands_separator(self):
        out = self.run_with([("나스닥", "IXIC", 2, "")],
                            lambda url: chart([(D23, 24000.0), (D24, 24975.8234)]))
        self.assertEqual(out["rows"][0], {"label": "나스닥", "value": "24,975.82", "change": "+4.1%", "dir": 1})

    def test_rate_uses_bp_not_percent(self):
        # 금리는 값 자체가 %. 4.649 → 4.679 는 +3bp 이지 +0.6% 가 아니다.
        out = self.run_with([("US10Y", "TNX", 3, "rate")],
                            lambda url: chart([(D23, 4.649), (D24, 4.679)]))
        self.assertEqual(out["rows"][0], {"label": "US10Y", "value": "4.679%", "change": "+3bp", "dir": 1})

    def test_decline_and_flat_direction(self):
        down = self.run_with([("SOXX", "SOXX", 2, "")], lambda url: chart([(D23, 551.24), (D24, 527.01)]))
        self.assertEqual(down["rows"][0]["change"], "-4.4%")
        self.assertEqual(down["rows"][0]["dir"], -1)
        flat = self.run_with([("금", "GC", 1, "")], lambda url: chart([(D23, 4100.0), (D24, 4100.0)]))
        self.assertEqual(flat["rows"][0]["dir"], 0)
        # 표시 자릿수 아래로 사라지는 미세 변동은 보합. '-0.0%'(빨강) 같은 표시가 나오면 안 된다.
        tiny_down = self.run_with([("금", "GC", 1, "")], lambda url: chart([(D23, 4100.0), (D24, 4098.4)]))
        self.assertEqual(tiny_down["rows"][0]["change"], "0.0%")
        self.assertEqual(tiny_down["rows"][0]["dir"], 0)
        tiny_up = self.run_with([("금", "GC", 1, "")], lambda url: chart([(D23, 4100.0), (D24, 4101.6)]))
        self.assertEqual(tiny_up["rows"][0]["change"], "0.0%")
        self.assertEqual(tiny_up["rows"][0]["dir"], 0)

    def test_in_progress_session_is_excluded_by_reference_day(self):
        """선물·환율은 24시간 거래라 미국 주식 개장 전에도 '오늘' 봉이 잡힌다.
        그 미완성 봉을 종가로 쓰면 asof가 어긋나고 변동률이 거짓이 된다."""
        def responses(url):
            if "CL" in url:   # 진행 중인 07-27 봉 포함
                return chart([(D23, 92.0), (D24, 89.31), (D27, 83.11)])
            return chart([(D23, 7408.30), (D24, 7411.98)])   # 주식은 07-24 마감이 마지막
        out = self.run_with([("S&P500", "GSPC", 2, ""), ("나스닥", "IXIC", 2, ""), ("WTI", "CL=F", 2, "")], responses)
        self.assertEqual(out["asof"], "2026-07-24", "기준일은 최빈 거래일이어야 함")
        wti = [r for r in out["rows"] if r["label"] == "WTI"][0]
        self.assertEqual(wti["value"], "89.31", "진행 중 봉이 아니라 기준일 종가를 써야 함")
        self.assertEqual(wti["change"], "-2.9%")

    def test_failed_symbol_is_skipped_not_fatal(self):
        def responses(url):
            if "BAD" in url:
                raise RuntimeError("404")
            return chart([(D23, 100.0), (D24, 101.0)])
        out = self.run_with([("정상", "OK", 2, ""), ("실패", "BAD", 2, "")], responses)
        self.assertEqual([r["label"] for r in out["rows"]], ["정상"])

    def test_single_close_symbol_is_skipped(self):
        out = self.run_with([("정상", "OK", 2, ""), ("한개", "ONE", 2, "")],
                            lambda url: chart([(D24, 5.0)]) if "ONE" in url else chart([(D23, 1.0), (D24, 2.0)]))
        self.assertEqual([r["label"] for r in out["rows"]], ["정상"])

    def test_all_failed_preserves_previous_snapshot(self):
        pathlib.Path(self.out).write_text('{"asof":"2026-07-24","rows":[{"label":"기존"}]}', encoding="utf-8")
        def boom(url):
            raise RuntimeError("network down")
        out = self.run_with([("나스닥", "IXIC", 2, "")], boom)
        self.assertEqual(out["rows"][0]["label"], "기존", "전부 실패하면 직전 스냅샷을 덮지 않아야 함")

    def test_live_ticker_list_matches_agreed_design(self):
        labels = [q[0] for q in fd.QUOTES]
        self.assertEqual(len(labels), 21)
        for expected in ("나스닥", "원/달러", "US2Y", "SOXX(반도체)", "XLC(엔터)", "EWY(한국·야간)"):
            self.assertIn(expected, labels)
        self.assertNotIn("US30", labels)   # Dow 와 중복
        self.assertNotIn("US500", labels)  # S&P500 과 중복
        rates = [q[0] for q in fd.QUOTES if q[3] == "rate"]
        self.assertEqual(rates, ["US2Y", "US5Y", "US10Y"])


if __name__ == "__main__":
    unittest.main()
