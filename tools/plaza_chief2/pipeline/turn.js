const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 300, height: 400 } });
  p.on('pageerror', e => console.log('err', e.message));
  await p.goto('http://127.0.0.1:8765/turn.html'); await p.waitForFunction(() => window.__done, null, { timeout: 60000 });
  const poses = JSON.parse(process.argv[2]);
  for (const [name, t] of poses) {
    fs.mkdirSync('turn/' + name, { recursive: true });
    await p.evaluate(([n, t]) => window.pose(n, t), [name, t]);
    for (let a = 0; a < 360; a++) {
      const u = await p.evaluate((a) => window.shot(a), a);
      fs.writeFileSync(`turn/${name}/${String(a).padStart(3, '0')}.png`, Buffer.from(u.split(',')[1], 'base64'));
    }
    console.log('done', name);
  }
  await b.close();
})();
