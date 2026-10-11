import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ClipboardList, Eye, FileUp, ShieldCheck, Send } from 'lucide-react';
import { PocNote, todayKst, usePocState, type Submission } from '../components/Poc';
import { PageTitle } from '../components/Shell';
import { WRITE_URL } from '../lib/board';

/**
 * 도구 등록 — 개편 PoC. 게시판 자유 글쓰기 대신 정해진 양식으로 등록하고,
 * 보안 자가점검을 거쳐 검수 현황으로 넘어가는 흐름.
 * 양식 항목은 지금 '한눈에 보기' 요약 항목과 같아서, 등록 내용이 그대로 상세 화면이 됨.
 * 2026. 10. 8. AI 활용 업무경감 현장 간담회 의견(공개 부담, 등록 전 보안 점검)을 반영.
 */

const PURPOSES = ['행정업무', '교육활동', '교무·학사', '범용도구'];
const TARGETS = ['유', '초', '중', '고', '특수', '기관'];
const RUNS = ['웹 접속', 'HTML 파일', '브라우저 확장', '설치 프로그램', '북마크', '구글 시트', 'AI 챗봇', '기타'];

/** 예·아니오로 답하는 자가점검 — 안전한 답 */
const QUESTIONS: { q: string; safe: boolean; hint?: string }[] = [
  { q: '이름·연락처·주민번호 등 개인정보를 도구가 저장하나요?', safe: false },
  { q: '입력한 자료를 외부 서버나 해외 AI로 보내나요?', safe: false, hint: '보낸다면 무엇을 어디로 보내는지 설명란에 밝혀 주세요' },
  { q: '무료 클라우드 DB(구글 시트 등)에 업무 자료를 쌓나요?', safe: false },
  { q: '계정·비밀번호·인증서 정보를 요구하나요?', safe: false },
  { q: '다른 사람이 만든 도구라면 제작자의 공유 동의를 받았나요?', safe: true, hint: '직접 만든 도구면 예' },
  { q: '업무 지침과 다르게 처리하는 부분이 있으면 설명에 밝혔나요?', safe: true },
];

interface Form {
  title: string;
  what: string;
  why: string;
  purpose: string;
  targets: string[];
  run: string;
  features: string;
  steps: string;
  deliver: 'file' | 'url';
  url: string;
  version: string;
  answers: (boolean | null)[];
}

const EMPTY: Form = {
  title: '',
  what: '',
  why: '',
  purpose: '',
  targets: [],
  run: '',
  features: '',
  steps: '',
  deliver: 'file',
  url: '',
  version: '1.0',
  answers: QUESTIONS.map(() => null),
};

const STEPS = [
  { t: '기본 정보', icon: ClipboardList },
  { t: '기능·배포', icon: FileUp },
  { t: '보안 자가점검', icon: ShieldCheck },
  { t: '미리보기·신청', icon: Eye },
];

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean);

const Field: React.FC<{ id: string; label: string; need?: boolean; hint?: string; children: React.ReactNode }> = ({ id, label, need, hint, children }) => (
  <div>
    <label htmlFor={id} className="text-[15px] font-bold text-slate-800">
      {label} {need && <span className="text-[#d61e49]">*</span>}
    </label>
    {hint && <p className="text-[13px] text-slate-500">{hint}</p>}
    <div className="mt-1.5">{children}</div>
  </div>
);

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none';

