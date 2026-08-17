"""엔진 응답 검증 — 2026-08-18 시장 카드 오염 재발 방지.

사고 요약: gemini-3.5 는 추론 토큰을 쓰는 모델이라 max_tokens 를 사고 과정에 써버리고
답변은 꼬리만 22~41자 남겼다. chat() 이 '비어 있지 않으면 성공'으로 처리해 그 조각이
폴백 없이 통과했고, fetch_market 이 파싱 실패 시 **원문을 그대로 요약에 넣어**
"exactly 2 sentences):**" 같은 문자열이 종목 카드에 그대로 떴다.

여기 잠그는 것은 두 층이다. ① 엔진 층에서 말이 안 되게 짧은 응답을 실패로 볼 것,
② 파싱에 실패한 응답을 콘텐츠로 저장하지 말 것.
"""
import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "lib"))


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ai = _load("ai", ROOT / "scripts" / "lib" / "ai.py")
fm = _load("fetch_market", ROOT / "scripts" / "fetch_market.py")


def reply(text):
    return {"choices": [{"message": {"content": text}}]}


class ChatMinCharsTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", {"DEEPSEEK_API_KEY": "k1", "GEMINI_API_KEY": "k2"})
        self.env.start()
        self.addCleanup(self.env.stop)
        ai._ORDER = [("deepseek", "https://d", "dm", "DEEPSEEK_API_KEY"),
                     ("gemini", "https://g", "gm", "GEMINI_API_KEY")]

    def test_truncated_response_falls_through_to_next_engine(self):
        """22자짜리 사고 조각이 통과하면 그게 그대로 콘텐츠가 된다."""
        calls = []

        def post(url, key, payload, timeout=40):
            calls.append(url)
            return reply('{"요약":"미국 반도체주 및 ADR 동' if len(calls) == 1 else "정상적인 두 문장 요약입니다. " * 6)

        with patch.object(ai, "_post", post):
            text, engine = ai.chat("s", "u", min_chars=80)
        self.assertEqual(engine, "gemini", "짧은 응답을 낸 엔진을 건너뛰어야 한다")
        self.assertEqual(len(calls), 2)

    def test_short_response_passes_when_no_minimum_requested(self):
        """min_chars 기본값 0 은 기존 동작 그대로 — 호출부가 요구할 때만 검사한다."""
        with patch.object(ai, "_post", lambda *a, **k: reply("짧음")):
            text, engine = ai.chat("s", "u")
        self.assertEqual(text, "짧음")

    def test_all_engines_short_returns_none(self):
        """전부 잘리면 조용히 짧은 걸 쓰지 말고 실패로 끝낸다."""
        with patch.object(ai, "_post", lambda *a, **k: reply("x" * 10)):
            self.assertEqual(ai.chat("s", "u", min_chars=80), (None, None))


class MarketSummaryTests(unittest.TestCase):
    """파싱 실패한 응답은 버린다. 예전에는 원문을 '요약' 으로 저장해 카드가 오염됐다."""

    def _run(self, text):
        """brief_one(ticker, name) — 헤드라인은 news() 가 내부에서 가져온다."""
        stub_news = lambda *a, **k: [("제목", "https://x", "뉴스", "2026-08-18")]
        with patch.object(fm.ai, "chat", lambda *a, **k: (text, "gemini")), \
             patch.object(fm, "news", stub_news), \
             patch.object(fm.guard, "screen", lambda s: (True, [])):
            return fm.brief_one("005930", "삼성전자")

    def test_unparseable_response_is_dropped_not_stored(self):
        for garbage in ['{"요약":"삼성전자와 SK하이닉스는 상반기 실',
                        'exactly 2 sentences):**\n    *   *Sentence',
                        '):**\n    *   *Draft 1:* 리노공']:
            self.assertIsNone(self._run(garbage), "파싱 실패분이 저장되면 카드가 오염된다: %r" % garbage)

    def test_empty_summary_is_dropped(self):
        self.assertIsNone(self._run('{"요약":"","근거":"x"}'))

    def test_valid_json_is_kept(self):
        row = self._run('{"요약":"삼성전자가 실적을 발표했습니다. 메모리 업황이 관찰됩니다.","근거":"실적 발표"}')
        self.assertIsNotNone(row)
        self.assertNotIn("{", row["요약"], "요약에 JSON 껍데기가 남으면 안 된다")

    def test_min_chars_is_requested_from_the_engine_layer(self):
        src = (ROOT / "scripts" / "fetch_market.py").read_text(encoding="utf-8")
        self.assertIn("min_chars=", src, "엔진 층 가드를 요청하지 않으면 짧은 응답이 그대로 온다")


class DraftFailureTests(unittest.TestCase):
    def test_array_less_response_is_distinguished_from_empty_array(self):
        """빈 배열(정상)과 생성 실패(배열 없음)가 같은 '후보 0건' 으로 찍히면
        엔진 고장이 '그 분야에 신호가 없음' 처럼 보인다 — 실제로 7개 도메인이 그랬다."""
        src = (ROOT / "scripts" / "fetch_weekly.py").read_text(encoding="utf-8")
        self.assertIn('"[" not in text or "]" not in text', src)
        self.assertIn("생성 실패로 처리", src)


class EvaluatorTests(unittest.TestCase):
    def test_release_gate_requires_a_minimum_response(self):
        """잘린 응답이 파싱 실패로 떨어지면 '엔진 고장' 과 '내용 탈락' 이 뭉개진다."""
        src = (ROOT / "scripts" / "prepare_weekly_release.py").read_text(encoding="utf-8")
        self.assertIn("min_chars=", src)


class WorkflowModelTests(unittest.TestCase):
    def test_gemini_model_is_overridable_without_a_code_change(self):
        """모델 id 는 EOS 한다. 코드 배포 없이 바꿀 수 있어야 한다."""
        for wf in ("market-data", "weekly-draft", "weekly-release"):
            t = (ROOT / ".github" / "workflows" / (wf + ".yml")).read_text(encoding="utf-8")
            self.assertIn("GEMINI_MODEL", t, "%s 에 모델 env 가 없다" % wf)


if __name__ == "__main__":
    unittest.main()
