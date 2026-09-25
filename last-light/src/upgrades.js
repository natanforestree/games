// The fire's upgrades: twelve, in five families, each taken at most once a night. You're "at the fire"
// in a lull within the stove's reach. There, carrying the next upgrade's cost, the fire draws an offer
// of three you can use (with the night's seed), and keys 1 to 3 take one. The offer stays on the table
// until you take one, so stepping back never re-rolls it. Nothing pauses: the lull clock runs, and the
// stove keeps healing you.
import { UPGRADES, NIGHT, PERKS, RIFLE } from './tuning.js';
import { nextRandom } from './rng.js';
import { emit } from './events.js';

// key: the perks flag it sets. shotgun: offered only once you have the shotgun.
export const UPGRADE_LIST = [
  { key: 'pierce', family: 'Rifle', name: 'Through-and-through', line: 'Rounds pass through one creature.' },
  { key: 'quickLever', family: 'Rifle', name: 'Quick lever', line: 'Work the lever a third faster.' },
  { key: 'steady', family: 'Rifle', name: 'Steady hands', line: 'Stand still: next shot hits double.' },
  { key: 'deepMagazine', family: 'Rifle', name: 'Deep magazine', line: 'The rifle holds 12.' },
  { key: 'slugs', family: 'Shotgun', name: 'Slugs', line: 'One heavy slug: long reach.', shotgun: true },
  { key: 'dragon', family: 'Shotgun', name: "Dragon's breath", line: 'Your shotgun sets them burning.', shotgun: true },
  { key: 'magnesium', family: 'Flares', name: 'Magnesium', line: 'Flares and fire burn twice as long.' },
  { key: 'pockets', family: 'Flares', name: 'Deep pockets', line: 'Carry 8 flares; lulls bring two.' },
  { key: 'wick', family: 'Lantern', name: 'Wide wick', line: 'Your light reaches further.' },
  { key: 'reach', family: 'Hunter', name: 'Long reach', line: 'Take embers from 2 cells away.' },
  { key: 'warm', family: 'Hunter', name: 'Warm hands', line: 'Each ember heals you a little.' },
  { key: 'snowshoes', family: 'Hunter', name: 'Snowshoes', line: 'Move a fifth faster.' },
];
export const UPGRADE_COUNT = UPGRADE_LIST.length;

// Every upgrade's flag, all false: what you've taken this night.
export function createPerks() {
  const perks = {};
  for (const u of UPGRADE_LIST) perks[u.key] = false;
  return perks;
}

// The embers the n-th upgrade of the night (from 0) costs.
export const upgradeCost = (bought) => UPGRADES.cost + UPGRADES.step * bought;

// Whether you could take upgrade `id` now: not taken yet, and usable (no shotgun cards before it).
export function usable(state, id) {
  const u = UPGRADE_LIST[id];
  return !state.perks[u.key] && (!u.shotgun || state.gun.hasShotgun);
}

const pool = new Int8Array(UPGRADE_COUNT);

// Draws up to UPGRADES.offer distinct usable upgrades into state.offer, at random from the night's seed.
function drawOffer(state) {
  let n = 0;
  for (let id = 0; id < UPGRADE_COUNT; id++) if (usable(state, id)) pool[n++] = id;
  const k = Math.min(UPGRADES.offer, n);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(nextRandom(state.rng) * (n - i));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
    state.offer[i] = pool[i];
  }
  state.offerN = k;
  if (k > 0) emit(state, 'offer', state.stove.x, state.stove.y, k);
}

// What an upgrade does the moment it's taken (the rest is read where it matters: weapons, embers, the
// player, the night and the scene look at state.perks).
export function applyUpgrade(state, id) {
  const g = state.gun, key = UPGRADE_LIST[id].key;
  state.perks[key] = true;
  if (key === 'quickLever') g.interval = PERKS.quickLever;
  else if (key === 'deepMagazine') {
    g.rounds = PERKS.deepMagazine;
    g.rifle = Math.min(g.rounds, g.rifle + PERKS.deepMagazine - RIFLE.rounds);
  }
}

function take(state, id) {
  const p = state.player;
  state.carried -= upgradeCost(state.bought);
  state.taken[state.bought++] = id;
  state.offerN = 0;
  applyUpgrade(state, id);
  emit(state, 'upgrade', p.x, p.y, id);
}

// One update: whether you're at the fire, drawing an offer when there's none and you can afford one,
// and taking the card your key picked (intents.pick, 1 to 3). While state.choosing, keys 1 and 2 don't
// switch guns (weapons.js); it stays true through the update that took a card.
export function updateChoosing(state, intents) {
  const p = state.player, stove = state.stove;
  let near = false;
  if (state.night.phase === 'lull' && stove) {
    const dx = stove.x - p.x, dy = stove.y - p.y;
    near = dx * dx + dy * dy <= NIGHT.stoveReach * NIGHT.stoveReach;
  }
  state.atFire = near;
  if (near && state.offerN === 0 && state.carried >= upgradeCost(state.bought)) drawOffer(state);
  state.choosing = near && state.offerN > 0;
  const pick = intents.pick | 0;
  if (state.choosing && pick >= 1 && pick <= state.offerN) take(state, state.offer[pick - 1]);
}
