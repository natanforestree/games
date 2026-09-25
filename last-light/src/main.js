// Boot, the loop, and the wiring between input, the game, the renderer, the HUD and sound.
//
// The world updates at a fixed 120 Hz; frames draw on requestAnimationFrame at the display's rate,
// blending between the last two updates. The renderer draws into a pixel buffer at internal
// resolution that an ImageData shares (no copy), the HUD goes on top with the 2D context, and the
// result is scaled up by a whole number in one drawImage.
//
// Debug (URL): ?debug=fps shows frame times; ?debug=bot plays by itself (&speed=N runs N updates per
// update); the flags combine with a comma (?debug=bot,fps). ?wave=N starts at wave N (1-8); ?god
// means you can't die; ?seed=N fixes the night. With any of them, window.__lastlight exposes the
// game, and window.__lastlightPerf the frame timing ({ frameMs, updates }), for the browser checks.
import { createInput } from './input.js';
import { createClock } from './clock.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { loadArt } from './assets.js';
import { safeStorage } from './storage.js';
import { parseMap } from './map.js';
import { chooseView } from './view.js';
import { createRenderer } from './render.js';
import { createLightmap, bakeStatic } from './lightmap.js';
import { createScene, buildFrame, sceneEvents } from './scene.js';
import { drawHud, drawScreen } from './hud.js';
import { createBot, botIntents } from './bot.js';
import { createState } from './sim.js';
import { LIGHT, MOUSE, DT } from './tuning.js';

// The module is running, so the page's "couldn't start" message will never be needed.
document.getElementById('nostart')?.remove();

const params = new URLSearchParams(location.search);
const debugFlags = new Set((params.get('debug') ?? '').split(',').filter(Boolean));
const int = (v, lo, hi, d) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const debug = {
  fps: debugFlags.has('fps'),
  bot: debugFlags.has('bot'),
  god: params.has('god'),
  wave: int(params.get('wave'), 1, 8, 1) - 1,
};
const speed = debug.bot ? int(params.get('speed'), 1, 20, 1) : 1;
const seed = params.has('seed') ? int(params.get('seed'), 0, 2 ** 31, 1) : Date.now();
const anyDebug = debug.fps || debug.bot || debug.god || params.has('wave') || params.has('seed');

const canvas = document.getElementById('game');
const message = (title, detail) => {
  const m = document.getElementById('message');
  m.querySelector('strong').textContent = title;
  m.querySelector('span').textContent = detail;
  m.hidden = false;
};

const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
if (touchOnly && !debug.bot) {
  document.getElementById('phone').hidden = false;
} else {
  boot().catch((err) => {
    console.error(err);
    message("Last Light couldn't load its art.", 'Check your connection, then reload the page.');
  });
}

