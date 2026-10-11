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
  /** 출처 게시판 — staff: 교직원 제작 도구, official: 교육청 배포 도구, external: 외부 공공업무 도구 */
  board?: Board;
  /** 고도화로 교육청 배포 도구가 된 경우 원작자(교직원 제작 때 작성자) */
  origin?: string;
  /** 전환한 날 */
  convertedAt?: string;
  /** 외부 공공업무 도구 — 제작 기관 누리집 */
  site?: string;
  /** 외부 공공업무 도구 — 게시판의 업무분야·이용형태 */
  field?: string;
  kind?: string;
}

export type Board = 'staff' | 'official' | 'external';
export const BOARD_LABEL: Record<Board, string> = { staff: '교직원 제작', official: '교육청 배포', external: '외부 공공' };
/** 제작자 이름을 보여 주는 게시판 — 교육청 배포·외부 공공은 게시판 운영자 이름이라 숨김 */
export const showsAuthor = (b?: Board) => (b ?? 'staff') === 'staff';

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
  /** 교육청 배포 도구 — 별도 수집 시트. 못 읽으면 빠짐 */
  official?: { asOf: string; tools: Tool[]; history: Record<string, [string, number][]> };
}

export type Grain = 'day' | 'week' | 'month';

export type Route =
  | { page: 'home'; q?: string; sort?: string; from?: string; to?: string; p?: string; src?: string }
  | { page: 'tools'; q?: string; sort?: string; from?: string; to?: string; p?: string; src?: string }
  | { page: 'register'; type?: string; req?: string }
  | { page: 'makers'; q?: string; sort?: string; from?: string; to?: string }
  | { page: 'about' }
  | { page: 'official' }
  | { page: 'requests' }
  | { page: 'request'; id: string }
  | { page: 'review' }
  | { page: 'poc' }
  | { page: 'tool'; sid: string }
  | { page: 'maker'; name: string };

/** 그래프에서 고른 기간 — 첫 화면 카드와 목록 정렬이 함께 씀 */
export interface Period {
  from: string;
  to: string;
  label: string;
  all: boolean; // 수집 전체 기간
}
