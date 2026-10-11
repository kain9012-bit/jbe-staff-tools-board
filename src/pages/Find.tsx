import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, LayoutGrid, List, PencilLine, Search, Sparkles, TrendingUp, X, Lightbulb } from 'lucide-react';
import { isNewTool, SourceTag, ToolCard, ToolTable } from '../components/Lists';
import { PageTitle, Pager } from '../components/Shell';
import { EmptyState } from '../components/Ui';
import { chipFields, chipMatcher, KEYWORD_CHIPS } from '../lib/keywords';
import { summaryText } from '../lib/summaries';
import { hrefTool } from '../lib/route';
import { matcher } from '../lib/search';
import { allTools, n, periodStats, rangeLabel, shortDay, splitAuthor, type Model, type ToolStat } from '../lib/stats';
import { BOARD_LABEL, type Board } from '../types';
import { SOURCES, sourceOf } from '../lib/sources';

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

/** 구분 안내 — 옛 게시판 첫머리 자리. 누가 올리고 누가 책임지는지 */
const SourceIntro: React.FC<{ src: Board }> = ({ src }) => {
  const x = sourceOf(src);
  return (
    <section aria-label={`${x.name} 안내`} className="mt-4 rounded-[14px] border border-[var(--nr-line)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="nr-title text-[20px] text-black">{x.name}</h2>
          <p className="mt-0.5 text-[15px] text-slate-600">{x.desc}</p>
        </div>
        {x.register ? (
          <a href={x.register.href} className="shrink-0 rounded-lg bg-[var(--nr-p1)] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--nr-p3)]">
            {x.register.label}
          </a>
        ) : (
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded-lg bg-[#f1f3f6] px-4 py-2.5 text-[13px] font-bold text-slate-500">{x.who} 전용 등록</span>
            {x.tip && (
              <a href={x.tip.href} className="text-[13px] font-bold text-[var(--nr-p3)] underline underline-offset-2">
                {x.tip.label}
              </a>
            )}
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] lg:grid-cols-4">
        {[
          ['등록', `${x.who} · ${x.how}`],
          ['검수', x.review],
          ['책임', x.resp],
          ['문의', x.ask],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12px] font-bold text-slate-500">{k}</dt>
            <dd className="text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

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
  const [src, setSrc] = useState<'' | Board>(initialSrc === 'staff' || initialSrc === 'official' || initialSrc === 'external' ? initialSrc : '');
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
  const extCount = m.external?.tools.length ?? 0;
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
  /**
   * 필터를 눌러도 필터 상자가 제자리에 있게 — 필터가 켜지고 꺼지면서 위쪽 구획(업무별 둘러보기·구분 안내)이
   * 나타나거나 사라져 화면이 위아래로 튀던 문제. 누르기 전 상자 위치를 기억했다가 그린 뒤 같은 자리로 맞춤
   */
  const anchorTop = useRef<number | null>(null);
  const keep = <T,>(fn: (v: T) => void) => (v: T) => {
    anchorTop.current = resultTop.current?.getBoundingClientRect().top ?? null;
    fn(v);
  };
  useLayoutEffect(() => {
    if (anchorTop.current === null || !resultTop.current) return;
    const diff = resultTop.current.getBoundingClientRect().top - anchorTop.current;
    anchorTop.current = null;
    if (Math.abs(diff) > 1) window.scrollBy(0, diff);
  });
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
  const popular = byRecent.slice(0, 5);
  const [pick, setPick] = useState<'popular' | 'fresh'>('popular');
  const fresh = useMemo(
    () => [...everything].sort((a, b) => b.created.localeCompare(a.created) || b.sid.localeCompare(a.sid)).slice(0, 5),
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

      {/* 0. 구분 — 옛 게시판 3개 자리. 구분마다 등록·책임·문의가 다름 */}
      <nav aria-label="도구 구분" className="mt-5 -mx-1 flex gap-1.5 overflow-x-auto no-scrollbar px-1">
        {[{ key: '' as const, name: '전체', n: everything.length }, ...SOURCES.map((x) => ({ key: x.key, name: x.name, n: everything.filter((t) => (t.board ?? 'staff') === x.key).length }))].map((x) => (
          <a
            key={x.key || 'all'}
            href={x.key ? `/?src=${x.key}` : '/'}
            aria-current={srcOn === x.key ? 'page' : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-[15px] ${
              srcOn === x.key ? 'bg-[var(--nr-p2)] font-bold text-white' : 'bg-[var(--nr-bg)] text-slate-700 hover:text-[var(--nr-p3)]'
            }`}
          >
            {x.name} <span className="tabular-nums opacity-75">{x.n}</span>
          </a>
        ))}
      </nav>
      {srcOn && !ps && <SourceIntro src={srcOn} />}

      {/* 1. 검색 — 남색 바탕 큰 검색창(누리집 통합검색 상자 색) */}
      <section aria-label="도구 검색" className="mt-6 rounded-[20px] bg-[var(--nr-p2)] px-5 py-7 sm:px-10 sm:py-9 text-white">
        <p className="nr-title text-[22px] sm:text-[28px] leading-snug">
          업무도구 <span className="text-[#ffd85c]">{everything.length}개</span>,
          <br className="sm:hidden" /> 필요한 걸 찾아보세요
        </p>
        {offCount > 0 && (
          <p className="mt-1.5 text-[14px] text-white/75">
            교육청 배포 {offCount}개 · 교직원 제작 {m.tools.length}개{extCount > 0 && ` · 외부 공공 ${extCount}개`}
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

      {/* 2. 업무별 바로가기 — 한두 줄 버튼. 누르면 아래 전체 도구가 그 업무로 걸러짐 */}
      <nav aria-label="업무별로 둘러보기" className="mt-5">
        <p className="mb-2 text-[14px] font-bold text-slate-700">
          업무별로 둘러보기 <span className="font-normal text-slate-500">· 도구 이름과 요약에 든 낱말로 묶음</span>
        </p>
        <ul className="-mx-1 flex gap-1.5 overflow-x-auto no-scrollbar px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {tiles.map((c) => {
            const on = chip === c.label;
            return (
              <li key={c.label} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setChip(on ? '' : c.label);
                    toResults();
                  }}
                  className={`rounded-full border px-3.5 py-2 text-[15px] ${
                    on ? 'border-[var(--nr-p3)] bg-[var(--nr-p3)] font-bold text-white' : 'border-[var(--nr-line)] bg-white text-slate-800 hover:border-[var(--nr-p3)] hover:text-[var(--nr-p3)]'
                  }`}
                >
                  {c.label} <span className={`tabular-nums text-[13px] ${on ? 'text-white/80' : 'text-[var(--nr-p3)]'}`}>{c.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 3. 요즘 많이 찾는 도구 · 새로 올라온 도구 — 같은 모양 목록이라 탭 하나로 */}
      {!filtered && (
        <section aria-label="추천 도구" className="mt-8 rounded-[14px] border border-[var(--nr-line)] bg-white">
          <div role="tablist" aria-label="추천 도구" className="flex border-b border-[var(--nr-line)]">
            {(
              [
                ['popular', '요즘 많이 찾는 도구', '최근 30일 조회수'],
                ['fresh', '새로 올라온 도구', '게시일 순'],
              ] as const
            ).map(([k, label, note]) => (
              <button
                key={k}
                type="button"
                role="tab"
                id={`tab-${k}`}
                aria-selected={pick === k}
                aria-controls="pick-panel"
                onClick={() => setPick(k)}
                className={`flex-1 border-b-[3px] px-3 py-3.5 text-center sm:flex-none sm:px-6 sm:text-left ${
                  pick === k ? 'border-[var(--nr-p3)] font-bold text-[var(--nr-p3)]' : 'border-transparent text-slate-600 hover:text-black'
                }`}
              >
                <span className="block text-[16px]">{label}</span>
                <span className="hidden text-[12px] font-normal text-slate-500 sm:block">{note}</span>
              </button>
            ))}
          </div>
          <ol id="pick-panel" role="tabpanel" aria-labelledby={`tab-${pick}`} className="divide-y divide-[var(--nr-line)]">
            {(pick === 'popular' ? popular : fresh).map((t, i) => (
              <li key={t.sid} className="flex items-center gap-4 px-5 py-3.5">
                {pick === 'popular' ? (
                  <span className="nr-title w-6 shrink-0 text-center text-[22px] text-[var(--nr-p1)]">{i + 1}</span>
                ) : (
                  <Sparkles className="w-5 h-5 shrink-0 text-[#e0a800]" aria-hidden="true" />
                )}
                <a href={hrefTool(t.sid)} className="group min-w-0 flex-1">
                  <span className="font-bold leading-snug text-black line-clamp-1 group-hover:text-[var(--nr-p3)] group-hover:underline underline-offset-2">{t.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-slate-500">
                    <SourceTag board={t.board} className="!px-1.5 !py-0 !text-[11px]" />
                    {pick === 'popular'
                      ? t.board === 'official'
                        ? '교육청 배포'
                        : t.board === 'external'
                          ? `외부 기관 · ${t.kind ?? ''}`
                          : `${splitAuthor(t.author).person} · ${splitAuthor(t.author).org}`
                      : `${t.board === 'staff' || !t.board ? `${splitAuthor(t.author).person} · ` : ''}${shortDay(t.created)} 게시`}
                  </span>
                </a>
                {pick === 'popular' ? (
                  <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[14px] font-bold tabular-nums text-[var(--nr-p3)]">
                    <TrendingUp className="w-4 h-4" aria-hidden="true" />+{n(t.recent30)}
                  </span>
                ) : (
                  isNewTool(t, today) && <span className="shrink-0 rounded-md bg-[#d61e49] px-2 py-0.5 text-[12px] font-bold text-white">NEW</span>
                )}
                <a href={t.url} target="_blank" rel="noreferrer" className="hidden sm:inline-flex shrink-0 rounded-full bg-[var(--nr-p1)] px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-[var(--nr-p3)]">
                  사용하기<span className="sr-only">(새 창)</span>
                </a>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              setSort(pick === 'popular' ? 'recent30' : 'created');
              toResults();
            }}
            className="flex w-full items-center justify-center gap-1 border-t border-[var(--nr-line)] py-3 text-[14px] font-bold text-[var(--nr-p3)] hover:bg-[var(--nr-bg)]"
          >
            {pick === 'popular' ? '많이 찾는 순으로 전체 보기' : '새로 올라온 순으로 전체 보기'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </section>
      )}

      {/* 4. 전체 도구 */}
      <section aria-labelledby="all-h" className="mt-10 scroll-mt-4" ref={resultTop}>
        <SectionHead id="all-h" title={filtered ? '찾은 도구' : '전체 도구'} />

        <div className="mt-4 rounded-[14px] bg-[var(--nr-bg)] p-4 sm:p-5 space-y-3">
          {offCount > 0 && !ps && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[14px] font-bold text-slate-700">구분</span>
              {(
                [
                  ['', '전체', matched.length],
                  ['staff', BOARD_LABEL.staff, srcCount('staff')],
                  ['official', BOARD_LABEL.official, srcCount('official')],
                  ...(extCount > 0 ? ([['external', BOARD_LABEL.external, srcCount('external')]] as const) : []),
                ] as const
              ).map(([v, label, c]) => (
                <button
                  key={v || 'all'}
                  type="button"
                  aria-pressed={srcOn === v}
                  onClick={() => keep(setSrc)(v)}
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
                onClick={() => keep(setPurpose)(o.v)}
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
                onClick={() => keep(setTarget)(tg)}
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
              onChange={(e) => keep(setChip)(e.target.value)}
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
              desc="검색어를 줄이거나 조건을 풀어 보세요."
            />
            <a href="/requests" className="mt-3 flex items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed border-[var(--nr-p1)] bg-white px-4 py-4 text-[15px] font-bold text-[var(--nr-p3)] hover:bg-[var(--nr-bg)]">
              <Lightbulb className="w-5 h-5 text-[#e0a800]" aria-hidden="true" />
              찾는 도구가 없나요? {q.trim() ? `'${q.trim()}' 도구를 ` : ''}요청해 주세요
            </a>
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
        <a href="/requests" className="group flex items-center gap-4 rounded-[14px] border border-[var(--nr-line)] bg-white p-6 hover:border-[var(--nr-p3)]">
          <Lightbulb className="w-8 h-8 shrink-0 text-[#e0a800]" aria-hidden="true" />
          <span>
            <span className="nr-title block text-[20px] text-black">찾는 도구가 없나요?</span>
            <span className="mt-1 block text-[14px] text-slate-600">필요한 도구를 요청하면 공감이 많은 순으로 검토해 만들거나 연결해 드립니다</span>
          </span>
        </a>
        <a href="/register" className="group flex items-center gap-4 rounded-[14px] bg-[var(--nr-p2)] p-6 text-white hover:opacity-95">
          <PencilLine className="w-8 h-8 shrink-0 opacity-80" aria-hidden="true" />
          <span>
            <span className="nr-title block text-[20px]">내가 만든 도구도 올려 주세요</span>
            <span className="mt-1 block text-[14px] text-white/80">정해진 양식으로 등록 · 보안 자가점검 후 검토를 거쳐 게시</span>
          </span>
        </a>
      </section>
    </>
  );
};
