/**
 * 3D 광장 — 천막 마당 한가운데 「명예의 전당」
 *  - 시상대: 최근 7일 조회수가 가장 많은 도구 1·2·3위(트로피 + 이름판)
 *  - 뒤 판: 인기 제작자(최근 7일, 만든 도구 조회수 합계) 1~10위
 *  - 청사 게이트타워 전광판에 띄울 「최근 7일 인기 도구 TOP 5」 그림도 여기서 만듦
 * 좌표: 받은 group을 마당 가운데에 두고, 앞(+z)이 시작 자리 쪽을 보게 돌려서 씀
 */
import * as THREE from 'three';
import { toon } from './chibi';

export interface FameData {
  /** 최근 7일 인기 도구(많은 순) */
  top: { title: string; who: string; n: number }[];
  /** 최근 7일 인기 제작자(많은 순) */
  makers: { person: string; org: string; n: number }[];
}

const FONT = "'Plaza SUIT', 'SUIT Variable', 'Pretendard Variable', 'Noto Sans CJK KR', sans-serif";
const DISPLAY = "'Plaza Edu', 'Plaza SUIT', 'Noto Sans CJK KR', sans-serif";
const n = (v: number) => v.toLocaleString('ko-KR');

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
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
/** 글이 길면 줄여서 … */
function fit(g: CanvasRenderingContext2D, s: string, w: number) {
  if (g.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1);
  return t + '…';
}
/** 두 줄까지 나눠 쓰기 */
function wrap2(g: CanvasRenderingContext2D, s: string, w: number) {
  if (g.measureText(s).width <= w) return [s];
  const words = s.split(/(\s+)/);
  let a = '';
  let i = 0;
  for (; i < words.length; i++) {
    if (g.measureText(a + words[i]).width > w && a.trim()) break;
    a += words[i];
  }
  if (!a.trim()) return [fit(g, s, w)];
  return [a.trim(), fit(g, words.slice(i).join('').trim(), w)].filter(Boolean);
}

const MEDAL = [
  { cup: '#f2c14e', dark: '#b8861b', label: '1위' },
  { cup: '#cfd6de', dark: '#8e98a3', label: '2위' },
  { cup: '#d99a5b', dark: '#9c6430', label: '3위' },
];

/** 시상대 이름판 */
function plateTex(rank: number, t?: { title: string; who: string; n: number }) {
  return canvas(640, 400, (g) => {
    const m = MEDAL[rank];
    g.fillStyle = 'rgba(13,24,48,0.92)';
    rr(g, 6, 6, 628, 388, 34);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = m.cup;
    g.stroke();
    g.fillStyle = m.cup;
    rr(g, 36, 34, 132, 70, 35);
    g.fill();
    g.fillStyle = '#1a1406';
    g.font = `900 46px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(m.label, 102, 71);
    g.textAlign = 'left';
    g.fillStyle = '#bff3ff';
    g.font = `700 30px ${FONT}`;
    g.fillText('최근 7일 조회', 190, 71);
    if (!t) {
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.font = `700 40px ${FONT}`;
      g.fillText('아직 없음', 40, 200);
      return;
    }
    g.fillStyle = '#ffffff';
    g.font = `800 48px ${FONT}`;
    const lines = wrap2(g, t.title, 560);
    lines.forEach((s, i) => g.fillText(s, 40, 168 + i * 62));
    g.fillStyle = 'rgba(205,238,255,.85)';
    g.font = `600 30px ${FONT}`;
    g.fillText(fit(g, t.who, 360), 40, 336);
    g.textAlign = 'right';
    g.fillStyle = m.cup;
    g.font = `900 52px ${FONT}`;
    g.fillText(`${n(t.n)}회`, 600, 334);
  });
}

/** 뒤 판: 인기 제작자 1~10위 */
function boardTex(d: FameData) {
  return canvas(1200, 1000, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 1000);
    gr.addColorStop(0, '#16285a');
    gr.addColorStop(1, '#0c1838');
    g.fillStyle = gr;
    rr(g, 0, 0, 1200, 1000, 40);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#f2c14e';
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f2c14e';
    g.font = `400 84px ${DISPLAY}`;
    g.fillText('명예의 전당', 600, 96);
    g.fillStyle = '#cdeeff';
    g.font = `700 38px ${FONT}`;
    g.fillText('인기 제작자 · 최근 7일 만든 도구 조회수 합계', 600, 168);
    g.textAlign = 'left';
    const rows = d.makers.slice(0, 10);
    if (!rows.length) {
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.font = `700 44px ${FONT}`;
      g.fillText('아직 집계가 없습니다', 80, 420);
    }
    rows.forEach((m, i) => {
      const y = 250 + i * 72;
      if (i % 2 === 0) {
        g.fillStyle = 'rgba(255,255,255,.05)';
        g.fillRect(50, y - 32, 1100, 64);
      }
      g.fillStyle = i < 3 ? MEDAL[i].cup : 'rgba(255,255,255,.7)';
      g.font = `900 44px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(String(i + 1), 110, y);
      g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      g.font = `800 42px ${FONT}`;
      const name = fit(g, m.person, 330);
      g.fillText(name, 170, y);
      const nw = g.measureText(name).width;
      g.fillStyle = 'rgba(205,238,255,.7)';
      g.font = `600 30px ${FONT}`;
      g.fillText(fit(g, m.org, 520 - nw), 190 + nw, y + 2);
      g.textAlign = 'right';
      g.fillStyle = '#bff3ff';
      g.font = `800 40px ${FONT}`;
      g.fillText(`${n(m.n)}회`, 1130, y);
    });
  });
}

