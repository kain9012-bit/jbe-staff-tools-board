import type { Model, ToolStat } from './stats';

/**
 * 고도화 후보 — 교직원 제작 도구 중 교육청 배포 도구로 전환을 검토할 도구.
 * PoC 기준: 최근 30일 조회수 교직원 제작 도구 상위 5개.
 * 개편 후에는 써봤어요·후기 평점·관련 요청 공감을 함께 봄
 */
export const UPGRADE_TOP = 5;
export const UPGRADE_RULE = `최근 30일 조회수 교직원 제작 도구 상위 ${UPGRADE_TOP}개`;

export const upgradeCandidates = (m: Model): ToolStat[] =>
  [...m.tools].filter((t) => t.recent30 > 0).sort((a, b) => b.recent30 - a.recent30 || b.views - a.views).slice(0, UPGRADE_TOP);
