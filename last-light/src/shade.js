// Colours and light. Textures and sprites are stored as palette indices (0 is transparent), and light
// is applied with pre-shaded colour tables, as in Doom: 16 light levels per palette colour, from the
// night's blue-black fog up to warm lantern amber. `table[level << 8 | index]` is a pixel ready for
// the buffer (RGBA, as a little-endian Uint32 over ImageData).
//
// Glowing colours (eyes, embers, the window's glow) ignore light. In `table` they're always full; in
// `fade` they fade into the fog by level instead, so a sprite can dim its eyes with distance.
export const LEVELS = 16;
export const FOG = [6, 8, 14];
const COLD = [0.7, 0.8, 1.0];
const WARM = [1.08, 0.92, 0.72];

// A 4x4 ordered-dither threshold in [0, 1), by (y & 3) << 2 | (x & 3): light between two levels is
// shown as a pattern of both.
export const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => v / 16);

const pack = (r, g, b) => ((255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
const clamp = (v) => Math.max(0, Math.min(255, v));

export function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// colors: ["#rrggbb", ...] for palette indices 1..n; glow: the set of indices that ignore light.
export function buildShades(colors, glow = new Set()) {
  if (colors.length > 255) throw new Error(`the palette has ${colors.length} colours; at most 255 fit`);
  const table = new Uint32Array(LEVELS * 256);
  const fade = new Uint32Array(LEVELS * 256);
  const emissive = new Uint8Array(256);
  colors.forEach((hex, n) => {
    const i = n + 1;
    const [r, g, b] = hexToRgb(hex);
    if (glow.has(i)) emissive[i] = 1;
    for (let l = 0; l < LEVELS; l++) {
      const k = l / (LEVELS - 1);
      const t = Math.pow(k, 1.4);
      const tint = [0, 1, 2].map((c) => COLD[c] + (WARM[c] - COLD[c]) * k);
      const lit = [r, g, b].map((v, c) => clamp(FOG[c] + (v * tint[c] - FOG[c]) * t));
      const faded = [r, g, b].map((v, c) => clamp(FOG[c] + (v - FOG[c]) * k));
      table[(l << 8) | i] = emissive[i] ? pack(r, g, b) : pack(...lit);
      fade[(l << 8) | i] = emissive[i] ? pack(...faded) : table[(l << 8) | i];
    }
  });
  return { table, fade, emissive };
}

// The light level (0..15) for a light value (0 = dark, 1 = full) at screen pixel (x, y), dithered.
export function levelAt(light, x, y) {
  const l = (light * (LEVELS - 1) + BAYER[((y & 3) << 2) | (x & 3)]) | 0;
  return l < 0 ? 0 : l > LEVELS - 1 ? LEVELS - 1 : l;
}