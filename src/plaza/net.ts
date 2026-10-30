/**
 * 3D 광장 — 함께 접속(Supabase Realtime)
 * - 누가 있는지: Presence(이름·모습·있는 곳)
 * - 움직임·몸짓: Broadcast(움직일 때만 초당 3번, 멈추면 보내지 않음)
 * - 저장하는 것 없음(데이터베이스 안 씀)
 * 설정: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY(공개용 키). 없으면 혼자 보기.
 * 개발 중 시험: 주소 끝에 ?mp=local → 같은 브라우저 탭끼리 연결
 */
import { cleanLook, cleanName, type Emote, type Look, type PeerMeta, type PeerMove, type World } from './crowd';

export interface NetHooks {
  meta: (id: string, m: PeerMeta) => void;
  move: (id: string, m: PeerMove) => void;
  leave: (id: string) => void;
  emote: (id: string, k: Emote) => void;
  status: (s: 'connecting' | 'on' | 'off') => void;
}
export interface Me {
  id: string;
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

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const LOCAL = import.meta.env.DEV && typeof location !== 'undefined' && /[?&]mp=local\b/.test(location.search);
export const netReady = () => Boolean((URL_ && KEY) || LOCAL);

const ROOM = 'plaza-v1';
const EMOTES: Emote[] = ['hi', 'like', 'clap', 'glad'];
const num = (v: unknown, lim = 400) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < lim ? v : null);
const okId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;
const okW = (v: unknown): World => (v === 'in' ? 'in' : 'out');

/** 주고받는 길: Supabase 채널 또는 (개발용) 같은 브라우저 탭끼리 */
interface Pipe {
  send: (ev: string, payload: Record<string, unknown>) => void;
  track: (meta: Record<string, unknown>) => void;
  stop: () => void;
}
type OnMsg = (ev: string, payload: Record<string, unknown>) => void;
type OnPres = (kind: 'join' | 'leave', id: string, meta?: Record<string, unknown>) => void;

async function supabasePipe(me: string, onMsg: OnMsg, onPres: OnPres, status: NetHooks['status']): Promise<Pipe> {
  const { RealtimeClient } = await import('@supabase/realtime-js');
  const client = new RealtimeClient(`${URL_!.replace(/\/$/, '')}/realtime/v1`, { params: { apikey: KEY! } });
  const ch = client.channel(ROOM, { config: { broadcast: { self: false, ack: false }, presence: { key: me, enabled: true } } });
  let last: Record<string, unknown> | null = null;
  let on = false;
  ch.on('broadcast', { event: 'p' }, ({ payload }) => onMsg('p', payload ?? {}))
    .on('broadcast', { event: 'e' }, ({ payload }) => onMsg('e', payload ?? {}))
    .on('presence', { event: 'join' }, ({ key, newPresences }) => onPres('join', key, (newPresences?.[newPresences.length - 1] ?? {}) as Record<string, unknown>))
    .on('presence', { event: 'leave' }, ({ key, currentPresences }) => {
      if (!currentPresences?.length) onPres('leave', key);
    })
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        on = true;
        status('on');
        if (last) void ch.track(last);
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        on = false;
        status(s === 'CLOSED' ? 'off' : 'connecting');
      }
    });
  return {
    send: (event, payload) => {
      if (on) void ch.send({ type: 'broadcast', event, payload });
    },
    track: (meta) => {
      last = meta;
      if (on) void ch.track(meta);
    },
    stop: () => {
      void ch.untrack().catch(() => null);
      void client.removeChannel(ch).catch(() => null);
      client.disconnect();
    },
  };
}

