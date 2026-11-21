// Wires the page: pick photos, arrange the multi-panel cover, edit the caption and
// grade, export a PNG. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js). Photos stay on this machine: uploads use object URLs and
// the samples are local files.
import { drawCover, panelCount, layoutRects, hitPanel } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const panelsEl = document.getElementById('panels');

const SAMPLES = {
  pier: { src: 'samples/pier.jpg', name: 'Pier' },
  boulevard: { src: 'samples/boulevard.jpg', name: 'Boulevard' },
};

const state = {
  layout: 'hero2',
  panels: [],
  title: 'Sunset Heist',
  subtitle: 'VICE CITY • 2026',
  titleSize: 1,
  titlePos: 'bottom',
  titleColor: '#ffffff',
  grade: 'sunset',
  gradeStrength: 1,
  exportSize: '1080x1080',
  selected: 0,
};

function emptyPanel() {
  return { img: null, src: '', name: 'Empty', zoom: 1, ox: 0, oy: 0, objectURL: null };
}

function resizePanels(layout) {
  const n = panelCount(layout);
  while (state.panels.length < n) state.panels.push(emptyPanel());
  state.panels.length = n;
  if (state.selected >= n) state.selected = 0;
}

resizePanels(state.layout);

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function render() {
  drawCover(canvas, state, { hints: true });
  renderPanelList();
}

function renderPanelList() {
  panelsEl.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row' + (i === state.selected ? ' selected' : '');
    row.addEventListener('click', () => {
      state.selected = i;
      render();
    });
    if (panel.img) {
      const thumb = document.createElement('img');
      thumb.src = panel.src;
      thumb.alt = '';
      row.appendChild(thumb);
    } else {
      const thumb = document.createElement('img');
      thumb.alt = '';
      thumb.style.background = 'linear-gradient(180deg,#3b1a5e,#c2337f 55%,#ff7a18)';
      row.appendChild(thumb);
    }
    const name = document.createElement('div');
    name.className = 'pname';
    const b = document.createElement('b');
    b.textContent = `Panel ${i + 1} — ${panel.name}`;
    const span = document.createElement('span');
    span.textContent = panel.img ? `zoom ${panel.zoom.toFixed(2)}×` : 'no photo yet';
    name.appendChild(b);
    name.appendChild(span);
    row.appendChild(name);
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '3';
    zoom.step = '0.05';
    zoom.value = String(panel.zoom);
    zoom.setAttribute('aria-label', `Zoom panel ${i + 1}`);
    zoom.addEventListener('input', (e) => {
      panel.zoom = Number(e.target.value);
      render();
    });
    zoom.addEventListener('click', (e) => e.stopPropagation());
    row.appendChild(zoom);
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.addEventListener('click', (e) => {
      e.stopPropagation();
      clearPanel(i);
    });
    row.appendChild(clear);
    panelsEl.appendChild(row);
  });
}

function clearPanel(i) {
  const panel = state.panels[i];
  if (panel.objectURL) URL.revokeObjectURL(panel.objectURL);
  state.panels[i] = emptyPanel();
  render();
}

function setPanelPhoto(i, img, src, name, objectURL = null) {
  const panel = state.panels[i];
  if (panel.objectURL) URL.revokeObjectURL(panel.objectURL);
  panel.img = img;
  panel.src = src;
  panel.name = name;
  panel.objectURL = objectURL;
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  state.selected = i;
  render();
}

async function setSample(key) {
  const sample = SAMPLES[key];
  if (!sample) return;
  try {
    const img = await loadImage(sample.src);
    setPanelPhoto(state.selected, img, sample.src, sample.name);
  } catch {
    status.textContent = `Could not load the ${sample.name} sample.`;
  }
}

/** Fills panels with the given files: first the selected panel, then empty ones. */
async function addFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  for (const file of list) {
    let target = state.selected;
    if (state.panels[target].img) {
      const empty = state.panels.findIndex((p) => !p.img);
      target = empty === -1 ? (target + 1) % state.panels.length : empty;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setPanelPhoto(target, img, url, file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Photo', url);
    } catch {
      URL.revokeObjectURL(url);
      status.textContent = `Could not read ${file.name}.`;
    }
  }
}

// --- Controls ---------------------------------------------------------------

document.querySelectorAll('[data-layout]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-layout]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.layout = btn.dataset.layout;
    resizePanels(state.layout);
    render();
  });
});

document.getElementById('photo').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = '';
});
document.getElementById('sample-boulevard').addEventListener('click', () => setSample('boulevard'));
document.getElementById('sample-pier').addEventListener('click', () => setSample('pier'));

