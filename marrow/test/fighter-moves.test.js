import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T } from '../src/tuning.js';
import { SCREENS } from '../src/level.js';
import * as P from '../src/physics.js';
import { alone, run, keys, NONE } from './helpers.js';

test('falling past a ledge corner grabs it; Up climbs on top', () => {
  const s = alone({ screen: 5, x: 246, y: 120 }); // B2+: right beside the pillar, whose top is y = 110
  const f = s.fighters[0];
  Object.assign(f, { state: 'air', vy: 0.5 });
  for (let i = 0; i < 20 && f.state !== 'ledge'; i++) run(s, 1);
  assert.equal(f.state, 'ledge');
  assert.equal(f.x, 246);
  assert.equal(f.y, 132);
  run(s, 1, keys('up'));
  run(s, T.CLIMB_TICKS);
  assert.equal(f.state, 'stand');
  assert.equal(f.y, 110);
  assert.equal(f.x, 255);
});

test('Down lets go of a ledge, without grabbing it again on the way down', () => {
  const s = alone({ screen: 5, x: 246, y: 132 });
  const f = s.fighters[0];
  Object.assign(f, { state: 'ledge', ledge: { side: 1, col: 25, top: 110, cornerX: 250 } });
  run(s, 1, keys('down'));
  assert.equal(f.state, 'air');
  run(s, 40);
  assert.equal(f.state, 'stand');
  assert.equal(f.y, 150);
});

test('jumping into a wall clings to it and slides down slowly', () => {
  const s = alone({ screen: 4, x: 50, y: 100 }); // B1+: the tunnel's face is at x = 60, from y = 0 to 120
  const f = s.fighters[0];
  Object.assign(f, { state: 'air', vx: T.RUN_SPEED, vy: 0 });
  run(s, 5);
  assert.equal(f.state, 'wallcling');
  assert.equal(f.wallDir, 1);
  const y = f.y;
  run(s, 10);
  assert.equal(f.state, 'wallcling');
  assert.ok(f.y - y <= 10 * T.WALL_SLIDE_SPEED + 1e-9);
});

test('Jump on a wall leaps away from it', () => {
  const s = alone({ screen: 4, x: 50, y: 100 });
  const f = s.fighters[0];
  Object.assign(f, { state: 'air', vx: T.RUN_SPEED, vy: 0 });
  run(s, 5);
  run(s, 1, keys('jump'));
  assert.equal(f.state, 'air');
  assert.equal(f.vx, -T.WALL_JUMP_SPEED);
  assert.equal(f.vy, T.JUMP_VELOCITY);
});

test('a running jump at the pillar clings, runs up the wall, and ends on top', () => {
  const s = alone({ screen: 5, x: 225 });
  const f = s.fighters[0];
  Object.assign(f, { state: 'run', moveDir: 1, moveT: 30 });
  run(s, 1, keys('right'));
  run(s, 1, keys('right jump'));
  let clung = false;
  for (let i = 0; i < 120 && !(f.onGround && f.y === 110); i++) {
    run(s, 1, i % 2 ? keys('right up') : keys('right'));
    clung ||= f.state === 'wallcling';
  }
  assert.ok(clung, 'clung to the wall on the way up');
  assert.equal(f.y, 110);
  assert.ok(f.x > 250 && f.x < 270);
});

test('a knockdown keeps you down for KNOCKDOWN_TICKS; then Up stands you up', () => {
  const s = alone({ x: 100 });
  const f = s.fighters[0];
  Object.assign(f, { state: 'knocked', t: 0 });
  run(s, T.KNOCKDOWN_TICKS - 1, keys('up'));
  assert.equal(f.state, 'knocked');
  run(s, 1, keys('up'));
  assert.equal(f.state, 'getup');
  run(s, T.GETUP_TICKS);
  assert.equal(f.state, 'stand');
});

test('a held fighter (neck snap in progress) cannot get up', () => {
  const s = alone({ x: 100 });
  const f = s.fighters[0];
  Object.assign(s.fighters[1], { state: 'necksnap', t: 0, x: 108, y: 150, armed: false }); // a real holder: combat.js drops holds whose holder isn't snapping
  Object.assign(f, { state: 'knocked', t: T.KNOCKDOWN_TICKS + 5, heldBy: 1 });
  run(s, 10, keys('up'));
  assert.equal(f.state, 'knocked');
});

test('rolling up from a knockdown picks up a sword on the floor', () => {
  const s = alone({ x: 100 });
  const f = s.fighters[0];
  Object.assign(f, { state: 'knocked', t: T.KNOCKDOWN_TICKS, armed: false });
  s.swords.push({ id: 9, state: 'floor', owner: null, x: 120, y: 150, vx: 0, vy: 0 });
  run(s, 1, keys('right'));
  assert.equal(f.state, 'rollup');
  run(s, T.ROLLUP_TICKS, NONE);
  assert.equal(f.armed, true);
  assert.equal(s.swords.length, 0);
  assert.equal(f.state, 'stand');
  assert.equal(f.stance, 0);
});

test('a roll started flush against a wall never overlaps it: the wider roll box settles out of the wall', () => {
  const s = alone({ screen: 5, x: 220 }); // B2+: the pillar's left face is at x = 250
  const f = s.fighters[0];
  let flush = false, rolled = false;
  for (let i = 0; i < 60; i++) {
    flush ||= f.state === 'run' && f.x === 246; // running into the pillar, pressed flat against it
    run(s, 1, flush ? keys('right down') : keys('right')); // Down while running rolls; holding it keeps it a roll
    rolled ||= f.state === 'roll';
    assert.ok(P.fits(f, f.state, SCREENS[s.screen]), `tick ${i}: ${f.state} at x = ${f.x} overlaps the pillar`);
  }
  assert.ok(flush, 'never got flush against the pillar');
  assert.ok(rolled, 'never rolled');
});
