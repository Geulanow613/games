/* ===========================================================================
   Kosher Chain - test harness
   Runs the real game in a real browser on a real phone viewport, and drives
   it with real touch events. Nothing here reaches into internals to fake a
   move: every chain is drawn with a finger.

   node kosher-chain/qa.js            all tests
   node kosher-chain/qa.js rule       only tests whose name contains "rule"
   node kosher-chain/qa.js --headed   watch it play
   =========================================================================== */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium, devices } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const filter = args.filter(a => !a.startsWith('--'))[0] || '';

const PHONES = {
  'iPhone 12': { width: 390, height: 844, dpr: 3 },
  'iPhone SE': { width: 375, height: 667, dpr: 2 },
  'Pixel 5': { width: 393, height: 851, dpr: 2.75 },
  'iPad mini': { width: 744, height: 1133, dpr: 2 }
};

let pass = 0, fail = 0;
const failures = [];

function ok(cond, name, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else {
    fail++;
    failures.push(name + (detail ? '\n         ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? '\n         ' + detail : ''));
  }
}

/* --------------------------------------------------------------- fixtures */
async function newPage(browser, phone = 'iPhone 12', opts = {}) {
  const p = PHONES[phone];
  const ctx = await browser.newContext({
    viewport: { width: p.width, height: p.height },
    deviceScaleFactor: p.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
               '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(([lang, nusach]) => {
    if (lang) window.KC_LANG = lang;
    try { localStorage.clear(); } catch (e) {}
    if (nusach) {
      try { localStorage.setItem('kc_nusach', nusach); } catch (e) {}
    }
  }, [opts.lang || null, opts.nusach || null]);
  await page.goto(FILE);
  await page.waitForFunction(() => window.KC && window.KC.Game && window.KC.Game.screen, null, { timeout: 8000 });
  page.__errors = errors;
  return { ctx, page, errors };
}

/* A throwaway web server, so the install-and-play-offline path can be tested
   the way a phone really loads it. file:// has no service worker. */
function serve() {
  const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
    '.webmanifest': 'application/manifest+json', '.json': 'application/json'
  };
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.join(__dirname, rel);
    if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not here');
    }
    res.writeHead(200, {
      'content-type': types[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(done => {
    server.listen(0, '127.0.0.1', () => {
      done({ server, url: 'http://127.0.0.1:' + server.address().port + '/' });
    });
  });
}

/* jump straight into a level with a board we control. The rule cards have
   been read already unless a test says otherwise, so a refusal does not stop
   the table to explain itself in the middle of a scripted move. */
async function setBoard(page, spec) {
  return page.evaluate(spec => {
    const K = window.KC;
    const Play = K.Play;
    if (!spec.freshCards) {
      for (const key in K.TEACH) K.Progress.seenTeach[key] = true;
    }
    const li = spec.li == null ? 0 : spec.li;
    const play = new Play(li);
    play.relayout();
    if (spec.moves) play.moves = spec.moves;
    if (spec.orders) play.orders = spec.orders.map(o => ({ kind: o.kind, need: o.need, got: 0 }));
    const b = play.board;
    /* fillWith makes every unnamed cell the same inert food, so a test only
       ever has to reason about the cells it actually named */
    if (spec.fillWith) {
      for (const t of b.cells) {
        if (!t) continue;
        t.f = K.foodByName(spec.fillWith);
        t.covered = false;
        t.born = 1;
      }
      /* and keep the refill inert too, or the board changes under the test */
      b.rollFood = () => K.foodByName(spec.fillWith);
    }
    if (spec.rows) {
      /* rows is an array of arrays of food names; '.' keeps whatever is there */
      for (let gy = 0; gy < spec.rows.length && gy < b.rows; gy++) {
        for (let gx = 0; gx < spec.rows[gy].length && gx < b.cols; gx++) {
          const name = spec.rows[gy][gx];
          if (name === '.') continue;
          const t = b.get(gx, gy);
          if (!t) continue;
          t.f = K.foodByName(name);
          t.covered = false;
          t.born = 1;
        }
      }
    }
    K.Game.go(play);
    window.__play = play;
    return { cols: play.board.cols, rows: play.board.rows };
  }, spec);
}

/* Write foods into the live board without resetting the game. Needed because
   serving a plate makes the column above it fall, so a test that wants the
   same dish in the same place for a second move has to put it back. */
async function stamp(page, rows) {
  await page.evaluate(rows => {
    const K = window.KC, b = window.__play.board;
    for (let gy = 0; gy < rows.length && gy < b.rows; gy++) {
      for (let gx = 0; gx < rows[gy].length && gx < b.cols; gx++) {
        const name = rows[gy][gx];
        if (name === '.') continue;
        const t = b.get(gx, gy);
        if (!t) continue;
        t.f = K.foodByName(name);
        t.covered = false;
        t.born = 1;
      }
    }
  }, rows);
}

/* logical grid cell -> CSS page coordinate, exactly where a finger would land */
async function cellPoint(page, gx, gy) {
  return page.evaluate(([gx, gy]) => {
    const V = window.KC.View, b = window.__play.board;
    const rect = V.canvas.getBoundingClientRect();
    return {
      x: rect.left + V.ox + b.cx(gx) * V.scale,
      y: rect.top + V.oy + b.cy(gy) * V.scale
    };
  }, [gx, gy]);
}

/* Draw a chain with one finger through the given cells.
   hold:true leaves the finger down so the chain can be inspected mid-gesture;
   the caller must then call lift(). smooth:false flings straight from cell to
   cell with no in-between samples, the way a fast swipe actually arrives. */
async function drag(page, cells, opts = {}) {
  const pts = [];
  for (const c of cells) pts.push(await cellPoint(page, c[0], c[1]));
  await page.evaluate(async ([pts, hold, smooth]) => {
    const cv = window.KC.View.canvas;
    const fire = (type, x, y) => {
      cv.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, bubbles: true, cancelable: true
      }));
    };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    fire('pointerdown', pts[0].x, pts[0].y);
    await sleep(20);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const steps = smooth === false ? 1 : 4;
      for (let s = 1; s <= steps; s++) {
        fire('pointermove', a.x + (b.x - a.x) * s / steps, a.y + (b.y - a.y) * s / steps);
        await sleep(8);
      }
    }
    await sleep(20);
    if (!hold) fire('pointerup', pts[pts.length - 1].x, pts[pts.length - 1].y);
  }, [pts, !!opts.hold, opts.smooth]);
  await page.waitForTimeout(opts.hold ? 40 : 160);
}

/* let go of a held chain without serving it */
async function lift(page, cancel = true) {
  await page.evaluate(cancel => {
    const cv = window.KC.View.canvas;
    cv.dispatchEvent(new PointerEvent(cancel ? 'pointercancel' : 'pointerup', {
      pointerId: 1, pointerType: 'touch', isPrimary: true,
      clientX: 0, clientY: 0, bubbles: true, cancelable: true
    }));
  }, cancel);
  await page.waitForTimeout(120);
}

/* tap any logical point on the canvas - used for HUD buttons, not just cells */
async function tapAt(page, lx, ly) {
  const p = await page.evaluate(([lx, ly]) => {
    const V = window.KC.View;
    const rect = V.canvas.getBoundingClientRect();
    return { x: rect.left + V.ox + lx * V.scale, y: rect.top + V.oy + ly * V.scale };
  }, [lx, ly]);
  await page.evaluate(([x, y]) => {
    const cv = window.KC.View.canvas;
    const fire = (type) => cv.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: y, bubbles: true, cancelable: true
    }));
    fire('pointerdown'); fire('pointerup');
  }, [p.x, p.y]);
  await page.waitForTimeout(140);
}

async function tapCell(page, gx, gy) {
  const p = await cellPoint(page, gx, gy);
  await page.evaluate(([x, y]) => {
    const cv = window.KC.View.canvas;
    const fire = (type) => cv.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: y, bubbles: true, cancelable: true
    }));
    fire('pointerdown'); fire('pointerup');
  }, [p.x, p.y]);
  await page.waitForTimeout(140);
}

/* the two free actions, straight on the play screen */
async function wash(page) {
  await page.evaluate(() => window.__play.doWash());
  await page.waitForTimeout(60);
}
async function rinse(page) {
  await page.evaluate(() => window.__play.doRinse());
  await page.waitForTimeout(60);
}
async function bentch(page) {
  await page.evaluate(() => window.__play.doBentch());
  await page.waitForTimeout(60);
}

const state = page => page.evaluate(() => {
  const p = window.__play;
  return {
    chain: p.chain.length,
    chainCells: p.chain.map(c => [c.gx, c.gy]),
    score: p.score, moves: p.moves,
    orders: p.orders.map(o => ({ kind: o.kind, got: o.got, need: o.need })),
    reason: p.reason ? p.reason.why : null,
    waitMoves: p.waitMoves, waitLeft: p.waitLeft, needRinse: p.needRinse,
    needWash: p.needWash, needDrink: p.needDrink, needPareve: p.needPareve,
    needFishDrink: p.needFishDrink,
    washed: p.washed, simcha: Math.round(p.simcha), clock: p.clock, day: p.day,
    mealSide: p.mealSide, mealAte: p.mealAte, meals: p.meals,
    drain: p.drain, flashKey: p.flashKey || null,
    loop: p.loop, over: p.over, overWhy: p.overWhy || null,
    plate: p.plate
  };
});

/* ===================================================================== */
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ------------------------------------------------------------ boot & shell */
test('boots on a phone with no errors and fills the screen', async (browser) => {
  const { page, errors } = await newPage(browser);
  const info = await page.evaluate(() => {
    const V = window.KC.View;
    return {
      cw: V.canvas.width, ch: V.canvas.height,
      cssW: parseFloat(V.canvas.style.width), cssH: parseFloat(V.canvas.style.height),
      dpr: V.dpr, scale: V.scale,
      innerW: window.innerWidth, innerH: window.innerHeight,
      screen: window.KC.Game.screen.constructor.name
    };
  });
  ok(errors.length === 0, 'no runtime errors on boot', errors.join('\n         '));
  ok(info.cssW === info.innerW && info.cssH === info.innerH, 'canvas covers the viewport',
    JSON.stringify(info));
  ok(info.cw === Math.round(info.cssW * info.dpr), 'canvas backing store matches device pixels',
    `${info.cw} vs ${info.cssW}x${info.dpr}`);
  ok(info.dpr > 1, 'renders at the real device pixel ratio (dpr ' + info.dpr + ')');
  ok(info.screen === 'Menu', 'lands on the menu');
  await page.context().close();
});

