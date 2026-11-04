# -*- coding: utf-8 -*-
"""
땅폴레옹 센타부동산 - 남양주시 아파트 대시보드 데이터 수집기

  python fetch_data.py            # 실거래(매매/전월세) + 좌표 + 주변시설 전체 수집
  python fetch_data.py --no-poi   # 주변시설(OSM) 수집 생략
  python fetch_data.py --bunyang-only   # 청약홈 분양공고(진접2·왕숙 등)만 갱신 → data/bunyang.js

결과물: data/data.js (대시보드가 바로 읽는 파일)
API 키는 config.json 에서 읽습니다.
"""
import json, os, sys, time, re, urllib.request, urllib.parse, datetime
import xml.etree.ElementTree as ET

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
os.makedirs(DATA, exist_ok=True)
CFG = json.load(open(os.path.join(BASE, "config.json"), encoding="utf-8"))
KEY = CFG["DATA_GO_KR_KEY"]
LAWD = CFG.get("LAWD_CD", "41360")
UA = "ttangpoleon-dashboard/1.0 (real-estate briefing)"

TRADE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
RENT_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent"
# 빌라(연립·다세대) / 주택(단독·다가구) — 공공데이터포털에서 각각 활용신청 필요
SOURCES = (("trade", TRADE_URL, "apt"), ("rent", RENT_URL, "apt"),
           ("trade_villa", "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade2/getRTMSDataSvcRHTrade2", "villa"),
           ("rent_villa", "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent", "villa"),
           ("trade_house", "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade", "house"),
           ("rent_house", "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent", "house"))


def http_get(url, headers=None, retries=3, timeout=60):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(2 + i * 3)


def months(start_ym):
    y, m = int(start_ym[:4]), int(start_ym[4:])
    today = datetime.date.today()
    while (y, m) <= (today.year, today.month):
        yield f"{y}{m:02d}"
        m += 1
        if m > 12:
            y, m = y + 1, 1


def fetch_month(url, ym):
    """한 달치 전체 페이지를 가져와 item dict 목록으로 반환"""
    items, page = [], 1
    while True:
        q = urllib.parse.urlencode({"LAWD_CD": LAWD, "DEAL_YMD": ym, "numOfRows": 1000, "pageNo": page})
        root = ET.fromstring(http_get(f"{url}?serviceKey={KEY}&{q}"))
        code = root.findtext(".//resultCode")
        if code not in ("000", "00"):
            raise RuntimeError(f"API 오류 {ym}: {code} {root.findtext('.//resultMsg') or root.findtext('.//returnAuthMsg')}")
        for it in root.iter("item"):
            items.append({c.tag: (c.text or "").strip() for c in it})
        total = int(root.findtext(".//totalCount") or 0)
        if page * 1000 >= total:
            return items
        page += 1


def num(s):
    if isinstance(s, (int, float)):
        return s
    s = (s or "").replace(",", "").strip()
    try:
        return float(s) if "." in s else int(s)
    except ValueError:
        return 0


def region_of(umd):
    """'진접읍 장현리' -> '진접읍', '다산동' -> '다산동'"""
    return umd.split()[0] if umd else ""


# ---------------------------------------------------------------- 실거래
def collect():
    cache_dir = os.path.join(DATA, "raw")
    os.makedirs(cache_dir, exist_ok=True)
    this_ym = datetime.date.today().strftime("%Y%m")
    prev_ym = (datetime.date.today().replace(day=1) - datetime.timedelta(days=1)).strftime("%Y%m")
    out = {}
    for kind, url, ptype in SOURCES:
        rows = []
        try:
            for ym in months(CFG.get("START_YM", "202401")):
                f = os.path.join(cache_dir, f"{kind}_{ym}.json")
                # 신고기한(30일) 때문에 최근 3개월은 항상 새로 받음
                recent = ym >= (datetime.date.today() - datetime.timedelta(days=95)).strftime("%Y%m")
                if os.path.exists(f) and not recent:
                    items = json.load(open(f, encoding="utf-8"))
                else:
                    items = fetch_month(url, ym)
                    json.dump(items, open(f, "w", encoding="utf-8"), ensure_ascii=False)
                    print(f"  {kind} {ym}: {len(items)}건", flush=True)
                rows.extend(items)
        except Exception as e:
            if ptype == "apt":
                raise
            # 빌라·주택 API는 활용신청 전이면 건너뜀 (아파트는 그대로 수집)
            print(f"  {kind} 수집 건너뜀 (공공데이터포털 활용신청 확인):", e)
            rows = []
        out[kind] = rows
    return out


