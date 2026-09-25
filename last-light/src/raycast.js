// Grid ray casting (DDA): steps a ray cell by cell until it enters a solid cell. Used for every
// screen column of the walls, and for shots, sight and flares.
import { isSolid } from './map.js';

// A reusable result, so casting allocates nothing.
export function createHit() {
  return { dist: Infinity, side: 0, cellX: 0, cellY: 0, kind: 0, face: 'ns', u: 0 };
}

// Casts from (px, py) along (rdx, rdy), which needn't be a unit vector: `dist` comes back in multiples
// of it. With a camera ray (facing + plane * cameraX) that's the depth along the facing; with a unit
// vector it's the true distance. Returns false (dist = Infinity) if nothing is hit within maxDist.
//   side  0 if it hit a cell's east or west face, 1 for north or south
//   face  'ew' or 'ns', to pick the wall's texture
//   u     where along the face it hit, 0..1, left to right as the viewer sees it
export function castRay(map, px, py, rdx, rdy, hit, maxDist = 64) {
  let mapX = Math.floor(px), mapY = Math.floor(py);
  const deltaX = rdx === 0 ? Infinity : Math.abs(1 / rdx);
  const deltaY = rdy === 0 ? Infinity : Math.abs(1 / rdy);
  let stepX, stepY, sideX, sideY;
  if (rdx < 0) {
    stepX = -1;
    sideX = (px - mapX) * deltaX;
  } else {
    stepX = 1;
    sideX = (mapX + 1 - px) * deltaX;
  }
  if (rdy < 0) {
    stepY = -1;
    sideY = (py - mapY) * deltaY;
  } else {
    stepY = 1;
    sideY = (mapY + 1 - py) * deltaY;
  }
  let side = 0, dist = 0;
  for (;;) {
    if (sideX < sideY) {
      dist = sideX;
      sideX += deltaX;
      mapX += stepX;
      side = 0;
    } else {
      dist = sideY;
      sideY += deltaY;
      mapY += stepY;
      side = 1;
    }
    if (dist > maxDist) {
      hit.dist = Infinity;
      return false;
    }
    if (isSolid(map, mapX, mapY)) break;
  }
  hit.dist = dist;
  hit.side = side;
  hit.cellX = mapX;
  hit.cellY = mapY;
  const inside = mapX >= 0 && mapY >= 0 && mapX < map.w && mapY < map.h;
  hit.kind = inside ? map.wall[mapY * map.w + mapX] : 1;
  if (side === 0) {
    let f = py + dist * rdy;
    f -= Math.floor(f);
    hit.face = 'ew';
    hit.u = rdx > 0 ? f : 1 - f;
  } else {
    let f = px + dist * rdx;
    f -= Math.floor(f);
    hit.face = 'ns';
    hit.u = rdy > 0 ? 1 - f : f;
  }
  return true;
}

// True if nothing solid lies between two points.
const sightHit = createHit();
export function canSee(map, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-9) return true;
  return !castRay(map, ax, ay, dx / d, dy / d, sightHit, d);
}
