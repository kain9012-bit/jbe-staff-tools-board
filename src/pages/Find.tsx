import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, LayoutGrid, List, PencilLine, Search, Sparkles, TrendingUp, X } from 'lucide-react';
import { isNewTool, ToolCard, ToolTable } from '../components/Lists';
import { PageTitle, Pager } from '../components/Shell';
import { EmptyState } from '../components/Ui';
import { BOARD_URL } from '../lib/board';
import { chipFields, chipMatcher, KEYWORD_CHIPS } from '../lib/keywords';
import { summaryText } from '../lib/summaries';
import { hrefTool } from '../lib/route';
import { matcher } from '../lib/search';
import { allTools, n, periodStats, rangeLabel, shortDay, splitAuthor, type Model, type ToolStat } from '../lib/stats';
import { BOARD_LABEL, type Board } from '../types';

/**
 * 도구 찾기 — 찾는 사람 중심 첫 화면
 *  1. 검색(추천 검색어)            → 아는 사람은 바로 찾고
 *  2. 업무별로 둘러보기 타일        → 모르는 사람은 업무로 고르고
 *  3. 요즘 많이 찾는 도구 · 새 도구 → 무엇이 쓸 만한지 보고
 *  4. 전체 도구(조건·정렬·보기 전환)
 * 교직원 제작 도구와 교육청 배포 도구를 함께 보여 줌. 교육청 배포 도구의 사용목적·적용기관은
 * src/data/official-meta.json 에 교직원 제작 도구 기준으로 정해 둔 값
 * 검색어나 조건을 고르면 2·3을 접고 결과를 검색창 바로 아래에 올림
 */

type SortKey = 'recent30' | 'views' | 'comments' | 'created' | 'period' | 'periodComments';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent30', label: '많이 찾는 순' },
  { value: 'created', label: '새로 올라온 순' },
  { value: 'views', label: '누적 조회수 순' },
  { value: 'comments', label: '댓글 많은 순' },
];
const SORT_KEYS = ['recent30', 'views', 'comments', 'created', 'period', 'periodComments', 'recent7'];

/** "유,초,중,고,특수" → 낱개. '전체' 대상 도구는 어느 학교급을 골라도 포함 */
const targetsOf = (t: string) => t.split(/[,·\s]+/).map((x) => x.trim()).filter(Boolean);
const TARGETS = ['유', '초', '중', '고', '특수', '기관'];
const TARGET_LABEL: Record<string, string> = { 유: '유치원', 초: '초등학교', 중: '중학교', 고: '고등학교', 특수: '특수학교', 기관: '기관' };
const SUGGEST = ['초과근무', '품의', '교복', '회의록', '4대보험', '공문'];

const narrowNow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

const SectionHead: React.FC<{ id: string; title: string; note?: React.ReactNode }> = ({ id, title, note }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2">
    <h2 id={id} className="nr-title text-[22px] sm:text-[24px] text-black">
      {title}
    </h2>
    {note && <span className="text-[13px] text-slate-500">{note}</span>}
  </div>
);