# ---------------------------------------------------------------- 지오코딩
def geocode_all(complexes):
    path = os.path.join(DATA, "geocache.json")
    cache = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    kakao = CFG.get("KAKAO_REST_KEY", "").strip()
    todo = [c for c in complexes.values() if c["id"] not in cache]
    print(f"좌표 변환: {len(todo)}개 단지 (캐시 {len(cache)})", flush=True)
    for i, c in enumerate(todo):
        queries = []
        if c.get("ptype") == "house":   # 단독·다가구는 지번이 가려져 있어 리/동 중심점 사용
            queries.append(f"경기도 남양주시 {c['umd']}")
        if c.get("road"):
            queries.append(f"경기도 남양주시 {c['road']}")
        if c.get("jibun"):
            queries.append(f"경기도 남양주시 {c['umd']} {c['jibun']}")
        queries.append(f"남양주시 {c['name']}")
        hit = None
        for q in queries:
            try:
                if kakao:
                    try:
                        r = json.loads(http_get("https://dapi.kakao.com/v2/local/search/address.json?" +
                                                urllib.parse.urlencode({"query": q}),
                                                headers={"Authorization": f"KakaoAK {kakao}"}, retries=1))
                        if r.get("documents"):
                            d = r["documents"][0]
                            hit = [round(float(d["y"]), 6), round(float(d["x"]), 6), "kakao"]
                    except Exception as e:
                        # 키 오류·카카오맵 서비스 비활성 등 → 이후는 Nominatim 사용
                        print("   카카오 주소검색 실패, OpenStreetMap으로 전환:", e)
                        kakao = ""
                if not hit and not kakao:
                    r = json.loads(http_get("https://nominatim.openstreetmap.org/search?" +
                                            urllib.parse.urlencode({"q": q, "format": "json", "limit": 1,
                                                                    "countrycodes": "kr"})))
                    time.sleep(1.1)  # Nominatim 사용정책: 초당 1회
                    if r:
                        lat, lon = float(r[0]["lat"]), float(r[0]["lon"])
                        if 37.45 < lat < 37.9 and 127.0 < lon < 127.5:
                            hit = [round(lat, 6), round(lon, 6), "osm"]
            except Exception as e:
                print("   geocode err", q, e)
            if hit:
                break
        cache[c["id"]] = hit
        if i % 20 == 0:
            json.dump(cache, open(path, "w", encoding="utf-8"), ensure_ascii=False)
            print(f"  {i}/{len(todo)}", flush=True)
    json.dump(cache, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    return cache


# ---------------------------------------------------------------- 주변시설 (OpenStreetMap)
def fetch_pois():
    bbox = "37.50,127.05,37.85,127.45"
    q = f"""[out:json][timeout:180];
(
  nwr["railway"="station"]({bbox});
  nwr["amenity"="school"]({bbox});
  nwr["shop"~"^(supermarket|department_store|mall)$"]({bbox});
  nwr["amenity"~"^(cafe|townhall|police|post_office|library|hospital|fire_station)$"]({bbox});
  nwr["office"="government"]({bbox});
  node["highway"="bus_stop"]({bbox});
);
out center tags;"""
    req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                 data=urllib.parse.urlencode({"data": q}).encode(),
                                 headers={"User-Agent": UA})
    r = json.loads(urllib.request.urlopen(req, timeout=240).read())
    big_mart = re.compile("이마트|홈플러스|롯데마트|코스트코|트레이더스|하나로마트|노브랜드|GS더프레시|농협")
    pois = []
    for e in r["elements"]:
        t = e.get("tags", {})
        lat = e.get("lat") or e.get("center", {}).get("lat")
        lon = e.get("lon") or e.get("center", {}).get("lon")
        name = t.get("name:ko") or t.get("name") or ""
        if not lat:
            continue
        cat = None
        if t.get("railway") == "station":
            cat = "역"
            line = t.get("line") or t.get("network") or t.get("operator") or ""
            name = name + (f"|{line}" if line else "")
        elif t.get("highway") == "bus_stop":
            cat = "버스"
        elif t.get("amenity") == "school":
            if "초등" in name: cat = "초"
            elif "중학" in name: cat = "중"
            elif "고등" in name or "고교" in name: cat = "고"
        elif t.get("shop") in ("department_store", "mall"):
            cat = "백화점"
        elif t.get("shop") == "supermarket":
            cat = "마트" if big_mart.search(name) else None
        elif t.get("amenity") == "cafe":
            cat = "카페"
        elif t.get("amenity") == "hospital":
            cat = "병원"
        elif t.get("amenity") in ("townhall", "police", "post_office", "library", "fire_station") or t.get("office") == "government":
            cat = "관공서"
        if cat and (name or cat == "버스"):
            pois.append([cat, name if cat != "버스" else "", round(lat, 5), round(lon, 5)])
    print(f"주변시설 {len(pois)}건", flush=True)
    return pois


