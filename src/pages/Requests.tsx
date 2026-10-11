import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Heart, Lightbulb, Plus } from 'lucide-react';
import { PocNote, PocTag, todayKst, usePocState } from '../components/Poc';
import { SourceTag } from '../components/Lists';
import { PageTitle } from '../components/Shell';
import { REQ_STATUS, SAMPLE_REQUESTS, type ReqStatus, type ToolRequest } from '../data/poc-requests';
import { KEYWORD_CHIPS } from '../lib/keywords';
import { hrefTool } from '../lib/route';
import { allTools, dayLabel, n, type Model } from '../lib/stats';

/**
 * 도구 요청 — 찾는 도구가 없을 때 '이런 도구가 필요해요'를 남기고, 공감이 많은 요청부터 검토·제작.
 * 해결되면 만들어진 도구와 연결되어 요청자에게 알림(개편 후).
 */

const STATUS_STYLE: Record<ReqStatus, string> = {
  접수: 'bg-slate-100 text-slate-700',
  '검토 중': 'bg-[#fff1d6] text-[#8a5300]',
  '제작 중': 'bg-[var(--nr-bg)] text-[var(--nr-p3)]',
  해결: 'bg-[#e3f5e9] text-[#1f7a3a]',
};

const FLOW = [
  ['요청', '찾는 도구가 없으면 필요한 내용을 남김'],
  ['공감', '같은 불편을 겪는 동료가 공감'],
  ['검토', '공감이 많은 요청부터 기존 도구·제작 가능성 확인'],
  ['제작', '교육청 배포 또는 교직원 제작으로 연결'],
  ['해결', '만든 도구를 요청에 연결하고 요청자에게 알림'],
] as const;

