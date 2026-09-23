import { test } from 'node:test';
import assert from 'node:assert/strict';
import body from '../data/body.json' with { type: 'json' };
import screens from '../data/screens.json' with { type: 'json' };

test('body.json has the three stances, with low reaching furthest', () => {
  assert.deepEqual(body.stances.map((s) => s.name), ['low', 'mid', 'high']);
  assert.deepEqual(body.stances.map((s) => s.height), [7, 13, 18]);
  assert.deepEqual(body.stances.map((s) => s.reach), [14, 12, 11]);
  assert.deepEqual(body.boxes.stand, { w: 8, h: 24 });
  assert.deepEqual(body.boxes.crouch, { w: 8, h: 14 });
  assert.deepEqual(body.boxes.roll, { w: 10, h: 10 });
  assert.equal(body.hilt, body.boxes.stand.w / 2);
});

test('every screen grid is 32x18 of "#" and "."', () => {
  assert.deepEqual(screens.order, ['V-', 'B2-', 'B1-', 'C', 'B1+', 'B2+', 'V+']);
  for (const [name, rows] of Object.entries(screens.screens)) {
    assert.equal(rows.length, 18, `${name} has 18 rows`);
    for (const row of rows) assert.match(row, /^[#.]{32}$/, `${name}: ${row}`);
  }
});

test('the tunnel leaves 30px: room to stand, too low to throw', () => {
  const b1 = screens.screens.B1;
  const col = 10;
  let ceiling = 0;
  while (b1[ceiling][col] === '#') ceiling++;
  let floor = ceiling;
  while (b1[floor][col] === '.') floor++;
  assert.equal((floor - ceiling) * 10, 30);
});
