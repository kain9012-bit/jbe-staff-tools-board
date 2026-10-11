import React, { useState } from 'react';
import { CheckCircle2, Hammer, Heart, Lightbulb, MessageCircle, Plus } from 'lucide-react';
import { PocNote, PocTag, todayKst } from '../components/Poc';
import { PageTitle } from '../components/Shell';
import { REQ_STATUS, type ReqStatus } from '../data/poc-requests';
import { KEYWORD_CHIPS } from '../lib/keywords';
import { useRequests } from '../lib/requests';
import { navigate } from '../lib/route';
import { dayLabel, n, type Model } from '../lib/stats';

/**
 * 도구 요청 — 필요한 사람이 요청을 올리고, 만들 수 있는 교직원이 보고 의견을 나누며 만들어 등록하는 열린 게시판.
 * 정책기획과는 운영(중복 정리·도구 연결)만 맡음
 */

export const STATUS_STYLE: Record<ReqStatus, string> = {
  '의견 모으는 중': 'bg-slate-100 text-slate-700',
  '만드는 중': 'bg-[var(--nr-bg)] text-[var(--nr-p3)]',
  해결: 'bg-[#e3f5e9] text-[#1f7a3a]',
};

const FLOW = [
  ['요청·의견', '필요한 사람이 요청을 올리고, 누구나 공감하고 지금 쓰는 양식·절차를 의견으로 보탬'],
  ['해결해볼게요', '만들 수 있는 교직원이 손들고, 시안을 의견란에 공유해 요청자와 맞춰 감'],
  ['도구 등록 → 해결', '도구를 등록하면 요청 아래에 해결 도구로 붙음. 여러 개도 가능, 요청자·공감한 사람에게 알림'],
] as const;

type View = '' | ReqStatus | 'waiting';

