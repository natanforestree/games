import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapDecision, activeIsland } from '../links.js';

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
