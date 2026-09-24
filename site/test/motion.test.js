import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOB_AMP, LIFT, LIFT_STEP_MS, bob, liftAt, frameAt, drift, hash, twinkles, twinkleFrame,
  birdAt, BIRD_EVERY, BIRD_MS, shootingStarAt, STAR_EVERY, STAR_MS, STAR_SPEED,
} from '../motion.js';

test('islands bob in whole pixels, never more than BOB_AMP either way', () => {
  for (let t = 0; t < 10000; t += 7) {
    const y = bob(t, 4200, 0.3);
    assert.ok(Number.isInteger(y) && Math.abs(y) <= BOB_AMP, `bob(${t}) = ${y}`);
  }
  assert.equal(bob(0, 4000, 0), 0);
  assert.equal(bob(1000, 4000, 0), BOB_AMP);
  assert.equal(bob(3000, 4000, 0), -BOB_AMP);
  assert.equal(bob(0, 4000, 0.25), BOB_AMP);
  assert.equal(bob(4000, 4000, 0), 0); // a whole period later: 0, never -0
});

test('an active island rises a pixel every LIFT_STEP_MS up to LIFT, and sinks back the same way', () => {
  assert.equal(liftAt(true, 0, 1000, 1000), 0);
  assert.equal(liftAt(true, 0, 1000, 1000 + LIFT_STEP_MS - 1), 0);
  assert.equal(liftAt(true, 0, 1000, 1000 + LIFT_STEP_MS), 1);
  assert.equal(liftAt(true, 0, 1000, 1000 + 10 * LIFT_STEP_MS), LIFT);
  assert.equal(liftAt(true, 2, 1000, 1000 + LIFT_STEP_MS), 3);
  assert.equal(liftAt(false, LIFT, 1000, 1000 + 2 * LIFT_STEP_MS), LIFT - 2);
  assert.equal(liftAt(false, LIFT, 1000, 1000 + 10 * LIFT_STEP_MS), 0);
  assert.equal(liftAt(true, 0, 1000, 900), 0); // a clock that seems to go backwards changes nothing
});

test('animation frames loop', () => {
  assert.equal(frameAt(0, 8, 150), 0);
  assert.equal(frameAt(149, 8, 150), 0);
  assert.equal(frameAt(150, 8, 150), 1);
  assert.equal(frameAt(8 * 150 - 1, 8, 150), 7);
  assert.equal(frameAt(8 * 150, 8, 150), 0);
});

test('clouds drift in whole pixels and wrap at their strip width', () => {
  assert.equal(drift(0, 4, 384), 0);
  assert.equal(drift(999, 4, 384), 3);
  assert.equal(drift(1000, 4, 384), 4);
  assert.equal(drift(100000, 4, 384), 400 % 384);
});

test('hash is deterministic, in [0, 1), and spreads out', () => {
  let sum = 0;
  for (let i = 0; i < 2000; i++) {
    const h = hash(i, 3);
    assert.ok(h >= 0 && h < 1);
    assert.equal(h, hash(i, 3));
    sum += h;
  }
  assert.ok(Math.abs(sum / 2000 - 0.5) < 0.05);
  assert.notEqual(hash(1, 1), hash(1, 2));
  assert.notEqual(hash(1, 1), hash(2, 1));
});

test('twinkling stars sit in the upper sky, the same ones every frame', () => {
  const stars = twinkles(384, 216);
  assert.deepEqual(stars, twinkles(384, 216));
  for (const s of stars) {
    assert.ok(Number.isInteger(s.x) && s.x >= 0 && s.x < 384);
    assert.ok(Number.isInteger(s.y) && s.y >= 0 && s.y < 216 * 0.6);
    for (let t = 0; t < 5000; t += 97) assert.ok([0, 1, 2].includes(twinkleFrame(t, s)));
  }
});

test('a bird crosses the day sky now and then, in whole pixels, the way it faces', () => {
  assert.equal(birdAt(BIRD_MS, 384, 216), null);
  assert.equal(birdAt(BIRD_EVERY - 1, 384, 216), null);
  const a = birdAt(BIRD_EVERY + 1000, 384, 216);
  const b = birdAt(BIRD_EVERY + 5000, 384, 216);
  assert.ok(a && b);
  for (const p of [a, b]) assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y) && p.y >= 0 && p.y < 216 / 2);
  assert.ok((b.x - a.x) * a.dir > 0);
});

test('shooting stars are rare and brief, and fall down and to the left', () => {
  let cycle = 0;
  while (!shootingStarAt(cycle * STAR_EVERY, 384, 216)) cycle++;
  assert.ok(cycle < 10, 'one turns up within ten cycles');
  const start = shootingStarAt(cycle * STAR_EVERY, 384, 216);
  const later = shootingStarAt(cycle * STAR_EVERY + 300, 384, 216);
  const d = Math.floor(300 * STAR_SPEED);
  assert.deepEqual([later.x, later.y], [start.x - d, start.y + d]);
  assert.equal(shootingStarAt(cycle * STAR_EVERY + STAR_MS, 384, 216), null);
  const seen = Array.from({ length: 50 }, (_, i) => shootingStarAt(i * STAR_EVERY, 384, 216)).filter(Boolean).length;
  assert.ok(seen > 5 && seen < 50, `${seen} of 50 cycles have one`);
});
