// Draws the world into a pixel buffer: the sky, the walls, the snow and floorboards, the rafters under
// the cabin roof, the sprites and the falling snow, all lit from the lightmap. It's arithmetic on
// typed arrays and allocates nothing per frame, so it runs (and is tested and timed) in Node too.
//
// art (see assets.js):
//   shades   { table, fade, emissive } from shade.js
//   walls    { name: Uint8Array(32 * 32) }, column-major (index x * 32 + y), palette indices
//   floors   { snow, planks, rafters: Uint8Array(32 * 32) }, row-major
//   sky      { w, h, px: Uint8Array }, row-major; a panorama whose bottom row sits on the horizon, and
//            whose top row carries on above it
//   flake    the palette index falling snow is drawn in
//   ichor    the palette index of the spray when a creature is hit
import { castRay, createHit } from './raycast.js';
import { BAYER, LEVELS } from './shade.js';
import { lightAt, RES } from './lightmap.js';

export const TEX = 32;
const TOP = LEVELS - 1;
const SNOW_BOX = 12; // flakes fill a box this many cells across, centred on you
const SNOW_TOP = 3.4; // and fall from this high: above the view's centre across the box, looking all the way up
const FLAKES = 780; // 300 to every 1.3 cells of height
const LIGHT_SPAN = 8; // the most pixels along a floor or ceiling row between reads of the light

