import React from 'react';
import { ArrowUpRight, CornerDownRight, MessageCircle } from 'lucide-react';
import { hrefMaker, hrefTool } from '../lib/route';
import { n, shortDay, type ToolStat } from '../lib/stats';
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

/** 도구 목록용 카드 */
export const ToolCard: React.FC<{ t: ToolStat; showAuthor?: boolean }> = ({ t, showAuthor = true }) => (
  <a
    href={hrefTool(t.sid)}
    className="group block bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-600 transition-colors"
  >
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone="blue">{t.purpose || '분류 없음'}</Badge>
      <Badge>{t.target || '적용기관 미기재'}</Badge>
      <span className="ml-auto text-xs tabular-nums text-slate-500">{shortDay(t.created)} 게시</span>
    </div>
    <h3 className="mt-2 font-bold text-slate-900 leading-snug group-hover:text-blue-700 line-clamp-2">{t.title}</h3>
    {showAuthor && <p className="mt-1 text-sm text-slate-500 truncate">{t.author}</p>}
    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
      <div>
        <dt className="text-xs text-slate-500">누적</dt>
        <dd className="tabular-nums font-bold text-slate-900">{n(t.views)}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">최근 7일</dt>
        <dd className="tabular-nums font-bold text-slate-900">+{n(t.recent7)}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">댓글</dt>
        <dd className="tabular-nums font-bold text-slate-900">{n(t.comments)}</dd>
      </div>
    </dl>
  </a>
);

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

export const BoardLink: React.FC<{ url: string; children?: React.ReactNode }> = ({ url, children }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-bold text-white hover:bg-slate-800"
  >
    {children ?? '게시글 열기'}
    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
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
