// @ts-nocheck
/*
 * 청사 1층 로비 — 호용님이 찍어 보낸 사진 기준(2026-10).
 * 책장 벽(여러 층 높이), 회색 문틀 + LED 시계, 나무 결 둥근 기둥, INFORMATION 안내 데스크,
 * 유리 난간 중층과 돌계단, 초록·흰 의자 쉼터.
 * 책장의 책 = 업무경감 도구. 서쪽 벽은 가나다순 「도구 서가」, 입구 양옆은 많이 찾는·새로 올라온 도구.
 * 좌표: x=동, z=남(입구 쪽), 원점 로비 가운데 바닥. 방 크기 32×26m, 높이 15.5m
 */
import * as THREE from 'three';
import { makeChibi, toon, type Chibi } from './chibi';
import promoUrl from './promo.mp4';

export interface LobbyTool {
  sid: string;
  title: string;
  tag: string;
  run: string;
}
const T = THREE;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const RX = 16, RZ = 13, RH = 15.5;
const FONT = "'Plaza SUIT', 'SUIT Variable', 'Pretendard Variable', 'Noto Sans CJK KR', sans-serif";
const DISPLAY = "'Plaza Edu', 'Plaza SUIT', 'Noto Sans CJK KR', sans-serif";

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, rep = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
const std = (c: string, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });

/** 낱말 첫 자음 — 가나다 서가 팻말용 */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MERGE: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };
export const sortKey = (title: string) => title.replace(/^[^0-9A-Za-z가-힣]+/, '').replace(/^\[[^\]]*\]\s*/, '');
export function initialOf(title: string) {
  const s = sortKey(title);
  const c = s.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) {
    const ch = CHO[Math.floor((c - 0xac00) / 588)];
    return MERGE[ch] ?? ch;
  }
  if (/[A-Za-z]/.test(s[0] ?? '')) return 'A–Z';
  return '0–9';
}

