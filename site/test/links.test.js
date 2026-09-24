import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapDecision, activeIsland, createLinks } from '../links.js';

// A minimal stand-in for the DOM createLinks needs: one anchor per id, and no-op listeners.
function fakeDoc(ids) {
  const anchors = ids.map((id) => ({ dataset: { game: id }, style: {}, addEventListener() {} }));
  return { anchors, querySelectorAll: () => anchors, addEventListener() {} };
}

test('on touch, the first tap on an island arms it and a second tap on it plays', () => {
  assert.equal(tapDecision(null, 'snake'), 'arm');
  assert.equal(tapDecision('snake', 'snake'), 'go');
  assert.equal(tapDecision('snake', 'marrow'), 'arm'); // tapping another island moves the sign, it doesn't play
});

test('the mouse wins over a tapped island, which wins over keyboard focus', () => {
  assert.equal(activeIsland({ hovered: 'a', armed: 'b', focused: 'c' }), 'a');
  assert.equal(activeIsland({ hovered: null, armed: 'b', focused: 'c' }), 'b');
  assert.equal(activeIsland({ hovered: null, armed: null, focused: 'c' }), 'c');
  assert.equal(activeIsland({ hovered: null, armed: null, focused: null }), null);
});

test('active(): a focused link only counts when :focus-visible says so', () => {
  const doc = fakeDoc(['snake']);
  const [a] = doc.anchors;
  const links = createLinks(doc, { addEventListener() {} });
  doc.activeElement = a;
  a.matches = () => true;
  assert.equal(links.active(), 'snake');
  a.matches = () => false;
  assert.equal(links.active(), null);
});

test('active(): a :focus-visible that throws (older Safari, Chrome and Firefox) is treated as visible', () => {
  const doc = fakeDoc(['snake']);
  const [a] = doc.anchors;
  const links = createLinks(doc, { addEventListener() {} });
  doc.activeElement = a;
  a.matches = () => { throw new SyntaxError("':focus-visible' is not a valid selector"); };
  assert.equal(links.active(), 'snake');
});

test("reset() clears place()'s inline positioning, so a failed scene doesn't leave the plain list with island-sized gaps", () => {
  const doc = fakeDoc(['snake', 'marrow']);
  const links = createLinks(doc, { addEventListener() {} });
  for (const a of doc.anchors) Object.assign(a.style, { left: '1px', top: '2px', width: '300px', height: '200px' });
  links.reset();
  for (const a of doc.anchors) assert.deepEqual(a.style, { left: '', top: '', width: '', height: '' });
});
