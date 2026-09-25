// Shared test helpers.
import { parseMap } from '../src/map.js';
import { createState, step } from '../src/sim.js';
import { DT } from '../src/tuning.js';

// A small map from rows; by default an open 12x12 room with the start in the middle.
export function room(rows) {
  return parseMap(
    rows ?? [
      '############',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#.....@....#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
  );
}

export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Intents for one update, all idle; override what a test needs.
export function intents(over = {}) {
  return { pick: 0, facing: 0, pitch: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0, ...over };
}

// A night on the real map, held in its dusk so nothing spawns unless a test starts it. You're on the
// porch at (19.5, 20.5), facing south.
export function quietState(over = {}) {
  const state = createState({ seed: 1, ...over });
  state.night.t = Infinity;
  return state;
}

// Runs `seconds` of updates with the same intents.
export function run(state, seconds, it = intents()) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(state, it);
}

// Runs `seconds` of updates and returns every event, as plain objects.
export function runCollecting(state, seconds, it = intents()) {
  const seen = [];
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    step(state, it);
    for (let k = 0; k < state.eventCount; k++) seen.push({ ...state.events[k] });
  }
  return seen;
}
