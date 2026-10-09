import data from '../data/summaries.json';

/**
 * 게시글 요약 — docs/summary-guide.md 지침대로 작성해 src/data/summaries.json에 저장.
 * 원 게시글 본문은 이 화면에 싣지 않고, 정해진 항목으로 짧게 정리한 요약만 보여 줌.
 */
export const RUN_TYPES = [
  '웹 접속',
  'HTML 파일',
  '브라우저 확장',
  '설치 프로그램',
  '북마크',
  '구글 시트',
  'AI 챗봇',
  '기타',
] as const;
export type RunType = (typeof RUN_TYPES)[number];

export interface ToolSummary {
  /** 한 줄 소개 — 무엇을 해 주는 도구인지 (40자 이내, 명사형 끝맺음) */
  what?: string;
  /** 주요 기능 — 최대 3개, 각 30자 이내 */
  features?: string[];
  /** 실행 방식 — RUN_TYPES 중 하나 */
  run?: RunType;
  /** 필요한 것 — 계정·키·브라우저·원자료 등 (선택) */
  needs?: string;
  /** 유의사항 — 대상 한정·시험판 등 (선택) */
  caution?: string;
  /** 게시글 설명이 짧아 확인된 내용만 정리한 경우 */
  thin?: boolean;
  /** 게시글에 설명이 전혀 없어 요약하지 못한 경우 */
  empty?: boolean;
  /** 정리한 날 (YYYY-MM-DD) */
  at: string;
}

const items = (data as { items: Record<string, ToolSummary> }).items;

export const summaryOf = (sid: string): ToolSummary | undefined => items[sid];
