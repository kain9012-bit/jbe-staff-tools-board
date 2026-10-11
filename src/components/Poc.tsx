import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * 데이터 도구실 개편 PoC 공통 — '예시' 표시와 이 브라우저에만 남는 저장소.
 * 예시 기능(등록 신청·검수·요청·후기·알림)은 서버에 저장하지 않음.
 * 누리집 게시판 연동 전까지 화면 흐름을 보여 주는 용도.
 */

/** 예시 기능 표시 — 실제 자료가 아니라는 것을 늘 함께 보여 줌 */
export const PocTag: React.FC<{ className?: string; label?: string }> = ({ className = '', label = 'PoC 예시' }) => (
  <span
    className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[#f0c36a] bg-[#fff7e3] px-2 py-0.5 text-[11px] font-bold text-[#8a5300] ${className}`}
  >
    <FlaskConical className="w-3 h-3" aria-hidden="true" />
    {label}
  </span>
);

/** 예시 기능 안내 줄 */
export const PocNote: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`flex items-start gap-2 rounded-[10px] border border-[#f0d9a6] bg-[#fffaf0] px-4 py-3 text-[14px] text-[#6b4a00] ${className}`}>
    <FlaskConical className="mt-0.5 w-4 h-4 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const KEY = 'jbe-tools-poc:';
const EV = 'jbe-tools-poc';

function read<T>(key: string, init: T): T {
  try {
    const v = window.localStorage.getItem(KEY + key);
    return v ? (JSON.parse(v) as T) : init;
  } catch {
    return init;
  }
}

/**
 * 이 브라우저에만 남는 상태 — 저장이 막힌 환경(사생활 보호 창 등)에서는 화면을 닫을 때까지만 유지.
 * 같은 키를 쓰는 다른 화면과 바로 맞춰짐
 */
export function usePocState<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => read(key, init));
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent).detail === key) setV(read(key, init));
    };
    window.addEventListener(EV, on);
    return () => window.removeEventListener(EV, on);
    // init은 처음 값만 씀
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T | ((p: T) => T)) => {
      setV((prev) => {
        const val = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(KEY + key, JSON.stringify(val));
        } catch {
          /* 저장이 막혀도 화면 안에서는 유지 */
        }
        queueMicrotask(() => window.dispatchEvent(new CustomEvent(EV, { detail: key })));
        return val;
      });
    },
    [key],
  );
  return [v, set];
}

/** 오늘 날짜 YYYY-MM-DD (한국 시간) */
export const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 제목 끝의 (v1.2.3) 등에서 버전 읽기 */
export const versionOf = (title: string) => title.match(/[(\s]v(?:er\.?)?\s?(\d+(?:\.\d+){0,3})\)?/i)?.[1];

/** 등록 신청 — 등록 화면에서 만들고 검수 현황에서 보임 */
export interface Submission {
  id: string;
  title: string;
  what: string;
  purpose: string;
  run: string;
  version: string;
  at: string;
  stage: number; // 구분별 단계 번호 — STAGES_OF 참고
  checks: number; // 자가점검 통과 개수(교직원 제작)
  /** 구분 — 교직원 제작 도구 등록 / 외부 공공업무 도구 추천 */
  board?: 'staff' | 'external';
  org?: string; // 외부 — 제작 기관
  region?: string; // 외부 — 기준 지역
  note?: string;
}

/** 구분마다 거치는 단계가 다름 — 교직원 제작은 보안 검토, 외부 공공은 운영자 확인 */
export const STAGES_OF = {
  staff: ['등록 신청', '자가점검', '보안 검토', '게시'],
  external: ['추천 접수', '운영자 확인', '게시'],
} as const;
export const STAGES = STAGES_OF.staff;
