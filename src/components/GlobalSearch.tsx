import React, { useId, useMemo, useRef, useState } from 'react';
import { Search, UserRound, Wrench } from 'lucide-react';
import { hrefMaker, hrefSearch, hrefTool } from '../lib/route';
import { matcher } from '../lib/search';
import { n, type Model } from '../lib/stats';

const MAX = 6;

/**
 * 첫 화면 통합 검색 — 입력하는 대로 도구·제작자를 함께 보여 줌.
 * 위·아래 화살표로 고르고 Enter로 이동, 고르지 않고 Enter면 도구 탭 검색 결과로.
 */
export const GlobalSearch: React.FC<{ m: Model }> = ({ m }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;

  const { tools, makers, toolTotal } = useMemo(() => {
    if (!q.trim()) return { tools: [], makers: [], toolTotal: 0 };
    const hit = matcher(q);
    const ts = m.tools.filter((t) => hit(t.title, t.author, t.purpose)).sort((a, b) => b.views - a.views);
    const ms = m.makers.filter((mk) => hit(mk.name));
    return { tools: ts.slice(0, MAX), makers: ms.slice(0, 4), toolTotal: ts.length };
  }, [m, q]);

  const items = [
    ...makers.map((mk) => ({ href: hrefMaker(mk.name), key: `m${mk.name}` })),
    ...tools.map((t) => ({ href: hrefTool(t.sid), key: `t${t.sid}` })),
  ];
  const go = (href: string) => {
    window.location.hash = href.slice(1);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setCur((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCur((c) => Math.max(c - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cur >= 0 && items[cur]) go(items[cur].href);
      else if (q.trim()) go(hrefSearch('tools', q.trim()));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const show = open && q.trim() !== '';
  let i = -1;

  return (
    <div
      ref={box}
      className="relative max-w-2xl"
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <label className="flex items-center gap-2 rounded-xl border-2 border-blue-600 bg-white px-4 py-3 shadow-sm focus-within:ring-4 focus-within:ring-blue-200">
        <Search className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
        <span className="sr-only">도구·제작자 검색</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-activedescendant={cur >= 0 && items[cur] ? `${listId}-${items[cur].key}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setCur(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={narrow ? '도구명 · 제작자 · 학교명' : '도구명 · 제작자 · 학교명으로 찾기 (예: 에듀파인, 교복)'}
          className="flex-1 min-w-0 text-base bg-transparent"
          style={{ outline: 'none' }} /* 바깥 상자가 포커스 테두리를 대신함 */
        />
      </label>

      {show && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-2 max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {!items.length && <p className="px-4 py-4 text-sm text-slate-500">'{q.trim()}'에 맞는 도구·제작자 없음</p>}

          {makers.length > 0 && (
            <div className="px-4 pt-3 pb-1 text-xs font-bold text-slate-500">제작자</div>
          )}
          {makers.map((mk) => {
            i++;
            const k = `m${mk.name}`;
            return (
              <a
                key={k}
                id={`${listId}-${k}`}
                role="option"
                aria-selected={cur === i}
                href={hrefMaker(mk.name)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2 ${cur === i ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
              >
                <UserRound className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  <b className="text-slate-900">{mk.person}</b> <span className="text-sm text-slate-500">{mk.org}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">도구 {mk.tools.length}개</span>
              </a>
            );
          })}

          {tools.length > 0 && (
            <div className="px-4 pt-3 pb-1 text-xs font-bold text-slate-500">도구</div>
          )}
          {tools.map((t) => {
            i++;
            const k = `t${t.sid}`;
            return (
              <a
                key={k}
                id={`${listId}-${k}`}
                role="option"
                aria-selected={cur === i}
                href={hrefTool(t.sid)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2 ${cur === i ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
              >
                <Wrench className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900">{t.title}</span>
                  <span className="block truncate text-xs text-slate-500">{t.author}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{n(t.views)}회</span>
              </a>
            );
          })}

          {toolTotal > MAX && (
            <a
              href={hrefSearch('tools', q.trim())}
              onClick={() => setOpen(false)}
              className="block border-t border-slate-200 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50"
            >
              도구 {toolTotal}개 모두 보기 →
            </a>
          )}
        </div>
      )}
    </div>
  );
};
