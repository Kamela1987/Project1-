// Usage: NODE_PATH=/opt/node-tools/node_modules node render.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + __dirname + '/brochure.html');
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: __dirname + '/../../images/kenstar-brochure.jpg', type: 'jpeg', quality: 92 });
  await b.close();
})();
