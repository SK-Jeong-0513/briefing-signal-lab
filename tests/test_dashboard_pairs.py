"""대시보드 신규 지표(2026-08-18) — FRED 수집 · 거래량 정규화 · 시장폭 비율 · 섹터 절단.

여기 잠그는 것은 대부분 '구현 중에 실제로 물린 함정'이다. 전부 조용히 실패하는 종류라
(파일은 생성되고 화면도 뜨는데 지표만 빠진다) 눈으로는 못 잡는다.
"""
import importlib.util
import json
import pathlib
import sys
import time
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("fetch_dashboard", ROOT / "scripts" / "fetch_dashboard.py")
fd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fd)

DAY = 86400


class FredTests(unittest.TestCase):
    def test_accept_header_is_sent(self):
        """FRED 는 Accept 가 없으면 응답 대신 연결을 끊는다(WinError 10054 / read timeout).

        20초 매달렸다 실패해서 네트워크 탓처럼 보이는데 헤더 한 줄이면 0.2초에 200 이 온다.
        2026-08-18 첫 실행에서 FRED 5개가 전부 이것 때문에 빠졌다.
        """
        seen = {}

        class FakeResp:
            def read(self): return b"observation_date,X\n2026-08-14,4.17\n"
            def __enter__(self): return self
            def __exit__(self, *a): return False

        def fake_open(req, timeout=None):
            seen["headers"] = {k.lower(): v for k, v in req.header_items()}
            return FakeResp()

        with patch.object(fd.urllib.request, "urlopen", fake_open):
            fd.fred("DGS2")
        self.assertIn("accept", seen["headers"], "Accept 헤더 없이 FRED 를 부르면 연결이 끊긴다")

    def _fred_csv(self, body):
        class FakeResp:
            def read(self): return body.encode()
            def __enter__(self): return self
            def __exit__(self, *a): return False
        return patch.object(fd.urllib.request, "urlopen", lambda req, timeout=None: FakeResp())

    def test_history_older_than_range_is_dropped(self):
        """FRED 는 전체 역사를 준다(DGS10 은 1962년부터 16,140행).

        그대로 담으면 다섯 시리즈가 741KB — 대부분 화면에 그려지지 않는 구간이다.
        """
        old = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 4000 * DAY))
        new = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 10 * DAY))
        with self._fred_csv("observation_date,X\n%s,1.0\n%s,2.0\n" % (old, new)):
            t, v = fd.fred("DGS10")
        self.assertEqual(v, [2.0], "RANGE 창 밖의 과거는 실리면 안 된다")

    def test_missing_values_are_skipped(self):
        """결측은 '.' 으로 온다. float('.') 는 예외라 걸러야 한다."""
        d = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 5 * DAY))
        d2 = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 4 * DAY))
        with self._fred_csv("observation_date,X\n%s,.\n%s,3.5\n" % (d, d2)):
            t, v = fd.fred("DGS2")
        self.assertEqual(v, [3.5])

    def test_dates_are_utc_midnight(self):
        """dashboard.js 의 aligned() 가 floor(t/86400) 로 내부조인한다.

        로컬 시간대로 만들면 하루가 밀려 교집합이 통째로 빌 수 있다.
        """
        d = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 5 * DAY))
        with self._fred_csv("observation_date,X\n%s,1.0\n" % d):
            t, _ = fd.fred("DGS2")
        self.assertEqual(t[0] % DAY, 0, "FRED 타임스탬프는 UTC 자정이어야 한다")

    def test_range_days_follows_RANGE(self):
        """RANGE 를 늘렸는데 FRED 만 3년이면 그 페어의 왼쪽이 잘려 보인다."""
        with patch.object(fd, "RANGE", "5y"):
            self.assertGreater(fd._range_days(), 1700)
        with patch.object(fd, "RANGE", "3y"):
            self.assertLess(fd._range_days(), 1200)


class VolumeTests(unittest.TestCase):
    """거래량은 원본을 쓰지 않는다.

    Yahoo 의 KOSPI 거래량은 천주, 미국은 주 단위로 와서 약 1000배 차이가 난다 —
    그대로 겹치면 한국 선이 바닥에 붙는다. 게다가 주식 '수' 는 시장 간 비교가 원래
    무의미하다(한국은 저가주가 많아 같은 돈에 주식 수가 부풀어난다).
    """
    def _chart(self, vols):
        ts = [1700000000 + i * DAY for i in range(len(vols))]
        return {"chart": {"result": [{"timestamp": ts, "indicators": {"quote": [
            {"close": [1.0] * len(vols), "volume": vols}]}}]}}

    def test_ratio_is_relative_to_trailing_average(self):
        vols = [100] * 20 + [200]        # 평소 100 → 오늘 200
        with patch.object(fd, "get", lambda url: self._chart(vols)):
            t, v = fd.normalized_volume("X", window=20)
        self.assertEqual(v, [2.0], "20일 평균의 2배면 2.0")

    def test_zero_volume_days_do_not_distort_the_average(self):
        """휴장일은 0 으로 온다. 평균에 넣으면 기준선이 내려가 다음 날이 과열로 보인다."""
        with patch.object(fd, "get", lambda url: self._chart([100] * 10 + [0] + [100] * 10 + [100])):
            t, v = fd.normalized_volume("X", window=20)
        self.assertEqual(v, [1.0])

    def test_series_shorter_than_window_yields_nothing(self):
        with patch.object(fd, "get", lambda url: self._chart([100] * 5)):
            self.assertEqual(fd.normalized_volume("X", window=20), ([], []))

    def test_missing_volume_field_is_not_fatal(self):
        """quotes 경로의 목처럼 close 만 있는 응답이 와도 죽지 않아야 한다."""
        chart = {"chart": {"result": [{"timestamp": [1700000000], "indicators": {"quote": [{"close": [1.0]}]}}]}}
        with patch.object(fd, "get", lambda url: chart):
            self.assertEqual(fd.yahoo_volume("X"), ([], []))


