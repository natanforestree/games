// Circles against the grid and against each other. A move is split into short steps, and after each
// step the circle is pushed out of any wall cell it overlaps, along the shortest way out. That slides
// a body along walls and rounds it smoothly past corners instead of catching on them, and a step is
// never long enough to pass through a wall.
import { isSolid } from './map.js';

function pushOutOfWalls(map, body) {
  const r = body.radius;
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const x0 = Math.floor(body.x - r), x1 = Math.floor(body.x + r);
    const y0 = Math.floor(body.y - r), y1 = Math.floor(body.y + r);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!isSolid(map, cx, cy)) continue;
        const nx = Math.max(cx, Math.min(body.x, cx + 1));
        const ny = Math.max(cy, Math.min(body.y, cy + 1));
        const dx = body.x - nx, dy = body.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2), push = r - d;
          body.x += (dx / d) * push;
          body.y += (dy / d) * push;
        } else {
          // The centre is inside the cell (only possible if something placed it there): leave by the
          // nearest side.
          const left = body.x - cx, right = cx + 1 - body.x, up = body.y - cy, down = cy + 1 - body.y;
          const m = Math.min(left, right, up, down);
          if (m === left) body.x = cx - r;
          else if (m === right) body.x = cx + 1 + r;
          else if (m === up) body.y = cy - r;
          else body.y = cy + 1 + r;
        }
      }
    }
  }
  return hit;
}

// Moves `body` ({ x, y, radius }) by (dx, dy), sliding along walls. Returns true if it touched one.
export function moveBody(map, body, dx, dy) {
  const stepLen = body.radius * 0.5;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / stepLen));
  let hit = false;
  for (let i = 0; i < steps; i++) {
    body.x += dx / steps;
    body.y += dy / steps;
    if (pushOutOfWalls(map, body)) hit = true;
  }
  return hit;
}

// Pushes `body` out of a fixed circle (a prop). Returns true if they overlapped.
export function pushOutOfCircle(body, cx, cy, cr) {
  const dx = body.x - cx, dy = body.y - cy;
  const min = body.radius + cr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-9) body.x += min; // exactly on top: any way out will do
  else {
    body.x = cx + (dx / d) * min;
    body.y = cy + (dy / d) * min;
  }
  return true;
}

// Pushes two bodies apart so they just touch. Each moves in proportion to the other's weight, so a
// heavy body barely shifts. Returns true if they overlapped.
export function separate(a, b, wa = 1, wb = 1) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const min = a.radius + b.radius;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  let d = Math.sqrt(d2), ux, uy;
  if (d < 1e-9) {
    ux = 1;
    uy = 0;
    d = 0;
  } else {
    ux = dx / d;
    uy = dy / d;
  }
  const overlap = min - d, total = wa + wb;
  a.x -= ux * overlap * (wb / total);
  a.y -= uy * overlap * (wb / total);
  b.x += ux * overlap * (wa / total);
  b.y += uy * overlap * (wa / total);
  return true;
}
