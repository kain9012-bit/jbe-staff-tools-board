/**
 * 데이터 도구실 서버판 — 화면 + API + 파일을 한 서버에서.
 * Node 22 내장 기능만 사용(외부 패키지 0). 바깥 인터넷 접속 없음.
 *
 * 환경 변수 (README-서버.md 참고)
 *  PORT=8080  DATA_DIR=/data  STATIC_DIR=./dist-server  SEED_DIR=./seed
 *  AUTH_MODE=dev|header|custom  SESSION_SECRET  OPS_USERS  OPS_PASSWORD
 *  MAX_UPLOAD_MB=100  TRUST_PROXY=0
 */
import { createServer } from 'node:http';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, todayKst, nowIso, json, tx, addDays } from './db.mjs';
import { seedIfEmpty } from './seed.mjs';
import { buildPayload, buildState, canEdit, editorsOf } from './data.mjs';
import * as auth from './auth.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = resolve(process.env.DATA_DIR || join(HERE, '..', 'data'));
const STATIC_DIR = resolve(process.env.STATIC_DIR || join(HERE, '..', 'dist-server'));
const SEED_DIR = resolve(process.env.SEED_DIR || join(HERE, 'seed'));
const FILE_DIR = join(DATA_DIR, 'files');
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_MB || 100) * 1024 * 1024;
const OPS = '정책기획과 빅데이터담당';

mkdirSync(FILE_DIR, { recursive: true });
const db = openDb(join(DATA_DIR, 'tools.db'));
seedIfEmpty(db, SEED_DIR);

/* ───────── 공통 ───────── */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, msg) => {
  throw new HttpError(status, msg);
};

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  // 외부 호출 차단 — 화면은 이 서버의 파일만 씀
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
};

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...SEC_HEADERS,
    'Content-Type': isBuf || typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

async function readBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) fail(413, '보낸 내용이 너무 큼');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  const b = await readBody(req);
  if (!b.length) return {};
  try {
    return JSON.parse(b.toString('utf8'));
  } catch {
    fail(400, '형식이 맞지 않음');
  }
}

function addCookie(res, c) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), c]);
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const list = (v, maxItems, maxLen) => (Array.isArray(v) ? v : []).map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
const audit = (u, action, target, detail) =>
  db.prepare('INSERT INTO audit (at, user_id, action, target, detail) VALUES (?, ?, ?, ?, ?)').run(nowIso(), u?.id ?? null, action, target ?? null, detail ? JSON.stringify(detail) : null);

const toolOr404 = (sid) => db.prepare('SELECT * FROM tools WHERE sid = ?').get(sid) ?? fail(404, '없는 도구');
const needUser = (u) => u ?? fail(401, '로그인이 필요함');
const needOps = (u) => (needUser(u).role === 'ops' ? u : fail(403, '운영 부서만 할 수 있음'));
const needEdit = (t, u) => (canEdit(t, needUser(u)) ? u : fail(403, '이 글을 고칠 권한이 없음'));

/** 같은 출처에서 온 요청만 받음(다른 사이트에서 몰래 보내는 쓰기 요청 차단) */
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    return new URL(o).host === req.headers.host;
  } catch {
    return false;
  }
}

/* ───────── 조회수 ───────── */

let lastCleanup = '';
function countView(sid, visitor) {
  const day = todayKst();
  if (lastCleanup !== day) {
    db.prepare('DELETE FROM view_seen WHERE day < ?').run(addDays(day, -2));
    lastCleanup = day;
  }
  const r = db.prepare('INSERT OR IGNORE INTO view_seen (sid, visitor, day) VALUES (?, ?, ?)').run(sid, visitor, day);
  if (r.changes) {
    db.prepare('INSERT INTO views_daily (sid, day, n) VALUES (?, ?, 1) ON CONFLICT(sid, day) DO UPDATE SET n = n + 1').run(sid, day);
    return true;
  }
  return false;
}

/* ───────── 도구 등록·수정 ───────── */

const BOARDS = ['staff', 'official', 'external'];
const QUESTION_SAFE = [false, false, false, false, true, true];

