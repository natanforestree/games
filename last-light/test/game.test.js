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

test('a click starts the next night only once the death or dawn screen has been up for 2.5 s', () => {
  const frames = (g, seconds) => {
    for (let t = 0; t < seconds; t += 1 / 60) g.frame(1 / 60);
  };
  // Death: the screen comes up a moment after you fall.
  const d = createGame({ storage: memoryStorage(), map, seed: 1 });
  d.newNight();
  startWave(d.state, 3);
  d.state.player.health = 0.5;
  for (let i = 0; i < 90 / DT && d.screen === 'playing'; i++) d.tick(intents());
  assert.equal(d.screen, 'dead');
  assert.equal(d.canContinue, false, 'not the moment the death screen shows');
  frames(d, 2.4);
  assert.equal(d.canContinue, false);
  frames(d, 0.2);
  assert.equal(d.canContinue, true);
  // Dawn: its screen comes up 10 s into the sunrise, and the guard still starts from there.
  const g = createGame({ storage: memoryStorage(), map, seed: 1 });
  g.newNight();
  startWave(g.state, LAST_WAVE);
  g.state.night.qi = g.state.night.qn;
  g.state.creatures.forEach((c) => (c.alive = false));
  for (let i = 0; i < 20 / DT && g.screen !== 'dawn'; i++) g.tick(intents());
  assert.equal(g.screen, 'dawn');
  assert.equal(g.canContinue, false, 'not the moment the dawn screen shows');
  frames(g, 2.4);
  assert.equal(g.canContinue, false);
  frames(g, 0.2);
  assert.equal(g.canContinue, true);
  g.newNight();
  assert.equal(g.canContinue, false, 'playing again');
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
