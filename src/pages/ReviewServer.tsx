import React, { useState } from 'react';
import { ArrowRight, Ban, CheckCircle2, ChevronDown, Download, LogIn, Rocket, Undo2, X } from 'lucide-react';
import { SourceTag } from '../components/Lists';
import { STAGES, UPGRADE_STAGES } from '../components/Poc';
import { PageTitle } from '../components/Shell';
import { useHashScroll } from '../lib/route';
import { SOURCES } from '../lib/sources';
import { dayLabel } from '../lib/stats';
import { act, errMsg, goLogin, notice, sizeLabel, useSrv, type SrvSubmission } from '../lib/server';
import { CRITERIA, Column, STAGE_INFO, UPGRADE_INFO } from './Review';
import { QUESTIONS } from './Register';

/**
 * 검수 현황(서버판) — 등록 신청 → 자가점검 → 보안 검토 → 게시.
 * 운영자: 모든 신청을 보고 다음 단계·반려·메모. 교직원: 내 신청만 보이고 취소 가능.
 * 새 버전(업데이트) 검토와 고도화 진행도 함께.
 */

const fail = (e: unknown) => notice(errMsg(e), 'err');

const Card: React.FC<{ s: SrvSubmission; ops: boolean; col: number }> = ({ s, ops, col }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(s.note ?? '');
  const go = (action: string, extra: Record<string, unknown> = {}) =>
    act('POST', `/api/review/${encodeURIComponent(s.id)}`, { action, note, ...extra }, action === 'advance' && col === 2).catch(fail);
  const risky = (s.answers ?? []).map((a, i) => a !== QUESTIONS[i]?.safe);
  return (
    <li className={`rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${s.mine ? 'ring-2 ring-[var(--nr-p1)]' : ''} ${s.status === 'rejected' ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-center gap-1">
        {s.mine && <span className="rounded-full bg-[var(--nr-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--nr-p3)]">내 신청</span>}
        <SourceTag board={s.board} className="!px-1.5 !py-0 !text-[11px]" />
        {s.run && <span className="rounded bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{s.run}</span>}
        {s.status === 'rejected' && <span className="rounded bg-[#fdecef] px-1.5 py-0.5 text-[11px] font-bold text-[#b0123a]">반려</span>}
      </div>
      <p className="mt-1.5 text-[15px] font-bold leading-snug text-black">
        {s.status === 'published' ? (
          <a href={`/tool/${s.id}`} className="hover:text-[var(--nr-p3)] hover:underline">
            {s.title}
          </a>
        ) : (
          s.title
        )}{' '}
        <span className="text-[12px] font-normal text-slate-500">v{s.version}</span>
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{s.what}</p>
      <p className="mt-1.5 text-[12px] text-slate-500">
        {dayLabel(s.at)} 신청 · 자가점검 {s.checks}/6{ops && ` · ${s.author}`}
      </p>
      {s.note && !ops && <p className="mt-1 text-[12px] font-bold text-[#8a5300]">{s.note}</p>}
      {col === STAGES.length - 1 && (
        <p className="mt-1 flex items-center gap-1 text-[12px] font-bold text-[#1f7a3a]">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> 게시 완료
        </p>
      )}

      {s.status !== 'published' && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 inline-flex items-center gap-0.5 text-[12px] font-bold text-slate-500 hover:text-[var(--nr-p3)]">
          내용 {open ? '접기' : '보기'} <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className="mt-2 space-y-2 rounded-md bg-[#fafafa] p-2.5 text-[13px] text-slate-700">
          {s.summary?.why && <p>{s.summary.why}</p>}
          {!!s.summary?.features?.length && (
            <ul className="list-disc pl-4">
              {s.summary.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-slate-500">
            {s.purpose} · 적용기관 {s.target}
            {s.org && ` · ${s.org}`}
            {s.region && ` · ${s.region}`}
          </p>
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="block break-all font-bold text-[var(--nr-p3)] underline">
              {s.url}
            </a>
          )}
          {s.files.map((f) => (
            <a key={f.id} href={f.url} download className="flex items-center gap-1 font-bold text-[var(--nr-p3)] hover:underline">
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> {f.name} <span className="font-normal text-slate-500">{sizeLabel(f.size)}</span>
            </a>
          ))}
          {s.deliver !== 'url' && !s.files.length && <p className="font-bold text-[#b0123a]">올린 파일 없음</p>}
          {s.answers && (
            <ul className="space-y-0.5 border-t border-slate-200 pt-2">
              {QUESTIONS.map((q, i) => (
                <li key={q.q} className={risky[i] ? 'font-bold text-[#8a5300]' : 'text-slate-500'}>
                  {risky[i] ? '확인 필요 · ' : ''}
                  {q.q} — {s.answers?.[i] ? '예' : '아니오'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ops && s.status === 'pending' && (
        <div className="mt-2 space-y-1.5">
          <label className="sr-only" htmlFor={`note-${s.id}`}>
            검수 메모
          </label>
          <input
            id={`note-${s.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (s.note ?? '') && go('note')}
            maxLength={100}
            placeholder="검수 메모 (신청자에게 보임)"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[13px]"
          />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => go('advance')} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[var(--nr-p1)] py-1.5 text-[13px] font-bold text-white hover:bg-[var(--nr-p3)]">
              {col === 2 ? (
                <>
                  <Rocket className="w-3.5 h-3.5" aria-hidden="true" /> 게시
                </>
              ) : (
                <>
                  다음 단계 <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </>
              )}
            </button>
            <button type="button" onClick={() => go('reject')} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px] font-bold text-slate-600 hover:text-[#b0123a]">
              <Ban className="w-3.5 h-3.5" aria-hidden="true" /> 반려
            </button>
          </div>
        </div>
      )}
      {ops && s.status === 'rejected' && (
        <button type="button" onClick={() => go('reopen')} className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-[var(--nr-p3)]">
          <Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> 다시 검토
        </button>
      )}
      {!ops && s.mine && s.status !== 'published' && (
        <button
          type="button"
          onClick={() => act('DELETE', `/api/submissions/${encodeURIComponent(s.id)}`).catch(fail)}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-[#b0123a]"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" /> 신청 취소
        </button>
      )}
    </li>
  );
};

