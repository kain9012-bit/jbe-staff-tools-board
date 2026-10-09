/**
 * 도구 찾기의 '자주 찾는 업무' 칩.
 * 2026-10 게시판 도구 제목에서 자주 나온 낱말로 만든 초안 — 운영하면서 이 목록만 고치면 됨.
 * 칩 하나에 낱말 여러 개: 그중 하나라도 제목·제작자에 들어 있으면 걸림(띄어쓰기·대소문자 무시).
 */
export interface KeywordChip {
  label: string;
  words: string[];
}

export const KEYWORD_CHIPS: KeywordChip[] = [
  { label: '에듀파인·품의', words: ['에듀파인', '품의', '원인행위', '기안', '결재'] },
  { label: '급여·4대보험', words: ['급여', '4대보험', '대보험', '초과근무', '임금', '인건비', '수납'] },
  { label: '계약·물품', words: ['물품', '계약', '견적', '하자', '비품', '장바구니', '입찰', '반출입'] },
  { label: '공문·문서', words: ['공문', '문서', '한글', 'hwp', 'pdf', '용량', '서식'] },
  { label: '학교운영위원회', words: ['학운위', '학교운영위원회', '회의록'] },
  { label: '교육공무직', words: ['교육공무직'] },
  { label: '나이스·학사', words: ['나이스', '생기부', '시험', '수능', '학사', '등록부'] },
  { label: '수업·학급', words: ['수업', '학급', '교실', '칠판', '학년', '단원', '체험학습'] },
  { label: '학교회계', words: ['회계', '세입', '세출', '출납', '반납', '목적사업비'] },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export const chipMatcher = (chip: KeywordChip | undefined) => {
  if (!chip) return () => true;
  const ws = chip.words.map(norm);
  return (...fields: string[]) => {
    const hay = norm(fields.join(' '));
    return ws.some((w) => hay.includes(w));
  };
};
