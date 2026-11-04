#!/usr/bin/env python3
"""ChartConvert: AI 가 만든 .md 의 ```mermaid 블록을 PNG 로 바꿔 서재 리포트로 만든다.

사이트(read.html)에는 Mermaid 가 없어 블록이 코드 텍스트로 보인다. 이 도구는 로컬
헤드리스 Chromium 으로 그려 public/library/assets/ 에 PNG 를 두고, 블록을 이미지 링크로
바꾼 리포트를 public/library/reports/ 에 쓴다. 사용법은 README.md.

실패 정책: 블록 0건·렌더 실패·대상 파일 존재는 전부 오류로 멈추고 아무것도 쓰지 않는다.
"""
import argparse
import datetime
import os
import pathlib
import re
import subprocess
import sys
from zoneinfo import ZoneInfo

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent
MERMAID_JS = HERE / "node_modules" / "mermaid" / "dist" / "mermaid.min.js"
ASSETS = REPO / "public" / "library" / "assets"
REPORTS = REPO / "public" / "library" / "reports"
CATEGORIES = ("기술", "금융", "경제")
BOM = chr(0xFEFF)
SCALE = 2  # 고해상도 화면에서 흐려지지 않게 2배로 찍는다

BLOCK_RE = re.compile(r"^```mermaid[ \t]*\n(.*?)^```[ \t]*$", re.M | re.S)
SANKEY_COMMA_RE = re.compile(r',(?=(?:[^"]*"[^"]*")*[^"]*$)(?![^()]*\))')

# 색은 public/assets/style.css 토큰(--surface·--text·--primary·--primary-soft·--border)
RENDER_JS = """
async ([src, id, labels]) => {
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict', theme: 'base',
    fontFamily: 'Pretendard, "Malgun Gothic", sans-serif',
    themeVariables: {
      background: '#FFFFFF', primaryColor: '#E8EEFF', primaryTextColor: '#17202A',
      primaryBorderColor: '#2454D6', lineColor: '#5F6B7A', fontSize: '16px',
      fontFamily: 'Pretendard, "Malgun Gothic", sans-serif'
    },
    sankey: { width: 640, height: 680, linkColor: '#2454D6', nodeAlignment: 'justify',
              showValues: false, useMaxWidth: false }
  });
  const { svg } = await mermaid.render(id, src);
  const host = document.getElementById('host');
  host.innerHTML = svg;
  host.querySelectorAll('text').forEach(t => {
    if (labels[t.textContent]) t.textContent = labels[t.textContent];
  });
  host.querySelectorAll('.node rect').forEach(r => r.setAttribute('fill', '#2454D6'));
  host.querySelectorAll('.link path').forEach(p => p.setAttribute('stroke-opacity', '0.22'));
  return true;
}
"""


class ConvertError(Exception):
    pass


def split_front_matter(text):
    """(프런트매터 블록 또는 None, 본문)."""
    m = re.match(r"---\n.*?\n---\n?", text, re.S)
    return (m.group(0), text[m.end():]) if m else (None, text)


def find_blocks(body):
    return [m.group(1).strip() for m in BLOCK_RE.finditer(body)]


def nearest_heading(body, pos):
    heads = re.findall(r"^#{1,6}\s+(.+)$", body[:pos], re.M)
    return heads[-1].strip() if heads else ""


def rewrite_blocks(body, stem):
    """블록을 이미지 링크로 바꾼다. 이미지를 누르면 원본 크기로 열린다(모바일 확대용)."""
    count = [0]

    def repl(m):
        count[0] += 1
        src = "library/assets/%s-%d.png" % (stem, count[0])
        alt = nearest_heading(body, m.start()).replace("[", "").replace("]", "") or "차트"
        return "[![%s](%s)](%s)" % (alt, src, src)

    return BLOCK_RE.sub(repl, body)


