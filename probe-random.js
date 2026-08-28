/* Throwaway: how often does a RANDOM adjacent swap clear something, and how
   much does it clear? Run: node probe-random.js  (delete after) */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForTimeout(700);

  const out = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('kitchen'); Game.beginPlay();
    const s = Game.scene;
    const R = KitchenMatch.ROWS, C = KitchenMatch.COLS;

    let log = [];
    const realClear = KitchenMatch.prototype.clearCells;
    KitchenMatch.prototype.clearCells = function (cells, cascade) {
      log.push(cells.length);
      return realClear.call(this, cells, cascade);
    };

    let rng = 4242;
    const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };

    let tries = 0, cleared = 0, tiles = 0, multiPlate = 0, big = 0;
    /* how many of all possible swaps on a fresh board would clear something */
    let swapTotal = 0, swapHits = 0;

    for (let board = 0; board < 300; board++) {
      s.level = 1 + Math.floor(rnd() * 12);
      s.setupShift(true);
      s.lives = 99; s.need = 99999; s.riseT = 999; s.rushTimer = 999;
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const t = s.grid[r][c];
        if (t && t.covered) { t.covered = false; t.reveal = 1; }
      }

      /* census of every legal swap on this untouched board */
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          for (const [dc, dr] of [[1, 0], [0, 1]]) {
            const c2 = c + dc, r2 = r + dr;
            if (c2 >= C || r2 >= R) continue;
            const a = s.grid[r][c], b = s.grid[r2][c2];
            if (!a || !b) continue;
            swapTotal++;
            s.grid[r][c] = b; s.grid[r2][c2] = a;
            const hits = s.findMatches(s.swapPrefer(c, r, c2, r2));
            let used = false;
            for (const h of hits) if ((h.c === c && h.r === r) || (h.c === c2 && h.r === r2)) { used = true; break; }
            s.grid[r][c] = a; s.grid[r2][c2] = b;
            if (used) swapHits++;
          }
        }
      }

      /* now poke it at random, like a player who is not looking */
      for (let step = 0; step < 12; step++) {
        s.busy = 0; s._shifting = false;
        const c1 = Math.floor(rnd() * C), r1 = Math.floor(rnd() * R);
        const horiz = rnd() < 0.5;
        const c2 = horiz ? c1 + 1 : c1, r2 = horiz ? r1 : r1 + 1;
        if (c2 >= C || r2 >= R) continue;
        if (!s.grid[r1][c1] || !s.grid[r2][c2]) continue;
        log = [];
        tries++;
        s.trySwap(c1, r1, c2, r2);
        if (!log.length) continue;
        cleared++;
        const n = log.reduce((a, b) => a + b, 0);
        tiles += n;
        if (log.length > 1) multiPlate++;
        if (n >= 5) big++;
      }
    }

    KitchenMatch.prototype.clearCells = realClear;
    return {
      tries, cleared, pctCleared: Math.round(cleared / tries * 100),
      avgTiles: (tiles / Math.max(1, cleared)).toFixed(1),
      pctMultiPlate: Math.round(multiPlate / Math.max(1, cleared) * 100),
      pctFivePlus: Math.round(big / Math.max(1, cleared) * 100),
      swapTotal, swapHits, pctSwapsThatWork: Math.round(swapHits / swapTotal * 100)
    };
  });

  console.log('random pokes:', out.tries, '| of those, cleared something:', out.cleared, '=', out.pctCleared + '%');
  console.log('when it clears: average', out.avgTiles, 'dishes |', out.pctFivePlus + '% lift 5 or more |',
    out.pctMultiPlate + '% lift more than one plate at once');
  console.log('on an untouched board,', out.pctSwapsThatWork + '% of every possible swap already clears something',
    '(' + out.swapHits + '/' + out.swapTotal + ')');

  await browser.close();
})();
