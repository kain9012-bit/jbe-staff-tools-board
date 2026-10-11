import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, FileSearch, Handshake, Megaphone, Rocket, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { SourceTag } from '../components/Lists';
import { PocNote, PocTag, STAGES, UPGRADE_STAGES, usePocState, type Submission } from '../components/Poc';
import { PageTitle } from '../components/Shell';
import { useHashScroll } from '../lib/route';
import { SOURCES } from '../lib/sources';
import { dayLabel } from '../lib/stats';

/**
 * 검수 현황 — 세 구분 모두 같은 절차(등록 신청 → 자가점검 → 보안 검토 → 게시).
 * 아래에 고도화 진행(교직원 제작 → 교육청 배포 전환)을 함께 보여 줌.
 * '(예시)' 카드는 흐름을 보여 주기 위한 가상의 신청
 */

const SAMPLES: Submission[] = [
  { id: 's1', board: 'staff', title: '(예시) 성적 일람표 서식 변환기', what: '나이스 성적 엑셀을 학교 서식으로 변환', purpose: '교무·학사', run: 'HTML 파일', version: '1.0', at: '2026-10-10', stage: 0, checks: 0 },
  { id: 'x1', board: 'external', title: '(예시) 학교 공간 예약 웹', what: '특별실 예약을 달력으로 관리', purpose: '행정업무', run: '웹 접속', version: '2.0', at: '2026-10-09', stage: 0, checks: 0, org: '○○도교육청 ○○초' },
  { id: 's2', board: 'staff', title: '(예시) 출장 여비 자동 계산', what: '출장 기록으로 여비 정산 금액 계산', purpose: '행정업무', run: '웹 접속', version: '2.1', at: '2026-10-08', stage: 1, checks: 6 },
  { id: 'o1', board: 'official', title: '(예시) 학교회계 결산 점검 도우미', what: '결산 자료의 누락·불일치 자동 점검', purpose: '행정업무', run: '설치 프로그램', version: '1.0', at: '2026-10-07', stage: 2, checks: 6, note: '실행 파일 백신 검사 중' },
  { id: 's3', board: 'staff', title: '(예시) 학부모 안내문 AI 초안', what: '행사 개요로 가정통신문 초안 작성', purpose: '교육활동', run: 'AI 챗봇', version: '1.0', at: '2026-10-06', stage: 2, checks: 5, note: '외부 AI 전송 범위 확인 중' },
  { id: 'x2', board: 'external', title: '(예시) 교원 호봉 계산기', what: '경력으로 호봉·승급일 계산', purpose: '행정업무', run: '웹 접속', version: '1.4', at: '2026-10-03', stage: 2, checks: 6, org: '○○교육청', region: '○○ 기준', note: '지역 지침 차이 확인 중' },
  { id: 's5', board: 'staff', title: '(예시) 교실 타이머', what: '전자칠판용 수업 타이머', purpose: '교육활동', run: '웹 접속', version: '1.0', at: '2026-09-29', stage: 3, checks: 6 },
];

const STAGE_INFO = [
  { icon: ClipboardCheck, desc: '공통 양식 접수 · 필수 항목 확인' },
  { icon: FileSearch, desc: '보안 자가점검 6문항' },
  { icon: ShieldCheck, desc: '담당자가 외부 전송·개인정보·실행 파일 확인' },
  { icon: Megaphone, desc: '도구 찾기에 게시 · 요청자·구독자 알림' },
];

