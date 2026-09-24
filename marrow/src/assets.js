// Loads the art made by the scripts in art/marrow/. The CPU's cyan art is the amber art with its
// glow ramp swapped, done once here at load time. `io` replaces the browser's loaders (for tests).
export async function loadAssets(base = new URL('../assets/', import.meta.url), io = {}) {
  const { image = loadImage, json = loadJson, swap = swapColors } = io;
  const at = (name) => new URL(name, base).href;
  const palette = await json(at('palette.json'));
  const pair = (img) => [img, swap(img, palette.amber, palette.cyan)];
  const [fighterData, fighterImg] = await Promise.all([json(at('fighter.json')), image(at('fighter.png'))]);
  const assets = { palette, fighter: { data: fighterData, sheets: pair(fighterImg) } };
  return assets;
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

// RGBA pixels: every exact match of from[i] becomes to[i]; fully transparent pixels are left alone.
export function swapPixels(px, from, to) {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const map = new Map(from.map((hex, i) => [rgb(hex).join(','), rgb(to[i])]));
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const hit = map.get(`${px[i]},${px[i + 1]},${px[i + 2]}`);
    if (hit) [px[i], px[i + 1], px[i + 2]] = hit;
  }
  return px;
}

export function swapColors(img, from, to) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  swapPixels(data.data, from, to);
  g.putImageData(data, 0, 0);
  return c;
}
