import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T } from '../src/tuning.js';
import { bladeHeight } from '../src/fighter.js';
import { duel, run, keys, has } from './helpers.js';

// The player at x = 40 with the CPU far away, so nothing interferes.
const solo = (opts = {}) => duel({ x0: 40, x1: 300, ...opts });
const close = (a, b) => Math.abs(a - b) < 1e-6;

test('walks in stance, then breaks into a run after RUN_AFTER_TICKS', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, 10, keys('right'));
  assert.equal(f.state, 'stand');
  assert.ok(close(f.x, 40 + 10 * T.WALK_SPEED));
  run(s, T.RUN_AFTER_TICKS - 10, keys('right'));
  assert.equal(f.state, 'run');
  const x = f.x;
  run(s, 10, keys('right'));
  assert.ok(close(f.x, x + 10 * T.RUN_SPEED));
});

test('unarmed fighters break straight into a faster run', () => {
  const s = solo();
  const f = s.fighters[0];
  f.armed = false;
  run(s, 1, keys('right'));
  assert.equal(f.state, 'run');
  const x = f.x;
  run(s, 10, keys('right'));
  assert.ok(close(f.x, x + 10 * T.RUN_SPEED_UNARMED));
});

test('holding left and right together stands still', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, 30, keys('left right'));
  assert.equal(f.x, 40);
  assert.equal(f.state, 'stand');
});

test('Up and Down change stance, sweeping the blade over STANCE_CHANGE_TICKS', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, 1, keys('up'));
  assert.equal(f.stance, 2);
  assert.equal(bladeHeight(f), 13 + (18 - 13) / T.STANCE_CHANGE_TICKS);
  run(s, T.STANCE_CHANGE_TICKS);
  assert.equal(bladeHeight(f), 18);
  run(s, 1, keys('down'));
  run(s, 1);
  run(s, 1, keys('down'));
  assert.equal(f.stance, 0);
});

test('holding Down lowers the stance to low, then ducks; letting go stands', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, 4, keys('down'));
  assert.equal(f.state, 'stand');
  assert.equal(f.stance, 0);
  run(s, 1, keys('down'));
  assert.equal(f.state, 'crouch');
  run(s, 1);
  assert.equal(f.state, 'stand');
});

test('moving while ducked crawls', () => {
  const s = solo({ stance0: 0 });
  const f = s.fighters[0];
  run(s, 1, keys('down'));
  assert.equal(f.state, 'crouch');
  run(s, 1, keys('down right'));
  assert.equal(f.state, 'crawl');
  const x = f.x;
  run(s, 10, keys('down right'));
  assert.ok(close(f.x, x + 10 * T.CRAWL_SPEED));
});

test('a jump rises about 33px and lands back on its feet', () => {
  const s = solo();
  const f = s.fighters[0];
  let top = f.y;
  run(s, 1, keys('jump'));
  for (let i = 0; i < 60; i++) {
    run(s, 1);
    top = Math.min(top, f.y);
  }
  assert.ok(150 - top > 30 && 150 - top < 37, `apex ${150 - top}`);
  assert.equal(f.state, 'stand');
  assert.equal(f.y, 150);
});

test('a lunge steps forward LUNGE_STEP and returns to stance', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, 1, keys('attack'));
  assert.equal(f.state, 'lunge');
  run(s, T.LUNGE_STARTUP_TICKS + T.LUNGE_ACTIVE_TICKS + T.LUNGE_RECOVERY_TICKS);
  assert.equal(f.state, 'stand');
  assert.ok(close(f.x, 40 + T.LUNGE_STEP));
});

test('holding Down while running rolls about 50px and stands up in low stance', () => {
  const s = solo({ stance0: 2 });
  const f = s.fighters[0];
  Object.assign(f, { state: 'run', moveDir: 1, moveT: 30 });
  run(s, T.ROLL_TICKS + 1, keys('right down'));
  assert.equal(f.state, 'stand');
  assert.equal(f.stance, 0);
  assert.ok(close(f.x, 40 + T.ROLL_TICKS * T.ROLL_SPEED));
});

test('a quick tap of Down while running cartwheels and keeps the stance', () => {
  const s = solo({ stance0: 2 });
  const f = s.fighters[0];
  Object.assign(f, { state: 'run', moveDir: 1, moveT: 30 });
  run(s, 1, keys('right down'));
  run(s, 1, keys('right'));
  assert.equal(f.state, 'cartwheel');
  run(s, T.CARTWHEEL_TICKS);
  assert.equal(f.state, 'stand');
  assert.equal(f.stance, 2);
});

test('holding Up at high stance raises the throw pose; letting go returns to high', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, T.THROWPOSE_HOLD_TICKS, keys('up'));
  assert.equal(f.state, 'throwpose');
  run(s, 1);
  assert.equal(f.state, 'stand');
  assert.equal(f.stance, 2);
});

test('Attack in the throw pose throws the sword straight ahead', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, T.THROWPOSE_HOLD_TICKS, keys('up'));
  const ev = run(s, 1, keys('up attack'));
  assert.ok(has(ev, 'throw'));
  assert.equal(f.armed, false);
  assert.equal(s.swords[0].state, 'thrown');
  assert.equal(s.swords[0].vx, T.THROWN_SWORD_SPEED);
});

test('Up + Attack together throws instantly', () => {
  const s = solo();
  run(s, 1, keys('up attack'));
  assert.equal(s.fighters[0].armed, false);
  assert.equal(s.swords.length, 1);
});

test('no throw pose and no throw under the low tunnel ceiling', () => {
  const s = duel({ screen: 4, x0: 100, x1: 300 }); // B1+: the tunnel runs from x = 60 to 220
  const f = s.fighters[0];
  run(s, T.THROWPOSE_HOLD_TICKS + 5, keys('up'));
  assert.equal(f.state, 'stand');
  run(s, 1);
  run(s, 1, keys('up attack'));
  assert.equal(f.armed, true);
  assert.equal(s.swords.length, 0);
});

test('Attack in the air starts a dive kick at 45 degrees', () => {
  const s = solo();
  const f = s.fighters[0];
  run(s, 1, keys('jump'));
  run(s, 8);
  run(s, 1, keys('attack'));
  assert.equal(f.state, 'divekick');
  const { x, y } = f;
  run(s, 2);
  assert.ok(close(f.x - x, 2 * T.DIVEKICK_SPEED) && close(f.y - y, 2 * T.DIVEKICK_SPEED));
});

test('Down over a sword picks it up when unarmed', () => {
  const s = solo();
  const f = s.fighters[0];
  f.armed = false;
  s.swords.push({ id: 9, state: 'floor', owner: null, x: 43, y: 150, vx: 0, vy: 0 });
  const ev = run(s, 1, keys('down'));
  assert.ok(has(ev, 'pickup'));
  assert.equal(f.armed, true);
  assert.equal(s.swords.length, 0);
  assert.equal(f.state, 'stand');
});
