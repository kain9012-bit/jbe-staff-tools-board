import React from 'react';
import { ArrowLeft, CalendarDays, Eye, MessageCircle, TrendingUp, UserRound, Wrench } from 'lucide-react';
import { CommentGap, CommentItem, unansweredIds } from '../components/Lists';
import { TrendChart } from '../components/TrendChart';
import { Badge, Card, EmptyState, Stat } from '../components/Ui';
import { hrefTool } from '../lib/route';
import { dayLabel, n, shortDay } from '../lib/stats';
import type { Model } from '../lib/stats';

export const MakerDetail: React.FC<{ m: Model; name: string }> = ({ m, name }) => {
  const idx = m.makers.findIndex((x) => x.name === name);
  const mk = m.makers[idx];
  if (!mk) {
    return <EmptyState icon={<UserRound className="w-5 h-5" aria-hidden="true" />} title="제작자를 찾지 못함" desc="게시판 작성자 표기가 바뀌었을 수 있습니다." />;
  }
  const sids = new Set(mk.tools.map((t) => t.sid));
  const comments = m.comments.filter((c) => sids.has(c.sid));
  const open = unansweredIds(comments);
  const toolBySid = new Map(mk.tools.map((t) => [t.sid, t]));
  const openCount = comments.filter((c) => open.has(c.cid)).length;

  return (
    <>
      <a href="#/makers" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-blue-700">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 제작자 목록
      </a>

      <div className="mt-3">
        <Badge tone="blue">누적 조회수 {idx + 1}위 / {m.makers.length}명</Badge>
        <h1 className="jbe-display mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{mk.person}</h1>
        <p className="mt-0.5 text-slate-600">{mk.org}</p>
      </div>

      <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Stat icon={<Wrench className="w-3.5 h-3.5" aria-hidden="true" />} label="만든 도구" value={mk.tools.length} desc={`최근 게시 ${shortDay(mk.latest)}`} />
        <Stat icon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />} label="누적 조회수" value={n(mk.views)} desc="도구 합계" />
        <Stat icon={<TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />} label="최근 7일" value={`+${n(mk.recent7)}`} desc="오늘 포함 7일" />
        <Stat icon={<CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />} label="이번 주" value={`+${n(mk.thisWeek)}`} desc={`${dayLabel(m.weekStart)}부터`} />
        <Stat
          icon={<MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />}
          label="댓글"
          value={n(mk.comments)}
          desc={!mk.comments ? '아직 댓글 없음' : openCount ? `답글 없는 댓글 ${openCount}개` : '모든 댓글에 답글 달림'}
          tone={openCount ? 'amber' : 'slate'}
        />
      </div>

      <section className="mt-6">
        <TrendChart model={m} daily={mk.daily} title="내 도구 전체 조회수 추이" desc="만든 도구 조회수 증가량 합계" from={mk.firstDate} />
      </section>

      <section className="mt-6">
        <h2 className="jbe-display text-xl font-extrabold text-slate-900">도구별 현황</h2>
        <ul className="mt-3 sm:hidden divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {mk.tools.map((t) => (
            <li key={t.sid}>
              <a href={hrefTool(t.sid)} className="block px-4 py-3 hover:bg-blue-50">
                <span className="block font-bold text-slate-900">{t.title}</span>
                <span className="mt-1 flex flex-wrap gap-x-3 text-sm tabular-nums text-slate-600">
                  <span>누적 <b className="text-slate-900">{n(t.views)}</b></span>
                  <span>7일 +{n(t.recent7)}</span>
                  <span>이번 주 +{n(t.thisWeek)}</span>
                  <span>댓글 {n(t.comments)}</span>
                </span>
                <span className="block text-xs text-slate-500">{shortDay(t.created)} 게시 · {t.purpose} · {t.target}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden sm:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-bold">도구</th>
                <th className="px-3 py-2.5 text-right font-bold">게시일</th>
                <th className="px-3 py-2.5 text-right font-bold">누적</th>
                <th className="px-3 py-2.5 text-right font-bold">최근 7일</th>
                <th className="px-3 py-2.5 text-right font-bold">이번 주</th>
                <th className="px-4 py-2.5 text-right font-bold">댓글</th>
              </tr>
            </thead>
            <tbody>
              {mk.tools.map((t) => (
                <tr key={t.sid} className="border-t border-slate-100 hover:bg-blue-50">
                  <td className="px-4 py-2.5">
                    <a href={hrefTool(t.sid)} className="font-bold text-slate-900 hover:text-blue-700 hover:underline underline-offset-2">
                      {t.title}
                    </a>
                    <span className="block text-xs text-slate-500">{t.purpose} · {t.target}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 whitespace-nowrap">{shortDay(t.created)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">{n(t.views)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">+{n(t.recent7)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">+{n(t.thisWeek)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{n(t.comments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="jbe-display text-xl font-extrabold text-slate-900">
          내 도구에 달린 댓글 <span className="jbe-count text-sm font-bold tabular-nums">{n(mk.comments)}개</span>
        </h2>
        <p className="text-xs text-slate-500">최신순 · 내 마지막 답글 뒤에 달린 댓글은 '답글 없음' 표시</p>
        <Card className="mt-3">
          {comments.length ? (
            <ul className="divide-y divide-slate-100">
              {comments.map((c) => (
                <CommentItem key={c.cid} c={c} tool={toolBySid.get(c.sid)} needsReply={open.has(c.cid)} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">아직 댓글이 없음</p>
          )}
          {mk.tools.map((t) => (
            <CommentGap key={t.sid} t={t} withTitle />
          ))}
        </Card>
      </section>
    </>
  );
};
