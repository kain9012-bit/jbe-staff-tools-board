import { useEffect, useMemo, useState } from 'react';
import type { Route } from './types';
import { AlertTriangle, ArrowUp, RotateCw } from 'lucide-react';
import { Lnb, menuOf, SiteFooter, SiteHeader, SubLayout, MENU, type LnbSub, type MenuKey } from './components/Shell';
import { Requests } from './pages/Requests';
import { RequestDetail } from './pages/RequestDetail';
import { SOURCES } from './lib/sources';
import { EmptyState } from './components/Ui';
import { locKey, useRoute } from './lib/route';
import { allTools } from './lib/stats';
import { useData } from './lib/useData';
import { useManage } from './lib/manage';
import { About } from './pages/About';
import { Find } from './pages/Find';
import { StatsOverview } from './pages/Home';
import { MakerDetail } from './pages/MakerDetail';
import { OfficialStats } from './pages/OfficialStats';
import { Makers } from './pages/Makers';
import { Register } from './pages/Register';
import { ToolDetail } from './pages/ToolDetail';
import { PageTitle } from './components/Shell';
import { SERVER } from './lib/edition';
import { ReviewServer } from './pages/ReviewServer';
import { Login } from './pages/Login';
import { NOTICE_EV } from './lib/server';

/** 짧은 알림 띠 — 저장·오류 안내 */
const Notice: React.FC = () => {
  const [n, setN] = useState<{ msg: string; tone: 'ok' | 'err'; k: number } | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { msg: string; tone: 'ok' | 'err' };
      setN({ ...d, k: Date.now() });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setN(null), d.tone === 'err' ? 6000 : 3000);
    };
    window.addEventListener(NOTICE_EV, on);
    return () => window.removeEventListener(NOTICE_EV, on);
  }, []);
  if (!n) return null;
  return (
    <div role={n.tone === 'err' ? 'alert' : 'status'} className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 jbe-noprint">
      <p className={`max-w-lg rounded-xl px-5 py-3 text-[15px] font-bold shadow-lg ${n.tone === 'err' ? 'bg-[#b0123a] text-white' : 'bg-[var(--nr-p2)] text-white'}`}>{n.msg}</p>
    </div>
  );
};

/** 자료가 오기 전 빈 껍데기 — 숫자 자리를 회색 막대로만 둠 */
const Skeleton = () => (
  <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-4">
    <span className="sr-only">자료를 불러오는 중</span>
    <div className="h-12 w-1/2 rounded bg-slate-100" />
    <div className="h-40 rounded-[10px] bg-slate-100" />
    <div className="h-24 rounded-[10px] bg-slate-100" />
    <div className="h-64 rounded-[10px] bg-slate-100" />
  </div>
);

const SERVICE = '업무경감 도구 모음';

/** 모바일 하위 메뉴 — PC는 왼쪽 메뉴에 있으므로 좁은 화면에서만 보임 */
const SubTabs: React.FC<{ items: LnbSub[] }> = ({ items }) => (
  <nav aria-label="하위 메뉴" className="lg:hidden mb-5 grid grid-flow-col auto-cols-fr rounded-[10px] bg-[var(--nr-bg)] p-1">
    {items.map((it) => (
      <a
        key={it.href}
        href={it.href}
        aria-current={it.on ? 'page' : undefined}
        className={`rounded-[8px] px-2 py-2.5 text-center text-[15px] font-bold ${
          it.on ? 'bg-[var(--nr-p2)] text-white shadow-sm' : 'text-slate-600'
        }`}
      >
        {it.label}
        {it.count !== undefined && <span className={`ml-1 text-[13px] font-medium ${it.on ? 'text-white/80' : 'text-slate-400'}`}>{it.count}</span>}
      </a>
    ))}
  </nav>
);

