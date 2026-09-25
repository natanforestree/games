// One night's state, and step(): a single 120 Hz update of the whole game world. step never touches
// the DOM, the canvas, the clock or Math.random, and allocates nothing, so a night replays exactly
// from its seed and intents, and every rule is tested in Node.
import { DT, PLAYER, NIGHT, PERKS, UPGRADES } from './tuning.js';
import { parseMap } from './map.js';
import { createRng } from './rng.js';
import { createPlayer, movePlayer } from './player.js';
import { createField, updateField } from './flowfield.js';
import { createCreatures, updateCreatures } from './creatures.js';
import { createGun, createFlares, updateGun, updateFlares, giveShotgun } from './weapons.js';
import { createNight, createPickups, updateNight } from './night.js';
import { createEvents, emit } from './events.js';
import { createEmbers, updateEmbers } from './embers.js';
import { createPerks, updateChoosing, UPGRADE_COUNT } from './upgrades.js';

// seed: the night's random seed. wave: start at this wave index (the ?wave= debug mode; from 11 PM on
// you start with the shotgun). god: you can't die. gentle: "Embers come to you". embers: carried from
// the start (the ?embers= debug mode).
export function createState({ seed = 1, wave = 0, god = false, gentle = false, embers = 0, map = parseMap() } = {}) {
  const state = {
    seed, rng: createRng(seed), tick: 0, time: 0, god,
    map, field: createField(map),
    player: createPlayer(map.start), maxHealth: PLAYER.health,
    gun: createGun(), flares: createFlares(), creatures: createCreatures(), pickups: createPickups(map),
    stove: map.props.find((p) => p.kind === 'stove') ?? null,
    night: createNight(),
    events: createEvents(), eventCount: 0,
    flash: 0, hurt: 0, shake: 0,
    stats: { kills: 0 },
    // Dark harvest: embers on the snow, the ones you carry, and what the fire has sold you.
    embers: createEmbers(), carried: embers, gentle,
    perks: createPerks(), bought: 0, taken: new Int8Array(UPGRADE_COUNT).fill(-1),
    offer: new Int8Array(UPGRADES.offer).fill(-1), offerN: 0, atFire: false, choosing: false,
  };
  state.night.wave = wave;
  state.night.reached = wave;
  if (wave >= NIGHT.shotgunBefore) {
    giveShotgun(state);
    state.gun.current = state.gun.next;
    state.gun.switching = 0;
  }
  state.eventCount = 0;
  updateField(state.field, map, state.player.x, state.player.y);
  return state;
}

export function step(state, intents) {
  state.eventCount = 0;
  state.tick++;
  state.time += DT;
  if (state.flash > 0) state.flash -= DT;
  if (state.hurt > 0) state.hurt -= DT;
  if (state.shake > 0) state.shake -= DT;
  const phase = state.night.phase;
  if (phase === 'dead') return state;
  const p = state.player;
  movePlayer(state.map, p, intents, DT, state.perks.snowshoes ? PERKS.snowshoes : 1);
  updateField(state.field, state.map, p.x, p.y);
  updateChoosing(state, intents);
  if (phase !== 'dawn') updateGun(state, intents, DT);
  updateCreatures(state, DT);
  updateFlares(state, DT);
  updateEmbers(state, DT);
  updateNight(state, DT);
  if (p.health <= 0 && state.night.phase !== 'dead') {
    p.health = 0;
    state.night.phase = 'dead';
    emit(state, 'dead');
  }
  return state;
}
