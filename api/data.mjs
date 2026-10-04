import { loadPayload } from './_lib/sheets.mjs';

/**
 * GET /api/data — 화면이 쓰는 자료 한 덩어리.
 * 수집기가 매시간 돌므로 10분 캐시, 시트가 느릴 때를 대비해 1시간까지는 묵은 값으로 응답.
 */
export default async function handler(req, res) {
  try {
    const payload = await loadPayload();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(payload));
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(err?.message || err) });
  }
}
