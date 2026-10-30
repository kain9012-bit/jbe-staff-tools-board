// @ts-nocheck
/* 전북교육청 청사 3D 모델 — C:\\work\\jbe-hq-3d-map 의 청사 모델을 옮겨 옴(지도 없이 단독 장면용).
 * 좌표: site(x=동, y=북, m, 원점 본관 중심) → three(x, 높이, -y)
 */
import logoSigUrl from './logoSig.png';
import slogan2Url from './slogan2.png';

export function makeHQ(T, scene, NIGHT_MATS) {
  const map = null;
  const BR = { logoSig: { src: logoSigUrl, w: 1528, h: 229 }, slogan2: { src: slogan2Url, w: 687, h: 319 } };
  let clockTex, clockCtx, lastClock = '';
  let ENT = null, MAINP = null;
  const LIT = { value: 1 };
  function nightTex(T, cw0, ch0, rect0, prob, seed, cells = 4) {
    const sc = cells > 4 ? 40 / cw0 : 1, cw = Math.round(cw0 * sc), ch = Math.round(ch0 * sc), rect = rect0.map(v => Math.max(1, Math.round(v * sc)));
    const c = document.createElement('canvas'); c.width = cw * cells; c.height = ch * cells; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const COLS = ['255,212,154', '255,226,181', '255,241,214', '255,207,134', '217,230,255', '255,236,200'];
    const LEVELS = [0, 0.12, 0.3, 0.5, 0.75, 0.95];
    const block = {};
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
      const bk = (i >> 2) + ',' + (j >> 2); if (block[bk] == null) block[bk] = LEVELS[Math.floor(rnd() * LEVELS.length)] * Math.min(1, prob * 1.4);
      if (cells === 4) block[bk] = prob;
      if (rnd() > block[bk]) continue;
      const rank = rnd(), [x, y, w, h] = rect;
      g.fillStyle = `rgba(${COLS[Math.floor(rnd() * COLS.length)]},${(0.35 + 0.65 * rank).toFixed(3)})`;
      g.clearRect(i * cw + x, j * ch + y, w, h); g.fillRect(i * cw + x, j * ch + y, w, h);
      if (rnd() < 0.3) { g.fillStyle = '#000'; g.fillRect(i * cw + x, j * ch + y, w, Math.round(h * (0.3 + rnd() * 0.4))); }   // 블라인드
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / cells, 1 / cells);
    t.userData.thr = true; return t;
  }
  function withNight(T, mat, tex, k) {
    mat.emissiveMap = tex; mat.emissive = new T.Color(0xffffff); mat.emissiveIntensity = 0; NIGHT_MATS.push([mat, k]);
    if (tex.userData && tex.userData.thr) mat.onBeforeCompile = sh => {
      sh.uniforms.uLit = LIT;
      sh.fragmentShader = 'uniform float uLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP
          vec4 eT = texture2D( emissiveMap, vEmissiveMapUv );
          float rk = ( eT.a - 0.35 ) / 0.65;
          totalEmissiveRadiance *= eT.rgb * step( rk, uLit ) * step( 0.3, eT.a );
        #endif`);
    };
    mat.needsUpdate = true; return mat;
  }
    const canvasTex = (w, h, draw, rep = true) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
      if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; }
      t.userData = { g }; return t;
    };
    const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .85, metalness: 0, side: T.DoubleSide }, o));
    const s2w = (x, y) => [x, -y];
    function setRepeat(geo, ru, rv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); uv.needsUpdate = true; }
    // 벽: p0→p1, 높이 y0~y1. bay·floor를 주면 텍스처를 그 간격으로 반복
    function wall(p0, p1, y0, y1, mat, out = 0, bay = 0, floor = 0) {
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy); if (L < .05) return null;
      const nx = dy / L, ny = -dx / L;
      const geo = new T.PlaneGeometry(L, y1 - y0); if (bay) setRepeat(geo, L / bay, (y1 - y0) / floor);
      const m = new T.Mesh(geo, mat);
      m.position.set((p0[0] + p1[0]) / 2 + nx * out, (y0 + y1) / 2, -((p0[1] + p1[1]) / 2 + ny * out)); m.rotation.y = Math.atan2(dy, dx);
      return m;
    }
    const shapeOf = poly => { const s = new T.Shape(); s.moveTo(poly[0][0], poly[0][1]); poly.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.closePath(); return s; };
    function slab(poly, y0, y1, mat) { const g = new T.ExtrudeGeometry(shapeOf(poly), { depth: y1 - y0, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return new T.Mesh(g, mat); }
    function smoothFront(poly, from, to, bow, steps) {
      const out = poly.slice(0, from + 1); const a = poly[from], b = poly[to]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      const nx = dy / L, ny = -dx / L, cx = (a[0] + b[0]) / 2 + nx * bow * 2, cy = (a[1] + b[1]) / 2 + ny * bow * 2;
      for (let s = 1; s < steps; s++) { const t = s / steps, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]); }
      return out.concat(poly.slice(to));
    }
    const box = (w, h, d, mat, x, y, z, ry = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; return m; };

    // ── 텍스처 ──
    // 업무층 한 칸: 폭 3.2m × 층고 4m (아래 24%는 층간 띠)
    const officeTex = canvasTex(128, 160, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6f93bd'); gr.addColorStop(.45, '#33577f'); gr.addColorStop(1, '#203b5a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * .55, 0); g.lineTo(0, h * .7); g.fill();
      g.fillStyle = '#9aa3ad'; g.fillRect(0, h * .76, w, h * .24); g.fillStyle = '#7e8791'; g.fillRect(0, h * .76, w, 3);
      g.fillStyle = '#d2d7dc'; g.fillRect(0, 0, 4, h); g.fillRect(w / 2 - 1, 0, 2, h * .76);
    });
    // 로비 2개층: 폭 3.2m × 5.5m, 밝은 실내
    const lobbyTex = canvasTex(128, 220, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5c7a9c'); gr.addColorStop(1, '#2b4361');
      g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,236,200,.18)'; g.fillRect(0, h * .2, w, h * .55);
      g.fillStyle = '#d9dde1'; g.fillRect(0, 0, 5, h); g.fillRect(w / 2 - 1, 0, 2, h); g.fillRect(0, h * .5 - 2, w, 4);
    });
    // 별관: 베이지 타일 벽 + 띠창 (폭 4m × 층고 4.2m)
    const annexTex = canvasTex(128, 134, (g, w, h) => {
      g.fillStyle = '#cdb08a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,95,65,.25)'; g.lineWidth = 1; for (let y = 0; y < h; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5b7a99'); gr.addColorStop(1, '#2c4560');
      g.fillStyle = gr; g.fillRect(6, h * .3, w - 12, h * .42); g.fillStyle = '#e6e2da'; g.fillRect(w / 2 - 2, h * .3, 4, h * .42);
    });
    const pvTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#1b2b49'; g.fillRect(0, 0, w, h); g.strokeStyle = '#51719e'; g.lineWidth = 2;
      for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); }
    });
    // 전광판 (문구만, 기관 상징은 넣지 않음)
    // 비전·슬로건 이미지를 판에 그림. 이미지 여러 장이면 6초마다 번갈아(전광판)
    
    const imgCache = {};
    const brandImg = k => { if (!BR[k]) return null; if (!imgCache[k]) { const im = new Image(); im.src = BR[k].src; imgCache[k] = im; } return imgCache[k]; };
    function boardTex(w, h, slides, opt = {}) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
      const pad = opt.pad ?? 0.08, bg = ('bg' in opt) ? opt.bg : '#ffffff';
      const drawSlide = (k, alpha) => {
        const im = brandImg(k); if (!im || !im.complete || !im.naturalWidth) return;
        const s = Math.min(w * (1 - 2 * pad) / im.naturalWidth, h * (1 - 2 * pad) / im.naturalHeight);
        const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        const x = (w - dw) / 2, y = (h - dh) / 2;
        if (opt.halo) {   // 글자 둘레 흰 테두리: 흰색 실루엣을 둘레로 여러 번 찍음
          const t = document.createElement('canvas'); t.width = Math.ceil(dw); t.height = Math.ceil(dh); const tg = t.getContext('2d');
          tg.drawImage(im, 0, 0, dw, dh); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = 'rgba(255,255,255,.95)'; tg.fillRect(0, 0, t.width, t.height);
          g.globalAlpha = alpha; for (let a = 0; a < 16; a++) g.drawImage(t, x + Math.cos(a * Math.PI / 8) * opt.halo, y + Math.sin(a * Math.PI / 8) * opt.halo);
        }
        g.globalAlpha = alpha; g.drawImage(im, x, y, dw, dh); g.globalAlpha = 1;
      };
      const paint = (a, b, f) => {
        if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
        if (opt.frame) { g.strokeStyle = opt.frame; g.lineWidth = Math.max(6, w * 0.008); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
        drawSlide(a, 1 - f); if (b != null && f > 0) drawSlide(b, f);
        t.needsUpdate = true; if (map) map.triggerRepaint();
      };
      let cur = 0;
      const first = () => paint(slides[0], null, 0);
      slides.forEach(k => { const im = brandImg(k); if (im) im.addEventListener('load', first); });
      first();
      if (slides.length > 1) setInterval(() => {
        const a = slides[cur], b = slides[(cur + 1) % slides.length]; let f = 0;
        const tick = () => { f = Math.min(1, f + 0.08); paint(a, b, f); if (f < 1) requestAnimationFrame(tick); else cur = (cur + 1) % slides.length; };
        tick();
      }, 6000);
      return t;
    }
    // 남색 전광판용: 이미지의 남색 글자를 흰색으로 바꿔 그림 (주황 글자·로고 마크 색은 그대로)
    function whiten(k) {
      const im = brandImg(k); if (!im || !im.naturalWidth) return null;
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d');
      g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) { const r = a[i], gg = a[i + 1], b = a[i + 2];
        if (a[i + 3] > 0 && b > r + 25 && r < 90 && gg < 110) { a[i] = a[i + 1] = a[i + 2] = 255; } }
      g.putImageData(d, 0, 0); return c;
    }
    function sloganLed(w, h) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
      const draw = () => {
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a3fb0'); gr.addColorStop(1, '#16237a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        const s1 = whiten('slogan2'), s2 = whiten('logoSig');
        if (s1) { const sc = Math.min(w * .84 / s1.width, h * .66 / s1.height); g.drawImage(s1, (w - s1.width * sc) / 2, h * .08, s1.width * sc, s1.height * sc); }
        if (s2) { const sc = Math.min(w * .5 / s2.width, h * .1 / s2.height); g.drawImage(s2, (w - s2.width * sc) / 2, h * .84, s2.width * sc, s2.height * sc); }
        t.needsUpdate = true; if (map) map.triggerRepaint();
      };
      ['slogan2', 'logoSig'].forEach(k => { const im = brandImg(k); if (im) im.addEventListener('load', draw); });
      draw(); return t;
    }
    const ledTex = (w, h, big, small, sub) => canvasTex(w, h, (g) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1e3f9a'); gr.addColorStop(1, '#0b2160'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(w * .9, h * .2, h * (.9 - i * .14), 0, 7); g.fill(); }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.font = `900 ${big}px 'Plaza SUIT', SUIT, 'Noto Sans CJK KR', sans-serif`; g.fillText('전북교육', w / 2, h * .42);
      g.font = `700 ${small}px 'Plaza SUIT', SUIT, 'Noto Sans CJK KR', sans-serif`; g.fillStyle = 'rgba(220,235,255,.9)'; g.fillText(sub, w / 2, h * .74);
    }, false);

    function build() {
      const mConc = std('#c9ccd0'), mConc2 = std('#e7e8e9'), mMetal = std('#9aa1aa', { roughness: .5, metalness: .3 }), mDark = std('#2a2f38');
      const mRoof = std('#8f959b'), mGlassD = std('#2a4361', { roughness: .2, metalness: .4 });
      const mOffice = withNight(T, std('#ffffff', { map: officeTex, roughness: .35, metalness: .15 }), nightTex(T, 128, 160, [4, 0, 124, 120], 0.75, 11), 1.1);
      const mLobby = withNight(T, std('#ffffff', { map: lobbyTex, roughness: .35, metalness: .1 }), nightTex(T, 128, 220, [5, 10, 123, 200], 0.9, 23), 1.0);
      const add = o => { if (o) scene.add(o); return o; };

      // 본관: 8층 (로비 2개층 5.5m + 업무 6개층 4m) — 남측 곡면은 완만한 호
      const MAIN = smoothFront([[-42.6, -17.7], [-34.1, -33.0], [7.2, -10.1], [34.8, 10.7], [43.1, 21.2], [18.6, 23.0], [11.6, 15.0], [4.0, 8.1]], 1, 4, 5.0, 22);
      MAINP = MAIN;
      const MH = 35;
      for (let i = 0; i < MAIN.length; i++) {
        const a = MAIN[i], b = MAIN[(i + 1) % MAIN.length];
        add(wall(a, b, 0, 11, mLobby, 0, 3.2, 5.5));
        add(wall(a, b, 11, MH, mOffice, 0, 3.2, 4));
        add(wall(a, b, MH, MH + 1.6, mConc2, .25));       // 옥상 난간
        add(wall(a, b, 10.6, 11.3, mConc2, .35));          // 로비 위 띠
      }
      add(slab(MAIN, MH - .2, MH, mRoof));
      // 정문 — 본관 곡면 앞, 전면동 왼쪽. 흰 평지붕 차양 + 회색 문틀 + 유리 자동문 (드론 사진 기준)
      {
        const a = [-34.1, -33.0], b = [34.8, 10.7];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
        const c = [(a[0] + b[0]) / 2 + nx * 10, (a[1] + b[1]) / 2 + ny * 10];
        const t = 0.47, u = 1 - t;
        const q = [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
        const tx0 = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), ty0 = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
        const tl = Math.hypot(tx0, ty0), tan = [tx0 / tl, ty0 / tl], nrm = [tan[1], -tan[0]];
        const ang = Math.atan2(tan[1], tan[0]);
        const at = (along, out) => [q[0] + tan[0] * along + nrm[0] * out, q[1] + tan[1] * along + nrm[1] * out];
        const W3 = (p, h) => new T.Vector3(p[0], h, -p[1]);
        const put = (o, p, h) => { o.position.copy(W3(p, h)); o.rotation.y = ang; o.castShadow = true; o.receiveShadow = true; add(o); return o; };
        const white = std('#eef0f2', { roughness: .6 }), gray = std('#b9bec5', { roughness: .55, metalness: .15 });
        // 차양: 폭 11m, 7m 내밂, 밑면 4.6m
        put(new T.Mesh(new T.BoxGeometry(11, .45, 7), white), at(0, 3.5), 4.85);
        put(new T.Mesh(new T.BoxGeometry(11.1, .95, .3), white), at(0, 7.0), 4.7);
        put(new T.Mesh(new T.BoxGeometry(11.12, .12, .32), std('#2f6fb3')), at(0, 7.0), 4.4);
        // 차양 밑면 조명(밤에 켜짐)
        const soffitTex = canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
          g.fillStyle = 'rgba(255,236,200,1)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(32 + i * 64, 30 + j * 50, 7, 0, 7); g.fill(); } }, false);
        const soffit = new T.Mesh(new T.PlaneGeometry(10.6, 6.6), withNight(T, std('#f4f4f2', { side: T.FrontSide }), soffitTex, 1.4));
        soffit.position.copy(W3(at(0, 3.5), 4.61)); soffit.rotation.order = 'YXZ'; soffit.rotation.y = ang; soffit.rotation.x = Math.PI / 2; add(soffit);
        // 기둥 둘(앞 모서리)
        for (const s of [-1, 1]) { const col = new T.Mesh(new T.CylinderGeometry(.2, .2, 4.6, 12), gray); put(col, at(s * 5.0, 6.4), 2.3); }
        // 회색 문틀(폭 8.2, 높이 4.2) + 유리문
        put(new T.Mesh(new T.BoxGeometry(8.4, .7, .9), gray), at(0, .45), 3.95);
        for (const s of [-1, 1]) put(new T.Mesh(new T.BoxGeometry(.6, 3.6, .9), gray), at(s * 3.9, .45), 1.8);
        const glass = new T.MeshStandardMaterial({ color: '#33485e', roughness: .15, metalness: .4, emissive: '#ffcf8a', emissiveIntensity: 0, transparent: true, opacity: .82 });
        NIGHT_MATS.push([glass, 0.55]);
        const steel = std('#d5d9de', { roughness: .3, metalness: .7 });
        const leaf = (along) => { const g = new T.Group(); const p = new T.Mesh(new T.BoxGeometry(1.75, 3.5, .06), glass); g.add(p);
          for (const [w, h, x, y] of [[1.8, .08, 0, 1.75], [1.8, .08, 0, -1.75], [.08, 3.5, -.87, 0], [.08, 3.5, .87, 0], [1.8, .05, 0, .2]]) { const f = new T.Mesh(new T.BoxGeometry(w, h, .08), steel); f.position.set(x, y, 0); g.add(f); }
          g.position.copy(W3(at(along, .6), 1.75)); g.rotation.y = ang; add(g); return g; };
        const fixedL = leaf(-2.7), fixedR = leaf(2.7), slideL = leaf(-0.9), slideR = leaf(0.9);
        void fixedL; void fixedR;
        // 발판·점자블록
        put(new T.Mesh(new T.BoxGeometry(5, .04, 1.6), std('#3b3f46', { roughness: 1 })), at(0, 1.6), .06);
        put(new T.Mesh(new T.BoxGeometry(3.2, .03, .35), std('#f2c230', { roughness: .8 })), at(0, 2.7), .07);
        const home = (g, along) => W3(at(along, .62), 1.75);
        ENT = { q, tan, nrm, ang, door: at(0, 0.5),
          setDoors(k) { slideL.position.copy(home(slideL, -0.9 - 1.7 * k)); slideR.position.copy(home(slideR, 0.9 + 1.7 * k)); } };
      }
      // 옥상 로고 간판: 사진처럼 곡면 오른쪽(게이트타워 쪽) 난간 위에 로고+기관명 글자
      if (BR.logoSig) {
        const i0 = 9, i1 = 17, a = MAIN[i0], b = MAIN[i1];   // 곡면 가운데~오른쪽, 게이트타워와 떨어진 구간
        const dx = b[0] - a[0], dy = b[1] - a[1], Lc = Math.hypot(dx, dy), nx = dy / Lc, ny = -dx / Lc;
        let sag = 0; for (let i = i0; i <= i1; i++) sag = Math.max(sag, (MAIN[i][0] - a[0]) * nx + (MAIN[i][1] - a[1]) * ny);
        const asp = BR.logoSig.w / BR.logoSig.h, wS = Math.min(Lc * 1.0, 24), hS = wS / asp;
        const tx = boardTex(1800, Math.round(1800 / asp), ['logoSig'], { pad: 0.02, bg: null, halo: 5 });
        const mS = new T.Mesh(new T.PlaneGeometry(wS, hS), withNight(T, new T.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: 0.04, roughness: .5, side: T.DoubleSide, depthWrite: false }), tx, 0.8));
        const mx = (a[0] + b[0]) / 2 + nx * (sag + 0.7), my = (a[1] + b[1]) / 2 + ny * (sag + 0.7);
        mS.position.set(mx, MH + 0.6 + hS / 2, -my); mS.rotation.y = Math.atan2(dy, dx); mS.renderOrder = 2; add(mS);
        // 글자를 받치는 얇은 틀
        add(box(wS * 0.98, 0.25, 0.4, mConc, mx - nx * 0.3, MH + 0.45, -(my - ny * 0.3), Math.atan2(dy, dx)));
      }
      // 옥탑·기계실은 간판을 가리지 않게 건물 뒤쪽(북쪽)으로
      add(box(30, 4.5, 9, mConc2, -2, MH + 2.25, 1, .57)); add(box(30.3, 1.2, 9.3, mGlassD, -2, MH + 2.6, 1, .57));   // 곡면과 나란히(약 33°)
      add(box(8, 7, 6, mConc, 16, MH + 3.5, -15, .62));

      // 전면 저층동: 필로티(4.4m) 위 금속 박스, 왼쪽 전광판, 오른쪽 유리
      { const SE = [[7.2, -10.1], [9.5, -19.5], [19.5, -19.5], [52.0, -1.2], [44.0, 9.5], [34.8, 10.7]]; const y0 = 4.4, y1 = 11.6;
        add(slab(SE, y0, y1, std('#8e949b', { roughness: .55, metalness: .25 })));
        const a = SE[2], b = SE[3], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L, ang = Math.atan2(dy, dx);
        const fr = (t, o, y, w, h, mat) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(a[0] + dx * t + nx * o, y, -(a[1] + dy * t + ny * o)); m.rotation.y = ang; return m; };
        // 사진처럼 정면은 흰 틀의 큰 유리 격자
        const g2 = new T.PlaneGeometry(L * .9, y1 - y0 - 0.6); setRepeat(g2, L * .9 / 3.2, 2);
        const gw = new T.Mesh(g2, mLobby); gw.position.copy(fr(.5, .07, (y0 + y1) / 2, 1, 1, mLobby).position); gw.rotation.y = ang; add(gw);
        // 입구 위 파란 띠 간판 (사진: 전면동 왼쪽 아래 차양)
        { const c = document.createElement('canvas'); c.width = 1400; c.height = 150; const g = c.getContext('2d');
          g.fillStyle = '#1f5fc0'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = "800 92px 'Plaza SUIT', SUIT, 'Noto Sans CJK KR', sans-serif"; g.fillText('전북특별자치도교육청', c.width / 2, 80);
          const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
          add(fr(.13, .25, y0 + 0.55, 9, 0.95, withNight(T, new T.MeshStandardMaterial({ map: t, roughness: .5, side: T.DoubleSide }), t, 0.9))); }
        // 앞마당 표지석 (사진: 화강석 덩어리에 기관명)
        { const sx = a[0] + dx * .22 + nx * 24, sy = a[1] + dy * .22 + ny * 24, rot = ang;
          add(box(10, 0.5, 2.0, std('#6f7175', { roughness: .8 }), sx, 0.25, -sy, rot));
          add(box(8.6, 2.5, 1.0, std('#a7a9ab', { roughness: .85 }), sx, 0.5 + 1.25, -sy, rot));
          const c = document.createElement('canvas'); c.width = 1400; c.height = 300; const g = c.getContext('2d');
          g.fillStyle = '#a7a9ab'; g.fillRect(0, 0, c.width, c.height);
          for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '40,40,40'},.06)`; g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3); }
          g.fillStyle = '#2f3236'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "800 128px 'Plaza SUIT', SUIT, 'Noto Sans CJK KR', serif"; g.fillText('전북특별자치도교육청', c.width / 2, 155);
          const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
          const face = new T.Mesh(new T.PlaneGeometry(8.4, 1.8), new T.MeshStandardMaterial({ map: t, roughness: .85 }));
          face.position.set(sx + nx * 0.52, 0.5 + 1.25, -(sy + ny * 0.52)); face.rotation.y = rot; add(face); }
        for (let p = 0; p < 6; p++) { const c = new T.Mesh(new T.CylinderGeometry(.55, .55, y0, 16), mConc2); const t = .12 + p * .16; c.position.set(a[0] + dx * t - nx * 2.5, y0 / 2, -(a[1] + dy * t - ny * 2.5)); add(c); }
        const lg = new T.PlaneGeometry(L * .8, y0 - .3); setRepeat(lg, L * .8 / 3.2, 1);
        const lob = new T.Mesh(lg, mLobby); lob.position.set(a[0] + dx * .5 - nx * 7, (y0 - .3) / 2, -(a[1] + dy * .5 - ny * 7)); lob.rotation.y = ang; add(lob);
      }

      // 게이트타워: 콘크리트 격자 + 유리 코어 + 경사 날개 지붕 + 전광판 + 시계
      { const faceAng = Math.atan2(-1.2 - (-19.5), 52.0 - 19.5); const g = new T.Group(); g.position.set(47.5, 0, -9.5); g.rotation.y = faceAng; scene.add(g);
        const GW = 19, GD = 15, GH = 42;
        g.add(box(GW - 2.4, GH - 1, GD - 2.4, std('#33465c', { roughness: .25, metalness: .5 }), 0, (GH - 1) / 2, 0));
        for (let f = 1; f <= 10; f++) g.add(box(GW + .6, .9, GD + .4, mConc2, 0, f * 4, 0));
        [-GW / 2, -GW / 6, GW / 6, GW / 2].forEach(x => [-GD / 2, GD / 2].forEach(z => g.add(box(1.3, GH, 1.3, mConc2, x, GH / 2, z))));
        [-GD / 6, GD / 6].forEach(z => [-GW / 2, GW / 2].forEach(x => g.add(box(1.3, GH, 1.3, mConc2, x, GH / 2, z))));
        const wg = new T.PlaneGeometry(GW - 3, GH - 12); setRepeat(wg, (GW - 3) / 3.2, (GH - 12) / 4); const wf = new T.Mesh(wg, mOffice); wf.position.set(0, (GH - 12) / 2 + 1, GD / 2 - .9); g.add(wf);
        const wg2 = new T.PlaneGeometry(GD - 3, GH - 4); setRepeat(wg2, (GD - 3) / 3.2, (GH - 4) / 4); const wf2 = new T.Mesh(wg2, mOffice); wf2.position.set(GW / 2 - .9, (GH - 4) / 2 + 1, 0); wf2.rotation.y = Math.PI / 2; g.add(wf2);
        [-1, 1].forEach(s => g.add(box(1.0, 7, 1.0, mConc2, s * 6.5, GH + 3.5, GD / 2 - 1)));
        const wing = new T.Group(); wing.position.set(-7, GH + 5.2, 1); wing.rotation.z = .2; wing.rotation.x = -.05;
        wing.add(box(36, .7, 20, std('#d9dcdf', { roughness: .6 }), 0, 0, 0));
        for (let i = 0; i < 12; i++) wing.add(box(36, .35, .5, mMetal, 0, -.5, -9.4 + i * 1.7));
        g.add(wing);
        const led = new T.Mesh(new T.PlaneGeometry(14, 9), new T.MeshBasicMaterial({ map: BR.slogan2 ? sloganLed(1400, 900) : ledTex(1400, 900, 190, 74, '전북특별자치도교육청') })); led.position.set(1.5, GH - 8, GD / 2 + .9); g.add(led);
        g.add(box(15.2, 10.2, .8, mDark, 1.5, GH - 8, GD / 2 + .4));
        clockTex = canvasTex(512, 170, () => {}, false); clockCtx = clockTex.userData.g;
        const ck = new T.Mesh(new T.PlaneGeometry(5.4, 1.8), new T.MeshBasicMaterial({ map: clockTex })); ck.position.set(1.5, GH - 1.6, GD / 2 + .9); g.add(ck);
        g.add(box(6, 2.4, .6, mDark, 1.5, GH - 1.6, GD / 2 + .5));
        add(box(5, MH + 2, 6, mGlassD, 41.5, (MH + 2) / 2, -13.5, faceAng));   // 본관-타워 사이 유리 계단실
      }

      // 별관: 본관 남쪽, 태양광 지붕 (VWorld 항공사진에서 어림한 외곽, 5층 19m)
      { const ANNEX = [[-46, -63], [-17, -50], [0, -87], [-31, -101]];
        const mAnnex = std('#ffffff', { map: annexTex, roughness: .9 });
        for (let i = 0; i < 4; i++) add(wall(ANNEX[i], ANNEX[(i + 1) % 4], 0, 19, mAnnex, 0, 4, 4.2));
        add(slab(ANNEX, 18.8, 19, std('#cbb08c')));
        for (let i = 0; i < 4; i++) add(wall(ANNEX[i], ANNEX[(i + 1) % 4], 19, 20.2, std('#e2d6c4'), .2));
        // 태양광 패널: 지붕 안쪽으로 2m 들인 면
        const cx = ANNEX.reduce((s, p) => s + p[0], 0) / 4, cy = ANNEX.reduce((s, p) => s + p[1], 0) / 4;
        const inner = ANNEX.map(([x, y]) => { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy); return [x - dx / L * 3, y - dy / L * 3]; });
        const pvGeo = new T.ShapeGeometry(shapeOf(inner)); const pos = pvGeo.attributes.pos || pvGeo.attributes.position, uv = pvGeo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 16, pos.getY(i) / 16);
        const pv = new T.Mesh(pvGeo, std('#ffffff', { map: pvTex, roughness: .3, metalness: .5 })); pv.rotation.x = -Math.PI / 2; pv.position.y = 19.15; add(pv);
        // 본관과 이어지는 저층 연결 통로 (어림)
        add(box(5, 4.5, 27, mGlassD, -20, 2.25, 38)); add(box(5.6, .6, 27.4, mConc2, -20, 4.8, 38));
      }
    }
  build();
  return { LIT, ENT, MAIN: MAINP, drawClock(hh) {
      const s = `${String(Math.floor(hh) % 24).padStart(2, '0')}:${String(Math.floor((hh % 1) * 60)).padStart(2, '0')}`;
      if (s === lastClock) return; lastClock = s;
      const g = clockCtx; g.fillStyle = '#05080d'; g.fillRect(0, 0, 512, 170);
      g.fillStyle = '#ff6a3d'; g.font = "800 130px 'Plaza SUIT', SUIT, 'Noto Sans CJK KR', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 256, 92);
      clockTex.needsUpdate = true; } };
}
