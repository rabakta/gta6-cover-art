[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/rabakta/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/rabakta/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Vice Cover Studio

A web app that turns any photo and caption into GTA-style poster cover art — framed crime-epic key art with a hero close-up, face-aware crops, 5 grades, and PNG export in 3 sizes. It runs offline in a desktop browser from its own static files: your photos never leave the machine.

## What it does

- **Hero Close-Up (default):** framed crime-epic key art — one large hero close-up dominating the cover, three smaller supporting panels beside it, over a drawn sunset sky with a big pink moon, city skyline, palm silhouettes, a yellow car, and a huge gradient neon title with a PRESENTS-style header. Every panel's default crop is face-aware (anchored to the face; double-click a panel to reframe on the face).
- **Built-in cast:** 8 original illustrated characters in a cel-shaded comic-poster style, drawn for this app. No real person's photo is used in the default cover.
- **Any photo:** add your own photos (upload or drag & drop) and they become panels too — per-panel crop (drag to pan, scroll to zoom, slider), so any photo fits the poster.
- **Caption:** editable header, title and subtitle in the vendored Anton font (OFL), with title size and grade controls.
- **Grades:** 5 grades — Sunset, Neon Night, Golden Hour, Midnight, Crimson Dusk — with a strength slider.
- **Export PNG:** one click per size — 1080×1080, 1080×1350, 1920×1080.

## Try it

```sh
node serve.mjs
# open http://localhost:8090
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/app/, out/screenshots/ and out/dossier.json
```

## Originality

Everything is original: the character art was drawn for this app, the lettering uses the vendored Anton font (OFL, see `app/fonts/OFL.txt`), and the sky, moon, skyline, palms and car are drawn shapes. No Rockstar Games logo, artwork or fonts.
