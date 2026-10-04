import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

/**
 * 로컬 개발용 /api/data — 배포에서는 Vercel 서버 함수(api/data.mjs)가 맡는다.
 * LOCAL_PAYLOAD=파일경로 를 주면 시트 대신 그 JSON을 쓴다(인터넷 없이 화면 확인용).
 */
const devApi = (): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api/data', async (_req, res) => {
      try {
        const body = process.env.LOCAL_PAYLOAD
          ? readFileSync(process.env.LOCAL_PAYLOAD, 'utf8')
          : JSON.stringify(await (await import('./api/_lib/sheets.mjs')).loadPayload());
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(body);
      } catch (e) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), devApi()],
  build: { outDir: 'dist', assetsDir: 'assets' },
});
