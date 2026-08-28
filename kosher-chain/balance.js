/* ===========================================================================
   Difficulty probe.

   Plays every table many times with a greedy player: on each move it searches
   for the chain that best serves whatever the diners are still waiting for,
   then serves it. It reports how often that player wins and with how many
   moves to spare, which is what tells us whether a table is beatable at all
   and whether it is worth playing.

   The player also takes time to think, because the simcha bar drains on the
   wall clock. THINK is how many seconds it spends per plate: 3.2s is a player
   who knows the game, 6s is a child hunting for the chain.

   node kosher-chain/balance.js [runsPerLevel] [thinkSeconds]
   =========================================================================== */
const path = require('path');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const RUNS = parseInt(process.argv[2] || '60', 10);
const THINK = parseFloat(process.argv[3] || '3.2');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR: ' + e));
  await page.goto(FILE);
  await page.waitForFunction(() => window.KC && window.KC.Game.screen);

  const rows = await page.evaluate(async (opts) => {
    const { RUNS, THINK } = opts;
    const K = window.KC;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    /* this player has read the rule cards already, so none of them pop up */
    for (const key in K.TEACH) K.Progress.seenTeach[key] = true;

    /* Time really passing at the table: the plate the player just found took
       him a few seconds to find, and the boys were hungry for all of them. */
    const think = (play, secs) => {
      for (let f = 0; f < 12; f++) play.update(1 / 60);
      for (let s = 0; s < Math.round(secs * 5); s++) play.update(0.2);
    };

    /* the smallest loop is a 2x2 block walked round; find one that is legal */
    function findLoop(play) {
      const b = play.board;
      const wantsLoop = play.orders.some(o => o.kind === 'loop' && o.got < o.need);
      if (!wantsLoop) return null;
      for (let gy = 0; gy < b.rows - 1; gy++) {
        for (let gx = 0; gx < b.cols - 1; gx++) {
          const ring = [[gx, gy], [gx + 1, gy], [gx + 1, gy + 1], [gx, gy + 1]]
            .map(c => b.get(c[0], c[1]));
          if (ring.some(t => !t)) continue;
          let plate = K.emptyPlate(), fine = true;
          for (const t of ring) {
            const save = play.plate;
            play.plate = plate;
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

    /* every legal chain from a start, up to maxLen, scored by usefulness */
    function bestChain(play, maxLen) {
      const b = play.board;
      const wants = {};
      for (const o of play.orders) if (o.got < o.need) wants[o.kind] = (o.need - o.got);
      let best = null;

      const consider = (path, plate) => {
        if (path.length < 3) return;
        const side = K.plateSide(plate);
        /* the kitchen may refuse this plate even though the halacha allows it */
        if (side === 'dairy' && (play.waitLeft > 0 || play.mealSide === 'meat')) return;
        if (side === 'meat' && play.needRinse) return;
        if (side === 'fish' && play.needFishDrink) return;
        let value = path.length;
        /* an order only fills on how much of its food is actually on the
           plate, not on whichever side the plate counts as halachically -
           a chain with one incidental cheese among four fish still owes
           the fish order, not the milchig one */
        for (const k of ['meat', 'dairy', 'fish', 'pareve']) {
          if (wants[k] && plate[k] >= 3) value += 40;
        }
        if (wants.big && path.length >= 6) value += 40;
        if (wants.pareve && side === 'pareve') value += 20;
        /* the kinuach is worth something even with no pareve order */
        if (play.needPareve && side === 'pareve') value += 25;
        /* hungry boys need feeding, and a longer plate feeds more of them */
        if (play.simcha < 45) value += path.length * 4;
        /* a thinking player batches one side at a time rather than flipping
           between meat and dairy and paying the wait over and over */
        if (side === play.__lastSide) value += 22;
        if (side === 'meat' && play.waitMoves === 0 && wants.dairy) value -= 12;
        if (!best || value > best.value) best = { value, path: path.slice() };
      };

      const walk = (path, plate) => {
        consider(path, plate);
        if (path.length >= maxLen) return;
        const last = path[path.length - 1];
        for (const d of DIRS) {
          const nx = last.gx + d[0], ny = last.gy + d[1];
          if (path.some(p => p.gx === nx && p.gy === ny)) continue;
          const t = b.get(nx, ny);
          if (!t) continue;
          const save = play.plate;
          play.plate = plate;
          const okJoin = play.canJoin(t).ok;
          play.plate = save;
          if (!okJoin) continue;
          const np = K.emptyPlate();
          for (const k in plate) np[k] = plate[k];
          K.addToPlate(np, t.f);
          path.push(t);
          walk(path, np);
          path.pop();
        }
      };

      for (const t of b.cells) {
        if (!t) continue;
        const save = play.plate;
        play.plate = K.emptyPlate();
        const okStart = play.canJoin(t).ok;
        play.plate = save;
        if (!okStart) continue;
        walk([t], K.addToPlate(K.emptyPlate(), t.f));
      }
      return best;
    }

    const out = [];
    for (let li = 0; li < K.LEVELS.length; li++) {
      let wins = 0, sumLeft = 0, sumScore = 0, sumMoves = 0, binned = 0, refusals = 0;
      let starved = 0, sumSimcha = 0, drain = 0, movesSum = 0;
      const nusachs = ['ashkenaz', 'sefard', 'mizrach', 'chabad'];
      for (let r = 0; r < RUNS; r++) {
        K.Nusach.set(nusachs[r % 4]);
        const play = new K.Play(li);
        movesSum += play.totalMoves;
        play.relayout();
        K.Game.go(play);
        drain = play.drain;

        let guard = 0;
        while (!play.over && guard++ < 400) {
          /* free actions first: wash, drink, bentch, bin the treif, lift lids */
          if (play.needDrink || play.needFishDrink ||
              play.needFishRinse || play.needDairyRinse) play.doRinse();
          if (play.needWash || !play.washed) play.doWash();
          /* milchig on the list and a fleishig meal on the table: once the
             hours are up, end the meal */
          const wantsDairy = play.orders.some(o => o.kind === 'dairy' && o.got < o.need);
          if (play.mealSide === 'meat' && play.mealAte > 0 &&
              play.waitLeft === 0 && wantsDairy) {
            play.doBentch();
          }
          let acted = false;
          for (const t of play.board.cells) {
            if (t && play.board.binnable(t)) {
              const need = play.orders.some(o => o.kind === 'treif' && o.got < o.need);
              /* bin it if an order wants it, or if it is simply in the way */
              if (need || Math.random() < 0.5) { play.bin(t); binned++; acted = true; break; }
            }
          }
          if (acted) { think(play, 0.7); continue; }
          for (const t of play.board.cells) {
            if (t && t.covered) { play.liftLid(t); acted = true; break; }
          }
          if (acted) { think(play, 0.5); continue; }

          const ring = findLoop(play);
          if (ring) {
            play.cancelChain();
            play.startChain(ring[0]);
            for (let i = 1; i < ring.length; i++) play.pushChain(ring[i]);
            play.loop = true;
            play.loopSide = K.plateSide(play.plate);
            play.serve();
            think(play, THINK);
            continue;
          }

          let pick = bestChain(play, 7);
          /* nothing to serve at this meal? bentch and look again */
          if (!pick && play.mealAte > 0) {
            play.doBentch();
            pick = bestChain(play, 7);
          }
          if (!pick) { refusals++; break; }
          play.cancelChain();
          play.startChain(pick.path[0]);
          for (let i = 1; i < pick.path.length; i++) play.pushChain(pick.path[i]);
          play.__lastSide = K.plateSide(play.plate);
          play.serve();
          think(play, THINK);
        }

        if (play.over === 'win') { wins++; sumLeft += play.moves; }
        if (play.over === 'lose' && play.overWhy === 'simcha') starved++;
        sumSimcha += play.simcha;
        sumScore += play.score;
        sumMoves += play.totalMoves - play.moves;
      }
      out.push({
        table: li + 1,
        winPct: Math.round(100 * wins / RUNS),
        avgLeft: wins ? +(sumLeft / wins).toFixed(1) : 0,
        movesGiven: +(movesSum / RUNS).toFixed(1),
        avgUsed: +(sumMoves / RUNS).toFixed(1),
        avgScore: Math.round(sumScore / RUNS),
        drain: +drain.toFixed(2),
        simcha: Math.round(sumSimcha / RUNS),
        starved: Math.round(100 * starved / RUNS),
        stuck: refusals
      });
    }
    return out;
  }, { RUNS, THINK });

  console.log('\nTable  moves  used   win%   spare  score   drain  simcha  sad%  stuck');
  for (const r of rows) {
    console.log(
      String(r.table).padStart(4) +
      String(r.movesGiven).padStart(7) +
      String(r.avgUsed).padStart(7) +
      String(r.winPct).padStart(7) +
      String(r.avgLeft).padStart(7) +
      String(r.avgScore).padStart(8) +
      String(r.drain).padStart(8) +
      String(r.simcha).padStart(8) +
      String(r.starved).padStart(6) +
      String(r.stuck).padStart(7)
    );
  }
  console.log('\n' + RUNS + ' runs per table, cycling all four nusachs, ' +
    THINK + 's of thinking per plate.');
  console.log('A good curve: early tables near 100%, later ones 40-80%,');
  console.log('spare moves small, stuck always 0, and sad% low for a player');
  console.log('at this pace but climbing on the late weeks.');

  await browser.close();
})();
