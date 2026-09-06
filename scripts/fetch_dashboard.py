#!/usr/bin/env python3
"""Briefing Signal Lab — 대시보드 데이터 수집기.
공개 API: Yahoo Finance v8 chart + 미 재무부 Fiscal Data(DTS) + FRED CSV + 관세청 수출(키 필요, 선택).
출력: public/assets/data/dashboard.json  (관계 페어 오버레이용 시계열).
stdlib만 사용(Actions에서 pip 불필요). 실패한 시계열은 건너뛰고 로그.

수집 실패는 죽이지 않는다(직전 데이터 보존). 대신 **보이게** 한다 —
main()이 성적("페어 N/M · 섹터 X/Y")을 마지막 줄에 찍고 워크플로가 그걸 커밋 메시지에 넣으며,
dashboard.json의 coverage 필드를 화면 하단이 읽어 결손을 표시한다.
조용한 폴백이 몇 주씩 안 보이는 사고를 2026-08-17 에 겪었다(주간 검수 엔진 404).
"""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error
import csv, io, datetime
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BriefingSignalLab/1.0"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "data", "dashboard.json")
OUT_MANUAL = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "data", "valuechain_manual.json")
OUT_QUOTES = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "data", "quotes.json")
RANGE = "3y"

# ── 일일 메일 '주요 시장 지표' 스냅샷 ────────────────────────────────────────
# (라벨, Yahoo 심볼, 소수자리, 종류) — 종류: "" 일반 / "rate" 금리(값에 % · 변화는 bp)
# 표시 문자열까지 여기서 만든다. 메일러(Apps Script)는 수동 붙여넣기 배포라
# 티커·라벨·포맷 변경이 메일러 코드를 건드리지 않게 하기 위함.
# 순서 = 메일에 찍히는 순서(2열 좌→우). 21개 = 2열 11행.
QUOTES = [
    ("나스닥",          "%5EIXIC",   2, ""),
    ("S&P500",         "%5EGSPC",   2, ""),
    ("다우",            "%5EDJI",    2, ""),
    ("러셀2000",        "%5ERUT",    2, ""),
    ("달러인덱스",       "DX-Y.NYB",  2, ""),
    ("원/달러",         "KRW=X",     2, ""),
    ("WTI",            "CL=F",      2, ""),
    ("금",              "GC=F",      1, ""),
    ("은",              "SI=F",      2, ""),
    ("구리",            "HG=F",      4, ""),
    ("US2Y",           "2YY=F",     3, "rate"),
    ("US5Y",           "%5EFVX",    3, "rate"),
    ("US10Y",          "%5ETNX",    3, "rate"),
    ("SOXX(반도체)",    "SOXX",      2, ""),
    ("ITA(방산)",       "ITA",       2, ""),
    ("UFO(우주)",       "UFO",       2, ""),
    ("XLK(IT)",        "XLK",       2, ""),
    ("XLY(소비재)",     "XLY",       2, ""),
    ("XLF(금융)",       "XLF",       2, ""),
    ("XLC(엔터)",       "XLC",       2, ""),
    ("EWY(한국·야간)",  "EWY",       2, ""),
]

# ── FRED (세인트루이스 연준) ────────────────────────────────────────────────
# graph/fredgraph.csv 는 **API 키 없이** 받아진다. 시리즈 선택 기준은 '신선도'다.
# 요청받았던 M2SL·TOTRESNS 는 둘 다 월별 + 발표지연 78일이라 차트 오른쪽이 두 달 반 비었다.
# 같은 개념의 주간 시리즈(WM2NS·WRESBAL)가 지연 43일/6일이라 그쪽을 쓴다.
# 국채금리는 Yahoo 에 3년물 지수 심볼이 아예 없어(404) FRED 가 유일한 경로다.
# ⚠️ 한 페어 안에서는 소스를 섞지 말 것 — 드롭다운을 바꿀 때마다 차트 끝 날짜가 달라진다.
FRED = {
    "wm2ns":   ("M2 통화량(주간)",   "$B", "WM2NS"),
    "wresbal": ("은행 준비금(주간)",  "$B", "WRESBAL"),
    "dgs2":    ("미 2년물 금리",     "%",  "DGS2"),
    "dgs3":    ("미 3년물 금리",     "%",  "DGS3"),
    "dgs10":   ("미 10년물 금리",    "%",  "DGS10"),
}

# ── 한국은행 ECOS ───────────────────────────────────────────────────────────
# 대시보드가 미국 편중이었다. 미국은 FRED 로 금리·통화량·준비금이 촘촘한데 한국은
# 야후에서 긁는 가격(KOSPI·원달러·EWY)만 있고 매크로가 0이었다. 설계 근거와 실측치는
# docs/kr-macro-plan.md 에 있다.
#
# ⚠️ 키가 없으면 ECOS 를 통째로 건너뛴다(fail-open). 수출 수집과 같은 원칙이다 —
#    지표 하나 때문에 배포를 막으면 멀쩡한 나머지 지표까지 낡는다.
ECOS_KEY = os.environ.get("BOK_API_KEY", "").strip()
ECOS_BASE = "https://ecos.bok.or.kr/api"

