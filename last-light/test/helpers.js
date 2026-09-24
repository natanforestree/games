// Shared test helpers.
import { parseMap } from '../src/map.js';

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
  return { facing: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0, ...over };
}