export const Find: React.FC<{
  m: Model;
  initialQ?: string;
  initialSort?: string;
  initialPurpose?: string;
  initialSrc?: string;
  from?: string;
  to?: string;
}> = ({ m, initialQ, initialSort, initialPurpose, initialSrc, from, to }) => {
  const today = m.dates[m.dates.length - 1] ?? m.start;
  /** q = 실제 적용된 검색어, draft = 입력 중인 글자(엔터·검색 버튼을 눌러야 q에 반영) */
  const [q, setQApplied] = useState(initialQ ?? '');
  const [draft, setDraft] = useState(initialQ ?? '');
  const setQ = (v: string) => {
    setQApplied(v);
    setDraft(v);
  };
  const [chip, setChip] = useState('');
  const [target, setTarget] = useState('');
  const [purpose, setPurpose] = useState(initialPurpose ?? '');
  const [src, setSrc] = useState<'' | Board>(initialSrc === 'staff' || initialSrc === 'official' ? initialSrc : '');
  const [view, setView] = useState<'card' | 'list'>('card');
  const [page, setPage] = useState(1);
  const resultTop = useRef<HTMLDivElement>(null);
  const pageSize = view === 'card' ? 12 : 20;

  /** 제작자 현황 순위 카드에서 넘어온 기간 정렬 */
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
        { value: 'period' as SortKey, label: `기간 조회수 순 (${pText})` },
        { value: 'periodComments' as SortKey, label: `기간 댓글 순 (${pText})` },
        ...SORTS,
      ]
    : SORTS;

  useEffect(() => setPage(1), [q, chip, target, purpose, src, sort, view]);

  const hit = matcher(q);
  const chipHit = chipMatcher(KEYWORD_CHIPS.find((c) => c.label === chip));
  const okTarget = (t: ToolStat, tg: string) => !tg || targetsOf(t.target).some((x) => x === tg || x === '전체');
  /** 기간 정렬(제작자 현황에서 넘어옴)은 교직원 제작 도구만 셈 */
  const everything = useMemo(() => allTools(m), [m]);
  const pool = ps ? m.tools : everything;
  const offCount = m.official?.tools.length ?? 0;
  const matched = pool.filter((t) => hit(t.title, t.author, t.purpose, summaryText(t.sid)) && chipHit(...chipFields(t)) && okTarget(t, target));
  const srcCount = (b: Board) => matched.filter((t) => (t.board ?? 'staff') === b).length;
  const srcOn = ps ? '' : src;
  const base = matched.filter((t) => !srcOn || (t.board ?? 'staff') === srcOn);

  const purposes = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of everything) c.set(t.purpose, (c.get(t.purpose) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [everything]);

  const keyOf = (t: ToolStat) =>
    sort === 'period' ? ps?.views.get(t.sid) ?? 0
    : sort === 'periodComments' ? ps?.comments.get(t.sid) ?? 0
    : sort === 'created' ? 0
    : t[sort];
  const shown = base
    .filter((t) => !purpose || t.purpose === purpose)
    .sort((a, b) =>
      sort === 'created' ? b.created.localeCompare(a.created) || b.sid.localeCompare(a.sid) : keyOf(b) - keyOf(a) || b.views - a.views,
    );
  const extraOf = (t: ToolStat) =>
    sort === 'period' ? { label: '기간', value: `+${n(ps?.views.get(t.sid) ?? 0)}` }
    : sort === 'periodComments' ? { label: '기간 댓글', value: n(ps?.comments.get(t.sid) ?? 0) }
    : undefined;

  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const cur = Math.min(page, pages);
  const pageRows = shown.slice((cur - 1) * pageSize, cur * pageSize);
  const toResults = () => setTimeout(() => resultTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  const goPage = (p: number) => {
    setPage(p);
    toResults();
  };

  const filtered = Boolean(q.trim() || chip || target || purpose || srcOn || ps);
  const clearAll = () => {
    setQ('');
    setChip('');
    setTarget('');
    setPurpose('');
    setSrc('');
  };

  const byRecent = useMemo(() => [...everything].sort((a, b) => b.recent30 - a.recent30 || b.views - a.views), [m]);
  const popular = byRecent.slice(0, 4);
  const fresh = useMemo(
    () => [...everything].sort((a, b) => b.created.localeCompare(a.created) || b.sid.localeCompare(a.sid)).slice(0, 4),
    [everything],
  );
  const tiles = useMemo(
    () =>
      KEYWORD_CHIPS.map((c) => {
        const ts = byRecent.filter((t) => chipMatcher(c)(...chipFields(t)));
        return { ...c, count: ts.length, top: ts.slice(0, 2) };
      }).filter((x) => x.count > 0),
    [byRecent],
  );

  const activeTags = [
    q.trim() && { k: 'q', label: `"${q.trim()}"`, clear: () => setQ('') },
    srcOn && { k: 'src', label: BOARD_LABEL[srcOn], clear: () => setSrc('') },
    chip && { k: 'chip', label: chip, clear: () => setChip('') },
    purpose && { k: 'p', label: purpose, clear: () => setPurpose('') },
    target && { k: 't', label: TARGET_LABEL[target], clear: () => setTarget('') },
  ].filter(Boolean) as { k: string; label: string; clear: () => void }[];

  return (
    <>
      <PageTitle>도구 찾기</PageTitle>

      {/* 1. 검색 — 남색 바탕 큰 검색창(누리집 통합검색 상자 색) */}
      <section aria-label="도구 검색" className="mt-6 rounded-[20px] bg-[var(--nr-p2)] px-5 py-7 sm:px-10 sm:py-9 text-white">
        <p className="nr-title text-[22px] sm:text-[28px] leading-snug">
          업무도구 <span className="text-[#ffd85c]">{everything.length}개</span>,
          <br className="sm:hidden" /> 필요한 걸 찾아보세요
        </p>
        {offCount > 0 && (
          <p className="mt-1.5 text-[14px] text-white/75">
            교직원 제작 {m.tools.length}개 · 교육청 배포 {offCount}개
          </p>
        )}
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(draft.trim());
            toResults();
          }}
        >
          <label htmlFor="find-q" className="sr-only">
            도구 검색
          </label>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
            <input
              id="find-q"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="줄이고 싶은 업무를 입력하세요"
              className="w-full h-14 rounded-full bg-white pl-12 pr-11 [&::-webkit-search-cancel-button]:appearance-none text-[17px] font-bold text-black placeholder:font-normal placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-white/40"
            />
            {draft && (
              <button type="button" onClick={() => setQ('')} aria-label="검색어 지우기" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <button type="submit" className="inline-flex shrink-0 items-center h-14 rounded-full bg-[#ffd85c] px-5 sm:px-7 text-base font-bold text-[#1d2550] hover:bg-[#ffe27f]">
            검색
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
          <span className="text-white/70">추천 검색어</span>
          {SUGGEST.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => {
                setQ(w);
                toResults();
              }}
              className="rounded-full border border-white/30 px-3 py-1 text-white hover:bg-white hover:text-[var(--nr-p2)]"
            >
              #{w}
            </button>
          ))}
        </div>
      </section>

      {!filtered && (
        <>
          {/* 2. 업무별로 둘러보기 */}
          <section aria-labelledby="by-work" className="mt-12">
            <SectionHead id="by-work" title="업무별로 둘러보기" note="도구 이름과 요약에 든 낱말로 묶음" />
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
              {tiles.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setChip(c.label);
                      toResults();
                    }}
                    className="group flex h-full w-full flex-col rounded-[14px] border border-[var(--nr-line)] bg-white p-4 sm:p-5 text-left transition hover:border-[var(--nr-p3)] hover:shadow-[0_6px_20px_rgba(28,100,172,0.12)]"
                  >
                    <span className="flex w-full flex-wrap items-center justify-between gap-1">
                      <span className="text-[16px] sm:text-[18px] font-bold text-black group-hover:text-[var(--nr-p3)]">{c.label}</span>
                      <span className="rounded-full bg-[var(--nr-bg)] px-2.5 py-0.5 text-[13px] font-bold tabular-nums text-[var(--nr-p3)]">{c.count}개</span>
                    </span>
                    <span className="mt-3 hidden sm:block w-full space-y-1 text-[14px] text-slate-600">
                      {c.top.map((t) => (
                        <span key={t.sid} className="block truncate">
                          · {t.title}
                        </span>
                      ))}
                    </span>
                    <span className="mt-3 hidden sm:inline-flex items-center gap-1 text-[13px] font-bold text-[var(--nr-p3)]">
                      모두 보기 <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* 3. 요즘 많이 찾는 도구 · 새로 올라온 도구 */}
          <div className="mt-12 grid grid-cols-1 gap-10 min-[1600px]:grid-cols-2">
            <section aria-labelledby="popular-h">
              <SectionHead id="popular-h" title="요즘 많이 찾는 도구" note="최근 30일 조회수" />
              <ol className="mt-4 divide-y divide-[var(--nr-line)] rounded-[14px] border border-[var(--nr-line)] bg-white">
                {popular.map((t, i) => (
                  <li key={t.sid} className="flex items-center gap-4 px-5 py-4">
                    <span className="nr-title w-6 shrink-0 text-center text-[24px] text-[var(--nr-p1)]">{i + 1}</span>
                    <a href={hrefTool(t.sid)} className="group min-w-0 flex-1">
                      <span className="font-bold leading-snug text-black line-clamp-1 group-hover:text-[var(--nr-p3)] group-hover:underline underline-offset-2">{t.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                        {t.board === 'official' ? '교육청 배포' : `${splitAuthor(t.author).person} · ${splitAuthor(t.author).org}`}
                      </span>
                    </a>
                    <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[14px] font-bold tabular-nums text-[var(--nr-p3)]">
                      <TrendingUp className="w-4 h-4" aria-hidden="true" />+{n(t.recent30)}
                    </span>
                    <a href={t.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-[var(--nr-p1)] px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-[var(--nr-p3)]">
                      사용하기<span className="sr-only">(새 창)</span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
            <section aria-labelledby="fresh-h">
              <SectionHead id="fresh-h" title="새로 올라온 도구" note="게시일 순" />
              <ol className="mt-4 divide-y divide-[var(--nr-line)] rounded-[14px] border border-[var(--nr-line)] bg-white">
                {fresh.map((t) => (
                  <li key={t.sid} className="flex items-center gap-4 px-5 py-4">
                    <Sparkles className="w-5 h-5 shrink-0 text-[#e0a800]" aria-hidden="true" />
                    <a href={hrefTool(t.sid)} className="group min-w-0 flex-1">
                      <span className="font-bold leading-snug text-black line-clamp-1 group-hover:text-[var(--nr-p3)] group-hover:underline underline-offset-2">{t.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                        {t.board === 'official' ? '교육청 배포' : splitAuthor(t.author).person} · {shortDay(t.created)} 게시
                      </span>
                    </a>
                    {isNewTool(t, today) && <span className="shrink-0 rounded-md bg-[#d61e49] px-2 py-0.5 text-[12px] font-bold text-white">NEW</span>}
                    <a href={t.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-[var(--nr-p1)] px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-[var(--nr-p3)]">
                      사용하기<span className="sr-only">(새 창)</span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}

      {/* 4. 전체 도구 */}
      <section aria-labelledby="all-h" className={`${filtered ? 'mt-8' : 'mt-14'} scroll-mt-4`} ref={resultTop}>
        <SectionHead id="all-h" title={filtered ? '찾은 도구' : '전체 도구'} />

        <div className="mt-4 rounded-[14px] bg-[var(--nr-bg)] p-4 sm:p-5 space-y-3">
          {offCount > 0 && !ps && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[14px] font-bold text-slate-700">출처</span>
              {(
                [
                  ['', '전체', matched.length],
                  ['staff', BOARD_LABEL.staff, srcCount('staff')],
                  ['official', BOARD_LABEL.official, srcCount('official')],
                ] as const
              ).map(([v, label, c]) => (
                <button
                  key={v || 'all'}
                  type="button"
                  aria-pressed={srcOn === v}
                  onClick={() => setSrc(v)}
                  className={`rounded-full px-3.5 py-1.5 text-[14px] transition-colors ${
                    srcOn === v ? 'bg-[var(--nr-p3)] text-white font-bold' : 'bg-white text-slate-700 hover:text-[var(--nr-p3)]'
                  }`}
                >
                  {label} <span className="tabular-nums opacity-70">{c}</span>
                </button>
              ))}
            </div>
          )}
          {(
          <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[14px] font-bold text-slate-700">사용목적</span>
            {[{ v: '', label: '전체', c: base.length }, ...purposes.map((p) => ({ v: p, label: p, c: base.filter((t) => t.purpose === p).length }))].map((o) => (
              <button
                key={o.v || 'all'}
                type="button"
                aria-pressed={purpose === o.v}
                onClick={() => setPurpose(o.v)}
                className={`rounded-full px-3.5 py-1.5 text-[14px] transition-colors ${
                  purpose === o.v ? 'bg-[var(--nr-p3)] text-white font-bold' : 'bg-white text-slate-700 hover:text-[var(--nr-p3)]'
                }`}
              >
                {o.label} <span className="tabular-nums opacity-70">{o.c}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[14px] font-bold text-slate-700">학교급</span>
            {['', ...TARGETS].map((tg) => (
              <button
                key={tg || 'all'}
                type="button"
                aria-pressed={target === tg}
                onClick={() => setTarget(tg)}
                className={`rounded-full px-3.5 py-1.5 text-[14px] transition-colors ${
                  target === tg ? 'bg-[var(--nr-p3)] text-white font-bold' : 'bg-white text-slate-700 hover:text-[var(--nr-p3)]'
                }`}
              >
                {tg ? TARGET_LABEL[tg] : '전체'}
              </button>
            ))}
          </div>
          </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[14px] font-bold text-slate-700">업무</span>
            <select
              value={chip}
              onChange={(e) => setChip(e.target.value)}
              aria-label="업무"
              className="h-9 rounded-full border-0 bg-white px-3.5 text-[14px]"
            >
              <option value="">전체 업무</option>
              {KEYWORD_CHIPS.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-[15px]">
            <b className="tabular-nums text-[var(--nr-p3)]">{shown.length}</b>개
          </p>
          {activeTags.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={t.clear}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--nr-p3)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--nr-p3)] hover:bg-[var(--nr-bg)]"
            >
              {t.label}
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sr-only">조건 빼기</span>
            </button>
          ))}
          {activeTags.length > 1 && (
            <button type="button" onClick={clearAll} className="text-[13px] text-slate-500 underline underline-offset-2 hover:text-black">
              모두 지우기
            </button>
          )}
          <span className="flex-1" />
          <label>
            <span className="sr-only">정렬</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-md border border-[#cdd7e4] bg-white px-2.5 text-[14px]">
              {sortOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {!narrowNow() && (
            <div role="group" aria-label="보기 방식" className="inline-flex rounded-md border border-[#cdd7e4] bg-white p-0.5">
              {(
                [
                  ['card', '카드', LayoutGrid],
                  ['list', '목록', List],
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
          )}
        </div>

        {shown.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Search className="w-5 h-5" aria-hidden="true" />}
              title="조건에 맞는 도구 없음"
              desc="검색어를 줄이거나 조건을 풀어 보세요. 찾는 도구가 없다면 직접 만들어 올려 주셔도 좋습니다."
            />
          </div>
        ) : view === 'list' ? (
          <div className="mt-3">
            <ToolTable rows={pageRows} today={today} startNo={(cur - 1) * pageSize + 1} extra={ps ? extraOf : undefined} />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1600px]:grid-cols-4">
            {pageRows.map((t) => (
              <ToolCard key={t.sid} t={t} today={today} extra={extraOf(t)} />
            ))}
          </div>
        )}
        <Pager page={cur} pages={pages} onPage={goPage} />
      </section>

      {/* 등록 유도 */}
      <section className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-2">
        <a href="#/register" className="group flex items-center gap-4 rounded-[14px] bg-[var(--nr-p2)] p-6 text-white hover:opacity-95">
          <PencilLine className="w-8 h-8 shrink-0 opacity-80" aria-hidden="true" />
          <span>
            <span className="nr-title block text-[20px]">내가 만든 도구도 올려 주세요</span>
            <span className="mt-1 block text-[14px] text-white/80">작은 엑셀 서식 하나도 괜찮습니다 · 등록 방법과 점검표 보기</span>
          </span>
        </a>
        <a href={BOARD_URL} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-[14px] border border-[var(--nr-line)] bg-white p-6 hover:border-[var(--nr-p3)]">
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
