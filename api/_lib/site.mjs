/**
 * 검색 엔진용 화면 공통 — 사이트 주소, 글자 처리, 요약·분류 자료
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const SUMMARIES = require('../../src/data/summaries.json').items;
export const OFFICIAL_META = require('../../src/data/official-meta.json').items;

export const SITE_URL = (process.env.SITE_URL || 'https://jbe-staff-tools-board.vercel.app').replace(/\/+$/, '');
export const SERVICE = '업무경감 도구 모음';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 교육청 배포 도구는 시트에 사용목적·적용기관이 없어 따로 정한 값으로 채움 */
export function withMeta(t) {
  if (t.board !== 'official') return t;
  const m = OFFICIAL_META[t.sid] || {};
  return { ...t, purpose: m.purpose || t.purpose, target: m.target || t.target, category: m.category };
}
