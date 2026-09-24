import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseView } from '../src/view.js';

test('1080p is exactly 4x: 480x270, 90 degrees across', () => {
  const v = chooseView(1920, 1080, 1);
  assert.deepEqual([v.scale, v.w, v.h, v.ox, v.oy], [4, 480, 270, 0, 0]);
  assert.ok(Math.abs(v.plane - 1) < 1e-9);
});

test('other screens pick the scale nearest 270 tall, and the width fills the window', () => {
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(2560, 1440, 1)), [5, 512, 288]);
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(1440, 900, 2)), [7, 412, 258]);
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(1280, 720, 1)), [3, 427, 240]);
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(300, 200, 1)), [1, 300, 200]);
});

test('the scaled view covers the window, cropping at most one pixel each way', () => {
  for (const [w, h, d] of [[1440, 900, 2], [1280, 720, 1], [1366, 768, 1], [1536, 864, 1.25]]) {
    const v = chooseView(w, h, d);
    assert.ok(v.w * v.scale >= v.dw && v.w * v.scale - v.dw < v.scale, `${w}x${h}@${d}`);
    assert.ok(v.h * v.scale >= v.dh && v.h * v.scale - v.dh < v.scale, `${w}x${h}@${d}`);
  }
});

test('past 21:9 the view stops widening and sits between bars', () => {
  const v = chooseView(3440 * 1.2, 1440, 1);
  assert.equal(v.w, Math.floor(288 * (21 / 9)));
  assert.ok(v.ox > 0);
});

test('a wider window sees more to the sides, with the same vertical field of view', () => {
  const a = chooseView(1920, 1080, 1), b = chooseView(2520, 1080, 1);
  assert.equal(a.focal, b.focal);
  assert.ok(b.plane > a.plane);
});