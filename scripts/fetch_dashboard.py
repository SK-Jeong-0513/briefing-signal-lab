#!/usr/bin/env python3
"""Briefing Signal Lab — 대시보드 데이터 수집기.
공개 API: Yahoo Finance v8 chart + 미 재무부 Fiscal Data(DTS) + 관세청 수출(키 필요, 선택).
출력: public/assets/data/dashboard.json  (관계 페어 오버레이용 시계열).
stdlib만 사용(Actions에서 pip 불필요). 실패한 시계열은 건너뛰고 로그.
"""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BriefingSignalLab/1.0"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "data", "dashboard.json")
RANGE = "3y"

# 시계열 정의: key -> (이름, 단위, Yahoo 심볼)  (TGA/바스켓은 별도 처리)
YAHOO = {
    # 관계 페어용 매크로·시장
    "tnx":    ("미 10년물 금리", "%",  "%5ETNX"),
    "gspc":   ("S&P 500",       "pt", "%5EGSPC"),
    "ks11":   ("KOSPI",         "pt", "%5EKS11"),
    "dxy":    ("달러지수",       "pt", "DX-Y.NYB"),
    "gold":   ("금",            "$",  "GC=F"),
    "copper": ("구리",          "$",  "HG=F"),
    "ewy":    ("MSCI 한국(EWY)", "$",  "EWY"),
    # 반도체 개별주(페어5 드롭다운 옵션)
    "samsung": ("삼성전자",       "원", "005930.KS"),
    "hynix":   ("SK하이닉스",     "원", "000660.KS"),
    "hanmi":   ("한미반도체",     "원", "042700.KS"),
    "joosung": ("주성엔지니어링", "원", "036930.KQ"),
    "leeno":   ("리노공업",       "원", "058470.KQ"),
    # 밸류체인 자동 프록시(P2)
    "soxx": ("미 반도체 ETF (SOXX)", "$",  "SOXX"),
    "smh":  ("반도체 ETF (SMH)",     "$",  "SMH"),
    "mu":   ("마이크론 (MU)",        "$",  "MU"),
    "tsm":  ("TSMC (TSM)",          "$",  "TSM"),
    "sox":  ("필라델피아 반도체지수",  "pt", "%5ESOX"),
}
# 반도체 바스켓(동일가중, 리베이스100). 개별주는 위 YAHOO에서 이미 수집됨.
BASKET = {"삼성전자": "005930.KS", "SK하이닉스": "000660.KS", "한미반도체": "042700.KS",
          "주성엔지니어링": "036930.KQ", "리노공업": "058470.KQ"}
# 페어5 우축 드롭다운 옵션 [series_key, 표시명] (기본=맨 앞=삼성전자)
KRSEMI_OPTIONS = [["samsung", "삼성전자"], ["hynix", "SK하이닉스"], ["hanmi", "한미반도체"],
                  ["joosung", "주성엔지니어링"], ["leeno", "리노공업"], ["krsemi", "반도체 바스켓(동일가중)"]]
