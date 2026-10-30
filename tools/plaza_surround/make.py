# 3D 광장 주변(건물·도로·땅 쓰임) 자료 만들기 — 원점 청사 본관 중심, x=동 y=북(m)
import json, math, re
LAT, LNG = 35.804403, 127.102486
ML = 111320; MG = 111320 * math.cos(LAT * math.pi / 180)
MAP = '../../../jbe-hq-3d-map'
RAD_B, RAD_R = 1000, 1200
# 광장 부지(건물·도로를 빼는 곳)
MAIN = [[-42.6, -17.7], [-34.1, -33.0], [7.2, -10.1], [34.8, 10.7], [43.1, 21.2], [18.6, 23.0], [11.6, 15.0], [4.0, 8.1]]
FRONT = [[7.2, -10.1], [9.5, -19.5], [19.5, -19.5], [52.0, -1.2], [44.0, 9.5], [34.8, 10.7]]
ANNEX = [[-46, -63], [-17, -50], [0, -87], [-31, -101]]
PLAZA = [[-14, -28], [10, -12], [52, -1], [70, 2], [80, -12], [30, -44], [-6, -46]]
PARK = [[-46, -16], [4, 9], [18, 24], [46, 24], [42, 62], [-22, 56], [-62, 18]]
FA, FB = (19.5, -19.5), (52.0, -1.2)
FL = math.hypot(FB[0] - FA[0], FB[1] - FA[1]); FN = ((FB[1] - FA[1]) / FL, -(FB[0] - FA[0]) / FL)
FM = ((FA[0] + FB[0]) / 2, (FA[1] + FB[1]) / 2); CS = (FM[0] + FN[0] * 48, FM[1] + FN[1] * 48); R = 26
pts = MAIN + FRONT + ANNEX + PLAZA + PARK + [[CS[0] + math.cos(a / 24 * 2 * math.pi) * (R + 12), CS[1] + math.sin(a / 24 * 2 * math.pi) * (R + 12)] for a in range(24)]
def hull(p):
    p = sorted(map(tuple, p))
    def cr(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in p:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(up) >= 2 and cr(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]
H = hull(pts)
def inpoly(p, poly):
    x, y = p; c = False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c
def segd(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; l = dx * dx + dy * dy or 1e-9
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
def campus(p, pad=6):
    return inpoly(p, H) or min(segd(p, H[i], H[i - 1]) for i in range(len(H))) < pad
r1 = lambda v: round(v, 1)

# 1) 건물(VWorld, 3D 지도 자료)
B = []
for k in ['-1_-1', '-1_0', '0_-1', '0_0']:
    s = open(f'{MAP}/b/c_{k}.js', encoding='utf-8').read()
    B += json.loads(s[s.index('{'):s.rindex('}') + 1])['b']
bld = []
for r in B:
    f = r[7]; poly = [(f[i], f[i + 1]) for i in range(0, len(f), 2)]
    cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
    if math.hypot(cx, cy) > RAD_B: continue
    if any(campus(p, 3) for p in poly): continue
    bld.append([r[0], r1(r[2]), r[4], r[5], r[6], [r1(v) for xy in poly for v in xy]])

# 2) 도로·땅 쓰임(OSM)
d = json.load(open('osm.json', encoding='utf-8'))
W = {'secondary': 20, 'secondary_link': 9, 'tertiary': 15, 'tertiary_link': 8, 'unclassified': 9, 'residential': 7,
     'living_street': 6, 'service': 5, 'pedestrian': 4, 'footway': 2.4, 'cycleway': 2.4, 'path': 2}
AREA = {('landuse', 'residential'): 'res', ('landuse', 'commercial'): 'com', ('landuse', 'retail'): 'com',
        ('landuse', 'recreation_ground'): 'park', ('leisure', 'park'): 'park', ('leisure', 'playground'): 'park',
        ('leisure', 'pitch'): 'pitch', ('natural', 'wood'): 'wood', ('natural', 'water'): 'water', ('leisure', 'swimming_pool'): 'water'}
roads, areas = [], []
for e in d['elements']:
    t = e.get('tags', {}); g = e.get('geometry')
    if e['type'] != 'way' or not g: continue
    P = [((q['lon'] - LNG) * MG, (q['lat'] - LAT) * ML) for q in g]
    h = t.get('highway')
    if h in W:
        run = []
        for p in P:
            if campus(p, W[h] / 2 + 2) or math.hypot(*p) > RAD_R:
                if len(run) >= 2: roads.append([h, [r1(v) for xy in run for v in xy]])
                run = []
            else: run.append(p)
        if len(run) >= 2: roads.append([h, [r1(v) for xy in run for v in xy]])
        continue
    for (k, v), name in AREA.items():
        if t.get(k) == v and len(P) >= 4 and P[0] == P[-1]:
            if all(math.hypot(*p) > RAD_R * 1.4 for p in P): break
            areas.append([name, [r1(v) for xy in P[:-1] for v in xy]])
            break

# 3) 운동장(3D 지도 fields.js)
s = open(f'{MAP}/fields.js', encoding='utf-8').read()
fj = json.loads(s[s.index('{'):s.rindex('}') + 1])
for ft in fj['features']:
    gm = ft['geometry']
    rings = [gm['coordinates'][0]] if gm['type'] == 'Polygon' else [c[0] for c in gm['coordinates']]
    for rg in rings:
        P = [((q[0] - LNG) * MG, (q[1] - LAT) * ML) for q in rg]
        if min(math.hypot(*p) for p in P) > RAD_B: continue
        if P[0] == P[-1]: P = P[:-1]
        areas.append(['f_' + ft['properties'].get('k', 'sand'), [r1(v) for xy in P for v in xy]])

out = {'src': 'VWorld GIS건물통합정보(건물) · © OpenStreetMap 기여자(도로·땅 쓰임, ODbL)', 'b': bld, 'r': roads, 'a': areas}
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open('surround.json', 'w', encoding='utf-8').write(s)
from collections import Counter
print('bld', len(bld), 'roads', len(roads), Counter(r[0] for r in roads), 'areas', Counter(a[0] for a in areas), 'bytes', len(s.encode()))
