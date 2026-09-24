import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
