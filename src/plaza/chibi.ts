// @ts-nocheck
/* 귀여운 교직원 캐릭터(2.5등신) — 큰 머리, 짧은 팔다리, 목걸이 공무원증.
 * 블렌더 모델 없이 기본 도형으로 만들어 가볍게 둠. 앞쪽이 +z
 */
import * as THREE from 'three';

export interface ChibiOpt {
  skin: string;
  hair: string;
  style: 'short' | 'bob' | 'pony' | 'bun' | 'curly' | 'side';
  top: string;
  inner?: string;
  pants: string;
  tie?: string | null;
  glasses?: boolean;
  prop?: string;
  hat?: 'chef' | 'cap' | null;
  capColor?: string;
}

let GRAD: THREE.Texture | null = null;
/** 만화풍 3단 음영 */
export function toonGrad() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  GRAD = t;
  return t;
}
const cache = new Map<string, THREE.Material>();
export const toon = (c: string, o: Record<string, unknown> = {}) => {
  const k = c + JSON.stringify(o);
  if (!cache.has(k)) cache.set(k, new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad(), ...o }));
  return cache.get(k)!;
};

const S = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
function m(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

/** 손에 든 물건 — 천막(업무)마다 다름 */
function prop(kind: string) {
  const g = new THREE.Group();
  const add = (o) => (g.add(o), o);
  switch (kind) {
    case 'laptop': {
      add(m(new THREE.BoxGeometry(0.26, 0.016, 0.18), toon('#c9ced6')));
      const sc = add(m(new THREE.BoxGeometry(0.26, 0.17, 0.012), toon('#c9ced6'), 0, 0.085, -0.09));
      sc.rotation.x = -0.25;
      const s2 = add(m(new THREE.PlaneGeometry(0.22, 0.13), toon('#3fbf7f', { emissive: '#1f8f5f', emissiveIntensity: 0.6 }), 0, 0.085, -0.082));
      s2.rotation.x = -0.25;
      g.rotation.set(0.9, 0, 0);
      g.position.set(0, -0.02, 0.1);
      break;
    }
    case 'doc': {
      for (let i = 0; i < 3; i++) add(m(new THREE.BoxGeometry(0.2, 0.26, 0.008), toon(i ? '#ffffff' : '#e9eef5'), i * 0.012, i * 0.01, i * 0.01));
      add(m(new THREE.BoxGeometry(0.12, 0.01, 0.01), toon('#3480cc'), 0.02, 0.08, 0.036));
      add(m(new THREE.BoxGeometry(0.14, 0.01, 0.01), toon('#9aa7b8'), 0.02, 0.04, 0.036));
      add(m(new THREE.BoxGeometry(0.1, 0.01, 0.01), toon('#9aa7b8'), 0.02, 0.0, 0.036));
      g.position.set(0.02, 0.0, 0.08);
      g.rotation.set(0.3, -0.3, 0);
      break;
    }
    case 'stamp': {
      add(m(new THREE.CylinderGeometry(0.035, 0.04, 0.12, 12), toon('#8a5a3c'), 0, 0.06, 0));
      add(m(S(0.045, 12, 8), toon('#8a5a3c'), 0, 0.13, 0));
      add(m(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14), toon('#d23b3b'), 0, -0.005, 0));
      g.position.set(0, -0.04, 0.05);
      break;
    }
    case 'box': {
      add(m(new THREE.BoxGeometry(0.3, 0.22, 0.24), toon('#c8955b')));
      add(m(new THREE.BoxGeometry(0.305, 0.03, 0.06), toon('#e3c08a'), 0, 0.1, 0));
      g.position.set(-0.12, 0.02, 0.18);
      break;
    }
    case 'folder': {
      add(m(new THREE.BoxGeometry(0.26, 0.2, 0.02), toon('#f2c14e')));
      add(m(new THREE.BoxGeometry(0.1, 0.03, 0.022), toon('#e0a92e'), -0.07, 0.11, 0));
      g.position.set(0, -0.02, 0.08);
      g.rotation.set(0.2, -0.4, 0);
      break;
    }
    case 'tablet': {
      add(m(new THREE.BoxGeometry(0.2, 0.27, 0.014), toon('#2b3240')));
      add(m(new THREE.PlaneGeometry(0.17, 0.23), toon('#7fc4ff', { emissive: '#3a8fe0', emissiveIntensity: 0.6 }), 0, 0, 0.008));
      g.position.set(0, 0, 0.09);
      g.rotation.set(0.35, -0.3, 0);
      break;
    }
    case 'book': {
      add(m(new THREE.BoxGeometry(0.2, 0.26, 0.05), toon('#d9534f')));
      add(m(new THREE.BoxGeometry(0.19, 0.25, 0.042), toon('#fff8ea'), 0.006, 0, 0));
      g.position.set(0, 0, 0.08);
      g.rotation.set(0.2, -0.5, 0);
      break;
    }
    case 'calendar': {
      add(m(new THREE.BoxGeometry(0.22, 0.24, 0.01), toon('#ffffff')));
      add(m(new THREE.BoxGeometry(0.22, 0.06, 0.012), toon('#e8554e'), 0, 0.09, 0.001));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) add(m(new THREE.BoxGeometry(0.03, 0.025, 0.004), toon(i === 1 && j === 2 ? '#e8554e' : '#c7cfdb'), -0.07 + j * 0.047, 0.02 - i * 0.045, 0.007));
      g.position.set(0, 0, 0.08);
      g.rotation.set(0.25, -0.35, 0);
      break;
    }
    case 'magnifier': {
      add(m(new THREE.TorusGeometry(0.07, 0.014, 8, 24), toon('#3a457f')));
      const lens = add(m(new THREE.CircleGeometry(0.07, 24), new THREE.MeshToonMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.5, gradientMap: toonGrad() })));
      lens.castShadow = false;
      const h = add(m(new THREE.CylinderGeometry(0.016, 0.02, 0.14, 8), toon('#3a457f'), 0, -0.14, 0));
      h.rotation.z = 0;
      g.position.set(0, 0.12, 0.05);
      g.rotation.set(0, -0.4, 0.3);
      break;
    }
    case 'toolbox': {
      add(m(new THREE.BoxGeometry(0.3, 0.15, 0.15), toon('#e8554e')));
      add(m(new THREE.BoxGeometry(0.31, 0.02, 0.155), toon('#b93c36'), 0, 0.04, 0));
      const h = add(m(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), toon('#3b3f4a'), 0, 0.075, 0));
      h.rotation.y = Math.PI / 2;
      g.position.set(0, -0.12, 0.02);
      break;
    }
    case 'calc': {
      add(m(new THREE.BoxGeometry(0.16, 0.22, 0.03), toon('#3b4256')));
      add(m(new THREE.BoxGeometry(0.12, 0.05, 0.006), toon('#bfe8c8', { emissive: '#4f9f6a', emissiveIntensity: 0.3 }), 0, 0.065, 0.017));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) add(m(new THREE.BoxGeometry(0.03, 0.025, 0.008), toon(j === 2 && i === 2 ? '#f08a24' : '#e9edf3'), -0.04 + j * 0.04, 0.0 - i * 0.04, 0.018));
      g.position.set(0, 0, 0.08);
      g.rotation.set(0.3, -0.3, 0);
      break;
    }
    case 'coins': {
      for (let i = 0; i < 4; i++) add(m(new THREE.CylinderGeometry(0.05, 0.05, 0.018, 16), toon('#f2b632'), 0, i * 0.02, 0));
      add(m(new THREE.BoxGeometry(0.2, 0.012, 0.14), toon('#4f8f5a'), 0, -0.016, 0));
      g.position.set(0, -0.03, 0.08);
      break;
    }
    case 'clipboard': {
      add(m(new THREE.BoxGeometry(0.2, 0.27, 0.012), toon('#b7863a')));
      add(m(new THREE.BoxGeometry(0.17, 0.21, 0.006), toon('#ffffff'), 0, -0.015, 0.008));
      add(m(new THREE.BoxGeometry(0.08, 0.03, 0.02), toon('#9aa1aa'), 0, 0.125, 0.008));
      g.position.set(0, 0, 0.08);
      g.rotation.set(0.25, -0.35, 0);
      break;
    }
    case 'ladle': {
      add(m(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), toon('#c9ced6'), 0, 0.1, 0));
      const b = add(m(new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#c9ced6'), 0, -0.06, 0));
      b.material = toon('#c9ced6', { side: THREE.DoubleSide });
      g.position.set(0, 0.05, 0.05);
      g.rotation.set(0.2, 0, -0.3);
      break;
    }
    case 'megaphone': {
      const c = add(m(new THREE.CylinderGeometry(0.09, 0.035, 0.22, 14, 1, true), toon('#f08a24', { side: THREE.DoubleSide })));
      c.rotation.x = Math.PI / 2;
      c.position.z = 0.12;
      add(m(new THREE.BoxGeometry(0.03, 0.08, 0.03), toon('#3b3f4a'), 0, -0.05, 0.02));
      g.position.set(0, 0.02, 0.02);
      g.rotation.set(-0.3, 0, 0);
      break;
    }
    case 'mug': {
      add(m(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 14), toon('#ffffff')));
      const h = add(m(new THREE.TorusGeometry(0.03, 0.01, 6, 12), toon('#ffffff'), 0.055, 0, 0));
      h.rotation.y = 0;
      add(m(new THREE.CylinderGeometry(0.045, 0.045, 0.005, 14), toon('#6b4226'), 0, 0.045, 0));
      g.position.set(0, 0.0, 0.06);
      break;
    }
    default:
      break;
  }
  return g;
}

