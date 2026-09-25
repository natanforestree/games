// Everything drawn over the world with the canvas 2D context, at internal resolution: the guns and
// lantern in your hands, the crosshair and hit tick, health, ammo, flares, the hour, the hurt glow,
// banners, and the title, death and dawn screens. Text is Silkscreen.
import { RIFLE, SHOTGUN, SWITCH_TIME, FLARE, FEEL, NIGHT } from './tuning.js';
import { RIFLE_ID } from './weapons.js';
import { hourLabel } from './night.js';

// Every frame of the hands art, and every HUD icon, the HUD draws.
export const HAND_FRAMES = [
  'rifle-idle', 'rifle-fire', 'rifle-lever-1', 'rifle-lever-2', 'rifle-reload-1', 'rifle-reload-2', 'rifle-reload-3',
  'shotgun-idle', 'shotgun-fire', 'shotgun-reload-1', 'shotgun-reload-2', 'shotgun-reload-3',
  'lantern-1', 'lantern-2', 'throw-1', 'throw-2',
];
export const HUD_ICONS = ['heart', 'round', 'roundEmpty', 'shell', 'shellEmpty', 'flare', 'crosshair', 'hitTick'];

const FONTS = { 8: '8px Silkscreen, monospace', 16: '16px Silkscreen, monospace', 24: '24px Silkscreen, monospace' };
const HOURS = ['9 PM', '10 PM', '11 PM', '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', 'dawn'];
const RIFLE_RELOAD = ['rifle-reload-1', 'rifle-reload-2', 'rifle-reload-3'];
const SHOTGUN_RELOAD = ['shotgun-reload-1', 'shotgun-reload-2', 'shotgun-reload-3'];
// Numbers as text, made once, so the HUD doesn't build new strings every frame.
const NUMBERS = Array.from({ length: 201 }, (_, i) => String(i));
const num = (n) => NUMBERS[Math.max(0, Math.min(200, Math.ceil(n)))];

const shown = { name: '', drop: 0 };
const third = (t, whole) => Math.min(2, Math.max(0, Math.floor((1 - t / whole) * 3)));

// Which frame of the gun in your hand to show, and how far it's lowered (0 up, 1 down). Returns a
// reused { name, drop }.
export function gunFrame(gun) {
  let drop = 0, id = gun.current, name;
  if (gun.switching > 0) {
    const half = SWITCH_TIME / 2;
    if (gun.switching > half) drop = 1 - (gun.switching - half) / half;
    else {
      id = gun.next;
      drop = gun.switching / half;
    }
    name = id === RIFLE_ID ? 'rifle-idle' : 'shotgun-idle';
  } else if (id === RIFLE_ID) {
    if (gun.shotT < 0.06) name = 'rifle-fire';
    else if (gun.shotT < 0.2) name = 'rifle-idle';
    else if (gun.shotT < 0.3) name = 'rifle-lever-1';
    else if (gun.shotT < RIFLE.interval) name = 'rifle-lever-2';
    else if (gun.reloading) name = RIFLE_RELOAD[third(gun.reloadT, RIFLE.reloadPerRound)];
    else name = 'rifle-idle';
  } else if (gun.shotT < 0.06) name = 'shotgun-fire';
  else if (gun.reloading) name = SHOTGUN_RELOAD[third(gun.reloadT, SHOTGUN.reload)];
  else name = 'shotgun-idle';
  shown.name = name;
  shown.drop = drop;
  return shown;
}

// The lantern hand's frame: a two-frame flicker, or the throw while a flare leaves your hand.
export function handFrame(gun, time) {
  const since = FLARE.cooldown - gun.flareT;
  if (gun.flareT > 0 && since < 0.3) return since < 0.15 ? 'throw-1' : 'throw-2';
  return Math.floor(time * 8) % 2 ? 'lantern-2' : 'lantern-1';
}

function frame(ctx, art, name, x, y) {
  const f = art.hands.frames[name];
  if (!f) throw new Error(`no hands frame "${name}"`);
  ctx.drawImage(art.hands.image, f[0], f[1], f[2], f[3], Math.round(x + f[4]), Math.round(y + f[5]), f[2], f[3]);
}

function icon(ctx, art, name, x, y) {
  const i = art.hud.icons[name];
  ctx.drawImage(art.hud.image, i[0], i[1], i[2], i[3], Math.round(x), Math.round(y), i[2], i[3]);
  return i[2];
}

