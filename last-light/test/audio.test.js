import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';
import { fakeAudioContext } from './fake-audio.js';
import { quietState } from './helpers.js';
import { emit } from '../src/events.js';

function memoryStorage() {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, String(v)) };
}

function withAudio(fn) {
  let ctx;
  globalThis.AudioContext = function () {
    ctx = fakeAudioContext();
    return ctx;
  };
  try {
    return fn(() => ctx);
  } finally {
    delete globalThis.AudioContext;
  }
}

test('every event type makes a sound without error', () =>
  withAudio((ctx) => {
    const audio = createAudio(memoryStorage());
    audio.start();
    const s = quietState();
    const types = ['shot', 'dry', 'reload', 'switch', 'hit', 'hurt', 'windup', 'shriek', 'leap', 'birth', 'flareThrow', 'pickup', 'wave', 'dawn', 'dead', 'spawn', 'flareOut', 'lull'];
    for (const type of types) {
      s.eventCount = 0;
      emit(s, type, 20, 25, type === 'hit' ? 1 : 0, 1);
      audio.events(s);
    }
    assert.ok(ctx().started.length > 20);
  }));

test('the score and the ambience play while a night is on', () =>
  withAudio((ctx) => {
    const audio = createAudio(memoryStorage());
    audio.start();
    const s = quietState();
    s.night.phase = 'wave';
    s.night.wave = 7;
    const before = ctx().started.length;
    for (let i = 0; i < 20; i++) {
      ctx().currentTime += 0.1;
      audio.update(s, 0, 'playing');
    }
    assert.ok(ctx().started.length > before + 10);
  }));

test('a creature sound takes a free voice, or else the one playing farthest from you', () => {
  // Record the panners, which are the positional voices, in the order they're made.
  const panners = [];
  globalThis.AudioContext = function () {
    const ctx = fakeAudioContext(), make = ctx.createPanner;
    ctx.createPanner = () => {
      const p = make();
      panners.push(p);
      return p;
    };
    return ctx;
  };
  try {
    const audio = createAudio(memoryStorage());
    audio.start();
    const s = quietState(), p = s.player;
    const hitAt = (dx) => {
      s.eventCount = 0;
      emit(s, 'hit', p.x + dx, p.y, 0, 0);
      audio.events(s);
    };
    for (let i = 0; i < panners.length; i++) hitAt(1 + i); // every voice busy, the last one farthest
    assert.deepEqual(panners.map((v) => v.positionX.value - p.x), panners.map((_, i) => 1 + i));
    hitAt(0.5);
    assert.equal(panners.at(-1).positionX.value, p.x + 0.5, 'the farthest voice gives way');
    assert.equal(panners[0].positionX.value, p.x + 1, 'the nearest keeps playing');
  } finally {
    delete globalThis.AudioContext;
  }
});

test('mute and volume are remembered', () => {
  const storage = memoryStorage();
  const a = createAudio(storage);
  a.toggleMute();
  a.setVolume(0.3);
  const b = createAudio(storage);
  assert.equal(b.muted, true);
  assert.equal(b.volume, 0.3);
});

test('with no Web Audio at all, everything is silently a no-op', () => {
  const a = createAudio(memoryStorage());
  a.start();
  a.events(quietState());
  a.update(quietState(), 0, 'playing');
  a.toggleMute();
});
