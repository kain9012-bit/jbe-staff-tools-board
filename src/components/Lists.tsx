import React from 'react';
import { ArrowUpRight, CornerDownRight, Eye, MessageCircle, TrendingUp } from 'lucide-react';
import { hrefMaker, hrefTool } from '../lib/route';
import { addDays, n, shortDay, splitAuthor, type ToolStat } from '../lib/stats';
import { showsAuthor, type Comment } from '../types';
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
      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--nr-bg)] focus-visible:bg-[var(--nr-bg)]"
    >
      <span
        className={`w-7 shrink-0 text-center tabular-nums font-extrabold ${
          rank <= 3 ? 'text-[var(--nr-p3)] text-lg' : 'text-slate-400 text-sm'
        }`}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-bold leading-snug text-slate-900 group-hover:text-[var(--nr-p3)] line-clamp-2 sm:line-clamp-1">{title}</span>
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

export const isNewTool = (t: ToolStat, today: string) => t.created >= addDays(today, -13);

/** 도구 카드 — 누리집 틀(연한 테두리·둥근 10px). 카드 전체는 상세로, 아래 단추는 게시판 원글로 */
/** 출처 표시 — 교직원 제작은 하늘색, 교육청 배포는 남색, 외부 공공은 초록. 한눈에 구분되게 */
const SOURCE_STYLE: Record<string, [string, string]> = {
  official: ['교육청 배포', 'bg-[#2f3a73] text-white'],
  external: ['외부 공공', 'bg-[#e3f5ee] text-[#0b6b52] ring-1 ring-inset ring-[#a8dcc8]'],
  staff: ['교직원 제작', 'bg-[#dcefff] text-[#0a62a8] ring-1 ring-inset ring-[#a9d3f5]'],
};
export const SourceTag: React.FC<{ board?: string; className?: string }> = ({ board, className = '' }) => {
  const [label, cls] = SOURCE_STYLE[board ?? 'staff'] ?? SOURCE_STYLE.staff;
  return <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[12px] font-bold ${cls} ${className}`}>{label}</span>;
};

export const ToolCard: React.FC<{
  t: ToolStat;
  today: string;
  showAuthor?: boolean;
  /** 기간 정렬로 열었을 때 맨 앞에 보이는 기간 지표 */
  extra?: { label: string; value: string };
}> = ({ t, today, showAuthor = true, extra }) => {
  const { org, person } = splitAuthor(t.author);
  return (
    <div className="group relative flex flex-col rounded-[10px] border border-[var(--nr-line)] bg-white p-5 transition hover:border-[var(--nr-p3)] hover:shadow-[0_4px_16px_rgba(28,100,172,0.12)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <SourceTag board={t.board} />
        <span className="rounded-md bg-[#f1f3f6] px-2 py-0.5 text-[12px] font-bold text-slate-700">{t.purpose || '분류 없음'}</span>
        {isNewTool(t, today) && <span className="rounded-md bg-[#d61e49] px-2 py-0.5 text-[12px] font-bold text-white">NEW</span>}
        <span className="ml-auto text-[12px] tabular-nums text-slate-500">{shortDay(t.created)}</span>
      </div>
      <h3 className="mt-2.5 min-h-[3rem] text-[17px] font-bold leading-snug text-black line-clamp-2">
        <a href={hrefTool(t.sid)} className="after:absolute after:inset-0 group-hover:text-[var(--nr-p3)]">
          {t.title}
        </a>
      </h3>
      <p className="mt-1.5 text-[13px] text-slate-500">적용기관 {t.target || '미기재'}</p>
      {showAuthor && (
        <p className="mt-3 flex items-baseline gap-1.5 border-t border-slate-100 pt-3 min-w-0 text-[14px]">
          {t.board === 'external' ? (
            <>
              <b className="shrink-0 text-slate-900">외부 기관 제작</b>
              <span className="truncate text-[12px] text-slate-500">{t.kind}</span>
            </>
          ) : (
            <>
              <b className="shrink-0 text-slate-900">{person}</b>
              <span className="truncate text-[12px] text-slate-500">{org}</span>
            </>
          )}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {extra ? (
          <span className="inline-flex items-center rounded-full bg-[var(--nr-p3)] px-2.5 py-1 text-[12px] font-bold tabular-nums text-white">
            {extra.label} {extra.value}
          </span>
        ) : (
          t.recent30 > 0 && (
            <Pill icon={<TrendingUp className="w-3.5 h-3.5 text-[var(--nr-p3)]" aria-hidden="true" />} label="최근 30일 조회">
              +{n(t.recent30)}
            </Pill>
          )
        )}
        {showsAuthor(t.board) && (
          <Pill icon={<MessageCircle className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />} label="댓글">
            {n(t.comments)}
          </Pill>
        )}
        <Pill icon={<Eye className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />} label="누적 조회">
          {n(t.views)}
        </Pill>
        <a
          href={t.url}
          target="_blank"
          rel="noreferrer"
          className="relative z-10 ml-auto inline-flex items-center gap-0.5 rounded-md bg-[var(--nr-p1)] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[var(--nr-p3)]"
        >
          사용하기 <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only">(게시판 원글, 새 창)</span>
        </a>
      </div>
    </div>
  );
};

/** 목록형 — 누리집 게시판 표와 같은 모양(윗선 진회색, 머리 연파랑, 가운데 정렬) */
export const ToolTable: React.FC<{
  rows: ToolStat[];
  today: string;
  startNo: number;
  extra?: (t: ToolStat) => { label: string; value: string } | undefined;
  /** 댓글을 모으지 않는 목록(교육청 배포 도구)에서 댓글 칸 숨김 */
  noComments?: boolean;
}> = ({ rows, today, startNo, extra, noComments }) => (
  <>
  {/* 모바일 — 표 대신 한 줄 목록 */}
  <ol className="md:hidden border-t-2 border-[var(--nr-dark)]">
    {rows.map((t, i) => {
      const ex = extra?.(t);
      return (
        <li key={t.sid} className="border-b border-[var(--nr-line)]">
          <a href={hrefTool(t.sid)} className="flex items-center gap-3 px-1 py-3 active:bg-[#fafcff]">
            <span className="w-7 shrink-0 text-center tabular-nums text-[15px] text-slate-500">{startNo + i}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-snug text-black line-clamp-2">
                {isNewTool(t, today) && (
                  <span className="mr-1.5 rounded bg-[#d61e49] px-1.5 py-px text-[11px] font-bold text-white align-[2px]">NEW</span>
                )}
                {t.title}
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                <SourceTag board={t.board} className="mr-1.5 align-[1px] !px-1.5 !py-0 !text-[11px]" />
                <span className="text-[var(--nr-p3)]">{t.purpose}</span>
                {showsAuthor(t.board) && <> · {t.author}</>}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block tabular-nums font-bold text-[var(--nr-p3)]">{ex ? ex.value : `+${n(t.recent30)}`}</span>
              <span className="block tabular-nums text-[12px] text-slate-500">누적 {n(t.views)}</span>
            </span>
          </a>
        </li>
      );
    })}
  </ol>
  <div className="hidden md:block overflow-x-auto">
    <table className="w-full min-w-[720px] table-fixed border-t-2 border-[var(--nr-dark)] text-[15px]">
      <caption className="sr-only">도구 목록</caption>
      <thead className="bg-[var(--nr-bg)]">
        <tr className="border-b border-[var(--nr-line)]">
          <th scope="col" className="w-12 py-3.5 font-bold">번호</th>
          <th scope="col" className="py-3.5 font-bold">도구명</th>
          <th scope="col" className="w-[88px] py-3.5 font-bold">적용기관</th>
          <th scope="col" className="w-[84px] py-3.5 font-bold">{extra ? '기간' : '최근 30일'}</th>
          <th scope="col" className="w-16 py-3.5 font-bold">누적</th>
          {!noComments && <th scope="col" className="w-12 py-3.5 font-bold">댓글</th>}
          <th scope="col" className="w-[78px] py-3.5 font-bold">게시일</th>
          <th scope="col" className="w-[92px] py-3.5 font-bold"><span className="sr-only">바로가기</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t, i) => {
          const ex = extra?.(t);
          return (
            <tr key={t.sid} className="border-b border-[var(--nr-line)] text-center hover:bg-[#fafcff]">
              <td className="py-3.5 tabular-nums text-slate-600">{startNo + i}</td>
              <td className="py-3 px-3 text-left">
                <a href={hrefTool(t.sid)} title={t.title} className="font-bold leading-snug text-black line-clamp-2 hover:text-[var(--nr-p3)] hover:underline underline-offset-2">
                  {isNewTool(t, today) && (
                    <span className="mr-1.5 rounded bg-[#d61e49] px-1.5 py-px text-[11px] font-bold text-white align-[2px] no-underline">NEW</span>
                  )}
                  {t.title}
                </a>
                <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                  <SourceTag board={t.board} className="mr-1.5 align-[1px] !px-1.5 !py-0 !text-[11px]" />
                  <span className="text-[var(--nr-p3)]">{t.purpose}</span>
                  {showsAuthor(t.board) && <> · {t.author}</>}
                </span>
              </td>
              <td className="py-3.5 text-[14px] text-slate-600">{t.target}</td>
              <td className="py-3.5 tabular-nums font-bold text-[var(--nr-p3)]">{ex ? ex.value : `+${n(t.recent30)}`}</td>
              <td className="py-3.5 tabular-nums">{n(t.views)}</td>
              {!noComments && <td className="py-3.5 tabular-nums">{showsAuthor(t.board) ? n(t.comments) : '–'}</td>}
              <td className="py-3.5 tabular-nums text-[14px] text-slate-600">{t.created.slice(2).replace(/-/g, '.')}</td>
              <td className="py-3.5">
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 rounded-md bg-[var(--nr-p1)] px-2.5 py-1.5 text-[13px] font-bold text-white hover:bg-[var(--nr-p3)]"
                >
                  사용하기 <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="sr-only">(새 창)</span>
                </a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  </>
);

/** 댓글 한 건 */
export const CommentItem: React.FC<{
  c: Comment;
  tool?: ToolStat;
  needsReply?: boolean;
}> = ({ c, tool, needsReply }) => (
  <li className={`px-4 py-3 ${c.maker ? 'bg-slate-50' : ''}`}>
    {tool && (
      <a href={hrefTool(tool.sid)} className="block truncate text-xs font-bold text-[var(--nr-p3)] hover:underline">
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
      <a href={t.url} target="_blank" rel="noreferrer" className="font-bold text-[var(--nr-p3)] underline underline-offset-2">
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
    className="group inline-flex w-full sm:w-auto items-center justify-between gap-4 rounded-xl bg-[var(--nr-p1)] px-6 py-3.5 text-white shadow-md shadow-[rgba(28,100,172,0.2)] transition hover:bg-[var(--nr-p3)] hover:shadow-lg"
  >
    <span className="text-left">
      <span className="block text-lg font-extrabold leading-tight">이 도구 사용하러 가기</span>
      <span className="block text-xs text-white/80">게시판 원글에서 내려받기 · 사용방법 확인</span>
    </span>
    <ArrowUpRight className="w-6 h-6 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
    <span className="sr-only">(새 창)</span>
  </a>
);

export const MakerLink: React.FC<{ name: string }> = ({ name }) => (
  <a href={hrefMaker(name)} className="font-bold text-[var(--nr-p3)] hover:underline underline-offset-2">
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