function toolFields(b) {
  const what = str(b.what, 45);
  const summary = {
    what,
    why: str(b.why, 70) || undefined,
    features: list(b.features, 6, 60),
    steps: list(b.steps, 5, 60),
    run: str(b.run, 20) || undefined,
    needs: list(b.needs, 3, 40),
    cautions: list(b.cautions, 3, 60),
    basis: '글',
    at: todayKst(),
  };
  return {
    title: str(b.title, 60),
    purpose: str(b.purpose, 20),
    target: list(b.targets, 6, 4).join(','),
    deliver: b.deliver === 'url' ? 'url' : 'file',
    url: b.deliver === 'url' ? str(b.url, 500) : '',
    org: str(b.org, 40) || null,
    region: str(b.region, 20) || null,
    req_id: str(b.reqId, 40) || null,
    summary,
  };
}

function checkUrl(u) {
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) fail(400, '주소는 http:// 또는 https:// 로 시작해야 함');
}

function newSid() {
  return `n${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
}

/* ───────── 파일 저장 ───────── */

const safeName = (s) =>
  String(s || 'file')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'file';

async function saveUpload(req, sid, versionId, name) {
  const len = Number(req.headers['content-length'] || 0);
  if (len > MAX_UPLOAD) fail(413, `파일은 ${MAX_UPLOAD / 1024 / 1024}MB까지`);
  const dir = join(FILE_DIR, sid.replace(/[^a-zA-Z0-9_-]/g, '_'));
  mkdirSync(dir, { recursive: true });
  const stored = join(dir, `${randomUUID()}${extname(name).slice(0, 12)}`);
  const hash = createHash('sha256');
  let size = 0;
  await new Promise((ok, no) => {
    const out = createWriteStream(stored);
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        req.destroy();
        out.destroy();
        no(new HttpError(413, '파일이 너무 큼'));
        return;
      }
      hash.update(c);
    });
    req.pipe(out);
    out.on('finish', ok);
    out.on('error', no);
    req.on('error', no);
  }).catch((e) => {
    try {
      unlinkSync(stored);
    } catch {}
    throw e;
  });
  if (!size) {
    unlinkSync(stored);
    fail(400, '빈 파일');
  }
  const mime = String(req.headers['content-type'] || 'application/octet-stream').slice(0, 100);
  const r = db
    .prepare('INSERT INTO files (sid, version_id, name, size, mime, stored, sha256, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(sid, versionId, name, size, mime, stored.slice(DATA_DIR.length + 1), hash.digest('hex'), nowIso());
  return { id: Number(r.lastInsertRowid), name, size };
}

function sendFile(req, res, f, sid) {
  const p = join(DATA_DIR, f.stored);
  if (!existsSync(p)) return send(res, 404, '파일 없음');
  db.prepare('INSERT INTO downloads_daily (sid, day, n) VALUES (?, ?, 1) ON CONFLICT(sid, day) DO UPDATE SET n = n + 1').run(sid, todayKst());
  // 올린 파일은 이 화면 안에서 실행되지 않게 항상 내려받기로
  res.writeHead(200, {
    ...SEC_HEADERS,
    'Content-Type': 'application/octet-stream',
    'Content-Length': statSync(p).size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Cache-Control': 'private, max-age=0',
  });
  createReadStream(p).pipe(res);
}

/* ───────── 경로 ───────── */

const routes = [];
const on = (method, path, fn) => {
  const keys = [];
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
  routes.push({ method, re, keys, fn });
};

on('GET', '/healthz', () => ({ ok: true }));

on('GET', '/api/data', () => buildPayload(db));
on('GET', '/api/state', ({ u }) => buildState(db, u, auth.loginInfo()));

// 로그인
on('POST', '/api/login', async ({ req, res }) => {
  const b = await readJson(req);
  const { user, setCookie } = auth.loginDev(db, b);
  addCookie(res, setCookie);
  audit(user, 'login', user.id);
  return { me: auth.publicUser(user) };
});
on('POST', '/api/logout', ({ res }) => {
  addCookie(res, auth.logoutCookie());
  return { ok: true };
});

// 조회수
on('POST', '/api/tools/:sid/view', ({ p, vid }) => {
  const t = toolOr404(p.sid);
  if (t.status !== 'published') return { counted: false };
  return { counted: countView(t.sid, vid) };
});

// 등록 신청
on('POST', '/api/submissions', async ({ req, u }) => {
  needUser(u);
  const b = await readJson(req);
  const board = BOARDS.includes(b.board) ? b.board : 'staff';
  if (board !== 'staff') needOps(u);
  const f = toolFields(b);
  if (!f.title || !f.summary.what || !f.purpose || !f.target || !f.summary.run) fail(400, '필수 항목을 채워 주세요');
  if (board === 'external' && !f.org) fail(400, '제작 기관을 적어 주세요');
  if (f.deliver === 'url') {
    if (!f.url) fail(400, '배포 주소를 적어 주세요');
    checkUrl(f.url);
  }
  const answers = Array.isArray(b.answers) ? b.answers.slice(0, 6).map((a) => (a === true ? true : a === false ? false : null)) : [];
  if (answers.length !== 6 || answers.some((a) => a === null)) fail(400, '보안 자가점검에 모두 답해 주세요');
  const checks = answers.filter((a, i) => a === QUESTION_SAFE[i]).length;
  const version = str(b.version, 10) || '1.0';
  const sid = newSid();
  const author = auth.display(u);
  tx(db, () => {
    db.prepare(
      `INSERT INTO tools (sid, board, status, stage, title, author, author_id, submitted_at, purpose, target, version, deliver, url, org, region,
        summary, checks, answers, req_id, site, first_seen, updated)
       VALUES (?, ?, 'pending', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sid, board, f.title, board === 'staff' ? author : board === 'external' ? f.org : OPS, u.id, nowIso(), f.purpose, f.target, version,
      f.deliver, f.url, f.org, f.region, JSON.stringify(f.summary), checks, JSON.stringify(answers), f.req_id,
      board === 'external' ? f.url || null : null, todayKst(), nowIso(),
    );
    db.prepare("INSERT INTO versions (sid, version, note, at, by, status, kind) VALUES (?, ?, '처음 등록', ?, ?, 'pending', 'first')").run(sid, version, nowIso(), u.id);
  });
  const versionId = db.prepare('SELECT id FROM versions WHERE sid = ? ORDER BY id DESC LIMIT 1').get(sid).id;
  audit(u, 'submit', sid, { title: f.title, board });
  return { sid, versionId };
});

