import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layersFor, notesAt, LAYERS, STEP, BAR, DAWN, midiToHz } from '../src/music.js';

test('a layer joins every hour, from the drone at 9 PM to all eight at 4 AM', () => {
  assert.deepEqual(layersFor('wave', 0), ['drone']);
  assert.equal(layersFor('wave', 3).length, 4);
  assert.deepEqual(layersFor('wave', 7), LAYERS);
});

test('the lulls thin to the drone and the music box; nothing plays after death', () => {
  assert.deepEqual(layersFor('lull', 5), ['drone', 'musicbox']);
  assert.deepEqual(layersFor('dead', 5), []);
});

test('the layers for an hour are made once, not on every frame that asks', () => {
  for (let wave = 0; wave < 8; wave++) assert.equal(layersFor('wave', wave), layersFor('wave', wave));
  assert.equal(layersFor('lull', 2), layersFor('dusk', 0));
  assert.equal(layersFor('dead', 5), layersFor('dawn', 7));
  assert.ok(Object.isFrozen(layersFor('wave', 3)), 'shared, so nobody may change them');
});

test('the notes are the same every night', () => {
  for (const layer of LAYERS) {
    for (let step = 0; step < 64; step++) assert.deepEqual(notesAt(layer, step), notesAt(layer, step));
  }
});

test('the music box plays a few notes a bar, from the chord', () => {
  let n = 0;
  for (let step = 0; step < BAR * 16; step++) n += notesAt('musicbox', step).length;
  assert.ok(n >= 16 && n <= 64, `${n} notes in 16 bars`);
});

test('66 beats a minute in eighths; A4 is 440 Hz; the dawn theme is about 12 seconds', () => {
  assert.ok(Math.abs(STEP - 60 / 66 / 2) < 1e-12);
  assert.equal(midiToHz(69), 440);
  const end = Math.max(...DAWN.map((d) => d.step + d.len));
  assert.ok(end * STEP > 10 && end * STEP < 16);
});
