import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step } from '../src/sim.js';
import { SCREENS } from '../src/level.js';
import * as P from '../src/physics.js';
import { isActive, setStance } from '../src/fighter.js';
import { edgesOpen } from '../src/match.js';
import { createAI, aiIntent, LADDER } from '../src/ai.js';
import { duel, NONE } from './helpers.js';

function play(p0, p1, seed, maxTicks = 216000, each = () => {}) {
  const s = createState();
  const ais = [createAI(0, p0, seed), createAI(1, p1, seed + 1000)];
  for (let i = 0; i < maxTicks && s.phase !== 'over'; i++) {
    step(s, ais.map((ai) => aiIntent(ai, s)));
    each(s);
  }
  return s;
}

for (const [i, name] of LADDER.entries()) {
  test(`a CPU-vs-CPU match against the ${name} reaches a winner`, () => {
    const s = play('shifter', name, 11 + i);
    assert.equal(s.phase, 'over', `still on ${SCREENS[s.screen].name} after an hour of game time`);
    assert.ok(s.winner === 0 || s.winner === 1);
  });
}

test('in CPU play nobody ever ends up inside a wall or the floor', () => {
  play('shifter', 'shifter', 5, 20000, (s) => {
    if (s.phase === 'slide') return;
    for (const f of s.fighters) {
      if (!isActive(f)) continue;
      assert.ok(P.fits(f, f.state, SCREENS[s.screen], edgesOpen(s, f)), `fighter ${f.id} in ${f.state} at ${f.x.toFixed(1)},${f.y.toFixed(1)} on ${SCREENS[s.screen].name}`);
    }
  });
});

test('the same seeds replay the same match', () => {
  const a = play('rusher', 'waiter', 3, 5000);
  const b = play('rusher', 'waiter', 3, 5000);
  assert.deepEqual(a.fighters.map((f) => [f.x, f.y, f.state]), b.fighters.map((f) => [f.x, f.y, f.state]));
});

test('the CPU fights: a rusher kills a fighter who stands still', () => {
  const s = createState();
  const ai = createAI(1, 'rusher', 9);
  for (let i = 0; i < 1200 && s.arrow === null; i++) step(s, [undefined, aiIntent(ai, s)]);
  assert.equal(s.arrow, 1);
});

test('the Waiter hunts for draw disarms: it runs in and stops with its blade across a still low blade', () => {
  const drew = (seed) => {
    const s = createState();
    setStance(s.fighters[0], 0, true); // the player holds a low stance and never moves
    const ai = createAI(1, 'waiter', seed);
    for (let i = 0; i < 600; i++) {
      step(s, [undefined, aiIntent(ai, s)]);
      // the stop itself draws (drawT 0), not a walk-in during the draw window afterwards
      if (s.events.some((e) => e.type === 'disarm' && e.kind === 'draw' && e.by === 1)) return s.fighters[1].drawT === 0;
    }
    return false;
  };
  assert.ok([1, 2, 3, 4, 5, 6].some(drew), 'no draw disarm from a stop in 10 s for any of the seeds');
});

test('the Waiter never throws its sword, not even by an Attack just after an Up (the throw chord)', () => {
  const throws = [];
  for (let seed = 1; seed <= 12; seed++) {
    for (const p0 of [null, 'rusher', 'shifter']) { // null: a player who stands still
      const s = createState();
      const ais = [p0 && createAI(0, p0, seed), createAI(1, 'waiter', seed + 1000)];
      for (let i = 0; i < 3600 && s.phase !== 'over'; i++) {
        step(s, ais.map((ai) => ai && aiIntent(ai, s)));
        if (s.events.some((e) => e.type === 'throw' && e.id === 1)) throws.push(`${p0 ?? 'still player'}, seed ${seed}, tick ${s.tick}`);
      }
    }
  }
  assert.deepEqual(throws, []);
});

test('a standoff across a wall ends: after 15 s without a kill, a CPU goes over it', () => {
  const s = createState({ screen: 5 }); // B2+: the low step (x 150-210) stands between the two start spots
  assert.ok(s.fighters[0].x < 150 && s.fighters[1].x > 210);
  const ais = [createAI(0, 'waiter', 1), createAI(1, 'waiter', 2)]; // Waiters never throw or jump on their own
  let killed = false;
  for (let i = 0; i < 1800 && !killed; i++) {
    step(s, ais.map((ai) => aiIntent(ai, s)));
    killed = s.events.some((e) => e.type === 'kill');
  }
  assert.ok(killed, `no kill in 30 s; the fighters are at ${s.fighters.map((f) => `${f.x.toFixed(1)},${f.y}`).join(' and ')}`);
});

test("a kill resets both CPUs' calm timers, the dead one's too", () => {
  const s = duel({ x0: 100, x1: 120, stance0: 0 }); // the player's low blade already reaches the CPU's body
  const ai = createAI(1, 'waiter', 1);
  ai.calmT = 5000; // deep into a standoff
  step(s, [NONE, aiIntent(ai, s)]);
  assert.equal(s.fighters[1].state, 'dead');
  const killedAt = s.tick;
  while (!isActive(s.fighters[1])) step(s, [NONE, aiIntent(ai, s)]);
  assert.ok(ai.calmT <= s.tick - killedAt, `calmT ${ai.calmT} after respawning, ${s.tick - killedAt} ticks after the kill`);
});
