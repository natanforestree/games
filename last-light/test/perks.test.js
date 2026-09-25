// What each of the fire's upgrades does (their flags in state.perks), and burning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyUpgrade, UPGRADE_LIST } from '../src/upgrades.js';
import { giveShotgun, steadyReady, flareMax, SHOTGUN_ID } from '../src/weapons.js';
import { spawnCreature, igniteCreature, CRAWLER, GAUNT } from '../src/creatures.js';
import { createState } from '../src/sim.js';
import { RIFLE, SHOTGUN, FLARE, BURN, PERKS, CREATURES, EMBERS, SWITCH_TIME, DT } from '../src/tuning.js';
import { quietState, run, runCollecting, intents } from './helpers.js';

const south = Math.PI / 2;
const take = (s, key) => applyUpgrade(s, UPGRADE_LIST.findIndex((u) => u.key === key));
const shots = (ev) => ev.filter((e) => e.type === 'shot').length;
const hits = (ev) => ev.filter((e) => e.type === 'hit').length;
// A night held at dusk with the shotgun raised.
function withShotgun() {
  const s = quietState();
  giveShotgun(s);
  run(s, SWITCH_TIME + DT);
  assert.equal(s.gun.current, SHOTGUN_ID);
  return s;
}

test('Through-and-through: a rifle round carries on into the next creature on its line', () => {
  for (const pierce of [false, true]) {
    const s = quietState(); // on the porch, facing south
    const near = spawnCreature(s, GAUNT, 19.5, 23.5), far = spawnCreature(s, GAUNT, 19.5, 26.5);
    if (pierce) take(s, 'pierce');
    run(s, DT, intents({ facing: south, fire: true }));
    assert.equal(near.hp, CREATURES.gaunt.health - RIFLE.damage);
    assert.equal(far.hp, CREATURES.gaunt.health - (pierce ? RIFLE.damage : 0), `pierce ${pierce}`);
  }
});

test('Quick lever: the rifle fires every 0.3 s instead of 0.45', () => {
  const s = quietState();
  const ev = runCollecting(s, 1, intents({ facing: south, fire: true }));
  assert.equal(shots(ev), 3);
  const t = quietState();
  take(t, 'quickLever');
  assert.equal(t.gun.interval, PERKS.quickLever);
  assert.equal(shots(runCollecting(t, 1, intents({ facing: south, fire: true }))), 4);
});

test('Steady hands: after standing still half a second, a rifle shot does double damage', () => {
  const s = quietState();
  take(s, 'steady');
  const g = spawnCreature(s, GAUNT, 19.5, 26.5);
  run(s, PERKS.steady.still - 0.1, intents({ facing: south }));
  assert.equal(steadyReady(s), false, 'not yet');
  run(s, 0.2, intents({ facing: south }));
  assert.equal(steadyReady(s), true);
  run(s, DT, intents({ facing: south, fire: true }));
  assert.equal(g.hp, CREATURES.gaunt.health - RIFLE.damage * PERKS.steady.damage);
  // Walking (straight at it, so the aim holds): an ordinary shot.
  const t = quietState();
  take(t, 'steady');
  const h = spawnCreature(t, GAUNT, 19.5, 26.5);
  run(t, 0.3, intents({ facing: south, forward: 1 }));
  run(t, DT, intents({ facing: south, forward: 1, fire: true }));
  assert.equal(steadyReady(t), false);
  assert.equal(h.hp, CREATURES.gaunt.health - RIFLE.damage);
  // Without it, standing still changes nothing.
  const u = quietState();
  const k = spawnCreature(u, GAUNT, 19.5, 26.5);
  run(u, 1, intents({ facing: south }));
  run(u, DT, intents({ facing: south, fire: true }));
  assert.equal(k.hp, CREATURES.gaunt.health - RIFLE.damage);
});

test('Deep magazine: the rifle holds 12, the new rounds come loaded, and it reloads to 12', () => {
  const s = quietState();
  run(s, DT, intents({ facing: south, fire: true })); // 7 left
  take(s, 'deepMagazine');
  assert.deepEqual([s.gun.rounds, s.gun.rifle], [PERKS.deepMagazine, 7 + PERKS.deepMagazine - RIFLE.rounds]);
  run(s, DT, intents({ facing: south, reload: 1 }));
  run(s, RIFLE.reloadPerRound * 2 + 0.05, intents({ facing: south }));
  assert.equal(s.gun.rifle, 12);
  assert.equal(s.gun.reloading, false);
});

test('Deep magazine taken in the middle of a reload: the reload carries on up to 12', () => {
  const s = quietState();
  run(s, DT, intents({ facing: south, fire: true }));
  run(s, RIFLE.interval, intents({ facing: south }));
  run(s, DT, intents({ facing: south, fire: true })); // 6 left
  run(s, DT, intents({ facing: south, reload: 1 }));
  assert.ok(s.gun.reloading);
  take(s, 'deepMagazine'); // 6 + 4 = 10
  run(s, RIFLE.reloadPerRound * 2 + 0.05, intents({ facing: south }));
  assert.deepEqual([s.gun.rifle, s.gun.reloading], [12, false]);
});

