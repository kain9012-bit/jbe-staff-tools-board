/**
 * 로그인 — 보기·내려받기는 로그인 없이, 쓰기(등록·댓글·후기·요청 등)만 로그인.
 *
 * AUTH_MODE
 *  - dev    : 시험용. 소속·이름을 직접 입력해 들어감. 운영자는 OPS_PASSWORD 입력. 통합인증 연동 전 시범 운영용
 *  - header : 통합인증(SSO) 게이트웨이·리버스 프록시가 검증한 사용자 정보를 요청 머리글로 넘겨 주는 방식
 *             AUTH_HEADER_ID / AUTH_HEADER_NAME / AUTH_HEADER_ORG 로 머리글 이름 지정
 *             LOGIN_URL / LOGOUT_URL 은 통합인증 로그인·로그아웃 주소
 *  - custom : server/auth-custom.mjs 의 함수로 연동(통합인증 규격을 받으면 그 파일만 채우면 됨)
 *
 * 운영자(정책기획과 빅데이터담당): OPS_USERS 에 적은 사용자 id, 또는 dev 모드에서 OPS_PASSWORD 로 들어온 사람
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { nowIso } from './db.mjs';

const MODE = process.env.AUTH_MODE || 'dev';
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const OPS_USERS = new Set((process.env.OPS_USERS || '').split(',').map((s) => s.trim()).filter(Boolean));
const OPS_PASSWORD = process.env.OPS_PASSWORD || '';
const H_ID = (process.env.AUTH_HEADER_ID || 'x-auth-user-id').toLowerCase();
const H_NAME = (process.env.AUTH_HEADER_NAME || 'x-auth-user-name').toLowerCase();
const H_ORG = (process.env.AUTH_HEADER_ORG || 'x-auth-user-org').toLowerCase();
const SECURE = process.env.COOKIE_SECURE === '1';
const DAY = 24 * 3600;

if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET 미설정 — 서버를 다시 켜면 로그인이 풀림');
}

let custom = null;
if (MODE === 'custom') {
  custom = await import('./auth-custom.mjs');
}

export const authMode = MODE;

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
}

const sign = (s) => createHmac('sha256', SECRET).update(s).digest('base64url');

function makeSession(userId, days = 7) {
  const exp = Math.floor(Date.now() / 1000) + days * DAY;
  const body = Buffer.from(JSON.stringify({ u: userId, e: exp })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readSession(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return e > Date.now() / 1000 ? u : null;
  } catch {
    return null;
  }
}

/** 화면 표기 이름 — 소속(이름) */
export const display = (u) => (u ? (u.org ? `${u.org}(${u.name})` : u.name) : '');

function upsertUser(db, { id, name, org, ops }) {
  const old = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const role = ops || OPS_USERS.has(id) ? 'ops' : old?.role ?? 'user';
  if (old) {
    db.prepare('UPDATE users SET name = ?, org = ?, role = ?, last_seen = ? WHERE id = ?').run(name, org, role, nowIso(), id);
  } else {
    db.prepare('INSERT INTO users (id, name, org, role, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, org, role, nowIso(), nowIso());
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

/** 요청의 사용자(없으면 null) */
export async function currentUser(db, req) {
  if (MODE === 'header') {
    const id = req.headers[H_ID];
    if (!id) return null;
    const dec = (v) => {
      try {
        return decodeURIComponent(String(v || ''));
      } catch {
        return String(v || '');
      }
    };
    return upsertUser(db, { id: String(id), name: dec(req.headers[H_NAME]) || String(id), org: dec(req.headers[H_ORG]) });
  }
  if (MODE === 'custom' && custom?.userFromRequest) {
    const u = await custom.userFromRequest(req);
    if (u) return upsertUser(db, u);
  }
  const uid = readSession(parseCookies(req).dt_session);
  if (!uid) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(uid) ?? null;
}

/** 로그인 처리 — dev 모드 입력값, custom 모드 콜백 결과 */
export function loginDev(db, { org, name, opsPassword }) {
  if (MODE !== 'dev') throw Object.assign(new Error('시험용 로그인이 꺼져 있음'), { status: 403 });
  org = String(org || '').trim().slice(0, 40);
  name = String(name || '').trim().slice(0, 20);
  if (!org || !name) throw Object.assign(new Error('소속과 이름을 입력해 주세요'), { status: 400 });
  let ops = false;
  if (opsPassword) {
    const a = Buffer.from(String(opsPassword));
    const b = Buffer.from(OPS_PASSWORD);
    if (!OPS_PASSWORD || a.length !== b.length || !timingSafeEqual(a, b)) throw Object.assign(new Error('운영자 암호가 맞지 않음'), { status: 401 });
    ops = true;
  }
  const user = upsertUser(db, { id: `${org}|${name}`, name, org, ops });
  return { user, setCookie: cookie('dt_session', makeSession(user.id), 7 * DAY) };
}

export function sessionFor(user) {
  return cookie('dt_session', makeSession(user.id), 7 * DAY);
}

export const logoutCookie = () => cookie('dt_session', '', 0);

export const loginInfo = () => ({
  mode: MODE,
  loginUrl: MODE === 'dev' ? '/login' : process.env.LOGIN_URL || (custom ? '/auth/start' : ''),
  logoutUrl: MODE === 'dev' ? '' : process.env.LOGOUT_URL || '',
});

export const customAuth = () => custom;

/** 화면에 보낼 사용자 정보 */
export const publicUser = (u) => (u ? { id: u.id, name: u.name, org: u.org, display: display(u), ops: u.role === 'ops' } : null);
