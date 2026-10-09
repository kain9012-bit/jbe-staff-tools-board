import React, { useState } from 'react';
import { ArrowUpRight, ChevronRight, Home, Link2, Check } from 'lucide-react';
import { BOARD_URL, OFFICIAL_BOARD_URL, WRITE_URL } from '../lib/board';
import type { Route } from '../types';

/**
 * 전북교육청 누리집(www.jbe.go.kr) 하위 화면 틀을 따른 공통 뼈대.
 * 머리말 → 위치 표시 띠 → [왼쪽 메뉴 | 본문] → 바닥글.
 * 누리집과 다른 점(사용 편의): 머리말에 게시판·등록 바로가기, 위치 띠에 주소 복사,
 * 휴대폰에서는 왼쪽 메뉴를 가로 메뉴로 바꿈.
 */

export type MenuKey = 'find' | 'makers' | 'register' | 'about';

export const MENU: { key: MenuKey; label: string; href: string }[] = [
  { key: 'find', label: '도구 찾기', href: '/' },
  { key: 'makers', label: '제작자 현황', href: '/makers' },
  { key: 'register', label: '도구 등록', href: '/register' },
  { key: 'about', label: '집계 기준', href: '/about' },
];

export const menuOf = (r: Route): MenuKey =>
  r.page === 'tool' || r.page === 'tools' || r.page === 'home'
    ? 'find'
    : r.page === 'maker' || r.page === 'official'
      ? 'makers'
      : (r.page as MenuKey);

