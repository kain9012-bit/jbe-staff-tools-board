import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, LayoutGrid, List, PencilLine, Search, TrendingUp, X } from 'lucide-react';
import { ToolCard, ToolTable } from '../components/Lists';
import { PageTitle, Pager, TabBox } from '../components/Shell';
import { EmptyState } from '../components/Ui';
import { BOARD_URL } from '../lib/board';
import { chipMatcher, KEYWORD_CHIPS } from '../lib/keywords';
import { hrefTool } from '../lib/route';
import { matcher } from '../lib/search';
import { n, periodStats, rangeLabel, type Model, type ToolStat } from '../lib/stats';

type SortKey = 'recent30' | 'views' | 'comments' | 'created' | 'period' | 'periodComments';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent30', label: '많이 찾는 순 (최근 30일)' },
  { value: 'created', label: '새로 올라온 순' },
  { value: 'views', label: '누적 조회수 순' },
  { value: 'comments', label: '댓글 많은 순' },
];
const SORT_KEYS = ['recent30', 'views', 'comments', 'created', 'period', 'periodComments', 'recent7'];

/** "유,초,중,고,특수" → 낱개. '전체' 대상 도구는 어느 학교급을 골라도 포함 */
const targetsOf = (t: string) => t.split(/[,·\s]+/).map((x) => x.trim()).filter(Boolean);
const TARGETS = ['유', '초', '중', '고', '특수', '기관'];
const TARGET_LABEL: Record<string, string> = { 유: '유치원', 초: '초등', 중: '중학교', 고: '고등학교', 특수: '특수', 기관: '기관' };

const PAGE_SIZE = 20;
const narrowNow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

