import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunFrame, handFrame, drawHud, drawScreen } from '../src/hud.js';
import { createGun, giveShotgun, RIFLE_ID, SHOTGUN_ID } from '../src/weapons.js';
import { SWITCH_TIME, RIFLE, FLARE } from '../src/tuning.js';
import { fakeArt, fakeContext, HANDS } from './fake-art.js';
import { quietState } from './helpers.js';

test('the rifle: flash, idle, the lever working, reloading', () => {
  const g = createGun();
  g.shotT = 0.03;
  assert.equal(gunFrame(g).name, 'rifle-fire');
  g.shotT = 0.25;
  assert.equal(gunFrame(g).name, 'rifle-lever-1');
  g.shotT = 0.35;
  assert.equal(gunFrame(g).name, 'rifle-lever-2');
  g.shotT = 5;
  g.reloading = true;
  g.reloadT = RIFLE.reloadPerRound * 0.1;
  assert.equal(gunFrame(g).name, 'rifle-reload-3');
  g.reloading = false;
  assert.equal(gunFrame(g).name, 'rifle-idle');
});

test('switching lowers one gun and raises the other', () => {
  const g = createGun();
  g.shotT = 5;
  g.next = SHOTGUN_ID;
  g.switching = SWITCH_TIME * 0.75;
  let f = gunFrame(g);
  assert.equal(f.name, 'rifle-idle');
  assert.ok(f.drop > 0.4 && f.drop < 0.6);
  g.switching = SWITCH_TIME * 0.25;
  f = gunFrame(g);
  assert.equal(f.name, 'shotgun-idle');
  assert.ok(f.drop > 0.4 && f.drop < 0.6);
});

test('every frame name the HUD can ask for exists in the hands art', () => {
  const g = createGun();
  const names = new Set();
  for (const current of [RIFLE_ID, SHOTGUN_ID]) {
    g.current = current;
    for (const reloading of [false, true]) {
      g.reloading = reloading;
      for (let t = 0; t < 1.3; t += 0.01) {
        g.shotT = t;
        g.reloadT = t;
        names.add(gunFrame(g).name);
      }
    }
  }
  for (const t of [0, 0.1, FLARE.cooldown - 0.05, FLARE.cooldown - 0.2]) {
    g.flareT = t;
    names.add(handFrame(g, 0));
    names.add(handFrame(g, 0.125));
  }
  for (const n of names) assert.ok(HANDS.includes(n), n);
});

test('the HUD shows your health, the hour, rounds and flares', () => {
  const art = fakeArt();
  const ctx = fakeContext();
  const s = quietState();
  s.player.health = 64.2;
  s.gun.rifle = 5;
  drawHud(ctx, art, s, { w: 480, h: 270 }, { time: 0, hitT: 9, banner: { t: 0 }, reducedMotion: false });
  const texts = ctx.calls.texts.map((t) => t.str);
  assert.ok(texts.includes('65'));
  assert.ok(texts.includes('8 PM'));
  const icons = ctx.calls.images.filter((i) => i.img === art.hud.image).map((i) => i.args[0]);
  const at = (name) => art.hud.icons[name][0];
  assert.equal(icons.filter((x) => x === at('round')).length, 5);
  assert.equal(icons.filter((x) => x === at('roundEmpty')).length, 3);
  assert.equal(icons.filter((x) => x === at('flare')).length, FLARE.start);
});

test('with the shotgun: shells loaded, and the spares as a number', () => {
  const art = fakeArt();
  const ctx = fakeContext();
  const s = quietState();
  giveShotgun(s);
  s.gun.current = SHOTGUN_ID;
  s.gun.switching = 0;
  drawHud(ctx, art, s, { w: 480, h: 270 }, { time: 0, hitT: 9, banner: { t: 0 }, reducedMotion: false });
  assert.ok(ctx.calls.texts.map((t) => t.str).includes('6'));
});

test('hurt: the edges glow red', () => {
  const art = fakeArt();
  const ctx = fakeContext();
  const s = quietState();
  s.hurt = 0.3;
  drawHud(ctx, art, s, { w: 480, h: 270 }, { time: 0, hitT: 9, banner: { t: 0 }, reducedMotion: false });
  assert.equal(ctx.calls.rects.filter((r) => r.color === art.ui.hurt).length, 4);
});

test('the title shows your best night; the death screen the hour it ended', () => {
  const art = fakeArt();
  let ctx = fakeContext();
  drawScreen(ctx, art, { w: 480, h: 270 }, 'title', { time: 0, best: { hour: 5, dawns: 0 }, reached: 0, kills: 0 });
  assert.ok(ctx.calls.texts.some((t) => t.str === 'Best night: 2 AM'));
  ctx = fakeContext();
  drawScreen(ctx, art, { w: 480, h: 270 }, 'dead', { time: 0, best: { hour: 5, dawns: 0 }, reached: 3, kills: 40 });
  assert.ok(ctx.calls.texts.some((t) => t.str.startsWith('It was 12 AM.')));
});

test('the death and dawn screens say "after-eater" singular for one, plural otherwise', () => {
  const art = fakeArt();
  let ctx = fakeContext();
  drawScreen(ctx, art, { w: 480, h: 270 }, 'dead', { time: 0, best: { hour: 5, dawns: 0 }, reached: 3, kills: 1 });
  assert.ok(ctx.calls.texts.some((t) => t.str === 'It was 12 AM.  1 after-eater fell.'));
  ctx = fakeContext();
  drawScreen(ctx, art, { w: 480, h: 270 }, 'dead', { time: 0, best: { hour: 5, dawns: 0 }, reached: 3, kills: 40 });
  assert.ok(ctx.calls.texts.some((t) => t.str === 'It was 12 AM.  40 after-eaters fell.'));
  ctx = fakeContext();
  drawScreen(ctx, art, { w: 480, h: 270 }, 'dawn', { time: 0, best: { hour: 5, dawns: 0 }, reached: 8, kills: 1 });
  assert.ok(ctx.calls.texts.some((t) => t.str === 'You held the cabin.  1 after-eater fell.'));
});
