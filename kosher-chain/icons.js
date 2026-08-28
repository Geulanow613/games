/* Home-screen icons, painted with the game's own food art so the tile on the
   phone matches the title screen. Re-run after changing the art.
   node kosher-chain/icons.js                                               */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'icons');

/* name, pixels, how much of the tile the art may use (maskable icons must
   keep everything important inside the middle 80%) */
const JOBS = [
  ['icon-192.png', 192, 0.86, true],
  ['icon-512.png', 512, 0.86, true],
  ['icon-maskable-512.png', 512, 0.64, false],
  ['apple-touch-icon.png', 180, 0.86, false]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR: ' + e));
  await page.goto(FILE);
  await page.waitForFunction(() => window.KC && window.KC.ready);

  for (const [name, px, art, rounded] of JOBS) {
    const b64 = await page.evaluate(([px, art, rounded]) => {
      const K = window.KC, P = K.PAL;
      const cv = document.createElement('canvas');
      cv.width = cv.height = px;
      const c = cv.getContext('2d');

      /* the tile */
      if (rounded) {
        K.Draw.rr(c, 0, 0, px, px, px * 0.22);
        c.clip();
      }
      let g = c.createLinearGradient(0, 0, px, px);
      g.addColorStop(0, '#141d38');
      g.addColorStop(1, '#05070d');
      c.fillStyle = g;
      c.fillRect(0, 0, px, px);
      g = c.createRadialGradient(px * 0.5, px * 0.42, 0, px * 0.5, px * 0.42, px * 0.6);
      g.addColorStop(0, 'rgba(255,207,92,.20)');
      g.addColorStop(1, 'rgba(255,207,92,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, px, px);

      /* three foods on a gold cord, the shape of the whole game */
      const foods = ['Challah', 'Brisket', 'Carrot'].map(K.foodByName);
      const R = px * art * 0.34;
      const pts = [
        { x: px * 0.5 - R * 0.95, y: px * 0.5 - R * 0.58 },
        { x: px * 0.5 + R * 0.95, y: px * 0.5 - R * 0.58 },
        { x: px * 0.5, y: px * 0.5 + R * 0.82 }
      ];
      c.save();
      c.lineCap = c.lineJoin = 'round';
      c.strokeStyle = P.gold;
      c.shadowColor = P.gold; c.shadowBlur = px * 0.06;
      c.globalAlpha = 0.65;
      c.lineWidth = px * 0.075;
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
      c.closePath();
      c.stroke();
      c.shadowBlur = 0;
      c.globalAlpha = 1;
      c.lineWidth = px * 0.028;
      c.stroke();
      c.restore();

      const size = px * art * 0.33;
      for (let i = 0; i < foods.length; i++) {
        c.save();
        c.translate(pts[i].x, pts[i].y);
        /* a dark disc so the food reads against the cord */
        c.fillStyle = 'rgba(6,10,20,.92)';
        c.beginPath(); c.arc(0, 0, size * 0.56, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.22)';
        c.lineWidth = px * 0.012;
        c.stroke();
        c.scale(size / 100, size / 100);
        K.paintFood(c, foods[i], 0, 0, 100, 7 + i * 977);
        c.restore();
      }
      return cv.toDataURL('image/png').split(',')[1];
    }, [px, art, rounded]);
    fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64'));
    console.log('  icons/' + name);
  }

  await browser.close();
})();
