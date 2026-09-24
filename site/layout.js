// The scene's two stages, in scene pixels, and where the fixed things sit on each. The canvas covers
// the whole window: the stage is centred in it and the sky carries on round it.
export const STAGES = {
  landscape: { w: 384, h: 216, title: [14, 12, 172, 30], moon: [336, 14], sun: [276, 166], clouds: [8, 60, 150] },
  portrait: { w: 216, h: 384, title: [12, 14, 172, 30], moon: [188, 18], sun: [160, 330], clouds: [40, 170, 320] },
};

// The view for a window of cssW x cssH CSS pixels at devicePixelRatio dpr. It picks the stage that can
// be drawn bigger, by the largest whole number of device pixels per scene pixel (at least 1); on a tie,
// the one that matches the window's shape. The canvas (cw x ch scene pixels) covers the window, and
// the stage's top-left sits at (ox, oy) on it.
export function chooseView(cssW, cssH, dpr = 1) {
  const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
  const fit = (s) => Math.max(1, Math.floor(Math.min(devW / s.w, devH / s.h)));
  const l = fit(STAGES.landscape), p = fit(STAGES.portrait);
  const layout = l > p || (l === p && cssW >= cssH) ? 'landscape' : 'portrait';
  const stage = STAGES[layout];
  const scale = layout === 'landscape' ? l : p;
  const cw = Math.ceil(devW / scale), ch = Math.ceil(devH / scale);
  return { layout, stage, scale, dpr, cw, ch, ox: Math.floor((cw - stage.w) / 2), oy: Math.floor((ch - stage.h) / 2) };
}

// A rectangle in stage pixels -> CSS pixels on the page.
export function toCss([x, y, w, h], view) {
  const k = view.scale / view.dpr;
  return { left: (x + view.ox) * k, top: (y + view.oy) * k, width: w * k, height: h * k };
}
