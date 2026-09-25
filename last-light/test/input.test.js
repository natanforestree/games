import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';
import { MOUSE, VIEW } from '../src/tuning.js';

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

test('moving the mouse up looks up and down looks down, at once, as far as VIEW.maxPitch either way', () => {
  const { win, doc, input } = setup();
  win.fire('mousemove', { movementY: -40 });
  assert.ok(Math.abs(input.pitch - 40 * MOUSE.sensitivity) < 1e-12, `up is positive: ${input.pitch}`);
  input.sensitivity = 2;
  win.fire('mousemove', { movementY: 40 });
  assert.ok(Math.abs(input.pitch + 40 * MOUSE.sensitivity) < 1e-12, 'the sensitivity scales it too');
  assert.equal(input.sample().pitch, input.pitch);
  for (let i = 0; i < 20; i++) win.fire('mousemove', { movementY: -100 });
  assert.equal(input.pitch, VIEW.maxPitch);
  for (let i = 0; i < 40; i++) win.fire('mousemove', { movementY: 100 });
  assert.equal(input.pitch, -VIEW.maxPitch);
  assert.equal(input.facing, 0, 'looking up and down never turns you');
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  win.fire('mousemove', { movementY: -100 });
  assert.equal(input.pitch, -VIEW.maxPitch, 'unlocked: no looking');
});

test('a single huge mouse jump is a browser glitch and is ignored', () => {
  const { win, input } = setup();
  win.fire('mousemove', { movementX: MOUSE.spike + 1 });
  assert.equal(input.facing, 0);
  const other = setup(); // judged from stillness, not from the jump above
  other.win.fire('mousemove', { movementX: 3, movementY: -(MOUSE.spike + 1) });
  assert.deepEqual([other.input.facing, other.input.pitch], [0, 0], 'a jump up or down is dropped too, sideways and all');
});

test('a fast flick that ramps up is a hand, not a glitch: every event of it turns you', () => {
  const { win, input } = setup();
  input.sensitivity = MOUSE.minScale; // the slider at its lowest, where a panicked flick is biggest
  for (const dx of [200, 400, 700, 900, 900]) win.fire('mousemove', { movementX: dx });
  assert.ok(Math.abs(input.facing - 3100 * MOUSE.sensitivity * MOUSE.minScale) < 1e-12, `turned ${input.facing}`);
});

test('a jump out of a slow turn is still a glitch, and the lock starts every judgement afresh', () => {
  const { win, doc, input } = setup();
  input.sensitivity = MOUSE.minScale;
  const turn = MOUSE.sensitivity * MOUSE.minScale;
  win.fire('mousemove', { movementX: 30 });
  win.fire('mousemove', { movementX: 5000 });
  assert.ok(Math.abs(input.facing - 30 * turn) < 1e-12, 'the jump is dropped');
  // A fast flick, then Esc and back: the glitch that comes with the new lock isn't judged by that flick.
  const before = input.facing;
  for (const dx of [300, 700, 900]) win.fire('mousemove', { movementX: dx });
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  doc.pointerLockElement = input.element;
  doc.fire('pointerlockchange');
  win.fire('mousemove', { movementX: 3000 });
  assert.ok(Math.abs(input.facing - before - 1900 * turn) < 1e-12, `turned ${input.facing - before}`);
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

test("keys 1 to 3 are the fire's cards too: 1 and 2 still give their gun, 3 only a card", () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'Digit2' });
  let s = input.sample();
  assert.deepEqual([s.pick, s.weapon], [2, 2]);
  win.fire('keyup', { code: 'Digit2' });
  win.fire('keydown', { code: 'Digit3' });
  s = input.sample();
  assert.deepEqual([s.pick, s.weapon], [3, 0]);
  assert.equal(input.sample().pick, 0, 'a press counts once');
  win.fire('keyup', { code: 'Digit3' });
  win.fire('keydown', { code: 'Digit1' });
  input.releaseAll(); // a pause between the press and the next update forgets it
  assert.equal(input.sample().pick, 0);
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

test('a long trackpad fling is one weapon step however long it runs; a fresh flick after a pause is another', () => {
  const { win, input } = setup();
  // One wheel event every 16 ms for a second, sampled at 120 Hz as the game does.
  const steps = [];
  let at = 1000;
  for (let t = 1000; t < 2000; t += 1000 / 120) {
    for (; at <= t; at += 16) win.fire('wheel', { deltaY: 30, timeStamp: at });
    const s = input.sample().weaponStep;
    if (s) steps.push(s);
  }
  assert.deepEqual(steps, [1]);
  win.fire('wheel', { deltaY: -30, timeStamp: at + 200 });
  assert.equal(input.sample().weaponStep, -1);
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
