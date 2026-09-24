import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, skyAt, phaseAt, skyFor, weights, dominant } from '../sky.js';

test('away from a boundary the sky is one phase', () => {
  assert.deepEqual(skyAt(12), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyAt(6.5), { from: 'dawn', to: 'dawn', t: 0 });
  assert.deepEqual(skyAt(18.5), { from: 'dusk', to: 'dusk', t: 0 });
  assert.deepEqual(skyAt(23), { from: 'night', to: 'night', t: 0 });
  assert.deepEqual(skyAt(2), { from: 'night', to: 'night', t: 0 });
});

test('each boundary crossfades over the half hour centred on it', () => {
  assert.deepEqual(skyAt(4.75), { from: 'night', to: 'dawn', t: 0 });
  assert.deepEqual(skyAt(5), { from: 'night', to: 'dawn', t: 0.5 });
  assert.deepEqual(skyAt(5.25), { from: 'dawn', to: 'dawn', t: 0 });
  assert.deepEqual(skyAt(8), { from: 'dawn', to: 'day', t: 0.5 });
  assert.deepEqual(skyAt(17), { from: 'day', to: 'dusk', t: 0.5 });
  assert.deepEqual(skyAt(19.875), { from: 'dusk', to: 'night', t: 0.25 });
});

test('the clock wraps round midnight', () => {
  assert.deepEqual(skyAt(0), { from: 'night', to: 'night', t: 0 });
  assert.deepEqual(skyAt(24), skyAt(0));
  assert.deepEqual(skyAt(-1), skyAt(23));
  assert.equal(phaseAt(23.99), 'night');
  assert.equal(phaseAt(4.99), 'night');
  assert.equal(phaseAt(5), 'dawn');
});

test('through a whole day the crossfade only ever moves on to the next phase', () => {
  for (let m = 0; m < 24 * 60; m++) {
    const { from, to, t } = skyAt(m / 60);
    assert.ok(t >= 0 && t < 1, `t at minute ${m}`);
    if (from === to) assert.equal(t, 0);
    else assert.equal(PHASES[(PHASES.indexOf(from) + 1) % PHASES.length], to);
  }
});

test('?time= pins the sky to a phase; anything else follows the clock', () => {
  const noon = new Date(2026, 8, 23, 12, 0, 0);
  const eight = new Date(2026, 8, 23, 20, 0, 0);
  assert.deepEqual(skyFor('?time=dusk', noon), { from: 'dusk', to: 'dusk', t: 0 });
  assert.deepEqual(skyFor('?time=night&x=1', noon), { from: 'night', to: 'night', t: 0 });
  assert.deepEqual(skyFor('', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('?time=noon', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('?time=DUSK', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('?time=', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('', eight), { from: 'dusk', to: 'night', t: 0.5 });
});

test('weights say how much of each phase shows; dominant picks the bigger', () => {
  assert.deepEqual(weights({ from: 'day', to: 'day', t: 0 }), { dawn: 0, day: 1, dusk: 0, night: 0 });
  assert.deepEqual(weights({ from: 'night', to: 'dawn', t: 0.25 }), { dawn: 0.25, day: 0, dusk: 0, night: 0.75 });
  assert.equal(dominant({ from: 'night', to: 'dawn', t: 0.25 }), 'night');
  assert.equal(dominant({ from: 'night', to: 'dawn', t: 0.5 }), 'dawn');
});
