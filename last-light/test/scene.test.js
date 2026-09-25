import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScene, buildFrame, creatureFrame, sceneEvents } from '../src/scene.js';
import { spawnCreature, CRAWLER, LEAPER, GAUNT } from '../src/creatures.js';
import { createLightmap, lightAt } from '../src/lightmap.js';
import { emit } from '../src/events.js';
import { LIGHT } from '../src/tuning.js';
import { fakeArt } from './fake-art.js';
import { quietState } from './helpers.js';

const view = (over = {}) => ({ facing: Math.PI / 2, alpha: 1, time: 0, dt: 1 / 60, reducedMotion: false, h: 270, focal: 240, ...over });

test('the camera blends between the last two updates', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  s.player.px = 10;
  s.player.x = 11;
  const f = buildFrame(scene, s, createLightmap(s.map), view({ alpha: 0.25 }));
  assert.equal(f.x, 10.25);
});

test('the view looks up and down with the mouse, at once', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  assert.equal(buildFrame(scene, s, createLightmap(s.map), view()).pitch, 0);
  assert.equal(buildFrame(scene, s, createLightmap(s.map), view({ pitch: -0.3 })).pitch, -0.3);
});

test('every creature, prop, active pickup and burning flare becomes a sprite', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  spawnCreature(s, CRAWLER, 19.5, 25.5);
  spawnCreature(s, GAUNT, 21.5, 25.5);
  s.pickups[0].active = true;
  s.flares[0].t = 5;
  const f = buildFrame(scene, s, createLightmap(s.map), view());
  assert.equal(f.spriteCount, 2 + s.map.props.length + 1 + 1);
});

test('a creature walking across your view shows its side, flipped by direction; towards you, its front', () => {
  const art = fakeArt();
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 25.5);
  const out = { frame: null, flip: false };
  const rx = -1, ry = 0; // camera facing south: its right is west
  c.heading = -Math.PI / 2; // straight at you
  creatureFrame(art, c, 19.5, 20.5, rx, ry, out);
  assert.ok(art.sprites.crawler.anims.walk.map((i) => art.sprites.crawler.frames[i]).includes(out.frame));
  c.heading = 0; // east: to your left
  creatureFrame(art, c, 19.5, 20.5, rx, ry, out);
  assert.ok(art.sprites.crawler.anims['side-walk'].map((i) => art.sprites.crawler.frames[i]).includes(out.frame));
  const eastFlip = out.flip;
  c.heading = Math.PI;
  creatureFrame(art, c, 19.5, 20.5, rx, ry, out);
  assert.notEqual(out.flip, eastFlip);
});

test('crouching and leaping leapers, winding-up gaunts, and the dying show those frames', () => {
  const art = fakeArt();
  const s = quietState();
  const out = { frame: null, flip: false };
  const l = spawnCreature(s, LEAPER, 19.5, 25.5);
  l.mode = 'crouch';
  creatureFrame(art, l, 19.5, 20.5, -1, 0, out);
  assert.equal(out.frame, art.sprites.leaper.frames[art.sprites.leaper.anims.crouch[0]]);
  const g = spawnCreature(s, GAUNT, 19.5, 25.5);
  g.mode = 'windup';
  creatureFrame(art, g, 19.5, 20.5, -1, 0, out);
  assert.equal(out.frame, art.sprites.gaunt.frames[art.sprites.gaunt.anims.windup[0]]);
  g.dying = 0.01;
  creatureFrame(art, g, 19.5, 20.5, -1, 0, out);
  const die = art.sprites.gaunt.anims.die;
  assert.equal(out.frame, art.sprites.gaunt.frames[die[die.length - 1]]);
});

test('eyes fade out with distance', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  spawnCreature(s, CRAWLER, 19.5, 22.5);
  spawnCreature(s, CRAWLER, 19.5, 20.5 + LIGHT.eyes.dark + 1);
  const f = buildFrame(scene, s, createLightmap(s.map), view());
  const glows = f.sprites.slice(0, 2).map((x) => x.glow);
  assert.deepEqual(glows, [15, 0]);
});

test('the lantern lights where you stand, and the muzzle flash adds to it', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  const lm = createLightmap(s.map);
  buildFrame(scene, s, lm, view());
  const plain = lightAt(lm, s.player.x, s.player.y);
  assert.ok(plain > 0.9 * LIGHT.lantern.intensity, 'the lantern at full where you stand, less its flicker');
  s.flash = 0.04;
  buildFrame(scene, s, lm, view());
  assert.ok(lightAt(lm, s.player.x, s.player.y) > plain + 0.5);
});

test('reduced motion: no head bob, no shake', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  s.player.vx = 3;
  s.player.walked = 0.2;
  s.shake = 0.1;
  let f = buildFrame(scene, s, createLightmap(s.map), view({ reducedMotion: true, time: 1.3 }));
  assert.equal(f.bob, 0);
  assert.deepEqual([scene.shakeX, scene.shakeY], [0, 0]);
  f = buildFrame(scene, s, createLightmap(s.map), view({ time: 1.3 }));
  assert.notEqual(f.bob, 0);
});

test('a hit throws a spray of droplets that fall to the snow', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  s.eventCount = 0;
  emit(s, 'hit', 19.5, 25.5, 1, 1);
  sceneEvents(scene, s);
  const live = scene.fx.drops.filter((d) => d.t > 0);
  assert.equal(live.length, 14);
  for (let i = 0; i < 10; i++) buildFrame(scene, s, createLightmap(s.map), view());
  assert.ok(live.every((d) => d.y > 25.5), 'thrown away from you');
  for (let i = 0; i < 60; i++) buildFrame(scene, s, createLightmap(s.map), view());
  assert.ok(live.every((d) => d.t > 0 && d.z === 0), 'landed, and still lying there');
  for (let i = 0; i < 30; i++) buildFrame(scene, s, createLightmap(s.map), view());
  assert.ok(live.every((d) => d.t <= 0), 'gone');
});
