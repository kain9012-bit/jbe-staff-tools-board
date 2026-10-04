import React from 'react';
import { ArrowLeft, CalendarDays, Eye, History, MessageCircle, TrendingUp, Wrench } from 'lucide-react';
import { UseToolLink, CommentGap, CommentItem, MakerLink } from '../components/Lists';
import { TrendChart } from '../components/TrendChart';
import { Badge, Card, EmptyState, Stat } from '../components/Ui';
import { dayLabel, n, type Model } from '../lib/stats';

export const ToolDetail: React.FC<{ m: Model; sid: string }> = ({ m, sid }) => {
  const t = m.tools.find((x) => x.sid === sid);
  if (!t) {
    return (
      <EmptyState
        icon={<Wrench className="w-5 h-5" aria-hidden="true" />}
        title="도구를 찾지 못함"
        desc="게시판에서 내려갔거나 주소가 바뀐 도구일 수 있습니다."
      />
    );
  }
  const comments = m.comments.filter((c) => c.sid === sid);
  const rank = [...m.tools].sort((a, b) => b.views - a.views).findIndex((x) => x.sid === sid) + 1;
  const siblings = m.makers.find((x) => x.name === t.author)?.tools.filter((x) => x.sid !== sid) ?? [];

  return (
    <>
      <a href="#/tools" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-blue-700">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 도구 목록
      </a>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-4xl">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="blue">{t.purpose || '분류 없음'}</Badge>
            <Badge>{t.target || '적용기관 미기재'}</Badge>
            <Badge>누적 {rank}위 / {m.tools.length}</Badge>
          </div>
          <h1 className="jbe-display mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">{t.title}</h1>
          <p className="mt-1 text-slate-600">
            <MakerLink name={t.author} /> · {dayLabel(t.created)} 게시
          </p>
        </div>
        <UseToolLink url={t.url} />
      </div>

      <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Stat icon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />} label="누적 조회수" value={n(t.views)} desc="게시판 표시값" />
        <Stat icon={<TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />} label="최근 7일" value={`+${n(t.recent7)}`} desc="오늘 포함 7일" />
        <Stat icon={<CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />} label="이번 주" value={`+${n(t.thisWeek)}`} desc={`${dayLabel(m.weekStart)}부터`} />
        <Stat icon={<MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />} label="댓글" value={n(t.comments)} desc={t.makerReplies ? `제작자 답글 ${t.makerReplies}개 포함` : '제작자 답글 없음'} />
        <Stat
          icon={<History className="w-3.5 h-3.5" aria-hidden="true" />}
          label="수집 전 누적"
          value={n(t.pre)}
          desc={t.pre ? `${dayLabel(m.start)} 수집 시작 전` : '수집 시작 후 게시'}
        />
      </div>

      <section className="mt-6">
        <TrendChart model={m} daily={t.daily} title="조회수 추이" from={t.firstDate} />
      </section>

      <section className="mt-6">
        <h2 className="jbe-display text-xl font-extrabold text-slate-900">
          댓글 <span className="jbe-count text-sm font-bold tabular-nums">{n(t.comments)}개</span>
        </h2>
        <Card className="mt-3">
          {comments.length ? (
            <ul className="divide-y divide-slate-100">
              {comments.map((c) => (
                <CommentItem key={c.cid} c={c} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">
              {t.comments ? '댓글 내용을 아직 모으지 못함' : '아직 댓글이 없음'} ·{' '}
              <a href={t.url} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline underline-offset-2">
                게시판에서 첫 댓글 남기기
              </a>
            </p>
          )}
          <CommentGap t={t} />
        </Card>
        {!m.commentsOk && <p className="mt-2 text-xs text-amber-800">댓글 시트를 읽지 못해 댓글 내용이 비어 있을 수 있음</p>}
      </section>

      {siblings.length > 0 && (
        <section className="mt-8">
          <h2 className="jbe-display text-xl font-extrabold text-slate-900">같은 제작자의 다른 도구</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {siblings.map((s) => (
              <li key={s.sid}>
                <a href={`#/tool/${s.sid}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 hover:border-blue-600">
                  <span className="truncate font-bold text-slate-900">{s.title}</span>
                  <span className="shrink-0 tabular-nums text-sm text-slate-500">{n(s.views)}회</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};