export const Requests: React.FC<{ m: Model }> = ({ m }) => {
  const R = useRequests(m);
  const [view, setView] = useState<View>('');
  const [sort, setSort] = useState<'likes' | 'new'>('likes');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [field, setField] = useState('');

  const waiting = (r: (typeof R.list)[number]) => r.status === '의견 모으는 중';
  const shown = R.list
    .filter((r) => !view || (view === 'waiting' ? waiting(r) : r.status === view))
    .sort((a, b) => (sort === 'likes' ? b.likes - a.likes : b.at.localeCompare(a.at)));
  const count = (s: ReqStatus) => R.list.filter((r) => r.status === s).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = `me-${Date.now()}`;
    R.addRequest({ id, title: title.trim().slice(0, 80), detail: detail.trim().slice(0, 300), field: field || '기타', who: '나', at: todayKst(), likes: 0, mine: true });
    setTitle('');
    setDetail('');
    setField('');
    setOpen(false);
    navigate(`/requests/${id}`);
  };

  return (
    <>
      <PageTitle desc="필요한 도구를 요청하면, 만들 수 있는 교직원이 보고 의견을 나누며 만들어 올립니다. 만드는 사람이 따로 정해져 있지 않은 열린 게시판입니다.">도구 요청</PageTitle>
      <PocNote className="mt-6">
        PoC 예시 화면입니다. 요청·의견·손든 사람은 흐름을 보여 주기 위한 예시이고, 해결된 요청에 연결된 도구는 실제 데이터 도구실 도구입니다. 새로 남긴 내용은 이 브라우저에만 저장됩니다.
      </PocNote>

      <ol className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FLOW.map(([h, d], i) => (
          <li key={h} className="rounded-[10px] bg-[var(--nr-bg)] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--nr-p2)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--nr-p2)] text-[11px] text-white">{i + 1}</span>
              {h}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-slate-600">{d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[13px] text-slate-500">정책기획과는 운영자로서 중복 요청을 합치고, 연결이 빠진 도구를 요청에 이어 붙임</p>

      {/* 요청 남기기 */}
      <section className="mt-8 rounded-[14px] border-2 border-[var(--nr-p1)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="nr-title flex items-center gap-2 text-[20px] text-black">
            <Lightbulb className="w-5 h-5 text-[#e0a800]" aria-hidden="true" /> 이런 도구가 필요해요
          </h2>
          {!open && (
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--nr-p3)]">
              <Plus className="w-4 h-4" aria-hidden="true" /> 요청 남기기
            </button>
          )}
        </div>
        {open && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <label htmlFor="rq-title" className="text-[14px] font-bold text-slate-800">
                어떤 일을 줄이고 싶나요? <span className="text-[#d61e49]">*</span>
              </label>
              <input id="rq-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="예: 학급별 출결 통계를 엑셀로 자동 정리" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none" />
            </div>
            <div>
              <label htmlFor="rq-detail" className="text-[14px] font-bold text-slate-800">
                지금은 어떻게 하고 있나요?
              </label>
              <textarea id="rq-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} rows={3} placeholder="반복되는 과정, 걸리는 시간, 쓰는 시스템을 적어 주면 제작자가 이해하기 쉽습니다. 개인정보는 적지 마세요." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-60">
                <label htmlFor="rq-field" className="text-[14px] font-bold text-slate-800">
                  업무 분야
                </label>
                <select id="rq-field" value={field} onChange={(e) => setField(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px]">
                  <option value="">선택</option>
                  {KEYWORD_CHIPS.map((c) => (
                    <option key={c.label}>{c.label}</option>
                  ))}
                  <option>기타</option>
                </select>
              </div>
              <div className="flex gap-2 sm:ml-auto">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] font-bold text-slate-700">
                  취소
                </button>
                <button type="submit" disabled={!title.trim()} className="rounded-lg bg-[var(--nr-p1)] px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">
                  요청 등록
                </button>
              </div>
            </div>
            <p className="text-[13px] text-slate-500">등록 전에 도구 찾기에서 비슷한 도구가 있는지 먼저 찾아보세요.</p>
          </form>
        )}
      </section>

      {/* 요청 목록 */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['', `전체 ${R.list.length}`],
                ['waiting', `만들 사람 기다리는 요청 ${R.list.filter(waiting).length}`],
                ...REQ_STATUS.filter((s) => s !== '의견 모으는 중').map((s) => [s, `${s} ${count(s)}`]),
              ] as [View, string][]
            ).map(([k, label]) => (
              <button
                key={k || 'all'}
                type="button"
                aria-pressed={view === k}
                onClick={() => setView(k)}
                className={`rounded-full px-3.5 py-1.5 text-[14px] ${view === k ? 'bg-[var(--nr-p3)] font-bold text-white' : 'bg-[var(--nr-bg)] text-slate-700 hover:text-[var(--nr-p3)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 text-[14px]">
            {(
              [
                ['likes', '공감순'],
                ['new', '최신순'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={`rounded-md px-2.5 py-1 ${sort === k ? 'font-bold text-black underline underline-offset-4' : 'text-slate-500'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {shown.map((r) => {
            const on = R.liked.includes(r.id);
            return (
              <li key={r.id} className="relative rounded-[12px] border border-[var(--nr-line)] bg-white p-4 hover:border-[var(--nr-p3)] sm:p-5">
                <div className="flex gap-4">
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`공감 ${r.likes}`}
                    onClick={() => R.toggleLike(r.id)}
                    className={`relative z-10 flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-[10px] border text-[13px] font-bold ${
                      on ? 'border-[#f3a6b8] bg-[#fff0f4] text-[#d61e49]' : 'border-[var(--nr-line)] bg-white text-slate-600 hover:border-[#f3a6b8]'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${on ? 'fill-[#d61e49]' : ''}`} aria-hidden="true" />
                    <span className="tabular-nums">{n(r.likes)}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                      <span className="rounded-md bg-[#f1f3f6] px-2 py-0.5 text-[12px] font-bold text-slate-700">{r.field}</span>
                      {r.mine ? <PocTag label="내가 남긴 요청" /> : <PocTag />}
                    </div>
                    <h3 className="mt-1.5 text-[17px] font-bold leading-snug text-black">
                      <a href={`/requests/${r.id}`} className="after:absolute after:inset-0 hover:text-[var(--nr-p3)]">
                        {r.title}
                      </a>
                    </h3>
                    {r.detail && <p className="mt-1 line-clamp-2 text-[14px] text-slate-600">{r.detail}</p>}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                      <span>
                        {r.who} · {dayLabel(r.at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        의견 {r.allComments.length}
                      </span>
                      {r.makers.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-bold text-[var(--nr-p3)]">
                          <Hammer className="w-3.5 h-3.5" aria-hidden="true" />
                          만드는 사람 {r.makers.length}
                        </span>
                      )}
                      {r.tools.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-bold text-[#1f7a3a]">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          해결 도구 {r.tools.length}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
};
