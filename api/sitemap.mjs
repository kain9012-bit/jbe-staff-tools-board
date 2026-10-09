import { loadToolLists } from './_lib/sheets.mjs';
import { SITE_URL, esc } from './_lib/site.mjs';

/** GET /sitemap.xml — 첫 화면·현황 화면·도구 상세 화면 주소 목록. 시트에서 바로 만들어 새 도구도 바로 들어감 */
export default async function handler(req, res) {
  try {
    const { staff, official } = await loadToolLists();
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      { loc: '/', lastmod: today, pri: '1.0' },
      { loc: '/makers', lastmod: today, pri: '0.6' },
      { loc: '/official', lastmod: today, pri: '0.6' },
      { loc: '/about', pri: '0.3' },
      ...[...staff, ...official].map((t) => ({ loc: `/tool/${t.sid}`, lastmod: /^\d{4}-\d{2}-\d{2}$/.test(t.created) ? t.created : undefined, pri: '0.8' })),
      ...[...new Set(staff.map((t) => t.author))].map((a) => ({ loc: `/maker/${encodeURIComponent(a)}`, pri: '0.4' })),
    ];
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map((u) => `  <url><loc>${esc(SITE_URL + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`)
        .join('\n') +
      '\n</urlset>\n';
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).send(String(e?.message || e));
  }
}
