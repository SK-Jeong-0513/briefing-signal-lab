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


def test_bad_slug_fails():
    assert convert.main(["없는파일.md", "--slug", "한글"]) == 1


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print("%d passed" % len(tests))
