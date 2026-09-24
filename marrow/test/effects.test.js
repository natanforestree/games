import { test } from 'node:test';
import assert from 'node:assert/strict';
import palette from '../assets/palette.json' with { type: 'json' };
import { createEffects } from '../src/effects.js';
import { fakeCanvas, fakeContext } from './fake-canvas.js';

// A kill on the center screen (index 3), and the stain layers the effects made.
function burst(id, cause = 'blade') {
  const layers = [];
  const fx = createEffects((w, h) => {
    const c = fakeCanvas(w, h);
    layers.push(c);
    return c;
  }, palette.ichor);
  fx.onEvents([{ type: 'kill', id, cause, x: 160, y: 150, screen: 3 }]);
  return { fx, layers };
}

test("a kill bursts into the victim's own ichor, from palette.json", () => {
  for (const id of [0, 1]) {
    const { fx } = burst(id);
    const ctx = fakeContext();
    fx.drawDrops(ctx, 3, 0);
    assert.ok(ctx.rects.length > 0);
    assert.ok(ctx.rects.every((r) => palette.ichor[id].includes(r.color)), `fighter ${id}`);
  }
});

test('ichor stains the screen it lands on for the rest of the match, and a new match starts clean', () => {
  const { fx, layers } = burst(1);
  for (let i = 0; i < 200; i++) fx.update();
  assert.equal(layers.length, 1);
  const stain = layers[0].getContext('2d');
  assert.ok(stain.rects.length > 12, 'drops landed as well as the first splash');
  assert.ok(stain.rects.every((r) => palette.ichor[1].includes(r.color)));
  const here = fakeContext(), next = fakeContext();
  fx.drawStains(here, 3, 0);
  fx.drawStains(next, 4, 0);
  assert.equal(here.images.length, 1);
  assert.equal(next.images.length, 0);
  fx.reset();
  const after = fakeContext();
  fx.drawStains(after, 3, 0);
  assert.equal(after.images.length, 0);
});

test('falling into a pit leaves no ichor', () => {
  const { fx, layers } = burst(0, 'pit');
  const ctx = fakeContext();
  fx.drawDrops(ctx, 3, 0);
  assert.equal(ctx.rects.length, 0);
  assert.equal(layers.length, 0);
});