/** 개발용: BroadcastChannel로 Presence 흉내(2초마다 알림, 6초 소식 없으면 나감) */
function localPipe(me: string, onMsg: OnMsg, onPres: OnPres, status: NetHooks['status']): Pipe {
  const bc = new BroadcastChannel(ROOM);
  const seen = new Map<string, number>();
  let meta: Record<string, unknown> | null = null;
  bc.onmessage = (e) => {
    const { ev, id, payload } = (e.data ?? {}) as { ev: string; id: string; payload: Record<string, unknown> };
    if (!okId(id) || id === me) return;
    if (ev === 'pres') {
      seen.set(id, Date.now());
      onPres('join', id, payload);
    } else if (ev === 'bye') {
      seen.delete(id);
      onPres('leave', id);
    } else onMsg(ev, payload);
  };
  const hb = window.setInterval(() => {
    if (meta) bc.postMessage({ ev: 'pres', id: me, payload: meta });
    const now = Date.now();
    for (const [id, t] of seen) if (now - t > 6000) (seen.delete(id), onPres('leave', id));
  }, 2000);
  window.setTimeout(() => status('on'), 50);
  return {
    send: (ev, payload) => bc.postMessage({ ev, id: me, payload }),
    track: (m) => {
      meta = m;
      bc.postMessage({ ev: 'pres', id: me, payload: m });
    },
    stop: () => {
      window.clearInterval(hb);
      bc.postMessage({ ev: 'bye', id: me, payload: {} });
      bc.close();
    },
  };
}

export async function startNet(me: Me, hooks: NetHooks, state: () => NetState): Promise<Net | null> {
  if (!netReady()) return null;
  hooks.status('connecting');
  let myMeta = { n: me.name, l: me.look, w: state().w as World };
  const known = new Set<string>();
  const early = new Map<string, PeerMove>(); // 이름보다 자리가 먼저 온 경우
  let sendSoon = false;
  const onPres: OnPres = (kind, id, m) => {
    if (!okId(id) || id === me.id) return;
    if (kind === 'leave') {
      known.delete(id);
      early.delete(id);
      hooks.leave(id);
      return;
    }
    const isNew = !known.has(id);
    known.add(id);
    hooks.meta(id, { name: cleanName(m?.n), look: cleanLook(m?.l), w: okW(m?.w) });
    const e = early.get(id);
    if (e) (early.delete(id), hooks.move(id, e));
    if (isNew) sendSoon = true; // 새로 온 사람에게 내 자리를 바로 알림
  };
  const onMsg: OnMsg = (ev, p) => {
    if (!okId(p.i) || p.i === me.id) return;
    if (ev === 'p') {
      const x = num(p.x), z = num(p.z), y = num(p.y, 20);
      if (x === null || z === null || y === null) return;
      const mv = { x, z, y, w: okW(p.w) };
      if (known.has(p.i)) hooks.move(p.i, mv);
      else if (early.size < 60) early.set(p.i, mv);
      return;
    }
    if (!known.has(p.i)) return;
    if (ev === 'e' && EMOTES.includes(p.k as Emote)) hooks.emote(p.i, p.k as Emote);
  };
  let pipe: Pipe;
  try {
    pipe = URL_ && KEY ? await supabasePipe(me.id, onMsg, onPres, hooks.status) : localPipe(me.id, onMsg, onPres, hooks.status);
  } catch {
    hooks.status('off');
    return null;
  }
  pipe.track(myMeta);

  // 움직일 때만 초당 3번, 멈추면 마지막 자리 한 번. 15초마다 한 번은 자리 알림
  let last = { x: NaN, z: NaN, y: 0, w: myMeta.w };
  let lastAt = 0;
  const tick = window.setInterval(() => {
    const s = state();
    const now = Date.now();
    const changed = Math.hypot(s.x - last.x, s.z - last.z) > 0.05 || Math.abs(Math.atan2(Math.sin(s.y - last.y), Math.cos(s.y - last.y))) > 0.12 || s.w !== last.w || Number.isNaN(last.x);
    if (s.w !== myMeta.w) {
      myMeta = { ...myMeta, w: s.w };
      pipe.track(myMeta);
    }
    if (changed || sendSoon || now - lastAt > 15000) {
      sendSoon = false;
      lastAt = now;
      last = { x: s.x, z: s.z, y: s.y, w: s.w };
      pipe.send('p', { i: me.id, x: +s.x.toFixed(2), z: +s.z.toFixed(2), y: +s.y.toFixed(2), w: s.w });
    }
  }, 333);
  let lastEmote = 0;
  return {
    setMeta: (name, look) => {
      myMeta = { ...myMeta, n: name, l: look };
      pipe.track(myMeta);
    },
    emote: (k) => {
      const now = Date.now();
      if (now - lastEmote < 800) return;
      lastEmote = now;
      pipe.send('e', { i: me.id, k });
    },
    stop: () => {
      window.clearInterval(tick);
      pipe.stop();
    },
  };
}
