// Light over the ground, on a grid four samples to a cell. Static light (the stove) is baked once,
// with walls casting shadows, except windows, which let it spill out onto the snow. Moving lights
// (your lantern, flares, the muzzle flash) are added each frame over just the samples they reach,
// without shadows. The renderer reads it with lightAt().
import { canSee } from './raycast.js';

export const RES = 4;

export function falloff(d, full, dark) {
  if (d <= full) return 1;
  if (d >= dark) return 0;
  const t = (dark - d) / (dark - full);
  return t * t * (3 - 2 * t);
}

export function createLightmap(map) {
  const w = map.w * RES, h = map.h * RES;
  return { w, h, baked: new Float32Array(w * h), cur: new Float32Array(w * h), ambient: 0 };
}

// Sight for baking: like canSee, but windows don't block.
function lit(map, ax, ay, bx, by) {
  if (canSee(map, ax, ay, bx, by)) return true;
  // Walk the segment in small steps, letting light through window cells only.
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 8);
  for (let i = 1; i < n; i++) {
    const x = Math.floor(ax + ((bx - ax) * i) / n), y = Math.floor(ay + ((by - ay) * i) / n);
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    const c = y * map.w + x;
    if (map.solid[c] && !map.passLight[c]) return false;
  }
  return true;
}

// lights: [{ x, y, full, dark, intensity }], fixed for the whole night.
export function bakeStatic(lm, map, lights) {
  lm.baked.fill(0);
  for (let sy = 0; sy < lm.h; sy++) {
    for (let sx = 0; sx < lm.w; sx++) {
      const x = (sx + 0.5) / RES, y = (sy + 0.5) / RES;
      let v = 0;
      for (const L of lights) {
        const d = Math.hypot(x - L.x, y - L.y);
        if (d >= L.dark) continue;
        // A sample inside a wall takes the light of the open side, so test from just outside it.
        if (lit(map, L.x, L.y, x, y) || lit(map, L.x, L.y, x + (L.x - x) * (0.3 / d), y + (L.y - y) * (0.3 / d))) {
          v += L.intensity * falloff(d, L.full, L.dark);
        }
      }
      lm.baked[sy * lm.w + sx] = v;
    }
  }
}

// Starts a frame's light from the baked light and the sky's ambient light.
export function beginLight(lm, ambient) {
  lm.cur.set(lm.baked);
  lm.ambient = ambient;
}

// Adds one moving light (no shadows) over the samples within its reach.
export function addLight(lm, x, y, full, dark, intensity) {
  const x0 = Math.max(0, Math.floor((x - dark) * RES)), x1 = Math.min(lm.w - 1, Math.ceil((x + dark) * RES));
  const y0 = Math.max(0, Math.floor((y - dark) * RES)), y1 = Math.min(lm.h - 1, Math.ceil((y + dark) * RES));
  for (let sy = y0; sy <= y1; sy++) {
    const dy = (sy + 0.5) / RES - y;
    for (let sx = x0; sx <= x1; sx++) {
      const dx = (sx + 0.5) / RES - x;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < dark) lm.cur[sy * lm.w + sx] += intensity * falloff(d, full, dark);
    }
  }
}

// The light at a world point: the four nearest samples blended, plus ambient.
export function lightAt(lm, x, y) {
  let fx = x * RES - 0.5, fy = y * RES - 0.5;
  if (fx < 0) fx = 0;
  else if (fx > lm.w - 1.001) fx = lm.w - 1.001;
  if (fy < 0) fy = 0;
  else if (fy > lm.h - 1.001) fy = lm.h - 1.001;
  const ix = fx | 0, iy = fy | 0;
  const tx = fx - ix, ty = fy - iy, i = iy * lm.w + ix, c = lm.cur;
  const top = c[i] + (c[i + 1] - c[i]) * tx;
  const bottom = c[i + lm.w] + (c[i + lm.w + 1] - c[i + lm.w]) * tx;
  return lm.ambient + top + (bottom - top) * ty;
}