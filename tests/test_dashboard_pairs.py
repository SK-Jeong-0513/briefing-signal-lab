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


class _both:
    """patch 두 개를 with 하나로 묶는다(ExitStack 을 쓸 만큼 크지 않다)."""
    def __init__(self, *ctxs): self.ctxs = ctxs
    def __enter__(self):
        for c in self.ctxs:
            c.__enter__()
        return self
    def __exit__(self, *a):
        for c in reversed(self.ctxs):
            c.__exit__(*a)
        return False


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
            k for k, _, _, _, _ in fd.ECOS_DAILY} | {
            "tga", "krsemi", "exports", "kvol", "uvol", "breadth", "krus10"}
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

    def test_kr_pair_dropdown_stays_on_one_ecos_table(self):
        """드롭다운 옵션이 다른 표에서 오면 옵션을 바꿀 때마다 거래일 달력이 달라진다.

        802Y001(주식시장, 일) 하나에서만 뽑아야 KOSPI·외국인순매수·KOSDAQ 의 끝 날짜가 같다.
        """
        by_key = {k: table for k, table, _, _, _ in fd.ECOS_DAILY}
        pair = [p for p in fd.PAIRS if p["id"] == "krus-kospi"][0]
        tables = {by_key.get(k) for k, _label in pair["rightOptions"]}
        self.assertEqual(tables, {"802Y001"}, "우축 옵션이 한 통계표에서 오지 않는다: %s" % tables)


