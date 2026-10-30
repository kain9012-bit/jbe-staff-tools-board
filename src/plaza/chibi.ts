// @ts-nocheck
/* 귀여운 교직원 캐릭터(2.5등신) — 블렌더로 만든 모델(chibi.glb — 만드는 스크립트는 tools/plaza_chibi/) + 손에 드는 소품.
 * 앞쪽이 +z
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import chibiUrl from './chibi.glb?url';

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

/* ── 블렌더로 만든 캐릭터(chibi.glb) — 몸·머리 6종·얼굴 그림·뼈대·동작(idle·walk·wave·talk) ── */
let TPL: { scene: THREE.Group; clips: THREE.AnimationClip[]; face: THREE.Texture | null } | null = null;
/** 3D 광장을 만들기 전에 한 번 불러 둠 */
export async function loadCharacters() {
  if (TPL) return;
  const g = await new GLTFLoader().loadAsync(chibiUrl);
  let face: THREE.Texture | null = null;
  g.scene.traverse((o: any) => {
    if (o.isMesh && o.material?.name === 'Face') face = o.material.map;
  });
  TPL = { scene: g.scene, clips: g.animations, face };
}

export interface Chibi {
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  act: Record<string, THREE.AnimationAction>;
  faceMap: THREE.Texture | null;
  armR: THREE.Object3D | null;
  foreR: THREE.Object3D | null;
  hold: boolean;
  /** 믹서가 마지막으로 정한 오른팔 자세(소품 들기 보정을 매번 새로 얹기 위함) */
  armBase: THREE.Quaternion;
  foreBase: THREE.Quaternion;
  phase: number;
  blinkT: number;
  wave: number;
  talk: number;
  hop: number;
  waving: boolean;
}

const HAIR_OF: Record<string, string> = { short: 'short', bob: 'bob', pony: 'pony', bun: 'bun', curly: 'curly', side: 'side' };

