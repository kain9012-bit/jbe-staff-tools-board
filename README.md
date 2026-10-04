# 교직원 제작 도구 현황

데이터 도구실 「교직원 제작 도구」 게시판의 조회수·댓글을 제작자별·도구별로 보여 주는 웹페이지.

## 구조
- `apps-script/collector.gs` — 구글 시트에 붙은 수집기(매시간). 도구목록·조회이력·댓글목록 시트를 채움
- `api/data.mjs` — Vercel 서버 함수. 시트 3종을 CSV로 읽어 JSON으로 묶음(10분 캐시)
- `src/` — 화면(Vite + React + Tailwind v4, 공통 스타일 jbe-ordinance-check 기준)

## 집계 기준
`src/lib/stats.ts` 머리 주석과 화면의 「집계 기준」 탭 참고.

## 개발
```
npm install
npm run dev            # 시트를 직접 읽음
```
시트 주소를 바꾸려면 Vercel 환경변수 `SHEET_ID`, `GID_TOOLS`, `GID_HISTORY`, `GID_COMMENTS`.
시트는 '링크가 있는 모든 사용자 — 뷰어'로 공유돼 있어야 함.
