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

// down.has(e.code) alone would also block this OS repeat, so it wouldn't catch a guard that lost
// its `e.repeat ||`: the real danger is a key held through Cmd-Tab, where blur empties `down`, and
// the OS repeat keydown on return looks exactly like a fresh press unless `e.repeat` stops it too.
test('OS auto-repeat on refocus, after a blur emptied the held set, is still not a new press', () => {
  const { input, target, key } = setup();
  key('keydown', 'KeyF');
  input.sample();
  input.takeUI();
  target.dispatchEvent(new Event('blur'));
  assert.equal(input.sample().attack, false);
  key('keydown', 'KeyF', { repeat: true });
  assert.equal(input.sample().attack, false);
  assert.equal(input.takeUI().has('attack'), false);
});

test('a tap not yet sampled is still cleared by losing focus', () => {
  const { input, target, key } = setup();
  key('keydown', 'KeyF');
  key('keyup', 'KeyF');
  target.dispatchEvent(new Event('blur'));
  assert.equal(input.sample().attack, false);
});

test('Cmd or Ctrl held with a bound key is left alone: nothing recorded, and the shortcut is not prevented', () => {
  const { input, key } = setup();
  assert.equal(key('keydown', 'KeyD', { metaKey: true }), true); // dispatchEvent: true means preventDefault was never called
  assert.equal(input.sample().right, false);
  assert.equal(key('keydown', 'KeyS', { ctrlKey: true }), true);
  assert.equal(input.sample().down, false);
  assert.equal(input.takeUI().size, 0);
});

test('Cmd going down releases whatever was already held, since its keyup may never come', () => {
  const { input, key } = setup();
  key('keydown', 'KeyD');
  assert.equal(input.sample().right, true);
  key('keydown', 'MetaLeft');
  assert.equal(input.sample().right, false);
});