# 일간 — 페어용. (key, 통계표, 항목코드들, 이름, 단위)
# ⚠️ 페어의 우축 드롭다운은 전부 802Y001 하나에서 온다. 소스를 섞으면 옵션을 바꿀 때마다
#    차트 끝 날짜가 달라진다(FRED 주석 참고). 같은 표면 거래일 달력이 같다.
ECOS_DAILY = [
    ("kr10y",     "817Y002", ("010210000",), "국고채 10년",            "%"),
    ("kospi_kr",  "802Y001", ("0001000",),   "KOSPI",                 "pt"),
    ("frgn_net",  "802Y001", ("0030000",),   "외국인 순매수(유가증권)",  "십억원"),
    ("kosdaq_kr", "802Y001", ("0089000",),   "KOSDAQ",                "pt"),
]

# 월간 — 카드용. mode 가 변화율 표시 방식을 정한다(docs/kr-macro-plan.md §2-C).
#   yoy          전년동월비 %       지수형 물가·실물
#   mom          전월비 %           잔액형
#   diff         전월 대비 절대차    부호가 바뀌거나 100 이 기준선이 아닌 것
#   baseline100  기준선 100 대비    100 중심으로 표준화된 지수
#
# ⚠️ BSI 에 baseline100 을 쓰지 말 것. 실측 평균이 75.3(범위 51~95)이라 100 을 기준선으로
#    보면 평년 수준인 77 이 '기준선 −23, 심각한 비관' 으로 읽힌다. CSI(평균 101.4)와
#    ESI(99.9)는 100 중심이라 baseline100 이 맞다.
# ⚠️ yoy 는 원계열·불변지수에만 쓴다. 계절조정지수에 전년동월비를 씌우면 조정이 두 번 된다.
#    그래서 전산업생산은 A00/1(원계열), 소매판매는 G0/T2(불변)를 집는다.
KR_MACRO = [
    ("kr_csi",      "511Y002", ("FME",),        "소비자심리지수",              "",         "baseline100"),
    ("kr_bsi",      "512Y007", ("AA", "99988"), "기업경기실사(전산업)",         "",         "diff"),
    ("kr_esi",      "513Y001", ("E1000",),      "경제심리지수",                "",         "baseline100"),
    ("kr_cpi",      "901Y009", ("0",),          "소비자물가지수",              "2020=100", "yoy"),
    ("kr_cpi_core", "901Y010", ("QB",),         "근원물가(농산물·석유류 제외)",  "2020=100", "yoy"),
    ("kr_reserves", "732Y001", ("99",),         "외환보유액",                  "천달러",    "mom"),
    ("kr_ca",       "301Y013", ("000000",),     "경상수지",                   "백만달러",  "diff"),
    ("kr_leading",  "901Y067", ("I16E",),       "선행지수순환변동치",           "2020=100", "baseline100"),
    ("kr_ip",       "901Y033", ("A00", "1"),    "전산업생산지수(원계열)",       "2020=100", "yoy"),
    ("kr_retail",   "901Y100", ("G0", "T2"),    "소매판매액지수(불변)",         "2020=100", "yoy"),
]
KR_MACRO_MONTHS = 72   # 6년. yoy 에 13개월이 필요하고 스파크라인에도 충분하다.

# 미 섹터 ETF — 페어가 아니라 **카드**로 나란히 깐다("어느 섹터가 앞서나"는 오버레이로 못 본다).
# ⚠️ 카드는 마지막 90개만 읽는다(dashboard.js 의 spark() 가 slice(-90), pctChg 가 -22).
#    3년치를 담으면 663개가 한 번도 안 읽히고 파일만 150KB 불어난다.
SECTOR_KEEP = 90
SECTORS = [
    ("xlk",  "IT (XLK)",           "XLK"),  ("xlf",  "금융 (XLF)",         "XLF"),
    ("xly",  "경기소비재 (XLY)",     "XLY"),  ("xlp",  "필수소비재 (XLP)",    "XLP"),
    ("xle",  "에너지 (XLE)",        "XLE"),  ("xlv",  "헬스케어 (XLV)",      "XLV"),
    ("xli",  "산업재 (XLI)",        "XLI"),  ("xlu",  "유틸리티 (XLU)",      "XLU"),
    ("xlb",  "소재 (XLB)",          "XLB"),  ("xlre", "리츠 (XLRE)",        "XLRE"),
    ("xlc",  "커뮤니케이션 (XLC)",   "XLC"),
]

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
    # 신규 페어용
    "ixic": ("나스닥",     "pt", "%5EIXIC"),
    "dji":  ("다우",       "pt", "%5EDJI"),
    "wti":  ("WTI 유가",   "$",  "CL=F"),
    "btc":  ("비트코인",   "$",  "BTC-USD"),
}
# 반도체 바스켓(동일가중, 리베이스100). 개별주는 위 YAHOO에서 이미 수집됨.
BASKET = {"삼성전자": "005930.KS", "SK하이닉스": "000660.KS", "한미반도체": "042700.KS",
          "주성엔지니어링": "036930.KQ", "리노공업": "058470.KQ"}
