"""주간 발행 스케줄의 순서·정합성을 잠근다.

이 파일이 존재하는 이유는 두 가지 실제 사고 유형이다.

1) **순서 역전** — release 가 send 보다 늦게 돌면 rev.1 원장이 없어
   `sendWeekly` 가 "발송 가능한 rev.1 원장/항목 없음 — 생략"으로 끝나고
   **그 호가 통째로 빠진다.** 조용히 실패해서 다음 주에야 알게 된다.
   2026-07-28 실측 지연은 release 2h38m·send 1h51m 였고, 당시 설계 버퍼가
   2h55m 라 실제로 17분 남고 통과했다. 버퍼는 넉넉해야 한다.

2) **발송 시각 이원화** — 실제 발송은 GitHub Actions(`weekly-send.yml`)와
   Apps Script 시간 트리거(`createWeeklyTriggers` 의 `sendWeekly`) 양쪽에서
   걸린다. 한쪽만 옮기면 옛 요일에 메일이 나가거나 정시성이 무너진다.

3) **issue_key 불일치** — 파이썬은 '다가오는 화요일의 ISO 주'를 키로 쓴다.
   draft·release·send 가 서로 다른 주를 가리키면 원장을 못 찾는다.
   일요일은 ISO 주가 끝나는 날이라 특히 어긋나기 쉽다.
"""
import importlib.util
import pathlib
import re
import sys
import unittest
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
_spec = importlib.util.spec_from_file_location("release", ROOT / "scripts" / "prepare_weekly_release.py")
release = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(release)

KST = timezone(timedelta(hours=9))
WORKFLOWS = ROOT / ".github" / "workflows"
# 발송(월 09:00)보다 release 가 이만큼은 앞서야 한다. 실측 최대 지연 2h38m 의 약 2배.
MIN_BUFFER_HOURS = 4.0
GS_WEEKDAY = {"SUNDAY": 0, "MONDAY": 1, "TUESDAY": 2, "WEDNESDAY": 3,
              "THURSDAY": 4, "FRIDAY": 5, "SATURDAY": 6}


def cron_of(name):
    """워크플로 파일에서 schedule cron 한 줄을 (분, 시, 요일)로 읽는다."""
    text = (WORKFLOWS / name).read_text(encoding="utf-8")
    found = re.findall(r'-\s*cron:\s*"(\S+)\s+(\S+)\s+\S+\s+\S+\s+(\S+)"', text)
    assert len(found) == 1, "%s: cron 이 1개가 아니다 (%d개)" % (name, len(found))
    minute, hour, dow = found[0]
    return int(minute), int(hour), int(dow)


def utc_to_kst(hour, dow, minute=0):
    """cron 의 UTC (시, 요일=0일요일) → KST (시, 요일). 9시간 더하며 날짜가 넘어간다."""
    hour += 9
    if hour >= 24:
        hour -= 24
        dow = (dow + 1) % 7
    return hour, dow, minute


def hours_from_saturday(hour, dow, minute=0):
    """토요일 00:00 KST 를 원점으로 한 경과 시간.

    주간 사이클이 일요일에 시작해 월요일에 끝나므로 ISO 주 경계(월요일)를
    원점으로 쓰면 draft 가 사이클의 '끝'으로 계산돼 순서 비교가 뒤집힌다.
    """
    return ((dow - 6) % 7) * 24 + hour + minute / 60.0


def kst_dt_for(hour, dow, minute=0):
    """2026-08-08(토)이 속한 사이클에서 그 요일·시각의 실제 KST 시각."""
    base = datetime(2026, 8, 8, 0, 0, tzinfo=KST)   # 토요일
    return base + timedelta(hours=hours_from_saturday(hour, dow, minute))


