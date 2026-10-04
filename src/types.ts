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
  | { page: 'home' }
  | { page: 'tools' }
  | { page: 'makers' }
  | { page: 'about' }
  | { page: 'tool'; sid: string }
  | { page: 'maker'; name: string };
