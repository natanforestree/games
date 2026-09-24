// Loads the scene's art: site/games.json and everything the scripts in art/site/ wrote to site/assets/.
// `io` replaces the browser's loaders (for the tests). Any file that fails to load fails the whole load.
import { PHASES } from './sky.js';
import { STAGES } from './layout.js';

export async function loadScene(base = new URL('./', import.meta.url), io = {}) {
  const { image = loadImage, json = loadJson } = io;
  const at = (path) => new URL(path, base).href;
  const [games, sky, signMeta] = await Promise.all([json(at('games.json')), json(at('assets/sky.json')), json(at('assets/sign.json'))]);
  const names = [games.unfinished.island, ...games.games.map((g) => g.island)];
  const layouts = Object.keys(STAGES);
  const [metaList, imageList, skyList, [clouds, atlas, signImage]] = await Promise.all([
    Promise.all(names.map((n) => json(at(`assets/${n}.json`)))),
    Promise.all(names.map((n) => image(at(`assets/${n}.png`)))),
    Promise.all(layouts.flatMap((l) => PHASES.map((p) => image(at(`assets/sky-${p}-${l}.png`))))),
    Promise.all(['clouds', 'sky', 'sign'].map((n) => image(at(`assets/${n}.png`)))),
  ]);
  const skies = Object.fromEntries(layouts.map((l, i) => [l, Object.fromEntries(PHASES.map((p, j) => [p, skyList[i * PHASES.length + j]]))]));
  return {
    games, sky, skies, clouds, atlas,
    metas: Object.fromEntries(names.map((n, i) => [n, metaList[i]])),
    images: Object.fromEntries(names.map((n, i) => [n, imageList[i]])),
    sign: { meta: signMeta, image: signImage },
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`couldn't load ${src}`));
    img.src = src;
  });
}

export async function loadJson(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`couldn't load ${src}: HTTP ${res.status}`);
  return res.json();
}
