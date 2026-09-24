import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveBody, pushOutOfCircle, separate } from '../src/collide.js';
import { room, near } from './helpers.js';

test('moving into a wall slides along it instead of stopping', () => {
  const map = room();
  const b = { x: 1.4, y: 5.5, radius: 0.25 };
  const hit = moveBody(map, b, -0.5, 0.3);
  assert.ok(hit);
  assert.ok(near(b.x, 1.25), `x ${b.x}`);
  assert.ok(near(b.y, 5.8), `y ${b.y}`);
});

test('a long move never passes through a wall', () => {
  const map = room(['#####', '#...#', '#.#.#', '#...#', '#####']);
  const b = { x: 1.5, y: 2.5, radius: 0.25 };
  moveBody(map, b, 0.95, 0);
  assert.ok(b.x <= 1.75 + 1e-9, `x ${b.x}`);
});

test('running along a wall past its corner rounds it smoothly', () => {
  // A wall block at cell (3, 1) only; running east just below it.
  const map = room(['#######', '#..#..#', '#.....#', '#.....#', '#######']);
  const b = { x: 2.5, y: 2.2, radius: 0.25 };
  // Starts overlapping the block's underside: pushed down to y = 2.25 and keeps going east.
  let lastX = b.x;
  for (let i = 0; i < 40; i++) {
    moveBody(map, b, 0.04, 0);
    assert.ok(b.x > lastX, 'never stops');
    lastX = b.x;
  }
  assert.ok(b.x > 4, `made it past, x ${b.x}`);
  assert.ok(near(b.y, 2.25), `y ${b.y}`);
});

test('a circle is pushed out of a prop, and two bodies apart by weight', () => {
  const b = { x: 5.3, y: 5, radius: 0.25 };
  assert.ok(pushOutOfCircle(b, 5, 5, 0.45));
  assert.ok(near(Math.hypot(b.x - 5, b.y - 5), 0.7));
  const a = { x: 0, y: 0, radius: 0.5 }, c = { x: 0.6, y: 0, radius: 0.5 };
  assert.ok(separate(a, c, 1, 3));
  assert.ok(near(c.x - a.x, 1));
  assert.ok(near(a.x, -0.3) && near(c.x, 0.7), `${a.x} ${c.x}`);
  assert.ok(!separate(a, c));
});
