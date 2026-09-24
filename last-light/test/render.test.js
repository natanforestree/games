import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../src/render.js';
import { chooseView } from '../src/view.js';
import { parseMap } from '../src/map.js';
import { createLightmap, beginLight, addLight } from '../src/lightmap.js';
import { room } from './helpers.js';
import { testArt, drawnAt, IDX } from './render-helpers.js';

const view = chooseView(480, 270, 1);

function setup(map, ambient = 1) {
  const art = testArt();
  const r = createRenderer(art, map);
  r.resize(view);
  const lm = createLightmap(map);
  beginLight(lm, ambient);
  const frame = (over) => ({ x: 6.5, y: 5.5, facing: 0, bob: 0, map, lightmap: lm, skyLevel: 15, time: 0, sprites: [], spriteCount: 0, snow: false, ...over });
  return { art, r, lm, frame };
}

test('facing a wall 4.5 cells away: wall at the horizon, sky above it, snow below', () => {
  const { art, r, frame } = setup(room());
  r.draw(frame());
  const { w, h, focal } = view;
  const at = (x, y) => drawnAt(art, r.buffer, w, x, y);
  const x = w / 2;
  const half = focal / 4.5 / 2;
  assert.equal(at(x, h / 2), IDX.trunks);
  assert.equal(at(x, Math.floor(h / 2 - half) - 2), IDX.sky);
  assert.equal(at(x, Math.ceil(h / 2 + half) + 2), IDX.snow);
  assert.equal(at(x, Math.floor(h / 2 - half) + 2), IDX.trunks);
});

test('a sprite in front of the wall is drawn; one behind the wall is hidden', () => {
  const { art, r, frame } = setup(room());
  const body = { w: 2, h: 2, px: new Uint8Array(4).fill(IDX.body) };
  r.draw(frame({ sprites: [{ x: 8.5, y: 5.5, height: 0.8, frame: body }], spriteCount: 1 }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h / 2 + 10), IDX.body);
  r.draw(frame({ sprites: [{ x: 12.5, y: 5.5, height: 0.8, frame: body }], spriteCount: 1 }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h / 2 + 5), IDX.trunks);
});

test('glowing eyes show in the dark, and fade with the sprite glow level', () => {
  const { art, r, frame } = setup(room(), 0);
  const eyes = { w: 1, h: 1, px: new Uint8Array([IDX.eye]) };
  r.draw(frame({ sprites: [{ x: 8.5, y: 5.5, height: 0.5, frame: eyes, glow: 15 }], spriteCount: 1 }));
  const px = r.buffer[(view.h / 2 + 20) * view.w + view.w / 2];
  assert.equal(px, art.shades.table[(15 << 8) | IDX.eye]);
  r.draw(frame({ sprites: [{ x: 8.5, y: 5.5, height: 0.5, frame: eyes, glow: 4 }], spriteCount: 1 }));
  assert.equal(r.buffer[(view.h / 2 + 20) * view.w + view.w / 2], art.shades.fade[(4 << 8) | IDX.eye]);
});

test('a light brightens the snow near it', () => {
  const { r, lm, frame } = setup(room(), 0);
  const y = view.h - 3, x = view.w / 2;
  r.draw(frame());
  const dark = r.buffer[y * view.w + x];
  addLight(lm, 6.5, 5.5, 3, 7, 1);
  r.draw(frame());
  assert.notEqual(r.buffer[y * view.w + x], dark);
});

test('inside the cabin you see rafters overhead, not sky', () => {
  const map = parseMap();
  const { art, r, frame } = setup(map);
  r.draw(frame({ x: 19.5, y: 16.5, facing: Math.PI / 2 }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, 0), IDX.rafters);
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h - 1), IDX.planks);
});

test('falling snow shows outside, never under the roof', () => {
  const map = parseMap();
  const { art, r, frame } = setup(map);
  const count = () => {
    let n = 0;
    for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) if (drawnAt(art, r.buffer, view.w, x, y) === IDX.flake) n++;
    return n;
  };
  r.draw(frame({ x: 19.5, y: 25.5, facing: Math.PI / 2, snow: true, time: 3 }));
  assert.ok(count() > 20, 'flakes outside');
  r.draw(frame({ x: 19.5, y: 16.5, facing: Math.PI, snow: true, time: 3 }));
  assert.equal(count(), 0, 'none indoors, looking at the wall');
});
