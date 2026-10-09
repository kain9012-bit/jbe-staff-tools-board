import React, { useState } from 'react';
import { ArrowUpRight, Check, ClipboardCopy, ShieldCheck } from 'lucide-react';
import { PageTitle } from '../components/Shell';
import { BOARD_URL, WRITE_URL } from '../lib/board';

/**
 * 도구 등록 안내 — 게시판 '교직원 제작 도구 게시판 이용 안내' 공지 내용을 바탕으로,
 * 2026. 10. 8. AI 활용 업무경감 현장 간담회 의견(공개 부담, 등록 전 보안 점검)을 반영.
 * 보안 점검표는 공식 기준이 확정되기 전의 자가점검용.
 */

const TEMPLATE = `[도구명]

## [만든 이유]
어떤 업무의 불편을 해결했는지

## [주요 기능]
*

## [사용방법]
1.
2.

## [실행 환경 및 유의사항] ※ 선택
실행 환경 · 현재 버전과 수정일 · 사용 시 유의사항 · 문의 방법

[첨부파일 또는 배포 주소]`;

const CHECKS = [
  '개인정보(이름·연락처·주민번호 등)를 도구가 저장하거나 외부로 보내지 않음',
  '무료 클라우드 DB(구글 시트 등)에 개인정보를 쌓지 않음',
  '해외 AI API를 쓴다면 개인정보가 들어가지 않게 막아 둠',
  '계정·비밀번호·인증서 정보를 요구하거나 저장하지 않음',
  '타인이 만든 도구라면 제작자의 공유 동의를 받음',
  '업무 지침과 다르게 처리하는 부분이 있으면 게시글에 밝힘',
];

const Step: React.FC<{ no: number; title: string; children: React.ReactNode }> = ({ no, title, children }) => (
  <li className="flex gap-4 rounded-[10px] border border-[var(--nr-line)] bg-white p-5">
    <span className="nr-title flex w-10 h-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--nr-bg)] text-[20px] text-[var(--nr-p3)]">{no}</span>
    <div>
      <h3 className="text-[17px] font-bold text-black">{title}</h3>
      <div className="mt-1 text-[15px] text-slate-700">{children}</div>
    </div>
  </li>
);

export const Register: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const done = checked.every(Boolean);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 복사 권한이 없으면 아래 상자에서 직접 선택 */
    }
  };

  return (
    <>
      <PageTitle desc="혼자 쓰던 업무도구, 동료와 나눠 주세요. 거창한 프로그램이 아니어도 실제 업무에 도움이 되면 충분합니다.">도구 등록</PageTitle>

      <section className="mt-8">
        <h2 className="nr-title text-[22px] text-black">어떤 도구를 올릴 수 있나요?</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-[15px]">
          {[
            '반복 입력·정리·검사·변환 작업을 줄여 주는 도구',
            '엑셀 서식·매크로, 한글 문서 자동화 파일',
            'HTML 단일 파일, 웹 도구, 브라우저 확장 프로그램',
            'Python 프로그램, GPTs 등 업무에 쓸 수 있는 도구',
          ].map((t) => (
            <li key={t} className="rounded-[10px] bg-[var(--nr-bg)] px-4 py-3">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="nr-title text-[22px] text-black">등록 순서</h2>
        <ol className="mt-3 space-y-2">
          <Step no={1} title="보안 자가점검">
            아래 점검표를 먼저 확인합니다.
          </Step>
          <Step no={2} title="게시글 양식 복사">
            도구명 · 만든 이유 · 주요 기능과 사용방법 · 파일이나 배포 주소, 네 가지만 쓰면 됩니다.
          </Step>
          <Step no={3} title="게시판에서 글쓰기">
            누리집에 로그인한 뒤 글쓰기에서 양식을 붙여 넣고, 파일이나 주소를 넣어 등록합니다. 등록한 도구는 1~2시간 안에 이 화면에 나타납니다.
          </Step>
        </ol>
      </section>

      <section className="mt-10 rounded-[10px] border-2 border-[var(--nr-p1)] p-5 sm:p-6">
        <h2 className="nr-title flex items-center gap-2 text-[22px] text-black">
          <ShieldCheck className="w-6 h-6 text-[var(--nr-p1)]" aria-hidden="true" />
          보안 자가점검표
        </h2>
        <p className="mt-1 text-[14px] text-slate-600">공식 점검 기준이 정해지기 전까지 쓰는 자가점검용입니다. 기록은 남지 않습니다.</p>
        <ul className="mt-4 space-y-2">
          {CHECKS.map((c, i) => (
            <li key={c}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-[var(--nr-bg)]">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => setChecked((v) => v.map((x, j) => (j === i ? !x : x)))}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--nr-p3)]"
                />
                <span className="text-[15px] text-slate-800">{c}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className={`mt-3 text-[14px] font-bold ${done ? 'text-[#1f7a3a]' : 'text-slate-500'}`}>
          {done ? '모두 확인했습니다. 양식을 복사해 등록하세요.' : `${checked.filter(Boolean).length} / ${CHECKS.length} 확인`}
        </p>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="nr-title text-[22px] text-black">게시글 양식</h2>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--nr-p2)] px-4 py-2 text-[14px] font-bold text-white hover:opacity-90"
          >
            {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <ClipboardCopy className="w-4 h-4" aria-hidden="true" />}
            {copied ? '복사됨' : '양식 복사'}
          </button>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-[10px] border border-[var(--nr-line)] bg-[#fafafa] p-5 font-sans text-[15px] leading-relaxed text-slate-800">
          {TEMPLATE}
        </pre>
      </section>

      <section className="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          href={WRITE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[var(--nr-p1)] px-6 py-4 text-[17px] font-bold text-white hover:bg-[var(--nr-p3)]"
        >
          게시판에서 글쓰기 <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
          <span className="sr-only">(새 창, 로그인 필요)</span>
        </a>
        <a
          href={BOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--nr-line)] bg-white px-6 py-4 text-[17px] font-bold text-black hover:border-[var(--nr-p3)]"
        >
          게시판 목록 보기 <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
      </section>
      <p className="mt-4 text-[14px] text-slate-600">
        게시 과정이 어려우면 정책기획과 빅데이터담당(063-239-3176)으로 문의해 주세요.
      </p>
    </>
  );
};
