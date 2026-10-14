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
  /** 한 줄 소개 — 무엇을 해 주는 도구인지 (45자 이내, 명사형 끝맺음) */
  what?: string;
  /** 만든 이유 — 어떤 불편을 줄이는지 (70자 이내, 선택) */
  why?: string;
  /** 주요 기능 — 1~6개, 각 45자 이내 */
  features?: string[];
  /** 사용 순서 — 1~5단계, 각 50자 이내 */
  steps?: string[];
  /** 실행 방식 — RUN_TYPES 중 하나 */
  run?: RunType;
  /** 필요한 것 — 계정·키·브라우저·원자료 등 (0~3개) */
  needs?: string[];
  /** 유의사항 — 대상 한정·시험판·저장 위치 등 (0~3개) */
  cautions?: string[];
  /** 정리 근거 — 게시글의 글, 그림, 또는 둘 다 */
  basis?: '글' | '그림' | '글·그림';
  /** 게시글 설명이 짧아 확인된 내용만 정리한 경우 */
  thin?: boolean;
  /** 게시글에 글도 그림도 없어 요약하지 못한 경우 */
  empty?: boolean;
  /** 정리한 날 (YYYY-MM-DD) */
  at: string;
}

let items = (data as { items: Record<string, ToolSummary> }).items;

/** 서버판 — 요약은 서버 DB에서 옴(등록 양식 내용이 곧 요약) */
export const setServerSummaries = (m?: Record<string, ToolSummary>) => {
  if (m) items = m;
};

/** 시트 「도구정보」 탭 한 줄 — 업무분류(null이면 낱말로 분류)·한줄소개·실행방식 */
export interface SheetInfo {
  cats: string[] | null;
  what: string;
  run: string;
  /** 수집기 AI가 쓰는 상세 요약 — 요약 파일에 없는 항목만 채움 */
  why?: string;
  features?: string[];
  steps?: string[];
  needs?: string[];
  cautions?: string[];
}
let sheetCats: Record<string, string[] | null> = {};

/**
 * 웹판 — 시트 「도구정보」 탭이 한 줄 소개·실행 방식의 기준.
 * 요약 파일(summaries.json)의 나머지 항목(만든 이유·기능·사용 순서 등)은 그대로 두고,
 * 시트에 값이 있으면 한 줄 소개·실행 방식만 시트 값으로 바꿈. 요약 파일에 없는 새 도구는 시트 값만으로 요약을 만듦
 */
export const setSheetInfo = (info?: Record<string, SheetInfo>) => {
  if (!info) return;
  const next: Record<string, ToolSummary> = { ...items };
  for (const [sid, v] of Object.entries(info)) {
    const run = (RUN_TYPES as readonly string[]).includes(v.run) ? (v.run as RunType) : undefined;
    const base = next[sid] ?? { at: '' };
    const fill = <K extends 'features' | 'steps' | 'needs' | 'cautions'>(k: K) =>
      !base[k]?.length && v[k]?.length ? { [k]: v[k] } : {};
    next[sid] = {
      ...base,
      ...(v.what ? { what: v.what } : {}),
      ...(run ? { run } : {}),
      ...(!base.why && v.why ? { why: v.why } : {}),
      ...fill('features'),
      ...fill('steps'),
      ...fill('needs'),
      ...fill('cautions'),
    };
  }
  items = next;
  sheetCats = Object.fromEntries(Object.entries(info).map(([sid, v]) => [sid, v.cats]));
};

/** 시트에 정해 둔 업무분류. undefined = 시트에 줄이 없음, null = 칸이 비어 있음 → 둘 다 낱말로 분류 */
export const sheetCatsOf = (sid: string): string[] | null | undefined => sheetCats[sid];

export const summaryOf = (sid: string): ToolSummary | undefined => items[sid];

/** 검색에 쓰는 요약 글 — 한 줄 소개·만든 이유·주요 기능 (사용 순서·유의사항은 제외) */
export const summaryText = (sid: string): string => {
  const s = items[sid];
  return s ? [s.what ?? '', s.why ?? '', ...(s.features ?? [])].join(' ') : '';
};
