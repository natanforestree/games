import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T } from '../src/tuning.js';
import { SCREENS } from '../src/level.js';
import * as P from '../src/physics.js';
import { isActive } from '../src/fighter.js';
import { duel, run, keys, NONE, has } from './helpers.js';

function runnerIntoBlade() {
  const s = duel({ x0: 60, x1: 140 });
  Object.assign(s.fighters[0], { state: 'run', moveDir: 1, moveT: 30 });
  for (let i = 0; i < 100 && s.fighters[0].state !== 'dead'; i++) run(s, 1, keys('right'));
  return s;
}

test('a kill gives the killer the GO arrow', () => {
  const s = runnerIntoBlade();
  assert.equal(s.fighters[0].state, 'dead');
  assert.equal(s.arrow, 1);
});

test('the dead respawn after RESPAWN_TICKS, armed, RESPAWN_AHEAD in front of the arrow holder', () => {
  const s = runnerIntoBlade();
  const [a, b] = s.fighters;
  run(s, T.RESPAWN_TICKS - 2);
  assert.equal(a.state, 'dead');
  run(s, 1);
  assert.equal(a.state, 'stand');
  assert.ok(a.armed);
  assert.equal(a.x, b.x + b.dir * T.RESPAWN_AHEAD); // the CPU heads left, so in front of it is to its left
  assert.equal(a.facing, 1);
});

test('a double kill clears the arrow, and both come back at their starting spots', () => {
  const s = duel({ x0: 100, x1: 112, stance0: 0, stance1: 1 });
  s.arrow = 0;
  run(s, 1);
  assert.equal(s.arrow, null);
  run(s, T.RESPAWN_TICKS);
  assert.deepEqual(s.fighters.map((f) => [f.state, f.x]), [['stand', T.START_X[0]], ['stand', T.START_X[1]]]);
});

test('a key held through a respawn does nothing until it is pressed again', () => {
  const s = duel({ x0: 60, x1: 140 });
  const a = s.fighters[0];
  s.arrow = 1;
  Object.assign(a, { state: 'dead', respawnT: 3 });
  run(s, 10, keys('attack'));
  assert.equal(a.state, 'stand');
  run(s, 1);
  run(s, 1, keys('attack'));
  assert.equal(a.state, 'lunge');
});

test('a respawn that would land inside blade reach of the arrow holder is held, not thrown into it', () => {
  // Near the holder's own goal edge, RESPAWN_AHEAD clamps to SPAWN_MARGIN: too close to respawn into.
  const s = duel({ x0: 200, x1: 30 }); // the CPU holds the arrow near its goal edge
  const [a, b] = s.fighters;
  s.arrow = 1;
  Object.assign(a, { state: 'dead', respawnT: 1 });
  run(s, 1);
  assert.equal(a.state, 'dead'); // held, not respawned into blade range
  run(s, 10); // long enough for the unfixed bug's double kill to have already happened
  assert.equal(a.state, 'dead'); // still held: the holder hasn't moved
  assert.ok(isActive(b)); // no double kill from an unsafe respawn
  assert.equal(s.arrow, 1);
});

test('a held respawn happens once the arrow holder backs away from the edge', () => {
  const s = duel({ x0: 200, x1: 30 });
  const [a, b] = s.fighters;
  s.arrow = 1;
  Object.assign(a, { state: 'dead', respawnT: 1 });
  run(s, 5);
  assert.equal(a.state, 'dead'); // still too close
  run(s, 60, NONE, keys('right')); // the CPU steps back from its own goal edge
  assert.equal(a.state, 'stand');
  assert.ok(isActive(a) && isActive(b));
  assert.equal(s.arrow, 1);
  assert.ok(P.standableAt(SCREENS[3], a.x, a.y)); // lands on solid floor
});

test('a held respawn resumes once the holder leaves the screen (a slide)', () => {
  const s = duel({ x0: 200, x1: 30 }); // the CPU holds the arrow near its goal edge
  const [a, b] = s.fighters;
  s.arrow = 1;
  Object.assign(a, { state: 'dead', respawnT: 1 });
  Object.assign(b, { state: 'run', moveDir: -1, moveT: 30 });
  const ev = run(s, 40, NONE, keys('left'));
  assert.ok(has(ev, 'slide'));
  run(s, T.SCREEN_SLIDE_TICKS, NONE, keys('left'));
  assert.equal(s.phase, 'play');
  assert.equal(s.screen, 2); // the next screen toward the CPU's goal
  assert.equal(a.state, 'gone'); // the hold was replaced by the off-screen respawn timer
  run(s, T.OFFSCREEN_RESPAWN_TICKS);
  assert.equal(a.state, 'stand'); // appears on the new screen per the normal respawn rules
});

test('respawns never land over a pit', () => {
  const s = duel({ screen: 5, x0: 20, x1: 290 }); // B2+: 80px ahead of x = 20 is the middle of the pit
  const b = s.fighters[1];
  s.arrow = 0;
  Object.assign(b, { state: 'dead', respawnT: 1 });
  run(s, 1);
  assert.equal(b.state, 'stand');
  assert.ok(P.standableAt(SCREENS[5], b.x, b.y));
  assert.ok(b.x <= 66 || b.x >= 114, `respawned at ${b.x}`);
});

