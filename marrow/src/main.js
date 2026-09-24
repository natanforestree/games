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

// The module is running, so index.html's "couldn't start" fallback message will never be needed.
document.getElementById('nostart')?.remove();

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

// Leaving the page (another window or app, another tab) pauses a match, so the CPU can't win and the
// timer can't run while the player is away; a match that begins while they're away (after an intro
// or a result) pauses on its first tick. A key press also means they're back, in case no focus event
// came, and Esc resumes as from any pause. A hidden tab's sound sleeps.
let away = false;
const leave = () => {
  away = true;
  game.pause();
};
addEventListener('blur', leave);
addEventListener('focus', () => (away = false));
// Sound may only start inside a key press's own event (Safari insists), not in a later frame. Esc
// doesn't count as user activation to browsers, and Cmd/Ctrl shortcuts aren't for the game.
addEventListener('keydown', (e) => {
  away = false;
  if (e.code !== 'Escape' && !e.metaKey && !e.ctrlKey) audio.start();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    leave();
    audio.suspend();
  } else audio.resume();
});

async function boot() {
  renderer.message('Marrow', 'Loading…');
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
    try {
      const ui = input.takeUI();
      if (ui.has('mute')) audio.toggleMute();
      for (const a of ui) pending.add(a);
      const n = clock.ticks(now) * speed;
      for (let i = 0; i < n; i++) {
        game.tick(input.sample(), i === 0 ? pending : NONE);
        if (away) game.pause();
        renderer.tick(game.state, game.events);
        audio.onTick(game.events, game.state, game.mode === 'match');
      }
      if (n > 0) pending = new Set();
      renderer.draw(game);
    } catch (err) {
      // An error stops the loop with a message, rather than freezing the game without a word.
      console.error(err);
      renderer.message('Something went wrong.', 'Reload the page to play again.');
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
boot();
