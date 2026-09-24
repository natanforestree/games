import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { parseMap } from '../src/map.js';
import { NIGHT, DT, LIGHT } from '../src/tuning.js';
import { startWave, LAST_WAVE } from '../src/night.js';
import { intents } from './helpers.js';

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, String(v)) };
}
const map = parseMap();

test('title, then a night; pause and resume', () => {
  const g = createGame({ storage: memoryStorage(), map, seed: 1 });
  assert.equal(g.screen, 'title');
  g.newNight();
  assert.equal(g.screen, 'playing');
  g.pause();
  assert.equal(g.screen, 'paused');
  const t = g.state.tick;
  g.tick(intents());
  assert.equal(g.state.tick, t, 'nothing moves while paused');
  g.resume();
  g.tick(intents());
  assert.equal(g.state.tick, t + 1);
});

test('the wave banner shows the hour', () => {
  const g = createGame({ storage: memoryStorage(), map, seed: 1 });
  g.newNight();
  for (let i = 0; i < (NIGHT.dusk + 0.1) / DT; i++) g.tick(intents());
  assert.equal(g.banner.text, '9 PM');
  assert.ok(g.banner.t > 0);
});

test('dying shows the death screen after a moment, and saves the best hour', () => {
  const storage = memoryStorage();
  const g = createGame({ storage, map, seed: 1 });
  g.newNight();
  startWave(g.state, 3);
  g.state.player.health = 0.5;
  for (let i = 0; i < 90 / DT && g.screen === 'playing'; i++) g.tick(intents());
  assert.equal(g.screen, 'dead');
  assert.equal(g.best.hour, 3);
  assert.equal(storage.get('last-light-best'), '3');
});

test('the dawn counts, and a worse night never lowers the best', () => {
  const storage = memoryStorage({ 'last-light-best': '8', 'last-light-dawns': '2' });
  const g = createGame({ storage, map, seed: 1 });
  assert.deepEqual(g.best, { hour: 8, dawns: 2 });
  g.newNight();
  startWave(g.state, LAST_WAVE);
  g.state.night.qi = g.state.night.qn;
  g.state.creatures.forEach((c) => (c.alive = false));
  for (let i = 0; i < (LIGHT.dawnTime + 3) / DT; i++) g.tick(intents());
  assert.equal(g.screen, 'dawn');
  assert.deepEqual(g.best, { hour: 8, dawns: 3 });
  assert.equal(storage.get('last-light-dawns'), '3');
});

test('junk in storage is ignored', () => {
  const g = createGame({ storage: memoryStorage({ 'last-light-best': 'lots', 'last-light-dawns': '-4' }), map });
  assert.deepEqual(g.best, { hour: 0, dawns: 0 });
});

test('?wave= and ?god reach the night', () => {
  const g = createGame({ storage: memoryStorage(), map, debug: { wave: 7, god: true } });
  g.newNight();
  assert.equal(g.state.night.wave, 7);
  assert.equal(g.state.god, true);
});
