// Box-vs-tile physics: collision, ground, walls, ledges, headroom and safe spawn spots.
// A box is {x0, x1, y0, y1} in pixels with x1 and y1 exclusive. A fighter's x is its center, y its feet.
import body from '../data/body.json' with { type: 'json' };
import { T, TILE, COLS, ROWS, VIEW_W } from './tuning.js';
import { isSolid } from './level.js';

const EPS = 1e-6;
export const CLOSED = Object.freeze({ left: false, right: false });

const BOX_FOR = { crouch: 'crouch', crawl: 'crouch', sweep: 'crouch', getup: 'crouch', roll: 'roll', rollup: 'roll', knocked: 'knocked' };

export function boxSize(stateName) {
  return body.boxes[BOX_FOR[stateName] ?? 'stand'];
}

export function boxAt(stateName, x, y) {
  const { w, h } = boxSize(stateName);
  return { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y };
}

// The fighter's body, or null when there isn't one (dead, or off-screen waiting to respawn).
export function fighterBox(f) {
  if (f.state === 'dead' || f.state === 'gone') return null;
  return boxAt(f.state, f.x, f.y);
}

// Tile lookup with screen edges. Above and below the grid is empty, so fighters can fall into pits.
// A closed edge is a wall; an open edge continues the edge column, so the floor runs on off-screen.
export function solidAt(screen, col, row, open = CLOSED) {
  if (row < 0 || row >= ROWS) return false;
  if (col < 0) return open.left ? isSolid(screen, 0, row) : true;
  if (col >= COLS) return open.right ? isSolid(screen, COLS - 1, row) : true;
  return isSolid(screen, col, row);
}

export function boxHitsSolid(screen, b, open = CLOSED) {
  const c0 = Math.floor(b.x0 / TILE), c1 = Math.floor((b.x1 - EPS) / TILE);
  const r0 = Math.floor(b.y0 / TILE), r1 = Math.floor((b.y1 - EPS) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solidAt(screen, c, r, open)) return true;
  return false;
}

// Moves f sideways by dx, a pixel at a time, stopping flush against a wall.
// Sets f.hitWall (-1, 0 or 1) and f.hitEdge (true when that wall was a closed screen edge).
export function moveX(f, screen, dx, open = CLOSED) {
  f.hitWall = 0;
  f.hitEdge = false;
  let left = dx;
  while (left !== 0) {
    const step = Math.abs(left) > 1 ? Math.sign(left) : left;
    const b = boxAt(f.state, f.x + step, f.y);
    if (boxHitsSolid(screen, b, open)) {
      const { w } = boxSize(f.state);
      const col = step > 0 ? Math.floor((b.x1 - EPS) / TILE) : Math.floor(b.x0 / TILE);
      f.x = step > 0 ? Math.max(f.x, col * TILE - w / 2) : Math.min(f.x, (col + 1) * TILE + w / 2);
      f.hitWall = Math.sign(step);
      f.hitEdge = col < 0 || col >= COLS;
      return false;
    }
    f.x += step;
    left -= step;
  }
  return true;
}

// Moves f vertically by dy; returns true if it landed. Hitting a ceiling sets f.hitCeiling.
// Either contact zeroes f.vy.
export function moveY(f, screen, dy, open = CLOSED) {
  f.hitCeiling = false;
  let left = dy;
  while (left !== 0) {
    const step = Math.abs(left) > 1 ? Math.sign(left) : left;
    const b = boxAt(f.state, f.x, f.y + step);
    if (boxHitsSolid(screen, b, open)) {
      f.vy = 0;
      if (step > 0) {
        f.y = Math.max(f.y, Math.floor((b.y1 - EPS) / TILE) * TILE);
        return true;
      }
      const { h } = boxSize(f.state);
      f.y = Math.min(f.y, (Math.floor(b.y0 / TILE) + 1) * TILE + h);
      f.hitCeiling = true;
      return false;
    }
    f.y += step;
    left -= step;
  }
  return false;
}

export function isOnGround(f, screen, open = CLOSED) {
  return boxHitsSolid(screen, boxAt(f.state, f.x, f.y + 1), open);
}