// 파일 올리기 — 본문이 파일 그대로. ?version=버전id&name=파일이름
on('POST', '/api/tools/:sid/files', async ({ req, u, p, q }) => {
  const t = toolOr404(p.sid);
  needUser(u);
  const own = t.author_id === u.id;
  if (!own && !canEdit(t, u)) fail(403, '이 글에 파일을 올릴 권한이 없음');
  const vid = Number(q.get('version'));
  const v = db.prepare('SELECT * FROM versions WHERE id = ? AND sid = ?').get(vid, t.sid) ?? fail(400, '버전을 찾을 수 없음');
  if (v.status === 'live' && u.role !== 'ops') fail(403, '게시된 버전의 파일은 바꿀 수 없음. 새 버전으로 올려 주세요');
  const name = safeName(q.get('name'));
  const f = await saveUpload(req, t.sid, v.id, name);
  audit(u, 'upload', t.sid, { file: name, version: v.version });
  return f;
});
on('DELETE', '/api/files/:id', ({ u, p }) => {
  const f = db.prepare('SELECT f.*, v.status vstatus FROM files f LEFT JOIN versions v ON v.id = f.version_id WHERE f.id = ?').get(Number(p.id)) ?? fail(404, '없는 파일');
  const t = toolOr404(f.sid);
  needUser(u);
  if (!(t.author_id === u.id || canEdit(t, u))) fail(403, '권한 없음');
  if (f.vstatus === 'live' && u.role !== 'ops') fail(403, '게시된 버전의 파일은 지울 수 없음');
  db.prepare('DELETE FROM files WHERE id = ?').run(f.id);
  try {
    unlinkSync(join(DATA_DIR, f.stored));
  } catch {}
  audit(u, 'file-delete', t.sid, { file: f.name });
  return { ok: true };
});

