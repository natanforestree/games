import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/sim.js';
import { drawWorld } from '../src/draw-world.js';
import { fakeContext } from './fake-canvas.js';

const colors = {
  vessel: ['#100000', '#200000'], drip: '#300000', spore: '#400000', sporeAlpha: 0.35, clear: '#500000',
  hud: { text: '#600000', dim: '#700000', mark: '#800000', markEnd: '#900000', markHere: '#a00000' },
};
// A stand-in world: images are plain objects with the real widths; every scene has one vessel and one drip.
function fakeWorld() {
  const scene = (base) => ({ image: { base }, fx: { vessels: [[10, 20]], drips: [[30, 40, 150]] } });
  return { far: { width: 800 }, fog: { width: 320 }, scenes: { C: scene('C'), B1: scene('B1'), B2: scene('B2'), V: scene('V') }, colors };
}
const noFx = { drawStains() {} };

test('the far panorama moves at 1/4 speed: screen i shows its columns 80 i to 80 i + 320', () => {
  const world = fakeWorld();
  for (let i = 0; i < 7; i++) {
    const ctx = fakeContext();
    drawWorld(ctx, createState({ screen: i }), world, noFx, 0);
    const xs = ctx.images.filter((d) => d.img === world.far).map((d) => d.args[0]);
    assert.ok(xs.includes(-80 * i), `screen ${i}: far drawn at ${xs}`);
  }
});

test("each scene's living details are drawn in the world's colors, mirrored on '-' screens", () => {
  const world = fakeWorld();
  for (const [index, vx, dx] of [[4, 10, 30], [2, 309, 289]]) { // B1+ as painted, B1- mirrored
    const ctx = fakeContext();
    drawWorld(ctx, createState({ screen: index }), world, noFx, 20);
    assert.ok(ctx.images.some((d) => d.img === world.scenes.B1.image));
    const at = (x, y) => ctx.rects.find((r) => r.x === x && r.y === y);
    assert.equal(at(vx, 20).color, colors.vessel[1]); // at tick 20 the first vessel is at its brightest
    assert.equal(at(dx, 40).color, colors.drip); // the drip, swelling at its anchor
    const spores = ctx.rects.filter((r) => r.color === colors.spore);
    assert.equal(spores.length, 14);
    assert.ok(spores.every((r) => r.alpha === colors.sporeAlpha));
    assert.equal(ctx.globalAlpha, 1);
  }
});
