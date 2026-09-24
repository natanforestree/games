import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castRay, createHit, canSee } from '../src/raycast.js';
import { parseMap } from '../src/map.js';
import { room, near } from './helpers.js';

test('a ray east hits the east wall at the right distance and face', () => {
  const hit = createHit();
  assert.ok(castRay(room(), 6.5, 5.5, 1, 0, hit));
  assert.ok(near(hit.dist, 4.5));
  assert.deepEqual([hit.side, hit.cellX, hit.cellY, hit.face], [0, 11, 5, 'ew']);
  assert.ok(near(hit.u, 0.5));
});

test('rays exactly along grid lines and diagonals', () => {
  const hit = createHit();
  const map = room();
  assert.ok(castRay(map, 6, 5, 0, -1, hit));
  assert.ok(near(hit.dist, 4));
  assert.equal(hit.face, 'ns');
  assert.ok(castRay(map, 6.5, 6.5, Math.SQRT1_2, Math.SQRT1_2, hit));
  assert.ok(near(hit.dist, Math.SQRT2 * 4.5));
});

test('u runs left to right across a wall as you see it, whichever way you face', () => {
  const hit = createHit();
  const map = room();
  const u = (x, y, dx, dy) => (castRay(map, x, y, dx, dy, hit), hit.u);
  // Each pair of rays lands on the same wall cell, one a little left of the other.
  // Facing east, left is north.
  assert.ok(u(6.5, 5.5, 1, -0.05) < u(6.5, 5.5, 1, 0.05));
  // Facing west, left is south.
  assert.ok(u(6.5, 5.5, -1, 0.05) < u(6.5, 5.5, -1, -0.05));
  // Facing south, left is east.
  assert.ok(u(6.5, 5.5, 0.05, 1) < u(6.5, 5.5, -0.05, 1));
  // Facing north, left is west.
  assert.ok(u(6.5, 5.5, -0.05, -1) < u(6.5, 5.5, 0.05, -1));
});

test('camera rays give depth along the facing, not the slanted length', () => {
  const hit = createHit();
  assert.ok(castRay(room(), 6.5, 5.5, 1, 0.5, hit));
  assert.ok(near(hit.dist, 4.5));
});

test('the wagon shows its side facing north and south, its end east and west', () => {
  const map = parseMap();
  const hit = createHit();
  castRay(map, 10.5, 22.5, 0, 1, hit);
  assert.equal(map.wallKinds[hit.kind][hit.face], 'wagonSide');
  castRay(map, 14.5, 24.5, -1, 0, hit);
  assert.equal(map.wallKinds[hit.kind][hit.face], 'wagonEnd');
});

test('a ray that runs past maxDist hits nothing; sight is blocked by walls', () => {
  const hit = createHit();
  assert.equal(castRay(room(), 6.5, 5.5, 1, 0, hit, 3), false);
  assert.equal(hit.dist, Infinity);
  const map = parseMap();
  assert.ok(canSee(map, 19.5, 21.5, 19.5, 24.5));
  assert.ok(!canSee(map, 16.5, 21.5, 16.5, 15.5), 'the cabin wall is in the way');
  assert.ok(!canSee(map, 17.5, 21.5, 17.5, 15.5), 'windows block sight and shots');
  assert.ok(canSee(map, 19.5, 21.5, 19.5, 15.5), 'the doorway does not');
});