// 글 수정(내용) — 바로 반영. 파일·버전은 '새 버전'으로
on('PUT', '/api/tools/:sid', async ({ req, u, p }) => {
  const t = toolOr404(p.sid);
  needEdit(t, u);
  const b = await readJson(req);
  const f = toolFields(b);
  if (!f.title || !f.summary.what) fail(400, '도구 이름과 한 줄 소개는 비울 수 없음');
  if (f.deliver === 'url') checkUrl(f.url);
  const old = json(t.summary, {});
  // 배포 방식은 바꾼다고 할 때만(이관 글의 원 게시글 주소 유지)
  const deliver = b.deliver === 'url' ? 'url' : b.deliver === 'file' ? 'file' : t.deliver;
  const url = b.deliver === 'url' ? f.url : t.url;
  db.prepare(
    `UPDATE tools SET title = ?, purpose = ?, target = ?, deliver = ?, url = ?, org = ?, region = ?, summary = ?, updated = ? WHERE sid = ?`,
  ).run(f.title, f.purpose || t.purpose, f.target || t.target, deliver, url, f.org ?? t.org, f.region ?? t.region, JSON.stringify({ ...old, ...f.summary, at: old.at ?? f.summary.at, basis: old.basis ?? '글' }), nowIso(), t.sid);
  if (t.board === 'external' && b.deliver === 'url') db.prepare('UPDATE tools SET site = ? WHERE sid = ?').run(url, t.sid);
  if (f.req_id !== (t.req_id || null)) db.prepare('UPDATE tools SET req_id = ? WHERE sid = ?').run(f.req_id, t.sid);
  audit(u, 'edit', t.sid);
  return { ok: true };
});

// 새 버전 — 운영자는 바로 게시, 그 밖은 보안 검토 뒤 게시
on('POST', '/api/tools/:sid/versions', async ({ req, u, p }) => {
  const t = toolOr404(p.sid);
  needEdit(t, u);
  if (t.status !== 'published') fail(400, '게시된 도구만 새 버전을 올릴 수 있음');
  const b = await readJson(req);
  const version = str(b.version, 10) || fail(400, '버전을 적어 주세요');
  const note = str(b.note, 200) || fail(400, '바뀐 내용을 적어 주세요');
  if (db.prepare("SELECT 1 FROM versions WHERE sid = ? AND status = 'pending'").get(t.sid)) fail(409, '검토 중인 새 버전이 이미 있음. 먼저 처리되거나 취소해야 함');
  const status = 'pending';
  const r = db.prepare("INSERT INTO versions (sid, version, note, at, by, status, kind) VALUES (?, ?, ?, ?, ?, ?, 'update')").run(t.sid, version, note, nowIso(), u.id, status);
  audit(u, 'version', t.sid, { version });
  return { versionId: Number(r.lastInsertRowid), status };
});
// 새 버전 제출 완료(파일 올린 뒤) — 운영자면 바로 게시
on('POST', '/api/versions/:id/submit', ({ u, p }) => {
  const v = db.prepare('SELECT * FROM versions WHERE id = ?').get(Number(p.id)) ?? fail(404, '없는 버전');
  const t = toolOr404(v.sid);
  needEdit(t, u);
  if (u.role === 'ops') publishVersion(v, t, u);
  return { ok: true, live: u.role === 'ops' };
});
on('DELETE', '/api/versions/:id', ({ u, p }) => {
  const v = db.prepare('SELECT * FROM versions WHERE id = ?').get(Number(p.id)) ?? fail(404, '없는 버전');
  const t = toolOr404(v.sid);
  needEdit(t, u);
  if (v.status !== 'pending') fail(400, '검토 중인 버전만 취소할 수 있음');
  for (const f of db.prepare('SELECT * FROM files WHERE version_id = ?').all(v.id)) {
    try {
      unlinkSync(join(DATA_DIR, f.stored));
    } catch {}
  }
  db.prepare('DELETE FROM files WHERE version_id = ?').run(v.id);
  db.prepare('DELETE FROM versions WHERE id = ?').run(v.id);
  return { ok: true };
});

function publishVersion(v, t, u) {
  tx(db, () => {
    db.prepare("UPDATE versions SET status = 'live', at = ? WHERE id = ?").run(nowIso(), v.id);
    db.prepare('UPDATE tools SET version = ?, updated = ? WHERE sid = ?').run(v.version, nowIso(), t.sid);
  });
  audit(u, 'version-live', t.sid, { version: v.version });
}

