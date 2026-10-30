// @ts-nocheck
/*
 * 3D 광장 — 전북교육청 청사 앞 잔디마당에 업무 분류별 게르(몽골 천막)를 세우고,
 * 천막지기(교직원 캐릭터)에게 말을 걸면 그 업무의 도구를 홀로그램 카드로 띄움.
 * 좌표: site(x=동, y=북, m, 원점 본관 중심) → three(x, 높이, -y)
 */
import * as THREE from 'three';
import { makeHQ } from './hq';
import { animChibi, blob, makeChibi, toon, toonGrad, type Chibi } from './chibi';
import { makeLobby, type Lobby } from './lobby';

export interface PlazaTool {
  sid: string;
  title: string;
  tag: string; // 교직원 제작·교육청 배포·외부 공공
  who: string;
  what: string;
  run: string;
}
export interface PlazaTent {
  label: string;
  color: string;
  prop: string;
  tools: PlazaTool[];
}
export type Mode = 'auto' | 'day' | 'night';
export type Ev =
  | { type: 'ready' }
  | { type: 'near'; tent: number | 'desk' | null }
  | { type: 'talk'; tent: number | 'desk' | null }
  | { type: 'world'; world: 'out' | 'in' }
  | { type: 'focus'; rect: { x: number; y: number; w: number; h: number } | null; kind?: 'card' | 'book'; from?: { x: number; y: number; w: number; h: number } }
  | { type: 'page'; page: number; pages: number; cards: PlazaTool[] }
  | { type: 'hover'; tool: PlazaTool | null }
  | { type: 'select'; tool: PlazaTool | null; slot: number | null }
  | { type: 'clock'; text: string; night: boolean };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const W = (x: number, y: number, h = 0) => V(x, h, -y);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeBack = (t: number) => {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const C3 = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t));
const FONT = "'Plaza SUIT', 'SUIT Variable', 'Pretendard Variable', 'Noto Sans CJK KR', sans-serif";
const DISPLAY = "'Plaza Edu', 'Plaza SUIT', 'Noto Sans CJK KR', sans-serif";

/* ── 부지 배치 ── */
const LAT = 35.804403, LNG = 127.102486;
const MAIN = [[-42.6, -17.7], [-34.1, -33.0], [7.2, -10.1], [34.8, 10.7], [43.1, 21.2], [18.6, 23.0], [11.6, 15.0], [4.0, 8.1]];
const FRONT = [[7.2, -10.1], [9.5, -19.5], [19.5, -19.5], [52.0, -1.2], [44.0, 9.5], [34.8, 10.7]];
const ANNEX = [[-46, -63], [-17, -50], [0, -87], [-31, -101]];
const SITE = {
  plaza: [[-14, -28], [10, -12], [52, -1], [70, 2], [80, -12], [30, -44], [-6, -46]],
  parking: [[-46, -16], [4, 9], [18, 24], [46, 24], [42, 62], [-22, 56], [-62, 18]],
};
// 전면동 앞면 방향과 바깥 법선
const FA = [19.5, -19.5], FB = [52.0, -1.2];
const FL = Math.hypot(FB[0] - FA[0], FB[1] - FA[1]);
const FN = [(FB[1] - FA[1]) / FL, -(FB[0] - FA[0]) / FL]; // 남동쪽
const FM = [(FA[0] + FB[0]) / 2, (FA[1] + FB[1]) / 2];
// 천막 둥근 마당: 앞면에서 48m 앞 잔디마당
const RING_D = 48, R = 26;
const CS = [FM[0] + FN[0] * RING_D, FM[1] + FN[1] * RING_D];
// 게이트타워 바닥(대략)
const TOWER = (() => {
  const ang = Math.atan2(-1.2 - -19.5, 52.0 - 19.5), c = [47.5, 9.5], hw = 9.5, hd = 7.5;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  // three 회전(rotation.y=ang)은 site 좌표에서 시계 반대 → site 회전 각도는 ang
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [c[0] + x * ca + z * sa, c[1] + x * sa - z * ca]);
})();
const BLOCKS = [MAIN, FRONT, ANNEX, TOWER];

function inPoly(p: number[], poly: number[][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, rep = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const out: string[] = [];
  let line = '';
  const push = (s: string) => out.push(s);
  const words = text.split(/\s+/).filter(Boolean);
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width <= maxW) {
      line = test;
      continue;
    }
    if (line) push(line);
    line = '';
    // 한 낱말이 너무 길면 글자 단위로 자름
    let cur = '';
    for (const ch of w) {
      if (g.measureText(cur + ch).width > maxW) {
        push(cur);
        cur = ch;
      } else cur += ch;
    }
    line = cur;
  }
  if (line) push(line);
  if (out.length > maxLines) {
    const keep = out.slice(0, maxLines);
    let last = keep[maxLines - 1];
    while (last && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    keep[maxLines - 1] = last + '…';
    return keep;
  }
  return out;
}

/* ── 해 위치 (jbe-hq-3d-map 과 같은 계산) ── */
const kstNow = () => {
  const d = new Date(Date.now() + 9 * 3600e3);
  return { h: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600, doy: Math.floor((+d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5) };
};
function sunAt(h: number) {
  const doy = kstNow().doy, lat = (LAT * Math.PI) / 180;
  const dec = ((23.44 * Math.sin((2 * Math.PI * (284 + doy)) / 365)) * Math.PI) / 180;
  const solar = h + ((LNG - 135) * 4) / 60;
  const H = ((solar - 12) * 15 * Math.PI) / 180;
  const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) + Math.PI;
  return { el, az };
}

/* ── 캐릭터 생김새 — 천막마다 고정 ── */
const SKINS = ['#ffdcc4', '#f9d2b4', '#ffe3cf', '#f3c9a8'];
const HAIRS = ['#2b2320', '#3d2b22', '#5a3b28', '#1f1f28', '#6b4a33', '#2e2a3a'];
const STYLES = ['short', 'bob', 'pony', 'side', 'bun', 'curly'] as const;
const TOPS = ['#3a457f', '#4f8f5a', '#c0584a', '#2f6fb3', '#7a5ea8', '#b7863a', '#2fa39a', '#5b6575', '#d07a3a', '#3f6e8c'];
/** 도구 구분 표 색 — 목록 화면의 구분 표(SourceTag)와 같게 */
const TAG_COL: Record<string, { bg: string; fg: string; line?: string }> = {
  '교직원 제작': { bg: '#1f7ae0', fg: '#ffffff' },
  '교육청 배포': { bg: '#2f3a73', fg: '#ffffff', line: '#ffffff' },
  '외부 공공': { bg: '#0f9a72', fg: '#ffffff' },
};
const LINES_TONE = ['#2f6fb3', '#e8554e', '#3a457f', '#4f8f5a', null, null];