/** 청사 전광판: 최근 7일 인기 도구 TOP 5 (전광판 판 크기 14×9 비율) */
export function ledTopTex(d: FameData) {
  return canvas(1400, 900, (g) => {
    const gr = g.createLinearGradient(0, 0, 1400, 900);
    gr.addColorStop(0, '#2a3fb0');
    gr.addColorStop(1, '#16237a');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1400, 900);
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#ffd84a';
    g.font = `400 92px ${DISPLAY}`;
    g.fillText('최근 7일 인기 도구 TOP 5', 700, 104);
    const rows = d.top.slice(0, 5);
    rows.forEach((t, i) => {
      const y = 250 + i * 136;
      g.fillStyle = i < 3 ? MEDAL[i].cup : '#9fc2ff';
      g.beginPath();
      g.arc(120, y, 46, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0e1a4a';
      g.font = `900 58px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(String(i + 1), 120, y + 2);
      g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      g.font = `800 62px ${FONT}`;
      g.fillText(fit(g, t.title, 900), 200, y);
      g.textAlign = 'right';
      g.fillStyle = '#bff3ff';
      g.font = `800 54px ${FONT}`;
      g.fillText(`${n(t.n)}회`, 1330, y);
    });
    if (!rows.length) {
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.font = `700 60px ${FONT}`;
      g.fillText('집계 중입니다', 700, 470);
    }
  });
}

/** 트로피(돌려 깎은 잔 + 손잡이 + 받침) */
function trophy(col: string, dark: string) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: col, metalness: 0.75, roughness: 0.28, emissive: new THREE.Color(col), emissiveIntensity: 0.08 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), toon('#3a2a1e'));
  base.position.y = 0.11;
  g.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.42, 16), gold);
  stem.position.y = 0.43;
  g.add(stem);
  const pts = [
    [0.0, 0],
    [0.16, 0.02],
    [0.3, 0.16],
    [0.36, 0.42],
    [0.38, 0.62],
    [0.35, 0.64],
    [0.33, 0.44],
    [0.27, 0.2],
    [0.0, 0.1],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), gold);
  cup.position.y = 0.62;
  g.add(cup);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 8, 20, Math.PI * 1.2), gold);
    h.position.set(s * 0.38, 1.0, 0);
    h.rotation.z = s > 0 ? -Math.PI * 0.6 : Math.PI * 1.6;
    g.add(h);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: dark, metalness: 0.6, roughness: 0.4 }));
  plate.position.set(0, 0.12, 0.315);
  g.add(plate);
  return { g, gold };
}

export function makeFame(d: FameData, shadows: boolean) {
  const group = new THREE.Group();
  const hit: THREE.Object3D[] = [];
  const glow: THREE.Material[] = [];
  // 둥근 단(돌) + 금색 테
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.7, 0.36, 48), toon('#d8cdb6'));
  dais.position.y = 0.18;
  dais.receiveShadow = shadows;
  group.add(dais);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.42, 0.06, 6, 64), new THREE.MeshStandardMaterial({ color: '#d9a93a', metalness: 0.7, roughness: 0.35 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.37;
  group.add(rim);
  // 시상대: 2위(왼쪽)·1위(가운데)·3위(오른쪽)
  const steps = [
    { rank: 1, x: -1.55, h: 0.75 },
    { rank: 0, x: 0, h: 1.15 },
    { rank: 2, x: 1.55, h: 0.5 },
  ];
  const trophies: THREE.Group[] = [];
  for (const s of steps) {
    const m = MEDAL[s.rank];
    const blk = new THREE.Mesh(new THREE.BoxGeometry(1.5, s.h, 1.5), toon('#f4f1ea'));
    blk.position.set(s.x, 0.36 + s.h / 2, 0.6);
    blk.castShadow = blk.receiveShadow = shadows;
    group.add(blk);
    const t = trophy(m.cup, m.dark);
    t.g.position.set(s.x, 0.36 + s.h, 0.6);
    t.g.scale.setScalar(s.rank === 0 ? 1.25 : 1.05);
    t.g.traverse((o) => ((o as THREE.Mesh).castShadow = shadows));
    group.add(t.g);
    trophies.push(t.g);
    glow.push(t.gold);
    // 이름판: 단 앞에 비스듬히 세운 안내판(순위·도구 이름·조회수)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.9), new THREE.MeshBasicMaterial({ map: plateTex(s.rank, d.top[s.rank]), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    plate.position.set(s.x, 0.95, 2.05);
    plate.rotation.x = -0.32;
    group.add(plate);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), toon('#2b2f3a'));
    leg.position.set(s.x, 0.62, 1.98);
    group.add(leg);
    [blk, t.g, plate].forEach((o) => {
      o.userData.fame = true;
      hit.push(o);
    });
  }
  // 뒤 판: 인기 제작자
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.83), new THREE.MeshBasicMaterial({ map: boardTex(d), side: THREE.DoubleSide, toneMapped: false }));
  board.position.set(0, 4.75, -2.3);
  board.userData.fame = true;
  hit.push(board);
  group.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.85, 4.08, 0.18), toon('#2b2f3a'));
  frame.position.set(0, 4.75, -2.41);
  group.add(frame);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.8, 0.22), toon('#2b2f3a'));
    post.position.set(s * 2.25, 3.4, -2.43);
    post.castShadow = shadows;
    group.add(post);
  }
  return {
    group,
    hit,
    /** 매 장면: 트로피 천천히 돌기, 밤에 반짝 */
    update(t: number, dark: number) {
      trophies.forEach((o, i) => (o.rotation.y = Math.sin(t * 0.6 + i) * 0.35));
      for (const m of glow) (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.08 + dark * 0.45;
    },
  };
}
