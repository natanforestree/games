import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, formatTime, INTRO_TICKS, RESULT_TICKS, BEST_KEY } from '../src/game.js';
import { NO_INPUT } from '../src/fighter.js';
import { worldOf } from '../src/render.js';

const memory = () => {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, String(v)) };
};
const GO = new Set(['confirm']);
const NONE = new Set();
const ticks = (g, n, ui = NONE) => {
  for (let i = 0; i < n; i++) g.tick(NO_INPUT, ui);
};
const toMatch = (g) => {
  g.tick(NO_INPUT, GO);
  ticks(g, INTRO_TICKS);
};
const finish = (g, winner) => {
  g.state.phase = 'over';
  g.state.winner = winner;
  g.tick(NO_INPUT, NONE);
};
const next = (g) => {
  ticks(g, RESULT_TICKS);
  ticks(g, INTRO_TICKS);
};

test('title, then the opponent intro, then the match against the Rusher', () => {
  const g = createGame({ storage: memory() });
  assert.equal(g.mode, 'title');
  g.tick(NO_INPUT, GO);
  assert.equal(g.mode, 'intro');
  ticks(g, INTRO_TICKS);
  assert.equal(g.mode, 'match');
  assert.equal(g.ais[1].personality, 'rusher');
});

test('losing replays the same opponent; winning moves up the ladder', () => {
  const g = createGame({ storage: memory() });
  toMatch(g);
  finish(g, 1);
  assert.equal(g.mode, 'result');
  assert.equal(g.outcome, 'lose');
  next(g);
  assert.equal(g.ais[1].personality, 'rusher');
  finish(g, 0);
  next(g);
  assert.equal(g.ais[1].personality, 'waiter');
});

test('beating the third opponent completes the ladder and saves the best time', () => {
  const storage = memory();
  const g = createGame({ storage });
  toMatch(g);
  for (let rung = 0; rung < 3; rung++) {
    ticks(g, 100);
    finish(g, 0);
    if (rung < 2) next(g);
  }
  assert.equal(g.mode, 'complete');
  assert.equal(g.newBest, true);
  assert.equal(g.best, g.timer);
  assert.equal(Number(storage.get(BEST_KEY)), g.timer);
});

test('a slower run keeps the old best time', () => {
  const storage = memory();
  storage.set(BEST_KEY, 5);
  const g = createGame({ storage });
  assert.equal(g.best, 5);
  toMatch(g);
  for (let rung = 0; rung < 3; rung++) {
    ticks(g, 10);
    finish(g, 0);
    if (rung < 2) next(g);
  }
  assert.equal(g.newBest, false);
  assert.equal(storage.get(BEST_KEY), '5');
});

test('pause stops the match and the timer; Esc again resumes', () => {
  const g = createGame({ storage: memory() });
  toMatch(g);
  const timer = g.timer, tick = g.state.tick;
  g.tick(NO_INPUT, new Set(['pause']));
  ticks(g, 30);
  assert.equal(g.timer, timer);
  assert.equal(g.state.tick, tick);
  g.tick(NO_INPUT, new Set(['pause']));
  assert.ok(g.timer > timer);
});

test('formatTime shows minutes, seconds and hundredths', () => {
  assert.equal(formatTime(0), '0:00.00');
  assert.equal(formatTime(60 * 61 + 30), '1:01.50');
});

test('debug mode plays itself through a whole match without a keyboard', () => {
  const g = createGame({ storage: memory(), debugCpu: true, seed: 4 });
  for (let i = 0; i < 300000 && g.results.length === 0; i++) g.tick(NO_INPUT, NONE);
  assert.equal(g.results.length, 1);
  assert.ok(g.results[0].winner === 0 || g.results[0].winner === 1);
});

test('each rung is drawn in its own world, and the title in the dusk world of the card icon', () => {
  const assets = { worldOrder: ['cathedral', 'dusk', 'abyss'], worlds: { cathedral: {}, dusk: {}, abyss: {} } };
  const g = createGame({ storage: memory() });
  assert.equal(worldOf(assets, g), assets.worlds.dusk);
  g.tick(NO_INPUT, GO);
  assert.equal(g.mode, 'intro');
  assert.equal(worldOf(assets, g), assets.worlds.cathedral); // the Rusher's intro, in the Rusher's world
  ticks(g, INTRO_TICKS);
  const seen = [];
  for (let rung = 0; rung < 3; rung++) {
    seen.push(worldOf(assets, g));
    finish(g, 0);
    assert.equal(worldOf(assets, g), seen[rung]); // the result shows the world just fought in
    if (rung < 2) next(g);
  }
  assert.deepEqual(seen, [assets.worlds.cathedral, assets.worlds.dusk, assets.worlds.abyss]);
});
