/**
 * 3D 광장 — 함께 접속한 사람들(다른 교직원 캐릭터)
 * 모습·이름 만들기, 이름표·말풍선, 받은 위치를 부드럽게 따라가기
 */
import * as THREE from 'three';
import { animChibi, makeChibi, type Chibi, type ChibiOpt } from './chibi';

/* ── 모습: 색·머리 모양을 번호로 주고받음(아무 색이나 받지 않게) ── */
const SKIN = ['#ffe0c8', '#f6d1b5', '#ecc3a2', '#dcae8a'];
const HAIR = ['#2b2320', '#3d2b22', '#5a3a26', '#1b1b22', '#7a5133', '#4a2c2a'];
const STYLE = ['short', 'bob', 'pony', 'bun', 'curly', 'side'] as const;
const TOP = ['#2fa39a', '#3a6fd8', '#e0675a', '#8a5cc7', '#f0a43a', '#3f8f4f', '#d65f8f', '#4a5568', '#2f9fd0', '#c2724a'];
const PANTS = ['#3b4256', '#2d3340', '#5b4a3a', '#2f4a6b'];
const CAP = ['#1c64ac', '#e8554e', '#f2b234', '#2f9e6e'];

export interface Look {
  sk: number;
  h: number;
  st: number;
  tp: number;
  pn: number;
  gl: number;
  ht: number;
  cp: number;
}
const rnd = (n: number) => Math.floor(Math.random() * n);
export function randomLook(): Look {
  return { sk: rnd(SKIN.length), h: rnd(HAIR.length), st: rnd(STYLE.length), tp: rnd(TOP.length), pn: rnd(PANTS.length), gl: Math.random() < 0.3 ? 1 : 0, ht: Math.random() < 0.3 ? 1 : 0, cp: rnd(CAP.length) };
}
const idx = (v: unknown, n: number) => (typeof v === 'number' && Number.isFinite(v) ? ((Math.floor(v) % n) + n) % n : 0);
/** 받은 모습 값 검사 — 범위 밖이면 고쳐 씀 */
export function cleanLook(x: unknown): Look {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  return { sk: idx(o.sk, SKIN.length), h: idx(o.h, HAIR.length), st: idx(o.st, STYLE.length), tp: idx(o.tp, TOP.length), pn: idx(o.pn, PANTS.length), gl: idx(o.gl, 2), ht: idx(o.ht, 2), cp: idx(o.cp, CAP.length) };
}
export const sameLook = (a: Look, b: Look) => (Object.keys(a) as (keyof Look)[]).every((k) => a[k] === b[k]);
export function lookOpt(l: Look): ChibiOpt {
  return {
    skin: SKIN[l.sk],
    hair: HAIR[l.h],
    style: STYLE[l.st],
    top: TOP[l.tp],
    inner: '#ffffff',
    pants: PANTS[l.pn],
    tie: null,
    glasses: l.gl === 1,
    hat: l.ht === 1 && STYLE[l.st] !== 'bun' && STYLE[l.st] !== 'curly' ? 'cap' : null, // 올림머리·곱슬엔 모자 안 씀
    capColor: CAP[l.cp],
  };
}

