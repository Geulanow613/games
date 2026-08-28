/* A local server with no dependencies, so the game can be opened on a real
   phone over wifi. Prints the address to type into the phone's browser.
   node kosher-chain/serve.js [port]                                        */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not here');
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-cache'
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  const nets = os.networkInterfaces();
  const lan = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
    }
  }
  console.log('\n  on this computer   http://localhost:' + PORT);
  lan.forEach(ip => console.log('  on your phone      http://' + ip + ':' + PORT));
  console.log('\n  Same wifi. Over plain http the offline cache stays off, which is');
  console.log('  fine for testing - the game itself needs no network either way.');
  console.log('\n  ctrl-c to stop\n');
});