// 운영: 새 버전 승인·반려
on('POST', '/api/review/versions/:id', async ({ req, u, p }) => {
  needOps(u);
  const b = await readJson(req);
  const v = db.prepare('SELECT * FROM versions WHERE id = ?').get(Number(p.id)) ?? fail(404, '없는 버전');
  const t = toolOr404(v.sid);
  if (b.action === 'approve') publishVersion(v, t, u);
  else if (b.action === 'reject') {
    db.prepare("UPDATE versions SET status = 'rejected', note = note || ? WHERE id = ?").run(b.note ? ` · 반려: ${str(b.note, 100)}` : ' · 반려', v.id);
    audit(u, 'version-reject', t.sid, { version: v.version });
  } else fail(400, '알 수 없는 처리');
  return { ok: true };
});

// 운영: 등록 검수 — 다음 단계·반려·메모
on('POST', '/api/review/:sid', async ({ req, u, p }) => {
  needOps(u);
  const t = toolOr404(p.sid);
  const b = await readJson(req);
  const note = b.note !== undefined ? str(b.note, 100) : t.note;
  if (b.action === 'advance') {
    if (t.status !== 'pending') fail(400, '검수 중인 글이 아님');
    const stage = Math.min(3, t.stage + 1);
    if (stage === 3) {
      tx(db, () => {
        db.prepare("UPDATE tools SET status = 'published', stage = 3, created = ?, note = ?, first_seen = ?, updated = ? WHERE sid = ?").run(todayKst(), note, todayKst(), nowIso(), t.sid);
        db.prepare("UPDATE versions SET status = 'live' WHERE sid = ? AND kind = 'first' AND status = 'pending'").run(t.sid);
      });
    } else db.prepare('UPDATE tools SET stage = ?, note = ? WHERE sid = ?').run(stage, note, t.sid);
    audit(u, stage === 3 ? 'publish' : 'advance', t.sid, { stage });
  } else if (b.action === 'reject') {
    db.prepare("UPDATE tools SET status = 'rejected', note = ? WHERE sid = ?").run(note || '반려', t.sid);
    audit(u, 'reject', t.sid, { note });
  } else if (b.action === 'reopen') {
    db.prepare("UPDATE tools SET status = 'pending', note = ? WHERE sid = ?").run(note, t.sid);
  } else if (b.action === 'note') {
    db.prepare('UPDATE tools SET note = ? WHERE sid = ?').run(note, t.sid);
  } else if (b.action === 'hide') {
    db.prepare("UPDATE tools SET status = 'hidden' WHERE sid = ?").run(t.sid);
    audit(u, 'hide', t.sid);
  } else fail(400, '알 수 없는 처리');
  return { ok: true };
});

// 신청 취소(작성자, 게시 전)
on('DELETE', '/api/submissions/:sid', ({ u, p }) => {
  const t = toolOr404(p.sid);
  needUser(u);
  if (t.author_id !== u.id && u.role !== 'ops') fail(403, '권한 없음');
  if (t.status === 'published') fail(400, '게시된 글은 운영 부서에 내림을 요청해 주세요');
  db.prepare("UPDATE tools SET status = 'hidden', note = '신청 취소' WHERE sid = ?").run(t.sid);
  return { ok: true };
});

// 글 수정 권한
on('PUT', '/api/tools/:sid/editors', async ({ req, u, p }) => {
  const t = toolOr404(p.sid);
  needEdit(t, u);
  const b = await readJson(req);
  const eds = list(b.editors, 20, 60);
  if (!eds.length) fail(400, '한 명 이상 남겨야 함');
  db.prepare('UPDATE tools SET editors = ? WHERE sid = ?').run(JSON.stringify(eds), t.sid);
  audit(u, 'editors', t.sid, { editors: eds });
  return { editors: eds };
});

