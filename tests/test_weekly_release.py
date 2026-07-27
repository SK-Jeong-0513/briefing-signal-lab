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

if __name__ == "__main__": unittest.main()
