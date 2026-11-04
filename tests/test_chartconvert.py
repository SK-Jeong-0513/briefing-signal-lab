"""ChartConvert 원고 변환 규칙. 렌더 없이 도는 순수 함수만 고정한다.
실행: python tests/test_chartconvert.py
"""
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "ChartConvert"))
import convert  # noqa: E402

BODY = """# 제목

첫 문단입니다.

## 수입 흐름

```mermaid
sankey-beta
A,B,1
```

## 지출 흐름

```mermaid
pie
"x": 1
```

```python
print("그대로")
```
"""


def test_blocks_found_only_for_mermaid():
    assert len(convert.find_blocks(BODY)) == 2


def test_rewrite_links_images_with_heading_alt():
    out = convert.rewrite_blocks(BODY, "2026-11-x")
    assert "[![수입 흐름](library/assets/2026-11-x-1.png)](library/assets/2026-11-x-1.png)" in out
    assert "[![지출 흐름](library/assets/2026-11-x-2.png)](library/assets/2026-11-x-2.png)" in out
    assert "```mermaid" not in out
    assert "```python" in out


def test_front_matter_from_h1_and_first_paragraph():
    fm = convert.build_front_matter(BODY, "경제", "2026-11-04", ["국채"])
    assert "title: 제목\n" in fm
    assert "abstract: 첫 문단입니다.\n" in fm
    assert "category: 경제\n" in fm
    assert "tags: [국채]\n" in fm


def test_existing_front_matter_is_kept():
    front, body = convert.split_front_matter("---\ntitle: 기존\n---\n본문\n")
    assert front == "---\ntitle: 기존\n---\n"
    assert body == "본문\n"


def test_missing_category_stops():
    try:
        convert.build_front_matter(BODY, None, "2026-11-04", [])
    except convert.ConvertError:
        return
    raise AssertionError("카테고리 없이 통과했다")


def test_zero_blocks_fails_and_writes_nothing():
    with tempfile.TemporaryDirectory() as d:
        src = pathlib.Path(d) / "a.md"
        src.write_text("# 제목\n\n차트 없음\n", encoding="utf-8")
        assert convert.main([str(src), "--slug", "zero-block-test", "--category", "경제"]) == 1
    assert not list(convert.REPORTS.glob("*zero-block-test*"))


def test_sankey_labels_become_ascii_and_map_back():
    src, labels = convert.encode_sankey("""sankey-beta
개인 ($1T),"재정, 합계",10
"재정, 합계",국방,3
""")
    assert src.splitlines() == ["sankey-beta", "N0,N1,10", "N1,N2,3"]
    assert labels == {"N0": "개인 ($1T)", "N1": "재정, 합계", "N2": "국방"}


def test_comma_inside_parens_is_not_a_separator():
    src, labels = convert.encode_sankey("""sankey-beta
순이자 ($1,052B),해외 ($243B),243""")
    assert src.splitlines()[1] == "N0,N1,243"
    assert labels["N0"] == "순이자 ($1,052B)"


def test_other_diagrams_pass_through():
    src = """pie
"x": 1"""
    assert convert.encode_sankey(src) == (src, {})


def test_bad_sankey_row_stops():
    try:
        convert.encode_sankey("""sankey-beta
A,B""")
    except convert.ConvertError:
        return
    raise AssertionError("칸 수가 틀린 행이 통과했다")


def stops(text):
    try:
        convert.check_draft(text)
    except convert.ConvertError:
        return True
    return False


def test_broken_text_stops():
    assert stops("# 제목\n\n" + convert.BROKEN_CHAR * 4)


def test_local_image_stops():
    assert stops("# 제목\n\n![그림](images/a.png)\n")
    assert stops('# 제목\n\n<img src="a.png">\n')


def test_web_image_and_code_sample_pass():
    assert not stops("# 제목\n\n![그림](https://example.com/a.png)\n")
    assert not stops("# 제목\n\n`![a](b.png)`\n\n```md\n![a](b.png)\n```\n")


def test_existing_site_image_passes():
    name = next(convert.ASSETS.glob("*.svg")).name
    assert not stops("# 제목\n\n![그림](library/assets/%s)\n" % name)


def test_note_front_matter_needs_no_category():
    assert not stops("---\ntitle: 노트\ntype: note\n---\n본문\n")
    assert stops("---\ntitle: 리포트\ntype: report\n---\n본문\n")
    assert stops("---\ntitle: 노트\ntype: note\ncategory: 투자\n---\n본문\n")
    assert stops("---\ntitle: 기타\ntype: memo\ncategory: 경제\n---\n본문\n")


def test_note_goes_to_notes_folder():
    job = convert.prepare("# 노트\n\n본문\n", "n", "", [], allow_no_charts=True, doc_type="note")
    assert job["report"].parent == convert.NOTES
    assert "type: note\n" in job["front"] and "category" not in job["front"]
    with_front = convert.prepare("---\ntitle: 노트\ntype: note\n---\n본문\n", "n", "", [], allow_no_charts=True)
    assert with_front["report"].parent == convert.NOTES


def test_report_stays_in_reports_folder():
    job = convert.prepare("# 글\n\n본문\n", "r", "경제", [], allow_no_charts=True)
    assert job["report"].parent == convert.REPORTS


def test_front_value_does_not_read_next_line():
    assert convert.front_value("---\nabstract: \naccess: free\n---\n", "abstract") == ""


def test_bad_slug_fails():
    assert convert.main(["없는파일.md", "--slug", "한글"]) == 1


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print("%d passed" % len(tests))
