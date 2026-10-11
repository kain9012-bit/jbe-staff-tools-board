import { usePocState } from '../components/Poc';
import type { Model, ToolStat } from './stats';

/**
 * 운영 관리 PoC — 고도화(교직원 제작 → 교육청 배포 전환)와 게시글별 수정 권한.
 * 모두 이 브라우저에만 저장. 실제 화면·자료에는 영향 없음
 */
export const OPS = '정책기획과 빅데이터담당';

export interface Upgrade {
  stage: number; // UPGRADE_STAGES 번호. 3 = 전환 완료
  notes: string[]; // 단계별 기록
  startedAt: string;
  convertedAt?: string;
  version?: string; // 전환 버전
  title?: string;
  maker?: string; // 원작자
}

export function useManage() {
  const [ups, setUps] = usePocState<Record<string, Upgrade>>('upgrades', {});
  const [eds, setEds] = usePocState<Record<string, string[]>>('editors', {});

  /** 기본 수정 권한 — 교직원 제작은 작성자, 교육청 배포·외부 공공은 운영 부서. 전환된 도구는 운영 부서 + 원작자 */
  const defaults = (t: ToolStat) => {
    if (t.origin) return [OPS, t.origin];
    return (t.board ?? 'staff') === 'staff' ? [t.author] : [OPS];
  };
  return {
    ups,
    up: (sid: string) => ups[sid] as Upgrade | undefined,
    setUp: (sid: string, u: Upgrade | null) =>
      setUps((v) => {
        const n = { ...v };
        if (u) n[sid] = u;
        else delete n[sid];
        return n;
      }),
    editors: (t: ToolStat) => eds[t.sid] ?? defaults(t),
    setEditors: (sid: string, list: string[]) => setEds((v) => ({ ...v, [sid]: list })),
  };
}

/** 전환된 도구를 교육청 배포로 보이게 — 목록·검색·상세 모두에 적용. 조회수·후기·주소는 그대로 */
export function applyUpgrades(m: Model, ups: Record<string, Upgrade>): Model {
  const done = Object.entries(ups).filter(([, u]) => u.convertedAt);
  if (!done.length) return m;
  const map = new Map(done);
  const conv = (t: ToolStat): ToolStat => {
    const u = map.get(t.sid);
    return u ? { ...t, board: 'official', origin: t.author, author: OPS, convertedAt: u.convertedAt } : t;
  };
  return { ...m, tools: m.tools.map(conv) };
}
