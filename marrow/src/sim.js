// The simulation: step(state, intents) advances one 60 Hz tick, mutating and returning `state`.
// It never touches the DOM, the canvas, the clock or Math.random, so the rules run the same in Node.
import { T } from './tuning.js';
import { SCREENS, CENTER } from './level.js';
import * as P from './physics.js';
import { createFighter, updateFighter, NO_INPUT } from './fighter.js';
import { resolveCombat } from './combat.js';

export function createState({ screen = CENTER } = {}) {
  const lvl = SCREENS[screen];
  const fighters = [0, 1].map((id) => {
    const spot = P.findSpawn(lvl, T.START_X[id], 150);
    return createFighter(id, spot.x, spot.y);
  });
  return { tick: 0, screen, phase: 'play', arrow: null, winner: null, slide: null, maw: null, fighters, swords: [], nextSwordId: 1, events: [], killsThisTick: [] };
}

export function step(state, intents = []) {
  state.tick++;
  state.events = [];
  state.killsThisTick = [];
  const env = { screen: SCREENS[state.screen], openFor: () => P.CLOSED };
  for (const f of state.fighters) {
    updateFighter(state, f, intents[f.id] ?? NO_INPUT, { screen: env.screen, open: env.openFor(f), opp: state.fighters[1 - f.id] });
  }
  resolveCombat(state, env);
  return state;
}