export function createPlaza(host: HTMLElement, tents: PlazaTent[], emit: (e: Ev) => void, opt: { quality: 'high' | 'low'; visited?: number[]; lobby: { tools: PlazaTool[]; popular: PlazaTool[]; fresh: PlazaTool[] } }) {
  const T = THREE;
  const high = opt.quality === 'high';
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!(window as any).__plazaShot });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const cv = renderer.domElement;
  cv.style.display = 'block';
  cv.style.width = '100%';
  cv.style.height = '100%';
  cv.style.touchAction = 'none';
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(50, 1, 0.3, 2400);
  scene.fog = new T.Fog('#dfeaf3', 110, 520);

  /* 빛 */
  const hemi = new T.HemisphereLight(0xeaf2ff, 0x8a8170, 1.6);
  const sun = new T.DirectionalLight(0xffffff, 2.3);
  const fill = new T.DirectionalLight(0xdfe8ff, 0.6);
  fill.position.set(-0.6, 0.5, -0.5);
  scene.add(hemi, sun, sun.target, fill);
  const SC = W((CS[0] + FM[0]) / 2, (CS[1] + FM[1]) / 2);
  if (high) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -78;
    s.right = 78;
    s.top = 78;
    s.bottom = -78;
    s.near = 1;
    s.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
  }

  /* 하늘 */
  const skyU = { top: { value: new T.Color('#7fb2e5') }, hor: { value: new T.Color('#dcebf7') } };
  const sky = new T.Mesh(
    new T.SphereGeometry(1500, 32, 16),
    new T.ShaderMaterial({
      uniforms: skyU,
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(hor, top, pow(h, 0.55)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);
  // 별
  const starG = new T.BufferGeometry();
  {
    const r = seeded(7), p: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const a = r() * Math.PI * 2, e = Math.asin(0.08 + r() * 0.92);
      p.push(Math.cos(a) * Math.cos(e) * 1400, Math.sin(e) * 1400, Math.sin(a) * Math.cos(e) * 1400);
    }
    starG.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  }
  const starM = new T.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  scene.add(new T.Points(starG, starM));
  // 달
  const moonM = new T.SpriteMaterial({
    map: canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,250,235,1)');
      gr.addColorStop(0.35, 'rgba(255,248,225,1)');
      gr.addColorStop(0.42, 'rgba(255,240,210,.35)');
      gr.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }, false),
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const moon = new T.Sprite(moonM);
  moon.scale.set(150, 150, 1);
  scene.add(moon);

  /* 땅 */
  const grassTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8fb767';
    g.fillRect(0, 0, w, h);
    const r = seeded(3);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(70,110,45,.18)' : 'rgba(190,220,140,.16)';
      g.fillRect(r() * w, r() * h, 2, 3 + r() * 3);
    }
  });
  const ground = new T.Mesh(new T.PlaneGeometry(2400, 2400), new T.MeshLambertMaterial({ map: grassTex }));
  grassTex.repeat.set(240, 240);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const flat = (poly: number[][], mat: THREE.Material, y: number, uvSize = 0) => {
    const s = new T.Shape();
    s.moveTo(poly[0][0], poly[0][1]);
    poly.slice(1).forEach((p) => s.lineTo(p[0], p[1]));
    const geo = new T.ShapeGeometry(s);
    if (uvSize) {
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / uvSize, pos.getY(i) / uvSize);
    }
    const o = new T.Mesh(geo, mat);
    o.rotation.x = -Math.PI / 2;
    o.position.y = y;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  };
  const paveTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d6cfc1';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,110,95,.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 32, 0);
      g.lineTo(i * 32, h);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * 32);
      g.lineTo(w, i * 32);
      g.stroke();
    }
  });
  const parkTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#6f747b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e9e4';
    for (let i = 0; i < 4; i++) g.fillRect(i * 32, 0, 2, h * 0.55);
    g.fillRect(0, h * 0.55, w, 2);
  });
  const pave = new T.MeshLambertMaterial({ map: paveTex });
  flat(SITE.plaza, pave, 0.04, 6);
  flat(SITE.parking, new T.MeshLambertMaterial({ map: parkTex }), 0.03, 10);
  // 둥근 천막 마당: 천막이 서는 고리길 + 가운데 원
  const stoneTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e4dccb';
    g.fillRect(0, 0, w, h);
    const r = seeded(11);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${150 + r() * 40},${135 + r() * 30},${110 + r() * 30},.10)`;
      const x = r() * w, y = r() * h, s = 18 + r() * 26;
      rr(g, x, y, s, s * (0.6 + r() * 0.5), 6);
      g.fill();
    }
  });
  stoneTex.repeat.set(1, 1);
  const ringPath = new T.Mesh(new T.RingGeometry(R - 5.2, R + 4.2, 96, 1), new T.MeshLambertMaterial({ map: stoneTex }));
  {
    const pos = ringPath.geometry.attributes.position, uv = ringPath.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 7, pos.getY(i) / 7);
  }
  ringPath.rotation.x = -Math.PI / 2;
  ringPath.position.copy(W(CS[0], CS[1], 0.05));
  ringPath.receiveShadow = true;
  scene.add(ringPath);
  const center = new T.Mesh(new T.CircleGeometry(6.5, 64), new T.MeshLambertMaterial({ map: stoneTex }));
  center.rotation.x = -Math.PI / 2;
  center.position.copy(W(CS[0], CS[1], 0.055));
  center.receiveShadow = true;
  scene.add(center);
  // 고리 테두리 무늬
  for (const rr0 of [R - 5.2, R + 4.2, 6.5]) {
    const e = new T.Mesh(new T.RingGeometry(rr0 - 0.18, rr0 + 0.18, 128), new T.MeshLambertMaterial({ color: '#b9a98c' }));
    e.rotation.x = -Math.PI / 2;
    e.position.copy(W(CS[0], CS[1], 0.07));
    scene.add(e);
  }
  // 청사 광장 → 천막 마당 길
  {
    const a = [FM[0] + FN[0] * 14, FM[1] + FN[1] * 14], b = [CS[0] - FN[0] * (R - 3), CS[1] - FN[1] * (R - 3)];
    const px = -FN[1], py = FN[0], hw = 3.2;
    flat([[a[0] + px * hw, a[1] + py * hw], [b[0] + px * hw, b[1] + py * hw], [b[0] - px * hw, b[1] - py * hw], [a[0] - px * hw, a[1] - py * hw]], new T.MeshLambertMaterial({ map: stoneTex }), 0.045, 7);
    // 가운데로 이어지는 짧은 길
    const c = [CS[0] - FN[0] * 6, CS[1] - FN[1] * 6];
    flat([[b[0] + px * 2.4, b[1] + py * 2.4], [c[0] + px * 2.4, c[1] + py * 2.4], [c[0] - px * 2.4, c[1] - py * 2.4], [b[0] - px * 2.4, b[1] - py * 2.4]], new T.MeshLambertMaterial({ map: stoneTex }), 0.046, 7);
  }

  /* 청사 */
  const NIGHT_MATS: [THREE.MeshStandardMaterial, number][] = [];
  const hqStart = scene.children.length;
  const HQ = makeHQ(T, scene, NIGHT_MATS);
  const ENT = HQ.ENT;
  const BLOCK_NOW = [HQ.MAIN, FRONT, ANNEX, TOWER];
  let world: 'out' | 'in' = 'out';
  let lobby: Lobby | null = null;
  // 정문 앞(바깥) 한 점과 차양 기둥
  const doorSite = [ENT.door[0] + ENT.nrm[0] * 0.4, ENT.door[1] + ENT.nrm[1] * 0.4];
  const doorPt = W(doorSite[0], doorSite[1]);
  const canopyCols = [-1, 1].map((s2) => W(ENT.q[0] + ENT.tan[0] * s2 * 5 + ENT.nrm[0] * 6.4, ENT.q[1] + ENT.tan[1] * s2 * 5 + ENT.nrm[1] * 6.4));
  for (const o of scene.children.slice(hqStart)) o.traverse((m) => m.isMesh && ((m.castShadow = true), (m.receiveShadow = true)));

  /* 나무 */
  {
    const r = seeded(29);
    const spots: number[][] = [];
    const ok = (p: number[]) => {
      if (BLOCKS.some((b) => inPoly(p, b)) || inPoly(p, SITE.plaza) || inPoly(p, SITE.parking)) return false;
      const d = Math.hypot(p[0] - CS[0], p[1] - CS[1]);
      if (d < R + 7.5) return false;
      // 청사 앞 길·마당 입구는 비움
      const ux = p[0] - FM[0], uy = p[1] - FM[1], along = ux * FN[0] + uy * FN[1], side = Math.abs(-ux * FN[1] + uy * FN[0]);
      if (along > 0 && along < RING_D && side < 9) return false;
      return spots.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 5.5);
    };
    for (let i = 0; i < 2600 && spots.length < 190; i++) {
      const a = r() * Math.PI * 2, d = 34 + Math.pow(r(), 0.8) * 110;
      const p = [CS[0] - 20 + Math.cos(a) * d, CS[1] + 18 + Math.sin(a) * d];
      if (ok(p)) spots.push(p);
    }
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.18, 0.26, 2.2, 6), toon('#7a5a3c'), spots.length);
    const crowns = ['#5f9a4a', '#4f8a43', '#76a85a'].map((c) => new T.InstancedMesh(new T.IcosahedronGeometry(1.9, 0), new T.MeshLambertMaterial({ color: c, flatShading: true }), spots.length));
    const mtx = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3();
    const cnt = [0, 0, 0];
    spots.forEach((p, i) => {
      const k = 0.8 + r() * 0.6;
      mtx.compose(W(p[0], p[1], 1.1 * k), q, s.set(k, k, k));
      trunk.setMatrixAt(i, mtx);
      const ci = Math.floor(r() * 3);
      q.setFromEuler(new T.Euler(r(), r() * 6, r()));
      mtx.compose(W(p[0], p[1], 2.2 * k + 1.3 * k), q, s.set(k * (1 + r() * 0.2), k * (1.15 + r() * 0.3), k * (1 + r() * 0.2)));
      crowns[ci].setMatrixAt(cnt[ci]++, mtx);
      q.identity();
    });
    crowns.forEach((c, i) => {
      c.count = cnt[i];
      c.castShadow = true;
      scene.add(c);
    });
    trunk.castShadow = true;
    scene.add(trunk);
  }

  /* 천막(행사용 고깔 천막) */
  const N = tents.length;
  const gapDir = Math.atan2(-FN[1], -FN[0]);
  const fullArc = Math.PI * 2 - (2 * 46 * Math.PI) / 180;
  const arc = Math.min(fullArc, N > 1 ? ((N - 1) * 8.4) / R : 0);
  const a0 = gapDir + Math.PI - arc / 2;
  const bandTex = (col: string) =>
    canvasTex(512, 64, (g, w, h) => {
      g.fillStyle = col;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.85)';
      g.lineWidth = 5;
      g.beginPath();
      for (let x = 0; x <= w; x += 32) {
        g.moveTo(x, h * 0.25);
        g.lineTo(x + 16, h * 0.75);
        g.lineTo(x + 32, h * 0.25);
      }
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.fillRect(0, 2, w, 3);
      g.fillRect(0, h - 5, w, 3);
    });
  const roofTex = (col: string) =>
    canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#fbf8f1';
      g.fillRect(0, 0, w, h);
      g.fillStyle = col;
      for (let i = 0; i < 16; i += 2) g.fillRect((i / 16) * w + w / 64, 0, w / 32, h);
      g.fillRect(0, h * 0.86, w, h * 0.14);
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.fillRect(0, h * 0.885, w, 3);
    });
  const labelTex = (txt: string, col: string) =>
    canvasTex(640, 150, (g, w, h) => {
      g.font = `400 70px ${DISPLAY}`;
      const tw = Math.min(w - 40, g.measureText(txt).width + 120);
      const x = (w - tw) / 2;
      g.fillStyle = 'rgba(20,30,60,.82)';
      rr(g, x, 18, tw, h - 36, (h - 36) / 2);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.arc(x + 48, h / 2, 16, 0, 7);
      g.fill();
      g.fillStyle = '#ffffff';
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillText(txt, x + 78, h / 2 + 4, tw - 100);
    }, false);
  const signTex = (txt: string, col: string) =>
    canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#7a5a3c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff7e8';
      rr(g, 14, 14, w - 28, h - 28, 18);
      g.fill();
      g.fillStyle = col;
      g.fillRect(14, 14, w - 28, 40);
      g.fillStyle = '#1e2430';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let fs = 76;
      g.font = `400 ${fs}px ${DISPLAY}`;
      while (g.measureText(txt).width > w - 70 && fs > 30) g.font = `400 ${(fs -= 4)}px ${DISPLAY}`;
      g.fillText(txt, w / 2, h / 2 + 22);
    }, false);

  // 밤에 바뀌는 재질 모음
  const tentGlow: THREE.MeshToonMaterial[] = [];
  const doorGlow: THREE.MeshBasicMaterial[] = [];
  const bulbs: THREE.MeshBasicMaterial[] = [];
  const pools: THREE.MeshBasicMaterial[] = [];
  const signs: THREE.MeshBasicMaterial[] = [];
  const poolTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,200,130,.9)');
    gr.addColorStop(0.45, 'rgba(255,180,100,.35)');
    gr.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }, false);
  const pool = (p: THREE.Vector3, r: number, op = 1) => {
    const m = new T.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    m.userData.k = op;
    const o = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), m);
    o.rotation.x = -Math.PI / 2;
    o.position.copy(p).setY(0.09);
    o.renderOrder = 2;
    scene.add(o);
    pools.push(m);
  };

  interface TentObj {
    pos: THREE.Vector3;
    f: THREE.Vector3; // 문 → 마당 가운데 방향
    r: THREE.Vector3; // 마당에서 천막을 볼 때 오른쪽
    npc: Chibi;
    npcPos: THREE.Vector3;
    npcYaw: number;
    hit: THREE.Object3D[];
    mark: THREE.Sprite;
    label: THREE.Sprite;
    visited: boolean;
  }
  const TENTS: TentObj[] = [];
  const hitList: THREE.Object3D[] = [];
  // 행사용 고깔 천막(흔히 '몽골텐트') — 정사각 바닥, 은색 기둥, 뾰족한 흰 지붕, 흰 벽 + 아래 색 띠, 앞은 열림
  const S = 2.5, EH = 2.3, RH2 = 2.5; // 반폭, 처마 높이, 지붕 높이
  const RW = S; // 다른 곳(꼬마전구 등)에서 쓰는 천막 반폭
  const WH = EH;
  const canvasWall = (col: string) =>
    canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#fbfbf8';
      g.fillRect(0, 0, w, h);
      // 천 주름
      for (let x = 0; x < w; x += 32) {
        const gr = g.createLinearGradient(x, 0, x + 32, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(0.5, 'rgba(120,120,110,.08)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x, 0, 32, h);
      }
      g.fillStyle = col;
      g.fillRect(0, h * 0.82, w, h * 0.18);
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillRect(0, h * 0.82, w, 3);
    }, false);
  const roofGeo = (() => {
    // 네모 뿔 지붕 — 처마에서는 완만, 꼭대기로 갈수록 가파른 오목한 곡면(파고다)
    const pts: THREE.Vector2[] = [];
    const n = 14;
    for (let k = 0; k <= n; k++) {
      const v = k / n;
      const rad = (S + 0.12) * Math.SQRT2 * (1 - v) + 0.05 * v;
      pts.push(new T.Vector2(rad, EH + RH2 * Math.pow(v, 2.1)));
    }
    pts.reverse();
    const g0 = new T.LatheGeometry(pts, 4, Math.PI / 4).toNonIndexed();
    g0.computeVertexNormals();
    return g0;
  })();
  const poleM = new T.MeshStandardMaterial({ color: '#d7dbe0', metalness: 0.7, roughness: 0.3 });
  tents.forEach((tc, i) => {
    const ang = N > 1 ? a0 + (arc * i) / (N - 1) : a0;
    const sx = CS[0] + Math.cos(ang) * R, sy = CS[1] + Math.sin(ang) * R;
    const pos = W(sx, sy);
    const f = W(CS[0] - sx, CS[1] - sy).normalize();
    const rr2 = new T.Vector3().crossVectors(f.clone().negate(), V(0, 1, 0)).normalize();
    const g = new T.Group();
    g.position.copy(pos);
    g.rotation.y = Math.atan2(f.x, f.z);
    scene.add(g);
    const col = tc.color;
    const wt = canvasWall(col);
    // 벽: 뒤·왼쪽·오른쪽 (앞은 열어 둠). 밤에는 안쪽 불빛이 천에 비침
    const wallM = new T.MeshToonMaterial({ color: '#ffffff', map: wt, gradientMap: toonGrad(), emissive: '#ffe2b8', emissiveMap: wt, emissiveIntensity: 0, side: T.DoubleSide });
    wallM.userData.glowK = 0.7;
    tentGlow.push(wallM);
    const wall = new T.Group();
    for (const [x, z, ry] of [[0, -S, 0], [-S, 0, Math.PI / 2], [S, 0, -Math.PI / 2]] as const) {
      const pl = new T.Mesh(new T.PlaneGeometry(S * 2, EH - 0.05), wallM);
      pl.position.set(x, (EH - 0.05) / 2, z);
      pl.rotation.y = ry;
      pl.castShadow = pl.receiveShadow = true;
      wall.add(pl);
    }
    g.add(wall);
    // 앞 양옆: 걷어 묶은 천
    for (const sd of [-1, 1]) {
      const fold = new T.Mesh(new T.CylinderGeometry(0.16, 0.22, EH - 0.1, 10), wallM);
      fold.position.set(sd * (S - 0.2), (EH - 0.1) / 2, S - 0.08);
      g.add(fold);
      const tie = new T.Mesh(new T.TorusGeometry(0.2, 0.025, 6, 16), toon(col));
      tie.rotation.x = Math.PI / 2;
      tie.position.set(sd * (S - 0.2), 1.2, S - 0.08);
      g.add(tie);
    }
    // 기둥 4개
    for (const [x, z] of [[-S, -S], [S, -S], [S, S], [-S, S]]) {
      const pl = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, EH, 8), poleM);
      pl.position.set(x, EH / 2, z);
      pl.castShadow = true;
      g.add(pl);
      const foot = new T.Mesh(new T.BoxGeometry(0.28, 0.12, 0.28), toon('#3b3f46'));
      foot.position.set(x, 0.06, z);
      g.add(foot);
    }
    // 지붕
    const roofM = new T.MeshToonMaterial({ color: '#fdfdfb', gradientMap: toonGrad(), side: T.DoubleSide, emissive: '#ffe2b8', emissiveIntensity: 0 });
    roofM.userData.glowK = 0.35;
    tentGlow.push(roofM);
    const roof = new T.Mesh(roofGeo, roofM);
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    const tip = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), poleM);
    tip.position.y = EH + RH2 + 0.05;
    g.add(tip);
    const rod = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.45, 6), poleM);
    rod.position.y = EH + RH2 + 0.25;
    g.add(rod);
    // 처마 가림막(빙 둘러 내린 천) + 색 줄
    const valT = canvasTex(512, 64, (g2, w, h) => {
      g2.fillStyle = '#fbfbf8';
      g2.fillRect(0, 0, w, h);
      g2.fillStyle = col;
      g2.fillRect(0, h - 12, w, 12);
    }, false);
    const valM = new T.MeshToonMaterial({ map: valT, gradientMap: toonGrad(), side: T.DoubleSide, emissive: '#ffe2b8', emissiveMap: valT, emissiveIntensity: 0 });
    valM.userData.glowK = 0.4;
    tentGlow.push(valM);
    for (const [x, z, ry] of [[0, -S - 0.12, 0], [-S - 0.12, 0, Math.PI / 2], [S + 0.12, 0, -Math.PI / 2]] as const) {
      const v = new T.Mesh(new T.PlaneGeometry(S * 2 + 0.24, 0.34), valM);
      v.position.set(x, EH - 0.15, z);
      v.rotation.y = ry;
      g.add(v);
    }
    // 앞 처마: 업무 이름 현수막
    const banT = canvasTex(1024, 128, (g2, w, h) => {
      g2.fillStyle = '#fbfbf8';
      g2.fillRect(0, 0, w, h);
      g2.fillStyle = col;
      g2.fillRect(0, h - 16, w, 16);
      g2.fillRect(0, 0, w, 6);
      g2.fillStyle = '#1e2430';
      g2.textAlign = 'center';
      g2.textBaseline = 'middle';
      let fs = 74;
      g2.font = `400 ${fs}px ${DISPLAY}`;
      while (g2.measureText(tc.label).width > w - 80 && fs > 30) g2.font = `400 ${(fs -= 4)}px ${DISPLAY}`;
      g2.fillText(tc.label, w / 2, h / 2 - 2);
    }, false);
    const banM = new T.MeshBasicMaterial({ map: banT, toneMapped: false, side: T.DoubleSide });
    signs.push(banM);
    const ban = new T.Mesh(new T.PlaneGeometry(S * 2 + 0.24, 0.62), banM);
    ban.position.set(0, EH - 0.29, S + 0.12);
    g.add(ban);
    // 안쪽: 흰 천 씌운 탁자
    const table = new T.Mesh(new T.BoxGeometry(2.2, 0.76, 0.7), toon('#ffffff'));
    table.position.set(0, 0.38, -S + 0.8);
    g.add(table);
    const skirt = new T.Mesh(new T.BoxGeometry(2.22, 0.18, 0.72), toon(col));
    skirt.position.set(0, 0.62, -S + 0.8);
    g.add(skirt);
    // 바닥 깔개
    const mat = new T.Mesh(new T.PlaneGeometry(S * 2 - 0.2, S * 2 - 0.2), toon('#e9e2d2'));
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.07;
    g.add(mat);
    const dz = S;
    // 천막 위 이름표
    const label = new T.Sprite(new T.SpriteMaterial({ map: labelTex(tc.label, col), transparent: true, depthWrite: false, toneMapped: false }));
    label.scale.set(4.6, 1.08, 1);
    label.position.copy(pos).setY(EH + RH2 + 1.0);
    label.renderOrder = 5;
    scene.add(label);
    // 밤 불빛
    pool(pos.clone().add(f.clone().multiplyScalar(dz + 1.2)), 2.6, 0.9);
    // 천막지기
    const r = seeded(101 + i * 17);
    const style = STYLES[i % STYLES.length];
    const npc = makeChibi({
      skin: SKINS[Math.floor(r() * SKINS.length)],
      hair: HAIRS[i % HAIRS.length],
      style,
      top: tc.prop === 'ladle' ? '#ffffff' : TOPS[i % TOPS.length],
      inner: tc.prop === 'ladle' ? '#ffffff' : ['#ffffff', '#f3efe6', '#e8f1fb'][i % 3],
      pants: ['#3b4256', '#4a4f5c', '#5b4a3c', '#2f3442'][i % 4],
      tie: tc.prop === 'ladle' ? null : LINES_TONE[(i * 5) % LINES_TONE.length],
      glasses: i % 3 === 1,
      prop: tc.prop,
      hat: tc.prop === 'ladle' ? 'chef' : null,
    });
    const npcPos = pos.clone().add(f.clone().multiplyScalar(dz + 0.9)).add(rr2.clone().multiplyScalar(0.95));
    npc.root.position.copy(npcPos);
    const npcYaw = Math.atan2(f.x, f.z);
    npc.root.rotation.y = npcYaw;
    scene.add(npc.root);
    // 머리 위 느낌표(아직 안 들른 천막)
    const mark = new T.Sprite(
      new T.SpriteMaterial({
        map: canvasTex(128, 128, (g2) => {
          g2.fillStyle = '#ffcf33';
          g2.beginPath();
          g2.arc(64, 58, 46, 0, 7);
          g2.fill();
          g2.beginPath();
          g2.moveTo(52, 98);
          g2.lineTo(64, 122);
          g2.lineTo(76, 98);
          g2.fill();
          g2.strokeStyle = '#ffffff';
          g2.lineWidth = 6;
          g2.beginPath();
          g2.arc(64, 58, 46, 0, 7);
          g2.stroke();
          g2.fillStyle = '#3a2a00';
          g2.font = `900 64px ${FONT}`;
          g2.textAlign = 'center';
          g2.textBaseline = 'middle';
          g2.fillText('!', 64, 62);
        }, false),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mark.scale.set(0.5, 0.5, 1);
    mark.renderOrder = 6;
    scene.add(mark);
    const hit = [wall, roof, npc.root];
    hit.forEach((o) => o.traverse((m) => (m.userData.tent = i)));
    hitList.push(...hit);
    TENTS.push({ pos, f, r: rr2, npc, npcPos, npcYaw, hit, mark, label, visited: Boolean(opt.visited?.includes(i)) });
  });

  /* 꼬마전구 줄 — 이웃한 천막 지붕 끝을 잇는 고리 */
  {
    const pts: THREE.Vector3[] = [];
    const lineM = new T.LineBasicMaterial({ color: '#5a4636' });
    const BCOL = ['#ffd36b', '#ff8b6b', '#8be0ff', '#b7ff8b', '#ffb3e6'];
    const eave = (t: TentObj, side: number) => t.pos.clone().add(t.r.clone().multiplyScalar(side * (RW + 0.1))).add(t.f.clone().multiplyScalar(RW)).setY(WH - 0.05);
    for (let k = 0; k < TENTS.length - 1; k++) {
      const a = eave(TENTS[k], 1), b = eave(TENTS[k + 1], -1);
      // 천막 순서와 r 방향이 반대일 수 있어 가까운 끝끼리 이음
      const a2 = eave(TENTS[k], -1), b2 = eave(TENTS[k + 1], 1);
      const [A, B] = a.distanceTo(b) < a2.distanceTo(b2) ? [a, b] : [a2, b2];
      const curve: THREE.Vector3[] = [];
      for (let n = 0; n <= 16; n++) {
        const u = n / 16;
        const p = A.clone().lerp(B, u);
        p.y -= Math.sin(u * Math.PI) * 0.55;
        curve.push(p);
        if (n % 2 === 1) pts.push(p.clone().add(V(0, -0.08, 0)));
      }
      scene.add(new T.Line(new T.BufferGeometry().setFromPoints(curve), lineM));
    }
    const bulbM = BCOL.map((c) => {
      const m = new T.MeshBasicMaterial({ color: c, toneMapped: false });
      m.userData.base = new T.Color(c);
      bulbs.push(m);
      return m;
    });
    const geo = new T.SphereGeometry(0.075, 8, 6);
    const inst = bulbM.map((m) => new T.InstancedMesh(geo, m, Math.max(1, Math.ceil(pts.length / BCOL.length))));
    const mtx = new T.Matrix4();
    const cnt = bulbM.map(() => 0);
    pts.forEach((p, n) => {
      const k = n % BCOL.length;
      mtx.makeTranslation(p.x, p.y, p.z);
      inst[k].setMatrixAt(cnt[k]++, mtx);
    });
    inst.forEach((im, k) => {
      im.count = cnt[k];
      scene.add(im);
    });
    pool(W(CS[0], CS[1]), 7, 0.5);
  }

  /* 가로등 */
  {
    const spots: THREE.Vector3[] = [];
    for (let k = 0; k < 14; k++) {
      const ang = gapDir + Math.PI * 0.12 + (k / 13) * Math.PI * 1.76;
      spots.push(W(CS[0] + Math.cos(ang) * (R + 5.6), CS[1] + Math.sin(ang) * (R + 5.6)));
    }
    const px = -FN[1], py = FN[0];
    for (let d = 16; d < RING_D - R; d += 9)
      for (const s of [-1, 1]) spots.push(W(FM[0] + FN[0] * d + px * s * 4.6, FM[1] + FN[1] * d + py * s * 4.6));
    const poleM = toon('#3b4256');
    spots.forEach((p) => {
      const pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 4.2, 8), poleM);
      pole.position.copy(p).setY(2.1);
      pole.castShadow = true;
      scene.add(pole);
      const head = new T.Mesh(new T.SphereGeometry(0.26, 14, 10), (() => {
        const m = new T.MeshBasicMaterial({ color: '#fff2d6', toneMapped: false });
        m.userData.base = new T.Color('#fff2d6');
        bulbs.push(m);
        return m;
      })());
      head.position.copy(p).setY(4.35);
      scene.add(head);
      pool(p, 4.2, 1);
    });
  }

  /* 나(플레이어) */
  const me = makeChibi({ skin: '#ffe0c8', hair: '#2b2320', style: 'short', top: '#2fa39a', inner: '#ffffff', pants: '#3b4256', tie: null, hat: 'cap', capColor: '#1c64ac' });
  scene.add(me.root);
  // 밤에 캐릭터가 까맣게 묻히지 않게 — 제 색으로 살짝 밝힘
  const charMats = new Set<THREE.MeshToonMaterial>();
  [me.root, ...TENTS.map((t) => t.npc.root)].forEach((r) =>
    r.traverse((o) => {
      const m = o.material;
      if (m && m.isMeshToonMaterial && !m.emissiveMap && !m.map && m.emissive && m.emissive.getHex() === 0) {
        m.emissive.copy(m.color);
        charMats.add(m);
      }
    }),
  );
  const meRing = new T.Mesh(
    new T.RingGeometry(0.46, 0.56, 32),
    new T.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
  );
  meRing.rotation.x = -Math.PI / 2;
  meRing.renderOrder = 3;
  scene.add(meRing);
  // 클릭한 곳 표시
  const pin = new T.Mesh(new T.RingGeometry(0.25, 0.38, 24), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
  pin.rotation.x = -Math.PI / 2;
  scene.add(pin);

  const start = W(CS[0] - FN[0] * 4, CS[1] - FN[1] * 4);
  const P = { pos: start.clone(), yaw: Math.atan2(-FN[0], FN[1]), speed: 0, target: null as THREE.Vector3 | null, goTalk: -1, goDoor: false };
  // 플레이어가 청사를 보도록: three 앞쪽(+z)이 향할 방향 = 청사 쪽(-FN) → world(-FN0, 0, FN1)
  P.yaw = Math.atan2(-FN[0], FN[1]);

  /* 카메라 */
  const narrow = host.clientWidth < host.clientHeight;
  // 세로 화면은 좌우가 좁아 청사 쪽을 보면 천막이 안 보임 → 마당 안쪽(천막들)을 보며 시작
  if (narrow) P.yaw = Math.atan2(FN[0], -FN[1]);
  const cam = {
    yaw: P.yaw + Math.PI, // 카메라는 플레이어 뒤
    pitch: narrow ? 0.5 : 0.42,
    dist: narrow ? 15 : 13,
    pos: V(),
    look: V(),
    mode: 'intro' as 'intro' | 'follow' | 'talk' | 'holo',
    t: 0,
    from: { pos: V(), look: V() },
    to: { pos: V(), look: V() },
  };
  const followPose = (out = { pos: V(), look: V() }) => {
    const look = P.pos.clone().add(V(0, 1.4, 0));
    const d = cam.dist;
    out.pos.set(look.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, look.y + Math.sin(cam.pitch) * d, look.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
    out.look.copy(look);
    if (world === 'in' && lobby) {
      const b = lobby.camBox;
      out.pos.x = clamp(out.pos.x, b.x0, b.x1);
      out.pos.z = clamp(out.pos.z, b.z0, b.z1);
      out.pos.y = clamp(out.pos.y, 0.6, b.y1);
    }
    return out;
  };
  // 시작 연출: 마당 뒤쪽 하늘에서 청사를 바라보며 내려옴
  cam.from.pos.copy(W(CS[0] + FN[0] * 48, CS[1] + FN[1] * 48, 46));
  cam.from.look.copy(W(FM[0], FM[1], 12));
  cam.pos.copy(cam.from.pos);
  cam.look.copy(cam.from.look);

  /* 홀로그램 */
  const CW = 1.5, CH = 0.94, GAP = 0.14;
  const holoU = { time: { value: 0 } };
  const cardVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  const cardFS = `
    uniform sampler2D map; uniform float time; uniform float appear; uniform float hover; uniform float sel; uniform float dim; uniform float gone; varying vec2 vUv;
    void main(){
      float edge = appear * 1.12;
      if (vUv.y > edge) discard;
      vec4 c = texture2D(map, vUv);
      float scan = 0.9 + 0.1 * sin(vUv.y * 260.0 - time * 5.0);
      c.rgb *= scan;
      float sweep = smoothstep(0.035, 0.0, abs(vUv.y - fract(time * 0.28 + 0.13)));
      c.rgb += vec3(0.25, 0.75, 1.0) * sweep * 0.22 * c.a;
      float rim = smoothstep(0.08, 0.0, edge - vUv.y) * (1.0 - step(1.0, appear));
      c.rgb += vec3(0.6, 0.95, 1.0) * rim; c.a = max(c.a, rim * 0.9);
      c.rgb *= 1.0 + hover * 0.35 + sel * 0.25;
      float fl = appear < 1.0 ? 0.75 + 0.25 * step(0.4, fract(sin(time * 61.0) * 4375.5)) : 1.0;
      gl_FragColor = vec4(c.rgb, c.a * fl * min(1.0, appear * 1.6) * (1.0 - dim) * (1.0 - gone));
      #include <colorspace_fragment>
    }`;
  const cards = Array.from({ length: 6 }, (_, k) => {
    const cvs = document.createElement('canvas');
    cvs.width = 800;
    cvs.height = 500;
    const tex = new T.CanvasTexture(cvs);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new T.ShaderMaterial({
      uniforms: { map: { value: tex }, time: holoU.time, appear: { value: 0 }, hover: { value: 0 }, sel: { value: 0 }, dim: { value: 0 }, gone: { value: 0 } },
      vertexShader: cardVS,
      fragmentShader: cardFS,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      toneMapped: false,
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(CW, CH), mat);
    mesh.visible = false;
    mesh.renderOrder = 10;
    mesh.userData.card = k;
    scene.add(mesh);
    return { mesh, cvs, tex, mat, tool: null as PlazaTool | null, from: V(), to: V(), q: new T.Quaternion(), t0: 0, hide: 0, hover: 0, fk: 0 };
  });
  const drawCard = (c, tool: PlazaTool, col: string) => {
    const g = c.cvs.getContext('2d')!;
    const w = 800, h = 500;
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, 'rgba(14,64,130,.82)');
    gr.addColorStop(1, 'rgba(6,28,70,.78)');
    rr(g, 8, 8, w - 16, h - 16, 30);
    g.fillStyle = gr;
    g.fill();
    // 격자 무늬
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(120,210,255,.07)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 26) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y < h; y += 26) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.restore();
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(120,220,255,.85)';
    rr(g, 8, 8, w - 16, h - 16, 30);
    g.stroke();
    // 모서리 꺾쇠
    g.strokeStyle = '#bff3ff';
    g.lineWidth = 7;
    const L = 46;
    for (const [x, y, sx, sy] of [[22, 22, 1, 1], [w - 22, 22, -1, 1], [22, h - 22, 1, -1], [w - 22, h - 22, -1, -1]]) {
      g.beginPath();
      g.moveTo(x, y + sy * L);
      g.lineTo(x, y);
      g.lineTo(x + sx * L, y);
      g.stroke();
    }
    // 구분 표 + 실행 방식
    g.font = `700 28px ${FONT}`;
    const tw = g.measureText(tool.tag).width + 34;
    const tc = TAG_COL[tool.tag] ?? { bg: col, fg: '#ffffff' };
    g.fillStyle = tc.bg;
    rr(g, 52, 52, tw, 46, 23);
    g.fill();
    if (tc.line) {
      g.strokeStyle = tc.line;
      g.lineWidth = 2.5;
      g.stroke();
    }
    g.fillStyle = tc.fg;
    g.textBaseline = 'middle';
    g.fillText(tool.tag, 69, 76);
    if (tool.run) {
      g.font = `600 26px ${FONT}`;
      g.fillStyle = 'rgba(170,230,255,.9)';
      g.textAlign = 'right';
      g.fillText(tool.run, w - 56, 76);
      g.textAlign = 'left';
    }
    // 이름
    g.font = `800 46px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(80,200,255,.8)';
    g.shadowBlur = 14;
    const tl = wrap(g, tool.title, w - 110, 2);
    tl.forEach((s, i) => g.fillText(s, 54, 152 + i * 58));
    g.shadowBlur = 0;
    // 한 줄 소개
    g.font = `500 29px ${FONT}`;
    g.fillStyle = 'rgba(200,238,255,.92)';
    const wl = wrap(g, tool.what || '아직 게시글 요약이 없습니다.', w - 110, 2);
    const y0 = 152 + tl.length * 58 + 22;
    wl.forEach((s, i) => g.fillText(s, 54, y0 + i * 40));
    // 아래 줄
    g.strokeStyle = 'rgba(120,220,255,.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(54, h - 92);
    g.lineTo(w - 54, h - 92);
    g.stroke();
    g.font = `600 26px ${FONT}`;
    g.fillStyle = 'rgba(170,230,255,.85)';
    g.fillText(tool.who, 54, h - 56, w - 330);
    g.textAlign = 'right';
    g.fillStyle = '#ffffff';
    g.font = `800 28px ${FONT}`;
    g.fillText('눌러서 보기 ▸', w - 56, h - 56);
    g.textAlign = 'left';
    c.tex.needsUpdate = true;
  };
  // 영사기(바닥 원판 + 빛기둥)
  const padTex = canvasTex(256, 256, (g) => {
    g.translate(128, 128);
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = `rgba(110,225,255,${0.9 - i * 0.18})`;
      g.lineWidth = 6 - i;
      g.beginPath();
      g.arc(0, 0, 118 - i * 24, i * 0.8, i * 0.8 + Math.PI * (1.2 + i * 0.15));
      g.stroke();
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60);
    gr.addColorStop(0, 'rgba(180,245,255,.95)');
    gr.addColorStop(1, 'rgba(80,200,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 60, 0, 7);
    g.fill();
  }, false);
  const pad = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), new T.MeshBasicMaterial({ map: padTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pad.rotation.x = -Math.PI / 2;
  pad.renderOrder = 4;
  scene.add(pad);
  const beamGeo = new T.BufferGeometry();
  beamGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(12 * 3), 3));
  beamGeo.setAttribute('k', new T.Float32BufferAttribute([0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1], 1));
  const beamM = new T.ShaderMaterial({
    uniforms: { op: { value: 0 }, time: holoU.time },
    vertexShader: 'attribute float k; varying float vK; void main(){ vK = k; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float op; uniform float time; varying float vK; void main(){ float a = (1.0 - vK) * 0.55 + 0.05; a *= 0.85 + 0.15 * sin(time * 9.0 + vK * 20.0); gl_FragColor = vec4(vec3(0.45, 0.85, 1.0) * a * op, 1.0); }',
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const beam = new T.Mesh(beamGeo, beamM);
  beam.frustumCulled = false;
  beam.renderOrder = 9;
  scene.add(beam);
  // 빛 알갱이
  const SPK = 90;
  const spkG = new T.BufferGeometry();
  spkG.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(SPK * 3), 3));
  const spkM = new T.PointsMaterial({ color: '#bff3ff', size: 0.07, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
  const spk = new T.Points(spkG, spkM);
  spk.frustumCulled = false;
  scene.add(spk);
  const spkSeed = Array.from({ length: SPK }, () => [Math.random(), Math.random(), Math.random()]);

  const holo = {
    tent: -1,
    anchor: null as null | { npc: Chibi; npcPos: THREE.Vector3; f: THREE.Vector3; r: THREE.Vector3 },
    list: [] as PlazaTool[],
    color: '#3a457f',
    front: 1.2,
    page: 0,
    cols: 3,
    rows: 2,
    on: false,
    apex: V(),
    corners: [V(), V(), V(), V()],
    camPos: V(),
    camLook: V(),
    beam: 0,
    sel: -1,
  };

  /* 낮·밤 */
  let mode: Mode = 'auto';
  let hourShown = kstNow().h;
  let hourFrom = hourShown, hourTo = hourShown, hourT = 1;
  const hourOf = (m: Mode) => (m === 'day' ? 13.5 : m === 'night' ? 21.2 : kstNow().h);
  let lastClockText = '';
  const lastSky = new T.Color('#9cc3e6');
  let lastDark = 0;
  function applyHour(h: number) {
    const { el, az } = sunAt(h);
    const elD = (el * 180) / Math.PI;
    const day = sstep(-6, 8, elD), warm = sstep(18, 2, elD) * sstep(-7, 1, elD), night = 1 - day;
    const d = V(Math.sin(az) * Math.cos(el), Math.max(Math.sin(el), 0.08), -Math.cos(az) * Math.cos(el)).normalize();
    sun.position.copy(SC).add(d.clone().multiplyScalar(160));
    sun.target.position.copy(SC);
    sun.intensity = 2.5 * sstep(-2, 12, elD);
    sun.color.copy(C3('#ffffff', '#ffa45c', warm));
    hemi.intensity = 0.42 + 1.3 * day;
    hemi.color.copy(C3('#3a4a7e', '#eaf2ff', day));
    hemi.groundColor.copy(C3('#1a1d26', '#8a8170', day));
    fill.intensity = 0.6 * day + 0.55 * night;
    fill.color.copy(C3('#8fa6ff', '#dfe8ff', day));
    const top = C3(C3('#0a1430', '#3f5a96', sstep(-14, -4, elD)), '#6fa7e0', sstep(0, 14, elD));
    const hor = C3(C3('#1d2a4c', '#f0a06a', sstep(-12, -3, elD)), '#d7e8f6', sstep(2, 16, elD));
    skyU.top.value.copy(top);
    skyU.hor.value.copy(hor);
    scene.fog.color.copy(hor);
    starM.opacity = sstep(-2, -10, elD) * 0.9;
    moonM.opacity = sstep(-2, -10, elD);
    moon.position.copy(SC).add(V(Math.sin(2.4) * 0.7, 0.55, -Math.cos(2.4) * 0.7).normalize().multiplyScalar(1300));
    const dark = sstep(4, -4, elD);
    const LH = [[0, 0.45], [2, 0.25], [5, 0.15], [6, 0.3], [7, 0.5], [17, 1], [21, 1], [23, 0.6], [24, 0.45]];
    let lr = 1;
    for (let i = 0; i < LH.length - 1; i++)
      if (h >= LH[i][0] && h < LH[i + 1][0]) {
        const t = (h - LH[i][0]) / (LH[i + 1][0] - LH[i][0]);
        lr = LH[i][1] + (LH[i + 1][1] - LH[i][1]) * t;
      }
    HQ.LIT.value = lr;
    for (const [m, k] of NIGHT_MATS) m.emissiveIntensity = dark * k;
    for (const m of tentGlow) m.emissiveIntensity = dark * (m.userData.glowK ?? 0.5);
    for (const m of charMats) m.emissiveIntensity = dark * 0.32;
    for (const m of doorGlow) m.color.copy(C3('#2a1c12', '#ffc070', dark));
    for (const m of bulbs) m.color.copy(m.userData.base).multiplyScalar(0.35 + 0.9 * dark);
    for (const m of signs) m.color.copy(C3('#f4f1ea', '#d8c3a0', dark));
    for (const m of pools) m.opacity = dark * m.userData.k * 0.75;
    renderer.toneMappingExposure = 1.0 + 0.15 * dark;
    HQ.drawClock(h);
    lastSky.copy(hor);
    lastDark = dark;
    lobby?.setOutside(hor, dark);
    const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
    const label = elD > 8 ? '낮' : elD > -6 ? (h < 12 ? '해 뜰 무렵' : '해 질 무렵') : '밤';
    const text = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${label}`;
    if (text !== lastClockText) {
      lastClockText = text;
      emit({ type: 'clock', text, night: elD < -2 });
    }
  }
  const setMode = (m: Mode) => {
    mode = m;
    hourFrom = hourShown;
    let to = hourOf(m);
    // 가까운 쪽으로 돌림
    let dlt = to - hourFrom;
    if (dlt > 12) dlt -= 24;
    if (dlt < -12) dlt += 24;
    to = hourFrom + dlt;
    hourTo = to;
    hourT = 0;
  };

  /* 크기 */
  let vw = 1, vh = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    vw = Math.max(1, r.width);
    vh = Math.max(1, r.height);
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.fov = vw < vh ? 62 : 50;
    camera.updateProjectionMatrix();
    if (holo.anchor && holo.on && cam.mode !== 'follow') layoutHolo(0, true);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* 이동 */
  const keys = new Set<string>();
  const RAD = 0.36;
  const blocked = (x: number, z: number) => {
    const p = [x, -z];
    if (world === 'in') return lobby!.blocked(x, z);
    if (BLOCK_NOW.some((b) => inPoly(p, b))) return true;
    if (Math.hypot(p[0] - CS[0], p[1] - CS[1]) > 95) return true;
    for (const c of canopyCols) if (Math.hypot(x - c.x, z - c.z) < 0.25 + RAD) return true;
    for (const t of TENTS) {
      {
        const dx = x - t.pos.x, dz2 = z - t.pos.z;
        const lf = dx * t.f.x + dz2 * t.f.z, lr = dx * t.r.x + dz2 * t.r.z;
        if (Math.abs(lf) < RW + 0.1 + RAD && Math.abs(lr) < RW + 0.1 + RAD) return true;
      }
      if (Math.hypot(x - t.npcPos.x, z - t.npcPos.z) < 0.35 + RAD) return true;
    }
    return false;
  };
  const moveBy = (dx: number, dz: number) => {
    const nx = P.pos.x + dx, nz = P.pos.z + dz;
    if (!blocked(nx, nz)) P.pos.set(nx, 0, nz);
    else if (!blocked(nx, P.pos.z)) P.pos.x = nx;
    else if (!blocked(P.pos.x, nz)) P.pos.z = nz;
    else return false;
    return true;
  };
  const talkSpot = (i: number) => {
    const t = TENTS[i];
    return t.npcPos.clone().add(t.f.clone().multiplyScalar(1.75)).add(t.r.clone().multiplyScalar(-0.85));
  };

  /* 홀로그램 배치 */
  function layoutHolo(_i: number, instant = false) {
    const t = holo.anchor!;
    const portrait = vw / vh < 0.95;
    holo.cols = portrait ? 2 : 3;
    holo.rows = portrait ? 3 : 2;
    const gw = holo.cols * CW + (holo.cols - 1) * GAP, gh = holo.rows * CH + (holo.rows - 1) * GAP;
    const up = V(0, 1, 0);
    const side = portrait ? 0.15 : 0.75;
    const H = t.npcPos.clone().add(t.f.clone().multiplyScalar(holo.front)).add(t.r.clone().multiplyScalar(side + gw / 2)).setY(1.2 + gh / 2 + (portrait ? 0.35 : 0));
    const vf = (camera.fov * Math.PI) / 180;
    const tv = Math.tan(vf / 2), th = tv * camera.aspect;
    // 카드 묶음이 화면 높이 절반, 너비 3/4 안에 들게 — 위 안내판·아래 대화 상자를 피해 조금 위·오른쪽에 둠
    const fh = portrait ? 0.46 : 0.47, fw = portrait ? 0.92 : 0.72;
    const dist = Math.max(gh / (fh * 2 * tv), gw / (fw * 2 * th), 3.6);
    const sx = portrait ? 0 : 0.1, sy = portrait ? 0.12 : 0.06;
    const look = H.clone().sub(t.r.clone().multiplyScalar(sx * dist * th)).sub(V(0, sy * dist * tv, 0));
    const pos = look.clone().add(t.f.clone().multiplyScalar(dist));
    holo.camPos.copy(pos);
    holo.camLook.copy(look);
    // 카드: 카메라 쪽으로 살짝 휜 면
    const k = 0;
    cards.forEach((c, n) => {
      const col = n % holo.cols, row = Math.floor(n / holo.cols);
      const x = (col - (holo.cols - 1) / 2) * (CW + GAP), y = ((holo.rows - 1) / 2 - row) * (CH + GAP);
      const p = H.clone().add(t.r.clone().multiplyScalar(x)).add(up.clone().multiplyScalar(y)).add(t.f.clone().multiplyScalar(0.12 * x * x));
      c.to.copy(p);
      const m4 = new T.Matrix4().lookAt(pos, p, up);
      c.q.setFromRotationMatrix(m4);
      // Matrix4.lookAt: +z가 카메라 쪽 → 평면 앞면이 카메라를 봄
      void k;
      if (instant) {
        c.mesh.position.copy(p);
        c.mesh.quaternion.copy(c.q);
      }
    });
    holo.apex.copy(t.npcPos.clone().add(t.f.clone().multiplyScalar(0.75)).add(t.r.clone().multiplyScalar(0.75))).setY(0.12);
    const hx = t.r.clone().multiplyScalar(gw / 2), hy = V(0, gh / 2, 0);
    holo.corners[0].copy(H).sub(hx).sub(hy);
    holo.corners[1].copy(H).add(hx).sub(hy);
    holo.corners[2].copy(H).add(hx).add(hy);
    holo.corners[3].copy(H).sub(hx).add(hy);
    pad.position.copy(holo.apex).setY(0.1);
    const bp = beamGeo.attributes.position;
    for (let s = 0; s < 4; s++) {
      const a = holo.corners[s], b = holo.corners[(s + 1) % 4];
      bp.setXYZ(s * 3, holo.apex.x, holo.apex.y, holo.apex.z);
      bp.setXYZ(s * 3 + 1, a.x, a.y, a.z);
      bp.setXYZ(s * 3 + 2, b.x, b.y, b.z);
    }
    bp.needsUpdate = true;
  }
  const perPage = () => holo.cols * holo.rows;
  function showPage(p: number) {
    const all = holo.list;
    const pages = Math.max(1, Math.ceil(all.length / perPage()));
    holo.page = ((p % pages) + pages) % pages;
    const list = all.slice(holo.page * perPage(), holo.page * perPage() + perPage());
    cards.forEach((c, n) => {
      const tool = list[n];
      c.tool = tool ?? null;
      c.mat.uniforms.sel.value = 0;
      if (!tool) {
        c.mesh.visible = false;
        return;
      }
      drawCard(c, tool, holo.color);
      c.mesh.visible = true;
      c.from.copy(holo.apex).setY(0.4);
      c.mesh.position.copy(c.from);
      c.mesh.quaternion.copy(c.q);
      c.mesh.scale.setScalar(0.05);
      c.t0 = now + 0.1 + n * 0.09;
      c.hide = 0;
      c.mat.uniforms.appear.value = 0;
    });
    holo.sel = -1;
    focus = -1;
    emit({ type: 'page', page: holo.page, pages, cards: list });
    emit({ type: 'select', tool: null, slot: null });
  }

  /* 대화 */
  let near: number | 'desk' | null = null;
  let talking = -1;
  const DESK = -2;
  const anchorOf = (i: number) => (i === DESK ? lobby!.anchor : TENTS[i]);
  const startTalk = (i: number) => {
    if (talking === i) return;
    if (talking !== -1) endTalk(true);
    talking = i;
    const t = anchorOf(i);
    P.target = null;
    P.goTalk = -1;
    const s = i === DESK ? lobby!.deskSpot.clone() : talkSpot(i);
    if (!blocked(s.x, s.z)) P.pos.copy(s);
    P.yaw = Math.atan2(t.npcPos.x - P.pos.x, t.npcPos.z - P.pos.z);
    t.npc.wave = 1.2;
    t.npc.hop = 1;
    if (i >= 0) TENTS[i].visited = true;
    // 대화 첫 장면: 천막지기와 나를 함께
    // 안내 데스크는 직원이 계산대 뒤에 있어 조금 높이서 봄
    const hy = i === DESK ? 1.25 : 0.95, up = i === DESK ? 1.6 : 0.9, back = i === DESK ? 5.6 : 4.3;
    const look = t.npcPos.clone().add(t.f.clone().multiplyScalar(0.8)).add(t.r.clone().multiplyScalar(-0.35)).setY(hy);
    const pos = look.clone().add(t.f.clone().multiplyScalar(back)).add(t.r.clone().multiplyScalar(2.1)).add(V(0, up, 0));
    camTo('talk', pos, look);
    emit({ type: 'talk', tent: i === DESK ? 'desk' : i });
  };
  const openHolo = (list: PlazaTool[], color: string) => {
    if (talking === -1) return;
    holo.tent = talking;
    holo.anchor = anchorOf(talking);
    holo.list = list;
    holo.color = color;
    holo.front = talking === DESK ? 2.1 : 1.2;
    holo.on = true;
    layoutHolo(0);
    camTo('holo', holo.camPos, holo.camLook);
    showPage(0);
    holo.anchor.npc.hop = 1;
  };
  const showTools = () => talking >= 0 && openHolo(tents[talking].tools, tents[talking].color);
  /** 안내 데스크 검색 결과 — 홀로그램 카드 + 서가에서 그 책들이 빛남 */
  const showResults = (list: PlazaTool[]) => {
    if (!lobby) return;
    const ids = new Set(list.map((x) => x.sid));
    lobby.books.forEach((b) => (b.userData.glow = ids.has(b.userData.tool.sid) ? 1 : 0));
    if (!list.length) {
      hideCards();
      return;
    }
    openHolo(list, '#3a457f');
  };
  const hideCards = () => {
    holo.on = false;
    focus = -1;
    cards.forEach((c) => (c.hide = c.mesh.visible ? now : 0));
  };
  const endTalk = (silent = false) => {
    if (talking === -1) return;
    const t = anchorOf(talking);
    hideCards();
    talking = -1;
    holo.tent = -1;
    // 대화가 끝나면 카메라는 마당(트인 쪽)에서 내 캐릭터를 바라봄 — 천막·건물이 시야를 가리지 않게
    P.yaw = Math.atan2(t.f.x, t.f.z);
    cam.yaw = Math.atan2(t.f.x, t.f.z) + 0.35;
    cam.pitch = 0.32;
    cam.dist = clamp(cam.dist, 7, 10);
    const fp = followPose();
    camTo('follow', fp.pos, fp.look);
    if (!silent) emit({ type: 'talk', tent: null });
  };
  function camTo(m: typeof cam.mode, pos: THREE.Vector3, look: THREE.Vector3) {
    cam.from.pos.copy(cam.pos);
    cam.from.look.copy(cam.look);
    cam.to.pos.copy(pos);
    cam.to.look.copy(look);
    cam.mode = m;
    cam.t = 0;
  }

  /* 입력 */
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  let down: { x: number; y: number; yaw: number; pitch: number; id: number } | null = null;
  let dragged = false;
  let hoverCard = -1;
  const pick = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const onDown = (e: PointerEvent) => {
    cv.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, id: e.pointerId };
    dragged = false;
    if (cam.mode === 'intro') skipIntro();
  };
  const onMove = (e: PointerEvent) => {
    if (down && down.id === e.pointerId) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!dragged && Math.hypot(dx, dy) > 6) dragged = true;
      if (dragged && cam.mode === 'follow') {
        cam.yaw = down.yaw - dx * 0.006;
        cam.pitch = clamp(down.pitch + dy * 0.004, 0.08, 1.1);
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    pick(e);
    let cursor = 'grab';
    hoverCard = -1;
    if (holo.on && focus < 0) {
      const h = ray.intersectObjects(cards.filter((c) => c.mesh.visible).map((c) => c.mesh), false)[0];
      if (h) {
        hoverCard = h.object.userData.card;
        cursor = 'pointer';
      }
    } else if (cam.mode === 'follow' && world === 'in' && lobby && !focusBook) {
      const h = ray.intersectObjects([...lobby.books, lobby.npc.root], true)[0];
      const b = h && lobby.books.includes(h.object as THREE.Mesh) ? (h.object as THREE.Mesh) : null;
      if (b !== hoverBook) {
        hoverBook = b;
        emit({ type: 'hover', tool: b ? b.userData.tool : null });
      }
      if (h) cursor = 'pointer';
    } else if (cam.mode === 'follow' && world === 'out') {
      const h = ray.intersectObjects([...hitList, ...doorHit], true)[0];
      if (h && (h.object.userData.tent !== undefined || h.object.userData.door)) cursor = 'pointer';
    }
    cv.style.cursor = cursor;
  };
  const onUp = (e: PointerEvent) => {
    if (!down || down.id !== e.pointerId) return;
    down = null;
    if (dragged) return;
    pick(e);
    if (holo.on) {
      const h = ray.intersectObjects(cards.filter((c) => c.mesh.visible).map((c) => c.mesh), false)[0];
      if (h && focus < 0) select(h.object.userData.card);
      return;
    }
    if (cam.mode !== 'follow') return;
    if (world === 'in' && lobby) {
      if (focusBook) return;
      const h = ray.intersectObjects([...lobby.books, lobby.npc.root], true)[0];
      if (h && lobby.books.includes(h.object as THREE.Mesh)) {
        openBook(h.object as THREE.Mesh);
        return;
      }
      if (h) {
        P.target = lobby.deskSpot.clone();
        P.goTalk = DESK;
        return;
      }
    } else {
      const ht = ray.intersectObjects([...hitList, ...doorHit], true)[0];
      if (ht && ht.object.userData.door) {
        goLobby();
        return;
      }
      if (ht && ht.object.userData.tent !== undefined) {
        walkToTent(ht.object.userData.tent);
        return;
      }
    }
    const hg = ray.intersectObject(world === 'in' && lobby ? lobby.floor : ground, false)[0];
    if (hg) {
      P.target = hg.point.clone().setY(0);
      P.goTalk = -1;
      P.goDoor = false;
      pin.position.copy(P.target).setY(0.1);
      pin.material.opacity = 0.9;
      pin.scale.setScalar(1);
    }
  };
  const onWheel = (e: WheelEvent) => {
    if (cam.mode !== 'follow') return;
    e.preventDefault();
    cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 4.5, 26);
  };
  const onKey = (e: KeyboardEvent, on: boolean) => {
    const k = e.key.toLowerCase();
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      if (cam.mode === 'follow' || cam.mode === 'intro') {
        if (on) keys.add(k);
        else keys.delete(k);
        if (cam.mode === 'intro' && on) skipIntro();
        if (k.startsWith('arrow')) e.preventDefault();
      } else if (on && holo.on && focus < 0 && (k === 'arrowleft' || k === 'arrowright')) {
        showPage(holo.page + (k === 'arrowright' ? 1 : -1));
        e.preventDefault();
      }
    }
    if (!on) return;
    if (holo.on && focus < 0 && /^[1-6]$/.test(k)) select(+k - 1);
  };
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  const blur = () => keys.clear();
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', () => (down = null));
  cv.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  window.addEventListener('blur', blur);

  let focus = -1;
  const focusPose = { pos: V(), q: new T.Quaternion(), sx: 1, sy: 1 };
  /** 자세히 화면 자리 — 화면 가운데, 가로 최대 820px */
  const detailRect = () => {
    const portrait = vw / vh < 0.95;
    const w = Math.min(vw - (portrait ? 16 : 48), 820);
    const h = Math.min(vh - (portrait ? 16 : 56), portrait ? vh : Math.max(w * 0.72, 420));
    return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
  };
  /** 화면 자리 → 카메라 앞 d 거리의 위치·크기 */
  function poseFor(rect: { x: number; y: number; w: number; h: number }, d: number, out: { pos: THREE.Vector3; q: THREE.Quaternion }) {
    const tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
    const ww = (rect.w / vw) * 2 * d * th, wh = (rect.h / vh) * 2 * d * tv;
    const cx = ((rect.x + rect.w / 2) / vw - 0.5) * 2 * d * th, cy = (0.5 - (rect.y + rect.h / 2) / vh) * 2 * d * tv;
    const dir = V(), right = V(), upv = V();
    camera.getWorldDirection(dir);
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    upv.setFromMatrixColumn(camera.matrixWorld, 1);
    out.pos.copy(camera.position).add(dir.multiplyScalar(d)).add(right.multiplyScalar(cx)).add(upv.multiplyScalar(cy));
    out.q.copy(camera.quaternion);
    return { ww, wh };
  }
  /** 고른 카드를 그대로 화면 가운데로 키움 — 다 커지면 그 자리에 자세히 내용이 들어감 */
  function focusCard(n: number | null) {
    if (n === null || !cards[n] || !cards[n].mesh.visible) {
      if (focus >= 0) emit({ type: 'focus', rect: null });
      focus = -1;
      return;
    }
    // 모핑: 3D 카드는 바로 숨기고, 화면의 같은 자리에 같은 모양의 카드(DOM)를 띄워 자세히 화면으로 바꿈
    const rect = detailRect();
    const m = cards[n].mesh;
    m.updateMatrixWorld();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [cx, cy] of [[-CW / 2, -CH / 2], [CW / 2, -CH / 2], [CW / 2, CH / 2], [-CW / 2, CH / 2]]) {
      const v = V(cx, cy, 0).applyMatrix4(m.matrixWorld).project(camera);
      const sx = ((v.x + 1) / 2) * vw, sy = ((1 - v.y) / 2) * vh;
      x0 = Math.min(x0, sx);
      x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy);
      y1 = Math.max(y1, sy);
    }
    focus = n;
    hoverCard = -1;
    emit({ type: 'focus', rect, kind: 'card', from: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
  }
  function select(n: number | null) {
    if (n === null || !cards[n] || !cards[n].mesh.visible || !cards[n].tool) {
      holo.sel = -1;
      cards.forEach((c) => (c.mat.uniforms.sel.value = 0));
      focusCard(null);
      if (focusBook) emit({ type: 'focus', rect: null });
      focusBook = null;
      emit({ type: 'select', tool: null, slot: null });
      return;
    }
    holo.sel = n;
    cards.forEach((c, k) => (c.mat.uniforms.sel.value = k === n ? 1 : 0));
    focusCard(n);
    emit({ type: 'select', tool: cards[n].tool, slot: n });
  }
  function walkToTent(i: number) {
    if (world === 'in') {
      exitLobby(() => walkToTent(i));
      return;
    }
    if (talking !== -1) endTalk(true);
    if (cam.mode === 'intro') skipIntro();
    const s = talkSpot(i);
    P.target = s;
    P.goTalk = i;
    pin.material.opacity = 0;
  }
  /** 책 꺼내 보기 — 화면 가운데로 끌어와 크게 */
  let hoverBook: THREE.Mesh | null = null;
  let focusBook: THREE.Mesh | null = null;
  const bookPose = { pos: V(), q: new T.Quaternion(), s: 1 };
  function openBook(b: THREE.Mesh) {
    const d = 1.5, tv = Math.tan((camera.fov * Math.PI) / 360);
    const dir = V();
    camera.getWorldDirection(dir);
    bookPose.pos.copy(camera.position).add(dir.multiplyScalar(d));
    bookPose.q.copy(camera.quaternion);
    void tv;
    // 펼친 책 자리: 가로로 두 쪽(세로 화면은 한 쪽). 덮인 책은 오른쪽 쪽 자리로 옴
    const portrait = vw / vh < 0.95;
    const w = portrait ? Math.min(vw - 20, 520) : Math.min(vw - 48, 980);
    const h = portrait ? Math.min(vh - 20, w * 1.42) : Math.min(vh - 48, w / 1.42);
    const rect = { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
    const page = portrait ? rect : { x: rect.x + w / 2, y: rect.y, w: w / 2, h };
    const { wh } = poseFor(page, d, bookPose);
    bookPose.s = (wh / 0.48) * 0.97;
    emit({ type: 'focus', rect, kind: 'book' });
    focusBook = b;
    hoverBook = null;
    emit({ type: 'hover', tool: null });
    emit({ type: 'select', tool: b.userData.tool, slot: null });
  }
  /* 청사 들어가기·나오기 */
  const doorHit: THREE.Object3D[] = [];
  {
    // 정문 앞을 누르면 걸어 들어가게 — 보이지 않는 판
    const hb = new T.Mesh(new T.BoxGeometry(11, 5, 7.5), new T.MeshBasicMaterial({ visible: false }));
    hb.position.copy(W(ENT.q[0] + ENT.nrm[0] * 3.5, ENT.q[1] + ENT.nrm[1] * 3.5, 2.5));
    hb.rotation.y = ENT.ang;
    hb.userData.door = true;
    scene.add(hb);
    doorHit.push(hb);
  }
  const fadeEl = document.createElement('div');
  Object.assign(fadeEl.style, { position: 'absolute', inset: '0', background: '#05070d', opacity: '0', transition: 'opacity .35s', pointerEvents: 'none', zIndex: '5' });
  host.appendChild(fadeEl);
  let fading = false;
  let tvSound = false;
  const movers = () => [me.root, meRing, pin, pad, beam, spk, ...cards.map((c) => c.mesh)];
  function fadeSwap(fn: () => void, then?: () => void) {
    if (fading) return;
    fading = true;
    keys.clear();
    P.target = null;
    fadeEl.style.opacity = '1';
    window.setTimeout(() => {
      fn();
      lastNear = -2;
      fadeEl.style.opacity = '0';
      window.setTimeout(() => {
        fading = false;
        then?.();
      }, 380);
    }, 380);
  }
  function enterLobby() {
    fadeSwap(() => {
      if (talking !== -1) endTalk(true);
      select(null);
      if (!lobby) {
        lobby = makeLobby(opt.lobby.tools, opt.lobby.popular, opt.lobby.fresh);
        lobby.setOutside(lastSky, lastDark);
      }
      const L = lobby;
      movers().forEach((o) => L.scene.add(o));
      world = 'in';
      L.video.muted = !tvSound;
      L.video.play().catch(() => {
        // 소리 켠 채 자동재생이 막히면 소리 없이라도 틂
        L.video.muted = true;
        L.video.play().catch(() => null);
      });
      P.pos.copy(L.spawn.pos);
      P.yaw = L.spawn.yaw;
      cam.yaw = P.yaw + Math.PI;
      cam.pitch = 0.3;
      cam.dist = 7.5;
      const fp = followPose();
      cam.pos.copy(fp.pos);
      cam.look.copy(fp.look);
      cam.mode = 'follow';
      cam.t = 1;
      emit({ type: 'world', world: 'in' });
    });
  }
  function exitLobby(then?: () => void) {
    fadeSwap(() => {
      if (talking !== -1) endTalk(true);
      select(null);
      hoverBook = null;
      lobby?.video.pause();
      movers().forEach((o) => scene.add(o));
      world = 'out';
      const o = [ENT.door[0] + ENT.nrm[0] * 2.4, ENT.door[1] + ENT.nrm[1] * 2.4];
      P.pos.copy(W(o[0], o[1]));
      P.yaw = Math.atan2(ENT.nrm[0], -ENT.nrm[1]);
      // 카메라는 광장 쪽에서 정문을 바라봄(뒤에서 따라가면 건물에 가려 아무것도 안 보임)
      cam.yaw = P.yaw;
      cam.pitch = 0.3;
      cam.dist = 11;
      const fp = followPose();
      cam.pos.copy(fp.pos);
      cam.look.copy(fp.look);
      cam.mode = 'follow';
      cam.t = 1;
      emit({ type: 'world', world: 'out' });
    }, then);
  }
  function goLobby() {
    if (world === 'in') return;
    if (talking !== -1) endTalk(true);
    if (cam.mode === 'intro') skipIntro();
    P.target = doorPt.clone();
    P.goTalk = -1;
    P.goDoor = true;
  }
  function skipIntro() {
    if (cam.mode !== 'intro') return;
    const fp = followPose();
    camTo('follow', fp.pos, fp.look);
    cam.t = 0.35;
  }

  /* 매 장면 */
  const clock = new T.Clock();
  let now = 0;
  let raf = 0;
  let readySent = false;
  let lastNear: number | null = -2;
  let tick20 = 0;
  let doorK = 0;
  const tmp = V();
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = (window as any).__plazaFast ? 0.2 : Math.min(0.05, clock.getDelta());
    now += dt;
    const t = now;
    holoU.time.value = t;
    // 시각
    tick20 += dt;
    if (hourT < 1) {
      hourT = Math.min(1, hourT + dt / 1.6);
      hourShown = (hourFrom + (hourTo - hourFrom) * ease(hourT) + 24) % 24;
      applyHour(hourShown);
    } else if (mode === 'auto' && tick20 > 20) {
      hourShown = kstNow().h;
      applyHour(hourShown);
    }
    if (tick20 > 20) tick20 = 0;

    // 플레이어 움직임
    let mx = 0, mz = 0;
    if (cam.mode === 'follow') {
      const fwd = V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      const rt = V(-fwd.z, 0, fwd.x);
      if (keys.has('w') || keys.has('arrowup')) (mx += fwd.x), (mz += fwd.z);
      if (keys.has('s') || keys.has('arrowdown')) (mx -= fwd.x), (mz -= fwd.z);
      if (keys.has('d') || keys.has('arrowright')) (mx += rt.x), (mz += rt.z);
      if (keys.has('a') || keys.has('arrowleft')) (mx -= rt.x), (mz -= rt.z);
      if (mx || mz) P.target = null;
    }
    const run = keys.has('shift') ? 7.2 : 4.6;
    let sp = 0;
    if (mx || mz) {
      const l = Math.hypot(mx, mz);
      mx /= l;
      mz /= l;
      sp = run;
    } else if (P.target && cam.mode === 'follow') {
      tmp.copy(P.target).sub(P.pos).setY(0);
      const d = tmp.length();
      if (d < 0.15 || d < Math.min(run, d * 4 + 1) * dt) {
        if (!blocked(P.target.x, P.target.z)) P.pos.copy(P.target);
        P.target = null;
        if (P.goTalk !== -1) startTalk(P.goTalk);
        else if (P.goDoor) enterLobby();
      } else {
        mx = tmp.x / d;
        mz = tmp.z / d;
        sp = Math.min(run, d * 4 + 1);
      }
    }
    if (sp > 0) {
      const ok = moveBy(mx * sp * dt, mz * sp * dt);
      if (!ok && P.target) {
        // 막혔으면 둘러 가기(오른쪽으로 살짝)
        if (!moveBy(-mz * sp * dt, mx * sp * dt)) P.target = null;
      }
      const ty = Math.atan2(mx, mz);
      let dy = ty - P.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      P.yaw += dy * Math.min(1, dt * 12);
      if (keys.size && cam.mode === 'follow') {
        // 키로 걸으면 카메라가 천천히 뒤로 따라붙음
        let cy = P.yaw + Math.PI - cam.yaw;
        cy = Math.atan2(Math.sin(cy), Math.cos(cy));
        if (keys.has('w') || keys.has('arrowup')) cam.yaw += cy * Math.min(1, dt * 1.2);
      }
    }
    P.speed += (sp - P.speed) * Math.min(1, dt * 10);
    me.root.position.copy(P.pos);
    me.root.rotation.y = P.yaw;
    animChibi(me, dt, t, P.speed);
    meRing.position.copy(P.pos).setY(0.08);
    meRing.material.opacity = 0.55 + 0.25 * Math.sin(t * 4);
    if (pin.material.opacity > 0) {
      pin.material.opacity = Math.max(0, pin.material.opacity - dt * 0.9);
      pin.scale.setScalar(1 + (0.9 - pin.material.opacity) * 0.8);
    }

    // 가까운 천막지기 / 안내 데스크
    let best: number | 'desk' | null = null, bd = 3.6;
    if (world === 'out') {
      // 정문: 다가가면 문이 열리고, 문 앞까지 오면 로비로
      const dd = Math.hypot(P.pos.x - doorPt.x, P.pos.z - doorPt.z);
      doorK += ((dd < 7 ? 1 : 0) - doorK) * Math.min(1, dt * 4);
      ENT.setDoors(doorK);
      if (dd < 1.0 && cam.mode === 'follow' && !fading && talking === -1) enterLobby();
    } else if (lobby) {
      const L = lobby;
      L.update(dt, t, P.pos, hourShown);
      const dd = Math.hypot(P.pos.x - L.deskSpot.x, P.pos.z - L.deskSpot.z);
      if (dd < 2.6) best = 'desk';
      const n = L.npc;
      let want = -Math.PI / 2;
      const nd = Math.hypot(P.pos.x - L.npcPos.x, P.pos.z - L.npcPos.z);
      if (nd < 8 || talking === DESK) want = Math.atan2(P.pos.x - L.npcPos.x, P.pos.z - L.npcPos.z);
      let dy = want - n.root.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      n.root.rotation.y += dy * Math.min(1, dt * 4);
      if (nd < 8 && !n.root.userData.greeted) {
        n.root.userData.greeted = true;
        n.wave = 1.1;
      }
      if (nd > 11) n.root.userData.greeted = false;
      animChibi(n, dt, t, 0);
      if (L.isExit(P.pos.x, P.pos.z) && !fading && cam.mode === 'follow') exitLobby();
      // 화면 소리: 가까울수록 크게
      if (!L.video.muted) L.video.volume = clamp(1 - (Math.hypot(P.pos.x - L.tvPos.x, P.pos.z - L.tvPos.z) - 4) / 18, 0.08, 1);
      // 책: 마우스 올리면 살짝 나오고, 고르면 화면 가운데로
      for (const b of L.books) {
        const u = b.userData;
        u.pull += ((b === hoverBook ? 1 : 0) - u.pull) * Math.min(1, dt * 10);
        u.fk += ((b === focusBook ? 1 : 0) - u.fk) * Math.min(1, dt * 7);
        if (u.pull < 0.002 && u.fk < 0.002 && !u.moved) continue;
        u.moved = u.pull > 0.002 || u.fk > 0.002;
        b.position.copy(u.home).add(tmp.copy(u.n).multiplyScalar(0.2 * u.pull));
        b.quaternion.copy(u.q);
        b.scale.setScalar(1);
        if (u.fk > 0.002) {
          const e5 = ease(clamp(u.fk));
          b.position.lerp(bookPose.pos, e5);
          b.quaternion.slerp(bookPose.q, e5);
          b.scale.setScalar(1 + (bookPose.s - 1) * e5);
        }
      }
    }
    if (world === 'out') TENTS.forEach((tt, i) => {
      const d = Math.hypot(tt.npcPos.x - P.pos.x, tt.npcPos.z - P.pos.z);
      if (d < bd) (bd = d), (best = i);
      // 천막지기: 가까이 오면 나를 봄
      const dd = d;
      let want = tt.npcYaw;
      if (dd < 9 || talking === i) want = Math.atan2(P.pos.x - tt.npcPos.x, P.pos.z - tt.npcPos.z);
      let dy = want - tt.npc.root.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      tt.npc.root.rotation.y += dy * Math.min(1, dt * 4);
      if (dd < 9 && !tt.npc.root.userData.greeted) {
        tt.npc.root.userData.greeted = true;
        tt.npc.wave = 1.1;
      }
      if (dd > 14) tt.npc.root.userData.greeted = false;
      animChibi(tt.npc, dt, t + i, 0);
      tt.mark.visible = !tt.visited;
      tt.mark.position.copy(tt.npcPos).setY(2.05 + Math.sin(t * 3 + i) * 0.08);
      const ld = camera.position.distanceTo(tt.label.position);
      tt.label.material.opacity = cam.mode === 'talk' || cam.mode === 'holo' ? 0 : clamp((ld - 7) / 6) * clamp(1.5 - ld / 110, 0.45, 1);
    });
    if (talking !== -1 || fading) best = null;
    if (best !== lastNear) {
      lastNear = best;
      near = best;
      emit({ type: 'near', tent: best });
    }

    // 카메라
    if (cam.mode === 'intro') {
      cam.t = Math.min(1, cam.t + dt / 4.2);
      if (cam.t > 0.999) skipIntro();
      const fp = followPose();
      const e2 = ease(cam.t);
      cam.pos.lerpVectors(cam.from.pos, fp.pos, e2);
      cam.look.lerpVectors(cam.from.look, fp.look, e2);
    } else {
      cam.t = Math.min(1, cam.t + dt / 1.1);
      const e2 = ease(cam.t);
      if (cam.mode === 'follow') {
        const fp = followPose();
        if (cam.t < 1) {
          cam.pos.lerpVectors(cam.from.pos, fp.pos, e2);
          cam.look.lerpVectors(cam.from.look, fp.look, e2);
        } else {
          cam.pos.lerp(fp.pos, Math.min(1, dt * 8));
          cam.look.lerp(fp.look, Math.min(1, dt * 10));
        }
      } else {
        cam.pos.lerpVectors(cam.from.pos, cam.to.pos, e2);
        cam.look.lerpVectors(cam.from.look, cam.to.look, e2);
      }
    }
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    sky.position.copy(camera.position);
    // 책을 꺼내 볼 때는 카메라 기준 위치를 계속 따라감(카메라는 멈춰 있음)

    // 홀로그램
    const beamOn = holo.on && focus < 0 ? 1 : 0;
    holo.beam += (beamOn - holo.beam) * Math.min(1, dt * 4);
    beamM.uniforms.op.value = holo.beam * 0.6;
    pad.material.opacity = holo.beam;
    pad.rotation.z = t * 0.6;
    spkM.opacity = holo.beam * 0.9;
    if (holo.beam > 0.01) {
      const sp2 = spkG.attributes.position;
      spkSeed.forEach(([a, b, c], n) => {
        const u = (t * 0.35 + a) % 1;
        const top = holo.corners[0].clone().lerp(holo.corners[1], b).lerp(holo.corners[3].clone().lerp(holo.corners[2], b), c);
        const p = holo.apex.clone().lerp(top, u);
        sp2.setXYZ(n, p.x, p.y, p.z);
      });
      sp2.needsUpdate = true;
    }
    cards.forEach((c, n) => {
      if (!c.mesh.visible) return;
      if (c.hide) {
        const k = clamp((t - c.hide) / 0.35);
        c.mat.uniforms.appear.value = 1 - k;
        c.mesh.scale.setScalar(1 - k * 0.3);
        if (k >= 1) {
          c.mesh.visible = false;
          c.hide = 0;
        }
        return;
      }
      const k = clamp((t - c.t0) / 0.55);
      const e3 = easeBack(k);
      c.mesh.position.lerpVectors(c.from, c.to, Math.min(1, e3));
      c.mesh.scale.setScalar(0.05 + 0.95 * clamp(e3, 0, 1.08));
      c.mat.uniforms.appear.value = clamp((t - c.t0 - 0.15) / 0.5, 0, 1);
      const hv = n === hoverCard && focus < 0 ? 1 : 0;
      c.hover += (hv - c.hover) * Math.min(1, dt * 12);
      c.mat.uniforms.hover.value = c.hover;
      if (k >= 1) {
        // 둥실둥실
        c.mesh.position.y = c.to.y + Math.sin(t * 1.6 + n) * 0.025;
        const push = (c.hover * 0.12 + (holo.sel === n ? 0.18 : 0));
        c.mesh.position.add(tmp.copy(holo.camPos).sub(c.to).normalize().multiplyScalar(push));
      }
      // 자세히 보기: 고른 카드는 화면 가운데로 크게, 나머지는 흐리게
      const fw = 0; // 확대는 화면(DOM) 모핑이 맡음
      c.fk += (fw - c.fk) * Math.min(1, dt * 7);
      if (c.fk > 0.001) {
        const e4 = ease(clamp(c.fk));
        c.mesh.position.lerp(focusPose.pos, e4);
        c.mesh.quaternion.copy(c.q).slerp(focusPose.q, e4);
        const s0 = c.mesh.scale.x;
        c.mesh.scale.set(s0 + (focusPose.sx - s0) * e4, s0 + (focusPose.sy - s0) * e4, 1);
        c.mesh.renderOrder = 12;
      } else {
        c.mesh.quaternion.copy(c.q);
        c.mesh.renderOrder = 10;
      }
      c.mat.uniforms.dim.value += ((focus >= 0 && focus !== n ? 1 : 0) - c.mat.uniforms.dim.value) * Math.min(1, dt * 7);
      c.mat.uniforms.gone.value = focus === n ? 1 : 0;
    });
    if (talking !== -1) anchorOf(talking).npc.talk = speaking ? 1 : 0;

    renderer.render(world === 'in' && lobby ? lobby.scene : scene, camera);
    if (!readySent) {
      readySent = true;
      emit({ type: 'ready' });
    }
  }
  let speaking = false;
  applyHour(hourShown);
  resize();
  frame();

  return {
    setMode,
    talk: (i: number) => startTalk(i),
    walkTo: (i: number) => walkToTent(i),
    goLobby,
    talkDesk: () => world === 'in' && startTalk(DESK),
    search: (list: PlazaTool[]) => showResults(list),
    /** 로비 화면 소리 켜기·끄기 — 누른 순간이라 자동재생 제한에 안 걸림 */
    tvSound: (on: boolean) => {
      tvSound = on;
      if (lobby) {
        lobby.video.muted = !on;
        if (world === 'in') lobby.video.play().catch(() => null);
      }
    },
    showTools,
    endTalk: () => endTalk(),
    page: (d: number) => holo.on && showPage(holo.page + d),
    world: () => world,
    select,
    focus: (n: number | null) => focusCard(n),
    speak: (on: boolean) => (speaking = on),
    near: () => near,
    shot: () => cv.toDataURL('image/png'),
    debug: { P, cam, TENTS, ENT, startTalk, showTools, applyHour, holo, cards, camera, enterLobby, exitLobby, get lobby() { return lobby; }, openBook },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      [scene, ...(lobby ? [lobby.scene] : [])].forEach((sc2) => sc2.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => {
          Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
          m.dispose();
        });
      }));
      fadeEl.remove();
      if (lobby) {
        lobby.video.pause();
        lobby.video.removeAttribute('src');
        lobby.video.load();
      }
      renderer.dispose();
      renderer.forceContextLoss();
      cv.remove();
    },
  };
}
export type PlazaEngine = ReturnType<typeof createPlaza>;