# 페어5 우축 드롭다운 옵션 [series_key, 표시명] (기본=맨 앞=삼성전자)
KRSEMI_OPTIONS = [["samsung", "삼성전자"], ["hynix", "SK하이닉스"], ["hanmi", "한미반도체"],
                  ["joosung", "주성엔지니어링"], ["leeno", "리노공업"], ["krsemi", "반도체 바스켓(동일가중)"]]
# 매크로 페어의 우축 공통 옵션(어느 지수에 견줄지)
INDEX_OPTIONS = [["gspc", "S&P500"], ["ixic", "나스닥"]]
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
    # ── 2026-08-18 추가분 ──────────────────────────────────────────────
    {"id": "m2-index",       "label": "M2 통화량 ↔ 주가지수",   "left": "wm2ns",   "right": "gspc",
     "rightOptions": INDEX_OPTIONS},
    {"id": "reserves-index", "label": "은행 준비금 ↔ 주가지수",  "left": "wresbal", "right": "gspc",
     "rightOptions": INDEX_OPTIONS},
    {"id": "gold-btc",       "label": "금 ↔ 비트코인",          "left": "gold",    "right": "btc"},
    {"id": "wti-rates",      "label": "WTI ↔ 미 국채금리",      "left": "wti",     "right": "dgs10",
     "rightOptions": [["dgs2", "미 2년물"], ["dgs3", "미 3년물"], ["dgs10", "미 10년물"]]},
    {"id": "volume",         "label": "거래량 (한국 ↔ 선택)",    "left": "kvol",    "right": "uvol",
     "rightOptions": [["uvol", "미국 거래량"], ["ks11", "KOSPI"], ["gspc", "S&P500"], ["ixic", "나스닥"]]},
    {"id": "breadth-index",  "label": "시장폭 ↔ 미국 지수",      "left": "breadth", "right": "gspc",
     "rightOptions": INDEX_OPTIONS + [["dji", "다우"]]},
    # ── 2026-09-06 추가분(한국은행 ECOS) ────────────────────────────────────
    # 좌축은 파생 시리즈다(국고10년 − 미10년, 교집합). 우축 셋은 전부 ECOS 802Y001 이라
    # 드롭다운을 바꿔도 거래일 달력이 같다.
    {"id": "krus-kospi",     "label": "한미 10년 금리차 ↔ KOSPI", "left": "krus10", "right": "kospi_kr",
     "rightOptions": [["kospi_kr", "KOSPI"], ["frgn_net", "외국인 순매수"], ["kosdaq_kr", "KOSDAQ"]]},
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


def _range_days():
    """RANGE("3y"/"5y"/"400d") → 일수. FRED 절단 창을 Yahoo 와 한 곳에서 맞추기 위한 것.
    RANGE 를 늘렸는데 FRED 만 3년이면 그 페어의 왼쪽이 잘려 보인다."""
    n, unit = RANGE[:-1], RANGE[-1]
    try:
        n = int(n)
    except ValueError:
        return 1130
    return n * 366 if unit == "y" else (n * 31 if unit == "mo"[0] else n)


