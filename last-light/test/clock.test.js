import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/clock.js';

const TICK = 1000 / 120;

test('the first frame runs no updates', () => {
  const c = createClock();
  assert.equal(c.advance(1000), 0);
  assert.equal(c.alpha, 0);
});

test('a 60 Hz display gets two updates a frame, a 144 Hz display about 5 in 6', () => {
  const c = createClock();
  c.advance(0);
  let total = 0;
  for (let i = 1; i <= 60; i++) total += c.advance((i * 1000) / 60);
  assert.equal(total, 120);
  const d = createClock();
  d.advance(0);
  total = 0;
  for (let i = 1; i <= 144; i++) total += d.advance((i * 1000) / 144);
  assert.ok(total === 119 || total === 120, `ran ${total}`);
});

test('alpha is how far the frame sits between two updates', () => {
  const c = createClock();
  c.advance(0);
  assert.equal(c.advance(TICK * 1.5), 1);
  assert.ok(Math.abs(c.alpha - 0.5) < 1e-9, `alpha ${c.alpha}`);
  assert.equal(c.advance(TICK * 1.75), 0);
  assert.ok(Math.abs(c.alpha - 0.75) < 1e-9, `alpha ${c.alpha}`);
});

test('a long gap (hidden tab, sleep) runs one update, not a burst', () => {
  const c = createClock();
  c.advance(0);
  assert.equal(c.advance(5000), 1);
});

test('a slow frame is capped at 8 updates and drops the rest', () => {
  const c = createClock();
  c.advance(0);
  assert.equal(c.advance(200), 8);
  assert.equal(c.alpha, 0);
});

test('timestamps coarsened to 0.1 ms still give exactly one update per tick', () => {
  const c = createClock();
  c.advance(0);
  let total = 0;
  for (let i = 1; i <= 120; i++) total += c.advance(Math.round(i * TICK * 10) / 10);
  assert.equal(total, 120);
});

test('reset forgets the time spent paused', () => {
  const c = createClock();
  c.advance(0);
  c.advance(100);
  c.reset();
  assert.equal(c.advance(10000), 0);
  assert.equal(c.advance(10000 + TICK), 1);
});
