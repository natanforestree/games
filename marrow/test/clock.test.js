import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/clock.js';

const round1 = (x) => Math.round(x * 10) / 10; // some browsers coarsen rAF timestamps to 0.1ms

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

test('the backlog dropped by a capped hitch is not carried into later frames', () => {
  const c = createClock();
  c.ticks(0);
  assert.equal(c.ticks(200), 4);
  assert.equal(c.ticks(200 + 1000 / 60), 1);
});

test('coming back to a hidden tab does not fast-forward the match', () => {
  const c = createClock();
  c.ticks(0);
  c.ticks(16.7);
  assert.ok(c.ticks(10000) <= 1);
});

test('a 60 Hz display still gets exactly one tick per frame when timestamps are coarsened to 0.1ms', () => {
  for (const t0 of [0, 1234.5678, 0.03]) {
    const c = createClock();
    c.ticks(round1(t0));
    for (let i = 1; i <= 120; i++) {
      assert.equal(c.ticks(round1(t0 + (i * 1000) / 60)), 1, `t0=${t0}, frame ${i}`);
    }
  }
});

test('the long-run tick rate stays exact off nominal 60 Hz, even with coarsened timestamps', () => {
  for (const hz of [59.94, 60.5]) {
    const c = createClock();
    c.ticks(0);
    const frames = Math.round(hz * 60); // enough frames to cover about a minute at this refresh rate
    let total = 0;
    for (let i = 1; i <= frames; i++) total += c.ticks(round1((i * 1000) / hz));
    assert.ok(Math.abs(total - 3600) <= 1, `hz=${hz}, total=${total}`);
  }
});