// 고도화 — 운영자
on('POST', '/api/upgrades/:sid', async ({ req, u, p }) => {
  needOps(u);
  const t = toolOr404(p.sid);
  const b = await readJson(req);
  const cur = db.prepare('SELECT * FROM upgrades WHERE sid = ?').get(t.sid);
  if (b.action === 'start') {
    if (t.board !== 'staff') fail(400, '교직원 제작 도구만 고도화 대상');
    db.prepare('INSERT OR REPLACE INTO upgrades (sid, stage, notes, started_at, by) VALUES (?, 0, ?, ?, ?)').run(t.sid, '[]', todayKst(), u.id);
  } else if (b.action === 'next') {
    if (!cur) fail(400, '고도화 진행 중이 아님');
    const notes = json(cur.notes, []);
    notes[cur.stage] = str(b.note, 80);
    if (cur.stage < 2) {
      db.prepare('UPDATE upgrades SET stage = ?, notes = ? WHERE sid = ?').run(cur.stage + 1, JSON.stringify(notes), t.sid);
    } else {
      // 전환 — 구분을 교육청 배포로, 원작자 수정 권한 유지. 주소·조회수·후기·댓글은 그대로
      const version = str(b.version, 10) || '2.0';
      notes[2] = [str(b.note, 80), `v${version}`].filter(Boolean).join(' · ');
      const eds = [...new Set([OPS, ...editorsOf(t)])];
      tx(db, () => {
        db.prepare('UPDATE upgrades SET stage = 3, notes = ?, converted_at = ?, version = ? WHERE sid = ?').run(JSON.stringify(notes), todayKst(), version, t.sid);
        db.prepare("UPDATE tools SET board = 'official', origin = author, converted_at = ?, version = ?, editors = ?, updated = ? WHERE sid = ?").run(todayKst(), version, JSON.stringify(eds), nowIso(), t.sid);
        db.prepare("INSERT INTO versions (sid, version, note, at, by, status, kind) VALUES (?, ?, '고도화 후 교육청 배포 도구로 전환', ?, ?, 'live', 'convert')").run(t.sid, version, nowIso(), u.id);
      });
      audit(u, 'convert', t.sid, { version });
    }
  } else if (b.action === 'cancel') {
    if (cur?.converted_at) fail(400, '이미 전환된 도구는 되돌릴 수 없음');
    db.prepare('DELETE FROM upgrades WHERE sid = ?').run(t.sid);
  } else fail(400, '알 수 없는 처리');
  return { ok: true };
});

// 댓글(질문과 답변)
on('POST', '/api/tools/:sid/comments', async ({ req, u, p }) => {
  const t = toolOr404(p.sid);
  needUser(u);
  const b = await readJson(req);
  const content = str(b.content, 1000) || fail(400, '내용을 적어 주세요');
  const maker = canEdit(t, u) && u.role !== 'ops' ? 1 : t.author_id === u.id ? 1 : 0;
  db.prepare('INSERT INTO comments (sid, user_id, writer, date, content, maker) VALUES (?, ?, ?, ?, ?, ?)').run(t.sid, u.id, auth.display(u), todayKst(), content, maker);
  return { ok: true };
});
on('DELETE', '/api/comments/:id', ({ u, p }) => {
  needUser(u);
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(p.id)) ?? fail(404, '없는 댓글');
  if (c.user_id !== u.id && u.role !== 'ops') fail(403, '권한 없음');
  db.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').run(c.id);
  audit(u, 'comment-delete', c.sid, { id: c.id });
  return { ok: true };
});

