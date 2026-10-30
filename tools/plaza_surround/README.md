# 3D 광장 주변 동네 자료 만들기

`src/plaza/surround.json`(청사 주변 건물·도로·공원)을 만드는 스크립트.

- 건물: 청사 3D 지도(`C:\work\jbe-hq-3d-map\b\`)의 VWorld 건물 자료 — 본관 중심 700m 안
- 운동장: 청사 3D 지도 `fields.js`
- 도로·공원·주거지·물: OpenStreetMap(오버패스) — 본관 중심 900m 안. `osm.json`으로 받아 둠
- 광장 부지(청사·주차장·천막 마당)에 걸치는 건물·도로는 뺌

```
# 1) OSM 받기 (osm.json)
curl -A "jbe-plaza" -H "Accept: application/json" -o osm.json --data-urlencode "data=[out:json][timeout:50];(way[\"highway\"](around:900,35.804403,127.102486);way[\"landuse\"](around:900,35.804403,127.102486);way[\"leisure\"](around:900,35.804403,127.102486);way[\"natural\"](around:900,35.804403,127.102486););out geom;" https://overpass-api.de/api/interpreter
# 2) 만들기 → surround.json 을 src/plaza/ 로 복사
python make.py
```

`make.py` 안의 `MAP`(청사 3D 지도 폴더) 경로는 이 폴더 기준 `../../../jbe-hq-3d-map`.
