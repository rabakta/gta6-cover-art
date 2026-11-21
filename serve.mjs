// serve.mjs — a tiny static server for the app/ folder (Node 22, stdlib
// only), so the entry can be tried locally without a build step:
//   node serve.mjs            (serves app/ on http://localhost:8090)
//   node serve.mjs --port 8080
// It sends the MIME types an offline web app needs and refuses any path
// outside app/. Development convenience only, not a server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8090 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8090;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  const file = join(root, rel === '' ? 'index.html' : rel);
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403); res.end('forbidden');
    return;
  }
  let st;
  try {
    st = statSync(file);
  } catch {
    res.writeHead(404); res.end('not found');
    return;
  }
  if (!st.isFile()) {
    res.writeHead(404); res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`serving app/ at http://localhost:${port}`);
});
