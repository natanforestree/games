import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADE_LIST, UPGRADE_COUNT, upgradeCost, applyUpgrade } from '../src/upgrades.js';
import { giveShotgun, RIFLE_ID } from '../src/weapons.js';
import { DT } from '../src/tuning.js';
import { quietState, run, runCollecting, intents } from './helpers.js';

// A night in a long lull, you by the stove, carrying `embers`.
function atFire(embers, over = {}) {
  const s = quietState(over);
  s.night.phase = 'lull';
  s.night.t = 1e9;
  s.carried = embers;
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 1;
  return s;
}
const offered = (s) => Array.from(s.offer.subarray(0, s.offerN));

test('the fire offers only in a lull, within the stove\'s reach, carrying the next upgrade\'s cost', () => {
  let s = atFire(10);
  s.night.phase = 'dusk';
  s.night.t = 1e9;
  run(s, DT);
  assert.deepEqual([s.offerN, s.choosing], [0, false], 'not outside a lull');
  s = atFire(10);
  s.player.x = 19.5;
  s.player.y = 20.5;
  run(s, DT);
  assert.deepEqual([s.offerN, s.atFire, s.choosing], [0, false, false], 'not away from the stove');
  s = atFire(upgradeCost(0) - 1);
  run(s, DT);
  assert.deepEqual([s.offerN, s.atFire, s.choosing], [0, true, false], 'not without enough embers');
  s = atFire(upgradeCost(0));
  const ev = runCollecting(s, DT);
  assert.deepEqual([s.offerN, s.choosing], [3, true]);
  assert.ok(ev.some((e) => e.type === 'offer' && e.a === 3));
});

test('an offer is three different upgrades you can use: no shotgun cards before the shotgun', () => {
  let sawShotgunCard = false;
  for (let seed = 1; seed <= 40; seed++) {
    const s = atFire(6, { seed });
    run(s, DT);
    const ids = offered(s);
    assert.equal(new Set(ids).size, 3, `seed ${seed}: ${ids}`);
    for (const id of ids) assert.ok(!UPGRADE_LIST[id].shotgun, `seed ${seed} offered ${UPGRADE_LIST[id].name}`);
    const t = atFire(6, { seed });
    giveShotgun(t);
    run(t, DT);
    if (offered(t).some((id) => UPGRADE_LIST[id].shotgun)) sawShotgunCard = true;
  }
  assert.ok(sawShotgunCard, 'with the shotgun, its cards turn up');
});

test('the same seed draws the same offers; another seed, others', () => {
  const draw = (seed) => {
    const s = atFire(6, { seed });
    run(s, DT);
    return offered(s).join();
  };
  assert.equal(draw(5), draw(5));
  assert.ok([6, 7, 8, 9].some((seed) => draw(seed) !== draw(5)));
});

test('keys 1 to 3 take a card: 6 embers, then 10, then 14; it applies at once, and more follow while you can pay', () => {
  const s = atFire(30);
  run(s, DT);
  const first = s.offer[0];
  const ev = runCollecting(s, DT, intents({ pick: 1 }));
  assert.equal(s.carried, 24);
  assert.equal(s.bought, 1);
  assert.equal(s.taken[0], first);
  assert.equal(s.perks[UPGRADE_LIST[first].key], true);
  assert.ok(ev.some((e) => e.type === 'upgrade' && e.a === first));
  run(s, DT);
  assert.equal(s.offerN, 3, 'a fresh three');
  assert.ok(!offered(s).includes(first), 'never what you took');
  run(s, DT, intents({ pick: 2 }));
  run(s, DT);
  run(s, DT, intents({ pick: 3 }));
  assert.deepEqual([s.carried, s.bought], [30 - 6 - 10 - 14, 3]);
  run(s, DT);
  assert.deepEqual([s.offerN, s.choosing], [0, false], `${s.carried} embers don't buy the fourth (${upgradeCost(3)})`);
});

