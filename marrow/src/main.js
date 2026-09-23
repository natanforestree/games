// Boot and the fixed-timestep loop (first playable build: the CPU stands still).
import { createState, step } from './sim.js';
import { createInput } from './input.js';
import { createClock } from './clock.js';
import { createRenderer } from './render.js';
import { NO_INPUT } from './fighter.js';

const renderer = createRenderer(document.getElementById('game'));
const input = createInput(window, document);
const clock = createClock();
let state = createState();

function frame(now) {
  const ui = input.takeUI();
  if (state.phase === 'over' && ui.has('confirm')) state = createState();
  const n = clock.ticks(now);
  for (let i = 0; i < n; i++) step(state, [input.sample(), NO_INPUT]);
  renderer.draw(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
