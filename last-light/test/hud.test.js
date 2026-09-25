import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunFrame, handFrame, drawHud, drawScreen } from '../src/hud.js';
import { createGun, giveShotgun, RIFLE_ID, SHOTGUN_ID } from '../src/weapons.js';
import { SWITCH_TIME, RIFLE, FLARE } from '../src/tuning.js';
import { fakeArt, fakeContext, HANDS } from './fake-art.js';
import { quietState } from './helpers.js';
import { UPGRADE_LIST } from '../src/upgrades.js';

test('the rifle: flash, idle, the lever working, reloading', () => {
  const g = createGun();
  g.shotT = 0.03;
  assert.equal(gunFrame(g).name, 'rifle-fire');
  g.shotT = 0.25;
  assert.equal(gunFrame(g).name, 'rifle-lever-1');
  g.shotT = 0.35;
  assert.equal(gunFrame(g).name, 'rifle-lever-2');
  g.shotT = 5;
  assert.equal(gunFrame(g).name, 'rifle-idle');
});

test('loading the rifle, it goes down out of sight, and comes back up when it is done', () => {
  const g = createGun();
  g.shotT = 5;
  g.reloading = true;
  g.reloadT = RIFLE.reloadPerRound;
  const drops = [0, 0.05, 0.1, 0.2, 1].map((t) => {
    g.loadT = t;
    const f = gunFrame(g);
    assert.equal(f.name, 'rifle-idle');
    return f.drop;
  });
  assert.equal(drops[0], 0, 'it starts from where you hold it');
  assert.ok(drops[1] > 0 && drops[1] < drops[2], `and goes down smoothly: ${drops}`);
  assert.deepEqual(drops.slice(3), [2, 2], 'out of sight (a switch only lowers it to 1) until the loading is done');
  g.reloading = false;
  const up = [0, 0.05, 0.1, 0.2].map((t) => {
    g.loadT = t;
    return gunFrame(g).drop;
  });
  assert.equal(up[0], 2);
  assert.ok(up[1] < 2 && up[2] < up[1], `then comes back up: ${up}`);
  assert.equal(up[3], 0);
});

test('an empty rifle that starts loading by itself works the lever first, then goes down', () => {
  const g = createGun();
  g.reloading = true;
  g.reloadT = RIFLE.reloadPerRound / 2;
  g.loadT = g.shotT = RIFLE.interval - 0.1; // the loading started with the last shot
  assert.deepEqual([gunFrame(g).name, gunFrame(g).drop], ['rifle-lever-2', 0]);
  g.loadT = g.shotT = RIFLE.interval + 0.01;
  const f = gunFrame(g);
  assert.ok(f.drop > 0 && f.drop < 0.5, `only just going down: ${f.drop}`);
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
        for (const loadT of [0, 1]) {
          g.loadT = loadT;
          names.add(gunFrame(g).name);
        }
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

// The HUD for state s, and what it drew: its texts, and the icons by name.
function hudOf(s, over = {}) {
  const art = fakeArt();
  const ctx = fakeContext();
  drawHud(ctx, art, s, { w: 480, h: 270 }, { time: 0, hitT: 9, banner: { t: 0 }, reducedMotion: false, ...over });
  const byX = new Map(Object.entries(art.hud.icons).map(([n, r]) => [r[0], n]));
  const icons = ctx.calls.images.filter((i) => i.img === art.hud.image).map((i) => byX.get(i.args[0]));
  return { texts: ctx.calls.texts.map((t) => t.str), icons };
}

test('the embers you carry show beside your health, however many (?embers=999 too)', () => {
  const s = quietState();
  s.carried = 17;
  const { texts, icons } = hudOf(s);
  assert.ok(icons.includes('ember'));
  assert.ok(texts.includes('17'));
  s.carried = 999;
  assert.ok(hudOf(s).texts.includes('999'));
});

test('at the fire: the offer as rows, each its key, icon, name and line; short of embers, how many more it wants', () => {
  const s = quietState();
  s.atFire = true;
  s.carried = 4;
  let { texts } = hudOf(s);
  assert.ok(texts.includes('The fire wants 2 more embers'), texts.join('|'));
  s.carried = 5;
  assert.ok(hudOf(s).texts.includes('The fire wants 1 more ember'));
  s.choosing = true;
  s.offer.set([0, 6, 11]);
  s.offerN = 3;
  const d = hudOf(s);
  texts = d.texts;
  assert.ok(texts.includes('The fire shows you three'));
  assert.ok(texts.includes('Costs 6 embers'));
  for (const id of [0, 6, 11]) {
    assert.ok(texts.includes(UPGRADE_LIST[id].name) && texts.includes(UPGRADE_LIST[id].line), UPGRADE_LIST[id].name);
    assert.ok(d.icons.includes(`up-${UPGRADE_LIST[id].key}`));
  }
  assert.ok(['1', '2', '3'].every((k) => texts.includes(k)));
  s.atFire = s.choosing = false;
  assert.ok(!hudOf(s).texts.some((t) => t.startsWith('The fire')), 'nothing away from it');
});

test('Steady hands ready: the crosshair goes warm; a hit tick still wins', () => {
  const s = quietState();
  s.perks.steady = true;
  s.player.stillT = 1;
  assert.ok(hudOf(s).icons.includes('crosshairSteady'));
  assert.ok(hudOf(s, { hitT: 0 }).icons.includes('hitTick'));
  s.player.stillT = 0;
  assert.ok(hudOf(s).icons.includes('crosshair'));
});

test('Deep magazine: the rifle row shows 12', () => {
  const s = quietState();
  s.gun.rounds = 12;
  s.gun.rifle = 10;
  const { icons } = hudOf(s);
  assert.deepEqual([icons.filter((n) => n === 'round').length, icons.filter((n) => n === 'roundEmpty').length], [10, 2]);
});

test('Quick lever: the lever frames play within the quicker time between shots', () => {
  const g = createGun();
  g.interval = 0.3;
  const seen = [];
  for (let t = 0; t < 0.3; t += 0.01) {
    g.shotT = t;
    seen.push(gunFrame(g).name);
  }
  assert.ok(seen.includes('rifle-lever-1') && seen.includes('rifle-lever-2'));
});

test('the dawn and death screens show the upgrades you took, in order', () => {
  for (const screen of ['dawn', 'dead']) {
    const art = fakeArt();
    const ctx = fakeContext();
    const taken = new Int8Array(12).fill(-1);
    taken.set([9, 1, 5]);
    drawScreen(ctx, art, { w: 480, h: 270 }, screen, { time: 0, best: { hour: 0, dawns: 0 }, reached: 4, kills: 30, taken, bought: 3 });
    const at = (n) => art.hud.icons[n][0];
    const drawn = ctx.calls.images.filter((i) => i.img === art.hud.image).map((i) => i.args[0]);
    assert.deepEqual(drawn, ['up-reach', 'up-quickLever', 'up-dragon'].map(at), screen);
  }
});
