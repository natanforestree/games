import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER, CENTER, LAST, SCREENS, isSolid, victoryIndex } from '../src/level.js';

test('the map runs V- B2- B1- C B1+ B2+ V+ with the center in the middle', () => {
  assert.deepEqual(ORDER, ['V-', 'B2-', 'B1-', 'C', 'B1+', 'B2+', 'V+']);
  assert.equal(CENTER, 3);
  assert.equal(LAST, 6);
  assert.equal(SCREENS.length, 7);
});

test("'-' screens are mirror images of their '+' twins", () => {
  for (const base of ['B1', 'B2', 'V']) {
    const plus = SCREENS[ORDER.indexOf(`${base}+`)];
    const minus = SCREENS[ORDER.indexOf(`${base}-`)];
    assert.equal(plus.mirrored, false);
    assert.equal(minus.mirrored, true);
    for (let r = 0; r < 18; r++) for (let c = 0; c < 32; c++) assert.equal(isSolid(minus, c, r), isSolid(plus, 31 - c, r));
  }
});

test('the center screen has a flat floor at y = 150', () => {
  const c = SCREENS[CENTER];
  for (let col = 0; col < 32; col++) {
    assert.equal(isSolid(c, col, 14), false);
    assert.equal(isSolid(c, col, 15), true);
  }
});

test('each side wins at its own end of the map', () => {
  assert.equal(victoryIndex(1), LAST);
  assert.equal(victoryIndex(-1), 0);
});
