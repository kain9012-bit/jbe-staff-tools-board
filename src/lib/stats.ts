import type { Comment, Grain, Payload, Tool } from '../types';

/**
 * 집계 규칙 (기준 안내 탭과 같은 내용)
 * - 일별 조회수 = 그날 누적조회수 − 직전 수집일 누적조회수
 * - 수집이 빠진 날은 0. 빠진 기간에 늘어난 조회수는 다음 수집일에 잡힘
 * - 수집 시작일 이전에 게시된 도구의 첫 수집값은 '수집 전 누적'으로 따로 둠
 * - 수집 시작일 이후 게시된 도구는 첫 수집값을 첫 수집일의 조회수로 셈
 * - 주간은 월요일~일요일, 월간은 달력 월
 */

export interface ToolStat extends Tool {
  daily: number[]; // dates[] 와 같은 길이
  pre: number; // 수집 전 누적
  recent7: number;
  recent30: number;
  thisWeek: number;
  lastDate: string; // 이 도구의 마지막 수집일
  firstDate: string; // 이 도구의 첫 수집일
  collected: number; // 댓글목록에 실제로 모인 댓글 수
  makerReplies: number;
}

export interface MakerStat {
  name: string;
  org: string;
  person: string;
  tools: ToolStat[];
  views: number;
  recent7: number;
  thisWeek: number;
  comments: number;
  daily: number[];
  latest: string; // 가장 최근 게시일
  firstDate: string;
}

export interface Model {
  asOf: string;
  start: string; // 수집 시작일
  dates: string[];
  missing: Set<string>; // 수집 기록이 하나도 없는 날
  tools: ToolStat[];
  makers: MakerStat[];
  comments: Comment[];
  commentsOk: boolean;
  weekStart: string; // 이번 주 월요일
  /** 교육청 배포 도구 — 수집 시작일이 달라 따로 계산한 모델. 제작자 현황·기간 통계에는 넣지 않음 */
  official?: Model;
}

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};
export const mondayOf = (s: string) => {
  const d = toDate(s);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  d.setUTCDate(d.getUTCDate() - dow);
  return fmt(d);
};

export const splitAuthor = (a: string) => {
  const m = a.match(/^(.*)\(([^()]+)\)\s*$/);
  return m ? { org: m[1].trim(), person: m[2].trim() } : { org: '', person: a };
};

export function buildModel(p: Payload): Model {
  const main = buildOne(p);
  if (p.official?.tools.length) {
    main.official = buildOne({
      asOf: p.official.asOf,
      fetchedAt: p.fetchedAt,
      tools: p.official.tools,
      history: p.official.history,
      comments: [],
      commentsOk: true,
    });
  }
  return main;
}

/** 도구 찾기·상세에서 쓰는 전체 도구(교직원 제작 + 교육청 배포) */
export const allTools = (m: Model): ToolStat[] => [...m.tools, ...(m.official?.tools ?? [])];

/** 이 도구가 속한 모델 — 조회수 추이의 날짜축이 게시판마다 다름 */
export const modelOf = (m: Model, sid: string): Model | undefined =>
  m.tools.some((t) => t.sid === sid) ? m : m.official?.tools.some((t) => t.sid === sid) ? m.official : undefined;

