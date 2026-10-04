import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState, SectionTitle, Segmented } from '../components/Ui';
import { hrefMaker } from '../lib/route';
import { matcher } from '../lib/search';
import { n, shortDay, type MakerStat, type Model } from '../lib/stats';

type SortKey = 'views' | 'recent7' | 'comments' | 'tools';

const val = (mk: MakerStat, k: SortKey) => (k === 'tools' ? mk.tools.length : mk[k]);

export const Makers: React.FC<{ m: Model; initialQ?: string }> = ({ m, initialQ }) => {
  const [q, setQ] = useState(initialQ ?? '');
  const [sort, setSort] = useState<SortKey>('views');
  const hit = matcher(q);
  const shown = m.makers
    .filter((mk) => hit(mk.name, ...mk.tools.map((t) => t.title)))
    .sort((a, b) => val(b, sort) - val(a, sort) || b.views - a.views);

  return (
    <>
      <SectionTitle count={shown.length} desc="게시판 작성자 표기 기준 · 소속(이름)">
        제작자
      </SectionTitle>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 flex-1 min-w-[12rem] max-w-md rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus-within:border-blue-600">
          <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="sr-only">검색</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="이름 · 학교명 · 도구명 검색"
            className="flex-1 min-w-0 text-sm outline-none"
          />
        </label>
        <Segmented
          label="정렬"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'views', label: '누적' },
            { value: 'recent7', label: '최근 7일' },
            { value: 'comments', label: '댓글' },
            { value: 'tools', label: '도구 수' },
          ]}
        />
      </div>

      {shown.length ? (
        <>
        <ol className="mt-4 sm:hidden divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {shown.map((mk, i) => (
            <li key={mk.name}>
              <a href={hrefMaker(mk.name)} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50">
                <span className={`w-7 shrink-0 text-center tabular-nums font-extrabold ${i < 3 ? 'text-blue-700 text-lg' : 'text-slate-400 text-sm'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-900">{mk.person}</span>
                  <span className="block truncate text-xs text-slate-500">{mk.org} · 도구 {mk.tools.length}개</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block font-bold text-slate-900">{n(mk.views)}회</span>
                  <span className="block text-xs text-slate-500">7일 +{n(mk.recent7)} · 댓글 {n(mk.comments)}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
        <div className="mt-4 hidden sm:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-bold w-12">순위</th>
                <th className="px-4 py-2.5 text-left font-bold">제작자</th>
                <th className="px-3 py-2.5 text-right font-bold">도구</th>
                <th className="px-3 py-2.5 text-right font-bold">누적 조회수</th>
                <th className="px-3 py-2.5 text-right font-bold">최근 7일</th>
                <th className="px-3 py-2.5 text-right font-bold">댓글</th>
                <th className="px-4 py-2.5 text-right font-bold">최근 게시</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((mk, i) => (
                <tr key={mk.name} className="border-t border-slate-100 hover:bg-blue-50">
                  <td className={`px-4 py-2.5 tabular-nums font-extrabold ${i < 3 ? 'text-blue-700' : 'text-slate-400'}`}>{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <a href={hrefMaker(mk.name)} className="font-bold text-slate-900 hover:text-blue-700 hover:underline underline-offset-2">
                      {mk.person}
                    </a>
                    <span className="block text-xs text-slate-500">{mk.org}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{mk.tools.length}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">{n(mk.views)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">+{n(mk.recent7)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(mk.comments)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{shortDay(mk.latest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState icon={<Search className="w-5 h-5" aria-hidden="true" />} title="조건에 맞는 제작자 없음" />
        </div>
      )}
    </>
  );
};
