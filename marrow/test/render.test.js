import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../src/render.js';
import { createGame } from '../src/game.js';
import { fakeCanvas } from './fake-canvas.js';

// createRenderer fits the canvas to the window and makes its stain layers with document.createElement:
// stand-ins for those, recording every layer it makes.
const layers = new Set();
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.addEventListener = () => {};
globalThis.document = {
  createElement: () => {
    const c = fakeCanvas(0, 0);
    layers.add(c);
    return c;
  },
};

const colors = {
  vessel: ['#100000', '#200000'], drip: '#300000', spore: '#400000', sporeAlpha: 0.35, clear: '#500000',
  hud: { text: '#600000', dim: '#700000', mark: '#800000', markEnd: '#900000', markHere: '#a00000' },
};
const scene = () => ({ image: {}, fx: { vessels: [], drips: [] } });
const world = () => ({ far: { width: 800 }, fog: { width: 320 }, scenes: { C: scene(), B1: scene(), B2: scene(), V: scene() }, colors });
const assets = {
  palette: { ichor: [['#e8a33a', '#e8a33a', '#e8a33a'], ['#6fd6d0', '#6fd6d0', '#6fd6d0']] },
  worldOrder: ['cathedral', 'dusk', 'abyss'],
  worlds: { cathedral: world(), dusk: world(), abyss: world() },
};
const memory = () => {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, String(v)) };
};

function renderer() {
  const canvas = { ...fakeCanvas(320, 180), style: {} };
  const r = createRenderer(canvas);
  r.setAssets(assets);
  return { r, ctx: canvas.getContext('2d') };
}
const fogX = (ctx, w) => ctx.images.filter((d) => d.img === w.fog).map((d) => d.args[0]);

test('cosmetic animation follows simulation ticks, not display frames (the same at 60, 120 or 144 Hz)', () => {
  const { r, ctx } = renderer();
  const game = createGame({ storage: memory() }); // the title: fog drifting, PRESS ENTER blinking
  const prompt = () => ctx.texts.some((t) => t.str === 'PRESS ENTER');
  r.draw(game);
  const fog = fogX(ctx, assets.worlds.dusk);
  assert.ok(prompt());
  for (let i = 0; i < 40; i++) r.draw(game); // a fast display draws many frames per tick
  ctx.images.length = ctx.texts.length = 0;
  r.draw(game);
  assert.deepEqual(fogX(ctx, assets.worlds.dusk), fog);
  assert.ok(prompt());
  for (let i = 0; i < 40; i++) r.tick(game.state, []); // 40 ticks: the fog has drifted 2 px, and the prompt blinked off
  ctx.images.length = ctx.texts.length = 0;
  r.draw(game);
  assert.notDeepEqual(fogX(ctx, assets.worlds.dusk), fog);
  assert.ok(!prompt());
});
