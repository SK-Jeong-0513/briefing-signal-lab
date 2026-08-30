import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("release", ROOT / "scripts" / "prepare_weekly_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class WeeklyReleaseTests(unittest.TestCase):
    def row(self, **overrides):
        base = {"분야":"semicon","발행주":"2026-W31","유형":"signal","제목ko":"HBM 공급망 변화","제목en":"HBM supply shift","한줄ko":"후공정 병목을 관찰","한줄en":"Observe packaging bottlenecks","밸류체인":"HBM","출처URL":"https://example.com/a","원문제목":"HBM packaging capacity expands","원문일시":"2026-07-26T00:00:00+00:00","생성엔진":"deepseek","status":"draft"}
        base.update(overrides)
        return base
    def good_eval(self,row):
        return {"score":91,"critical":False,"fact_match":True,"classification_confidence":.91,"reason":"ok"}, ""
    def test_next_tuesday_issue_key(self):
        self.assertEqual(release.issue_key_kst(datetime(2026,7,26,6,tzinfo=timezone.utc)),"2026-W31")
    def test_all_gates_pass(self):
        ok,bad=release.select_candidates([self.row()],"2026-W31",datetime(2026,7,27,tzinfo=timezone.utc),self.good_eval)
        self.assertEqual(len(ok),1); self.assertEqual(bad,[])
    def test_missing_source_and_duplicate_are_excluded(self):
        ok,bad=release.select_candidates([self.row(출처URL=""),self.row(제목ko="다른 제목")],"2026-W31",datetime(2026,7,27,tzinfo=timezone.utc),self.good_eval)
        self.assertEqual(ok,[]); self.assertTrue(any("source_url" in x["reasons"] for x in bad)); self.assertTrue(any("duplicate" in x["reasons"] for x in bad))
    def test_article_published_in_earlier_issue_is_excluded(self):
        prior = release.prior_keys([{"issue_key":"2026-W30","출처URL":"https://example.com/a","원문제목":"HBM packaging capacity expands"}],"2026-W31")
        ok,bad=release.select_candidates([self.row()],"2026-W31",datetime(2026,7,27,tzinfo=timezone.utc),self.good_eval,prior=prior)
        self.assertEqual(ok,[]); self.assertIn("duplicate_prior_issue",bad[0]["reasons"])

    def test_prior_keys_ignores_current_issue(self):
        prior = release.prior_keys([{"issue_key":"2026-W31","출처URL":"https://example.com/a","원문제목":"HBM packaging capacity expands"}],"2026-W31")
        self.assertEqual(prior,set())

    def test_tally_summarises_domains(self):
        self.assertEqual(release.tally(["semicon","macro","semicon"]),"macro 1, semicon 2")

    def test_low_score_is_excluded(self):
        ok,bad=release.select_candidates([self.row()],"2026-W31",datetime(2026,7,27,tzinfo=timezone.utc),lambda row:(None,"evaluation_gate"))
        self.assertEqual(ok,[]); self.assertIn("evaluation_gate",bad[0]["reasons"])


    def test_missing_generator_and_stale_source_are_excluded(self):
        stale = self.row(생성엔진="", 원문일시="2026-06-01T00:00:00+00:00")
        ok, bad = release.select_candidates([stale], "2026-W31", datetime(2026, 7, 27, tzinfo=timezone.utc), self.good_eval)
        self.assertEqual(ok, [])
        self.assertIn("generator_engine", bad[0]["reasons"])
        self.assertIn("freshness", bad[0]["reasons"])

    def test_main_fails_closed_without_csv_urls(self):
        with patch.dict(release.os.environ, {}, clear=True):
            self.assertEqual(release.main(), 2)


    def test_evaluator_requires_matching_domain_and_independent_engine(self):
        wrong = '{"score": 95, "critical": false, "fact_match": true, "predicted_domain": "power", "classification_confidence": 0.95, "reason": "wrong domain"}'
        with patch.object(release.ai, "chat", return_value=(wrong, "gemini")):
            result, reason = release.evaluate_row(self.row())
        self.assertEqual(reason, "evaluation_gate")
        self.assertEqual(result["evaluator_engine"], "gemini")

    def test_evaluator_accepts_matching_domain_from_other_engine(self):
        good = '{"score": 95, "critical": false, "fact_match": true, "predicted_domain": "semicon", "classification_confidence": 0.95, "reason": "ok"}'
        with patch.object(release.ai, "chat", return_value=(good, "gemini")):
            result, reason = release.evaluate_row(self.row())
        self.assertEqual(reason, "")
        self.assertEqual(result["score"], 95)

class PostRowsTimeoutTests(unittest.TestCase):
    """타임아웃이 '안 써졌다'를 뜻하지 않는다 — 2026-08-31 W36 실사고.

    항목 88행이 시트에 기록됐는데 30초에 끊겨 스크립트가 죽었고, 뒤따르는 원장 POST 가
    실행되지 못했다. '항목만 있고 원장이 없는' 반쪽 상태는 mailer weeklyLatestBundle_ 이
    조용히 null 을 반환하는 조건이라 그 호가 통째로 빠질 뻔했다.
    """

    def setUp(self):
        self.env = patch.dict(release.os.environ, {
            "WEEKLY_WEBAPP_URL": "https://example.com/exec",
            "WEEKLY_WEBAPP_TOKEN": "t",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        # 검증 대기를 실제로 자지 않는다. start/stop 은 같은 패처여야 한다 —
        # 따로 만들면 시작한 패치가 안 풀려 다른 테스트까지 sleep 이 죽은 채로 돈다.
        napping = patch.object(release.time, "sleep", lambda *a: None)
        napping.start()
        self.addCleanup(napping.stop)

    def test_timeout_but_written_does_not_resend(self):
        """기록이 확인되면 재전송하지 않고 통과한다 — 재전송하면 같은 행이 두 번 들어간다."""
        with patch.object(release.urllib.request, "urlopen", side_effect=TimeoutError("read timed out")), \
             patch.object(release, "stamped_rows", return_value=3) as counted:
            release.post_rows("주간-발행항목", [1, 2, 3],
                              verify=("csv://items", "2026-W36", "STAMP", 3))
        counted.assert_called_with("csv://items", "2026-W36", "STAMP")

    def test_timeout_and_not_written_raises(self):
        """정말 안 써졌으면 실패시킨다 — 조용히 넘어가면 원장 없는 호가 생긴다."""
        with patch.object(release.urllib.request, "urlopen", side_effect=TimeoutError("read timed out")), \
             patch.object(release, "stamped_rows", return_value=0):
            with self.assertRaises(TimeoutError):
                release.post_rows("주간-발행항목", [1],
                                  verify=("csv://items", "2026-W36", "STAMP", 1))

    def test_timeout_without_verify_still_raises(self):
        """확인할 수단이 없으면 성공으로 넘기지 않는다."""
        with patch.object(release.urllib.request, "urlopen", side_effect=TimeoutError("x")):
            with self.assertRaises(TimeoutError):
                release.post_rows("주간-발행", [1])

    def test_stamped_rows_counts_only_this_run(self):
        """updated_at 으로 이번 실행분만 센다 — 과거 행·중복 재실행분이 섞이면 안 된다."""
        rows = [
            {"issue_key": "2026-W36", "updated_at": "STAMP"},
            {"issue_key": "2026-W36", "updated_at": "OLD"},
            {"issue_key": "2026-W35", "updated_at": "STAMP"},
        ]
        with patch.object(release, "fetch_csv", return_value=rows):
            self.assertEqual(release.stamped_rows("u", "2026-W36", "STAMP"), 1)

    def test_stamped_rows_distinguishes_fetch_failure_from_zero(self):
        """조회 실패(-1)와 0건은 다르다 — 실패를 0건으로 읽으면 있는데도 실패 처리한다."""
        with patch.object(release, "fetch_csv", side_effect=OSError("boom")):
            self.assertEqual(release.stamped_rows("u", "2026-W36", "STAMP"), -1)

    def test_post_timeout_is_longer_than_the_30s_that_failed(self):
        self.assertGreaterEqual(release.POST_TIMEOUT, 120)


if __name__ == "__main__": unittest.main()
