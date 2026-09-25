// Turns the game state into what the renderer draws this frame: the camera (blended between the last
// two updates, looking where the mouse says, with the head bob and the gun's kick), the lights, and every sprite with its animation
// frame. Embers glow on the snow, dimming and flickering as they cool, and light the ground round them;
// a burning creature is lit by its fire and throws sparks. Allocates nothing per frame: the sprite list
// is a fixed pool.
//
// art.sprites[name] = { height, stride?, ms?, frames: [{ w, h, px }], anims: { name: [frame indices] } },
// with the animations SPRITE_ANIMS lists.
import { VIEW, LIGHT, FEEL, CREATURES, EMBERS, PERKS } from './tuning.js';
import { KINDS, LEAPER } from './creatures.js';
import { beginLight, addLight, falloff } from './lightmap.js';
import { ambientFor, skyLevelFor } from './night.js';
import { createEffects, spray, spark, updateEffects } from './effects.js';

// Every sprite the game draws, and the animations each must have.
export const SPRITE_ANIMS = {
  crawler: ['walk', 'side-walk', 'attack', 'hurt', 'die'],
  gaunt: ['walk', 'side-walk', 'windup', 'attack', 'hurt', 'die'],
  leaper: ['walk', 'side-walk', 'crouch', 'leap', 'side-leap', 'attack', 'hurt', 'die'],
  mother: ['walk', 'side-walk', 'windup', 'attack', 'hurt', 'die'],
  stove: ['idle'],
  well: ['idle'],
  pine: ['idle'],
  flare: ['idle'],
  ember: ['idle'],
  'pickup-flare': ['idle'],
  'pickup-shells': ['idle'],
  'pickup-shotgun': ['idle'],
};
const MAX_SPRITES = 128;
export const SPRAY_Z = [0.25, 0.7, 0.4, 1.3]; // where on each kind (crawler, gaunt, leaper, mother) the spray comes from
const PICKUP_SPRITE = ['pickup-flare', 'pickup-shells', 'pickup-shotgun'];
const SIDE_FROM = (50 * Math.PI) / 180, SIDE_TO = (130 * Math.PI) / 180;
const EMBER_SIZE = [0, 1, 1.25, 1.5]; // an ember's height, times its sprite's, by value
const FIRE = { full: 0.3, dark: 1.6, intensity: 0.6 }; // the light of a creature burning
const SPARK_EVERY = 0.05; // seconds between sparks off each burning creature

export function createScene(art) {
  for (const [name, anims] of Object.entries(SPRITE_ANIMS)) {
    if (!art.sprites[name]) throw new Error(`no sprite "${name}"`);
    for (const a of anims) if (!art.sprites[name].anims[a]?.length) throw new Error(`sprite "${name}" has no "${a}" animation`);
  }
  const sprites = Array.from({ length: MAX_SPRITES }, () => ({ x: 0, y: 0, height: 1, lift: 0, frame: null, flip: false, glow: 15 }));
  return {
    art, sprites,
    frame: { x: 0, y: 0, facing: 0, pitch: 0, bob: 0, map: null, lightmap: null, skyLevel: 0, time: 0, sprites, spriteCount: 0, snow: true, drops: null, sparks: null },
    shakeX: 0, shakeY: 0, count: 0, sparkT: 0, sparkN: 0,
    fx: createEffects(),
  };
}

