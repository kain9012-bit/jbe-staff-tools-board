# 3D 광장 주변 동네 자료 만들기

`src/plaza/surround.json`(청사 주변 건물·도로·공원)을 만드는 스크립트.

- 건물: 청사 3D 지도(`C:\work\jbe-hq-3d-map\b\`)의 VWorld 건물 자료 — 본관 중심 1000m 안
- 운동장: 청사 3D 지도 `fields.js`
- 도로·공원·주거지·물: OpenStreetMap(오버패스) — 본관 중심 1200m 안. `osm.json`으로 받아 둠
- 주차장·하천 등 보충: OpenStreetMap(`osm2.json`)
- 나무 자리: 청사 3D 지도의 VWorld 항공사진(`data/aerial_z18.jpg`)에서 숲 판정(`canopy.py` → `trees.json`). 사진을 바닥에 깔지는 않음
- 손으로 짚은 곳(`detail.json`): 동암고 운동장·금, 사모지붕, 용호공원 연못 터·숲·데크길·정자, 청사 북쪽 연못
- 광장 부지(청사·주차장·천막 마당)에 걸치는 건물·도로·나무는 뺌

```
# 1) OSM 받기 (osm.json)
curl -A "jbe-plaza" -H "Accept: application/json" -o osm.json --data-urlencode "data=[out:json][timeout:50];(way[\"highway\"](around:1300,35.804403,127.102486);way[\"landuse\"](around:1300,35.804403,127.102486);way[\"leisure\"](around:1300,35.804403,127.102486);way[\"natural\"](around:1300,35.804403,127.102486););out geom;" https://overpass-api.de/api/interpreter
# 1-2) 주차장 등 보충(osm2.json): 위와 같은 방식으로 amenity=parking, waterway 등
# 2) 나무 자리 → trees.json
python canopy.py 0.5
# 3) 만들기 → surround.json 을 src/plaza/ 로 복사
python make.py
```

`make.py` 안의 `MAP`(청사 3D 지도 폴더) 경로는 이 폴더 기준 `../../../jbe-hq-3d-map`.
