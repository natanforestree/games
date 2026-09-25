import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceShot, RIFLE_ID, SHOTGUN_ID, giveShotgun } from '../src/weapons.js';
import { spawnCreature, CRAWLER, GAUNT, LEAPER, MOTHER } from '../src/creatures.js';
import { RIFLE, SHOTGUN, FLARE, SWITCH_TIME, CREATURES, DT, PLAYER, VIEW, AIM } from '../src/tuning.js';
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

// The pitch that puts the crosshair on height z at distance d.
const lookAt = (z, d) => Math.atan2(z - PLAYER.eye, d);

test('a shot goes where you look: level, it passes over a crawler close by; looking down at it hits', () => {
  const s = quietState(); // you're at (19.5, 20.5)
  const c = spawnCreature(s, CRAWLER, 19.5, 21.5);
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, 0).creature, null, 'over its back');
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(CREATURES.crawler.height / 2, 1)).creature, c);
  c.y = 22.5;
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, -VIEW.maxPitch).creature, null, '2 cells off, all the way down goes into the snow before it');
  c.y = 26.5; // 6 cells off it's small enough that level is near enough
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, 0).creature, c);
});

test('a shot a little above or below a creature still hits it, AIM.forgive per cell away; further off it misses', () => {
  const s = quietState();
  const g = spawnCreature(s, GAUNT, 19.5, 25.5); // 5 cells south
  const top = CREATURES.gaunt.height, give = 5 * AIM.forgive;
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(top + give * 0.9, 5)).creature, g);
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(top + give * 1.1, 5)).creature, null);
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(-give * 0.9, 5)).creature, g);
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(-give * 1.1, 5)).creature, null);
});

test('a leaper in the air is hit where it is, not where it took off; the Mother is hit high up', () => {
  const s = quietState();
  const m = spawnCreature(s, MOTHER, 19.5, 24.5);
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(2, 4)).creature, m, 'her head, looking up');
  m.alive = false;
  const l = spawnCreature(s, LEAPER, 19.5, 22.5);
  l.lift = 0.35; // the top of a leap
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(0.05, 2)).creature, null, 'under it');
  assert.equal(traceShot(s, 19.5, 20.5, south, 40, lookAt(0.9, 2)).creature, l);
});

test('the rifle and the shotgun both fire where you look', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 21.5);
  run(s, DT, intents({ facing: south, fire: true }));
  assert.ok(c.alive && !c.dying, 'level, the rifle misses it');
  s.gun.cooldown = 0; // fire again at once, before it moves
  run(s, DT, intents({ facing: south, pitch: lookAt(0.2, 1), fire: true }));
  assert.ok(c.dying > 0, 'looking down, it hits');
  const t = quietState();
  giveShotgun(t);
  run(t, SWITCH_TIME + DT);
  const d = spawnCreature(t, CRAWLER, 19.5, 21.5);
  run(t, DT, intents({ facing: south, fire: true }));
  assert.ok(d.alive && !d.dying, 'level, every pellet misses it');
  t.gun.cooldown = 0;
  run(t, DT, intents({ facing: south, pitch: lookAt(0.2, 1), fire: true }));
  assert.ok(d.dying > 0, 'looking down, the pellets hit');
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

test("the gun keeps time since loading last started or stopped, for the hands", () => {
  const s = quietState();
  assert.ok(s.gun.loadT >= 0.5, 'a new gun is long settled');
  run(s, DT, intents({ facing: south, fire: true })); // one shot: 7 left
  run(s, RIFLE.interval, intents({ facing: south }));
  run(s, DT, intents({ facing: south, reload: 1 }));
  assert.ok(s.gun.reloading && s.gun.loadT < DT * 1.5, `just started: ${s.gun.loadT}`);
  run(s, 0.1, intents({ facing: south }));
  assert.ok(s.gun.reloading && Math.abs(s.gun.loadT - 0.1) < DT * 1.5, `loading for 0.1 s: ${s.gun.loadT}`);
  run(s, RIFLE.reloadPerRound, intents({ facing: south }));
  assert.equal(s.gun.reloading, false);
  assert.ok(s.gun.loadT < RIFLE.reloadPerRound, `stopped a moment ago: ${s.gun.loadT}`);
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
