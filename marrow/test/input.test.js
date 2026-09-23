import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';

function setup() {
  const target = new EventTarget();
  const doc = new EventTarget();
  doc.hidden = false;
  const input = createInput(target, doc);
  const key = (type, code, extra = {}) =>
    target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, repeat: false, ...extra }));
  return { input, target, doc, key };
}

test('a held key reads as held on every sample until released', () => {
  const { input, key } = setup();
  key('keydown', 'KeyD');
  assert.equal(input.sample().right, true);
  assert.equal(input.sample().right, true);
  key('keyup', 'KeyD');
  assert.equal(input.sample().right, false);
});

test('a tap shorter than a tick still shows up for exactly one sample', () => {
  const { input, key } = setup();
  key('keydown', 'KeyF');
  key('keyup', 'KeyF');
  assert.equal(input.sample().attack, true);
  assert.equal(input.sample().attack, false);
});

test('OS key auto-repeat is not a new press', () => {
  const { input, key } = setup();
  key('keydown', 'KeyF');
  assert.equal(input.takeUI().has('attack'), true);
  key('keydown', 'KeyF', { repeat: true });
  key('keydown', 'KeyF', { repeat: true });
  assert.equal(input.takeUI().size, 0);
});

test('losing window focus releases every key', () => {
  const { input, target, key } = setup();
  key('keydown', 'KeyD');
  input.sample();
  target.dispatchEvent(new Event('blur'));
  assert.equal(input.sample().right, false);
});

test('hiding the tab releases every key', () => {
  const { input, doc, key } = setup();
  key('keydown', 'ArrowLeft');
  input.sample();
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(input.sample().left, false);
});

test('either binding holds an action, and letting go of one keeps it held', () => {
  const { input, key } = setup();
  key('keydown', 'KeyA');
  key('keydown', 'ArrowLeft');
  key('keyup', 'KeyA');
  assert.equal(input.sample().left, true);
});

test('pause, mute and confirm arrive through takeUI', () => {
  const { input, key } = setup();
  key('keydown', 'Escape');
  key('keydown', 'KeyM');
  key('keydown', 'Enter');
  assert.deepEqual([...input.takeUI()].sort(), ['confirm', 'mute', 'pause']);
});
