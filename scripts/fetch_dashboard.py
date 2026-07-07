#!/usr/bin/env python3
"""Briefing Signal Lab — 대시보드 데이터 수집기.
무키 공개 API만 사용: Yahoo Finance v8 chart + 미 재무부 Fiscal Data(DTS).
출력: public/assets/data/dashboard.json  (관계 페어 오버레이용 시계열).
stdlib만 사용(Actions에서 pip 불필요). 실패한 시계열은 건너뛰고 로그.
"""
import json, os, sys, time, urllib.request, urllib.error

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BriefingSignalLab/1.0"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "data", "dashboard.json")
RANGE = "3y"

# 시계열 정의: key -> (이름, 단위, Yahoo 심볼)  (TGA/바스켓은 별도 처리)
YAHOO = {
    "tnx":    ("미 10년물 금리", "%",  "%5ETNX"),
    "gspc":   ("S&P 500",       "pt", "%5EGSPC"),
    "ks11":   ("KOSPI",         "pt", "%5EKS11"),
    "dxy":    ("달러지수",       "pt", "DX-Y.NYB"),
    "gold":   ("금",            "$",  "GC=F"),
    "copper": ("구리",          "$",  "HG=F"),
    "ewy":    ("MSCI 한국(EWY)", "$",  "EWY"),
}
# 반도체 밸류체인 바스켓(동일가중, 리베이스100 평균). 티커는 자유 교체.
BASKET = {
    "삼성전자": "005930.KS", "SK하이닉스": "000660.KS", "한미반도체": "042700.KS",
    "주성엔지니어링": "036930.KQ", "리노공업": "058470.KQ",
}
# 관계 페어(좌축 ↔ 우축)
PAIRS = [
    {"id": "rate-index",   "label": "금리 ↔ 주가지수",           "left": "tnx",    "right": "gspc"},
    {"id": "tga-index",    "label": "TGA 잔고 ↔ 주가지수",        "left": "tga",    "right": "gspc"},
    {"id": "dollar-kospi", "label": "달러 ↔ KOSPI",              "left": "dxy",    "right": "ks11"},
    {"id": "metal-rate",   "label": "구리 ↔ 금리",               "left": "copper", "right": "tnx"},
    {"id": "ewy-krsemi",   "label": "미 야간(EWY) ↔ 반도체 바스켓", "left": "ewy",    "right": "krsemi"},
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))


def yahoo(symbol):
    """(ts[], val[]) — 종가, null 제거."""
    url = "https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=1d" % (symbol, RANGE)
    j = get(url)
    res = j["chart"]["result"][0]
    ts = res["timestamp"]
    close = res["indicators"]["quote"][0]["close"]
    out_t, out_v = [], []
    for t, v in zip(ts, close):
        if v is not None:
            out_t.append(int(t))
            out_v.append(round(float(v), 4))
    return out_t, out_v


def treasury_tga():
    """미 재무부 DTS — TGA 종가 잔고($M). 무키. Closing Balance 행에서 금액 필드 자동 탐색."""
    base = ("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/"
            "operating_cash_balance?filter=record_date:gte:2023-01-01&sort=record_date&page[size]=10000")
    j = get(base)
    rows = j.get("data", [])
    if not rows:
        print("  [TGA] data 없음. keys=%s" % list(j.keys()))
        return [], []

    def amount(row):
        # 금액으로 보이는 필드 자동 탐색(*_bal / amt 계열 중 파싱 가능한 첫 값)
        for k in ("close_today_bal", "open_today_bal"):
            v = row.get(k)
            if v not in (None, "", "null"):
                try:
                    return float(v)
                except Exception:
                    pass
        for k, v in row.items():
            if ("bal" in k or "amt" in k) and v not in (None, "", "null"):
                try:
                    return float(v)
                except Exception:
                    pass
        return None

    seen, out_t, out_v, sample = set(), [], [], None
    for row in rows:
        acct = (row.get("account_type") or "")
        if "TGA" not in acct or "Closing" not in acct:
            continue
        d = row.get("record_date")
        if not d or d in seen:
            continue
        v = amount(row)
        if v is None:
            if sample is None:
                sample = row
            continue
        try:
            ts = int(time.mktime(time.strptime(d, "%Y-%m-%d")))
            out_t.append(ts); out_v.append(round(v, 1)); seen.add(d)
        except Exception:
            continue
    if not out_v and sample:
        print("  [TGA] Closing 행 금액 필드 못 찾음. 샘플=%s" % sample)
    return out_t, out_v


def rebase_basket(members):
    """구성종목을 각자 100으로 리베이스 후 공통일자 평균 → 동일가중 지수."""
    series = {}
    for name, sym in members.items():
        try:
            t, v = yahoo(sym)
            if len(v) > 5:
                series[name] = dict(zip(t, v))
                print("  basket %s(%s): %d pts" % (name, sym, len(v)))
        except Exception as e:
            print("  [WARN] basket %s(%s) 실패: %s" % (name, sym, e))
    if not series:
        return [], []
    common = None
    for m in series.values():
        common = set(m) if common is None else (common & set(m))
    common = sorted(common)
    if not common:
        return [], []
    first = {name: m[common[0]] for name, m in series.items()}
    out_t, out_v = [], []
    for ts in common:
        vals = [m[ts] / first[name] * 100.0 for name, m in series.items()]
        out_t.append(ts); out_v.append(round(sum(vals) / len(vals), 3))
    return out_t, out_v


def main():
    series = {}
    for key, (name, unit, sym) in YAHOO.items():
        try:
            t, v = yahoo(sym)
            series[key] = {"name": name, "unit": unit, "t": t, "v": v}
            print("%s(%s): %d pts" % (key, sym, len(v)))
        except Exception as e:
            print("[WARN] %s(%s) 실패: %s" % (key, sym, e))
    try:
        t, v = treasury_tga()
        if v:
            series["tga"] = {"name": "미 재무부 TGA", "unit": "$M", "t": t, "v": v}
            print("tga: %d pts" % len(v))
        else:
            print("[WARN] TGA 데이터 없음")
    except Exception as e:
        print("[WARN] TGA 실패: %s" % e)
    print("반도체 바스켓 계산...")
    bt, bv = rebase_basket(BASKET)
    if bv:
        series["krsemi"] = {"name": "반도체 바스켓(동일가중)", "unit": "=100", "t": bt, "v": bv}
        print("krsemi: %d pts" % len(bv))

    # 좌/우 시계열이 모두 있는 페어만 노출
    pairs = [p for p in PAIRS if p["left"] in series and p["right"] in series]
    out = {
        "updated": time.strftime("%Y-%m-%d"),
        "note": "공개 출처 실데이터(Yahoo Finance · 미 재무부). 정보 제공이며 투자 조언 아님.",
        "series": series,
        "pairs": pairs,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("→ %s (%d series, %d pairs)" % (os.path.abspath(OUT), len(series), len(pairs)))
    if len(pairs) < 3:
        print("[WARN] 페어 %d개 — 데이터 수집 확인 필요" % len(pairs))


if __name__ == "__main__":
    main()
