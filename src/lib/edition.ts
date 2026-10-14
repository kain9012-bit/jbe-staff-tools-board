/** 서버판(도커) 빌드인지 — npm run build:server 로 만들면 true. Vercel PoC는 false */
export const SERVER = import.meta.env.VITE_EDITION === 'server';
