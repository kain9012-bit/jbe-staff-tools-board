import React from 'react';
import { ArrowUpRight, Info, Wrench } from 'lucide-react';
import { BOARD_URL } from '../lib/board';
import type { Route } from '../types';

const TABS: { key: 'home' | 'tools' | 'makers' | 'about'; label: string; href: string }[] = [
  { key: 'home', label: '둘러보기', href: '#/' },
  { key: 'tools', label: '도구', href: '#/tools' },
  { key: 'makers', label: '제작자', href: '#/makers' },
  { key: 'about', label: '집계 기준', href: '#/about' },
];

const activeOf = (r: Route) =>
  r.page === 'tool' ? 'tools' : r.page === 'maker' ? 'makers' : r.page;

export const Header: React.FC<{ route: Route; asOf?: string }> = ({ route, asOf }) => {
  const active = activeOf(route);
  return (
    <header className="sm:sticky sm:top-0 z-30 bg-white jbe-noprint">
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="hidden sm:flex items-start gap-1.5 min-w-0">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="min-w-0">
              교직원 제작 도구 게시판의 조회수·댓글을 매시간 모아 정리
            </span>
          </span>
          <span className="flex w-full sm:w-auto shrink-0 items-center justify-between sm:justify-start gap-3">
            <span className="tabular-nums">{asOf ? `${asOf} 수집 기준` : '수집 시점 확인 중'}</span>
            <a href={BOARD_URL} target="_blank" rel="noreferrer" className="md:hidden inline-flex items-center gap-0.5 font-bold text-blue-700">
              게시판 바로가기 <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </span>
        </div>
      </div>
      <div className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center gap-x-8">
          <a href="#/" className="flex items-center gap-3 py-2.5 sm:py-3">
            <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="jbe-display block text-lg font-extrabold text-slate-900 leading-tight">
                교직원 제작 도구 현황
              </strong>
              <span className="block text-xs text-slate-500">전북특별자치도교육청 데이터 도구실</span>
            </span>
          </a>
          <ul role="tablist" className="flex items-center gap-5 sm:gap-6 sm:ml-auto overflow-x-auto">
            {TABS.map((t) => (
              <li key={t.key} role="presentation">
                <a
                  href={t.href}
                  role="tab"
                  aria-selected={active === t.key}
                  className={`block py-3 sm:py-4 text-base font-bold border-b-[3px] whitespace-nowrap transition-colors ${
                    active === t.key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={BOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center gap-1 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50"
          >
            게시판 바로가기
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
        </div>
      </div>
    </header>
  );
};