test('the page cannot scroll, zoom or select - it behaves like an app', async (browser) => {
  const { page } = await newPage(browser);
  const r = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const h = getComputedStyle(document.documentElement);
    const meta = document.querySelector('meta[name=viewport]').content;
    return {
      touchAction: h.touchAction, overflow: h.overflow,
      select: b.userSelect || b.webkitUserSelect,
      meta,
      canvasTouch: getComputedStyle(document.getElementById('stage')).touchAction
    };
  });
  ok(r.touchAction === 'none', 'touch-action is none, so no browser panning', r.touchAction);
  ok(r.canvasTouch === 'none', 'canvas takes every touch itself', r.canvasTouch);
  ok(r.overflow === 'hidden', 'nothing scrolls');
  ok(r.select === 'none', 'text cannot be selected by a long press');
  ok(/user-scalable=no/.test(r.meta) && /viewport-fit=cover/.test(r.meta),
    'viewport blocks pinch zoom and reaches under the notch', r.meta);
  await page.context().close();
});

test('a scrolling gesture on the board never scrolls the page', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0 });
  await drag(page, [[0, 0], [0, 1], [0, 2]]);
  const y = await page.evaluate(() => window.scrollY + document.documentElement.scrollTop);
  ok(y === 0, 'window stayed put during a drag', 'scrollY ' + y);
  await page.context().close();
});

test('it lays out on every phone size and never puts the board off screen', async (browser) => {
  for (const name of Object.keys(PHONES)) {
    const { page } = await newPage(browser, name);
    await setBoard(page, { li: 11 });
    const r = await page.evaluate(() => {
      const b = window.__play.board, V = window.KC.View, C = window.KC.CFG;
      return {
        left: b.bx, right: b.bx + b.bw, top: b.by, bottom: b.by + b.bh,
        cellCss: b.cell * V.scale,
        W: C.W, H: C.H, ox: V.ox, oy: V.oy,
        safe: V.safe
      };
    });
    ok(r.left >= 0 && r.right <= r.W && r.top >= 0 && r.bottom <= r.H,
      name + ': board sits inside the safe layout', JSON.stringify(r));
    ok(r.cellCss >= 40, name + ': dishes are at least 40 css px, big enough for a thumb',
      'cell ' + r.cellCss.toFixed(1) + 'px');
    ok(Math.abs(r.ox) < 1 && Math.abs(r.oy) < 1,
      name + ': the game fills the screen with no black bars',
      `offset ${r.ox.toFixed(1)},${r.oy.toFixed(1)}`);
    await page.context().close();
  }
});

test('rotating to landscape re-lays out without breaking', async (browser) => {
  const { page, errors } = await newPage(browser);
  await setBoard(page, { li: 5 });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const b = window.__play.board, C = window.KC.CFG;
    return {
      left: b.bx, right: b.bx + b.bw, top: b.by, bottom: b.by + b.bh, cell: b.cell,
      W: C.W, H: C.H
    };
  });
  ok(r.left >= 0 && r.right <= r.W && r.top >= 0 && r.bottom <= r.H && r.cell > 0,
    'landscape board is still on screen', JSON.stringify(r));
  ok(errors.length === 0, 'no errors while rotating', errors.join('\n'));
  await page.context().close();
});

/* -------------------------------------------------------------- the chain */
test('a chain of three pareve foods serves and scores', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 0, fillWith: 'Apple',
    rows: [['Challah', 'Carrot', 'Egg']]
  });
  await wash(page);                       /* the challah needs washed hands */
  const before = await state(page);
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  const after = await state(page);
  ok(after.score > before.score, 'the plate scored', `${before.score} -> ${after.score}`);
  ok(after.moves === before.moves - 1, 'it cost exactly one move');
  ok(after.chain === 0, 'the chain let go');
  await page.context().close();
});

test('two foods is not a plate', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, fillWith: 'Apple', rows: [['Challah', 'Carrot']] });
  const before = await state(page);
  await drag(page, [[0, 0], [1, 0]]);
  const after = await state(page);
  ok(after.score === before.score, 'nothing was served');
  ok(after.moves === before.moves, 'no move was spent');
  await page.context().close();
});

test('nothing ever clears on its own - an untouched board stays put', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 11 });
  const sig = () => page.evaluate(() => window.__play.board.cells.map(c => c ? c.id : 0).join(','));
  const a = await sig();
  const s0 = await state(page);
  await page.waitForTimeout(1500);
  const b = await sig();
  const s1 = await state(page);
  ok(a === b, 'not one dish moved while nobody played');
  ok(s0.score === s1.score && s0.moves === s1.moves, 'score and moves untouched');
  await page.context().close();
});

test('a fast fling cannot make the chain jump over a dish', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, fillWith: 'Apple' });
  /* one single move event straight past the middle cell */
  await drag(page, [[0, 0], [2, 0]], { hold: true, smooth: false });
  const s = await state(page);
  ok(s.chain === 1, 'the chain refused to skip a dish', 'chain ' + s.chain);
  await lift(page);
  await page.context().close();
});

test('a finger passing over a dish does pick it up', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, fillWith: 'Apple' });
  await drag(page, [[0, 0], [2, 0]], { hold: true });
  const s = await state(page);
  ok(s.chain === 3, 'sliding across three dishes picked up all three',
    'chain ' + s.chain + ' ' + JSON.stringify(s.chainCells));
  await lift(page);
  await page.context().close();
});

test('dragging back one step takes the last food off the plate', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, fillWith: 'Apple' });
  await drag(page, [[0, 0], [1, 0], [2, 0], [1, 0]], { hold: true });
  const s = await state(page);
  ok(s.chain === 2, 'the plate went back to two', 'chain ' + s.chain);
  ok(s.chainCells[1][0] === 1, 'the last link is the one we backed onto',
    JSON.stringify(s.chainCells));
  await lift(page);
  await page.context().close();
});

test('a longer plate is worth more than two short ones', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, fillWith: 'Apple' });
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  const short = (await state(page)).score;
  await setBoard(page, { li: 0, fillWith: 'Apple' });
  await drag(page, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  const long = (await state(page)).score;
  ok(long > short * 2, 'six beats three twice over', `3-chain ${short}, 6-chain ${long}`);
  await page.context().close();
});

/* --------------------------------------------------------------- halacha */
test('rule: meat and milk never land on the same plate', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 1, fillWith: 'Apple',
    rows: [['Brisket', 'Chicken', 'Cheese', 'Apple']]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
  const s = await state(page);
  ok(s.chain === 2, 'the cheese was refused', 'chain ' + s.chain);
  ok(/never share a plate/.test(s.reason || ''), 'and it said why', s.reason);
  await lift(page);
  await page.context().close();
});

test('rule: milk and then meat is refused just the same', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 1, fillWith: 'Apple',
    rows: [['Cheese', 'Butter', 'Brisket', 'Apple']]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
  const s = await state(page);
  ok(s.chain === 2, 'the brisket was refused', 'chain ' + s.chain);
  ok(/never share a plate/.test(s.reason || ''), 'and it said why', s.reason);
  await lift(page);
  await page.context().close();
});

test('rule: fish never joins a meat plate, for anybody', async (browser) => {
  for (const nusach of ['ashkenaz', 'sefard', 'mizrach', 'chabad']) {
    const { page } = await newPage(browser, 'iPhone 12', { nusach });
    await setBoard(page, {
      li: 3, fillWith: 'Apple',
      rows: [['Brisket', 'Apple', 'Salmon', 'Apple']]
    });
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    const s = await state(page);
    ok(s.chain === 2 && /fish with meat/.test(s.reason || ''),
      nusach + ': fish stopped at the meat plate', `chain ${s.chain}, reason ${s.reason}`);
    await lift(page);
    await page.context().close();
  }
});

test('rule: treif can never join a plate, in any direction', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 4, fillWith: 'Apple' });
  const cases = [
    ['Shrimp', /never kosher/],
    ['Bacon', /never kosher/],
    ['Cheeseburger', /cheese/]
  ];
  for (const [name, why] of cases) {
    await stamp(page, [['Apple', 'Carrot', name]]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    const s = await state(page);
    ok(s.chain === 2, name + ' was refused', 'chain ' + s.chain);
    ok(why.test(s.reason || ''), name + ' explained itself', s.reason);
    await lift(page);
  }
  await page.context().close();
});

test('rule: a chain may not start on treif, it goes in the bin instead', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 4, fillWith: 'Apple', orders: [{ kind: 'treif', need: 2 }],
    rows: [['Shrimp', 'Apple', 'Apple']]
  });
  const before = await state(page);
  await tapCell(page, 0, 0);
  const after = await state(page);
  ok(after.chain === 0, 'no chain was started');
  ok(after.orders[0].got === 1, 'the bin order ticked up',
    JSON.stringify(after.orders));
  ok(after.score > before.score, 'throwing it out was worth points');
  ok(after.moves === before.moves, 'binning treif costs no move');
  await page.context().close();
});

test('rule: a covered dish may not join until the lid is lifted', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 5, fillWith: 'Apple' });
  await page.evaluate(() => {
    const b = window.__play.board;
    for (const c of b.cells) if (c) c.covered = false;
    b.get(2, 0).covered = true;
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
  let s = await state(page);
  ok(s.chain === 2 && /Lift the lid/.test(s.reason || ''),
    'the lid blocked the chain', `chain ${s.chain}, ${s.reason}`);
  await lift(page);
  await tapCell(page, 2, 0);
  const covered = await page.evaluate(() => window.__play.board.get(2, 0).covered);
  ok(covered === false, 'tapping the lid uncovered the dish');
  await page.context().close();
});