test('Slugs: one heavy ball, full damage at any range, instead of 8 pellets', () => {
  const s = withShotgun();
  take(s, 'slugs');
  const g = spawnCreature(s, GAUNT, 19.5, 30.5); // 10 cells: past the pellets' fall-off
  const ev = runCollecting(s, DT, intents({ facing: south, fire: true }));
  assert.equal(hits(ev), 1);
  assert.equal(g.hp, CREATURES.gaunt.health - PERKS.slug.damage);
});

test("Dragon's breath: shotgun hits set a creature burning; it burns quietly, and a burn kill counts and drops its ember", () => {
  const s = withShotgun();
  take(s, 'dragon');
  const g = spawnCreature(s, GAUNT, 19.5, 26.5); // 6 cells: the pellets' half damage leaves it standing
  const ev = runCollecting(s, DT, intents({ facing: south, fire: true }));
  assert.equal(ev.filter((e) => e.type === 'alight').length, 1, 'set alight once, however many pellets');
  assert.ok(Math.abs(g.burnT - BURN.time) < DT * 2);
  const hp = g.hp;
  g.flinch = 0;
  g.x = 30.5; // out of the way: 12 cells off, by the trees
  g.y = 26.5;
  const burning = runCollecting(s, 1);
  assert.ok(Math.abs(hp - g.hp - BURN.dps) < 0.1, `took ${hp - g.hp}`);
  assert.equal(hits(burning), 0, 'no hit sounds, ticks or spray while it burns');
  // A crawler set alight burns to death.
  const t = quietState();
  const c = spawnCreature(t, CRAWLER, 30.5, 26.5);
  igniteCreature(t, c);
  const dies = runCollecting(t, BURN.time);
  assert.ok(c.dying > 0 || !c.alive, 'burnt to death');
  assert.equal(t.stats.kills, 1);
  assert.deepEqual(dies.filter((e) => e.type === 'hit').map((e) => e.b), [1], 'one hit event: the kill');
  assert.ok(t.embers.some((e) => e.t > 0 && e.value === EMBERS.value.crawler));
});

test('burning stops after its time, and flare light makes it burn harder', () => {
  const s = quietState();
  const c = spawnCreature(s, GAUNT, 30.5, 26.5);
  igniteCreature(s, c);
  run(s, BURN.time + 0.5);
  const hp = c.hp;
  assert.ok(Math.abs(CREATURES.gaunt.health - hp - BURN.dps * BURN.time) < 0.1);
  run(s, 1);
  assert.equal(c.hp, hp, 'no longer burning');
  const t = quietState();
  const d = spawnCreature(t, GAUNT, 30.5, 26.5);
  t.flares[0].x = 30.5;
  t.flares[0].y = 26.5;
  t.flares[0].t = 100;
  igniteCreature(t, d);
  run(t, 1);
  assert.ok(Math.abs(CREATURES.gaunt.health - d.hp - BURN.dps * FLARE.damage) < 0.1);
});

test('Magnesium: flares burn twice as long, and so does anything set alight', () => {
  const s = quietState();
  take(s, 'magnesium');
  run(s, DT, intents({ facing: south, flare: 1 }));
  const f = s.flares.find((fl) => fl.t > 0);
  assert.ok(Math.abs(f.t - FLARE.burn * PERKS.magnesium) < DT * 2);
  const c = spawnCreature(s, GAUNT, 30.5, 26.5);
  igniteCreature(s, c);
  assert.equal(c.burnT, BURN.time * PERKS.magnesium);
});

test('Deep pockets: carry 8 flares, and a lull\'s flare gives two', () => {
  const s = createState({ seed: 10, wave: 3 });
  assert.equal(flareMax(s), FLARE.max);
  take(s, 'pockets');
  assert.equal(flareMax(s), PERKS.pockets.max);
  s.gun.flares = 3;
  s.pickups[0].active = true;
  s.player.x = s.pickups[0].x;
  s.player.y = s.pickups[0].y;
  run(s, DT);
  assert.equal(s.gun.flares, 3 + PERKS.pockets.perLull);
  s.gun.flares = PERKS.pockets.max - 1;
  s.pickups[0].active = true;
  run(s, DT);
  assert.equal(s.gun.flares, PERKS.pockets.max, 'never past 8');
});

test('Snowshoes: you walk and run a fifth faster', () => {
  for (const [shoes, want] of [[false, 1], [true, PERKS.snowshoes]]) {
    const s = quietState();
    if (shoes) take(s, 'snowshoes');
    run(s, 0.5, intents({ facing: south, forward: 1 }));
    const v = Math.sqrt(s.player.vx ** 2 + s.player.vy ** 2);
    assert.ok(Math.abs(v - 3 * want) < 1e-6, `snowshoes ${shoes}: ${v}`);
  }
});
