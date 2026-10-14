/**
 * 데이터 도구실 서버판 — DB(SQLite 파일 하나).
 * Node 내장 node:sqlite 사용. 외부 패키지 없음.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      org TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',      -- user | ops
      created TEXT NOT NULL,
      last_seen TEXT
    );

    -- 도구 글. status: pending(검수 중) | published(게시) | rejected(반려) | hidden(내림)
    CREATE TABLE IF NOT EXISTS tools (
      sid TEXT PRIMARY KEY,
      board TEXT NOT NULL DEFAULT 'staff',    -- staff | official | external
      status TEXT NOT NULL DEFAULT 'pending',
      stage INTEGER NOT NULL DEFAULT 0,       -- 0 등록 신청 · 1 자가점검 · 2 보안 검토 · 3 게시
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',        -- 화면 표기: 소속(이름)
      author_id TEXT,
      created TEXT,                           -- 게시일
      submitted_at TEXT,
      purpose TEXT NOT NULL DEFAULT '',
      target TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '',
      deliver TEXT NOT NULL DEFAULT 'file',   -- file | url
      url TEXT NOT NULL DEFAULT '',           -- 주소형 도구의 주소, 이관 도구의 원 게시글
      site TEXT, field TEXT, kind TEXT, org TEXT, region TEXT,
      summary TEXT,                           -- JSON: what·why·features·steps·run·needs·cautions
      checks INTEGER NOT NULL DEFAULT 0,
      answers TEXT,                           -- JSON 자가점검 답
      note TEXT NOT NULL DEFAULT '',          -- 검수 메모
      req_id TEXT,
      origin TEXT,                            -- 고도화 전환 시 원작자
      converted_at TEXT,
      editors TEXT,                           -- JSON 글 수정 권한(사용자 id 또는 소속(이름))
      base_views INTEGER NOT NULL DEFAULT 0,  -- 이관 시점 누적 조회수
      base_day TEXT,                          -- 이관 자료의 마지막 날
      legacy_comments INTEGER NOT NULL DEFAULT 0,
      first_seen TEXT,
      updated TEXT
    );

    -- 이관한 조회 이력(누적값 스냅숏). 이관 이후는 views_daily로 계산
    CREATE TABLE IF NOT EXISTS history_import (sid TEXT, day TEXT, cum INTEGER, PRIMARY KEY (sid, day));
    -- 서버가 직접 센 날짜별 조회수
    CREATE TABLE IF NOT EXISTS views_daily (sid TEXT, day TEXT, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (sid, day));
    -- 같은 사람·같은 날 중복 조회 제외용(오래된 것은 지움)
    CREATE TABLE IF NOT EXISTS view_seen (sid TEXT, visitor TEXT, day TEXT, PRIMARY KEY (sid, visitor, day));
    CREATE TABLE IF NOT EXISTS downloads_daily (sid TEXT, day TEXT, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (sid, day));

    -- 버전. status: pending(검토 중) | live(현재·이전판) | rejected
    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sid TEXT NOT NULL,
      version TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      at TEXT NOT NULL,
      by TEXT,
      status TEXT NOT NULL DEFAULT 'live',
      kind TEXT NOT NULL DEFAULT 'update'     -- first | update | convert
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sid TEXT NOT NULL,
      version_id INTEGER,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime TEXT NOT NULL DEFAULT 'application/octet-stream',
      stored TEXT NOT NULL,
      sha256 TEXT,
      at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sid TEXT NOT NULL,
      user_id TEXT,
      writer TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      maker INTEGER NOT NULL DEFAULT 0,
      legacy_cid TEXT,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sid TEXT NOT NULL, user_id TEXT NOT NULL, writer TEXT NOT NULL,
      stars INTEGER NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS used (sid TEXT, user_id TEXT, at TEXT, PRIMARY KEY (sid, user_id));
    CREATE TABLE IF NOT EXISTS subs (sid TEXT, user_id TEXT, at TEXT, PRIMARY KEY (sid, user_id));

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', field TEXT NOT NULL DEFAULT '',
      who TEXT NOT NULL DEFAULT '', user_id TEXT, at TEXT NOT NULL,
      closed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS request_likes (req_id TEXT, user_id TEXT, PRIMARY KEY (req_id, user_id));
    CREATE TABLE IF NOT EXISTS request_making (req_id TEXT, user_id TEXT, name TEXT, at TEXT, PRIMARY KEY (req_id, user_id));
    CREATE TABLE IF NOT EXISTS request_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      req_id TEXT NOT NULL, user_id TEXT, who TEXT NOT NULL, at TEXT NOT NULL, text TEXT NOT NULL, maker INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS request_links (req_id TEXT, sid TEXT, by TEXT, PRIMARY KEY (req_id, sid));

    -- 고도화(교직원 제작 → 교육청 배포)
    CREATE TABLE IF NOT EXISTS upgrades (
      sid TEXT PRIMARY KEY,
      stage INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      converted_at TEXT,
      version TEXT,
      by TEXT
    );

    -- 운영 기록(누가 무엇을 바꿨는지)
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, target TEXT, detail TEXT
    );

    CREATE INDEX IF NOT EXISTS i_comments_sid ON comments(sid);
    CREATE INDEX IF NOT EXISTS i_files_sid ON files(sid);
    CREATE INDEX IF NOT EXISTS i_versions_sid ON versions(sid);
    CREATE INDEX IF NOT EXISTS i_views_day ON views_daily(day);
    CREATE INDEX IF NOT EXISTS i_seen_day ON view_seen(day);
  `);
  return db;
}

/** 한국 시간 오늘 YYYY-MM-DD */
export const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();

export const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const json = (v, fb) => {
  if (v == null || v === '') return fb;
  try {
    return JSON.parse(v);
  } catch {
    return fb;
  }
};

export function getMeta(db, key) {
  return db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value;
}
export function setMeta(db, key, value) {
  db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
