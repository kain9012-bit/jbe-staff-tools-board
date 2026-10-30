import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Building2, ChevronDown, Search, ExternalLink, Footprints, LayoutGrid, Maximize2, Minimize2, Moon, Sun, Clock3, X } from 'lucide-react';
import { allTools, splitAuthor, type Model } from '../lib/stats';
import { KEYWORD_CHIPS, chipFields, chipMatcher } from '../lib/keywords';
import { summaryOf, summaryText, type ToolSummary } from '../lib/summaries';
import { matcher } from '../lib/search';
import { hrefTool } from '../lib/route';
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
/** 구분 표 색 — 목록 화면의 구분 표와 같은 계열(홀로그램 위에서 보이게 진하게) */
const TAG_CLS: Record<string, string> = {
  staff: 'bg-[#1f7ae0] text-white',
  official: 'bg-[#2f3a73] text-white ring-1 ring-inset ring-white',
  external: 'bg-[#0f9a72] text-white',
};

/** 들른 천막 — 이 브라우저에만 기억(다시 들어와도 유지) */
const VKEY = 'plaza:visited';
const loadVisited = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(VKEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const saveVisited = (labels: string[]) => {
  try {
    localStorage.setItem(VKEY, JSON.stringify(labels));
  } catch {
    /* 저장할 수 없는 브라우저 — 이번 방문 동안만 기억 */
  }
};
const LINE2 = '이 업무에 쓸 수 있는 도구들이에요. 카드를 눌러 살펴보세요!';

type Tool = PlazaTool & { url: string; board: string };
type Tent = PlazaTent & { tools: Tool[] };

/** 천막(업무 분류)별 도구 + 로비 서가용 전체·많이 찾는·새로 올라온 도구 */
function usePlazaData(m: Model) {
  return useMemo(() => {
    const byRecent = [...allTools(m)].sort((a, b) => b.recent30 - a.recent30 || b.views - a.views);
    const cache = new Map<string, Tool>();
    const toTool = (t: (typeof byRecent)[number]): Tool => {
      const hitT = cache.get(t.sid);
      if (hitT) return hitT;
      const s = summaryOf(t.sid);
      const board = t.board ?? 'staff';
      const a = splitAuthor(t.author);
      const v: Tool = {
        sid: t.sid,
        title: t.title,
        tag: TAG[board] ?? '교직원 제작',
        who: board === 'staff' ? a.person + (a.org ? ` · ${a.org}` : '') : board === 'official' ? '전북특별자치도교육청' : '외부 기관',
        what: s?.what ?? '',
        run: s?.run ?? '',
        url: t.url,
        board,
      };
      cache.set(t.sid, v);
      return v;
    };
    const tents: Tent[] = KEYWORD_CHIPS.map((c) => {
      const hit = chipMatcher(c);
      const tools = byRecent.filter((t) => hit(...chipFields(t))).map(toTool);
      const look = LOOK[c.label] ?? { color: '#3a457f', prop: 'clipboard', line: '어서 오세요!' };
      return { label: c.label, color: look.color, prop: look.prop, tools };
    }).filter((t) => t.tools.length > 0);
    const all = byRecent.map(toTool);
    const popular = all.slice(0, 12);
    const fresh = [...byRecent]
      .sort((a, b) => b.created.localeCompare(a.created) || b.sid.localeCompare(a.sid))
      .slice(0, 12)
      .map(toTool);
    return { tents, all, popular, fresh };
  }, [m]);
}
const DESK_HELLO = '어서 오세요! 어떤 업무 도구를 찾으세요? 낱말을 넣거나 아래에서 골라 보세요.';

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

const HOLO_CSS = `
.plaza-holo{background:linear-gradient(135deg,rgba(14,64,130,.9),rgba(6,28,70,.92));border:2px solid rgba(120,220,255,.75);
box-shadow:0 0 0 1px rgba(120,220,255,.15),0 0 40px rgba(60,180,255,.35),inset 0 0 60px rgba(60,180,255,.12);backdrop-filter:blur(6px);
animation:plazaHoloIn .45s cubic-bezier(.2,.9,.3,1.2) .28s both;overflow:hidden}
@media (max-width:639px){.plaza-holo{overflow-y:auto;-webkit-overflow-scrolling:touch}.plaza-holo::after{display:none}}
.plaza-holo::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
background:repeating-linear-gradient(0deg,rgba(150,225,255,.05) 0 1px,transparent 1px 4px),linear-gradient(rgba(120,220,255,.07) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,rgba(120,220,255,.07) 1px,transparent 1px) 0 0/26px 26px}
.plaza-holo::after{content:"";position:absolute;left:0;right:0;height:60px;top:-60px;pointer-events:none;
background:linear-gradient(transparent,rgba(120,220,255,.12),transparent);animation:plazaSweep 4.5s linear .8s infinite}
@keyframes plazaHoloIn{from{opacity:0;transform:scale(.92);filter:brightness(2)}to{opacity:1;transform:none;filter:none}}
@keyframes plazaSweep{to{top:100%}}
.plaza-scroll{scrollbar-width:thin;scrollbar-color:rgba(120,220,255,.5) transparent}
@media (prefers-reduced-motion:reduce){.plaza-holo,.plaza-holo::after{animation:none}}
`;

export const Plaza: React.FC<{ m: Model }> = ({ m }) => {
  const data = usePlazaData(m);
  const tents = data.tents;
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const eng = useRef<PlazaEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState<number | 'desk' | null>(null);
  const [talk, setTalk] = useState<number | 'desk' | null>(null);
  const [world, setWorld] = useState<'out' | 'in'>('out');
  const [hoverTool, setHoverTool] = useState<PlazaTool | null>(null);
  const [deskQ, setDeskQ] = useState('');
  const [deskMsg, setDeskMsg] = useState<string | null>(null);
  const [deskHas, setDeskHas] = useState(false);
  const [step, setStep] = useState<'hello' | 'tools'>('hello');
  const [page, setPage] = useState({ page: 0, pages: 1, cards: [] as PlazaTool[] });
  const [sel, setSel] = useState<Tool | null>(null);
  const [mode, setMode] = useState<Mode>('auto');
  const [clock, setClock] = useState({ text: '', night: false });
  const [visited, setVisited] = useState<Set<number>>(() => {
    const keep = loadVisited();
    return new Set(tents.map((t, i) => (keep.includes(t.label) ? i : -1)).filter((i) => i >= 0));
  });
  const visitedRef = useRef(visited);
  visitedRef.current = visited;
  const [detail, setDetail] = useState<Tool | null>(null);
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
        setDetail(null);
        setDeskMsg(null);
        setDeskHas(false);
        if (typeof e.tent === 'number')
          setVisited((v) => {
            const n = new Set(v).add(e.tent as number);
            saveVisited([...new Set([...loadVisited(), ...[...n].map((i) => tents[i]?.label).filter(Boolean)])]);
            return n;
          });
      } else if (e.type === 'page') {
        setPage({ page: e.page, pages: e.pages, cards: e.cards });
        setDetail(null);
      }
      else if (e.type === 'select') {
        setSel(e.tool as Tool | null);
        setDetail(e.tool as Tool | null);
      }
      else if (e.type === 'clock') setClock({ text: e.text, night: e.night });
      else if (e.type === 'world') {
        setWorld(e.world);
        setHoverTool(null);
      } else if (e.type === 'hover') setHoverTool(e.tool);
    };
    void loadFonts().then(() => {
      if (dead || !host.current) return;
      try {
        eng.current = createPlaza(host.current, tents, on, { quality, visited: [...visitedRef.current], lobby: { tools: data.all, popular: data.popular, fresh: data.fresh } });
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
  }, [tents, quality, data]);

  // 대사 한 글자씩
  const tent = typeof talk === 'number' ? tents[talk] : null;
  const isDesk = talk === 'desk';
  const line = isDesk ? deskMsg ?? DESK_HELLO : tent ? (step === 'hello' ? LOOK[tent.label]?.line ?? '어서 오세요!' : LINE2) : '';
  const talker = isDesk ? { label: '안내 데스크', color: '#3a457f' } : tent ? { label: `${tent.label} 천막지기`, color: tent.color } : null;
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

  const doTalk = useCallback(() => (near === 'desk' ? eng.current?.talkDesk() : near !== null && eng.current?.talk(near)), [near]);
  const doShow = useCallback(() => {
    if (typing) return setTyped(line.length);
    setStep('tools');
    eng.current?.showTools();
  }, [typing, line]);
  const doEnd = useCallback(() => {
    eng.current?.endTalk();
    setSel(null);
    setDetail(null);
  }, []);
  /** 안내 데스크 찾기 — 낱말 또는 업무 분류 */
  const runSearch = (q: string, chip?: string) => {
    const word = (chip ?? q).trim();
    if (!word) return;
    const list = chip ? tents.find((t) => t.label === chip)?.tools ?? [] : data.all.filter((t) => matcher(q)(t.title, t.who, t.tag, summaryText(t.sid)));
    eng.current?.search(list);
    setDeskHas(list.length > 0);
    setDeskMsg(list.length ? `‘${word}’ 도구 ${list.length}개를 찾았어요. 서가에서도 빛나는 책을 찾아보세요!` : `‘${word}’에 맞는 도구를 찾지 못했어요. 다른 낱말로 찾아볼까요?`);
  };
  const closeDetail = useCallback(() => {
    eng.current?.select(null);
    setDetail(null);
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
        } else if (typeof talk === 'number' && step === 'hello') {
          e.preventDefault();
          doShow();
        }
      } else if (e.key === 'Escape') {
        if (detail) closeDetail();
        else if (sel) eng.current?.select(null);
        else if (talk !== null) doEnd();
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [talk, near, step, sel, detail, doTalk, doShow, doEnd, closeDetail]);

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
      <style>{HOLO_CSS}</style>
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
            <span className="nr-title whitespace-nowrap text-[18px] sm:text-[20px] leading-none">{world === 'in' ? '청사 로비' : '3D 광장'}</span>
            <span className="ml-auto text-[12px] tabular-nums text-white/70" title="들른 천막">
              <Footprints className="mr-1 inline w-3.5 h-3.5 align-[-2px]" aria-hidden="true" />
              {visited.size}/{tents.length}
            </span>
            <button type="button" onClick={() => setHelp((v) => !v)} aria-expanded={help} className="rounded p-0.5 text-white/70 hover:text-white" aria-label="조작 안내 접기·펴기">
              <ChevronDown className={`w-4 h-4 transition ${help ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
          {help && (
            <ul className="mt-2 space-y-0.5 whitespace-nowrap text-[13px] leading-relaxed text-white/80">
              {world === 'in' ? (
                <>
                  <li>책장의 책이 업무경감 도구예요.</li>
                  <li>· 책을 누르면 도구 설명이 열려요</li>
                  <li>· 안내 데스크에서 도구를 찾아 드려요</li>
                  <li>· 들어온 문으로 나가면 광장이에요</li>
                </>
              ) : (
                <li>업무별 천막의 천막지기에게 말을 걸어 보세요.</li>
              )}
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
                  <li>· 땅을 누르면 걸어가기</li>
                  <li>· 끌어서 둘러보기, 바퀴로 확대</li>
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
            바로 가기
            <ChevronDown className={`ml-auto w-4 h-4 transition ${listOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {listOpen && (
            <ul className="max-h-[40vh] overflow-y-auto px-2 pb-2">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    eng.current?.goLobby();
                    if (touch) setListOpen(false);
                  }}
                  disabled={world === 'in'}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-white/10 focus-visible:bg-white/10 disabled:opacity-50"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-[#9be6ff]" aria-hidden="true" />
                  <span className="truncate">청사 로비 · 도구 서가</span>
                  {world === 'in' && <span className="ml-auto text-[11px] text-[#9be6ff]">여기</span>}
                </button>
              </li>
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
            <span className="h-3 w-3 rounded-full" style={{ background: near === 'desk' ? '#3a457f' : tents[near].color }} aria-hidden="true" />
            {near === 'desk' ? '안내 데스크에 말 걸기' : `${tents[near].label} 천막지기에게 말 걸기`}
            {!touch && <Kbd dark>Space</Kbd>}
          </button>
        </div>
      )}

      {/* 책에 마우스를 올리면 이름 */}
      {hoverTool && !detail && talk === null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <span className="inline-flex max-w-[90%] items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-bold text-[#0d1830] shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
            <BookOpen className="h-4 w-4 shrink-0 text-[#1c64ac]" aria-hidden="true" />
            <span className="truncate">{hoverTool.title}</span>
            <span className="shrink-0 font-medium text-slate-500">· 누르면 설명</span>
          </span>
        </div>
      )}

      {/* 대화 상자 */}
      {talker && !detail && (
        <div className="absolute inset-x-0 bottom-3 sm:bottom-5 z-20 flex justify-center px-3">
          <div role="dialog" aria-label={talker.label} className={`relative w-full max-w-3xl rounded-2xl ${glass} px-5 pb-4 pt-6 sm:px-6`}>
            <span className="absolute -top-3.5 left-5 rounded-full px-3.5 py-1 text-[13px] font-bold text-white shadow" style={{ background: talker.color }}>
              {talker.label}
            </span>
            <button type="button" onClick={doEnd} className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="대화 끝내기">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <p className="min-h-[3.2em] pr-6 text-[16px] sm:text-[17px] leading-relaxed" aria-live="polite">
              {line.slice(0, typed)}
              {typing && <span className="ml-0.5 inline-block w-2 animate-pulse">▍</span>}
            </p>
            {isDesk && (
              <div className="mt-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runSearch(deskQ);
                  }}
                  className="flex gap-2"
                >
                  <label className="sr-only" htmlFor="plaza-desk-q">찾을 업무 낱말</label>
                  <input
                    id="plaza-desk-q"
                    autoFocus={!touch}
                    value={deskQ}
                    onChange={(e) => setDeskQ(e.target.value)}
                    placeholder="예: 엑셀 합치기, 품의, 급식"
                    className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-[15px] text-[#0d1830] outline-none ring-2 ring-transparent focus:ring-[#4fd1ff]"
                  />
                  <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#4fd1ff] px-4 py-2 text-[14px] font-bold text-[#06213a] hover:bg-[#7fe0ff]">
                    <Search className="h-4 w-4" aria-hidden="true" /> 찾기
                  </button>
                </form>
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {tents.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        setDeskQ('');
                        runSearch('', t.label);
                      }}
                      className="shrink-0 rounded-full px-3 py-1 text-[13px] font-bold text-white/85 ring-1 ring-white/25 hover:bg-white/10"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!isDesk && step === 'hello' ? (
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
                  {(!isDesk || deskHas) && page.pages > 1 && (
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
                  {!touch && (!isDesk || deskHas) && <span className="text-[12px] text-white/60">카드를 누르면 자세히 · 숫자 키 1~6</span>}
                  <button type="button" onClick={doEnd} className="ml-auto rounded-full px-4 py-2 text-[14px] font-bold text-white/80 ring-1 ring-white/25 hover:text-white">
                    대화 끝내기
                  </button>
                </>
              )}
            </div>
            {/* 키보드·화면 낭독기용 카드 목록 */}
            {(step === 'tools' || deskHas) && (
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

      {/* 자세히 보기 — 확대된 홀로그램 카드 위에 겹쳐 띄움 */}
      {detail && <Detail tool={detail} s={summaryOf(detail.sid)} onClose={closeDetail} />}
    </section>
  );
};

const Sec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-5">
    <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-[#9be6ff]">
      <span className="h-px w-4 bg-[#4fd1ff]" aria-hidden="true" />
      {title}
    </h3>
    <div className="mt-2 text-[15px] leading-relaxed text-white/90">{children}</div>
  </section>
);

const Detail: React.FC<{ tool: Tool; s?: ToolSummary; onClose: () => void }> = ({ tool, s, onClose }) => {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  const none = !s?.why && !s?.features?.length && !s?.steps?.length && !s?.needs?.length && !s?.cautions?.length;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center p-2 sm:p-6 pointer-events-none">
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-label={`${tool.title} 자세히 보기`}
        className="plaza-holo plaza-scroll pointer-events-auto relative block max-h-full w-full max-w-[760px] rounded-[18px] text-white outline-none sm:flex sm:max-h-[86%] sm:flex-col sm:rounded-[22px]"
      >
        <div className="flex items-start gap-2 px-5 pt-5 sm:px-8 sm:pt-7">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${TAG_CLS[tool.board] ?? TAG_CLS.staff}`}>{tool.tag}</span>
              {tool.run && <span className="rounded-md bg-white/12 px-2 py-0.5 text-[12px] font-bold text-[#bff3ff] ring-1 ring-inset ring-[#4fd1ff]/40">{tool.run}</span>}
              <span className="text-[13px] text-white/60">{tool.who}</span>
            </div>
            <h2 className="mt-2.5 text-[22px] sm:text-[26px] font-bold leading-snug [text-shadow:0_0_14px_rgba(80,200,255,.6)]">{tool.title}</h2>
            {(s?.what || tool.what) && <p className="mt-1.5 text-[16px] leading-relaxed text-[#cdeeff]">{s?.what || tool.what}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-2 shrink-0 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="닫기">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 pb-2 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:px-8 plaza-scroll">
          {s?.why && <Sec title="만든 이유">{s.why}</Sec>}
          {!!s?.features?.length && (
            <Sec title="주요 기능">
              <ul className="space-y-1">
                {s.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#4fd1ff]" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </Sec>
          )}
          {!!s?.steps?.length && (
            <Sec title="사용 순서">
              <ol className="space-y-1.5">
                {s.steps.map((st, i) => (
                  <li key={st} className="flex gap-2.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#4fd1ff]/20 text-[12px] font-bold text-[#9be6ff] ring-1 ring-[#4fd1ff]/50">{i + 1}</span>
                    <span className="pt-px">{st}</span>
                  </li>
                ))}
              </ol>
            </Sec>
          )}
          {!!s?.needs?.length && <Sec title="필요한 것">{s.needs.join(' · ')}</Sec>}
          {!!s?.cautions?.length && (
            <Sec title="유의사항">
              <ul className="space-y-1">
                {s.cautions.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            </Sec>
          )}
          {none && <p className="mt-5 text-[15px] text-white/70">아직 게시글 요약이 없습니다. 게시글에서 내용을 확인해 주세요.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#4fd1ff]/25 px-5 py-4 sm:px-8">
          <a href={tool.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#4fd1ff] px-5 py-2.5 text-[14px] font-bold text-[#06213a] hover:bg-[#7fe0ff]">
            사용하기 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
          <a href={hrefTool(tool.sid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-[14px] font-bold text-white/85 ring-1 ring-white/30 hover:bg-white/10">
            상세 화면 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
          <button type="button" onClick={onClose} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2.5 text-[14px] font-bold text-white/80 hover:text-white">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 카드로 돌아가기
          </button>
        </div>
      </div>
    </div>
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
