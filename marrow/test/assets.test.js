import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import palette from '../assets/palette.json' with { type: 'json' };
import { loadAssets, swapPixels, worldFor } from '../src/assets.js';

// Node has no Image or canvas: an image is stood in for by its URL, JSON is read from disk, and the
// cyan swap records what it was asked to do.
const fakeIO = {
  image: async (href) => ({ href }),
  json: async (href) => JSON.parse(await readFile(new URL(href), 'utf8')),
  swap: (img, from, to) => ({ swapOf: img.href, from, to }),
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('the palette swap turns amber glow into cyan and leaves everything else alone', () => {
  const px = new Uint8ClampedArray([
    ...rgb(palette.amber[2]), 255, // glow: swapped
    ...rgb(palette.blade.body), 255, // the bone blade: untouched
    ...rgb(palette.amber[2]), 0, // transparent: untouched
  ]);
  swapPixels(px, palette.amber, palette.cyan);
  assert.deepEqual([...px], [...rgb(palette.cyan[2]), 255, ...rgb(palette.blade.body), 255, ...rgb(palette.amber[2]), 0]);
});

test('the fighter sheet loads with a cyan twin, and the palette brings the blade colors', async () => {
  const assets = await loadAssets(undefined, fakeIO);
  const [amber, cyan] = assets.fighter.sheets;
  assert.match(amber.href, /\/marrow\/assets\/fighter\.png$/);
  assert.deepEqual(cyan, { swapOf: amber.href, from: palette.amber, to: palette.cyan });
  assert.equal(assets.fighter.data.anims.stand1.frames.length, 1);
  assert.deepEqual(assets.palette.blade, palette.blade);
});

test('each world loads its far panorama, fog, a scene per screen base and its colors', async () => {
  const assets = await loadAssets(undefined, fakeIO);
  assert.deepEqual(assets.worldOrder, ['cathedral', 'dusk', 'abyss']);
  for (const name of assets.worldOrder) {
    const w = assets.worlds[name];
    assert.match(w.far.href, new RegExp(`/assets/${name}/far\\.png$`));
    assert.match(w.fog.href, new RegExp(`/assets/${name}/fog\\.png$`));
    assert.deepEqual(Object.keys(w.scenes).sort(), ['B1', 'B2', 'C', 'V']); // "colors" is not a scene
    for (const [base, scene] of Object.entries(w.scenes)) {
      assert.match(scene.image.href, new RegExp(`/assets/${name}/scene-${base}\\.png$`));
      assert.ok(Array.isArray(scene.fx.vessels) && Array.isArray(scene.fx.drips), `${name} ${base}`);
    }
    assert.match(w.colors.hud.markHere, /^#[0-9a-f]{6}$/);
  }
});

test('each ladder rung is drawn in its own world', async () => {
  const assets = await loadAssets(undefined, fakeIO);
  assert.equal(worldFor(assets, 0), assets.worlds.cathedral);
  assert.equal(worldFor(assets, 1), assets.worlds.dusk);
  assert.equal(worldFor(assets, 2), assets.worlds.abyss);
});
