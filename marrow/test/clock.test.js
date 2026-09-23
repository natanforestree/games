import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/clock.js';

test('a 60 Hz display gets one tick per frame', () => {
  const c = createClock();
  c.ticks(0);
  let total = 0;
  for (let i = 1; i <= 600; i++) total += c.ticks((i * 1000) / 60);
  assert.equal(total, 600);
});

test('a 120 Hz display gets a tick every other frame', () => {
  const c = createClock();
  c.ticks(0);
  let total = 0;
  for (let i = 1; i <= 1200; i++) total += c.ticks((i * 1000) / 120);
  assert.equal(total, 600);
});

test('a slow frame is capped at a few ticks', () => {
  const c = createClock();
  c.ticks(0);
  assert.equal(c.ticks(200), 4);
});

test('coming back to a hidden tab does not fast-forward the match', () => {
  const c = createClock();
  c.ticks(0);
  c.ticks(16.7);
  assert.ok(c.ticks(10000) <= 1);
});