def yahoo_volume(symbol):
    """(ts[], vol[]) — 일별 거래량. 이미 chart 응답에 들어 있던 값을 그동안 버리고 있었다."""
    url = "https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=1d" % (symbol, RANGE)
    res = get(url)["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    vols = q.get("volume") or []
    out_t, out_v = [], []
    for t, v in zip(res["timestamp"], vols):
        if v:                       # None 과 0(휴장) 을 함께 배제 — 0 은 평균을 왜곡한다
            out_t.append(int(t))
            out_v.append(float(v))
    return out_t, out_v


def normalized_volume(symbol, window=20):
    """거래량 → 직전 window 일 평균 대비 배수(1.0 = 평소 수준).

    왜 원본을 안 쓰나: Yahoo 의 KOSPI 거래량은 천주 단위로, 미국은 주 단위로 온다(약 1000배 차이).
    그대로 겹치면 한국 선이 바닥에 붙는다. 게다가 주식 '수' 는 시장 간 비교가 원래 무의미하다
    (한국은 저가주가 많아 같은 돈에 주식 수가 부풀어난다). 평소 대비 배수로 바꾸면 둘이 같은
    축에서 읽히고, 애초에 거래량에서 보고 싶은 것도 절대량이 아니라 '평소보다 달아올랐나' 다.
    """
    t, v = yahoo_volume(symbol)
    if len(v) <= window:
        return [], []
    out_t, out_v = [], []
    for i in range(window, len(v)):
        base = sum(v[i - window:i]) / window
        if base > 0:
            out_t.append(t[i])
            out_v.append(round(v[i] / base, 4))
    return out_t, out_v


def ratio_series(num_symbol, den_symbol):
    """두 종가의 비율(공통 거래일만). 시장폭 RSP/SPY 용.

    좌축 RSP·우축 SPY 로 원본을 나란히 놓으면 이중축이 각자 자동 스케일링해서 두 선이
    거의 포개진다 — 발산이 눈에 안 보인다. 비율 한 줄로 만들어야 갈라지는 게 드러난다.
    """
    tn, vn = yahoo(num_symbol)
    td, vd = yahoo(den_symbol)
    den = dict(zip(td, vd))
    out_t, out_v = [], []
    for t, v in zip(tn, vn):
        d = den.get(t)
        if d:
            out_t.append(t)
            out_v.append(round(v / d, 6))
    return out_t, out_v


def fred(series_id):
    """(ts[], val[]) — FRED 공개 CSV. API 키 불필요.

    결측은 '.' 으로 오므로 걸러낸다. 날짜는 UTC 자정 epoch 으로 맞춘다 —
    dashboard.js 의 aligned() 가 UTC 일(floor(t/86400)) 단위 내부조인을 하므로
    여기서 로컬 시간대를 쓰면 하루가 밀려 교집합이 통째로 비는 수가 있다.

    ⚠️ FRED 는 **전체 역사**를 준다(DGS10 은 1962년부터 16,140행). 그대로 담으면 다섯
    시리즈가 741KB 를 차지하는데 대부분 화면에 그려지지 않는 구간이다. Yahoo 와 같은
    RANGE 창으로 잘라야 한다.
    """
    url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=%s" % series_id
    rows = list(csv.reader(io.StringIO(_get_text(url))))
    cutoff = time.time() - _range_days() * 86400
    out_t, out_v = [], []
    for row in rows[1:]:
        if len(row) < 2 or row[1] in (".", ""):
            continue
        try:
            d = datetime.datetime.strptime(row[0].strip(), "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
            ts = int(d.timestamp())
            if ts < cutoff:
                continue
            out_t.append(ts)
            out_v.append(round(float(row[1]), 4))
        except ValueError:
            continue
    return out_t, out_v


def _ecos_ts(t):
    """ECOS TIME → UTC 자정 epoch. 일간은 'YYYYMMDD', 월간은 'YYYYMM'(그 달 1일로 본다).

    dashboard.js 의 aligned() 가 floor(t/86400) 로 내부조인하므로 FRED 와 같은 규칙을 쓴다.
    로컬 시간대를 쓰면 하루가 밀려 교집합이 통째로 빌 수 있다.
    """
    t = str(t).strip()
    if len(t) == 8:
        d = datetime.datetime.strptime(t, "%Y%m%d")
    elif len(t) == 6:
        d = datetime.datetime.strptime(t + "01", "%Y%m%d")
    else:
        return None
    return int(d.replace(tzinfo=datetime.timezone.utc).timestamp())


def ecos_series(table, cycle, start, end, items):
    """ECOS StatisticSearch → (ts[], val[]). 시각 오름차순, 시점당 1개.

    ⚠️ 항목 코드를 덜 지정하면 **시점당 여러 행**이 온다. 901Y033 은 항목 하나(A00)만 주면
       원계열과 계절조정이 같이 와서 값이 두 배로 늘고, 무엇이 담겼는지 모르게 된다.
       그래서 중복 시점을 발견하면 마지막 값을 취하되 **반드시 로그로 남긴다** —
       조용히 절반을 버리면 어느 계열이 실렸는지 아무도 모른다.
    """
    if not ECOS_KEY:
        return [], []
    path = "/".join([ECOS_BASE, "StatisticSearch", ECOS_KEY, "json", "kr", "1", "900",
                     table, cycle, start, end] + [urllib.parse.quote(str(i)) for i in items])
    j = get(path)
    if "StatisticSearch" not in j:
        raise RuntimeError(str(j.get("RESULT", j))[:200])
    rows = j["StatisticSearch"].get("row", [])
    by_ts, kept = {}, 0
    for r in rows:
        val = r.get("DATA_VALUE")
        if val in (None, "", "-"):
            continue
        ts = _ecos_ts(r.get("TIME", ""))
        if ts is None:
            continue
        try:
            fv = float(val)
        except (TypeError, ValueError):
            continue
        kept += 1
        by_ts[ts] = round(fv, 4)
    if kept > len(by_ts):
        print("  [ECOS] %s 항목 지정이 느슨하다 — 유효 %d행이 %d시점으로 접혔다(마지막 값 사용)"
              % (table, kept, len(by_ts)))
    ordered = sorted(by_ts)
    return ordered, [by_ts[t] for t in ordered]


def _ecos_period(ts):
    """카드에 찍을 기준 시점 라벨. 월간 지표는 '언제 것인가' 가 값만큼 중요하다."""
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y.%m")


def kr_us_spread(kr, us):
    """한미 10년 금리차 = 국고채(10년) − 미 10년물. **날짜 교집합만** 쓴다.

    forward-fill 하지 않는다. 2025-01-01~2026-09-06 실측으로 KR 409 · US 419 거래일 중
    교집합이 395(94.3%)라 보간할 만큼 비지 않고, 결측 보간은 없는 값을 지어내는 쪽이다.
    최대 공백은 추석 8일이며 uPlot 이 선으로 잇는다.

    ⚠️ 최신일은 둘 중 **느린 쪽**에 맞춰진다. 대개 미국(FRED)이 하루 더 늦어
       한국 값만 있는 마지막 하루는 빠진다 — 정상이다.
    """
    um = dict(zip(us[0], us[1]))
    t, v = [], []
    for ts, kv in zip(kr[0], kr[1]):
        if ts in um:
            t.append(ts)
            v.append(round(kv - um[ts], 4))
    return t, v


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
        print("[수출] DATA_GO_KR_KEY 시크릿 없음 - 건너뜀")
        return [], []
    hexish = all(c in "0123456789abcdefABCDEF" for c in key)
    print("[수출] key 진단: len=%d has_percent=%s hexish=%s (내용 비노출)" % (len(key), "%" in key, hexish))
    keyq = key if "%" in key else urllib.parse.quote(key, safe="")
    ym = time.strftime("%Y%m")   # 현재 년월 (strtYymm/endYymm은 YYYYMM 6자리)
    url = (EXP_BASE + "/getCntyMmUtPrviExpAcrs?serviceKey=" + keyq +
           "&numOfRows=2000&pageNo=1&strtYymm=202101&endYymm=" + ym)
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
        # priodMon=YYYYMM. 월당 10일 3구간을 합산 → 월별 수출 총액.
        m = "".join(ch for ch in (d.get("priodMon") or "") if ch.isdigit())
        if len(m) != 6:
            y = "".join(ch for ch in (d.get("priodYear") or "") if ch.isdigit())
            mm = "".join(ch for ch in (d.get("priodMon") or "") if ch.isdigit())
            m = (y + mm[-2:]) if (len(y) == 4 and len(mm) >= 2) else ""
        if len(m) != 6:
            continue
        ds = m + "15"   # 월 대표일
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
            agg[ds] = agg.get(ds, 0.0) + float(val)   # 월 합계(10일 3구간)
        except Exception:
            continue
    out_t, out_v = [], []
    for ds in sorted(agg):
        try:
            out_t.append(int(time.mktime(time.strptime(ds, "%Y%m%d")))); out_v.append(round(agg[ds], 1))
        except Exception:
            continue
    print("[수출] → %d 개월" % len(out_v))
    return out_t, out_v


def _prev_series(key):
    """직전 dashboard.json에서 series[key] 반환(수집 실패 시 보존용)."""
    return (_prev_all() or {}).get(key)


def _prev_all():
    """직전 dashboard.json의 series 전체 dict."""
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f).get("series", {})
    except Exception:
        return {}


def _get_text(url):
    # ⚠️ Accept 를 반드시 보낼 것. FRED(fredgraph.csv)는 Accept 가 없으면 응답 대신
    #    연결을 끊는다(WinError 10054 / read timeout). 20초쯤 매달렸다가 실패해서
    #    네트워크 문제처럼 보이는데, 헤더 한 줄 넣으면 0.2초에 200이 온다.
    #    2026-08-18 첫 구현에서 FRED 5개가 전부 이것 때문에 조용히 빠졌다.
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/csv,text/plain,*/*"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")


def _to_epoch(s):
    """시각 셀 → epoch(초). 숫자면 그대로, 날짜(YYYY-MM-DD 등)면 UTC epoch로."""
    s = str(s).strip()
    if not s:
        return 0
    try:
        return int(float(s))                       # 이미 epoch(초)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m"):
        try:
            dt = datetime.datetime.strptime(s, fmt).replace(tzinfo=datetime.timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            continue
    return 0


def manual_from_sheet():
    """'대시보드-수동' 탭 CSV(env DASH_MANUAL_CSV) → valuechain_manual.json 재생성.
    관리자 콘솔이 시트에 점을 추가하면 이 크론이 JSON을 갱신(dashboard.js는 무변경).
    env 미설정/네트워크 실패/빈 시트면 아무것도 안 함(기존 파일 보존 = fail-safe).
    열: 카드키·라벨·단위·주기·출처·시각·값 (카드키로 그룹, 행 순서 = 시계열 순서)."""
    url = os.environ.get("DASH_MANUAL_CSV", "").strip()
    if not url:
        print("[manual] DASH_MANUAL_CSV 미설정 → valuechain_manual.json 보존")
        return
    try:
        rows = list(csv.reader(io.StringIO(_get_text(url))))
    except Exception as e:
        print("[manual] CSV 로드 실패 → 보존: %s" % e)
        return
    if len(rows) < 2:
        print("[manual] 시트 데이터 없음 → 보존")
        return
    header = [c.strip() for c in rows[0]]
    idx = {name: header.index(name) for name in header}

    def cell(row, name):
        i = idx.get(name)
        return row[i].strip() if (i is not None and i < len(row)) else ""

    order, groups = [], {}
    for row in rows[1:]:
        key = cell(row, "카드키")
        raw = cell(row, "값")
        if not key or raw == "":
            continue
        try:
            v = round(float(raw), 6)
        except ValueError:
            print("[manual] 값 파싱 실패(건너뜀): %r" % raw)
            continue
        if key not in groups:
            groups[key] = {"key": key, "label": cell(row, "라벨"), "unit": cell(row, "단위"),
                           "manual": True, "period": cell(row, "주기"), "source": cell(row, "출처"),
                           "t": [], "v": []}
            order.append(key)
        groups[key]["t"].append(_to_epoch(cell(row, "시각")))
        groups[key]["v"].append(v)

    items = [groups[k] for k in order if groups[k]["v"]]
    if not items:
        print("[manual] 유효 데이터 점 없음 → 보존")
        return
    out = {"updated": time.strftime("%Y-%m-%d"),
           "note": "운영자 콘솔이 '대시보드-수동' 시트에 입력한 수동 지표. 정보 제공이며 투자 조언 아님.",
           "items": items}
    with open(OUT_MANUAL, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("→ %s (%d cards)" % (os.path.abspath(OUT_MANUAL), len(items)))


def _fmt_num(value, decimals):
    """1234.5 → '1,234.50'. 천단위 콤마 + 고정 소수자리."""
    return "{:,.{d}f}".format(value, d=decimals)


def _kst_date(now=None):
    """UTC 실행 환경에서도 한국 기준 브리핑 날짜를 반환."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    return now.astimezone(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d")


def quotes_snapshot():
    """QUOTES 목록의 최근 2거래일 종가 → 표시용 스냅샷(public/assets/data/quotes.json).

    일일 시황 메일이 이 파일 하나만 읽어 '주요 시장 지표' 블록을 그린다.
    - 개별 심볼 실패는 그 행만 생략(빈칸보다 없는 게 낫다).
    - 전부 실패하면 파일을 덮지 않는다(직전 스냅샷 보존 — 수출 시리즈와 같은 fail-safe).
    - asof = 발송 시각이 아니라 Yahoo 응답의 실제 마지막 거래일. 월요일 아침에
      금요일 마감이 찍히는 게 정상이므로, 신선도 판단은 메일러가 asof로 한다.
    """
    fetched = []
    for label, sym, decimals, kind in QUOTES:
        try:
            url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=5d&interval=1d" % sym)
            res = get(url)["chart"]["result"][0]
            ts = res["timestamp"]
            close = res["indicators"]["quote"][0]["close"]
            pts = [(time.strftime("%Y-%m-%d", time.gmtime(t)), v)
                   for t, v in zip(ts, close) if v is not None]
            if len(pts) < 2:
                print("[quotes] %s(%s): 종가 2개 미만 - 생략" % (label, sym))
                continue
        except Exception as e:
            print("[quotes] %s(%s) 실패 - 생략: %s" % (label, sym, e))
            continue
        fetched.append((label, sym, decimals, kind, pts))
    if not fetched:
        print("[quotes] 유효 행 0건 → 직전 스냅샷 보존")
        return

    # 기준 거래일 = 마지막 봉 날짜의 최빈값. 선물·환율은 24시간 거래라 미국 주식이
    # 열리기 전에도 '오늘' 봉이 잡히는데, 그건 진행 중인 미완성 봉이다. 최빈값을
    # 기준으로 삼고 모든 심볼을 그 날짜 이하의 마지막 봉으로 맞춰야 한 호가 같은 장을 가리킨다.
    days = {}
    for _, _, _, _, pts in fetched:
        days[pts[-1][0]] = days.get(pts[-1][0], 0) + 1
    asof = max(days, key=lambda d: (days[d], d))

    rows = []
    for label, sym, decimals, kind, pts in fetched:
        usable = [p for p in pts if p[0] <= asof]
        if len(usable) < 2:
            print("[quotes] %s(%s): %s 기준 종가 부족 - 생략" % (label, sym, asof))
            continue
        now, prev = usable[-1][1], usable[-2][1]
        if kind == "rate":
            # 금리는 값 자체가 %. 변화는 %가 아니라 bp로 적어야 %p 혼동이 없다.
            value = _fmt_num(now, decimals) + "%"
            diff = round((now - prev) * 100)
            change = "%+d" % diff + "bp"
        else:
            value = _fmt_num(now, decimals)
            # 표시 자릿수로 먼저 반올림하고 방향을 정한다. 그래야 +0.04% 가
            # '-0.0%'(빨강) 처럼 오타로 보이는 표시가 안 나온다.
            diff = round(((now - prev) / prev * 100) if prev else 0.0, 1)
            if diff == 0:
                diff = 0.0
                change = "0.0%"
            else:
                change = "%+.1f%%" % diff
        rows.append({"label": label, "value": value, "change": change,
                     "dir": (1 if diff > 0 else (-1 if diff < 0 else 0))})
    if not rows:
        print("[quotes] 유효 행 0건 → 직전 스냅샷 보존")
        return
    out = {"asof": asof, "briefing_date": _kst_date(), "updated": _kst_date(),
           "note": "Yahoo Finance 종가. 정보 제공이며 투자 조언 아님.", "rows": rows}
    os.makedirs(os.path.dirname(OUT_QUOTES), exist_ok=True)
    with open(OUT_QUOTES, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("→ %s (%d/%d rows, asof %s)" % (os.path.abspath(OUT_QUOTES), len(rows), len(QUOTES), asof))


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
    for key, (name, unit, sid) in FRED.items():
        try:
            t, v = fred(sid)
            if v:
                series[key] = {"name": name, "unit": unit, "t": t, "v": v}
                print("%s(FRED %s): %d pts" % (key, sid, len(v)))
            else:
                print("[WARN] %s(FRED %s) 빈 응답" % (key, sid))
        except Exception as e:
            print("[WARN] %s(FRED %s) 실패: %s" % (key, sid, e))

    # ── 한국은행 ECOS ──────────────────────────────────────────────────────
    # 키가 없으면 통째로 건너뛴다. 아래 페어·카드는 series 에 재료가 없으면 자동으로 빠지고,
    # _prev_all() 보존 로직이 직전 값을 살려 화면이 갑자기 비지는 않는다.
    if not ECOS_KEY:
        print("[ECOS] BOK_API_KEY 없음 — 한국 매크로 수집 건너뜀")
    else:
        today = datetime.date.today()
        d_start = (today - datetime.timedelta(days=_range_days())).strftime("%Y%m%d")
        d_end = today.strftime("%Y%m%d")
        for key, table, items, name, unit in ECOS_DAILY:
            try:
                t, v = ecos_series(table, "D", d_start, d_end, items)
                if v:
                    series[key] = {"name": name, "unit": unit, "t": t, "v": v}
                    print("%s(ECOS %s): %d pts" % (key, table, len(v)))
                else:
                    print("[WARN] %s(ECOS %s) 빈 응답" % (key, table))
            except Exception as e:
                print("[WARN] %s(ECOS %s) 실패: %s" % (key, table, e))

        m_start = (today - datetime.timedelta(days=31 * KR_MACRO_MONTHS)).strftime("%Y%m")
        m_end = today.strftime("%Y%m")
        for key, table, items, name, unit, mode in KR_MACRO:
            try:
                t, v = ecos_series(table, "M", m_start, m_end, items)
                if v:
                    series[key] = {"name": name, "unit": unit, "t": t, "v": v,
                                   "mode": mode, "period": _ecos_period(t[-1])}
                    print("%s(ECOS %s): %d pts [%s, %s 기준]"
                          % (key, table, len(v), mode, _ecos_period(t[-1])))
                else:
                    print("[WARN] %s(ECOS %s) 빈 응답" % (key, table))
            except Exception as e:
                print("[WARN] %s(ECOS %s) 실패: %s" % (key, table, e))

        # 한미 10년 금리차 — 파생 시리즈. 재료 둘 중 하나라도 없으면 만들지 않는다.
        if series.get("kr10y", {}).get("v") and series.get("dgs10", {}).get("v"):
            st, sv = kr_us_spread((series["kr10y"]["t"], series["kr10y"]["v"]),
                                  (series["dgs10"]["t"], series["dgs10"]["v"]))
            if sv:
                series["krus10"] = {"name": "한미 10년 금리차", "unit": "%p", "t": st, "v": sv}
                print("krus10: %d pts (KR %d · US %d 교집합 %.1f%%)"
                      % (len(sv), len(series["kr10y"]["v"]), len(series["dgs10"]["v"]),
                         100.0 * len(sv) / max(len(series["kr10y"]["v"]), len(series["dgs10"]["v"]))))
            else:
                print("[WARN] krus10 교집합 0 — 날짜 정렬을 의심할 것")
        else:
            print("[WARN] krus10 재료 없음 (kr10y=%s · dgs10=%s)"
                  % (bool(series.get("kr10y")), bool(series.get("dgs10"))))

    # 섹터는 카드 전용 — 마지막 SECTOR_KEEP 개만 남긴다(위 SECTORS 주석 참고).
    for key, name, sym in SECTORS:
        try:
            t, v = yahoo(sym)
            if v:
                series[key] = {"name": name, "unit": "$", "t": t[-SECTOR_KEEP:], "v": v[-SECTOR_KEEP:]}
                print("%s(%s): %d pts (섹터, %d일 절단)" % (key, sym, len(v), SECTOR_KEEP))
        except Exception as e:
            print("[WARN] 섹터 %s(%s) 실패: %s" % (key, sym, e))

    for key, name, sym in [("kvol", "한국 거래량(20일평균 대비)", "%5EKS11"),
                           ("uvol", "미국 거래량(20일평균 대비)", "%5EGSPC")]:
        try:
            t, v = normalized_volume(sym)
            if v:
                series[key] = {"name": name, "unit": "배", "t": t, "v": v}
                print("%s(%s): %d pts" % (key, sym, len(v)))
        except Exception as e:
            print("[WARN] %s(%s) 실패: %s" % (key, sym, e))

    try:
        t, v = ratio_series("RSP", "SPY")
        if v:
            series["breadth"] = {"name": "시장폭 (동일가중/시총가중)", "unit": "비율", "t": t, "v": v}
            print("breadth(RSP/SPY): %d pts" % len(v))
    except Exception as e:
        print("[WARN] breadth(RSP/SPY) 실패: %s" % e)

    print("반도체 바스켓 계산...")
    bt, bv = rebase_basket(BASKET)
    if bv:
        series["krsemi"] = {"name": "반도체 바스켓(동일가중)", "unit": "=100", "t": bt, "v": bv}
        print("krsemi: %d pts" % len(bv))
    try:
        et, ev = customs_export()
        if ev:
            series["exports"] = {"name": "수출 총액(월별)", "unit": "천$", "t": et, "v": ev}
            print("exports: %d pts" % len(ev))
        else:  # 수집 실패(인증·네트워크 등) 시 직전 dashboard.json의 수출 데이터 보존
            prev = _prev_series("exports")
            if prev and prev.get("v"):
                series["exports"] = prev
                print("[수출] 수집 실패 → 직전 데이터 보존(%d pts)" % len(prev["v"]))
    except Exception as e:
        print("[WARN] 수출 실패: %s" % e)

    # 이번 수집에서 빠진 시리즈는 직전 dashboard.json에서 보존(일시 실패로 페어가 사라지는 것 방지)
    for k, s in _prev_all().items():
        if k not in series and isinstance(s, dict) and s.get("v"):
            series[k] = s
            print("[보존] %s 이번 수집 없음 → 직전 데이터 유지(%d pts)" % (k, len(s["v"])))

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
    sectors = [k for k, _, _ in SECTORS if k in series]
    krmacro = [k for k, _, _, _, _, _ in KR_MACRO if k in series]
    # 결손을 화면이 읽을 수 있게 실어 보낸다. fail-safe 로 직전 데이터가 남아 그림은 멀쩡한데
    # 실제로는 낡은 값인 상태를 사람이 알 방법이 여기 말고는 없다.
    coverage = {"pairs": len(pairs), "pairsExpected": len(PAIRS) + 1,
                "sectors": len(sectors), "sectorsExpected": len(SECTORS),
                "krmacro": len(krmacro), "krmacroExpected": len(KR_MACRO)}
    out = {
        "updated": time.strftime("%Y-%m-%d"),
        "note": "공개 출처 실데이터(Yahoo Finance · 미 재무부 · FRED · 한국은행 ECOS). 정보 제공이며 투자 조언 아님.",
        "series": series,
        "pairs": pairs,
        "valuechain": valuechain,
        "sectors": sectors,
        "krmacro": krmacro,
        "coverage": coverage,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("→ %s (%d series, %d pairs)" % (os.path.abspath(OUT), len(series), len(pairs)))

    # 일일 메일 지표 스냅샷(quotes.json). 실패해도 대시보드 산출물에는 영향 없음.
    try:
        quotes_snapshot()
    except Exception as e:
        print("[WARN] quotes 스냅샷 실패 - 직전 파일 보존: %s" % e)

    # 수동 카드(대시보드-수동 시트 → valuechain_manual.json). env 없으면 no-op(기존 보존).
    manual_from_sheet()

    # 성적표. 워크플로가 이 줄을 잡아 커밋 메시지에 넣는다 —
    # 매일 남는 커밋 제목만 훑어도 언제부터 틀어졌는지 날짜가 잡힌다.
    # 일부러 exit 1 을 하지 않는다: 수집 실패로 배포를 막으면 멀쩡한 나머지 지표까지 낡는다.
    live = {q["id"] for q in pairs}
    missing = [p["id"] for p in PAIRS if p["id"] not in live]
    if missing:
        print("[WARN] 누락 페어: %s" % ", ".join(missing))
    print("SCORE 페어 %d/%d · 섹터 %d/%d · 한국매크로 %d/%d"
          % (coverage["pairs"], coverage["pairsExpected"], coverage["sectors"], coverage["sectorsExpected"],
             coverage["krmacro"], coverage["krmacroExpected"]))


def run(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv == ["--quotes-only"]:
        quotes_snapshot()
        return
    if argv:
        raise SystemExit("usage: fetch_dashboard.py [--quotes-only]")
    main()


if __name__ == "__main__":
    run()
