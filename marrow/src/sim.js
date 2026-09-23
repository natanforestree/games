// The simulation: step(state, intents) advances one 60 Hz tick, mutating and returning `state`.
// It never touches the DOM, the canvas, the clock or Math.random, so the rules run the same in Node.
import { T } from './tuning.js';
import { SCREENS, CENTER } from './level.js';
import * as P from './physics.js';
import { createFighter, updateFighter, trackInput, NO_INPUT } from './fighter.js';
import { resolveCombat } from './combat.js';
import { edgesOpen, updateMatch, updateSlide } from './match.js';

export function createState({ screen = CENTER } = {}) {
  const lvl = SCREENS[screen];
  const fighters = [0, 1].map((id) => {
    const spot = P.findSpawn(lvl, T.START_X[id], T.START_Y);
    return createFighter(id, spot.x, spot.y);
  });
  return { tick: 0, screen, phase: 'play', arrow: null, winner: null, slide: null, maw: null, fighters, swords: [], nextSwordId: 1, events: [], killsThisTick: [] };
}

export function step(state, intents = []) {
  state.tick++;
  state.events = [];
  state.killsThisTick = [];
  if (state.phase === 'over') return state;
  if (state.phase === 'slide') {
    // fighters aren't simulated during a slide, but their held buttons still update f.prev, so a
    // key first pressed mid-slide doesn't fire the instant it ends (as with one held through a death)
    for (const f of state.fighters) trackInput(f, intents[f.id] ?? NO_INPUT);
    updateSlide(state);
    return state;
  }
  const env = { screen: SCREENS[state.screen], openFor: (f) => edgesOpen(state, f) };
  const frozen = state.phase === 'maw' && state.maw.t >= T.MAW_DELAY_TICKS; // the Maw has come for the winner
  for (const f of state.fighters) {
    const held = frozen ? NO_INPUT : intents[f.id] ?? NO_INPUT;
    updateFighter(state, f, held, { screen: env.screen, open: env.openFor(f), opp: state.fighters[1 - f.id] });
  }
  resolveCombat(state, env);
  updateMatch(state);
  return state;
}