export default function App() {
  const raw = useRoute();
  /** 서버판 — 개편 안내·집계 기준 화면 없음. 옛 주소는 도구 찾기로
   *  웹판 — 도구 찾기·제작자 현황·집계 기준만. 요청·등록·검수·개편 안내 등 옛 주소는 도구 찾기로 */
  const WEB_GONE = ['poc', 'requests', 'request', 'register', 'review', 'login', 'board-home'];
  const route = SERVER
    ? raw.page === 'about' || raw.page === 'poc'
      ? ({ page: 'home' } as Route)
      : raw
    : WEB_GONE.includes(raw.page as string)
      ? ({ page: 'home' } as Route)
      : raw;
  const { state, reload } = useData();
  const [top, setTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { ups } = useManage();
  /** 서버판 — 고도화로 전환된 도구는 서버 자료에 이미 반영됨. 웹판은 수집 자료 그대로 */
  const m = useMemo(() => (state.status === 'ready' ? state.model : undefined), [state]);
  void ups;
  const active: MenuKey = menuOf(route);
  const srcNow = route.page === 'home' || route.page === 'tools' ? route.src ?? '' : '';

  const toolNow = route.page === 'tool' && m ? allTools(m).find((x) => x.sid === route.sid) : undefined;
  const toolTitle = toolNow?.title;
  const toolBoard = toolNow ? toolNow.board ?? 'staff' : '';
  const makerName = route.page === 'maker' ? route.name : route.page === 'request' ? '요청 글' : route.page === 'login' ? '로그인' : undefined;

  useEffect(() => {
    const t = toolTitle ?? makerName ?? (active !== 'find' ? MENU.find((x) => x.key === active)?.label : undefined);
    document.title = t ? `${t} · 데이터 도구실` : `${SERVICE} · 데이터 도구실 · 전북특별자치도교육청`;
  }, [toolTitle, makerName, active]);

  /** 왼쪽 메뉴 '도구 찾기' 아래 사용목적 바로가기 — 교직원 제작 + 교육청 배포 함께 셈 */
  const subs = useMemo<Partial<Record<MenuKey, LnbSub[]>>>(() => {
    const fixed: Partial<Record<MenuKey, LnbSub[]>> = SERVER
      ? {
          register: [
            { label: '등록 신청', href: '/register', on: route.page === 'register' },
            { label: '검수 현황', href: '/review', on: route.page === 'review' },
          ],
          guide: [{ label: '집계 기준', href: '/about', on: route.page === 'about' }],
        }
      : {};
    if (!m) return fixed;
    const all = allTools(m);
    const c = new Map<string, number>();
    for (const t of all) c.set(t.purpose, (c.get(t.purpose) ?? 0) + 1);
    return {
      ...fixed,
      find: [
        { label: '전체', href: '/', on: active === 'find' && route.page !== 'tool' && !srcNow, count: all.length },
        ...SOURCES.map((x) => ({
          label: x.name,
          href: `/?src=${x.key}`,
          on: srcNow === x.key || (route.page === 'tool' && toolBoard === x.key),
          count: all.filter((t) => (t.board ?? 'staff') === x.key).length,
        })),
      ],
      makers: [
        { label: '교직원 제작 도구', href: '/makers', on: route.page === 'makers' || route.page === 'maker', count: m.tools.length },
        ...(m.official ? [{ label: '교육청 배포 도구', href: '/official', on: route.page === 'official', count: m.official.tools.length }] : []),
        ...(m.external && !m.external.staticOnly
          ? [{ label: '외부 공공업무 도구', href: '/external', on: route.page === 'external', count: m.external.tools.length }]
          : []),
        // 웹판 — 집계 기준은 제작자 현황 아래
        ...(SERVER ? [] : [{ label: '집계 기준', href: '/about', on: route.page === 'about' }]),
      ],
    };
  }, [m, active, route.page, srcNow, toolBoard]);

  const label = MENU.find((x) => x.key === active)?.label ?? '';
  /** 하위 메뉴가 있는 화면은 '메뉴 > 하위 메뉴' */
  const subNow = active !== 'find' || srcNow ? subs[active]?.find((x) => x.on)?.label : undefined;
  const trail: { label: string; href?: string }[] = [
    { label: '교육데이터 허브' },
    { label: '데이터 도구실' },
    { label: SERVICE, href: '/' },
    ...(toolTitle || makerName
      ? [{ label, href: MENU.find((x) => x.key === active)!.href }, { label: toolTitle ?? makerName ?? '' }]
      : subNow && subNow !== label && (subs[active]?.length ?? 0) > 1
        ? [{ label, href: MENU.find((x) => x.key === active)!.href }, { label: subNow }]
        : [{ label }]),
  ];

  let body: React.ReactNode;
  if (route.page === 'about') body = <About m={m} />;
  else if (route.page === 'register' && SERVER) body = <Register key={locKey()} initialType={route.type} initialReq={route.req} m={m} edit={route.edit} />;
  else if (route.page === 'review' && SERVER) body = <ReviewServer />;
  else if (route.page === 'login' && SERVER) body = <Login next={route.next} />;
  else if (state.status === 'loading') body = <Skeleton />;
  else if (state.status === 'error')
    body = (
      <div className="space-y-3">
        <EmptyState
          icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />}
          title="자료를 불러오지 못함"
          desc={SERVER ? `서버에서 자료를 받지 못했습니다. (${state.message})` : `수집 시트를 읽는 중 문제가 생겼습니다. (${state.message})`}
        />
        <div className="text-center">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--nr-p2)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" /> 다시 시도
          </button>
        </div>
      </div>
    );
  else if (m) {
    if (route.page === 'home' || route.page === 'tools')
      body = (
        <Find key={locKey()} m={m} initialQ={route.q} initialSort={route.sort} initialPurpose={route.p} initialSrc={route.src} from={route.from} to={route.to} />
      );
    else if (route.page === 'makers')
      body = (
        <>
          <PageTitle desc="교직원이 만든 도구와 제작자별 조회수·댓글 현황. 기간을 골라 보면 아래 순위가 함께 바뀝니다.">교직원 제작 도구</PageTitle>
          <StatsOverview m={m} />
          <div className="mt-12" id="makers-table">
            <Makers key={locKey()} m={m} initialQ={route.q} initialSort={route.sort} from={route.from} to={route.to} />
          </div>
        </>
      );
    else if (route.page === 'official') body = <OfficialStats m={m} />;
    else if (route.page === 'external') body = <OfficialStats key="external" m={m} board="external" />;
    else if (route.page === 'tool') body = <ToolDetail m={m} sid={route.sid} />;
    else if (route.page === 'maker') body = <MakerDetail m={m} name={route.name} />;
    else if (route.page === 'requests' && SERVER) body = <Requests m={m} />;
    else if (route.page === 'request' && SERVER) body = <RequestDetail key={route.id} m={m} id={route.id} />;
  }
  /** 휴대폰 하위 메뉴 — PC는 왼쪽 메뉴에 있음 */
  const mobileSubs = active !== 'find' && route.page !== 'maker' ? subs[active] : undefined;
  if (body && mobileSubs && mobileSubs.length > 1)
    body = (
      <>
        <SubTabs items={mobileSubs} />
        {body}
      </>
    );

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[var(--nr-text)] font-sans antialiased flex flex-col selection:bg-[var(--nr-p3)] selection:text-white">
      <a
        className="krds-skip"
        href="#container"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('container')?.focus();
        }}
      >
        본문 바로가기
      </a>
      <SiteHeader active={active} asOf={m?.asOf} />
      <SubLayout lnb={<Lnb active={active} subs={subs} />} trail={trail}>
        {body}
      </SubLayout>

      <SiteFooter />
      {SERVER && <Notice />}

      {top && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="맨 위로"
          className="fixed right-4 bottom-4 w-11 h-11 rounded-full bg-[var(--nr-p2)] text-white shadow-md hover:opacity-90 flex items-center justify-center jbe-noprint"
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