const COVER_BG = ['#2f6fb3', '#2e9e6a', '#c0584a', '#b7863a', '#7a5ea8', '#2fa39a', '#d65a3a', '#5b6ee1', '#3f6e8c', '#e0a92e', '#d65aa4', '#4f8f5a', '#3a457f', '#8a6f5a'];
const TAG_BAND: Record<string, string> = { '교직원 제작': '#1f7ae0', '교육청 배포': '#2f3a73', '외부 공공': '#0f9a72' };
export const coverColor = (sid: string) => COVER_BG[hash(sid) % COVER_BG.length];
export const TAG_BAND_COLOR = (tag: string) => TAG_BAND[tag] ?? '#1f7ae0';
function hash(s: string) {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const out: string[] = [];
  let line = '';
  for (const ch of text) {
    if (g.measureText(line + ch).width > maxW && line) {
      out.push(line);
      line = ch.trim() ? ch : '';
    } else line += ch;
  }
  if (line) out.push(line);
  if (out.length > maxLines) {
    const keep = out.slice(0, maxLines);
    let last = keep[maxLines - 1];
    while (last && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    keep[maxLines - 1] = last + '…';
    return keep;
  }
  return out;
}

export function makeLobby(tools: LobbyTool[], popular: LobbyTool[], fresh: LobbyTool[]) {
  const scene = new T.Scene();
  scene.background = new T.Color('#1a2030');
  const add = <O extends THREE.Object3D>(o: O) => (scene.add(o), o);

  /* 빛 — 실내라 낮밤과 상관없이 고정 */
  add(new T.HemisphereLight('#fff6ea', '#9a8f80', 1.25));
  const key = new T.DirectionalLight('#fff3e0', 1.1);
  key.position.set(-6, 14, 9);
  add(key);
  const fill = new T.DirectionalLight('#e8f0ff', 0.45);
  fill.position.set(10, 8, -6);
  add(fill);

  /* 바닥 — 회색 화강석 + 서쪽 서가 앞 베이지 띠 무늬 */
  const granite = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9bcc0';
    g.fillRect(0, 0, w, h);
    const r = seeded(5);
    for (let i = 0; i < 9000; i++) {
      const v = 150 + r() * 80;
      g.fillStyle = `rgba(${v},${v},${v + 4},.35)`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(90,95,100,.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 128, 0);
      g.lineTo(i * 128, h);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * 128);
      g.lineTo(w, i * 128);
      g.stroke();
    }
  }, true);
  granite.repeat.set(RX / 2.4, RZ / 2.4);
  const floor = add(new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2), std('#ffffff', { map: granite, roughness: 0.28, metalness: 0.08 })));
  floor.rotation.x = -Math.PI / 2;
  const beige = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#ddd2c0';
    g.fillRect(0, 0, w, h);
    const r = seeded(9);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(150,130,110,${0.15 * r()})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.fillStyle = '#3a3c42';
    g.fillRect(0, 96, w, 26);
  }, true);
  beige.repeat.set(1, RZ / 1.6);
  const strip = add(new T.Mesh(new T.PlaneGeometry(6, RZ * 2), std('#ffffff', { map: beige, roughness: 0.3 })));
  strip.rotation.x = -Math.PI / 2;
  strip.rotation.z = 0;
  strip.position.set(-RX + 3, 0.01, 0);

  /* 천장 — 흰 판 + 둥근 매입등 */
  const ceilTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#f1f1ef';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fffdf6';
    g.beginPath();
    g.arc(128, 128, 22, 0, 7);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.08)';
    g.stroke();
  }, true);
  ceilTex.repeat.set(RX / 3, RZ / 3);
  const ceil = add(new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2), new T.MeshBasicMaterial({ map: ceilTex })));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = RH;

  /* 책장 — 나무 칸막이 격자 + 칸마다 앞표지가 보이게 세운 책 */
  const wood = toon('#c99a62');
  const woodDark = std('#6d4a2b', { roughness: 0.9 });
  const COLW = 0.92, ROWH = 0.8;
  const deco: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const decoR = seeded(77);
  const DECO_COL = ['#e05a6a', '#f2c14e', '#3fb6c9', '#7bb662', '#9b6ad6', '#ffffff', '#f08a24', '#2f6fb3', '#e9dcc8', '#232a36', '#d65aa4', '#c7e3a0'];
  const mtx = new T.Matrix4(), q = new T.Quaternion(), sc = V(1, 1, 1);
  interface Wall {
    o: THREE.Vector3; // 왼쪽 아래 모서리(앞면)
    u: THREE.Vector3; // 벽을 따라 오른쪽
    n: THREE.Vector3; // 방 안쪽
    cols: number;
    rows: number;
    gaps?: [number, number, number][]; // [시작 칸, 끝 칸(포함), 비울 줄 수]
  }
  const slots: { pos: THREE.Vector3; n: THREE.Vector3; u: THREE.Vector3; wall: number; col: number; row: number }[] = [];
  function shelfWall(w: Wall, wi: number) {
    const len = w.cols * COLW, hgt = w.rows * ROWH;
    const yaw = Math.atan2(w.n.x, w.n.z);
    const cell = (c: number, r: number) => w.o.clone().add(w.u.clone().multiplyScalar((c + 0.5) * COLW)).add(V(0, (r + 0.5) * ROWH, 0));
    const isGap = (c: number, r: number) => (w.gaps ?? []).some(([a, b, n]) => c >= a && c <= b && r < n);
    void len;
    const gapRows = (c: number) => (w.gaps ?? []).reduce((m, [a, b, n]) => (c >= a && c <= b ? Math.max(m, n) : m), 0);
    q.setFromAxisAngle(V(0, 1, 0), yaw);
    // 뒷판(칸마다, 비운 자리 위만)
    const backG = new T.PlaneGeometry(COLW, 1);
    const bk = new T.InstancedMesh(backG, woodDark, w.cols);
    for (let c = 0; c < w.cols; c++) {
      const g0 = gapRows(c) * ROWH;
      const p = w.o.clone().add(w.u.clone().multiplyScalar((c + 0.5) * COLW)).sub(w.n.clone().multiplyScalar(0.36)).setY((g0 + hgt) / 2);
      mtx.compose(p, q, sc.set(1, hgt - g0, 1));
      bk.setMatrixAt(c, mtx);
    }
    add(bk);
    // 세로판(양옆 칸 중 낮은 쪽 비움 위부터)
    const vb = new T.InstancedMesh(new T.BoxGeometry(0.05, 1, 0.42), wood, w.cols + 1);
    for (let c = 0; c <= w.cols; c++) {
      const g0 = Math.min(c > 0 ? gapRows(c - 1) : 0, c < w.cols ? gapRows(c) : 0) * ROWH;
      const p = w.o.clone().add(w.u.clone().multiplyScalar(c * COLW)).sub(w.n.clone().multiplyScalar(0.15)).setY((g0 + hgt) / 2);
      mtx.compose(p, q, sc.set(1, hgt - g0, 1));
      vb.setMatrixAt(c, mtx);
    }
    add(vb);
    // 가로판(칸마다 — 비운 칸 안은 빼고)
    const hb = new T.InstancedMesh(new T.BoxGeometry(COLW, 0.05, 0.42), wood, w.cols * (w.rows + 1));
    let hn = 0;
    for (let c = 0; c < w.cols; c++)
      for (let r = 0; r <= w.rows; r++) {
        if (r < gapRows(c)) continue;
        const p = w.o.clone().add(w.u.clone().multiplyScalar((c + 0.5) * COLW)).sub(w.n.clone().multiplyScalar(0.15)).setY(r * ROWH);
        mtx.compose(p, q, sc.set(1, 1, 1));
        hb.setMatrixAt(hn++, mtx);
      }
    hb.count = hn;
    add(hb);
    for (let c = 0; c < w.cols; c++)
      for (let r = 0; r < w.rows; r++) {
        if (isGap(c, r)) continue;
        const p = cell(c, r);
        if (r < (wi === 0 ? 4 : wi === 1 ? 3 : 0)) {
          slots.push({ pos: p, n: w.n, u: w.u, wall: wi, col: c, row: r });
          continue;
        }
        decoCell(p, w.n, w.u);
      }
  }
  /** 꾸밈 책 한 칸 — 앞표지 2권, 꽂힌 책등 한 줄, 가끔 나무판 */
  function decoCell(p: THREE.Vector3, n: THREE.Vector3, u: THREE.Vector3) {
    const w = { n, u };
    const yaw = Math.atan2(n.x, n.z);
    {
      {
        const kind = decoR();
        if (kind < 0.12) {
          q.setFromAxisAngle(V(0, 1, 0), yaw);
          mtx.compose(p.clone().sub(w.n.clone().multiplyScalar(0.15)), q, sc.set(COLW - 0.08, ROWH - 0.08, 0.04));
          deco.push({ m: mtx.clone(), c: new T.Color('#c99a62') });
        } else if (kind < 0.62) {
          for (const s of [-1, 1]) {
            const bp = p.clone().add(w.u.clone().multiplyScalar(s * 0.2)).add(V(0, -0.08, 0));
            q.setFromEuler(new T.Euler(-0.12, yaw, 0, 'YXZ'));
            mtx.compose(bp, q, sc.set(0.3, 0.44, 0.05));
            deco.push({ m: mtx.clone(), c: new T.Color(DECO_COL[Math.floor(decoR() * DECO_COL.length)]) });
          }
        } else {
          let x = -COLW / 2 + 0.08;
          while (x < COLW / 2 - 0.12) {
            const th = 0.035 + decoR() * 0.04, hh = 0.42 + decoR() * 0.2;
            const bp = p.clone().add(w.u.clone().multiplyScalar(x + th / 2)).add(V(0, -ROWH / 2 + hh / 2 + 0.03, 0)).sub(w.n.clone().multiplyScalar(0.12));
            q.setFromAxisAngle(V(0, 1, 0), yaw);
            mtx.compose(bp, q, sc.set(th, hh, 0.28));
            deco.push({ m: mtx.clone(), c: new T.Color(DECO_COL[Math.floor(decoR() * DECO_COL.length)]) });
            x += th + 0.004;
          }
        }
      }
    }
  }
  // 서쪽 벽: 도구 서가 — 가운데쯤 복도로 가는 열린 문(4칸 × 4줄)
  const WCOLS = Math.floor((RZ * 2) / COLW);
  const wOff = (RZ * 2 - WCOLS * COLW) / 2;
  shelfWall({ o: V(-RX + 0.36, 0, RZ - wOff), u: V(0, 0, -1), n: V(1, 0, 0), cols: WCOLS, rows: 18, gaps: [[15, 18, 4]] }, 0);
  {
    // 열린 문 너머 복도 — 베이지 벽, 밝은 천장
    const z0 = RZ - wOff - 15 * COLW, z1 = RZ - wOff - 19 * COLW, hgt = 4 * ROWH;
    const cw = std('#efe6d6', { roughness: 0.9 });
    const back = add(new T.Mesh(new T.PlaneGeometry(Math.abs(z0 - z1), hgt), std('#f4efe6')));
    back.position.set(-RX - 3.5, hgt / 2, (z0 + z1) / 2);
    back.rotation.y = Math.PI / 2;
    for (const z of [z0, z1]) {
      const sd = add(new T.Mesh(new T.PlaneGeometry(3.6, hgt), cw));
      sd.position.set(-RX - 1.7, hgt / 2, z);
      sd.rotation.y = z === z0 ? Math.PI : 0;
    }
    const cf = add(new T.Mesh(new T.PlaneGeometry(3.6, Math.abs(z0 - z1)), std('#d9d4ca', { roughness: 0.4 })));
    cf.rotation.x = -Math.PI / 2;
    cf.position.set(-RX - 1.7, 0.005, (z0 + z1) / 2);
    const cc = add(new T.Mesh(new T.PlaneGeometry(3.6, Math.abs(z0 - z1)), new T.MeshBasicMaterial({ color: '#fbf8f2' })));
    cc.rotation.x = Math.PI / 2;
    cc.position.set(-RX - 1.7, hgt, (z0 + z1) / 2);
    // 문틀(나무)
    const fr = add(new T.Mesh(new T.BoxGeometry(0.5, 0.25, Math.abs(z0 - z1)), toon('#b88a58')));
    fr.position.set(-RX + 0.3, hgt, (z0 + z1) / 2);
  }
  // 남쪽 벽(입구 벽): 가운데 문틀 자리 비움
  const SCOLS = Math.floor((RX * 2) / COLW);
  const sOff = (RX * 2 - SCOLS * COLW) / 2;
  const doorC0 = Math.floor((SCOLS * COLW) / 2 / COLW - 6.2 / COLW), doorC1 = SCOLS - 1 - doorC0;
  shelfWall({ o: V(-RX + sOff, 0, RZ - 0.36), u: V(1, 0, 0), n: V(0, 0, -1), cols: SCOLS, rows: 18, gaps: [[doorC0, doorC1, 8]] }, 1);
  // 북동쪽: 쉼터 뒤 낮은 책장
  shelfWall({ o: V(6, 0, -RZ + 0.36), u: V(1, 0, 0), n: V(0, 0, 1), cols: Math.floor((RX - 6) / COLW), rows: 6 }, 2);

  /* 책 = 도구. 표지 그림은 한 장의 큰 그림(아틀라스)에 모아 그림 */
  const CWp = 128, CHp = 180, PER = 16;
  const uniq = new Map<string, LobbyTool>();
  [...tools, ...popular, ...fresh].forEach((t) => uniq.set(t.sid, t));
  const list = [...uniq.values()];
  const idx = new Map(list.map((t, i) => [t.sid, i]));
  const rowsA = Math.ceil(list.length / PER);
  const atlas = tex(CWp * PER, CHp * rowsA, (g) => {
    list.forEach((t, i) => {
      const x = (i % PER) * CWp, y = Math.floor(i / PER) * CHp;
      const bg = COVER_BG[hash(t.sid) % COVER_BG.length];
      g.fillStyle = bg;
      g.fillRect(x, y, CWp, CHp);
      // 무늬
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.beginPath();
      g.arc(x + CWp * 0.85, y + CHp * 0.82, 46, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(x, y, 7, CHp);
      // 구분 띠
      g.fillStyle = TAG_BAND[t.tag] ?? '#1f7ae0';
      g.fillRect(x + 7, y + 8, CWp - 7, 20);
      g.fillStyle = '#ffffff';
      g.font = `700 12px ${FONT}`;
      g.textBaseline = 'middle';
      g.fillText(t.tag, x + 14, y + 18.5);
      // 이름
      g.font = `800 17px ${FONT}`;
      g.fillStyle = '#ffffff';
      const ls = wrap(g, t.title.replace(/^[⭐★☆\s]+/, ''), CWp - 22, 5);
      ls.forEach((l, k) => g.fillText(l, x + 13, y + 46 + k * 21));
      if (t.run) {
        g.font = `600 11px ${FONT}`;
        g.fillStyle = 'rgba(255,255,255,.8)';
        g.fillText(t.run, x + 13, y + CHp - 14);
      }
    });
  });
  const coverM = new T.MeshStandardMaterial({ map: atlas, roughness: 0.55, emissive: '#ffd36b', emissiveIntensity: 0 });
  const pageM = std('#f4efe4', { roughness: 0.9 });
  const books: THREE.Mesh[] = [];
  const BW = 0.34, BH = 0.48, BD = 0.05;
  function makeBook(t: LobbyTool, s: (typeof slots)[number], side: number) {
    const i = idx.get(t.sid)!;
    const geo = new T.BoxGeometry(BW, BH, BD);
    // 앞면(+z, 면 번호 4)의 UV를 아틀라스 칸으로
    const uv = geo.attributes.uv;
    const u0 = (i % PER) / PER, u1 = u0 + 1 / PER;
    const v1 = 1 - Math.floor(i / PER) / rowsA, v0 = v1 - 1 / rowsA;
    for (let k = 0; k < 4; k++) {
      const vi = 16 + k;
      uv.setXY(vi, uv.getX(vi) ? u1 : u0, uv.getY(vi) ? v1 : v0);
    }
    const m = new T.Mesh(geo, [pageM, pageM, pageM, pageM, coverM.clone(), pageM]);
    const yaw = Math.atan2(s.n.x, s.n.z);
    const home = s.pos.clone().add(s.u.clone().multiplyScalar(side * 0.21)).add(V(0, -ROWH / 2 + BH / 2 + 0.06, 0)).sub(s.n.clone().multiplyScalar(0.06));
    m.position.copy(home);
    m.rotation.set(-0.1, yaw, 0, 'YXZ');
    m.userData = { tool: t, home: home.clone(), q: m.quaternion.clone(), n: s.n.clone(), pull: 0, fk: 0, glow: 0, slot: s };
    add(m);
    books.push(m);
    return m;
  }
  // 입구 양옆: 많이 찾는 도구(왼쪽)·새로 올라온 도구(오른쪽) — 한 칸에 한 권
  const sSlots = slots.filter((s) => s.wall === 1);
  const leftS = sSlots.filter((s) => s.col < doorC0).sort((a, b) => b.row - a.row || b.col - a.col);
  const rightS = sSlots.filter((s) => s.col > doorC1).sort((a, b) => b.row - a.row || a.col - b.col);
  popular.slice(0, leftS.length).forEach((t, k) => makeBook(t, leftS[k], 0));
  fresh.slice(0, rightS.length).forEach((t, k) => makeBook(t, rightS[k], 0));
  // 서쪽 벽: 가나다순, 한 칸에 두 권 (위에서 아래가 아니라 왼쪽에서 오른쪽, 칸마다 위→아래)
  const sorted = [...tools].sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title), 'ko'));
  const wSlots = slots.filter((s) => s.wall === 0).sort((a, b) => a.col - b.col || b.row - a.row);
  const plaques: { label: string; pos: THREE.Vector3 }[] = [];
  let lastIni = '';
  let lastCol = -1, colShift = 0;
  sorted.forEach((t, k) => {
    const s = wSlots[Math.floor(k / 2)];
    if (!s) return;
    makeBook(t, s, k % 2 ? 0.5 : -0.5);
    const ini = initialOf(t.title);
    if (ini !== lastIni) {
      lastIni = ini;
      colShift = s.col === lastCol ? colShift + 1 : 0;
      lastCol = s.col;
      plaques.push({ label: ini, pos: s.pos.clone().add(V(0, 0, -0.36 * colShift)) });
    }
  });
  // 남는 칸은 꾸밈 책
  const used = new Set(books.map((b) => b.userData.slot));
  slots.forEach((sl) => !used.has(sl) && decoCell(sl.pos, sl.n, sl.u));
  {
    const geo = new T.BoxGeometry(1, 1, 1);
    const im = new T.InstancedMesh(geo, std('#ffffff', { roughness: 0.6 }), deco.length);
    deco.forEach((d, i) => {
      im.setMatrixAt(i, d.m);
      im.setColorAt(i, d.c);
    });
    add(im);
  }
  // 첫 자음 팻말(칸 위쪽 가로판에 붙인 작은 흰 표)
  plaques.forEach(({ label, pos }) => {
    const m = new T.Mesh(
      new T.PlaneGeometry(0.34, 0.2),
      new T.MeshBasicMaterial({
        map: tex(96, 56, (g, w, h) => {
          g.fillStyle = '#ffffff';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#2f3a73';
          g.fillRect(0, 0, w, 6);
          g.fillStyle = '#1e2430';
          g.font = `800 32px ${FONT}`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(label, w / 2, h / 2 + 3);
        }),
      }),
    );
    m.position.set(-RX + 0.6, 4 * ROWH + 0.14, pos.z + 0.25);
    m.rotation.y = Math.PI / 2;
    add(m);
  });
  // 서가 이름판
  const signTex = (txt: string, sub: string) =>
    tex(1024, 220, (g, w, h) => {
      g.fillStyle = '#2b2f3a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c99a62';
      g.fillRect(0, h - 10, w, 10);
      g.fillStyle = '#ffffff';
      g.font = `400 86px ${DISPLAY}`;
      g.textBaseline = 'middle';
      g.fillText(txt, 40, h / 2 - 18);
      g.font = `600 36px ${FONT}`;
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillText(sub, 44, h / 2 + 58);
    });
  const sign = (txt: string, sub: string, p: THREE.Vector3, yaw: number, w = 3.4) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, (w * 220) / 1024), new T.MeshBasicMaterial({ map: signTex(txt, sub) }));
    m.position.copy(p);
    m.rotation.y = yaw;
    add(m);
  };
  sign('도구 서가', '가나다순 · 책을 누르면 도구 설명', V(-RX + 0.62, 4 * ROWH + 0.85, 7.6), Math.PI / 2);
  sign('요즘 많이 찾는 도구', '최근 30일 조회수 순', V(-RX + sOff + 3, 3 * ROWH + 0.45, RZ - 0.5), Math.PI, 3.0);
  sign('새로 올라온 도구', '게시일 순', V(RX - sOff - 3, 3 * ROWH + 0.45, RZ - 0.5), Math.PI, 3.0);

  /* 입구 문틀(회색) + LED 시계 + 유리문 */
  const gray = std('#b8bcc2', { roughness: 0.5, metalness: 0.1 });
  const frame = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = add(new T.Mesh(new T.BoxGeometry(w, h, d), gray));
    m.position.set(x, y, z);
    return m;
  };
  const DW = 5.6; // 문틀 안쪽 반폭
  frame(DW * 2 + 1.6, 2.2, 1.0, 0, 4.9, RZ - 0.5);
  frame(0.8, 3.8, 1.0, -DW - 0.4, 1.9, RZ - 0.5);
  frame(0.8, 3.8, 1.0, DW + 0.4, 1.9, RZ - 0.5);
  // 문 너머(바깥) — 낮밤 색
  const outsideM = new T.MeshBasicMaterial({ color: '#9cc3e6' });
  const outside = add(new T.Mesh(new T.PlaneGeometry(DW * 2, 3.8), outsideM));
  outside.position.set(0, 1.9, RZ + 0.4);
  outside.rotation.y = Math.PI;
  const glassM = new T.MeshStandardMaterial({ color: '#7d93a6', roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.35 });
  const steel = std('#dfe3e8', { roughness: 0.25, metalness: 0.8 });
  const leaf = (x: number) => {
    const g = new T.Group();
    g.add(new T.Mesh(new T.BoxGeometry(1.35, 3.6, 0.04), glassM));
    for (const [w, h, px, py] of [[1.4, 0.07, 0, 1.8], [1.4, 0.07, 0, -1.8], [0.07, 3.6, -0.67, 0], [0.07, 3.6, 0.67, 0]]) {
      const f = new T.Mesh(new T.BoxGeometry(w, h, 0.07), steel);
      f.position.set(px, py, 0);
      g.add(f);
    }
    // 문 가운데 띠 문구 자리(흰 띠)
    const band = new T.Mesh(new T.BoxGeometry(1.3, 0.12, 0.05), std('#ffffff'));
    band.position.y = 0.15;
    g.add(band);
    g.position.set(x, 1.85, RZ - 0.4);
    add(g);
    return g;
  };
  [-4.85, -3.5, 3.5, 4.85].forEach((x) => leaf(x));
  const doorL = leaf(-0.7), doorR = leaf(0.7);
  // 비상구 표시
  const exitSign = add(new T.Mesh(new T.BoxGeometry(0.5, 0.3, 0.08), new T.MeshBasicMaterial({ color: '#19b36b' })));
  exitSign.position.set(0, 3.95, RZ - 1.02);
  // LED 시계판
  const clockC = document.createElement('canvas');
  clockC.width = 512;
  clockC.height = 300;
  const clockT = new T.CanvasTexture(clockC);
  clockT.colorSpace = T.SRGBColorSpace;
  const clockBox = add(new T.Mesh(new T.BoxGeometry(1.75, 1.05, 0.12), std('#1b1d22')));
  clockBox.position.set(0, 4.95, RZ - 1.04);
  const clockFace = add(new T.Mesh(new T.PlaneGeometry(1.6, 0.92), new T.MeshBasicMaterial({ map: clockT, toneMapped: false })));
  clockFace.position.set(0, 4.95, RZ - 1.11);
  clockFace.rotation.y = Math.PI;
  let lastClock = '';
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  function drawClock(h: number) {
    const d = new Date(Date.now() + 9 * 3600e3);
    const date = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    const time = `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    const key = date + time;
    if (key === lastClock) return;
    lastClock = key;
    const g = clockC.getContext('2d')!;
    g.fillStyle = '#06070a';
    g.fillRect(0, 0, 512, 300);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 64px ${FONT}`;
    g.fillStyle = '#ff4d3d';
    g.fillText(date, 256, 52);
    g.fillStyle = '#3ee07a';
    g.fillText(`${DAYS[d.getUTCDay()]}요일`, 256, 128);
    g.font = `500 112px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText(time, 256, 228);
    clockT.needsUpdate = true;
  }
  // 점자 블록
  for (const z of [RZ - 1.6, RZ - 2.4]) {
    const b = add(new T.Mesh(new T.BoxGeometry(2.6, 0.02, 0.3), std('#f2c230', { roughness: 0.8 })));
    b.position.set(0, 0.012, z);
  }

  /* 나무 결 둥근 기둥 */
  const ribTex = tex(256, 64, (g, w, h) => {
    g.fillStyle = '#e2c79e';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = '#b8955f';
      g.fillRect(x, 0, 3, h);
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.fillRect(x + 5, 0, 4, h);
    }
  }, true);
  ribTex.repeat.set(6, 1);
  const colM = std('#ffffff', { map: ribTex, roughness: 0.7 });
  const COLS: [number, number][] = [[-7.4, 9.6], [7.4, 9.6], [12.6, -6.2], [-9.6, -4.6]];
  COLS.forEach(([x, z]) => {
    const c = add(new T.Mesh(new T.CylinderGeometry(0.72, 0.72, RH, 32), colM));
    c.position.set(x, RH / 2, z);
    const base = add(new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 0.12, 32), steel));
    base.position.set(x, 0.06, z);
  });

  /* 동쪽 벽: 높은 유리벽(밖이 비침) */
  const glassWallM = new T.MeshBasicMaterial({ color: '#9cc3e6' });
  const gw = add(new T.Mesh(new T.PlaneGeometry(RZ * 2, RH), glassWallM));
  gw.position.set(RX, RH / 2, 0);
  gw.rotation.y = -Math.PI / 2;
  const mull = std('#3a3f48', { roughness: 0.5, metalness: 0.4 });
  for (let z = -RZ; z <= RZ; z += 2.6) {
    const m = add(new T.Mesh(new T.BoxGeometry(0.14, RH, 0.14), mull));
    m.position.set(RX - 0.08, RH / 2, z);
  }
  for (let y = 3.5; y < RH; y += 3.5) {
    const m = add(new T.Mesh(new T.BoxGeometry(0.14, 0.14, RZ * 2), mull));
    m.position.set(RX - 0.08, y, 0);
  }

  /* 북쪽: 중층(유리 난간) + 아래 나무 천장 + 큰 화면 */
  const stone = std('#d8d2c6', { roughness: 0.8 });
  const MZ0 = -RZ, MZ1 = -7.6, MY = 5.4;
  const mez = add(new T.Mesh(new T.BoxGeometry(RX + 6, 0.6, MZ1 - MZ0), stone));
  mez.position.set((-RX + 6) / 2, MY, (MZ0 + MZ1) / 2);
  const rail = add(new T.Mesh(new T.BoxGeometry(RX + 6, 1.1, 0.04), new T.MeshStandardMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2 })));
  rail.position.set((-RX + 6) / 2, MY + 0.85, MZ1);
  const hand = add(new T.Mesh(new T.CylinderGeometry(0.03, 0.03, RX + 6, 8), steel));
  hand.rotation.z = Math.PI / 2;
  hand.position.set((-RX + 6) / 2, MY + 1.4, MZ1);
  // 중층 밑 나무 천장 + 줄 조명
  const woodCeil = tex(512, 256, (g, w, h) => {
    g.fillStyle = '#c58e55';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,50,20,.35)';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.moveTo(i * 48, 0);
      g.lineTo(i * 48 + 30, h);
      g.stroke();
    }
    g.fillStyle = '#fff6dd';
    for (let i = 0; i < 6; i++) g.fillRect(40 + i * 75, 40 + (i % 3) * 60, 60, 6);
  });
  const wc = add(new T.Mesh(new T.PlaneGeometry(RX + 6, MZ1 - MZ0), new T.MeshBasicMaterial({ map: woodCeil })));
  wc.rotation.x = Math.PI / 2;
  wc.position.set((-RX + 6) / 2, MY - 0.31, (MZ0 + MZ1) / 2);
  // 북쪽 벽 아래: 나무 판 + 큰 화면
  const panel = add(new T.Mesh(new T.PlaneGeometry(RX + 6, MY), std('#e6d3b3', { roughness: 0.8 })));
  panel.position.set((-RX + 6) / 2, MY / 2, -RZ + 0.02);
  // 큰 화면 — 데이터 도구실 홍보영상(소리 없이 반복, 단추로 소리 켬)
  const TVX = 1.4, TVY = 2.75, TVW = 7.2, TVH = 4.05;
  const bezel = add(new T.Mesh(new T.BoxGeometry(TVW + 0.24, TVH + 0.24, 0.14), std('#15171c', { roughness: 0.35, metalness: 0.3 })));
  bezel.position.set(TVX, TVY, -RZ + 0.1);
  const video = document.createElement('video');
  video.src = promoUrl;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  const vtex = new T.VideoTexture(video);
  vtex.colorSpace = T.SRGBColorSpace;
  const screenM = new T.MeshBasicMaterial({ color: '#000000', toneMapped: false });
  video.addEventListener('playing', () => {
    screenM.map = vtex;
    screenM.color.set('#ffffff');
    screenM.needsUpdate = true;
  });
  const screen = add(new T.Mesh(new T.PlaneGeometry(TVW, TVH), screenM));
  screen.position.set(TVX, TVY, -RZ + 0.18);
  // 화면 불빛이 바닥에 비침
  const glowC = document.createElement('canvas');
  glowC.width = glowC.height = 64;
  {
    const g = glowC.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(120,170,255,.5)');
    gr.addColorStop(1, 'rgba(120,170,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  const glow = add(new T.Mesh(new T.PlaneGeometry(9, 5), new T.MeshBasicMaterial({ map: new T.CanvasTexture(glowC), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.6 })));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(TVX, 0.02, -RZ + 2.4);
  const tvPos = V(TVX, 0, -RZ + 1);
  // 중층 위 벽(돌판)
  const upper = add(new T.Mesh(new T.PlaneGeometry(RX * 2, RH - MY), std('#e2ddd3', { roughness: 0.85 })));
  upper.position.set(0, MY + (RH - MY) / 2, -RZ + 0.01);

  /* 돌계단(중층으로 올라가는 굵은 돌 계단) — 올라갈 수는 없음 */
  const STX0 = -6.2, STX1 = -2.2, STZ0 = 2.0, STZ1 = MZ1;
  {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const z = STZ0 - ((STZ0 - STZ1) * (i + 0.5)) / n, y = (MY * (i + 1)) / n;
      const s = add(new T.Mesh(new T.BoxGeometry(STX1 - STX0, 0.12, (STZ0 - STZ1) / n + 0.02), stone));
      s.position.set((STX0 + STX1) / 2, y - 0.06, z);
    }
    const len = Math.hypot(STZ0 - STZ1, MY);
    for (const x of [STX0 - 0.2, STX1 + 0.2]) {
      const sl = add(new T.Mesh(new T.BoxGeometry(0.4, 1.2, len), stone));
      sl.position.set(x, MY / 2 - 0.2, (STZ0 + STZ1) / 2);
      sl.rotation.x = Math.atan2(MY, STZ0 - STZ1);
    }
    const under = add(new T.Mesh(new T.BoxGeometry(STX1 - STX0 + 0.8, 0.5, len), std('#f0eeea')));
    under.position.set((STX0 + STX1) / 2, MY / 2 - 0.55, (STZ0 + STZ1) / 2);
    under.rotation.x = Math.atan2(MY, STZ0 - STZ1);
    // 계단 밑 화단
    const bed = add(new T.Mesh(new T.BoxGeometry(3.6, 0.35, 2.4), std('#5a3a22', { roughness: 1 })));
    bed.position.set((STX0 + STX1) / 2, 0.18, -2.6);
    const r = seeded(31);
    for (let i = 0; i < 9; i++) {
      const p = add(new T.Mesh(new T.IcosahedronGeometry(0.25 + r() * 0.15, 0), new T.MeshLambertMaterial({ color: ['#4f8a43', '#6aa84f', '#3d7a3a'][i % 3], flatShading: true })));
      p.position.set(STX0 + 0.5 + r() * 3, 0.5, -3.5 + r() * 1.8);
    }
  }

  /* 쉼터: 초록·흰 둥근 의자, 긴 흰 소파, 낮은 탁자, 빨간 우체통 */
  {
    const green = toon('#9ccc3c'), white = toon('#f3efe6');
    const pouf = (x: number, z: number, m: THREE.Material, r = 0.45, h = 0.42) => {
      const o = add(new T.Mesh(new T.CylinderGeometry(r, r * 1.04, h, 24), m));
      o.position.set(x, h / 2, z);
      const top = add(new T.Mesh(new T.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), m));
      top.scale.y = 0.25;
      top.position.set(x, h, z);
    };
    pouf(6.5, -9.0, green, 0.55);
    pouf(7.6, -8.4, green, 0.45);
    pouf(8.7, -9.2, white, 0.4);
    pouf(10.8, -8.8, white, 0.4);
    const sofa = add(new T.Mesh(new T.CapsuleGeometry(0.42, 2.6, 6, 16), white));
    sofa.rotation.z = Math.PI / 2;
    sofa.position.set(11.6, 0.42, -10.6);
    const back = add(new T.Mesh(new T.CapsuleGeometry(0.3, 2.4, 6, 16), white));
    back.rotation.z = Math.PI / 2;
    back.position.set(11.6, 0.85, -11.1);
    const table = add(new T.Mesh(new T.CylinderGeometry(0.45, 0.4, 0.4, 24), toon('#c99a62')));
    table.position.set(9.6, 0.2, -9.6);
    const mail = add(new T.Mesh(new T.BoxGeometry(0.5, 1.2, 0.45), toon('#d8262b')));
    mail.position.set(4.6, 0.6, -11.8);
  }

  /* 안내 데스크(INFORMATION) — 입구 동쪽, 방 가운데를 봄 */
  const DX = 11.6, DZ0 = -1.2, DZ1 = 4.2;
  {
    const counter = add(new T.Mesh(new T.BoxGeometry(0.7, 1.05, DZ1 - DZ0), std('#e9e1d5', { roughness: 0.7 })));
    counter.position.set(DX, 0.53, (DZ0 + DZ1) / 2);
    const slat = tex(256, 64, (g, w, h) => {
      g.fillStyle = '#ddd2c2';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) {
        g.fillStyle = 'rgba(120,100,80,.25)';
        g.fillRect(x, 0, 2, h);
      }
    }, true);
    slat.repeat.set(4, 1);
    const front = add(new T.Mesh(new T.PlaneGeometry(DZ1 - DZ0, 1.0), std('#ffffff', { map: slat })));
    front.position.set(DX - 0.36, 0.5, (DZ0 + DZ1) / 2);
    front.rotation.y = -Math.PI / 2;
    const top = add(new T.Mesh(new T.BoxGeometry(0.9, 0.06, DZ1 - DZ0 + 0.1), std('#fafafa', { roughness: 0.3 })));
    top.position.set(DX - 0.05, 1.08, (DZ0 + DZ1) / 2);
    // 나무 틀(지붕·옆벽·뒷벽)
    const wd = toon('#b88a58');
    const roof = add(new T.Mesh(new T.BoxGeometry(3.0, 0.5, DZ1 - DZ0 + 0.6), wd));
    roof.position.set(DX + 1.0, 3.1, (DZ0 + DZ1) / 2);
    for (const z of [DZ0 - 0.25, DZ1 + 0.25]) {
      const side = add(new T.Mesh(new T.BoxGeometry(3.0, 3.35, 0.4), wd));
      side.position.set(DX + 1.0, 1.68, z);
    }
    const backW = add(new T.Mesh(new T.BoxGeometry(0.2, 3.0, DZ1 - DZ0), std('#efe9df')));
    backW.position.set(DX + 2.4, 1.5, (DZ0 + DZ1) / 2);
    const infoT = tex(1024, 140, (g, w, h) => {
      g.fillStyle = '#b88a58';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f7f4ee';
      g.font = `800 92px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('INFORMATION', w / 2, h / 2 + 4);
    });
    const info = add(new T.Mesh(new T.PlaneGeometry(DZ1 - DZ0 + 0.6, 0.48), new T.MeshBasicMaterial({ map: infoT })));
    info.position.set(DX - 0.51, 3.1, (DZ0 + DZ1) / 2);
    info.rotation.y = -Math.PI / 2;
    // 화분
    const pot = add(new T.Mesh(new T.CylinderGeometry(0.25, 0.2, 0.6, 16), toon('#ffffff')));
    pot.position.set(DX - 0.9, 0.3, DZ0 - 0.6);
    const leaf2 = add(new T.Mesh(new T.IcosahedronGeometry(0.55, 0), new T.MeshLambertMaterial({ color: '#4f8a43', flatShading: true })));
    leaf2.position.set(DX - 0.9, 1.3, DZ0 - 0.6);
  }
  // 안내 직원
  const npc: Chibi = makeChibi({ skin: '#ffdcc4', hair: '#3d2b22', style: 'bob', top: '#3a457f', inner: '#ffffff', pants: '#3b4256', tie: '#e8554e', glasses: false, prop: 'tablet' });
  const npcPos = V(DX + 0.6, 0, (DZ0 + DZ1) / 2);
  npc.root.position.copy(npcPos);
  npc.root.scale.setScalar(1.2);
  npc.root.rotation.y = -Math.PI / 2;
  add(npc.root);
  // f: 직원 → 방 쪽, r: 방에서 데스크를 볼 때 오른쪽
  const f = V(-1, 0, 0), r = V(0, 0, 1);
  const deskSpot = npcPos.clone().add(f.clone().multiplyScalar(1.75)).add(r.clone().multiplyScalar(-0.85));

  /* 움직일 수 있는 곳 */
  const RAD = 0.36;
  function blocked(x: number, z: number) {
    if (x < -RX + 0.9 + RAD || x > RX - 0.3 - RAD || z < -RZ + 0.5 + RAD) return true;
    if (z > RZ - 1.1 - RAD && Math.abs(x) > DW - 0.2) return true;
    if (z > RZ - 0.6) return Math.abs(x) > DW - 0.4; // 문 쪽으로는 나가기 구역
    if (x > DX - 0.45 - RAD && z > DZ0 - 0.5 - RAD && z < DZ1 + 0.5 + RAD) return true;
    for (const [cx, cz] of COLS) if (Math.hypot(x - cx, z - cz) < 0.75 + RAD) return true;
    if (x > STX0 - 0.45 - RAD && x < STX1 + 0.45 + RAD && z < STZ0 + RAD && z > -3.9 - RAD) return true;
    if (x > 5.8 - RAD && z < -7.6 + RAD && z > -RZ) return true; // 쉼터
    if (z < MZ1 && x > STX0 - 1 && x < STX1 + 1) return true;
    return false;
  }
  const isExit = (x: number, z: number) => z > RZ - 0.5 && Math.abs(x) < DW;
  const camBox = { x0: -RX + 1.2, x1: RX - 0.6, z0: -RZ + 0.6, z1: RZ - 1.4, y1: RH - 0.6 };

  /* 매 장면 */
  let doorK = 0;
  function update(dt: number, t: number, player: THREE.Vector3, hourShown: number) {
    drawClock(hourShown);
    const want = player.z > RZ - 4.5 && Math.abs(player.x) < DW + 1 ? 1 : 0;
    doorK += (want - doorK) * Math.min(1, dt * 5);
    doorL.position.x = -0.7 - doorK * 1.3;
    doorR.position.x = 0.7 + doorK * 1.3;
    for (const b of books) {
      const u = b.userData;
      const glowT = u.glow > 0 ? 0.55 + 0.45 * Math.sin(t * 5 + u.home.x) : 0;
      b.material[4].emissiveIntensity = glowT * 0.55;
    }
  }
  function setOutside(sky: THREE.Color, dark: number) {
    outsideM.color.copy(sky).lerp(new T.Color('#0b1020'), dark * 0.6);
    glassWallM.color.copy(sky).lerp(new T.Color('#0b1020'), dark * 0.5);
  }

  return {
    video,
    tvPos,
    scene,
    floor,
    books,
    npc,
    npcPos,
    anchor: { npc, npcPos, f, r },
    deskSpot,
    spawn: { pos: V(0, 0, RZ - 2.6), yaw: Math.PI },
    blocked,
    isExit,
    camBox,
    update,
    setOutside,
  };
}
export type Lobby = ReturnType<typeof makeLobby>;
