import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRandom } from '../src/rng.js';

test('the same seed gives the same sequence, in [0, 1)', () => {
  const a = { s: 42 }, b = { s: 42 };
  for (let i = 0; i < 1000; i++) {
    const x = nextRandom(a);
    assert.equal(x, nextRandom(b));
    assert.ok(x >= 0 && x < 1);
  }
});

test('different seeds diverge', () => {
  assert.notEqual(nextRandom({ s: 1 }), nextRandom({ s: 2 }));
});
