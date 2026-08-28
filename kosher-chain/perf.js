/* Where does a play frame go? Times the busy board with one piece of the
   drawing stubbed out at a time, on a Pixel 5 profile. The page is reloaded
   for every variant, because a stale board and a stale sprite cache make
   every later measurement look worse than the one before it.
   node kosher-chain/perf.js                                                */
const path = require('path');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

const PARTS = ['everything', 'kids', 'hall', 'actions', 'hud', 'vignette',
               'fx', 'ribbon', 'dishes', 'status', 'simcha'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();

  const rows = [];
  for (const part of PARTS) {
    await page.goto(FILE);
    await page.waitForFunction(() => window.KC && window.KC.ready);
    const ms = await page.evaluate(async (part) => {
      const K = window.KC, nop = function () {};
      if (part === 'kids') window.Kids.draw = nop;
      if (part === 'hall') window.Scene.drawHall = nop;
      if (part === 'vignette') window.Draw.vignette = nop;
      if (part === 'fx') window.FX.draw = nop;
      if (part === 'dishes') window.drawDish = nop;
      if (part === 'actions') K.Play.prototype.drawActions = nop;
      if (part === 'hud') K.Play.prototype.drawHUD = nop;
      if (part === 'ribbon') K.Play.prototype.drawRibbon = nop;
      if (part === 'status') K.Play.prototype.drawStatus = nop;
      if (part === 'simcha') K.Play.prototype.drawSimcha = nop;

      const play = new K.Play(11);
      play.relayout();
      K.Game.go(play);
      play.startChain(play.board.get(0, 0));
      play.finger = { x: 300, y: 700 };
      for (let i = 0; i < 24; i++) {
        window.FX.burst(Math.random() * 720, Math.random() * 1280, { n: 12 });
      }
      /* warm the sprite cache, then measure */
      await new Promise(res => {
        let n = 0;
        const loop = () => { if (++n >= 30) return res(); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      });
      const t0 = performance.now();
      let frames = 0;
      await new Promise(res => {
        const loop = () => { if (++frames >= 60) return res(); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      });
      return (performance.now() - t0) / frames;
    }, part);
    rows.push({ part, ms });
  }

  const base = rows[0].ms;
  console.log('\n  frame cost, Pixel 5, busy board\n');
  for (const r of rows) {
    const saved = r.part === 'everything' ? '' : '  saves ' + (base - r.ms).toFixed(2) + 'ms';
    console.log('  ' + ('without ' + r.part).padEnd(20) + r.ms.toFixed(2) + 'ms' + saved);
  }
  console.log('');
  await browser.close();
})();