# ---------------------------------------------------------------- 땅폴레옹 홈페이지 매물
HOMEPAGE = "https://010-8848-7727.com"


def fetch_homepage_listings():
    """홈페이지 매물 목록(JSON 안의 카드 HTML)을 모두 받아 필요한 항목만 뽑음"""
    def page(main_type, start, n):
        body = urllib.parse.urlencode({"offset": n, "start": start, "cols": "col-sm-3", "main_type": main_type,
                                       "category": "", "optional_select": "", "view_type": "4",
                                       "is_random": 0, "type": ""}).encode()
        req = urllib.request.Request(f"{HOMEPAGE}/item/get_item_json/main/cell_4/0/0/0", data=body,
                                     headers={"User-Agent": UA, "X-Requested-With": "XMLHttpRequest"})
        raw = urllib.request.urlopen(req, timeout=90).read().decode("utf-8")
        raw = raw.replace("\n", "").replace("\r", "").strip()
        return json.loads(raw).get("item", []) if raw else []

    def cards(main_type, size=200, cap=5000):
        out, start = [], 0
        while start < cap:
            items = page(main_type, start, size)
            out.extend(v["html_data"] for v in items if v.get("html_data"))
            if len(items) < size:
                break
            start += size
        return out

    def text(h):
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h).replace("&nbsp;", " ")).strip()

    rec_ids = {re.search(r"item_list_(\d+)", h).group(1) for h in cards("recommend")}
    result = []
    for h in cards("recent"):
        g = lambda pat: (re.search(pat, h, re.S) or [None, ""])[1]
        lid = g(r"item_list_(\d+)")
        cat = text(g(r'card-item-category">(.*?)</span>'))
        addr = text(re.sub(r"<span[^>]*>\d+</span>", "", g(r'card_address ellipsis">(.*?)</div>')))
        if not lid or cat != "아파트·주택" or "남양주" not in addr:
            continue
        ex = re.findall(r"<span[^>]*>([^<]+)</span>", g(r'card_ex ellipsis">(.*?)</div>'))
        area = num((re.search(r"전용\s*([\d,.]+)㎡", " ".join(ex)) or [0, "0"])[1])
        rooms = next((e for e in ex if "방" in e), "")
        prices = [(text(n), text(v)) for n, v in re.findall(
            r'class="price_name[^"]*">(.*?)</span><span class="price_val[^"]*">(.*?)</span>', h)]
        names = [n for n, _ in prices]
        kind = "월세" if "월세" in names else "전세" if "전세" in names else "매매"
        img = g(r'class="item_card_inner_img" src=([^ >]+)')
        tags = [text(t) for t in re.findall(r'class="card_tag[^"]*"[^>]*>(.*?)</span>', h)]
        ribbon = text(g(r'class="ribbon[^"]*"><span[^>]*>(.*?)</span>'))
        result.append({"id": lid, "title": text(g(r'card_title ellipsis">(.*?)</div>')), "addr": addr,
                       "cat": cat, "area": area, "rooms": rooms, "kind": kind,
                       "price": " / ".join(f"{n} {v}" if n not in ("매매",) else v for n, v in prices),
                       "img": (HOMEPAGE + img) if img.startswith("/") else img,
                       "tags": tags + ([ribbon] if ribbon else []), "rec": lid in rec_ids,
                       "url": f"{HOMEPAGE}/item/view/{lid}"})
    print(f"홈페이지 아파트·주택 매물 {len(result)}건 (추천 {sum(r['rec'] for r in result)})", flush=True)
    return result