function text(ctx, str, x, y, color, px = 8, align = 'left') {
  ctx.font = FONTS[px];
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// info: { time, hitT (seconds since you last hit something), banner: { text, sub, t }, reducedMotion }
export function drawHud(ctx, art, state, view, info) {
  const { w, h } = view, g = state.gun, p = state.player, ui = art.ui;
  // The hands, bobbing as you walk.
  const speed = Math.min(1, Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 3);
  const phase = (p.walked / 0.9) * Math.PI;
  const bx = info.reducedMotion ? 0 : Math.sin(phase) * 3 * speed;
  const by = info.reducedMotion ? 0 : Math.abs(Math.cos(phase)) * 2 * speed;
  if (state.night.phase !== 'dead') {
    frame(ctx, art, handFrame(g, info.time), w / 2 - bx, h + by);
    const gf = gunFrame(g);
    frame(ctx, art, gf.name, w / 2 + bx, h + by + gf.drop * 60 + g.kick * 120);
  }
  // Crosshair and hit tick.
  icon(ctx, art, info.hitT < 0.15 ? 'hitTick' : 'crosshair', Math.floor(w / 2) - 3, Math.floor(h / 2) - 3);
  // Hurt: the edges glow red, and pulse when you're low.
  let hurt = state.hurt > 0 ? (state.hurt / FEEL.hurtTime) * 0.55 : 0;
  if (p.health > 0 && p.health <= FEEL.lowHealth) hurt = Math.max(hurt, 0.18 + 0.12 * Math.sin(info.time * 7));
  if (hurt > 0) {
    ctx.globalAlpha = Math.min(1, hurt);
    ctx.fillStyle = ui.hurt;
    const e = Math.round(h / 14);
    ctx.fillRect(0, 0, w, e);
    ctx.fillRect(0, h - e, w, e);
    ctx.fillRect(0, e, e, h - 2 * e);
    ctx.fillRect(w - e, e, e, h - 2 * e);
    ctx.globalAlpha = 1;
  }
  // Health, bottom left.
  const hx = 6, hy = h - 14;
  const hw = icon(ctx, art, 'heart', hx, hy);
  text(ctx, num(p.health), hx + hw + 3, hy + 1, p.health <= FEEL.lowHealth ? ui.hurt : ui.text);
  // Ammo and flares, bottom right.
  let x = w - 6;
  if (g.current === RIFLE_ID) {
    for (let i = RIFLE.rounds - 1; i >= 0; i--) x -= icon(ctx, art, i < g.rifle ? 'round' : 'roundEmpty', x - 4, hy) + 1;
  } else {
    text(ctx, num(g.spare), x, hy + 1, ui.dim, 8, 'right');
    x -= 14;
    for (let i = SHOTGUN.shells - 1; i >= 0; i--) x -= icon(ctx, art, i < g.shells ? 'shell' : 'shellEmpty', x - 5, hy) + 2;
  }
  x -= 8;
  for (let i = 0; i < g.flares; i++) x -= icon(ctx, art, 'flare', x - 5, hy) + 1;
  // The hour, top centre.
  text(ctx, hourLabel(state.night), w / 2, 6, ui.dim, 8, 'center');
  // A banner: the new hour, a supply, a warning.
  const b = info.banner;
  if (b && b.t > 0) {
    ctx.globalAlpha = Math.min(1, b.t);
    if (b.text) text(ctx, b.text, w / 2, h * 0.28, ui.text, 16, 'center');
    if (b.sub) text(ctx, b.sub, w / 2, h * 0.28 + 22, ui.dim, 8, 'center');
    ctx.globalAlpha = 1;
  }
}

// The title, death and dawn screens, drawn over the world. info: { best: { hour, dawns }, reached, kills, time }
export function drawScreen(ctx, art, view, screen, info) {
  const { w, h } = view, ui = art.ui;
  ctx.globalAlpha = screen === 'title' ? 0.35 : 0.55;
  ctx.fillStyle = ui.night;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  const blink = Math.floor(info.time * 2) % 2 === 0;
  if (screen === 'title') {
    text(ctx, 'LAST LIGHT', w / 2, h * 0.3, ui.text, 24, 'center');
    text(ctx, 'Hold the cabin until dawn.', w / 2, h * 0.3 + 32, ui.dim, 8, 'center');
    if (blink) text(ctx, 'Click to start', w / 2, h * 0.62, ui.text, 8, 'center');
    const best = info.best.dawns > 0 ? `Dawns seen: ${info.best.dawns}` : info.best.hour > 0 ? `Best night: ${HOURS[info.best.hour]}` : '';
    if (best) text(ctx, best, w / 2, h * 0.62 + 14, ui.dim, 8, 'center');
    text(ctx, 'WASD move  Mouse aim  Click shoot  R reload', w / 2, h - 30, ui.dim, 8, 'center');
    text(ctx, '1/2 guns  F flare  Shift run  Esc pause  M mute', w / 2, h - 18, ui.dim, 8, 'center');
  } else if (screen === 'dead') {
    text(ctx, "You didn't see the dawn", w / 2, h * 0.32, ui.hurt, 16, 'center');
    text(ctx, `It was ${NIGHT.hours[Math.min(info.reached, NIGHT.hours.length - 1)]}.  ${info.kills} of them fell.`, w / 2, h * 0.32 + 24, ui.dim, 8, 'center');
    if (blink) text(ctx, 'Click to try again', w / 2, h * 0.62, ui.text, 8, 'center');
  } else if (screen === 'dawn') {
    text(ctx, 'Dawn', w / 2, h * 0.3, ui.text, 24, 'center');
    text(ctx, `You held the cabin.  ${info.kills} of them fell.`, w / 2, h * 0.3 + 30, ui.dim, 8, 'center');
    if (blink) text(ctx, 'Click for another night', w / 2, h * 0.62, ui.text, 8, 'center');
  }
}
