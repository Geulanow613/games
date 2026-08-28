/* Builds www/ - the exact set of files that ships inside the iOS and Android
   app, and the exact set you upload for the web build. Nothing else from this
   folder (tests, screenshots, tools) goes near a phone.
   node kosher-chain/pack.js                                                */
const path = require('path');
const fs = require('fs');

const SRC = __dirname;
const WWW = path.join(SRC, 'www');
const SHIP = ['index.html', 'manifest.webmanifest', 'sw.js', 'icons'];

function copy(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copy(path.join(from, name), path.join(to, name));
  } else {
    fs.copyFileSync(from, to);
  }
}
function bytes(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((n, f) => n + bytes(path.join(p, f)), 0);
}

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

let total = 0;
for (const item of SHIP) {
  const from = path.join(SRC, item);
  if (!fs.existsSync(from)) {
    console.error('missing: ' + item + (item === 'icons' ? '  (run: node kosher-chain/icons.js)' : ''));
    process.exit(1);
  }
  copy(from, path.join(WWW, item));
  const n = bytes(from);
  total += n;
  console.log('  ' + item.padEnd(22) + (n / 1024).toFixed(0) + ' KB');
}
console.log('\nwww/ ready - ' + (total / 1024).toFixed(0) + ' KB, no network needed at runtime');
