import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_ROWS, parseMap, isSolid, isRoofed } from '../src/map.js';

const map = parseMap();

test('the map is 40x40, walled all round', () => {
  assert.equal(MAP_ROWS.length, 40);
  for (const row of MAP_ROWS) assert.equal(row.length, 40);
  for (let i = 0; i < 40; i++) {
    assert.ok(isSolid(map, i, 0) && isSolid(map, i, 39) && isSolid(map, 0, i) && isSolid(map, 39, i));
  }
  assert.ok(isSolid(map, -1, 5) && isSolid(map, 5, 40), 'outside the map is solid');
});

test('it has six trails, a start, the three supply spots and the props', () => {
  assert.equal(map.spawns.length, 6);
  for (const s of map.spawns) assert.ok(s && !isSolid(map, Math.floor(s.x), Math.floor(s.y)));
  assert.deepEqual(map.start, { x: 19.5, y: 20.5, facing: Math.PI / 2 });
  assert.deepEqual(Object.keys(map.spots).sort(), ['flare', 'shells', 'shotgun']);
  assert.deepEqual(map.props.map((p) => p.kind).sort(), ['pine', 'pine', 'pine', 'pine', 'stove', 'well']);
});

test('every open cell can be reached from the start without crossing walls or props', () => {
  const { w, h } = map;
  const seen = new Uint8Array(w * h);
  const q = [Math.floor(map.start.y) * w + Math.floor(map.start.x)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    for (const n of [i + 1, i - 1, i + w, i - w]) {
      if (!seen[n] && !map.blocked[n]) {
        seen[n] = 1;
        q.push(n);
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (!map.blocked[i]) assert.ok(seen[i], `cell ${i % w},${Math.floor(i / w)} is cut off`);
});

test('the cabin: logs, two windows that let light out, a doorway, a roof and the stove', () => {
  assert.ok(isRoofed(map, 19, 15) && isRoofed(map, 19, 18), 'floor and doorway are roofed');
  assert.ok(!isRoofed(map, 19, 20), 'the porch is open sky');
  assert.ok(!isSolid(map, 19, 18), 'the doorway is open');
  assert.equal(map.passLight[18 * 40 + 17], 1);
  assert.equal(map.passLight[18 * 40 + 21], 1);
  const kind = (x, y) => map.wallKinds[map.wall[y * 40 + x]];
  assert.deepEqual(kind(15, 15), { ns: 'logs', ew: 'logs' });
  assert.deepEqual(kind(10, 24), { ns: 'wagonSide', ew: 'wagonEnd' });
  assert.deepEqual(kind(0, 0), { ns: 'trunks', ew: 'trunks' });
});

test('a bad row or character is reported', () => {
  assert.throws(() => parseMap(['###', '##']), /row 1/);
  assert.throws(() => parseMap(['###', '#?#', '###']), /unknown character "\?"/);
});
