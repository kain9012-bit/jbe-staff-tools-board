/**
 * 3D 광장 함께 접속 — 중계 서버(Cloudflare Workers + Durable Objects, 무료 플랜)
 *
 * 방(Durable Object) 하나에 광장·로비 사람이 모두 들어옴(인원은 함께 집계).
 *  - 새로 온 사람에게 지금 있는 사람 전체(이름·모습·있는 곳·자리)를 한 번에 보냄
 *  - 이름·모습·있는 곳이 바뀌면 모두에게, 걷기·몸짓은 같은 곳(광장/로비)에 있는 사람에게만 나눠 줌
 * 저장하는 것 없음(접속이 끊기면 사라짐). 이름·모습·자리 말고 다른 정보는 받지 않음.
 *
 * 주고받는 글(JSON)
 *  브라우저→서버  w: 있는 곳+자리 {t:'w', w:'out'|'in', x, z, y}  (처음 들어올 때, 광장↔로비 옮길 때)
 *                 m: 이름·모습 {t:'m', n, l}
 *                 p: 자리 {t:'p', x, z, y, s}   e: 몸짓 {t:'e', k}
 *  서버→브라우저  hi: 처음 목록 {t:'hi', you, peers:[{i,n,l,w,x,z,y,s}]}
 *                 m / w / p / e (i = 보낸 사람), here: 옮긴 곳 사람들의 지금 자리, bye: 나감
 *  'ping' → 'pong'(연결 유지, 방을 깨우지 않음)
 */

const MAX_IN_ROOM = 200; // 최대 인원(광장+로비)
const MAX_MSG = 600; // 한 번에 받는 글자 수
const RATE = 8; // 한 사람이 1초에 보낼 수 있는 최대 개수(넘으면 버림)
const EMOTES = new Set(['hi', 'like', 'clap', 'glad']);
const WORLDS = new Set(['out', 'in']);

/** 들어올 수 있는 화면 주소 */
function allowedOrigin(origin, env) {
  if (!origin) return false;
  const list = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.includes(origin)) return true;
  // 개발용: 내 PC에서 띄운 화면
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/plaza') return new Response('3D 광장 중계 서버', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket 필요', { status: 426 });
    if (!allowedOrigin(req.headers.get('Origin'), env)) return new Response('허용되지 않은 주소', { status: 403 });
    const room = env.ROOM.get(env.ROOM.idFromName('plaza'));
    return room.fetch(req);
  },
};

const num = (v, lim = 400) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < lim ? Math.round(v * 100) / 100 : null);
const cleanName = (s) =>
  typeof s === 'string'
    ? [...s.replace(/[\p{C}\u200b-\u200f\u2028-\u202e\u2060-\u206f]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, 10).join('')
    : '';
const cleanLook = (l) => {
  const o = l && typeof l === 'object' ? l : {};
  const out = {};
  for (const k of ['sk', 'h', 'st', 'tp', 'pn', 'gl', 'ht', 'cp']) out[k] = Number.isInteger(o[k]) && o[k] >= 0 && o[k] < 20 ? o[k] : 0;
  return out;
};
const pub = (a) => ({ i: a.i, n: a.n, l: a.l, w: a.w, x: a.x, z: a.z, y: a.y, s: a.s });

export class PlazaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // 연결 유지용 ping/pong은 방을 깨우지 않고 바로 답함(요금·시간 0)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch() {
    if (this.ctx.getWebSockets().length >= MAX_IN_ROOM) return new Response('방이 가득 참', { status: 503 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const id = crypto.randomUUID().slice(0, 12);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ i: id, n: '', l: null, w: '', x: 0, z: 0, y: 0, s: 0, win: 0, cnt: 0 });
    const peers = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === server) continue;
      const a = ws.deserializeAttachment();
      if (a && a.n && a.w) peers.push(pub(a));
    }
    server.send(JSON.stringify({ t: 'hi', you: id, peers }));
    return new Response(null, { status: 101, webSocket: client });
  }

  /** 나 말고 모두에게(w를 주면 그곳에 있는 사람에게만) */
  cast(from, msg, w) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === from) continue;
      if (w) {
        const b = ws.deserializeAttachment();
        if (!b || b.w !== w) continue;
      }
      try {
        ws.send(s);
      } catch {
        /* 끊긴 연결 */
      }
    }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    const a = ws.deserializeAttachment();
    if (!a) return;
    // 1초에 RATE개 넘으면 버림
    const now = Date.now();
    if (now - a.win > 1000) (a.win = now), (a.cnt = 0);
    if (++a.cnt > RATE) return ws.serializeAttachment(a);
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return ws.serializeAttachment(a);
    }
    if (!m || typeof m !== 'object') return ws.serializeAttachment(a);
    const ready = () => a.n && a.w;
    if (m.t === 'w') {
      const x = num(m.x), z = num(m.z), y = num(m.y, 20);
      if (!WORLDS.has(m.w) || x === null || z === null || y === null) return ws.serializeAttachment(a);
      const was = ready();
      Object.assign(a, { w: m.w, x, z, y, s: 0 });
      ws.serializeAttachment(a);
      if (ready()) this.cast(ws, was ? { t: 'w', i: a.i, w: a.w, x, z, y } : { t: 'm', ...pub(a) });
      // 옮긴 곳 사람들의 지금 자리
      const here = [];
      for (const o of this.ctx.getWebSockets()) {
        if (o === ws) continue;
        const b = o.deserializeAttachment();
        if (b && b.n && b.w === a.w) here.push({ i: b.i, x: b.x, z: b.z, y: b.y, s: b.s });
      }
      ws.send(JSON.stringify({ t: 'here', peers: here }));
    } else if (m.t === 'm') {
      const n = cleanName(m.n);
      if (!n) return ws.serializeAttachment(a);
      a.n = n;
      a.l = cleanLook(m.l);
      ws.serializeAttachment(a);
      if (ready()) this.cast(ws, { t: 'm', ...pub(a) });
    } else if (m.t === 'p') {
      const x = num(m.x), z = num(m.z), y = num(m.y, 20), s = num(m.s, 20);
      if (x === null || z === null || y === null) return ws.serializeAttachment(a);
      Object.assign(a, { x, z, y, s: s === null ? 0 : Math.max(0, Math.min(8, s)) });
      ws.serializeAttachment(a);
      if (ready()) this.cast(ws, { t: 'p', i: a.i, x, z, y, s: a.s }, a.w);
    } else if (m.t === 'e') {
      ws.serializeAttachment(a);
      if (ready() && EMOTES.has(m.k)) this.cast(ws, { t: 'e', i: a.i, k: m.k }, a.w);
    } else ws.serializeAttachment(a);
  }

  async webSocketClose(ws, code) {
    const a = ws.deserializeAttachment();
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      /* 이미 닫힘 */
    }
    if (a && a.n) this.cast(ws, { t: 'bye', i: a.i });
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws, 1011);
  }
}
