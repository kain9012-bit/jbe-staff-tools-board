import React from 'react';
import { ArrowUpRight, CornerDownRight, Eye, MessageCircle, TrendingUp } from 'lucide-react';
import { hrefMaker, hrefTool } from '../lib/route';
import { addDays, n, shortDay, splitAuthor, type ToolStat } from '../lib/stats';
import type { Comment } from '../types';
import { Badge } from './Ui';

/** 순위 한 줄 — 1~3위만 강조 */
export const RankRow: React.FC<{
  rank: number;
  href: string;
  title: string;
  sub?: React.ReactNode;
  value: string;
  valueSub?: string;
}> = ({ rank, href, title, sub, value, valueSub }) => (
  <li>
    <a
      href={href}
      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 focus-visible:bg-blue-50"
    >
      <span
        className={`w-7 shrink-0 text-center tabular-nums font-extrabold ${
          rank <= 3 ? 'text-blue-700 text-lg' : 'text-slate-400 text-sm'
        }`}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-slate-900 group-hover:text-blue-700">{title}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block tabular-nums font-bold text-slate-900">{value}</span>
        {valueSub && <span className="block tabular-nums text-xs text-slate-500">{valueSub}</span>}
      </span>
    </a>
  </li>
);

const Pill: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
    {icon}
    <span className="sr-only">{label}</span>
    {children}
  </span>
);

/** 도구 카드 — 분류·NEW / 제목(게시판 그대로) / 적용기관 / 제작자 / 게시일·지표 */
export const ToolCard: React.FC<{ t: ToolStat; today: string; showAuthor?: boolean }> = ({ t, today, showAuthor = true }) => {
  const isNew = t.created >= addDays(today, -13);
  const { org, person } = splitAuthor(t.author);
  return (
    <a
      href={hrefTool(t.sid)}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 p-5 transition hover:border-blue-600 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{t.purpose || '분류 없음'}</Badge>
        {isNew && <Badge tone="red">NEW</Badge>}
      </div>
      <h3 className="mt-2.5 min-h-[3rem] text-[1.0625rem] font-extrabold leading-snug text-slate-900 line-clamp-2 group-hover:text-blue-700">
        {t.title}
      </h3>
      <p className="mt-2 text-xs text-slate-500">적용기관: {t.target || '미기재'}</p>

      <div className="mt-auto pt-4">
        {showAuthor && (
          <div className="flex items-baseline gap-2 border-t border-slate-100 pt-3 min-w-0">
            <b className="shrink-0 text-sm text-slate-900">{person}</b>
            <span className="truncate text-xs text-slate-500">{org}</span>
          </div>
        )}
        <div className={`flex flex-wrap items-center gap-1.5 ${showAuthor ? 'mt-3' : 'border-t border-slate-100 pt-3'}`}>
          <span className="mr-auto text-xs tabular-nums text-slate-500">{shortDay(t.created)} 게시</span>
          {t.recent7 > 0 && (
            <Pill icon={<TrendingUp className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />} label="최근 7일 조회">
              +{n(t.recent7)}
            </Pill>
          )}
          <Pill icon={<MessageCircle className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />} label="댓글">
            {n(t.comments)}
          </Pill>
          <Pill icon={<Eye className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />} label="누적 조회">
            {n(t.views)}
          </Pill>
        </div>
      </div>
    </a>
  );
};

/** 댓글 한 건 */
export const CommentItem: React.FC<{
  c: Comment;
  tool?: ToolStat;
  needsReply?: boolean;
}> = ({ c, tool, needsReply }) => (
  <li className={`px-4 py-3 ${c.maker ? 'bg-slate-50' : ''}`}>
    {tool && (
      <a href={hrefTool(tool.sid)} className="block truncate text-xs font-bold text-blue-700 hover:underline">
        {tool.title}
      </a>
    )}
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
      {c.maker && <CornerDownRight className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      <b className="text-slate-900">{c.writer}</b>
      {c.maker && <Badge tone="green">제작자 답글</Badge>}
      {needsReply && <Badge tone="amber">답글 없음</Badge>}
      <span className="text-xs tabular-nums text-slate-500">{shortDay(c.date)}</span>
    </div>
    {c.content ? (
      <p className="mt-1 whitespace-pre-line text-slate-700">{c.content}</p>
    ) : (
      <p className="mt-1 text-sm text-slate-400">(내용 없는 댓글)</p>
    )}
  </li>
);

/** 댓글 목록 아래 안내 — 게시판 1쪽 밖 댓글 */
export const CommentGap: React.FC<{ t: ToolStat; withTitle?: boolean }> = ({ t, withTitle }) =>
  t.comments > t.collected ? (
    <p className="px-4 py-3 text-sm text-slate-500 border-t border-slate-100">
      {withTitle && <b className="text-slate-700">{t.title} — </b>}
      이전 댓글 {n(t.comments - t.collected)}개는{' '}
      <a href={t.url} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline underline-offset-2">
        게시판에서 확인
      </a>
      <span className="text-xs"> (로그인해야 보이는 2쪽 이후 댓글)</span>
    </p>
  ) : null;

/** 도구 상세의 주 단추 — 게시판 원글로 가서 내려받기·사용 */
export const UseToolLink: React.FC<{ url: string }> = ({ url }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="group inline-flex w-full sm:w-auto items-center justify-between gap-4 rounded-xl bg-blue-600 px-6 py-3.5 text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-lg"
  >
    <span className="text-left">
      <span className="block text-lg font-extrabold leading-tight">이 도구 사용하러 가기</span>
      <span className="block text-xs text-blue-100">게시판 원글에서 내려받기 · 사용방법 확인</span>
    </span>
    <ArrowUpRight className="w-6 h-6 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
    <span className="sr-only">(새 창)</span>
  </a>
);

export const MakerLink: React.FC<{ name: string }> = ({ name }) => (
  <a href={hrefMaker(name)} className="font-bold text-blue-700 hover:underline underline-offset-2">
    {name}
  </a>
);

export const CommentCount: React.FC<{ v: number }> = ({ v }) => (
  <span className="inline-flex items-center gap-1 tabular-nums">
    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
    {n(v)}
  </span>
);

/**
 * 도구별로, 제작자의 마지막 답글보다 뒤에 달린 사용자 댓글을 '답글 없음'으로 표시.
 * 같은 날짜면 commentSid가 큰 쪽이 나중.
 */
export function unansweredIds(comments: Comment[]): Set<string> {
  const lastMaker = new Map<string, string>();
  const key = (c: Comment) => `${c.date}|${c.cid.padStart(10, '0')}`;
  for (const c of comments) {
    if (!c.maker) continue;
    const k = key(c);
    if ((lastMaker.get(c.sid) ?? '') < k) lastMaker.set(c.sid, k);
  }
  const out = new Set<string>();
  for (const c of comments) {
    if (!c.maker && key(c) > (lastMaker.get(c.sid) ?? '')) out.add(c.cid);
  }
  return out;
}
