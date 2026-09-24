// The game around the matches: title, opponent intro, match, result and ladder complete. It keeps the
// speedrun timer (match ticks across the whole ladder, retries included) and the best time.
import { createState, step } from './sim.js';
import { createAI, aiIntent, LADDER } from './ai.js';
import { T } from './tuning.js';

export const INTRO_TICKS = 150;
export const RESULT_TICKS = 240;
export const BEST_KEY = 'marrow-best';

export function createGame({ storage, debugCpu = false, touchOnly = false, seed = 1 }) {
  const saved = Number(storage.get(BEST_KEY));
  const g = {
    mode: 'title', modeT: 0, rung: 0, timer: 0, best: saved > 0 ? saved : null, newBest: false,
    state: createState(), ais: null, paused: false, outcome: null, events: [], results: [],
    debugCpu, touchOnly, seed: seed >>> 0,
  };
  g.tick = (held, ui) => tick(g, held, ui, storage);
  // The page asks for this when the player leaves it (focus lost, tab hidden): a match pauses as if
  // they'd pressed Esc, and Esc resumes it. Nothing else pauses, and debug runs never do.
  g.pause = () => {
    if (g.mode === 'match' && !g.debugCpu) g.paused = true;
  };
  if (debugCpu) startLadder(g);
  return g;
}

export function formatTime(ticks) {
  const cs = Math.floor((ticks * 100) / 60);
  return `${Math.floor(cs / 6000)}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

function enter(g, mode) {
  g.mode = mode;
  g.modeT = 0;
}

function tick(g, held, ui, storage) {
  g.events = [];
  g.modeT++;
  const go = ui.has('confirm') || ui.has('attack') || ui.has('jump');
  switch (g.mode) {
    case 'title':
      if (go) startLadder(g);
      break;
    case 'intro':
      if (g.modeT >= INTRO_TICKS || (go && g.modeT > T.INTRO_SKIP_TICKS)) startMatch(g);
      break;
    case 'match':
      playMatch(g, held, ui, storage);
      break;
    case 'result':
      if (g.modeT >= RESULT_TICKS || (go && g.modeT > T.RESULT_SKIP_TICKS)) {
        if (g.outcome === 'win') g.rung++;
        toIntro(g);
      }
      break;
    case 'complete':
      if (g.debugCpu ? g.modeT >= RESULT_TICKS : go && g.modeT > T.COMPLETE_SKIP_TICKS) {
        if (g.debugCpu) startLadder(g);
        else enter(g, 'title');
      }
      break;
  }
}

function startLadder(g) {
  g.rung = 0;
  g.timer = 0;
  g.newBest = false;
  toIntro(g);
}

function toIntro(g) {
  g.state = createState(); // the intro shows the empty center screen
  enter(g, 'intro');
}

function startMatch(g) {
  g.ais = [createAI(0, 'shifter', g.seed++), createAI(1, LADDER[g.rung], g.seed++)];
  g.paused = false;
  enter(g, 'match');
}

function playMatch(g, held, ui, storage) {
  if (ui.has('pause')) g.paused = !g.paused;
  if (g.paused) return;
  const player = g.debugCpu ? aiIntent(g.ais[0], g.state) : held;
  step(g.state, [player, aiIntent(g.ais[1], g.state)]);
  g.events = g.state.events;
  g.timer++;
  if (g.state.phase !== 'over') return;
  const won = g.state.winner === 0;
  g.results.push({ rung: g.rung, opponent: LADDER[g.rung], winner: g.state.winner, ticks: g.state.tick });
  g.outcome = won ? 'win' : 'lose';
  if (!won || g.rung < LADDER.length - 1) {
    enter(g, 'result');
    return;
  }
  g.newBest = g.best === null || g.timer < g.best;
  if (g.newBest) {
    g.best = g.timer;
    if (!g.debugCpu) storage.set(BEST_KEY, g.timer);
  }
  enter(g, 'complete');
}
