#!/usr/bin/env python3
"""Briefing Signal Lab — 서재(Library) manifest 생성기.
public/library/{reports,notes}/*.md 의 YAML 프런트매터를 스캔해
public/assets/data/library.json 을 재생성한다. stdlib만 사용(pip 불필요).
프런트매터는 단순 `key: value` + 인라인 리스트(`[a, b]`)만 지원한다.
"""
import json, os, glob, time

ROOT = os.path.join(os.path.dirname(__file__), "..", "public")
DIRS = [("reports", "report"), ("notes", "note")]
OUT = os.path.join(ROOT, "assets", "data", "library.json")


def parse_front_matter(text):
    """앞부분 --- ... --- 블록을 dict로 파싱. (meta, body) 반환."""
    if not text.startswith("---"):
        return {}, text
    lines = text.splitlines()
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        return {}, text
    meta = {}
    for line in lines[1:end]:
        if not line.strip() or ":" not in line:
            continue
        key, _, val = line.partition(":")
        key, val = key.strip(), val.strip()
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            meta[key] = [x.strip().strip('"\'') for x in inner.split(",") if x.strip()] if inner else []
        else:
            meta[key] = val.strip('"\'')
    return meta, "\n".join(lines[end + 1:])


def main():
    items = []
    for sub, default_type in DIRS:
        for path in sorted(glob.glob(os.path.join(ROOT, "library", sub, "*.md"))):
            with open(path, encoding="utf-8-sig") as f:  # BOM 허용
                meta, _ = parse_front_matter(f.read())
            slug = os.path.splitext(os.path.basename(path))[0]
            tags = meta.get("tags")
            item = {
                "id": slug,
                "title": meta.get("title", slug),
                "type": meta.get("type", default_type),
                "category": meta.get("category", ""),
                "tags": tags if isinstance(tags, list) else [],
                "date": meta.get("date", ""),
                "abstract": meta.get("abstract", ""),
                "access": meta.get("access", "free"),
                "file": "library/%s/%s" % (sub, os.path.basename(path)),
            }
            for k in ("title_en", "abstract_en", "cover"):  # 예약 필드(있으면 통과)
                if meta.get(k):
                    item[k] = meta[k]
            items.append(item)
    items.sort(key=lambda x: x.get("date") or "", reverse=True)  # 최신순
    out = {"updated": time.strftime("%Y-%m-%d"), "items": items}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("-> %s (%d items)" % (os.path.abspath(OUT), len(items)))
    for it in items:
        print("  [%s] %s | %s | %s" % (it["type"], it["id"], it["date"], it["title"]))


if __name__ == "__main__":
    main()
