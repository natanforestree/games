import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/physics.js';
import { SCREENS, ORDER } from '../src/level.js';

const C = SCREENS[ORDER.indexOf('C')];
const B1 = SCREENS[ORDER.indexOf('B1+')];
const B2 = SCREENS[ORDER.indexOf('B2+')];
const dummy = (x, y, state = 'stand') => ({ x, y, state, vx: 0, vy: 0 });

test('falling lands exactly on the floor, even at top speed', () => {
  const f = dummy(100, 20);
  let landed = false;
  for (let i = 0; i < 40 && !landed; i++) landed = P.moveY(f, C, 6);
  assert.ok(landed);
  assert.equal(f.y, 150);
});

test('walking into a wall stops flush against it', () => {
  const f = dummy(230, 150); // B2+: the pillar's left face is at x = 250
  P.moveX(f, B2, 30);
  assert.equal(f.x, 246);
  assert.equal(f.hitWall, 1);
  assert.equal(f.hitEdge, false);
});

test('closed screen edges are walls; an open edge lets you through', () => {
  const f = dummy(310, 150);
  P.moveX(f, C, 20);
  assert.equal(f.x, 316);
  assert.equal(f.hitEdge, true);
  P.moveX(f, C, 20, { left: false, right: true });
  assert.equal(f.x, 336);
});

test('the ground check counts floor under any part of the body', () => {
  assert.ok(P.isOnGround(dummy(100, 150), C));
  assert.ok(P.isOnGround(dummy(67, 150), B2)); // B2+ pit starts at x = 70: half over it still stands
  assert.ok(!P.isOnGround(dummy(90, 150), B2)); // fully over the pit
});

test('headroom: open above the chamber floor, not in the tunnel', () => {
  assert.ok(P.headroomFree(C, 100, 150, 36));
  assert.ok(!P.headroomFree(B1, 100, 150, 36));
  assert.ok(P.headroomFree(B1, 100, 150, 24));
});

test('findLedge finds the pillar corner beside a falling fighter', () => {
  assert.deepEqual(P.findLedge(dummy(246, 132), B2, 1, 6), { side: 1, col: 25, top: 110, cornerX: 250 });
  assert.equal(P.findLedge(dummy(246, 150), B2, 1, 6), null); // head 16px below the corner
  assert.equal(P.findLedge(dummy(240, 132), B2, 1, 6), null); // not next to the wall
  assert.equal(P.findLedge(dummy(146, 148), B2, 1, 6), null); // the raised ledge is only 20px tall
});

test('findSpawn never picks a spot over a pit', () => {
  const s = P.findSpawn(B2, 90, 150); // x = 90 is the middle of the B2+ pit (x 70-110)
  assert.ok(P.standableAt(B2, s.x, s.y));
  assert.ok(s.x <= 66 || s.x >= 114, `spawned at ${s.x}`);
});

test('findSpawn stays inside the screen', () => {
  assert.deepEqual(P.findSpawn(C, 400, 150), { x: 304, y: 150 });
  assert.deepEqual(P.findSpawn(C, -50, 150), { x: 16, y: 150 });
});

test('settle nudges a grown box out of a wall', () => {
  const f = dummy(245, 150, 'knocked'); // 20px wide, overlapping the pillar
  P.settle(f, B2);
  assert.ok(P.fits(f, 'knocked', B2));
});
