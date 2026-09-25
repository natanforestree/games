import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step, createState } from '../src/sim.js';
import { createBot, botIntents } from '../src/bot.js';
import { spawnCreature, CRAWLER, MOTHER } from '../src/creatures.js';
import { DT, VIEW } from '../src/tuning.js';
import { quietState } from './helpers.js';
import { dropEmber } from '../src/embers.js';
import { UPGRADE_LIST } from '../src/upgrades.js';

test('the bot looks down to shoot a crawler at its feet', () => {
  const s = quietState(); // on the porch, facing south
  const c = spawnCreature(s, CRAWLER, 19.5, 21.8);
  const bot = createBot();
  let lowest = 0;
  for (let i = 0; i < 1 / DT && !c.dying; i++) {
    step(s, botIntents(s, bot, DT));
    lowest = Math.min(lowest, bot.pitch);
  }
  assert.ok(c.dying > 0, 'dead within a second');
  assert.ok(lowest < -0.1, `looked down to ${lowest}`);
});

test('the bot looks up at the Mother, never past how far you can look', () => {
  const s = quietState();
  spawnCreature(s, MOTHER, 19.5, 23.5);
  const bot = createBot();
  let highest = 0;
  for (let i = 0; i < 0.5 / DT; i++) {
    step(s, botIntents(s, bot, DT));
    highest = Math.max(highest, bot.pitch);
    assert.ok(Math.abs(bot.pitch) <= VIEW.maxPitch);
    assert.equal(s.player.pitch, bot.pitch);
  }
  assert.ok(highest > 0.1, `looked up to ${highest}`);
});

test('the bot only fires once the crosshair is on a crawler, not over its back', () => {
  const s = quietState();
  spawnCreature(s, CRAWLER, 19.5, 21.5); // straight ahead, 1 cell off: level passes over it
  const bot = createBot();
  const first = botIntents(s, bot, DT);
  assert.equal(first.fire, false, 'still looking level');
  let fired = false;
  for (let i = 0; i < 20 && !fired; i++) fired = botIntents(s, bot, DT).fire;
  assert.ok(fired, `fired once looking down, at ${bot.pitch}`);
});

test('a crawler at its feet: the bot looks down only as far as you can', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 21);
  const bot = createBot();
  for (let i = 0; i < 0.5 / DT; i++) {
    c.x = s.player.x; // held half a cell in front, where it wants to look further down than that
    c.y = s.player.y + 0.5;
    c.hp = 1e9;
    step(s, botIntents(s, bot, DT));
    assert.ok(bot.pitch >= -VIEW.maxPitch, `${bot.pitch}`);
  }
  assert.equal(bot.pitch, -VIEW.maxPitch);
});

const ORDER = ['warm', 'quickLever', 'pierce', 'reach', 'dragon', 'deepMagazine', 'magnesium', 'steady', 'wick', 'snowshoes', 'slugs', 'pockets'];

test('the bot fetches an ember it can reach before it cools, and leaves one that will be gone', () => {
  const s = quietState(); // on the porch
  dropEmber(s, 19.5, 24.5, 1);
  const bot = createBot();
  for (let i = 0; i < 2 / DT && s.carried === 0; i++) step(s, botIntents(s, bot, DT));
  assert.equal(s.carried, 1);
  const t = quietState();
  const e = dropEmber(t, 19.5, 26.5, 3);
  e.t = 0.5; // six cells off, half a second left: not worth it
  const other = createBot();
  for (let i = 0; i < 0.4 / DT; i++) step(t, botIntents(t, other, DT));
  assert.ok(t.player.y < 21, `stayed put: ${t.player.y}`);
});

test('at the fire the bot takes the card it likes best', () => {
  const s = quietState();
  s.night.phase = 'lull';
  s.night.t = 1e9;
  s.carried = 6;
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 0.9;
  const bot = createBot();
  step(s, botIntents(s, bot, DT)); // the fire draws its three
  const offer = Array.from(s.offer.subarray(0, s.offerN));
  step(s, botIntents(s, bot, DT));
  assert.equal(s.bought, 1);
  const best = offer.map((id) => UPGRADE_LIST[id].key).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
  assert.equal(UPGRADE_LIST[s.taken[0]].key, best);
});

test('buying several cards in one visit, the bot takes the best of each offer', () => {
  const s = quietState();
  s.night.phase = 'lull';
  s.night.t = 1e9;
  s.carried = 30; // 6 + 10 + 14: three cards
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 0.9;
  const bot = createBot();
  for (let i = 0; i < 20 && s.bought < 3; i++) {
    const shown = Array.from(s.offer.subarray(0, s.offerN));
    const before = s.bought;
    step(s, botIntents(s, bot, DT));
    if (s.bought > before) {
      const best = shown.map((id) => UPGRADE_LIST[id].key).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
      assert.equal(UPGRADE_LIST[s.taken[before]].key, best, `card ${before + 1}`);
    }
  }
  assert.equal(s.bought, 3);
});

test('over whole nights (it cannot die), the bot buys 5 to 7 upgrades a night on average', () => {
  let picks = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const s = createState({ seed, god: true });
    const bot = createBot();
    for (let i = 0; i < (20 * 60) / DT && s.night.phase !== 'dawn'; i++) step(s, botIntents(s, bot, DT));
    assert.equal(s.night.phase, 'dawn', `seed ${seed}`);
    picks += s.bought;
  }
  const avg = picks / 8;
  assert.ok(avg >= 5 && avg <= 7, `${avg} a night`);
});