/** 고도화 진행 예시 — 실제 진행 중인 도구가 아님 */
const UPGRADES = [
  { id: 'u1', title: '(예시) 교직원 제작 출결 집계 도구', maker: '○○초 교사', stage: 0, note: '사업부서(○○과) 협의 · 적용 범위 검토 중' },
  { id: 'u2', title: '(예시) 교직원 제작 계약 서류 점검표', maker: '○○고 행정실', stage: 1, note: '제작자 동의 요청 · 원작 표시 협의' },
  { id: 'u3', title: '(예시) 교직원 제작 물품 대장 정리기', maker: '○○중 행정실', stage: 2, note: '보안 보강 · 설치형 → 웹 전환' },
  { id: 'u4', title: '(예시) 교직원 제작 수신자 그룹 등록기', maker: '○○지원청 주무관', stage: 3, note: '교육청 배포 도구로 전환 · 후기·조회수 이어받음' },
];
const UPGRADE_INFO = [
  { icon: Sparkles, desc: '사업부서 협의 · 업무 범위·지침 부합·유지보수 가능성 등 검토. 활용도 자료는 참고' },
  { icon: Handshake, desc: '제작자 동의 · 원작 표시 · 공동 개발 여부' },
  { icon: Wrench, desc: '정책기획과가 보안·기능 보강, 버전 올림' },
  { icon: Rocket, desc: '구분을 교육청 배포로 바꿈 · 같은 도구 화면 유지' },
];

const CRITERIA = [
  ['개인정보', '도구가 개인정보를 저장·전송하지 않는지, 한다면 범위와 보관 기간이 밝혀져 있는지'],
  ['외부 전송', '외부 서버·해외 AI로 보내는 자료가 무엇인지, 끌 수 있는지'],
  ['실행 파일', '설치 프로그램·매크로 파일의 백신 검사, 출처·제작자 표기'],
  ['계정 정보', '업무포털·나이스 등 계정·인증서를 요구하거나 저장하지 않는지'],
  ['지침 일치', '업무 지침과 다르게 처리하는 부분이 소개에 밝혀져 있는지. 외부 공공은 기준 지역 확인'],
  ['버전 표기', '버전과 바뀐 내용이 적혀 있어 사용자가 최신판을 구분할 수 있는지'],
];

const Column: React.FC<{ icon: typeof Sparkles; no: number; name: string; desc: string; count: number; children: React.ReactNode }> = ({ icon: Icon, no, name, desc, count, children }) => (
  <div className="flex flex-col rounded-[12px] bg-[#f5f7fa] p-3">
    <div className="px-1 pb-2">
      <h3 className="flex items-center gap-1.5 text-[16px] font-bold text-black">
        <Icon className="w-4 h-4 text-[var(--nr-p1)]" aria-hidden="true" />
        {no}. {name}
        <span className="ml-auto rounded-full bg-white px-2 text-[13px] tabular-nums text-slate-600">{count}</span>
      </h3>
      <p className="text-[12px] text-slate-500">{desc}</p>
    </div>
    <ul className="flex-1 space-y-2">{children}</ul>
  </div>
);

