import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { PHASES } from '../sky.js';
import { readJson, pngSize, siteFile } from './helpers.js';

const HEX = /^#[0-9a-f]{6}$/;
const rect = (r) => Array.isArray(r) && r.length === 4 && r.every(Number.isInteger);

test('sky.json lists the phases in sky.js order, with every colour and sprite', () => {
  const sky = readJson('assets/sky.json');
  assert.deepEqual(sky.order, PHASES);
  for (const p of PHASES) {
    for (const k of ['top', 'bottom', 'title', 'shadow', 'subtitle']) assert.match(sky.phases[p][k], HEX, `${p}.${k}`);
  }
  assert.match(sky.shooting, HEX);
  assert.deepEqual(sky.clouds, { w: 384, h: 48, layers: 3 });
  assert.ok(rect(sky.sprites.moon) && rect(sky.sprites.sun));
  assert.equal(sky.sprites.bird.length, 2);
  assert.ok(sky.sprites.bird.every(rect));
  assert.equal(sky.sprites.twinkle.length, 3);
  assert.ok(sky.sprites.twinkle.every(rect));
});

test('each phase has a sky for each stage, and the clouds a row per phase and layer', () => {
  for (const p of PHASES) {
    assert.deepEqual(pngSize(`assets/sky-${p}-landscape.png`), [384, 216], p);
    assert.deepEqual(pngSize(`assets/sky-${p}-portrait.png`), [216, 384], p);
  }
  assert.deepEqual(pngSize('assets/clouds.png'), [384, 48 * 3 * PHASES.length]);
  assert.ok(existsSync(siteFile('assets/sky.png')));
});

test('each island sheet is its frames side by side, over a row of glows', () => {
  const data = readJson('games.json');
  for (const { island } of [data.unfinished, ...data.games]) {
    const meta = readJson(`assets/${island}.json`);
    assert.deepEqual(pngSize(`assets/${island}.png`), [meta.w * meta.frames, meta.h * 2], island);
    assert.ok(Number.isInteger(meta.ms) && meta.ms > 0 && rect(meta.hit), island);
  }
});

test('all the site art together stays under 300 KB', () => {
  const dir = siteFile('assets/');
  const total = readdirSync(dir).reduce((sum, f) => sum + statSync(new URL(f, dir)).size, 0);
  assert.ok(total < 300_000, `site/assets is ${total} bytes`);
});
