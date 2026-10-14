import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync } from 'node:fs';

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

/**
 * 서버판(도커) 빌드 — 바깥 인터넷 호출 0건.
 *  · CDN 서체 → src/fonts 의 파일을 함께 묶음
 *  · 검색 엔진 확인 태그·외부 주소 메타 제거
 */
const serverEdition = (): Plugin => ({
  name: 'server-edition',
  enforce: 'pre',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('/src/index.css')) return null;
    return code
      .replace(/@import\s+(?:url\()?["']?https?:\/\/[^;]+;/g, '')
      .replace(/url\(["']?https?:\/\/[^)]*GangwonEduPowerExtraBoldA\.woff["']?\)/, 'url("./fonts/GangwonEduPowerExtraBoldA.woff")')
      .concat(`\n@font-face { font-family: "SUIT Variable"; font-weight: 100 900; font-display: swap; src: url("./fonts/SUIT-Variable.woff2") format("woff2-variations"), url("./fonts/SUIT-Variable.woff2") format("woff2"); }\n`);
  },
  closeBundle() {
    // 내부망 서버 — 검색 엔진 수집 막음
    writeFileSync('dist-server/robots.txt', 'User-agent: *\nDisallow: /\n');
  },
  transformIndexHtml(html) {
    return html
      .replace(/\s*<meta name="(google|naver)-site-verification"[^>]*>/g, '')
      .replace(/\s*<link rel="canonical"[^>]*>/g, '')
      .replace(/\s*<meta property="og:(url|type|site_name|title|description)"[^>]*\/?>/g, '')
      .replace(/\s*<!--[^>]*-->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
      .replace(/<title>[^<]*<\/title>/, '<title>데이터 도구실 · 업무경감 도구 모음</title>');
  },
});

export default defineConfig(({ mode }) => {
  const server = mode === 'server';
  return {
    base: '/',
    plugins: [react(), tailwindcss(), ...(server ? [serverEdition()] : [devApi()])],
    build: { outDir: server ? 'dist-server' : 'dist', assetsDir: 'assets', ...(server ? { assetsInlineLimit: 0 } : {}) },
    // 서버판 개발: npm run dev:server (서버는 따로 node server/index.mjs, 8090)
    server: server ? { proxy: { '/api': 'http://localhost:8090', '/files': 'http://localhost:8090', '/download': 'http://localhost:8090' } } : undefined,
  };
});
