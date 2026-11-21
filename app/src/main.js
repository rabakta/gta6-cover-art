// main.js — the editor. Loads the illustrated character assets, keeps the
// editor state, wires the controls, and renders the preview canvas through
// cover.js. The built-in cast is the app's own illustrated characters — no
// real person's photo is used anywhere in the default cover. The user can
// still add their own photos (upload / drag & drop): the bounty asks the app
// to turn ANY photo into cover art, and uploads are that path.
import { drawCover, layoutRects, panelCount, FACE_ANCHOR } from './cover.js';

const ASSET_NAMES = [
  'char-1.jpg', 'char-2.jpg', 'char-3.jpg', 'char-4.jpg',
  'char-5.jpg', 'char-6.jpg', 'char-7.jpg', 'char-8.jpg',
];
const LAYOUT_NAMES = { hero: 'Hero Close-Up', single: 'Single', hero2: 'Hero + 2', grid: 'Grid 2×2' };
const GRADE_NAMES = { sunset: 'Sunset', neon: 'Neon Night', golden: 'Golden Hour', midnight: 'Midnight', crimson: 'Crimson Dusk' };
const EXPORT_SIZES = [[1080, 1080], [1080, 1350], [1920, 1080]];

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const params = new URLSearchParams(location.search);

const state = {
  layout: params.get('layout') || 'hero',
  grade: params.get('grade') || 'sunset',
  gradeStrength: Number(params.get('gradeStrength') || 70) / 100,
  title: params.get('title') || 'SUNSET HEIST',
  subtitle: params.get('subtitle') || 'VICE CITY • 2026',
  header: params.get('header') || 'VICE COVER STUDIO PRESENTS',
  titleScale: Number(params.get('titleSize') || 100) / 100,
  images: [],      // HTMLImageElement per asset slot
  names: [],       // display name per asset slot
  panels: [],      // { img, ox, oy, zoom } per layout panel
  selected: 0,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed: ' + src));
    img.src = src;
  });
}

async function loadAssets() {
  for (const name of ASSET_NAMES) {
    try {
      const img = await loadImage('assets/' + name);
      state.images.push(img);
      state.names.push(name.replace(/\.jpg$/, ''));
    } catch (e) { /* asset not present yet — skip */ }
  }
}

// Per-asset face anchors (oy): the cast was drawn with faces at slightly
// different heights (char-5's tall ponytail puts her face lower), so each
// asset records its own face height. defaultPanels and reframeToFace use
// these; anything unlisted falls back to FACE_ANCHOR.
const FACE_OY = [0.28, 0.28, 0.28, 0.28, 0.38, 0.32, 0.30, 0.30];
function faceOy(imgIdx) {
  return Number.isInteger(imgIdx) && FACE_OY[imgIdx] !== undefined ? FACE_OY[imgIdx] : FACE_ANCHOR.oy;
}

// Default panels for a layout: cycle through the cast, each crop anchored
// to that asset's face (faceOy) so no face is ever cut by default. The hero
// panel is a close-up (zoomed to the face); supporting panels vary their
// zoom slightly so a repeated character still reads differently.
function defaultPanels(layout) {
  const n = panelCount(layout);
  const { hero } = layoutRects(layout, 100, 100);
  const panels = [];
  for (let i = 0; i < n; i++) {
    const img = state.images.length ? i % state.images.length : -1;
    panels.push({
      img,
      ox: FACE_ANCHOR.ox,
      oy: faceOy(img),
      zoom: i === hero ? 1.5 : 1 + (i % 3) * 0.08,
    });
  }
  return panels;
}

// Reframe one panel's crop back onto the face (double-click on the canvas).
function reframeToFace(i) {
  const p = state.panels[i];
  if (!p) return;
  const { hero } = layoutRects(state.layout, canvas.width, canvas.height);
  p.ox = FACE_ANCHOR.ox;
  p.oy = faceOy(p.img);
  p.zoom = i === hero ? 1.5 : 1;
  render();
  buildPanelList();
}

function applyAssetParam() {
  const raw = params.get('assets');
  if (!raw) return;
  const idxs = raw.split(',').map((s) => Number(s.trim()));
  idxs.forEach((a, i) => {
    if (state.panels[i] && Number.isInteger(a) && a >= 0 && a < state.images.length) {
      state.panels[i].img = a;
    }
  });
}

function render() {
  drawCover(canvas, {
    images: state.images,
    panels: state.panels,
    layout: state.layout,
    grade: state.grade,
    gradeStrength: state.gradeStrength,
    title: state.title,
    subtitle: state.subtitle,
    header: state.header,
    titleScale: state.titleScale,
  });
}

