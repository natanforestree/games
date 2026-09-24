import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShades, levelAt, FOG, BAYER } from '../src/shade.js';

const rgb = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24];

test('level 0 is the fog, and brightness rises with every level', () => {
  const { table } = buildShades(['#c0c0c0']);
  assert.deepEqual(rgb(table[(0 << 8) | 1]), [...FOG, 255]);
  let last = -1;
  for (let l = 0; l < 16; l++) {
    const [r, g, b] = rgb(table[(l << 8) | 1]);
    const sum = r + g + b;
    assert.ok(sum > last, `level ${l}`);
    last = sum;
  }
});

test('full light is warm (lantern amber), dim light is cold', () => {
  const { table } = buildShades(['#c0c0c0']);
  const [r15, , b15] = rgb(table[(15 << 8) | 1]);
  const [r4, , b4] = rgb(table[(4 << 8) | 1]);
  assert.ok(r15 > b15, 'warm');
  assert.ok(b4 > r4, 'cold');
});

test('glowing colours ignore light in the table, and fade by level in `fade`', () => {
  const { table, fade, emissive } = buildShades(['#c0c0c0', '#ff3020'], new Set([2]));
  assert.equal(emissive[2], 1);
  assert.deepEqual(rgb(table[(0 << 8) | 2]), [255, 48, 32, 255]);
  assert.deepEqual(rgb(fade[(15 << 8) | 2]), [255, 48, 32, 255]);
  assert.deepEqual(rgb(fade[(0 << 8) | 2]), [...FOG, 255]);
  assert.equal(fade[(7 << 8) | 1], table[(7 << 8) | 1], 'plain colours are the same in both');
});

test('index 0 stays transparent, and too many colours is an error', () => {
  const { table } = buildShades(['#ffffff']);
  assert.equal(table[(15 << 8) | 0], 0);
  assert.throws(() => buildShades(Array(256).fill('#000000')), /255/);
});

test('light between two levels dithers between them', () => {
  const seen = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(levelAt(0.5, x, y));
  assert.deepEqual([...seen].sort((a, b) => a - b), [7, 8]);
  assert.equal(levelAt(0, 3, 3), 0);
  assert.equal(levelAt(5, 0, 0), 15);
  assert.equal(BAYER.length, 16);
});