class ScheduleOrderTests(unittest.TestCase):
    def setUp(self):
        self.steps = {}
        for key, fname in (("draft", "weekly-draft.yml"),
                           ("release", "weekly-release.yml"),
                           ("send", "weekly-send.yml")):
            minute, hour, dow = cron_of(fname)
            h, d, m = utc_to_kst(hour, dow, minute)
            self.steps[key] = (h, d, m)

    def test_steps_stay_inside_the_cycle_window(self):
        """토 00:00 ~ 수 00:00 밖으로 나가면 아래 순서 비교가 무의미해진다."""
        for key, (h, d, m) in self.steps.items():
            self.assertLess(hours_from_saturday(h, d, m), 96.0, key)

    def test_draft_before_release_before_send(self):
        order = [hours_from_saturday(*self.steps[k]) for k in ("draft", "release", "send")]
        self.assertLess(order[0], order[1], "draft 가 release 보다 늦다")
        self.assertLess(order[1], order[2], "release 가 send 보다 늦다 — 호가 통째로 생략된다")

    def test_release_has_enough_buffer_before_send(self):
        gap = hours_from_saturday(*self.steps["send"]) - hours_from_saturday(*self.steps["release"])
        self.assertGreaterEqual(
            gap, MIN_BUFFER_HOURS,
            "release→send 버퍼 %.2fh — GitHub Actions 지연(실측 2h38m)에 먹힌다" % gap)

    def test_send_is_monday_0900_kst(self):
        hour, dow, minute = self.steps["send"]
        self.assertEqual((dow, hour, minute), (1, 9, 0))   # 1 = 월요일

    def test_issue_key_matches_across_the_cycle(self):
        keys = {k: release.issue_key_kst(kst_dt_for(*self.steps[k])) for k in self.steps}
        self.assertEqual(len(set(keys.values())), 1, "단계별 issue_key 불일치: %r" % keys)


class AppsScriptTriggerTests(unittest.TestCase):
    def setUp(self):
        self.gs = (ROOT / "mailer" / "Code.gs").read_text(encoding="utf-8")

    def trigger(self, handler):
        m = re.search(
            r'newTrigger\("%s"\)[^;]*?WeekDay\.(\w+)\)\.atHour\((\d+)\)' % handler, self.gs)
        self.assertIsNotNone(m, "%s 트리거를 찾지 못했다" % handler)
        return GS_WEEKDAY[m.group(1)], int(m.group(2))

    def test_apps_script_send_matches_workflow_cron(self):
        """양쪽 발송 시각이 어긋나면 옛 요일에 메일이 나간다."""
        minute, hour, dow = cron_of("weekly-send.yml")
        wf_hour, wf_dow, _ = utc_to_kst(hour, dow, minute)
        self.assertEqual(self.trigger("sendWeekly"), (wf_dow, wf_hour))

    def test_result_alert_comes_after_send(self):
        send_dow, send_hour = self.trigger("sendWeekly")
        alert_dow, alert_hour = self.trigger("weeklyAlertResult")
        self.assertEqual(alert_dow, send_dow)
        self.assertGreater(alert_hour, send_hour, "발송 결과 알림이 발송보다 이르다")

    def test_deadline_alert_comes_before_send(self):
        send = hours_from_saturday(self.trigger("sendWeekly")[1], self.trigger("sendWeekly")[0])
        d_dow, d_hour = self.trigger("weeklyAlertDeadline")
        self.assertLess(hours_from_saturday(d_hour, d_dow), send)

    def test_legacy_trigger_names_are_still_cleaned_up(self):
        """옛 이름을 삭제 목록에서 빼면 화요일 트리거가 사라진 함수를 계속 호출해
        매주 Apps Script 오류 메일이 온다."""
        block = re.search(r"function createWeeklyTriggers\(\)\s*\{(.+?)\n\}", self.gs, re.S)
        self.assertIsNotNone(block)
        names = re.search(r"var names = \[(.+?)\];", block.group(1), re.S).group(1)
        for legacy in ("weeklyAlertSunday", "weeklyAlertMonday", "weeklyAlertTuesday"):
            self.assertIn(legacy, names, "%s 가 정리 목록에서 빠졌다" % legacy)


if __name__ == "__main__":
    unittest.main()
