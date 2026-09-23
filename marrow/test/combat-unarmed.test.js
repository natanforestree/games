import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T } from '../src/tuning.js';
import { isActive } from '../src/fighter.js';
import { kill } from '../src/combat.js';
import { duel, run, keys, NONE } from './helpers.js';

test('a dive kick into a high blade kills the kicker', () => {
  const s = duel({ x0: 110, x1: 140, stance1: 2 });
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'divekick', y: 120 });
  run(s, 6);
  assert.equal(a.state, 'dead');
  assert.ok(isActive(b) && b.armed);
});

test('a dive kick that would also land is not applied on the tick its kicker dies', () => {
  const s = duel({ x0: 126, x1: 140, stance1: 2 });
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'divekick', y: 130 });
  run(s, 3);
  assert.equal(a.state, 'dead');
  assert.equal(b.state, 'stand');
  assert.equal(b.armed, true);
});

test('a dive kick into a body knocks it down and disarms it', () => {
  const s = duel({ x0: 110, x1: 140, stance1: 0 });
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'divekick', y: 112 });
  const ev = run(s, 6);
  assert.ok(ev.some((e) => e.type === 'kick'));
  assert.equal(b.state, 'knocked');
  assert.equal(b.armed, false);
  assert.ok(isActive(a));
});

test('a sweep knocks down and disarms a standing opponent', () => {
  const s = duel({ x0: 128, x1: 140, stance1: 2 });
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'crouch', armed: false });
  run(s, 1, keys('down attack'));
  assert.equal(a.state, 'sweep');
  run(s, 10, keys('down'));
  assert.equal(b.state, 'knocked');
  assert.equal(b.armed, false);
  assert.ok(isActive(a));
});

test('a sweep knocks a hanging fighter off the ledge', () => {
  const s = duel({ screen: 5, x0: 256, y: 110, x1: 246, y1: 132 }); // sweeper on the pillar, target hanging from its corner
  const [a, b] = s.fighters;
  Object.assign(a, { state: 'crouch', armed: false, facing: -1 });
  Object.assign(b, { state: 'ledge', facing: 1, ledge: { side: 1, col: 25, top: 110, cornerX: 250 } });
  run(s, 1, keys('down attack'));
  run(s, 10, keys('down'));
  assert.equal(b.state === 'air' || b.state === 'stand', true, `state ${b.state}`);
  assert.equal(b.ledge, null);
});

test('two punches in quick succession knock the opponent down', () => {
  const s = duel({ x0: 100, x1: 110 });
  const [a, b] = s.fighters;
  a.armed = false;
  b.armed = false;
  const ev = run(s, 40, (i) => (i === 0 || i === 20 ? keys('attack') : NONE));
  assert.equal(b.state, 'knocked');
  assert.ok(ev.some((e) => e.type === 'knockdown'));
});

test('two punches further apart than PUNCH_COMBO_WINDOW only stun each time', () => {
  const s = duel({ x0: 100, x1: 110 });
  const [a, b] = s.fighters;
  a.armed = false;
  b.armed = false;
  const gap = T.PUNCH_COMBO_WINDOW + 20;
  const ev = run(s, gap + 12, (i) => (i === 0 || i === gap ? keys('attack') : NONE));
  assert.deepEqual(ev.filter((e) => e.type === 'punch' || e.type === 'knockdown').map((e) => e.type), ['punch', 'punch']);
  assert.equal(b.state, 'stand');
});

test('one punch only stuns', () => {
  const s = duel({ x0: 100, x1: 110 });
  const [a, b] = s.fighters;
  a.armed = false;
  b.armed = false;
  run(s, 12, (i) => (i === 0 ? keys('attack') : NONE));
  assert.equal(b.state, 'stand');
  assert.ok(b.stunT > 0);
});

test('an unarmed Attack over a downed fighter snaps their neck; they cannot get up meanwhile', () => {
  const s = duel({ x0: 100, x1: 108 });
  const [a, b] = s.fighters;
  a.armed = false;
  Object.assign(b, { state: 'knocked', t: T.KNOCKDOWN_TICKS + 5, armed: false });
  run(s, 1, keys('attack'), keys('up'));
  assert.equal(a.state, 'necksnap');
  assert.equal(b.heldBy, 0);
  const ev = run(s, T.NECKSNAP_TICKS, NONE, keys('up'));
  assert.equal(b.state, 'dead');
  assert.ok(ev.some((e) => e.type === 'kill' && e.cause === 'necksnap'));
});

test('a neck snap is broken off when the snapper is interrupted', () => {
  const s = duel({ x0: 100, x1: 108 });
  const [a, b] = s.fighters;
  a.armed = false;
  Object.assign(b, { state: 'knocked', t: T.KNOCKDOWN_TICKS + 5, armed: false });
  run(s, 1, keys('attack'), keys('up'));
  assert.equal(a.state, 'necksnap');
  run(s, 5, NONE, keys('up'));
  kill(s, a, 'test'); // the snapper is interrupted mid-snap
  const ev = run(s, T.NECKSNAP_TICKS + 10, NONE, keys('up'));
  assert.equal(b.heldBy, null);
  assert.equal(b.state, 'stand');
  assert.ok(isActive(b));
  assert.ok(!ev.some((e) => e.type === 'kill' && e.cause === 'necksnap'));
});

test('a neck snap ends when its victim is gone some other way, instead of leaving the snapper stuck', () => {
  const s = duel({ x0: 100, x1: 108 });
  const [a, b] = s.fighters;
  a.armed = false;
  Object.assign(b, { state: 'knocked', t: T.KNOCKDOWN_TICKS + 5, armed: false });
  run(s, 1, keys('attack'), keys('up'));
  assert.equal(a.state, 'necksnap');
  run(s, 5, NONE, keys('up'));
  kill(s, b, 'pit'); // the held victim is gone some other way mid-snap
  run(s, 2, keys('right')); // even while still holding a direction, the snapper isn't left stuck
  assert.notEqual(a.state, 'necksnap');
});

test('a downed fighter dies to a low blade; a mid blade passes over', () => {
  for (const [stance, dies] of [[0, true], [1, false]]) {
    const s = duel({ x0: 100, x1: 120, stance0: stance });
    const b = s.fighters[1];
    Object.assign(b, { state: 'knocked', t: 0, armed: false });
    run(s, 1);
    assert.equal(b.state === 'dead', dies, `stance ${stance}`);
  }
});
