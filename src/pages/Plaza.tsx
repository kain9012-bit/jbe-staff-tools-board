import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink, Footprints, LayoutGrid, Maximize2, Minimize2, Moon, Sun, Clock3, X } from 'lucide-react';
import { allTools, splitAuthor, type Model } from '../lib/stats';
import { KEYWORD_CHIPS, chipFields, chipMatcher } from '../lib/keywords';
import { summaryOf } from '../lib/summaries';
import { hrefTool, navigate } from '../lib/route';
import { createPlaza, type Ev, type Mode, type PlazaEngine, type PlazaTent, type PlazaTool } from '../plaza/engine';
import suitUrl from '../fonts/SUIT-Variable.woff2';
import eduUrl from '../fonts/GangwonEduPowerExtraBoldA.woff';

/**
 * 3D 광장 — 업무별 둘러보기(업무 분류 16개)를 청사 앞 잔디마당의 천막으로 보여 주는 시범 화면.
 * 천막 = 업무 분류, 천막지기에게 말을 걸면 그 업무의 도구가 홀로그램 카드로 뜸.
 * 웹판(Vercel)에만 있음. 서버판(도커)에는 없음
 */

/** 천막 색 · 천막지기가 든 물건 */
const LOOK: Record<string, { color: string; prop: string; line: string }> = {
  '공문·문서': { color: '#2f6fb3', prop: 'doc', line: '어서 오세요! 공문 쓰고, 한글 파일 고치고… 문서 일에 쓰는 도구를 모아 둔 천막이에요.' },
  '엑셀·데이터': { color: '#2e9e6a', prop: 'laptop', line: '엑셀 취합에 지치셨죠? 표를 합치고 다듬는 데이터 도구들이 여기 있어요.' },
  '에듀파인·품의': { color: '#c0584a', prop: 'stamp', line: '품의·기안 준비를 돕는 도구들이에요. 결재 올리기 전에 한번 둘러보세요.' },
  '계약·물품': { color: '#b7863a', prop: 'box', line: '물품 구매, 계약, 견적… 손이 많이 가는 일을 덜어 줄 도구들이에요.' },
  '파일 정리': { color: '#e0a92e', prop: 'folder', line: '파일 이름 바꾸고, 폴더 정리하고! 정리를 도와주는 도구들이에요.' },
  '나이스·학사': { color: '#3a9ad9', prop: 'tablet', line: '나이스와 학사 업무에 쓰는 도구들을 모아 두었어요.' },
  '수업·학급': { color: '#e8554e', prop: 'book', line: '수업 준비와 학급 운영을 돕는 도구들이 모여 있어요.' },
  '복무·인사·일정': { color: '#7a5ea8', prop: 'calendar', line: '복무, 인사, 일정 챙기기를 도와주는 도구들이에요.' },
  '안내·검색·AI': { color: '#2fa39a', prop: 'magnifier', line: '찾고, 묻고, 안내받는 도구들이에요. 궁금한 게 있으면 여기부터!' },
  '종합 도구 모음': { color: '#d65a3a', prop: 'toolbox', line: '여러 기능을 한데 묶은 종합 도구 천막이에요.' },
  '급여·4대보험': { color: '#5b6ee1', prop: 'calc', line: '급여와 4대보험 업무를 돕는 도구들이에요.' },
  '학교회계': { color: '#4f8f5a', prop: 'coins', line: '학교회계 업무를 돕는 도구들을 모았어요.' },
  '학교운영위원회': { color: '#8a6f5a', prop: 'clipboard', line: '학교운영위원회 업무에 쓰는 도구들이에요.' },
  '급식': { color: '#f08a24', prop: 'ladle', line: '급식 천막에 오신 걸 환영해요! 급식 업무 도구를 보여 드릴게요.' },
  '행사·시험': { color: '#d65aa4', prop: 'megaphone', line: '행사와 시험 준비를 돕는 도구들이에요.' },
  '교육공무직': { color: '#3f6e8c', prop: 'mug', line: '교육공무직 업무에 쓰는 도구들이에요.' },
};
const TAG: Record<string, string> = { staff: '교직원 제작', official: '교육청 배포', external: '외부 공공' };
const LINE2 = '이 업무에 쓸 수 있는 도구들이에요. 카드를 눌러 살펴보세요!';

type Tool = PlazaTool & { url: string; board: string };
type Tent = PlazaTent & { tools: Tool[] };

