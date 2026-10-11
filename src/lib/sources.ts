import type { Board } from '../types';

/**
 * 도구 구분 — 개편 후 게시판 3개를 대신하는 도구의 속성.
 * 등록 양식과 절차는 세 구분 모두 같고, 등록할 수 있는 사람·책임·문의 창구만 다름.
 * 교직원 제작 도구는 고도화를 거쳐 교육청 배포 도구로 전환될 수 있음
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
  /** 일반 사용자가 등록할 수 없을 때 안내 */
  tip?: { href: string; label: string };
}

export const SOURCES: SourceInfo[] = [
  {
    key: 'official',
    name: '교육청 배포 도구',
    desc: '교육청이 직접 만들어 배포하는 업무도구',
    who: '정책기획과 빅데이터담당',
    how: '공통 등록 양식',
    review: '공통 절차(자가점검 → 보안 검토 → 게시)',
    resp: '교육청이 유지보수·지원 (고도화로 전환된 도구 포함)',
    ask: '정책기획과 빅데이터담당',
  },
  {
    key: 'staff',
    name: '교직원 제작 도구',
    desc: '교직원이 직접 만들어 동료와 나누는 업무도구',
    who: '교직원 누구나',
    how: '공통 등록 양식',
    review: '공통 절차(자가점검 → 보안 검토 → 게시)',
    resp: '제작자가 관리, 사용 전 내용 확인',
    ask: '제작자(질문과 답변)',
    register: { href: '/register?type=staff', label: '내 도구 등록하기' },
    // 사업부서 협의 등 여러 조건을 갖춘 도구는 고도화를 거쳐 교육청 배포 도구로 전환될 수 있음
  },
  {
    key: 'external',
    name: '외부 공공업무 도구',
    desc: '다른 교육청·공공기관 공무원이 만든 도구 중 우리 업무에 도움이 되는 도구',
    who: '정책기획과 빅데이터담당',
    how: '공통 등록 양식 + 제작 기관·기준 지역',
    review: '공통 절차(자가점검 → 보안 검토 → 게시)',
    resp: '사용자가 지역 지침과 맞는지 확인',
    ask: '제작 기관',
    tip: { href: '/requests', label: '알리고 싶은 외부 도구는 도구 요청으로' },
  },
];

export const sourceOf = (b?: string) => SOURCES.find((s) => s.key === (b ?? 'staff')) ?? SOURCES[1];