export const Review: React.FC = () => {
  useHashScroll();
  const [mine, setMine] = usePocState<Submission[]>('submissions', []);
  const [kind, setKind] = useState('');
  const all: (Submission & { mine?: boolean })[] = [...mine.map((s) => ({ ...s, mine: true })), ...SAMPLES].filter((s) => !kind || (s.board ?? 'staff') === kind);
  const advance = (id: string) => setMine((v) => v.map((s) => (s.id === id ? { ...s, stage: Math.min(STAGES.length - 1, s.stage + 1) } : s)));

  return (
    <>
      <PageTitle desc="세 구분 모두 같은 절차를 거칩니다. 등록 신청한 도구가 어느 단계에 있는지, 고도화 중인 도구가 어디까지 왔는지 확인합니다.">검수 현황</PageTitle>
      <PocNote className="mt-6">
        PoC 예시 화면입니다. '(예시)' 카드는 흐름을 보여 주기 위한 가상의 신청이고, 도구 등록에서 직접 낸 신청은 '내 신청'으로 맨 앞에 보이며 '다음 단계'로 진행을 시연할 수 있습니다.
      </PocNote>

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
            const items = all.filter((s) => s.stage === i);
            return (
              <Column key={name} icon={STAGE_INFO[i].icon} no={i + 1} name={name} desc={STAGE_INFO[i].desc} count={items.length}>
                {items.map((s) => (
                  <li key={s.id} className={`rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${s.mine ? 'ring-2 ring-[var(--nr-p1)]' : ''}`}>
                    <div className="flex flex-wrap items-center gap-1">
                      {s.mine && <PocTag label="내 신청" />}
                      <SourceTag board={s.board} className="!px-1.5 !py-0 !text-[11px]" />
                      <span className="rounded bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{s.run}</span>
                    </div>
                    <p className="mt-1.5 text-[15px] font-bold leading-snug text-black">
                      {s.title} <span className="text-[12px] font-normal text-slate-500">v{s.version}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{s.what}</p>
                    <p className="mt-1.5 text-[12px] text-slate-500">
                      {dayLabel(s.at)} 신청{i >= 1 && ` · 자가점검 ${s.checks}/6`}
                      {s.org && ` · ${s.org}`}
                      {s.region && ` · ${s.region}`}
                    </p>
                    {s.note && <p className="mt-1 text-[12px] font-bold text-[#8a5300]">{s.note}</p>}
                    {i === STAGES.length - 1 && (
                      <p className="mt-1 flex items-center gap-1 text-[12px] font-bold text-[#1f7a3a]">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> 게시 완료
                      </p>
                    )}
                    {s.mine && i < STAGES.length - 1 && (
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
              </Column>
            );
          })}
        </div>
        {mine.length === 0 && (
          <p className="mt-3 text-[14px] text-slate-600">
            직접 신청해 보려면{' '}
            <a href="/register" className="font-bold text-[var(--nr-p3)] underline underline-offset-2">
              도구 등록
            </a>
            에서 양식을 채워 보세요.
          </p>
        )}
      </section>

      {/* 고도화 */}
      <section aria-labelledby="up-h" className="mt-14">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="up-h" className="nr-title text-[22px] text-black">
            고도화 진행 <span className="text-[14px] font-normal text-slate-500">교직원 제작 → 교육청 배포 전환</span>
          </h2>
          <PocTag />
        </div>
        <p className="mt-1 text-[14px] text-slate-600">
          교직원 제작 도구 중 사업부서와 협의해 여러 조건을 갖춘 도구를 정책기획과가 다듬어 교육청 배포 도구로 전환. 조회수·후기는 참고 자료일 뿐 선정 기준이 아님. 전환 뒤에도 도구 화면·주소·후기·조회수는 그대로 이어지고 구분과 책임 주체만 바뀜
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {UPGRADE_STAGES.map((name, i) => {
            const items = UPGRADES.filter((u) => u.stage === i);
            return (
              <Column key={name} icon={UPGRADE_INFO[i].icon} no={i + 1} name={name} desc={UPGRADE_INFO[i].desc} count={items.length}>
                {items.map((u) => (
                  <li key={u.id} className="rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                    <div className="flex flex-wrap items-center gap-1">
                      <SourceTag board={i === 3 ? 'official' : 'staff'} className="!px-1.5 !py-0 !text-[11px]" />
                      {i === 3 && <span className="text-[11px] font-bold text-slate-500">← 교직원 제작</span>}
                    </div>
                    <p className="mt-1.5 text-[15px] font-bold leading-snug text-black">{u.title}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">원작 {u.maker}</p>
                    <p className="mt-1 text-[12px] font-bold text-[#8a5300]">{u.note}</p>
                  </li>
                ))}
              </Column>
            );
          })}
        </div>
      </section>

      {/* 검수 기준 */}
      <section className="mt-14">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="nr-title text-[22px] text-black">보안 검토 기준</h2>
          <PocTag label="제안" />
        </div>
        <p className="mt-1 text-[14px] text-slate-600">세 구분에 같은 기준 적용. 2026. 10. 8. AI 활용 업무경감 현장 간담회의 '등록 전 보안 점검' 의견을 반영한 제안</p>
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
