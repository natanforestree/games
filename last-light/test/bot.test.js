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
