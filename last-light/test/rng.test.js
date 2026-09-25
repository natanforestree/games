import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, nextRandom, randomBetween } from '../src/rng.js';

test('the same seed gives the same sequence, in [0, 1)', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 1000; i++) {
    const x = nextRandom(a);
    assert.equal(x, nextRandom(b));
    assert.ok(x >= 0 && x < 1);
  }
});

test('randomBetween stays in its range', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const x = randomBetween(r, 2, 4);
    assert.ok(x >= 2 && x < 4);
  }
});