class EcosTests(unittest.TestCase):
    """한국은행 ECOS. 여기 잠그는 것은 전부 조용히 틀리는 종류다."""

    def _search(self, rows):
        """ECOS 응답 목. ECOS_KEY 도 같이 채운다 — 비어 있으면 fail-open 가드가 먼저 걸려
        빈 결과가 오고, 테스트가 '통과'가 아니라 '아무것도 안 함'을 검사하게 된다."""
        payload = {"StatisticSearch": {"row": rows}}
        return _both(patch.object(fd, "ECOS_KEY", "TESTKEY"),
                     patch.object(fd, "get", lambda url: payload))

    def test_monthly_time_becomes_utc_midnight_of_the_first(self):
        """월간 TIME 은 'YYYYMM' 이다. 파싱을 안 하면 카드가 통째로 빈다."""
        with self._search([{"TIME": "202608", "DATA_VALUE": "120.05"}]):
            t, v = fd.ecos_series("901Y009", "M", "202001", "202608", ("0",))
        self.assertEqual(v, [120.05])
        self.assertEqual(t[0] % DAY, 0, "ECOS 타임스탬프는 UTC 자정이어야 aligned() 와 맞는다")
        self.assertEqual(fd._ecos_period(t[0]), "2026.08")

    def test_loose_item_codes_collapse_and_are_reported(self):
        """901Y033 은 항목을 A00 만 주면 원계열과 계절조정이 같이 온다.

        조용히 절반을 버리면 어느 계열이 실렸는지 아무도 모른다 — 로그로 드러나야 한다.
        """
        rows = [{"TIME": "202607", "DATA_VALUE": "117.9"}, {"TIME": "202607", "DATA_VALUE": "120.2"}]
        with self._search(rows), patch("builtins.print") as pr:
            t, v = fd.ecos_series("901Y033", "M", "202001", "202607", ("A00",))
        self.assertEqual(v, [120.2], "마지막 값을 취한다")
        self.assertTrue(any("느슨" in str(c) for c in pr.call_args_list),
                        "시점이 접혔는데 로그가 없으면 조용한 결손이 된다")

    def test_missing_values_are_skipped(self):
        with self._search([{"TIME": "202606", "DATA_VALUE": "-"},
                           {"TIME": "202607", "DATA_VALUE": ""},
                           {"TIME": "202608", "DATA_VALUE": "3.5"}]):
            _, v = fd.ecos_series("X", "M", "202001", "202608", ("0",))
        self.assertEqual(v, [3.5])

    def test_api_error_raises_instead_of_returning_empty(self):
        """ECOS 는 오류도 200 으로 준다. 빈 배열로 삼키면 원인이 안 남는다."""
        err = {"RESULT": {"CODE": "INFO-200", "MESSAGE": "없음"}}
        with _both(patch.object(fd, "ECOS_KEY", "TESTKEY"),
                   patch.object(fd, "get", lambda url: err)):
            with self.assertRaises(RuntimeError):
                fd.ecos_series("X", "M", "202001", "202608", ("0",))

    def test_spread_uses_only_common_days(self):
        """한국 추석과 미국 독립기념일은 겹치지 않는다. forward-fill 하면 없는 값을 지어낸다."""
        kr = ([DAY, 2 * DAY, 3 * DAY], [3.9, 4.0, 4.1])
        us = ([DAY, 3 * DAY], [4.3, 4.5])
        t, v = fd.kr_us_spread(kr, us)
        self.assertEqual(t, [DAY, 3 * DAY])
        self.assertEqual(v, [-0.4, -0.4])

    def test_no_key_is_not_fatal(self):
        """키가 없으면 건너뛴다. 지표 하나 때문에 배포를 막으면 나머지가 낡는다."""
        with patch.object(fd, "ECOS_KEY", ""):
            self.assertEqual(fd.ecos_series("X", "D", "20260101", "20260906", ("0",)), ([], []))

    def test_bsi_must_not_use_the_100_baseline(self):
        """BSI 실측 평균은 75.3(범위 51~95)이다. 100 을 기준선으로 보면 평년 77 이
        '기준선 −23, 심각한 비관' 으로 읽힌다. CSI(101.4)·ESI(99.9)만 100 중심이다."""
        modes = {k: m for k, _, _, _, _, m in fd.KR_MACRO}
        self.assertEqual(modes["kr_bsi"], "diff")
        self.assertEqual(modes["kr_csi"], "baseline100")
        self.assertEqual(modes["kr_esi"], "baseline100")

    def test_yoy_series_are_not_seasonally_adjusted(self):
        """계절조정지수에 전년동월비를 씌우면 조정이 두 번 된다.

        전산업생산은 A00/1(원계열), 소매판매는 G0/T2(불변)이어야 한다.
        """
        items = {k: it for k, _, it, _, _, _ in fd.KR_MACRO}
        self.assertEqual(items["kr_ip"], ("A00", "1"), "A00/2 는 계절조정이다")
        self.assertEqual(items["kr_retail"], ("G0", "T2"), "G0/T3 는 계절조정이다")

    def test_monthly_cards_all_declare_a_mode(self):
        """mode 가 없으면 vcCard 가 pctChg 로 떨어져 22개월 전 대비를 '~1M' 이라 찍는다."""
        allowed = {"yoy", "mom", "diff", "baseline100"}
        js = (ROOT / "public" / "assets" / "dashboard.js").read_text(encoding="utf-8")
        for key, _t, _i, _n, _u, mode in fd.KR_MACRO:
            self.assertIn(mode, allowed, "%s 의 mode 가 미정의" % key)
            self.assertIn('"' + mode + '"', js, "dashboard.js 가 %s 모드를 모른다" % mode)

    def test_yoy_needs_thirteen_months_of_history(self):
        """KR_MACRO_MONTHS 가 13 미만이면 yoy 카드가 전부 조용히 폴백한다."""
        self.assertGreaterEqual(fd.KR_MACRO_MONTHS, 13)

    def test_workflow_passes_the_bok_key(self):
        """env 에 안 실으면 Actions 에서 ECOS 를 통째로 건너뛴다.

        로컬에서는 .env 로 되고 CI 에서만 조용히 빠지는, 배포 전까지 안 보이는 종류다.
        """
        wf = (ROOT / ".github" / "workflows" / "dashboard-data.yml").read_text(encoding="utf-8")
        self.assertIn("BOK_API_KEY: ${{ secrets.BOK_API_KEY }}", wf)


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
