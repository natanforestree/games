import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step } from '../src/sim.js';
import { startWave, ambientFor, hourLabel, LAST_WAVE } from '../src/night.js';
import { aliveCount, KINDS } from '../src/creatures.js';
import { NIGHT, DT, LIGHT, FLARE, SHOTGUN, SHELL_BOX } from '../src/tuning.js';
import { run, runCollecting, intents } from './helpers.js';

const killAll = (s) => s.creatures.forEach((c) => (c.alive = false));

test('dusk lasts a few seconds, then the 9 PM wave starts', () => {
  const s = createState({ seed: 2 });
  assert.equal(hourLabel(s.night), '8 PM');
  const ev = runCollecting(s, NIGHT.dusk + DT);
  assert.ok(ev.some((e) => e.type === 'wave' && e.a === 0));
  assert.equal(s.night.phase, 'wave');
  assert.equal(hourLabel(s.night), '9 PM');
});

test('each wave queues exactly its row of the table', () => {
  for (let i = 0; i <= LAST_WAVE; i++) {
    const s = createState({ seed: 3 });
    startWave(s, i);
    const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
    for (let j = 0; j < s.night.qn; j++) counts[KINDS[s.night.queue[j]]]++;
    assert.deepEqual(counts, NIGHT.waves[i], `wave ${i}`);
  }
});

test('the Mother comes early in her wave', () => {
  const s = createState({ seed: 4 });
  startWave(s, LAST_WAVE);
  const at = [...s.night.queue.subarray(0, s.night.qn)].indexOf(3);
  assert.ok(at >= 0 && at <= 3);
});

test('creatures trickle out under the alive cap, from trails away from you', () => {
  const s = createState({ seed: 5, god: true });
  startWave(s, 6); // 36 creatures, cap 22
  let most = 0;
  for (let i = 0; i < 20 / DT; i++) {
    step(s, intents());
    most = Math.max(most, aliveCount(s));
  }
  assert.equal(most, NIGHT.aliveCap(7));
});

test('spawns come from trails at least 8 cells from you when there are any', () => {
  const s = createState({ seed: 6 });
  startWave(s, 5);
  const ev = runCollecting(s, 5).filter((e) => e.type === 'spawn');
  assert.ok(ev.length > 3);
  for (const e of ev) assert.ok(Math.hypot(e.x - s.player.x, e.y - s.player.y) >= NIGHT.spawnAway - 0.3);
});

test('clearing a wave starts a lull: the clock moves on, a flare turns up, the stove heals', () => {
  const s = createState({ seed: 7 });
  startWave(s, 0);
  s.night.qi = s.night.qn;
  killAll(s);
  const ev = runCollecting(s, DT);
  assert.ok(ev.some((e) => e.type === 'lull' && e.a === 1));
  assert.equal(hourLabel(s.night), '10 PM');
  assert.ok(s.pickups[0].active);
  assert.ok(!s.pickups[1].active, 'no shells before the shotgun');
  s.player.health = 50;
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 1;
  run(s, 1);
  assert.ok(Math.abs(s.player.health - (50 + NIGHT.stoveHeal)) < 0.5);
  run(s, NIGHT.lull);
  assert.equal(s.night.phase, 'wave');
  assert.equal(s.night.wave, 1);
});

test('the stove does not heal during a wave', () => {
  const s = createState({ seed: 8 });
  startWave(s, 0);
  s.night.spawnT = Infinity;
  s.player.health = 50;
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 1;
  run(s, 1);
  assert.equal(s.player.health, 50);
});

test('the shotgun appears before 11 PM; walking onto it gives it to you, loaded', () => {
  const s = createState({ seed: 9 });
  startWave(s, 1);
  s.night.qi = s.night.qn;
  killAll(s);
  run(s, DT);
  const gun = s.pickups[2];
  assert.ok(gun.active);
  s.player.x = gun.x;
  s.player.y = gun.y;
  const ev = runCollecting(s, DT);
  assert.ok(ev.some((e) => e.type === 'pickup' && e.a === 2));
  assert.ok(s.gun.hasShotgun && s.gun.shells === SHOTGUN.shells);
  assert.equal(s.gun.shells + s.gun.spare, SHOTGUN.foundWith);
});

test('pickups: a flare up to the carry limit; a shell box', () => {
  const s = createState({ seed: 10, wave: 3 });
  s.gun.flares = FLARE.max;
  s.pickups[0].active = true;
  s.player.x = s.pickups[0].x;
  s.player.y = s.pickups[0].y;
  run(s, DT);
  assert.ok(s.pickups[0].active, 'left there when you carry the most');
  s.gun.spare = 0;
  s.pickups[1].active = true;
  s.player.x = s.pickups[1].x;
  s.player.y = s.pickups[1].y;
  run(s, DT);
  assert.equal(s.gun.spare, SHELL_BOX);
});

test('clearing 4 AM brings the dawn; the light rises to day', () => {
  const s = createState({ seed: 11, wave: LAST_WAVE });
  startWave(s, LAST_WAVE);
  s.night.qi = s.night.qn;
  killAll(s);
  const ev = runCollecting(s, DT);
  assert.ok(ev.some((e) => e.type === 'dawn'));
  assert.equal(s.night.reached, LAST_WAVE + 1);
  const before = ambientFor(s.night);
  run(s, LIGHT.dawnTime);
  assert.ok(ambientFor(s.night) > before);
  assert.ok(Math.abs(ambientFor(s.night) - LIGHT.dawn) < 1e-9);
});

test('running out of health ends the night at the hour you reached', () => {
  const s = createState({ seed: 12 });
  startWave(s, 2);
  s.player.health = 1;
  s.player.x = 19.5;
  s.player.y = 20.5;
  const ev = [];
  for (let i = 0; i < 60 / DT && s.night.phase !== 'dead'; i++) {
    step(s, intents());
    for (let k = 0; k < s.eventCount; k++) ev.push(s.events[k].type);
  }
  assert.equal(s.night.phase, 'dead');
  assert.ok(ev.includes('dead'));
  assert.equal(s.night.reached, 2);
  const x = s.player.x;
  run(s, 1, intents({ forward: 1 }));
  assert.equal(s.player.x, x, 'nothing moves after death');
});

test('?wave= starts you at that wave, with the shotgun from 11 PM', () => {
  const s = createState({ seed: 13, wave: 5 });
  assert.equal(s.night.wave, 5);
  assert.ok(s.gun.hasShotgun);
  run(s, NIGHT.dusk + DT);
  assert.equal(s.night.wave, 5);
  assert.equal(s.night.phase, 'wave');
});