export interface Chibi {
  root: THREE.Group;
  head: THREE.Group;
  body: THREE.Mesh;
  eyes: THREE.Mesh[];
  mouth: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** 걸음 위상 */
  phase: number;
  blinkT: number;
  wave: number;
  talk: number;
  hop: number;
}

export function makeChibi(o: ChibiOpt): Chibi {
  const root = new THREE.Group();
  const skin = toon(o.skin), hairM = toon(o.hair), top = toon(o.top), pants = toon(o.pants);
  const inner = toon(o.inner ?? '#ffffff');
  // 다리
  const leg = (x: number) => {
    const p = new THREE.Group();
    p.position.set(x, 0.3, 0);
    p.add(m(new THREE.CapsuleGeometry(0.072, 0.12, 4, 10), pants, 0, -0.12, 0));
    const shoe = m(S(0.085, 14, 10), toon('#3b3f4a'), 0, -0.255, 0.03);
    shoe.scale.set(1, 0.6, 1.35);
    p.add(shoe);
    root.add(p);
    return p;
  };
  const legL = leg(0.095), legR = leg(-0.095);
  // 몸통
  const body = m(new THREE.CapsuleGeometry(0.2, 0.2, 6, 16), top, 0, 0.53, 0);
  body.scale.set(1, 1, 0.86);
  root.add(body);
  root.add(m(new THREE.CylinderGeometry(0.2, 0.185, 0.13, 18), pants, 0, 0.33, 0));
  // 깃·속옷 (앞섶)
  const shirt = m(S(0.11, 14, 10), inner, 0, 0.73, 0.12);
  shirt.scale.set(1, 0.55, 0.5);
  root.add(shirt);
  const placket = m(new THREE.BoxGeometry(0.07, 0.36, 0.02), inner, 0, 0.55, 0.168);
  placket.rotation.x = -0.05;
  root.add(placket);
  if (o.tie) {
    const tie = m(new THREE.BoxGeometry(0.04, 0.15, 0.015), toon(o.tie), 0, 0.62, 0.185);
    root.add(tie);
    const knot = m(S(0.022, 8, 6), toon(o.tie), 0, 0.705, 0.18);
    root.add(knot);
  }
  // 목걸이 공무원증
  const strap = toon('#2f6fb3');
  for (const s of [-1, 1]) {
    const c = m(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), strap, s * 0.055, 0.7, 0.165);
    c.rotation.z = s * 0.38;
    c.rotation.x = -0.25;
    root.add(c);
  }
  root.add(m(new THREE.BoxGeometry(0.1, 0.13, 0.012), toon('#ffffff'), 0, 0.565, 0.2));
  root.add(m(new THREE.BoxGeometry(0.1, 0.034, 0.014), toon('#3480cc'), 0, 0.615, 0.2));
  root.add(m(new THREE.BoxGeometry(0.035, 0.042, 0.014), toon('#ffd9b8'), -0.022, 0.565, 0.202));

  // 머리
  const head = new THREE.Group();
  head.position.y = 0.8;
  root.add(head);
  const HC = 0.37;
  head.add(m(S(0.36, 32, 24), skin, 0, HC, 0));
  for (const s of [-1, 1]) head.add(m(S(0.055, 10, 8), skin, s * 0.352, HC - 0.03, 0));
  // 머리카락
  const cap = m(new THREE.SphereGeometry(0.382, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM, 0, HC, 0);
  cap.rotation.x = -0.42;
  head.add(cap);
  const back = m(S(0.37, 24, 16), hairM, 0, HC + 0.01, -0.06);
  back.scale.set(1.0, 0.95, 0.9);
  head.add(back);
  if (o.style === 'side') {
    const b = m(S(0.2, 16, 10), hairM, 0.12, HC + 0.24, 0.22);
    b.scale.set(1.4, 0.5, 0.7);
    b.rotation.z = -0.35;
    head.add(b);
  } else if (o.style !== 'curly') {
    for (const x of [-0.15, 0, 0.15]) {
      const b = m(S(0.12, 14, 10), hairM, x, HC + 0.22 - Math.abs(x) * 0.25, 0.25 - Math.abs(x) * 0.25);
      b.scale.set(1.1, 0.55, 0.65);
      head.add(b);
    }
  }
  if (o.style === 'bob') {
    for (const s of [-1, 1]) {
      const b = m(S(0.2, 16, 12), hairM, s * 0.29, HC - 0.06, -0.04);
      b.scale.set(0.62, 1.15, 0.95);
      head.add(b);
    }
  }
  if (o.style === 'pony') {
    head.add(m(S(0.11, 12, 8), toon('#e8554e'), 0, HC + 0.04, -0.37));
    const tail = m(S(0.12, 14, 10), hairM, 0, HC - 0.16, -0.42);
    tail.scale.set(0.85, 1.7, 0.8);
    head.add(tail);
  }
  if (o.style === 'bun') head.add(m(S(0.15, 16, 12), hairM, 0, HC + 0.34, -0.12));
  if (o.style === 'curly') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      head.add(m(S(0.1, 10, 8), hairM, Math.cos(a) * 0.28, HC + 0.25 + Math.sin(i * 1.7) * 0.02, Math.sin(a) * 0.24 - 0.03));
    }
    head.add(m(S(0.14, 12, 8), hairM, 0, HC + 0.36, 0));
  }
  // 얼굴
  const eyeM = toon('#1f2430');
  const eyes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const e = m(S(0.045, 14, 10), eyeM, s * 0.125, HC - 0.02, 0.322);
    e.scale.set(1, 1.35, 0.6);
    head.add(e);
    eyes.push(e);
    const hl = m(S(0.015, 8, 6), toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 }), s * 0.125 + 0.016, HC + 0.012, 0.36);
    hl.castShadow = false;
    e.userData.hl = hl;
    head.add(hl);
    const brow = m(new THREE.BoxGeometry(0.07, 0.014, 0.01), hairM, s * 0.125, HC + 0.085, 0.335);
    brow.rotation.z = s * -0.12;
    head.add(brow);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: '#ff8fa0', transparent: true, opacity: 0.5, depthWrite: false }));
    blush.position.set(s * 0.215, HC - 0.095, 0.29);
    blush.lookAt(blush.position.clone().multiplyScalar(2).setY(HC - 0.095 + 0.0));
    blush.position.y += 0;
    head.add(blush);
  }
  const mouth = m(new THREE.TorusGeometry(0.034, 0.009, 6, 16, Math.PI), toon('#8a3b3b'), 0, HC - 0.115, 0.344);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
  if (o.glasses) {
    const gm = toon('#2b2f3a');
    for (const s of [-1, 1]) head.add(m(new THREE.TorusGeometry(0.068, 0.009, 6, 20), gm, s * 0.125, HC - 0.015, 0.352));
    head.add(m(new THREE.BoxGeometry(0.06, 0.01, 0.01), gm, 0, HC - 0.005, 0.36));
  }
  if (o.hat === 'chef') {
    head.add(m(new THREE.CylinderGeometry(0.25, 0.27, 0.16, 20), toon('#ffffff'), 0, HC + 0.36, -0.02));
    const puff = m(S(0.27, 18, 12), toon('#ffffff'), 0, HC + 0.5, -0.02);
    puff.scale.set(1.05, 0.7, 1.05);
    head.add(puff);
  }
  if (o.hat === 'cap') {
    const c = m(new THREE.SphereGeometry(0.39, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(o.capColor ?? '#2f6fb3'), 0, HC + 0.03, 0);
    c.rotation.x = -0.2;
    head.add(c);
    const brim = m(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), toon(o.capColor ?? '#2f6fb3'), 0, HC + 0.17, 0.25);
    brim.scale.set(1.2, 1, 0.9);
    head.add(brim);
  }
  // 팔
  const arm = (s: number) => {
    const p = new THREE.Group();
    p.position.set(s * 0.215, 0.73, 0);
    p.add(m(new THREE.CapsuleGeometry(0.06, 0.16, 4, 10), top, 0, -0.13, 0));
    p.add(m(S(0.062, 12, 10), skin, 0, -0.27, 0.01));
    p.rotation.z = s * 0.18;
    root.add(p);
    return p;
  };
  const armL = arm(1), armR = arm(-1);
  if (o.prop) {
    const pr = prop(o.prop);
    pr.position.y += -0.3;
    armR.add(pr);
    armR.rotation.x = -0.75;
    armR.userData.hold = true;
  }
  // 발밑 그림자(그림자 끄기에서도 붙어 보이게)
  root.add(blob());
  return { root, head, body, eyes, mouth, armL, armR, legL, legR, phase: 0, blinkT: 1 + Math.random() * 3, wave: 0, talk: 0, hop: 0 };
}

