// take-shots.mjs — takes the entry's 4 screenshots with Playwright's
// bundled Chromium (Node 22, stdlib only besides the playwright CLI).
// Reads shots.json, serves app/ on a local port, loads each shot URL,
// waits for the app to finish rendering (window.__coverReady), and saves a
// JPEG per shot into screenshots/. Any screenshot over the 256 KiB cap is
// re-encoded at a lower JPEG quality until it fits.
//   node take-shots.mjs
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const PORT = 8091;
const MAX_BYTES = 262144;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('server did not come up: ' + url);
}

function reencodeJpeg(path, quality) {
  const oneLiner = [
    'from PIL import Image',
    `im = Image.open(${JSON.stringify(path)}).convert('RGB')`,
    `im.save(${JSON.stringify(path)}, 'JPEG', quality=${quality})`,
  ].join('; ');
  execSync(`python3 -c ${JSON.stringify(oneLiner)}`, { stdio: 'inherit' });
}

const server = spawn(process.execPath, [join(here, 'serve.mjs'), '--port', String(PORT)], { stdio: 'inherit' });
try {
  await waitForServer(`http://localhost:${PORT}/index.html`);
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  for (const shot of shots) {
    const url = `http://localhost:${PORT}/${shot.query}`;
    const out = join(here, 'screenshots', shot.name);
    console.log(`shot ${shot.name} ${shot.w}x${shot.h} ${url}`);
    execSync(
      `npx playwright screenshot --viewport-size=${shot.w},${shot.h} --wait-for-timeout=5000 ${JSON.stringify(url)} ${JSON.stringify(out)}`,
      { stdio: 'inherit' },
    );
    let size = statSync(out).size;
    let quality = 75;
    while (size > MAX_BYTES && quality > 40) {
      quality -= 10;
      reencodeJpeg(out, quality);
      size = statSync(out).size;
      console.log(`  re-encoded at q${quality}: ${size} bytes`);
    }
    console.log(`  ${shot.name}: ${size} bytes${size > MAX_BYTES ? ' — STILL OVER CAP' : ''}`);
  }
} finally {
  server.kill();
}
console.log('done');