const Ext: React.FC<{ href: string; children: React.ReactNode; className?: string }> = ({ href, children, className = '' }) => (
  <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-0.5 ${className}`}>
    {children}
    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
    <span className="sr-only">(새 창)</span>
  </a>
);

/** 머리말·본문·꼬리말이 함께 쓰는 좌우 기준선 (누리집 본문 폭) */
export const BOX = 'mx-4 min-[1024px]:mx-5 min-[1200px]:mx-auto min-[1200px]:max-w-[1200px] min-[1600px]:max-w-[1620px]';

/** 머리말 — 누리집처럼 위 작은 줄(바로가기) + 이름 줄 + 대메뉴 줄 */
export const SiteHeader: React.FC<{ active: MenuKey; asOf?: string }> = ({ active, asOf }) => (
  <header className="bg-white border-b border-[var(--nr-line)] jbe-noprint">
    <div className={BOX}>
      <div className="hidden md:flex justify-end gap-3 pt-3 text-[13px] text-slate-600">
        <span className="tabular-nums">{asOf ? `${asOf} 수집 기준` : '수집 시점 확인 중'}</span>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <Ext href={BOARD_URL} className="hover:text-[var(--nr-p3)]">교직원 제작 도구 게시판</Ext>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <Ext href={WRITE_URL} className="hover:text-[var(--nr-p3)]">내 도구 등록하기</Ext>
      </div>
      <div className="flex items-center gap-4 py-3 md:py-2">
        <a href="/" className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid grid-cols-2 gap-0.5 w-8 h-8 shrink-0">
            <span className="rounded-sm bg-[var(--nr-p1)]" />
            <span className="rounded-sm bg-[#32bdb8]" />
            <span className="rounded-sm bg-[#fecd20]" />
            <span className="rounded-sm bg-[var(--nr-p2)]" />
          </span>
          <span className="leading-tight">
            <strong className="nr-title block text-[1.375rem] text-[#002f63]">업무경감 도구 모음</strong>
            <span className="block text-[12px] text-slate-500">전북특별자치도교육청 데이터 도구실</span>
          </span>
        </a>
        <a
          href={BOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto md:hidden text-[13px] font-bold text-[var(--nr-p3)] inline-flex items-center gap-0.5"
        >
          게시판 <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
    <nav aria-label="주메뉴" className="border-t border-[var(--nr-line)] lg:hidden">
      <div className={BOX}>
      <ul className="-mx-3 lg:-mx-5 flex overflow-x-auto no-scrollbar">
        {MENU.map((m) => (
          <li key={m.key}>
            <a
              href={m.href}
              aria-current={active === m.key ? 'page' : undefined}
              className={`block whitespace-nowrap px-3 lg:px-5 py-3 text-base border-b-[3px] transition-colors ${
                active === m.key
                  ? 'border-[var(--nr-p3)] text-[var(--nr-p3)] font-bold'
                  : 'border-transparent text-[var(--nr-text)] hover:text-[var(--nr-p3)]'
              }`}
            >
              {m.label}
            </a>
          </li>
        ))}
      </ul>
      </div>
    </nav>
  </header>
);

/** 위치 표시 — 누리집처럼 본문 칸 맨 위(연한 띠 안)에 집 아이콘 경로. 오른쪽에 주소 복사 */
export const Breadcrumb: React.FC<{ trail: { label: string; href?: string }[] }> = ({ trail }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 복사 권한이 없으면 조용히 넘어감 */
    }
  };
  return (
    <div className="h-12 lg:h-[60px] flex items-center gap-2 text-[13px] text-slate-600 jbe-noprint">
      <a href="/" aria-label="처음으로" className="text-slate-600 hover:text-[var(--nr-p3)]">
        <Home className="w-4 h-4" aria-hidden="true" />
      </a>
      {trail.map((t, i) => (
        <span key={i} className={`${i === trail.length - 1 ? 'flex min-w-0' : 'hidden sm:flex shrink-0'} items-center gap-2`}>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          {t.href ? (
            <a href={t.href} className="shrink-0 whitespace-nowrap hover:text-[var(--nr-p3)]">
              {t.label}
            </a>
          ) : (
            <span className={`font-bold text-slate-800 ${i === trail.length - 1 ? 'min-w-0 truncate' : 'shrink-0 whitespace-nowrap'}`}>{t.label}</span>
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={copy}
        className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--nr-p2)] px-3 py-1.5 text-[12px] font-bold text-white hover:opacity-90"
      >
        {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Link2 className="w-3.5 h-3.5" aria-hidden="true" />}
        {copied ? '복사됨' : '주소 복사'}
      </button>
    </div>
  );
};

/**
 * 하위 화면 틀 — 누리집 sub_container 기준
 *  · 1023px~ : 위 100px 연한 띠(#eff8fe), 좌우 20px, 왼쪽 메뉴 200px + 간격 40px
 *  · 1200px~ : 본문 최대 1200px 가운데, 왼쪽 메뉴 280px + 간격 60px
 *  · 1600px~ : 본문 최대 1620px
 */
export const SubLayout: React.FC<{ lnb: React.ReactNode; trail: { label: string; href?: string }[]; children: React.ReactNode }> = ({
  lnb,
  trail,
  children,
}) => (
  <div className="relative flex-1">
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-12 lg:h-[100px] bg-[var(--nr-band)]" />
    <div className={`relative ${BOX} lg:pt-10 flex gap-10 min-[1200px]:gap-[60px]`}>
      {lnb}
      <main id="container" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <Breadcrumb trail={trail} />
        <div className="pt-6 lg:pt-8">{children}</div>
      </main>
    </div>
  </div>
);

export interface LnbSub {
  label: string;
  href: string;
  on: boolean;
  count?: number;
}

/** 왼쪽 메뉴 — 누리집과 같은 파란 제목 카드 + 남색 활성 항목 + 연한 바탕 하위 목록 */
export const Lnb: React.FC<{ active: MenuKey; subs?: Partial<Record<MenuKey, LnbSub[]>> }> = ({ active, subs }) => (
  <aside className="hidden lg:block w-[200px] min-[1200px]:w-[280px] shrink-0 jbe-noprint" aria-label="메뉴">
    <h2 className="nr-title flex items-center justify-center h-[130px] rounded-[10px_10px_40px_10px] bg-[var(--nr-p1)] text-[22px] min-[1200px]:text-[28px] text-white shadow-[0_0_10px_rgba(35,88,195,0.1)]">
      업무경감 도구 모음
    </h2>
    <ul className="mt-5 space-y-2">
      {MENU.map((m) => {
        const on = active === m.key;
        const sub = subs?.[m.key];
        return (
          <li key={m.key}>
            <a
              href={m.href}
              aria-current={on ? 'page' : undefined}
              className={`flex items-center justify-between rounded-[10px] px-5 py-[18px] text-[18px] transition-colors ${
                on
                  ? 'bg-[var(--nr-p2)] text-white font-semibold'
                  : 'bg-white text-[var(--nr-text)] shadow-[0_0_0_1px_#eef0f4,0_2px_6px_rgba(0,0,0,0.04)] hover:text-[var(--nr-p3)]'
              }`}
            >
              {m.label}
              <ChevronRight className="w-4 h-4 opacity-70" aria-hidden="true" />
            </a>
            {on && sub && sub.length > 0 && (
              <ul className="mt-1 rounded-[10px] bg-[var(--nr-bg)] px-4 py-3 space-y-1.5">
                {sub.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      className={`flex items-center gap-1.5 text-[15px] ${
                        s.on ? 'font-bold text-[var(--nr-p2)] underline underline-offset-4' : 'text-slate-700 hover:text-[var(--nr-p3)]'
                      }`}
                    >
                      <span aria-hidden="true">•</span>
                      {s.label}
                      {s.count !== undefined && <span className="ml-auto tabular-nums text-[13px] text-slate-500">{s.count}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
    {/* 게시판 바로가기 — 왼쪽 메뉴와 같은 크기의 큰 버튼. 글쓰기는 위 '도구 등록' 메뉴에서 */}
    <nav aria-label="게시판 바로가기" className="mt-6">
      <p className="mb-2 px-1 text-[15px] font-bold text-slate-600">게시판 바로가기</p>
      <ul className="space-y-2">
        {[
          { href: BOARD_URL, label: '교직원 제작 도구 게시판', note: '원글·첨부파일·댓글' },
          { href: OFFICIAL_BOARD_URL, label: '교육청 배포 도구 게시판', note: '교육청이 배포한 업무도구' },
        ].map((b) => (
          <li key={b.href}>
            <a
              href={b.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-3 rounded-[10px] bg-white px-5 py-4 shadow-[0_0_0_1px_#eef0f4,0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_1px_var(--nr-p3)]"
            >
              <span className="min-w-0">
                <span className="block text-[17px] font-bold text-[var(--nr-text)] group-hover:text-[var(--nr-p3)]">{b.label}</span>
                <span className="mt-0.5 block text-[13px] text-slate-500">{b.note}</span>
              </span>
              <ArrowUpRight className="w-5 h-5 shrink-0 text-[var(--nr-p1)]" aria-hidden="true" />
              <span className="sr-only">(새 창)</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  </aside>
);

/** 본문 제목 — 누리집과 같은 큰 제목 + 아래 가는 줄 */
export const PageTitle: React.FC<{ children: React.ReactNode; desc?: React.ReactNode; right?: React.ReactNode }> = ({
  children,
  desc,
  right,
}) => (
  <div className="border-b border-[var(--nr-line)] pb-5 lg:pt-2">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="nr-title text-[28px] sm:text-[36px] leading-tight text-black">{children}</h1>
      {right}
    </div>
    {desc && <p className="mt-2 text-[15px] text-slate-600">{desc}</p>}
  </div>
);

/** 분류 탭 — 누리집 게시판 위 탭과 같은 모양(연한 상자 안 흰 칸, 활성은 진파랑) */
export function TabBox<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="rounded-[10px] bg-[var(--nr-bg)] p-3 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {items.map((it) => {
          const on = it.value === value;
          return (
            <button
              key={it.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(it.value)}
              className={`flex items-center justify-between rounded-[10px] px-4 sm:px-5 h-[46px] sm:h-[50px] text-[15px] sm:text-base transition-colors ${
                on ? 'bg-[var(--nr-p3)] text-white font-bold' : 'bg-white text-black hover:text-[var(--nr-p3)]'
              }`}
            >
              {it.label}
              {it.count !== undefined && (
                <span className={`tabular-nums text-[13px] ${on ? 'text-white/80' : 'text-slate-500'}`}>{it.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 쪽 번호 — 누리집과 같은 둥근 남색 활성 */
export const Pager: React.FC<{ page: number; pages: number; onPage: (p: number) => void }> = ({ page, pages, onPage }) =>
  pages <= 1 ? null : (
    <nav aria-label="쪽 이동" className="mt-6 flex flex-wrap justify-center gap-1.5">
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
          className={`w-10 h-10 rounded-[15px] tabular-nums text-base ${
            p === page ? 'bg-[var(--nr-p2)] text-white font-bold' : 'text-slate-700 hover:bg-[var(--nr-bg)]'
          }`}
        >
          {p}
        </button>
      ))}
    </nav>
  );

/** 바닥글 — 누리집 하단처럼 연회색 바탕, 담당 부서 표기 */
export const SiteFooter: React.FC = () => (
  <footer className="mt-16 bg-[#f7f8fa] border-t border-[var(--nr-line)] jbe-noprint">
    <div className={`${BOX} py-8 text-[14px] text-slate-600 space-y-2`}>
      <p className="nr-title text-[18px] text-[#002f63]">업무경감 도구 모음</p>
      <p>데이터 도구실 「교직원 제작 도구」·「교육청 배포 도구」 게시판의 업무도구를 한곳에 모아 매시간 갱신하는 화면</p>
      <p>
        <b className="text-slate-800">담당</b> 정책기획과 빅데이터담당 · <b className="text-slate-800">전화</b> 063-239-3176
      </p>
      <p className="pt-3 border-t border-[var(--nr-line)] text-[13px] text-slate-500">
        자료 출처 —{' '}
        <a href={BOARD_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--nr-p3)]">
          전북특별자치도교육청 누리집 교직원 제작 도구 게시판
        </a>
        ,{' '}
        <a href={OFFICIAL_BOARD_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--nr-p3)]">
          교육청 배포 도구 게시판
        </a>
      </p>
    </div>
  </footer>
);
