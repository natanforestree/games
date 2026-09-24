// Loads the art that the scripts in art/last-light/ write to last-light/assets/, and unpacks the
// world's images (textures, sky, sprites) into palette indices for the renderer. The guns in your
// hands and the HUD icons stay as images, drawn with the canvas.
//
//   palette.json   { colors: ["#rrggbb", ...] (index 1 up), glow: [indices], names: { flake, ichor, ui, uiDim, hurt, night } }
//   textures.json  { size: 32, names: [...] }, textures.png: the tiles side by side in that order
//   sky.png        the panorama; its bottom row sits on the horizon, and it wraps round
//   sprites.json   { sprites: { name: { x, y, w, h, count, height, stride?, ms?, anims: { anim: [frame...] } } } }
//                  (each frame unpacks to { w, h, px, mips }; see buildMips)
//                  sprites.png: each sprite's frames left to right from (x, y)
//   hands.json     { frames: { name: [x, y, w, h, ox, oy] } }: (ox, oy) places the frame's top-left
//                  relative to the bottom centre of the view
//   hud.json       { icons: { name: [x, y, w, h] } }
import { buildShades } from './shade.js';

export const FLOORS = new Set(['snow', 'planks', 'rafters']);
const JSON_FILES = ['palette', 'textures', 'sprites', 'hands', 'hud'];
const IMAGE_FILES = ['textures', 'sky', 'sprites', 'hands', 'hud'];

export async function loadJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`couldn't load ${url}`));
    img.src = url;
  });
}

export function imagePixels(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: x.getImageData(0, 0, img.width, img.height).data };
}

// Some browsers add a little noise when a canvas is read back (Firefox's and Brave's fingerprinting
// guards), so a colour within this much of a palette colour in every channel is taken as that colour.
// The palette's closest two colours are 5 apart, so that's never ambiguous (art.test.js checks it).
export const COLOR_SLACK = 2;

// The palette index (1 up) of the colour within COLOR_SLACK of (r, g, b) in every channel, or 0.
function nearIndex(rgbs, r, g, b) {
  for (let k = 0; k < rgbs.length; k++) {
    const c = rgbs[k];
    if (Math.abs((c >> 16) - r) <= COLOR_SLACK && Math.abs(((c >> 8) & 255) - g) <= COLOR_SLACK && Math.abs((c & 255) - b) <= COLOR_SLACK) return k + 1;
  }
  return 0;
}

// RGBA pixels to palette indices (0 where transparent: alpha under half, which also absorbs noise).
// A colour not in the palette, even allowing for noise, is an art bug, and is reported with where it is.
export function indexPixels({ w, h, data }, colors, name) {
  const rgbs = colors.map((hex) => parseInt(hex.slice(1), 16));
  const lookup = new Map(rgbs.map((rgb, i) => [rgb, i + 1]));
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 128) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const rgb = (r << 16) | (g << 8) | b;
    const idx = lookup.get(rgb) ?? nearIndex(rgbs, r, g, b);
    if (idx === 0) {
      throw new Error(`${name}: the pixel at ${i % w},${Math.floor(i / w)} is #${rgb.toString(16).padStart(6, '0')}, which isn't in the palette`);
    }
    out[i] = idx;
  }
  return out;
}

// The w x h piece of an indexed image at (x, y), row by row, or column by column if `columns`.
export function cut(indexed, imgW, x, y, w, h, columns) {
  const out = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) out[columns ? xx * h + yy : yy * w + xx] = indexed[(y + yy) * imgW + x + xx];
  }
  return out;
}

// Far off, a sprite is drawn smaller than its frame, and sampling one texel per pixel skips some: a
// 1-texel eye would blink out. So each sprite frame carries `mips`, for the renderer to sample from
// instead: the frame halved, then halved again (1/2, 1/4, 1/8, each side rounded up). In each 2x2
// block a glowing texel wins, so the eyes survive every halving; otherwise the block keeps its first
// opaque texel reading across then down (top-left, top-right, bottom-left, bottom-right), or stays
// clear. Frames are column-major (index x * h + y), like `cut(..., true)` makes them.
export const MIP_LEVELS = 3;

function halve(f, emissive) {
  const w = Math.ceil(f.w / 2), h = Math.ceil(f.h / 2), px = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let opaque = 0, glow = 0;
      for (let k = 0; k < 4 && glow === 0; k++) {
        const sx = 2 * x + (k & 1), sy = 2 * y + (k >> 1);
        if (sx >= f.w || sy >= f.h) continue;
        const v = f.px[sx * f.h + sy];
        if (emissive[v]) glow = v;
        else if (opaque === 0) opaque = v;
      }
      px[x * h + y] = glow || opaque;
    }
  }
  return { w, h, px };
}

export function buildMips(frame, emissive, levels = MIP_LEVELS) {
  const mips = [];
  for (let i = 0, f = frame; i < levels; i++) mips.push((f = halve(f, emissive)));
  return mips;
}

// json: { palette, textures, sprites, hands, hud }; images: { textures, sky, sprites, hands, hud };
// pixels(image) -> { w, h, data (RGBA) }.
export function unpackArt(json, images, pixels) {
  const { palette } = json;
  const shades = buildShades(palette.colors, new Set(palette.glow));
  const tex = pixels(images.textures);
  const texIdx = indexPixels(tex, palette.colors, 'textures.png');
  const size = json.textures.size;
  const walls = {}, floors = {};
  json.textures.names.forEach((name, i) => {
    const floor = FLOORS.has(name);
    (floor ? floors : walls)[name] = cut(texIdx, tex.w, i * size, 0, size, size, !floor);
  });
  const skyPx = pixels(images.sky);
  const sky = { w: skyPx.w, h: skyPx.h, px: indexPixels(skyPx, palette.colors, 'sky.png') };
  const spr = pixels(images.sprites);
  const sprIdx = indexPixels(spr, palette.colors, 'sprites.png');
  const sprites = {};
  for (const [name, s] of Object.entries(json.sprites.sprites)) {
    sprites[name] = {
      height: s.height, stride: s.stride, ms: s.ms, anims: s.anims,
      frames: Array.from({ length: s.count }, (_, i) => {
        const f = { w: s.w, h: s.h, px: cut(sprIdx, spr.w, s.x + i * s.w, s.y, s.w, s.h, true) };
        f.mips = buildMips(f, shades.emissive);
        return f;
      }),
    };
  }
  const color = (n) => palette.colors[palette.names[n] - 1];
  return {
    palette, shades, walls, floors, sky, sprites,
    flake: palette.names.flake,
    ichor: palette.names.ichor,
    hands: { image: images.hands, frames: json.hands.frames },
    hud: { image: images.hud, icons: json.hud.icons },
    ui: { text: color('ui'), dim: color('uiDim'), hurt: color('hurt'), night: color('night') },
  };
}

export async function loadArt(base = new URL('../assets/', import.meta.url), io = { json: loadJson, image: loadImage, pixels: imagePixels }) {
  const at = (f) => new URL(f, base).href;
  const jsons = await Promise.all(JSON_FILES.map((f) => io.json(at(`${f}.json`))));
  const imgs = await Promise.all(IMAGE_FILES.map((f) => io.image(at(`${f}.png`))));
  const json = Object.fromEntries(JSON_FILES.map((f, i) => [f, jsons[i]]));
  const images = Object.fromEntries(IMAGE_FILES.map((f, i) => [f, imgs[i]]));
  return unpackArt(json, images, io.pixels);
}