function useTents(m: Model): Tent[] {
  return useMemo(() => {
    const byRecent = [...allTools(m)].sort((a, b) => b.recent30 - a.recent30 || b.views - a.views);
    return KEYWORD_CHIPS.map((c) => {
      const hit = chipMatcher(c);
      const tools: Tool[] = byRecent
        .filter((t) => hit(...chipFields(t)))
        .map((t) => {
          const s = summaryOf(t.sid);
          const board = t.board ?? 'staff';
          return {
            sid: t.sid,
            title: t.title,
            tag: TAG[board] ?? '교직원 제작',
            who: board === 'staff' ? splitAuthor(t.author).person + (splitAuthor(t.author).org ? ` · ${splitAuthor(t.author).org}` : '') : board === 'official' ? '전북특별자치도교육청' : '외부 기관',
            what: s?.what ?? '',
            run: s?.run ?? '',
            url: t.url,
            board,
          };
        });
      const look = LOOK[c.label] ?? { color: '#3a457f', prop: 'clipboard', line: '어서 오세요!' };
      return { label: c.label, color: look.color, prop: look.prop, tools };
    }).filter((t) => t.tools.length > 0);
  }, [m]);
}

let fontsReady: Promise<unknown> | null = null;
const loadFonts = () =>
  (fontsReady ??= Promise.all(
    [
      ['Plaza SUIT', suitUrl, { weight: '100 900' }],
      ['Plaza Edu', eduUrl, {}],
    ].map(async ([name, url, d]) => {
      try {
        const f = new FontFace(name as string, `url(${url as string})`, d as FontFaceDescriptors);
        document.fonts.add(await f.load());
      } catch {
        /* 서체를 못 받아도 기본 서체로 그림 */
      }
    }),
  ));

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

const glass = 'bg-[rgba(12,22,48,0.78)] text-white backdrop-blur-md ring-1 ring-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.25)]';

