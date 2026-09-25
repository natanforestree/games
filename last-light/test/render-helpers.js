// A tiny art set for renderer tests: every texture is one flat palette colour, so a pixel's colour
// says what was drawn there.
import { buildShades } from '../src/shade.js';
import { TEX } from '../src/render.js';

export const IDX = { trunks: 1, logs: 2, window: 3, woodpile: 4, wagonSide: 5, wagonEnd: 6, snow: 7, planks: 8, rafters: 9, sky: 10, body: 11, eye: 12, flake: 13 };
const colors = Object.keys(IDX).map((_, i) => `#${(40 + i * 12).toString(16)}${(200 - i * 9).toString(16)}${(90 + i * 7).toString(16)}`);

export function testArt() {
  const flat = (i) => new Uint8Array(TEX * TEX).fill(i);
  return {
    shades: buildShades(colors, new Set([IDX.eye])),
    walls: { trunks: flat(1), logs: flat(2), window: flat(3), woodpile: flat(4), wagonSide: flat(5), wagonEnd: flat(6) },
    floors: { snow: flat(7), planks: flat(8), rafters: flat(9) },
    sky: { w: 64, h: 40, px: new Uint8Array(64 * 40).fill(10) },
    flake: 13,
  };
}

// The palette index a pixel was drawn from at full light, or null.
export function drawnAt(art, buf, w, x, y) {
  const v = buf[y * w + x];
  for (const i of Object.values(IDX)) if (art.shades.table[(15 << 8) | i] === v) return i;
  return null;
}
