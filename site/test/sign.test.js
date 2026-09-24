import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGN, wrap, layoutSign, placeSign } from '../sign.js';
import { STAGES } from '../layout.js';
import { placeIslands, overlaps } from '../islands.js';
import { readJson } from './helpers.js';

const mono = (s) => s.length * 6;
const byStyle = (s, style) => s.length * (style === 'name' ? 7 : 6); // the name is bold, so wider

test('wrap fills each line as far as it fits', () => {
  assert.deepEqual(wrap('one two three', 40, mono), ['one', 'two', 'three']);
  assert.deepEqual(wrap('one two three', 60, mono), ['one two', 'three']);
  assert.deepEqual(wrap('  one   two  ', 60, mono), ['one two']);
  assert.deepEqual(wrap('', 60, mono), []);
});

test('a word too long for any line gets a line to itself', () => {
  assert.deepEqual(wrap('a supercalifragilistic b', 30, mono), ['a', 'supercalifragilistic', 'b']);
});

test('the sign lays out name, blurb and controls, measuring each in its own font', () => {
  const sign = layoutSign({ name: 'Snake', blurb: "Eat, grow, don't bite yourself.", controls: 'Arrow keys, WASD, or swipe.' }, byStyle, 120);
  assert.deepEqual(sign.rows, [
    { text: 'Snake', style: 'name', y: 7 },
    { text: "Eat, grow, don't", style: 'blurb', y: 20 },
    { text: 'bite yourself.', style: 'blurb', y: 30 },
    { text: 'Arrow keys, WASD,', style: 'controls', y: 43 },
    { text: 'or swipe.', style: 'controls', y: 53 },
  ]);
  assert.equal(sign.w, 102 + 2 * SIGN.pad);
  assert.equal(sign.h, 53 + SIGN.text + SIGN.pad);
});

test('an empty section leaves no gap, and the board is never smaller than SIGN.min', () => {
  const sign = layoutSign({ name: 'X', blurb: 'y', controls: '' }, byStyle, 120);
  assert.deepEqual(sign.rows.map((r) => [r.text, r.y]), [['X', 7], ['y', 20]]);
  assert.equal(sign.h, 20 + SIGN.text + SIGN.pad);
  assert.equal(sign.w, Math.max(SIGN.min, 7 + 2 * SIGN.pad));
});

test('the board is as wide as its widest line, rounded up to a whole pixel', () => {
  const sign = layoutSign({ name: 'Abc', blurb: 'c', controls: 'd' }, (s) => s.length * 5.5, 120);
  assert.equal(sign.w, 17 + 2 * SIGN.pad);
});

const W = 116, H = 68, STAGE = [0, 0, 384, 216];

test('the sign hangs centred under the island when there is room', () => {
  assert.deepEqual(placeSign([100, 50, 80, 60], W, H, STAGE), { x: 82, y: 115, hanging: true });
});

test('near the bottom of the canvas it goes above the island instead', () => {
  assert.deepEqual(placeSign([100, 120, 80, 60], W, H, STAGE), { x: 82, y: 47, hanging: false });
});

test("when it fits neither below nor above, it hangs below, clamped to the canvas but never past the hit box's middle", () => {
  assert.deepEqual(placeSign([100, 30, 80, 150], W, H, STAGE), { x: 82, y: 144, hanging: true });
});

test('it stays inside the canvas at the sides', () => {
  assert.equal(placeSign([0, 50, 40, 60], W, H, STAGE).x, SIGN.margin);
  assert.equal(placeSign([360, 50, 40, 60], W, H, STAGE).x, 384 - SIGN.margin - W);
});

test('it may use the sky beyond the stage when the canvas is bigger', () => {
  assert.deepEqual(placeSign([360, 50, 40, 60], W, H, [-61, -9, 507, 234]), { x: 322, y: 115, hanging: true });
});

test('on a canvas narrower than the sign, its left edge stays in view', () => {
  assert.equal(placeSign([10, 10, 40, 40], W, H, [0, 0, 100, 300]).x, SIGN.margin);
});

test('for every real game, in both layouts, a nominal board never covers the top half of its island', () => {
  const data = readJson('games.json');
  const metas = Object.fromEntries([data.unfinished, ...data.games].map((e) => [e.island, readJson(`assets/${e.island}.json`)]));
  for (const layout of Object.keys(STAGES)) {
    const stage = STAGES[layout];
    const bounds = [0, 0, stage.w, stage.h];
    for (const island of placeIslands(data, metas, layout)) {
      if (!island.game) continue;
      const [hx, hy, hw, hh] = island.hit;
      const { x, y } = placeSign(island.hit, 200, 68, bounds);
      const topHalf = [hx, hy, hw, Math.floor(hh / 2)];
      assert.equal(overlaps([x, y, 200, 68], topHalf), false, `${island.id} in ${layout}`);
    }
  }
});
