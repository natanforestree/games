import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';
import { MOUSE } from '../src/tuning.js';

// A stand-in for window and document: dispatches events to listeners.
function fakeTarget() {
  const ls = {};
  return {
    addEventListener: (t, f) => (ls[t] ??= []).push(f),
    fire: (t, e = {}) => {
      const evt = { prevented: false, preventDefault() { evt.prevented = true; }, ...e };
      (ls[t] ?? []).forEach((f) => f(evt));
      return evt;
    },
  };
}

function setup() {
  const win = fakeTarget(), doc = fakeTarget();
  const input = createInput(win, doc);
  const canvas = {};
  input.element = canvas;
  doc.pointerLockElement = canvas;
  doc.fire('pointerlockchange');
  return { win, doc, input };
}

test('WASD gives forward and strafe; Shift runs', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('keydown', { code: 'KeyD' });
  win.fire('keydown', { code: 'ShiftLeft' });
  let s = input.sample();
  assert.deepEqual([s.forward, s.strafe, s.run], [1, 1, true]);
  win.fire('keyup', { code: 'KeyW' });
  win.fire('keydown', { code: 'KeyS' });
  s = input.sample();
  assert.equal(s.forward, -1);
});

test('the mouse turns you at once, scaled by sensitivity, while the pointer is locked', () => {
  const { win, doc, input } = setup();
  win.fire('mousemove', { movementX: 100 });
  assert.ok(Math.abs(input.facing - 100 * MOUSE.sensitivity) < 1e-12);
  input.sensitivity = 2;
  win.fire('mousemove', { movementX: -50 });
  assert.ok(Math.abs(input.facing) < 1e-12);
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  win.fire('mousemove', { movementX: 100 });
  assert.ok(Math.abs(input.facing) < 1e-12, 'unlocked: no turning');
});

test('a single huge mouse jump is a browser glitch and is ignored', () => {
  const { win, input } = setup();
  win.fire('mousemove', { movementX: MOUSE.spike + 1 });
  assert.equal(input.facing, 0);
});

test('a click shorter than an update still fires once; holding keeps firing', () => {
  const { win, input } = setup();
  win.fire('mousedown', { button: 0 });
  win.fire('mouseup', { button: 0 });
  assert.equal(input.sample().fire, true);
  assert.equal(input.sample().fire, false);
  win.fire('mousedown', { button: 0 });
  assert.equal(input.sample().fire, true);
  assert.equal(input.sample().fire, true);
});

test('presses are latched once: reload, flare (F or right click), weapon keys', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyR' });
  win.fire('keydown', { code: 'KeyR', repeat: true });
  win.fire('mousedown', { button: 2 });
  win.fire('keydown', { code: 'Digit2' });
  let s = input.sample();
  assert.deepEqual([s.reload, s.flare, s.weapon], [1, 1, 2]);
  s = input.sample();
  assert.deepEqual([s.reload, s.flare, s.weapon], [0, 0, 0]);
  win.fire('keyup', { code: 'KeyR' });
  win.fire('keydown', { code: 'KeyR' });
  assert.equal(input.sample().reload, 1);
});

test('the wheel steps weapons, once per fling', () => {
  const { win, input } = setup();
  win.fire('wheel', { deltaY: 5, timeStamp: 1000 });
  win.fire('wheel', { deltaY: 5, timeStamp: 1020 });
  assert.equal(input.sample().weaponStep, 1);
  win.fire('wheel', { deltaY: -5, timeStamp: 1300 });
  assert.equal(input.sample().weaponStep, -1);
  assert.equal(input.sample().weaponStep, 0);
});

test('losing focus or the pointer lock releases every key and the trigger', () => {
  const { win, doc, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('mousedown', { button: 0 });
  win.fire('blur');
  let s = input.sample();
  assert.deepEqual([s.forward, s.fire], [0, false]);
  win.fire('keydown', { code: 'KeyW' });
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  s = input.sample();
  assert.equal(s.forward, 0);
});

test('a key pressed while paused does not carry into the resumed night', () => {
  const { win, doc, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('mousedown', { button: 0 });
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  win.fire('keydown', { code: 'KeyR' });
  win.fire('keydown', { code: 'KeyF' });
  win.fire('keydown', { code: 'Digit2' });
  doc.pointerLockElement = input.element;
  doc.fire('pointerlockchange');
  const s = input.sample();
  assert.deepEqual([s.forward, s.fire, s.reload, s.flare, s.weapon], [0, false, 0, 0, 0]);
});

test('Cmd shortcuts are left to the browser, and Cmd releases held keys', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('keydown', { code: 'MetaLeft' });
  assert.equal(input.sample().forward, 0);
  win.fire('keydown', { code: 'KeyR', metaKey: true });
  assert.equal(input.sample().reload, 0);
});

test('unlocked, a click is not a shot', () => {
  const { win, doc, input } = setup();
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  win.fire('mousedown', { button: 0 });
  assert.equal(input.sample().fire, false);
});

test('unlocked, movement keys reach the page (not default-prevented, not latched); M still mutes; locking lets them move you again', () => {
  const { win, doc, input } = setup();
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  const evt = win.fire('keydown', { code: 'ArrowLeft' });
  assert.equal(evt.prevented, false);
  assert.equal(input.sample().strafe, 0);
  win.fire('keydown', { code: 'KeyM' });
  assert.equal(input.takeUI().mute, 1);
  doc.pointerLockElement = input.element;
  doc.fire('pointerlockchange');
  win.fire('keydown', { code: 'ArrowLeft' });
  assert.equal(input.sample().strafe, -1);
});

test('releaseAll also forgets presses not yet taken', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyR' });
  input.releaseAll();
  assert.equal(input.sample().reload, 0);
});

test('M is a page press: taken once', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyM' });
  assert.equal(input.takeUI().mute, 1);
  assert.equal(input.takeUI().mute, 0);
});

test('lock() asks for raw input, and falls back to plain pointer lock', async () => {
  const { input } = setup();
  const asked = [];
  input.element = {
    requestPointerLock(opts) {
      asked.push(opts ?? null);
      return opts ? Promise.reject(new Error('unsupported')) : Promise.resolve();
    },
  };
  assert.equal(await input.lock(), true);
  assert.deepEqual(asked, [{ unadjustedMovement: true }, null]);
  input.element = { requestPointerLock: () => Promise.reject(new Error('too soon')) };
  assert.equal(await input.lock(), false);
});
