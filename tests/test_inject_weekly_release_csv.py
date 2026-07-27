import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("injector", ROOT / "scripts" / "inject_weekly_release_csv.py")
injector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(injector)

class InjectWeeklyReleaseCsvTests(unittest.TestCase):
    def test_injects_valid_published_csv(self):
        url = "https://docs.google.com/spreadsheets/d/e/example/pub?gid=1&single=true&output=csv"
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "site.js"
            path.write_text('const WEEKLY_RELEASE_ITEMS_CSV = "";', encoding="utf-8")
            injector.inject(path, url)
            self.assertIn(url, path.read_text(encoding="utf-8"))
    def test_rejects_non_csv_url(self):
        with self.assertRaises(ValueError):
            injector.inject(pathlib.Path("unused"), "https://example.com/file.csv")

if __name__ == "__main__": unittest.main()
