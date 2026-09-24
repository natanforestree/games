// Draws the scene on the canvas, in scene pixels: the sky for the time of day and what moves in it, the
// clouds, the title, the islands, and the sign under the active island.
import { PHASES, weights, dominant } from './sky.js';
import { bob, liftAt, frameAt, drift, twinkles, twinkleFrame, birdAt, shootingStarAt, LIFT, CLOUD_SPEEDS } from './motion.js';
import { SIGN, layoutSign, placeSign } from './sign.js';

export const TITLE = 'Games';
export const SUBTITLE = "Little things I've built.";
const SUBTITLE_DY = 20; // the subtitle's top, below the title's

const FONTS = {
  title: '16px Silkscreen, monospace',
  subtitle: '8px Silkscreen, monospace',
  name: '700 8px Silkscreen, monospace',
  blurb: '8px Silkscreen, monospace',
  controls: '8px Silkscreen, monospace',
};

// art: what loadScene() returned. info(id): the words on a game's sign, { name, blurb, controls }.
export function createRenderer(ctx, art, info) {
  const lifts = new Map(); // island id -> { active, from, since }, for liftAt
  const boards = new Map(); // `${id}/${maxW}` -> layoutSign()
  const measure = (text, style) => {
    ctx.font = FONTS[style];
    return ctx.measureText(text).width;
  };

  function liftOf(id, active, now, reduced) {
    let s = lifts.get(id);
    if (!s) lifts.set(id, (s = { active: false, from: 0, since: now }));
    if (s.active !== active) {
      s.from = liftAt(s.active, s.from, s.since, now);
      s.active = active;
      s.since = now;
    }
    if (reduced) return active ? LIFT : 0;
    return liftAt(s.active, s.from, s.since, now);
  }

  function boardFor(id, maxW) {
    const key = `${id}/${maxW}`;
    if (!boards.has(key)) boards.set(key, layoutSign(info(id), measure, maxW));
    return boards.get(key);
  }

  // Pixel lettering with a 1 px drop shadow, so it reads on every sky.
  function lettering(text, style, x, y, color, shadow) {
    ctx.font = FONTS[style];
    ctx.fillStyle = shadow;
    ctx.fillText(text, x, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // Two ropes from the board's top up to the middle of the island. They're drawn before the islands,
  // so they disappear up behind the rock.
  function drawRopes({ x, y, board, hit }, ox, oy) {
    const { image, meta } = art.sign;
    const [rx, ry, rw, rh] = meta.rope;
    const top = hit[1] + Math.floor(hit[3] / 2);
    for (const cx of [x + 8, x + board.w - 9]) {
      for (let yy = top; yy < y; yy += rh) {
        const n = Math.min(rh, y - yy);
        ctx.drawImage(image, rx, ry, rw, n, ox + cx, oy + yy, rw, n);
      }
    }
  }

  // The board: the 9-slice's corners as they are, its edges tiled, its middle filled; then the words.
  function drawBoard({ x, y, board }, ox, oy) {
    const { image, meta } = art.sign;
    const s = meta.slice;
    const [bw, bh] = meta.size;
    const mw = bw - 2 * s, mh = bh - 2 * s;
    const X = ox + x, Y = oy + y, W = board.w, H = board.h;
    ctx.fillStyle = meta.fill;
    ctx.fillRect(X + s, Y + s, W - 2 * s, H - 2 * s);
    for (let i = s; i < W - s; i += mw) {
      const n = Math.min(mw, W - s - i);
      ctx.drawImage(image, s, 0, n, s, X + i, Y, n, s);
      ctx.drawImage(image, s, bh - s, n, s, X + i, Y + H - s, n, s);
    }
    for (let j = s; j < H - s; j += mh) {
      const n = Math.min(mh, H - s - j);
      ctx.drawImage(image, 0, s, s, n, X, Y + j, s, n);
      ctx.drawImage(image, bw - s, s, s, n, X + W - s, Y + j, s, n);
    }
    for (const [cx, cy] of [[0, 0], [bw - s, 0], [0, bh - s], [bw - s, bh - s]]) {
      ctx.drawImage(image, cx, cy, s, s, cx ? X + W - s : X, cy ? Y + H - s : Y, s, s);
    }
    for (const row of board.rows) {
      ctx.font = FONTS[row.style];
      ctx.fillStyle = meta.text[row.style];
      ctx.fillText(row.text, X + SIGN.pad, Y + row.y);
    }
  }

  function draw({ view, islands, sky, now, anim, reduced, active }) {
    const { cw, ch, ox, oy, stage, layout } = view;
    const t = reduced ? 0 : anim; // reduced motion: everything that loops holds its first frame
    const shown = weights(sky);
    const layers = sky.from === sky.to ? [[sky.from, 1]] : [[sky.from, 1], [sky.to, sky.t]];
    const S = art.sky.sprites;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';

    // A strip (a whole image, or one row of a sheet) repeated sideways across the canvas, lined up so
    // one copy starts at x0.
    const tileRow = (image, sy, sw, sh, x0, y) => {
      for (let x = (((x0 % sw) + sw) % sw) - sw; x < cw; x += sw) ctx.drawImage(image, 0, sy, sw, sh, x, y, sw, sh);
    };
    const sprite = ([sx, sy, sw, sh], x, y) => ctx.drawImage(art.atlas, sx, sy, sw, sh, x, y, sw, sh);

    // 1. The sky: each showing phase's picture tiled across the canvas, its top and bottom colours
    //    carrying on above and below the stage. The incoming phase is drawn over the outgoing one.
    for (const [phase, alpha] of layers) {
      ctx.globalAlpha = alpha;
      const edges = art.sky.phases[phase];
      ctx.fillStyle = edges.top;
      ctx.fillRect(0, 0, cw, Math.max(0, oy));
      ctx.fillStyle = edges.bottom;
      ctx.fillRect(0, oy + stage.h, cw, Math.max(0, ch - oy - stage.h));
      const image = art.skies[layout][phase];
      tileRow(image, 0, image.width, image.height, ox, oy);
    }

    // 2. Night: twinkling stars, the moon, and now and then a shooting star. Dawn: a low pale sun.
    //    Day: the odd bird. Each fades with its phase.
    if (shown.night > 0) {
      ctx.globalAlpha = shown.night;
      for (const star of twinkles(cw, ch)) {
        const r = S.twinkle[twinkleFrame(t, star)];
        sprite(r, star.x - (r[2] >> 1), star.y - (r[3] >> 1));
      }
      sprite(S.moon, ox + stage.moon[0], oy + stage.moon[1]);
      const shooting = reduced ? null : shootingStarAt(t, cw, ch);
      if (shooting) {
        ctx.fillStyle = art.sky.shooting;
        for (let i = 0; i < 8; i++) {
          ctx.globalAlpha = shown.night * (1 - shooting.age) * (1 - i / 8);
          ctx.fillRect(shooting.x + i, shooting.y - i, 1, 1);
        }
      }
    }
    if (shown.dawn > 0) {
      ctx.globalAlpha = shown.dawn;
      sprite(S.sun, ox + stage.sun[0], oy + stage.sun[1]);
    }
    const bird = reduced || shown.day === 0 ? null : birdAt(t, cw, ch);
    if (bird) {
      ctx.globalAlpha = shown.day;
      sprite(S.bird[bird.frame], bird.x, bird.y);
    }

    // 3. The clouds, far to near, each layer drifting at its own speed. A layer has the same shapes in
    //    every phase, so the incoming phase's colours are simply drawn over the outgoing ones.
    const clouds = art.sky.clouds;
    for (let layer = 0; layer < clouds.layers; layer++) {
      const x0 = ox - drift(t, CLOUD_SPEEDS[layer], clouds.w);
      for (const [phase, alpha] of layers) {
        ctx.globalAlpha = alpha;
        const row = PHASES.indexOf(phase) * clouds.layers + layer;
        tileRow(art.clouds, row * clouds.h, clouds.w, clouds.h, x0, oy + stage.clouds[layer]);
      }
    }
    ctx.globalAlpha = 1;

    // 4. The title, in the colours of whichever phase shows more.
    const colors = art.sky.phases[dominant(sky)];
    const [tx, ty] = stage.title;
    lettering(TITLE, 'title', ox + tx, oy + ty, colors.title, colors.shadow);
    lettering(SUBTITLE, 'subtitle', ox + tx, oy + ty + SUBTITLE_DY, colors.subtitle, colors.shadow);

    // 5. The islands, bobbing, the active one lifted and glowing, with its sign hanging from it.
    const placed = islands.map((island) => {
      const lift = island.game ? liftOf(island.id, island.id === active, now, reduced) : 0;
      return { island, dy: bob(t, island.bob.period, island.bob.phase) - lift };
    });
    const lit = placed.find((p) => p.island.game && p.island.id === active);
    let sign = null;
    if (lit) {
      const board = boardFor(lit.island.id, Math.min(SIGN.maxW, cw - 2 * SIGN.margin));
      const [hx, hy, hw, hh] = lit.island.hit;
      const hit = [hx, hy + lit.dy, hw, hh];
      sign = { board, hit, ...placeSign(hit, board.w, board.h, [-ox, -oy, cw, ch]) };
      if (sign.hanging) drawRopes(sign, ox, oy);
    }
    for (const p of placed) {
      const { meta } = p.island;
      const image = art.images[p.island.island];
      const sx = frameAt(t, meta.frames, meta.ms) * meta.w;
      const x = ox + p.island.x, y = oy + p.island.y + p.dy;
      if (p === lit) ctx.drawImage(image, sx, meta.h, meta.w, meta.h, x, y, meta.w, meta.h);
      ctx.drawImage(image, sx, 0, meta.w, meta.h, x, y, meta.w, meta.h);
    }
    if (sign) drawBoard(sign, ox, oy);
  }

  return { draw };
}