class BreadthTests(unittest.TestCase):
    def test_ratio_uses_only_common_days(self):
        """RSP 와 SPY 의 거래일이 어긋나면 그 날은 버린다 — 값이 밀리면 발산이 가짜가 된다."""
        a = {"chart": {"result": [{"timestamp": [DAY, 2 * DAY, 3 * DAY],
                                   "indicators": {"quote": [{"close": [10.0, 20.0, 30.0]}]}}]}}
        b = {"chart": {"result": [{"timestamp": [DAY, 3 * DAY],
                                   "indicators": {"quote": [{"close": [5.0, 10.0]}]}}]}}
        with patch.object(fd, "get", lambda url: a if "RSP" in url else b):
            t, v = fd.ratio_series("RSP", "SPY")
        self.assertEqual((t, v), ([DAY, 3 * DAY], [2.0, 3.0]))


class SectorTests(unittest.TestCase):
    def test_cards_only_need_the_last_90_points(self):
        """dashboard.js 의 spark() 가 slice(-90), pctChg 가 -22 만 읽는다.

        3년치를 담으면 663개가 한 번도 안 읽히고 파일만 150KB 불어난다.
        """
        js = (ROOT / "public" / "assets" / "dashboard.js").read_text(encoding="utf-8")
        self.assertIn("values.slice(-90)", js, "spark 의 창이 바뀌면 SECTOR_KEEP 도 같이 바꿔야 한다")
        self.assertGreaterEqual(fd.SECTOR_KEEP, 90)
        self.assertLessEqual(fd.SECTOR_KEEP, 120, "카드가 읽지도 않는 구간을 담고 있다")

    def test_all_eleven_spdr_sectors_are_defined(self):
        self.assertEqual(len(fd.SECTORS), 11)
        self.assertEqual(len({k for k, _, _ in fd.SECTORS}), 11, "키 중복")


class PairTests(unittest.TestCase):
    def test_every_pair_axis_resolves_to_a_defined_series(self):
        """오타 난 키는 그 페어를 조용히 사라지게 한다(main 이 없는 페어를 건너뛴다)."""
        known = set(fd.YAHOO) | set(fd.FRED) | {k for k, _, _ in fd.SECTORS} | {
            "tga", "krsemi", "exports", "kvol", "uvol", "breadth"}
        for p in fd.PAIRS:
            self.assertIn(p["left"], known, "%s 좌축" % p["id"])
            self.assertIn(p["right"], known, "%s 우축" % p["id"])
            for key, _label in p.get("rightOptions", []):
                self.assertIn(key, known, "%s 우축 옵션 %s" % (p["id"], key))

    def test_rate_pair_does_not_mix_sources(self):
        """한 페어 안에서 소스를 섞으면 드롭다운을 바꿀 때마다 차트 끝 날짜가 달라진다.

        FRED 는 1~4일 지연, Yahoo 는 당일이다. tnx(Yahoo) 를 이 옵션에 끼워 넣지 말 것.
        """
        wti = [p for p in fd.PAIRS if p["id"] == "wti-rates"][0]
        for key, _ in wti["rightOptions"]:
            self.assertIn(key, fd.FRED, "%s 는 FRED 시리즈가 아니다" % key)

    def test_pair_ids_are_unique(self):
        ids = [p["id"] for p in fd.PAIRS]
        self.assertEqual(len(ids), len(set(ids)))


class CoverageTests(unittest.TestCase):
    def test_score_line_is_printed_for_the_commit_message(self):
        """워크플로가 이 줄을 grep 해 커밋 제목에 넣는다. 형식이 바뀌면 성적이 사라진다."""
        src = (ROOT / "scripts" / "fetch_dashboard.py").read_text(encoding="utf-8")
        self.assertIn('print("SCORE ', src)
        wf = (ROOT / ".github" / "workflows" / "dashboard-data.yml").read_text(encoding="utf-8")
        self.assertIn("'^SCORE '", wf, "워크플로가 SCORE 줄을 잡지 못한다")
        self.assertIn("set -o pipefail", wf, "tee 가 종료코드를 삼켜 크래시가 초록불이 된다")

    def test_dashboard_json_carries_coverage_for_the_screen(self):
        """수집이 일부 실패해도 직전 데이터가 남아 화면은 멀쩡해 보인다.

        사람이 그걸 알 방법이 화면의 coverage 표시 말고 없다.
        """
        out = json.loads((ROOT / "public" / "assets" / "data" / "dashboard.json").read_text(encoding="utf-8"))
        cov = out.get("coverage")
        self.assertIsNotNone(cov, "coverage 필드가 없으면 화면이 결손을 표시할 수 없다")
        for k in ("pairs", "pairsExpected", "sectors", "sectorsExpected"):
            self.assertIn(k, cov)
        js = (ROOT / "public" / "assets" / "dashboard.js").read_text(encoding="utf-8")
        self.assertIn("pairsExpected", js, "화면이 coverage 를 읽지 않으면 실려봐야 소용없다")


if __name__ == "__main__":
    unittest.main()