def build_front_matter(body, category, date, tags):
    """프런트매터가 없는 원고용. 제목은 H1, 초록은 첫 일반 문단에서 가져온다."""
    title = re.search(r"^#\s+(.+)$", body, re.M)
    if not title:
        raise ConvertError("프런트매터도 H1 제목도 없습니다. 원고 맨 위에 # 제목 을 넣어 주세요.")
    if category not in CATEGORIES:
        raise ConvertError("프런트매터가 없어 --category 가 필요합니다: %s" % " / ".join(CATEGORIES))
    abstract = ""
    for para in re.split(r"\n\s*\n", body[title.end():]):
        para = para.strip()
        if para and not re.match(r"[#\-*|>`!\[]", para):
            abstract = " ".join(para.split())
            break
    return "\n".join([
        "---",
        "title: %s" % title.group(1).strip(),
        "type: report",
        "category: %s" % category,
        "tags: [%s]" % ", ".join(tags),
        "date: %s" % date,
        "abstract: %s" % abstract,
        "access: free",
        "---",
        "",
    ])


def encode_sankey(src):
    """Mermaid 의 sankey 문법은 라벨에 ASCII 만 받는다(따옴표로 묶어도 한글은 실패).
    라벨을 N0, N1… 로 바꿔 그린 뒤 SVG 에서 되돌린다. (바꾼 원문, {코드: 라벨}) 반환."""
    lines = src.strip().splitlines()
    if not lines[0].strip().startswith("sankey"):
        return src, {}
    codes, out = {}, [lines[0]]
    for line in filter(str.strip, lines[1:]):
        # 라벨의 "($1,052B)" 처럼 괄호·따옴표 안 쉼표는 구분자가 아니다.
        row = [x.strip().strip('"') for x in SANKEY_COMMA_RE.split(line)]
        if len(row) != 3:
            raise ConvertError("sankey 행은 출발,도착,값 3칸이어야 합니다: %s" % ",".join(row))
        a, b = (codes.setdefault(x.strip(), "N%d" % len(codes)) for x in row[:2])
        out.append("%s,%s,%s" % (a, b, row[2].strip()))
    return chr(10).join(out), {code: label for label, code in codes.items()}


def render_png(blocks):
    """블록마다 PNG 바이트를 돌려준다. 하나라도 실패하면 ConvertError."""
    if not MERMAID_JS.exists():
        raise ConvertError("Mermaid 가 없습니다. ChartConvert 폴더에서 npm install 을 먼저 실행하세요.")
    from playwright.sync_api import Error as PlaywrightError, sync_playwright

    pngs = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1000, "height": 900}, device_scale_factor=SCALE)
        # 렌더 중 외부 요청을 전부 막는다: 오프라인 동작을 보장하고 원고가 밖으로 나가지 않는다.
        page.route("**/*", lambda route: route.abort())
        page.set_content('<!doctype html><meta charset="utf-8">'
                         '<body style="margin:0;background:#FFFFFF">'
                         '<div id="host" style="display:inline-block;padding:16px;background:#FFFFFF"></div>')
        page.add_script_tag(content=MERMAID_JS.read_text(encoding="utf-8"))
        for i, src in enumerate(blocks, 1):
            try:
                ascii_src, labels = encode_sankey(src)
                page.evaluate(RENDER_JS, [ascii_src, "chart%d" % i, labels])
                pngs.append(page.locator("#host").screenshot())
            except PlaywrightError as e:
                raise ConvertError("%d번째 차트 렌더 실패: %s" % (i, str(e).splitlines()[0]))
        browser.close()
    return pngs


def git(*args):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")  # 앱에서 인증 프롬프트로 멈추지 않게
    done = subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, env=env,
                          encoding="utf-8", errors="replace", timeout=120)
    if done.returncode:
        raise ConvertError("git %s 실패: %s" % (args[0], done.stderr.strip() or done.stdout.strip()))
    return done.stdout


def preflight():
    """원격이 내 미커밋 파일을 바꿨다면 autostash 가 그 작업을 충돌 상태로 남긴다. 쓰기 전에 멈춘다."""
    git("fetch", "origin", "main")
    dirty = set(git("diff", "--name-only", "HEAD").splitlines())
    overlap = dirty & set(git("diff", "--name-only", "HEAD", "origin/main").splitlines())
    if overlap:
        raise ConvertError("미커밋 파일을 원격도 바꿨습니다. 먼저 정리하세요(공개 안 함): %s"
                           % ", ".join(sorted(overlap)))