document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  render();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  render();
});
document.getElementById('title-size').addEventListener('input', (e) => {
  state.titleSize = Number(e.target.value);
  render();
});
document.getElementById('pos-top').addEventListener('click', (e) => {
  state.titlePos = 'top';
  document.getElementById('pos-top').classList.add('active');
  document.getElementById('pos-bottom').classList.remove('active');
  render();
});
document.getElementById('pos-bottom').addEventListener('click', (e) => {
  state.titlePos = 'bottom';
  document.getElementById('pos-bottom').classList.add('active');
  document.getElementById('pos-top').classList.remove('active');
  render();
});
document.querySelectorAll('[data-color]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-color]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.titleColor = btn.dataset.color;
    render();
  });
});
document.querySelectorAll('[data-grade]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-grade]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.grade = btn.dataset.grade;
    render();
  });
});
document.getElementById('grade-strength').addEventListener('input', (e) => {
  state.gradeStrength = Number(e.target.value);
  render();
});

function setExportSize(size) {
  state.exportSize = size;
  const [w, h] = size.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  render();
}
document.querySelectorAll('[data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-size]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    setExportSize(btn.dataset.size);
  });
});

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = state.exportSize.split('x').map(Number);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  drawCover(out, state, { hints: false });
  out.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${state.exportSize}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved vice-cover-${state.exportSize}.png`;
  }, 'image/png');
});

// --- Canvas interaction: click to select, drag to pan, wheel to zoom --------

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = hitPanel(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (i === -1) return;
  state.selected = i;
  canvas.setPointerCapture(e.pointerId);
  drag = { i, x: p.x, y: p.y, moved: false };
  render();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const dx = p.x - drag.x;
  const dy = p.y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const panel = state.panels[drag.i];
  if (!panel.img) return;
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  const r = rects[drag.i];
  const s0 = Math.max(r.w / panel.img.naturalWidth, r.h / panel.img.naturalHeight);
  const s = s0 * panel.zoom;
  const dw = panel.img.naturalWidth * s;
  const dh = panel.img.naturalHeight * s;
  if (dw > r.w) panel.ox = Math.max(-1, Math.min(1, panel.ox + dx / ((dw - r.w) / 2)));
  if (dh > r.h) panel.oy = Math.max(-1, Math.min(1, panel.oy + dy / ((dh - r.h) / 2)));
  drag.x = p.x;
  drag.y = p.y;
  render();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  const i = hitPanel(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (i === -1) return;
  const panel = state.panels[i];
  if (!panel.img) return;
  state.selected = i;
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  render();
}, { passive: false });

canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// --- Startup -----------------------------------------------------------------

async function init() {
  // Load the vendored display font before the first paint so the caption uses it.
  try {
    await document.fonts.load('100px Anton');
  } catch { /* falls back to sans-serif */ }
  const params = new URLSearchParams(location.search);
  if (params.get('shot')) {
    await runShot(params.get('shot'), params, async (scene) => {
      if (scene.layout) {
        state.layout = scene.layout;
        resizePanels(state.layout);
        document.querySelectorAll('[data-layout]').forEach((b) =>
          b.classList.toggle('active', b.dataset.layout === state.layout));
      }
      if (scene.grade) {
        state.grade = scene.grade;
        document.querySelectorAll('[data-grade]').forEach((b) =>
          b.classList.toggle('active', b.dataset.grade === state.grade));
      }
      if (scene.size) setExportSize(scene.size);
      if (scene.title !== undefined) {
        state.title = scene.title;
        document.getElementById('title').value = scene.title;
      }
      if (scene.subtitle !== undefined) {
        state.subtitle = scene.subtitle;
        document.getElementById('subtitle').value = scene.subtitle;
      }
      // Fill the panels with the scene's photos, in order.
      for (let i = 0; i < scene.photos.length && i < state.panels.length; i++) {
        const key = scene.photos[i];
        const sample = SAMPLES[key];
        if (!sample) continue;
        try {
          const img = await loadImage(sample.src);
          const panel = state.panels[i];
          panel.img = img;
          panel.src = sample.src;
          panel.name = sample.name;
          panel.zoom = scene.zoom ?? 1;
          panel.ox = scene.ox ?? 0;
          panel.oy = scene.oy ?? 0;
        } catch { /* panel stays empty */ }
      }
      state.selected = -1;
      render();
    });
    return;
  }
  // Default scene: a full cover from the two samples, so the app opens ready.
  const defaults = ['pier', 'boulevard', 'pier'];
  for (let i = 0; i < defaults.length && i < state.panels.length; i++) {
    const sample = SAMPLES[defaults[i]];
    try {
      const img = await loadImage(sample.src);
      const panel = state.panels[i];
      panel.img = img;
      panel.src = sample.src;
      panel.name = sample.name;
    } catch { /* panel stays empty */ }
  }
  render();
}

init();