let BLOB: THREE.Texture | null = null;
export function blob(r = 0.42, op = 0.32) {
  if (!BLOB) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.6, 'rgba(0,0,0,.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    BLOB = new THREE.CanvasTexture(c);
  }
  const b = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, opacity: op, depthWrite: false }));
  b.rotation.x = -Math.PI / 2;
  b.position.y = 0.025;
  b.renderOrder = 1;
  return b;
}

/** 매 장면 몸짓 — 걷기·숨쉬기·눈 깜빡임·손 흔들기·말하기 */
export function animChibi(c: Chibi, dt: number, t: number, speed: number) {
  const walk = Math.min(1, speed / 3);
  c.phase += dt * (4 + speed * 2.2);
  const sw = Math.sin(c.phase) * 0.7 * walk;
  c.legL.rotation.x = sw;
  c.legR.rotation.x = -sw;
  c.armL.rotation.x = -sw * 0.8;
  if (!c.armR.userData.hold) c.armR.rotation.x = sw * 0.8;
  const bob = Math.abs(Math.sin(c.phase)) * 0.05 * walk + Math.sin(t * 2.2) * 0.008 * (1 - walk);
  c.hop = Math.max(0, c.hop - dt * 2.5);
  const hop = Math.sin(Math.min(1, 1 - c.hop) * Math.PI) * (c.hop > 0 ? 0.18 : 0);
  c.body.position.y = 0.53 + bob;
  c.head.position.y = 0.8 + bob * 1.1 + hop;
  c.root.children.forEach(() => 0);
  c.head.rotation.z = Math.sin(t * 1.3 + c.blinkT) * 0.04 * (1 - walk);
  // 손 흔들기
  if (c.wave > 0) {
    c.wave = Math.max(0, c.wave - dt);
    c.armL.rotation.z = 2.4 + Math.sin(t * 14) * 0.35;
    c.armL.rotation.x = 0;
  } else c.armL.rotation.z += (0.18 - c.armL.rotation.z) * Math.min(1, dt * 8);
  // 말하기 — 입 벌렸다 닫기
  const talk = c.talk > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(t * 13)) : 0;
  c.mouth.scale.set(1, 1 + talk * 1.6, 1);
  // 깜빡임
  c.blinkT -= dt;
  const closed = c.blinkT < 0.12 && c.blinkT > 0;
  if (c.blinkT <= 0) c.blinkT = 2 + Math.random() * 3.5;
  for (const e of c.eyes) {
    e.scale.y = closed ? 0.15 : 1.35;
    e.userData.hl.visible = !closed;
  }
}
