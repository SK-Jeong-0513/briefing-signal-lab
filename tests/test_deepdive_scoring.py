"""주간 딥다이브 채점(score_weekly_deepdive.py) 검증.

배경(2026-08-27): 헤드라이너가 1줄 요약으로 쪼그라들고 밸류체인이 12건 중 10건 비어
있어, 사이트의 딥다이브 자리가 '유료 구독' 자물쇠만 있는 빈 박스였다. 유료로 감추는
대신 실제로 채우기로 하고, 선행성·파급범위 2축으로 채점해 카테고리별 상위 3건을 뽑는다.
"""
import importlib.util
import json
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("deepdive", ROOT / "scripts" / "score_weekly_deepdive.py")
deepdive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deepdive)


def row(domain, title, **extra):
    base = {"분야": domain, "제목ko": title, "한줄ko": title + " 요약",
            "원문제목": title + " source", "밸류체인": "", "출처URL": "https://x/" + title,
            "issue_key": "2026-W35", "revision": "1", "상태": "ready"}
    base.update(extra)
    return base


def chat_scores(pairs, engine="deepseek"):
    """pairs = [(lead, reach), ...] 순서대로 응답하는 스텁."""
    def _chat(system, user, **kwargs):
        items = json.loads(user)["items"]
        return json.dumps({"scores": [
            {"i": it["i"], "lead": pairs[it["i"]][0], "reach": pairs[it["i"]][1], "why": "근거"}
            for it in items]}, ensure_ascii=False), engine
    return _chat


