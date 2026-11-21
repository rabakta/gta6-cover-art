// Renders the multi-panel cover onto a 2D canvas. Everything is drawn in the canvas's
// own pixel space (W x H), so the same state renders the preview and the PNG export
// at any post size. No network: photos are Image objects, the font is vendored.
//
// state:
//   layout: 'single' | 'hero2' | 'hero3' | 'grid' | 'strip'
//   panels: [{ img: Image|null, src: string, name: string, zoom: number, ox: number, oy: number }]
//   title, subtitle, titleSize (0.6..1.5), titlePos ('top'|'bottom'), titleColor
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
};

export function panelCount(layout) {
  return LAYOUTS[layout] ? LAYOUTS[layout]().length : 1;
}

/** Panel rectangles in pixels, with a gap between panels and a half-gap outer margin. */
export function layoutRects(layout, W, H) {
  const g = Math.max(4, Math.round(W * 0.012));
  return LAYOUTS[layout]().map((f) => ({
    x: Math.round(f.x * W + g / 2),
    y: Math.round(f.y * H + g / 2),
    w: Math.round(f.w * W - g),
    h: Math.round(f.h * H - g),
  }));
}

/** Finds which panel (index) contains canvas point (px, py), or -1. */
export function hitPanel(layout, W, H, px, py) {
  const rects = layoutRects(layout, W, H);
  for (let i = 0; i < rects.length; i++) {
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
  if (!title && !subtitle) return;
  const glow = GRADE_GLOW[state.grade] || '#ff5a00';
  const accent = GRADE_ACCENT[state.grade] || '#ffd23f';
  const atBottom = state.titlePos !== 'top';
  const base = H * 0.105 * (state.titleSize || 1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

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

/** Draws the whole cover onto `canvas` at its own pixel size. */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const hints = !!opts.hints;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a0f2e';
  ctx.fillRect(0, 0, W, H);

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
