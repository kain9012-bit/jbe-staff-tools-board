/**
 * 3D 광장 — 함께 접속
 * 중계 서버: Cloudflare Workers + Durable Objects(relay/ 폴더). 광장·로비 사람을 함께 집계.
 * - 처음 들어가면 서버가 지금 있는 사람 목록(이름·모습·있는 곳·자리)을 한 번에 줌
 * - 걸을 때만 초당 2번 자리를 보냄(속도도 함께 → 받는 쪽이 사이를 이어 그림). 서 있으면 안 보냄
 * - 걷기·몸짓은 같은 곳(광장/로비)에 있는 사람끼리만 주고받음
 * - 저장하는 것 없음
 * 설정: VITE_PLAZA_RELAY(예: wss://jbe-plaza-relay.○○.workers.dev). 없으면 혼자 보기.
 * 개발 중 시험: 주소 끝에 ?mp=local → 같은 브라우저 탭끼리 연결(서버 없이)
 */
import { cleanLook, cleanName, type Emote, type Look, type PeerMeta, type PeerMove, type World } from './crowd';

export interface NetHooks {
  meta: (id: string, m: PeerMeta) => void;
  move: (id: string, m: PeerMove) => void;
  leave: (id: string) => void;
  emote: (id: string, k: Emote) => void;
  /** 다시 연결함 → 보이던 사람 모두 지움 */
  reset: () => void;
  status: (s: 'connecting' | 'on' | 'off') => void;
}
export interface Me {
  name: string;
  look: Look;
}
export interface NetState {
  x: number;
  z: number;
  y: number;
  s: number;
  w: World;
}
export interface Net {
  setMeta: (name: string, look: Look) => void;
  emote: (k: Emote) => void;
  stop: () => void;
}

const RELAY = (import.meta.env.VITE_PLAZA_RELAY as string | undefined)?.trim().replace(/\/$/, '');
const LOCAL = import.meta.env.DEV && typeof location !== 'undefined' && /[?&]mp=local\b/.test(location.search);
export const netReady = () => Boolean(RELAY || LOCAL);

const SEND_MS = 500; // 걸을 때 초당 2번
const EMOTES: Emote[] = ['hi', 'like', 'clap', 'glad'];
const num = (v: unknown, lim = 1500) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < lim ? v : null);
const okId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;
const okW = (v: unknown): World | null => (v === 'in' || v === 'out' ? v : null);
type Msg = Record<string, unknown>;

/** 서버와 주고받는 길 */
interface Pipe {
  send: (m: Msg) => void;
  stop: () => void;
}
type Open = (onMsg: (m: Msg) => void, onOpen: () => void, onDrop: () => void) => Pipe;

/** 중계 서버(WebSocket). 끊기면 1·2·4…최대 20초 뒤 다시 연결 */
const relayOpen: Open = (onMsg, onOpen, onDrop) => {
  let ws: WebSocket | null = null;
  let dead = false;
  let wait = 1000;
  let ping = 0;
  let retry = 0;
  let heard = 0; // 서버에서 마지막으로 무언가 받은 때
  const drop = () => {
    window.clearInterval(ping);
    ws = null;
    if (dead) return;
    onDrop();
    retry = window.setTimeout(connect, wait);
    wait = Math.min(20000, wait * 2);
  };
  const connect = () => {
    if (dead) return;
    const s = new WebSocket(`${RELAY}/plaza`);
    ws = s;
    s.onopen = () => {
      wait = 1000;
      heard = Date.now();
      onOpen();
      // 20초마다 ping. 90초 넘게 아무 답이 없으면(휴대폰 잠금 뒤 등) 끊긴 것으로 보고 다시 연결
      ping = window.setInterval(() => {
        if (s.readyState !== 1) return;
        if (Date.now() - heard > 90000) {
          s.onclose = null;
          s.close();
          drop();
          return;
        }
        s.send('ping');
      }, 20000);
    };
    s.onmessage = (e) => {
      heard = Date.now();
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      try {
        onMsg(JSON.parse(e.data));
      } catch {
        /* 잘못된 글 */
      }
    };
    s.onclose = drop;
  };
  // 화면이 다시 보이면(휴대폰 잠금 해제 등) 연결 상태를 바로 확인
  const onVis = () => {
    if (document.visibilityState !== 'visible' || dead) return;
    if (!ws || ws.readyState > 1) {
      window.clearTimeout(retry);
      wait = 1000;
      if (!ws) connect();
    } else if (ws.readyState === 1) ws.send('ping');
  };
  document.addEventListener('visibilitychange', onVis);
  connect();
  return {
    send: (m) => {
      if (ws?.readyState === 1) ws.send(JSON.stringify(m));
    },
    stop: () => {
      dead = true;
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(ping);
      window.clearTimeout(retry);
      ws?.close(1000);
    },
  };
};

