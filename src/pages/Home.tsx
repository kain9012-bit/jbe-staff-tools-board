import React, { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Eye, MessageCircle, Users, Wrench } from 'lucide-react';
import { CommentItem, RankRow } from '../components/Lists';
import { TrendChart } from '../components/TrendChart';
import { Card, Stat } from '../components/Ui';
import { hrefList, hrefMaker, hrefTool } from '../lib/route';
import { dayLabel, n, periodStats, rangeLabel, shortDay, sum, type Model } from '../lib/stats';
import type { Period } from '../types';


const Panel: React.FC<{ title: string; desc: string; action?: React.ReactNode; children: React.ReactNode; more?: string }> = ({
  title,
  desc,
  action,
  children,
  more,
}) => (
  <Card className="flex min-w-0 flex-col">
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 className="nr-title text-[20px] text-black">{title}</h2>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      {action}
    </div>
    <ol className="flex-1 divide-y divide-slate-100 py-1">{children}</ol>
    {more && (
      <a href={more} className="border-t border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-[var(--nr-p3)]">
        전체 보기 →
      </a>
    )}
  </Card>
);

/** 제작자 현황 위쪽 — 전체 지표·조회수 추이·기간 순위 카드·최근 댓글 (예전 첫 화면) */
export const StatsOverview: React.FC<{ m: Model }> = ({ m }) => {
  const last = m.dates[m.dates.length - 1] ?? m.start;
  const [period, setPeriodState] = useState<Period>({ from: m.start, to: last, label: '전체 기간', all: true });
  const setPeriod = useCallback((p: Period) => setPeriodState(p), []);

  const total = sum(m.tools.map((t) => t.views));
  const week = sum(m.tools.map((t) => t.thisWeek));
  const commentTotal = sum(m.tools.map((t) => t.comments));
  const allDaily = useMemo(() => m.dates.map((_, i) => sum(m.tools.map((t) => t.daily[i]))), [m]);

  /** 그래프에서 고른 기간 기준 집계 — 세 카드가 함께 따라감 */
  const ps = useMemo(() => periodStats(m, period.from, period.to), [m, period.from, period.to]);
  const pv = (sid: string) => ps.views.get(sid) ?? 0;
  const pc = (sid: string) => ps.comments.get(sid) ?? 0;
  const periodText = period.all ? '전체 기간' : `${period.label} (${rangeLabel(period.from, period.to)})`;

  const popular = [...m.tools]
    .filter((t) => pv(t.sid) > 0)
    .sort((a, b) => pv(b.sid) - pv(a.sid) || b.views - a.views)
    .slice(0, 10);
  const talk = m.tools
    .filter((t) => pc(t.sid) > 0)
    .sort((a, b) => pc(b.sid) - pc(a.sid) || b.views - a.views)
    .slice(0, 10);
  const makers = m.makers
    .map((mk) => ({ mk, v: sum(mk.tools.map((t) => pv(t.sid))) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v || b.mk.views - a.mk.views)
    .slice(0, 10);
  const toolBySid = new Map(m.tools.map((t) => [t.sid, t]));
  const recentComments = m.comments.slice(0, 6);

  return (
    <>
    <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">
      <Stat icon={<Users className="w-3.5 h-3.5" aria-hidden="true" />} label="제작자" value={n(m.makers.length)} desc="게시판 작성자 기준" />
      <Stat icon={<Wrench className="w-3.5 h-3.5" aria-hidden="true" />} label="등록 도구" value={n(m.tools.length)} desc="게시중 글, 공지 제외" />
      <Stat icon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />} label="누적 조회수" value={n(total)} desc="전체 도구 합계" />
      <Stat
        icon={<CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />}
        label="이번 주 조회수"
        value={`+${n(week)}`}
        desc={`${dayLabel(m.weekStart)}부터`}
      />
      <Stat icon={<MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />} label="댓글" value={n(commentTotal)} desc={`${m.tools.filter((t) => t.comments > 0).length}개 도구에 달림`} />
    </div>

      <section className="mt-6">
        <TrendChart model={m} daily={allDaily} title="전체 도구 조회수 추이" desc="모든 도구의 조회수 증가량 합계" onPeriod={setPeriod} pre={sum(m.tools.map((t) => t.pre))} />
      </section>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <CalendarDays className="w-4 h-4 text-[var(--nr-p3)]" aria-hidden="true" />
        아래 순위는 그래프에서 고른 기간 기준
        <b className="rounded-md bg-[var(--nr-bg)] px-2 py-0.5 text-[var(--nr-p2)]">{periodText}</b>
        {ps.includesPre && ps.pre > 0 && (
          <span className="text-xs text-slate-500">
            · 수집 시작({shortDay(m.start)}) 전 조회수 {n(ps.pre)}회 포함
          </span>
        )}
      </p>
      <section className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="인기 도구"
          desc="선택 기간 조회수 순"
          more={hrefList('tools', 'period', period)}
        >
          {popular.length ? (
            popular.map((t, i) => (
              <RankRow
                key={t.sid}
                rank={i + 1}
                href={hrefTool(t.sid)}
                title={t.title}
                sub={t.author}
                value={`+${n(pv(t.sid))}회`}
                valueSub={`누적 ${n(t.views)}`}
              />
            ))
          ) : (
            <li className="px-4 py-6 text-sm text-slate-500">이 기간에 늘어난 조회수 없음</li>
          )}
        </Panel>

        <Panel
          title="소통이 활발한 도구"
          desc="선택 기간 댓글 수 순 · 제작자 답글 포함"
          more={hrefList('tools', 'periodComments', period)}
        >
          {talk.length ? (
            talk.map((t, i) => (
              <RankRow
                key={t.sid}
                rank={i + 1}
                href={hrefTool(t.sid)}
                title={t.title}
                sub={t.author}
                value={`댓글 ${n(pc(t.sid))}`}
                valueSub={ps.all ? (t.makerReplies ? `제작자 답글 ${t.makerReplies}` : undefined) : `전체 ${n(t.comments)}`}
              />
            ))
          ) : (
            <li className="px-4 py-6 text-sm text-slate-500">이 기간에 달린 댓글 없음</li>
          )}
        </Panel>

        <Panel title="인기 제작자" desc="만든 도구의 선택 기간 조회수 합계 순" more={hrefList('makers', 'period', period)}>
          {makers.length ? (
            makers.map(({ mk, v }, i) => (
              <RankRow
                key={mk.name}
                rank={i + 1}
                href={hrefMaker(mk.name)}
                title={mk.person}
                sub={`${mk.org} · 도구 ${mk.tools.length}개`}
                value={`+${n(v)}회`}
                valueSub={`누적 ${n(mk.views)}`}
              />
            ))
          ) : (
            <li className="px-4 py-6 text-sm text-slate-500">이 기간에 늘어난 조회수 없음</li>
          )}
        </Panel>
      </section>



      {recentComments.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline gap-2">
            <MessageCircle className="w-4 h-4 text-[var(--nr-p3)] self-center" aria-hidden="true" />
            <h2 className="nr-title text-[22px] text-black">최근 댓글</h2>
            <span className="text-xs text-slate-500">질문·후기·개선 의견과 제작자 답글</span>
          </div>
          <Card className="mt-3">
            <ul className="divide-y divide-slate-100">
              {recentComments.map((c) => (
                <CommentItem key={c.cid} c={c} tool={toolBySid.get(c.sid)} />
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
};
