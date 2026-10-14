/**
 * 화면용 자료 만들기.
 *  - payload : 도구·조회 이력·댓글·요약 (기존 화면의 /api/data 와 같은 모양 + 서버판 추가 정보)
 *  - state   : 로그인한 사람 기준 — 요청·검수·고도화·내가 누른 것
 * 조회 이력은 수집하지 않고 DB에 쌓인 날짜별 조회수로 바로 계산함
 */
import { addDays, json, todayKst } from './db.mjs';
import { display } from './auth.mjs';

const OPS = '정책기획과 빅데이터담당';

/** 파일 내려받기 주소 */
export const fileUrl = (f) => `/files/${f.id}/${encodeURIComponent(f.name)}`;

function liveVersion(db, sid) {
  return db.prepare("SELECT * FROM versions WHERE sid = ? AND status = 'live' ORDER BY id DESC LIMIT 1").get(sid);
}

export function filesOf(db, versionId) {
  return versionId ? db.prepare('SELECT id, name, size, mime, at FROM files WHERE version_id = ? ORDER BY id').all(versionId) : [];
}

/** 도구 하나의 조회 이력(누적값) — 이관 스냅숏 + 서버가 센 날짜별 조회수 */
function historyOf(db, t, today) {
  const imported = db.prepare('SELECT day, cum FROM history_import WHERE sid = ? ORDER BY day').all(t.sid);
  const vd = db.prepare('SELECT day, n FROM views_daily WHERE sid = ? ORDER BY day').all(t.sid);
  const base = t.base_views || 0;
  const from = t.base_day || t.created || today;
  const out = imported.filter((r) => r.day < from).map((r) => [r.day, r.cum]);
  let cum = base;
  let i = 0;
  // 시작일 이전에 센 조회수(이관 당일 등)는 시작일 값에 합침
  while (i < vd.length && vd[i].day < from) cum += vd[i++].n;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    while (i < vd.length && vd[i].day <= d) cum += vd[i++].n;
    out.push([d, cum]);
  }
  return { hist: out, views: cum };
}

export function buildPayload(db) {
  const today = todayKst();
  const rows = db.prepare("SELECT * FROM tools WHERE status = 'published' ORDER BY created DESC, sid DESC").all();
  const newComments = new Map(
    db.prepare('SELECT sid, COUNT(*) n FROM comments WHERE legacy_cid IS NULL AND deleted = 0 GROUP BY sid').all().map((r) => [r.sid, r.n]),
  );
  const ups = new Map(db.prepare('SELECT * FROM upgrades').all().map((u) => [u.sid, u]));
  const boards = { staff: { tools: [], history: {} }, official: { tools: [], history: {} }, external: { tools: [], history: {} } };
  const summaries = {};
  const extra = {};

  for (const t of rows) {
    const { hist, views } = historyOf(db, t, today);
    const v = liveVersion(db, t.sid);
    const files = filesOf(db, v?.id);
    const url = `/tool/${t.sid}`; // 목록의 '사용하기'는 도구 화면으로(내려받기·주소는 거기서)
    const tool = {
      sid: t.sid,
      title: t.title,
      url,
      created: t.created || '',
      author: t.board === 'staff' ? t.author : t.origin ? OPS : t.author,
      views,
      comments: (t.legacy_comments || 0) + (newComments.get(t.sid) ?? 0),
      purpose: t.purpose,
      target: t.target,
      firstSeen: t.first_seen || t.created || today,
      board: t.board,
      ...(t.origin ? { origin: t.origin, convertedAt: t.converted_at } : {}),
      ...(t.site ? { site: t.site } : {}),
      ...(t.field ? { field: t.field } : {}),
      ...(t.kind ? { kind: t.kind } : {}),
    };
    boards[t.board]?.tools.push(tool);
    if (boards[t.board]) boards[t.board].history[t.sid] = hist;
    const s = json(t.summary, null);
    if (s) summaries[t.sid] = s;

    const versions = db
      .prepare("SELECT id, version, note, at, kind FROM versions WHERE sid = ? AND status = 'live' ORDER BY id DESC")
      .all(t.sid);
    const up = ups.get(t.sid);
    extra[t.sid] = {
      version: v?.version || t.version || '',
      deliver: t.deliver,
      link: t.deliver === 'url' ? t.url : '',
      legacyUrl: t.deliver === 'board' && !files.length ? t.url : '',
      files: files.map((f) => ({ ...f, url: fileUrl(f) })),
      versions,
      editors: editorsOf(t),
      checks: t.checks,
      answers: json(t.answers, null),
      org: t.org || '',
      region: t.region || '',
      reqId: t.req_id || '',
      converted: up?.converted_at ? { at: up.converted_at, version: up.version || '' } : null,
      downloads: db.prepare('SELECT COALESCE(SUM(n),0) n FROM downloads_daily WHERE sid = ?').get(t.sid).n,
    };
  }

  const comments = db
    .prepare('SELECT id, sid, writer, date, content, maker, legacy_cid, user_id FROM comments WHERE deleted = 0 ORDER BY date DESC, id DESC')
    .all()
    .map((c) => ({ sid: c.sid, cid: c.legacy_cid ?? `c${c.id}`, writer: c.writer, date: c.date, content: c.content, maker: !!c.maker, id: c.id, uid: c.user_id ?? '' }));

  const asOf = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  return {
    edition: 'server',
    asOf,
    fetchedAt: new Date().toISOString(),
    tools: boards.staff.tools,
    history: boards.staff.history,
    comments,
    commentsOk: true,
    official: { asOf, ...boards.official },
    external: { asOf, ...boards.external },
    summaries,
    extra,
  };
}