/* --------------------------------------------------------------- nusach */
test('nusach: salmon then cheese - allowed for Ashkenaz and Sefard, not for Edot HaMizrach',
  async (browser) => {
    const expect = { ashkenaz: 3, sefard: 3, mizrach: 2, chabad: 3 };
    for (const nusach of Object.keys(expect)) {
      const { page } = await newPage(browser, 'iPhone 12', { nusach });
      await setBoard(page, {
        li: 3, fillWith: 'Apple',
        rows: [['Salmon', 'Apple', 'Cheese', 'Apple']]
      });
      await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
      const s = await state(page);
      ok(s.chain === expect[nusach],
        nusach + ': salmon + cheese chain is ' + expect[nusach],
        `chain ${s.chain}, reason ${s.reason}`);
      if (expect[nusach] === 2) {
        ok(/nusach keeps fish off dairy/.test(s.reason || ''),
          nusach + ': named the nusach in the refusal', s.reason);
      }
      await lift(page);
      await page.context().close();
    }
  });

test('nusach: Chabad takes fish with cheese but never with liquid milk', async (browser) => {
  const { page } = await newPage(browser, 'iPhone 12', { nusach: 'chabad' });
  await setBoard(page, {
    li: 3, fillWith: 'Apple',
    rows: [['Salmon', 'Apple', 'Milk', 'Apple']]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
  const s = await state(page);
  ok(s.chain === 2, 'chabad: the milk was refused after fish', 'chain ' + s.chain);
  ok(/never with milk/.test(s.reason || ''), 'chabad: said milk, not dairy', s.reason);
  await lift(page);
  await page.context().close();
});

test('nusach: it works the other way round too - milk then fish', async (browser) => {
  const { page } = await newPage(browser, 'iPhone 12', { nusach: 'chabad' });
  await setBoard(page, {
    li: 3, fillWith: 'Apple',
    rows: [['Milk', 'Apple', 'Salmon', 'Apple']]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
  const s = await state(page);
  ok(s.chain === 2 && /never with milk/.test(s.reason || ''),
    'chabad: fish refused onto a milk plate', `chain ${s.chain}, ${s.reason}`);
  await lift(page);
  await page.context().close();
});

test('nusach: changing it in the menu changes what the board allows', async (browser) => {
  const { page } = await newPage(browser, 'iPhone 12', { nusach: 'mizrach' });
  const r = await page.evaluate(() => {
    const K = window.KC;
    const plate = K.addToPlate(K.emptyPlate(), K.foodByName('Salmon'));
    const cheese = K.foodByName('Cheese');
    const before = K.plateAccepts(plate, cheese, 'mizrach').ok;
    K.Nusach.set('ashkenaz');
    const after = K.plateAccepts(plate, cheese, K.Nusach.id).ok;
    return { before, after, id: K.Nusach.id };
  });
  ok(r.before === false && r.after === true,
    'the same plate flips when the nusach changes', JSON.stringify(r));
  await page.context().close();
});

/* every nusach, every pair, checked against the rules written out longhand */
test('rule: a full sweep of every food pair matches the halacha, for every nusach',
  async (browser) => {
    const { page } = await newPage(browser);
    const bad = await page.evaluate(() => {
      const K = window.KC;
      const out = [];
      const nusachs = ['ashkenaz', 'sefard', 'mizrach', 'chabad'];

      /* the truth, spelled out independently of the game code */
      function allowed(a, b, n) {
        const cats = [a.cat, b.cat];
        if (cats.includes('treif') || cats.includes('mixed')) return false;
        const has = c => cats.includes(c);
        if (has('meat') && has('dairy')) return false;
        if (has('meat') && has('fish')) return false;
        if (has('fish') && has('dairy')) {
          if (n === 'mizrach') return false;
          if (n === 'chabad') {
            const milk = (a.liquidMilk && b.cat === 'fish') || (b.liquidMilk && a.cat === 'fish');
            if (milk) return false;
          }
        }
        return true;
      }

      for (const n of nusachs) {
        for (const a of K.FOODS) {
          for (const b of K.FOODS) {
            const plate = K.addToPlate(K.emptyPlate(), a);
            /* a plate that starts with treif is impossible, skip that half */
            if (a.cat === 'treif' || a.cat === 'mixed') {
              const r0 = K.plateAccepts(K.emptyPlate(), a, n);
              if (r0.ok) out.push(`${n}: ${a.name} should never be plateable`);
              continue;
            }
            const got = K.plateAccepts(plate, b, n).ok;
            const want = allowed(a, b, n);
            if (got !== want) out.push(`${n}: ${a.name} + ${b.name} got ${got} want ${want}`);
          }
        }
      }
      return out;
    });
    ok(bad.length === 0, 'every one of the ' + (18 * 18 * 4) + ' pairs agrees',
      bad.slice(0, 8).join('\n         '));
    await page.context().close();
  });

test('rule: a long chain stays legal end to end, not just pair by pair', async (browser) => {
  const { page } = await newPage(browser, 'iPhone 12', { nusach: 'ashkenaz' });
  await setBoard(page, {
    li: 3, fillWith: 'Apple',
    rows: [['Salmon', 'Apple', 'Cheese', 'Egg', 'Brisket', 'Apple', 'Apple']]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], { hold: true });
  const s = await state(page);
  ok(s.chain === 4, 'the brisket was refused at the end of a fish-and-cheese chain',
    'chain ' + s.chain);
  ok(/never share a plate|fish with meat/.test(s.reason || ''), 'and said why', s.reason);
  await lift(page);
  await page.context().close();
});

/* ------------------------------------------------------- between courses */
test('rule: after a fleishig plate the milchig orders have to wait', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 1, moves: 20, fillWith: 'Apple',
    rows: [
      ['Brisket', 'Chicken', 'Salami', 'Apple'],
      ['Cheese', 'Butter', 'Yogurt', 'Apple']
    ]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  let s = await state(page);
  ok(s.waitMoves > 0, 'the wait started', 'waitMoves ' + s.waitMoves);

  await drag(page, [[0, 1], [1, 1], [2, 1]], { hold: true });
  s = await state(page);
  ok(s.chain === 0, 'no dairy could even be picked up during the wait', 'chain ' + s.chain);
  ok(/waiting after the meat/.test(s.reason || ''), 'and it said we are waiting', s.reason);
  await lift(page);
  await page.context().close();
});

test('rule: the wait runs down as you serve other things', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 1, moves: 20, fillWith: 'Apple',
    rows: [['Brisket', 'Chicken', 'Salami', 'Apple']]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  const start = (await state(page)).waitMoves;
  /* three pareve plates from the filler */
  for (let i = 0; i < 3; i++) {
    await drag(page, [[0, 3], [1, 3], [2, 3]]);
  }
  const end = (await state(page)).waitMoves;
  ok(start === 3 && end === 0, 'three plates later the wait is done', `${start} -> ${end}`);
  await page.context().close();
});

test('rule: milchig never joins a fleishig meal, even once the six hours are up',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, {
      li: 1, moves: 20, fillWith: 'Apple',
      rows: [['Brisket', 'Chicken', 'Salami', 'Apple']]
    });

    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    let s = await state(page);
    ok(s.mealSide === 'meat', 'the meal is now a fleishig meal', String(s.mealSide));

    /* three pareve plates, which is the six hours */
    for (let i = 0; i < 3; i++) await drag(page, [[0, 3], [1, 3], [2, 3]]);
    s = await state(page);
    ok(s.waitLeft === 0, 'the six hours are up', String(s.waitLeft));
    ok(s.mealSide === 'meat', 'but it is still the same meal', String(s.mealSide));

    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    s = await state(page);
    ok(s.chain === 0, 'the cheese would not go on the plate', 'chain ' + s.chain);
    ok(/[Bb]entch/.test(s.reason || ''), 'and it said to bentch first', s.reason);
    await lift(page);

    const before = await state(page);
    await bentch(page);
    s = await state(page);
    ok(s.mealSide === null && s.mealAte === 0, 'bentching ended the meal',
      JSON.stringify({ side: s.mealSide, ate: s.mealAte }));
    ok(s.moves === before.moves, 'bentching costs no move');

    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.mealSide === 'dairy' && s.orders.some(o => o.kind === 'dairy' && o.got > 0),
      'and now the milchig plate went out', JSON.stringify(s.orders));
    await page.context().close();
  });

test('rule: nothing to bentch on yet, so bentching does nothing', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 1, moves: 20, fillWith: 'Apple' });
  const before = await state(page);
  await bentch(page);
  const s = await state(page);
  ok(s.meals === 0, 'no meal was ended', String(s.meals));
  ok(s.clock === before.clock, 'and the clock did not move', String(s.clock));
  await page.context().close();
});

test('rule: one washing covers the whole meal, and bentching means washing again',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, {
      li: 0, moves: 20, fillWith: 'Apple',
      rows: [['Challah', 'Challah', 'Challah', 'Apple']]
    });

    await wash(page);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    let s = await state(page);
    ok(s.washed === true, 'the washing held through the challah');

    /* more bread at the same meal needs no second washing */
    await stamp(page, [['Challah', 'Challah', 'Challah']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.washed === true && s.mealAte === 2,
      'and it held for the second challah plate too', JSON.stringify(s));

    /* a milchig plate does not undo a netilas yadayim either */
    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.washed === true, 'eating milchig does not undo the washing');

    await bentch(page);
    s = await state(page);
    ok(s.washed === false, 'bentching does');

    await stamp(page, [['Challah', 'Challah', 'Challah']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    s = await state(page);
    ok(s.chain === 0 && /[Ww]ash/.test(s.reason || ''),
      'so the next meal starts with washing', `chain ${s.chain}, ${s.reason}`);
    await lift(page);
    await page.context().close();
  });

