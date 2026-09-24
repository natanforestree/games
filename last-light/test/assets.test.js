import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexPixels, cut, unpackArt } from '../src/assets.js';

// RGBA for a w x h image from a function of (x, y) giving "#rrggbb" or null (transparent).
function rgba(w, h, at) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (!c) continue;
      const i = (y * w + x) * 4;
      data[i] = parseInt(c.slice(1, 3), 16);
      data[i + 1] = parseInt(c.slice(3, 5), 16);
      data[i + 2] = parseInt(c.slice(5, 7), 16);
      data[i + 3] = 255;
    }
  }
  return { w, h, data };
}

test('pixels become palette indices, transparent is 0, and a stray colour is named', () => {
  const colors = ['#000000', '#ffffff'];
  const idx = indexPixels(rgba(2, 1, (x) => (x ? '#ffffff' : null)), colors, 't');
  assert.deepEqual([...idx], [0, 2]);
  assert.throws(() => indexPixels(rgba(1, 1, () => '#123456'), colors, 'sky.png'), /sky\.png: the pixel at 0,0 is #123456/);
});

test('cut: rows for floors, columns for walls and sprites', () => {
  const img = Uint8Array.from([1, 2, 3, 4]); // 2x2
  assert.deepEqual([...cut(img, 2, 0, 0, 2, 2, false)], [1, 2, 3, 4]);
  assert.deepEqual([...cut(img, 2, 0, 0, 2, 2, true)], [1, 3, 2, 4]);
});

test('unpackArt: textures by name, the sky, sprite frames, named colours', () => {
  const colors = ['#101010', '#202020', '#303030'];
  const json = {
    palette: { colors, glow: [3], names: { flake: 2, ichor: 1, ui: 2, uiDim: 1, hurt: 3, night: 1 } },
    textures: { size: 2, names: ['trunks', 'snow'] },
    sprites: { sprites: { well: { x: 0, y: 0, w: 1, h: 2, count: 2, height: 0.5, anims: { idle: [0, 1] } } } },
    hands: { frames: {} },
    hud: { icons: {} },
  };
  const images = { textures: 'tex', sky: 'sky', sprites: 'spr', hands: 'hands', hud: 'hud' };
  const pixels = (img) =>
    ({
      tex: rgba(4, 2, (x, y) => colors[(x + y) % 2]),
      sky: rgba(3, 1, () => colors[2]),
      spr: rgba(2, 2, (x, y) => (x === 0 ? colors[y] : null)),
    })[img];
  const art = unpackArt(json, images, pixels);
  assert.deepEqual(Object.keys(art.walls), ['trunks']);
  assert.deepEqual(Object.keys(art.floors), ['snow']);
  assert.deepEqual([...art.walls.trunks], [1, 2, 2, 1]);
  assert.deepEqual([art.sky.w, art.sky.h, art.sky.px[0]], [3, 1, 3]);
  assert.deepEqual([...art.sprites.well.frames[0].px], [1, 2]);
  assert.deepEqual([...art.sprites.well.frames[1].px], [0, 0]);
  assert.equal(art.shades.emissive[3], 1);
  assert.deepEqual(art.ui, { text: '#202020', dim: '#101010', hurt: '#303030', night: '#101010' });
  assert.equal(art.flake, 2);
});