/** 글 수정 권한 — 따로 정하지 않았으면 교직원 제작은 작성자, 그 밖은 운영 부서. 전환된 도구는 운영 부서 + 원작자 */
export function editorsOf(t) {
  const set = json(t.editors, null);
  if (Array.isArray(set) && set.length) return set;
  if (t.origin) return [OPS, t.origin];
  return t.board === 'staff' ? [t.author] : [OPS];
}

/** 이 사람이 이 도구 글을 고칠 수 있나 */
export function canEdit(t, u) {
  if (!u) return false;
  if (u.role === 'ops') return true;
  if (t.author_id && t.author_id === u.id) return true;
  const eds = editorsOf(t);
  return eds.includes(u.id) || eds.includes(display(u));
}

const asSubmission = (t) => {
  const s = json(t.summary, {});
  return {
    id: t.sid,
    title: t.title,
    what: s.what ?? '',
    purpose: t.purpose,
    run: s.run ?? '',
    version: t.version,
    at: (t.submitted_at || '').slice(0, 10),
    stage: t.status === 'published' ? 3 : t.stage,
    checks: t.checks,
    board: t.board,
    org: t.org || undefined,
    region: t.region || undefined,
    note: t.note || undefined,
    reqId: t.req_id || undefined,
    status: t.status,
    author: t.author,
    answers: json(t.answers, null),
    summary: s,
    target: t.target,
    deliver: t.deliver,
    url: t.deliver === 'url' ? t.url : '',
  };
};

