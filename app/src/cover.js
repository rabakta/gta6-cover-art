// cover.js — the poster renderer. Pure canvas 2D, no dependencies.
// Draws the whole cover: a framed crime-epic key art — one large hero
// close-up dominating the cover, smaller supporting panels around it,
// sunset sky, moon, skyline, palms, car, and the lettering. Every drawn
// element is deterministic (seeded), so the same inputs always produce the
// same pixels.
//
// The cover is built from the app's own illustrated character assets — never
// a real person's photo in the default cover — arranged as framed key art
// over a drawn Vice City style sunset. No Rockstar logo, artwork or font is
// used anywhere: the art is drawn shapes + the app's own character art, the
// lettering is the vendored Anton font (OFL).

// Seeded PRNG so the skyline and grain are identical on every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- layouts
// A layout is a list of panel rects in fractions of the canvas (x, y, w, h)
// plus the index of the hero panel, which is drawn last (in front).
function rects(fracs, hero) {
  return { hero, panels: fracs.map(([x, y, w, h]) => ({ x, y, w, h })) };
}

// The hero close-up is the default: one large hero panel (~43% of the
// cover) on the left, three smaller supporting panels in a right column.
// The hero is drawn last, in front, and is a close-up (zoomed to the face).
export const LAYOUTS = {
  hero: rects([
    [0.03, 0.09, 0.62, 0.68], // hero close-up, dominant
    [0.67, 0.09, 0.29, 0.21], // supporting, top
    [0.67, 0.32, 0.29, 0.21], // supporting, middle
    [0.67, 0.55, 0.29, 0.22], // supporting, bottom
  ], 0),
  single: rects([[0.06, 0.09, 0.88, 0.68]], 0),
  hero2: rects([
    [0.06, 0.09, 0.56, 0.68], // hero
    [0.66, 0.09, 0.28, 0.33], // side top
    [0.66, 0.44, 0.28, 0.33], // side bottom
  ], 0),
  grid: rects([
    [0.05, 0.09, 0.44, 0.33],
    [0.51, 0.09, 0.44, 0.33],
    [0.05, 0.44, 0.44, 0.33],
    [0.51, 0.44, 0.44, 0.33],
  ], 0),
};

export function layoutRects(name, W, H) {
  // In landscape the portrait fractions would make every panel far wider
  // than tall, and a cover-fit would crop the tall character art to a thin
  // band (faces cut off). So a wide canvas gets its own, taller panels.
  const set = W > H ? LANDSCAPE_LAYOUTS : LAYOUTS;
  const L = set[name] || set.hero;
  return {
    hero: L.hero,
    rects: L.panels.map((p) => ({
      x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H,
    })),
  };
}

// The same four layouts, re-cut for a wide canvas: panels stay close to
// square or portrait so the tall character art keeps its face in frame.
const LANDSCAPE_LAYOUTS = {
  hero: rects([
    [0.02, 0.06, 0.46, 0.72], // hero close-up, dominant, left
    [0.50, 0.06, 0.23, 0.34], // supporting, top-left
    [0.75, 0.06, 0.23, 0.34], // supporting, top-right
    [0.50, 0.44, 0.48, 0.34], // supporting, wide bottom
  ], 0),
  single: rects([[0.25, 0.07, 0.50, 0.68]], 0),
  hero2: rects([
    [0.03, 0.07, 0.44, 0.68], // hero
    [0.50, 0.07, 0.22, 0.68], // side
    [0.75, 0.07, 0.22, 0.68], // side
  ], 0),
  grid: rects([
    [0.03, 0.07, 0.22, 0.68],
    [0.27, 0.07, 0.22, 0.68],
    [0.51, 0.07, 0.22, 0.68],
    [0.75, 0.07, 0.22, 0.68],
  ], 0),
};

export function panelCount(name) {
  return (LAYOUTS[name] || LAYOUTS.hero).panels.length;
}

