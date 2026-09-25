// A breadth-first flow field towards you over the grid: every open cell's step count to your cell.
// Creatures that can't see you follow it downhill, so they come round the cabin and through the
// doorway instead of pressing into walls. It's rebuilt only when you move into a new cell.
export function createField(map) {
  return { dist: new Int16Array(map.w * map.h).fill(-1), queue: new Int32Array(map.w * map.h), cx: -1, cy: -1 };
}

// Rebuilds the field if (x, y) is in a different cell from last time. Returns true if it did.
export function updateField(field, map, x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx === field.cx && cy === field.cy) return false;
  field.cx = cx;
  field.cy = cy;
  const { w, h, blocked } = map;
  const dist = field.dist, q = field.queue;
  dist.fill(-1);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return true;
  let head = 0, tail = 0;
  const start = cy * w + cx;
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const i = q[head++], d = dist[i] + 1, x0 = i % w;
    if (x0 > 0 && dist[i - 1] < 0 && !blocked[i - 1]) (dist[i - 1] = d), (q[tail++] = i - 1);
    if (x0 < w - 1 && dist[i + 1] < 0 && !blocked[i + 1]) (dist[i + 1] = d), (q[tail++] = i + 1);
    if (i >= w && dist[i - w] < 0 && !blocked[i - w]) (dist[i - w] = d), (q[tail++] = i - w);
    if (i < w * (h - 1) && dist[i + w] < 0 && !blocked[i + w]) (dist[i + w] = d), (q[tail++] = i + w);
  }
  return true;
}

// The eight neighbours, as (dx, dy) pairs: sides first, then diagonals.
const DIRS = Int8Array.from([1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1]);

// The way downhill from (x, y): a unit vector in `out` towards the centre of the neighbouring cell
// nearest you (diagonals only where both sides are open, so nothing cuts a corner). Returns false if
// (x, y) is in your cell, or has no way to you.
export function flowDir(field, map, x, y, out) {
  const { w, h } = map, dist = field.dist;
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
  const here = dist[cy * w + cx];
  if (here === 0) return false;
  let best = here < 0 ? 32767 : here, bx = 0, by = 0, found = false;
  for (let k = 0; k < 16; k += 2) {
    const dx = DIRS[k], dy = DIRS[k + 1];
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (dx !== 0 && dy !== 0 && (dist[cy * w + nx] < 0 || dist[ny * w + cx] < 0)) continue;
    const d = dist[ny * w + nx];
    if (d >= 0 && d < best) {
      best = d;
      bx = nx;
      by = ny;
      found = true;
    }
  }
  if (!found) return false;
  const vx = bx + 0.5 - x, vy = by + 0.5 - y, l = Math.sqrt(vx * vx + vy * vy) || 1;
  out.x = vx / l;
  out.y = vy / l;
  return true;
}
