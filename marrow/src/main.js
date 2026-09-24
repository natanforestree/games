// Boot and the fixed-timestep loop. You play the left side against the CPU; ?debug=cpu makes both
// sides CPUs (with hitboxes) and &speed=N runs N times faster, for the browser smoke test.
import { createState, step } from './sim.js';
import { createInput } from './input.js';
import { createClock } from './clock.js';
import { createRenderer } from './render.js';
import { createAI, aiIntent, LADDER } from './ai.js';

const params = new URLSearchParams(location.search);
const debugCpu = params.get('debug') === 'cpu';
const speed = debugCpu ? Math.min(50, Math.max(1, Number(params.get('speed')) || 1)) : 1;

const renderer = createRenderer(document.getElementById('game'), { debug: debugCpu });
const input = createInput(window, document);
const clock = createClock();
const results = [];
let seed = Date.now() >>> 0;
let rung = 0;
let match = newMatch();
if (debugCpu) window.__marrow = { results, get state() { return match.state; } };

function newMatch() {
  return { state: createState(), ais: [createAI(0, 'shifter', seed++), createAI(1, LADDER[rung], seed++)], overT: 0 };
}

function frame(now) {
  const ui = input.takeUI();
  const n = clock.ticks(now) * speed;
  for (let i = 0; i < n; i++) {
    const { state, ais } = match;
    if (state.phase === 'over') {
      if (++match.overT === 1) results.push({ winner: state.winner, ticks: state.tick, opponent: LADDER[rung] });
      if (debugCpu ? match.overT > 60 : ui.has('confirm')) {
        if (debugCpu) rung = (rung + 1) % LADDER.length;
        match = newMatch();
      }
      continue;
    }
    step(state, [debugCpu ? aiIntent(ais[0], state) : input.sample(), aiIntent(ais[1], state)]);
  }
  renderer.draw(match.state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
