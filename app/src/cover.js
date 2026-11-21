// Renders the multi-panel cover onto a 2D canvas. Everything is drawn in the canvas's
// own pixel space (W x H), so the same state renders the preview and the PNG export
// at any post size. No network: photos are Image objects, the font is vendored.
//
// state:
//   layout: 'single' | 'hero2' | 'hero3' | 'grid' | 'strip' | 'poster'
//   panels: [{ img: Image|null, src: string, name: string, zoom: number, ox: number, oy: number }]
//   title, subtitle, header, titleSize (0.6..1.5), titlePos ('top'|'bottom'), titleColor
//   header: small-caps "PRESENTS" line at the top, the app's own wording only.
//   grade: 'sunset' | 'neon' | 'golden' | 'midnight', gradeStrength (0..1.5)
//   selected: index of the selected panel
// opts: { hints: boolean } — editor hints (empty-panel marks, selection outline) are
//   drawn only in the preview, never in an export.

export const LAYOUTS = {
  single: () => [{ x: 0, y: 0, w: 1, h: 1 }],
  hero2: () => [
    { x: 0, y: 0, w: 0.6, h: 1 },
    { x: 0.6, y: 0, w: 0.4, h: 0.5 },
    { x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
  ],
  hero3: () => [
    { x: 0, y: 0, w: 0.6, h: 1 },
    { x: 0.6, y: 0, w: 0.4, h: 1 / 3 },
    { x: 0.6, y: 1 / 3, w: 0.4, h: 1 / 3 },
    { x: 0.6, y: 2 / 3, w: 0.4, h: 1 / 3 },
  ],
  grid: () => [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  strip: () => [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ],
  // Poster: a tall pyramid collage of 7 panels, like the reference poster's
  // fanned-out characters — smaller panels above and to the sides, one large
  // hero panel centre-bottom, drawn last so it sits in front. The panels
  // overlap slightly (see layoutRects) instead of a grid gap.
  poster: () => [
    { x: 0.02, y: 0.04, w: 0.40, h: 0.30 },
    { x: 0.58, y: 0.02, w: 0.40, h: 0.32 },
    { x: 0.10, y: 0.30, w: 0.38, h: 0.30 },
    { x: 0.60, y: 0.32, w: 0.36, h: 0.28 },
    { x: 0.00, y: 0.58, w: 0.34, h: 0.34 },
    { x: 0.68, y: 0.60, w: 0.32, h: 0.32 },
    { x: 0.30, y: 0.50, w: 0.42, h: 0.42 },
  ],
};

export function panelCount(layout) {
  return LAYOUTS[layout] ? LAYOUTS[layout]().length : 1;
}

/**
 * Panel rectangles in pixels. The grid layouts keep a gap between panels and a
 * half-gap outer margin. The poster collage instead sits inside an inset frame
 * (the sunset sky shows around it) and its panels overlap slightly, so the
 * collage reads as fanned-out panels rather than a grid.
 */
export function layoutRects(layout, W, H) {
  const poster = layout === 'poster';
  const g = poster ? -Math.max(2, Math.round(W * 0.015)) : Math.max(4, Math.round(W * 0.012));
  const inset = poster
    ? { x: W * 0.08, y: H * 0.05, w: W * 0.84, h: H * 0.88 }
    : { x: 0, y: 0, w: W, h: H };
  return LAYOUTS[layout]().map((f) => ({
    x: Math.round(inset.x + f.x * inset.w + g / 2),
    y: Math.round(inset.y + f.y * inset.h + g / 2),
    w: Math.round(f.w * inset.w - g),
    h: Math.round(f.h * inset.h - g),
  }));
}

/** Finds which panel (index) contains canvas point (px, py), or -1. */
export function hitPanel(layout, W, H, px, py) {
  const rects = layoutRects(layout, W, H);
  // Topmost first, so overlapping poster panels select the one on top.
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

const GRADE_FILTERS = {
  sunset: 'saturate(1.3) contrast(1.06) brightness(1.03) sepia(0.15)',
  neon: 'saturate(1.5) contrast(1.12) brightness(0.98) hue-rotate(-8deg)',
  golden: 'saturate(1.35) contrast(1.05) brightness(1.05) sepia(0.35)',
  midnight: 'saturate(0.85) contrast(1.12) brightness(0.92) hue-rotate(12deg)',
};

const GRADE_GLOW = {
  sunset: '#ff5a00',
  neon: '#ff00aa',
  golden: '#ffb400',
  midnight: '#00c8ff',
};

const GRADE_ACCENT = {
  sunset: '#ffd23f',
  neon: '#00e5ff',
  golden: '#ffffff',
  midnight: '#7df9ff',
};

// Deterministic film grain, generated once: a small noise tile, tiled over the cover.
let grainTile = null;
function getGrain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  let seed = 20261121;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

function drawPhoto(ctx, img, r, zoom, ox, oy, filter) {
  const s0 = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight);
  const s = s0 * zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  // Pan is bounded so the photo always covers the panel: |ox|,|oy| <= 1 puts one
  // edge flush with the panel edge.
  const dx = r.x + (r.w - dw) / 2 + Math.max(-1, Math.min(1, ox)) * ((dw - r.w) / 2);
  const dy = r.y + (r.h - dh) / 2 + Math.max(-1, Math.min(1, oy)) * ((dh - r.h) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.filter = filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

function drawEmptyPanel(ctx, r, grade, hints) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#3b1a5e');
  g.addColorStop(0.55, '#c2337f');
  g.addColorStop(1, '#ff7a18');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // A low sun, poster style.
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h * 0.38;
  const rad = Math.min(r.w, r.h) * 0.2;
  const sun = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
  sun.addColorStop(0, 'rgba(255, 230, 150, 0.95)');
  sun.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  if (hints) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.max(13, Math.round(r.w * 0.055))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('+ ADD PHOTO', cx, r.y + r.h * 0.72);
  }
}

function drawGrade(ctx, W, H, grade, strength) {
  const k = Math.max(0, Math.min(1.5, strength));
  if (k === 0) return;
  let g;
  if (grade === 'sunset') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(255, 140, 60, ${0.08 * k})`);
    g.addColorStop(0.55, `rgba(255, 60, 120, ${0.16 * k})`);
    g.addColorStop(1, `rgba(120, 20, 120, ${0.26 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W * 0.82, H * 0.12, 0, W * 0.82, H * 0.12, W * 0.45);
    sun.addColorStop(0, `rgba(255, 210, 120, ${0.22 * k})`);
    sun.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
  } else if (grade === 'neon') {
    g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `rgba(255, 0, 170, ${0.2 * k})`);
    g.addColorStop(0.5, 'rgba(255, 0, 170, 0)');
    g.addColorStop(1, `rgba(0, 220, 255, ${0.18 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.15, H * 0.9, 0, W * 0.15, H * 0.9, W * 0.5);
    glow.addColorStop(0, `rgba(255, 0, 170, ${0.22 * k})`);
    glow.addColorStop(1, 'rgba(255, 0, 170, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  } else if (grade === 'golden') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(255, 190, 80, ${0.16 * k})`);
    g.addColorStop(1, `rgba(255, 120, 20, ${0.2 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(10, 20, 80, ${0.22 * k})`);
    g.addColorStop(1, `rgba(0, 0, 0, ${0.3 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, W * 0.6);
    glow.addColorStop(0, `rgba(0, 200, 255, ${0.14 * k})`);
    glow.addColorStop(1, 'rgba(0, 200, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
  // Vignette + grain, every grade.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${0.32 * k})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.05 * k;
  ctx.fillStyle = ctx.createPattern(getGrain(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawCaption(ctx, W, H, state) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  const header = (state.header || '').trim().toUpperCase();
  const glow = GRADE_GLOW[state.grade] || '#ff5a00';
  const accent = GRADE_ACCENT[state.grade] || '#ffd23f';
  const isPoster = state.layout === 'poster';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  // Header: the small-caps "PRESENTS" line at the very top, the app's own
  // wording only. Skipped when the title sits at the top (it would collide).
  if (header && (isPoster || state.titlePos !== 'top')) {
    const hSize = Math.max(12, Math.round(H * 0.022));
    ctx.font = `${hSize}px Anton, 'Arial Narrow', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(hSize * 0.35)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = hSize * 0.3;
    ctx.fillText(header, W / 2, H * 0.028 + hSize * 0.5);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    ctx.shadowBlur = 0;
  }

  if (!title && !subtitle) return;
  const atBottom = state.titlePos !== 'top';
  // The poster's title is huge, like the reference poster's neon title.
  const base = H * (isPoster ? 0.19 : 0.105) * (state.titleSize || 1);

  let titleSize = base;
  if (title) {
    ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
    while (ctx.measureText(title).width > W * 0.92 && titleSize > 14) {
      titleSize -= 2;
      ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
    }
  }
  const subSize = Math.max(14, Math.round(titleSize * 0.3));
  const titleY = atBottom ? H * 0.94 : H * 0.05 + titleSize;
  const subY = atBottom ? titleY - titleSize * 1.12 : titleY + subSize * 1.7;
  const barY = atBottom ? subY - subSize * 1.15 : subY + subSize * 1.5;

  // Accent bar above the caption block.
  ctx.fillStyle = accent;
  const barW = Math.max(40, W * 0.09);
  ctx.fillRect(W / 2 - barW / 2, barY, barW, Math.max(4, titleSize * 0.07));

  if (subtitle) {
    ctx.font = `${subSize}px Anton, 'Arial Narrow', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = accent;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(2, subSize * 0.12);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subSize * 0.25;
    ctx.strokeText(subtitle, W / 2, subY);
    ctx.fillText(subtitle, W / 2, subY);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    ctx.shadowBlur = 0;
  }

  if (title) {
    ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
    if (isPoster) {
      // Big gradient title, like the reference poster's title: a pink-to-orange
      // gradient fill, a dark outline and a neon glow, with a thin bright rim.
      const tg = ctx.createLinearGradient(0, titleY - titleSize, 0, titleY);
      tg.addColorStop(0, '#ff7ad9');
      tg.addColorStop(0.5, '#ff2e88');
      tg.addColorStop(1, '#ff7a18');
      ctx.fillStyle = tg;
      ctx.strokeStyle = '#2a0a3e';
      ctx.lineWidth = Math.max(3, titleSize * 0.045);
      ctx.shadowColor = glow;
      ctx.shadowBlur = titleSize * 0.25;
      ctx.shadowOffsetY = titleSize * 0.02;
      ctx.fillText(title, W / 2, titleY);
      ctx.strokeText(title, W / 2, titleY);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, titleSize * 0.018);
      ctx.strokeText(title, W / 2, titleY);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = state.titleColor || '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(4, titleSize * 0.15);
      ctx.shadowColor = glow;
      ctx.shadowBlur = titleSize * 0.16;
      ctx.shadowOffsetY = titleSize * 0.02;
      ctx.strokeText(title, W / 2, titleY);
      ctx.fillText(title, W / 2, titleY);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  }
}

/** Purple-to-pink sunset sky, the poster backdrop (drawn, not a photo). */
function drawSky(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6a1fb8');
  g.addColorStop(0.35, '#a62b8f');
  g.addColorStop(0.62, '#e0407e');
  g.addColorStop(0.82, '#ff7a45');
  g.addColorStop(1, '#ffb347');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.5, H * 0.66, 0, W * 0.5, H * 0.66, W * 0.42);
  sun.addColorStop(0, 'rgba(255, 225, 150, 0.5)');
  sun.addColorStop(1, 'rgba(255, 225, 150, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
}

/**
 * A generic palm-tree silhouette, drawn shapes only. (x, y) is the base of the
 * trunk; s scales the tree (its trunk is 140 units tall); flip mirrors it.
 */
function drawPalm(ctx, x, y, s, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.strokeStyle = 'rgba(38, 8, 58, 0.9)';
  ctx.fillStyle = 'rgba(38, 8, 58, 0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(16, -70, 6, -140);
  ctx.stroke();
  // Fronds: filled leaf shapes fanning from the crown, so the crown reads as
  // a solid silhouette instead of a few thin sticks.
  const fronds = [-165, -140, -115, -90, -65, -40, -15, 10, 35];
  for (const a of fronds) {
    const rad = (a * Math.PI) / 180;
    const tipX = Math.cos(rad) * 100;
    const tipY = -140 + Math.sin(rad) * 60;
    const midX = Math.cos(rad) * 55;
    const midY = -140 + Math.sin(rad) * 24;
    ctx.beginPath();
    ctx.moveTo(6, -140);
    ctx.quadraticCurveTo(midX, midY - 16, tipX, tipY);
    ctx.quadraticCurveTo(midX, midY + 16, 6, -140);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A big pink moon, sitting in the gap between the top panels so the collage
 * overlaps its edges, like the moon behind the reference poster's characters.
 */
function drawMoon(ctx, W, H) {
  const cx = W * 0.52, cy = H * 0.15, r = W * 0.075;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.1);
  halo.addColorStop(0, 'rgba(255, 140, 200, 0.35)');
  halo.addColorStop(1, 'rgba(255, 140, 200, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  disc.addColorStop(0, '#fff0f8');
  disc.addColorStop(0.55, '#ffd1e8');
  disc.addColorStop(1, '#ff9ecf');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // A tiny plane silhouette flying past the moon.
  ctx.strokeStyle = 'rgba(40, 8, 58, 0.85)';
  ctx.lineWidth = Math.max(1.5, W * 0.0012);
  const px = W * 0.60, py = H * 0.055, s = W * 0.016;
  ctx.beginPath();
  ctx.moveTo(px - s, py);
  ctx.lineTo(px + s, py);
  ctx.moveTo(px + s * 0.3, py);
  ctx.lineTo(px + s * 0.1, py - s * 0.45);
  ctx.moveTo(px + s * 0.3, py);
  ctx.lineTo(px + s * 0.1, py + s * 0.45);
  ctx.stroke();
}

/**
 * A city skyline silhouette along the bottom, behind the collage. Deterministic
 * (fixed seed), so the same state always renders the same skyline.
 */
function drawSkyline(ctx, W, H) {
  let seed = 987654321;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const baseY = H * 0.98;
  let x = 0;
  while (x < W) {
    const bw = W * (0.03 + rnd() * 0.05);
    const top = H * (0.80 + rnd() * 0.10);
    ctx.fillStyle = 'rgba(28, 6, 48, 0.92)';
    ctx.fillRect(x, top, bw, baseY - top);
    // A few lit windows inside this building.
    ctx.fillStyle = 'rgba(255, 200, 90, 0.7)';
    const cols = Math.max(1, Math.floor(bw / (W * 0.014)));
    const rows = Math.max(1, Math.floor((baseY - top) / (H * 0.025)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() < 0.3) {
          ctx.fillRect(
            x + W * 0.005 + c * W * 0.014,
            top + H * 0.012 + r * H * 0.025,
            Math.max(2, W * 0.004),
            Math.max(2, H * 0.008),
          );
        }
      }
    }
    x += bw + W * 0.004;
  }
}

/**
 * A simple generic car silhouette in the foreground, bottom-right — the
 * reference poster's yellow car, drawn as basic shapes, not copied art.
 */
function drawCar(ctx, W, H) {
  const x0 = W * 0.66, y0 = H * 0.90, len = W * 0.30, h = H * 0.07;
  ctx.save();
  // A dark outline so the car reads against the bright sky and title.
  ctx.strokeStyle = 'rgba(20, 8, 31, 0.85)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  const body = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  body.addColorStop(0, '#ffc21c');
  body.addColorStop(1, '#ff7a18');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h * 0.62);
  ctx.lineTo(x0 + len * 0.06, y0 + h * 0.62);
  ctx.lineTo(x0 + len * 0.22, y0 + h * 0.18);
  ctx.lineTo(x0 + len * 0.62, y0 + h * 0.18);
  ctx.lineTo(x0 + len * 0.78, y0 + h * 0.62);
  ctx.lineTo(x0 + len, y0 + h * 0.62);
  ctx.lineTo(x0 + len, y0 + h * 0.95);
  ctx.lineTo(x0, y0 + h * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cabin: two windows with a pillar between them.
  ctx.fillStyle = '#1a0f2e';
  ctx.beginPath();
  ctx.moveTo(x0 + len * 0.26, y0 + h * 0.24);
  ctx.lineTo(x0 + len * 0.42, y0 + h * 0.24);
  ctx.lineTo(x0 + len * 0.44, y0 + h * 0.56);
  ctx.lineTo(x0 + len * 0.26, y0 + h * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x0 + len * 0.48, y0 + h * 0.24);
  ctx.lineTo(x0 + len * 0.60, y0 + h * 0.24);
  ctx.lineTo(x0 + len * 0.68, y0 + h * 0.56);
  ctx.lineTo(x0 + len * 0.48, y0 + h * 0.56);
  ctx.closePath();
  ctx.fill();
  for (const wx of [x0 + len * 0.22, x0 + len * 0.80]) {
    ctx.fillStyle = '#14081f';
    ctx.beginPath();
    ctx.arc(wx, y0 + h * 0.95, h * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9b8d6';
    ctx.beginPath();
    ctx.arc(wx, y0 + h * 0.95, h * 0.10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Draws the whole cover onto `canvas` at its own pixel size. */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const hints = !!opts.hints;
  ctx.clearRect(0, 0, W, H);
  if (state.layout === 'poster') {
    drawSky(ctx, W, H);
    drawMoon(ctx, W, H);
    drawSkyline(ctx, W, H);
    drawPalm(ctx, W * 0.03, H * 0.96, H * 0.0024, false);
    drawPalm(ctx, W * 0.97, H * 0.93, H * 0.0022, true);
    drawPalm(ctx, W * 0.99, H * 0.98, H * 0.003, true);
  } else {
    ctx.fillStyle = '#1a0f2e';
    ctx.fillRect(0, 0, W, H);
  }

  const rects = layoutRects(state.layout, W, H);
  const filter = GRADE_FILTERS[state.grade] || GRADE_FILTERS.sunset;
  for (let i = 0; i < rects.length; i++) {
    const panel = state.panels[i];
    if (panel && panel.img) {
      drawPhoto(ctx, panel.img, rects[i], panel.zoom || 1, panel.ox || 0, panel.oy || 0, filter);
    } else {
      drawEmptyPanel(ctx, rects[i], state.grade, hints);
    }
    // White poster border per panel.
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.strokeRect(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
  }

  if (state.layout === 'poster') drawCar(ctx, W, H);
  drawGrade(ctx, W, H, state.grade, state.gradeStrength);
  drawCaption(ctx, W, H, state);

  // Outer poster frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, W * 0.005);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  // Editor-only: selection outline around the selected panel.
  if (hints && state.selected >= 0 && state.selected < rects.length) {
    const r = rects[state.selected];
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.setLineDash([Math.max(8, W * 0.012), Math.max(6, W * 0.008)]);
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    ctx.restore();
  }
}