class ScoringTests(unittest.TestCase):
    def test_issue_key_is_only_right_on_monday(self):
        from datetime import datetime, timezone
        # (1-weekday)%7 = 다음 화요일. 월요일에 부르면 그 주 호가 되지만
        self.assertEqual(deepdive.issue_key_kst(datetime(2026, 8, 24, tzinfo=timezone.utc)), "2026-W35")
        # 목요일에 부르면 다음 호가 된다 — 그래서 호 선택에 쓰면 안 된다(경고용으로만)
        self.assertEqual(deepdive.issue_key_kst(datetime(2026, 8, 27, tzinfo=timezone.utc)), "2026-W36")

    def test_issue_comes_from_data_not_clock(self):
        """수동 실행은 아무 요일에나 일어난다. ready 행이 있는 최신 호를 그대로 본다."""
        rows = [row("semicon", "old", issue_key="2026-W34", 상태="published"),
                row("semicon", "A", issue_key="2026-W35"),
                row("bio", "B", issue_key="2026-W35")]
        issue, revision, picked = deepdive.pick_issue(rows)
        self.assertEqual((issue, revision), ("2026-W35", 1))
        self.assertEqual([r["제목ko"] for r in picked], ["A", "B"], "published 는 대상이 아니다")

    def test_pick_issue_takes_latest_and_highest_revision(self):
        rows = [row("semicon", "old", issue_key="2026-W34"),
                row("semicon", "r1", issue_key="2026-W35", revision="1"),
                row("semicon", "r2", issue_key="2026-W35", revision="2")]
        issue, revision, picked = deepdive.pick_issue(rows)
        self.assertEqual((issue, revision), ("2026-W35", 2))
        self.assertEqual([r["제목ko"] for r in picked], ["r2"], "옛 리비전은 섞이면 안 된다")

    def test_pick_issue_empty_when_nothing_ready(self):
        self.assertEqual(deepdive.pick_issue([row("semicon", "A", 상태="published")]), ("", 0, []))

    def test_published_issue_is_skipped_even_with_leftover_ready(self):
        """발송 뒤에도 ready 가 남는다 — 2026-08-27 실측 W35: published 205 · ready 59.

        weeklyLatestBundle_ 이 중복을 selected 에서 걸러내는데 weeklyPublish_ 는 그
        selected 만 published 로 바꾸므로, 걸러진 행은 영원히 ready 로 남는다.
        이걸 이번 호로 착각하면 발송 끝난 호의 잔여물을 채점한다.
        """
        rows = [row("semicon", "sent", 상태="published"), row("bio", "leftover", 상태="ready")]
        self.assertEqual(deepdive.pick_issue(rows), ("", 0, []))

    def test_published_older_issue_does_not_block_new_one(self):
        rows = [row("semicon", "old", issue_key="2026-W34", 상태="published"),
                row("semicon", "new", issue_key="2026-W35", 상태="ready")]
        issue, revision, picked = deepdive.pick_issue(rows)
        self.assertEqual((issue, revision), ("2026-W35", 1))
        self.assertEqual([r["제목ko"] for r in picked], ["new"])

    def test_select_never_takes_same_article_twice(self):
        """발행항목에 중복 행이 실제로 있다(W35 published 안에 같은 출처URL 2종·각 2회)."""
        dup = "https://example.com/same"
        rows = [row("semicon", "A", 출처URL=dup), row("bio", "A-복제", 출처URL=dup),
                row("power", "B"), row("space", "C")]
        scores = {0: {"lead": 99, "reach": 99}, 1: {"lead": 98, "reach": 98},
                  2: {"lead": 50, "reach": 50}, 3: {"lead": 40, "reach": 40}}
        picked = deepdive.select(rows, scores, per_category=3)
        self.assertEqual(picked, [0, 2, 3], "같은 출처URL 은 한 번만 — 다음 후보로 채운다")

    def test_select_falls_back_to_title_when_url_missing(self):
        rows = [row("semicon", "같은제목", 출처URL=""), row("bio", "같은제목", 출처URL=""),
                row("power", "다른제목")]
        scores = {i: {"lead": 90 - i, "reach": 90 - i} for i in range(3)}
        self.assertEqual(deepdive.select(rows, scores, per_category=3), [0, 2])

    def test_clamp_bounds_and_rejects_non_numeric(self):
        self.assertEqual(deepdive.clamp(150), 100)
        self.assertEqual(deepdive.clamp(-5), 0)
        self.assertEqual(deepdive.clamp("87"), 87)
        self.assertIsNone(deepdive.clamp("높음"))
        self.assertIsNone(deepdive.clamp(None))

    def test_full_batch_is_scored(self):
        rows = [row("semicon", "A"), row("semicon", "B")]
        got = deepdive.score_batch("semicon", rows, chat_scores([(90, 80), (40, 30)]))
        self.assertEqual(got[0]["lead"], 90)
        self.assertEqual(got[1]["reach"], 30)
        self.assertEqual(got[0]["engine"], "deepseek")

    def test_partial_batch_is_discarded_whole(self):
        # 일부만 오면 '점수를 못 받은 항목'과 '낮게 받은 항목'이 구분되지 않는다.
        def half(system, user, **kwargs):
            return json.dumps({"scores": [{"i": 0, "lead": 90, "reach": 90, "why": "x"}]}), "deepseek"
        self.assertEqual(deepdive.score_batch("semicon", [row("semicon", "A"), row("semicon", "B")], half), {})

    def test_malformed_or_engineless_response_is_discarded(self):
        self.assertEqual(deepdive.score_batch("semicon", [row("semicon", "A")],
                                              lambda s, u, **k: ("쓰레기", "deepseek")), {})
        self.assertEqual(deepdive.score_batch("semicon", [row("semicon", "A")],
                                              lambda s, u, **k: ('{"scores":[]}', None)), {})

    def test_unknown_domain_is_skipped_not_crashed(self):
        rows = [row("semicon", "A"), row("존재하지않는분야", "B")]
        scores = deepdive.score_rows(rows, chat_scores([(70, 70), (70, 70)]))
        self.assertIn(0, scores)
        self.assertNotIn(1, scores, "알 수 없는 분야는 채점 대상이 아니다")

    def test_select_takes_top_n_per_category(self):
        rows = [row("semicon", "T1"), row("bio", "T2"), row("power", "T3"), row("ai-infra", "T4"),
                row("kr-equity", "F1"), row("bond", "F2"), row("flows", "F3"),
                row("macro", "E1"), row("macro", "E2")]
        scores = {0: {"lead": 90, "reach": 90}, 1: {"lead": 80, "reach": 80}, 2: {"lead": 70, "reach": 70},
                  3: {"lead": 10, "reach": 10}, 4: {"lead": 95, "reach": 95}, 5: {"lead": 60, "reach": 60},
                  6: {"lead": 50, "reach": 50}, 7: {"lead": 88, "reach": 88}, 8: {"lead": 20, "reach": 20}}
        picked = deepdive.select(rows, scores, per_category=3)
        self.assertEqual(picked, [0, 1, 2, 4, 5, 6, 7, 8],
                         "카테고리별 상위 3 — economy 는 후보가 2건뿐이라 2건")
        self.assertNotIn(3, picked, "최저점 ai-infra 는 tech 상위 3에서 밀려야 한다")

    def test_select_is_stable_on_ties(self):
        rows = [row("semicon", "A"), row("bio", "B"), row("power", "C"), row("space", "D")]
        scores = {i: {"lead": 50, "reach": 50} for i in range(4)}
        self.assertEqual(deepdive.select(rows, scores, per_category=2), [0, 1],
                         "동점이면 원래 행 순서를 유지한다")

    def test_deepdive_trims_to_three_lines(self):
        def four(system, user, **kwargs):
            return json.dumps({"lines": ["1", "2", "3", "4"], "watch": "관전"}), "gemini"
        body, watch = deepdive.build_deepdive(row("semicon", "A"), four)
        self.assertEqual(body, "1\n2\n3")
        self.assertEqual(watch, "관전")

    def test_deepdive_failure_leaves_scores_intact(self):
        # 본문 생성이 실패해도 점수 행은 남아야 한다 — 딥다이브만 비는 게 전부 잃는 것보다 낫다.
        body, watch = deepdive.build_deepdive(row("semicon", "A"), lambda s, u, **k: ("", None))
        self.assertEqual((body, watch), ("", ""))

    def test_already_done_is_per_issue_revision(self):
        existing = [{"issue_key": "2026-W35", "revision": "1"}]
        self.assertTrue(deepdive.already_done(existing, "2026-W35", 1))
        self.assertFalse(deepdive.already_done(existing, "2026-W35", 2), "새 리비전은 다시 채점")
        self.assertFalse(deepdive.already_done(existing, "2026-W36", 1))

    def test_categories_match_mailer_cats(self):
        """도메인 목록이 메일러 CATS 와 어긋나면 카테고리 선정이 조용히 틀어진다."""
        src = (ROOT / "mailer" / "Code.gs").read_text(encoding="utf-8")
        block = src[src.index("const CATS = ["):src.index("const C = {")]
        parts = re.split(r'key:\s*"(\w+)"', block)
        mailer = {parts[i]: re.findall(r'id:\s*"([\w-]+)"', parts[i + 1]) for i in range(1, len(parts), 2)}
        self.assertEqual(mailer, deepdive.CATEGORIES)

    def test_deepdive_fields_cover_written_rows(self):
        """시트 헤더(DEEPDIVE_FIELDS)와 실제로 쓰는 키가 어긋나면 웹앱이 조용히 빈칸을 넣는다."""
        written = {"issue_key", "revision", "분야", "출처URL", "영향도", "선행성", "파급범위",
                   "딥다이브ko", "관전포인트", "근거", "엔진", "created_at"}
        self.assertEqual(set(deepdive.DEEPDIVE_FIELDS), written)
        self.assertEqual(len(deepdive.DEEPDIVE_FIELDS), len(set(deepdive.DEEPDIVE_FIELDS)))

    def test_defaults(self):
        self.assertEqual(deepdive.PER_CATEGORY, 3)
        self.assertEqual(deepdive.DEEPDIVE_TAB, "주간-딥다이브")


if __name__ == "__main__":
    unittest.main()