export function fits(f, stateName, screen, open = CLOSED) {
  return !boxHitsSolid(screen, boxAt(stateName, f.x, f.y), open);
}

// Nudges f sideways out of any wall its current box overlaps (used when its box grows).
export function settle(f, screen, open = CLOSED) {
  if (fits(f, f.state, screen, open)) return;
  for (let d = 1; d <= 12; d++) {
    for (const s of [d, -d]) {
      if (!boxHitsSolid(screen, boxAt(f.state, f.x + s, f.y), open)) {
        f.x += s;
        return;
      }
    }
  }
}

export function touchingWall(f, screen, side, open = CLOSED) {
  return boxHitsSolid(screen, boxAt(f.state, f.x + side, f.y), open);
}

// Is there `need` px of open space above feet at (x, y), across a standing body's width?
export function headroomFree(screen, x, y, need, open = CLOSED) {
  const w = body.boxes.stand.w;
  return !boxHitsSolid(screen, { x0: x - w / 2, x1: x + w / 2, y0: y - need, y1: y }, open);
}

// A ledge f can grab on `side` (-1 left, 1 right): the outer corner of a solid tile, right beside
// f's body, with room to stand on top, and its top within `range` of f's head.
// Returns {side, col, top, cornerX} or null.
export function findLedge(f, screen, side, range, open = CLOSED) {
  const { w, h } = body.boxes.stand;
  const face = f.x + (side * w) / 2;
  const col = side > 0 ? Math.floor((face + 1) / TILE) : Math.floor((face - 1) / TILE);
  if (col < 0 || col >= COLS) return null;
  const cornerX = side > 0 ? col * TILE : (col + 1) * TILE;
  if (Math.abs(cornerX - face) > 2) return null;
  const head = f.y - h;
  for (let row = Math.floor((head - range) / TILE); row <= Math.floor((head + range) / TILE); row++) {
    const top = row * TILE;
    if (Math.abs(head - top) > range || !solidAt(screen, col, row, open)) continue;
    if (solidAt(screen, col - side, row, open)) continue; // not an outer corner
    let room = true;
    for (let r = row - 3; r < row; r++) if (solidAt(screen, col, r, open)) room = false;
    // the hanging body (feet at top + h - 2, flush with the corner) must be clear, so a ledge too low to hang from isn't grabbed
    if (room && !boxHitsSolid(screen, boxAt('stand', cornerX - (side * w) / 2, top + h - 2), open)) return { side, col, top, cornerX };
  }
  return null;
}

// Can a standing fighter be placed with feet at (x, y)? The body must be clear and every column
// under it solid: never even partly over a pit.
export function standableAt(screen, x, y, open = CLOSED) {
  const b = boxAt('stand', x, y);
  if (y % TILE !== 0 || boxHitsSolid(screen, b, open)) return false;
  const row = y / TILE;
  for (let c = Math.floor(b.x0 / TILE); c <= Math.floor((b.x1 - EPS) / TILE); c++) if (!solidAt(screen, c, row, open)) return false;
  return true;
}

export function surfacesAt(screen, x) {
  const ys = [];
  for (let row = 1; row < ROWS; row++) if (standableAt(screen, x, row * TILE)) ys.push(row * TILE);
  return ys;
}

// The nearest safe standing spot to targetX, fully inside the screen (SPAWN_MARGIN from each edge),
// taking the surface closest to preferY where a column has several.
export function findSpawn(screen, targetX, preferY) {
  const min = T.SPAWN_MARGIN, max = VIEW_W - T.SPAWN_MARGIN;
  const tx = Math.round(Math.min(max, Math.max(min, targetX)));
  for (let d = 0; d <= VIEW_W; d++) {
    for (const x of d === 0 ? [tx] : [tx + d, tx - d]) {
      if (x < min || x > max) continue;
      const ys = surfacesAt(screen, x);
      if (ys.length) return { x, y: ys.reduce((best, y) => (Math.abs(y - preferY) < Math.abs(best - preferY) ? y : best)) };
    }
  }
  throw new Error(`no safe floor on screen ${screen.name}`);
}
