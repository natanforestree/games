import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropEmber, emberCount } from '../src/embers.js';
import { spawnCreature, damageCreature, CRAWLER, GAUNT, LEAPER, MOTHER } from '../src/creatures.js';
import { EMBERS, DT } from '../src/tuning.js';
import { quietState, run, runCollecting } from './helpers.js';

// The first ember on the snow, or undefined.
const lying = (s) => s.embers.find((e) => e.t > 0);

test('a kill drops an ember of its kind where it died; the Mother drops none', () => {
  for (const [kind, value] of [[CRAWLER, 1], [LEAPER, 2], [GAUNT, 3]]) {
    const s = quietState();
    const c = spawnCreature(s, kind, 19.5, 26.5);
    damageCreature(s, c, 999);
    const e = lying(s);
    assert.deepEqual([e.x, e.y, e.value, e.t], [19.5, 26.5, value, EMBERS.life]);
  }
  const s = quietState();
  damageCreature(s, spawnCreature(s, MOTHER, 19.5, 26.5), 9999);
  assert.equal(emberCount(s), 0);
});

test('an ember cools out after EMBERS.life seconds, and says so', () => {
  const s = quietState();
  dropEmber(s, 19.5, 28.5, 1);
  run(s, EMBERS.life - 0.1);
  assert.equal(emberCount(s), 1, 'still warm just before');
  const ev = runCollecting(s, 0.2);
  assert.equal(emberCount(s), 0);
  assert.ok(ev.some((e) => e.type === 'emberOut' && e.x === 19.5 && e.y === 28.5));
  assert.equal(s.carried, 0);
});

test('walking within reach takes an ember; beyond it, it lies there; Long reach takes it from 2 cells', () => {
  const s = quietState(); // you're at (19.5, 20.5)
  dropEmber(s, 19.5, 20.5 + EMBERS.reach + 0.1, 3);
  run(s, DT);
  assert.equal(s.carried, 0, 'just out of reach');
  s.perks.reach = true;
  const ev = runCollecting(s, DT);
  assert.equal(s.carried, 3);
  assert.ok(ev.some((e) => e.type === 'ember' && e.a === 3));
  assert.equal(emberCount(s), 0);
  dropEmber(s, 19.5, 20.5 + EMBERS.longReach + 0.1, 1);
  run(s, DT);
  assert.equal(s.carried, 3, 'even Long reach has a limit');
});

test('a full pool: a new ember takes the place of the one closest to going out', () => {
  const s = quietState();
  for (let i = 0; i < s.embers.length; i++) {
    dropEmber(s, 10.5 + (i % 8), 30.5 + Math.floor(i / 8) * 0.5, 1);
    s.embers[i].t = EMBERS.life - i * 0.01;
  }
  const coolest = s.embers[s.embers.length - 1];
  const e = dropEmber(s, 5.5, 5.5, 2);
  assert.equal(e, coolest);
  assert.deepEqual([e.x, e.y, e.value, e.t], [5.5, 5.5, 2, EMBERS.life]);
  assert.equal(emberCount(s), s.embers.length);
});

test('"Embers come to you": they drift your way, through anything, and you take them', () => {
  const s = quietState({ gentle: true });
  dropEmber(s, 19.5, 15.5, 2); // inside the cabin, behind its south wall
  const d = 5;
  run(s, d / EMBERS.drift - 0.5);
  assert.equal(s.carried, 0, 'on its way');
  const e = lying(s);
  assert.ok(e && e.y > 16.5, `drifting: ${e?.y}`);
  run(s, 1);
  assert.equal(s.carried, 2);
});

test('switching "Embers come to you" on mid-night draws in the embers already lying there', () => {
  const s = quietState();
  dropEmber(s, 19.5, 26.5, 1);
  run(s, 1);
  assert.equal(s.carried, 0);
  s.gentle = true;
  run(s, 3);
  assert.equal(s.carried, 1);
});

test('Warm hands: an ember heals 2 for each of its value, never past full', () => {
  const s = quietState();
  s.perks.warm = true;
  s.player.health = 50;
  dropEmber(s, 19.5, 20.5, 3);
  run(s, DT);
  assert.equal(s.player.health, 50 + EMBERS.warm * 3);
  s.player.health = s.maxHealth - 1;
  dropEmber(s, 19.5, 20.5, 3);
  run(s, DT);
  assert.equal(s.player.health, s.maxHealth);
});