export const Plaza: React.FC<{ m: Model }> = ({ m }) => {
  const tents = useTents(m);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const eng = useRef<PlazaEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState<number | null>(null);
  const [talk, setTalk] = useState<number | null>(null);
  const [step, setStep] = useState<'hello' | 'tools'>('hello');
  const [page, setPage] = useState({ page: 0, pages: 1, cards: [] as PlazaTool[] });
  const [sel, setSel] = useState<Tool | null>(null);
  const [mode, setMode] = useState<Mode>('auto');
  const [clock, setClock] = useState({ text: '', night: false });
  const [visited, setVisited] = useState<Set<number>>(() => new Set());
  const [listOpen, setListOpen] = useState(false);
  const [help, setHelp] = useState(() => !(window.matchMedia?.('(pointer: coarse)').matches ?? false));
  const [full, setFull] = useState(false);
  const [h, setH] = useState<number | null>(null);
  const [quality] = useState<'high' | 'low'>(() =>
    window.matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high',
  );
  const touch = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, []);

  // 화면 높이 = 창 높이 − 머리말
  useEffect(() => {
    const fit = () => {
      const hdr = document.querySelector('header') as HTMLElement | null;
      setH(Math.max(440, window.innerHeight - (hdr?.offsetHeight ?? 0)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // 장면 만들기
  useEffect(() => {
    if (!hasWebGL()) {
      setFailed(true);
      return;
    }
    let dead = false;
    const on = (e: Ev) => {
      if (e.type === 'ready') setReady(true);
      else if (e.type === 'near') setNear(e.tent);
      else if (e.type === 'talk') {
        setTalk(e.tent);
        setStep('hello');
        setSel(null);
        if (e.tent !== null) setVisited((v) => new Set(v).add(e.tent!));
      } else if (e.type === 'page') setPage({ page: e.page, pages: e.pages, cards: e.cards });
      else if (e.type === 'select') setSel(e.tool as Tool | null);
      else if (e.type === 'clock') setClock({ text: e.text, night: e.night });
    };
    void loadFonts().then(() => {
      if (dead || !host.current) return;
      try {
        eng.current = createPlaza(host.current, tents, on, { quality });
        (window as unknown as { __plaza?: PlazaEngine }).__plaza = eng.current;
      } catch {
        setFailed(true);
      }
    });
    return () => {
      dead = true;
      eng.current?.destroy();
      eng.current = null;
    };
  }, [tents, quality]);

  // 대사 한 글자씩
  const tent = talk !== null ? tents[talk] : null;
  const line = tent ? (step === 'hello' ? LOOK[tent.label]?.line ?? '어서 오세요!' : LINE2) : '';
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    setTyped(0);
    if (!line) return;
    eng.current?.speak(true);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= line.length) {
        window.clearInterval(id);
        eng.current?.speak(false);
      }
    }, 32);
    return () => {
      window.clearInterval(id);
      eng.current?.speak(false);
    };
  }, [line]);
  const typing = typed < line.length;

  const doTalk = useCallback(() => near !== null && eng.current?.talk(near), [near]);
  const doShow = useCallback(() => {
    if (typing) return setTyped(line.length);
    setStep('tools');
    eng.current?.showTools();
  }, [typing, line]);
  const doEnd = useCallback(() => {
    eng.current?.endTalk();
    setSel(null);
  }, []);

  // 키보드: Space·Enter 말 걸기/다음, Esc 끝내기
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg && (tg.tagName === 'BUTTON' || tg.tagName === 'A' || tg.tagName === 'INPUT')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (talk === null && near !== null) {
          e.preventDefault();
          doTalk();
        } else if (talk !== null && step === 'hello') {
          e.preventDefault();
          doShow();
        }
      } else if (e.key === 'Escape') {
        if (sel) eng.current?.select(null);
        else if (talk !== null) doEnd();
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [talk, near, step, sel, doTalk, doShow, doEnd]);

  const setDn = (md: Mode) => {
    setMode(md);
    eng.current?.setMode(md);
  };
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      /* 전체 화면을 못 쓰는 브라우저 */
    }
  };
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  if (failed)
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="nr-title text-[24px] text-black">3D 화면을 열 수 없습니다</p>
        <p className="mt-2 text-slate-600">이 브라우저에서는 3D 그래픽(WebGL)을 쓸 수 없습니다. 같은 도구를 업무별 목록으로 볼 수 있습니다.</p>
        <a href="/" className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[var(--nr-p2)] px-4 py-2.5 font-bold text-white">
          <LayoutGrid className="w-4 h-4" aria-hidden="true" /> 업무별로 둘러보기
        </a>
      </div>
    );

  return (
    <section
      ref={stage}
      aria-label="3D 광장 — 업무별 천막에서 도구 찾기"
      className="relative w-full overflow-hidden bg-[#0d1830] select-none"
      style={{ height: full ? '100vh' : h ?? '80vh' }}
    >
      <h1 className="sr-only">3D 광장</h1>
      <p className="sr-only">
        전북교육청 청사 앞 잔디마당에 업무 분류별 천막이 있습니다. 왼쪽 위 「천막 바로 가기」에서 업무를 고르면 천막지기가 그 업무의 도구를 보여 줍니다.
      </p>
      <div ref={host} className="absolute inset-0" />

      {/* 불러오는 중 */}
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-[#0d1830] text-white">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-[#4fd1ff]" />
            <p className="nr-title mt-4 text-[22px]">광장에 천막을 세우는 중…</p>
          </div>
        </div>
      )}

      {/* 왼쪽 위: 안내 + 천막 바로 가기 */}
      <div className={`absolute left-3 top-3 sm:left-4 sm:top-4 z-10 w-[min(300px,calc(100%-196px))] space-y-2 transition-opacity ${talk !== null ? 'pointer-events-none opacity-0' : ''}`} aria-hidden={talk !== null}>
        <div className={`rounded-2xl ${glass} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <span className="nr-title whitespace-nowrap text-[18px] sm:text-[20px] leading-none">3D 광장</span>
            <span className="rounded-full bg-[#4fd1ff]/20 px-2 py-0.5 text-[11px] font-bold text-[#9be6ff]">시범</span>
            <span className="ml-auto text-[12px] tabular-nums text-white/70" title="들른 천막">
              <Footprints className="mr-1 inline w-3.5 h-3.5 align-[-2px]" aria-hidden="true" />
              {visited.size}/{tents.length}
            </span>
            <button type="button" onClick={() => setHelp((v) => !v)} aria-expanded={help} className="rounded p-0.5 text-white/70 hover:text-white" aria-label="조작 안내 접기·펴기">
              <ChevronDown className={`w-4 h-4 transition ${help ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
          {help && (
            <ul className="mt-2 space-y-0.5 text-[13px] leading-relaxed text-white/80">
              <li>업무별 천막의 천막지기에게 말을 걸어 보세요.</li>
              {touch ? (
                <>
                  <li>· 땅을 누르면 그곳으로 걸어가요</li>
                  <li>· 끌어서 둘러보기</li>
                </>
              ) : (
                <>
                  <li>
                    · <Kbd>W</Kbd>
                    <Kbd>A</Kbd>
                    <Kbd>S</Kbd>
                    <Kbd>D</Kbd>·방향키 걷기, <Kbd>Shift</Kbd> 달리기
                  </li>
                  <li>· 땅을 누르면 걸어가기 · 끌어서 둘러보기 · 바퀴로 확대</li>
                  <li>
                    · 가까이서 <Kbd>Space</Kbd> 말 걸기, <Kbd>Esc</Kbd> 끝내기
                  </li>
                </>
              )}
            </ul>
          )}
        </div>
        <div className={`rounded-2xl ${glass}`}>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] font-bold"
          >
            천막 바로 가기
            <ChevronDown className={`ml-auto w-4 h-4 transition ${listOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {listOpen && (
            <ul className="max-h-[40vh] overflow-y-auto px-2 pb-2">
              {tents.map((t, i) => (
                <li key={t.label}>
                  <button
                    type="button"
                    onClick={() => {
                      eng.current?.walkTo(i);
                      if (touch) setListOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-white/10 focus-visible:bg-white/10"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/40" style={{ background: t.color }} aria-hidden="true" />
                    <span className="truncate">{t.label}</span>
                    {visited.has(i) && <span className="ml-auto text-[11px] text-[#9be6ff]">들름</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 오른쪽 위: 낮·밤, 전체 화면, 목록 화면 */}
      <div className="absolute right-3 top-3 sm:right-4 sm:top-4 z-10 flex flex-col items-end gap-2">
        <div role="radiogroup" aria-label="낮과 밤" className={`flex rounded-full p-1 ${glass}`}>
          {(
            [
              ['auto', <Clock3 key="a" className="w-4 h-4" aria-hidden="true" />, '지금 시각'],
              ['day', <Sun key="d" className="w-4 h-4" aria-hidden="true" />, '낮'],
              ['night', <Moon key="n" className="w-4 h-4" aria-hidden="true" />, '밤'],
            ] as const
          ).map(([k, icon, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={mode === k}
              onClick={() => setDn(k)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold transition ${
                mode === k ? 'bg-white text-[#0d1830]' : 'text-white/80 hover:text-white'
              }`}
            >
              {icon}
              <span className={k === 'auto' ? 'hidden sm:inline' : ''}>{label}</span>
            </button>
          ))}
        </div>
        {clock.text && <span className={`rounded-full px-3 py-1 text-[12px] tabular-nums ${glass}`}>{clock.text}</span>}
        <div className="flex gap-2">
          <button type="button" onClick={toggleFull} className={`rounded-full p-2 ${glass} hover:bg-[rgba(30,50,90,0.9)]`} aria-label={full ? '전체 화면 끝내기' : '전체 화면'}>
            {full ? <Minimize2 className="w-4 h-4" aria-hidden="true" /> : <Maximize2 className="w-4 h-4" aria-hidden="true" />}
          </button>
          <a href="/" className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-bold ${glass} hover:bg-[rgba(30,50,90,0.9)]`}>
            <LayoutGrid className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">목록 화면</span>
            <span className="sr-only sm:hidden">목록 화면</span>
          </a>
        </div>
      </div>

      {/* 아래: 말 걸기 */}
      {ready && talk === null && near !== null && (
        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <button
            type="button"
            onClick={doTalk}
            className="group inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-[15px] font-bold text-[#0d1830] shadow-[0_8px_30px_rgba(0,0,0,0.3)] ring-4 ring-[#4fd1ff]/40 hover:ring-[#4fd1ff]/70"
          >
            <span className="h-3 w-3 rounded-full" style={{ background: tents[near].color }} aria-hidden="true" />
            {tents[near].label} 천막지기에게 말 걸기
            {!touch && <Kbd dark>Space</Kbd>}
          </button>
        </div>
      )}

      {/* 대화 상자 */}
      {tent && (
        <div className="absolute inset-x-0 bottom-3 sm:bottom-5 z-20 flex justify-center px-3">
          <div role="dialog" aria-label={`${tent.label} 천막지기`} className={`relative w-full max-w-3xl rounded-2xl ${glass} px-5 pb-4 pt-6 sm:px-6`}>
            <span
              className="absolute -top-3.5 left-5 rounded-full px-3.5 py-1 text-[13px] font-bold text-white shadow"
              style={{ background: tent.color }}
            >
              {tent.label} 천막지기
            </span>
            <button type="button" onClick={doEnd} className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="대화 끝내기">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            {sel ? (
              <div aria-live="polite">
                <div className="flex flex-wrap items-center gap-1.5 pr-8">
                  <span className="rounded-md px-2 py-0.5 text-[12px] font-bold text-white" style={{ background: tent.color }}>{sel.tag}</span>
                  {sel.run && <span className="rounded-md bg-white/15 px-2 py-0.5 text-[12px] font-bold">{sel.run}</span>}
                  <span className="text-[13px] text-white/65">{sel.who}</span>
                </div>
                <h2 className="mt-2 text-[18px] sm:text-[19px] font-bold leading-snug">{sel.title}</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-white/85">{sel.what || '아직 게시글 요약이 없습니다.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={hrefTool(sel.sid)}
                    onClick={(e) => {
                      e.preventDefault();
                      if (document.fullscreenElement) void document.exitFullscreen().catch(() => null);
                      navigate(hrefTool(sel.sid));
                    }}
                    className="rounded-full bg-[#4fd1ff] px-4 py-2 text-[14px] font-bold text-[#06213a] hover:bg-[#7fe0ff]"
                  >
                    자세히 보기
                  </a>
                  <a href={sel.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[14px] font-bold ring-1 ring-white/30 hover:bg-white/10">
                    사용하기 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="sr-only">(새 창)</span>
                  </a>
                  <button type="button" onClick={() => eng.current?.select(null)} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-[14px] font-bold text-white/80 hover:text-white">
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 다른 카드
                  </button>
                </div>
              </div>
            ) : (
            <>
            <p className="min-h-[3.2em] pr-6 text-[16px] sm:text-[17px] leading-relaxed" aria-live="polite">
              {line.slice(0, typed)}
              {typing && <span className="ml-0.5 inline-block w-2 animate-pulse">▍</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {step === 'hello' ? (
                <>
                  <button type="button" onClick={doShow} className="inline-flex items-center gap-1.5 rounded-full bg-[#4fd1ff] px-4 py-2 text-[14px] font-bold text-[#06213a] hover:bg-[#7fe0ff]">
                    도구 보여 주세요 {!touch && <Kbd dark>Space</Kbd>}
                  </button>
                  <button type="button" onClick={doEnd} className="rounded-full px-4 py-2 text-[14px] font-bold text-white/80 ring-1 ring-white/25 hover:text-white">
                    다음에 올게요
                  </button>
                </>
              ) : (
                <>
                  {page.pages > 1 && (
                    <div className="inline-flex items-center gap-1 rounded-full ring-1 ring-white/25">
                      <button type="button" onClick={() => eng.current?.page(-1)} className="rounded-full p-2 hover:bg-white/10" aria-label="이전 카드">
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <span className="px-1 text-[13px] tabular-nums text-white/80">
                        {page.page + 1} / {page.pages}
                      </span>
                      <button type="button" onClick={() => eng.current?.page(1)} className="rounded-full p-2 hover:bg-white/10" aria-label="다음 카드">
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  {!touch && <span className="text-[12px] text-white/60">카드를 누르거나 숫자 키 1~6</span>}
                  <button type="button" onClick={doEnd} className="ml-auto rounded-full px-4 py-2 text-[14px] font-bold text-white/80 ring-1 ring-white/25 hover:text-white">
                    대화 끝내기
                  </button>
                </>
              )}
            </div>
            </>
            )}
            {/* 키보드·화면 낭독기용 카드 목록 */}
            {step === 'tools' && (
              <ul className="sr-only">
                {page.cards.map((c, i) => (
                  <li key={c.sid}>
                    <button type="button" className="focus:not-sr-only" onClick={() => eng.current?.select(i)}>
                      {i + 1}. {c.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

    </section>
  );
};

const Kbd: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <kbd
    className={`mx-0.5 inline-block rounded-[5px] px-1.5 py-[1px] font-sans text-[11px] font-bold leading-[1.4] ${
      dark ? 'bg-[#0d1830] text-white' : 'bg-white/15 text-white ring-1 ring-white/25'
    }`}
  >
    {children}
  </kbd>
);

export default Plaza;