// ------------------------------------------------------------------ controls
function buildButtons(el, names, current, onPick) {
  el.innerHTML = '';
  for (const [key, label] of Object.entries(names)) {
    const b = document.createElement('button');
    b.textContent = label;
    if (key === current) b.classList.add('active');
    b.addEventListener('click', () => {
      onPick(key);
      el.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    el.appendChild(b);
  }
}

function buildCast() {
  const cast = $('cast');
  cast.innerHTML = '';
  state.images.forEach((img, i) => {
    const t = document.createElement('img');
    t.src = img.src;
    t.alt = state.names[i] || ('asset ' + (i + 1));
    t.title = t.alt;
    t.addEventListener('click', () => {
      const p = state.panels[state.selected];
      if (p) { p.img = i; render(); buildPanelList(); }
      cast.querySelectorAll('img').forEach((x) => x.classList.remove('sel'));
      t.classList.add('sel');
    });
    cast.appendChild(t);
  });
}

function buildPanelList() {
  const list = $('panelList');
  list.innerHTML = '';
  state.panels.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'prow';
    const thumb = document.createElement('img');
    thumb.src = p.img >= 0 && state.images[p.img] ? state.images[p.img].src : '';
    thumb.alt = '';
    const name = document.createElement('span');
    name.className = 'pname';
    name.textContent = `Panel ${i + 1} — ${p.img >= 0 ? (state.names[p.img] || 'asset') : 'empty'}`;
    const zoom = document.createElement('input');
    zoom.type = 'range'; zoom.min = '100'; zoom.max = '400'; zoom.value = String(Math.round(p.zoom * 100));
    zoom.addEventListener('input', () => { p.zoom = Number(zoom.value) / 100; render(); });
    const clear = document.createElement('button');
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => { p.img = -1; render(); buildPanelList(); });
    row.append(thumb, name, zoom, clear);
    row.addEventListener('click', () => { state.selected = i; render(); });
    list.appendChild(row);
  });
}

function setLayout(layout) {
  state.layout = layout;
  state.panels = defaultPanels(layout);
  state.selected = 0;
  applyAssetParam();
  render();
  buildPanelList();
}

// ------------------------------------------------------------------- export
function exportPNG(w, h) {
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawCover(off, {
    images: state.images,
    panels: state.panels,
    layout: state.layout,
    grade: state.grade,
    gradeStrength: state.gradeStrength,
    title: state.title,
    subtitle: state.subtitle,
    header: state.header,
    titleScale: state.titleScale,
  });
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

// ------------------------------------------------------------------ pointer
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function hitPanel(pt) {
  const { hero, rects } = layoutRects(state.layout, canvas.width, canvas.height);
  const order = rects.map((_, i) => i).sort((a, b) => (a === hero ? -1 : b === hero ? 1 : b - a));
  for (const i of order) {
    const r = rects[i];
    if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const i = hitPanel(pt);
  if (i < 0) return;
  state.selected = i;
  const p = state.panels[i];
  const { rects } = layoutRects(state.layout, canvas.width, canvas.height);
  drag = { i, x: pt.x, y: pt.y, ox: p.ox, oy: p.oy, w: rects[i].w, h: rects[i].h };
  canvas.setPointerCapture(e.pointerId);
  render();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const p = state.panels[drag.i];
  const dx = pt.x - drag.x, dy = pt.y - drag.y;
  p.ox = Math.max(0, Math.min(1, drag.ox - dx / (drag.w * p.zoom)));
  p.oy = Math.max(0, Math.min(1, drag.oy - dy / (drag.h * p.zoom)));
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  const pt = canvasPoint(e);
  const i = hitPanel(pt);
  if (i < 0) return;
  e.preventDefault();
  const p = state.panels[i];
  p.zoom = Math.max(1, Math.min(4, p.zoom * Math.exp(-e.deltaY * 0.001)));
  state.selected = i;
  render();
  buildPanelList();
}, { passive: false });

canvas.addEventListener('dblclick', (e) => {
  const pt = canvasPoint(e);
  const i = hitPanel(pt);
  if (i < 0) return;
  state.selected = i;
  reframeToFace(i);
});

// -------------------------------------------------------------------- upload
function addUpload(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.images.push(img);
    state.names.push(file.name.replace(/\.[^.]+$/, ''));
    buildCast();
    render();
  };
  img.src = url;
}

$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (e) => {
  for (const f of e.target.files) addUpload(f);
  e.target.value = '';
});
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  for (const f of e.dataTransfer.files) addUpload(f);
});

// --------------------------------------------------------------------- init
async function init() {
  // Cover-only mode (for screenshots) hides the editor chrome.
  const shot = params.get('shot');
  if (shot === 'cover') document.body.classList.add('cover-only');
  const size = params.get('size');
  if (size) {
    const [w, h] = size.split('x').map(Number);
    if (Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0) {
      canvas.width = w; canvas.height = h;
    }
  }

  await loadAssets();
  try { await document.fonts.load('400 100px Anton'); await document.fonts.ready; } catch (e) { /* Anton missing — fallback font */ }

  state.panels = defaultPanels(state.layout);
  applyAssetParam();

  buildButtons($('layouts'), LAYOUT_NAMES, state.layout, setLayout);
  buildButtons($('grades'), GRADE_NAMES, state.grade, (g) => { state.grade = g; render(); });
  const ex = $('exports');
  ex.innerHTML = '';
  for (const [w, h] of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.textContent = `${w} × ${h}`;
    b.addEventListener('click', () => exportPNG(w, h));
    ex.appendChild(b);
  }
  buildCast();
  buildPanelList();

  $('headerInput').value = state.header;
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('titleSize').value = String(Math.round(state.titleScale * 100));
  $('titleSizeVal').textContent = `${Math.round(state.titleScale * 100)}%`;
  $('gradeStrength').value = String(Math.round(state.gradeStrength * 100));
  $('gradeStrengthVal').textContent = `${Math.round(state.gradeStrength * 100)}%`;

  $('headerInput').addEventListener('input', (e) => { state.header = e.target.value; render(); });
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('titleSize').addEventListener('input', (e) => {
    state.titleScale = Number(e.target.value) / 100;
    $('titleSizeVal').textContent = `${e.target.value}%`;
    render();
  });
  $('gradeStrength').addEventListener('input', (e) => {
    state.gradeStrength = Number(e.target.value) / 100;
    $('gradeStrengthVal').textContent = `${e.target.value}%`;
    render();
  });

  render();
  window.__coverReady = true;
}

init().catch((e) => { window.__coverError = String(e); });
