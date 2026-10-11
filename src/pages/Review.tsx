import React from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, FileSearch, Megaphone, ShieldCheck } from 'lucide-react';
import { PocNote, PocTag, STAGES, usePocState, type Submission } from '../components/Poc';
import { PageTitle } from '../components/Shell';
import { dayLabel } from '../lib/stats';

/**
 * 검수 현황 — 등록 신청이 게시되기까지의 단계를 보여 줌(개편 PoC).
 * 예시 카드는 흐름을 보여 주기 위한 가상의 신청. 내가 등록 화면에서 낸 신청은 맨 앞에 붙고 '다음 단계' 시연 가능
 */

const SAMPLES: (Submission & { note?: string })[] = [
  { id: 's1', title: '(예시) 성적 일람표 서식 변환기', what: '나이스 성적 엑셀을 학교 서식으로 변환', purpose: '교무·학사', run: 'HTML 파일', version: '1.0', at: '2026-10-10', stage: 0, checks: 0 },
  { id: 's2', title: '(예시) 출장 여비 자동 계산', what: '출장 기록으로 여비 정산 금액 계산', purpose: '행정업무', run: '웹 접속', version: '2.1', at: '2026-10-08', stage: 1, checks: 6 },
  { id: 's3', title: '(예시) 학부모 안내문 AI 초안', what: '행사 개요로 가정통신문 초안 작성', purpose: '교육활동', run: 'AI 챗봇', version: '1.0', at: '2026-10-06', stage: 2, checks: 5, note: '외부 AI 전송 범위 확인 중' },
  { id: 's4', title: '(예시) 계약 서류 점검표', what: '수의계약 서류 누락 여부 점검', purpose: '행정업무', run: '설치 프로그램', version: '1.3', at: '2026-10-02', stage: 2, checks: 6, note: '실행 파일 백신 검사 중' },
  { id: 's5', title: '(예시) 교실 타이머', what: '전자칠판용 수업 타이머', purpose: '교육활동', run: '웹 접속', version: '1.0', at: '2026-09-29', stage: 3, checks: 6 },
];

const STAGE_INFO = [
  { icon: ClipboardCheck, desc: '양식 접수 · 필수 항목 확인' },
  { icon: FileSearch, desc: '제작자 보안 자가점검 6문항' },
  { icon: ShieldCheck, desc: '담당자가 외부 전송·개인정보·실행 파일 확인' },
  { icon: Megaphone, desc: '도구 찾기에 게시 · 요청자·구독자 알림' },
];

const CRITERIA = [
  ['개인정보', '도구가 개인정보를 저장·전송하지 않는지, 한다면 범위와 보관 기간이 밝혀져 있는지'],
  ['외부 전송', '외부 서버·해외 AI로 보내는 자료가 무엇인지, 끌 수 있는지'],
  ['실행 파일', '설치 프로그램·매크로 파일의 백신 검사, 출처·제작자 표기'],
  ['계정 정보', '업무포털·나이스 등 계정·인증서를 요구하거나 저장하지 않는지'],
  ['지침 일치', '업무 지침과 다르게 처리하는 부분이 소개에 밝혀져 있는지'],
  ['버전 표기', '버전과 바뀐 내용이 적혀 있어 사용자가 최신판을 구분할 수 있는지'],
];

export const Review: React.FC = () => {
  const [mine, setMine] = usePocState<Submission[]>('submissions', []);
  const all: (Submission & { note?: string; mine?: boolean })[] = [...mine.map((s) => ({ ...s, mine: true })), ...SAMPLES];
  const advance = (id: string) => setMine((v) => v.map((s) => (s.id === id ? { ...s, stage: Math.min(3, s.stage + 1) } : s)));

  return (
    <>
      <PageTitle desc="등록 신청한 도구가 어느 단계에 있는지 확인합니다. 보안 검토를 거친 도구만 도구 찾기에 게시됩니다.">검수 현황</PageTitle>
      <PocNote className="mt-6">
        PoC 예시 화면입니다. '(예시)' 신청은 흐름을 보여 주기 위한 가상의 신청이고, 도구 등록에서 직접 낸 신청은 '내 신청'으로 맨 앞에 보입니다. 내 신청은 '다음 단계'로 진행을 시연할 수 있습니다.
      </PocNote>

      {/* 단계별 칸 */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((name, i) => {
          const Icon = STAGE_INFO[i].icon;
          const items = all.filter((s) => s.stage === i);
          return (
            <section key={name} aria-labelledby={`st-${i}`} className="flex flex-col rounded-[12px] bg-[#f5f7fa] p-3">
              <div className="px-1 pb-2">
                <h2 id={`st-${i}`} className="flex items-center gap-1.5 text-[16px] font-bold text-black">
                  <Icon className="w-4 h-4 text-[var(--nr-p1)]" aria-hidden="true" />
                  {i + 1}. {name}
                  <span className="ml-auto rounded-full bg-white px-2 text-[13px] tabular-nums text-slate-600">{items.length}</span>
                </h2>
                <p className="text-[12px] text-slate-500">{STAGE_INFO[i].desc}</p>
              </div>
              <ul className="flex-1 space-y-2">
                {items.map((s) => (
                  <li key={s.id} className={`rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${s.mine ? 'ring-2 ring-[var(--nr-p1)]' : ''}`}>
                    <div className="flex flex-wrap items-center gap-1">
                      {s.mine ? <PocTag label="내 신청" /> : null}
                      <span className="rounded bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{s.purpose}</span>
                      <span className="rounded bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{s.run}</span>
                    </div>
                    <p className="mt-1.5 text-[15px] font-bold leading-snug text-black">
                      {s.title} <span className="text-[12px] font-normal text-slate-500">v{s.version}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{s.what}</p>
                    <p className="mt-1.5 text-[12px] text-slate-500">
                      {dayLabel(s.at)} 신청{i >= 1 && ` · 자가점검 ${s.checks}/6`}
                    </p>
                    {s.note && <p className="mt-1 text-[12px] font-bold text-[#8a5300]">{s.note}</p>}
                    {i === 3 && (
                      <p className="mt-1 flex items-center gap-1 text-[12px] font-bold text-[#1f7a3a]">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> 게시 완료
                      </p>
                    )}
                    {s.mine && i < 3 && (
                      <button
                        type="button"
                        onClick={() => advance(s.id)}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-[var(--nr-bg)] py-1.5 text-[13px] font-bold text-[var(--nr-p3)] hover:bg-[#dcebff]"
                      >
                        다음 단계 (시연) <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
                {items.length === 0 && <li className="px-1 py-4 text-center text-[13px] text-slate-400">없음</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {mine.length === 0 && (
        <p className="mt-4 text-[14px] text-slate-600">
          직접 신청해 보려면{' '}
          <a href="/register" className="font-bold text-[var(--nr-p3)] underline underline-offset-2">
            도구 등록
          </a>
          에서 양식을 채워 보세요.
        </p>
      )}

      {/* 검수 기준 */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="nr-title text-[22px] text-black">보안 검토 기준</h2>
          <PocTag label="제안" />
        </div>
        <p className="mt-1 text-[14px] text-slate-600">공식 기준이 정해지기 전의 제안. 2026. 10. 8. AI 활용 업무경감 현장 간담회의 '등록 전 보안 점검' 의견을 반영</p>
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
