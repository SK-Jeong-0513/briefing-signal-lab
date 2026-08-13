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

NOW = datetime(2026, 7, 27, tzinfo=timezone.utc)  # 수집 기준 시각 고정 — 테스트가 실제 날짜에 의존하지 않게

class FetchWeeklyTests(unittest.TestCase):
    def test_sunday_targets_next_tuesday_issue(self):
        self.assertEqual(fetch_weekly.week_kst(datetime(2026, 7, 26, 6, tzinfo=timezone.utc)), "2026-W31")

    def test_google_news_preserves_source_metadata(self):
        xml = "<rss><channel><item><title>HBM update</title><link>https://example.com/hbm</link><pubDate>Sun, 26 Jul 2026 00:00:00 GMT</pubDate></item></channel></rss>"
        with patch.object(fetch_weekly, "_fetch", return_value=xml):
            row = fetch_weekly.feed_gnews("HBM", 1, now=NOW)[0]
        self.assertEqual(row[:3], ("HBM update", "https://example.com/hbm", "뉴스"))
        self.assertTrue(row[3].startswith("2026-07-26T00:00:00"))

    def test_stale_and_undated_articles_are_dropped(self):
        # Google News RSS는 관련도순이라 수개월 전 기사가 상위에 남는다 → 수집 단계에서 잘라야 한다.
        xml = ("<rss><channel>"
               "<item><title>4월 기사</title><link>https://example.com/old</link><pubDate>Fri, 03 Apr 2026 00:00:00 GMT</pubDate></item>"
               "<item><title>일시 없음</title><link>https://example.com/nodate</link></item>"
               "<item><title>이번 주</title><link>https://example.com/new</link><pubDate>Fri, 24 Jul 2026 00:00:00 GMT</pubDate></item>"
               "</channel></rss>")
        with patch.object(fetch_weekly, "_fetch", return_value=xml):
            rows = fetch_weekly.feed_gnews("CPO", 3, now=NOW)
        self.assertEqual([r[0] for r in rows], ["이번 주"])

    def test_query_is_limited_to_collect_window(self):
        seen = {}
        def capture(url, timeout=25):
            seen["url"] = url
            return "<rss><channel></channel></rss>"
        with patch.object(fetch_weekly, "_fetch", capture):
            fetch_weekly.feed_gnews("CPO", 1, now=NOW)
        self.assertIn("when%%3A%dd" % fetch_weekly.COLLECT_DAYS, seen["url"])

    def test_collect_skips_articles_used_in_earlier_weeks(self):
        domain = {"id": "ai-infra", "feeds": [("gnews", "CPO")]}
        heads = [("포토니솔, 광 아이솔레이터 칩 개발 성공", "https://news.google.com/a", "뉴스", "2026-07-24T00:00:00+00:00"),
                 ("신규 기사", "https://news.google.com/b", "뉴스", "2026-07-25T00:00:00+00:00")]
        with patch.object(fetch_weekly, "feed_gnews", return_value=heads), patch.object(fetch_weekly.time, "sleep"):
            kept = fetch_weekly.collect(domain, used={"https://news.google.com/a"})
            by_title = fetch_weekly.collect(domain, used={fetch_weekly.title_key("포토니솔 광 아이솔레이터 칩 개발 성공")})
        self.assertEqual([h[0] for h in kept], ["신규 기사"])
        self.assertEqual([h[0] for h in by_title], ["신규 기사"])

    def test_used_keys_is_fail_open(self):
        with patch.dict(fetch_weekly.os.environ, {"WEEKLY_DRAFT_CSV": "https://example.com/x.csv"}, clear=True):
            with patch.object(fetch_weekly, "_csv_rows", side_effect=RuntimeError("403")):
                self.assertEqual(fetch_weekly.used_keys(), set())

    def test_used_keys_collects_url_and_title(self):
        rows = [{"출처URL": "https://news.google.com/A", "원문제목": "포토니솔, 광 아이솔레이터"}]
        with patch.dict(fetch_weekly.os.environ, {"WEEKLY_DRAFT_CSV": "https://example.com/x.csv"}, clear=True):
            with patch.object(fetch_weekly, "_csv_rows", return_value=rows):
                keys = fetch_weekly.used_keys()
        self.assertIn("https://news.google.com/a", keys)
        self.assertIn(fetch_weekly.title_key("포토니솔 광 아이솔레이터"), keys)

    def test_every_domain_has_a_signal_hint(self):
        # hint가 없으면 기술(밸류체인 병목) 기본 프롬프트가 나가 bio·금융·경제는 []만 반환한다.
        missing = [d["id"] for d in fetch_weekly.DOMAINS if not d.get("hint")]
        self.assertEqual(missing, ["ai-infra", "semicon", "power", "space"], "기술 물리 계층 외에는 분야별 hint 필수")

if __name__ == "__main__":
    unittest.main()