function buildOne(p: Payload): Model {
  const allDates = Object.values(p.history).flat().map((x) => x[0]).sort();
  const start = allDates[0] ?? p.asOf.slice(0, 10);
  const end = allDates[allDates.length - 1] ?? start;

  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  const seenDates = new Set(allDates);
  const missing = new Set(dates.filter((d) => !seenDates.has(d)));
  const idx = new Map(dates.map((d, i) => [d, i]));

  const weekStart = mondayOf(end);
  const recentFrom = addDays(end, -6);
  const recent30From = addDays(end, -29);

  const collectedBySid = new Map<string, { n: number; maker: number }>();
  for (const c of p.comments) {
    const e = collectedBySid.get(c.sid) ?? { n: 0, maker: 0 };
    e.n++;
    if (c.maker) e.maker++;
    collectedBySid.set(c.sid, e);
  }

  const tools: ToolStat[] = p.tools.map((t) => {
    const daily = new Array<number>(dates.length).fill(0);
    const hist = p.history[t.sid] ?? [];
    let prev: number | null = null;
    let pre = 0;
    for (const [d, v] of hist) {
      const i = idx.get(d);
      if (i === undefined) continue;
      if (prev === null) {
        if (t.created && t.created >= start) daily[i] = v;
        else pre = v;
      } else {
        daily[i] = Math.max(0, v - prev);
      }
      prev = v;
    }
    const sumFrom = (from: string) =>
      dates.reduce((s, d, i) => (d >= from ? s + daily[i] : s), 0);
    const c = collectedBySid.get(t.sid);
    return {
      ...t,
      daily,
      pre,
      recent7: sumFrom(recentFrom),
      recent30: sumFrom(recent30From),
      thisWeek: sumFrom(weekStart),
      lastDate: hist.length ? hist[hist.length - 1][0] : '',
      firstDate: hist.length ? hist[0][0] : start,
      collected: c?.n ?? 0,
      makerReplies: c?.maker ?? 0,
    };
  });

  const byMaker = new Map<string, ToolStat[]>();
  for (const t of tools) byMaker.set(t.author, [...(byMaker.get(t.author) ?? []), t]);

  const makers: MakerStat[] = [...byMaker.entries()].map(([name, ts]) => {
    const { org, person } = splitAuthor(name);
    const sorted = [...ts].sort((a, b) => b.views - a.views);
    return {
      name,
      org,
      person,
      tools: sorted,
      views: sum(ts.map((t) => t.views)),
      recent7: sum(ts.map((t) => t.recent7)),
      thisWeek: sum(ts.map((t) => t.thisWeek)),
      comments: sum(ts.map((t) => t.comments)),
      daily: dates.map((_, i) => sum(ts.map((t) => t.daily[i]))),
      latest: ts.map((t) => t.created).sort().pop() ?? '',
      firstDate: ts.map((t) => t.firstDate).sort()[0] ?? start,
    };
  });
  makers.sort((a, b) => b.views - a.views || a.name.localeCompare(b.name, 'ko'));

  return {
    asOf: p.asOf,
    start,
    dates,
    missing,
    tools,
    makers,
    comments: p.comments,
    commentsOk: p.commentsOk !== false,
    weekStart,
  };
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface Bucket {
  key: string; // 첫날 (주: 월요일, 월: 1일)
  label: string;
  value: number;
  partial: boolean; // 수집 기간이 덜 찬 구간
  missingDays: number;
}

/**
 * 일별 배열을 [from, to] 기간 안에서 일·주·월 구간으로 묶음.
 * 기간 경계에 걸려 일부 날짜만 들어간 구간, 아직 끝나지 않은 구간은 partial.
 */
export function bucketize(m: Model, daily: number[], grain: Grain, from = m.start, to = m.dates[m.dates.length - 1]): Bucket[] {
  const out: Bucket[] = [];
  const keyOf = (d: string) =>
    grain === 'day' ? d : grain === 'week' ? mondayOf(d) : `${d.slice(0, 7)}-01`;
  m.dates.forEach((d, i) => {
    if (d < from || d > to) return;
    const k = keyOf(d);
    let b = out[out.length - 1];
    if (!b || b.key !== k) {
      b = { key: k, label: labelOf(k, grain), value: 0, partial: false, missingDays: 0 };
      out.push(b);
    }
    b.value += daily[i];
    if (m.missing.has(d)) b.missingDays++;
  });
  if (!out.length) return out;
  const lastData = m.dates[m.dates.length - 1];
  const endOf = (k: string) => (grain === 'day' ? k : grain === 'week' ? addDays(k, 6) : endOfMonth(k));
  const first = out[0];
  const last = out[out.length - 1];
  if (first.key < from) first.partial = true;
  if (endOf(last.key) > to || endOf(last.key) >= lastData) last.partial = true;
  return out;
}

const endOfMonth = (k: string) => {
  const d = toDate(k);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return fmt(d);
};

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function labelOf(k: string, grain: Grain) {
  const [, mo, da] = k.split('-').map(Number);
  if (grain === 'month') return `${mo}월`;
  if (grain === 'week') return `${mo}.${da}. 주`;
  return `${mo}.${da}.`;
}
export const dayLabel = (s: string) => {
  if (!s) return '';
  const [y, mo, da] = s.split('-').map(Number);
  return `${y}. ${mo}. ${da}.(${DOW[toDate(s).getUTCDay()]})`;
};
export const shortDay = (s: string) => {
  if (!s) return '';
  const [, mo, da] = s.split('-').map(Number);
  return `${mo}. ${da}.`;
};
export const n = (v: number) => v.toLocaleString('ko-KR');

/** 기간 [from, to] 안의 도구별 조회수 증가·댓글 수 */
/**
 * 기간 [from, to] 안의 도구별 조회수·댓글 수.
 * 기간이 수집 시작일을 포함하면(includesPre) 날짜를 나눌 수 없는 '수집 전 누적'도 더함
 * → 전체 기간·90일 등은 누적 조회수와 정확히 맞음. 댓글도 시작일 이전 것까지 셈
 */
export function periodStats(m: Model, from: string, to: string) {
  const last = m.dates[m.dates.length - 1] ?? m.start;
  const includesPre = from <= m.start;
  const all = includesPre && to >= last;
  const idx = m.dates.map((d, i) => (d >= from && d <= to ? i : -1)).filter((i) => i >= 0);
  const views = new Map<string, number>();
  let pre = 0;
  for (const t of m.tools) {
    const p = includesPre ? t.pre : 0;
    pre += p;
    views.set(t.sid, p + idx.reduce((s2, i) => s2 + t.daily[i], 0));
  }
  const comments = new Map<string, number>();
  if (all) {
    // 전체 기간은 게시판 목록의 댓글 수(수집 못 한 예전 댓글 포함)
    for (const t of m.tools) comments.set(t.sid, t.comments);
  } else {
    for (const c of m.comments) {
      if ((includesPre || c.date >= from) && c.date <= to) comments.set(c.sid, (comments.get(c.sid) ?? 0) + 1);
    }
  }
  return { all, includesPre, pre, views, comments };
}

export const rangeLabel = (from: string, to: string) => `${shortDay(from)} ~ ${shortDay(to)}`;
