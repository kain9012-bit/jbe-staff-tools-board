import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUp, RotateCw } from 'lucide-react';
import { Header } from './components/Header';
import { EmptyState } from './components/Ui';
import { BOARD_URL } from './lib/board';
import { useRoute } from './lib/route';
import { useData } from './lib/useData';
import { About } from './pages/About';
import { Home } from './pages/Home';
import { MakerDetail } from './pages/MakerDetail';
import { Makers } from './pages/Makers';
import { ToolDetail } from './pages/ToolDetail';
import { Tools } from './pages/Tools';


/** 자료가 오기 전 빈 껍데기 — 숫자 자리를 회색 막대로만 둠 */
const Skeleton = () => (
  <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-4">
    <span className="sr-only">자료를 불러오는 중</span>
    <div className="h-10 w-2/3 rounded bg-slate-100" />
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-slate-100" />
      ))}
    </div>
    <div className="h-64 rounded-lg bg-slate-100" />
  </div>
);

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

  useEffect(() => {
    if (!m) return;
    const base = '교직원 제작 도구 현황';
    const t =
      route.page === 'tool'
        ? m.tools.find((x) => x.sid === route.sid)?.title
        : route.page === 'maker'
          ? route.name
          : undefined;
    document.title = t ? `${t} · ${base}` : `${base} · 전북특별자치도교육청`;
  }, [m, route]);

  let body: React.ReactNode;
  if (route.page === 'about') body = <About m={m} />;
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" /> 다시 시도
          </button>
        </div>
      </div>
    );
  else if (m) {
    body =
      route.page === 'tools' ? <Tools key={route.q} m={m} initialQ={route.q} />
      : route.page === 'makers' ? <Makers key={route.q} m={m} initialQ={route.q} />
      : route.page === 'tool' ? <ToolDetail m={m} sid={route.sid} />
      : route.page === 'maker' ? <MakerDetail m={m} name={route.name} />
      : <Home m={m} />;
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-slate-800 font-sans antialiased flex flex-col selection:bg-blue-600 selection:text-white">
      <a className="krds-skip" href="#container" onClick={(e) => { e.preventDefault(); document.getElementById('container')?.focus(); }}>
        본문 바로가기
      </a>
      <Header route={route} asOf={m?.asOf} />

      <main id="container" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 outline-none">
        {body}
      </main>

      <footer className="bg-slate-900 mt-auto jbe-noprint">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap justify-between gap-4 text-sm text-slate-300">
          <div>
            <b className="block text-white">교직원 제작 도구 현황</b>
            데이터 도구실 교직원 제작 도구 게시판의 조회수·댓글 현황 (비공식)
          </div>
          <div className="text-slate-400">
            출처 —{' '}
            <a href={BOARD_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">
              전북특별자치도교육청 누리집 교직원 제작 도구 게시판
            </a>
          </div>
        </div>
      </footer>

      {top && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="맨 위로"
          className="fixed right-4 bottom-4 w-11 h-11 rounded-full border border-slate-300 bg-white text-slate-600 shadow-md hover:border-blue-600 hover:text-blue-700 flex items-center justify-center jbe-noprint"
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