class DraftWriteFailureTests(unittest.TestCase):
    """초안 쓰기 실패는 반드시 빨간 run 으로 끝나야 한다.

    2026-08-02 실제 사고: `[write] 실패: The read operation timed out` 이 났는데
    post_rows 가 예외를 삼키고 main 이 정상 종료해 **run 이 success 로 남았다.**
    그 결과 2026-W32 초안 40행이 시트에 없는 걸 아무도 모른 채 한 주가 지났다.
    """

    ENV = {"WEEKLY_WEBAPP_URL": "https://example.com/exec", "WEEKLY_WEBAPP_TOKEN": "t"}

    def test_write_failure_returns_false_after_retries(self):
        with patch.dict(fetch_weekly.os.environ, self.ENV, clear=False), \
             patch.object(fetch_weekly.urllib.request, "urlopen", side_effect=OSError("timed out")) as up, \
             patch.object(fetch_weekly.time, "sleep"):
            self.assertFalse(fetch_weekly.post_rows([{"a": 1}]))
        self.assertEqual(up.call_count, 3, "재시도 없이 한 번만 시도했다")

    def test_transient_failure_then_success(self):
        class Resp:
            status = 200
            def read(self): return b"ok"
            def __enter__(self): return self
            def __exit__(self, *a): return False
        with patch.dict(fetch_weekly.os.environ, self.ENV, clear=False), \
             patch.object(fetch_weekly.urllib.request, "urlopen",
                          side_effect=[OSError("timed out"), Resp()]), \
             patch.object(fetch_weekly.time, "sleep"):
            self.assertTrue(fetch_weekly.post_rows([{"a": 1}]))

    def test_missing_url_is_dry_run_not_a_failure(self):
        env = {"WEEKLY_WEBAPP_URL": "", "WEEKLY_WEBAPP_TOKEN": ""}
        with patch.dict(fetch_weekly.os.environ, env, clear=False):
            self.assertTrue(fetch_weekly.post_rows([{"a": 1}]))

    # 아래 두 테스트는 '쓰기' 경로를 보는 것이므로 draft_domain 이 행을 내놓아야 한다.
    # 빈 리스트를 두면 main 이 0건 검사에서 먼저 끝나 쓰기 경로에 닿지도 않는다.
    CARD = [{"분야": "ai-infra", "제목ko": "카드"}]

    def _main(self, **patches):
        with patch.object(fetch_weekly, "used_keys", return_value=set()), \
             patch.object(fetch_weekly.toggle, "pipeline_enabled", return_value=True), \
             patch.object(fetch_weekly.time, "sleep"), \
             patch.object(fetch_weekly.sys, "argv", ["fetch_weekly.py", "--limit=1"]), \
             patch.object(fetch_weekly, "draft_domain", return_value=patches.pop("drafts", self.CARD)), \
             patch.object(fetch_weekly, "post_rows", return_value=patches.pop("written", True)):
            return fetch_weekly.main()

    def test_main_exits_nonzero_when_write_fails(self):
        self.assertEqual(self._main(written=False), 1)

    def test_main_exits_zero_when_write_succeeds(self):
        self.assertEqual(self._main(written=True), 0)


class EmptyDraftTests(unittest.TestCase):
    """전 도메인 0건은 빨간 run 으로 끝나야 한다.

    2026-08-08 실행에서 LLM 키 3종이 모두 죽어 11개 도메인이 전부 '응답 없음'으로
    0건이 됐는데 워크플로가 초록으로 끝났다. 그 주 사이트가 통째로 빈 것을 일주일
    뒤에야 알았다. 주간은 주 1회 단발이라 그 순간 실패하면 메울 기회가 없다.
    """

    CARD = [{"분야": "ai-infra", "제목ko": "카드"}]

    def _main(self, drafts, argv=None):
        with patch.object(fetch_weekly, "used_keys", return_value=set()), \
             patch.object(fetch_weekly.toggle, "pipeline_enabled", return_value=True), \
             patch.object(fetch_weekly.time, "sleep"), \
             patch.object(fetch_weekly.sys, "argv", argv or ["fetch_weekly.py", "--limit=1"]), \
             patch.object(fetch_weekly, "draft_domain", return_value=drafts), \
             patch.object(fetch_weekly, "post_rows", return_value=True) as post:
            return fetch_weekly.main(), post

    def test_all_domains_empty_is_a_failure(self):
        code, _ = self._main([])
        self.assertEqual(code, 1)

    def test_all_domains_empty_does_not_write_to_the_sheet(self):
        """빈 결과를 써봐야 얻을 게 없고, 원장에 잘못된 흔적만 남는다."""
        _, post = self._main([])
        post.assert_not_called()

    def test_any_row_is_a_success(self):
        """일부 도메인만 0건인 것은 실패로 보지 않는다 — 어떤 주는 실제로 신호가 없다.
        그것까지 빨간불로 만들면 경보가 무뎌져 진짜 사고를 놓친다."""
        code, post = self._main(self.CARD)
        self.assertEqual(code, 0)
        post.assert_called_once()

    def test_dry_run_stays_zero_even_with_no_rows(self):
        """--dry 는 품질 확인용이다. 0건이라고 빨간불이면 확인 자체를 못 한다."""
        code, post = self._main([], argv=["fetch_weekly.py", "--limit=1", "--dry"])
        self.assertEqual(code, 0)
        post.assert_not_called()
