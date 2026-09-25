import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../src/sim.js';
import { createBot, botIntents } from '../src/bot.js';
import { spawnCreature, CRAWLER, MOTHER } from '../src/creatures.js';
import { DT, VIEW } from '../src/tuning.js';
import { quietState } from './helpers.js';

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
