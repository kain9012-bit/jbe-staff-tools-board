import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react';
import { BOARD_URL, WRITE_URL } from '../lib/board';
import { ToolCard } from '../components/Lists';
import { Chip, EmptyState, SectionTitle } from '../components/Ui';
import { matcher } from '../lib/search';
import { n, periodStats, rangeLabel, type Model, type ToolStat } from '../lib/stats';

type SortKey = 'views' | 'recent7' | 'comments' | 'created' | 'period' | 'periodComments';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'views', label: '누적 조회수 순' },
  { value: 'recent7', label: '최근 7일 조회수 순' },
  { value: 'comments', label: '댓글 많은 순' },
  { value: 'created', label: '최근 게시 순' },
];

const SORT_KEYS = ['views', 'recent7', 'comments', 'created', 'period', 'periodComments'];

/** "유,초,중,고,특수" → ["유","초","중","고","특수"], "전체"는 그대로 */
const targetsOf = (t: string) => t.split(/[,·\s]+/).map((x) => x.trim()).filter(Boolean);
const TARGET_ORDER = ['전체', '유', '초', '중', '고', '특수', '기관'];

export const Tools: React.FC<{ m: Model; initialQ?: string; initialSort?: string; from?: string; to?: string }> = ({
  m,
  initialQ,
  initialSort,
  from,
  to,
}) => {
  const [purpose, setPurpose] = useState('');
  const [target, setTarget] = useState('');
  const [q, setQ] = useState(initialQ ?? '');
  const hasPeriod = Boolean(from && to);
  const [sort, setSort] = useState<SortKey>(() => {
    const k = (initialSort ?? 'views') as SortKey;
    if (!SORT_KEYS.includes(k)) return 'views';
    if ((k === 'period' || k === 'periodComments') && !hasPeriod) return k === 'period' ? 'views' : 'comments';
    return k;
  });

  /** 첫 화면 카드에서 넘어온 기간 — 그 기간 조회수·댓글로 정렬 */
  const ps = useMemo(() => (from && to ? periodStats(m, from, to) : null), [m, from, to]);
  const pText = from && to ? (ps?.all ? '전체 기간' : rangeLabel(from, to)) : '';
  const sortOptions = ps
    ? [
        { value: 'period' as SortKey, label: `선택 기간 조회수 순 (${pText})` },
        { value: 'periodComments' as SortKey, label: `선택 기간 댓글 순 (${pText})` },
        ...SORTS,
      ]
    : SORTS;
  const keyOf = (t: ToolStat) =>
    sort === 'period' ? ps?.views.get(t.sid) ?? 0
    : sort === 'periodComments' ? ps?.comments.get(t.sid) ?? 0
    : sort === 'created' ? 0
    : t[sort];
  const sorter = (a: ToolStat, b: ToolStat) =>
    sort === 'created'
      ? b.created.localeCompare(a.created) || b.sid.localeCompare(a.sid)
      : keyOf(b) - keyOf(a) || b.views - a.views;
  const extraOf = (t: ToolStat) =>
    sort === 'period' ? { label: '기간', value: `+${n(ps?.views.get(t.sid) ?? 0)}` }
    : sort === 'periodComments' ? { label: '기간 댓글', value: n(ps?.comments.get(t.sid) ?? 0) }
    : undefined;

  const purposes = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of m.tools) c.set(t.purpose, (c.get(t.purpose) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [m]);

  const targets = useMemo(() => {
    const s = new Set(m.tools.flatMap((t) => targetsOf(t.target)));
    const rank = (x: string) => (TARGET_ORDER.includes(x) ? TARGET_ORDER.indexOf(x) : 99);
    return [...s].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ko'));
  }, [m]);

  /** 사용목적 칩의 건수는 다른 조건을 먼저 적용한 결과 */
  const hit = matcher(q);
  const base = m.tools.filter((t) => {
    if (!hit(t.title, t.author, t.purpose)) return false;
    // '전체' 대상 도구는 어느 학교급을 골라도 포함
    if (target && !targetsOf(t.target).some((x) => x === target || x === '전체')) return false;
    return true;
  });
  const shown = base.filter((t) => !purpose || t.purpose === purpose).sort(sorter);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle count={shown.length} desc="게시판에 올라온 교직원 제작 도구 전체">
          도구
        </SectionTitle>
        <span className="flex items-center gap-4 text-sm font-bold">
          <a href={BOARD_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline underline-offset-2">
            게시판에서 보기 <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
          <a href={WRITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline underline-offset-2">
            내 도구 등록하기 <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip on={purpose === ''} onClick={() => setPurpose('')} count={base.length}>
          전체
        </Chip>
        {purposes.map((p) => (
          <Chip key={p} on={purpose === p} onClick={() => setPurpose(p)} count={base.filter((t) => t.purpose === p).length}>
            {p}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 flex-1 min-w-[12rem] max-w-md rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus-within:border-blue-600">
          <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="sr-only">검색</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="도구명 · 제작자 · 학교명 검색"
            className="flex-1 min-w-0 text-sm outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">적용기관</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 bg-white hover:border-blue-600"
          >
            <option value="">적용기관 전체</option>
            {targets.filter((x) => x !== '전체').map((x) => (
              <option key={x} value={x}>
                {x === '기관' ? '기관' : `${x} 대상`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">정렬</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 bg-white hover:border-blue-600"
          >
            {sortOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {target && <p className="mt-2 text-xs text-slate-500">적용기관이 '전체'인 도구도 함께 표시</p>}

      {shown.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <ToolCard key={t.sid} t={t} today={m.dates[m.dates.length - 1]} extra={extraOf(t)} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState icon={<Search className="w-5 h-5" aria-hidden="true" />} title="조건에 맞는 도구 없음" desc="검색어나 분류를 바꿔 보세요." />
        </div>
      )}
    </>
  );
};
