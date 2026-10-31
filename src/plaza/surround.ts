/**
 * 3D 광장 — 청사 주변 동네(건물·도로·땅 쓰임)
 * 자료: surround.json (tools/plaza_surround/make.py로 만듦)
 *  - 건물: VWorld GIS건물통합정보(청사 3D 지도 자료) — 외곽선·높이·벽색·지붕색
 *  - 도로·공원·주거지·물: © OpenStreetMap 기여자(ODbL)
 *  - 운동장: 청사 3D 지도의 학교 운동장 자료
 *  - 나무 자리·용호공원·동암고 운동장·연못: VWorld 항공사진을 보고 짚음(사진을 깔지는 않음)
 * 좌표: 원점 = 본관 중심, x=동, y=북(m) → three (x, 높이, -y)
 * 색은 청사 3D 지도(그림풍 지도)와 같은 계열.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import data from './surround.json';
import { toon } from './chibi';

/** [유형, 높이, 벽색, 지붕색, 지붕 모양(flat|hip|gable|pyr), 외곽선, 둘러싼 사각형] */
type Rec = [string, number, string, string, string, number[], number[]];
const D = data as unknown as {
  b: Rec[];
  r: [string, number[]][];
  a: [string, number[]][];
  /** 나무 자리 x,y,… */
  t?: number[];
  /** 데크길(선), 정자(점), 운동장 금 긋기(사각형) */
  deck?: number[][];
  gz?: number[][];
  lines?: number[][];
};

const AREA_COL: Record<string, string> = {
  res: '#c9ceb3', com: '#cfccbf', park: '#a3c27c', wood: '#8fae69', water: '#7eb2d8', pitch: '#c9b07d',
  f_sand: '#d9c290', f_turf: '#5f9e52', f_court: '#4f84b6', f_track: '#c2654c',
  parking: '#9a9ea4', open: '#d3c99d', reed: '#b3c287', pond: '#6db7a8', court: '#3fa58f', tennis: '#4f8f6a',
};
const AREA_ORDER = ['res', 'com', 'park', 'wood', 'parking', 'pitch', 'open', 'reed', 'water', 'pond', 'f_sand', 'f_turf', 'f_track', 'f_court', 'court', 'tennis'];
/** 도로 폭(m) — 실제 폭에 가깝게 */
const ROAD_W: Record<string, number> = {
  secondary: 20, secondary_link: 9, tertiary: 15, tertiary_link: 8, unclassified: 9, residential: 7,
  living_street: 6, service: 5, pedestrian: 4, footway: 2.4, cycleway: 2.4, path: 2,
};
const PATHS = new Set(['footway', 'cycleway', 'path', 'pedestrian']);
const MINOR = new Set(['service', 'living_street']);

