export interface Tool {
  sid: string;
  title: string;
  url: string;
  created: string; // 게시판 작성일 YYYY-MM-DD
  author: string; // 게시판 표기 그대로: 소속(이름)
  views: number; // 현재 누적 조회수
  comments: number; // 게시판 목록의 댓글 수
  purpose: string;
  target: string;
  firstSeen: string;
}

export interface Comment {
  sid: string;
  cid: string;
  writer: string;
  date: string;
  content: string;
  maker: boolean; // 제작자 답글
}

export interface Payload {
  asOf: string; // 마지막 수집 시각
  fetchedAt: string;
  tools: Tool[];
  history: Record<string, [string, number][]>;
  comments: Comment[];
  commentsOk?: boolean;
}

export type Grain = 'day' | 'week' | 'month';

export type Route =
  | { page: 'home'; q?: string; sort?: string; from?: string; to?: string; p?: string }
  | { page: 'tools'; q?: string; sort?: string; from?: string; to?: string; p?: string }
  | { page: 'register' }
  | { page: 'makers'; q?: string; sort?: string; from?: string; to?: string }
  | { page: 'about' }
  | { page: 'tool'; sid: string }
  | { page: 'maker'; name: string };

/** 그래프에서 고른 기간 — 첫 화면 카드와 목록 정렬이 함께 씀 */
export interface Period {
  from: string;
  to: string;
  label: string;
  all: boolean; // 수집 전체 기간
}
