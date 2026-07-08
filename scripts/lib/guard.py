#!/usr/bin/env python3
"""Briefing Signal Lab — §6 투자판단 린트 (무인 자동 발행의 유일한 방어선).

AI가 생성한 브리핑을 Sheet에 쓰기 직전에 스캔한다. 매수·매도·목표가·비중 등
투자판단 표현이 있으면 해당 항목을 제외(권장)하거나 마스킹한다. stdlib만 사용.

사용:
    from lib.guard import screen, scan, filter_items
    clean, hits = screen(text)          # clean=False면 발행 금지
    kept = filter_items(rows, ["제목", "요약", "근거"])  # 위반 행 제외 + 로그

자가검증:
    python scripts/lib/guard.py --selftest
"""
import re
import sys

# 명시적 투자판단 표현(발견 시 항목 제외). 이번 세션 실제 위반 문구를 포함해 큐레이션.
BANNED = [
    "매수 추천", "매도 추천", "매수 의견", "매도 의견", "매수세", "매도세",
    "목표가", "목표 주가", "목표주가", "적정 주가", "적정주가", "적정 가치",
    "비중 확대", "비중 축소", "비중 조절", "비중을 늘", "비중을 줄",
    "풀매수", "손절", "익절", "물타기", "불타기", "저가 매수", "저가매수", "매집",
    "강력 추천", "강력추천", "적극 매수", "적극 추천",
    "베팅", "뇌관", "순환 배치", "담아야", "사야 한다", "팔아야 한다",
    "불티", "따상", "상한가 노려", "단타",
]

# 주의 신호(제외까진 아니나 로그로 남겨 사후 점검). 문맥상 정당한 분석일 수 있음.
SOFT = [
    "투자 포인트", "비중", "매수", "매도", "리레이팅", "재평가", "필수적",
    "알파", "수익률 극대화", "저평가", "고평가",
]


def scan(text, terms=BANNED):
    """text에서 걸린 표현 리스트(중복 제거, 등장 순)."""
    if not text:
        return []
    hits, seen = [], set()
    for term in terms:
        if term in text and term not in seen:
            seen.add(term)
            hits.append(term)
    return hits


def screen(text):
    """(clean: bool, hits: list). BANNED가 하나도 없으면 clean=True."""
    hits = scan(text, BANNED)
    return (len(hits) == 0, hits)


def soft_scan(text):
    """주의 신호(SOFT) 리스트 — 로그용."""
    return scan(text, SOFT)


def mask(text):
    """BANNED 표현을 […]로 마스킹(제외 대신 게시하고 싶을 때)."""
    out = text or ""
    for term in BANNED:
        out = out.replace(term, "[…]")
    return out


def filter_items(rows, text_fields, log=None):
    """dict 리스트에서 지정 필드에 BANNED가 있는 행을 제외. 남은 행 반환.
    log(callable)이 있으면 제외 사유를 넘김."""
    kept = []
    for i, row in enumerate(rows):
        blob = " ".join(str(row.get(f, "")) for f in text_fields)
        clean, hits = screen(blob)
        if clean:
            soft = soft_scan(blob)
            if soft and log:
                log("[guard] soft %d: %s" % (i, ", ".join(soft)))
            kept.append(row)
        elif log:
            log("[guard] DROP %d: %s" % (i, ", ".join(hits)))
    return kept


def _selftest():
    # 이번 세션(2026-07-08)에 실제로 §6를 어긴 문구들 — 반드시 걸려야 함.
    violations = [
        "정밀 소부장 생태계에 대한 과감한 비중 확대가 필수적이다.",
        "제조 플랫폼의 패러다임 전환에 베팅해야 한다.",
        "수주 공시가 주가 재평가의 뇌관이 될 것이다.",
        "중장기 CPO 코어 생태계로 자본을 적극적으로 순환 배치해야 한다.",
        "글로벌 연기금의 의무 편입 매수세가 기계적으로 발생한다.",
        "삼성전자 목표가 12만원, 지금이 저가 매수 구간.",
    ]
    # §6를 지킨(관찰·메커니즘형) 문구들 — 통과해야 함.
    clean = [
        "HBM4 본딩 공정이 병목으로 부상하며 후공정 장비 수요가 커지고 있다.",
        "삼성전자 파운드리의 고객 확보 수주 여부가 시장의 주요 관찰 지점이다.",
        "구리 인터커넥트의 물리적 한계로 광학 전환이 진행 중이다.",
    ]
    fails = []
    for t in violations:
        ok, hits = screen(t)
        if ok:
            fails.append("MISS(위반 통과): " + t)
    for t in clean:
        ok, hits = screen(t)
        if not ok:
            fails.append("FALSE+(정상 차단): %s | %s" % (t, hits))
    if fails:
        print("SELFTEST FAIL:")
        for f in fails:
            print("  " + f)
        return 1
    print("SELFTEST OK - 위반 %d개 전부 차단, 정상 %d개 전부 통과" % (len(violations), len(clean)))
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        sys.exit(_selftest())
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
        ok, hits = screen(text)
        print("clean=%s hits=%s soft=%s" % (ok, hits, soft_scan(text)))
    else:
        print("usage: guard.py --selftest | guard.py <text>")