test('it is the same boys all day, so what they ate still counts',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 1, moves: 30, fillWith: 'Apple' });
    const first = await page.evaluate(() =>
      window.__play.kids.map(k => k.skin + k.shirt).join('|'));

    await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    /* breakfast at 7am, two hours a plate: this walks the clock into lunch */
    for (let i = 0; i < 2; i++) await drag(page, [[0, 0], [1, 0], [2, 0]]);
    await page.waitForTimeout(1200);
    const s = await state(page);
    const faces = await page.evaluate(() =>
      window.__play.kids.map(k => k.skin + k.shirt).join('|'));

    ok(s.clock >= 13 * 60, 'the clock reached the afternoon', String(s.clock));
    ok(faces === first, 'the same boys are still at the table');
    ok(s.mealSide === 'meat',
      'and the meal on the table is still their fleishig meal', String(s.mealSide));
    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    const held = await state(page);
    ok(held.chain === 0, 'so milchig is still held back by the meal they ate');
    await lift(page);
    await page.context().close();
  });

test('rule: after milchig, meat waits for washing, a drink and something pareve',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 2, moves: 20, fillWith: 'Apple' });

    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    let s = await state(page);
    ok(s.needWash && s.needDrink && s.needPareve, 'all three are owed after milchig',
      JSON.stringify(s));
    ok(s.mealSide === 'dairy', 'and the meal is a milchig meal', String(s.mealSide));

    await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    s = await state(page);
    ok(s.chain === 0 && /wash, drink/.test(s.reason || ''),
      'meat is refused until all three are done', `chain ${s.chain}, ${s.reason}`);
    await lift(page);

    /* washing and drinking are free - they do not cost a move */
    const before = await state(page);
    await wash(page);
    await rinse(page);
    s = await state(page);
    ok(!s.needWash && !s.needDrink, 'the two free actions were taken');
    ok(s.moves === before.moves, 'neither of them cost a move');
    ok(s.needPareve === true, 'the pareve plate is still owed');

    await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    s = await state(page);
    ok(s.chain === 0, 'meat is still refused with the kinuach outstanding');
    await lift(page);

    /* the whole board is apples, so any three of them is the pareve plate */
    await stamp(page, [['Apple', 'Apple', 'Apple']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.needRinse === false, 'a pareve plate finished the job');

    await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.waitMoves === 3 && s.waitLeft === 360,
      'and now the meat plate went out, starting six hours', JSON.stringify(s));
    await page.context().close();
  });

test('rule: after fish, the boys drink before any meat goes out', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 4, moves: 20, fillWith: 'Apple' });
  await stamp(page, [['Salmon', 'Tuna', 'Salmon']]);
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  let s = await state(page);
  ok(s.needDrink === true, 'a drink is owed after the fish plate');
  ok(s.needWash === false && s.needPareve === false, 'and only a drink');

  await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
  await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
  s = await state(page);
  ok(s.chain === 0 && /Rinse between fish and meat/.test(s.reason || ''),
    'the meat was held back', `chain ${s.chain}, ${s.reason}`);
  await lift(page);

  await rinse(page);
  await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  s = await state(page);
  ok(s.waitMoves === 3, 'after the drink the meat plate went out', JSON.stringify(s));
  await page.context().close();
});

test('rule: and it goes the other way round - fish waits for a rinse after meat',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 4, moves: 20, fillWith: 'Apple' });
    await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    let s = await state(page);
    ok(s.needFishDrink === true, 'a drink is owed before any fish now');

    await stamp(page, [['Salmon', 'Tuna', 'Salmon']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    s = await state(page);
    ok(s.chain === 0 && /Rinse between meat and fish/.test(s.reason || ''),
      'the fish was held back', `chain ${s.chain}, ${s.reason}`);
    await lift(page);

    const before = await state(page);
    await rinse(page);
    s = await state(page);
    ok(s.needFishDrink === false, 'the rinse cleared it');
    ok(s.moves === before.moves, 'and it was free');

    await stamp(page, [['Salmon', 'Tuna', 'Salmon']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.score > before.score, 'now the fish plate goes out');
    ok(s.waitLeft > 0, 'and the six hours from the meat are still running',
      String(s.waitLeft));
    await page.context().close();
  });

test('rule: challah may not be served with unwashed hands', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, moves: 20, fillWith: 'Apple' });
  await stamp(page, [['Challah', 'Apple', 'Carrot']]);
  let s = await state(page);
  ok(s.washed === false, 'a new table starts with unwashed hands');
  await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
  s = await state(page);
  ok(s.chain === 0 && /Wash your hands/.test(s.reason || ''),
    'the challah would not go on the plate', `chain ${s.chain}, ${s.reason}`);
  await lift(page);

  const before = await state(page);
  await wash(page);
  await stamp(page, [['Challah', 'Apple', 'Carrot']]);
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  s = await state(page);
  ok(s.washed === true, 'the hands are washed');
  ok(s.moves === before.moves - 1, 'washing was free, the plate cost the move');
  ok(s.score > before.score, 'and the challah went out');
  await page.context().close();
});

test('a fresh table asks for nothing until something is actually owed',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 0, moves: 20, fillWith: 'Apple' });
    const s = await state(page);
    ok(s.needRinse === false && s.waitLeft === 0 && s.mealSide === null,
      'nothing is owed on the first plate of the week', JSON.stringify(s));
    ok(s.reason === null, 'and the boys are not being told off about anything');
    /* the status strip is the nusach line, not a washing instruction */
    const strip = await page.evaluate(() => {
      const p = window.__play, seen = [];
      const ctx = window.KC.View.ctx;
      const realFit = window.KC.Draw.textFit, realText = window.KC.Draw.text;
      window.KC.Draw.textFit = function (c, s) { seen.push(s); };
      window.KC.Draw.text = function (c, s) { seen.push(s); };
      p.drawStatus(ctx, 0, 0, 300);
      window.KC.Draw.textFit = realFit; window.KC.Draw.text = realText;
      return seen.join(' | ');
    });
    ok(!/[Ww]ash/.test(strip), 'the strip does not nag about washing', strip);
    await page.context().close();
  });

test('the card that explains a rule flashes the first time that rule bites',
  async (browser) => {
    const { page } = await newPage(browser);
    /* freshCards: this player has never been told any of it */
    await setBoard(page, { li: 1, moves: 20, fillWith: 'Apple', freshCards: true });
    await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    /* milchig straight after fleishig: refused, and the six hours card comes up */
    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    await lift(page);
    await page.waitForTimeout(400);
    const card = await page.evaluate(() => {
      const s = window.KC.Game.screen;
      return { key: s.key || null, title: s.card ? s.card.title : null,
        source: s.card ? s.card.source || null : null };
    });
    ok(card.key === 'wait', 'the six hours card is on screen', JSON.stringify(card));
    ok(/Shulchan Aruch|Chullin/.test(card.source || ''),
      'and it says where the halacha comes from', String(card.source));

    /* GOT IT hands the table back, and the card does not come again */
    await page.evaluate(() => window.KC.Game.screen.btns[0].onTap());
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => {
      const s = window.KC.Game.screen;
      return { isPlay: s === window.__play, seen: !!window.KC.Progress.seenTeach.wait };
    });
    ok(back.isPlay, 'the week carried on where it left off');
    ok(back.seen, 'and that card is marked as read');

    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]], { hold: true });
    await lift(page);
    await page.waitForTimeout(300);
    const again = await page.evaluate(() => window.KC.Game.screen === window.__play);
    ok(again, 'the second refusal just says no, it does not teach again');
    await page.context().close();
  });

test('the camp clock moves two hours a plate, and the wait is six of them',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 1, moves: 20, fillWith: 'Apple' });
    const start = await state(page);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    let s = await state(page);
    ok(s.clock === start.clock + 120, 'one plate is two hours',
      `${start.clock} -> ${s.clock}`);

    await stamp(page, [['Brisket', 'Chicken', 'Salami']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.waitLeft === 360, 'fleishig starts a six hour wait', String(s.waitLeft));

    await stamp(page, [['Apple', 'Apple', 'Apple']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.waitLeft === 240, 'two of those hours have gone by', String(s.waitLeft));
    await page.context().close();
  });

test('the simcha bar runs down on the clock and fills when the boys eat',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 1, moves: 20, fillWith: 'Apple' });
    const start = await state(page);
    ok(start.simcha > 0 && start.simcha < 100, 'the boys start somewhere in the middle',
      String(start.simcha));

    /* standing there doing nothing costs simcha, which is the whole rush.
       The table opens with a couple of seconds' grace, so run that off first */
    const idled = await page.evaluate(() => {
      const p = window.__play;
      while (p.grace > 0) p.update(0.2);
      const was = p.simcha;
      for (let s = 0; s < 50; s++) p.update(0.2);   /* ten seconds of nothing */
      return { was, now: p.simcha, drain: p.drain };
    });
    const fell = idled.was - idled.now;
    ok(fell > idled.drain * 8 && fell < idled.drain * 11,
      'ten seconds of standing about cost about ten seconds of simcha',
      `${idled.was.toFixed(1)} -> ${idled.now.toFixed(1)} at ${idled.drain}/s`);

    /* a short plate barely keeps up with the drain, a long one lifts the room */
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    const short = await state(page);
    await drag(page, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
    const long = await state(page);
    ok(long.simcha > short.simcha, 'the big plate lifted the simcha',
      `${short.simcha} -> ${long.simcha}`);

    /* and it empties on its own, with moves still in hand */
    const end = await page.evaluate(() => {
      const p = window.__play;
      p.simcha = 3;
      for (let s = 0; s < 60 && !p.over; s++) p.update(0.2);
      return { over: p.over, why: p.overWhy, moves: p.moves, simcha: p.simcha };
    });
    ok(end.over === 'lose' && end.why === 'simcha' && end.moves > 0,
      'an empty simcha bar ends the week on its own', JSON.stringify(end));
    await page.context().close();
  });

