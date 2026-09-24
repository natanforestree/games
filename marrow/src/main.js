// Boot and the fixed-timestep loop. You play the left side against the CPU; ?debug=cpu makes both
// sides CPUs (with hitboxes), &speed=N runs N times faster, and &seed=N pins the CPUs' RNG, for the
// browser smoke test.
import { createState, step } from './sim.js';
import { createInput } from './input.js';
import { createClock } from './clock.js';
import { createRenderer } from './render.js';
import { createAI, aiIntent, LADDER } from './ai.js';
import { loadAssets } from './assets.js';

const params = new URLSearchParams(location.search);
const debugCpu = params.get('debug') === 'cpu';
const speed = debugCpu ? Math.floor(Math.min(50, Math.max(1, Number(params.get('speed')) || 1))) : 1;

const renderer = createRenderer(document.getElementById('game'), { debug: debugCpu });
const input = createInput(window, document);
const clock = createClock();
const results = [];
let seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : Date.now() >>> 0;
let rung = 0;
let match = newMatch();
if (debugCpu) window.__marrow = { results, get state() { return match.state; }, get rung() { return rung; } };

function newMatch() {
  return { state: createState(), ais: [createAI(0, 'shifter', seed++), createAI(1, LADDER[rung], seed++)], overT: 0 };
}

function frame(now) {
  const n = clock.ticks(now) * speed;
  for (let i = 0; i < n; i++) {
    const { state, ais } = match;
    if (state.phase === 'over') {
      input.sample(); // discarded: a fight key tapped on the result screen mustn't latch into the next match
      if (++match.overT === 1) results.push({ winner: state.winner, ticks: state.tick, opponent: LADDER[rung] });
      continue;
    }
    // both intents are read before step() applies either, so the AIs see the same, unmutated tick
    const intents = [debugCpu ? aiIntent(ais[0], state) : input.sample(), aiIntent(ais[1], state)];
    step(state, intents);
    renderer.tick(state, state.events);
  }
  // UI actions are handled once per frame, outside the tick loop above: a frame that runs 0 ticks
  // (about half of them at 120 Hz) must still see a press, or it's lost.
  const ui = input.takeUI();
  if (match.state.phase === 'over' && (debugCpu ? match.overT > 60 : ui.has('confirm'))) {
    if (debugCpu) rung = (rung + 1) % LADDER.length;
    match = newMatch();
  }
  renderer.draw(match.state, rung); // each rung is fought in its own world
  requestAnimationFrame(frame);
}

async function boot() {
  try {
    renderer.setAssets(await loadAssets());
  } catch (err) {
    console.error(err);
    renderer.message("Marrow couldn't load its art.", 'Check your connection, then reload the page.');
    return;
  }
  requestAnimationFrame(frame);
}
boot();
