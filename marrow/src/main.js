// Boot and the fixed-timestep loop. ?debug=cpu makes both sides CPUs (with hitboxes) and &speed=N
// runs N times faster; &seed=N pins the CPUs' RNG, for the browser smoke test; window.__marrow then
// exposes the game for it.
import { createInput } from './input.js';
import { createClock } from './clock.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { loadAssets } from './assets.js';
import { safeStorage } from './storage.js';

const params = new URLSearchParams(location.search);
const debugCpu = params.get('debug') === 'cpu';
const speed = debugCpu ? Math.floor(Math.min(50, Math.max(1, Number(params.get('speed')) || 1))) : 1;
const seed = params.has('seed') ? Number(params.get('seed')) : Date.now();
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

const renderer = createRenderer(document.getElementById('game'), { debug: debugCpu });
const storage = safeStorage();
const audio = createAudio(storage);
const input = createInput(window, document);
const game = createGame({ storage, debugCpu, touchOnly, seed });
if (debugCpu) window.__marrow = game;

async function boot() {
  try {
    const [assets] = await Promise.all([
      loadAssets(),
      document.fonts.load('8px Silkscreen').catch((err) => console.warn('Silkscreen not loaded; using the fallback font', err)),
    ]);
    renderer.setAssets(assets);
  } catch (err) {
    console.error(err);
    renderer.message("Marrow couldn't load its art.", 'Check your connection, then reload the page.');
    return;
  }
  const clock = createClock();
  const NONE = new Set();
  let pending = new Set(); // UI presses wait for the next tick, even on frames that run none
  const frame = (now) => {
    const ui = input.takeUI();
    if (ui.size) audio.start(); // browsers allow sound only after a key press
    if (ui.has('mute')) audio.toggleMute();
    for (const a of ui) pending.add(a);
    const n = clock.ticks(now) * speed;
    for (let i = 0; i < n; i++) {
      game.tick(input.sample(), i === 0 ? pending : NONE);
      renderer.tick(game.state, game.events);
      audio.onTick(game.events, game.state, game.mode === 'match');
    }
    if (n > 0) pending = new Set();
    renderer.draw(game);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
boot();