export const ReviewServer: React.FC = () => {
  useHashScroll();
  const S = useSrv();
  const [kind, setKind] = useState('');
  const ops = !!S.me?.ops;
  const all = S.submissions.filter((s) => s.status !== 'hidden' && (!kind || (s.board ?? 'staff') === kind));
  const upList = Object.entries(S.upgrades).map(([sid, u]) => ({ sid, ...u }));

  return (
    <>
      <PageTitle desc="세 구분 모두 같은 절차를 거칩니다. 등록 신청한 도구가 어느 단계에 있는지, 새 버전과 고도화가 어디까지 왔는지 확인합니다.">검수 현황</PageTitle>

      {S.ready && !S.me && (
        <p className="mt-6 flex flex-wrap items-center gap-3 rounded-[10px] bg-[var(--nr-bg)] px-4 py-3 text-[15px] text-slate-700">
          로그인하면 내가 신청한 도구의 진행 상황을 볼 수 있습니다.
          <button type="button" onClick={goLogin} className="inline-flex items-center gap-1 rounded-lg bg-[var(--nr-p1)] px-3 py-1.5 text-[14px] font-bold text-white">
            <LogIn className="w-4 h-4" aria-hidden="true" /> 로그인
          </button>
        </p>
      )}
      {S.me && !ops && (
        <p className="mt-6 rounded-[10px] bg-[var(--nr-bg)] px-4 py-3 text-[14px] text-slate-700">내가 신청한 도구만 보입니다. 검수 메모는 담당자가 남긴 확인 사항입니다.</p>
      )}

      {/* 등록 검수 */}
      <section aria-labelledby="rv-h" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rv-h" className="nr-title text-[22px] text-black">
            등록 검수 <span className="text-[14px] font-normal text-slate-500">{STAGES.join(' → ')}</span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {[{ key: '', name: '전체' }, ...SOURCES.map((x) => ({ key: x.key, name: x.name }))].map((x) => (
              <button
                key={x.key || 'all'}
                type="button"
                aria-pressed={kind === x.key}
                onClick={() => setKind(x.key)}
                className={`rounded-full px-3 py-1.5 text-[13px] ${kind === x.key ? 'bg-[var(--nr-p3)] font-bold text-white' : 'bg-[var(--nr-bg)] text-slate-700'}`}
              >
                {x.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((name, i) => {
            const items = all.filter((s) => (s.status === 'published' ? 3 : s.stage) === i);
            return (
              <Column key={name} icon={STAGE_INFO[i].icon} no={i + 1} name={name} desc={i === 3 ? '최근 30일 게시' : STAGE_INFO[i].desc} count={items.length}>
                {items.map((s) => (
                  <Card key={s.id} s={s} ops={ops} col={i} />
                ))}
                {items.length === 0 && <li className="px-1 py-4 text-center text-[13px] text-slate-400">없음</li>}
              </Column>
            );
          })}
        </div>
        {S.me && !ops && all.length === 0 && (
          <p className="mt-3 text-[14px] text-slate-600">
            아직 신청한 도구가 없습니다.{' '}
            <a href="/register" className="font-bold text-[var(--nr-p3)] underline underline-offset-2">
              도구 등록
            </a>
          </p>
        )}
      </section>

      {/* 새 버전 검토 */}
      {(ops || S.updates.length > 0) && (
        <section className="mt-14">
          <h2 className="nr-title text-[22px] text-black">
            새 버전 검토 <span className="text-[14px] font-normal text-slate-500">게시된 도구의 업데이트</span>
          </h2>
          {S.updates.length ? (
            <ul className="mt-3 divide-y divide-slate-100 rounded-[10px] border border-[var(--nr-line)] bg-white">
              {S.updates.map((u) => (
                <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <SourceTag board={u.board} className="!px-1.5 !py-0 !text-[11px]" />
                      <a href={`/tool/${u.sid}`} className="font-bold text-slate-900 hover:text-[var(--nr-p3)] hover:underline">
                        {u.title}
                      </a>
                      <span className="text-[13px] font-bold text-[#8a5300]">v{u.version}</span>
                    </p>
                    <p className="text-[13px] text-slate-600">
                      {dayLabel(u.at)} · {u.note}
                    </p>
                    {u.files.map((f) => (
                      <a key={f.id} href={f.url} download className="mr-3 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--nr-p3)] hover:underline">
                        <Download className="w-3.5 h-3.5" aria-hidden="true" /> {f.name}
                      </a>
                    ))}
                  </div>
                  {ops ? (
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={() => act('POST', `/api/review/versions/${u.id}`, { action: 'approve' }, true).catch(fail)} className="rounded-md bg-[var(--nr-p1)] px-3 py-1.5 text-[13px] font-bold text-white">
                        게시
                      </button>
                      <button type="button" onClick={() => act('POST', `/api/review/versions/${u.id}`, { action: 'reject' }).catch(fail)} className="rounded-md border border-slate-300 px-3 py-1.5 text-[13px] font-bold text-slate-600">
                        반려
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-[13px] font-bold text-[#8a5300]">보안 검토 중</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-slate-500">검토할 새 버전 없음</p>
          )}
        </section>
      )}

      {/* 고도화 */}
      <section aria-labelledby="up-h" className="mt-14">
        <h2 id="up-h" className="nr-title text-[22px] text-black">
          고도화 진행 <span className="text-[14px] font-normal text-slate-500">교직원 제작 → 교육청 배포 전환</span>
        </h2>
        <p className="mt-1 text-[14px] text-slate-600">
          교직원 제작 도구 중 사업부서와 협의해 여러 조건을 갖춘 도구를 정책기획과가 다듬어 교육청 배포 도구로 전환. 전환 뒤에도 도구 화면·주소·후기·조회수는 그대로 이어지고 구분과 책임 주체만 바뀜
          {!ops && ' · 진행 중인 건은 운영 부서에만 보임'}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {UPGRADE_STAGES.map((name, i) => {
            const items = upList.filter((u) => (u.convertedAt ? 3 : u.stage) === i);
            return (
              <Column key={name} icon={UPGRADE_INFO[i].icon} no={i + 1} name={name} desc={UPGRADE_INFO[i].desc} count={items.length}>
                {items.map((u) => (
                  <li key={u.sid} className="rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                    <SourceTag board={i === 3 ? 'official' : 'staff'} className="!px-1.5 !py-0 !text-[11px]" />
                    <p className="mt-1.5 text-[15px] font-bold leading-snug text-black">
                      <a href={`/tool/${u.sid}`} className="hover:text-[var(--nr-p3)] hover:underline">
                        {u.title}
                      </a>
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">원작 {u.maker}</p>
                    {u.notes.filter(Boolean).slice(-1)[0] && <p className="mt-1 text-[12px] font-bold text-[#8a5300]">{u.notes.filter(Boolean).slice(-1)[0]}</p>}
                  </li>
                ))}
                {items.length === 0 && <li className="px-1 py-4 text-center text-[13px] text-slate-400">없음</li>}
              </Column>
            );
          })}
        </div>
        {ops && <p className="mt-2 text-[13px] text-slate-500">고도화 시작·단계 진행은 도구 화면 맨 아래 '운영 관리'에서</p>}
      </section>

      {/* 검수 기준 */}
      <section className="mt-14">
        <h2 className="nr-title text-[22px] text-black">보안 검토 기준</h2>
        <p className="mt-1 text-[14px] text-slate-600">세 구분에 같은 기준 적용</p>
        <dl className="mt-4 overflow-hidden rounded-[10px] border border-[var(--nr-line)]">
          {CRITERIA.map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 gap-1 border-t border-[var(--nr-line)] px-4 py-3 first:border-t-0 sm:grid-cols-[8rem_1fr]">
              <dt className="font-bold text-slate-900">{k}</dt>
              <dd className="text-[15px] text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
};