test('a key past the offered cards, or with no offer, does nothing', () => {
  const s = atFire(6);
  run(s, DT); // the offer is drawn this update
  run(s, DT, intents({ pick: 1 })); // then taken next update
  const left = s.carried;
  run(s, DT, intents({ pick: 3 }));
  assert.equal(s.carried, left);
  assert.equal(s.bought, 1);
});

test('an offer stays on the table: stepping back, or the next wave, never re-rolls it', () => {
  const s = atFire(6);
  run(s, DT);
  const ids = offered(s).join();
  s.player.x = 19.5;
  s.player.y = 20.5;
  run(s, 1);
  assert.equal(s.choosing, false);
  s.night.phase = 'wave';
  run(s, DT);
  s.night.phase = 'lull';
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 1;
  run(s, DT);
  assert.equal(offered(s).join(), ids);
  assert.equal(s.choosing, true);
});

test('at the fire, keys 1 and 2 pick cards and switch no guns; away from it they switch guns', () => {
  const s = atFire(6);
  giveShotgun(s);
  s.gun.current = s.gun.next = RIFLE_ID; // holding the rifle, the shotgun on your back
  s.gun.switching = 0;
  run(s, DT); // the offer is drawn this update
  run(s, DT, intents({ weapon: 2, pick: 2 })); // key 2, as the keyboard gives it: both at once
  assert.equal(s.gun.switching, 0, 'no switch while choosing');
  assert.equal(s.bought, 1, 'the card was taken');
  s.player.x = 19.5;
  s.player.y = 20.5;
  run(s, DT, intents({ weapon: 2, pick: 2 }));
  assert.ok(s.gun.switching > 0, 'away from the fire, 2 is the shotgun');
});

test('before the shotgun, once the other ten are taken the fire offers nothing, however many embers you carry', () => {
  const s = atFire(0);
  for (let i = 0; i < 10; i++) {
    s.carried = upgradeCost(s.bought);
    run(s, DT);
    run(s, DT, intents({ pick: 1 }));
  }
  assert.equal(s.bought, 10);
  s.carried = 999;
  run(s, 1);
  assert.deepEqual([s.offerN, s.choosing, s.carried], [0, false, 999]);
});

test('every upgrade once: after all twelve the fire offers nothing', () => {
  const s = atFire(0);
  giveShotgun(s);
  for (let id = 0; id < UPGRADE_COUNT; id++) {
    s.carried = upgradeCost(s.bought);
    run(s, DT);
    assert.ok(s.offerN > 0, `offer ${id}`);
    run(s, DT, intents({ pick: 1 }));
  }
  assert.equal(s.bought, UPGRADE_COUNT);
  assert.equal(new Set(s.taken).size, UPGRADE_COUNT);
  s.carried = 999;
  run(s, DT);
  assert.equal(s.offerN, 0);
});

test('a key pressed in the update that first draws the offer takes nothing, but next update it does', () => {
  const s = atFire(6);
  run(s, DT, intents({ pick: 1 })); // offer drawn this update, pick ignored
  assert.equal(s.carried, 6, 'no embers spent');
  assert.equal(s.bought, 0, 'no card taken');
  assert.ok(s.offerN > 0, 'offer is showing');
  const id = s.offer[0];
  run(s, DT, intents({ pick: 1 })); // same card pick now works
  assert.equal(s.carried, 0);
  assert.equal(s.bought, 1);
  assert.equal(s.taken[0], id);
});

test('the upgrade list: twelve, in five families, each with a name and a card line short enough for a card', () => {
  assert.equal(UPGRADE_COUNT, 12);
  assert.deepEqual([...new Set(UPGRADE_LIST.map((u) => u.family))], ['Rifle', 'Shotgun', 'Flares', 'Lantern', 'Hunter']);
  for (const u of UPGRADE_LIST) {
    assert.ok(u.name.length <= 20 && u.line.length <= 36, u.name);
    assert.equal(typeof quietState().perks[u.key], 'boolean', u.key);
  }
  const s = quietState();
  applyUpgrade(s, UPGRADE_LIST.findIndex((u) => u.key === 'snowshoes'));
  assert.equal(s.perks.snowshoes, true);
});
