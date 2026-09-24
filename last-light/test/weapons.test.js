import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceShot, RIFLE_ID, SHOTGUN_ID, giveShotgun } from '../src/weapons.js';
import { spawnCreature, CRAWLER, GAUNT } from '../src/creatures.js';
import { RIFLE, SHOTGUN, FLARE, SWITCH_TIME, CREATURES, DT } from '../src/tuning.js';
import { quietState, run, runCollecting, intents } from './helpers.js';

const south = Math.PI / 2;
const shots = (ev) => ev.filter((e) => e.type === 'shot').length;

test('the shot hits the nearest creature on the line, and walls stop it', () => {
  const s = quietState();
  const far = spawnCreature(s, GAUNT, 19.5, 28.5);
  const near = spawnCreature(s, GAUNT, 19.6, 24.5);
  assert.equal(traceShot(s, 19.5, 20.5, south, 40).creature, near);
  near.alive = false;
  assert.equal(traceShot(s, 19.5, 20.5, south, 40).creature, far);
  const behind = spawnCreature(s, CRAWLER, 19.5, 12.5); // behind the cabin's back wall
  assert.equal(traceShot(s, 19.5, 20.5, -Math.PI / 2, 40).creature, null);
  assert.ok(behind.alive);
});

test('holding fire shoots the rifle at its lever rate, 8 rounds, then it reloads by itself', () => {
  const s = quietState();
  const ev = runCollecting(s, RIFLE.interval * 7 + 0.01, intents({ facing: south, fire: true }));
  assert.equal(shots(ev), 8);
  assert.equal(s.gun.rifle, 0);
  assert.ok(s.gun.reloading);
  run(s, RIFLE.reloadPerRound * 8 + 0.02, intents({ facing: south }));
  assert.equal(s.gun.rifle, 8);
  assert.equal(s.gun.reloading, false);
});

test('reloading goes a round at a time, and firing interrupts it', () => {
  const s = quietState();
  run(s, RIFLE.interval * 3 + 0.01, intents({ facing: south, fire: true })); // 4 shots: 4 left
  assert.equal(s.gun.rifle, 4);
  run(s, DT, intents({ facing: south, reload: 1 }));
  run(s, RIFLE.reloadPerRound * 2 + 0.01, intents({ facing: south }));
  assert.equal(s.gun.rifle, 6);
  const ev = runCollecting(s, DT, intents({ facing: south, fire: true }));
  assert.equal(shots(ev), 1);
  assert.equal(s.gun.reloading, false);
  assert.equal(s.gun.rifle, 5);
});

test('a rifle shot kills a crawler, and a gaunt takes five', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 26.5);
  run(s, DT, intents({ facing: south, fire: true }));
  assert.ok(c.dying > 0);
  const t = quietState();
  const g = spawnCreature(t, GAUNT, 19.5, 30.5);
  let n = 0;
  while (!g.dying && n < 8) {
    run(t, RIFLE.interval, intents({ facing: south, fire: true }));
    n++;
  }
  assert.equal(n, Math.ceil(CREATURES.gaunt.health / RIFLE.damage));
});

test('the shotgun: 8 pellets, both barrels, full damage close and half past 4 cells', () => {
  const s = quietState();
  giveShotgun(s);
  run(s, SWITCH_TIME + DT);
  assert.equal(s.gun.current, SHOTGUN_ID);
  assert.deepEqual([s.gun.shells, s.gun.spare], [2, SHOTGUN.foundWith - 2]);
  const near = spawnCreature(s, GAUNT, 19.5, 22.5);
  run(s, DT, intents({ facing: south, fire: true }));
  assert.ok(near.dying > 0, 'a point-blank blast kills a gaunt');
  const t = quietState();
  giveShotgun(t);
  run(t, SWITCH_TIME + DT);
  const far = spawnCreature(t, GAUNT, 19.5, 26.5);
  run(t, DT, intents({ facing: south, fire: true }));
  const taken = CREATURES.gaunt.health - far.hp;
  assert.ok(taken > 0 && taken <= (SHOTGUN.pellets * SHOTGUN.damage) / 2, `took ${taken}`);
});

test('an empty shotgun reloads both shells from the spares; with none left it goes back to the rifle', () => {
  const s = quietState();
  giveShotgun(s);
  run(s, SWITCH_TIME + DT);
  run(s, SHOTGUN.interval * 2, intents({ facing: south, fire: true }));
  assert.equal(s.gun.shells, 0);
  assert.ok(s.gun.reloading);
  run(s, SHOTGUN.reload + 0.02);
  assert.deepEqual([s.gun.shells, s.gun.spare], [2, SHOTGUN.foundWith - 4]);
  s.gun.shells = 0;
  s.gun.spare = 0;
  s.gun.reloading = false;
  run(s, SWITCH_TIME + 0.05, intents({ facing: south, fire: true }));
  assert.equal(s.gun.current, RIFLE_ID);
});

test('switching takes a moment, you cannot fire during it, and pressing again does not restart it', () => {
  const s = quietState();
  giveShotgun(s);
  run(s, SWITCH_TIME / 2, intents({ facing: south, weapon: 2 }));
  assert.equal(s.gun.current, RIFLE_ID);
  const ev = runCollecting(s, SWITCH_TIME / 2 - 2 * DT, intents({ facing: south, weapon: 2, fire: true }));
  assert.equal(shots(ev), 0);
  run(s, 3 * DT, intents({ facing: south, weapon: 2 }));
  assert.equal(s.gun.current, SHOTGUN_ID);
  run(s, DT, intents({ facing: south, weapon: 2 }));
  assert.equal(s.gun.switching, 0, 'asking for the gun you hold does nothing');
});

test('a flare lands ahead of you, or just short of a wall, and burns out', () => {
  const s = quietState();
  run(s, DT, intents({ facing: south, flare: 1 }));
  const f = s.flares.find((x) => x.t > 0);
  assert.ok(Math.abs(f.y - (20.5 + FLARE.throw)) < 1e-9);
  assert.equal(s.gun.flares, FLARE.start - 1);
  const t = quietState();
  t.player.x = t.player.px = 17.5; // facing the window, 1.5 cells away
  run(t, DT, intents({ facing: -Math.PI / 2, flare: 1 }));
  const g = t.flares.find((x) => x.t > 0);
  assert.ok(Math.abs(g.y - 19.3) < 1e-6, `landed at ${g.y}`);
  const ev = runCollecting(s, FLARE.burn);
  assert.ok(ev.some((e) => e.type === 'flareOut'));
});

test('no flares, no throw; and one throw per press, however long the button is held', () => {
  const s = quietState();
  s.gun.flares = 0;
  run(s, DT, intents({ flare: 1 }));
  assert.ok(s.flares.every((f) => f.t <= 0));
});

test('every shot kicks the view, and the kick springs back', () => {
  const s = quietState();
  run(s, DT, intents({ facing: south, fire: true }));
  const k = s.gun.kick;
  assert.ok(k > 0);
  run(s, 0.4, intents({ facing: south }));
  assert.ok(s.gun.kick < k * 0.02);
});