def listing_detail(lid, cache):
    """매물 상세페이지의 구조화 데이터(JSON-LD)에서 좌표·설명을 가져옴 (캐시)"""
    if lid in cache:
        return cache[lid]
    info = {"lat": None, "lon": None, "desc": ""}
    try:
        h = http_get(f"{HOMEPAGE}/item/view/{lid}", timeout=60).decode("utf-8", "ignore")
        block = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
        if block:
            for node in json.loads(block.group(1)).get("@graph", []):
                geo = node.get("geo") or (node.get("item") or {}).get("geo") if isinstance(node, dict) else None
                if geo and info["lat"] is None:
                    info["lat"], info["lon"] = round(float(geo["latitude"]), 6), round(float(geo["longitude"]), 6)
                if isinstance(node, dict) and node.get("@type") == "WebPage":
                    info["desc"] = node.get("description", "")[:600]
        time.sleep(0.3)
    except Exception as e:
        print("   detail err", lid, e)
        return info
    cache[lid] = info
    return info


def match_listings(listings, complexes, ids_index, cx_coords):
    """주소 지번 → 단지명 → 상세페이지 좌표(가장 가까운 단지) 순으로 실거래 단지와 연결"""
    path = os.path.join(DATA, "geocache.json")
    cache = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    dpath = os.path.join(DATA, "homepage_detail.json")
    dcache = json.load(open(dpath, encoding="utf-8")) if os.path.exists(dpath) else {}
    for l in listings:
        addr = re.sub(r"([리동])(\d)", r"\1 \2", l["addr"])  # '장현리461-4' → '장현리 461-4'
        m = re.search(r"남양주시\s+(\S+(?:\s+\S+[리동])?)\s*([\d-]+)?", addr)
        umd, jibun = (m.group(1), m.group(2) or "") if m else ("", "")
        umd = re.sub(r"\s+", " ", umd)
        l["region"] = umd.split()[0] if umd else ""
        hit = None
        if jibun:
            main = jibun.split("-")[0]
            hit = next((cid for cid, c in complexes.items()
                        if c["umd"] == umd and c["jibun"] and (c["jibun"] == jibun or c["jibun"].split("-")[0] == main)), None)
        if not hit:
            t = l["title"].replace(" ", "")
            cands = [(len(c["name"]), cid) for cid, c in complexes.items()
                     if c["region"] == l["region"] and len(c["name"]) >= 3 and c["name"].replace(" ", "") in t]
            hit = max(cands)[1] if cands else None
        l["lat"] = l["lon"] = None
        if not hit:
            d = listing_detail(l["id"], dcache)
            l["lat"], l["lon"] = d["lat"], d["lon"]
            # 설명 첫머리 [OO아파트 매매] 같은 단지명
            text = (l["title"] + d["desc"]).replace(" ", "")
            cands = [(len(c["name"]), cid) for cid, c in complexes.items()
                     if c["region"] == l["region"] and len(c["name"]) >= 3 and c["name"].replace(" ", "") in text]
            if cands:
                hit = max(cands)[1]
            elif d["lat"] is not None and "아파트" in text:
                # 좌표 기준 150m 안의 가장 가까운 단지
                best = min(((abs(la - d["lat"]) * 111000) ** 2 + (abs(lo - d["lon"]) * 88000) ** 2, cid)
                           for cid, (la, lo) in cx_coords.items())
                if best[0] <= 150 ** 2:
                    hit = best[1]
        l["cx"] = ids_index[hit] if hit else None
        if hit is None and jibun and l["lat"] is None:
            key = f"hp:{umd} {jibun}"
            if key not in cache:
                try:
                    r = json.loads(http_get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
                        {"q": f"경기도 남양주시 {umd} {jibun}", "format": "json", "limit": 1, "countrycodes": "kr"})))
                    time.sleep(1.1)
                    cache[key] = [round(float(r[0]["lat"]), 6), round(float(r[0]["lon"]), 6)] if r else None
                except Exception as e:
                    print("   geocode err", key, e)
                    cache[key] = None
            if cache[key]:
                l["lat"], l["lon"] = cache[key]
    json.dump(cache, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(dcache, open(dpath, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"  단지 매칭 {sum(l['cx'] is not None for l in listings)}건 / 좌표만 {sum(l['lat'] is not None for l in listings)}건")
    return listings


# ---------------------------------------------------------------- main
APPLY_URL = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/"
BUNYANG_FROM = "2021-01-01"   # 진접2·왕숙 사전청약이 시작된 시기부터


def apply_get(op, **cond):
    q = {"page": 1, "perPage": 500, "serviceKey": KEY}
    q.update({f"cond[{k}]": v for k, v in cond.items()})
    d = json.loads(http_get(APPLY_URL + op + "?" + urllib.parse.urlencode(q)))
    if "data" not in d:
        raise RuntimeError(d.get("msg") or d)
    return d["data"]


def district_of(text):
    t = text.replace(" ", "")
    if "왕숙2" in t or re.search(r"일패|이패", t): return "왕숙2"
    if "왕숙" in t: return "왕숙"
    if "진접2" in t: return "진접2"
    return "기타"


def fetch_bunyang():
    """청약홈 분양정보: 남양주 APT 공고(일반·무순위/잔여) + 주택형별 분양가 → data/bunyang.js"""
    rows = []
    for op, kind in (("getAPTLttotPblancDetail", "APT"), ("getRemndrLttotPblancDetail", "무순위·잔여")):
        for r in apply_get(op, **{"HSSPLY_ADRES::LIKE": "남양주", "RCRIT_PBLANC_DE::GTE": BUNYANG_FROM}):
            mdl = apply_get(op.replace("Detail", "Mdl"), **{"HOUSE_MANAGE_NO::EQ": r["HOUSE_MANAGE_NO"], "PBLANC_NO::EQ": r["PBLANC_NO"]})
            time.sleep(0.2)
            rows.append({
                "nm": r.get("HOUSE_NM", ""), "addr": r.get("HSSPLY_ADRES", ""), "kind": kind,
                "dist": district_of(r.get("HOUSE_NM", "") + " " + r.get("HSSPLY_ADRES", "")),
                "type": r.get("HOUSE_DTL_SECD_NM") or r.get("HOUSE_SECD_NM") or "",
                "tot": num(r.get("TOT_SUPLY_HSHLDCO")), "pblanc": r.get("RCRIT_PBLANC_DE"),
                "rcpt": [r.get("RCEPT_BGNDE") or r.get("SUBSCRPT_RCEPT_BGNDE"), r.get("RCEPT_ENDDE") or r.get("SUBSCRPT_RCEPT_ENDDE")],
                "prz": r.get("PRZWNER_PRESNATN_DE"), "cntrct": r.get("CNTRCT_CNCLS_BGNDE"), "mvn": r.get("MVN_PREARNGE_YM"),
                "bsns": r.get("BSNS_MBY_NM") or "", "cnstr": r.get("CNSTRCT_ENTRPS_NM") or "", "url": r.get("PBLANC_URL") or "",
                "ceil": r.get("PARCPRC_ULS_AT") == "Y",
                # [주택형, 공급면적㎡, 공급세대(일반+특별), 분양최고가(만원)]
                "models": [[m.get("HOUSE_TY", ""), num(m.get("SUPLY_AR")), num(m.get("SUPLY_HSHLDCO")) + num(m.get("SPSPLY_HSHLDCO")),
                            num(m.get("LTTOT_TOP_AMOUNT"))] for m in mdl],
            })
    rows.sort(key=lambda x: x["pblanc"] or "", reverse=True)
    with open(os.path.join(DATA, "bunyang.js"), "w", encoding="utf-8") as f:
        f.write("window.BUNYANG={updated:%s,rows:" % json.dumps(datetime.date.today().isoformat()))
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
        f.write("};")
    print(f"분양공고 {len(rows)}건 (진접2 {sum(r['dist']=='진접2' for r in rows)} / 왕숙 {sum(r['dist'].startswith('왕숙') for r in rows)})")


def main():
    if "--bunyang-only" in sys.argv:
        try:
            return fetch_bunyang()
        except Exception as e:
            return print("청약홈 분양정보 수집 실패 (공공데이터포털에서 '한국부동산원_청약홈 분양정보 조회 서비스' 활용신청 필요):", e)
    print("실거래 수집 중...", flush=True)
    raw = collect()
    complexes, trades, rents = {}, [], []

    def cx(it, ptype="apt"):
        if ptype == "villa":
            cid = f"villa|{it.get('umdNm')}|{it.get('jibun')}|{it.get('mhouseNm')}"
            it = {**it, "aptNm": it.get("mhouseNm", "")}
        elif ptype == "house":
            # 단독·다가구는 단지명·지번이 없어 리/동 단위로 묶음
            umd = it.get("umdNm", "")
            cid = f"house|{umd}"
            it = {**it, "aptNm": f"단독·다가구 ({umd.split()[-1] if umd else '-'})", "jibun": "", "buildYear": ""}
        else:
            cid = it.get("aptSeq") or f"{it.get('umdNm')}|{it.get('aptNm')}"
        c = complexes.get(cid)
        if not c:
            road = ""
            if it.get("roadNm"):
                road = f"{it['roadNm']} {int(it.get('roadNmBonbun') or 0)}"
                if int(it.get("roadNmBubun") or 0):
                    road += f"-{int(it['roadNmBubun'])}"
            elif it.get("roadnm"):
                road = it["roadnm"]
            c = complexes[cid] = {"id": cid, "name": it.get("aptNm", ""), "umd": it.get("umdNm", ""),
                                  "region": region_of(it.get("umdNm", "")), "year": num(it.get("buildYear")),
                                  "road": road, "jibun": it.get("jibun", ""), "ptype": ptype}
        elif not c["road"] and (it.get("roadNm") or it.get("roadnm")):
            c["road"] = it.get("roadnm") or f"{it['roadNm']} {int(it.get('roadNmBonbun') or 0)}"
        return cid

    # 면적: 아파트·빌라 = 전용면적, 단독·다가구 = 연면적
    area_of = lambda it: num(it.get("excluUseAr") or it.get("totalFloorAr"))
    for kind, ptype in (("trade", "apt"), ("trade_villa", "villa"), ("trade_house", "house")):
        for it in raw.get(kind, []):
            if it.get("cdealType") == "O":  # 해제(취소)거래 제외
                continue
            d = int(it["dealYear"]) * 10000 + int(it["dealMonth"]) * 100 + int(it["dealDay"])
            trades.append([cx(it, ptype), d, round(area_of(it), 1), num(it.get("floor")), num(it["dealAmount"]),
                           1 if it.get("dealingGbn") == "직거래" else 0])
    for kind, ptype in (("rent", "apt"), ("rent_villa", "villa"), ("rent_house", "house")):
        for it in raw.get(kind, []):
            d = int(it["dealYear"]) * 10000 + int(it["dealMonth"]) * 100 + int(it["dealDay"])
            ct = {"신규": 1, "갱신": 2}.get(it.get("contractType", ""), 0)
            rents.append([cx(it, ptype), d, round(area_of(it), 1), num(it.get("floor")), num(it["deposit"]),
                          num(it["monthlyRent"]), ct])

    geo = geocode_all(complexes)
    ids = sorted(complexes)
    idx = {cid: i for i, cid in enumerate(ids)}
    cx_out = []
    for cid in ids:
        c, g = complexes[cid], geo.get(cid)
        # [이름, 읍면동, 법정동, 준공, 표시주소, 위도, 경도, 구분(홈페이지 매물='hp'), 지번, 도로명, 유형(apt/villa/house)]
        cx_out.append([c["name"], c["region"], c["umd"], c["year"], c["road"] or f"{c['umd']} {c['jibun']}".strip(),
                       g[0] if g else None, g[1] if g else None, None, c["jibun"], c["road"], c["ptype"]])
    for t in trades: t[0] = idx[t[0]]
    for t in rents: t[0] = idx[t[0]]
    trades.sort(key=lambda t: t[1]); rents.sort(key=lambda t: t[1])

    poi_path = os.path.join(DATA, "pois.json")
    if "--no-poi" not in sys.argv or not os.path.exists(poi_path):
        try:
            json.dump(fetch_pois(), open(poi_path, "w", encoding="utf-8"), ensure_ascii=False)
        except Exception as e:
            print("주변시설 수집 실패:", e)
    pois = json.load(open(poi_path, encoding="utf-8")) if os.path.exists(poi_path) else []

    try:
        # 단독·다가구 묶음은 리/동 중심점이라 '가까운 단지' 매칭에서 제외
        cx_coords = {cid: (g[0], g[1]) for cid, g in geo.items() if g and complexes.get(cid, {}).get("ptype") != "house"}
        homepage = match_listings(fetch_homepage_listings(), complexes, idx, cx_coords)
    except Exception as e:
        print("홈페이지 매물 수집 실패:", e)
        homepage = []

    payload = {"updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
               "complexes": cx_out, "trades": trades, "rents": rents, "pois": pois, "homepage": homepage}
    with open(os.path.join(DATA, "data.js"), "w", encoding="utf-8") as f:
        f.write("window.DASH_DATA=")
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    print(f"완료: 단지 {len(cx_out)} / 매매 {len(trades)} / 전월세 {len(rents)} / 시설 {len(pois)}")
    try:
        fetch_bunyang()
    except Exception as e:
        print("청약홈 분양정보 수집 실패 (공공데이터포털에서 '한국부동산원_청약홈 분양정보 조회 서비스' 활용신청 필요):", e)


if __name__ == "__main__":
    main()
