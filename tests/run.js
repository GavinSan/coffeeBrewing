// Checks syntax, serves the app on a free port, then runs every *.test.js in a real browser (Chromium).
// Exits non-zero if anything fails, so CI blocks the merge and the deploy.
//   npm test                 all tests
//   npm test -- gear.test.js one file
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const run = (args, env) => new Promise((resolve) => spawn(process.execPath, args, { stdio: 'inherit', env: Object.assign({}, process.env, env) }).on('exit', resolve));

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep) || /[\\/](node_modules|\.git)[\\/]/.test(file)) { res.writeHead(404); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

server.listen(0, '127.0.0.1', async () => {
  const failed = [];
  for (const f of ['app.js', 'sync.js', 'sw.js', 'config.js']) if (await run(['--check', path.join(ROOT, f)]) !== 0) failed.push('syntax: ' + f);
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
  const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
  for (const f of files) {
    console.log('\n▶ ' + f);
    const t = Date.now();
    const code = await run([path.join(__dirname, path.basename(f))], { BASE: base });
    console.log((code === 0 ? '✓ ' : '✗ ') + f + ' (' + Math.round((Date.now() - t) / 1000) + ' s)');
    if (code !== 0) failed.push(f);
  }
  server.close();
  console.log(failed.length ? '\nFailed: ' + failed.join(', ') : '\nAll tests passed');
  process.exit(failed.length ? 1 : 0);
});