// ------------------------------------------------------------------ grades
// A grade is a colour wash over the finished cover plus a per-panel tint.
export const GRADES = {
  sunset: { wash: ['rgba(255,90,140,0)', 'rgba(255,60,120,0.30)'], tint: 1.05, glow: '#ff2e88' },
  neon: { wash: ['rgba(150,40,220,0)', 'rgba(190,40,220,0.34)'], tint: 1.12, glow: '#c44dff' },
  golden: { wash: ['rgba(255,180,60,0)', 'rgba(255,160,40,0.28)'], tint: 1.08, glow: '#ffb02e' },
  midnight: { wash: ['rgba(30,50,160,0)', 'rgba(30,50,180,0.34)'], tint: 0.95, glow: '#4d7dff' },
  crimson: { wash: ['rgba(180,20,60,0)', 'rgba(160,20,60,0.32)'], tint: 1.0, glow: '#ff2e4d' },
};

// ------------------------------------------------------------------ helpers
// Face-aware crops: every character in the built-in cast was drawn with its
// face in the upper third of the frame, so the default crop anchors to the
// face region (ox 0.5, oy 0.28) instead of the image centre. A panel's crop
// starts on the face; the user can still pan/zoom freely, and double-click
// reframes a panel back onto the face.
export const FACE_ANCHOR = { ox: 0.5, oy: 0.28 };

// Cover-fit draw of an image into a rect, with a focal point (ox, oy in
// 0..1) and a zoom factor. Faces in the character art sit in the upper
// portion, so the default focal point is the face anchor (0.5, 0.28).
function drawImageCover(ctx, img, dx, dy, dw, dh, ox, oy, zoom) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return;
  const base = Math.max(dw / iw, dh / ih);
  const s = base * (zoom || 1);
  const sw = dw / s, sh = dh / s;
  let sx = ox * iw - sw / 2, sy = oy * ih - sh / 2;
  sx = Math.max(0, Math.min(iw - sw, sx));
  sy = Math.max(0, Math.min(ih - sh, sy));
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

// A deterministic film-grain tile, built once and reused.
let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const rnd = mulberry32(1234);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() * 255;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(c, 'repeat');
  return grainTile;
}

// ------------------------------------------------------------------- sky
function drawSky(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, '#2a0a4d');
  g.addColorStop(0.35, '#7b1e7a');
  g.addColorStop(0.6, '#e0407a');
  g.addColorStop(0.8, '#ff7a4d');
  g.addColorStop(1.0, '#ffb84d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Warm sun glow low on the horizon.
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.78, 0, W * 0.5, H * 0.78, W * 0.55);
  glow.addColorStop(0, 'rgba(255,200,110,0.55)');
  glow.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawMoon(ctx, W, H) {
  // The moon sits in the sky band above the panels: top-right in portrait
  // (clear of the header text and the hero panel), top-right in landscape.
  const wide = W > H;
  const cx = wide ? W * 0.90 : W * 0.82;
  const cy = H * (wide ? 0.055 : 0.068);
  const r = W * (wide ? 0.032 : 0.038);
  const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.4);
  halo.addColorStop(0, 'rgba(255,190,220,0.55)');
  halo.addColorStop(1, 'rgba(255,190,220,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
  const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  disc.addColorStop(0, '#ffe3f2');
  disc.addColorStop(1, '#ff9ecf');
  ctx.fillStyle = disc;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // A tiny plane silhouette crossing the moon.
  ctx.fillStyle = 'rgba(30,10,50,0.85)';
  ctx.save();
  ctx.translate(cx + r * 1.5, cy - r * 0.6);
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(10, -3); ctx.lineTo(-8, -3);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-2, -8, 3, 8);
  ctx.restore();
}

function drawSkyline(ctx, W, H) {
  const rnd = mulberry32(7);
  const base = H * 0.86;
  ctx.fillStyle = '#1a0a2e';
  let x = 0;
  while (x < W) {
    const bw = W * (0.03 + rnd() * 0.05);
    const bh = H * (0.03 + rnd() * 0.11);
    ctx.fillRect(x, base - bh, bw, bh + H * 0.14);
    // Lit windows.
    ctx.fillStyle = 'rgba(255,200,90,0.85)';
    const cols = Math.max(1, Math.floor(bw / (W * 0.012)));
    const rows = Math.max(1, Math.floor(bh / (H * 0.02)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() < 0.35) {
          ctx.fillRect(x + W * 0.004 + c * (W * 0.012), base - bh + H * 0.008 + r * (H * 0.02), W * 0.005, H * 0.008);
        }
      }
    }
    ctx.fillStyle = '#1a0a2e';
    x += bw + W * 0.004;
  }
}

