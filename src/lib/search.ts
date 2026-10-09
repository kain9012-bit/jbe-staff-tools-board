/**
 * 검색어 맞춤 — 대소문자·띄어쓰기 무시, 낱말이 여럿이면 모두 들어 있어야 함.
 * "에듀파인 품의" → 도구명·제작자·사용목적·요약(한 줄 소개·만든 이유·주요 기능) 어디에든 두 낱말이 다 있으면 걸림
 */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export function matcher(q: string) {
  const words = q.trim().split(/\s+/).filter(Boolean).map(norm);
  if (!words.length) return () => true;
  return (...fields: string[]) => {
    const hay = norm(fields.join(' '));
    return words.every((w) => hay.includes(w));
  };
}
