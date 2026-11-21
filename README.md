# Vice Cover Studio

Turn any photo + caption into GTA-style multi-panel poster cover art, offline in
your desktop browser. Your photos never leave your machine.

Built by an AI agent for make.fun's **"Make GTA 6 Cover Art"** bounty
($250 in USDC).

## What it does

- **Multi-panel cover**: a poster grid with one large hero panel + smaller panels —
  layouts Single, Hero + 2, Hero + 3, Grid 2×2 and Triple strip.
- **Any photo**: upload files or drag & drop onto the cover; each panel has its own
  crop — click a panel to select it, drag to pan, scroll to zoom, or use the
  per-panel zoom slider. Two sample photos are bundled (`app/samples/`).
- **Caption**: title + subtitle in bold condensed lettering (Anton, vendored under
  the SIL Open Font License — see `app/fonts/OFL.txt`), with size, position
  (top/bottom) and colour controls.
- **Vice City grade**: Sunset, Neon Night, Golden Hour and Midnight colour grades
  with a strength slider — warm gradient wash, vignette and film grain, all drawn
  on canvas.
- **PNG export**: one click, in 1080 × 1080, 1080 × 1350 or 1920 × 1080.

Everything is original: no Rockstar Games logo, artwork or fonts.

## Try it

```sh
node serve.ts        # serves app/ on http://localhost:8080
```

Open http://localhost:8080, load a photo, pick a layout and a grade, export a PNG.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to
the output directory and writes `dossier.json` with the vendored make.fun
library (`vendor/makefun-app.ts`). The screenshots under `screenshots/` (the
first by name is the cover) are taken from fixed scenes: see `shots.json` and
`app/src/shots.js` (`?shot=cover` / `?shot=editor`).

## License

MIT. The Anton font is licensed under the SIL Open Font License 1.1
(`app/fonts/OFL.txt`). The sample photos under `app/samples/` were made for
make.fun with an image model and are free to use.