export const Requests: React.FC<{ m: Model }> = ({ m }) => {
  const [mine, setMine] = usePocState<ToolRequest[]>('requests', []);
  const [liked, setLiked] = usePocState<string[]>('liked', []);
  const [filter, setFilter] = useState<'' | ReqStatus>('');
  const [sort, setSort] = useState<'likes' | 'new'>('likes');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [field, setField] = useState('');

  const toolsById = useMemo(() => new Map(allTools(m).map((t) => [t.sid, t])), [m]);
  const all = [...mine, ...SAMPLE_REQUESTS];
  const likesOf = (r: ToolRequest) => r.likes + (liked.includes(r.id) ? 1 : 0);
  const shown = all
    .filter((r) => !filter || r.status === filter)
    .sort((a, b) => (sort === 'likes' ? likesOf(b) - likesOf(a) : b.at.localeCompare(a.at)));
  const count = (s: ReqStatus) => all.filter((r) => r.status === s).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setMine((v) => [
      {
        id: `me-${Date.now()}`,
        title: title.trim().slice(0, 80),
        detail: detail.trim().slice(0, 300),
        field: field || '기타',
        who: '나',
        at: todayKst(),
        likes: 0,
        status: '접수',
        mine: true,
      },
      ...v,
    ]);
    setTitle('');
    setDetail('');
    setField('');
    setOpen(false);
    setFilter('');
    setSort('new');
  };

  return (
    <>
      <PageTitle desc="찾는 도구가 없나요? 필요한 도구를 남기면 공감이 많은 요청부터 검토해 만들거나, 이미 있는 도구를 연결해 드립니다.">
        도구 요청
      </PageTitle>
      <PocNote className="mt-6">
        PoC 예시 화면입니다. 아래 요청 목록은 흐름을 보여 주기 위한 예시이고, 해결된 요청에 연결된 도구는 실제 데이터 도구실 도구입니다. 새로 남긴 요청과 공감은 이 브라우저에만 저장됩니다.
      </PocNote>

      {/* 요청 흐름 */}
      <ol className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {FLOW.map(([h, d], i) => (
          <li key={h} className="relative rounded-[10px] bg-[var(--nr-bg)] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--nr-p2)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--nr-p2)] text-[11px] text-white">{i + 1}</span>
              {h}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-slate-600">{d}</p>
          </li>
        ))}
      </ol>

      {/* 요청 남기기 */}
      <section className="mt-8 rounded-[14px] border-2 border-[var(--nr-p1)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="nr-title flex items-center gap-2 text-[20px] text-black">
            <Lightbulb className="w-5 h-5 text-[#e0a800]" aria-hidden="true" /> 이런 도구가 필요해요
          </h2>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--nr-p3)]"
            >
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
              <input
                id="rq-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
                placeholder="예: 학급별 출결 통계를 엑셀로 자동 정리"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="rq-detail" className="text-[14px] font-bold text-slate-800">
                지금은 어떻게 하고 있나요?
              </label>
              <textarea
                id="rq-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="반복되는 과정, 걸리는 시간, 쓰는 시스템을 적어 주면 검토가 빨라집니다. 개인정보는 적지 마세요."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-60">
                <label htmlFor="rq-field" className="text-[14px] font-bold text-slate-800">
                  업무 분야
                </label>
                <select
                  id="rq-field"
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px]"
                >
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
            {(['', ...REQ_STATUS] as const).map((s) => (
              <button
                key={s || 'all'}
                type="button"
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3.5 py-1.5 text-[14px] ${
                  filter === s ? 'bg-[var(--nr-p3)] font-bold text-white' : 'bg-[var(--nr-bg)] text-slate-700 hover:text-[var(--nr-p3)]'
                }`}
              >
                {s || '전체'} <span className="tabular-nums opacity-80">{s ? count(s) : all.length}</span>
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
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className={`rounded-md px-2.5 py-1 ${sort === k ? 'font-bold text-black underline underline-offset-4' : 'text-slate-500'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {shown.map((r) => {
            const on = liked.includes(r.id);
            const linked = (r.sids ?? []).map((s) => toolsById.get(s)).filter(Boolean);
            return (
              <li key={r.id} className="rounded-[12px] border border-[var(--nr-line)] bg-white p-4 sm:p-5">
                <div className="flex gap-4">
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`공감 ${likesOf(r)}`}
                    onClick={() => setLiked((v) => (on ? v.filter((x) => x !== r.id) : [...v, r.id]))}
                    className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-[10px] border text-[13px] font-bold ${
                      on ? 'border-[#f3a6b8] bg-[#fff0f4] text-[#d61e49]' : 'border-[var(--nr-line)] bg-white text-slate-600 hover:border-[#f3a6b8]'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${on ? 'fill-[#d61e49]' : ''}`} aria-hidden="true" />
                    <span className="tabular-nums">{n(likesOf(r))}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                      <span className="rounded-md bg-[#f1f3f6] px-2 py-0.5 text-[12px] font-bold text-slate-700">{r.field}</span>
                      {r.mine ? <PocTag label="내가 남긴 요청" /> : <PocTag />}
                    </div>
                    <h3 className="mt-1.5 text-[17px] font-bold leading-snug text-black">{r.title}</h3>
                    {r.detail && <p className="mt-1 text-[14px] text-slate-600">{r.detail}</p>}
                    <p className="mt-1.5 text-[13px] text-slate-500">
                      {r.who} · {dayLabel(r.at)}
                      {r.maker && <> · {r.maker}</>}
                    </p>
                    {linked.length > 0 && (
                      <div className="mt-3 rounded-[10px] bg-[#f3faf5] px-3 py-2.5">
                        <p className="flex items-center gap-1 text-[13px] font-bold text-[#1f7a3a]">
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> 연결된 도구
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {linked.map((t) => (
                            <li key={t!.sid}>
                              <a href={hrefTool(t!.sid)} className="group flex items-center gap-2 text-[14px]">
                                <SourceTag board={t!.board} className="!px-1.5 !py-0 !text-[11px]" />
                                <span className="min-w-0 truncate font-bold text-slate-900 group-hover:text-[var(--nr-p3)] group-hover:underline">{t!.title}</span>
                                <ArrowRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