async function boot() {
  const storage = safeStorage();
  const audio = createAudio(storage);
  const input = createInput(window, document);
  input.element = canvas;
  const sens = Number(storage.get('last-light-sensitivity') ?? 1);
  input.sensitivity = sens >= MOUSE.minScale && sens <= MOUSE.maxScale ? sens : 1;
  const map = parseMap();
  const game = createGame({ storage, map, seed, debug });
  if (anyDebug) window.__lastlight = game;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const [art] = await Promise.all([
    loadArt(),
    document.fonts.load('8px Silkscreen').catch((err) => console.warn('Silkscreen not loaded; using the fallback font', err)),
  ]);
  const renderer = createRenderer(art, map);
  const scene = createScene(art);
  const lightmap = createLightmap(map);
  const stove = map.props.find((p) => p.kind === 'stove');
  bakeStatic(lightmap, map, [{ x: stove.x, y: stove.y, ...LIGHT.stove }]);
  const titleState = createState({ seed: 7, map }); // the backdrop behind the title screen
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  let view, image;

  function fit() {
    view = chooseView(innerWidth, innerHeight, devicePixelRatio || 1);
    canvas.width = view.dw;
    canvas.height = view.dh;
    off.width = view.w;
    off.height = view.h;
    renderer.resize(view);
    image = new ImageData(new Uint8ClampedArray(renderer.buffer.buffer), view.w, view.h);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = art.ui.night;
    ctx.fillRect(0, 0, view.dw, view.dh);
  }
  fit();
  addEventListener('resize', fit);

  // The pause menu (a plain HTML form over the canvas).
  const pause = document.getElementById('pause');
  const sensInput = document.getElementById('sensitivity'), volInput = document.getElementById('volume');
  const muteInput = document.getElementById('mute'), note = document.getElementById('pause-note');
  // The slider runs 0-100 for 0.25x-4x, evenly in ratio (50 is 1x).
  sensInput.value = String(Math.round((Math.log(input.sensitivity / MOUSE.minScale) / Math.log(MOUSE.maxScale / MOUSE.minScale)) * 100));
  volInput.value = String(Math.round(audio.volume * 100));
  muteInput.checked = audio.muted;
  sensInput.addEventListener('input', () => {
    input.sensitivity = MOUSE.minScale * (MOUSE.maxScale / MOUSE.minScale) ** (Number(sensInput.value) / 100);
    storage.set('last-light-sensitivity', input.sensitivity.toFixed(3));
  });
  volInput.addEventListener('input', () => audio.setVolume(Number(volInput.value) / 100));
  muteInput.addEventListener('change', () => {
    if (muteInput.checked !== audio.muted) audio.toggleMute();
  });
  const showPause = (show) => {
    pause.hidden = !show;
    note.hidden = true;
    muteInput.checked = audio.muted;
  };
  // A refused pointer lock (Chrome: too soon after Esc; the next click works) says so where you are: on
  // the pause menu by its Resume button, and otherwise over the title or end screen.
  const lockNote = document.getElementById('lock-note');
  const lockRefused = () => {
    if (!pause.hidden) note.hidden = false;
    else lockNote.hidden = false;
  };
  const lockOrExplain = async () => {
    if (!(await input.lock())) lockRefused();
  };
  document.addEventListener('pointerlockerror', lockRefused);
  document.getElementById('resume').addEventListener('click', lockOrExplain);
  document.getElementById('quit').addEventListener('click', () => {
    game.quit();
    showPause(false);
  });

  const clock = createClock();
  let bot = createBot();
  const start = () => {
    game.newNight();
    input.facing = game.state.player.facing;
    input.releaseAll();
    bot = createBot();
    clock.reset();
  };
  // A click on the canvas starts a night (and the sound, which browsers only allow from a click).
  canvas.addEventListener('click', () => {
    audio.start();
    if (debug.bot) {
      if (game.screen !== 'playing') start();
    } else if (!input.locked) lockOrExplain();
  });
  // With the mouse still locked on the death or dawn screen, a click starts the next night (once the
  // screen has been up a moment). That click is only the start: it doesn't reach input as a shot.
  canvas.addEventListener('mousedown', (e) => {
    if (!input.locked || !game.canContinue) return;
    e.stopPropagation();
    start();
  });
  document.addEventListener('pointerlockchange', () => {
    if (input.locked) {
      lockNote.hidden = true;
      showPause(false);
      if (game.screen === 'paused') {
        game.resume();
        input.releaseAll();
        clock.reset();
      } else if (game.screen === 'title') start();
    } else if (game.screen === 'playing') {
      game.pause();
      showPause(true);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.screen === 'playing' && !debug.bot) {
        game.pause();
        showPause(true);
      }
      audio.suspend();
    } else audio.resume();
  });
  if (debug.bot) start(); // sound waits for a click, as browsers require

  let time = 0, last = null;
  const perf = { frameMs: 0, updates: 0 };
  if (anyDebug) window.__lastlightPerf = perf;
  const frameView = { facing: 0, alpha: 0, time: 0, dt: 0, reducedMotion: false, h: 0, focal: 0 };
  const hudInfo = { time: 0, hitT: 0, banner: game.banner, reducedMotion: false };
  const screenInfo = { time: 0, best: game.best, reached: 0, kills: 0 };
  const loop = (now) => {
    try {
      const t0 = performance.now();
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      if (input.takeUI().mute) {
        audio.toggleMute();
        muteInput.checked = audio.muted; // the pause menu's box, if it's open, follows M
      }
      const n = game.running ? clock.advance(now) * speed : 0;
      for (let i = 0; i < n; i++) {
        game.tick(debug.bot ? botIntents(game.state, bot, DT) : input.sample());
        audio.events(game.state);
        sceneEvents(scene, game.state);
      }
      perf.updates = n;
      game.frame(dt);
      draw(dt);
      perf.frameMs = perf.frameMs * 0.9 + (performance.now() - t0) * 0.1;
    } catch (err) {
      // An error stops the loop with a message, rather than freezing without a word.
      console.error(err);
      message('Something went wrong.', 'Reload the page to play again.');
      return;
    }
    requestAnimationFrame(loop);
  };

  function draw(dt) {
    const s = game.state ?? titleState;
    const facing = !game.state ? Math.PI / 2 + Math.sin(time * 0.07) * 0.8 : debug.bot ? bot.facing : input.facing;
    const alpha = game.running ? clock.alpha : 1;
    frameView.facing = facing;
    frameView.alpha = alpha;
    frameView.time = time;
    frameView.dt = dt;
    frameView.reducedMotion = reducedMotion.matches;
    frameView.h = view.h;
    frameView.focal = view.focal;
    const f = buildFrame(scene, s, lightmap, frameView);
    renderer.draw(f);
    octx.putImageData(image, 0, 0);
    if (game.state && (game.screen === 'playing' || game.screen === 'paused')) {
      hudInfo.time = time;
      hudInfo.hitT = game.hitT;
      hudInfo.reducedMotion = frameView.reducedMotion;
      drawHud(octx, art, s, view, hudInfo);
    } else if (game.screen !== 'paused') {
      screenInfo.time = time;
      screenInfo.reached = s.night.reached;
      screenInfo.kills = s.stats.kills;
      drawScreen(octx, art, view, game.screen, screenInfo);
    }
    if (debug.fps) {
      octx.font = '8px Silkscreen, monospace';
      octx.textAlign = 'left';
      octx.textBaseline = 'top';
      octx.fillStyle = '#ffffff';
      octx.fillText(`${perf.frameMs.toFixed(2)} ms  ${perf.updates} upd  ${view.w}x${view.h} x${view.scale}`, 4, 4);
    }
    if (scene.shakeX || scene.shakeY || view.ox > 0) ctx.fillRect(0, 0, view.dw, view.dh);
    ctx.drawImage(off, view.ox + scene.shakeX * view.scale, view.oy + scene.shakeY * view.scale, view.w * view.scale, view.h * view.scale);
    audio.update(s, facing, game.screen);
  }
  requestAnimationFrame(loop);
}
