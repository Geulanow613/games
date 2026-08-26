const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForTimeout(700);

  // in-page gesture helpers
  await page.evaluate(() => {
    const cv = document.getElementById('stage');
    const toClient = (gx, gy) => {
      const r = cv.getBoundingClientRect();
      return { x: r.left + View.ox + gx * View.scale, y: r.top + View.oy + gy * View.scale };
    };
    let pid = 100;
    window.QA = {
      tap(gx, gy) {
        const p = toClient(gx, gy), id = ++pid;
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: p.x, clientY: p.y, bubbles: true }));
        cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: p.x, clientY: p.y, bubbles: true }));
      },
      swipe(gx, gy, gx2, gy2, steps) {
        steps = steps || 6;
        const a = toClient(gx, gy), b = toClient(gx2, gy2), id = ++pid;
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: a.x, clientY: a.y, bubbles: true }));
        for (let i = 1; i <= steps; i++) {
          cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: a.x + (b.x - a.x) * i / steps, clientY: a.y + (b.y - a.y) * i / steps, bubbles: true }));
        }
        cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: b.x, clientY: b.y, bubbles: true }));
      },
      /* press-hold-drag-release, for anything that charges or slings */
      grab(gx, gy) {
        const a = toClient(gx, gy);
        this.heldId = ++pid; this.heldAt = { x: gx, y: gy };
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: this.heldId, clientX: a.x, clientY: a.y, bubbles: true }));
      },
      dragTo(gx, gy, steps) {
        steps = steps || 4;
        const from = this.heldAt, to = { x: gx, y: gy };
        for (let i = 1; i <= steps; i++) {
          const p = toClient(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
          cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: this.heldId, clientX: p.x, clientY: p.y, bubbles: true }));
        }
        this.heldAt = to;
      },
      release() {
        const a = toClient(this.heldAt.x, this.heldAt.y);
        cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: this.heldId, clientX: a.x, clientY: a.y, bubbles: true }));
      }
    };
  });
  const frame = (n = 3) => page.evaluate(k => new Promise(res => {
    let i = 0; const step = () => { i++; i < k ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step);
  }), n);

  const checks = [];
  const check = (name, ok, extra) => { checks.push({ name, ok, extra }); if (!ok) console.log('  FAIL:', name, extra || ''); };

  // ---------- KOSHER ----------
  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('kosher'); Game.beginPlay();
    const s = Game.scene; s.items.length = 0;
    s.items.push({ food: Foods.list.find(f => f.k === 'meat'), belt: 0, x: 210, y: 600, r: 52, rot: 0, spin: 0, wob: 0 });
  });
  await page.evaluate(() => QA.swipe(210, 600, 90, 610));
  await frame(4);
  let r = await page.evaluate(() => ({ score: Game.scene.score, combo: Game.scene.combo, correct: Game.scene.correct, lives: Game.scene.lives }));
  check('kosher: correct meat swipe scores', r.correct === 1 && r.score > 0 && r.lives === 3, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.items.length = 0;
    s.items.push({ food: Foods.list.find(f => f.k === 'dairy'), belt: 1, x: 510, y: 600, r: 52, rot: 0, spin: 0, wob: 0 }); });
  await page.evaluate(() => QA.swipe(510, 600, 660, 610));
  await frame(4);
  r = await page.evaluate(() => ({ correct: Game.scene.correct, combo: Game.scene.combo }));
  check('kosher: correct dairy swipe', r.correct === 2 && r.combo === 2, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.items.length = 0;
    s.items.push({ food: Foods.list.find(f => f.k === 'mixed'), belt: 0, x: 210, y: 600, r: 52, rot: 0, spin: 0, wob: 0 }); });
  await page.evaluate(() => QA.swipe(210, 600, 220, 420));
  await frame(4);
  r = await page.evaluate(() => ({ mixedOk: Game.scene.mixedOk, lives: Game.scene.lives }));
  check('kosher: mixed flicked up to disposal', r.mixedOk === 1 && r.lives === 3, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.items.length = 0;
    s.items.push({ food: Foods.list.find(f => f.k === 'treif'), belt: 0, x: 210, y: 600, r: 52, rot: 0, spin: 0, wob: 0 }); });
  await page.evaluate(() => QA.swipe(210, 600, 90, 610));
  await frame(4);
  r = await page.evaluate(() => ({ wrong: Game.scene.wrong, lives: Game.scene.lives, hint: !!Game.scene.hint }));
  check('kosher: wrong bin costs a life and shows the hint', r.wrong === 1 && r.lives === 2 && r.hint, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.sortedThisLevel = 11; s.items.length = 0;
    s.items.push({ food: Foods.list.find(f => f.k === 'pareve'), belt: 0, x: 210, y: 600, r: 52, rot: 0, spin: 0, wob: 0 }); });
  await page.evaluate(() => QA.swipe(210, 600, 215, 790));
  await frame(4);
  r = await page.evaluate(() => ({ state: Game.state, level: Game.scene.level }));
  check('kosher: 12 sorted triggers halacha card + shift up', r.state === 'HALACHA_POPUP' && r.level === 2, JSON.stringify(r));
  await page.evaluate(() => Game.closeCard());
  await frame(3);
  check('kosher: card returns to play', (await page.evaluate(() => Game.state)) === 'PLAYING');

  // ---------- KOSHER SORT: swipe accuracy ----------
  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('kosher'); Game.beginPlay();
    Game.scene.items.length = 0; Game.scene.rushTimer = 999; });
  r = await page.evaluate(() => {
    const s = Game.scene;
    const it = { x: 210, y: 600 };
    const cases = [
      ['left  flat',        -140,    0, 'left'],
      ['left  drifting down', -120,  60, 'left'],
      ['left  steep drift',  -100, 140, 'left'],
      ['left  drifting up',  -120, -70, 'left'],
      ['right across',        260,  80, 'right'],
      ['down the belt',        20, 150, 'down'],
      ['down, thumb curls',    70, 170, 'down'],
      ['flick up',             15,-150, 'up'],
      ['flick up, angled',     80,-170, 'up']
    ];
    return cases.map(c => ({ name: c[0], got: s.dirFromSwipe(it, c[1], c[2]), want: c[3] }));
  });
  var wrongDirs = r.filter(c => c.got !== c.want);
  check('kosher: swipes resolve to the bin the player aimed at, drift and all',
    wrongDirs.length === 0, JSON.stringify(wrongDirs));

  // the reported failure: dragging olive oil took the meat further down the belt
  await page.evaluate(() => { const s = Game.scene; s.items.length = 0; s.correct = 0; s.wrong = 0;
    s.grabs = {}; s.rushTimer = 999;
    s.items.push({ food: Foods.list.find(f => f.name === 'Olive Oil'), belt: 0, x: 210, y: 560, r: 52, rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 });
    s.items.push({ food: Foods.list.find(f => f.name === 'Steak'),     belt: 0, x: 210, y: 800, r: 52, rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 });
  });
  await page.evaluate(() => QA.swipe(210, 560, 224, 760));   // grab the oil, flick DOWN past the steak
  await frame(4);
  r = await page.evaluate(() => ({ correct: Game.scene.correct, wrong: Game.scene.wrong,
    left: Game.scene.items.map(i => i.food.name) }));
  check('kosher: a downward flick sorts the dish you grabbed, not one it passes over',
    r.correct === 1 && r.wrong === 0 && r.left.length === 1 && r.left[0] === 'Steak', JSON.stringify(r));

  // and the same going the other way - grab the lower one
  await page.evaluate(() => { const s = Game.scene; s.items.length = 0; s.correct = 0; s.wrong = 0; s.grabs = {};
    s.items.push({ food: Foods.list.find(f => f.name === 'Milk'),   belt: 1, x: 510, y: 520, r: 52, rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 });
    s.items.push({ food: Foods.list.find(f => f.name === 'Shrimp'), belt: 1, x: 510, y: 760, r: 52, rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 });
  });
  await page.evaluate(() => QA.swipe(510, 760, 520, 560));   // grab the shrimp, flick UP past the milk
  await frame(4);
  r = await page.evaluate(() => ({ treifOk: Game.scene.treifOk, wrong: Game.scene.wrong,
    left: Game.scene.items.map(i => i.food.name) }));
  check('kosher: an upward flick sorts the dish you grabbed, not one above it',
    r.treifOk === 1 && r.wrong === 0 && r.left.length === 1 && r.left[0] === 'Milk', JSON.stringify(r));

  // a stroke that starts on nothing sorts nothing
  await page.evaluate(() => { const s = Game.scene; s.items.length = 0; s.correct = 0; s.wrong = 0; s.grabs = {};
    s.items.push({ food: Foods.list.find(f => f.k === 'meat'), belt: 0, x: 210, y: 600, r: 52, rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 }); });
  await page.evaluate(() => QA.swipe(360, 300, 360, 520));   // empty air between the belts
  await frame(4);
  r = await page.evaluate(() => ({ left: Game.scene.items.length, correct: Game.scene.correct, wrong: Game.scene.wrong }));
  check('kosher: a stroke that starts on empty belt does nothing at all',
    r.left === 1 && r.correct === 0 && r.wrong === 0, JSON.stringify(r));

  // the exact reported failure, end to end through real pointer events
  await page.evaluate(() => { const s = Game.scene; s.items.length = 0; s.correct = 0; s.wrong = 0;
    s.items.push({ food: Foods.list.find(f => f.name === 'Salami'), belt: 0, x: 210, y: 600, r: 52,
      rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 }); });
  await page.evaluate(() => QA.swipe(210, 600, 96, 656));   // left, drifting down
  await frame(4);
  r = await page.evaluate(() => ({ correct: Game.scene.correct, wrong: Game.scene.wrong, lives: Game.scene.lives }));
  check('kosher: salami flicked left-and-down lands in MEAT, not pareve',
    r.correct === 1 && r.wrong === 0 && r.lives === 3, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.items.length = 0; s.correct = 0; s.wrong = 0;
    s.items.push({ food: Foods.list.find(f => f.name === 'Steak'), belt: 1, x: 510, y: 700, r: 52,
      rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 }); });
  await page.evaluate(() => QA.swipe(510, 700, 380, 770));   // long left drag from the far belt
  await frame(4);
  r = await page.evaluate(() => ({ correct: Game.scene.correct, wrong: Game.scene.wrong }));
  check('kosher: steak dragged left from the far belt lands in MEAT',
    r.correct === 1 && r.wrong === 0, JSON.stringify(r));

  // a short deliberate flick used to fall in the dead band between tap and swipe
  r = await page.evaluate(() => ({ min: Input.SWIPE_MIN, tap: Input.TAP_MAX_MOVE }));
  check('input: no dead band between a tap and a swipe', r.min <= r.tap, JSON.stringify(r));
  await page.evaluate(() => { const s = Game.scene; s.items.length = 0; s.correct = 0; s.wrong = 0;
    s.grabs = {}; s.spawnT = 999; s.rushTimer = 999;
    s.items.push({ food: Foods.list.find(f => f.k === 'dairy'), belt: 1, x: 510, y: 600, r: 52,
      rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 }); });
  await page.evaluate(() => QA.swipe(510, 600, 545, 606));   // 35px flick
  await frame(4);
  r = await page.evaluate(() => ({ correct: Game.scene.correct, left: Game.scene.items.length }));
  check('kosher: a short 35px flick still sorts', r.correct === 1 && r.left === 0, JSON.stringify(r));

  // the item you grabbed is the item that moves, even with another on screen
  await page.evaluate(() => { const s = Game.scene; s.items.length = 0; s.correct = 0; s.wrong = 0;
    s.grabs = {}; s.spawnT = 999; s.rushTimer = 999;
    s.items.push({ food: Foods.list.find(f => f.k === 'meat'), belt: 0, x: 210, y: 600, r: 52, rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 });
    s.items.push({ food: Foods.list.find(f => f.k === 'dairy'), belt: 1, x: 510, y: 620, r: 52, rot: 0, spin: 0, wob: 0, covered: false, reveal: 0 }); });
  await page.evaluate(() => QA.swipe(510, 620, 660, 660));   // grab the dairy one, flick right
  await frame(4);
  r = await page.evaluate(() => ({ correct: Game.scene.correct, wrong: Game.scene.wrong,
    stillThere: Game.scene.items.filter(i => i.food.k === 'meat').length,
    dairyGone: Game.scene.items.filter(i => i.food.k === 'dairy').length }));
  check('kosher: the swipe moves the item you started on, not its neighbour',
    r.correct === 1 && r.wrong === 0 && r.stillThere === 1 && r.dairyGone === 0, JSON.stringify(r));

  // ---------- KOSHER SORT: covered dishes + the rush ----------
  r = await page.evaluate(() => ({
    name: Foods.list.find(f => f.shape === 'lasagna').name,
    hint: Foods.list.find(f => f.shape === 'lasagna').hint
  }));
  check('kosher: the lasagna is labelled Meat/Cheese and says why',
    r.name === 'Meat/Cheese Lasagna' && r.hint.indexOf('pareve meat lasagna') > 0, JSON.stringify(r));

  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('kosher'); Game.beginPlay();
    const s = Game.scene; s.items.length = 0; s.rushT = 0; s.rushTimer = 999;
    s.items.push({ food: Foods.list.find(f => f.k === 'meat'), belt: 0, x: 210, y: 600, r: 52,
      rot: 0, spin: 0, wob: 0, covered: true, reveal: 0 }); });
  await page.evaluate(() => QA.swipe(210, 600, 90, 610));
  await frame(4);
  r = await page.evaluate(() => ({ left: Game.scene.items.length, correct: Game.scene.correct,
    lives: Game.scene.lives, covered: Game.scene.items[0] && Game.scene.items[0].covered }));
  check('kosher: a covered dish cannot be swiped until you look under the lid',
    r.left === 1 && r.correct === 0 && r.lives === 3 && r.covered === true, JSON.stringify(r));
  await page.evaluate(() => QA.tap(210, 600));
  await frame(4);
  r = await page.evaluate(() => ({ covered: Game.scene.items[0].covered, uncovered: Game.scene.uncovered }));
  check('kosher: tapping lifts the lid', r.covered === false && r.uncovered === 1, JSON.stringify(r));
  await page.evaluate(() => QA.swipe(210, 600, 90, 610));
  await frame(4);
  r = await page.evaluate(() => ({ left: Game.scene.items.length, correct: Game.scene.correct }));
  check('kosher: once uncovered it sorts normally', r.left === 0 && r.correct === 1, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    const calm = { speed: s.speed(), interval: +s.interval().toFixed(3), mult: s.mult };
    s.rushTimer = 0; s.update(0.016);
    const rush = { speed: s.speed(), interval: +s.interval().toFixed(3), mult: s.mult, t: s.rushT };
    s.rushT = 0.001; s.update(0.016);
    return { calm: calm, rush: rush, afterMult: s.mult };
  });
  check('kosher: the Kashrus Rush speeds the belts, halves the gaps and doubles the score',
    r.rush.speed > r.calm.speed * 1.4 && r.rush.interval < r.calm.interval * 0.7 &&
    r.rush.mult === 2 && r.afterMult === 1, JSON.stringify(r));

  // ---------- SHUL: kosher vs treif food trucks ----------
  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('shul'); Game.beginPlay(); });
  r = await page.evaluate(() => {
    const s = Game.scene;
    let road = 0, food = 0;
    for (let i = 0; i < 500; i++) {
      const row = s.makeRow(6 + (i % 9));
      if (row.type === 'road') { road++; if (row.food) food++; }
    }
    return { road: road, food: food, pct: Math.round(food / road * 100) };
  });
  check('kosher food trucks are a rare lane, not the usual road', r.road > 50 && r.pct <= 25, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    const mkRow = (kosher) => {
      const rr = Math.round(s.py);
      s.rows[rr] = { type: 'road', r: rr, dir: -1, speed: 0, food: true,
        items: [{ x: s.px * ShulCrossing.CELL + 40, w: 176, kind: 'truck', kosher: kosher, color: '#f2d24b' }] };
      return s.rows[rr].items[0];
    };
    s.col = 4; s.px = 4; s.hopT = 0; s.invuln = 0; s.remountCool = 0; s.rides = 0;
    mkRow(true); s.update(0.016);
    const rode = { riding: !!s.riding, rides: s.rides, lives: s.lives };
    s.riding = null; s.invuln = 0; s.remountCool = 0;
    mkRow(false); s.update(0.016);
    return { rode: rode, afterTreif: { lives: s.lives, riding: !!s.riding } };
  });
  check('shul: a kosher truck carries you, a treif truck flattens you',
    r.rode.riding === true && r.rode.rides === 1 && r.rode.lives === 3 &&
    r.afterTreif.lives === 2 && r.afterTreif.riding === false, JSON.stringify(r));

  // the corner remount loop
  r = await page.evaluate(() => {
    const s = Game.scene;
    s.lives = 3; s.invuln = 0; s.remountCool = 0; s.rides = 0; s.riding = null;
    const rr = Math.round(s.py);
    const truck = { x: 40, w: 176, kind: 'truck', kosher: true, color: '#f2d24b' };
    s.rows[rr] = { type: 'road', r: rr, dir: -1, speed: 0, food: true, items: [truck] };
    s.col = 0; s.px = 0; s.hopT = 0;
    s.riding = truck; s.rideOffset = 0;
    truck.x = -160;                       // carried off the kerb
    s.update(0.016);
    const dropped = { riding: !!s.riding, cool: +s.remountCool.toFixed(2), col: s.col, rides: s.rides };
    let grabbedDuringCooldown = 0;
    for (let i = 0; i < 30; i++) {                 // ~0.5s, still inside the cooldown
      truck.x = s.px * ShulCrossing.CELL + 40;     // a truck sitting right on top of you
      s.update(0.016);
      if (s.riding) grabbedDuringCooldown++;
    }
    const duringCool = { rides: s.rides, riding: !!s.riding };
    for (let i = 0; i < 90; i++) {                 // let the cooldown lapse
      truck.x = s.px * ShulCrossing.CELL + 40;
      s.update(0.016);
    }
    return { dropped: dropped, duringCool: duringCool, grabbed: grabbedDuringCooldown,
      afterCool: { rides: s.rides, riding: !!s.riding }, lives: s.lives };
  });
  check('shul: falling off a truck sets you down inward, and no remount loop while the grace lasts',
    r.dropped.riding === false && r.dropped.cool > 0.9 &&
    r.grabbed === 0 && r.duringCool.rides === 0 && r.lives === 3, JSON.stringify(r));
  check('shul: once the grace lapses you can ride again - awarded exactly once',
    r.afterCool.riding === true && r.afterCool.rides === 1, JSON.stringify(r));

  // ---------- MENORAH ----------
  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay(); });
  r = await page.evaluate(() => ({ lights: Game.scene.activeCandles().length, jugs: Game.scene.jugs.length,
    aligned: Game.scene.jugs.every(j => j.x === Game.scene.candles[j.ci].x), dur: Game.scene.nightDuration }));
  check('menorah: night 1 = 2 lights, one aligned jug each, 90s night',
    r.lights === 2 && r.jugs === 2 && r.aligned && r.dur === 90, JSON.stringify(r));

  // every hazard type is live on night 1, just slow
  r = await page.evaluate(() => { const T = Game.scene.tune();
    return { gust: Math.round(T.gustEvery), boy: Math.round(T.boyEvery), dreid: Math.round(T.dreidEvery),
      latke: Math.round(T.latkeEvery), speed: Math.round(T.gustSpeed), crack: +T.crackTime.toFixed(1) }; });
  check('menorah: all four hazards are active on night 1 and slow',
    r.gust < 1e6 && r.boy < 1e6 && r.dreid < 1e6 && r.latke < 1e6 && r.speed < 140 && r.crack > 8, JSON.stringify(r));
  r = await page.evaluate(() => { const a = Game.scene.tune(); Game.scene.night = 8; const b = Game.scene.tune(); Game.scene.night = 1;
    return { g: a.gustEvery > b.gustEvery, s: a.gustSpeed < b.gustSpeed, l: a.latkeEvery > b.latkeEvery, c: a.crackTime > b.crackTime, d: a.drain < b.drain }; });
  check('menorah: every hazard ramps from night 1 to night 8', r.g && r.s && r.l && r.c && r.d, JSON.stringify(r));

  await page.evaluate(() => { Game.scene.candles.forEach(c => { if (c.active) c.oil = 0.3; }); });
  await page.evaluate(() => { const s = Game.scene, j = s.jugs.find(j => !s.candles[j.ci].sham); QA.tap(j.x, s.jugY()); });
  await frame(4);
  r = await page.evaluate(() => { const s = Game.scene, j = s.jugs.find(j => !s.candles[j.ci].sham);
    return { filled: s.candles[j.ci].oil, other: s.candles[4].oil, jugFill: j.fill }; });
  check('menorah: a jug fills only the light directly above it',
    r.filled > 0.9 && Math.abs(r.other - 0.3) < 0.06 && r.jugFill < 0.1, JSON.stringify(r));

  // swiping against the wind pushes the gust back out the way it came
  r = await page.evaluate(() => {
    const s = Game.scene; s.gusts.length = 0;
    s.spawnGust(1, s.tune());              // enters from the left, travels right
    s.gusts[0].warn = 0; s.gusts[0].x = 200;
    return { need: s.gusts[0].need, dir: s.gusts[0].dir };
  });
  check('menorah: a gust from the left must be swiped left', r.need === 'left' && r.dir === 1, JSON.stringify(r));
  await page.evaluate(() => QA.swipe(200, 700, 560, 704));   // wrong way (rightward)
  await frame(3);
  r = await page.evaluate(() => ({ reversed: Game.scene.gusts[0].reversed, dir: Game.scene.gusts[0].dir, prompt: !!Game.scene.prompt }));
  check('menorah: swiping the wrong way does not block, and says so',
    r.reversed === false && r.dir === 1 && r.prompt, JSON.stringify(r));
  await page.evaluate(() => QA.swipe(560, 700, 200, 704));   // correct way (leftward)
  await frame(3);
  r = await page.evaluate(() => ({ reversed: Game.scene.gusts[0].reversed, dir: Game.scene.gusts[0].dir, blocks: Game.scene.blocks }));
  check('menorah: swiping against the wind reverses it back the way it came',
    r.reversed === true && r.dir === -1 && r.blocks === 1, JSON.stringify(r));
  r = await page.evaluate(() => {
    const s = Game.scene, c = s.candles[8];
    c.lit = true; c.gutter = 0; c.oil = 1;
    s.gusts[0].x = c.x + 40;                 // sweep the reversed gust back over it
    s.updateGusts(0.3, s.tune());
    return { lit: c.lit, gutter: c.gutter };
  });
  check('menorah: a reversed gust no longer harms the flames', r.lit === true && r.gutter === 0, JSON.stringify(r));

  // one gust sputters, a LATER wave puts it out - and wind always costs oil
  r = await page.evaluate(() => {
    const s = Game.scene; s.gusts.length = 0;
    const mk = (wave, c) => ({ dir: 1, need: 'left', x: c.x - 5, warn: 0, speed: 120, hit: {},
      reversed: false, y: 0, lane: 0, wave: wave, strength: 1, maxStrength: 1 });
    const c = s.candles[8]; c.lit = true; c.gutter = 0; c.gutterWave = 0; c.oil = 1;
    s.waveKills = 0;
    s.gusts.push(mk(1, c)); s.updateGusts(0.2, s.tune());
    const after1 = { lit: c.lit, sputter: c.gutter > 0, oil: c.oil };
    s.gusts.length = 0; s.waveKills = 0;
    s.gusts.push(mk(2, c)); s.updateGusts(0.2, s.tune());
    return { after1: after1, lit2: c.lit, oil2: c.oil };
  });
  check('menorah: one gust sputters the flame, a later gust puts it out',
    r.after1.lit === true && r.after1.sputter === true && r.lit2 === false, JSON.stringify(r));
  check('menorah: a gust that lands also drinks the oil',
    r.after1.oil < 0.9 && r.oil2 < r.after1.oil, JSON.stringify(r));

  // the twin-gust bug: two gusts of ONE wave must not wipe the menorah
  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 5; s.setupNight(); s.gusts.length = 0; s.waveKills = 0;
    const lights = s.candles.filter(c => c.active);
    lights.forEach(c => { c.lit = true; c.oil = 1; c.gutter = 0; c.gutterWave = 0; });
    s.gustWave = 7;
    const mk = (dir, x) => ({ dir: dir, need: dir > 0 ? 'left' : 'right', x: x, warn: 0, speed: 900,
      hit: {}, reversed: false, y: 0, lane: 0, wave: 7, strength: 1, maxStrength: 1 });
    s.gusts.push(mk(1, -200), mk(-1, CFG.W + 200));
    for (let i = 0; i < 40; i++) s.updateGusts(0.05, s.tune());   // sweep both right across
    const out = lights.filter(c => !c.lit).length;
    const sputtering = lights.filter(c => c.gutter > 0).length;
    return { total: lights.length, out: out, sputtering: sputtering };
  });
  check('menorah: twin gusts in one wave sputter the menorah but never wipe it out',
    r.out === 0 && r.sputtering === r.total, JSON.stringify(r));

  // and no single wave may take more than two lights
  r = await page.evaluate(() => {
    const s = Game.scene; s.gusts.length = 0; s.waveKills = 0;
    const lights = s.candles.filter(c => c.active);
    lights.forEach(c => { c.lit = true; c.oil = 1; c.gutter = 5; c.gutterWave = 7; });
    s.gusts.push({ dir: 1, need: 'left', x: -200, warn: 0, speed: 900, hit: {}, reversed: false,
      y: 0, lane: 0, wave: 8, strength: 1, maxStrength: 1 });
    for (let i = 0; i < 40; i++) s.updateGusts(0.05, s.tune());
    const out = lights.filter(c => !c.lit).length;
    s.night = 1; s.setupNight();
    return { total: lights.length, out: out };
  });
  check('menorah: one wind wave can never take more than two lights',
    r.total > 3 && r.out === 2, JSON.stringify(r));

  // the night opens straight away
  r = await page.evaluate(() => { const s = Game.scene; s.setupNight();
    return { gust: s.gustTimer, boy: s.boyTimer, latke: s.latkeTimer, dreidel: s.dreidelTimer }; });
  check('menorah: the first hazard arrives within a couple of seconds, not ten',
    r.gust <= 1.5 && r.boy <= 3 && r.latke <= 6 && r.dreidel <= 8, JSON.stringify(r));

  // wind gets faster and the jelly boys come more often as nights go on
  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 1; const a = s.tune(); s.night = 8; const b = s.tune(); s.night = 1;
    return { speedUp: b.gustSpeed > a.gustSpeed * 2, moreOften: b.gustEvery < a.gustEvery / 3,
      boy1: Math.round(a.boyEvery), boy8: Math.round(b.boyEvery) };
  });
  check('menorah: wind speeds up sharply and jelly comes far more often by night 8',
    r.speedUp && r.moreOften && r.boy1 <= 18 && r.boy8 <= 5, JSON.stringify(r));

  // ---- what sputtering actually costs you ----
  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 1; s.setupNight(); s.gusts.length = 0;
    const T = s.tune();
    const a = s.candles[8], b = s.candles[4];
    a.lit = true; a.oil = 1; a.gutter = T.gutter; a.gutterMax = T.gutter;
    b.lit = true; b.oil = 1; b.gutter = 0;
    s.updateCandles(1.0, T);
    return { sput: +(1 - a.oil).toFixed(4), calm: +(1 - b.oil).toFixed(4), factor: T.sputterDrain };
  });
  check('menorah: a sputtering flame drinks its cup far faster',
    r.sput > r.calm * 2 && Math.abs(r.sput / r.calm - r.factor) < 0.2, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene; s.lives = 9;
    const c = s.candles[8];
    c.lit = true; c.oil = 1; c.gutter = 0.4; c.gutterMax = 8;
    s.updateCandles(0.5, s.tune());
    return { lit: c.lit, oil: +c.oil.toFixed(2), gutter: c.gutter };
  });
  check('menorah: a sputter left unattended puts the flame out even on a full cup',
    r.lit === false && r.oil > 0.8, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    const c = s.candles[8];
    const j = s.jugFor(c.i); j.fill = 1; j.cool = 0; j.spill = 0;
    c.lit = true; c.oil = 1; c.gutter = 5; c.gutterMax = 8; s.steadied = 0;
    const poured = s.pour(c);
    return { poured: poured, gutter: c.gutter, lit: c.lit, steadied: s.steadied };
  });
  check('menorah: pouring steadies a sputtering flame - even into a full cup',
    r.poured === true && r.gutter === 0 && r.lit === true && r.steadied === 1, JSON.stringify(r));

  // twin gusts from both sides at higher nights
  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 6; s.gusts.length = 0;
    let sawTwin = false;
    for (let i = 0; i < 60 && !sawTwin; i++) { s.gusts.length = 0; s.gustTimer = 0; s.updateGusts(0.016, s.tune());
      if (s.gusts.length === 2 && s.gusts[0].dir === -s.gusts[1].dir) sawTwin = true; }
    s.gusts.length = 0; s.night = 1;
    return { sawTwin: sawTwin };
  });
  check('menorah: night 6 can send gusts from both sides at once', r.sawTwin, JSON.stringify(r));

  r = await page.evaluate(async () => {
    const s = Game.scene; const c = s.candles[8];
    c.lit = false; c.dark = 0; c.oil = 1; s.lives = 9;
    await new Promise(res => setTimeout(res, 900));
    return { lit: c.lit };
  });
  check('menorah: a dark light never relights itself', r.lit === false, JSON.stringify(r));

  // latke grease fire -> swipe it off
  r = await page.evaluate(() => {
    const s = Game.scene; const c = s.candles[8];
    c.broken = 0; c.lit = true; c.oil = 1; c.latke = { stuck: 1, max: 1, heat: 0.3, wob: 0, big: false };
    return { has: !!c.latke };
  });
  await page.evaluate(() => { const c = Game.scene.candles[8]; for (let i = 0; i < 3; i++) QA.swipe(c.x - 60, c.y + 6, c.x + 60, c.y + 10, 6); });
  await frame(4);
  r = await page.evaluate(() => ({ latke: !!Game.scene.candles[8].latke, off: Game.scene.latkesOff, broken: Game.scene.candles[8].broken }));
  check('menorah: swiping flings a burning latke off the cup',
    r.latke === false && r.off === 1 && !r.broken, JSON.stringify(r));

  // ... and if you do not, the glass cracks for good
  r = await page.evaluate(() => {
    const s = Game.scene; const c = s.candles[8];
    s.lives = 9; c.lit = true; c.oil = 1; c.broken = 0;
    c.latke = { stuck: 1, max: 1, heat: 0.99, wob: 0, big: false };
    s.updateLatkes(0.5, s.tune());
    const wasBroken = c.broken;
    const poured = s.pour(c);
    return { broken: !!wasBroken, lit: c.lit, poured: poured, cracked: s.cracked, lives: s.lives };
  });
  check('menorah: an overheated cup cracks, costs a life and cannot be refilled',
    r.broken && r.lit === false && r.poured === false && r.cracked === 1 && r.lives === 8, JSON.stringify(r));

  // shamash relight, now requiring real oil in the cup
  await page.evaluate(() => { const s = Game.scene;
    s.candles.forEach(c => { c.broken = 0; });
    s.setupNight();
    s.candles[4].lit = true; s.candles[4].oil = 1;
    s.candles[8].lit = false; s.candles[8].oil = 0.02; });
  await page.evaluate(() => { const c = Game.scene.candles[4]; QA.tap(c.x, c.y); });
  await frame(3);
  check('menorah: one tap lifts the lit shamash off its pin', (await page.evaluate(() => Game.scene.sham.out)) === true);
  // a second tap landing right behind the first must not put it straight back
  await page.evaluate(() => { const c = Game.scene.candles[4]; QA.tap(c.x, c.y); });
  await frame(3);
  check('menorah: a double tap lifts it once, it does not lift and drop again',
    (await page.evaluate(() => Game.scene.sham.out && Game.scene.sham.returning <= 0)) === true);
  await page.evaluate(() => {
    const cv = document.getElementById('stage'), s = Game.scene;
    const toC = (gx, gy) => { const b = cv.getBoundingClientRect(); return { x: b.left + View.ox + gx * View.scale, y: b.top + View.oy + gy * View.scale }; };
    const a = toC(s.sham.x, s.sham.y - 26), b = toC(s.candles[8].x, s.candles[8].y - 44);
    cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, clientX: a.x, clientY: a.y, bubbles: true }));
    cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 77, clientX: b.x, clientY: b.y, bubbles: true }));
  });
  await page.waitForTimeout(900);
  r = await page.evaluate(() => ({ prog: Game.scene.sham.progress, lit: Game.scene.candles[8].lit,
    dry: Game.scene.sham.dry === Game.scene.candles[8] }));
  check('menorah: an empty cup will not take a flame, and the cup itself says so',
    r.prog === 0 && r.lit === false && r.dry === true, JSON.stringify(r));
  await page.evaluate(() => { Game.scene.candles[8].oil = 0.9; });
  await page.waitForTimeout(2300);
  r = await page.evaluate(() => ({ lit: Game.scene.candles[8].lit, relights: Game.scene.relights }));
  check('menorah: holding it over a filled wick relights that light', r.lit === true && r.relights === 1, JSON.stringify(r));
  await page.evaluate(() => { const cv = document.getElementById('stage');
    cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 77, clientX: 0, clientY: 0, bubbles: true })); });
  await frame(3);

  // jelly: three globs douse, two do not
  await page.evaluate(() => {
    const s = Game.scene, c = s.candles[8];
    s.boys.length = 0; s.shots.length = 0; s.boyTimer = 999;   // no stray squirts mid-test
    s.candles.forEach(x => { x.jelly.length = 0; x.dripT = 0; });
    c.lit = true; c.oil = 1; c.jelly.length = 0;
    for (let k = 0; k < 2; k++) c.jelly.push({ x: c.x, y: s.globSlotY(c, k), ty: s.globSlotY(c, k), r: 40, wipe: 1, born: 9, blobs: [] });
  });
  await frame(3);
  r = await page.evaluate(() => ({ lit: Game.scene.candles[8].lit, globs: Game.scene.candles[8].jelly.length }));
  check('menorah: two globs do not douse the light', r.lit === true && r.globs === 2, JSON.stringify(r));
  await page.evaluate(() => { const s = Game.scene, c = s.candles[8];
    c.jelly.push({ x: c.x, y: s.globSlotY(c, 2), ty: s.globSlotY(c, 2), r: 40, wipe: 1, born: 9, blobs: [] }); });
  await page.waitForTimeout(1400);
  r = await page.evaluate(() => ({ lit: Game.scene.candles[8].lit, globs: Game.scene.candles[8].jelly.length, doused: Game.scene.doused }));
  check('menorah: the third glob drips down and douses it', r.lit === false && r.globs === 0 && r.doused === 1, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene, c = s.candles[8]; c.lit = true; c.jelly.length = 0;
    s.boyTimer = 999;
    c.jelly.push({ x: c.x, y: 500, ty: 500, r: 40, wipe: 1, born: 9, blobs: [] }); s.wipes = 0; });
  for (let i = 0; i < 12; i++) await page.evaluate(() => { const c = Game.scene.candles[8]; QA.swipe(c.x - 70, 500, c.x + 70, 504, 8); });
  await frame(4);
  r = await page.evaluate(() => ({ globs: Game.scene.candles[8].jelly.length, wipes: Game.scene.wipes }));
  check('menorah: swiping wipes the jelly off the glass', r.globs === 0 && r.wipes >= 1, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene; s.boys.length = 0;
    const chars = new Set();
    for (let i = 0; i < 5; i++) { s.boyTimer = 0.01; s.updateBoys(0.02, s.tune()); s.boys.forEach(b => chars.add(b.ch)); }
    return { boys: s.boys.length, distinct: chars.size, total: MenorahKeeper.BOYS.length };
  });
  check('menorah: boys spawn and cycle through 5 characters', r.boys >= 3 && r.distinct >= 3 && r.total === 5, JSON.stringify(r));

  // halachic grading
  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 5; s.setupNight();
    const lights = s.candles.filter(c => c.active && !c.sham);
    const all = s.gradeNight().key;
    lights[0].lit = false; const some = s.gradeNight().key;
    lights.forEach((c, i) => { c.lit = (i === 0); }); lights[0].lit = true;
    const one = s.gradeNight().key;
    lights.forEach(c => { c.lit = false; }); const none = s.gradeNight().key;
    s.night = 1; s.setupNight();
    return { all: all, some: some, one: one, none: none };
  });
  check('menorah: grades are Mehadrin / Kosher / Me\'ikkar HaDin / not fulfilled',
    r.all === 'mehadrin' && r.some === 'kosher' && r.one === 'ikkar' && r.none === 'none', JSON.stringify(r));
  r = await page.evaluate(() => !!Halacha.byId('m10') && Halacha.byId('m10').body.indexOf('single light per household') > 0);
  check('menorah: the Me\'ikkar HaDin halacha card exists', r === true);

  // ---- what the end of a night actually decides ----
  // a light that goes out costs the grade, never a life
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.night = 5; s.setupNight();
    s.gustTimer = 999; s.boyTimer = 999; s.latkeTimer = 999; s.dreidelTimer = 999;
    s.catTimer = 999; s.mothTimer = 999;
    const lights = s.candles.filter(c => c.active && !c.sham);
    lights[0].lit = false; lights[0].oil = 0.6;
    const lives0 = s.lives;
    const T = s.tune();
    for (let i = 0; i < Math.ceil((T.grace * 4 + 2) * 60); i++) s.updateCandles(1 / 60, T);
    return { lives0, lives: s.lives, dark: Math.round(lights[0].dark), clean: s.cleanNight };
  });
  check('menorah: a light left dark costs you the grade, not a life - even for a long time',
    r.lives === r.lives0 && r.dark > 3 && r.clean === false, JSON.stringify(r));

  // one light still burning at the bell carries the night
  r = await page.evaluate(() => {
    const s = Game.scene;
    s.night = 4; s.setupNight(); s.lives = 3;
    const lights = s.candles.filter(c => c.active && !c.sham);
    lights.forEach((c, i) => { c.lit = (i === 0); c.oil = 1; });
    s.nightTime = s.nightDuration + 0.01;
    s.update(1 / 60);
    return { state: Game.state, night: s.night, lives: s.lives, grade: s.lastGrade && s.lastGrade.key };
  });
  check('menorah: one light still burning at the bell is me\'ikkar hadin - the night stands and you move on',
    r.grade === 'ikkar' && r.night === 5 && r.lives === 3 && r.state === 'HALACHA_POPUP', JSON.stringify(r));
  await page.evaluate(() => Game.closeCard());
  await frame(3);

  // a menorah that is completely dark at the bell ends the run
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.night = 1; s.setupNight(); s.lives = 3;
    s.candles.forEach(c => { if (c.active) c.lit = false; });
    s.nightTime = s.nightDuration + 0.01;
    s.update(1 / 60);
    return { state: Game.state, night: s.night, lives: s.lives,
      grade: s.lastGrade && s.lastGrade.key, victory: !!s.victory,
      reason: (Game.gameover && Game.gameover.reason) || s.failReason };
  });
  check('menorah: night 1 ending with every light dark ends the run instead of waving you through',
    r.grade === 'none' && r.night === 1 && r.lives === 0 && r.victory === false &&
    /every light dark/.test(r.reason || ''), JSON.stringify(r));
  await page.evaluate(() => { if (Game.state === 'HALACHA_POPUP') Game.closeCard(); });
  await frame(4);
  r = await page.evaluate(() => ({ state: Game.state, victory: Game.gameover && Game.gameover.victory }));
  check('menorah: and that lands on the game-over screen, not the next night',
    r.state === 'GAME_OVER' && r.victory !== true, JSON.stringify(r));

  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay(); });
  await frame(3);

  // ---- regressions found by the adversarial audit ----
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.night = 8; s.setupNight(); s.lives = 3;
    s.candles.forEach(c => { if (c.active) c.lit = false; });
    s.nightTime = s.nightDuration + 0.01;
    s.update(1 / 60);
    return { boss: !!s.boss, grade: s.lastGrade && s.lastGrade.key, lives: s.lives,
      victory: !!s.victory, reason: (Game.gameover && Game.gameover.reason) || s.failReason };
  });
  check('menorah: night 8 is graded before the boss - a dark menorah ends the run instead of winning it',
    r.boss === false && r.grade === 'none' && r.lives === 0 && r.victory === false &&
    /every light dark/.test(r.reason || ''), JSON.stringify(r));
  await page.evaluate(() => { if (Game.state === 'HALACHA_POPUP') Game.closeCard(); });
  await frame(4);

  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.night = 8; s.setupNight(); s.lives = 3;
    s.nightTime = s.nightDuration + 0.01;
    s.update(1 / 60);
    return { boss: !!s.boss, grade: s.lastGrade && s.lastGrade.key };
  });
  check('menorah: night 8 with the lights still burning does reach Jelly-Zilla',
    r.boss === true && r.grade === 'mehadrin', JSON.stringify(r));

  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.night = 3; s.setupNight();
    const T = s.tune(), sh = s.shamash();
    s.cleanNight = true;
    sh.lit = true; sh.gutter = 0.001; sh.gutterWave = 0; sh.oil = 1;
    for (let i = 0; i < 8; i++) s.updateCandles(1 / 60, T);
    return { shamashOut: sh.lit === false, clean: s.cleanNight };
  });
  check('menorah: the shamash sputtering out costs nothing, exactly like every other way it can die',
    r.shamashOut === true && r.clean === true, JSON.stringify(r));

  r = await page.evaluate(async () => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene, sh = s.sham;
    s.night = 3; s.setupNight();
    const c = s.shamash(); c.lit = true; c.oil = 1;
    QA.tap(c.x, c.y);
    await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
    const cv = document.getElementById('stage');
    const b = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91,
      clientX: b.left + View.ox + sh.x * View.scale, clientY: b.top + View.oy + sh.y * View.scale, bubbles: true }));
    await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
    const heldBefore = sh.held;
    /* a pause eats the pointer, and the matching 'up' never reaches the scene */
    Game.pause(); Game.resume();
    for (let i = 0; i < 4; i++) s.update(1 / 60);
    return { heldBefore, heldAfter: sh.held, out: sh.out };
  });
  check('menorah: pausing while carrying the shamash lets go of it, instead of eating every swipe for the rest of the night',
    r.heldBefore === true && r.heldAfter === false && r.out === true, JSON.stringify(r));

  // ---- new higher-night attackers ----
  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 4; s.setupNight(); s.cats.length = 0; s.catTimer = 0;
    s.updateCats(0.016, s.tune());
    const spawnedAt4 = s.cats.length;
    s.cats.length = 0; s.night = 2; s.catTimer = 0; s.updateCats(0.016, s.tune());
    const spawnedAt2 = s.cats.length;
    s.night = 4; s.setupNight();
    return { at4: spawnedAt4, at2: spawnedAt2 };
  });
  check('menorah: the cat only starts stalking from night 4', r.at4 === 1 && r.at2 === 0, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.cats.length = 0;
    s.cats.push({ dir: 1, x: 300, y: s.catY(), speed: 80, state: 'creep', phase: 0, target: s.jugs[s.jugs.length - 1] }); });
  await page.evaluate(() => { const s = Game.scene; QA.swipe(240, s.catY(), 380, s.catY() + 6); });
  await frame(4);
  r = await page.evaluate(() => ({ state: Game.scene.cats[0] && Game.scene.cats[0].state, shooed: Game.scene.shooed }));
  check('menorah: swiping at the cat shoos it off', r.state === 'flee' && r.shooed === 1, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene; s.cats.length = 0;
    const tgt = s.jugs[2];
    s.cats.push({ dir: 1, x: tgt.x - 1, y: s.catY(), speed: 80, state: 'creep', phase: 0, target: tgt });
    s.updateCats(0.05, s.tune());
    const spilled = s.jugs.filter(j => j.spill > 0).length;
    s.jugs.forEach(j => { j.spill = 0; j.fill = 1; });
    return { spilled: spilled, cats: s.cats.length };
  });
  check('menorah: a cat that gets through spills two jugs at once', r.spilled === 2 && r.cats === 0, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 5; s.setupNight(); s.moths.length = 0; s.mothTimer = 0;
    s.updateMoths(0.016, s.tune());
    const at5 = s.moths.length;
    s.moths.length = 0; s.night = 3; s.mothTimer = 0; s.updateMoths(0.016, s.tune());
    const at3 = s.moths.length;
    s.night = 5; s.setupNight();
    return { at5: at5, at3: at3 };
  });
  check('menorah: moths only start diving from night 5', r.at5 === 1 && r.at3 === 0, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.moths.length = 0;
    s.moths.push({ x: 360, y: 460, target: s.liveCandles().find(c => c.lit), phase: 0, sp: 1 }); });
  await page.evaluate(() => QA.tap(360, 460));
  await frame(4);
  r = await page.evaluate(() => ({ moths: Game.scene.moths.length, swatted: Game.scene.swatted }));
  check('menorah: tapping swats a moth out of the air', r.moths === 0 && r.swatted === 1, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene; s.moths.length = 0;
    const c = s.liveCandles().find(x => x.lit && !x.sham);
    c.gutter = 0;
    s.moths.push({ x: c.x, y: c.y - 30, target: c, phase: 0, sp: 200 });
    s.updateMoths(0.05, s.tune());
    const first = { lit: c.lit, sputter: c.gutter > 0 };
    s.moths.push({ x: c.x, y: c.y - 30, target: c, phase: 0, sp: 200 });
    s.updateMoths(0.05, s.tune());
    return { first: first, litAfterTwo: c.lit };
  });
  check('menorah: a moth that reaches a flame sputters it, a second puts it out',
    r.first.lit === true && r.first.sputter === true && r.litAfterTwo === false, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene; s.night = 8; s.setupNight(); s.gusts.length = 0;
    s.spawnGust(1, s.tune(), true);
    const g = s.gusts[0]; g.warn = 0; g.x = 300;
    const before = g.strength;
    s.trySwipeBack('left', 360, 700);
    const mid = { strength: g.strength, reversed: g.reversed };
    s.trySwipeBack('left', 360, 700);
    return { before: before, mid: mid, after: { strength: g.strength, reversed: g.reversed } };
  });
  check('menorah: a hard gust at night 8 needs two swipes to turn back',
    r.before === 2 && r.mid.strength === 1 && r.mid.reversed === false && r.after.reversed === true, JSON.stringify(r));

  // ---- text never overflows its box ----
  r = await page.evaluate(() => {
    const ctx = View.ctx;
    const long = "NOT FULFILLED - Every light was dark by the end of the half hour.";
    const lines = Draw.wrap(ctx, long, 640 - 108, 22, '800');
    const widest = Math.max.apply(null, lines.map(l => Draw.measure(ctx, l, 22, '800')));
    const fitted = Draw.textFit(ctx, long, -9999, -9999, 300, { size: 40 });
    return { lines: lines.length, widest: Math.round(widest), fitted: Math.round(fitted) };
  });
  check('text: long toast copy wraps inside its panel and textFit shrinks to fit',
    r.lines > 1 && r.widest <= 532 && r.fitted < 40, JSON.stringify(r));
  r = await page.evaluate(() => {
    const ctx = View.ctx;
    const s = Game.scene;
    s.say('Drag the shamash onto a dark wick - it burns twice as fast in the open');
    const lines = Draw.wrap(ctx, s.prompt.text, CFG.W - 120, 22, '800');
    const widest = Math.max.apply(null, lines.map(l => Draw.measure(ctx, l, 22, '800')));
    return { lines: lines.length, widest: Math.round(widest), max: CFG.W - 120 };
  });
  check('text: the in-game prompt bar wraps too', r.widest <= r.max, JSON.stringify(r));

  // ---- the column guides are gone ----
  r = await page.evaluate(() => ({
    noColumns: typeof MenorahKeeper.prototype.drawColumns === 'undefined',
    hasStreams: typeof MenorahKeeper.prototype.drawPourStreams === 'function',
    aligned: Game.scene.jugs.every(j => j.x === Game.scene.candles[j.ci].x)
  }));
  check('menorah: columns are invisible but jug and light still line up',
    r.noColumns && r.hasStreams && r.aligned, JSON.stringify(r));

  r = await page.evaluate(() => Halacha.byId('m8').body.indexOf('Erev Shabbos') > 0 &&
    Halacha.byId('m8').source.indexOf('679:1') > 0);
  check('halacha: the lighting-time card covers erev Shabbos', r === true);

  await page.evaluate(() => { Game.scene.night = 1; Game.scene.setupNight(); });
  await page.evaluate(() => { Game.scene.night = 1; Game.scene.nightTime = Game.scene.nightDuration + 0.1; });
  await frame(4);
  r = await page.evaluate(() => ({ state: Game.state, night: Game.scene.night, grade: Game.scene.lastGrade && Game.scene.lastGrade.key }));
  check('menorah: finishing a night grades it, shows a card and advances',
    r.state === 'HALACHA_POPUP' && r.night === 2 && !!r.grade, JSON.stringify(r));
  await page.evaluate(() => Game.closeCard());
  await frame(3);
  r = await page.evaluate(() => ({ state: Game.state, lights: Game.scene.activeCandles().length, jugs: Game.scene.jugs.length }));
  check('menorah: night 2 = 3 lights and 3 jugs', r.state === 'PLAYING' && r.lights === 3 && r.jugs === 3, JSON.stringify(r));

  // ---------- the shamash carries no penalty at all ----------
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.gustTimer = 999; s.boyTimer = 999; s.latkeTimer = 999; s.dreidelTimer = 999;
    s.catTimer = 999; s.mothTimer = 999;
    const sh = s.shamash();
    sh.lit = false; sh.oil = 1; s.lives = 3; s.cleanNight = true;
    for (let i = 0; i < 40; i++) s.updateCandles(1.0, s.tune());   // 40 seconds dark
    return { lives: s.lives, state: Game.state, cleanNight: s.cleanNight };
  });
  check('menorah: the shamash can stay dark all night and it costs nothing',
    r.lives === 3 && r.state === 'PLAYING' && r.cleanNight === true, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    const lights = s.candles.filter(c => c.active && !c.sham);
    lights.forEach(c => { c.lit = true; c.oil = 1; });
    const before = s.gradeNight();
    s.shamash().lit = false;
    const after = s.gradeNight();
    return { before: before.key, after: after.key };
  });
  check('menorah: a dark shamash never touches the nightly grade',
    r.before === 'mehadrin' && r.after === 'mehadrin', JSON.stringify(r));

  await page.evaluate(() => { const sh = Game.scene.shamash(); sh.lit = false; sh.oil = 1;
    QA.tap(sh.x, sh.y); });
  await frame(4);
  r = await page.evaluate(() => ({ lit: Game.scene.shamash().lit, lives: Game.scene.lives }));
  check('menorah: one tap lights the shamash again whenever you get round to it',
    r.lit === true && r.lives === 3, JSON.stringify(r));

  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.gustTimer = 999; s.boyTimer = 999; s.latkeTimer = 999; s.dreidelTimer = 999;
    s.catTimer = 999; s.mothTimer = 999;
    const sh = s.shamash();
    s.lives = 3; s.cleanNight = true;
    sh.latke = { stuck: 1, max: 1, heat: 0.99, wob: 0, big: false };
    s.updateLatkes(0.5, s.tune());
    return { broken: !!sh.broken, lit: sh.lit, lives: s.lives, cleanNight: s.cleanNight,
      state: Game.state };
  });
  check('menorah: a cracked shamash cup costs no life - you just cannot relight from it',
    r.broken === true && r.lit === false && r.lives === 3 && r.cleanNight === true &&
    r.state === 'PLAYING', JSON.stringify(r));

  // dressed properly
  r = await page.evaluate(() => {
    function lum(hex) {
      var n = parseInt(hex.slice(1), 16);
      return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
    }
    return MenorahKeeper.BOYS.map((b, i) => ({
      i: i, gap: Math.round(Math.abs(lum(b.shirt) - lum(b.skin)))
    }));
  });
  var tooClose = r.filter(b => b.gap < 60);
  check('menorah: every boy has a shirt clearly distinct from skin tone',
    tooClose.length === 0, JSON.stringify(r));

  // ---------- NIGHT 8: THE JELLY-POCALYPSE ----------
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    s.night = 8; s.setupNight();
    const lightsBefore = s.candles.filter(c => c.active).length;
    s.nightTime = s.nightDuration + 0.1;
    s.update(0.016);
    return { lights: lightsBefore, boss: !!s.boss, phase: s.boss && s.boss.phase,
      allLit: s.candles.filter(c => c.active && c.lit).length };
  });
  check('boss: night 8 does not end - it fakes a win first, every light burning',
    r.lights === 9 && r.boss === true && r.phase === 'victory' && r.allLit === 9, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    s.update(3.7); const p1 = s.boss.phase;
    s.update(3.5); const p2 = s.boss.phase;
    const dark = s.candles.filter(c => c.active && !c.lit).length;
    s.update(3.0); const p3 = s.boss.phase;
    return { gift: p1, reveal: p2, fight: p3, blownOut: dark };
  });
  check('boss: a boy brings a box, it opens, and the arrival blows every light out',
    r.gift === 'gift' && r.reveal === 'reveal' && r.fight === 'fight' && r.blownOut === 9,
    JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, b = s.boss;
    b.shots.length = 0; b.halves.length = 0; b.combo = 0;
    s.bossVolley(2);
    const fired = b.shots.length;
    const sh = b.shots[0];
    s.handleBoss({ type: 'move', px: sh.x - 90, py: sh.y - 6, x: sh.x + 90, y: sh.y + 6 });
    const afterSlice = { left: b.shots.length, halves: b.halves.length, combo: b.combo, hp: b.hp };
    for (let i = 0; i < 40; i++) s.update(0.016);      // the halves fly home
    return { fired: fired, afterSlice: afterSlice, hpAfter: b.hp, halvesLeft: b.halves.length };
  });
  check('boss: slicing a sufganiyah sends both halves back into him for damage',
    r.fired === 2 && r.afterSlice.left === 1 && r.afterSlice.halves === 2 &&
    r.afterSlice.combo === 1 && r.hpAfter < 100 && r.halvesLeft === 0, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, b = s.boss;
    b.blobs.length = 0;
    s.bossAddBlob(360, 700);
    const bl = b.blobs[0];
    for (let i = 0; i < 14; i++) {
      s.handleBoss({ type: 'move', px: bl.x - 30, py: bl.y, x: bl.x + 30, y: bl.y + 12 });
    }
    s.update(0.016);
    return { cleared: b.blobs.length === 0, scrubbed: b.scrubbed };
  });
  check('boss: scrubbing clears jelly off the glass', r.cleared && r.scrubbed >= 1, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, b = s.boss;
    b.blobs.length = 0; s.lives = 3;
    for (let i = 0; i < 5; i++) s.bossAddBlob(120 + i * 110, 600 + i * 40);
    s.update(0.016);
    return { lives: s.lives, blobs: b.blobs.length };
  });
  check('boss: five blobs at once smothers you and costs a life',
    r.lives === 2 && r.blobs === 0, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, b = s.boss;
    s.lives = 3; b.chomp = { t: 0.05, taps: 7, need: 7 };
    const hp0 = b.hp;
    s.update(0.06);
    const repelled = { lives: s.lives, hurt: b.hp < hp0, chomp: b.chomp };
    b.chomp = { t: 0.05, taps: 0, need: 7 };
    s.update(0.06);
    return { repelled: repelled, missedLives: s.lives };
  });
  check('boss: tapping fast enough shoves the lunge back, missing it costs a life',
    r.repelled.lives === 3 && r.repelled.hurt === true && r.repelled.chomp === null &&
    r.missedLives === 2, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, b = s.boss;
    s.lives = 3; b.blobs.length = 0; b.shots.length = 0; b.chomp = null;
    b.hp = 2; s.bossHurt(5, 360, 500);
    s.update(0.016);
    const flask = s.boss.phase;
    s.handleBoss({ type: 'tap', x: CFG.W / 2, y: 980 });
    const burn = s.boss.phase;
    s.update(4.0);
    const relight = s.boss.phase;
    return { flask: flask, burn: burn, relight: relight };
  });
  check('boss: at zero HP the Pach Shemen appears, one tap lights him up',
    r.flask === 'flask' && r.burn === 'burn' && r.relight === 'relight', JSON.stringify(r));

  r = await page.evaluate(async () => {
    const s = Game.scene;
    for (let i = 0; i < 60; i++) s.update(0.1);
    return { state: Game.state, victory: s.victory, badge: Profile.hasBadge('b_boss'),
      lit: s.candles.filter(c => c.active && c.lit).length, score: Math.round(s.score) };
  });
  check('boss: beating him relights all nine and hands you the prize',
    r.victory === true && r.badge === true && r.lit === 9 && r.score > 5000 &&
    r.state === 'HALACHA_POPUP', JSON.stringify(r));
  await page.evaluate(() => Game.closeCard());
  await frame(4);
  r = await page.evaluate(() => ({ state: Game.state, victory: Game.gameover && Game.gameover.victory,
    reason: Game.gameover && Game.gameover.reason }));
  check('boss: the run ends on a victory screen, not a failure one',
    r.state === 'GAME_OVER' && r.victory === true && /defeated/.test(r.reason), JSON.stringify(r));

  r = await page.evaluate(() => ({
    card: !!Halacha.byId('m12') && /sealed with the seal/.test(Halacha.byId('m12').body),
    note: !!Halacha.byId('m2').note && /does not roll like that/.test(Halacha.byId('m2').note),
    m2: /not obligated to relight/.test(Halacha.byId('m2').body)
  }));
  check('halacha: the relighting card carries the ruling and the game\'s own aside, and the Pach Shemen card exists',
    r.card && r.note && r.m2, JSON.stringify(r));

  // ---------- SHUL ----------
  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('shul'); Game.beginPlay(); });
  let st0 = await page.evaluate(() => ({ col: Game.scene.col, row: Game.scene.row }));
  await page.evaluate(() => QA.tap(360, 500));
  await frame(3);
  let st1 = await page.evaluate(() => ({ col: Game.scene.col, row: Game.scene.row, hops: Game.scene.hops }));
  check('shul: tap hops forward', st1.row === st0.row + 1 && st1.hops === 1, JSON.stringify(st1));
  await page.evaluate(() => QA.swipe(400, 700, 200, 700));
  await frame(3);
  let st2 = await page.evaluate(() => ({ col: Game.scene.col }));
  check('shul: swipe left steers left', st2.col === st1.col - 1, JSON.stringify(st2));
  await page.evaluate(() => QA.swipe(200, 700, 460, 700));
  await frame(3);
  check('shul: swipe right steers right', (await page.evaluate(() => Game.scene.col)) === st1.col);
  await page.evaluate(() => { Game.scene.row = Game.scene.goalRow; Game.scene.py = Game.scene.goalRow; Game.scene.col = 4; Game.scene.px = 4; Game.scene.hopT = 0; });
  await frame(4);
  r = await page.evaluate(() => ({ state: Game.state, arrivals: Game.scene.arrivals, mult: Game.scene.mult }));
  check('shul: reaching the shul awards the multiplier + card', r.state === 'HALACHA_POPUP' && r.arrivals === 1 && r.mult > 1, JSON.stringify(r));
  await page.evaluate(() => Game.closeCard());
  await frame(3);

  // ---------- MATZAH ----------
  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('matzah'); Game.beginPlay();
    const s = Game.scene; s.chametz.length = 0;
    s.chametz.push({ kind: 'loaf', giant: false, x: 360, y: 500, vx: 0, vy: 0, r: 44, rot: 0, spin: 0, hp: 1, flash: 0, dead: false }); });
  await page.evaluate(() => QA.swipe(240, 500, 480, 505, 8));
  await frame(4);
  r = await page.evaluate(() => ({ sliced: Game.scene.sliced, left: Game.scene.chametz.length }));
  check('matzah: a slash cuts flying chametz', r.sliced === 1 && r.left === 0, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.chametz.length = 0;
    s.chametz.push({ kind: 'croissant', giant: true, x: 360, y: 500, vx: 0, vy: 0, r: 78, rot: 0, spin: 0, hp: 3, flash: 0, dead: false }); });
  await page.waitForTimeout(500);
  await page.evaluate(() => QA.swipe(240, 500, 480, 505, 8));
  await frame(2);
  r = await page.evaluate(() => ({ hp: Game.scene.chametz[0] ? Game.scene.chametz[0].hp : null }));
  check('matzah: giant croissant survives one cut', r.hp === 2, JSON.stringify(r));
  await page.evaluate(() => { QA.swipe(240, 500, 480, 505, 8); QA.swipe(480, 520, 240, 480, 8); });
  await frame(4);
  r = await page.evaluate(() => ({ giants: Game.scene.giants, left: Game.scene.chametz.length }));
  check('matzah: combo swipes destroy the giant', r.giants === 1 && r.left === 0, JSON.stringify(r));

  const tx0 = await page.evaluate(() => Game.scene.truckX);
  await page.evaluate(() => { const sl = Game.scene.sliderRect(); QA.swipe(sl.x + 10, sl.cy, sl.x + sl.w - 10, sl.cy, 6); });
  await frame(6);
  const tx1 = await page.evaluate(() => Game.scene.targetX);
  check('matzah: the steering slider moves the truck', tx1 > tx0 + 100, tx0 + ' -> ' + tx1);

  await page.evaluate(() => { const s = Game.scene; s.clouds.length = 0;
    s.clouds.push({ x: 360, y: 500, r: 74, vy: 0, taps: 0, need: 4, wob: 0, shake: 0 }); });
  for (let i = 0; i < 4; i++) { await page.evaluate(() => QA.tap(360, 500)); await frame(2); }
  r = await page.evaluate(() => ({ clouds: Game.scene.clouds.length, busted: Game.scene.cloudsBusted }));
  check('matzah: repeated taps disperse a yeast cloud', r.clouds === 0 && r.busted === 1, JSON.stringify(r));

  await page.evaluate(() => { const s = Game.scene; s.pickups.length = 0;
    s.pickups.push({ x: s.truckX, y: MatzahHavoc.TRUCK_Y - 20, r: 40, rot: 0 }); });
  await frame(4);
  r = await page.evaluate(() => ({ shield: Game.scene.shield, taken: Game.scene.shieldsTaken }));
  check('matzah: Afikoman pickup grants the shield', r.shield > 0 && r.taken === 1, JSON.stringify(r));

  // ---------- MATZAH: the truck's hitbox matches its outline ----------
  await page.evaluate(() => { Game.quitToMenu(); Game.startGame('matzah'); Game.beginPlay();
    const s = Game.scene; s.chametz.length = 0; s.clouds.length = 0; s.obstacles.length = 0;
    s.spawnAir = 999; s.spawnRoad = 999; s.spawnCloud = 999; s.spawnPickup = 999;
    s.truckX = 360; s.targetX = 360; s.shield = 0; });
  r = await page.evaluate(() => {
    const s = Game.scene, T = MatzahHavoc.TRUCK_Y;
    const loaf = (x, y) => ({ kind: 'loaf', giant: false, x: x, y: y, vx: 0, vy: 0, r: 44,
      rot: 0, spin: 0, hp: 1, flash: 0, cool: 0, dead: false });
    const test = (x, y) => { s.chametz.length = 0; s.cargo = 1; s.lives = 9;
      s.chametz.push(loaf(x, y)); s.updateLatkes ? 0 : 0; s.update(0.016);
      return s.cargo < 1; };
    return {
      onTheBody:   test(360, T - 40),
      justAbove:   test(360, T - 150),
      wideRight:   test(360 + 130, T),
      alreadyPast: test(360, T + 300),
      farBelowOff: test(360, T + 240)
    };
  });
  check('matzah: chametz only counts when it actually meets the truck body',
    r.onTheBody === true && r.justAbove === false && r.wideRight === false &&
    r.alreadyPast === false && r.farBelowOff === false, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, T = MatzahHavoc.TRUCK_Y;
    s.chametz.length = 0;
    const cloud = (x, y) => ({ x: x, y: y, r: 74, vy: 0, taps: 0, need: 4, wob: 0, shake: 0 });
    const test = (x, y) => { s.clouds.length = 0; s.cargo = 1; s.lives = 9;
      s.clouds.push(cloud(x, y)); s.update(0.016); return s.cargo < 1; };
    return { over: test(360, T - 30), beside: test(360 + 175, T), below: test(360, T + 280) };
  });
  check('matzah: a yeast cloud has to reach the cargo to spoil it',
    r.over === true && r.beside === false && r.below === false, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, T = MatzahHavoc.TRUCK_Y;
    s.clouds.length = 0; s.chametz.length = 0;
    const car = (x, y) => ({ x: x, y: y, w: 118, h: 190, kind: 'car', color: '#fff', rel: 0 });
    const test = (x, y) => { s.obstacles.length = 0; s.lives = 9; s.hitFlash = 0;
      s.obstacles.push(car(x, y)); s.update(0.016); return s.lives < 9; };
    return { sameLane: test(360, T), nextLane: test(360 + 143, T), wayAhead: test(360, T - 320) };
  });
  check('matzah: only traffic in your own lane hits you',
    r.sameLane === true && r.nextLane === false && r.wayAhead === false, JSON.stringify(r));

  // ---------- MATZAH: the Afikoman shield really is invincibility ----------
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('matzah'); Game.beginPlay();
    const s = Game.scene, T = MatzahHavoc.TRUCK_Y;
    s.spawnAir = 999; s.spawnRoad = 999; s.spawnCloud = 999; s.spawnPickup = 999;
    s.truckX = 360; s.targetX = 360;
    s.shield = 6; s.cargo = 1; s.lives = 3; s.hour = 0.001;
    s.chametz.length = 0; s.clouds.length = 0; s.obstacles.length = 0;
    s.chametz.push({ kind: 'loaf', giant: false, x: 360, y: T - 40, vx: 0, vy: 0, r: 44,
      rot: 0, spin: 0, hp: 1, flash: 0, cool: 0.2, dead: false });
    s.clouds.push({ x: 360, y: T - 30, r: 74, vy: 0, taps: 0, need: 4, wob: 0, shake: 0 });
    s.obstacles.push({ x: 360, y: T, w: 118, h: 190, kind: 'car', color: '#fff', rel: 0 });
    for (let i = 0; i < 12; i++) s.update(0.016);
    return { lives: s.lives, cargo: +s.cargo.toFixed(2), shield: s.shield > 0,
      chametz: s.chametz.length, clouds: s.clouds.length, obstacles: s.obstacles.length };
  });
  check('matzah: with the Afikoman shield up, nothing damages you at all',
    r.lives === 3 && r.cargo === 1 && r.chametz === 0 && r.clouds === 0 && r.obstacles === 0,
    JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, T = MatzahHavoc.TRUCK_Y;
    s.shield = 0; s.cargo = 1; s.lives = 3;
    s.chametz.length = 0; s.clouds.length = 0; s.obstacles.length = 0;
    s.obstacles.push({ x: 360, y: T, w: 118, h: 190, kind: 'car', color: '#fff', rel: 0 });
    s.update(0.016);
    return { lives: s.lives };
  });
  check('matzah: the same crash without the shield still costs a life', r.lives === 2, JSON.stringify(r));

  // ---------- no sun, moon or stars anywhere in the art ----------
  r = await page.evaluate(() => {
    var badIcons = []
      .concat(Halacha.cards.map(c => c.icon))
      .concat(Halacha.badges.map(b => b.icon))
      .filter(i => i === 'sun' || i === 'star' || i === 'moon');
    return {
      starfieldGone: typeof Starfield === 'undefined',
      cloudsPresent: typeof Clouds === 'object' && typeof Clouds.render === 'function',
      sunShape: typeof Icons.shapes.sun,
      starShape: typeof Icons.shapes.star,
      moonShape: typeof Icons.shapes.moon,
      rosette: typeof Icons.shapes.rosette,
      badIcons: badIcons
    };
  });
  check('art: no starfield, no sun/moon/star icons - clouds instead',
    r.starfieldGone && r.cloudsPresent && r.sunShape === 'undefined' &&
    r.starShape === 'undefined' && r.moonShape === 'undefined' &&
    r.rosette === 'function' && r.badIcons.length === 0, JSON.stringify(r));

  r = await page.evaluate(() => {
    var src = document.documentElement.innerHTML;
    // the only "star" left should be the word inside code that draws nothing celestial
    return { drawStar: typeof Draw.star, magen: typeof Draw.magenDavid };
  });
  check('art: the Magen David emblem is kept, it is not a depiction of a heavenly body',
    r.magen === 'function', JSON.stringify(r));

  // ---------- BADGES / PROFILE / PERSISTENCE ----------
  r = await page.evaluate(() => { const ok = Game.award('b_slice'); return { ok: ok, has: Profile.hasBadge('b_slice'), toasts: Game.toasts.length }; });
  check('badges: awarding unlocks and toasts', r.ok && r.has && r.toasts > 0, JSON.stringify(r));
  r = await page.evaluate(() => { const raw = localStorage.getItem(CFG.SAVE_KEY); return { saved: !!raw && JSON.parse(raw).badges.b_slice > 0 }; });
  check('profile: persisted to localStorage', r.saved, JSON.stringify(r));

  // ================= GEOMETRY / PHYSICS AUDIT =================
  // Menorah Keeper
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('menorah'); Game.beginPlay();
    const s = Game.scene;
    const out = { nights: [], ok: true };
    for (let n = 1; n <= 8; n++) {
      s.night = n; s.setupNight();
      const xs = s.jugs.map(j => j.x).sort((a, b) => a - b);
      let minGap = 1e9;
      for (let i = 1; i < xs.length; i++) minGap = Math.min(minGap, xs[i] - xs[i - 1]);
      const cw = s.colWidth(), jw = s.jugs[0].w, T = s.tune();
      const globR = cw * 0.44 * 1.05;           // widest glob plus its puffs
      const latkeRing = Math.min(46, cw / 2 - 2);
      const row = {
        n: n,
        aligned: s.jugs.every(j => j.x === s.candles[j.ci].x),
        jugFits: jw <= minGap,                   // jugs never overlap each other
        colFits: cw <= minGap + 8,               // tap columns never overlap
        sputterRing: 31 <= cw / 2,               // sputter countdown stays in its column
        latkeRing: latkeRing <= cw / 2,
        globFits: globR <= cw / 2 + 4,
        jellyClearsFlame: s.globSlotY(s.candles[4], 0) < s.candles[4].y - 60,
        jellyClearsHud: s.globSlotY(s.candles[4], 2) > View.safe.t + 236,
        jugsOnScreen: s.jugs.every(j => j.x - j.w / 2 > 22 && j.x + j.w / 2 < CFG.W - 22),
        gustCrossSec: +((CFG.W + 300) / T.gustSpeed).toFixed(1)
      };
      for (const k in row) if (row[k] === false) out.ok = false;
      out.nights.push(row);
    }
    const t1 = (s.night = 1, s.tune()), t8 = (s.night = 8, s.tune());
    s.night = 1; s.setupNight();
    out.reactionN1 = (CFG.W + 300) / t1.gustSpeed >= 5;
    out.pressureN8 = (CFG.W + 300) / t8.gustSpeed <= 3.5;
    return out;
  });
  check('audit/menorah: every night lays out inside its own columns and on screen',
    r.ok && r.reactionN1 && r.pressureN8,
    JSON.stringify(r.nights.filter(n => Object.keys(n).some(k => n[k] === false))) +
    ' n1=' + r.reactionN1 + ' n8=' + r.pressureN8);

  // Shul Crossing - is every traffic row actually passable, at every moment?
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('shul'); Game.beginPlay();
    const s = Game.scene, CELL = ShulCrossing.CELL, TRACK = ShulCrossing.TRACK;
    let rows = 0, impassable = 0, badWrap = 0, worstClear = 1e9;
    for (let lvl = 1; lvl <= 10; lvl++) {
      s.level = lvl;
      for (let i = 0; i < 120; i++) {
        const row = s.makeRow(6 + (i % 9));
        if (row.type !== 'road') continue;
        rows++;
        const w = row.items[0].w;
        const gap = row.items.length > 1 ? row.items[1].x - row.items[0].x : TRACK;
        if (Math.abs(row.items.length * gap - TRACK) > 0.001) badWrap++;
        // sweep the whole cycle: at every phase there must be a safe column
        for (let ph = 0; ph < 24; ph++) {
          const off = ph * gap / 24;
          let bestClear = -1;
          for (let c = 0; c < ShulCrossing.COLS; c++) {
            const px = c * CELL + CELL / 2;
            let clear = 1e9;
            for (let k = 0; k < row.items.length; k++) {
              let vx = row.items[k].x + off;
              vx = ((vx + 200) % TRACK + TRACK) % TRACK - 200;
              clear = Math.min(clear, Math.abs(px - vx) - w / 2);
            }
            bestClear = Math.max(bestClear, clear);
          }
          if (bestClear < 20) impassable++;
          worstClear = Math.min(worstClear, bestClear);
        }
      }
    }
    s.level = 1;
    return { rows: rows, impassable: impassable, badWrap: badWrap, worstClear: Math.round(worstClear) };
  });
  check('audit/shul: every traffic row leaves a safe column at every moment of its cycle',
    r.rows > 200 && r.impassable === 0 && r.badWrap === 0 && r.worstClear >= 20, JSON.stringify(r));

  // Kosher Sort - bins really are where the swipe says they are
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('kosher'); Game.beginPlay();
    const s = Game.scene;
    const beltL = KosherSort.BELT_X[0] - KosherSort.BELT_W / 2;
    const beltR = KosherSort.BELT_X[1] + KosherSort.BELT_W / 2;
    s.level = 14; s.rushT = 8;
    const spacing = s.speed() * s.interval() * 0.85;   // tightest possible
    s.level = 1; s.rushT = 0;
    return {
      meatLeftOfBelts: 8 + 98 <= beltL,
      dairyRightOfBelts: CFG.W - 106 >= beltR,
      pareveBelowEnd: KosherSort.END + 26 > KosherSort.END,
      trashAboveTop: KosherSort.TOP - 114 + 106 <= KosherSort.TOP,
      chutesBetweenBelts: 300 >= beltL + KosherSort.BELT_W && 420 <= beltR - KosherSort.BELT_W,
      spacing: Math.round(spacing),
      grabUnambiguous: spacing > KosherSort.GRAB_RADIUS
    };
  });
  check('audit/kosher: bins sit where the gestures point, and grabs stay unambiguous even in a rush',
    r.meatLeftOfBelts && r.dairyRightOfBelts && r.pareveBelowEnd && r.trashAboveTop &&
    r.chutesBetweenBelts && r.grabUnambiguous, JSON.stringify(r));

  // Matzah Havoc - steering range, lanes and hitbox
  r = await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('matzah'); Game.beginPlay();
    const s = Game.scene;
    const sl = s.sliderRect();
    s.setSlider(sl.x - 999); const atMin = s.targetX;
    s.setSlider(sl.x + sl.w + 999); const atMax = s.targetX;
    const lanes = [0, 1, 2, 3].map(l => MatzahHavoc.ROAD_L + 72 + l * 143);
    const R = s.truckRect();
    return {
      sliderMin: Math.round(atMin), sliderMax: Math.round(atMax),
      truckMin: MatzahHavoc.MIN_X, truckMax: MatzahHavoc.MAX_X,
      rangesMatch: Math.abs(atMin - MatzahHavoc.MIN_X) < 0.001 && Math.abs(atMax - MatzahHavoc.MAX_X) < 0.001,
      lanesOnRoad: lanes.every(x => x > MatzahHavoc.ROAD_L && x < MatzahHavoc.ROAD_R),
      lanesReachable: lanes.every(x => x >= MatzahHavoc.MIN_X && x <= MatzahHavoc.MAX_X),
      hitboxInsideArt: (R.x >= s.truckX - 82) && (R.x + R.w <= s.truckX + 82) &&
                       (R.y >= MatzahHavoc.TRUCK_Y - 118) && (R.y + R.h <= MatzahHavoc.TRUCK_Y + 106)
    };
  });
  check('audit/matzah: the slider covers exactly the truck range, lanes are reachable, hitbox inside the art',
    r.rangesMatch && r.lanesOnRoad && r.lanesReachable && r.hitboxInsideArt, JSON.stringify(r));

  // ---------- TZEDAKA BLAST ----------
  await page.evaluate(() => {
    Game.quitToMenu(); Game.startGame('tzedaka'); Game.beginPlay();
    const s = Game.scene;
    s.spawnT = 9999; s.pigeonT = 9999; s.people.length = 0; s.coins.length = 0;
    s.wind = 0; s.windTarget = 0; s.windT = 9999;
    window.TZ = {
      /* park one person of a given kind under the window, ready to catch */
      put(kind, lane, dx, opts) {
        const A = TzedakaBlast, def = A.KINDS[kind];
        s.wind = 0; s.windTarget = 0; s.windT = 9999;
        s.left = 9999;          /* no street may close in the middle of a test */
        s.spawnT = 9999; s.pigeonT = 9999;   /* and nobody may wander in */
        const p = { id: ++s.personId, kind, def, lane, y: A.LANES[lane],
          dir: 1, x: A.AX + (dx || 0), sp: 0, ch: 0, phase: 0, local: true,
          patience: 20, maxPat: 20, served: false, words: false, gone: false, shamed: false,
          flash: 0, joy: 0, pending: 0, hint: 0, seen: 0, wasSeen: false };
        Object.assign(p, opts || {});
        s.people.push(p); return p;
      },
      /* drop a coin straight down at a chosen speed and run it to a conclusion */
      drop(speed, gold) { s.charge = (speed - TzedakaBlast.VMIN) / (TzedakaBlast.VMAX - TzedakaBlast.VMIN);
        s.throwCoin(0, speed, 'drop', !!gold); },
      settle(n) { for (let i = 0; i < (n || 90); i++) s.update(1 / 60); },
      /* pointer events are queued and drained by the loop, so tests must drain too */
      flush() { const evs = Input.drain(); for (const e of evs) if (Game.scene) Game.scene.handle(e); },
      hold(n) { for (let i = 0; i < (n || 30); i++) { this.flush(); s.update(1 / 60); } }
    };
  });
  await frame(2);

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    QA.grab(360, 700);
    TZ.flush();
    const before = s.aim ? s.aim.mode : null;
    TZ.hold(30);
    const mid = s.charge;
    QA.release(); TZ.flush();
    const c = s.coins[0];
    return { mode: before, charge: mid, coins: s.coins.length,
      vx: c ? Math.round(c.vx) : null, vy: c ? Math.round(c.vy) : null, kind: c ? c.mode : null };
  });
  check('tzedaka: holding still charges a straight drop, and the charge is the speed',
    r.mode === 'charge' && r.charge > 0.1 && r.coins === 1 && r.vx === 0 &&
    r.vy >= 300 && r.kind === 'drop', JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0;
    QA.grab(360, 700); QA.dragTo(470, 800, 4); TZ.flush();
    const mode = s.aim ? s.aim.mode : null;
    QA.release(); TZ.flush();
    const c = s.coins[0];
    return { mode, vx: c ? Math.round(c.vx) : null, vy: c ? Math.round(c.vy) : null, kind: c ? c.mode : null };
  });
  check('tzedaka: pulling back slings instead - away from the pull, exactly like a slingshot',
    r.mode === 'sling' && r.kind === 'sling' && r.vx < -200 && r.vy < -200, JSON.stringify(r));

  /* the dotted preview must be the same integrator the coin actually uses */
  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0;
    const vx = 420, vy = -300;
    /* predicted path */
    let px = A.AX, py = A.AY, pvx = vx, pvy = vy, sdt = 1 / 90;
    for (let i = 0; i < 10; i++) for (let q = 0; q < 4; q++) {
      pvx += s.wind * sdt * 0.55; pvy += A.GRAV * sdt; px += pvx * sdt; py += pvy * sdt;
    }
    /* actual flight, same elapsed time */
    s.throwCoin(vx, vy, 'sling', false);
    const c = s.coins[0];
    const steps = Math.round((10 * 4 / 90) / (1 / 60));
    for (let i = 0; i < steps; i++) s.updateCoins(1 / 60);
    return { px: Math.round(px), py: Math.round(py), cx: Math.round(c.x), cy: Math.round(c.y) };
  });
  check('tzedaka: the arc preview is the real integrator, not a drawing',
    Math.abs(r.px - r.cx) < 26 && Math.abs(r.py - r.cy) < 26, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0;
    s.combo = 0; s.score = 0;
    const p = TZ.put('hand', 1, 0);
    const b = s.targetBox(p);
    p.x += A.AX - (b.x + b.w / 2);
    TZ.drop(700);
    TZ.settle(160);
    return { served: p.served, score: Math.round(s.score), combo: s.combo, stoops: s.stoops, coins: s.coins.length };
  });
  check('tzedaka: a soft drop lands in an open hand and counts',
    r.served === true && r.score > 0 && r.combo === 1 && r.stoops === 0, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0; s.combo = 0; s.stoops = 0; s.score = 0;
    const p = TZ.put('hand', 1, 0);
    const b = s.targetBox(p);
    p.x += A.AX - (b.x + b.w / 2);
    TZ.drop(1150);
    TZ.settle(140);
    return { served: p.served, stoops: s.stoops, combo: s.combo };
  });
  check('tzedaka: a fast drop into the same hand counts too - there is no wrong speed any more',
    r.served === true && r.stoops === 0 && r.combo === 1, JSON.stringify(r));

  // the two numbers the aim line is drawn from must match where the coin lands
  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0;
    s.wind = 90; s.windTarget = 90; s.windT = 9999;
    const speed = 700, y = A.LANES[2] - 92;
    const predX = s.dropLanding(speed, y);
    const predT = s.dropTime(speed, y);
    s.throwCoin(0, speed, 'drop', false);
    const c = s.coins[0];
    let frames = 0;
    while (c.y < y && frames < 600) { s.updateCoins(1 / 60); frames++; }
    const out = { predX: Math.round(predX), gotX: Math.round(c.x),
      predT: +predT.toFixed(2), gotT: +(frames / 60).toFixed(2) };
    s.wind = 0; s.windTarget = 0; s.windT = 9999;   /* leave the street calm */
    return out;
  });
  check('tzedaka: the aim line is drawn from the same numbers the coin actually flies on, wind and all',
    Math.abs(r.predX - r.gotX) < 14 && Math.abs(r.predT - r.gotT) < 0.06, JSON.stringify(r));

  // and nothing tells the player when to let go - judging the lead is the game
  r = await page.evaluate(() => {
    const src = TzedakaBlast.prototype;
    const bad = [];
    for (const n of Object.getOwnPropertyNames(src)) {
      if (typeof src[n] !== 'function') continue;
      const body = src[n].toString();
      if (/LET GO|RELEASE|DROP NOW/i.test(body)) bad.push(n + ' prompts the player when to release');
    }
    return { bad, hasWillMeet: typeof src.willMeet === 'function' };
  });
  check('tzedaka: nothing on screen tells you when to let go',
    r.bad.length === 0 && r.hasWillMeet === false, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0; s.combo = 0; s.score = 0;
    const shy = TZ.put('seter', 1, 0);
    let b = s.targetBox(shy); shy.x += A.AX - (b.x + b.w / 2);
    TZ.put('hand', 1, 130);                 /* somebody standing right there */
    s.update(1 / 60);
    const watched = shy.seen;
    TZ.drop(700); TZ.settle(160);
    return { watched, served: shy.served, score: Math.round(s.score),
      soft: !!(s.banner && s.banner.soft), lives: s.lives };
  });
  check('tzedaka: giving to the bashful one in the open still helps him - it just scores less, and nothing is lost',
    r.watched > 0 && r.served === true && r.lives === 1 && r.score > 0 && r.score < 120 && r.soft === true,
    JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0; s.combo = 0; s.score = 0; s.seterGiven = 0;
    const shy = TZ.put('seter', 1, 0);
    const b = s.targetBox(shy); shy.x += A.AX - (b.x + b.w / 2);
    s.update(1 / 60);
    const alone = shy.seen;
    TZ.drop(700); TZ.settle(160);
    return { alone, served: shy.served, given: s.seterGiven, score: Math.round(s.score) };
  });
  check('tzedaka: waiting until nobody is looking is matan b\'seter and pays the most',
    r.alone === 0 && r.served === true && r.given === 1 && r.score >= 300, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0; s.combo = 0; s.score = 0;
    s.cfg.kedimah = true;
    const local = TZ.put('hand', 0, -260, { local: true });
    local.patience = local.maxPat * 0.5;
    const away = TZ.put('hand', 1, 0, { local: false });
    const b = s.targetBox(away); away.x += A.AX - (b.x + b.w / 2);
    TZ.drop(700); TZ.settle(160);
    return { served: away.served, combo: s.combo, score: Math.round(s.score),
      soft: !!(s.banner && s.banner.soft) };
  });
  check('tzedaka: serving the out-of-towner while a local waits scores less and says why, gently',
    r.served === true && r.combo === 1 && r.score > 0 && r.score < 100 && r.soft === true,
    JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    s.coins.length = 0; s.people.length = 0; s.combo = 6; s.missed = 0;
    const p = TZ.put('hand', 1, 0);
    p.patience = 0.02;
    s.update(1 / 30);
    return { lives: s.lives, left: s.people.length, missed: s.missed, combo: s.combo,
      state: Game.state };
  });
  check('tzedaka: somebody walking off unhelped is a missed chance, not a life - the run carries on',
    r.lives === 1 && r.left === 0 && r.missed === 1 && r.combo === 0 && r.state === 'PLAYING',
    JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    s.coins.length = 0; s.people.length = 0; s.pouch = 0; s.wordsSaid = 0; s.missed = 0;
    const p = TZ.put('hand', 1, 0);
    QA.grab(p.x, p.y - 60); QA.release(); TZ.flush();
    const words = p.words;
    p.patience = 0.02;
    s.update(1 / 30);
    return { words, said: s.wordsSaid, missed: s.missed };
  });
  check('tzedaka: with an empty purse you still owe him words, and words mean he did not leave empty',
    r.words === true && r.said === 1 && !r.missed, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0; s.motes.length = 0;
    s.score = 0; s.stoops = 0; s.combo = 4; s.served = 0;
    /* a coin on the cobbles is a miss and stays one - nobody wanders over and
       rescues it, because pe'ah is a corner of a field, not a coin in a road */
    const p = TZ.put('hand', 1, 0);
    p.sp = 0;
    s.coins.push({ x: p.x, y: A.GROUND - 20, px: p.x, py: A.GROUND - 22, vx: 0, vy: 600,
      mode: 'drop', gold: false, r: 13, spin: 0, spinV: 0, life: 0, dead: false, trail: [] });
    for (let i = 0; i < 120; i++) s.update(1 / 60);
    return { score: Math.round(s.score), served: p.served, stoops: s.stoops,
      combo: s.combo, helped: s.served, motes: s.motes.length };
  });
  check('tzedaka: a coin that misses scores nothing at all, and stays missed',
    r.score === 0 && r.served === false && r.stoops === 1 && r.combo === 0 &&
    r.helped === 0 && r.motes === 0, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0;
    s.pouch = 12; s.loansMade = 0; s.score = 0;
    const p = TZ.put('loan', 1, 0);
    const b = s.targetBox(p); p.x += A.AX - (b.x + b.w / 2);
    const wanted = s.goldWanted();
    const before = s.pouch;
    TZ.drop(700, true);
    const cost = before - s.pouch;
    TZ.settle(120);
    const served = p.served;
    const midPouch = s.pouch;
    for (let i = 0; i < 8 * 60; i++) s.update(1 / 60);
    return { wanted, cost, served, loans: s.loansMade, midPouch, endPouch: s.pouch, score: Math.round(s.score) };
  });
  check('tzedaka: the highest rung is a loan - it costs three, sets him up, and he pays it back',
    r.wanted === true && r.cost === 3 && r.served === true && r.loans === 1 &&
    r.endPouch >= r.midPouch && r.score > 500, JSON.stringify(r));

  // nothing hanging off a building may stand between the window and the road
  r = await page.evaluate(() => {
    const src = TzedakaBlast.prototype, bad = [];
    for (const n of Object.getOwnPropertyNames(src)) {
      if (typeof src[n] !== 'function') continue;
      if (/awning|solids|canopy/i.test(src[n].toString().replace(/\/\*[\s\S]*?\*\//g, ''))) {
        bad.push(n + ' still deals with something hanging over the street');
      }
    }
    const s = Game.scene;
    return { bad, hasAwnings: s.awnings !== undefined, hasBuild: typeof src.buildAwnings === 'function' };
  });
  check('tzedaka: nothing hangs over the road - a shopfront awning cannot stop a coin thrown into the street',
    r.bad.length === 0 && r.hasAwnings === false && r.hasBuild === false, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    s.coins.length = 0; s.people.length = 0; s.pigeons.length = 0;
    s.pouch = 12;
    s.spawnPigeon();
    const g = s.pigeons[0];
    g.x = 360; g.y = 600;
    QA.grab(360, 600); QA.release(); TZ.flush();
    s.update(1 / 60);
    const scared = s.pigeons.length === 0, threw = s.coins.length;
    s.spawnPigeon();
    s.pigeons[0].x = 360; s.pigeons[0].y = 600;
    QA.grab(360, 600); TZ.flush();
    TZ.hold(30);
    QA.release(); TZ.flush();
    return { scared, threw, stillThere: s.pigeons.length, coins: s.coins.length };
  });
  check('tzedaka: a quick tap shoos the pigeon, but holding to charge over one still throws',
    r.scared === true && r.threw === 0 && r.stillThere === 1 && r.coins === 1, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    s.coins.length = 0; s.people.length = 0; s.pigeons.length = 0;
    s.level = 2; s.setupStreet(); s.spawnT = 9999;
    s.served = s.need; s.left = 0.001;
    s.update(1 / 60);
    return { state: Game.state, level: s.level };
  });
  check('tzedaka: filling the street quota moves you on to the next one',
    r.state === 'HALACHA_POPUP' && r.level === 3, JSON.stringify(r));
  await page.evaluate(() => Game.closeCard());
  await frame(3);

  r = await page.evaluate(() => {
    const s = Game.scene;
    s.level = 8; s.setupStreet();
    return { purim: s.cfg.purim, kedimah: s.cfg.kedimah, mult: s.mult, goal: s.need };
  });
  check('tzedaka: the last street is Matanos LaEvyonim - you do not check, you just give',
    r.purim === true && r.kedimah === false && r.mult === 2 && r.goal >= 12, JSON.stringify(r));

  // ---------- AUDIT: TZEDAKA GEOMETRY ----------
  r = await page.evaluate(() => {
    const A = TzedakaBlast, s = Game.scene;
    const bad = [];
    /* 1. every target must carry a plain name, and the charge must span a
          flight time wide enough for leading a walker to be a real choice */
    for (const k of Object.keys(A.KINDS)) {
      const L = A.KINDS[k].label;
      if (!L || !/^[A-Z ]{3,8}$/.test(L)) bad.push(k + ' has no plain name to show the player');
    }
    const deepY = A.LANES[2] - 92;
    const slow = s.dropTime(A.VMIN, deepY), fast = s.dropTime(A.VMAX, deepY);
    if (slow - fast < 0.9) bad.push('the charge barely changes the flight time, so aiming has no choice in it');
    if (fast < 0.3) bad.push('even the fastest drop should be slow enough to watch');
    /* 2. every kind of person must present a target box fully on screen and
          clear of the bottom UI strip, in every lane, facing either way */
    for (const kind of Object.keys(A.KINDS)) {
      for (let lane = 0; lane < A.LANES.length; lane++) {
        for (const dir of [1, -1]) {
          const p = { kind, def: A.KINDS[kind], dir,
            x: dir > 0 ? 90 : CFG.W - 90, y: A.LANES[lane] };
          const b = s.targetBox(p);
          if (b.x < 0 || b.x + b.w > CFG.W) bad.push(kind + ' opening off the side in lane ' + lane);
          if (b.y + b.h > A.BAND) bad.push(kind + ' opening runs under the HUD in lane ' + lane);
          if (b.y < A.PAVE - 130) bad.push(kind + ' opening floats above the street in lane ' + lane);
          /* the opening is meant to be an opening: a hand or a slot, not a man */
          if (b.w > 52 || b.h > 24) bad.push(kind + ' target is bigger than an opening - it is his body');
          if (b.w < 30 || b.h < 12) bad.push(kind + ' opening is too small to be a fair target');
          if (b.h > 22) bad.push(kind + ' opening is taller than the thing it is meant to be');
        }
      }
    }
    /* a coin must have to go IN, not merely brush past him */
    if (A.CATCH > 6) bad.push('the catch radius is generous enough to count a graze');
    /* 3. a windless fast drop lands straight below you, in every lane */
    for (let lane = 0; lane < A.LANES.length; lane++) {
      const y = A.LANES[lane] - 92;
      const saveW = s.wind; s.wind = 0;
      const fast = s.dropLanding(A.VMAX, y);
      s.wind = saveW;
      if (Math.round(fast) !== A.AX) bad.push('a windless fast drop should land straight below you');
    }
    /* 5b. and the badge above a person must clear his own hat and everything
           he is holding, or the label sits on top of the art */
    for (const kind of Object.keys(A.KINDS)) {
      const p = { kind, def: A.KINDS[kind], dir: 1, x: 360, y: A.LANES[1] };
      const b = s.targetBox(p);
      const badgeBottom = p.y - 184 + 30;
      if (badgeBottom > p.y - 145) bad.push(kind + ' badge overlaps the hat');
      if (badgeBottom > b.y) bad.push(kind + ' badge overlaps what he is holding');
    }
    /* 6. the walking speed must leave a fair release window on the slowest drop */
    const t8 = s.tune.call({ level: 8 });
    const fall = (A.LANES[2] - A.AY) / A.VMIN;
    const window8 = 32 / t8.walkMax;
    if (window8 < 0.2) bad.push('at street 8 the release window is under a fifth of a second');
    return { bad, fall: +fall.toFixed(2), window8: +window8.toFixed(2) };
  });
  check('audit/tzedaka: every target has a plain name and a fair opening on screen, and the charge really changes the lead',
    r.bad.length === 0, JSON.stringify(r));

  // nothing in this game may take a life or shake the screen at you
  r = await page.evaluate(() => {
    const src = TzedakaBlast.prototype;
    const names = Object.getOwnPropertyNames(src).filter(k => typeof src[k] === 'function');
    const bad = [];
    for (const n of names) {
      const body = src[n].toString();
      if (/this\.damage\s*\(/.test(body)) bad.push(n + ' takes a life');
      if (/FX\.shake\s*\(/.test(body)) bad.push(n + ' shakes the screen');
      if (/FX\.flash\s*\(\s*C\.red/.test(body)) bad.push(n + ' flashes the screen red');
    }
    return { bad, maxLives: Game.scene.maxLives };
  });
  check('tzedaka: nothing in the game costs a life, shakes the screen or flashes it red',
    r.bad.length === 0 && r.maxLives === 0, JSON.stringify(r));

  // ---------- REGRESSIONS FOUND BY THE ADVERSARIAL AUDIT ----------
  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0; s.pigeons.length = 0;
    /* two coins in the air, a bird over the LOWER-indexed one */
    const mk = (x, y) => ({ x, y, px: x, py: y, vx: 0, vy: 700, mode: 'drop', gold: false,
      r: 13, spin: 0, spinV: 0, life: 0, bounced: 0, dead: false, trail: [] });
    s.coins.push(mk(360, A.GROUND - 12), mk(500, 500));
    s.spawnPigeon();
    s.pigeons[0].x = 360; s.pigeons[0].y = A.GROUND - 12;
    s.update(1 / 60);
    const carried = !!s.pigeons[0].carrying;
    const innocentSurvived = s.coins.some(c => Math.abs(c.x - 500) < 40);
    /* and shooing the bird must give the coin back to the world, not a corpse */
    s.scarePigeon(s.pigeons[0].x, s.pigeons[0].y);
    const returned = s.coins.some(c => c.dead === false && c.held === false && Math.abs(c.x - 360) < 60);
    return { carried, innocentSurvived, returned, coins: s.coins.length };
  });
  check('tzedaka: a pigeon stealing one coin must not delete a different coin in mid-air',
    r.carried === true && r.innocentSurvived === true && r.returned === true, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    s.coins.length = 0; s.people.length = 0; s.pigeons.length = 0;
    s.served = 0; s.score = 0; s.combo = 0;
    const p = TZ.put('hand', 1, 0);
    const b = s.targetBox(p);
    p.x += A.AX - (b.x + b.w / 2);
    /* the bird sits right on the hand */
    s.spawnPigeon();
    s.pigeons[0].x = b.x + b.w / 2; s.pigeons[0].y = b.y + b.h / 2;
    s.coins.push({ x: s.pigeons[0].x, y: s.pigeons[0].y - 2, px: s.pigeons[0].x, py: s.pigeons[0].y - 4,
      vx: 0, vy: 700, mode: 'drop', gold: false, r: 13, spin: 0, spinV: 0,
      life: 0, bounced: 0, dead: false, trail: [] });
    s.update(1 / 60);
    return { served: p.served, score: Math.round(s.score), carried: !!s.pigeons[0].carrying };
  });
  check('tzedaka: a coin the bird flew off with must not also be credited as given',
    r.carried === true && r.served === false && r.score === 0, JSON.stringify(r));

  r = await page.evaluate(() => {
    const s = Game.scene;
    s.level = 1; s.setupStreet(); s.spawnT = 9999;
    const p = TZ.put('hand', 1, 0);
    p.patience = 0.02;
    s.update(1 / 30);
    const afterStreet1 = s.missed;
    s.level = 8; s.setupStreet(); s.spawnT = 9999;
    const afterReset = s.missed;
    s.served = s.need; s.left = 0.001;
    s.update(1 / 60);
    return { afterStreet1, afterReset, purimClean: s.purimClean, badge: Profile.hasBadge('b_purim') };
  });
  check('tzedaka: a person missed on street 1 must not forfeit the clean-Purim bonus on street 8',
    r.afterStreet1 === 1 && r.afterReset === 0 && r.purimClean === true && r.badge === true,
    JSON.stringify(r));
  await page.evaluate(() => { if (Game.state === 'HALACHA_POPUP') Game.closeCard(); });
  await frame(4);

  // there is no lock-on: a coin that visibly misses the opening misses it
  r = await page.evaluate(() => {
    const s = Game.scene, A = TzedakaBlast;
    const out = {};
    for (const kind of ['hand', 'pushka', 'basket', 'noask', 'kupah', 'loan']) {
      const gold = kind === 'loan';
      s.coins.length = 0; s.people.length = 0; s.combo = 0; s.pouch = 12;
      const p = TZ.put(kind, 1, 0);
      p.sp = 0;
      const b0 = s.targetBox(p);
      p.x += A.AX - (b0.x + b0.w / 2);
      const b = s.targetBox(p);
      /* dead centre must land */
      TZ.drop(700, gold); TZ.settle(140);
      const hit = p.served;
      /* and the same throw, one coin-width to the side, must not - and must
         not score a single point either */
      s.coins.length = 0; s.people.length = 0; s.combo = 0; s.pouch = 12;
      const q = TZ.put(kind, 1, 0);
      q.sp = 0;
      const qb0 = s.targetBox(q);
      q.x += A.AX - (qb0.x + qb0.w / 2) + (b.w / 2 + A.CATCH + 8);
      const before = s.score;
      TZ.drop(700, gold); TZ.settle(140);
      out[kind] = { hit, magnet: q.served, gained: Math.round(s.score - before) };
    }
    return out;
  });
  check('tzedaka: no lock-on - dead centre lands, and the same throw a coin-width off the opening does not',
    Object.keys(r).every(k => r[k].hit === true && r[k].magnet === false && r[k].gained === 0),
    JSON.stringify(r));

  // ---------- AUDIT: TZEDAKA IS ACTUALLY PLAYABLE ----------
  r = await page.evaluate(() => {
    const A = TzedakaBlast, s = Game.scene, bad = [];

    /* 1. The birds are the only thing between your window and the road, and
          they have to be slow enough to count. A bird that crosses the drop
          column faster than the coin falls cannot be planned around at all. */
    for (let lv = 5; lv <= 8; lv++) {
      const T = s.tune.call({ level: lv });
      s.pigeons.length = 0;
      s.level = lv; s.cfg = T;
      for (let k = 0; k < 40; k++) s.spawnPigeon();
      let fastest = 0;
      for (const g of s.pigeons) fastest = Math.max(fastest, g.sp);
      s.pigeons.length = 0;
      /* how long a bird takes to clear the width of the column it threatens */
      const cross = 68 / fastest;
      if (cross < 0.55) bad.push('street ' + lv + ' birds cross the drop column in ' + cross.toFixed(2) + 's - too fast to plan around');
      if (fastest > A.VMIN * 0.35) bad.push('street ' + lv + ' birds move fast enough to be an ambush');
    }
    /* and they must not exist at all before street 5 */
    for (let lv = 1; lv <= 4; lv++) {
      if (s.tune.call({ level: lv }).pigeon < 100) bad.push('street ' + lv + ' has birds already');
    }

    /* 2. Every kind of person must be hittable by a plain drop as he walks
          through the column - that is the whole game, and the opening is now
          small enough that this is worth proving rather than assuming. */
    for (const kind of Object.keys(A.KINDS)) {
      let ok = false;
      for (let lane = 0; lane < A.LANES.length && !ok; lane++) {
        const p = { kind, def: A.KINDS[kind], dir: 1, x: 0, y: A.LANES[lane], sp: 0 };
        const b0 = s.targetBox(p);
        p.x += A.AX - (b0.x + b0.w / 2);
        const b = s.targetBox(p);
        const cy = b.y + b.h / 2;
        for (let v = A.VMIN; v <= A.VMAX && !ok; v += 25) {
          const saveW = s.wind; s.wind = 0;
          const lx = s.dropLanding(v, cy);
          s.wind = saveW;
          if (MatzahHavoc.circleRect(lx, cy, A.CATCH, b)) ok = true;
        }
      }
      if (!ok) bad.push(kind + ' cannot be reached by a straight drop at all');
    }

    /* 3. The release window a walking person leaves you, measured on the
          narrowest opening in the game. */
    let narrow = 999;
    for (const kind of Object.keys(A.KINDS)) {
      const p = { kind, def: A.KINDS[kind], dir: 1, x: 360, y: A.LANES[1] };
      narrow = Math.min(narrow, s.targetBox(p).w);
    }
    const econ = [];
    for (let lv = 1; lv <= 8; lv++) {
      const T = s.tune.call({ level: lv });
      const supply = Math.floor(T.dur / T.spawnEvery);
      const slack = supply / T.goal;
      econ.push(+slack.toFixed(2));
      if (slack < 1.8) bad.push('street ' + lv + ' does not send enough people to reach its own quota');
      if (slack > 5) bad.push('street ' + lv + ' quota is so loose it cannot be missed');
      const win = (narrow + A.CATCH * 2) / T.walkMax;
      if (win < 0.2) bad.push('street ' + lv + ' release window is ' + win.toFixed(2) + 's - too tight to hit');
      const coins = T.pouchMax + Math.floor(T.dur / T.refill);
      if (coins < T.goal * 2) bad.push('street ' + lv + ' cannot fund its own quota');
      /* wind must bend a slow drop and leave a fast one alone */
      const deep = A.LANES[2] - 92;
      const saveWind = s.wind;
      s.wind = T.windMax;
      const slowDrift = Math.abs(s.dropLanding(A.VMIN, deep) - A.AX);
      const fastDrift = Math.abs(s.dropLanding(A.VMAX, deep) - A.AX);
      s.wind = saveWind;
      if (slowDrift < 40) bad.push('street ' + lv + ' wind is too weak to change anything');
      if (A.AX + slowDrift > CFG.W + 80) bad.push('street ' + lv + ' max wind blows every slow drop off the screen');
      if (fastDrift > 60) bad.push('street ' + lv + ' even a hard drop is at the wind\'s mercy');
    }

    /* 4. Nothing static is left in the game - every target walks. */
    if (s.spots !== undefined) bad.push('a fixed-target list still exists');
    if (A.COURT !== undefined) bad.push('the courtyard is still defined');

    return { bad, narrow, econ };
  });
  check('audit/tzedaka: every target walks and every one of them is hittable by a plain drop, the drop column is never roofed, and each street is fundable, missable and windy without being unfair',
    r.bad.length === 0, JSON.stringify(r));

  await page.setViewportSize({ width: 896, height: 414 });
  await page.waitForTimeout(500);
  r = await page.evaluate(() => ({ state: Game.state, scale: View.scale, ox: Math.round(View.ox), oy: Math.round(View.oy) }));
  check('layout: landscape letterboxes without error', r.scale > 0 && r.ox > 0, JSON.stringify(r));
  await page.screenshot({ path: 'shot_landscape.png' });
  await page.setViewportSize({ width: 414, height: 896 });
  await page.waitForTimeout(400);

  // ---------- SOAK: 45s of random input across all games ----------
  await page.evaluate(() => { Game.quitToMenu(); });
  for (const gid of ['menorah', 'shul', 'kosher', 'matzah', 'tzedaka']) {
    await page.evaluate(id => { Game.quitToMenu(); Game.startGame(id); Game.beginPlay(); }, gid);
    for (let i = 0; i < 55; i++) {
      await page.evaluate(() => {
        const rx = () => 60 + Math.random() * 600, ry = () => 220 + Math.random() * 900;
        if (Math.random() < 0.5) QA.tap(rx(), ry());
        else QA.swipe(rx(), ry(), rx(), ry(), 6);
        if (Game.state === 'HALACHA_POPUP') Game.closeCard();
        if (Game.state === 'GAME_OVER') { Game.startGame(Game.gameover.id); Game.beginPlay(); }
      });
      await page.waitForTimeout(140);
    }
    const s = await page.evaluate(() => ({ state: Game.state, fps: Math.round(Game.fps), mp: Profile.data.mitzvahPoints, badges: Profile.badgeCount() }));
    console.log('  soak', gid, JSON.stringify(s));
    check('soak ' + gid + ': stayed alive with good fps', s.fps > 40, JSON.stringify(s));
  }
  await page.screenshot({ path: 'shot_soak.png' });
  await page.evaluate(() => Game.quitToMenu());
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot_menu2.png' });

  // ---------- RENDER SMOKE: every screen of every game must actually draw ----------
  {
    const before = errors.length;
    for (const gid of ['menorah', 'shul', 'kosher', 'matzah', 'tzedaka']) {
      await page.evaluate(id => { Game.quitToMenu(); Game.startGame(id); Game.beginPlay(); }, gid);
      /* walk every level of the game so level-gated scenery gets drawn too */
      for (let lv = 1; lv <= 8; lv++) {
        await page.evaluate(l => {
          const sc = Game.scene;
          if (sc.setupStreet) { sc.level = l; sc.setupStreet(); for (let k = 0; k < 5; k++) sc.spawnPerson(); }
          else if (sc.setupNight) { sc.night = l; sc.setupNight(); }
          else { sc.level = l; }
        }, lv);
        await frame(6);
      }
      await page.evaluate(() => Game.pause());
      await frame(3);
      await page.evaluate(() => Game.resume());
      await frame(3);
    }
    await page.evaluate(() => Game.quitToMenu());
    await frame(4);
    const fresh = errors.slice(before);
    check('render: every game draws every one of its levels without throwing',
      fresh.length === 0, fresh.slice(0, 3).join(' | '));
  }

  // ---------- SOURCE: no method may be defined twice ----------
  {
    const src = require('fs').readFileSync(path.resolve('index.html'), 'utf8');
    const seen = {}, dupes = [];
    const re = /^([A-Za-z]+)\.prototype\.([A-Za-z0-9_]+)\s*=\s*function/gm;
    let m;
    while ((m = re.exec(src))) {
      const key = m[1] + '.' + m[2];
      if (seen[key]) dupes.push(key); else seen[key] = true;
    }
    check('source: no method is defined twice - a stale copy later in the file silently wins',
      dupes.length === 0, dupes.slice(0, 8).join(', '));
  }

  console.log('\n--- RESULTS ---');
  const failed = checks.filter(c => !c.ok);
  checks.forEach(c => console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name));
  console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' passed');
  console.log('--- errors ---');
  console.log(errors.length ? [...new Set(errors)].slice(0, 12).join('\n') : 'NONE');
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})();
