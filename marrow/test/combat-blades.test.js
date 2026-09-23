import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActive } from '../src/fighter.js';
import { blade } from '../src/combat.js';
import { SCREENS } from '../src/level.js';
import { duel, run, keys, NONE, has } from './helpers.js';

test('level lunges clash: both are pushed back and nobody dies', () => {
  const s = duel({ x0: 100, x1: 130 });
  const [a, b] = s.fighters;
  const ev = run(s, 3, keys('attack'), keys('attack'));
  assert.ok(has(ev, 'clash'));
  assert.ok(isActive(a) && isActive(b) && a.armed && b.armed);
  assert.equal(a.state, 'stand');
  assert.equal(b.state, 'stand');
  assert.ok(b.x - a.x >= 30, `gap ${b.x - a.x}`); // 22 apart at the clash, then pushed 6 each
});

test('walking into a level blade stops at the crossing point', () => {
  const s = duel({ x0: 100, x1: 140 });
  const [a, b] = s.fighters;
  run(s, 17, keys('right'), NONE);
  assert.ok(isActive(a) && isActive(b));
  assert.ok(a.x - b.x + 32 <= 6 + 1e-9, 'mid blades cross by at most half their length');
  assert.ok(b.x > 140, 'the defender is pushed back too');
});

test('changing stance across a crossed blade knocks it out of their hand', () => {
  const s = duel({ x0: 100, x1: 126 }); // mid vs mid, crossed by 6px: half a mid blade
  const [a, b] = s.fighters;
  const ev = run(s, 1, keys('up'), NONE);
  assert.ok(ev.some((e) => e.type === 'disarm' && e.kind === 'stance' && e.id === 1));
  assert.equal(b.armed, false);
  assert.equal(a.armed, true);
  assert.equal(s.swords.length, 1);
  assert.equal(s.swords[0].state, 'loose');
  run(s, 60);
  assert.equal(s.swords[0].state, 'floor');
  assert.equal(s.swords[0].y, 150);
});

test('a stance change with only the tips touching is not a disarm', () => {
  const s = duel({ x0: 100, x1: 130 }); // crossed by 2px
  run(s, 4, keys('up'), NONE);
  assert.equal(s.fighters[1].armed, true);
});

for (const [stance, name] of [[0, 'low'], [2, 'high']]) {
  test(`coming out of a run into ${name}, level with their blade, disarms them`, () => {
    const s = duel({ x0: 125, x1: 150, stance0: stance, stance1: stance });
    const [a, b] = s.fighters;
    Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
    const ev = run(s, 1);
    assert.ok(ev.some((e) => e.type === 'disarm' && e.kind === 'draw'));
    assert.equal(b.armed, false);
    assert.ok(isActive(a) && isActive(b));
  });
}

test('coming out of a run into mid is a normal block, not a disarm', () => {
  const s = duel({ x0: 125, x1: 150 });
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  run(s, 1);
  assert.equal(b.armed, true);
  assert.ok(isActive(a) && isActive(b));
  assert.ok(b.x > 150, 'blades met and pushed apart');
});

test('a sword knocked up under the tunnel ceiling falls back to the floor', () => {
  const s = duel({ screen: 4, x0: 125, x1: 150, stance0: 2, stance1: 2 }); // B1+: the tunnel ceiling is at y = 120
  Object.assign(s.fighters[0], { state: 'run', moveDir: 1, moveT: 30 });
  run(s, 1); // a high draw disarm: the sword pops up from y = 132
  run(s, 60);
  assert.equal(s.swords[0].state, 'floor');
  assert.equal(s.swords[0].y, 150);
});

test('the low blade outreaches mid and high', () => {
  for (const other of [1, 2]) {
    const s = duel({ x0: 108, x1: 140, stance0: 0, stance1: other });
    const [a, b] = s.fighters;
    run(s, 16, keys('right'), NONE);
    assert.ok(isActive(a), `low survives against stance ${other}`);
    assert.equal(b.state, 'dead');
  }
});

