/* Prints the menu's own numbers on a few phones, so layout gaps can be
   checked without squinting at a picture.  node kosher-chain/probe.js      */
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

const PHONES = [
  ['iPhone SE', 375, 667],
  ['iPhone 12', 390, 844],
  ['Pixel 5', 393, 851],
  ['iPhone 15 Pro Max', 430, 932],
  ['iPad mini', 744, 1133],
  ['landscape', 844, 390]
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, w, h] of PHONES) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR: ' + e));
    await page.goto(FILE);
    await page.waitForFunction(() => window.KC && window.KC.Game.screen);
    const r = await page.evaluate(() => {
      const m = window.KC.Game.screen, C = window.KC.CFG, V = window.KC.View;
      const play = m.btns[0];
      return {
        W: Math.round(C.W), H: Math.round(C.H),
        logoTop: Math.round(m.logoY - 59),
        logoBot: Math.round(m.logoY + (window.KC.Progress.totalStars() > 0 ? 316 : 255)),
        demoY: m.demoY == null ? null : Math.round(m.demoY),
        playTop: Math.round(play.y),
        safeT: Math.round(V.safe.t), safeB: Math.round(V.safe.b)
      };
    });
    const gaps = [];
    if (r.demoY != null) {
      gaps.push(r.logoTop - r.safeT, (r.demoY - 46) - r.logoBot, r.playTop - (r.demoY + 129));
    } else {
      gaps.push(r.logoTop - r.safeT, r.playTop - r.logoBot);
    }
    console.log(name.padEnd(18), r.W + 'x' + r.H,
      'demo=' + (r.demoY == null ? 'off' : r.demoY),
      'gaps=' + gaps.map(g => Math.round(g)).join(' / '));
    await ctx.close();
  }
  await browser.close();
})();