// Deterministic per-flake numbers in [0, 1).
function hash(i, k) {
  let n = (i * 374761393 + k * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function createRenderer(art, map) {
  const { table, fade, emissive } = art.shades;
  const wallTex = map.wallKinds.map((k) => k && { ns: art.walls[k.ns], ew: art.walls[k.ew] });
  for (let i = 1; i < wallTex.length; i++) {
    for (const f of ['ns', 'ew']) if (!wallTex[i][f]) throw new Error(`no wall texture "${map.wallKinds[i][f]}"`);
  }
  const { snow, planks, rafters } = art.floors;
  const sky = art.sky;
  const flakes = new Float32Array(FLAKES * 4);
  for (let i = 0; i < FLAKES; i++) {
    flakes[i * 4] = hash(i, 1) * SNOW_BOX;
    flakes[i * 4 + 1] = hash(i, 2) * SNOW_BOX;
    flakes[i * 4 + 2] = hash(i, 3); // fall phase
    flakes[i * 4 + 3] = (0.325 + hash(i, 4) * 0.325) / SNOW_TOP; // falling 0.33 to 0.65 cells a second, as a share of the fall
  }
  const hit = createHit();
  let w = 0, h = 0, focal = 1, plane = 1;
  let buf, zbuf, wallTop, wallBot, rayX, rayY, skyCol, order, depths;
  // This frame's camera, shared with point().
  let cx = 0, cy = 0, dirX = 1, dirY = 0, hz = 0, lm = null;

  // A point in the world (height z) as one lit pixel, or a 2x2 block up close, hidden by walls.
  function point(wx, wy, z, idx) {
    const rx = wx - cx, ry = wy - cy;
    const depth = rx * dirX + ry * dirY;
    if (depth < 0.2) return;
    const sxp = (w / 2 + ((rx * -dirY + ry * dirX) / depth) * focal) | 0;
    const syp = (hz + ((0.5 - z) * focal) / depth) | 0;
    if (sxp < 0 || sxp >= w || syp < 0 || syp >= h || depth >= zbuf[sxp]) return;
    let l = (lightAt(lm, wx, wy) * TOP + 0.5) | 0;
    if (l > TOP) l = TOP;
    if (l === 0) return;
    const c = table[(l << 8) | idx];
    buf[syp * w + sxp] = c;
    if (depth < 2 && sxp + 1 < w && syp + 1 < h) {
      buf[syp * w + sxp + 1] = c;
      buf[(syp + 1) * w + sxp] = c;
      buf[(syp + 1) * w + sxp + 1] = c;
    }
  }

  const r = {
    buffer: null,
    resize(view) {
      ({ w, h, focal, plane } = view);
      buf = new Uint32Array(w * h);
      zbuf = new Float32Array(w);
      wallTop = new Int32Array(w);
      wallBot = new Int32Array(w);
      rayX = new Float32Array(w + 1);
      rayY = new Float32Array(w + 1);
      skyCol = new Int32Array(w);
      order = new Int32Array(256);
      depths = new Float32Array(256);
      r.buffer = buf;
    },
    draw(f) {
      lm = f.lightmap;
      cx = f.x;
      cy = f.y;
      dirX = Math.cos(f.facing);
      dirY = Math.sin(f.facing);
      const rightX = -dirY * plane, rightY = dirX * plane;
      // Looking up or down shears the view, as Duke Nukem 3D did: the horizon moves by tan(pitch) x
      // focal, so the crosshair at the centre stays on the line a shot takes, and walls stay upright.
      hz = Math.round(h / 2 + (f.bob || 0) + Math.tan(f.pitch || 0) * focal);
      const skyRow = (f.skyLevel | 0) << 8;

      // Walls, one column at a time.
      for (let x = 0; x <= w; x++) {
        const camX = (2 * x) / w - 1 + 1 / w;
        rayX[x] = dirX + rightX * camX;
        rayY[x] = dirY + rightY * camX;
      }
      for (let x = 0; x < w; x++) {
        const rdx = rayX[x], rdy = rayY[x];
        const ang = f.facing + Math.atan2((2 * x) / w - 1 + 1 / w, 1 / plane);
        let a = (ang / (2 * Math.PI)) % 1;
        if (a < 0) a += 1;
        skyCol[x] = (a * sky.w) | 0;
        if (!castRay(map, cx, cy, rdx, rdy, hit)) {
          zbuf[x] = Infinity;
          wallTop[x] = hz;
          wallBot[x] = hz;
          continue;
        }
        const dist = Math.max(hit.dist, 1e-4);
        zbuf[x] = dist;
        const lineH = focal / dist;
        const top = hz - lineH * 0.5;
        const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(h, Math.ceil(top + lineH - 0.5));
        wallTop[x] = y0;
        wallBot[x] = y1;
        const tex = wallTex[hit.kind][hit.face];
        let tx = (hit.u * TEX) | 0;
        if (tx > TEX - 1) tx = TEX - 1;
        const col = tx * TEX;
        // Light where the ray met the wall, pulled back a little into the open side.
        const back = 0.05 / Math.sqrt(rdx * rdx + rdy * rdy);
        const light = lightAt(lm, cx + rdx * (dist - back), cy + rdy * (dist - back)) * TOP;
        const step = TEX / lineH;
        let pos = (y0 + 0.5 - top) * step;
        for (let y = y0, o = y0 * w + x; y < y1; y++, o += w, pos += step) {
          const idx = tex[col + ((pos | 0) & (TEX - 1))];
          let l = (light + BAYER[((y & 3) << 2) | (x & 3)]) | 0;
          if (l > TOP) l = TOP;
          buf[o] = table[(l << 8) | idx];
        }
      }

      // Floor and ceiling, a row at a time: every pixel of a row is at the same depth. Above the
      // horizon it's sky, except under the cabin roof. Along a row the light changes slowly, so it's
      // read every `span` pixels and blended in between: a span covers at most one lightmap cell, so
      // up close (looking down, most of the view) that's LIGHT_SPAN pixels, and near the horizon
      // every pixel.
      const half = 0.5 * focal;
      const mw = map.w, mh = map.h, roofed = map.roofed, skyPx = sky.px;
      for (let y = 0; y < h; y++) {
        const below = y >= hz;
        const rowDist = half / (below ? y + 0.5 - hz : hz - y - 0.5);
        let wx = cx + rowDist * rayX[0], wy = cy + rowDist * rayY[0];
        const sx = (rowDist * (rayX[w] - rayX[0])) / w, sy = (rowDist * (rayY[w] - rayY[0])) / w;
        const span = Math.max(1, Math.min(LIGHT_SPAN, (1 / (RES * Math.sqrt(sx * sx + sy * sy))) | 0));
        let x0 = 0, x1 = 0, l0 = 0, dl = 0; // the light at x0, and its change a pixel until x1
        const bay = (y & 3) << 2;
        let o = y * w;
        if (!below) {
          const sr = sky.h - (hz - y);
          const skyBase = (sr < 0 ? 0 : sr) * sky.w;
          for (let x = 0; x < w; x++, o++, wx += sx, wy += sy) {
            if (y >= wallTop[x]) continue;
            const mx = wx | 0, my = wy | 0;
            if (wx < 0 || wy < 0 || mx >= mw || my >= mh || roofed[my * mw + mx] === 0) {
              buf[o] = table[skyRow | skyPx[skyBase + skyCol[x]]];
              continue;
            }
            const idx = rafters[(((wy - my) * TEX) | 0) * TEX + (((wx - mx) * TEX) | 0)];
            if (x >= x1) {
              x0 = x;
              x1 = x + span;
              l0 = lightAt(lm, wx, wy);
              dl = (lightAt(lm, wx + sx * span, wy + sy * span) - l0) / span;
            }
            let l = ((l0 + dl * (x - x0)) * TOP + BAYER[bay | (x & 3)]) | 0;
            if (l > TOP) l = TOP;
            buf[o] = table[(l << 8) | idx];
          }
          continue;
        }
        for (let x = 0; x < w; x++, o++, wx += sx, wy += sy) {
          if (y < wallBot[x]) continue;
          const mx = wx | 0, my = wy | 0;
          const roof = wx >= 0 && wy >= 0 && mx < mw && my < mh && roofed[my * mw + mx] === 1;
          const idx = (roof ? planks : snow)[(((wy - my) * TEX) | 0) * TEX + (((wx - mx) * TEX) | 0)];
          if (x >= x1) {
            x0 = x;
            x1 = x + span;
            l0 = lightAt(lm, wx, wy);
            dl = (lightAt(lm, wx + sx * span, wy + sy * span) - l0) / span;
          }
          let l = ((l0 + dl * (x - x0)) * TOP + BAYER[bay | (x & 3)]) | 0;
          if (l > TOP) l = TOP;
          buf[o] = table[(l << 8) | idx];
        }
      }

      // Sprites, far to near, each column hidden behind nearer walls.
      const n = Math.min(f.spriteCount, order.length);
      let m = 0;
      for (let i = 0; i < n; i++) {
        const s = f.sprites[i];
        const rx = s.x - cx, ry = s.y - cy;
        const depth = rx * dirX + ry * dirY;
        if (depth < 0.1) continue;
        // insertion sort, farthest first
        let j = m++;
        while (j > 0 && depths[j - 1] < depth) {
          depths[j] = depths[j - 1];
          order[j] = order[j - 1];
          j--;
        }
        depths[j] = depth;
        order[j] = i;
      }
      for (let k = 0; k < m; k++) {
        const s = f.sprites[order[k]];
        const depth = depths[k];
        const fr = s.frame;
        const lateral = ((s.x - cx) * -dirY + (s.y - cy) * dirX);
        const sh = (s.height * focal) / depth, sw = (sh * fr.w) / fr.h;
        const centre = w / 2 + (lateral / depth) * focal;
        const bottom = hz + ((0.5 - (s.lift || 0)) * focal) / depth;
        const top = bottom - sh, left = centre - sw / 2;
        const xa = Math.max(0, Math.ceil(left - 0.5)), xb = Math.min(w, Math.ceil(left + sw - 0.5));
        const ya = Math.max(0, Math.ceil(top - 0.5)), yb = Math.min(h, Math.ceil(bottom - 0.5));
        if (xa >= xb || ya >= yb) continue;
        const light = lightAt(lm, s.x, s.y) * TOP;
        const eyes = (s.glow ?? TOP) << 8;
        // Far off, sample a halved copy of the frame (its `mips`, from assets.js): the finest that's
        // less than twice the drawn size. While that's still bigger than drawn, pixels skip some of its
        // texels, and a 1-texel eye could fall between them; so each pixel also looks at the next
        // level down, at the 2x2 block its texel is in, and shows the block's glow if it has one. On
        // screen every texel of that level spans at least a pixel, so no pixel skips it, and the eyes
        // never blink out.
        let F = fr, G = null, mi = 0;
        const mips = fr.mips;
        if (mips !== undefined) {
          while (mi < mips.length && F.h >= 2 * sh) F = mips[mi++];
          if (mi < mips.length && (F.h > sh || F.w > sw)) G = mips[mi];
        }
        const px = F.px, fw = F.w, fh = F.h;
        const gpx = G === null ? null : G.px, gh = G === null ? 0 : G.h;
        for (let x = xa; x < xb; x++) {
          if (depth >= zbuf[x]) continue;
          let tx = (((x + 0.5 - left) / sw) * fw) | 0;
          if (tx >= fw) tx = fw - 1;
          if (s.flip) tx = fw - 1 - tx;
          const col = tx * fh, last = col + fh - 1, step = fh / sh, gcol = (tx >> 1) * gh;
          let pos = (ya + 0.5 - top) * step;
          for (let y = ya, o = ya * w + x; y < yb; y++, o += w, pos += step) {
            let ti = col + (pos | 0);
            if (ti > last) ti = last;
            let idx = px[ti];
            if (gpx !== null && emissive[idx] === 0) {
              const g = gpx[gcol + ((ti - col) >> 1)];
              if (emissive[g] === 1) idx = g;
            }
            if (idx === 0) continue;
            if (emissive[idx]) {
              buf[o] = fade[eyes | idx];
              continue;
            }
            let l = (light + BAYER[((y & 3) << 2) | (x & 3)]) | 0;
            if (l > TOP) l = TOP;
            buf[o] = table[(l << 8) | idx];
          }
        }
      }

      // The spray from hits.
      if (f.drops) for (const d of f.drops) if (d.t > 0) point(d.x, d.y, d.z, art.ichor);

      // Falling snow: a box of flakes that drifts with you, drawn as single pixels, hidden by walls
      // and by the cabin roof.
      if (f.snow) {
        const t = f.time;
        for (let i = 0; i < FLAKES; i++) {
          const b = i * 4;
          let fx = (flakes[b] + t * 0.35 - cx) % SNOW_BOX;
          if (fx < 0) fx += SNOW_BOX;
          let fy = (flakes[b + 1] + t * 0.12 - cy) % SNOW_BOX;
          if (fy < 0) fy += SNOW_BOX;
          const wx = cx + fx - SNOW_BOX / 2, wy = cy + fy - SNOW_BOX / 2;
          const z = SNOW_TOP - ((flakes[b + 2] + t * flakes[b + 3]) % 1) * SNOW_TOP;
          const rx = wx - cx, ry = wy - cy;
          const depth = rx * dirX + ry * dirY;
          if (depth < 0.2) continue;
          const sxp = (w / 2 + ((rx * -dirY + ry * dirX) / depth) * focal) | 0;
          const syp = (hz + ((0.5 - z) * focal) / depth) | 0;
          if (sxp < 0 || sxp >= w || syp < 0 || syp >= h || depth >= zbuf[sxp]) continue;
          const mx = wx | 0, my = wy | 0;
          if (mx >= 0 && my >= 0 && mx < map.w && my < map.h && map.roofed[my * map.w + mx]) continue;
          let l = (lightAt(lm, wx, wy) * TOP + 0.5) | 0;
          if (l > TOP) l = TOP;
          if (l > 0) buf[syp * w + sxp] = table[(l << 8) | art.flake];
        }
      }
    },
  };
  return r;
}