export const Find: React.FC<{
  m: Model;
  initialQ?: string;
  initialSort?: string;
  initialPurpose?: string;
  from?: string;
  to?: string;
}> = ({ m, initialQ, initialSort, initialPurpose, from, to }) => {
  const today = m.dates[m.dates.length - 1] ?? m.start;
  const [q, setQ] = useState(initialQ ?? '');
  const [chip, setChip] = useState('');
  const [target, setTarget] = useState('');
  const [purpose, setPurpose] = useState(initialPurpose ?? '');
  const [view, setView] = useState<'list' | 'card'>(() => (narrowNow() ? 'card' : 'list'));
  const [page, setPage] = useState(1);
  const resultTop = useRef<HTMLDivElement>(null);

  /** 첫 화면 이전 판·제작자 현황에서 넘어온 기간 정렬 */
  const ps = useMemo(() => (from && to ? periodStats(m, from, to) : null), [m, from, to]);
  const [sort, setSort] = useState<SortKey>(() => {
    let k = (initialSort ?? 'recent30') as SortKey | 'recent7';
    if (k === 'recent7') k = 'recent30';
    if (!SORT_KEYS.includes(k)) return 'recent30';
    if ((k === 'period' || k === 'periodComments') && !(from && to)) return k === 'period' ? 'recent30' : 'comments';
    return k as SortKey;
  });
  const pText = ps ? (ps.all ? '전체 기간' : rangeLabel(from!, to!)) : '';
  const sortOptions = ps
    ? [
        { value: 'period' as SortKey, label: `선택 기간 조회수 순 (${pText})` },
        { value: 'periodComments' as SortKey, label: `선택 기간 댓글 순 (${pText})` },
        ...SORTS,
      ]
    : SORTS;

  useEffect(() => setPage(1), [q, chip, target, purpose, sort]);

  const hit = matcher(q);
  const chipObj = KEYWORD_CHIPS.find((c) => c.label === chip);
  const chipHit = chipMatcher(chipObj);
  const okTarget = (t: ToolStat, tg: string) => !tg || targetsOf(t.target).some((x) => x === tg || x === '전체');

  /** 분류 탭 건수는 다른 조건을 먼저 적용한 결과 */
  const base = m.tools.filter((t) => hit(t.title, t.author, t.purpose) && chipHit(t.title, t.author) && okTarget(t, target));

  const purposes = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of m.tools) c.set(t.purpose, (c.get(t.purpose) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [m]);

  const keyOf = (t: ToolStat) =>
    sort === 'period' ? ps?.views.get(t.sid) ?? 0
    : sort === 'periodComments' ? ps?.comments.get(t.sid) ?? 0
    : sort === 'created' ? 0
    : t[sort];
  const shown = base
    .filter((t) => !purpose || t.purpose === purpose)
    .sort((a, b) =>
      sort === 'created'
        ? b.created.localeCompare(a.created) || b.sid.localeCompare(a.sid)
        : keyOf(b) - keyOf(a) || b.views - a.views,
    );
  const extraOf = (t: ToolStat) =>
    sort === 'period' ? { label: '기간', value: `+${n(ps?.views.get(t.sid) ?? 0)}` }
    : sort === 'periodComments' ? { label: '기간 댓글', value: n(ps?.comments.get(t.sid) ?? 0) }
    : undefined;

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const pageRows = shown.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const goPage = (p: number) => {
    setPage(p);
    resultTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filtered = Boolean(q.trim() || chip || target || purpose);
  const popular = [...m.tools].sort((a, b) => b.recent30 - a.recent30 || b.views - a.views).slice(0, 4);

  return (
    <>
      <PageTitle desc={<>교직원이 직접 만들어 게시판에 공유한 업무도구 <b className="text-black tabular-nums">{m.tools.length}개</b>를 업무·학교급별로 찾아보세요.</>}>
        도구 찾기
      </PageTitle>

      {/* 검색 — 누리집 통합검색 상자처럼 크게 */}
      <section aria-label="도구 검색" className="mt-6 rounded-[10px] bg-[var(--nr-band)] p-4 sm:p-6">
        <label htmlFor="find-q" className="block text-[17px] font-bold text-black">
          어떤 업무를 줄이고 싶으세요?
        </label>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input
              id="find-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="예: 초과근무, 교복, 품의, 회의록"
              className="w-full h-14 rounded-lg border border-[#717171] bg-white pl-4 pr-10 text-[17px] font-bold text-black placeholder:font-normal placeholder:text-slate-400"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="검색어 지우기" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => resultTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 inline-flex items-center gap-1.5 h-14 rounded-lg bg-[var(--nr-p2)] px-5 text-base font-bold text-white hover:opacity-90"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">검색</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[14px] font-bold text-slate-700">자주 찾는 업무</span>
          {KEYWORD_CHIPS.map((c) => {
            const on = chip === c.label;
            const cnt = m.tools.filter((t) => chipMatcher(c)(t.title, t.author)).length;
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={on}
                onClick={() => setChip(on ? '' : c.label)}
                className={`rounded-full border px-3 py-1.5 text-[14px] transition-colors ${
                  on ? 'border-[var(--nr-p3)] bg-[var(--nr-p3)] text-white font-bold' : 'border-[#cdd7e4] bg-white text-slate-700 hover:border-[var(--nr-p3)] hover:text-[var(--nr-p3)]'
                }`}
              >
                {c.label} <span className="tabular-nums opacity-70">{cnt}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[14px] font-bold text-slate-700">우리 학교급</span>
          {TARGETS.map((tg) => {
            const on = target === tg;
            return (
              <button
                key={tg}
                type="button"
                aria-pressed={on}
                onClick={() => setTarget(on ? '' : tg)}
                className={`rounded-md border px-2.5 py-1 text-[14px] ${
                  on ? 'border-[var(--nr-p2)] bg-[var(--nr-p2)] text-white font-bold' : 'border-[#cdd7e4] bg-white text-slate-700 hover:border-[var(--nr-p2)]'
                }`}
              >
                {TARGET_LABEL[tg]}
              </button>
            );
          })}
          {target && <span className="text-[12px] text-slate-500">적용기관이 '전체'인 도구 포함</span>}
        </div>
      </section>

      {/* 요즘 많이 찾는 도구 — 아무 조건도 없을 때만 */}
      {!filtered && sort !== 'period' && sort !== 'periodComments' && (
        <section aria-labelledby="popular-h" className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 id="popular-h" className="nr-title text-[22px] text-black">
              요즘 많이 찾는 도구
            </h2>
            <span className="text-[13px] text-slate-500">최근 30일 조회수</span>
          </div>
          <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {popular.map((t, i) => (
              <li key={t.sid}>
                <a
                  href={hrefTool(t.sid)}
                  className="group flex h-full gap-3 rounded-[10px] border border-[var(--nr-line)] bg-white p-4 hover:border-[var(--nr-p3)]"
                >
                  <span className="nr-title text-[26px] leading-none text-[var(--nr-p1)]">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="text-[15px] font-bold leading-snug text-black line-clamp-2 group-hover:text-[var(--nr-p3)]">{t.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-[13px] font-bold tabular-nums text-[var(--nr-p3)]">
                      <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />+{n(t.recent30)}회
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 분류 탭 + 목록 — 누리집 게시판과 같은 탭 */}
      <section aria-label="도구 목록" className="mt-8 scroll-mt-4" ref={resultTop}>
        <TabBox
          label="사용목적"
          value={purpose}
          onChange={setPurpose}
          items={[
            { value: '', label: '전체', count: base.length },
            ...purposes.map((p) => ({ value: p, label: p, count: base.filter((t) => t.purpose === p).length })),
          ]}
        />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <p className="text-[15px]">
            총 <b className="tabular-nums text-[var(--nr-p3)]">{shown.length}</b>건
            {chip && <span className="ml-2 text-[13px] text-slate-500">'{chip}' 업무</span>}
          </p>
          <span className="flex-1" />
          <label className="text-[14px]">
            <span className="sr-only">정렬</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-md border border-[#cdd7e4] bg-white px-2.5 text-[14px]"
            >
              {sortOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="보기 방식" className="inline-flex rounded-md border border-[#cdd7e4] bg-white p-0.5">
            {(
              [
                ['list', '목록', List],
                ['card', '카드', LayoutGrid],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`inline-flex items-center gap-1 rounded px-2.5 h-8 text-[13px] ${
                  view === v ? 'bg-[var(--nr-p2)] text-white font-bold' : 'text-slate-600 hover:text-[var(--nr-p3)]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Search className="w-5 h-5" aria-hidden="true" />}
              title="조건에 맞는 도구 없음"
              desc="검색어를 줄이거나 업무·학교급 선택을 풀어 보세요. 찾는 도구가 없다면 직접 만들어 올려 주셔도 좋습니다."
            />
          </div>
        ) : view === 'list' ? (
          <div className="mt-3">
            <ToolTable rows={pageRows} today={today} startNo={(cur - 1) * PAGE_SIZE + 1} extra={ps ? extraOf : undefined} />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((t) => (
              <ToolCard key={t.sid} t={t} today={today} extra={extraOf(t)} />
            ))}
          </div>
        )}
        <Pager page={cur} pages={pages} onPage={goPage} />
      </section>

      {/* 등록 유도 */}
      <section className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
        <a href="#/register" className="group flex items-center gap-4 rounded-[10px] bg-[var(--nr-p2)] p-6 text-white hover:opacity-95">
          <PencilLine className="w-8 h-8 shrink-0 opacity-80" aria-hidden="true" />
          <span>
            <span className="nr-title block text-[20px]">내가 만든 도구도 올려 주세요</span>
            <span className="mt-1 block text-[14px] text-white/80">작은 엑셀 서식 하나도 괜찮습니다 · 등록 방법과 점검표 보기</span>
          </span>
        </a>
        <a
          href={BOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-4 rounded-[10px] border border-[var(--nr-line)] bg-white p-6 hover:border-[var(--nr-p3)]"
        >
          <ArrowUpRight className="w-8 h-8 shrink-0 text-[var(--nr-p1)]" aria-hidden="true" />
          <span>
            <span className="nr-title block text-[20px] text-black">교직원 제작 도구 게시판</span>
            <span className="mt-1 block text-[14px] text-slate-600">누리집 게시판에서 원글·첨부파일·댓글 보기</span>
          </span>
        </a>
      </section>
    </>
  );
};
