/* The same table, and the menu, on the phones we care about, to check the
   board and the title screen sit where they should.
   node kosher-chain/shots-sizes.js                                         */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'shots');
const PHONES = [
  ['se', 375, 667, 2],
  ['pixel', 393, 851, 2.75],
  ['max', 430, 932, 3],
  ['ipad', 744, 1133, 2]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, w, h, dpr] of PHONES) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h }, deviceScaleFactor: dpr,
      isMobile: true, hasTouch: true
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR: ' + e));
    await page.goto(FILE);
    await page.waitForFunction(() => window.KC && window.KC.ready);

    /* the title screen, parked on a frame where the demo has a full plate */
    await page.evaluate(() => {
      const m = window.KC.Game.screen;
      const s = m.demoScript();
      m.t = s.tryAt + 0.6;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, 'size_' + name + '_menu.png') });

    await page.evaluate(() => {
      const p = new window.KC.Play(6);
      p.relayout();
      p.waitMoves = 3;
      window.KC.Game.go(p);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'size_' + name + '.png') });
    console.log('  size_' + name + '.png + menu   ' + w + 'x' + h);
    await ctx.close();
  }
  await browser.close();
})();
