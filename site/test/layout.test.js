import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, chooseView, toCss } from '../layout.js';

const pick = (v) => ({ layout: v.layout, scale: v.scale, cw: v.cw, ch: v.ch, ox: v.ox, oy: v.oy });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('a 1080p window shows the landscape stage at exactly 5x', () => {
  assert.deepEqual(pick(chooseView(1920, 1080, 1)), { layout: 'landscape', scale: 5, cw: 384, ch: 216, ox: 0, oy: 0 });
});

test('a taller window gets more sky above and below the stage', () => {
  assert.deepEqual(pick(chooseView(1920, 1200, 1)), { layout: 'landscape', scale: 5, cw: 384, ch: 240, ox: 0, oy: 12 });
});

test('a phone held upright gets the portrait stage, scaled in device pixels', () => {
  assert.deepEqual(pick(chooseView(390, 844, 3)), { layout: 'portrait', scale: 5, cw: 234, ch: 507, ox: 9, oy: 61 });
});

test('turning the phone sideways switches to the landscape stage', () => {
  assert.deepEqual(pick(chooseView(844, 390, 3)), { layout: 'landscape', scale: 5, cw: 507, ch: 234, ox: 61, oy: 9 });
});

test("when both stages fit equally well, the window's shape decides", () => {
  assert.equal(chooseView(1000, 1000, 1).layout, 'landscape');
  assert.equal(chooseView(999, 1000, 1).layout, 'portrait');
  assert.equal(chooseView(768, 1024, 1).layout, 'portrait');
});

test('a zoomed page (devicePixelRatio 1.25) still scales by whole device pixels', () => {
  assert.deepEqual(pick(chooseView(1366, 768, 1.25)), { layout: 'landscape', scale: 4, cw: 427, ch: 240, ox: 21, oy: 12 });
});

test('a window too small for the stage shows it at 1x, centred and cropped', () => {
  assert.deepEqual(pick(chooseView(200, 100, 1)), { layout: 'landscape', scale: 1, cw: 200, ch: 100, ox: -92, oy: -58 });
});

test('the canvas always covers the window, by less than one scene pixel too many', () => {
  const sizes = [[1920, 1080], [1366, 768], [1280, 720], [2560, 1080], [390, 844], [844, 390], [768, 1024], [3440, 1440]];
  for (const [w, h] of sizes) {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      const v = chooseView(w, h, dpr);
      const devW = Math.round(w * dpr), devH = Math.round(h * dpr);
      assert.ok(v.cw * v.scale >= devW && (v.cw - 1) * v.scale < devW, `${w}x${h}@${dpr} width`);
      assert.ok(v.ch * v.scale >= devH && (v.ch - 1) * v.scale < devH, `${w}x${h}@${dpr} height`);
      assert.equal(v.stage, STAGES[v.layout]);
      assert.ok(Number.isInteger(v.scale) && v.scale >= 1);
    }
  }
});

test('toCss maps a stage rectangle to CSS pixels on the page', () => {
  assert.deepEqual(toCss([10, 20, 30, 40], chooseView(1920, 1080, 2)), { left: 50, top: 100, width: 150, height: 200 });
  const phone = toCss([0, 0, 216, 384], chooseView(390, 844, 3));
  near(phone.left, 15);
  near(phone.top, 305 / 3);
  near(phone.width, 360);
  near(phone.height, 640);
});
