import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeStorage } from '../src/storage.js';

test('reads back what it wrote, as strings', () => {
  const m = new Map();
  const s = safeStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) });
  s.set('marrow-best', 1234);
  assert.equal(s.get('marrow-best'), '1234');
  assert.equal(s.get('missing'), null);
});

test('storage that throws (private window, blocked site data) is survivable', () => {
  const s = safeStorage({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
  assert.equal(s.get('x'), null);
  assert.doesNotThrow(() => s.set('x', 1));
});

test('no storage at all is survivable', () => {
  const s = safeStorage(null);
  assert.equal(s.get('x'), null);
  assert.doesNotThrow(() => s.set('x', 1));
});