test('running onto a still blade kills the runner', () => {
  const s = duel({ x0: 60, x1: 140 });
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  const ev = run(s, 60, keys('right'), NONE);
  assert.equal(a.state, 'dead');
  assert.ok(isActive(b));
  assert.ok(ev.some((e) => e.type === 'kill' && e.id === 0 && e.cause === 'blade'));
});

test('a roll passes under a mid blade but dies to a low one', () => {
  for (const [stance, dies] of [[1, false], [0, true]]) {
    const s = duel({ x0: 110, x1: 140, stance1: stance });
    const a = s.fighters[0];
    Object.assign(a, { state: 'roll', t: 0, facing: 1 });
    run(s, 12, keys('right down'), NONE); // Down stays held, so it stays a roll
    assert.equal(a.state === 'dead', dies, `rolling into stance ${stance}`);
    if (!dies) assert.ok(a.x > 136, 'rolled in under the blade');
  }
});

test('blades reaching both bodies in the same tick kill both', () => {
  const s = duel({ x0: 100, x1: 112, stance0: 0, stance1: 1 });
  run(s, 1);
  assert.equal(s.fighters[0].state, 'dead');
  assert.equal(s.fighters[1].state, 'dead');
  assert.equal(s.killsThisTick.length, 2);
});

test("a stance change across a lunging opponent's blade disarms them", () => {
  const s = duel({ x0: 100, x1: 126 }); // mid vs mid, crossed by 6px: half a mid blade
  const [a, b] = s.fighters;
  Object.assign(b, { state: 'lunge', t: 12 }); // in lunge recovery: still, but the blade stays live
  const ev = run(s, 1, keys('up'), NONE);
  assert.ok(ev.some((e) => e.type === 'disarm' && e.kind === 'stance' && e.id === 1 && e.by === 0));
  assert.equal(b.armed, false);
  assert.equal(a.armed, true);
  assert.equal(s.swords.length, 1);
  assert.equal(s.swords[0].state, 'loose');
});

test('coming out of a roll into a low stance level with their blade is a draw disarm', () => {
  const s = duel({ x0: 119.8, x1: 150, stance1: 0 }); // b stands in low; a rolls in to land level with it
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'roll', t: 23, facing: 1 }); // one tick from the roll's end
  const ev = run(s, 1);
  assert.ok(ev.some((e) => e.type === 'disarm' && e.kind === 'draw' && e.id === 1 && e.by === 0));
  assert.equal(a.state, 'stand');
  assert.equal(a.stance, 0);
  assert.equal(b.armed, false);
  assert.ok(isActive(a) && isActive(b));
});

test("blades don't meet through the B2 pillar", () => {
  const s = duel({ screen: 5, x0: 230, x1: 274, stance0: 0, stance1: 0 }); // B2+: a pillar spans cols 25-26, rows 11-14
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'run', moveDir: 1, moveT: 30 });
  const ev = run(s, 40, keys('right'), NONE); // a runs into the pillar and stops flush against it at x = 246: a draw
  assert.equal(a.x, 246);
  assert.equal(a.state, 'stand');
  assert.ok(!ev.some((e) => e.type === 'disarm' || e.type === 'clash'));
  assert.equal(a.armed, true);
  assert.equal(b.armed, true);
  assert.ok(isActive(a) && isActive(b));
});

test('blade(f, screen) is clipped at a solid tile; blade(f) alone is not', () => {
  const s = duel({ screen: 5, x0: 246, x1: 274, stance0: 0, stance1: 0 }); // a stands flush against the B2 pillar
  const [a] = s.fighters;
  const unclipped = blade(a);
  const clipped = blade(a, SCREENS[s.screen]);
  assert.ok(unclipped && unclipped.reach === 14, 'without a screen the blade reaches its full, unclipped length');
  assert.equal(clipped, null, 'with the screen, the pillar blocks it right at the hilt');
});
