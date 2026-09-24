import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnCreature, damageCreature, aliveCount, CRAWLER, GAUNT, LEAPER, MOTHER } from '../src/creatures.js';
import { CREATURES, DT, FLARE } from '../src/tuning.js';
import { quietState, run, runCollecting, intents } from './helpers.js';

const types = (events) => events.map((e) => e.type);

test('a crawler runs you down and bites on a timer', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 26.5);
  const start = Math.hypot(c.x - s.player.x, c.y - s.player.y);
  run(s, 0.5);
  assert.ok(Math.hypot(c.x - s.player.x, c.y - s.player.y) < start - 1.5, 'closing at crawler speed');
  const ev = runCollecting(s, 3, intents({ facing: Math.PI / 2 }));
  const bites = ev.filter((e) => e.type === 'hurt');
  assert.ok(bites.length >= 3 && bites.length <= 5, `${bites.length} bites in 3 s`);
  assert.ok(bites.every((e) => e.a === CREATURES.crawler.damage));
});

test('a gaunt winds up before it swipes, and you can step out of the swipe', () => {
  const s = quietState();
  spawnCreature(s, GAUNT, 19.5, 21.8);
  const ev = runCollecting(s, 0.1);
  assert.ok(types(ev).includes('windup'));
  assert.ok(!types(ev).includes('hurt'), 'no damage before the wind-up ends');
  // Back away north-east, out of reach, during the wind-up: the swipe misses.
  const miss = runCollecting(s, 0.5, intents({ facing: -Math.PI / 2, forward: 1, run: true }));
  assert.ok(!types(miss).includes('hurt'));
  // Stand still next to it and it lands.
  const t = quietState();
  spawnCreature(t, GAUNT, 19.5, 21.8);
  const hit = runCollecting(t, 0.6).filter((e) => e.type === 'hurt');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].a, CREATURES.gaunt.damage);
});

test('a leaper circles, shrieks, and leaps in a straight line: sidestep it and it misses', () => {
  const s = quietState();
  const c = spawnCreature(s, LEAPER, 19.5, 26);
  const ev = runCollecting(s, 6);
  assert.ok(types(ev).includes('shriek'), 'it crouches with a shriek');
  assert.ok(types(ev).includes('leap'));
  const i = types(ev).indexOf('leap');
  assert.ok(types(ev).slice(i).includes('hurt'), 'standing still, the pounce lands');
  // Again, but sidestep as soon as it leaps.
  const t = quietState();
  const d = spawnCreature(t, LEAPER, 19.5, 26);
  let leapt = false, hurt = false;
  for (let k = 0; k < 6 / DT; k++) {
    const e = runCollecting(t, DT, intents({ facing: Math.PI / 2, strafe: leapt ? 1 : 0, run: leapt }));
    if (types(e).includes('leap')) leapt = true;
    if (leapt && types(e).includes('hurt')) hurt = true;
    if (leapt && d.mode === 'land') break;
  }
  assert.ok(leapt && !hurt, 'the sidestep dodges the pounce');
  assert.ok(c.alive);
});

test('the Mother gives birth to crawlers on her timer', () => {
  const s = quietState();
  s.night.wave = 7;
  spawnCreature(s, MOTHER, 19.5, 30);
  const ev = runCollecting(s, CREATURES.mother.birthEvery + 0.1);
  assert.equal(types(ev).filter((t) => t === 'birth').length, 1);
  assert.equal(aliveCount(s), 1 + CREATURES.mother.births);
});

test('a hit flinches a creature; enough damage kills it, and it dies over the death animation', () => {
  const s = quietState();
  const c = spawnCreature(s, GAUNT, 19.5, 30);
  assert.equal(damageCreature(s, c, 10), false);
  assert.ok(c.flinch > 0);
  assert.equal(damageCreature(s, c, 40), true);
  assert.equal(s.stats.kills, 1);
  assert.ok(c.alive && c.dying > 0);
  assert.equal(aliveCount(s), 0, 'dying creatures no longer count');
  assert.equal(damageCreature(s, c, 10), false, 'no hitting the dead');
  run(s, CREATURES.die + 0.05);
  assert.equal(c.alive, false);
});

test('in flare light creatures move at half speed and take more damage', () => {
  const s = quietState();
  const a = spawnCreature(s, CRAWLER, 12.5, 20.5);
  run(s, 0.25);
  const free = Math.hypot(a.x - 12.5, a.y - 20.5);
  const t = quietState();
  t.flares[0].x = 12.5;
  t.flares[0].y = 20.5;
  t.flares[0].t = FLARE.burn;
  const b = spawnCreature(t, CRAWLER, 12.5, 20.5);
  run(t, 0.25);
  const slowed = Math.hypot(b.x - 12.5, b.y - 20.5);
  assert.ok(Math.abs(slowed - free * FLARE.slow) < 0.05, `${slowed} vs ${free}`);
  const g = spawnCreature(t, GAUNT, 12.5, 20.5);
  damageCreature(t, g, 10);
  assert.equal(g.hp, CREATURES.gaunt.health - 10 * FLARE.damage);
});

test('a pack never piles into one spot, and never into you', () => {
  const s = quietState();
  for (let i = 0; i < 8; i++) spawnCreature(s, CRAWLER, 19.5 + (i % 3) * 0.01, 25.5);
  run(s, 2);
  const cs = s.creatures.filter((c) => c.alive);
  for (let i = 0; i < cs.length; i++) {
    const di = Math.hypot(cs[i].x - s.player.x, cs[i].y - s.player.y);
    assert.ok(di >= cs[i].radius + s.player.radius - 1e-6, 'not inside you');
    for (let j = i + 1; j < cs.length; j++) {
      const d = Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y);
      assert.ok(d >= cs[i].radius + cs[j].radius - 0.05, `crawlers ${i} and ${j} overlap: ${d}`);
    }
  }
});

test('a creature that cannot see you comes round the cabin to reach you', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 11.5); // behind the cabin
  run(s, 6);
  assert.ok(Math.hypot(c.x - s.player.x, c.y - s.player.y) < 1, `still at ${c.x},${c.y}`);
});

test('the Mother fits through the doorway', () => {
  const s = quietState();
  s.player.x = s.player.px = 19.5;
  s.player.y = s.player.py = 15.5;
  const m = spawnCreature(s, MOTHER, 19.5, 24.5);
  run(s, 12);
  assert.ok(m.y < 18, `stuck at ${m.x.toFixed(2)},${m.y.toFixed(2)}`);
});