test('the later weeks get hungry faster than the first ones', async (browser) => {
  const { page } = await newPage(browser);
  const rates = await page.evaluate(() => {
    const K = window.KC;
    return K.LEVELS.map((lv, li) => {
      const p = new K.Play(li);
      return { week: lv.week, drain: p.drain };
    });
  });
  const first = rates[0].drain, last = rates[rates.length - 1].drain;
  ok(first > 0.3 && first < 1, 'week one drains gently', String(first));
  ok(last > first * 1.3, 'the last week drains a good deal faster',
    `${first} -> ${last}`);
  let climbs = true;
  for (let i = 1; i < rates.length; i++) {
    if (rates[i].week > rates[i - 1].week && rates[i].drain <= rates[i - 1].drain) climbs = false;
  }
  ok(climbs, 'and every week is hungrier than the week before it');
  await page.context().close();
});

/* ----------------------------------------------------------------- loops */
test('fish riding with dairy fills both orders and pays a dual simcha bonus',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, {
      li: 3, moves: 20, fillWith: 'Apple',
      orders: [{ kind: 'fish', need: 5 }, { kind: 'dairy', need: 5 }]
    });
    await page.evaluate(() => window.KC.Nusach.set('ashkenaz'));

    const before = await page.evaluate(() => window.__play.simcha);
    await stamp(page, [['Salmon', 'Cheese', 'Salmon']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    let s = await state(page);
    ok(s.orders[0].got === 1 && s.orders[1].got === 1,
      'two fish and a cheese fills the fish order and the milchig order both',
      JSON.stringify(s.orders));
    const after = await page.evaluate(() => window.__play.simcha);

    /* a same-length pure-fish plate right after, for the simcha comparison -
       the first plate cleared row 0 and refilled it, so this draws there too */
    await stamp(page, [['Salmon', 'Tuna', 'Salmon']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    const afterPlain = await page.evaluate(() => window.__play.simcha);
    ok(after - before > afterPlain - after,
      'the dual plate lifted simcha by more than the plain one that followed it',
      `dual +${(after - before).toFixed(2)}, plain +${(afterPlain - after).toFixed(2)}`);
    await page.context().close();
  });

test('Edot HaMizrach rinse between fish and dairy, whichever came first',
  async (browser) => {
    const { page } = await newPage(browser, 'iPhone 12', { nusach: 'mizrach' });
    await setBoard(page, {
      li: 3, moves: 20, fillWith: 'Apple',
      orders: [{ kind: 'fish', need: 5 }, { kind: 'dairy', need: 5 }]
    });

    /* fish first: dairy is turned away until a rinse */
    await stamp(page, [['Salmon', 'Tuna', 'Salmon']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    await stamp(page, [['Cheese', 'Cheese', 'Cheese']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    let s = await state(page);
    ok(s.orders[1].got === 0 && s.reason === 'Rinse between fish and dairy',
      'dairy is refused right after fish, with the right reason', JSON.stringify(s));
    await page.evaluate(() => window.__play.doRinse());
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.orders[1].got === 1, 'and goes through once the boys have rinsed', JSON.stringify(s));

    /* dairy first: fish is turned away until a rinse. that last dairy plate
       already set needFishRinse, so this one serves straight through and is
       really the fixture for the fish refusal right after it */
    await stamp(page, [['Cheese', 'Cheese', 'Cheese']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    await stamp(page, [['Salmon', 'Tuna', 'Salmon']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.reason === 'Rinse between dairy and fish' && s.orders[0].got === 1,
      'and fish is refused right after dairy, the other way round', JSON.stringify(s));
    await page.evaluate(() => window.__play.doRinse());
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    s = await state(page);
    ok(s.orders[0].got === 2, 'and goes through once the boys have rinsed', JSON.stringify(s));
    await page.context().close();
  });

test('a table that orders both fish and dairy hands Edot HaMizrach a few extra moves',
  async (browser) => {
    const { page } = await newPage(browser);
    /* week 1, day 1: fish5, dairy5 - the very table a Mizrach player found
       "not nearly enough fish options" on with a plain 12-move budget */
    const totals = await page.evaluate(() => {
      const K = window.KC;
      const out = {};
      for (const nusach of ['ashkenaz', 'sefard', 'mizrach', 'chabad']) {
        K.Nusach.set(nusach);
        const play = new K.Play(3);
        out[nusach] = play.totalMoves;
      }
      return out;
    });
    ok(totals.ashkenaz === 12 && totals.sefard === 12,
      'Ashkenaz and Sefard get the table as written', JSON.stringify(totals));
    ok(totals.mizrach > totals.ashkenaz,
      'Mizrach, who may not chain fish through dairy, gets extra moves to make up for it',
      JSON.stringify(totals));
    await page.context().close();
  });

test('a table with no fish order at all still hands Edot HaMizrach a fair board',
  async (browser) => {
    const { page } = await newPage(browser);
    /* week 1, day 3: dairy6, meat6 - fish is only ever filler here, never an
       order. Ashkenaz can still fold a stray fish tile into a milchig chain;
       Mizrach cannot fold it into either order, so it used to just be
       clutter thinning out both the meat and the dairy half of the board. */
    const weights = await page.evaluate(() => {
      const K = window.KC;
      const out = {};
      for (const nusach of ['ashkenaz', 'mizrach']) {
        K.Nusach.set(nusach);
        const play = new K.Play(5);
        out[nusach] = play.board.foodWeights();
      }
      return out;
    });
    ok(weights.ashkenaz.fish === 2, 'Ashkenaz gets the table as written',
      JSON.stringify(weights.ashkenaz));
    ok(weights.mizrach.fish < weights.ashkenaz.fish,
      'Mizrach, who can use a fish tile for neither order here, sees less of it',
      JSON.stringify(weights.mizrach));
    ok(weights.mizrach.meat > weights.ashkenaz.meat && weights.mizrach.dairy > weights.ashkenaz.dairy,
      'that room goes to the orders actually on the table',
      JSON.stringify(weights.mizrach));
    await page.context().close();
  });

test('closing a loop sweeps that food off the whole board', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 8, moves: 20, fillWith: 'Apple',
    orders: [{ kind: 'loop', need: 1 }]
  });
  const before = await page.evaluate(() => {
    const b = window.__play.board;
    let n = 0;
    for (const c of b.cells) if (c && c.f.cat === 'pareve') n++;
    return n;
  });
  await drag(page, [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
  const s = await state(page);
  ok(s.orders[0].got === 1, 'the loop order was filled', JSON.stringify(s.orders));
  ok(before > 4, 'there was a boardful of pareve to sweep', 'had ' + before);
  ok(s.score > 300, 'the sweep paid like a sweep', 'score ' + s.score);
  await page.context().close();
});

test('a loop cannot sweep a challah past unwashed hands, even one the ring never touched',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 8, moves: 20, fillWith: 'Apple' });
    await page.evaluate(() => { window.__play.washed = false; });
    /* a challah far from the 2x2 ring that is about to close - the ring
       itself is clean, but the sweep would reach this one too */
    await stamp(page, [['.', '.', '.', '.', '.', '.', 'Challah']]);
    const before = await state(page);
    await drag(page, [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
    const after = await state(page);
    ok(/Wash your hands before challah/.test(after.reason || ''),
      'the loop is turned away for the unwashed challah', JSON.stringify(after));
    ok(after.score === before.score && after.moves === before.moves,
      'and nothing was actually served', JSON.stringify(after));
    const stillThere = await page.evaluate(() =>
      window.__play.board.get(6, 0).f.name === 'Challah');
    ok(stillThere, 'the challah itself never left the board');

    /* wash, and the very same loop goes through and takes the challah too */
    await wash(page);
    await drag(page, [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
    const washed = await state(page);
    ok(washed.score > before.score, 'once washed, the loop sweeps clean', JSON.stringify(washed));
    const gone = await page.evaluate(() => !!window.__play.board.get(6, 0).f &&
      window.__play.board.get(6, 0).f.name !== 'Challah');
    ok(gone, 'and the challah went out with the rest of the pareve');
    await page.context().close();
  });

test('a loop needs four foods - a three-food turn will not close it', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 8, fillWith: 'Apple' });
  /* out and straight back is a backtrack, not a loop */
  await drag(page, [[0, 0], [1, 0], [1, 1], [0, 1]], { hold: true });
  let s = await state(page);
  ok(s.loop === false && s.chain === 4, 'four in a square is not closed yet',
    `loop ${s.loop}, chain ${s.chain}`);
  await lift(page);

  await setBoard(page, { li: 8, fillWith: 'Apple' });
  await drag(page, [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], { hold: true });
  s = await state(page);
  ok(s.loop === true, 'coming back onto the first dish closes it', 'loop ' + s.loop);
  await lift(page);
  await page.context().close();
});

/* ------------------------------------------------------------------- hint */
test('the hint button lights a legal chain, then cools down before it can be used again',
  async (browser) => {
    const { page } = await newPage(browser);
    await setBoard(page, { li: 0, moves: 20, fillWith: 'Apple' });
    const before = await page.evaluate(() => {
      const p = window.__play;
      return { hint: p.hint, enabled: p.hintBtn.enabled };
    });
    ok(before.hint === null && before.enabled === true,
      'the hint starts ready and unused', JSON.stringify(before));

    const btn = await page.evaluate(() => {
      const b = window.__play.hintBtn;
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    });
    await tapAt(page, btn.x, btn.y);
    const after = await page.evaluate(() => {
      const p = window.__play;
      return { hintLen: p.hint ? p.hint.length : 0, cooldown: p.hintCooldown, enabled: p.hintBtn.enabled };
    });
    ok(after.hintLen >= 3, 'a legal three-or-more chain lit up', 'len ' + after.hintLen);
    ok(after.cooldown > 170, 'the hint went on a roughly three minute cooldown',
      'cooldown ' + after.cooldown);
    ok(after.enabled === false, 'the button is disabled while it cools down');

    await tapAt(page, btn.x, btn.y);
    const again = await page.evaluate(() => window.__play.hintCooldown);
    ok(Math.abs(again - after.cooldown) < 1, 'tapping again during the cooldown does nothing',
      `${after.cooldown} -> ${again}`);
    await page.context().close();
  });

test('tapping an order card explains it, and a tap elsewhere closes it', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, fillWith: 'Apple' });
  const kind = await page.evaluate(() => window.__play.orders[0].kind);
  const r = await page.evaluate(() => {
    const o = window.__play._ord[0];
    return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
  });
  await tapAt(page, r.x, r.y);
  const opened = await page.evaluate(() => window.__play.explainKind);
  ok(opened === kind, 'the card opened for the order that was tapped', `${opened} vs ${kind}`);

  const bc = await page.evaluate(() => {
    const b = window.__play.board;
    return { x: b.bx + b.bw / 2, y: b.by + b.bh / 2 };
  });
  await tapAt(page, bc.x, bc.y);
  const closed = await page.evaluate(() => window.__play.explainKind);
  ok(closed === null, 'tapping elsewhere closed the card', String(closed));
  await page.context().close();
});

/* --------------------------------------------------------------- level flow */
test('filling the orders wins the table and unlocks the next one', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 0, moves: 20, fillWith: 'Apple',
    orders: [{ kind: 'pareve', need: 2 }]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  await drag(page, [[0, 1], [1, 1], [2, 1]]);
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => ({
    screen: window.KC.Game.screen.constructor.name,
    unlocked: window.KC.Progress.unlocked,
    stars: window.KC.Progress.stars[0] || 0
  }));
  ok(r.screen === 'Result', 'the result card came up', r.screen);
  ok(r.unlocked >= 2, 'table two is open', 'unlocked ' + r.unlocked);
  ok(r.stars >= 1, 'stars were awarded', 'stars ' + r.stars);
  await page.context().close();
});

