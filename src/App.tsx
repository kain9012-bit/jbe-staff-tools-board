import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, RotateCw } from 'lucide-react';
import { Lnb, menuOf, SiteFooter, SiteHeader, SubLayout, MENU, type LnbSub, type MenuKey } from './components/Shell';
import { EmptyState } from './components/Ui';
import { hrefSource, useRoute } from './lib/route';
import { allTools } from './lib/stats';
import { useData } from './lib/useData';
import { About } from './pages/About';
import { Find } from './pages/Find';
import { StatsOverview } from './pages/Home';
import { MakerDetail } from './pages/MakerDetail';
import { Makers } from './pages/Makers';
import { Register } from './pages/Register';
import { ToolDetail } from './pages/ToolDetail';
import { PageTitle } from './components/Shell';

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

const SERVICE = '교직원 제작 도구 현황';

export default function App() {
  const route = useRoute();
  const { state, reload } = useData();
  const [top, setTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const m = state.status === 'ready' ? state.model : undefined;
  const active: MenuKey = menuOf(route);
  const srcNow = route.page === 'home' || route.page === 'tools' ? route.src ?? '' : '';

  const toolTitle = route.page === 'tool' && m ? allTools(m).find((x) => x.sid === route.sid)?.title : undefined;
  const makerName = route.page === 'maker' ? route.name : undefined;

  useEffect(() => {
    const t = toolTitle ?? makerName ?? (active !== 'find' ? MENU.find((x) => x.key === active)?.label : undefined);
    document.title = t ? `${t} · ${SERVICE}` : `${SERVICE} · 전북특별자치도교육청`;
  }, [toolTitle, makerName, active]);

  /** 왼쪽 메뉴 '도구 찾기' 아래 출처 게시판 바로가기 — 게시판마다 분류가 달라 출처로만 나눔 */
  const subs = useMemo<Partial<Record<MenuKey, LnbSub[]>>>(() => {
    if (!m) return {};
    const home = active === 'find' && route.page !== 'tool';
    const off = m.official?.tools.length ?? 0;
    return {
      find: [
        { label: '전체', href: hrefSource(''), on: home && !srcNow, count: m.tools.length + off },
        { label: '교직원 제작', href: hrefSource('staff'), on: home && srcNow === 'staff', count: m.tools.length },
        ...(off ? [{ label: '교육청 배포', href: hrefSource('official'), on: home && srcNow === 'official', count: off }] : []),
      ],
    };
  }, [m, active, route.page, srcNow]);

  const label = MENU.find((x) => x.key === active)?.label ?? '';
  const trail: { label: string; href?: string }[] = [
    { label: '데이터 도구실' },
    { label: '교직원 제작 도구', href: '#/' },
    ...(toolTitle || makerName
      ? [{ label, href: MENU.find((x) => x.key === active)!.href }, { label: toolTitle ?? makerName ?? '' }]
      : [{ label }]),
  ];

  let body: React.ReactNode;
  if (route.page === 'about') body = <About m={m} />;
  else if (route.page === 'register') body = <Register />;
  else if (state.status === 'loading') body = <Skeleton />;
  else if (state.status === 'error')
    body = (
      <div className="space-y-3">
        <EmptyState
          icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />}
          title="자료를 불러오지 못함"
          desc={`수집 시트를 읽는 중 문제가 생겼습니다. (${state.message})`}
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
        <Find key={window.location.hash} m={m} initialQ={route.q} initialSort={route.sort} initialPurpose={route.p} initialSrc={route.src} from={route.from} to={route.to} />
      );
    else if (route.page === 'makers')
      body = (
        <>
          <PageTitle desc="도구를 만든 교직원별 조회수·댓글 현황. 기간을 골라 보면 아래 순위가 함께 바뀝니다.">제작자 현황</PageTitle>
          <StatsOverview m={m} />
          <div className="mt-12" id="makers-table">
            <Makers key={window.location.hash} m={m} initialQ={route.q} initialSort={route.sort} from={route.from} to={route.to} />
          </div>
        </>
      );
    else if (route.page === 'tool') body = <ToolDetail m={m} sid={route.sid} />;
    else if (route.page === 'maker') body = <MakerDetail m={m} name={route.name} />;
  }

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
