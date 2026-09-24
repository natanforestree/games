// The world behind the fighters, painted in the current opponent's world: the far panorama and the fog
// (slower parallax during screen slides), each screen's scene (mirrored for '-' screens), ichor stains,
// and living details in the world's colors: pulsing vessels, drips and drifting spores.
import { T, VIEW_W, VIEW_H } from './tuning.js';
import { SCREENS } from './level.js';

// far.png is one panorama of the whole map at this parallax: 320 + 6 screens * 80 px = 800 px, and
// screen i shows its columns [80 i, 80 i + 320). The art centers each world's centrepiece on that
// (worlds/common.lua), so this stays 1/4. The fog is a seamless 320 px tile at 1/2, drifting.
const FAR_PARALLAX = 0.25;
const FOG_PARALLAX = 0.5;
const FOG_DRIFT = 0.05; // px per frame

const smooth = (t) => t * t * (3 - 2 * t);

// world: one entry of assets.worlds, { far, fog, scenes, colors } (Task 17 adds maw).
export function drawWorld(ctx, state, world, fx, tick) {
  const slide = state.slide;
  const k = slide ? smooth(slide.t / T.SCREEN_SLIDE_TICKS) : 0;
  const dir = slide ? slide.dir : 0;
  const along = state.screen * VIEW_W + dir * k * VIEW_W; // how far along the map the camera is
  wrap(ctx, world.far, -along * FAR_PARALLAX);
  wrap(ctx, world.fog, -along * FOG_PARALLAX - tick * FOG_DRIFT);
  if (slide) {
    drawScreen(ctx, slide.from, -dir * k * VIEW_W, world, fx, tick);
    drawScreen(ctx, slide.to, dir * (1 - k) * VIEW_W, world, fx, tick);
  } else {
    drawScreen(ctx, state.screen, 0, world, fx, tick);
  }
}

// Draws img at x, repeated to its left and right as needed (it uses img.width, so any width works).
function wrap(ctx, img, x) {
  const w = img.width, ox = ((Math.round(x) % w) + w) % w;
  ctx.drawImage(img, ox - w, 0);
  ctx.drawImage(img, ox, 0);
}

function drawScreen(ctx, index, ox, world, fx, tick) {
  const screen = SCREENS[index];
  const scene = world.scenes[screen.base];
  const x = Math.round(ox);
  if (screen.mirrored) {
    ctx.save();
    ctx.translate(x + VIEW_W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(scene.image, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(scene.image, x, 0);
  }
  details(ctx, screen, scene.fx, world.colors, x, tick);
  fx.drawStains(ctx, index, x);
}

function details(ctx, screen, anchors, colors, ox, tick) {
  const mx = (px) => (screen.mirrored ? VIEW_W - 1 - px : px) + ox;
  anchors.vessels.forEach(([x, y], i) => {
    const pulse = Math.sin(tick * 0.08 + i * 1.7);
    if (pulse < 0.2) return;
    ctx.fillStyle = pulse > 0.75 ? colors.vessel[1] : colors.vessel[0];
    ctx.fillRect(mx(x), y, 1, 1);
  });
  ctx.fillStyle = colors.drip;
  anchors.drips.forEach(([x, y, floorY], i) => {
    const period = 150 + ((i * 37) % 90), t = (tick + i * 53) % period, fall = t - 60;
    if (fall < 0) ctx.fillRect(mx(x), y + Math.floor(t / 30), 1, 1); // swelling
    else {
      const dy = y + 2 + fall * fall * 0.02;
      if (dy < floorY) ctx.fillRect(mx(x), Math.round(dy), 1, 2);
    }
  });
  ctx.globalAlpha = colors.sporeAlpha;
  ctx.fillStyle = colors.spore;
  for (let i = 0; i < 14; i++) {
    const sx = (i * 97 + tick * (0.1 + (i % 3) * 0.05)) % VIEW_W;
    const sy = VIEW_H - ((i * 53 + tick * 0.15) % VIEW_H);
    ctx.fillRect(Math.round(ox + sx), Math.round(sy + Math.sin(tick * 0.02 + i) * 3), 1, 1);
  }
  ctx.globalAlpha = 1;
}
