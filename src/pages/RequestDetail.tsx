import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Hammer, Heart, Link2, MessageCircle, Search, X } from 'lucide-react';
import { SourceTag } from '../components/Lists';
import { PocNote, PocTag, todayKst } from '../components/Poc';
import { EmptyState } from '../components/Ui';
import { useRequests } from '../lib/requests';
import { navigate } from '../lib/route';
import { allTools, dayLabel, n, type Model } from '../lib/stats';
import { STATUS_STYLE } from './Requests';

/**
 * 요청 상세 — 요청 내용, 의견, '제가 해결해볼게요', 이 요청을 해결하는 도구(여러 개 가능).
 * 운영자는 연결이 빠진 도구를 나중에 이어 붙일 수 있음
 */
export const RequestDetail: React.FC<{ m: Model; id: string }> = ({ m, id }) => {
  const R = useRequests(m);
  const r = R.get(id);
  const [text, setText] = useState('');
  const [ops, setOps] = useState(false);
  const [q, setQ] = useState('');
  const pool = useMemo(() => allTools(m), [m]);

  if (!r) {
    return <EmptyState icon={<Search className="w-5 h-5" aria-hidden="true" />} title="요청을 찾지 못함" desc="지워졌거나 주소가 바뀐 요청일 수 있습니다." />;
  }
  const liked = R.liked.includes(r.id);
  const making = R.isMaking(r.id);
  const opsLinked = R.linkedByOps(r.id);
  const hits = q.trim()
    ? pool.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase()) && !r.tools.some((x) => x.sid === t.sid)).slice(0, 6)
    : [];

  return (
    <>
      <a href="/requests" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[var(--nr-p3)]">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 도구 요청
      </a>

      {/* 요청 */}
      <div className="mt-3 flex gap-4">
        <button
          type="button"
          aria-pressed={liked}
          aria-label={`공감 ${r.likes}`}
          onClick={() => R.toggleLike(r.id)}
          className={`flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-[12px] border text-[14px] font-bold ${
            liked ? 'border-[#f3a6b8] bg-[#fff0f4] text-[#d61e49]' : 'border-[var(--nr-line)] bg-white text-slate-600 hover:border-[#f3a6b8]'
          }`}
        >
          <Heart className={`w-6 h-6 ${liked ? 'fill-[#d61e49]' : ''}`} aria-hidden="true" />
          <span className="tabular-nums">{n(r.likes)}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
            <span className="rounded-md bg-[#f1f3f6] px-2 py-0.5 text-[12px] font-bold text-slate-700">{r.field}</span>
            {r.mine ? <PocTag label="내가 남긴 요청" /> : <PocTag />}
          </div>
          <h1 className="nr-title mt-2 text-2xl leading-snug text-slate-900 sm:text-3xl">{r.title}</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            {r.who} · {dayLabel(r.at)} 요청
          </p>
        </div>
      </div>
      {r.detail && <p className="mt-4 whitespace-pre-line rounded-[10px] bg-[#fafafa] px-5 py-4 text-[16px] leading-relaxed text-slate-800">{r.detail}</p>}

      {/* 해결 도구 */}
      <section className="mt-8">
        {r.tools.length > 0 || r.pending.length > 0 ? (
          <div className="rounded-[14px] border-2 border-[#9fd5b0] bg-[#f3faf5] p-5">
            <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#1f7a3a]">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              {r.tools.length > 0 ? '이 요청을 해결할 도구가 등록되었습니다. 확인해 보세요' : '이 요청을 해결할 도구가 등록 신청되었습니다'}
            </h2>
            <ul className="mt-3 space-y-2">
              {r.tools.map((t) => (
                <li key={t.sid} className="flex items-center gap-2 rounded-[10px] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <a href={`/tool/${t.sid}`} className="group flex min-w-0 flex-1 items-center gap-2">
                    <SourceTag board={t.board} className="!px-1.5 !py-0 !text-[11px]" />
                    <span className="min-w-0 truncate font-bold text-slate-900 group-hover:text-[var(--nr-p3)] group-hover:underline">{t.title}</span>
                    {opsLinked.includes(t.sid) && <span className="shrink-0 rounded bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-bold text-slate-600">운영자 연결</span>}
                    <ArrowRight className="ml-auto w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </a>
                  {ops && opsLinked.includes(t.sid) && (
                    <button type="button" onClick={() => R.unlink(r.id, t.sid)} aria-label="연결 해제" className="shrink-0 rounded p-1 text-slate-400 hover:text-[#d61e49]">
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
              {r.pending.map((s) => (
                <li key={s.id}>
                  <a href="/review" className="flex items-center gap-2 rounded-[10px] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:text-[var(--nr-p3)]">
                    <Clock className="w-4 h-4 shrink-0 text-[#c27b00]" aria-hidden="true" />
                    <span className="min-w-0 truncate font-bold text-slate-900">{s.title}</span>
                    <span className="shrink-0 text-[12px] font-bold text-[#8a5300]">{s.stage >= 3 ? '게시됨' : '검수 중'} · 내 신청</span>
                    <ArrowRight className="ml-auto w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-slate-600">해결 도구는 여러 개 붙을 수 있음. 요청자와 공감한 사람에게 알림</p>
          </div>
        ) : (
          <p className="rounded-[14px] border border-dashed border-[var(--nr-line)] px-5 py-4 text-[15px] text-slate-600">아직 이 요청을 해결할 도구가 등록되지 않았습니다.</p>
        )}
      </section>

      {/* 해결해볼게요 */}
      <section className="mt-4 flex flex-col gap-3 rounded-[14px] bg-[var(--nr-bg)] p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[16px] font-bold text-[var(--nr-p2)]">
            <Hammer className="w-5 h-5" aria-hidden="true" /> 만들 수 있으신가요?
          </p>
          <p className="mt-0.5 text-[14px] text-slate-600">
            {r.makers.length ? `만드는 사람: ${r.makers.join(', ')} · 여러 명이 함께 도전해도 됩니다.` : "'제가 해결해볼게요'를 누르면 이 요청이 연결된 도구 등록 양식이 열립니다."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!making) R.toggleMaking(r.id);
            navigate(`/register?type=staff&req=${r.id}`);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-5 py-3 text-[15px] font-bold text-white hover:bg-[var(--nr-p3)]"
        >
          제가 해결해볼게요 <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </section>

      {/* 의견 */}
      <section className="mt-10">
        <h2 className="nr-title flex items-center gap-2 text-[22px] text-black">
          <MessageCircle className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 의견 <span className="jbe-count text-sm font-bold tabular-nums">{r.allComments.length}개</span>
        </h2>
        <p className="mt-1 text-[14px] text-slate-600">지금 쓰는 양식·절차, 꼭 필요한 기능, 이미 있는 도구, 제작 중인 시안을 나눠 주세요.</p>
        <ul className="mt-3 divide-y divide-slate-100 rounded-[10px] border border-[var(--nr-line)] bg-white">
          {r.allComments.map((c, i) => (
            <li key={i} className={`px-4 py-3 ${c.maker ? 'bg-[#f7fbff]' : ''}`}>
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
                <b className="text-slate-800">{c.who}</b>
                {c.maker && <span className="rounded bg-[var(--nr-p2)] px-1.5 py-0.5 text-[11px] font-bold text-white">제작자</span>}
                {dayLabel(c.at)}
              </p>
              <p className="mt-1 text-[15px] text-slate-800">{c.text}</p>
            </li>
          ))}
          {r.allComments.length === 0 && <li className="px-4 py-5 text-[14px] text-slate-500">아직 의견이 없습니다.</li>}
        </ul>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            R.addComment(r.id, { who: '나', at: todayKst(), text: text.trim().slice(0, 300), maker: making });
            setText('');
          }}
        >
          <label htmlFor="rc-text" className="sr-only">
            의견
          </label>
          <input id="rc-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="의견 남기기 · 개인정보는 적지 마세요" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none" />
          <button type="submit" disabled={!text.trim()} className="shrink-0 rounded-lg bg-[var(--nr-p1)] px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">
            남기기
          </button>
        </form>
      </section>

      {/* 운영자 연결 */}
      <section className="mt-10 border-t border-[var(--nr-line)] pt-6">
        <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
          <input type="checkbox" checked={ops} onChange={(e) => setOps(e.target.checked)} className="accent-[var(--nr-p3)]" />
          운영 부서 계정으로 보기 (PoC 시연)
        </label>
        {ops && (
          <div className="mt-3 rounded-[12px] border border-[var(--nr-line)] bg-white p-5">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-black">
              <Link2 className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 운영자 도구 연결
            </h2>
            <p className="mt-1 text-[14px] text-slate-600">제작자가 등록할 때 연결하지 않았지만 이 요청을 해결하는 도구가 있으면 운영자가 이어 붙임</p>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                aria-label="연결할 도구 찾기"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="도구 이름으로 찾기"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none"
              />
            </div>
            {hits.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {hits.map((t) => (
                  <li key={t.sid} className="flex items-center gap-2 px-3 py-2">
                    <SourceTag board={t.board} className="!px-1.5 !py-0 !text-[11px]" />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-slate-800">{t.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        R.link(r.id, t.sid);
                        setQ('');
                      }}
                      className="shrink-0 rounded-md bg-[var(--nr-bg)] px-3 py-1 text-[13px] font-bold text-[var(--nr-p3)]"
                    >
                      연결
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.trim() && hits.length === 0 && <p className="mt-2 text-[13px] text-slate-500">찾는 도구가 없음</p>}
          </div>
        )}
      </section>
      <PocNote className="mt-6">의견·손들기·연결은 이 브라우저에만 저장됩니다.</PocNote>
    </>
  );
};