test('running out of moves ends the table without winning', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, {
    li: 0, moves: 1, fillWith: 'Apple',
    orders: [{ kind: 'meat', need: 5 }]
  });
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => ({
    screen: window.KC.Game.screen.constructor.name,
    win: window.KC.Game.screen.win
  }));
  ok(r.screen === 'Result' && r.win === false, 'it ended as a loss', JSON.stringify(r));
  await page.context().close();
});

test('the board refills from the top after a plate goes out', async (browser) => {
  const { page } = await newPage(browser);
  await setBoard(page, { li: 0, fillWith: 'Apple' });
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const b = window.__play.board;
    let holes = 0;
    for (const c of b.cells) if (!c) holes++;
    return { holes, settled: b.settled() };
  });
  ok(r.holes === 0, 'every cell has a dish again', 'holes ' + r.holes);
  ok(r.settled === true, 'and everything has landed');
  await page.context().close();
});

test('the player is never left staring at a board with no legal plate',
  async (browser) => {
    const { page } = await newPage(browser);
    /* a board of nothing but meat, then a dairy plate to owe the rinse:
       every remaining dish is blocked, which is a genuine dead end */
    await setBoard(page, { li: 5, moves: 20, fillWith: 'Brisket' });
    await stamp(page, [['Cheese', 'Butter', 'Yogurt']]);
    await drag(page, [[0, 0], [1, 0], [2, 0]]);
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const p = window.__play;
      return {
        needRinse: p.needRinse,
        hasMove: p.hasMove(),
        reason: p.reason ? p.reason.why : null,
        over: p.over
      };
    });
    ok(s.needRinse === true, 'the rinse is owed, so all the meat is blocked');
    ok(s.hasMove === true, 'fresh dishes arrived and there is a plate to serve');
    ok(/fresh dishes/i.test(s.reason || ''), 'and the player was told why', s.reason);
    ok(s.over === null, 'the table did not just end on its own');
    await page.context().close();
  });

test('every table can actually be won, and none of them is a walkover',
  async (browser) => {
    const { page } = await newPage(browser);
    const rows = await page.evaluate(() => {
      const K = window.KC;
      const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      /* he has read the rule cards, so none of them interrupt him */
      for (const key in K.TEACH) K.Progress.seenTeach[key] = true;
      /* and he takes a few seconds to find each plate, which the boys feel */
      const THINK = 3.2;
      const think = (play, secs) => {
        for (let f = 0; f < 12; f++) play.update(1 / 60);
        for (let s = 0; s < Math.round(secs * 5); s++) play.update(0.2);
      };

      /* a competent player: find the most useful legal chain, batch by side */
      function bestChain(play) {
        const b = play.board;
        const wants = {};
        for (const o of play.orders) if (o.got < o.need) wants[o.kind] = true;
        let best = null;
        const consider = (path, plate) => {
          if (path.length < 3) return;
          const side = K.plateSide(plate);
          if (side === 'dairy' && (play.waitLeft > 0 || play.mealSide === 'meat')) return;
          if (side === 'meat' && play.needRinse) return;
          if (side === 'fish' && play.needFishDrink) return;
          let v = path.length;
          if (wants[side]) v += 40;
          if (wants.big && path.length >= 6) v += 40;
          if (play.needPareve && side === 'pareve') v += 25;
          if (side === play.__last) v += 22;
          if (side === 'meat' && play.waitMoves === 0 && wants.dairy) v -= 12;
          /* hungry boys are worth feeding: long plates matter more as the
             simcha drops, which is how a real player would read the bar */
          if (play.simcha < 45) v += path.length * 4;
          if (!best || v > best.v) best = { v, path: path.slice() };
        };
        const walk = (path, plate) => {
          consider(path, plate);
          if (path.length >= 7) return;
          const last = path[path.length - 1];
          for (const d of DIRS) {
            const nx = last.gx + d[0], ny = last.gy + d[1];
            if (path.some(p => p.gx === nx && p.gy === ny)) continue;
            const t = b.get(nx, ny);
            if (!t) continue;
            const save = play.plate; play.plate = plate;
            const okJoin = play.canJoin(t).ok;
            play.plate = save;
            if (!okJoin) continue;
            const np = K.emptyPlate();
            for (const k in plate) np[k] = plate[k];
            K.addToPlate(np, t.f);
            path.push(t); walk(path, np); path.pop();
          }
        };
        for (const t of b.cells) {
          if (!t) continue;
          const save = play.plate; play.plate = K.emptyPlate();
          const okStart = play.canJoin(t).ok;
          play.plate = save;
          if (!okStart) continue;
          walk([t], K.addToPlate(K.emptyPlate(), t.f));
        }
        return best;
      }

      function findLoop(play) {
        const b = play.board;
        if (!play.orders.some(o => o.kind === 'loop' && o.got < o.need)) return null;
        for (let gy = 0; gy < b.rows - 1; gy++) {
          for (let gx = 0; gx < b.cols - 1; gx++) {
            const ring = [[gx, gy], [gx + 1, gy], [gx + 1, gy + 1], [gx, gy + 1]]
              .map(c => b.get(c[0], c[1]));
            if (ring.some(t => !t)) continue;
            let plate = K.emptyPlate(), fine = true;
            for (const t of ring) {
              const save = play.plate; play.plate = plate;
              const okJoin = play.canJoin(t).ok;
              play.plate = save;
              if (!okJoin) { fine = false; break; }
              K.addToPlate(plate, t.f);
            }
            if (!fine) continue;
            const side = K.plateSide(plate);
            if (side === 'dairy' && (play.waitLeft > 0 || play.mealSide === 'meat')) continue;
            if (side === 'meat' && play.needRinse) continue;
            if (side === 'fish' && play.needFishDrink) continue;
            return ring;
          }
        }
        return null;
      }

      const out = [];
      const nusachs = ['ashkenaz', 'sefard', 'mizrach', 'chabad'];
      for (let li = 0; li < K.LEVELS.length; li++) {
        let wins = 0, spare = 0, used = 0, starved = 0, movesSum = 0;
        const RUNS = 12;
        for (let r = 0; r < RUNS; r++) {
          K.Nusach.set(nusachs[r % 4]);
          const play = new K.Play(li);
          movesSum += play.totalMoves;
          play.relayout();
          K.Game.go(play);
          let guard = 0;
          while (!play.over && guard++ < 300) {
            let acted = false;
            /* washing, drinking and bentching are free, so a competent player
               keeps on top of them before looking for a plate */
            if (play.needDrink || play.needFishDrink ||
                play.needFishRinse || play.needDairyRinse) play.doRinse();
            if (play.needWash || !play.washed) play.doWash();
            const wantsDairy = play.orders.some(o => o.kind === 'dairy' && o.got < o.need);
            if (play.mealSide === 'meat' && play.mealAte > 0 &&
                play.waitLeft === 0 && wantsDairy) {
              play.doBentch();
            }
            for (const t of play.board.cells) {
              if (t && play.board.binnable(t)) { play.bin(t); acted = true; break; }
            }
            if (acted) { think(play, 0.7); continue; }
            for (const t of play.board.cells) {
              if (t && t.covered) { play.liftLid(t); acted = true; break; }
            }
            if (acted) { think(play, 0.5); continue; }
            const ring = findLoop(play);
            let path = ring || (bestChain(play) || {}).path;
            /* nothing to serve at this meal? bentch and look again */
            if (!path && play.mealAte > 0) {
              play.doBentch();
              path = (bestChain(play) || {}).path;
            }
            if (!path) break;
            play.cancelChain();
            play.startChain(path[0]);
            for (let i = 1; i < path.length; i++) play.pushChain(path[i]);
            if (ring) { play.loop = true; play.loopSide = K.plateSide(play.plate); }
            play.__last = K.plateSide(play.plate);
            play.serve();
            think(play, THINK);
          }
          if (play.over === 'win') { wins++; spare += play.moves; }
          if (play.over === 'lose' && play.overWhy === 'simcha') starved++;
          used += play.totalMoves - play.moves;
        }
        out.push({
          table: li + 1, wins, runs: RUNS, starved,
          spare: wins ? +(spare / wins).toFixed(1) : 0,
          used: +(used / RUNS).toFixed(1),
          moves: +(movesSum / RUNS).toFixed(1)
        });
      }
      return out;
    });

    const unwinnable = rows.filter(r => r.wins === 0);
    ok(unwinnable.length === 0, 'no table is impossible',
      unwinnable.map(r => 'table ' + r.table).join(', '));

    const walkover = rows.filter(r => r.spare > r.moves * 0.55);
    ok(walkover.length === 0, 'no table hands out more than half its moves for free',
      walkover.map(r => `table ${r.table}: ${r.spare}/${r.moves} spare`).join(', '));

    const tooTight = rows.filter(r => r.wins < r.runs * 0.5);
    ok(tooTight.length === 0, 'a player who plays well clears every table at least half the time',
      tooTight.map(r => `table ${r.table}: ${r.wins}/${r.runs}`).join(', '));

    /* the bar has to be survivable at a sensible pace, or it is not a game */
    const starving = rows.filter(r => r.starved > r.runs * 0.34);
    ok(starving.length === 0, 'the simcha bar does not starve out a player who keeps moving',
      starving.map(r => `table ${r.table}: ${r.starved}/${r.runs} starved`).join(', '));

    console.log('         ' + rows.map(r =>
      `t${r.table} ${r.wins}/${r.runs} used ${r.used}/${r.moves}`).join('  '));
    await page.context().close();
  });