/* ── 이름 ── */
const ADJ = ['부지런한', '꼼꼼한', '친절한', '든든한', '성실한', '슬기로운', '다정한', '씩씩한', '느긋한', '반짝이는', '차분한', '명랑한', '야무진', '상냥한'];
const ANI = ['다람쥐', '고양이', '부엉이', '펭귄', '수달', '토끼', '판다', '고래', '여우', '강아지', '너구리', '곰', '햄스터', '알파카'];
export const randomName = () => `${ADJ[rnd(ADJ.length)]} ${ANI[rnd(ANI.length)]}`;
export const NAME_MAX = 10;
// 이름표에 쓰면 안 되는 말(띄어쓰기·기호를 빼고 비교)
const BAD = ['씨발', '시발', 'ㅅㅂ', '씨팔', '병신', 'ㅂㅅ', '개새', '새끼', '좆', '존나', 'ㅈㄴ', '지랄', '미친놈', '미친년', '닥쳐', '꺼져', '섹스', '야동', '보지', '자지', 'fuck', 'shit', 'bitch', 'sex'];
const squash = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}0-9_]/gu, '');
/** 이름 다듬기 — 보이지 않는 글자·줄바꿈 빼고 10자까지 */
export function tidyName(s: unknown): string {
  if (typeof s !== 'string') return '';
  return [...s.replace(/[\p{C}\u200b-\u200f\u2028-\u202e\u2060-\u206f]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, NAME_MAX).join('');
}
export const nameBad = (s: string) => {
  const q = squash(s);
  return BAD.some((b) => q.includes(b));
};
/** 받은 이름 — 비었거나 쓸 수 없는 말이면 '교직원' */
export function cleanName(s: unknown): string {
  const t = tidyName(s);
  return !t || nameBad(t) ? '교직원' : t;
}

/* ── 이름표·말풍선 ── */
const FONT = "'Plaza SUIT', 'SUIT Variable', 'Pretendard Variable', 'Noto Sans CJK KR', sans-serif";
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function textSprite(text: string, o: { bg: string; fg: string; ring?: string; tail?: boolean; h: number; font: number }) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = `800 ${o.font}px ${FONT}`;
  g.font = font;
  const tw = Math.ceil(g.measureText(text).width);
  const pad = o.font * 0.62;
  const bh = Math.round(o.font * 1.7);
  const tail = o.tail ? Math.round(o.font * 0.5) : 0;
  c.width = tw + pad * 2 + 8;
  c.height = bh + tail + 8;
  g.font = font;
  rr(g, 4, 4, c.width - 8, bh, bh / 2);
  g.fillStyle = o.bg;
  g.fill();
  if (o.ring) {
    g.lineWidth = 4;
    g.strokeStyle = o.ring;
    g.stroke();
  }
  if (tail) {
    g.beginPath();
    g.moveTo(c.width / 2 - tail * 0.8, 4 + bh - 1);
    g.lineTo(c.width / 2, 4 + bh + tail);
    g.lineTo(c.width / 2 + tail * 0.8, 4 + bh - 1);
    g.closePath();
    g.fill();
  }
  g.fillStyle = o.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, 4 + bh / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  sp.scale.set((o.h * c.width) / c.height, o.h, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 6;
  return sp;
}
export const nameTag = (text: string, me = false) =>
  textSprite(text, me ? { bg: 'rgba(79,209,255,0.95)', fg: '#06223a', h: 0.3, font: 44 } : { bg: 'rgba(13,24,48,0.78)', fg: '#ffffff', ring: 'rgba(255,255,255,0.35)', h: 0.3, font: 44 });
export type Emote = 'hi' | 'like' | 'clap' | 'glad';
export const EMOTES: { k: Emote; icon: string; text: string }[] = [
  { k: 'hi', icon: '👋', text: '안녕하세요!' },
  { k: 'like', icon: '👍', text: '좋아요!' },
  { k: 'clap', icon: '👏', text: '짝짝짝!' },
  { k: 'glad', icon: '😊', text: '반가워요!' },
];
export const bubble = (k: Emote) => textSprite(EMOTES.find((e) => e.k === k)?.text ?? '!', { bg: '#ffffff', fg: '#0d1830', tail: true, h: 0.46, font: 46 });
export function disposeSprite(s: THREE.Sprite | null) {
  if (!s) return;
  s.removeFromParent();
  s.material.map?.dispose();
  s.material.dispose();
}
/** 몸짓: 손 흔들기·깡충 */
export function playEmote(c: Chibi, k: Emote) {
  if (k === 'hi' || k === 'glad') c.wave = 1.1;
  if (k === 'like' || k === 'clap' || k === 'glad') c.hop = 1;
}

/* ── 다른 사람들 ── */
export type World = 'out' | 'in';
export interface PeerMeta {
  name: string;
  look: Look;
  w: World;
}
export interface PeerMove {
  x: number;
  z: number;
  y: number;
  /** 걷는 빠르기(m/s) — 다음 소식이 올 때까지 이 빠르기로 이어 그림 */
  s: number;
  w: World;
}
interface Peer {
  id: string;
  name: string;
  look: Look;
  w: World;
  /** 캐릭터(가까운 SHOW명만 만듦) */
  ch: Chibi | null;
  tag: THREE.Sprite | null;
  bub: THREE.Sprite | null;
  bubT: number;
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
  yaw: number;
  tyaw: number;
  /** 받은 빠르기·받은 뒤 지난 시간 */
  ts: number;
  age: number;
  speed: number;
  /** 자리를 받은 적 있음 */
  placed: boolean;
}
const LEAD = 0.55; // 앞질러 그릴 수 있는 최대 시간(초) — 받는 간격 0.5초보다 조금 길게
const SHOW = 40; // 캐릭터로 그리는 최대 인원(같은 곳에서 가까운 순)
const KEEP = 46; // 이미 그린 사람은 46번째보다 멀어져야 지움(경계에서 깜빡임 방지)
const PER_PICK = 6; // 한 번에 새로 만드는 캐릭터 수(한꺼번에 만들면 화면이 멈칫함)
export const MAX_PEERS = 300; // 목록에 담는 최대 인원(서버 최대 200명)

export function makeCrowd(o: { groups: Record<World, THREE.Group>; lift: (root: THREE.Object3D) => void }) {
  const peers = new Map<string, Peer>();
  const tmp = new THREE.Vector3();
  let pickT = 0;
  const build = (p: Peer) => {
    const ch = makeChibi(lookOpt(p.look));
    o.lift(ch.root);
    p.ch = ch;
    p.tag = nameTag(p.name);
    p.tag.position.y = 1.78;
    ch.root.add(p.tag);
    ch.root.position.copy(p.pos);
    ch.root.rotation.y = p.yaw;
    o.groups[p.w].add(ch.root);
  };
  const unbuild = (p: Peer) => {
    disposeSprite(p.tag);
    disposeSprite(p.bub);
    p.tag = p.bub = null;
    if (!p.ch) return;
    p.ch.root.removeFromParent();
    p.ch.mixer.stopAllAction();
    p.ch.mixer.uncacheRoot(p.ch.model);
    p.ch = null;
  };
  const drop = (id: string) => {
    const p = peers.get(id);
    if (!p) return;
    unbuild(p);
    peers.delete(id);
  };
  /** 같은 곳에서 가까운 SHOW명만 캐릭터로 */
  const pick = (here: World, me: THREE.Vector3) => {
    const near = [...peers.values()].filter((p) => p.placed && p.w === here).sort((a, b) => a.pos.distanceToSquared(me) - b.pos.distanceToSquared(me));
    const rank = new Map(near.map((p, i) => [p.id, i]));
    for (const p of peers.values()) {
      if (!p.ch) continue;
      const r = rank.get(p.id);
      if (r === undefined || r >= KEEP) unbuild(p);
    }
    let made = 0;
    for (const p of near.slice(0, SHOW)) {
      if (p.ch) continue;
      if (made++ >= PER_PICK) break;
      build(p);
    }
  };
  return {
    peers,
    /** 함께 있는 사람(나 빼고) */
    count: () => peers.size,
    /** 함께 있는 사람(이름·있는 곳) — 그리지 않는 사람도 모두 */
    roster: () => [...peers.values()].map((p) => ({ name: p.name, w: p.w })),
    /** 들어옴·이름/모습/있는 곳 바뀜 */
    meta(id: string, m: PeerMeta) {
      let p = peers.get(id);
      if (!p) {
        if (peers.size >= MAX_PEERS) return;
        p = { id, name: m.name, look: m.look, w: m.w, ch: null, tag: null, bub: null, bubT: 0, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), yaw: 0, tyaw: 0, ts: 0, age: 0, speed: 0, placed: false };
        peers.set(id, p);
        pickT = 0;
        return;
      }
      if (m.name !== p.name) {
        p.name = m.name;
        if (p.ch) {
          disposeSprite(p.tag);
          p.tag = nameTag(m.name);
          p.tag.position.y = 1.78;
          p.ch.root.add(p.tag);
        }
      }
      if (!sameLook(m.look, p.look)) {
        p.look = m.look;
        if (p.ch) (unbuild(p), build(p));
      }
      if (m.w !== p.w) {
        p.w = m.w;
        p.placed = false;
        unbuild(p);
        pickT = 0;
      }
    },
    /** 받은 자리 반영. 있는 곳(광장/로비)이 바뀌었으면 true */
    move(id: string, m: PeerMove): boolean {
      const p = peers.get(id);
      if (!p) return false;
      const moved = m.w !== p.w;
      if (moved) {
        p.w = m.w;
        p.placed = false;
        unbuild(p);
        pickT = 0;
      }
      p.tgt.set(m.x, 0, m.z);
      p.tyaw = m.y;
      p.ts = m.s;
      p.age = 0;
      // 처음이거나 멀리 건너뛰면(문 드나듦) 바로 그 자리로
      if (!p.placed || p.pos.distanceTo(p.tgt) > 9) {
        p.pos.copy(p.tgt);
        p.yaw = p.tyaw;
        if (!p.placed) pickT = 0;
        p.placed = true;
        p.ch?.root.position.copy(p.pos);
      }
      return moved;
    },
    drop,
    emote(id: string, k: Emote) {
      const p = peers.get(id);
      if (!p?.ch) return; // 그리지 않는(먼) 사람은 안 보이니 생략
      disposeSprite(p.bub);
      p.bub = bubble(k);
      p.bub.position.y = 2.12;
      p.ch.root.add(p.bub);
      p.bubT = 2.6;
      playEmote(p.ch, k);
    },
    /** 매 장면. here: 내가 있는 곳, me: 내 자리 */
    update(dt: number, t: number, camPos: THREE.Vector3, hideTags: boolean, here: World, me: THREE.Vector3) {
      pickT -= dt;
      if (pickT <= 0) {
        pickT = 0.5;
        pick(here, me);
      }
      for (const p of peers.values()) {
        if (!p.placed) continue;
        const bx = p.pos.x, bz = p.pos.z;
        // 받은 자리 + 받은 빠르기로 걸어간 만큼(최대 LEAD초) → 그쪽으로 부드럽게
        p.age += dt;
        const lead = p.ts > 0 ? Math.min(p.age, LEAD) * p.ts : 0;
        tmp.set(p.tgt.x + Math.sin(p.tyaw) * lead, 0, p.tgt.z + Math.cos(p.tyaw) * lead);
        p.pos.lerp(tmp, Math.min(1, dt * 6));
        if (!p.ch || p.w !== here) continue; // 그리지 않는 사람은 자리만 따라감
        const moved = Math.hypot(p.pos.x - bx, p.pos.z - bz);
        const sp = dt > 0 ? moved / dt : 0;
        p.speed += (sp - p.speed) * Math.min(1, dt * 8);
        if (p.speed < 0.25 && p.pos.distanceTo(tmp) < 0.05) p.speed = 0;
        let dy = p.tyaw - p.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        p.yaw += dy * Math.min(1, dt * 10);
        p.ch.root.position.copy(p.pos);
        p.ch.root.rotation.y = p.yaw;
        animChibi(p.ch, dt, t, p.speed);
        // 이름표: 멀면 흐려짐, 대화 중에는 숨김
        if (p.tag) {
          const d = camPos.distanceTo(p.pos);
          const op = hideTags ? 0 : Math.max(0, Math.min(1, (34 - d) / 10));
          p.tag.material.opacity = op;
          p.tag.visible = op > 0.01;
        }
        if (p.bub) {
          p.bubT -= dt;
          p.bub.material.opacity = Math.max(0, Math.min(1, p.bubT / 0.4));
          if (p.bubT <= 0) {
            disposeSprite(p.bub);
            p.bub = null;
          }
        }
      }
    },
    clear() {
      [...peers.keys()].forEach(drop);
    },
  };
}
export type Crowd = ReturnType<typeof makeCrowd>;
