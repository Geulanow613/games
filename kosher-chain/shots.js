/* Screenshots of every screen, on a phone, in both languages.
   node kosher-chain/shots.js  [he]                                        */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'shots');
const LANG = process.argv[2] === 'he' ? 'he' : 'en';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR: ' + e));
  await page.addInitScript(lang => {
    if (lang === 'he') window.KC_LANG = 'he';
    try { localStorage.clear(); } catch (e) {}
  }, LANG);
  await page.goto(FILE);
  await page.waitForFunction(() => window.KC && window.KC.Game.screen);
  /* the rule cards flash the first time a rule refuses a plate, and these
     shots refuse plates on purpose. Read them all first. */
  await page.evaluate(() => {
    for (const k in window.KC.TEACH) window.KC.Progress.seenTeach[k] = true;
  });

  const suffix = LANG === 'he' ? '_he' : '';
  const shot = async (name) => {
    await page.waitForTimeout(420);
    await page.screenshot({ path: path.join(OUT, name + suffix + '.png') });
    console.log('  ' + name + suffix + '.png');
  };

  await shot('01_menu');

  await page.evaluate(() => window.KC.Game.go(new Story(function () {})));
  await shot('01b_story');
  await page.evaluate(() => { const s = window.KC.Game.screen; s.i = 2; s.build(); });
  await shot('01c_story');

  await page.evaluate(() => window.KC.Game.go(new NusachPick(function () {})));
  await shot('02_nusach');

  await page.evaluate(() => { window.KC.Progress.unlocked = 6; window.KC.Progress.stars = { 0: 3, 1: 2, 2: 1 }; });
  await page.evaluate(() => window.KC.Game.go(new LevelSelect()));
  await shot('03_tables');

  await page.evaluate(() => window.KC.Game.go(new Teach('nusach', function () {})));
  await shot('04_teach');

  await page.evaluate(() => window.KC.Game.go(new Help()));
  await shot('05_help');

  /* a real board mid-chain */
  await page.evaluate(() => {
    const p = new Play(7); p.relayout();
    window.KC.Game.go(p); window.__play = p;
    const b = p.board;
    const names = ['Salmon', 'Apple', 'Cheese', 'Yogurt', 'Challah'];
    const cells = [[2, 3], [3, 3], [3, 4], [2, 4], [2, 5]];
    cells.forEach((c, i) => {
      const t = b.get(c[0], c[1]);
      t.f = window.KC.foodByName(names[i]); t.covered = false;
    });
    p.startChain(b.get(2, 3));
    for (let i = 1; i < cells.length; i++) p.pushChain(b.get(cells[i][0], cells[i][1]));
    const last = b.get(2, 5);
    p.finger = { x: last.px + 20, y: last.py + 60 };
  });
  await shot('06_play_chain');

  /* the refusal bubble */
  await page.evaluate(() => {
    const p = window.__play, b = p.board;
    const t = b.get(3, 5);
    t.f = window.KC.foodByName('Brisket');
    p.refuse('Meat and milk never share a plate', t);
  });
  await page.waitForTimeout(180);
  await shot('07_play_refused');

  /* the wait between courses */
  await page.evaluate(() => {
    const p = window.__play;
    p.cancelChain(); p.finger = null; p.reason = null;
    p.washed = true;
    p.waitLeft = 360; p.syncGates();
    p.moves = 3;
    const b = p.board;
    for (const c of b.cells) if (c) c.covered = false;
    b.get(1, 2).covered = true; b.get(4, 5).covered = true;
  });
  await shot('08_play_waiting');

  /* the three things owed after a milchig plate */
  await page.evaluate(() => {
    const p = window.__play;
    p.waitLeft = 0;
    p.needWash = false; p.needDrink = true; p.needPareve = true;
    p.washed = true;
    p.syncGates();
    p.moves = 11;
    p.simcha = 34;
    Kids.order(p, 'drink', {});
  });
  await shot('09_play_rinse');

  /* the boys at the sink */
  await page.evaluate(() => {
    const p = window.__play;
    p.needWash = true; p.washed = false; p.syncGates();
    Kids.order(p, 'wash', {});
  });
  await page.waitForTimeout(900);
  await shot('09b_play_wash');

  /* a fleishig meal that has to end before any milchig can go out */
  await page.evaluate(() => {
    const p = window.__play;
    p.needWash = false; p.needDrink = false; p.needPareve = false;
    p.washed = true; p.mealSide = 'meat'; p.mealAte = 3; p.waitLeft = 0;
    p.clock = 13 * 60 + 30; p.simcha = 64;
    p.syncGates();
    Kids.order(p, 'bentch', {});
  });
  await page.waitForTimeout(600);
  await shot('09c_play_bentch');

  /* the boys with the simcha nearly gone - the faces are the warning */
  await page.evaluate(() => {
    const p = window.__play;
    p.mealSide = null; p.mealAte = 0; p.needWash = false; p.needDrink = false;
    p.needPareve = false; p.needFishDrink = false; p.washed = true; p.syncGates();
    p.simcha = 14; p.moves = 6;
    p.kids.forEach(k => { k.state = 'idle'; k.st = 0; });
  });
  await page.waitForTimeout(700);
  await shot('09d_play_sad');

  /* the card that explains a refusal, source and all */
  await page.evaluate(() => {
    window.KC.Game.go(new Teach('fishmeat', function () {}));
  });
  await shot('09e_teach_fishmeat');
  await page.evaluate(() => {
    window.KC.Game.go(new Teach('meatmilk', function () {}));
  });
  await shot('09f_teach_meatmilk');
  await page.evaluate(() => {
    window.KC.Game.go(new Teach('fishdairy', function () {}));
  });
  await shot('09g_teach_fishdairy');
  await page.evaluate(() => window.KC.Game.go(window.__play));

  /* fish riding with dairy - Ashkenaz, so it fills both orders at once */
  await page.evaluate(() => {
    const p = window.__play, b = p.board;
    window.KC.Nusach.set('ashkenaz');
    p.cancelChain(); p.finger = null; p.reason = null;
    p.needWash = false; p.needDrink = false; p.needPareve = false;
    p.needFishDrink = false; p.washed = true; p.mealSide = null; p.mealAte = 0;
    p.waitLeft = 0; p.simcha = 60; p.syncGates();
    const names = ['Salmon', 'Cheese', 'Salmon'];
    const cells = [[2, 3], [3, 3], [3, 4]];
    cells.forEach((c, i) => {
      const t = b.get(c[0], c[1]);
      t.f = window.KC.foodByName(names[i]); t.covered = false;
    });
    p.startChain(b.get(2, 3));
    for (let i = 1; i < cells.length; i++) p.pushChain(b.get(cells[i][0], cells[i][1]));
    p.serve();
  });
  await page.waitForTimeout(160);
  await shot('09h_play_dual');

  /* a loop about to sweep */
  await page.evaluate(() => {
    const p = window.__play, b = p.board;
    p.needRinse = false; p.needWash = false; p.needDrink = false;
    p.needPareve = false; p.washed = true; p.simcha = 72;
    const cells = [[2, 3], [3, 3], [3, 4], [2, 4]];
    cells.forEach(c => { const t = b.get(c[0], c[1]); t.f = window.KC.foodByName('Apple'); });
    p.startChain(b.get(2, 3));
    for (let i = 1; i < cells.length; i++) p.pushChain(b.get(cells[i][0], cells[i][1]));
    p.loop = true; p.loopSide = 'pareve';
    p.finger = { x: b.get(2, 3).px, y: b.get(2, 3).py };
  });
  await shot('10_play_loop');

  await page.evaluate(() => window.KC.Game.go(new Pause(window.__play)));
  await shot('11_pause');

  await page.evaluate(() => {
    const p = window.__play;
    p.cancelChain(); p.finger = null;
    p.score = 4820; p.moves = 9;
    p.orders.forEach(o => { o.got = o.need; });
    p.over = 'win';
    window.KC.Game.go(new Result(p));
  });
  await page.waitForTimeout(900);
  await shot('12_win');

  await page.evaluate(() => {
    const p = window.__play;
    p.moves = 0; p.score = 1240;
    p.orders.forEach((o, i) => { o.got = i === 0 ? 1 : 0; });
    p.over = 'lose'; p.overWhy = 'moves';
    window.KC.Game.go(new Result(p));
  });
  await page.waitForTimeout(900);
  await shot('13_lose');

  await page.evaluate(() => {
    const p = window.__play;
    p.simcha = 0; p.moves = 5; p.score = 980;
    p.over = 'lose'; p.overWhy = 'simcha';
    window.KC.Game.go(new Result(p));
  });
  await page.waitForTimeout(900);
  await shot('13b_lose_simcha');

  /* a later week, so the hall and the boys are not week one */
  await page.evaluate(() => {
    const p = new Play(16); p.relayout();
    p.washed = true; p.syncGates();
    p.simcha = 88;
    window.KC.Game.go(p); window.__play = p;
    Kids.order(p, 'eat', { big: true });
  });
  await page.waitForTimeout(500);
  await shot('14_week6');

  await browser.close();
  console.log('\nwrote to ' + OUT);
})();
