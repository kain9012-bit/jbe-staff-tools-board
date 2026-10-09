import React from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Eye, FileText, History, Info, MessageCircle, TrendingUp, Wrench } from 'lucide-react';
import { UseToolLink, CommentGap, CommentItem, MakerLink, SourceTag } from '../components/Lists';
import { TrendChart } from '../components/TrendChart';
import { Badge, Card, EmptyState, Stat } from '../components/Ui';
import { KEYWORD_CHIPS, chipFields, chipMatcher } from '../lib/keywords';
import { allTools, dayLabel, modelOf, n, type Model, type ToolStat } from '../lib/stats';
import { summaryOf, type ToolSummary } from '../lib/summaries';

/** 한눈에 보기 — 원 게시글을 정해진 항목으로 짧게 정리한 요약. 본문 자체는 싣지 않음 */
const SummaryBox: React.FC<{ s?: ToolSummary; url: string }> = ({ s, url }) => {
  const head = (
    <h2 className="nr-title flex items-center gap-2 text-[22px] text-black">
      <FileText className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 한눈에 보기
    </h2>
  );
  const goPost = (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[var(--nr-p3)] underline underline-offset-2">
      원 게시글 보기 <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
      <span className="sr-only">(새 창)</span>
    </a>
  );

  if (!s || s.empty) {
    return (
      <section className="mt-8">
        {head}
        <div className="mt-3 rounded-[10px] border border-dashed border-[var(--nr-line)] bg-[#fafafa] px-5 py-6 text-[15px] text-slate-600">
          <p>{s?.empty ? '원 게시글에 글도 그림 설명도 없어 요약할 내용이 없습니다.' : '아직 게시글 요약이 없습니다.'}</p>
          <p className="mt-2">{goPost}</p>
        </div>
      </section>
    );
  }

  const basisText = s.basis === '글·그림' ? '게시글의 글과 그림' : s.basis === '그림' ? '게시글의 그림' : '게시글';
  const sub = (t: string) => <h3 className="text-[15px] font-bold text-[var(--nr-p2)]">{t}</h3>;

  return (
    <section className="mt-8">
      {head}
      <div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--nr-line)] bg-white">
        {/* 무엇·왜 */}
        <div className="border-b border-[var(--nr-line)] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {s.run && (
              <span className="rounded-full bg-[var(--nr-p2)] px-2.5 py-0.5 text-[12px] font-bold text-white">{s.run}</span>
            )}
          </div>
          <p className="mt-2 text-[19px] font-bold leading-snug text-black">{s.what}</p>
          {s.why && <p className="mt-1.5 text-[15px] text-slate-600">{s.why}</p>}
        </div>

        {/* 기능·사용 순서 */}
        <div className="grid grid-cols-1 gap-6 px-5 py-5 sm:px-6 lg:grid-cols-2 lg:gap-10">
          {s.features && s.features.length > 0 && (
            <div>
              {sub('주요 기능')}
              <ul className="mt-2 space-y-1.5">
                {s.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[15px] leading-relaxed text-slate-800">
                    <span aria-hidden="true" className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nr-p1)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.steps && s.steps.length > 0 && (
            <div>
              {sub('사용 순서')}
              <ol className="mt-2 space-y-1.5">
                {s.steps.map((st, i) => (
                  <li key={st} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-800">
                    <span aria-hidden="true" className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--nr-bg)] text-[12px] font-bold text-[var(--nr-p3)] ring-1 ring-[var(--nr-p1)]/40">
                      {i + 1}
                    </span>
                    {st}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* 필요한 것·유의사항 */}
        {((s.needs && s.needs.length > 0) || (s.cautions && s.cautions.length > 0)) && (
          <dl className="grid grid-cols-1 gap-x-6 border-t border-[var(--nr-line)] bg-[var(--nr-bg)] px-5 py-4 text-[14px] sm:grid-cols-[96px_1fr] sm:px-6">
            {s.needs && s.needs.length > 0 && (
              <>
                <dt className="font-bold text-slate-700 sm:py-1">필요한 것</dt>
                <dd className="mb-3 mt-0.5 text-slate-800 sm:mb-0 sm:mt-0 sm:py-1">{s.needs.join(' · ')}</dd>
              </>
            )}
            {s.cautions && s.cautions.length > 0 && (
              <>
                <dt className="font-bold text-[#8a5300] sm:py-1">유의사항</dt>
                <dd className="mt-0.5 sm:mt-0 sm:py-1">
                  <ul className="space-y-1 text-slate-800">
                    {s.cautions.map((c) => (
                      <li key={c} className="flex gap-1.5">
                        <span aria-hidden="true" className="text-[#c27b00]">!</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
          </dl>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
        {s.thin ? '게시글 설명이 짧아 확인된 내용만 정리했습니다.' : `${basisText}을 바탕으로 정리했습니다.`} 자세한 내용은 {goPost}
        <span className="tabular-nums">· {dayLabel(s.at)} 정리</span>
      </p>
    </section>
  );
};

const ToolLinkList: React.FC<{ tools: ToolStat[] }> = ({ tools }) => (
  <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
    {tools.map((s) => (
      <li key={s.sid}>
        <a href={`#/tool/${s.sid}`} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--nr-line)] bg-white px-4 py-2.5 hover:border-[var(--nr-p3)]">
          <span className="min-w-0">
            <span className="block truncate font-bold text-slate-900">{s.title}</span>
            <span className="block truncate text-[13px] text-slate-500">{s.author}</span>
          </span>
          <span className="shrink-0 tabular-nums text-sm text-slate-500">{n(s.views)}회</span>
        </a>
      </li>
    ))}
  </ul>
);

export const ToolDetail: React.FC<{ m: Model; sid: string }> = ({ m, sid }) => {
  const t = allTools(m).find((x) => x.sid === sid);
  /** 이 도구가 속한 게시판의 모델 — 교육청 배포 도구는 수집 시작일이 달라 따로 계산 */
  const bm = modelOf(m, sid) ?? m;
  const official = t?.board === 'official';
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
  /** 교육청 배포 도구는 작성자가 모두 같아 제작자별 묶음을 보이지 않음 */
  const siblings = official ? [] : m.makers.find((x) => x.name === t.author)?.tools.filter((x) => x.sid !== sid) ?? [];
  const chips = KEYWORD_CHIPS.filter((c) => chipMatcher(c)(...chipFields(t)));
  const similar = chips.length
    ? allTools(m)
        .filter((x) => x.sid !== sid && (official || x.author !== t.author) && chips.some((c) => chipMatcher(c)(...chipFields(x))))
        .sort((a, b) => b.recent30 - a.recent30 || b.views - a.views)
        .slice(0, 4)
    : [];

  return (
    <>
      <a href="#/" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[var(--nr-p3)]">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 도구 찾기
      </a>

      {/* 1. 도구 머리 — 이름·제작자·분류와 바로 쓰러 가는 버튼 */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-4xl">
          <div className="flex flex-wrap gap-1.5">
            <SourceTag board={t.board} className="!text-[13px] !py-1" />
            <Badge tone="blue">{t.purpose || '분류 없음'}</Badge>
            <Badge>적용기관 {t.target || '미기재'}</Badge>
            {chips.map((c) => (
              <Badge key={c.label}>{c.label}</Badge>
            ))}
          </div>
          <h1 className="nr-title mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">{t.title}</h1>
          <p className="mt-1 text-slate-600">
            {official ? <b className="text-slate-800">{t.author}</b> : <MakerLink name={t.author} />} · {dayLabel(t.created)} 게시 · 조회 {n(t.views)}회
            {!official && <> · 댓글 {n(t.comments)}개</>}
          </p>
        </div>
        <UseToolLink url={t.url} />
      </div>

      {/* 2. 한눈에 보기 */}
      <SummaryBox s={summaryOf(sid)} url={t.url} />

      {/* 3. 질문과 답변 — 교육청 배포 도구는 댓글을 모으지 않아 게시판으로 안내 */}
      {official ? (
        <section className="mt-10">
          <h2 className="nr-title text-[22px] text-black">질문과 답변</h2>
          <Card className="mt-3">
            <p className="px-4 py-6 text-sm text-slate-600">
              교육청 배포 도구의 질문과 답변은 게시판 원글 댓글에서 확인할 수 있습니다 ·{' '}
              <a href={t.url} target="_blank" rel="noreferrer" className="font-bold text-[var(--nr-p3)] underline underline-offset-2">
                게시판 원글 보기
              </a>
            </p>
          </Card>
        </section>
      ) : (
      <section className="mt-10">
        <h2 className="nr-title text-[22px] text-black">
          질문과 답변 <span className="jbe-count text-sm font-bold tabular-nums">댓글 {n(t.comments)}개</span>
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
              <a href={t.url} target="_blank" rel="noreferrer" className="font-bold text-[var(--nr-p3)] underline underline-offset-2">
                게시판에서 질문 남기기
              </a>
            </p>
          )}
          <CommentGap t={t} />
        </Card>
        {!m.commentsOk && <p className="mt-2 text-xs text-amber-800">댓글 시트를 읽지 못해 댓글 내용이 비어 있을 수 있음</p>}
      </section>
      )}

      {/* 4. 함께 볼 도구 */}
      {siblings.length > 0 && (
        <section className="mt-10">
          <h2 className="nr-title text-[22px] text-black">같은 제작자의 다른 도구</h2>
          <ToolLinkList tools={siblings} />
        </section>
      )}
      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="nr-title text-[22px] text-black">비슷한 업무의 도구</h2>
          <ToolLinkList tools={similar} />
        </section>
      )}

      {/* 5. 조회 현황 — 제작자용 통계는 맨 아래 */}
      <section className="mt-12 border-t border-[var(--nr-line)] pt-8">
        <h2 className="nr-title text-[22px] text-black">조회 현황</h2>
        <div className={`mt-3 grid gap-3 grid-cols-2 ${official ? 'lg:grid-cols-4' : 'lg:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1'}`}>
          <Stat icon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />} label="누적 조회수" value={n(t.views)} desc="게시판 표시값" />
          <Stat icon={<TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />} label="최근 7일" value={`+${n(t.recent7)}`} desc="오늘 포함 7일" />
          <Stat icon={<CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />} label="이번 주" value={`+${n(t.thisWeek)}`} desc={`${dayLabel(bm.weekStart)}부터`} />
          {!official && (
            <Stat icon={<MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />} label="댓글" value={n(t.comments)} desc={t.makerReplies ? `제작자 답글 ${t.makerReplies}개 포함` : '제작자 답글 없음'} />
          )}
          <Stat
            icon={<History className="w-3.5 h-3.5" aria-hidden="true" />}
            label="수집 전 누적"
            value={n(t.pre)}
            desc={t.pre ? `${dayLabel(bm.start)} 수집 시작 전` : '수집 시작 후 게시'}
          />
        </div>
        <div className="mt-4">
          <TrendChart model={bm} daily={t.daily} title="조회수 추이" from={t.firstDate} pre={t.pre} />
        </div>
      </section>
    </>
  );
};