/** 개발용: 서버 없이 같은 브라우저 탭끼리(BroadcastChannel). 서버가 하는 일을 흉내 냄 */
const localOpen: Open = (onMsg, onOpen) => {
  const bc = new BroadcastChannel('plaza-local');
  const me = Math.random().toString(36).slice(2, 12);
  let mine: Msg = {};
  const seen = new Map<string, number>();
  const announce = () => mine.n && mine.w && bc.postMessage({ ...mine, t: 'm', i: me });
  bc.onmessage = (e) => {
    const m = e.data as Msg;
    if (!okId(m.i) || m.i === me) return;
    if (m.t === 'bye') {
      seen.delete(m.i);
      return onMsg(m);
    }
    if (!seen.has(m.i)) announce(); // 새 사람에게 나를 알림
    seen.set(m.i, Date.now());
    onMsg(m);
  };
  const hb = window.setInterval(() => {
    const now = Date.now();
    for (const [i, t] of seen) if (now - t > 8000) (seen.delete(i), onMsg({ t: 'bye', i }));
    announce();
  }, 3000);
  window.setTimeout(() => {
    onMsg({ t: 'hi', you: me, peers: [] });
    onOpen();
  }, 30);
  return {
    send: (m) => {
      if (m.t === 'm') mine = { ...mine, n: m.n, l: m.l };
      if (m.t === 'w') mine = { ...mine, w: m.w, x: m.x, z: m.z, y: m.y, s: 0 };
      if (m.t === 'p') mine = { ...mine, x: m.x, z: m.z, y: m.y, s: m.s };
      if (m.t === 'm' || m.t === 'w') announce();
      else bc.postMessage({ ...m, i: me });
    },
    stop: () => {
      window.clearInterval(hb);
      bc.postMessage({ t: 'bye', i: me });
      bc.close();
    },
  };
};

export async function startNet(me: Me, hooks: NetHooks, state: () => NetState): Promise<Net | null> {
  if (!netReady()) return null;
  const open = RELAY ? relayOpen : localOpen;
  let meta = { n: me.name, l: me.look };
  let you = '';
  /** 아는 사람 → 있는 곳 */
  const where = new Map<string, World>();
  const moveOf = (p: Msg, w: World): PeerMove | null => {
    const x = num(p.x), z = num(p.z), y = num(p.y, 20), s = num(p.s, 20) ?? 0;
    return x === null || z === null || y === null ? null : { x, z, y, s: Math.max(0, Math.min(8, s)), w };
  };
  const meet = (p: Msg) => {
    const w = okW(p.w);
    if (!okId(p.i) || p.i === you || !w) return;
    where.set(p.i, w);
    hooks.meta(p.i, { name: cleanName(p.n), look: cleanLook(p.l), w });
    const mv = moveOf(p, w);
    if (mv) hooks.move(p.i, mv);
  };
  const onMsg = (m: Msg) => {
    if (m.t === 'hi') {
      you = typeof m.you === 'string' ? m.you : '';
      if (Array.isArray(m.peers)) (m.peers as Msg[]).slice(0, 200).forEach(meet);
      return;
    }
    if (m.t === 'here') {
      if (Array.isArray(m.peers))
        for (const p of m.peers as Msg[]) {
          const w = okId(p.i) ? where.get(p.i) : undefined;
          const mv = w && moveOf(p, w);
          if (mv) hooks.move(p.i as string, mv);
        }
      return;
    }
    if (!okId(m.i) || m.i === you) return;
    if (m.t === 'm') meet(m);
    else if (m.t === 'w') {
      const w = okW(m.w);
      if (!w || !where.has(m.i)) return;
      where.set(m.i, w);
      const mv = moveOf({ ...m, s: 0 }, w);
      if (mv) hooks.move(m.i, mv);
    } else if (m.t === 'p') {
      const w = where.get(m.i);
      const mv = w && moveOf(m, w);
      if (mv) hooks.move(m.i, mv);
    } else if (m.t === 'e' && where.has(m.i) && EMOTES.includes(m.k as Emote)) hooks.emote(m.i, m.k as Emote);
    else if (m.t === 'bye') {
      where.delete(m.i);
      hooks.leave(m.i);
    }
  };
  let room: World = state().w;
  let last = { x: NaN, z: NaN, y: 0, s: 0 };
  const sendWhere = () => {
    const s = state();
    room = s.w;
    last = { x: s.x, z: s.z, y: s.y, s: 0 };
    pipe.send({ t: 'w', w: s.w, x: +s.x.toFixed(2), z: +s.z.toFixed(2), y: +s.y.toFixed(2) });
  };
  const onOpen = () => {
    hooks.status('on');
    // 있는 곳·자리 먼저, 그다음 이름·모습(서버는 둘 다 받은 뒤에 남에게 알림)
    sendWhere();
    pipe.send({ t: 'm', ...meta });
  };
  const onDrop = () => {
    where.clear();
    hooks.reset();
    hooks.status('connecting');
  };
  hooks.status('connecting');
  const pipe = open(onMsg, onOpen, onDrop);
  const tick = window.setInterval(() => {
    const s = state();
    if (s.w !== room) return sendWhere(); // 광장↔로비
    const sp = s.s < 0.3 ? 0 : s.s;
    const changed =
      Math.hypot(s.x - last.x, s.z - last.z) > 0.05 ||
      Math.abs(Math.atan2(Math.sin(s.y - last.y), Math.cos(s.y - last.y))) > 0.12 ||
      Math.abs(sp - last.s) > 0.5;
    if (!changed) return;
    last = { x: s.x, z: s.z, y: s.y, s: sp };
    pipe.send({ t: 'p', x: +s.x.toFixed(2), z: +s.z.toFixed(2), y: +s.y.toFixed(2), s: +sp.toFixed(1) });
  }, SEND_MS);
  let lastEmote = 0;
  return {
    setMeta: (name, look) => {
      meta = { n: name, l: look };
      pipe.send({ t: 'm', ...meta });
    },
    emote: (k) => {
      const now = Date.now();
      if (now - lastEmote < 800) return;
      lastEmote = now;
      pipe.send({ t: 'e', k });
    },
    stop: () => {
      window.clearInterval(tick);
      pipe.stop();
    },
  };
}
