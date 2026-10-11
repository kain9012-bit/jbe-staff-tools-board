import React, { useState } from 'react';
import { ArrowRight, Check, KeyRound, Rocket, Settings2, Sparkles, Undo2, UserPlus, X } from 'lucide-react';
import { OPS, useManage } from '../lib/manage';
import { dayLabel, type ToolStat } from '../lib/stats';
import { PocTag, todayKst, UPGRADE_STAGES, versionOf } from './Poc';

/**
 * 도구 상세 맨 아래 운영 관리 — '운영 부서 계정으로 보기'를 켰을 때만 보임.
 *  · 게시글 수정 권한: 게시글마다 사람을 더하고 뺌(개발자가 바뀌어도 이어서 관리)
 *  · 고도화: 교직원 제작 도구를 검토 → 제작자 동의 → 고도화 개발 → 교육청 배포 전환
 */

const STEP_HINT = [
  '사업부서·협의 내용, 업무 범위, 지침 부합, 유지보수 가능성',
  '원작자 동의 일자, 원작 표시·공동 개발 여부',
  '보강 내용과 새 버전',
  '',
];

export const ManagePanel: React.FC<{ t: ToolStat }> = ({ t }) => {
  const M = useManage();
  const [ops, setOps] = useState(false);
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [ver, setVer] = useState('');
  const editors = M.editors(t);
  const u = M.up(t.sid);
  const isStaff = (t.board ?? 'staff') === 'staff';
  const cur = versionOf(t.title);

  return (
    <section className="mt-10 border-t border-[var(--nr-line)] pt-6">
      <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
        <input type="checkbox" checked={ops} onChange={(e) => setOps(e.target.checked)} className="accent-[var(--nr-p3)]" />
        운영 부서 계정으로 보기 (PoC 시연)
      </label>
      {ops && (
        <div className="mt-3 space-y-4 rounded-[14px] border border-[var(--nr-line)] bg-[#fbfcfe] p-5">
          <h2 className="flex items-center gap-2 text-[18px] font-bold text-black">
            <Settings2 className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 운영 관리 <PocTag />
          </h2>

          {/* 수정 권한 */}
          <div className="rounded-[10px] bg-white p-4 ring-1 ring-[var(--nr-line)]">
            <h3 className="flex items-center gap-1.5 text-[16px] font-bold text-black">
              <KeyRound className="w-4 h-4 text-[var(--nr-p1)]" aria-hidden="true" /> 게시글 수정 권한
            </h3>
            <p className="mt-0.5 text-[13px] text-slate-600">이 도구 글을 고칠 수 있는 사람. 개발자가 바뀌면 여기서 넘겨줌{t.origin && ' · 전환된 도구는 원작자도 계속 수정 가능'}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {editors.map((e) => (
                <li key={e} className="inline-flex items-center gap-1 rounded-full bg-[var(--nr-bg)] py-1 pl-3 pr-1.5 text-[14px] text-slate-800">
                  {e}
                  {e === t.origin && <span className="text-[11px] font-bold text-[#8a5300]">원작자</span>}
                  {e === OPS && <span className="text-[11px] font-bold text-[var(--nr-p3)]">운영</span>}
                  <button
                    type="button"
                    aria-label={`${e} 권한 빼기`}
                    disabled={editors.length <= 1}
                    onClick={() => M.setEditors(t.sid, editors.filter((x) => x !== e))}
                    className="rounded-full p-0.5 text-slate-400 hover:text-[#d61e49] disabled:opacity-30"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = who.trim();
                if (!v || editors.includes(v)) return;
                M.setEditors(t.sid, [...editors, v]);
                setWho('');
              }}
            >
              <label htmlFor="ed-who" className="sr-only">
                권한 줄 사람
              </label>
              <input id="ed-who" value={who} onChange={(e) => setWho(e.target.value)} maxLength={40} placeholder="소속(이름) 예: ○○초등학교(홍길동)" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[14px] focus:border-[var(--nr-p3)] focus:outline-none" />
              <button type="submit" disabled={!who.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--nr-p1)] px-3.5 py-2 text-[14px] font-bold text-white disabled:opacity-40">
                <UserPlus className="w-4 h-4" aria-hidden="true" /> 권한 주기
              </button>
            </form>
          </div>

          {/* 고도화 */}
          {(isStaff || t.origin) && (
            <div className="rounded-[10px] bg-white p-4 ring-1 ring-[var(--nr-line)]">
              <h3 className="flex items-center gap-1.5 text-[16px] font-bold text-black">
                <Sparkles className="w-4 h-4 text-[#e0a800]" aria-hidden="true" /> 고도화 → 교육청 배포 전환
              </h3>
              {!u ? (
                <>
                  <p className="mt-0.5 text-[13px] text-slate-600">사업부서 협의 등 여러 조건을 검토해 교육청 배포 도구로 키울 때 시작. 진행 중에는 일반 교직원 화면에 보이지 않음</p>
                  <button
                    type="button"
                    onClick={() => M.setUp(t.sid, { stage: 0, notes: [], startedAt: todayKst(), title: t.title, maker: t.author })}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#e0a800] px-4 py-2.5 text-[14px] font-bold text-white hover:opacity-90"
                  >
                    <Sparkles className="w-4 h-4" aria-hidden="true" /> 고도화 검토 시작
                  </button>
                </>
              ) : (
                <>
                  <ol className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {UPGRADE_STAGES.map((s, i) => {
                      const done = i < u.stage || !!u.convertedAt;
                      const now = i === u.stage && !u.convertedAt;
                      return (
                        <li key={s} className={`rounded-lg px-3 py-2 text-[13px] ${now ? 'bg-[#e0a800] font-bold text-white' : done ? 'bg-[#fff1d6] font-bold text-[#8a5300]' : 'bg-[#f5f6f8] text-slate-500'}`}>
                          <span className="flex items-center gap-1">
                            {done && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                            {i + 1}. {s}
                          </span>
                          {u.notes[i] && <span className="mt-0.5 block text-[12px] font-normal">{u.notes[i]}</span>}
                        </li>
                      );
                    })}
                  </ol>
                  {u.convertedAt ? (
                    <p className="mt-3 text-[14px] text-[#1f7a3a]">
                      <b>{dayLabel(u.convertedAt)} 교육청 배포 도구로 전환</b>
                      {u.version && ` · v${u.version}`} · 원작자 {t.origin} 수정 권한 유지
                    </p>
                  ) : (
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const notes = [...u.notes];
                        notes[u.stage] = note.trim();
                        if (u.stage < 2) {
                          M.setUp(t.sid, { ...u, stage: u.stage + 1, notes });
                        } else {
                          // 고도화 개발 끝 → 전환
                          const v = ver.trim() || '2.0';
                          notes[2] = [note.trim(), `v${v}`].filter(Boolean).join(' · ');
                          M.setUp(t.sid, { ...u, stage: 3, notes, convertedAt: todayKst(), version: v });
                          if (!M.editors(t).includes(OPS)) M.setEditors(t.sid, [OPS, ...M.editors(t)]);
                        }
                        setNote('');
                        setVer('');
                      }}
                    >
                      <label htmlFor="up-note" className="text-[14px] font-bold text-slate-800">
                        {UPGRADE_STAGES[u.stage]} 기록
                      </label>
                      <input id="up-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder={STEP_HINT[u.stage]} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] focus:border-[var(--nr-p3)] focus:outline-none" />
                      {u.stage === 2 && (
                        <div className="flex items-center gap-2">
                          <label htmlFor="up-ver" className="text-[14px] font-bold text-slate-800">
                            전환 버전 v
                          </label>
                          <input id="up-ver" value={ver} onChange={(e) => setVer(e.target.value)} maxLength={10} placeholder={cur ? String(Number(cur.split('.')[0]) + 1) + '.0' : '2.0'} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-[14px]" />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-bold text-white ${u.stage === 2 ? 'bg-[var(--nr-p2)]' : 'bg-[#e0a800]'}`}>
                          {u.stage === 2 ? (
                            <>
                              <Rocket className="w-4 h-4" aria-hidden="true" /> 교육청 배포로 전환
                            </>
                          ) : (
                            <>
                              다음 단계 <ArrowRight className="w-4 h-4" aria-hidden="true" />
                            </>
                          )}
                        </button>
                        <button type="button" onClick={() => M.setUp(t.sid, null)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-[14px] font-bold text-slate-600">
                          <Undo2 className="w-4 h-4" aria-hidden="true" /> 검토 종료
                        </button>
                      </div>
                      {u.stage === 2 && <p className="text-[12px] text-slate-500">전환하면 구분·문의 창구가 바뀌고, 주소·조회수·후기·질문과 답변은 그대로. 원작자 수정 권한 유지</p>}
                    </form>
                  )}
                  {u.convertedAt && (
                    <button type="button" onClick={() => M.setUp(t.sid, null)} className="mt-2 inline-flex items-center gap-1 text-[13px] text-slate-500 underline underline-offset-2">
                      <Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> 시연 되돌리기
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
