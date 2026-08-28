/* Frames of the title-screen demo, and the same moment under a nusach that
   forbids fish with dairy, so the difference is visible side by side.
   node kosher-chain/demo-shots.js                                          */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const [nusach, lang] of [['ashkenaz', 'en'], ['mizrach', 'en'], ['mizrach', 'he']]) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR: ' + e));
    await page.addInitScript(([n, l]) => {
      if (l === 'he') window.KC_LANG = 'he';
      try { localStorage.clear(); localStorage.setItem('kc_nusach', n); } catch (e) {}
    }, [nusach, lang]);
    await page.goto(FILE);
    await page.waitForFunction(() => window.KC && window.KC.Game.screen);

    /* park the menu clock on the exact frame we want to look at */
    const at = async (secs, name) => {
      await page.evaluate(s => { window.KC.Game.screen.t = s; }, secs);
      await page.waitForTimeout(120);
      const file = 'demo_' + nusach + '_' + name + (lang === 'he' ? '_he' : '') + '.png';
      await page.screenshot({
        path: path.join(OUT, file),
        clip: { x: 0, y: 380, width: 390, height: 300 }
      });
      console.log('  ' + file);
    };
    const script = await page.evaluate(() => window.KC.Game.screen.demoScript());
    await at(script.start + script.linkAt * 1.5, 'building');
    await at(script.tryAt + 0.6, 'refused');
    await at(script.serveAt + 0.15, 'served');
    await page.context().close();
  }
  await browser.close();
})();
