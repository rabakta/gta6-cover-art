// Fixed scenes for screenshots. `?shot=cover` shows the cover alone; `?shot=editor`
// shows the editor with a photo loaded. Query parameters:
//   photo=pier|boulevard   sample for the hero panel (the others alternate)
//   photos=pier,boulevard  samples per panel, in order
//   caption=...            title text
//   subtitle=...           subtitle text
//   layout=single|hero2|hero3|grid|strip
//   grade=sunset|neon|golden|midnight
//   size=1080x1080|1080x1350|1920x1080
// window.__shotReady is set once the scene is painted with the display font loaded.
export async function runShot(shot, query, setup) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photosParam = query.get('photos');
  let photos;
  if (photosParam) {
    photos = photosParam.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    const one = query.get('photo') ?? 'pier';
    const other = one === 'pier' ? 'boulevard' : 'pier';
    photos = [one, other, one, other];
  }
  const scene = {
    layout: query.get('layout') ?? undefined,
    grade: query.get('grade') ?? undefined,
    size: query.get('size') ?? undefined,
    title: query.get('caption') ?? undefined,
    subtitle: query.get('subtitle') ?? undefined,
    photos,
    zoom: query.get('zoom') ? Number(query.get('zoom')) : 1,
    ox: query.get('ox') ? Number(query.get('ox')) : 0,
    oy: query.get('oy') ? Number(query.get('oy')) : 0,
  };
  await setup(scene);
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch { /* title falls back to sans-serif */ }
  // Repaint once with the font in place, then signal readiness.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
