import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, RotateCw } from 'lucide-react';
import { Lnb, menuOf, SiteFooter, SiteHeader, SubLayout, MENU, type LnbSub, type MenuKey } from './components/Shell';
import { EmptyState } from './components/Ui';
import { hrefPurpose, locKey, useRoute } from './lib/route';
import { allTools } from './lib/stats';
import { useData } from './lib/useData';
import { About } from './pages/About';
import { Find } from './pages/Find';
import { StatsOverview } from './pages/Home';
import { MakerDetail } from './pages/MakerDetail';
import { OfficialStats } from './pages/OfficialStats';
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

const SERVICE = '업무경감 도구 모음';

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
  const purposeNow = route.page === 'home' || route.page === 'tools' ? route.p ?? '' : '';

  const toolTitle = route.page === 'tool' && m ? allTools(m).find((x) => x.sid === route.sid)?.title : undefined;
  const makerName = route.page === 'maker' ? route.name : undefined;

  useEffect(() => {
    const t = toolTitle ?? makerName ?? (active !== 'find' ? MENU.find((x) => x.key === active)?.label : undefined);
    document.title = t ? `${t} · ${SERVICE}` : `${SERVICE} · 전북특별자치도교육청`;
  }, [toolTitle, makerName, active]);

  /** 왼쪽 메뉴 '도구 찾기' 아래 사용목적 바로가기 — 교직원 제작 + 교육청 배포 함께 셈 */
  const subs = useMemo<Partial<Record<MenuKey, LnbSub[]>>>(() => {
    if (!m) return {};
    const all = allTools(m);
    const c = new Map<string, number>();
    for (const t of all) c.set(t.purpose, (c.get(t.purpose) ?? 0) + 1);
    return {
      find: [
        { label: '전체', href: hrefPurpose(''), on: active === 'find' && route.page !== 'tool' && !purposeNow, count: all.length },
        ...[...c.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([p, k]) => ({ label: p, href: hrefPurpose(p), on: purposeNow === p, count: k })),
      ],
      makers: [
        { label: '교직원 제작 도구', href: '/makers', on: route.page === 'makers' || route.page === 'maker', count: m.tools.length },
        ...(m.official ? [{ label: '교육청 배포 도구', href: '/official', on: route.page === 'official', count: m.official.tools.length }] : []),
      ],
    };
  }, [m, active, route.page, purposeNow]);

  const label = MENU.find((x) => x.key === active)?.label ?? '';
  const trail: { label: string; href?: string }[] = [
    { label: '데이터 도구실' },
    { label: SERVICE, href: '/' },
    ...(toolTitle || makerName
      ? [{ label, href: MENU.find((x) => x.key === active)!.href }, { label: toolTitle ?? makerName ?? '' }]
      : route.page === 'makers' || route.page === 'official'
        ? [{ label, href: '/makers' }, { label: route.page === 'official' ? '교육청 배포 도구' : '교직원 제작 도구' }]
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