export const Register: React.FC = () => {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [, setSubs] = usePocState<Submission[]>('submissions', []);
  const [sent, setSent] = useState<Submission | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const ok = [
    f.title.trim() && f.what.trim() && f.purpose && f.targets.length && f.run,
    lines(f.features).length > 0 && lines(f.steps).length > 0 && (f.deliver === 'file' || f.url.trim()),
    f.answers.every((a) => a !== null),
    true,
  ];
  const risky = f.answers.map((a, i) => a !== null && a !== QUESTIONS[i].safe);
  const riskCount = risky.filter(Boolean).length;

  const submit = () => {
    const s: Submission = {
      id: `me-${Date.now()}`,
      title: f.title.trim(),
      what: f.what.trim(),
      purpose: f.purpose,
      run: f.run,
      version: f.version.trim() || '1.0',
      at: todayKst(),
      stage: 1,
      checks: QUESTIONS.length - riskCount,
    };
    setSubs((v) => [s, ...v]);
    setSent(s);
    window.scrollTo(0, 0);
  };

  if (sent) {
    return (
      <>
        <PageTitle>도구 등록</PageTitle>
        <div className="mt-8 rounded-[14px] border-2 border-[#9fd5b0] bg-[#f3faf5] p-6 text-center sm:p-10">
          <Check className="mx-auto w-12 h-12 rounded-full bg-[#1f7a3a] p-2.5 text-white" aria-hidden="true" />
          <h2 className="nr-title mt-4 text-[24px] text-black">등록 신청 완료</h2>
          <p className="mt-2 text-[15px] text-slate-700">
            「{sent.title}」 v{sent.version} · 자가점검 {sent.checks}/{QUESTIONS.length} 통과
          </p>
          <p className="mt-1 text-[14px] text-slate-600">
            {riskCount ? `확인이 필요한 답 ${riskCount}개는 보안 검토에서 함께 살핍니다.` : '보안 검토를 거쳐 게시됩니다.'} 진행 상황은 검수 현황에서 볼 수 있습니다.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <a href="/review" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-5 py-3 text-[15px] font-bold text-white hover:bg-[var(--nr-p3)]">
              검수 현황 보기 <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => {
                setSent(null);
                setF(EMPTY);
                setStep(0);
              }}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-[15px] font-bold text-slate-700"
            >
              다른 도구 등록
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle desc="혼자 쓰던 업무도구, 동료와 나눠 주세요. 정해진 양식으로 등록하면 그대로 도구 소개 화면이 되고, 보안 검토를 거쳐 게시됩니다.">
        도구 등록
      </PageTitle>
      <PocNote className="mt-6">
        PoC 예시 화면입니다. 신청 내용은 이 브라우저에만 저장되고 실제로 게시되지 않습니다. 지금 도구를 올리려면{' '}
        <a href={WRITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2">
          게시판 글쓰기
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
        를 이용해 주세요.
      </PocNote>

      {/* 단계 표시 */}
      <ol className="mt-6 grid grid-cols-4 gap-1.5" aria-label="등록 단계">
        {STEPS.map(({ t, icon: Icon }, i) => (
          <li key={t}>
            <button
              type="button"
              disabled={i > step && !ok.slice(0, i).every(Boolean)}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`flex w-full flex-col items-center gap-1 rounded-[10px] px-1 py-3 text-center text-[13px] sm:flex-row sm:justify-center sm:gap-2 sm:text-[15px] ${
                i === step ? 'bg-[var(--nr-p2)] font-bold text-white' : i < step ? 'bg-[var(--nr-bg)] font-bold text-[var(--nr-p3)]' : 'bg-[#f5f6f8] text-slate-500'
              }`}
            >
              {i < step ? <Check className="w-4 h-4" aria-hidden="true" /> : <Icon className="w-4 h-4" aria-hidden="true" />}
              <span>
                <span className="hidden sm:inline">{i + 1}. </span>
                {t}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-[14px] border border-[var(--nr-line)] bg-white p-5 sm:p-7">
        {step === 0 && (
          <div className="space-y-5">
            <Field id="f-title" label="도구 이름" need hint="버전은 다음 단계에서 따로 적습니다">
              <input id="f-title" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={60} className={input} placeholder="예: 체험학습 버스 좌석 배치" />
            </Field>
            <Field id="f-what" label="한 줄 소개" need hint="무엇을 해 주는 도구인지 45자 안에서 · 이 문장이 검색 결과와 카드에 그대로 보임">
              <input id="f-what" value={f.what} onChange={(e) => set('what', e.target.value)} maxLength={45} className={input} placeholder="예: 나이스 명단으로 버스 좌석 배치도와 모둠표 작성" />
              <p className="mt-1 text-right text-[12px] tabular-nums text-slate-400">{f.what.length}/45</p>
            </Field>
            <Field id="f-why" label="만든 이유" hint="어떤 불편을 줄이는지 · 선택">
              <input id="f-why" value={f.why} onChange={(e) => set('why', e.target.value)} maxLength={70} className={input} placeholder="예: 체험학습 때마다 자리를 손으로 짜는 시간 감소" />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field id="f-purpose" label="사용목적" need>
                <select id="f-purpose" value={f.purpose} onChange={(e) => set('purpose', e.target.value)} className={`${input} bg-white`}>
                  <option value="">선택</option>
                  {PURPOSES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field id="f-run" label="실행 방식" need>
                <select id="f-run" value={f.run} onChange={(e) => set('run', e.target.value)} className={`${input} bg-white`}>
                  <option value="">선택</option>
                  {RUNS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            <fieldset>
              <legend className="text-[15px] font-bold text-slate-800">
                적용기관 <span className="text-[#d61e49]">*</span>
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {TARGETS.map((t) => {
                  const on = f.targets.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('targets', on ? f.targets.filter((x) => x !== t) : [...f.targets, t])}
                      className={`min-w-[3.5rem] rounded-lg px-3 py-2 text-[15px] ${on ? 'bg-[var(--nr-p3)] font-bold text-white' : 'bg-[#f1f3f6] text-slate-700'}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Field id="f-features" label="주요 기능" need hint="한 줄에 하나씩, 3~6개 · 사용자가 얻는 결과 위주">
              <textarea id="f-features" rows={5} value={f.features} onChange={(e) => set('features', e.target.value)} className={input} placeholder={'나이스 엑셀에서 성명·반·번호 자동 인식\n버스 규격별 좌석 자동 배분\nA4 인쇄·PNG 저장'} />
            </Field>
            <Field id="f-steps" label="사용 순서" need hint="한 줄에 하나씩, 2~5단계 · 처음 여는 것부터 결과까지">
              <textarea id="f-steps" rows={4} value={f.steps} onChange={(e) => set('steps', e.target.value)} className={input} placeholder={'주소로 접속\n나이스 명단 엑셀 올리기\n[좌석 배치하기] 누른 뒤 인쇄'} />
            </Field>
            <fieldset>
              <legend className="text-[15px] font-bold text-slate-800">
                배포 방식 <span className="text-[#d61e49]">*</span>
              </legend>
              <div className="mt-1.5 flex gap-2">
                {(
                  [
                    ['file', '파일 올리기'],
                    ['url', '주소 알려 주기'],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={f.deliver === k}
                    onClick={() => set('deliver', k)}
                    className={`rounded-lg px-4 py-2 text-[15px] ${f.deliver === k ? 'bg-[var(--nr-p3)] font-bold text-white' : 'bg-[#f1f3f6] text-slate-700'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {f.deliver === 'file' ? (
                <div className="mt-2 rounded-lg border-2 border-dashed border-slate-300 bg-[#fafafa] px-4 py-6 text-center text-[14px] text-slate-500">
                  <FileUp className="mx-auto mb-1 w-6 h-6" aria-hidden="true" />
                  파일을 끌어 놓거나 눌러서 선택 (PoC에서는 올라가지 않음)
                </div>
              ) : (
                <input aria-label="배포 주소" value={f.url} onChange={(e) => set('url', e.target.value)} className={`${input} mt-2`} placeholder="https://" />
              )}
            </fieldset>
            <Field id="f-ver" label="버전" hint="업데이트할 때마다 올리면 상세 화면에 버전 이력이 쌓이고, 알림 받기를 누른 사람에게 알림이 감">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-slate-600">v</span>
                <input id="f-ver" value={f.version} onChange={(e) => set('version', e.target.value)} maxLength={10} className={`${input} max-w-[8rem]`} />
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-[15px] text-slate-700">답에 따라 보안 검토에서 살필 부분이 정해집니다. '확인 필요' 답이 있어도 신청할 수 있습니다.</p>
            <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
              {QUESTIONS.map((q, i) => (
                <li key={q.q} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[15px] text-slate-900">{q.q}</p>
                    {q.hint && <p className="text-[13px] text-slate-500">{q.hint}</p>}
                    {risky[i] && <p className="text-[13px] font-bold text-[#8a5300]">확인 필요 — 보안 검토에서 함께 살핌</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={q.q}>
                    {(
                      [
                        [true, '예'],
                        [false, '아니오'],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={l}
                        type="button"
                        role="radio"
                        aria-checked={f.answers[i] === v}
                        onClick={() => set('answers', f.answers.map((a, j) => (j === i ? v : a)))}
                        className={`w-20 rounded-lg py-2 text-[15px] ${
                          f.answers[i] === v ? (v === q.safe ? 'bg-[#1f7a3a] font-bold text-white' : 'bg-[#c27b00] font-bold text-white') : 'bg-[#f1f3f6] text-slate-700'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[14px] font-bold text-slate-600">
              {f.answers.filter((a) => a !== null).length} / {QUESTIONS.length} 답함{riskCount > 0 && ` · 확인 필요 ${riskCount}개`}
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-[15px] text-slate-700">게시되면 도구 상세 화면에 이렇게 보입니다.</p>
            <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--nr-line)]">
              <div className="border-b border-[var(--nr-line)] px-5 py-5">
                <div className="flex flex-wrap gap-1.5 text-[12px] font-bold">
                  <span className="rounded-md bg-[#dcefff] px-2 py-0.5 text-[#0a62a8]">교직원 제작</span>
                  <span className="rounded-md bg-[#f1f3f6] px-2 py-0.5 text-slate-700">{f.purpose}</span>
                  <span className="rounded-md bg-[#f1f3f6] px-2 py-0.5 text-slate-700">적용기관 {f.targets.length === TARGETS.length ? '전체' : f.targets.join(',')}</span>
                  <span className="rounded-full bg-[var(--nr-p2)] px-2.5 py-0.5 text-white">{f.run}</span>
                </div>
                <p className="nr-title mt-2 text-[22px] text-black">
                  {f.title} <span className="text-[16px] text-slate-500">v{f.version}</span>
                </p>
                <p className="mt-1 text-[17px] font-bold text-slate-800">{f.what}</p>
                {f.why && <p className="mt-1 text-[15px] text-slate-600">{f.why}</p>}
              </div>
              <div className="grid grid-cols-1 gap-6 px-5 py-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--nr-p2)]">주요 기능</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-slate-800">
                    {lines(f.features).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--nr-p2)]">사용 순서</h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] text-slate-800">
                    {lines(f.steps).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="border-t border-[var(--nr-line)] bg-[var(--nr-bg)] px-5 py-3 text-[14px] text-slate-700">
                보안 자가점검 {QUESTIONS.length - riskCount}/{QUESTIONS.length} 통과{riskCount > 0 && ` · 확인 필요 ${riskCount}개는 보안 검토에서 살핌`}
              </div>
            </div>
          </div>
        )}

        {/* 이전·다음 */}
        <div className="mt-7 flex items-center justify-between gap-2 border-t border-slate-100 pt-5">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2.5 text-[15px] font-bold text-slate-600 disabled:invisible"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 이전
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={!ok[step]}
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--nr-p1)] px-5 py-2.5 text-[15px] font-bold text-white hover:bg-[var(--nr-p3)] disabled:opacity-40"
            >
              다음 <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-5 py-2.5 text-[15px] font-bold text-white hover:bg-[var(--nr-p3)]">
              <Send className="w-4 h-4" aria-hidden="true" /> 등록 신청
            </button>
          )}
        </div>
        {!ok[step] && step < 3 && <p className="mt-2 text-right text-[13px] text-slate-500">* 표시 항목을 채우면 다음으로 넘어갈 수 있음</p>}
      </div>
    </>
  );
};
