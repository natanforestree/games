import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step } from '../src/sim.js';
import { createBot, botIntents } from '../src/bot.js';
import { DT } from '../src/tuning.js';

// Everything that matters about a night, as one string.
function snapshot(s) {
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return JSON.stringify({
    t: s.tick, p: [r(s.player.x), r(s.player.y), r(s.player.health)], n: [s.night.phase, s.night.wave, s.night.qi],
    c: s.creatures.filter((c) => c.alive).map((c) => [c.id, c.kind, r(c.x), r(c.y), r(c.hp), c.mode]),
    g: [s.gun.current, s.gun.rifle, s.gun.shells, s.gun.spare, s.gun.flares], k: s.stats.kills,
  });
}

function playMinute(seed) {
  const s = createState({ seed });
  const bot = createBot();
  for (let i = 0; i < 60 / DT; i++) step(s, botIntents(s, bot, DT));
  return snapshot(s);
}

test('the same seed and intents give the same night', () => {
  assert.equal(playMinute(21), playMinute(21));
  assert.notEqual(playMinute(21), playMinute(22));
});

test('the bot, unable to die, plays a whole night to the dawn', () => {
  const s = createState({ seed: 2, god: true });
  const bot = createBot();
  for (let i = 0; i < (20 * 60) / DT && s.night.phase !== 'dawn'; i++) step(s, botIntents(s, bot, DT));
  assert.equal(s.night.phase, 'dawn');
  assert.ok(s.stats.kills > 150);
});

test('an update allocates nothing that lasts: the pools keep their objects', () => {
  const s = createState({ seed: 3, god: true });
  const bot = createBot();
  const creatures = s.creatures, events = s.events, first = s.creatures[0], flares = s.flares;
  for (let i = 0; i < 90 / DT; i++) step(s, botIntents(s, bot, DT));
  assert.equal(s.creatures, creatures);
  assert.equal(s.creatures[0], first);
  assert.equal(s.events, events);
  assert.equal(s.flares, flares);
});
