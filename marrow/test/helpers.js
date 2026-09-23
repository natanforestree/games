// Test helpers: build small matches and drive them with scripted buttons.
import { createState, step } from '../src/sim.js';
import { NO_INPUT, setStance } from '../src/fighter.js';

export const NONE = NO_INPUT;

// keys('right attack') -> an intent with those buttons held.
export function keys(list = '') {
  const k = { ...NO_INPUT };
  for (const name of list.split(/\s+/).filter(Boolean)) {
    if (!(name in k)) throw new Error(`unknown button ${name}`);
    k[name] = true;
  }
  return k;
}

// Two armed fighters on one screen: the player (0) facing right, the CPU (1) facing left.
export function duel({ screen = 3, x0 = 100, x1 = 140, y = 150, y1 = y, stance0 = 1, stance1 = 1 } = {}) {
  const state = createState({ screen });
  const [a, b] = state.fighters;
  Object.assign(a, { x: x0, y, facing: 1 });
  Object.assign(b, { x: x1, y: y1, facing: -1 });
  setStance(a, stance0, true);
  setStance(b, stance1, true);
  return state;
}

// The player alone: the CPU is off-screen and never comes back.
export function alone({ screen = 3, x = 100, y = 150 } = {}) {
  const state = duel({ screen, x0: x, y });
  Object.assign(state.fighters[1], { state: 'gone', respawnT: 0 });
  return state;
}

// Runs n ticks. i0/i1 are intents, or functions of the tick number (0..n-1). Returns every event.
export function run(state, n, i0 = NONE, i1 = NONE) {
  const events = [];
  for (let i = 0; i < n; i++) {
    step(state, [typeof i0 === 'function' ? i0(i) : i0, typeof i1 === 'function' ? i1(i) : i1]);
    events.push(...state.events);
  }
  return events;
}

export const has = (events, type) => events.some((e) => e.type === type);
