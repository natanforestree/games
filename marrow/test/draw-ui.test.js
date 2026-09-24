import { test } from 'node:test';
import assert from 'node:assert/strict';
import cathedral from '../assets/cathedral/scenes.json' with { type: 'json' };
import { createState } from '../src/sim.js';
import { drawHUD } from '../src/draw-ui.js';
import { fakeContext } from './fake-canvas.js';

const world = { colors: cathedral.colors };
const hud = cathedral.colors.hud;
const arrow = { data: { frame: [24, 12], frames: 4 }, sheets: [{ id: 'amber' }, { id: 'cyan' }] };

test("the map track is drawn in the world's HUD colors: the Maw's ends, the other screens, and this one lit", () => {
  const ctx = fakeContext();
  drawHUD(ctx, createState({ screen: 4 }), { arrow }, world, 0);
  assert.deepEqual(ctx.rects.map((r) => r.color), [hud.markEnd, hud.mark, hud.mark, hud.mark, hud.markHere, hud.mark, hud.markEnd]);
});

test("the GO arrow is the holder's own sheet, on their goal's side", () => {
  const s = createState();
  s.arrow = 1; // the CPU heads left
  const ctx = fakeContext();
  drawHUD(ctx, s, { arrow }, world, 0);
  assert.equal(ctx.images.length, 1);
  assert.equal(ctx.images[0].img, arrow.sheets[1]);
  assert.deepEqual(ctx.texts.map((t) => [t.str, t.color]), [['GO', '#6fd6d0']]);
});