function drawPalm(ctx, cx, cy, s, lean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = '#150829';
  ctx.strokeStyle = '#150829';
  // Trunk: a gentle curve.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * 14, -46, lean * 26, -88);
  ctx.stroke();
  // Fronds: filled leaf shapes fanning from the crown.
  const topX = lean * 26, topY = -88;
  for (let i = 0; i < 7; i++) {
    const a = (-160 + i * 26) * Math.PI / 180;
    const len = 52 - Math.abs(i - 3) * 5;
    const dx = Math.cos(a) * len, dy = Math.sin(a) * len * 0.55 - 14;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + dx * 0.5, topY + dy * 0.4 - 10, topX + dx, topY + dy);
    ctx.quadraticCurveTo(topX + dx * 0.5, topY + dy * 0.6 + 6, topX, topY);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawCar(ctx, W, H) {
  // A low yellow side-profile car at bottom-right, behind the title.
  const x = W * 0.60, y = H * 0.885, w = W * 0.37, h = H * 0.075;
  ctx.save();
  ctx.fillStyle = '#ffc61a';
  ctx.strokeStyle = '#1a0a2e';
  ctx.lineWidth = Math.max(2, H * 0.003);
  // Body: low wedge with a rounded nose.
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.62);
  ctx.lineTo(x + w * 0.06, y + h * 0.30);
  ctx.lineTo(x + w * 0.34, y + h * 0.18);
  ctx.lineTo(x + w * 0.62, y + h * 0.18);
  ctx.lineTo(x + w * 0.86, y + h * 0.34);
  ctx.lineTo(x + w * 0.97, y + h * 0.52);
  ctx.lineTo(x + w * 0.97, y + h * 0.72);
  ctx.lineTo(x + w * 0.90, y + h * 0.78);
  ctx.lineTo(x + w * 0.10, y + h * 0.78);
  ctx.lineTo(x, y + h * 0.72);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Cabin windows (two panes).
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.38, y + h * 0.24);
  ctx.lineTo(x + w * 0.48, y + h * 0.24);
  ctx.lineTo(x + w * 0.48, y + h * 0.46);
  ctx.lineTo(x + w * 0.36, y + h * 0.46);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.52, y + h * 0.24);
  ctx.lineTo(x + w * 0.60, y + h * 0.24);
  ctx.lineTo(x + w * 0.66, y + h * 0.46);
  ctx.lineTo(x + w * 0.52, y + h * 0.46);
  ctx.closePath(); ctx.fill();
  // Wheels.
  for (const wx of [x + w * 0.22, x + w * 0.78]) {
    ctx.fillStyle = '#14101e';
    ctx.beginPath(); ctx.arc(wx, y + h * 0.78, h * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cfd2da';
    ctx.beginPath(); ctx.arc(wx, y + h * 0.78, h * 0.11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- panels
function drawPanels(ctx, W, H, layout, images, panels) {
  const { hero, rects: R } = layoutRects(layout, W, H);
  const order = R.map((_, i) => i).sort((a, b) => (a === hero ? 1 : b === hero ? -1 : a - b));
  for (const i of order) {
    const r = R[i];
    const p = panels[i];
    if (!p) continue;
    const img = images[p.img];
    ctx.save();
    // White poster border, then the image clipped inside it.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    if (img) drawImageCover(ctx, img, r.x, r.y, r.w, r.h, p.ox ?? 0.5, p.oy ?? 0.3, p.zoom ?? 1);
    else { ctx.fillStyle = '#2b1838'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    ctx.restore();
  }
}

// --------------------------------------------------------------- lettering
function fitFont(ctx, text, family, maxW, startSize) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > 10) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

function drawLettering(ctx, W, H, { title, subtitle, header, grade, titleScale }) {
  const g = GRADES[grade] || GRADES.sunset;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Header line, small caps at the very top.
  if (header && header.trim()) {
    const hs = H * 0.026;
    ctx.font = `bold ${hs}px Anton, sans-serif`;
    try { ctx.letterSpacing = `${hs * 0.28}px`; } catch (e) { /* older canvas */ }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = hs * 0.3;
    ctx.fillText(header.trim().toUpperCase(), W / 2, H * 0.048);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  }
  // Subtitle above the title.
  if (subtitle && subtitle.trim()) {
    const ss = H * 0.045;
    ctx.font = `${ss}px Anton, sans-serif`;
    try { ctx.letterSpacing = `${ss * 0.22}px`; } catch (e) { /* older canvas */ }
    ctx.fillStyle = grade === 'neon' ? '#37e6ff' : grade === 'midnight' ? '#ffffff' : '#ffd23d';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = ss * 0.25;
    ctx.fillText(subtitle.trim().toUpperCase(), W / 2, H * 0.815);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  }
  // The huge gradient title.
  const text = (title || '').trim().toUpperCase();
  if (!text) return;
  const size = fitFont(ctx, text, 'Anton, sans-serif', W * 0.94, H * 0.17 * (titleScale || 1));
  const ty = H * 0.965;
  const grad = ctx.createLinearGradient(0, ty - size, 0, ty);
  grad.addColorStop(0, '#ff5da2');
  grad.addColorStop(0.55, '#ff2e88');
  grad.addColorStop(1, '#ff8a3d');
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.shadowColor = g.glow;
  ctx.shadowBlur = size * 0.28;
  ctx.fillStyle = grad;
  ctx.fillText(text, W / 2, ty);
  ctx.shadowBlur = 0;
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = '#2a0a3d';
  ctx.strokeText(text, W / 2, ty);
  ctx.lineWidth = size * 0.014;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(text, W / 2, ty);
}

// ------------------------------------------------------------------- grade
function applyGrade(ctx, W, H, grade, strength) {
  const g = GRADES[grade] || GRADES.sunset;
  const s = strength ?? 0.7;
  const wash = ctx.createLinearGradient(0, H * 0.3, 0, H);
  wash.addColorStop(0, g.wash[0]);
  wash.addColorStop(1, g.wash[1].replace(/0\.\d+\)$/, `${(parseFloat(g.wash[1].match(/0\.\d+/)?.[0] || '0.3') * s).toFixed(2)})`));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  // Vignette.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // Film grain.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------------- frame
// A distinct double frame around the whole cover — the framed key-art look.
// Drawn last so it stays crisp over the grade wash and grain.
function drawFrame(ctx, W, H) {
  const outer = Math.max(5, H * 0.008);
  const inset = outer + H * 0.006;
  ctx.save();
  ctx.strokeStyle = '#f5e6c8'; // warm off-white poster frame
  ctx.lineWidth = outer;
  ctx.strokeRect(outer / 2, outer / 2, W - outer, H - outer);
  ctx.strokeStyle = 'rgba(255,210,61,0.95)'; // gold keyline
  ctx.lineWidth = Math.max(2, H * 0.0025);
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.restore();
}

// ------------------------------------------------------------------- entry
// opts: { images, panels, layout, grade, gradeStrength, title, subtitle, header }
export function drawCover(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const layout = opts.layout || 'hero';
  const grade = opts.grade || 'sunset';
  drawSky(ctx, W, H);
  drawMoon(ctx, W, H);
  drawSkyline(ctx, W, H);
  drawPalm(ctx, W * 0.02, H * 0.92, H / 780, 1);
  drawPalm(ctx, W * 0.99, H * 0.90, H / 860, -1);
  drawCar(ctx, W, H);
  drawPanels(ctx, W, H, layout, opts.images || [], opts.panels || []);
  drawLettering(ctx, W, H, {
    title: opts.title, subtitle: opts.subtitle, header: opts.header, grade,
    titleScale: opts.titleScale,
  });
  applyGrade(ctx, W, H, grade, opts.gradeStrength);
  drawFrame(ctx, W, H);
}