/* --------------------------------------------------------------- Hebrew */
test('hebrew: every readable string has a Hebrew side', async (browser) => {
  const { page } = await newPage(browser);
  const missing = await page.evaluate(() => {
    const K = window.KC;
    const keys = [];
    /* everything the player can read, gathered from the real data */
    K.FOODS.forEach(f => keys.push(f.name));
    K.LEVELS.forEach(l => l.orders.forEach(o => keys.push(o.kind)));
    /* what the boys say, hungry and not */
    K.KID_LINES.forEach(s => keys.push(s));
    K.KID_HUNGRY.forEach(s => keys.push(s));
    const ui = [
      'CAMP KOSH', 'Feed the boys. Keep it kosher.',
      'SIMCHA', 'WASH', 'DAY', 'WEEK', 'HANDS WASHED', 'EVERYONE DRINKS',
      'Wash your hands before challah', 'Rinse between fish and meat',
      'Rinse between meat and fish',
      'After milchig: wash, drink, then something pareve',
      '2 hours', '6 hours', 'START THE WEEK', 'NEXT',
      'Welcome to Camp Kosh', 'Feed them', 'Keep it kosher', 'Six weeks',
      'MITZVAH DASH', 'Link the foods that belong on one plate', 'PLAY', 'HOW TO PLAY',
      'Drag through what goes together', 'MORE GAMES',
      'MY NUSACH', 'BACK', 'TABLES', 'CONTINUE', 'RETRY', 'QUIT', 'PAUSED', 'RESUME',
      'MOVES', 'SCORE', 'ORDERS', 'TABLE CLEARED!', 'OUT OF MOVES', 'BEST',
      'You served every order', 'The orders are not finished', 'NEXT TABLE', 'GOT IT',
      'MEAT', 'DAIRY', 'FISH', 'PAREVE', 'TREIF', 'NOT TOGETHER',
      'FLEISHIG PLATE', 'MILCHIG PLATE', 'FISH PLATE', 'PAREVE PLATE', 'BIG PLATE',
      'FULL PLATE!', 'THE WHOLE TRAY!', 'THROWN OUT', 'LID OFF', 'RINSE', 'moves',
      'LOOP! WHOLE BOARD', 'WAITING',
      'Meat and milk never share a plate', 'We do not put fish with meat',
      'Your nusach keeps fish off dairy', 'Chabad: fish never with milk',
      'This is never kosher - throw it out', 'Meat cooked with cheese - throw it out',
      'Lift the lid first', 'Not touching',
      'Wait after meat before dairy', 'Still waiting after the meat',
      'Rinse first, then meat', 'Serve a pareve plate to rinse',
      'Fish may be eaten with dairy', 'Fish may not be eaten with dairy',
      'Fish may not be eaten with milk',
      'Ashkenaz', 'Nusach Sefard', 'Edot HaMizrach', 'Chabad',
      'Drag through touching foods. Lift your finger to serve the plate.',
      'Three or more. Longer plate, more points.',
      'The chain stops when something may not join. It will tell you why.',
      'Tap treif to throw it out. Tap a covered dish to look under the lid.',
      'WASH, RINSE and BENTCH are free. Bentching ends the meal and starts a new one.',
      'BENTCH', 'BENTCHED - NEW MEAL', 'Nothing has been eaten yet',
      'Bentch first - milchig needs its own meal',
      'Fleishig meal - bentch to start a milchig one',
      'BREAKFAST', 'LUNCH', 'SUPPER', 'NIGHT SNACK',
      'KASHRUS', 'SCHEDULE', 'OUT OF SIMCHA', 'The boys lost all their simcha!'
    ];
    ui.forEach(s => keys.push(s));

    K.Lang.set('he');
    const out = [];
    for (const k of keys) {
      if (['meat', 'dairy', 'fish', 'pareve', 'treif', 'big', 'loop'].includes(k)) continue;
      const v = K.Lang.t(k);
      if (v === k || !/[\u0590-\u05FF]/.test(v)) out.push(k);
    }
    K.Lang.set('en');
    return out;
  });
  ok(missing.length === 0, 'nothing is English-only', missing.join(' | '));
  await page.context().close();
});

test('hebrew: the teaching cards are all translated', async (browser) => {
  const { page } = await newPage(browser);
  const missing = await page.evaluate(() => {
    const K = window.KC;
    K.Lang.set('he');
    const out = [];
    /* every card, not only the ones a level opens with: most of them are
       reached by being refused a plate */
    for (const key in K.TEACH) {
      const card = K.TEACH[key];
      for (const f of ['title', 'body', 'note', 'source']) {
        if (!card[f]) continue;
        const v = K.Lang.t(card[f]);
        if (v === card[f] || !/[\u0590-\u05FF]/.test(v)) out.push(key + '.' + f);
      }
    }
    K.Lang.set('en');
    return out;
  });
  ok(missing.length === 0, 'every card has a Hebrew side', missing.join(' | '));
  await page.context().close();
});

test('every refusal the player can be given has a card that explains it',
  async (browser) => {
    const { page } = await newPage(browser);
    const holes = await page.evaluate(() => {
      const K = window.KC;
      const out = [];
      /* every reason string the rules can produce, gathered from the rules
         themselves rather than from a list somebody has to remember */
      const reasons = new Set();
      const nusachs = ['ashkenaz', 'sefard', 'mizrach', 'chabad'];
      for (const n of nusachs) {
        for (const a of K.FOODS) {
          for (const b of K.FOODS) {
            const plate = K.addToPlate(K.emptyPlate(), a);
            const r = K.plateAccepts(plate, b, n);
            if (!r.ok) reasons.add(r.why);
          }
        }
      }
      /* and the ones the kitchen adds on top of the plate rules */
      const p = new K.Play(4);
      p.waitLeft = 360; reasons.add(p.gate(K.foodByName('Cheese')));
      p.waitLeft = 0; p.mealSide = 'meat'; reasons.add(p.gate(K.foodByName('Cheese')));
      p.mealSide = null; p.needWash = true; p.needPareve = true;
      reasons.add(p.gate(K.foodByName('Brisket')));
      p.needWash = false; p.needPareve = false; p.needDrink = true;
      reasons.add(p.gate(K.foodByName('Brisket')));
      p.needDrink = false; p.needFishDrink = true;
      reasons.add(p.gate(K.foodByName('Salmon')));
      p.needFishDrink = false; p.washed = false;
      reasons.add(p.gate(K.foodByName('Challah')));
      reasons.add('Lift the lid first');

      for (const why of reasons) {
        if (!why) continue;
        const key = K.WHY_CARD[why];
        if (!key) { out.push('no card: ' + why); continue; }
        if (!K.TEACH[key]) out.push('bad card key: ' + key);
      }
      return out;
    });
    ok(holes.length === 0, 'no rule can refuse a plate without explaining itself',
      holes.join(' | '));

    /* and the halacha cards say where they come from */
    const sourceless = await page.evaluate(() => {
      const K = window.KC;
      const halacha = ['meatmilk', 'wait', 'bentch', 'rinse', 'wash', 'fishmeat',
        'nusach', 'treif', 'mixed'];
      return halacha.filter(k => !K.TEACH[k] || !K.TEACH[k].source);
    });
    ok(sourceless.length === 0, 'every halacha card cites a source',
      sourceless.join(', '));
    await page.context().close();
  });

test('hebrew: the game runs in Hebrew without errors', async (browser) => {
  const { page, errors } = await newPage(browser, 'iPhone 12', { lang: 'he' });
  const lang = await page.evaluate(() => window.KC.Lang.id);
  ok(lang === 'he', 'started in Hebrew', lang);
  await setBoard(page, { li: 11 });
  await page.waitForTimeout(400);
  await drag(page, [[0, 0], [1, 0], [2, 0]]);
  await page.evaluate(() => window.KC.Game.go(new Menu()));
  await page.waitForTimeout(300);
  ok(errors.length === 0, 'no errors drawing Hebrew', errors.join('\n         '));
  await page.context().close();
});

/* --------------------------------------------------------------- screens */
test('every screen draws without an error', async (browser) => {
  const { page, errors } = await newPage(browser);
  const names = await page.evaluate(async () => {
    const K = window.KC;
    const seen = [];
    const step = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const visit = async (s) => { K.Game.go(s); await step(); seen.push(s.constructor.name); };
    /* the screen constructors are globals in the page */
    await visit(new Menu());
    await visit(new LevelSelect());
    await visit(new NusachPick(function () {}));
    await visit(new Help());
    await visit(new Teach('nusach', function () {}));
    const play = new Play(11); play.relayout();
    await visit(play);
    await visit(new Pause(play));
    play.over = 'win';
    await visit(new Result(play));
    play.over = 'lose';
    await visit(new Result(play));
    return seen;
  });
  ok(names.length === 9, 'walked every screen', names.join(', '));
  ok(errors.length === 0, 'and none of them threw', errors.join('\n         '));
  await page.context().close();
});