const pts = (f: number[]) => {
  const o: [number, number][] = [];
  for (let i = 0; i + 1 < f.length; i += 2) o.push([f[i], f[i + 1]]);
  return o;
};
function inPoly(x: number, y: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function segDist(x: number, y: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
const area = (p: [number, number][]) => {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return s / 2; // >0: 시계 반대(CCW)
};
/** 바닥에 까는 평면(색은 꼭짓점 색) */
function flatGeo(poly: [number, number][], col: THREE.Color) {
  const s = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2); // (x, y) → (x, 0, -y)
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}
/** 길 띠: 마디마다 둥근 이음 */
function ribbonGeo(line: [number, number][], w: number, col: THREE.Color) {
  const P: number[] = [];
  const h = w / 2;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / l) * h, ny = ((bx - ax) / l) * h;
    const q = [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
    P.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]); // 위에서 볼 때 시계 반대
  }
  const seg = w > 6 ? 10 : 6;
  for (const [x, y] of line)
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      P.push(x, y, x + Math.cos(a0) * h, y + Math.sin(a0) * h, x + Math.cos(a1) * h, y + Math.sin(a1) * h);
    }
  const pos = new Float32Array((P.length / 2) * 3), c = new Float32Array((P.length / 2) * 3);
  for (let i = 0, j = 0; i < P.length; i += 2, j += 3) {
    pos[j] = P[i];
    pos[j + 1] = 0; // 높이는 겹(layer)마다 따로 올림
    pos[j + 2] = -P[i + 1];
    col.toArray(c, j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** 창문 무늬(벽) — 4×4칸에 창이 무작위로 켜짐 */
function windowTex(lit: boolean) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  let seed = 17;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = lit ? '#000000' : '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const on = r() < 0.4;
      if (lit) {
        if (!on) continue;
        g.fillStyle = r() < 0.7 ? '#ffd9a0' : '#fff2d8';
      } else g.fillStyle = '#9fb3c4';
      g.fillRect(i * 64 + 18, j * 64 + 18, 28, 24);
    }
  // 지붕 자리(왼쪽 아래 귀퉁이)는 민무늬
  g.fillStyle = lit ? '#000000' : '#ffffff';
  g.fillRect(0, 248, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeSurround(scene: THREE.Scene, opt: { shadows: boolean; low?: boolean; avoid: (x: number, y: number) => boolean }) {
  const group = new THREE.Group();
  group.name = 'surround';
  scene.add(group);
  const tmpC = new THREE.Color();

  /* 땅 쓰임 */
  {
    const geos: THREE.BufferGeometry[] = [], waters: THREE.BufferGeometry[] = [];
    const list = [...D.a].sort((a, b) => AREA_ORDER.indexOf(a[0]) - AREA_ORDER.indexOf(b[0]));
    list.forEach(([k, f]) => {
      const p = pts(f);
      if (p.length < 3) return;
      const g = flatGeo(p, tmpC.set(AREA_COL[k] ?? AREA_COL.res));
      g.translate(0, 0.008 + AREA_ORDER.indexOf(k) * 0.002, 0); // 종류마다 높이 한 칸(길보다 아래)
      (k === 'water' || k === 'pond' ? waters : geos).push(g);
    });
    // 물: 햇빛이 반짝이게
    if (waters.length) {
      const w = new THREE.Mesh(
        mergeGeometries(waters),
        new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: new THREE.Color('#6f8a96'), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }),
      );
      w.position.y = 0.01;
      w.receiveShadow = opt.shadows;
      w.renderOrder = -2;
      group.add(w);
      waters.forEach((g) => g.dispose());
    }
    if (geos.length) {
      const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      m.receiveShadow = opt.shadows;
      m.renderOrder = -2;
      group.add(m);
      geos.forEach((g) => g.dispose());
    }
  }

  /* 도로: 테두리 → 길 → 보행로 순 */
  const roadLines: { w: number; line: [number, number][] }[] = [];
  {
    const cases: THREE.BufferGeometry[] = [], tops: THREE.BufferGeometry[] = [], paths: THREE.BufferGeometry[] = [], pathEdges: THREE.BufferGeometry[] = [];
    for (const [k, f] of D.r) {
      const w = ROAD_W[k];
      if (!w) continue;
      const line = pts(f);
      roadLines.push({ w, line });
      if (PATHS.has(k)) {
        // 산책로: 흙빛 길 + 짙은 가장자리(숲속에서도 잘 보이게)
        pathEdges.push(ribbonGeo(line, w + 1.1, tmpC.set('#b49f78')));
        paths.push(ribbonGeo(line, w + 0.3, tmpC.set('#e6d6b2')));
      }
      else {
        cases.push(ribbonGeo(line, w + 2.2, tmpC.set('#a7abb0'))); // 보도·경계석
        tops.push(ribbonGeo(line, w, tmpC.set(MINOR.has(k) ? '#7d8288' : '#62676e')));
      }
    }
    // 겹마다 높이를 조금씩 달리해 멀리서도 깜빡이지 않게
    const layer = (geos: THREE.BufferGeometry[], units: number, y: number) => {
      if (!geos.length) return;
      const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: units }));
      m.position.y = y;
      m.geometry.computeVertexNormals();
      m.receiveShadow = opt.shadows;
      m.renderOrder = -1;
      group.add(m);
      geos.forEach((g) => g.dispose());
    };
    layer(cases, -4, 0.05);
    layer(pathEdges, -3, 0.052);
    layer(paths, -5, 0.058);
    layer(tops, -6, 0.07);
  }

  /* 건물 */
  const polys: [number, number][][] = [];
  const heights: number[] = [];
  const nightMats: THREE.MeshLambertMaterial[] = [];
  {
    const P: number[] = [], C: number[] = [], U: number[] = [], N: number[] = [];
    const wallC = new THREE.Color(), roofC = new THREE.Color();
    const BAY = 3.4, FLOOR = 3.2;
    for (const rec of D.b) {
      const [, hgt, wall, roof, , f] = rec;
      let p = pts(f);
      if (p.length < 3) continue;
      if (area(p) < 0) p = p.reverse(); // 시계 반대로 맞춤 → 바깥 법선
      polys.push(p);
      const h = Math.max(3, hgt);
      heights.push(h);
      wallC.set(wall);
      roofC.set(roof);
      // 벽
      let run = 0;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.05) continue;
        const nx = (b[1] - a[1]) / len, ny = -(b[0] - a[0]) / len; // 바깥쪽(CCW 기준 오른쪽)
        const u0 = run / BAY, u1 = (run + len) / BAY, v0 = -0.2, v1 = h / FLOOR;
        run += len;
        const A = [a[0], -0.5, -a[1]], B = [b[0], -0.5, -b[1]], Bt = [b[0], h, -b[1]], At = [a[0], h, -a[1]];
        P.push(...A, ...B, ...Bt, ...A, ...Bt, ...At);
        U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
        for (let k = 0; k < 6; k++) (C.push(wallC.r, wallC.g, wallC.b), N.push(nx, 0, -ny));
      }
      // 경사 지붕(모임·박공·사모): 둘러싼 사각형 위에 올림
      const roofType = rec[4], obb = rec[6];
      if (roofType !== 'flat' && obb && obb.length === 8) {
        const q = pts(obb);
        const e1 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), e2 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
        // 긴 변 방향으로 정렬: a→b 긴 변, b→c 짧은 변
        const [a0, b0, c0, d0] = e1 >= e2 ? q : [q[1], q[2], q[3], q[0]];
        const L = Math.max(e1, e2), Sh = Math.min(e1, e2);
        const rise = roofType === 'pyr' ? Math.min(Sh * 0.42, 9) : Math.min(Sh * 0.32, 5);
        const mid = (u: [number, number], v: [number, number]) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2] as [number, number];
        const top = h + rise;
        const tri = (A: number[], B: number[], Cc: number[]) => {
          // 바깥(위)을 향하게: 법선 y>0
          const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          if (ny < 0) {
            [B, Cc] = [Cc, B];
            nx = -nx; ny = -ny; nz = -nz;
          }
          const l = Math.hypot(nx, ny, nz) || 1;
          P.push(...A, ...B, ...Cc);
          U.push(0.005, 0.005, 0.005, 0.005, 0.005, 0.005);
          for (let k = 0; k < 3; k++) (C.push(roofC.r, roofC.g, roofC.b), N.push(nx / l, ny / l, nz / l));
        };
        const V3 = (p2: [number, number], y: number) => [p2[0], y, -p2[1]];
        const A = V3(a0, h), B = V3(b0, h), Cq = V3(c0, h), Dq = V3(d0, h);
        if (roofType === 'pyr' || L - Sh < 1) {
          const cpt = V3(mid(a0, c0), top);
          tri(A, B, cpt); tri(B, Cq, cpt); tri(Cq, Dq, cpt); tri(Dq, A, cpt);
        } else {
          // 용마루: 짧은 변 가운데를 잇는 선(박공) 또는 양 끝을 짧은 변 절반만큼 들인 선(모임)
          const m1 = mid(d0, a0), m2 = mid(b0, c0);
          const ux = (m2[0] - m1[0]) / L, uy = (m2[1] - m1[1]) / L, inset = roofType === 'hip' ? Sh / 2 : 0;
          const R1 = V3([m1[0] + ux * inset, m1[1] + uy * inset], top), R2 = V3([m2[0] - ux * inset, m2[1] - uy * inset], top);
          tri(A, B, R2); tri(A, R2, R1); // 긴 면 1
          tri(Cq, Dq, R1); tri(Cq, R1, R2); // 긴 면 2
          tri(Dq, A, R1); tri(B, Cq, R2); // 끝(모임: 경사, 박공: 세운 삼각 벽)
        }
      }
      // 지붕(평지붕 판 — 경사 지붕이면 그 밑에 가려짐)
      const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, y]) => new THREE.Vector2(x, y)), []);
      for (const t of tris)
        for (const k of t) {
          P.push(p[k][0], h, -p[k][1]);
          U.push(0.005, 0.005); // 민무늬 귀퉁이
          C.push(roofC.r * 0.92, roofC.g * 0.92, roofC.b * 0.92);
          N.push(0, 1, 0);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    // 창 무늬 4×4칸 = 4베이 × 4층
    const map = windowTex(false), emi = windowTex(true);
    map.repeat.set(0.25, 0.25);
    emi.repeat.set(0.25, 0.25);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map, emissiveMap: emi, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, side: THREE.DoubleSide });
    nightMats.push(mat);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = opt.shadows;
    m.receiveShadow = false;
    group.add(m);
  }

  /* 빠른 찾기: 20m 칸 */
  const CELL = 20;
  const grid = new Map<string, { polys: number[]; roads: number[] }>();
  const cellOf = (x: number, y: number) => `${Math.floor(x / CELL)}_${Math.floor(y / CELL)}`;
  const put = (x0: number, y0: number, x1: number, y1: number, fn: (c: { polys: number[]; roads: number[] }) => void) => {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
        const k = `${i}_${j}`;
        let c = grid.get(k);
        if (!c) grid.set(k, (c = { polys: [], roads: [] }));
        fn(c);
      }
  };
  polys.forEach((p, i) => {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    put(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (c) => c.polys.push(i));
  });
  roadLines.forEach((r, i) => {
    const xs = r.line.map((q) => q[0]), ys = r.line.map((q) => q[1]), pad = r.w / 2 + 2;
    put(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad, (c) => c.roads.push(i));
  });

  const waterPolys = D.a
    .filter(([k]) => k === 'water' || k === 'pond')
    .map(([, f]) => {
      const p = pts(f);
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      return { p, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    });
  const deckLines = (D.deck ?? []).map(pts);
  /** 물 위인가(데크 위는 아님) */
  const inWater = (x: number, y: number) => {
    if (!waterPolys.some((w) => x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1 && inPoly(x, y, w.p))) return false;
    if (deckLines.some((l) => l.some((_, k) => k + 1 < l.length && segDist(x, y, l[k], l[k + 1]) < 1.0))) return false;
    // 물 위를 지나는 산책로(징검다리·데크)는 걸을 수 있음
    const c = grid.get(cellOf(x, y));
    if (c)
      for (const i of c.roads) {
        const r = roadLines[i];
        if (r.w > 4) continue;
        for (let k = 0; k + 1 < r.line.length; k++) if (segDist(x, y, r.line[k], r.line[k + 1]) < r.w / 2 + 0.4) return false;
      }
    return true;
  };
  const inBuilding = (x: number, y: number, pad = 0) => {
    const c = grid.get(cellOf(x, y));
    if (!c) return false;
    for (const i of c.polys) {
      const p = polys[i];
      if (inPoly(x, y, p)) return true;
      if (pad > 0) for (let k = 0; k < p.length; k++) if (segDist(x, y, p[k], p[(k + 1) % p.length]) < pad) return true;
    }
    return false;
  };
  const onRoad = (x: number, y: number, pad = 0) => {
    const c = grid.get(cellOf(x, y));
    if (!c) return false;
    for (const i of c.roads) {
      const r = roadLines[i];
      for (let k = 0; k + 1 < r.line.length; k++) if (segDist(x, y, r.line[k], r.line[k + 1]) < r.w / 2 + pad) return true;
    }
    return false;
  };

  /* 나무: 항공사진에서 나무가 있는 자리(숲·가로수·공원) */
  {
    const T = D.t ?? [];
    const spots: [number, number][] = [];
    for (let i = 0; i + 1 < T.length; i += 2) {
      const x = T[i], y = T[i + 1];
      if (opt.low && Math.hypot(x, y) > 300 && (i / 2) % 2) continue; // 휴대폰: 먼 나무는 절반만
      if (opt.avoid(x, y)) continue;
      if ((D.gz ?? []).some(([gx, gy]) => Math.hypot(x - gx, y - gy) < 6.5)) continue; // 정자 둘레는 빈터
      spots.push([x, y]);
    }
    let seed = 41;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 5), toon('#7a5a3c'), spots.length);
    const crownCols = ['#5f9a4a', '#4f8a43', '#76a85a', '#3f7a3a'];
    const crowns = crownCols.map((c) => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.75, 0), new THREE.MeshLambertMaterial({ color: c, flatShading: true }), spots.length));
    const cnt = crownCols.map(() => 0);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    spots.forEach(([x, y], i) => {
      const k = 0.85 + r() * 0.55;
      mtx.compose(pos.set(x, 1.2 * k, -y), q.identity(), sc.set(k, k, k));
      trunk.setMatrixAt(i, mtx);
      const ci = Math.floor(r() * crownCols.length);
      q.setFromEuler(new THREE.Euler(r(), r() * 6, r()));
      mtx.compose(pos.set(x, 2.4 * k + 1.3 * k, -y), q, sc.set(k * 1.1, k * 1.3, k * 1.1));
      crowns[ci].setMatrixAt(cnt[ci]++, mtx);
    });
    crowns.forEach((c, i) => {
      c.count = cnt[i];
      c.castShadow = opt.shadows;
      group.add(c);
    });
    trunk.castShadow = opt.shadows;
    group.add(trunk);
  }

  /* 운동장 금(흰 선): 둘레·가운데 선·가운데 원 */
  {
    const geos: THREE.BufferGeometry[] = [];
    const white = new THREE.Color('#f4f2ea');
    for (const f of D.lines ?? []) {
      const q = pts(f);
      if (q.length !== 4) continue;
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
      const inn = q.map(([x, y]) => [cx + (x - cx) * 0.9, cy + (y - cy) * 0.9] as [number, number]);
      geos.push(ribbonGeo([...inn, inn[0]], 0.35, white));
      // 긴 변의 가운데끼리 → 가운데 선
      const e01 = Math.hypot(inn[1][0] - inn[0][0], inn[1][1] - inn[0][1]), e12 = Math.hypot(inn[2][0] - inn[1][0], inn[2][1] - inn[1][1]);
      const m = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number];
      const half = e01 >= e12 ? [m(inn[0], inn[1]), m(inn[2], inn[3])] : [m(inn[1], inn[2]), m(inn[3], inn[0])];
      geos.push(ribbonGeo(half, 0.35, white));
      const ring: [number, number][] = [];
      for (let k = 0; k <= 32; k++) ring.push([cx + Math.cos((k / 32) * Math.PI * 2) * 8, cy + Math.sin((k / 32) * Math.PI * 2) * 8]);
      geos.push(ribbonGeo(ring, 0.35, white));
    }
    if (geos.length) {
      const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -8 }));
      m.geometry.computeVertexNormals();
      m.position.y = 0.045;
      group.add(m);
    }
  }

  /* 용호공원: 데크길·정자 */
  {
    const deckM = toon('#9a6e48');
    for (const f of D.deck ?? []) {
      const line = pts(f);
      for (let i = 0; i + 1 < line.length; i++) {
        const [ax, ay] = line[i], [bx, by] = line[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 2.2), deckM);
        deck.position.set((ax + bx) / 2, 0.1, -(ay + by) / 2); // 사람이 걸어 다니는 높이(땅과 거의 같게)
        deck.rotation.y = Math.atan2(by - ay, bx - ax);
        deck.castShadow = deck.receiveShadow = opt.shadows;
        group.add(deck);
        // 난간
        for (const sd of [-1, 1]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), deckM);
          rail.position.set(0, 0.9, sd * 1.05);
          // 난간 기둥
          for (let t = -len / 2 + 0.6; t < len / 2; t += 2.4) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), deckM);
            post.position.set(t, 0.45, sd * 1.05);
            deck.add(post);
          }
          deck.add(rail);
        }
      }
    }
    for (const [gx, gy] of D.gz ?? []) {
      const g = new THREE.Group();
      g.position.set(gx, 0, -gy);
      const wood = toon('#8a5a3a'), roofM = toon('#5b4a42');
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, 0.5, 8), toon('#b89b7a'));
      floor.position.y = 0.25;
      g.add(floor);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.6, 6), wood);
        post.position.set(Math.cos(a) * 2.8, 1.8, Math.sin(a) * 2.8);
        g.add(post);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 1.9, 8), roofM);
      roof.position.y = 4.0;
      roof.rotation.y = Math.PI / 8;
      g.add(roof);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), wood);
      cap.position.y = 5.0;
      g.add(cap);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = opt.shadows));
      group.add(g);
    }
  }

  return {
    group,
    /** site 좌표(x=동, y=북)가 건물 안인가(pad: 여유 m) */
    inBuilding,
    /** 길 위인가(pad: 길 가장자리 여유 m) */
    onRoad,
    /** 물 위인가(데크는 걸을 수 있음) */
    inWater,
    /** 높이 h(m)의 점이 건물 속인가 — 카메라가 건물에 가리는지 볼 때 */
    solidAt(x: number, y: number, h: number) {
      const c = grid.get(cellOf(x, y));
      if (!c) return false;
      for (const i of c.polys) if (h < heights[i] + 0.5 && inPoly(x, y, polys[i])) return true;
      return false;
    },
    /** 밤: 창에 불 */
    setDark(dark: number) {
      for (const m of nightMats) m.emissiveIntensity = dark * 0.7;
    },
  };
}