// Reacts to one update's events: a hit throws a spray away from you (more for a kill).
export function sceneEvents(scene, state) {
  const p = state.player;
  for (let i = 0; i < state.eventCount; i++) {
    const e = state.events[i];
    if (e.type === 'hit') spray(scene.fx, e.x, e.y, SPRAY_Z[e.a], p.x, p.y, e.b ? 14 : 7);
  }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = (a, b, t) => a + (b - a) * t;

// The frame of a looping animation `ms` per frame at `time` seconds, or of a one-shot at progress p.
function loopFrame(spr, anim, time) {
  const list = spr.anims[anim];
  return spr.frames[list[Math.floor((time * 1000) / (spr.ms ?? 150)) % list.length]];
}
function progressFrame(spr, anim, p) {
  const list = spr.anims[anim];
  return spr.frames[list[Math.min(list.length - 1, Math.floor(p * list.length))]];
}

// Which animation frame a creature shows, seen from (camX, camY), written into `out` ({ frame, flip }).
export function creatureFrame(art, c, camX, camY, camRightX, camRightY, out) {
  const spr = art.sprites[KINDS[c.kind]];
  let flip = false;
  const toCam = Math.atan2(camY - c.y, camX - c.x);
  const rel = Math.abs(wrap(c.heading - toCam));
  const side = rel > SIDE_FROM && rel < SIDE_TO;
  if (side) flip = Math.cos(c.heading) * camRightX + Math.sin(c.heading) * camRightY < 0;
  let frame;
  if (c.dying) frame = progressFrame(spr, 'die', 1 - c.dying / CREATURES.die);
  else if (c.hurtT > 0) frame = spr.frames[spr.anims.hurt[0]];
  else if (c.kind === LEAPER && c.mode === 'crouch') frame = spr.frames[spr.anims.crouch[0]];
  else if (c.kind === LEAPER && c.mode === 'leap') frame = spr.frames[spr.anims[side ? 'side-leap' : 'leap'][0]];
  else if (c.mode === 'windup' && spr.anims.windup) frame = spr.frames[spr.anims.windup[0]];
  else if (c.struck > 0) frame = progressFrame(spr, 'attack', 1 - c.struck / 0.25);
  else {
    const list = spr.anims[side ? 'side-walk' : 'walk'];
    const i = c.moving || c.walked > 0 ? Math.floor(c.walked / (spr.stride ?? 0.4)) % list.length : 0;
    frame = spr.frames[list[i]];
  }
  out.frame = frame;
  out.flip = side && flip;
  return out;
}

function put(scene, sx, sy, spr, frame, lift, flip, glow, height = spr.height) {
  if (scene.count >= MAX_SPRITES) return;
  const s = scene.sprites[scene.count++];
  s.x = sx;
  s.y = sy;
  s.height = height;
  s.frame = frame;
  s.lift = lift;
  s.flip = flip;
  s.glow = glow;
}

const shown = { frame: null, flip: false };

// view: { facing and pitch (from input), alpha (clock blend), time (seconds), dt (seconds since the last frame),
//        reducedMotion, h (view height), focal }
export function buildFrame(scene, state, lightmap, view) {
  const { art } = scene;
  const f = scene.frame, p = state.player, t = view.time;
  const x = lerp(p.px, p.x, view.alpha), y = lerp(p.py, p.y, view.alpha);
  f.x = x;
  f.y = y;
  f.facing = view.facing;
  f.pitch = view.pitch || 0;
  f.map = state.map;
  f.lightmap = lightmap;
  f.time = t;
  f.skyLevel = skyLevelFor(state.night);
  updateEffects(scene.fx, view.dt ?? 0);
  f.drops = scene.fx.drops;
  f.sparks = scene.fx.sparks;
  // Head bob: a step every 0.9 cells walked, scaled by how fast you're going; the kick lifts the view.
  const speed = Math.min(1, Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 3);
  const px = view.h / VIEW.targetHeight;
  const bob = view.reducedMotion ? 0 : Math.sin((p.walked / 0.9) * Math.PI * 2) * VIEW.bobPixels * px * speed;
  f.bob = bob + state.gun.kick * view.focal;
  const shake = !view.reducedMotion && state.shake > 0 ? (FEEL.shake.shotgun * px * state.shake) / FEEL.shakeTime : 0;
  scene.shakeX = shake ? Math.round(Math.sin(t * 97) * shake) : 0;
  scene.shakeY = shake ? Math.round(Math.cos(t * 83) * shake) : 0;

  // Lights: the sky, your lantern (flickering), burning flares, and the muzzle flash.
  beginLight(lightmap, ambientFor(state.night));
  const L = LIGHT;
  const flick = 0.95 + 0.05 * Math.sin(t * 13.1) * Math.sin(t * 7.3);
  const wick = state.perks.wick;
  addLight(lightmap, x, y, wick ? PERKS.wick.full : L.lantern.full, wick ? PERKS.wick.dark : L.lantern.dark, L.lantern.intensity * flick);
  for (const fl of state.flares) {
    if (fl.t <= 0) continue;
    const dying = Math.min(1, fl.t); // fades over its last second
    addLight(lightmap, fl.x, fl.y, L.flare.full, L.flare.dark, L.flare.intensity * dying * (0.85 + 0.15 * Math.sin(t * 31 + fl.x)));
  }
  if (state.flash > 0) addLight(lightmap, x, y, L.muzzle.full, L.muzzle.dark, L.muzzle.intensity);
  // Each ember lights the snow round it, dimming as it cools.
  for (const e of state.embers) {
    if (e.t <= 0) continue;
    const E = EMBERS.light;
    addLight(lightmap, e.x, e.y, E.full, E.dark, E.intensity * Math.min(1.5, 0.75 + 0.25 * e.value) * emberWarmth(e, t));
  }
  // A burning creature is lit by its fire, and throws sparks.
  scene.sparkT += view.dt ?? 0;
  const sparking = scene.sparkT >= SPARK_EVERY;
  if (sparking) scene.sparkT %= SPARK_EVERY;
  for (const c of state.creatures) {
    if (!c.alive || c.burnT <= 0) continue;
    const cx = lerp(c.px, c.x, view.alpha), cy = lerp(c.py, c.y, view.alpha);
    addLight(lightmap, cx, cy, FIRE.full, FIRE.dark, FIRE.intensity * (0.8 + 0.2 * Math.sin(t * 23 + c.id)));
    if (sparking) spark(scene.fx, cx, cy, c.lift + CREATURES[KINDS[c.kind]].height * 0.5, scene.sparkN++);
  }

  // Sprites.
  scene.count = 0;
  const rightX = -Math.sin(view.facing), rightY = Math.cos(view.facing);
  for (const c of state.creatures) {
    if (!c.alive) continue;
    const cx = lerp(c.px, c.x, view.alpha), cy = lerp(c.py, c.y, view.alpha);
    creatureFrame(art, c, x, y, rightX, rightY, shown);
    const ex = cx - x, ey = cy - y;
    const glow = Math.round(15 * falloff(Math.sqrt(ex * ex + ey * ey), L.eyes.full, L.eyes.dark));
    put(scene, cx, cy, art.sprites[KINDS[c.kind]], shown.frame, c.lift, shown.flip, glow);
  }
  for (const prop of state.map.props) {
    const spr = art.sprites[prop.kind];
    put(scene, prop.x, prop.y, spr, loopFrame(spr, 'idle', t), 0, false, 15);
  }
  for (const k of state.pickups) {
    if (!k.active) continue;
    const spr = art.sprites[PICKUP_SPRITE[k.kind]];
    put(scene, k.x, k.y, spr, loopFrame(spr, 'idle', t), 0.04 + 0.03 * Math.sin(t * 3), false, 15);
  }
  const flareSpr = art.sprites.flare;
  for (const fl of state.flares) if (fl.t > 0) put(scene, fl.x, fl.y, flareSpr, loopFrame(flareSpr, 'idle', t), 0, false, 15);
  const emberSpr = art.sprites.ember;
  for (const e of state.embers) {
    if (e.t <= 0) continue;
    const frame = loopFrame(emberSpr, 'idle', t + ((e.x * 1.37 + e.y) % 1));
    put(scene, e.x, e.y, emberSpr, frame, 0, false, Math.round(15 * emberWarmth(e, t)), emberSpr.height * EMBER_SIZE[e.value]);
  }
  f.spriteCount = scene.count;
  return f;
}

// How warm an ember looks (0 to 1): full until its last seconds, then dimming, and flickering.
export function emberWarmth(e, t) {
  if (e.t >= EMBERS.flicker) return 1;
  const k = e.t / EMBERS.flicker;
  return (0.3 + 0.7 * k) * (Math.sin(t * 31 + e.x * 7) > -0.2 ? 1 : 0.45);
}