def publish(paths, title):
    """이 도구가 만든 파일만 커밋해 올린다. 다른 미커밋 변경은 건드리지 않는다."""
    rel = [str(p.relative_to(REPO)) for p in paths]
    if not git("status", "--porcelain", "--", *rel).strip():
        raise ConvertError("이미 공개된 내용과 같습니다. 바뀐 것이 없어 공개하지 않았습니다.")
    git("add", "--", *rel)
    git("commit", "-m", "feat(library): %s" % title,
        "-m", "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", "--", *rel)
    try:
        git("pull", "--rebase", "--autostash", "origin", "main")
        git("push", "origin", "HEAD:main")
    except ConvertError as e:
        raise ConvertError("%s (로컬 커밋은 만들어졌고 푸시는 안 됐습니다)" % e)


def prepare(text, slug, category, tags, allow_no_charts=False):
    """원고를 검사해 결과물 계획을 돌려준다. 아무것도 쓰지 않는다."""
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug or ""):
        raise ConvertError("파일 이름은 영문 소문자·숫자·하이픈만 씁니다: %s" % slug)
    front, body = split_front_matter(text.lstrip(BOM).replace("\r\n", "\n"))
    blocks = find_blocks(body)
    if not blocks and not allow_no_charts:
        raise ConvertError("mermaid 블록이 0건입니다. 변환할 차트가 없습니다.")
    today = datetime.datetime.now(ZoneInfo("Asia/Seoul")).date()
    stem = "%s-%s" % (today.strftime("%Y-%m"), slug)
    if front is None:
        front = build_front_matter(body, category, today.isoformat(), tags) + "\n"
    return {
        "stem": stem, "front": front, "body": body, "blocks": blocks,
        "report": REPORTS / (stem + ".md"),
        "images": [ASSETS / ("%s-%d.png" % (stem, i)) for i in range(1, len(blocks) + 1)],
    }


def taken_files(job):
    return [p.name for p in [job["report"]] + job["images"] if p.exists()]


def write_outputs(job, pngs):
    for path, data in zip(job["images"], pngs):
        path.write_bytes(data)
    job["report"].write_text(job["front"] + rewrite_blocks(job["body"], job["stem"]),
                             encoding="utf-8", newline="\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description="mermaid 블록이 든 .md 를 서재 리포트로 변환")
    ap.add_argument("source", type=pathlib.Path, help="원고 .md (보통 ChartConvert/input/ 안)")
    ap.add_argument("--slug", required=True, help="영문 소문자 파일명, 예: us-federal-interest")
    ap.add_argument("--category", help="프런트매터가 없을 때 필수: " + " / ".join(CATEGORIES))
    ap.add_argument("--tags", default="", help="쉼표 구분 태그")
    ap.add_argument("--force", action="store_true", help="같은 이름의 결과물을 덮어쓴다")
    ap.add_argument("--publish", action="store_true", help="변환 뒤 커밋·푸시(사이트 공개)")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")  # 파이프로 받아도 한글 오류문이 깨지지 않게
    sys.stderr.reconfigure(encoding="utf-8")

    try:
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args.slug):
            raise ConvertError("--slug 는 영문 소문자·숫자·하이픈만 씁니다: %s" % args.slug)
        job = prepare(args.source.read_text(encoding="utf-8"), args.slug, args.category, tags)
        taken = taken_files(job)
        if taken and not args.force:
            raise ConvertError("이미 있습니다(덮어쓰려면 --force): %s" % ", ".join(taken))
        pngs = render_png(job["blocks"])  # 전부 성공한 뒤에만 쓴다
        if args.publish:
            preflight()
        write_outputs(job, pngs)
        print("차트 %d건 변환 -> %s" % (len(pngs), job["report"].relative_to(REPO)))
        for path, data in zip(job["images"], pngs):
            print("  %s (%d KB)" % (path.relative_to(REPO), len(data) // 1024))
        if args.publish:
            publish([job["report"]] + job["images"], job["stem"])
            print("푸시 완료. 목록 갱신과 배포는 library-manifest.yml 이 이어서 합니다.")
        else:
            print("아직 공개되지 않았습니다. 확인 후 같은 명령에 --force --publish 를 더해 실행하세요.")
    except ConvertError as e:
        print("[ERROR] %s" % e, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
