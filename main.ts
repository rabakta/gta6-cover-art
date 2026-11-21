// main.ts — hands in the Vice Cover Studio entry (Node 22, stdlib only).
// The app is this directory's app/ folder: static files a desktop browser
// loads offline (app/index.html and its modules, the vendored Anton font and
// the illustrated character assets — no network request). This program copies
// app/ and screenshots/ from beside itself to /output and writes
// /output/dossier.json with the vendored make.fun library, so the judge can
// read the app and its cover screenshots.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.)

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files, or a path under app/ over 1000 bytes).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

// Counts files and bytes under a directory, recursively.
function countTree(dir) {
  let files = 0, bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countTree(p);
      files += sub.files; bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
}

// Fail fast on the caps buildDossier would refuse, with a plain message
// naming the cap, before anything is copied.
function checkCaps() {
  const appDir = join(here, 'app');
  const app = countTree(appDir);
  if (app.files > CAPS.app_max_files) {
    throw new Error(`app/: ${app.files} files, over the ${CAPS.app_max_files} allowed (app_max_files)`);
  }
  if (app.bytes > CAPS.app_max_bytes) {
    throw new Error(`app/: ${app.bytes} bytes, over the ${CAPS.app_max_bytes} allowed (app_max_bytes)`);
  }
  const index = statSync(join(appDir, 'index.html'));
  if (index.size > 1024 * 1024) {
    throw new Error(`app/index.html: ${index.size} bytes, over the 1048576 a page may be`);
  }
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('screenshots/: no such directory (3 or 4 PNG or JPEG renders required)');
  const shots = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    throw new Error(`screenshots/: ${shots.length} images, need 3 or 4 (screenshots.max)`);
  }
  for (const f of shots) {
    const size = statSync(join(shotsDir, f)).size;
    if (size > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshots/${f}: ${size} bytes, over the ${CAPS.screenshots.max_bytes} allowed (screenshots.max_bytes)`);
    }
  }
}

checkCaps();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

const app = countTree(join(out, 'app'));
const shots = readdirSync(join(out, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
console.log(`vice cover studio: ${app.files} app files (${app.bytes} bytes), ${shots.length} screenshots, dossier written`);
