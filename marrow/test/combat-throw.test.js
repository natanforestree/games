import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActive } from '../src/fighter.js';
import { duel, alone, run, keys, NONE, has } from './helpers.js';

// The player throws at the CPU from 140px away; the CPU does whatever `cpu` holds.
function throwAt(stance1, cpu = NONE, setup = () => {}) {
  const s = duel({ x0: 60, x1: 200, stance1 });
  setup(s);
  const ev = run(s, 40, (i) => (i === 0 ? keys('up attack') : NONE), cpu);
  return { s, ev, b: s.fighters[1] };
}

for (const [stance, name] of [[1, 'mid'], [2, 'high']]) {
  test(`a ${name} blade deflects a thrown sword, which falls to the floor`, () => {
    const { s, ev, b } = throwAt(stance);
    assert.ok(has(ev, 'throw') && has(ev, 'deflect'));
    assert.ok(isActive(b) && b.armed);
    run(s, 60);
    assert.equal(s.swords[0].state, 'floor');
  });
}

test('a thrown sword kills a fighter in low stance', () => {
  const { ev, b } = throwAt(0);
  assert.equal(b.state, 'dead');
  assert.ok(ev.some((e) => e.type === 'kill' && e.id === 1 && e.cause === 'thrown'));
});

test('a thrown sword flies over a ducking fighter', () => {
  const { b } = throwAt(0, keys('down'), (s) => { s.fighters[1].state = 'crouch'; });
  assert.ok(isActive(b));
  assert.equal(b.state, 'crouch');
});

test('a thrown sword passes over a crawling fighter', () => {
  const { s, b } = throwAt(0, keys('down right'), (st) => { st.fighters[1].state = 'crawl'; });
  assert.ok(isActive(b));
  assert.equal(b.state, 'crawl');
  assert.equal(s.swords[0].state, 'thrown');
  assert.ok(s.swords[0].x > b.x, `sword at ${s.swords[0].x} should have flown past the fighter at ${b.x}`);
});

test('a wall stops a thrown sword and drops it to the floor', () => {
  const s = alone({ screen: 5, x: 225 }); // B2+: the pillar's face is at x = 250
  const ev = run(s, 1, keys('up attack'));
  const more = run(s, 40);
  assert.ok(has(ev.concat(more), 'swordwall'));
  assert.equal(s.swords[0].state, 'floor');
  assert.ok(s.swords[0].x < 250);
});