// 후기·써봤어요·알림
on('POST', '/api/tools/:sid/reviews', async ({ req, u, p }) => {
  const t = toolOr404(p.sid);
  needUser(u);
  const b = await readJson(req);
  const stars = Math.round(Number(b.stars));
  if (!(stars >= 1 && stars <= 5)) fail(400, '평점을 골라 주세요');
  const text = str(b.text, 200) || fail(400, '후기를 적어 주세요');
  db.prepare('INSERT INTO reviews (sid, user_id, writer, stars, text, at) VALUES (?, ?, ?, ?, ?, ?)').run(t.sid, u.id, auth.display(u), stars, text, todayKst());
  return { ok: true };
});
on('DELETE', '/api/reviews/:id', ({ u, p }) => {
  needUser(u);
  const r = db.prepare('SELECT * FROM reviews WHERE id = ?').get(Number(p.id)) ?? fail(404, '없는 후기');
  if (r.user_id !== u.id && u.role !== 'ops') fail(403, '권한 없음');
  db.prepare('DELETE FROM reviews WHERE id = ?').run(r.id);
  return { ok: true };
});
const toggle = (table, col, val, u) => {
  const has = db.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ? AND user_id = ?`).get(val, u.id);
  if (has) db.prepare(`DELETE FROM ${table} WHERE ${col} = ? AND user_id = ?`).run(val, u.id);
  else db.prepare(`INSERT INTO ${table} (${col}, user_id, at) VALUES (?, ?, ?)`).run(val, u.id, nowIso());
  return { on: !has };
};
on('POST', '/api/tools/:sid/used', ({ u, p }) => toggle('used', 'sid', toolOr404(p.sid).sid, needUser(u)));
on('POST', '/api/tools/:sid/subs', ({ u, p }) => toggle('subs', 'sid', toolOr404(p.sid).sid, needUser(u)));

// 도구 요청
const reqOr404 = (id) => db.prepare('SELECT * FROM requests WHERE id = ?').get(id) ?? fail(404, '없는 요청');
on('POST', '/api/requests', async ({ req, u }) => {
  needUser(u);
  const b = await readJson(req);
  const title = str(b.title, 60) || fail(400, '제목을 적어 주세요');
  const id = `q${Date.now().toString(36)}`;
  db.prepare('INSERT INTO requests (id, title, detail, field, who, user_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, title, str(b.detail, 600), str(b.field, 20), str(b.who, 30) || u.org, u.id, todayKst(),
  );
  audit(u, 'request', id);
  return { id };
});
on('DELETE', '/api/requests/:id', ({ u, p }) => {
  const r = reqOr404(p.id);
  needUser(u);
  if (r.user_id !== u.id && u.role !== 'ops') fail(403, '권한 없음');
  db.prepare('UPDATE requests SET closed = 1 WHERE id = ?').run(r.id);
  return { ok: true };
});
on('POST', '/api/requests/:id/like', ({ u, p }) => {
  const r = reqOr404(p.id);
  needUser(u);
  const has = db.prepare('SELECT 1 FROM request_likes WHERE req_id = ? AND user_id = ?').get(r.id, u.id);
  if (has) db.prepare('DELETE FROM request_likes WHERE req_id = ? AND user_id = ?').run(r.id, u.id);
  else db.prepare('INSERT INTO request_likes (req_id, user_id) VALUES (?, ?)').run(r.id, u.id);
  return { on: !has };
});
on('POST', '/api/requests/:id/making', ({ u, p }) => {
  const r = reqOr404(p.id);
  needUser(u);
  const has = db.prepare('SELECT 1 FROM request_making WHERE req_id = ? AND user_id = ?').get(r.id, u.id);
  if (has) db.prepare('DELETE FROM request_making WHERE req_id = ? AND user_id = ?').run(r.id, u.id);
  else db.prepare('INSERT INTO request_making (req_id, user_id, name, at) VALUES (?, ?, ?, ?)').run(r.id, u.id, auth.display(u), nowIso());
  return { on: !has };
});
on('POST', '/api/requests/:id/comments', async ({ req, u, p }) => {
  const r = reqOr404(p.id);
  needUser(u);
  const b = await readJson(req);
  const text = str(b.text, 300) || fail(400, '의견을 적어 주세요');
  const maker = db.prepare('SELECT 1 FROM request_making WHERE req_id = ? AND user_id = ?').get(r.id, u.id) ? 1 : 0;
  db.prepare('INSERT INTO request_comments (req_id, user_id, who, at, text, maker) VALUES (?, ?, ?, ?, ?, ?)').run(r.id, u.id, str(b.who, 30) || u.org || u.name, todayKst(), text, maker);
  return { ok: true };
});
on('DELETE', '/api/request-comments/:id', ({ u, p }) => {
  needUser(u);
  const c = db.prepare('SELECT * FROM request_comments WHERE id = ?').get(Number(p.id)) ?? fail(404, '없는 의견');
  if (c.user_id !== u.id && u.role !== 'ops') fail(403, '권한 없음');
  db.prepare('DELETE FROM request_comments WHERE id = ?').run(c.id);
  return { ok: true };
});
on('POST', '/api/requests/:id/links', async ({ req, u, p }) => {
  needOps(u);
  const r = reqOr404(p.id);
  const b = await readJson(req);
  const t = toolOr404(str(b.sid, 40));
  if (b.on === false) db.prepare('DELETE FROM request_links WHERE req_id = ? AND sid = ?').run(r.id, t.sid);
  else db.prepare('INSERT OR IGNORE INTO request_links (req_id, sid, by) VALUES (?, ?, ?)').run(r.id, t.sid, u.id);
  audit(u, 'request-link', r.id, { sid: t.sid, on: b.on !== false });
  return { ok: true };
});

/* ───────── 파일 내려받기 ───────── */

function handleDownload(req, res, path, u) {
  let m = path.match(/^\/files\/(\d+)(?:\/.*)?$/);
  if (m) {
    const f = db.prepare('SELECT f.*, v.status vstatus, t.status tstatus, t.author_id, t.editors, t.author, t.board, t.origin FROM files f LEFT JOIN versions v ON v.id = f.version_id JOIN tools t ON t.sid = f.sid WHERE f.id = ?').get(Number(m[1]));
    if (!f) return send(res, 404, '파일 없음');
    const isPublic = f.vstatus === 'live' && f.tstatus === 'published';
    // 검토 중 파일은 올린 사람·수정 권한자·운영자만
    if (!isPublic && !(u && (u.role === 'ops' || f.author_id === u.id || canEdit(f, u)))) return send(res, 403, '검토 중인 파일');
    return sendFile(req, res, f, f.sid);
  }
  m = path.match(/^\/download\/([^/]+)$/);
  if (m) {
    const v = db.prepare("SELECT v.id FROM versions v JOIN tools t ON t.sid = v.sid WHERE v.sid = ? AND v.status = 'live' AND t.status = 'published' ORDER BY v.id DESC LIMIT 1").get(decodeURIComponent(m[1]));
    const f = v && db.prepare('SELECT * FROM files WHERE version_id = ? ORDER BY id LIMIT 1').get(v.id);
    if (!f) return send(res, 404, '파일 없음');
    return sendFile(req, res, f, f.sid);
  }
  return false;
}

/* ───────── 화면 파일 ───────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};
let indexHtml = null;
const getIndex = () => (indexHtml ??= readFileSync(join(STATIC_DIR, 'index.html')));

function serveStatic(req, res, path) {
  const rel = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
  const file = join(STATIC_DIR, rel);
  if (rel && file.startsWith(STATIC_DIR) && existsSync(file) && statSync(file).isFile()) {
    const immutable = rel.startsWith('assets/');
    res.writeHead(200, {
      ...SEC_HEADERS,
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).pipe(res);
  }
  if (rel.startsWith('assets/')) return send(res, 404, '없음');
  // 그 밖의 주소는 화면(index.html)이 경로를 읽어 그림
  res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : getIndex());
}

/* ───────── 서버 ───────── */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const path = url.pathname;
  try {
    // 방문자 표시(조회수 중복 제외용, 개인 정보 없음)
    const cookies = auth.parseCookies(req);
    let vid = cookies.dt_vid;
    if (!vid || !/^[a-f0-9]{32}$/.test(vid)) {
      vid = randomBytes(16).toString('hex');
      addCookie(res, auth.cookie('dt_vid', vid, 365 * 24 * 3600));
    }
    const u = await auth.currentUser(db, req);

    if (path.startsWith('/api/')) {
      if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: '다른 사이트에서 온 요청' });
      const r = routes.find((x) => x.method === req.method && x.re.test(path));
      if (!r) return send(res, 404, { error: '없는 주소' });
      const m = path.match(r.re);
      const p = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const out = await r.fn({ req, res, u, p, q: url.searchParams, vid });
      return send(res, 200, out ?? { ok: true });
    }
    if (path === '/healthz') return send(res, 200, { ok: true });
    if (path === '/auth/start' && auth.customAuth()) return auth.customAuth().start(req, res, url.searchParams.get('next') || '/');
    if (path === '/auth/callback' && auth.customAuth()) {
      const r = await auth.customAuth().callback(req);
      if (!r?.user?.id) return send(res, 401, '통합인증 확인 실패');
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.user.id) ?? (db.prepare('INSERT INTO users (id, name, org, role, created) VALUES (?, ?, ?, ?, ?)').run(r.user.id, r.user.name, r.user.org ?? '', 'user', nowIso()), db.prepare('SELECT * FROM users WHERE id = ?').get(r.user.id));
      addCookie(res, auth.sessionFor(user));
      res.writeHead(302, { Location: r.next?.startsWith('/') ? r.next : '/' });
      return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '허용되지 않음');
    if (handleDownload(req, res, path, u) !== false) return;
    return serveStatic(req, res, path);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) send(res, status, path.startsWith('/api/') ? { error: e.message || '서버 오류' } : e.message || '서버 오류');
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[데이터 도구실] http://0.0.0.0:${PORT}  (DATA_DIR=${DATA_DIR}, AUTH_MODE=${auth.authMode})`);
});

const stop = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