test('without the arrow, the screen edges are walls', () => {
  const s = duel({ x0: 300, x1: 40 });
  Object.assign(s.fighters[0], { state: 'run', moveDir: 1, moveT: 30 });
  run(s, 40, keys('right'));
  assert.equal(s.screen, 3);
  assert.ok(s.fighters[0].x <= 316 + 1e-9, `x = ${s.fighters[0].x}`);
});

test('only the arrow holder advances: off their goal edge, the screen slides to the next one', () => {
  const s = duel({ x0: 300, x1: 40 });
  const [a, b] = s.fighters;
  s.arrow = 0;
  Object.assign(b, { state: 'dead', respawnT: 999 });
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  const ev = run(s, 14, keys('right'));
  assert.ok(has(ev, 'slide'));
  assert.equal(s.phase, 'slide');
  assert.equal(b.state, 'gone');
  assert.equal(b.respawnT, T.OFFSCREEN_RESPAWN_TICKS);
  run(s, T.SCREEN_SLIDE_TICKS, keys('right'));
  assert.equal(s.phase, 'play');
  assert.equal(s.screen, 4);
  assert.ok(a.x < 20);
});

test('attack pressed during a slide does not fire on entry, until released and pressed again', () => {
  const s = duel({ x0: 300, x1: 40 });
  const [a, b] = s.fighters;
  s.arrow = 0;
  Object.assign(b, { state: 'dead', respawnT: 999 });
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  run(s, 14, keys('right'));
  assert.equal(s.phase, 'slide');
  run(s, T.SCREEN_SLIDE_TICKS, keys('right attack')); // attack first pressed mid-slide, held through entry
  assert.equal(s.phase, 'play');
  assert.equal(a.state, 'run'); // no lunge on entry
  run(s, 5, keys('right attack')); // still held: must not fire
  assert.equal(a.state, 'run');
  run(s, 1, keys('right')); // release attack
  run(s, 1, keys('right attack')); // press again
  assert.equal(a.state, 'lunge');
});

test('a fighter without the arrow who runs off-screen comes back after OFFSCREEN_RESPAWN_TICKS', () => {
  const s = duel({ x0: 300, x1: 100 });
  const a = s.fighters[0];
  s.arrow = 1;
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  run(s, 20, keys('right'));
  assert.equal(a.state, 'gone');
  assert.equal(s.screen, 3);
  run(s, T.OFFSCREEN_RESPAWN_TICKS);
  assert.equal(a.state, 'stand');
  assert.equal(a.x, 100 - T.RESPAWN_AHEAD);
});

test('falling into a pit is a death that hands the other fighter the arrow', () => {
  const s = duel({ screen: 5, x0: 90, x1: 290 }); // B2+: x = 90 is over the pit
  s.arrow = 0;
  Object.assign(s.fighters[0], { state: 'air', vy: 0 });
  const ev = run(s, 40);
  assert.ok(ev.some((e) => e.type === 'kill' && e.id === 0 && e.cause === 'pit'));
  assert.equal(s.arrow, 1);
});

test('entering V+ with the arrow wins for the player, and the Maw ends the match', () => {
  const s = duel({ screen: 5, x0: 305, x1: 40 });
  const [a, b] = s.fighters;
  s.arrow = 0;
  Object.assign(b, { state: 'dead', respawnT: 999 });
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  const ev = run(s, 40, keys('right'));
  assert.ok(has(ev, 'victory'));
  assert.equal(s.screen, 6);
  assert.equal(s.winner, 0);
  assert.equal(s.phase, 'maw');
  const more = run(s, T.MAW_DELAY_TICKS + T.MAW_TICKS);
  assert.ok(has(more, 'maw') && has(more, 'swallow'));
  assert.equal(s.phase, 'over');
  assert.ok(!isActive(b));
});

test('the Maw pins a winner still airborne, so it rises exactly under them', () => {
  const s = duel({ screen: 5, x0: 305, x1: 40 });
  const [a, b] = s.fighters;
  s.arrow = 0;
  Object.assign(b, { state: 'dead', respawnT: 999 });
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  for (let i = 0; i < 100 && s.phase !== 'maw'; i++) run(s, 1, keys('right'));
  assert.equal(s.phase, 'maw');
  run(s, T.MAW_DELAY_TICKS - 2); // just short of the freeze tick
  Object.assign(a, { state: 'air', vx: 1.6, vy: -3, onGround: false }); // caught mid-jump
  run(s, 2); // the tick the Maw is fixed at maw.x, pinning the winner
  const mawX = s.maw.x;
  assert.ok(mawX !== null);
  assert.notEqual(a.state, 'air'); // settled onto the floor once frozen
  run(s, T.MAW_SWALLOW_TICKS + 5);
  assert.ok(!isActive(a));
  assert.ok(Math.abs(a.x - mawX) <= 1, `x drifted to ${a.x}, maw at ${mawX}`);
});

test('entering V- with the arrow wins for the CPU', () => {
  const s = duel({ screen: 1, x0: 280, x1: 15 });
  const [a, b] = s.fighters;
  s.arrow = 1;
  Object.assign(a, { state: 'dead', respawnT: 999 });
  Object.assign(b, { state: 'run', moveDir: -1, moveT: 30, facing: -1 });
  run(s, 40, NONE, keys('left'));
  assert.equal(s.screen, 0);
  assert.equal(s.winner, 1);
});
