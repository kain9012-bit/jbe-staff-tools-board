import type { Board } from '../types';

/**
 * 도구 구분 — 개편 후 게시판 3개를 대신하는 도구의 속성.
 * 구분에 따라 등록하는 사람, 검수, 책임, 문의 창구가 다름
 */
export interface SourceInfo {
  key: Board;
  name: string; // 옛 게시판 이름 그대로
  desc: string;
  who: string; // 등록하는 사람
  how: string; // 등록 방식
  review: string; // 검수
  resp: string; // 책임·지원
  ask: string; // 문의 창구
  /** 등록 화면 — 없으면 일반 사용자 등록 불가 */
  register?: { href: string; label: string };
}

export const SOURCES: SourceInfo[] = [
  {
    key: 'official',
    name: '교육청 배포 도구',
    desc: '교육청이 직접 만들어 배포하는 업무도구',
    who: '정책기획과 빅데이터담당',
    how: '배포 등록',
    review: '부서 내부 검토 후 배포',
    resp: '교육청이 유지보수·지원',
    ask: '정책기획과 빅데이터담당',
  },
  {
    key: 'staff',
    name: '교직원 제작 도구',
    desc: '교직원이 직접 만들어 동료와 나누는 업무도구',
    who: '교직원 누구나',
    how: '등록 신청(정해진 양식)',
    review: '보안 자가점검 → 담당자 보안 검토 → 게시',
    resp: '제작자가 관리, 사용 전 내용 확인',
    ask: '제작자(질문과 답변)',
    register: { href: '/register?type=staff', label: '내 도구 등록하기' },
  },
  {
    key: 'external',
    name: '외부 공공업무 도구',
    desc: '다른 교육청·공공기관 공무원이 만든 도구 중 우리 업무에 도움이 되는 도구',
    who: '누구나 추천',
    how: '추천(주소·제작 기관·추천 이유)',
    review: '운영자가 확인 후 선정·게재',
    resp: '사용자가 지역 지침과 맞는지 확인',
    ask: '제작 기관',
    register: { href: '/register?type=external', label: '외부 도구 추천하기' },
  },
];

export const sourceOf = (b?: string) => SOURCES.find((s) => s.key === (b ?? 'staff')) ?? SOURCES[1];
