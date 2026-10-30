# 3D 광장 함께 접속 — 중계 서버

Cloudflare Workers 무료 플랜 + Durable Objects. 방 하나에 광장·로비 사람이 함께 들어감(인원 함께 집계, 걷기·몸짓은 같은 곳끼리만).
이름·모습·자리만 주고받고 저장하는 것은 없음.

## 처음 올리기 (이 폴더에서)

```
npm install
npx wrangler login      ← 브라우저가 열리면 Cloudflare 계정으로 허용
npx wrangler deploy
```

끝나면 `https://jbe-plaza-relay.<계정이름>.workers.dev` 주소가 나옴.
화면 쪽 환경 변수 `VITE_PLAZA_RELAY`에 앞의 https를 wss로 바꿔 넣음.

- Vercel: Settings → Environment Variables → `VITE_PLAZA_RELAY=wss://jbe-plaza-relay.<계정이름>.workers.dev`
- 내 PC 개발용: 저장소 맨 위 `.env.local`에 같은 줄

## 접속 허용 주소

`wrangler.toml`의 `ALLOWED_ORIGINS`. 다른 주소에서 연 화면은 연결이 거절됨(내 PC의 localhost는 허용).

## 무료 한도(2026-10 기준)

- 하루 요청 10만 건. 접속 1번 = 1건, 브라우저가 보낸 글 20개 = 1건, 나눠 주는 글은 안 셈
- 넘으면 그날(한국 시간 오전 9시까지) 연결이 안 되고 광장은 혼자 보기로 동작

## 내 PC에서 시험

```
npm run dev     ← ws://127.0.0.1:8787
```
저장소 맨 위 `.env.local`에 `VITE_PLAZA_RELAY=ws://127.0.0.1:8787` 넣고 `npm run dev`.
