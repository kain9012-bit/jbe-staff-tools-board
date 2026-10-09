import { useEffect, useState } from 'react';
import type { Route } from '../types';

/**
 * 해시 주소
 *  #/            도구 찾기(?q=검색어&src=출처&p=사용목적&sort=정렬&from=&to=)
 *  #/tools       예전 주소 — 도구 찾기와 같음
 *  #/tool/<번호> #/makers #/maker/<작성자> #/register #/about
 *  #/official    제작자 현황 > 교육청 배포 도구
 */
export function parseHash(h: string): Route {
  const [path, query = ''] = h.replace(/^#\/?/, '').split('?');
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
  if (p === 'tool' && arg) return { page: 'tool', sid: arg };
  if (p === 'maker' && arg) return { page: 'maker', name: decodeURIComponent(arg) };
  return { page: 'home', ...opt };
}

/** 도구 찾기·제작자 현황 주소 — 'tools'는 첫 화면(#/)으로 */
const base = (page: 'tools' | 'makers') => (page === 'tools' ? '#/' : '#/makers');

export const hrefTool = (sid: string) => `#/tool/${sid}`;
export const hrefSearch = (page: 'tools' | 'makers', q: string) =>
  `${base(page)}?q=${encodeURIComponent(q)}`;
export const hrefPurpose = (p: string) => (p ? `#/?p=${encodeURIComponent(p)}` : '#/');
/** 출처 게시판으로 거른 도구 찾기 — staff·official, 빈 값은 전체 */
export const hrefSource = (src: string) => (src ? `#/?src=${src}` : '#/');
/** 목록 탭을 정렬·기간을 정해서 열기 */
export const hrefList = (page: 'tools' | 'makers', sort: string, period?: { from: string; to: string; all: boolean }) => {
  const sp = new URLSearchParams({ sort });
  if (period) {
    sp.set('from', period.from);
    sp.set('to', period.to);
  }
  return `${base(page)}?${sp.toString()}`;
};
export const hrefMaker = (name: string) => `#/maker/${encodeURIComponent(name)}`;

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setR(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
