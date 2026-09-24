import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScene } from '../load.js';

const BOB = { period: 4000, phase: 0 };
const GAMES = {
  games: [{ id: 'snake', island: 'island-snake', at: { landscape: [0, 0], portrait: [0, 0] }, bob: BOB }],
  unfinished: { island: 'island-unfinished', at: { landscape: [0, 0], portrait: [0, 0] }, bob: BOB },
};
const BASE = 'https://example.test/site/';

// Loaders that record every URL asked for and hand back a stand-in named after it.
function fakeIo(failing) {
  const asked = [];
  const answer = (url, value) => {
    asked.push(url.slice(BASE.length));
    if (url === failing) return Promise.reject(new Error(`couldn't load ${url}`));
    return Promise.resolve(value);
  };
  return {
    asked,
    io: {
      json: (url) => answer(url, url.endsWith('games.json') ? GAMES : { name: url.slice(BASE.length) }),
      image: (url) => answer(url, { src: url.slice(BASE.length) }),
    },
  };
}

test('it loads games.json and every picture and data file the scene needs', async () => {
  const { asked, io } = fakeIo();
  const art = await loadScene(new URL(BASE), io);
  const skies = ['landscape', 'portrait'].flatMap((l) => ['dawn', 'day', 'dusk', 'night'].map((p) => `assets/sky-${p}-${l}.png`));
  assert.deepEqual(asked.sort(), [
    'games.json', 'assets/sky.json', 'assets/sign.json', 'assets/island-unfinished.json', 'assets/island-snake.json',
    'assets/island-unfinished.png', 'assets/island-snake.png', 'assets/clouds.png', 'assets/sky.png', 'assets/sign.png', ...skies,
  ].sort());
  assert.equal(art.games, GAMES);
  assert.deepEqual(art.sky, { name: 'assets/sky.json' });
  assert.deepEqual(art.skies.portrait.night, { src: 'assets/sky-night-portrait.png' });
  assert.deepEqual(art.skies.landscape.dawn, { src: 'assets/sky-dawn-landscape.png' });
  assert.deepEqual(art.metas['island-snake'], { name: 'assets/island-snake.json' });
  assert.deepEqual(art.images['island-unfinished'], { src: 'assets/island-unfinished.png' });
  assert.deepEqual(art.clouds, { src: 'assets/clouds.png' });
  assert.deepEqual(art.atlas, { src: 'assets/sky.png' });
  assert.deepEqual(art.sign, { meta: { name: 'assets/sign.json' }, image: { src: 'assets/sign.png' } });
});

test('a file that fails to load fails the whole load', async () => {
  const { io } = fakeIo(`${BASE}assets/island-snake.png`);
  await assert.rejects(loadScene(new URL(BASE), io), /island-snake\.png/);
});
