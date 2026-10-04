import { useEffect, useState } from 'react';
import type { Route } from '../types';

/** 해시 주소: #/tools, #/tool/1183666, #/makers, #/maker/<작성자>, #/about */
export function parseHash(h: string): Route {
  const [path, query = ''] = h.replace(/^#\/?/, '').split('?');
  const parts = path.split('/');
  const [p, arg] = [parts[0], parts.slice(1).join('/')];
  const q = new URLSearchParams(query).get('q') || undefined;
  if (p === 'tools') return { page: 'tools', q };
  if (p === 'makers') return { page: 'makers', q };
  if (p === 'about') return { page: 'about' };
  if (p === 'tool' && arg) return { page: 'tool', sid: arg };
  if (p === 'maker' && arg) return { page: 'maker', name: decodeURIComponent(arg) };
  return { page: 'home' };
}

export const hrefTool = (sid: string) => `#/tool/${sid}`;
export const hrefSearch = (page: 'tools' | 'makers', q: string) =>
  `#/${page}?q=${encodeURIComponent(q)}`;
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