# 밸류체인 지표(자동 프록시) — 카드로 표시
VALUECHAIN = ["soxx", "smh", "mu", "tsm", "sox"]
# 관계 페어(좌축 ↔ 우축)
PAIRS = [
    {"id": "rate-index",   "label": "금리 ↔ 주가지수",           "left": "tnx",    "right": "gspc"},
    {"id": "tga-index",    "label": "TGA 잔고 ↔ 주가지수",        "left": "tga",    "right": "gspc"},
    {"id": "dollar-kospi", "label": "달러 ↔ KOSPI",              "left": "dxy",    "right": "ks11"},
    {"id": "metal-rate",   "label": "구리 ↔ 금리",               "left": "copper", "right": "tnx"},
    {"id": "ewy-krsemi",   "label": "미 야간(EWY) ↔ 한국 반도체",  "left": "ewy",    "right": "samsung",
     "rightOptions": KRSEMI_OPTIONS},
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


EXP_BASE = "https://apis.data.go.kr/1220000/cntyMmUtPrviExpAcrs"  # 관세청 수출 주요국가별 10일 잠정치


def customs_export():
    """관세청 수출(10일 잠정치) — 기간별 총 수출액(itemUsdAmt00). 키(DATA_GO_KR_KEY) 필요.
    응답 스키마: item{ priodYear, priodMon, priodDt, itemUsdAmt00..10 }.
    요청 필수 파라미터를 priodYear/priodMon/priodDt/strtYmd 순으로 탐색."""
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if not key:
        print("[수출] DATA_GO_KR_KEY 시크릿 없음 — 건너뜀")
        return [], []
    keyq = key if "%" in key else urllib.parse.quote(key, safe="")
    today = time.strftime("%Y%m%d")
    url = (EXP_BASE + "/getCntyMmUtPrviExpAcrs?serviceKey=" + keyq +
           "&numOfRows=2000&pageNo=1&strtYymm=20210101&endYymm=" + today)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception as e:
        print("[수출] 요청 실패: %s" % e)
        return [], []
    code = body.split("<resultCode>")[-1].split("</resultCode>")[0].strip() if "<resultCode>" in body else "?"
    try:
        root = ET.fromstring(body)
    except Exception as e:
        print("[수출] XML 파싱 실패: %s | head=%s" % (e, body[:160].replace("\n", " ")))
        return [], []
    items = root.findall(".//item")
    print("[수출] code=%s items=%d" % (code, len(items)))
    if not items:
        print("[수출] head=%s" % body[:220].replace("\n", " "))
        return [], []
    print("[수출] item[0]=%s" % {c.tag: (c.text or "") for c in list(items[0])})
    agg = {}
    for it in items:
        d = {c.tag: (c.text or "") for c in list(it)}
        ds = "".join(ch for ch in (d.get("priodDt") or "") if ch.isdigit())
        if len(ds) < 8:
            y = "".join(ch for ch in (d.get("priodYear") or "") if ch.isdigit())
            m = "".join(ch for ch in (d.get("priodMon") or "") if ch.isdigit())
            if len(m) == 6:
                ds = m + "01"
            elif len(y) == 4 and len(m) >= 2:
                ds = y + m[-2:] + "01"
        ds = ds[:8]
        if len(ds) != 8:
            continue
        val = (d.get("itemUsdAmt00") or "").replace(",", "").strip()
        if not val:  # 00(총계) 없으면 01~10 합산
            s, ok = 0.0, False
            for i in range(1, 11):
                x = (d.get("itemUsdAmt%02d" % i) or "").replace(",", "").strip()
                if x:
                    try:
                        s += float(x); ok = True
                    except Exception:
                        pass
            val = s if ok else ""
        try:
            agg[ds] = float(val)
        except Exception:
            continue
    out_t, out_v = [], []
    for ds in sorted(agg):
        try:
            out_t.append(int(time.mktime(time.strptime(ds, "%Y%m%d")))); out_v.append(round(agg[ds], 1))
        except Exception:
            continue
    print("[수출] → %d 기간" % len(out_v))
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
    try:
        et, ev = customs_export()
        if ev:
            series["exports"] = {"name": "수출(주요국 합계, 10일)", "unit": "천$", "t": et, "v": ev}
            print("exports: %d pts" % len(ev))
    except Exception as e:
        print("[WARN] 수출 실패: %s" % e)

    # 좌/우 시계열이 모두 있는 페어만 노출. rightOptions는 수집된 것만.
    pairs = []
    for p in PAIRS:
        if p["left"] not in series or p["right"] not in series:
            continue
        q = dict(p)
        if "rightOptions" in q:
            q["rightOptions"] = [o for o in q["rightOptions"] if o[0] in series]
        pairs.append(q)
    if "exports" in series and "samsung" in series:
        pairs.append({"id": "export-krsemi", "label": "수출 ↔ 반도체 종목", "left": "exports", "right": "samsung",
                      "rightOptions": [o for o in KRSEMI_OPTIONS if o[0] in series]})
    valuechain = [k for k in VALUECHAIN if k in series]
    out = {
        "updated": time.strftime("%Y-%m-%d"),
        "note": "공개 출처 실데이터(Yahoo Finance · 미 재무부). 정보 제공이며 투자 조언 아님.",
        "series": series,
        "pairs": pairs,
        "valuechain": valuechain,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("→ %s (%d series, %d pairs)" % (os.path.abspath(OUT), len(series), len(pairs)))
    if len(pairs) < 3:
        print("[WARN] 페어 %d개 — 데이터 수집 확인 필요" % len(pairs))


if __name__ == "__main__":
    main()
