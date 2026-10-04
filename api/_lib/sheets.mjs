/**
 * 구글 시트(수집기가 쓰는 시트) 3종을 CSV로 읽어 화면용 JSON으로 묶는다.
 *
 * gviz(시트 이름) 대신 export(gid)로 읽는다.
 * gviz는 열 형식을 다수결로 추정해서 소수 형식 값을 빈칸으로 버린다.
 */
export const SHEET_ID =
  process.env.SHEET_ID || '1Kq9WboOQO-UsxEX24qXruSg_qbS9bfDGk5txXi9Bfs8';

export const GIDS = {
  tools: process.env.GID_TOOLS || '794330143',
  history: process.env.GID_HISTORY || '1478783098',
  comments: process.env.GID_COMMENTS || '2087929200',
};

const csvUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

/** 따옴표·줄바꿈을 지원하는 CSV 파서 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const num = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** "2026-10-04" 또는 "2026. 10. 4" → "2026-10-04" */
const day = (v) => {
  const s = String(v ?? '').trim();
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : s;
};

const byHeader = (rows) => {
  const [head, ...body] = rows;
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  return body
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => (key) => (idx[key] === undefined ? '' : (r[idx[key]] ?? '').trim()));
};

async function fetchCsv(gid) {
  const res = await fetch(csvUrl(gid), { redirect: 'follow' });
  if (!res.ok) throw new Error(`시트 읽기 실패 (gid ${gid}, HTTP ${res.status})`);
  const text = await res.text();
  if (/^\s*<!doctype html|<html/i.test(text)) {
    throw new Error('시트가 공개 상태가 아님 — 링크 공유 설정 확인 필요');
  }
  return parseCsv(text);
}

export function buildPayload(toolsRows, historyRows, commentRows) {
  const tools = byHeader(toolsRows)
    .filter((g) => g('게시상태') === '게시중' && g('dataSid'))
    .map((g) => ({
      sid: g('dataSid'),
      title: g('도구명').replace(/\s*\(\s*댓글\s*:\s*[0-9,]+\s*\)\s*$/, ''),
      url: g('게시글URL'),
      created: day(g('작성일')),
      author: g('작성자') || '(작성자 미확인)',
      views: num(g('현재누적조회수')) ?? 0,
      comments: num(g('댓글수')) ?? 0,
      purpose: g('사용목적'),
      target: g('적용기관'),
      firstSeen: day(g('최초수집일')),
    }));

  const live = new Set(tools.map((t) => t.sid));

  /** sid → [[기준일, 누적조회수], ...] (기준일 오름차순) */
  const history = {};
  let asOf = '';
  for (const g of byHeader(historyRows)) {
    const sid = g('dataSid');
    if (!live.has(sid)) continue;
    const v = num(g('누적조회수'));
    if (v === null) continue;
    (history[sid] ||= []).push([day(g('기준일')), v]);
    const at = g('수집시각');
    if (at > asOf) asOf = at;
  }
  for (const k of Object.keys(history)) history[k].sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const comments = commentRows
    ? byHeader(commentRows)
        .filter((g) => g('상태') === '게시중' && live.has(g('dataSid')))
        .map((g) => ({
          sid: g('dataSid'),
          cid: g('commentSid'),
          writer: g('댓글작성자'),
          date: day(g('댓글작성일')),
          content: g('내용').replace(/^'/, ''),
          maker: g('제작자답글') === 'Y',
        }))
        .sort((a, b) => (a.date === b.date ? (b.cid > a.cid ? 1 : -1) : a.date < b.date ? 1 : -1))
    : [];

  return { asOf, fetchedAt: new Date().toISOString(), tools, history, comments };
}

export async function loadPayload() {
  const [t, h, c] = await Promise.all([
    fetchCsv(GIDS.tools),
    fetchCsv(GIDS.history),
    fetchCsv(GIDS.comments).catch(() => null), // 댓글을 못 읽어도 조회수 화면은 띄운다
  ]);
  const payload = buildPayload(t, h, c);
  payload.commentsOk = c !== null;
  return payload;
}
