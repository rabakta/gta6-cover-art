// Vice Cover Studio: a gta6-cover-art-01 entry (Node 22, standard library only).
// The app is this directory's app/ folder — plain static files a desktop browser
// loads offline (app/index.html and its ES modules, the vendored Anton font, the
// two sample photos; no library and no network request) — and this program hands
// it in. It copies app/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. The first screenshot by name is the cover.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Fail fast where the scorer would: the screenshots must be 3 or 4 files, each
// at most 256 KiB, and app/ must stay inside its file and byte caps.
const shots = readdirSync(join(out, 'screenshots'))
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .sort();
if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
  throw new Error(`expected 3-4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  const bytes = statSync(join(out, 'screenshots', shot)).size;
  if (bytes > CAPS.screenshots.max_bytes) {
    throw new Error(`screenshot ${shot} is ${bytes} bytes, over the 256 KiB cap`);
  }
}
let appFiles = 0;
let appBytes = 0;
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      appFiles += 1;
      walk(path);
    } else {
      appFiles += 1;
      appBytes += statSync(path).size;
    }
  }
})(join(out, 'app'));
if (appFiles > CAPS.app_max_files || appBytes > CAPS.app_max_bytes) {
  throw new Error(`app/ has ${appFiles} files / ${appBytes} bytes, over the caps`);
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
console.log(
  `vice cover studio: ${appFiles} app files (${appBytes} bytes), ` +
    `${shots.length} screenshots (${shots.join(', ')}), dossier written to ${join(out, 'dossier.json')}`,
);