export function buildState(db, u, login) {
  const uid = u?.id ?? '';
  const ops = u?.role === 'ops';
  const me = u ? { id: u.id, name: u.name, org: u.org, display: display(u), ops } : null;

  // 요청
  const reqs = db.prepare('SELECT * FROM requests WHERE closed = 0 ORDER BY at DESC, id DESC').all();
  const likeN = new Map(db.prepare('SELECT req_id, COUNT(*) n FROM request_likes GROUP BY req_id').all().map((r) => [r.req_id, r.n]));
  const making = db.prepare('SELECT req_id, user_id, name FROM request_making ORDER BY at').all();
  const rcom = db.prepare('SELECT * FROM request_comments ORDER BY id').all();
  const links = db.prepare('SELECT req_id, sid FROM request_links').all();
  const byReg = db.prepare("SELECT sid, req_id FROM tools WHERE req_id IS NOT NULL AND req_id != '' AND status = 'published'").all();
  const requests = reqs.map((r) => ({
    id: r.id,
    title: r.title,
    detail: r.detail,
    field: r.field,
    who: r.who,
    at: r.at,
    likes: likeN.get(r.id) ?? 0,
    sids: [...new Set([...links.filter((l) => l.req_id === r.id).map((l) => l.sid), ...byReg.filter((t) => t.req_id === r.id).map((t) => t.sid)])],
    opsLinks: links.filter((l) => l.req_id === r.id).map((l) => l.sid),
    making: making.filter((m) => m.req_id === r.id).map((m) => m.name),
    comments: rcom.filter((c) => c.req_id === r.id).map((c) => ({ id: c.id, who: c.who, at: c.at, text: c.text, maker: !!c.maker, mine: !!uid && c.user_id === uid })),
    mine: !!uid && r.user_id === uid,
  }));

  // 검수 — 운영자는 전체, 그 밖은 내 신청만. 일반 교직원 화면에는 남의 검수 중 글을 보이지 않음
  const subRows = ops
    ? db.prepare("SELECT * FROM tools WHERE author_id IS NOT NULL AND (status IN ('pending','rejected') OR (status = 'published' AND created >= ?)) ORDER BY submitted_at DESC").all(addDays(todayKst(), -30))
    : uid
      ? db.prepare("SELECT * FROM tools WHERE author_id = ? AND (status IN ('pending','rejected') OR (status = 'published' AND created >= ?)) ORDER BY submitted_at DESC").all(uid, addDays(todayKst(), -30))
      : [];
  const firstFiles = (sid) => {
    const v = db.prepare("SELECT id FROM versions WHERE sid = ? AND kind = 'first' ORDER BY id LIMIT 1").get(sid);
    return filesOf(db, v?.id).map((f) => ({ ...f, url: fileUrl(f) }));
  };
  const submissions = subRows.map((t) => ({ ...asSubmission(t), mine: !!uid && t.author_id === uid, files: firstFiles(t.sid) }));

  // 업데이트(새 버전) 검토
  const verRows = ops
    ? db.prepare("SELECT v.*, t.title, t.board, t.author FROM versions v JOIN tools t ON t.sid = v.sid WHERE v.status = 'pending' AND t.status = 'published' ORDER BY v.id DESC").all()
    : uid
      ? db.prepare("SELECT v.*, t.title, t.board, t.author FROM versions v JOIN tools t ON t.sid = v.sid WHERE v.status = 'pending' AND t.status = 'published' AND v.by = ? ORDER BY v.id DESC").all(uid)
      : [];
  const updates = verRows.map((v) => ({ id: v.id, sid: v.sid, title: v.title, board: v.board, version: v.version, note: v.note, at: v.at.slice(0, 10), files: filesOf(db, v.id).map((f) => ({ ...f, url: fileUrl(f) })) }));

  // 고도화 — 진행 중인 것은 운영자만
  const upgrades = {};
  for (const u2 of db.prepare('SELECT u.*, t.title, t.author, t.origin FROM upgrades u JOIN tools t ON t.sid = u.sid').all()) {
    if (!ops && !u2.converted_at) continue;
    upgrades[u2.sid] = {
      stage: u2.stage,
      notes: json(u2.notes, []),
      startedAt: u2.started_at,
      convertedAt: u2.converted_at || undefined,
      version: u2.version || undefined,
      title: u2.title,
      maker: u2.origin || u2.author,
    };
  }

  // 후기·써봤어요
  const reviews = db.prepare('SELECT id, sid, writer, stars, text, at, user_id FROM reviews ORDER BY id DESC').all().map((r) => ({ id: r.id, sid: r.sid, writer: r.writer, stars: r.stars, text: r.text, at: r.at, mine: !!uid && r.user_id === uid }));
  const usedCount = Object.fromEntries(db.prepare('SELECT sid, COUNT(*) n FROM used GROUP BY sid').all().map((r) => [r.sid, r.n]));
  const pick = (sql) => (uid ? db.prepare(sql).all(uid).map((r) => Object.values(r)[0]) : []);

  // 내가 고칠 수 있는 도구
  const editable = u
    ? db
        .prepare("SELECT * FROM tools WHERE status = 'published'")
        .all()
        .filter((t) => canEdit(t, u))
        .map((t) => t.sid)
    : [];

  return {
    me,
    login,
    requests,
    submissions,
    updates,
    upgrades,
    reviews,
    usedCount,
    myUsed: pick('SELECT sid FROM used WHERE user_id = ?'),
    mySubs: pick('SELECT sid FROM subs WHERE user_id = ?'),
    myLikes: pick('SELECT req_id FROM request_likes WHERE user_id = ?'),
    myMaking: pick('SELECT req_id FROM request_making WHERE user_id = ?'),
    editable,
  };
}
