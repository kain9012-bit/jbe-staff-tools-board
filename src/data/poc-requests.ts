/**
 * 도구 요청 PoC 예시 — 실제 접수된 요청이 아님.
 * '해결' 요청은 지금 데이터 도구실에 있는 실제 도구와 연결해 흐름을 보여 줌
 */
export type ReqStatus = '접수' | '검토 중' | '제작 중' | '해결';

export interface ToolRequest {
  id: string;
  title: string;
  detail: string;
  field: string;
  who: string; // 요청 부서 유형만(개인 이름 없음)
  at: string;
  likes: number;
  status: ReqStatus;
  /** 해결 — 연결된 도구 */
  sids?: string[];
  /** 제작 중 — 맡은 쪽 */
  maker?: string;
  mine?: boolean;
}

export const REQ_STATUS: ReqStatus[] = ['접수', '검토 중', '제작 중', '해결'];

export const SAMPLE_REQUESTS: ToolRequest[] = [
  {
    id: 'r1',
    title: '체험학습 버스 좌석·모둠을 명단으로 자동 배치',
    detail: '학년 체험학습 때마다 버스 자리와 모둠을 손으로 짭니다. 나이스 명단을 넣으면 자동으로 나왔으면 합니다.',
    field: '수업·학급',
    who: '초등학교 교사',
    at: '2026-08-21',
    likes: 34,
    status: '해결',
    sids: ['1172751'],
  },
  {
    id: 'r2',
    title: '에듀파인 개인수신그룹을 엑셀로 한 번에 등록',
    detail: '수신자를 한 명씩 추가하느라 시간이 오래 걸립니다.',
    field: '공문·문서',
    who: '교육지원청 주무관',
    at: '2026-06-02',
    likes: 52,
    status: '해결',
    sids: ['1144553', '1144600'],
  },
  {
    id: 'r3',
    title: '부서원 복무 현황을 나이스 화면에서 달력으로 보기',
    detail: '누가 언제 출장·연가인지 한눈에 보이지 않아 결재할 때 불편합니다.',
    field: '나이스·학사',
    who: '중학교 교감',
    at: '2026-05-12',
    likes: 61,
    status: '해결',
    sids: ['1141424'],
  },
  {
    id: 'r4',
    title: '교육공무직 연차·미사용수당 계산기',
    detail: '근무 형태마다 계산이 달라 검산에 시간이 많이 듭니다.',
    field: '급여·4대보험',
    who: '고등학교 행정실',
    at: '2026-09-02',
    likes: 47,
    status: '해결',
    sids: ['1154326'],
  },
  {
    id: 'r5',
    title: '학교운영위원회 회의록 초안을 녹음에서 바로 작성',
    detail: '회의 녹음을 듣고 회의록을 정리하는 데 반나절이 걸립니다.',
    field: '학교운영위원회',
    who: '초등학교 행정실',
    at: '2026-09-18',
    likes: 39,
    status: '제작 중',
    maker: '교육청 배포 도구로 개발 중',
  },
  {
    id: 'r6',
    title: '방과후 강사료를 출강 기록으로 자동 정산',
    detail: '강사별 출강 횟수와 단가를 맞춰 지급 내역을 만드는 일이 반복됩니다.',
    field: '학교회계',
    who: '중학교 행정실',
    at: '2026-09-25',
    likes: 21,
    status: '검토 중',
  },
  {
    id: 'r7',
    title: '급식 식단표에 알레르기 번호 자동 표시',
    detail: '식단표마다 알레르기 유발 식품 번호를 직접 붙이고 있습니다.',
    field: '급식',
    who: '초등학교 영양교사',
    at: '2026-10-02',
    likes: 15,
    status: '접수',
  },
  {
    id: 'r8',
    title: '재물조사 때 물품대장과 실물 대조 목록 만들기',
    detail: '에듀파인 물품대장을 실별로 나눠 점검표로 뽑고 싶습니다.',
    field: '계약·물품',
    who: '고등학교 행정실',
    at: '2026-10-06',
    likes: 12,
    status: '접수',
  },
];
