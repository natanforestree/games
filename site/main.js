// The games page: loads the scene's art, then draws the living scene every frame, with each game's link
// from index.html laid invisibly over its island. If anything fails, the page shows the plain list of
// links instead (see the scripts in index.html's <head>).
import { skyFor } from './sky.js';
import { chooseView } from './layout.js';
import { placeIslands } from './islands.js';
import { loadScene } from './load.js';
import { createLinks } from './links.js';
import { createRenderer } from './render.js';

const root = document.documentElement;
root.classList.add('js', 'booting'); // index.html's fallback timer leaves a booting page alone

let links = null; // set once boot() creates it; fail() may run before or after that

function fail(err) {
  console.error(err);
  root.classList.remove('js', 'booting', 'scene');
  links?.reset(); // undo place()'s inline sizing, so the plain list isn't left with island-sized gaps
}

async function boot() {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const [art] = await Promise.all([
    loadScene(),
    Promise.all(['16px Silkscreen', '8px Silkscreen', '700 8px Silkscreen'].map((font) => document.fonts.load(font)))
      .catch((err) => console.warn('Silkscreen not loaded; using the fallback font', err)),
  ]);
  links = createLinks(document, window);
  const renderer = createRenderer(ctx, art, links.info);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let view, islands;
  const fit = () => {
    view = chooseView(innerWidth, innerHeight, devicePixelRatio || 1);
    canvas.width = view.cw;
    canvas.height = view.ch;
    canvas.style.width = `${(view.cw * view.scale) / view.dpr}px`;
    canvas.style.height = `${(view.ch * view.scale) / view.dpr}px`;
    islands = placeIslands(art.games, art.metas, view.layout);
    links.place(islands, view);
  };
  addEventListener('resize', () => {
    try {
      fit();
    } catch (err) {
      fail(err);
    }
  });
  fit();
  root.classList.add('scene');
  root.classList.remove('booting');
  // requestAnimationFrame doesn't run in a hidden tab, so the scene pauses there by itself.
  let start;
  const frame = (now) => {
    try {
      start ??= now;
      renderer.draw({
        view, islands, now, anim: now - start, reduced: reduceMotion.matches,
        sky: skyFor(location.search, new Date()), active: links.active(),
      });
      requestAnimationFrame(frame);
    } catch (err) {
      fail(err);
    }
  };
  requestAnimationFrame(frame);
}

boot().catch(fail);
