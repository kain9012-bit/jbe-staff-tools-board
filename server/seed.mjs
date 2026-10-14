/**
 * 최초 1회 이관 — 지금까지의 도구 글·조회 이력·댓글·요약을 DB로 옮김.
 * 이미 이관했으면(meta.seeded) 아무것도 하지 않음. 이후 외부 접속 없음.
 *
 * 이관 파일(SEED_DIR):
 *  - payload.json        교직원 제작·교육청 배포 도구, 조회 이력, 댓글 (기존 화면의 /api/data 응답을 저장한 것)
 *  - summaries.json      도구 요약
 *  - external-tools.json 외부 공공업무 도구 목록
 *  - official-meta.json  교육청 배포 도구 사용목적·적용기관
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMeta, nowIso, setMeta, tx } from './db.mjs';

/** 이관 폴더에 없으면 저장소의 src/data 에서(개발용) */
const SRC_DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const read = (dir, name) => {
  for (const p of [join(dir, name), join(SRC_DATA, name)]) if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  return null;
};

const versionOf = (title) => title.match(/[(\s]v(?:er\.?)?\s?(\d+(?:\.\d+){0,3})\)?/i)?.[1] ?? '';

export function seedIfEmpty(db, dir, log = console.log) {
  if (getMeta(db, 'seeded')) return false;
  const payload = read(dir, 'payload.json');
  const sums = read(dir, 'summaries.json')?.items ?? {};
  const ext = read(dir, 'external-tools.json');
  const offMeta = read(dir, 'official-meta.json')?.items ?? {};
  if (!payload && !ext) {
    setMeta(db, 'seeded', nowIso());
    log('[seed] 이관 파일 없음 — 빈 상태로 시작');
    return false;
  }

  const insTool = db.prepare(`
    INSERT OR IGNORE INTO tools (sid, board, status, stage, title, author, created, submitted_at, purpose, target, version,
      deliver, url, site, field, kind, summary, checks, base_views, base_day, legacy_comments, first_seen, updated)
    VALUES (?, ?, 'published', 3, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`);
  const insHist = db.prepare('INSERT OR REPLACE INTO history_import (sid, day, cum) VALUES (?, ?, ?)');
  const insVer = db.prepare(`INSERT INTO versions (sid, version, note, at, by, status, kind) VALUES (?, ?, ?, ?, ?, 'live', 'first')`);
  const insCom = db.prepare('INSERT INTO comments (sid, writer, date, content, maker, legacy_cid) VALUES (?, ?, ?, ?, ?, ?)');

  let n = 0;
  tx(db, () => {
    const addBoard = (tools, history, asOf, board) => {
      const day = (asOf || '').slice(0, 10);
      for (const t of tools ?? []) {
        const hist = history?.[t.sid] ?? [];
        const last = hist.length ? hist[hist.length - 1] : null;
        const views = Math.max(t.views ?? 0, last?.[1] ?? 0);
        const meta = board === 'official' ? offMeta[t.sid] : null;
        const s = sums[t.sid];
        insTool.run(
          t.sid, board, t.title, t.author ?? '', t.created ?? '', t.created ?? '',
          meta?.purpose ?? t.purpose ?? '', meta?.target ?? t.target ?? '', versionOf(t.title), board === 'external' ? 'url' : 'board',
          t.url ?? '', t.site ?? null, t.field ?? null, t.kind ?? null,
          s ? JSON.stringify(s) : null, views, day, t.comments ?? 0, t.firstSeen ?? day, nowIso(),
        );
        for (const [d, v] of hist) insHist.run(t.sid, d, v);
        // 마지막 스냅숏보다 목록 조회수가 크면 이관일 값으로 보탬
        if (day && (!last || (last[0] <= day && views > last[1]))) insHist.run(t.sid, day, views);
        insVer.run(t.sid, versionOf(t.title), '이관(기존 게시판 글)', t.created || day, t.author ?? '');
        n++;
      }
    };
    if (payload) {
      addBoard(payload.tools, payload.history, payload.asOf, 'staff');
      if (payload.official) addBoard(payload.official.tools, payload.official.history, payload.official.asOf, 'official');
      for (const c of payload.comments ?? []) insCom.run(c.sid, c.writer, c.date, c.content, c.maker ? 1 : 0, c.cid ?? null);
    }
    if (ext) {
      const tools = ext.items.map((e) => ({
        sid: e.sid, title: e.title, created: e.created, author: '외부 기관', views: e.views, purpose: e.purpose, target: e.target,
        url: e.site, site: e.site, field: e.field, kind: e.kind, firstSeen: ext.asOf,
      }));
      addBoard(tools, Object.fromEntries(ext.items.map((e) => [e.sid, [[ext.asOf, e.views]]])), ext.asOf, 'external');
    }
    setMeta(db, 'seeded', nowIso());
    setMeta(db, 'seed_asof', payload?.asOf ?? ext?.asOf ?? '');
  });
  log(`[seed] 도구 ${n}건 이관 완료`);
  return true;
}