export function makeChibi(o: ChibiOpt): Chibi {
  if (!TPL) throw new Error('캐릭터를 먼저 불러야 함');
  const root = new THREE.Group();
  const model = cloneSkinned(TPL.scene);
  const colors: Record<string, string> = {
    Skin: o.skin, Top: o.top, Inner: o.inner ?? '#ffffff', Pants: o.pants, Shoes: '#3b3f4a', Hair: o.hair, Tie: o.tie ?? o.top,
    Strap: '#2f6fb3', Card: '#ffffff', CardBand: '#3480cc', Glasses: '#2b2f3a', HatChef: '#ffffff', Cap: o.capColor ?? '#1c64ac', HairTie: '#e8554e',
  };
  let faceMap: THREE.Texture | null = null;
  const hair = 'Hair_' + (HAIR_OF[o.style] ?? 'short');
  model.traverse((m: any) => {
    const nm: string = m.name || '';
    if (nm.startsWith('Hair_')) m.visible = nm.startsWith(hair) && !(o.hat === 'cap' && false);
    if (nm.startsWith('Glasses')) m.visible = !!o.glasses;
    if (nm.startsWith('Hat_chef')) m.visible = o.hat === 'chef';
    if (nm.startsWith('Hat_cap')) m.visible = o.hat === 'cap';
    if (nm.startsWith('Tie')) m.visible = !!o.tie;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;
    const mn: string = m.material?.name ?? '';
    if (mn === 'Face') {
      faceMap = TPL!.face!.clone();
      faceMap.colorSpace = THREE.SRGBColorSpace;
      faceMap.needsUpdate = true;
      m.material = new THREE.MeshBasicMaterial({ map: faceMap, transparent: true, depthWrite: false, toneMapped: false });
      m.castShadow = false;
      m.renderOrder = 2;
      return;
    }
    m.material = toon(colors[mn] ?? '#cccccc');
  });
  root.add(model);
  root.add(blob());
  const mixer = new THREE.AnimationMixer(model);
  const act: Record<string, THREE.AnimationAction> = {};
  for (const c of TPL.clips) {
    const a = mixer.clipAction(c);
    a.enabled = true;
    a.setEffectiveWeight(0);
    a.play();
    act[c.name] = a;
  }
  act.idle?.setEffectiveWeight(1);
  act.idle && (act.idle.time = Math.random() * 2);
  if (act.wave) {
    act.wave.setLoop(THREE.LoopOnce, 1);
    act.wave.clampWhenFinished = false;
    act.wave.stop();
  }
  const armR = model.getObjectByName('upper_armR') ?? null;
  const foreR = model.getObjectByName('forearmR') ?? null;
  if (o.prop && foreR) {
    const pr = prop(o.prop);
    // 소품은 손끝(아래팔 끝)에 — 캐릭터 기준 방향을 유지하도록 뼈의 쉬는 자세 회전을 되돌려 둠
    model.updateMatrixWorld(true);
    const holder = new THREE.Group();
    holder.position.set(0, 0.23, 0);
    const q = new THREE.Quaternion();
    foreR.getWorldQuaternion(q);
    holder.quaternion.copy(q.invert());
    holder.add(pr);
    pr.position.y += 0.02;
    foreR.add(holder);
  }
  return { root, model, mixer, act, faceMap, armR, foreR, hold: !!o.prop, armBase: armR ? armR.quaternion.clone() : new THREE.Quaternion(), foreBase: foreR ? foreR.quaternion.clone() : new THREE.Quaternion(), phase: 0, blinkT: 1 + Math.random() * 3, wave: 0, talk: 0, hop: 0, waving: false };
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

/** 매 장면 몸짓 — 서기·걷기 섞기, 손 흔들기, 말하기(입), 눈 깜빡임, 깡충 */
export function animChibi(c: Chibi, dt: number, _t: number, speed: number) {
  const walk = Math.min(1, speed / 3);
  const A = c.act;
  // 손 흔들기 — 한 번 재생
  if (c.wave > 0 && !c.waving && A.wave) {
    c.waving = true;
    A.wave.reset().play();
  }
  if (c.wave > 0) c.wave = Math.max(0, c.wave - dt);
  const waveW = c.waving && A.wave && A.wave.isRunning() ? 1 : 0;
  if (c.waving && !waveW) c.waving = false;
  const talkW = c.talk > 0 ? 0.8 : 0;
  A.walk?.setEffectiveWeight(walk);
  if (A.walk) A.walk.timeScale = 0.6 + speed / 4.6;
  A.idle?.setEffectiveWeight(Math.max(0.05, (1 - walk) * (waveW ? 0.15 : 1) * (talkW ? 0.4 : 1)));
  A.talk?.setEffectiveWeight(talkW * (1 - walk));
  A.wave?.setEffectiveWeight(waveW * 1.5);
  // 믹서는 값이 바뀔 때만 뼈를 덮어쓰므로, 지난 장면의 보정을 먼저 걷어 냄(안 하면 팔이 계속 돎)
  if (c.armR && c.foreR) {
    c.armR.quaternion.copy(c.armBase);
    c.foreR.quaternion.copy(c.foreBase);
  }
  c.mixer.update(dt);
  if (c.armR && c.foreR) {
    c.armBase.copy(c.armR.quaternion);
    c.foreBase.copy(c.foreR.quaternion);
    // 소품 든 오른팔은 앞으로(걸을수록 풀림)
    const k = c.hold ? 1 - walk : 0;
    if (k > 0) {
      c.armR.rotateX(-0.75 * k);
      c.foreR.rotateX(-0.55 * k);
    }
  }
  // 깡충
  c.hop = Math.max(0, c.hop - dt * 2.5);
  c.model.position.y = c.hop > 0 ? Math.sin((1 - c.hop) * Math.PI) * 0.18 : 0;
  // 얼굴: 눈 깜빡임·말할 때 입
  c.blinkT -= dt;
  const closed = c.blinkT < 0.12 && c.blinkT > 0;
  if (c.blinkT <= 0) c.blinkT = 2 + Math.random() * 3.5;
  if (c.faceMap) {
    c.phase += dt;
    const mouth = c.talk > 0 && Math.sin(c.phase * 22) > 0;
    c.faceMap.offset.x = closed ? 1 / 3 : mouth ? 2 / 3 : 0;
  }
}