test('a long random session never throws and never breaks a rule', async (browser) => {
  const { page, errors } = await newPage(browser);
  const report = await page.evaluate(async () => {
    const K = window.KC;
    const bad = [];
    let served = 0, refused = 0, binned = 0;

    function truth(cats, liquidMilkWithFish, n) {
      const has = c => cats.indexOf(c) >= 0;
      if (has('treif') || has('mixed')) return false;
      if (has('meat') && has('dairy')) return false;
      if (has('meat') && has('fish')) return false;
      if (has('fish') && has('dairy')) {
        if (n === 'mizrach') return false;
        if (n === 'chabad' && liquidMilkWithFish) return false;
      }
      return true;
    }

    const nusachs = ['ashkenaz', 'sefard', 'mizrach', 'chabad'];
    for (let round = 0; round < 40; round++) {
      K.Nusach.set(nusachs[round % 4]);
      const play = new Play(11);
      play.relayout();
      play.moves = 999;
      K.Game.go(play);
      const b = play.board;

      for (let m = 0; m < 40; m++) {
        /* pick a random start and wander */
        const start = b.cells[Math.floor(Math.random() * b.cells.length)];
        if (!start) continue;
        play.cancelChain();
        play.plate = K.emptyPlate();
        if (!play.canJoin(start).ok) {
          if (b.binnable(start)) { play.bin(start); binned++; }
          continue;
        }
        play.startChain(start);
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let step = 0; step < 10; step++) {
          const last = play.chain[play.chain.length - 1];
          const d = dirs[Math.floor(Math.random() * 4)];
          const nx = last.gx + d[0], ny = last.gy + d[1];
          if (play.inChain(nx, ny) >= 0) continue;
          const t = b.get(nx, ny);
          if (!t) continue;
          if (!play.canJoin(t).ok) { refused++; continue; }
          play.pushChain(t);
        }
        if (play.chain.length >= 3) {
          /* check the plate we are about to serve against the rules longhand */
          const cats = play.chain.map(c => c.tile.f.cat);
          const hasFish = cats.indexOf('fish') >= 0;
          const liquid = play.chain.some(c => c.tile.f.liquidMilk) && hasFish;
          if (!truth(cats, liquid, K.Nusach.id)) {
            bad.push(K.Nusach.id + ': ' + play.chain.map(c => c.tile.f.name).join('+'));
          }
          const side = K.plateSide(play.plate);
          const gated = (side === 'dairy' && (play.waitMoves > 0 || play.mealSide === 'meat')) ||
                        (side === 'meat' && play.needRinse) ||
                        play.chain.some(c => c.tile.f.bread && !play.washed);
          play.serve();
          if (!gated) served++;
        } else play.cancelChain();

        /* let the board settle the way it would on a real frame */
        for (let f = 0; f < 8; f++) { play.update(1 / 60); }
        if (play.over) break;
      }
    }
    return { bad, served, refused, binned };
  });
  ok(report.bad.length === 0,
    report.served + ' plates served across 40 tables and 4 nusachs, none illegal',
    report.bad.slice(0, 6).join('\n         '));
  ok(report.served > 200, 'the session actually played', JSON.stringify(report));
  ok(errors.length === 0, 'no errors during the soak', errors.join('\n         '));
  await page.context().close();
});

test('performance: a busy board still renders fast enough for a phone', async (browser) => {
  const { page } = await newPage(browser, 'Pixel 5');
  await setBoard(page, { li: 11 });
  const ms = await page.evaluate(async () => {
    const play = window.__play;
    /* load it up: a live chain plus a screenful of particles */
    play.startChain(play.board.get(0, 0));
    play.finger = { x: 300, y: 700 };
    for (let i = 0; i < 24; i++) {
      window.FX.burst(Math.random() * 720, Math.random() * 1280, { n: 12 });
    }
    const t0 = performance.now();
    let frames = 0;
    await new Promise(res => {
      const loop = () => {
        frames++;
        if (frames >= 60) return res();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    return (performance.now() - t0) / frames;
  });
  ok(ms < 22, 'average frame under 22ms', ms.toFixed(2) + 'ms');
  await page.context().close();
});

/* ------------------------------------------------------- shipping as an app */
test('Play tab lock: MITZ_MODE hides pickers and maps sephardi to mizrach', async (browser) => {
  const { server, url } = await serve();
  const p = PHONES['iPhone 12'];
  const ctx = await browser.newContext({
    viewport: { width: p.width, height: p.height },
    deviceScaleFactor: p.dpr, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.MITZ_MODE = true;
    window.MITZ_NUSACH = 'sephardi';
    window.MITZ_LANG = 'he';
  });
  await page.goto(url);
  await page.waitForFunction(() => window.KC && window.KC.ready, null, { timeout: 8000 });
  const r = await page.evaluate(() => {
    const m = window.KC.Game.screen;
    const labels = (m.btns || []).map(b => b.label);
    return {
      nusach: window.KC.Nusach.id,
      lockedN: window.KC.Nusach.locked(),
      lang: window.KC.Lang.id,
      lockedL: window.KC.Lang.locked(),
      labels,
      hasMore: labels.indexOf('MORE GAMES') >= 0 || labels.indexOf('עוד משחקים') >= 0,
      hasNusach: labels.indexOf('MY NUSACH') >= 0 || labels.indexOf('הנוסח שלי') >= 0,
      hasLang: labels.some(l => l === 'English' || l === 'עברית')
    };
  });
  ok(r.nusach === 'mizrach', 'host sephardi becomes mizrach', JSON.stringify(r));
  ok(r.lockedN && r.lockedL, 'lang and nusach are locked to the app', JSON.stringify(r));
  ok(r.lang === 'he', 'Play tab Hebrew sticks', r.lang);
  ok(r.hasMore, 'MORE GAMES is on the menu so you can get back', JSON.stringify(r.labels));
  ok(!r.hasNusach && !r.hasLang, 'in-game pickers stay hidden', JSON.stringify(r.labels));
  await ctx.close();
  server.close();
});

test('it installs to the home screen and plays with no signal', async (browser) => {
  const { server, url } = await serve();
  const p = PHONES['Pixel 5'];
  const ctx = await browser.newContext({
    viewport: { width: p.width, height: p.height },
    deviceScaleFactor: p.dpr, isMobile: true, hasTouch: true
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => window.KC && window.KC.ready, null, { timeout: 8000 });

  /* the phone reads this to decide it is an app and not a web page */
  const man = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]');
    if (!link) return null;
    const r = await fetch(link.href);
    if (!r.ok) return null;
    const m = await r.json();
    const icons = [];
    for (const i of m.icons) {
      const res = await fetch(new URL(i.src, link.href).href);
      icons.push({ src: i.src, ok: res.ok, purpose: i.purpose });
    }
    return { m: m, icons: icons, apple: !!document.querySelector('link[rel="apple-touch-icon"]') };
  });
  ok(!!man, 'the manifest is there and parses');
  if (man) {
    ok(man.m.name === 'Camp Kosh', 'it installs under the right name', man.m.name);
    ok(man.m.display === 'standalone', 'it opens without browser chrome', man.m.display);
    ok(man.m.orientation === 'portrait', 'it stays portrait on a phone', man.m.orientation);
    ok(man.icons.length >= 3 && man.icons.every(i => i.ok),
      'every home-screen icon exists', JSON.stringify(man.icons));
    ok(man.icons.some(i => (i.purpose || '').includes('maskable')),
      'there is a maskable icon, so Android will not letterbox it');
    ok(man.apple, 'iOS has an apple-touch-icon to use');
  }

  /* the service worker takes over, then we pull the network out */
  const controlled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  ok(controlled, 'the service worker registered');

  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller != null, null, { timeout: 8000 });
  await ctx.setOffline(true);
  await page.reload();
  const offline = await page.evaluate(() =>
    !!(window.KC && window.KC.ready && window.KC.Game.screen));
  ok(offline, 'with the network off it still boots to the menu');

  /* and it is actually playable, not just a picture */
  const played = await page.evaluate(() => {
    const K = window.KC;
    const play = new K.Play(0);
    play.relayout();
    K.Game.go(play);
    return play.board.cells.filter(Boolean).length > 0;
  });
  ok(played, 'a table opens while offline');
  ok(errors.length === 0, 'no errors on the offline path', errors.join('\n         '));

  await ctx.close();
  server.close();
});

test('the Android back button steps through the game, it does not throw you out', async (browser) => {
  const { server, url } = await serve();
  const p = PHONES['Pixel 5'];
  const ctx = await browser.newContext({
    viewport: { width: p.width, height: p.height },
    deviceScaleFactor: p.dpr, isMobile: true, hasTouch: true
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => window.KC && window.KC.ready, null, { timeout: 8000 });

  const where = () => page.evaluate(() => window.KC.Game.screen.constructor.name);
  const back = async () => { await page.goBack(); await page.waitForTimeout(120); };

  await page.evaluate(() => window.KC.Game.go(new LevelSelect()));
  await back();
  ok(await where() === 'Menu', 'back leaves the table list for the menu', await where());

  await page.evaluate(() => window.KC.Game.startLevel(0, true));
  await page.waitForTimeout(150);
  ok(await where() === 'Play', 'a table is open');
  await back();
  ok(await where() === 'Pause', 'back pauses the table instead of losing it', await where());
  await back();
  ok(await where() === 'Play', 'back again resumes the table', await where());

  /* on the menu there is nowhere to go, and it must not blow up or blank */
  await page.evaluate(() => window.KC.Game.go(new Menu()));
  await back();
  await back();
  ok(await where() === 'Menu', 'back on the menu stays on the menu in a browser', await where());
  ok(await page.evaluate(() => window.KC.ready === true), 'the page never navigated away');
  ok(errors.length === 0, 'no errors from the back button', errors.join('\n         '));

  await ctx.close();
  server.close();
});

/* ===================================================================== */
(async () => {
  const browser = await chromium.launch({ headless: !HEADED });
  const chosen = tests.filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));
  console.log('Kosher Chain - ' + chosen.length + ' tests\n');
  for (const t of chosen) {
    console.log('* ' + t.name);
    try {
      await t.fn(browser);
    } catch (e) {
      fail++;
      failures.push(t.name + '\n         threw: ' + (e && e.message));
      console.log('  FAIL threw: ' + (e && e.message));
    }
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(' - ' + f));
  }
  process.exit(fail ? 1 : 0);
})();
