import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField, updateField, flowDir } from '../src/flowfield.js';
import { parseMap } from '../src/map.js';

const map = parseMap();

test('the field counts steps to your cell, and only rebuilds when you change cell', () => {
  const f = createField(map);
  assert.ok(updateField(f, map, 19.5, 20.5));
  assert.equal(f.dist[20 * 40 + 19], 0);
  assert.equal(f.dist[20 * 40 + 22], 3);
  assert.equal(f.dist[0], -1, 'walls are never reached');
  assert.ok(!updateField(f, map, 19.9, 20.1));
  assert.ok(updateField(f, map, 20.1, 20.1));
});

test('from behind the cabin, the way to you leads round it, not into the back wall', () => {
  const f = createField(map);
  updateField(f, map, 19.5, 20.5); // on the porch, south of the cabin
  const out = { x: 0, y: 0 };
  // Walk a point downhill from behind the cabin (north side) and check it arrives.
  let x = 19.5, y = 11.5;
  for (let i = 0; i < 60 && flowDir(f, map, x, y, out); i++) {
    x += out.x * 0.5;
    y += out.y * 0.5;
    const c = map.blocked[Math.floor(y) * 40 + Math.floor(x)];
    assert.equal(c, 0, `stepped into a wall at ${x.toFixed(2)},${y.toFixed(2)}`);
  }
  assert.ok(Math.floor(x) === 19 && Math.floor(y) === 20, `ended at ${x},${y}`);
});

test('into the cabin through the doorway', () => {
  const f = createField(map);
  updateField(f, map, 19.5, 15.5); // by the stove
  const out = { x: 0, y: 0 };
  let x = 25.5, y = 21.5, throughDoor = false;
  for (let i = 0; i < 80 && flowDir(f, map, x, y, out); i++) {
    x += out.x * 0.4;
    y += out.y * 0.4;
    if (Math.floor(x) === 19 && Math.floor(y) === 18) throughDoor = true;
  }
  assert.ok(throughDoor);
  assert.equal(Math.floor(y), 15);
});

test('no corner cutting: diagonals only where both sides are open', () => {
  const f = createField(map);
  updateField(f, map, 24.5, 17.5); // just east of the cabin's south-east corner
  const out = { x: 0, y: 0 };
  // From inside the corner pocket north-east of the cabin's corner cell (23, 18): never straight through it.
  assert.ok(flowDir(f, map, 24.5, 19.5, out));
  assert.ok(!(out.x < 0 && out.y < 0) || !map.blocked[18 * 40 + 23]);
});

test('in your own cell there is no flow (head straight for you)', () => {
  const f = createField(map);
  updateField(f, map, 19.5, 20.5);
  assert.equal(flowDir(f, map, 19.2, 20.8, { x: 0, y: 0 }), false);
});
