import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Route } from '../types';

/**
 * 주소 (검색 엔진이 도구마다 따로 읽을 수 있게 경로 방식)
 *  /             도구 찾기(?q=검색어&src=출처&p=사용목적&sort=정렬&from=&to=)
 *  /tools        예전 주소 — 도구 찾기와 같음
 *  /tool/<번호> /makers /maker/<작성자> /register /about
 *  /official     제작자 현황 > 교육청 배포 도구
 * 예전 해시 주소(#/tool/123)로 들어오면 경로 주소로 바꿔 줌
 */
export function parseLoc(pathname: string, search: string): Route {
  const path = pathname.replace(/^\/+|\/+$/g, '');
  const query = search.replace(/^\?/, '');
  const parts = path.split('/');
  const [p, arg] = [parts[0], parts.slice(1).join('/')];
  const sp = new URLSearchParams(query);
  const opt = {
    q: sp.get('q') || undefined,
    sort: sp.get('sort') || undefined,
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    p: sp.get('p') || undefined,
    src: sp.get('src') || undefined,
  };
  if (p === 'tools') return { page: 'tools', ...opt };
  if (p === 'makers') return { page: 'makers', q: opt.q, sort: opt.sort, from: opt.from, to: opt.to };
  if (p === 'register') return { page: 'register' };
  if (p === 'about') return { page: 'about' };
  if (p === 'official') return { page: 'official' };
  if (p === 'requests') return { page: 'requests' };
  if (p === 'review') return { page: 'review' };
  if (p === 'poc') return { page: 'poc' };
  if (p === 'tool' && arg) return { page: 'tool', sid: arg };
  if (p === 'maker' && arg) return { page: 'maker', name: decodeURIComponent(arg) };
  return { page: 'home', ...opt };
}

/** 도구 찾기·제작자 현황 주소 — 'tools'는 첫 화면(#/)으로 */
const base = (page: 'tools' | 'makers') => (page === 'tools' ? '/' : '/makers');

export const hrefTool = (sid: string) => `/tool/${sid}`;
export const hrefSearch = (page: 'tools' | 'makers', q: string) =>
  `${base(page)}?q=${encodeURIComponent(q)}`;
export const hrefPurpose = (p: string) => (p ? `/?p=${encodeURIComponent(p)}` : '/');
/** 출처 게시판으로 거른 도구 찾기 — staff·official, 빈 값은 전체 */
export const hrefSource = (src: string) => (src ? `/?src=${src}` : '/');
/** 목록 탭을 정렬·기간을 정해서 열기 */
export const hrefList = (page: 'tools' | 'makers', sort: string, period?: { from: string; to: string; all: boolean }) => {
  const sp = new URLSearchParams({ sort });
  if (period) {
    sp.set('from', period.from);
    sp.set('to', period.to);
  }
  return `${base(page)}?${sp.toString()}`;
};
export const hrefMaker = (name: string) => `/maker/${encodeURIComponent(name)}`;

const EV = 'app:navigate';
const here = () => window.location.pathname + window.location.search;

/** 화면 안 이동 — 새로 불러오지 않고 주소만 바꿈 */
export function navigate(href: string, replace = false) {
  if (href === here()) return;
  if (replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(EV));
}

/** 예전 해시 주소(#/tool/123?q=…) → 경로 주소 */
function upgradeHash() {
  const h = window.location.hash;
  if (h.startsWith('#/')) window.history.replaceState(null, '', h.slice(1) || '/');
}

/** 같은 사이트 안 링크(/로 시작)는 새로 불러오지 않고 화면만 바꿈 */
function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || a.target || a.hasAttribute('download')) return;
  const href = a.getAttribute('href') || '';
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/')) return;
  e.preventDefault();
  navigate(href);
}

/** 화면 키 — 주소가 바뀌면 검색 화면을 새로 그릴 때 씀 */
export const locKey = () => here();

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => {
    upgradeHash();
    return parseLoc(window.location.pathname, window.location.search);
  });
  useEffect(() => {
    const on = () => {
      upgradeHash();
      setR(parseLoc(window.location.pathname, window.location.search));
    };
    window.addEventListener(EV, on);
    window.addEventListener('popstate', on);
    // 예전 해시 주소만 처리 — '#container' 같은 본문 바로가기는 그대로 둠
    const onHash = () => window.location.hash.startsWith('#/') && on();
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener(EV, on);
      window.removeEventListener('popstate', on);
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('click', onClick);
    };
  }, []);
  // 새 화면을 그린 직후, 화면에 보이기 전에 맨 위로 올림.
  // 주소를 바꾸자마자 올리면 이전 화면 꼭대기(남색 검색 상자)가 한 순간 보여 번쩍임
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [r]);
  return r;
}
