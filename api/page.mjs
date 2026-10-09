import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadToolLists } from './_lib/sheets.mjs';
import { SERVICE, SITE, SITE_URL, SUMMARIES, esc, withMeta } from './_lib/site.mjs';

/**
 * GET /tool/123, /makers, /maker/이름 … — 검색 엔진이 읽을 수 있는 화면.
 * 빌드된 index.html에 그 주소의 제목·설명·본문을 넣어 돌려주고, 화면은 그 위에 React가 다시 그림.
 * 시트를 열 때마다 읽으므로 새 도구도 다시 배포하지 않고 바로 검색용 화면이 생김.
 */
let template = null;
async function loadTemplate(req) {
  if (template) return template;
  try {
    template = await readFile(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
  } catch {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const r = await fetch(`https://${host}/index.html`);
    if (!r.ok) throw new Error(`index.html 읽기 실패 (HTTP ${r.status})`);
    template = await r.text();
  }
  return template;
}

const BOARD = { staff: '교직원 제작', official: '교육청 배포' };
const DEFAULT_DESC =
  '전북특별자치도교육청 교직원이 만든 업무도구와 교육청이 배포한 업무도구를 한곳에서 찾아보는 페이지. 도구별 요약과 조회수 현황 제공.';

const list = (items) => (items?.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const olist = (items) => (items?.length ? `<ol>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '');
const toolLinks = (tools) =>
  `<ul>${tools.map((t) => `<li><a href="/tool/${esc(t.sid)}">${esc(t.title)}</a></li>`).join('')}</ul>`;

function toolPage(t) {
  const s = SUMMARIES[t.sid];
  const by = t.board === 'official' ? '전북특별자치도교육청 배포' : `${t.author} 제작`;
  const desc = s && !s.empty
    ? [s.what, s.why].filter(Boolean).join('. ')
    : `${by} 업무도구${t.purpose ? ` · ${t.purpose}` : ''}. ${SERVICE}에서 도구 정보와 조회수 현황 확인.`;
  const facts = [BOARD[t.board], t.board === 'official' ? null : `제작자 ${t.author}`, t.purpose, t.target && `적용기관 ${t.target}`, t.created && `게시일 ${t.created}`]
    .filter(Boolean)
    .map(esc)
    .join(' · ');
  const body = `
<article>
  <h1>${esc(t.title)}</h1>
  <p>${facts}</p>
  ${s && !s.empty ? `
  <h2>한눈에 보기</h2>
  <p>${esc(s.what)}</p>
  ${s.why ? `<p>${esc(s.why)}</p>` : ''}
  ${s.features?.length ? `<h3>주요 기능</h3>${list(s.features)}` : ''}
  ${s.steps?.length ? `<h3>사용 순서</h3>${olist(s.steps)}` : ''}
  ${s.run ? `<p>실행 방식: ${esc(s.run)}</p>` : ''}
  ${s.needs?.length ? `<h3>필요한 것</h3>${list(s.needs)}` : ''}
  ${s.cautions?.length ? `<h3>유의사항</h3>${list(s.cautions)}` : ''}` : ''}
  ${t.url ? `<p><a href="${esc(t.url)}">원 게시글에서 내려받기·사용하기</a></p>` : ''}
  <p><a href="/">${SERVICE} 처음으로</a></p>
</article>`;
  return { title: `${t.title} · ${SITE}`, desc, body };
}

function render(parts, all) {
  const [p, ...rest] = parts;
  const arg = decodeURIComponent(rest.join('/'));
  const staff = all.filter((t) => t.board === 'staff');
  const official = all.filter((t) => t.board === 'official');

  if (p === 'tool' && arg) {
    const t = all.find((x) => x.sid === arg);
    return t ? toolPage(t) : null;
  }
  if (p === 'maker' && arg) {
    const mine = staff.filter((t) => t.author === arg);
    if (!mine.length) return null;
    return {
      title: `${arg} 제작 도구 · ${SITE}`,
      desc: `${arg}님이 만든 업무도구 ${mine.length}개: ${mine.slice(0, 5).map((t) => t.title).join(', ')}`,
      body: `<h1>${esc(arg)} 제작 도구</h1>${toolLinks(mine)}`,
    };
  }
  if (p === 'makers')
    return {
      title: `교직원 제작 도구 · ${SITE}`,
      desc: `교직원이 만든 업무도구 ${staff.length}개의 제작자별·도구별 조회수와 댓글 현황.`,
      body: `<h1>교직원 제작 도구</h1>${toolLinks(staff)}`,
    };
  if (p === 'official')
    return {
      title: `교육청 배포 도구 · ${SITE}`,
      desc: `전북특별자치도교육청이 배포한 업무도구 ${official.length}개의 조회수 현황.`,
      body: `<h1>교육청 배포 도구</h1>${toolLinks(official)}`,
    };
  if (p === 'about') return { title: `집계 기준 · ${SITE}`, desc: DEFAULT_DESC, body: `<h1>집계 기준</h1>` };
  if (p === 'register') return { title: `도구 등록 · ${SITE}`, desc: DEFAULT_DESC, body: `<h1>도구 등록</h1>` };
  if (p === 'tools' || !p) return { title: `${SERVICE} · ${SITE} · 전북특별자치도교육청`, desc: DEFAULT_DESC, body: `<h1>${SERVICE}</h1>${toolLinks(all)}` };
  return null;
}

function inject(html, { title, desc, body, canonical, noindex }) {
  const head = [
    `<meta name="description" content="${esc(desc)}" />`,
    noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="교육데이터 허브 ${SITE}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : '',
  ].join('\n    ');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/\n\s*<meta\s+name="description"[\s\S]*?\/>/, '')
    .replace(/\n\s*(<link rel="canonical"[^>]*>|<meta property="og:[^>]*>)/g, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><div class="seo-pre">${body}</div></div>`);
}

export default async function handler(req, res) {
  const raw = String(req.query?.path ?? '').replace(/^\/+|\/+$/g, '');
  const parts = raw ? raw.split('/') : [];
  let html;
  try {
    html = await loadTemplate(req);
  } catch (e) {
    res.status(502).send(String(e?.message || e));
    return;
  }
  try {
    const { staff, official } = await loadToolLists();
    const all = [...staff, ...official].map(withMeta);
    const page = render(parts, all);
    const canonical = `${SITE_URL}/${parts.map(encodeURIComponent).join('/')}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!page) {
      res.setHeader('Cache-Control', 's-maxage=600');
      res.status(404).send(inject(html, { title: `찾는 화면이 없음 · ${SITE}`, desc: DEFAULT_DESC, body: '', noindex: true }));
      return;
    }
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    res.status(200).send(inject(html, { ...page, canonical }));
  } catch {
    // 시트를 못 읽어도 화면은 열리게 — 검색용 내용만 빠짐
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  }
}
