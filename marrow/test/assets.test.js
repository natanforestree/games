import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import palette from '../assets/palette.json' with { type: 'json' };
import { loadAssets, swapPixels } from '../src/assets.js';

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
