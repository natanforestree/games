// Times the renderer on a busy late-night frame at 480x270 in Node: 30 creatures, 3 flares, 20 embers
// on the snow (each lighting it), the lantern, falling snow; then the same looking all the way down
// (the most snow to draw), and inside
// the cabin looking all the way up (the most rafters). `npm run bench`. The target is under 4 ms a
// frame. Not a test, because timings vary from machine to machine.
import { parseMap } from './src/map.js';
import { chooseView } from './src/view.js';
import { buildShades } from './src/shade.js';
import { createLightmap, bakeStatic, beginLight, addLight } from './src/lightmap.js';
import { createRenderer, TEX } from './src/render.js';
import { LIGHT, VIEW, EMBERS } from './src/tuning.js';

const map = parseMap();
const colors = Array.from({ length: 48 }, (_, i) => `#${((i * 2654435761) >>> 8).toString(16).padStart(6, '0').slice(0, 6)}`);
const shades = buildShades(colors, new Set([47, 48]));
const tex = (seed) => Uint8Array.from({ length: TEX * TEX }, (_, i) => 1 + ((i * 31 + seed * 17) % 46));
const art = {
  shades,
  walls: { trunks: tex(1), logs: tex(2), window: tex(3), woodpile: tex(4), wagonSide: tex(5), wagonEnd: tex(6) },
  floors: { snow: tex(7), planks: tex(8), rafters: tex(9) },
  sky: { w: 1024, h: 120, px: Uint8Array.from({ length: 1024 * 120 }, (_, i) => 1 + (i % 40)) },
  flake: 40,
};
const frame = { w: 28, h: 40, px: Uint8Array.from({ length: 28 * 40 }, (_, i) => (i % 7 === 0 ? 0 : i % 13 === 0 ? 47 : 1 + (i % 40))) };
const view = chooseView(480, 270, 1);
const renderer = createRenderer(art, map);
renderer.resize(view);
const lm = createLightmap(map);
const stove = map.props.find((p) => p.kind === 'stove');
bakeStatic(lm, map, [{ x: stove.x, y: stove.y, ...LIGHT.stove }]);

const sprites = [];
for (let i = 0; i < 30; i++) {
  const a = -0.7 + (i / 30) * 1.4, d = 2 + (i % 7);
  sprites.push({ x: 19.5 + Math.cos(Math.PI / 2 + a) * d, y: 22 + Math.sin(Math.PI / 2 + a) * d, height: 1, frame, flip: i % 2 === 0, glow: 15 });
}
const ember = { w: 10, h: 6, px: Uint8Array.from({ length: 60 }, (_, i) => (i % 6 === 0 ? 0 : i % 3 === 0 ? 47 : 48)) };
const embers = [];
for (let i = 0; i < 20; i++) {
  const x = 15.5 + (i % 5) * 2, y = 23.5 + Math.floor(i / 5) * 2;
  embers.push([x, y]);
  sprites.push({ x, y, height: 0.15, frame: ember, flip: false, glow: 15 });
}
const flares = [[17, 26], [22, 25], [20, 30]];
const f = { x: 19.5, y: 21, facing: Math.PI / 2, pitch: 0, bob: 0, map, lightmap: lm, skyLevel: 3, time: 0, sprites, spriteCount: sprites.length, snow: true };

function one(t) {
  f.time = t;
  f.facing = Math.PI / 2 + Math.sin(t) * 0.3;
  beginLight(lm, 0.04);
  addLight(lm, f.x, f.y, LIGHT.lantern.full, LIGHT.lantern.dark, LIGHT.lantern.intensity);
  for (const [x, y] of flares) addLight(lm, x, y, LIGHT.flare.full, LIGHT.flare.dark, LIGHT.flare.intensity);
  for (const [x, y] of embers) addLight(lm, x, y, EMBERS.light.full, EMBERS.light.dark, EMBERS.light.intensity);
  renderer.draw(f);
}
function time(label, x, y, pitch) {
  f.x = x;
  f.y = y;
  f.pitch = pitch;
  for (let i = 0; i < 100; i++) one(i / 60);
  const N = 600;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) one(i / 60);
  const ms = (performance.now() - t0) / N;
  console.log(`${view.w}x${view.h}, ${label}: ${ms.toFixed(2)} ms a frame (target under 4 ms)`);
}
time('on the porch', 19.5, 21, 0);
time('looking down', 19.5, 21, -VIEW.maxPitch);
time('in the cabin looking up', 19.5, 16.5, VIEW.maxPitch);
