import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../assets/fighter.json' with { type: 'json' };
import palette from '../assets/palette.json' with { type: 'json' };
import { T } from '../src/tuning.js';
import { SCREENS } from '../src/level.js';
import { blade } from '../src/combat.js';
import { frameFor, animName, drawFighters } from '../src/draw-fighters.js';
import { duel, run, keys } from './helpers.js';
import { fakeContext } from './fake-canvas.js';

const STATES = ['stand', 'run', 'lunge', 'crouch', 'crawl', 'roll', 'cartwheel', 'air', 'divekick', 'sweep', 'punch', 'throw',
  'throwpose', 'knocked', 'getup', 'rollup', 'ledge', 'climb', 'wallcling', 'necksnap', 'dead'];

test('every fighter state has a frame, armed or not, in every stance, still or moving', () => {
  for (const state of STATES) for (const armed of [true, false]) for (const stance of [0, 1, 2]) for (const vx of [0, 1]) {
    const f = { state, armed, stance, vx, vy: vx ? -1 : 0, t: 0 };
    assert.notEqual(frameFor(f, data.anims), null, `${state} armed=${armed} stance=${stance} vx=${vx}`);
  }
});

test('lunge frames follow the lunge: coil, thrust, recover', () => {
  const at = (t) => frameFor({ state: 'lunge', stance: 1, armed: true, t }, data.anims);
  const [coil, thrust, recover] = data.anims.lunge1.frames;
  assert.equal(at(1), coil);
  assert.equal(at(T.LUNGE_STARTUP_TICKS + 1), thrust);
  assert.equal(at(T.LUNGE_STARTUP_TICKS + T.LUNGE_ACTIVE_TICKS + 1), recover);
});

test('walking uses the walk for its stance; running unarmed uses the run', () => {
  assert.equal(animName({ state: 'stand', armed: true, stance: 2, vx: 0.9 }), 'walk2');
  assert.equal(animName({ state: 'stand', armed: false, stance: 1, vx: 1.9 }), 'run');
});

test("a dead fighter's body is drawn only during the death frames", () => {
  const a = data.anims.death;
  assert.notEqual(frameFor({ state: 'dead', t: 0 }, data.anims), null);
  assert.equal(frameFor({ state: 'dead', t: a.frames.length * a.rate }, data.anims), null);
});

test('nothing is drawn for a fighter who is off-screen', () => {
  assert.equal(frameFor({ state: 'gone', t: 0 }, data.anims), null);
});

test("the live blade is drawn in palette.json's blade colors, on its collision segment, stopping at a wall", () => {
  const s = duel({ screen: 5, x0: 240 }); // B2+: the pillar starts at x = 250, 6 px past the hilt
  s.fighters[1].state = 'gone';
  const bl = blade(s.fighters[0], SCREENS[5]);
  assert.deepEqual([bl.x0, bl.x1, bl.y], [244, 250, 137]);
  const ctx = fakeContext();
  drawFighters(ctx, s, { fighter: { data, sheets: [{}, {}] }, palette });
  const drawn = ctx.rects.filter((r) => r.y === bl.y && r.h === 1).map((r) => [r.x, r.w, r.color]);
  assert.deepEqual(drawn, [[244, 6, palette.blade.body], [244, 2, palette.blade.hilt], [247, 3, palette.blade.tip]]);
});

test('the death animation plays out while the fighter waits to respawn', () => {
  const s = duel({ x0: 60, x1: 140 });
  Object.assign(s.fighters[0], { state: 'run', moveDir: 1, moveT: 30 });
  for (let i = 0; i < 100 && s.fighters[0].state !== 'dead'; i++) run(s, 1, keys('right'));
  const a = data.anims.death;
  run(s, a.frames.length * a.rate);
  assert.equal(frameFor(s.fighters[0], data.anims), null);
});
