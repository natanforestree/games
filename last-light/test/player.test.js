import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, movePlayer } from '../src/player.js';
import { PLAYER, DT } from '../src/tuning.js';
import { room, intents, near } from './helpers.js';

const speed = (p) => Math.hypot(p.vx, p.vy);

test('walking reaches full speed within 0.1 s, running too', () => {
  const map = room();
  const p = createPlayer({ x: 3.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ forward: 1 }), DT);
  assert.ok(near(speed(p), PLAYER.walk), `walk ${speed(p)}`);
  const q = createPlayer({ x: 3.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, q, intents({ forward: 1, run: true }), DT);
  assert.ok(near(speed(q), PLAYER.run), `run ${speed(q)}`);
});

test('letting go stops you within 0.08 s, even from a run', () => {
  const map = room();
  const p = createPlayer({ x: 2.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ forward: 1, run: true }), DT);
  for (let i = 0; i < 10; i++) movePlayer(map, p, intents(), DT);
  assert.equal(speed(p), 0);
});

test('diagonal input is no faster than straight', () => {
  const map = room();
  const p = createPlayer({ x: 5.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ forward: 1, strafe: 1 }), DT);
  assert.ok(near(speed(p), PLAYER.walk), `${speed(p)}`);
});

test('strafe right moves to your right: south, when facing east', () => {
  const map = room();
  const p = createPlayer({ x: 5.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ strafe: 1 }), DT);
  assert.ok(p.y > 5.5 && near(p.x, 5.5), `${p.x} ${p.y}`);
});

test('the last position is kept for blending, and the facing follows the intent', () => {
  const map = room();
  const p = createPlayer({ x: 5.5, y: 5.5, facing: 0 });
  movePlayer(map, p, intents({ forward: 1, facing: 1 }), DT);
  assert.equal(p.px, 5.5);
  assert.equal(p.facing, 1);
  assert.ok(p.walked > 0);
});
