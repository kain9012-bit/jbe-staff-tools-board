import React, { useMemo, useState } from 'react';
import { CalendarDays, Eye, MessageCircle, Sparkles, Users, Wrench } from 'lucide-react';
import { GlobalSearch } from '../components/GlobalSearch';
import { CommentItem, RankRow, ToolCard } from '../components/Lists';
import { TrendChart } from '../components/TrendChart';
import { Card, Segmented, Stat } from '../components/Ui';
import { hrefMaker, hrefTool } from '../lib/route';
import { dayLabel, n, sum, type Model } from '../lib/stats';

type PopKey = 'views' | 'recent7';

const Panel: React.FC<{ title: string; desc: string; action?: React.ReactNode; children: React.ReactNode; more?: string }> = ({
  title,
  desc,
  action,
  children,
  more,
}) => (
  <Card className="flex flex-col">
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 className="jbe-display text-lg font-extrabold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      {action}
    </div>
    <ol className="flex-1 divide-y divide-slate-100 py-1">{children}</ol>
    {more && (
      <a href={more} className="border-t border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-blue-700">
        전체 보기 →
      </a>
    )}
  </Card>
);

export const Home: React.FC<{ m: Model }> = ({ m }) => {
  const [pop, setPop] = useState<PopKey>('views');
  const total = sum(m.tools.map((t) => t.views));
  const week = sum(m.tools.map((t) => t.thisWeek));
  const commentTotal = sum(m.tools.map((t) => t.comments));
  const allDaily = useMemo(() => m.dates.map((_, i) => sum(m.tools.map((t) => t.daily[i]))), [m]);

  const popular = [...m.tools].sort((a, b) => b[pop] - a[pop] || b.views - a.views).slice(0, 10);
  const talk = m.tools
    .filter((t) => t.comments > 0)
    .sort((a, b) => b.comments - a.comments || b.views - a.views)
    .slice(0, 10);
  const makers = m.makers.slice(0, 10);
  const fresh = [...m.tools].sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : b.sid.localeCompare(a.sid))).slice(0, 6);
  const toolBySid = new Map(m.tools.map((t) => [t.sid, t]));
  const recentComments = m.comments.slice(0, 6);

  return (
    <>
      <div className="relative z-10 left-1/2 w-screen -translate-x-1/2 -mt-6 bg-blue-50 border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="jbe-display text-3xl sm:text-[2.75rem] font-extrabold text-slate-900 leading-tight tracking-tight">
            교직원이 만든 업무도구,
            <span className="block text-blue-700">누가 만들고 얼마나 쓰이는지</span>
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            데이터 도구실 「교직원 제작 도구」 게시판의 조회수와 댓글을 매시간 모아 제작자별·도구별로 정리한 현황.
          </p>
          <div className="mt-5">
            <GlobalSearch m={m} />
          </div>
          <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
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
        </div>
      </div>

      <section className="mt-6">
        <TrendChart model={m} daily={allDaily} title="전체 도구 조회수 추이" desc="모든 도구의 조회수 증가량 합계" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          title="인기 도구"
          desc={pop === 'views' ? '누적 조회수 순' : '최근 7일 조회수 증가 순'}
          more="#/tools"
          action={
            <Segmented
              label="인기 기준"
              value={pop}
              onChange={setPop}
              options={[
                { value: 'views', label: '누적' },
                { value: 'recent7', label: '최근 7일' },
              ]}
            />
          }
        >
          {popular.map((t, i) => (
            <RankRow
              key={t.sid}
              rank={i + 1}
              href={hrefTool(t.sid)}
              title={t.title}
              sub={t.author}
              value={pop === 'views' ? `${n(t.views)}회` : `+${n(t.recent7)}회`}
              valueSub={pop === 'views' ? `7일 +${n(t.recent7)}` : `누적 ${n(t.views)}`}
            />
          ))}
        </Panel>

        <Panel title="소통이 활발한 도구" desc="댓글 수 순 · 제작자 답글 포함 · 댓글 0개 제외" more="#/tools">
          {talk.length ? (
            talk.map((t, i) => (
              <RankRow
                key={t.sid}
                rank={i + 1}
                href={hrefTool(t.sid)}
                title={t.title}
                sub={t.author}
                value={`댓글 ${n(t.comments)}`}
                valueSub={t.makerReplies ? `제작자 답글 ${t.makerReplies}` : undefined}
              />
            ))
          ) : (
            <li className="px-4 py-6 text-sm text-slate-500">아직 댓글이 달린 도구가 없음</li>
          )}
        </Panel>

        <Panel title="인기 제작자" desc="만든 도구의 누적 조회수 합계 순" more="#/makers">
          {makers.map((mk, i) => (
            <RankRow
              key={mk.name}
              rank={i + 1}
              href={hrefMaker(mk.name)}
              title={mk.person}
              sub={`${mk.org} · 도구 ${mk.tools.length}개`}
              value={`${n(mk.views)}회`}
              valueSub={`7일 +${n(mk.recent7)}`}
            />
          ))}
        </Panel>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline gap-2">
          <Sparkles className="w-4 h-4 text-blue-700 self-center" aria-hidden="true" />
          <h2 className="jbe-display text-xl font-extrabold text-slate-900">새로 올라온 도구</h2>
          <span className="text-xs text-slate-500">게시일 순</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fresh.map((t) => (
            <ToolCard key={t.sid} t={t} />
          ))}
        </div>
      </section>

      {recentComments.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline gap-2">
            <MessageCircle className="w-4 h-4 text-blue-700 self-center" aria-hidden="true" />
            <h2 className="jbe-display text-xl font-extrabold text-slate-900">최근 댓글</h2>
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
