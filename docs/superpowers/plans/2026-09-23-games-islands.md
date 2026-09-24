# Games Page: Floating Islands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the games site's plain card grid (`index.html` at the repo root) with a single-screen, living pixel-art scene: each game floats as its own diorama island, in its own game's style, in a sky that follows the visitor's local time of day.

**Architecture:**
- **Art.** Lua scripts run through the Aseprite CLI paint everything into `site/assets/`: the sky for each phase and stage shape, the clouds, the small sky sprites, each island's animation strip, and the sign.
- **Pure modules.** Small modules (`sky.js`, `layout.js`, `motion.js`, `islands.js`, `sign.js`) hold all the logic as pure functions of time and size, and are tested in Node.
- **Drawing and links.** `render.js` draws a canvas from them. `links.js` lays the page's real `<a>` links invisibly over the islands.
- **Fallback.** Without JavaScript, or if the scene can't start, the same links show as a plain list.

**Tech Stack:**
- Page: plain JavaScript ES modules and Canvas 2D. No build step and no dependencies.
- Tests: `node --test` on Node 22, plus the Playwright MCP for the browser checks.
- Art: Aseprite 1.3 Lua (the `json` module, `Image{fromFile}`).
- Font: Silkscreen 400/700 from Google Fonts.

**Spec:** `docs/superpowers/specs/2026-09-23-games-islands-design.md`. Read it alongside this plan: the plan implements it, and the spec explains why.

## Global Constraints

**Hosting and code**
- The site is static files served by GitHub Pages from `main` at the repo root. There's no build step and there are no npm dependencies.
- `site/package.json` contains only `"type": "module"` and a `test` script. The tests run with `cd site && npm test`.
- Everything is plain ES modules. The page code never uses JSON import attributes: `games.json` and the art are fetched, so the scene runs in any browser with ES modules, and the plain list covers the rest.
- The pure modules never touch the DOM, `Date`, `Math.random` or the canvas. Time and sizes are passed in:
  - `sky.js`, `layout.js`, `motion.js`, `islands.js` and `sign.js`;
  - `tapDecision` and `activeIsland` in `links.js`.
- `Math.random` isn't used anywhere. Anything scattered (stars, birds, shooting stars) comes from `hash()` in `motion.js`.

**Scene**
- There are two stages:
  - **landscape**, 384×216 scene pixels;
  - **portrait**, 216×384.
- The scale is the largest whole number of **device** pixels per scene pixel that fits the window, and at least 1.
- The canvas covers the whole window. The stage is centred in it. Past the stage, the sky tiles sideways, with its top and bottom colours above and below.
- The canvas has `image-rendering: pixelated` and `imageSmoothingEnabled = false`. Every drawing coordinate is a whole scene pixel.
- The sky phases, in this order everywhere, are `dawn` (05:00), `day` (08:00), `dusk` (17:00) and `night` (20:00), each starting at the local hour shown. Each boundary crossfades over the half hour centred on it. `?time=dawn|day|dusk|night` pins the phase.
- The title words are **"Games"** and **"Little things I've built."**, in Silkscreen: the title at 16px, the subtitle and signs at 8px, and the sign's name in bold (700).

**Data**
- The words live in the page. Each game's link sits in `index.html`'s list, in exactly this form, all on one line:

  ```html
  <li><a href="./<id>/" data-game="<id>"><strong>Name</strong> <span class="blurb">…</span> <span class="controls">…</span></a></li>
  ```

  Without JavaScript this is the plain list. With it, these are the words on the island's sign.
- The rest lives in `site/games.json`, keyed by the same `id`. List order is draw order and tab order.
- Game islands are 96–140 px wide (their opaque width). The unfinished island is 48–80 px wide.
- The id `unfinished` is reserved for the unfinished island. It has no link.

**Art**
- Every image comes from a Lua script in `art/site/`. Run each one from the repo root with
  `/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/<name>.lua`.
- The rebuild loop is:

  ```sh
  for s in sky island-snake island-marrow island-unfinished sign; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/$s.lua; done
  ```

  It's deterministic. Re-running it on unchanged scripts leaves `git status` clean. There's no `math.random`; noise comes from `L.rnd`.
- Where the scripts write:
  - editable `.aseprite` files go to `art/site/`;
  - PNG and JSON go to `site/assets/`;
  - previews (`art/site/preview-*.png`, `preview-*.gif`) are git-ignored and never committed.
- The site's art has its own helpers (`art/site/lib.lua`) and colours (`art/site/palette.lua`). It never `dofile`s anything in `art/marrow/` or `art/snake-*`. Colours borrowed from a game are copied into `palette.lua`, with a comment naming where they came from.
- All of `site/assets/` together stays under 300 KB, and a test enforces it.
- Nothing in `snake/`, `marrow/`, `art/marrow/` or `art/snake-*` changes.

**Commits**
- Subjects start with `Games page: `.
- Every commit message ends with a blank line and then these two lines, using your own model name:

  ```
  Co-Authored-By: <your model name> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Jer9JZ6gGPVuWkiQDWM26m
  ```

- Work on the `islands` branch. Never push.

## File Structure

```
index.html                      the page: the plain list (words + links), the canvas, the boot scripts   (Task 9)
README.md                       "Adding a game" and "The games page"                                    (Task 10)
art/site/.gitignore             preview-*.png, preview-*.gif                                            (Task 1)
art/site/lib.lua                buffers, noise, dither, blit, outline, save                             (Task 1)
art/site/palette.lua            every colour: sky phases, clouds, sprites, each island, sign, glows     (Task 1)
art/site/sky.lua                -> sky-<phase>-<layout>.png x8, clouds.png, sky.png, sky.json           (Task 1)
art/site/island.lua             island sheet writer: frames -> strip + glow row, json, .aseprite, gif    (Task 2)
art/site/island-snake.lua       -> island-snake.png/.json                                               (Task 2)
art/site/island-marrow.lua      -> island-marrow.png/.json                                              (Task 2)
art/site/island-unfinished.lua  -> island-unfinished.png/.json                                          (Task 3)
art/site/sign.lua               -> sign.png/.json                                                       (Task 3)
art/site/style-test.lua         -> art/site/preview-style.png (not committed)                           (Task 3)
site/package.json               {"type":"module","scripts":{"test":"node --test test/*.test.js"}}       (Task 4)
site/sky.js                     phase and crossfade from the clock or ?time=                            (Task 4)
site/layout.js                  the two stages; chooseView; toCss                                       (Task 5)
site/motion.js                  bob, lift, frames, drift, hash, stars, birds, shooting stars            (Task 5)
site/games.json                 each game's island, positions per layout, bob; the unfinished island    (Task 6)
site/islands.js                 placeIslands, checkGames, overlaps                                      (Task 6)
site/sign.js                    wrap, layoutSign, placeSign                                             (Task 7)
site/load.js                    loadScene (fetches games.json and every asset)                          (Task 8)
site/render.js                  createRenderer(ctx, art, info).draw(frame)                              (Task 8)
site/links.js                   tapDecision, activeIsland, createLinks (DOM)                            (Task 9)
site/main.js                    boot, resize, the frame loop, fallback on failure                       (Task 9)
site/test/helpers.js            readJson, pngSize, siteFile                                             (Task 4)
site/test/*.test.js             one per module, plus assets.test.js and page.test.js
```

## Review Focus

These are the five failure modes the spec implies but a straightforward build could miss. Each has a test in its owning task.

1. **Resizing or rotating across the landscape/portrait boundary mid-visit.**
   - Expected: the stage switches, the sky pictures swap, and every link moves with its island.
   - Covered by: the Task 5 layout tests (phone upright and sideways, ties) and the Task 9 browser resize check.
2. **Browser zoom or a fractional `devicePixelRatio`** (1.25 on many Windows laptops).
   - Expected: the pixels stay crisp and the canvas still covers the window.
   - Covered by: the Task 5 tests at 1366×768@1.25, and a sweep of sizes × DPRs.
3. **`?time=` typos and clock edges** (`?time=noon`, `?time=DUSK`, midnight, exactly on a boundary).
   - Expected: anything unknown follows the clock, and the crossfade is continuous.
   - Covered by: the Task 4 tests.
4. **Touch.**
   - Expected: tapping island A and then island B arms B instead of playing it. Tapping the sky puts the sign away. Coming back with Back leaves nothing stuck. Enter on a touch laptop still plays at once.
   - Covered by: the Task 9 `tapDecision` and `activeIsland` tests, plus the `detail === 0` and `pageshow` handling.
5. **Silkscreen failing to load** (fonts blocked, offline), and long words.
   - Expected: the sign measures with whatever font is in use, so the words still fit, and one long word can't break the layout.
   - Covered by: the Task 7 wrap and layout tests, which use a measure function per style.

---

## Phase 1 — The art (spec build step 1: the style checkpoint)

### Task 1: Site art helpers, palette and the sky

**Files:**
- Create: `art/site/.gitignore`, `art/site/lib.lua`, `art/site/palette.lua`, `art/site/sky.lua`
- Generated:
  - in `site/assets/`: `sky-{dawn,day,dusk,night}-{landscape,portrait}.png`, `clouds.png`, `sky.png`, `sky.json`;
  - in `art/site/`: the matching `.aseprite` files.

**Interfaces:**
- Produces: `sky.json`, which Tasks 4 and 8 read. It has this shape:

  ```json
  {
    "order": ["dawn", "day", "dusk", "night"],
    "phases": { "<phase>": { "top": "#rrggbb", "bottom": "#rrggbb", "title": "#rrggbb", "shadow": "#rrggbb", "subtitle": "#rrggbb" } },
    "clouds": { "w": 384, "h": 48, "layers": 3 },
    "sprites": {
      "moon": [x, y, w, h], "sun": [x, y, w, h],
      "bird": [[x, y, w, h], [x, y, w, h]],
      "twinkle": [[x, y, w, h], [x, y, w, h], [x, y, w, h]]
    },
    "shooting": "#rrggbb"
  }
  ```

  - `top` and `bottom` are the first and last gradient stops.
  - `clouds.png` row `r = phaseIndex * 3 + layer` (layers far, mid, near) is the strip at `y = r * 48`. Each layer has the same shapes in every phase; only the colours change.
- Produces: `L` (`lib.lua`) and `P` (`palette.lua`), which every later art script uses.

- [ ] **Step 1: Ignore the previews**

`art/site/.gitignore`:
```
preview-*.png
preview-*.gif
```

- [ ] **Step 2: Write the helper library**

`art/site/lib.lua`:
```lua
-- Shared helpers for the games page's art scripts: repo paths, JSON, pixel buffers, deterministic
-- noise, ordered dither, simple drawing, alpha blitting, outlines and saving. Buffers hold "#rrggbb" or
-- "#rrggbbaa" strings (nil is transparent), indexed buf[y][x] from 0.
local M = {}

local here = debug.getinfo(1, "S").source:sub(2)
M.ROOT = here:match("^(.-)art/site/[^/]+$") or ""

function M.path(rel) return M.ROOT .. rel end

function M.readJson(rel)
  local f = assert(io.open(M.path(rel), "r"), "can't open " .. M.path(rel))
  local text = f:read("a")
  f:close()
  return json.decode(text)
end

-- Makes sure the folder that will hold a repo-relative file exists.
function M.ensureDir(rel)
  app.fs.makeAllDirectories(app.fs.filePath(M.path(rel)))
end

function M.writeText(rel, text)
  M.ensureDir(rel)
  local f = assert(io.open(M.path(rel), "w"), "can't write " .. M.path(rel))
  f:write(text)
  f:close()
end

function M.channels(hex)
  return tonumber(hex:sub(2, 3), 16), tonumber(hex:sub(4, 5), 16), tonumber(hex:sub(6, 7), 16),
    (#hex >= 9) and tonumber(hex:sub(8, 9), 16) or 255
end

function M.rgba(hex)
  local r, g, b, a = M.channels(hex)
  return app.pixelColor.rgba(r, g, b, a)
end

function M.buffer(w, h)
  local b = { w = w, h = h }
  for y = 0, h - 1 do b[y] = {} end
  return b
end

function M.set(b, x, y, c)
  x, y = math.floor(x), math.floor(y)
  if x >= 0 and y >= 0 and x < b.w and y < b.h then b[y][x] = c end
end

function M.get(b, x, y)
  x, y = math.floor(x), math.floor(y)
  if x >= 0 and y >= 0 and x < b.w and y < b.h then return b[y][x] end
  return nil
end

-- Deterministic noise in [0, 1), so every run draws identical pixels.
function M.rnd(x, y, seed)
  local n = (math.floor(x) * 374761393 + math.floor(y) * 668265263 + math.floor(seed or 0) * 1442695041) % 2147483647
  n = ((n ~ (n >> 13)) * 1274126177) % 2147483647
  return (n % 10007) / 10007
end

local BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }
-- 4x4 ordered-dither threshold in (0, 1).
function M.bayer(x, y)
  return (BAYER[(math.floor(y) % 4) * 4 + (math.floor(x) % 4) + 1] + 0.5) / 16
end

function M.fillRect(b, x0, y0, x1, y1, c)
  for y = y0, y1 do for x = x0, x1 do M.set(b, x, y, c) end end
end

function M.disc(b, cx, cy, r, c)
  for y = math.floor(cy - r), math.ceil(cy + r) do
    for x = math.floor(cx - r), math.ceil(cx + r) do
      local dx, dy = x + 0.5 - cx, y + 0.5 - cy
      if dx * dx + dy * dy <= r * r then M.set(b, x, y, c) end
    end
  end
end

-- Draws src onto dst at (ox, oy); translucent pixels are blended over what's already there.
function M.blit(dst, src, ox, oy)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then
        local r, g, bl, a = M.channels(c)
        local under = M.get(dst, ox + x, oy + y)
        if a < 255 and under then
          local r2, g2, b2 = M.channels(under)
          local k = a / 255
          c = string.format("#%02x%02x%02x", math.floor(r * k + r2 * (1 - k) + 0.5),
            math.floor(g * k + g2 * (1 - k) + 0.5), math.floor(bl * k + b2 * (1 - k) + 0.5))
        end
        if a > 0 then M.set(dst, ox + x, oy + y, c) end
      end
    end
  end
end

function M.scale(src, k)
  local b = M.buffer(src.w * k, src.h * k)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then for yy = 0, k - 1 do for xx = 0, k - 1 do b[y * k + yy][x * k + xx] = c end end end
    end
  end
  return b
end

-- A copy of the w x h rectangle of src at (x, y).
function M.crop(src, x, y, w, h)
  local b = M.buffer(w, h)
  for yy = 0, h - 1 do for xx = 0, w - 1 do b[yy][xx] = M.get(src, x + xx, y + yy) end end
  return b
end

-- A 1px outline in `color` round everything opaque in b (4-neighbour), added outside the shape.
function M.outline(b, color)
  local add = {}
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      if not b[y][x] then
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          if M.get(b, x + d[1], y + d[2]) then add[#add + 1] = { x, y }; break end
        end
      end
    end
  end
  for _, p in ipairs(add) do b[p[2]][p[1]] = color end
end

-- Loads a PNG (path relative to the repo root) into a buffer of "#rrggbbaa" strings.
function M.load(rel)
  local img = Image{ fromFile = M.path(rel) }
  local b = M.buffer(img.width, img.height)
  local pc = app.pixelColor
  for y = 0, img.height - 1 do
    for x = 0, img.width - 1 do
      local p = img:getPixel(x, y)
      local a = pc.rgbaA(p)
      if a > 0 then b[y][x] = string.format("#%02x%02x%02x%02x", pc.rgbaR(p), pc.rgbaG(p), pc.rgbaB(p), a) end
    end
  end
  return b
end

-- Writes a buffer as a one-layer RGB sprite: the editable .aseprite and/or a PNG (either may be nil).
function M.save(b, asepriteRel, pngRel)
  local spr = Sprite(b.w, b.h, ColorMode.RGB)
  local img = spr.cels[1].image
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      local c = b[y][x]
      if c then img:drawPixel(x, y, M.rgba(c)) end
    end
  end
  if asepriteRel then M.ensureDir(asepriteRel); spr:saveAs(M.path(asepriteRel)) end
  if pngRel then M.ensureDir(pngRel); spr:saveCopyAs(M.path(pngRel)) end
  spr:close()
end

return M
```

- [ ] **Step 3: Write the palette**

`art/site/palette.lua`:
```lua
-- Every colour on the games page, defined once. The sky is deliberately neutral and soft, so it frames
-- the islands' clashing styles instead of competing with them. Each island's colours are copied from its
-- game's own art (named below), not read from there, so the site's art never depends on the games'
-- scripts. Ramps run dark -> light.
return {
  -- Each phase: gradient stops top -> bottom ({ position 0..1, colour }), and the title's colours on it.
  sky = {
    dawn = {
      stops = { { 0, "#4b3f73" }, { 0.35, "#7e6a9e" }, { 0.62, "#c795b3" }, { 0.84, "#f0b3a0" }, { 1, "#fbd8b4" } },
      title = "#fff7ec", shadow = "#4b3f73", subtitle = "#fde9dc",
    },
    day = {
      stops = { { 0, "#4d86c9" }, { 0.4, "#6ea4dc" }, { 0.7, "#9cc6ea" }, { 1, "#d4e9f6" } },
      title = "#ffffff", shadow = "#2f5f99", subtitle = "#eef6ff",
    },
    dusk = {
      stops = { { 0, "#241c47" }, { 0.3, "#4a2d66" }, { 0.55, "#8a3c6c" }, { 0.78, "#cf6456" }, { 1, "#f3a04c" } },
      title = "#ffeede", shadow = "#241c47", subtitle = "#f7d3bc",
    },
    night = {
      stops = { { 0, "#070a1f" }, { 0.45, "#0f1636" }, { 0.8, "#1a2450" }, { 1, "#28336a" } },
      title = "#eef0ff", shadow = "#05071a", subtitle = "#b9c2ea",
    },
  },
  -- Clouds per phase: lit edge, body, underside (dusk's edge is the rim light).
  clouds = {
    dawn = { "#fff0e4", "#f2c9c6", "#b894b4" },
    day = { "#ffffff", "#e9f2fb", "#b9cfe6" },
    dusk = { "#ffc98a", "#c76a78", "#5e3b6e" },
    night = { "#56628f", "#34406e", "#222b55" },
  },
  stars = { "#8d96c8", "#d8ddff", "#ffffff" },
  moon = { "#b9b39a", "#e9e2c6", "#fffbe8" },
  sun = { "#ffd9a8", "#fff3dc" },
  bird = "#3a3550",
  shooting = "#fff6dc",

  -- The hover glow round each island.
  glow = { snake = "#fff4c2", marrow = "#ffd9b8", unfinished = "#ffe8b0" },

  -- Snake: copied from art/snake-icon.lua (the card icon), plus a rock ramp for the underside.
  snake = {
    outline = "#2a2f26",
    s1 = "#2e5a4c", s2 = "#3f7a4d", s3 = "#5f9c48", s4 = "#8dbf4f", s5 = "#c9df7e",
    spot = "#35664a", belly1 = "#d8c38a", belly2 = "#f2e5b3",
    g1 = "#3d6a3c", g2 = "#55893f", g3 = "#77aa47", g4 = "#a2cc5c",
    d1 = "#4a3324", d2 = "#6e4c30", d3 = "#8f663f",
    a1 = "#9e2f2a", a2 = "#d2493b", a3 = "#ee7a5c", a4 = "#ffd2b8",
    stem = "#5a3b24", leaf = "#c2e27a",
    eye = "#1d2230", white = "#fffaf0", blush = "#f2a09a", tongue = "#d8404f",
    yellow = "#f7d16b", pink = "#f5a8bd", cream = "#fff3dc",
    mcap = "#c9453c", mcap2 = "#e76f58", mstem = "#efe0c0",
    rock = { "#3b2e2a", "#57443a", "#7a6152" },
  },

  -- Marrow: copied from art/marrow/palette.lua (the fighters' glows and outline, and the cathedral world).
  marrow = {
    outline = "#0d0a0f",
    amber = { "#5c300f", "#a8601e", "#e8a33a", "#ffd98a" },
    cyan = { "#0f4744", "#2a8f8a", "#6fd6d0", "#c9fff6" },
    void = "#0c0510",
    shadow = { "#140b20", "#1f1638", "#2e2656", "#443f78" },
    crimson = { "#2f0915", "#4f0e20", "#78172c", "#a2263c" },
    flesh = { "#6d2242", "#9a385d", "#c65a75", "#e48892", "#f6c3b6" },
    magenta = { "#731a5f", "#b02a87", "#ea68ba" },
    bone = { "#6b4d59", "#9d7f87", "#ceb3af", "#f0e1d7" },
  },

  -- The unfinished island: bare stone, a little grass, raw timber, rope and a lantern.
  unfinished = {
    outline = "#2a2f26",
    stone = { "#4a4652", "#6b6674", "#908a98", "#b8b2bd" },
    grass = { "#55893f", "#77aa47" },
    wood = { "#4a3324", "#6e4c30", "#8f663f", "#b58a58" },
    rope = "#c9a46a",
    lantern = { "#3a2a1c", "#ffb347", "#ffd98a", "#fff4d0" }, -- frame, flame dark -> bright
  },

  -- The sign: a wooden board round a parchment panel, hung on rope.
  sign = {
    outline = "#2a2f26",
    wood = { "#5a3b24", "#8f663f", "#b58a58" },
    paper = "#f3e6c4", paperShade = "#e0cfa6",
    rope = { "#c9a46a", "#8f6a3a" },
    name = "#3b2a1c", blurb = "#5e4a38", controls = "#7d6247",
  },
}
```

- [ ] **Step 4: Write the sky script**

`art/site/sky.lua`:
```lua
-- The sky behind the games page. Run from the repo root: aseprite -b --script art/site/sky.lua
-- Writes to site/assets/ (and each picture's .aseprite to art/site/):
--   sky-<phase>-<layout>.png  the dithered sky for a phase (dawn, day, dusk, night) on a stage
--                             (landscape 384x216, portrait 216x384); it tiles sideways
--   clouds.png                three drifting cloud layers (far, mid, near), 384 wide and tiling sideways,
--                             once per phase in that phase's colours: row = phase index * 3 + layer
--   sky.png                   the small sprites: moon, sun, bird (2 frames), twinkling star (3 frames)
--   sky.json                  phase order, each phase's edge and title colours, the cloud rows, sprite rects
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local PHASES = { "dawn", "day", "dusk", "night" } -- site/sky.js uses the same order; sky.json records it
local LAYOUTS = { { "landscape", 384, 216 }, { "portrait", 216, 384 } }
local CLOUD_W, CLOUD_H = 384, 48

-- A vertical gradient through the stops, ordered-dithered between each pair of neighbours so it stays in
-- the palette. Every row is the same all the way across and the dither repeats every 4 px, so the
-- picture tiles sideways (both stage widths divide by 4).
local function gradient(w, h, stops)
  local b = L.buffer(w, h)
  for y = 0, h - 1 do
    local v = y / (h - 1)
    local i = 1
    while i < #stops - 1 and v > stops[i + 1][1] do i = i + 1 end
    local a, c = stops[i], stops[i + 1]
    local t = (v - a[1]) / (c[1] - a[1])
    for x = 0, w - 1 do b[y][x] = (t > L.bayer(x, y)) and c[2] or a[2] end
  end
  return b
end

-- Night only: dim stars, thicker toward the top, a few of them brighter.
local function scatterStars(b)
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      local r = L.rnd(x, y, 7)
      local chance = 0.014 * (1 - y / b.h) ^ 1.5
      if r < chance then b[y][x] = (r < chance * 0.2) and P.stars[2] or P.stars[1] end
    end
  end
end

for _, phase in ipairs(PHASES) do
  for _, stage in ipairs(LAYOUTS) do
    local b = gradient(stage[2], stage[3], P.sky[phase].stops)
    if phase == "night" then scatterStars(b) end
    local name = "sky-" .. phase .. "-" .. stage[1]
    L.save(b, "art/site/" .. name .. ".aseprite", "site/assets/" .. name .. ".png")
  end
end

-- The cloud layers, far to near: far ones small, faint and wispy; near ones bigger and fuller.
local LAYERS = {
  { puffs = 6, rmin = 2, rmax = 5, alpha = "80", seed = 11 },
  { puffs = 4, rmin = 4, rmax = 8, alpha = "c0", seed = 12 },
  { puffs = 3, rmin = 6, rmax = 11, alpha = "e8", seed = 13 },
}

-- One layer's shape, the same in every phase so a crossfade only changes its colours: puffs of
-- overlapping discs on a flat base, x wrapped so the strip tiles. true where there's cloud.
local function cloudShape(layer)
  local m = L.buffer(CLOUD_W, CLOUD_H)
  for i = 0, layer.puffs - 1 do
    local cx = (i + 0.2 + L.rnd(i, 0, layer.seed) * 0.6) * CLOUD_W / layer.puffs
    local base = CLOUD_H - 4 - math.floor(L.rnd(i, 1, layer.seed) * (CLOUD_H / 3))
    local span = layer.rmax * (3 + L.rnd(i, 2, layer.seed) * 3)
    local n = 5 + math.floor(L.rnd(i, 3, layer.seed) * 4)
    for k = 0, n - 1 do
      local u = k / (n - 1)
      local r = layer.rmin + L.rnd(i, 10 + k, layer.seed) * (layer.rmax - layer.rmin)
      r = r * (0.6 + 0.4 * math.sin(u * math.pi)) -- bigger in the middle of the puff
      local x, y = cx + (u - 0.5) * span, base - r * 0.6
      for py = math.floor(y - r), math.min(base, math.ceil(y + r)) do
        for px = math.floor(x - r), math.ceil(x + r) do
          local dx, dy = px + 0.5 - x, py + 0.5 - y
          if dx * dx + dy * dy <= r * r and py >= 0 and py < CLOUD_H then m[py][px % CLOUD_W] = true end
        end
      end
    end
  end
  return m
end

-- Colours a layer's shape in a phase's ramp (lit edge, body, underside): the top pixel of each run of
-- cloud is lit, the lower part of each column shaded, with a dithered edge between body and underside.
local function paintClouds(m, ramp, alpha)
  local b = L.buffer(CLOUD_W, CLOUD_H)
  for x = 0, CLOUD_W - 1 do
    local top, bottom
    for y = 0, CLOUD_H - 1 do if m[y][x] then top = top or y; bottom = y end end
    if top then
      for y = top, bottom do
        if m[y][x] then
          local v = (y - top) / math.max(1, bottom - top)
          local c = ramp[2]
          if y == 0 or not m[y - 1][x] then c = ramp[1]
          elseif v > 0.55 + L.bayer(x, y) * 0.2 then c = ramp[3] end
          b[y][x] = c .. alpha
        end
      end
    end
  end
  return b
end

local shapes = {}
for l, layer in ipairs(LAYERS) do shapes[l] = cloudShape(layer) end
local strip = L.buffer(CLOUD_W, CLOUD_H * #PHASES * #LAYERS)
for p, phase in ipairs(PHASES) do
  for l, layer in ipairs(LAYERS) do
    L.blit(strip, paintClouds(shapes[l], P.clouds[phase], layer.alpha), 0, ((p - 1) * #LAYERS + (l - 1)) * CLOUD_H)
  end
end
L.save(strip, "art/site/clouds.aseprite", "site/assets/clouds.png")

-- The small sprites, packed into one 56x20 sheet.
local atlas = L.buffer(56, 20)
local sprites = {
  moon = { 0, 0, 14, 14 }, sun = { 16, 0, 20, 20 },
  bird = { { 38, 0, 7, 4 }, { 46, 0, 7, 4 } },
  twinkle = { { 38, 6, 5, 5 }, { 44, 6, 5, 5 }, { 50, 6, 5, 5 } },
}
-- The moon: a disc lit from the upper left, with a few soft craters.
for y = 0, 13 do
  for x = 0, 13 do
    local dx, dy = x + 0.5 - 7, y + 0.5 - 7
    if dx * dx + dy * dy <= 42 then
      local c = P.moon[2]
      if dx + dy < -5 then c = P.moon[3] elseif dx + dy > 4 then c = P.moon[1] end
      L.set(atlas, x, y, c)
    end
  end
end
for _, p in ipairs({ { 4, 6 }, { 5, 6 }, { 8, 9 }, { 9, 4 }, { 6, 10 } }) do L.set(atlas, p[1], p[2], P.moon[1]) end
-- The dawn sun: a pale disc in a faint halo.
for y = 0, 19 do
  for x = 16, 35 do
    local dx, dy = x + 0.5 - 26, y + 0.5 - 10
    local d2 = dx * dx + dy * dy
    if d2 <= 49 then L.set(atlas, x, y, (dx + dy < -4) and P.sun[2] or P.sun[1])
    elseif d2 <= 90 then L.set(atlas, x, y, P.sun[2] .. "40") end
  end
end
-- A bird: wings up, then wings down.
local BIRD = {
  { { 0, 0 }, { 6, 0 }, { 1, 1 }, { 5, 1 }, { 2, 2 }, { 4, 2 }, { 3, 3 } },
  { { 3, 1 }, { 2, 2 }, { 4, 2 }, { 1, 3 }, { 5, 3 }, { 0, 3 }, { 6, 3 } },
}
for f, pts in ipairs(BIRD) do
  for _, p in ipairs(pts) do L.set(atlas, sprites.bird[f][1] + p[1], p[2], P.bird) end
end
-- A twinkling star: a dot, a small cross, a bigger cross.
local function star(ox, oy, pts)
  for _, p in ipairs(pts) do L.set(atlas, ox + p[1], oy + p[2], p[3]) end
end
star(38, 6, { { 2, 2, P.stars[2] } })
star(44, 6, { { 2, 2, P.stars[3] }, { 2, 1, P.stars[1] }, { 1, 2, P.stars[1] }, { 3, 2, P.stars[1] }, { 2, 3, P.stars[1] } })
star(50, 6, { { 2, 2, P.stars[3] }, { 2, 1, P.stars[2] }, { 1, 2, P.stars[2] }, { 3, 2, P.stars[2] }, { 2, 3, P.stars[2] },
  { 2, 0, P.stars[1] }, { 0, 2, P.stars[1] }, { 4, 2, P.stars[1] }, { 2, 4, P.stars[1] } })
L.save(atlas, "art/site/sky-sprites.aseprite", "site/assets/sky.png")

local phases = {}
for _, phase in ipairs(PHASES) do
  local s = P.sky[phase]
  phases[phase] = { top = s.stops[1][2], bottom = s.stops[#s.stops][2], title = s.title, shadow = s.shadow, subtitle = s.subtitle }
end
L.writeText("site/assets/sky.json", json.encode({
  order = PHASES, phases = phases, clouds = { w = CLOUD_W, h = CLOUD_H, layers = #LAYERS },
  sprites = sprites, shooting = P.shooting,
}))
print("sky: 8 skies, clouds, sprites and sky.json written")
```

- [ ] **Step 5: Generate it and look**

```bash
cd /Users/nathan/Documents/code/games
git checkout -b islands 2>/dev/null || git checkout islands
/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/sky.lua
ls -la site/assets
```

Expected: `sky: 8 skies, clouds, sprites and sky.json written`, and 11 files in `site/assets/`.

View each `site/assets/sky-*-landscape.png`, and `clouds.png`, with the Read tool. Check against this list:
- **Dawn:** peach and lilac.
- **Day:** soft blue, paler toward the horizon.
- **Dusk:** violet at the top, through rose, to amber at the horizon.
- **Night:** deep indigo with sparse dim stars.
- **Dither:** the bands are clean, with no stray colours.
- **Clouds:** each row's clouds read as clouds, and a layer's shapes are the same in every phase row.

Adjust `palette.lua`, or the cloud numbers in `sky.lua`, until it's right.

- [ ] **Step 6: Check the rebuild is deterministic**

```bash
cd /Users/nathan/Documents/code/games
git add art/site site/assets && git commit -q -m "Games page: the sky art (WIP check)" && \
/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/sky.lua && git status --porcelain art/site site/assets
```

Expected: `git status` prints nothing. If a file differs, find the non-determinism and fix it, for example a `pairs()` loop that decides drawing order.

Then fold the WIP commit into the real one:

```bash
git reset --soft HEAD~1
```

- [ ] **Step 7: Commit**

```bash
git add art/site/.gitignore art/site/lib.lua art/site/palette.lua art/site/sky.lua art/site/*.aseprite site/assets
git commit -m "Games page: site art helpers, palette and the sky in four phases"
```

(End the message with the two trailer lines from the Global Constraints.)

### Task 2: The island sheet writer, and the Snake and Marrow islands

**Files:**
- Create: `art/site/island.lua`, `art/site/island-snake.lua`, `art/site/island-marrow.lua`
- Generated:
  - `site/assets/island-snake.{png,json}` and `site/assets/island-marrow.{png,json}`;
  - `art/site/island-snake.aseprite` and `art/site/island-marrow.aseprite`;
  - the previews `art/site/preview-island-*.gif`, which are ignored.

**Interfaces:**
- Consumes: `L` and `P` from Task 1.
- Produces: `I.write(id, frames, ms, glowColor)`. `frames` is a list of `L.buffer`s, all the same size, and `glowColor` is `"#rrggbb"`. It writes:
  - **`site/assets/island-<id>.png`:** a sheet of `frames × w` by `2 × h`. Row 0 holds the island's frames. Row 1 holds each frame's hover glow: a ring 1 px out at alpha `c0` and 2 px out at alpha `60`.
  - **`site/assets/island-<id>.json`:** `{ "w", "h", "frames", "ms", "hit": [x, y, w, h] }`. `hit` is the opaque bounding box across all frames, in frame pixels. The page puts the island's link there.
  - **`art/site/island-<id>.aseprite`:** one Aseprite frame per animation frame, lasting `ms`.
  - **`art/site/preview-island-<id>.gif`:** the animation at 3×.
- Tasks 6 and 8 read the JSON and the sheet.

- [ ] **Step 1: Write the sheet writer**

`art/site/island.lua`:
```lua
-- Writes an island's animation for the games page. Each island script paints its frames and calls
-- I.write(id, frames, ms, glowColor), which writes:
--   site/assets/island-<id>.png   row 0: the frames side by side; row 1: each frame's hover glow
--   site/assets/island-<id>.json  { w, h, frames, ms, hit = opaque box across all frames [x, y, w, h] }
--   art/site/island-<id>.aseprite the editable animation, one Aseprite frame per frame
--   art/site/preview-island-<id>.gif  the animation at 3x, to look at (not committed)
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local I = {}
I.MARGIN = 3 -- every frame keeps this transparent border, so the glow fits inside it

-- The hover glow round one frame: a soft ring 1 px out (alpha c0) and 2 px out (alpha 60).
local function glow(frame, color)
  local g = L.buffer(frame.w, frame.h)
  for y = 0, frame.h - 1 do
    for x = 0, frame.w - 1 do
      if not frame[y][x] then
        local best = 99
        for dy = -2, 2 do
          for dx = -2, 2 do
            local d2 = dx * dx + dy * dy
            if d2 <= 5 and d2 < best and L.get(frame, x + dx, y + dy) then best = d2 end
          end
        end
        if best <= 2 then g[y][x] = color .. "c0" elseif best <= 5 then g[y][x] = color .. "60" end
      end
    end
  end
  return g
end

-- An RGB sprite with one frame per buffer (scaled k times), each lasting `seconds`.
local function animation(frames, k, seconds)
  local fw, fh = frames[1].w * k, frames[1].h * k
  local spr = Sprite(fw, fh, ColorMode.RGB)
  for _ = 2, #frames do spr:newEmptyFrame() end
  for i, f in ipairs(frames) do
    local s = (k == 1) and f or L.scale(f, k)
    local img = Image(fw, fh, ColorMode.RGB)
    for y = 0, fh - 1 do
      for x = 0, fw - 1 do
        local c = s[y][x]
        if c then img:drawPixel(x, y, L.rgba(c)) end
      end
    end
    spr.frames[i].duration = seconds
    spr:newCel(spr.layers[1], i, img, Point(0, 0))
  end
  return spr
end

function I.write(id, frames, ms, glowColor)
  local w, h, n = frames[1].w, frames[1].h, #frames
  local minX, minY, maxX, maxY = w, h, -1, -1
  local sheet = L.buffer(w * n, h * 2)
  for i, f in ipairs(frames) do
    assert(f.w == w and f.h == h, "island " .. id .. ": frame " .. i .. " is a different size")
    for y = 0, h - 1 do
      for x = 0, w - 1 do
        if f[y][x] then
          assert(x >= I.MARGIN and y >= I.MARGIN and x < w - I.MARGIN and y < h - I.MARGIN,
            "island " .. id .. ": frame " .. i .. " paints inside the " .. I.MARGIN .. " px margin at " .. x .. "," .. y)
          minX, minY = math.min(minX, x), math.min(minY, y)
          maxX, maxY = math.max(maxX, x), math.max(maxY, y)
        end
      end
    end
    L.blit(sheet, f, (i - 1) * w, 0)
    L.blit(sheet, glow(f, glowColor), (i - 1) * w, h)
  end
  local hit = { minX, minY, maxX - minX + 1, maxY - minY + 1 }
  L.save(sheet, nil, "site/assets/island-" .. id .. ".png")
  L.writeText("site/assets/island-" .. id .. ".json", json.encode({ w = w, h = h, frames = n, ms = ms, hit = hit }))
  local src = animation(frames, 1, ms / 1000)
  src:saveAs(L.path("art/site/island-" .. id .. ".aseprite"))
  src:close()
  local gif = animation(frames, 3, ms / 1000)
  gif:saveCopyAs(L.path("art/site/preview-island-" .. id .. ".gif"))
  gif:close()
  print(string.format("island %s: %d frames of %dx%d, %d ms; hit %d,%d %dx%d", id, n, w, h, ms, hit[1], hit[2], hit[3], hit[4]))
end

return I
```

- [ ] **Step 2: Paint the Snake island**

`art/site/island-snake.lua`. It uses the frame size and timing exactly as in this skeleton. The painting inside `paint(f)` is yours to write, following the brief below.

```lua
-- The Snake island for the games page: the card icon's cozy meadow grown into a floating diorama, a
-- snake winding slowly round an apple patch. Run from the repo root:
--   aseprite -b --script art/site/island-snake.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local I = dofile(here .. "island.lua")
local W, H, N, MS = 136, 112, 24, 200
local C = P.snake

-- Frame f of N (0-based): the snake has gone f/N of the way round its loop.
local function paint(f)
  local b = L.buffer(W, H)
  -- ... the brief below ...
  return b
end

local frames = {}
for f = 0, N - 1 do frames[#frames + 1] = paint(f) end
I.write("snake", frames, MS, P.glow.snake)
```

**Brief.** Read `art/snake-icon.lua` first, and borrow its techniques and its look: the ellipse island, the top-left `light()`, the `ramp()` shading, the disc-built tube body with spots and belly, and the head. All coordinates below are frame pixels. Keep 3 px clear at every edge (`island.lua` asserts it).

- **Grass top.** An ellipse centred at (68, 46) with radii 56 × 17.
  - Shading: lit top-left (`g4`), `g3` body, `g2` toward the bottom rim, and sparse deterministic noise specks.
  - A few 1–2 px grass tufts poke above the back rim.
- **The underside.** It hangs from the ellipse's lower rim, a rough inverted cone narrowing to about (66, 92).
  - Earth is layered `d3`, then `d2`, then `d1` going down, with a few embedded stones (`rock` ramp).
  - The left side is a touch lighter. The silhouette is jagged (`L.rnd`), so it reads as torn from the ground.
- **Roots and dangling bits.** 5–7 roots (`stem`, `d1`, 1 px wide) hang from the underside to y 100–106.
  - Two of them end in a tiny clump of earth or a pebble.
  - One is a vine with two `leaf` leaves.
- **The apple patch.** Three apples cluster around (68, 44), drawn like the icon's: an outline, the `a1`–`a4` ramp, a stem and a leaf. Give it a few fallen leaves too.
  - Near the right rim: the icon's mushroom.
  - Scattered over the grass: 4–5 flowers, as in the icon.
- **The snake.**
  - **Path.** It follows a closed loop: an ellipse centred at (68, 46) with radii 28 × 9, round the patch, travelling anticlockwise as seen from above.
  - **Length.** It covers about 70% of the loop, head first. Body radius is 3, tapering to 1 over the last 15% toward the tail tip.
  - **Motion.** In frame `f`, the head sits at loop fraction `f / N`. So frame N would equal frame 0, and the animation is a seamless loop.
  - **Look.** Shade it like the icon: `s1`–`s5` tube shading with the light top-left, and `spot` markings every few pixels along its length. The `belly1`/`belly2` belly shows on the side facing the viewer.
  - **Head.** A slightly larger ellipse on the leading end, with an eye (`white`/`eye`), a `blush` spot and, in every 4th frame, a flicked `tongue`.
- **Depth.** Paint the parts of the snake on the back half of the loop (y < 46) before the apples, and the front half after them, so it passes behind and in front of the patch.
- **Outline.** Use `C.outline` round the whole island silhouette and round the snake, as the icon does (`L.outline` helps).
- **Size.** The opaque width (the printed `hit` width) must be 96–140. Aim for about 116.

Run it: `/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/island-snake.lua`.

Then view `site/assets/island-snake.png` with the Read tool. Iterate until it reads, at 1×, as the icon's meadow grown into a floating island, with the snake clearly circling the apples.

- [ ] **Step 3: Paint the Marrow island**

`art/site/island-marrow.lua`. It uses the same skeleton, with these values, `C = P.marrow`, `I.write("marrow", frames, MS, P.glow.marrow)` and a header comment of its own:

```lua
local W, H, N, MS = 128, 136, 12, 130
```

**Brief.** Look at `art/marrow/preview-tour-cathedral.png` and `art/marrow/worlds/cathedral.lua` for the mood: ribbed, living, bone and meat, lit amber and cyan by the two fighters.

- **The rock shard.** An angular, asymmetric chunk of dark rock (the `shadow` ramp).
  - Its top is fairly flat, at y ≈ 72–78, across x ≈ 10–118.
  - The underside tapers into 2–3 jagged downward spikes, the longest reaching y ≈ 120.
  - Thin crimson and flesh veins (1 px, branching) run through it.
  - Bone-white crust (the `bone` ramp) runs along the top edge and rim: little vertebrae and barnacle-like knobs.
  - It's lit from the top-left.
- **The cathedral.** A tiny ribbed nave on top, centred at x ≈ 64 and standing on y ≈ 76, about 52 wide with its top at y ≈ 24.
  - 5–6 curved `bone` ribs rise from both sides and meet under a spine, a row of vertebrae along the ridge.
  - A pointed-arch doorway at the front, 2–3 lancet windows between the ribs, and a small bone spire at the front end reaching y ≈ 12.
  - The inside is dark (`void`, `shadow`).
- **The duel inside.** A faint light flickers in the doorway and windows: amber on the left side (`amber`) and cyan on the right (`cyan`), mostly in each ramp's two dimmest steps. In frames 3 and 8 it flashes brighter, as the blades clash.
- **Drips.** Three drip points sit under the spikes. At each, a drop of ichor (`magenta` and `crimson`):
  - swells as a 1–2 px bead (6 frames);
  - falls as a 1×2 streak, 3–4 px per frame, for 5 frames;
  - is gone for 1 frame.

  Each drip is offset by 4 frames from the last. Drops never go below y 132.
- **Dangling bits.** 3–4 sinewy strands (`flesh`, `crimson`) hang from the underside.
- **Outline.** `C.outline` round the whole silhouette.
- **Size.** The opaque width must be 96–140. Aim for about 108.

Run it and view `site/assets/island-marrow.png`. Iterate until it reads, at 1×, as a shard of Marrow's world with a lit cathedral on it, clearly a different style from the Snake island but at home in the same sky.

- [ ] **Step 4: Check the rebuild is deterministic**

```bash
cd /Users/nathan/Documents/code/games
A=/Applications/Aseprite.app/Contents/MacOS/aseprite
$A -b --script art/site/island-snake.lua && $A -b --script art/site/island-marrow.lua
git add art/site site/assets && git commit -q -m "wip" && \
$A -b --script art/site/island-snake.lua && $A -b --script art/site/island-marrow.lua && git status --porcelain art/site site/assets
git reset --soft HEAD~1
```

Expected: the status line prints nothing.

- [ ] **Step 5: Commit**

```bash
git add art/site/island.lua art/site/island-snake.lua art/site/island-marrow.lua art/site/island-*.aseprite site/assets/island-*
git commit -m "Games page: the Snake and Marrow islands"
```

### Task 3: The unfinished island, the sign, and the style-test checkpoint

**Files:**
- Create: `art/site/island-unfinished.lua`, `art/site/sign.lua`, `art/site/style-test.lua`
- Generated:
  - `site/assets/island-unfinished.{png,json}`, `site/assets/sign.{png,json}`;
  - their `.aseprite` files;
  - the preview `art/site/preview-style.png`, which is ignored.

**Interfaces:**
- Consumes: `L`, `P` and `I` from Tasks 1–2, `sky.json`, and the island sheets.
- Produces: `sign.json`, which Tasks 7 and 8 read:

  ```json
  { "size": [16, 16], "slice": 5, "rope": [16, 0, 1, 4], "fill": "#rrggbb", "text": { "name": "#rrggbb", "blurb": "#rrggbb", "controls": "#rrggbb" } }
  ```

  - The board is the 16×16 rectangle at (0, 0) of `sign.png`, a 9-slice with 5 px corners.
  - Its edge segments (6 px) tile. Its middle is plain `fill`.
  - The rope is a 1×4 tile at (16, 0).

- [ ] **Step 1: Paint the unfinished island**

`art/site/island-unfinished.lua`. It uses the Task 2 skeleton with these values, `C = P.unfinished`, and `I.write("unfinished", frames, MS, P.glow.unfinished)`:

```lua
local W, H, N, MS = 80, 84, 6, 180
```

**Brief.**
- **Rock.** A small bare stone lump (`stone` ramp, lit top-left). Its top is at y ≈ 44–50, across x ≈ 12–68.
  - A thin patch of `grass` sits on top.
  - The underside tapers to y ≈ 70, with 3 dangling roots down to y ≈ 78.
- **Scaffolding** (`wood` ramp, outlined):
  - two posts at x ≈ 24 and 52, rising from the top to y ≈ 16;
  - a crossbeam at y ≈ 18, and a diagonal brace;
  - a plank platform at y ≈ 34, tied on with `rope` lashings;
  - a small ladder leaning on the left post.
- **Lantern.** It hangs from the crossbeam's right end, at about (58, 22–30): a dark frame (`lantern[1]`) around a flame.
  - Across the 6 frames, the flame's brightness steps irregularly through `lantern[2..4]`, for example 3, 2, 3, 3, 1, 2.
  - A 1–2 px halo of translucent warm pixels grows and shrinks with it.
- **Optional:** a bucket or a hammer on the planks.
- **Outline.** `C.outline`.
- **Size.** The opaque width must be 48–80. Aim for about 60.

- [ ] **Step 2: Write the sign**

`art/site/sign.lua`:
```lua
-- The sign that hangs under the active island on the games page: a small wooden board round a parchment
-- panel, drawn once as a 9-slice the page stretches to fit the words, and a rope tile.
-- Run from the repo root: aseprite -b --script art/site/sign.lua
-- Writes site/assets/sign.png, site/assets/sign.json and art/site/sign.aseprite.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local S = P.sign
local B, SLICE = 16, 5 -- a 16x16 board; its outer 5 px are fixed corners and tiled edges (6 px repeats)

local b = L.buffer(B + 1, B)
for y = 0, B - 1 do
  for x = 0, B - 1 do
    local edge = math.min(x, y, B - 1 - x, B - 1 - y) -- 0 on the outside, counting in
    local topLeft = (y == edge) or (x == edge)
    local c
    if edge == 0 then c = S.outline
    elseif edge == 1 then c = topLeft and S.wood[3] or S.wood[1]
    elseif edge <= 3 then
      -- the frame's wood, with a grain notch every 3 px along its length (so the 6 px edges tile)
      local along = (y == edge or B - 1 - y == edge) and x or y
      c = (edge == 2 and along % 3 == 0) and S.wood[1] or S.wood[2]
    elseif edge == 4 then c = S.paperShade
    else c = S.paper end
    b[y][x] = c
  end
end
-- round the outer corners
for _, p in ipairs({ { 0, 0 }, { B - 1, 0 }, { 0, B - 1 }, { B - 1, B - 1 } }) do b[p[2]][p[1]] = nil end
-- the rope: a 1 px twist, light and dark in pairs
for y = 0, 3 do b[y][B] = (y < 2) and S.rope[1] or S.rope[2] end

L.save(b, "art/site/sign.aseprite", "site/assets/sign.png")
L.writeText("site/assets/sign.json", json.encode({
  size = { B, B }, slice = SLICE, rope = { B, 0, 1, 4 }, fill = S.paper,
  text = { name = S.name, blurb = S.blurb, controls = S.controls },
}))
print("sign written")
```

Run it, and view `site/assets/sign.png` scaled up: `aseprite -b` can't scale, so read the file with the Read tool.

The board should read as wood round parchment, and the edges must tile. Checking the second criterion: the 6 px middle of each edge repeats seamlessly.

- [ ] **Step 3: Write the style test**

`art/site/style-test.lua`:
```lua
-- The style test for the games page: the landscape stage in all four phases (dawn, day, dusk, night),
-- with the islands at rest and the Snake island's hover glow on the day panel, scaled 2x into
-- art/site/preview-style.png (not committed). Run after sky.lua and the island scripts:
--   aseprite -b --script art/site/style-test.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local W, H = 384, 216
local PHASES = { "dawn", "day", "dusk", "night" }
-- These match STAGES.landscape in site/layout.js and the landscape spots in site/games.json.
local MOON, SUN, CLOUD_Y = { 336, 14 }, { 292, 160 }, { 8, 60, 150 }
local ISLANDS = { { "unfinished", 300, 118 }, { "snake", 14, 72 }, { "marrow", 180, 20 } }

local sky = L.readJson("site/assets/sky.json")
local clouds = L.load("site/assets/clouds.png")
local atlas = L.load("site/assets/sky.png")
local sheets = {}
for _, isl in ipairs(ISLANDS) do
  sheets[isl[1]] = { meta = L.readJson("site/assets/island-" .. isl[1] .. ".json"), image = L.load("site/assets/island-" .. isl[1] .. ".png") }
end

local out = L.buffer(W * 2, H * 2)
for i, phase in ipairs(PHASES) do
  local panel = L.load("site/assets/sky-" .. phase .. "-landscape.png")
  if phase == "night" then L.blit(panel, L.crop(atlas, table.unpack(sky.sprites.moon)), MOON[1], MOON[2]) end
  if phase == "dawn" then L.blit(panel, L.crop(atlas, table.unpack(sky.sprites.sun)), SUN[1], SUN[2]) end
  for layer = 0, sky.clouds.layers - 1 do
    local row = ((i - 1) * sky.clouds.layers + layer) * sky.clouds.h
    L.blit(panel, L.crop(clouds, 0, row, sky.clouds.w, sky.clouds.h), 0, CLOUD_Y[layer + 1])
  end
  for _, isl in ipairs(ISLANDS) do
    local s = sheets[isl[1]]
    if phase == "day" and isl[1] == "snake" then L.blit(panel, L.crop(s.image, 0, s.meta.h, s.meta.w, s.meta.h), isl[2], isl[3]) end
    L.blit(panel, L.crop(s.image, 0, 0, s.meta.w, s.meta.h), isl[2], isl[3])
  end
  L.blit(out, panel, ((i - 1) % 2) * W, ((i - 1) // 2) * H)
end
L.save(L.scale(out, 2), nil, "art/site/preview-style.png")
print("style test written: art/site/preview-style.png")
```

- [ ] **Step 4: Generate and look**

```bash
cd /Users/nathan/Documents/code/games
A=/Applications/Aseprite.app/Contents/MacOS/aseprite
for s in sky island-snake island-marrow island-unfinished sign; do $A -b --script art/site/$s.lua; done
$A -b --script art/site/style-test.lua
```

View `art/site/preview-style.png` with the Read tool. It should match the spec's look:
- **Sky:** each sky is soft and neutral, and frames the islands without competing with them.
- **Clashing styles:** the Snake island is cozy, green and warm; the Marrow island is dark, bone and flesh with amber and cyan light. They clash on purpose, yet both sit in the same sky.
- **Night:** the islands still read against the night sky. If Marrow disappears into it, lift its rim and crust a step.
- **Title space:** the title area (top-left, about x 14–186, y 12–42) is clear sky.
- **Glow:** the glow on the day panel's Snake island reads as "this one is selected".

Iterate on `palette.lua` and the island scripts until it does. Then re-run the determinism check from Task 2 Step 4, this time for all five scripts.

- [ ] **Step 5: Commit**

```bash
git add art/site site/assets
git commit -m "Games page: the unfinished island, the sign, and the style test"
```

- [ ] **Step 6: CHECKPOINT — show Nathan the look (controller)**

The controller sends Nathan `art/site/preview-style.png` and the island GIFs, and asks whether the look is right: the skies, the three islands, and their animations.

Nathan asked for the build to keep going without waiting ("keep going until this is done"), so work continues with Task 4 while he looks. Tasks 4–8 don't depend on the look.

Any change he asks for is made in the art scripts and `palette.lua`, regenerated, checked for determinism, and committed before Task 10's final pass.

---

## Phase 2 — The logic (pure modules, tested in Node)

### Task 4: The sky follows the clock

**Files:**
- Create: `site/package.json`, `site/sky.js`, `site/test/helpers.js`, `site/test/sky.test.js`, `site/test/assets.test.js`

**Interfaces:**
- Consumes: `site/assets/sky.json` and the sky PNGs from Task 1.
- Produces, from `sky.js`:
  - `PHASES` (`['dawn','day','dusk','night']`) and `STARTS`;
  - `skyAt(hours) → { from, to, t }`, where you draw `from`, then `to` over it at opacity `t`. Away from a boundary, `from === to` and `t` is 0;
  - `phaseAt(hours)`;
  - `skyFor(search, date)`;
  - `weights(sky) → { dawn, day, dusk, night }`, which sums to 1;
  - `dominant(sky)`.
- Produces, from `test/helpers.js`:
  - `SITE`, a URL of `site/`;
  - `siteFile(rel) → URL`;
  - `readJson(rel)`;
  - `pngSize(rel) → [w, h]`.

- [ ] **Step 1: Set up the package and the test helpers**

`site/package.json`:
```json
{
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.js"
  }
}
```

`site/test/helpers.js`:
```js
// Test helpers: files in site/, read without any dependencies.
import { readFileSync } from 'node:fs';

export const SITE = new URL('../', import.meta.url);
export const siteFile = (rel) => new URL(rel, SITE);
export const readJson = (rel) => JSON.parse(readFileSync(siteFile(rel), 'utf8'));

// A PNG's width and height, from its IHDR chunk.
export function pngSize(rel) {
  const b = readFileSync(siteFile(rel));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
```

- [ ] **Step 2: Write the failing tests**

`site/test/sky.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, skyAt, phaseAt, skyFor, weights, dominant } from '../sky.js';

test('away from a boundary the sky is one phase', () => {
  assert.deepEqual(skyAt(12), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyAt(6.5), { from: 'dawn', to: 'dawn', t: 0 });
  assert.deepEqual(skyAt(18.5), { from: 'dusk', to: 'dusk', t: 0 });
  assert.deepEqual(skyAt(23), { from: 'night', to: 'night', t: 0 });
  assert.deepEqual(skyAt(2), { from: 'night', to: 'night', t: 0 });
});

test('each boundary crossfades over the half hour centred on it', () => {
  assert.deepEqual(skyAt(4.75), { from: 'night', to: 'dawn', t: 0 });
  assert.deepEqual(skyAt(5), { from: 'night', to: 'dawn', t: 0.5 });
  assert.deepEqual(skyAt(5.25), { from: 'dawn', to: 'dawn', t: 0 });
  assert.deepEqual(skyAt(8), { from: 'dawn', to: 'day', t: 0.5 });
  assert.deepEqual(skyAt(17), { from: 'day', to: 'dusk', t: 0.5 });
  assert.deepEqual(skyAt(19.875), { from: 'dusk', to: 'night', t: 0.25 });
});

test('the clock wraps round midnight', () => {
  assert.deepEqual(skyAt(0), { from: 'night', to: 'night', t: 0 });
  assert.deepEqual(skyAt(24), skyAt(0));
  assert.deepEqual(skyAt(-1), skyAt(23));
  assert.equal(phaseAt(23.99), 'night');
  assert.equal(phaseAt(4.99), 'night');
  assert.equal(phaseAt(5), 'dawn');
});

test('through a whole day the crossfade only ever moves on to the next phase', () => {
  for (let m = 0; m < 24 * 60; m++) {
    const { from, to, t } = skyAt(m / 60);
    assert.ok(t >= 0 && t < 1, `t at minute ${m}`);
    if (from === to) assert.equal(t, 0);
    else assert.equal(PHASES[(PHASES.indexOf(from) + 1) % PHASES.length], to);
  }
});

test('?time= pins the sky to a phase; anything else follows the clock', () => {
  const noon = new Date(2026, 8, 23, 12, 0, 0);
  const eight = new Date(2026, 8, 23, 20, 0, 0);
  assert.deepEqual(skyFor('?time=dusk', noon), { from: 'dusk', to: 'dusk', t: 0 });
  assert.deepEqual(skyFor('?time=night&x=1', noon), { from: 'night', to: 'night', t: 0 });
  assert.deepEqual(skyFor('', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('?time=noon', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('?time=DUSK', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('?time=', noon), { from: 'day', to: 'day', t: 0 });
  assert.deepEqual(skyFor('', eight), { from: 'dusk', to: 'night', t: 0.5 });
});

test('weights say how much of each phase shows; dominant picks the bigger', () => {
  assert.deepEqual(weights({ from: 'day', to: 'day', t: 0 }), { dawn: 0, day: 1, dusk: 0, night: 0 });
  assert.deepEqual(weights({ from: 'night', to: 'dawn', t: 0.25 }), { dawn: 0.25, day: 0, dusk: 0, night: 0.75 });
  assert.equal(dominant({ from: 'night', to: 'dawn', t: 0.25 }), 'night');
  assert.equal(dominant({ from: 'night', to: 'dawn', t: 0.5 }), 'dawn');
});
```

`site/test/assets.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PHASES } from '../sky.js';
import { readJson, pngSize, siteFile } from './helpers.js';

const HEX = /^#[0-9a-f]{6}$/;
const rect = (r) => Array.isArray(r) && r.length === 4 && r.every(Number.isInteger);

test('sky.json lists the phases in sky.js order, with every colour and sprite', () => {
  const sky = readJson('assets/sky.json');
  assert.deepEqual(sky.order, PHASES);
  for (const p of PHASES) {
    for (const k of ['top', 'bottom', 'title', 'shadow', 'subtitle']) assert.match(sky.phases[p][k], HEX, `${p}.${k}`);
  }
  assert.match(sky.shooting, HEX);
  assert.deepEqual(sky.clouds, { w: 384, h: 48, layers: 3 });
  assert.ok(rect(sky.sprites.moon) && rect(sky.sprites.sun));
  assert.equal(sky.sprites.bird.length, 2);
  assert.ok(sky.sprites.bird.every(rect));
  assert.equal(sky.sprites.twinkle.length, 3);
  assert.ok(sky.sprites.twinkle.every(rect));
});

test('each phase has a sky for each stage, and the clouds a row per phase and layer', () => {
  for (const p of PHASES) {
    assert.deepEqual(pngSize(`assets/sky-${p}-landscape.png`), [384, 216], p);
    assert.deepEqual(pngSize(`assets/sky-${p}-portrait.png`), [216, 384], p);
  }
  assert.deepEqual(pngSize('assets/clouds.png'), [384, 48 * 3 * PHASES.length]);
  assert.ok(existsSync(siteFile('assets/sky.png')));
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: FAIL. The cause is `Cannot find module '.../site/sky.js'`.

- [ ] **Step 4: Write `sky.js`**

`site/sky.js`:
```js
// The sky follows the visitor's local time: four phases, with a half-hour crossfade centred on each
// boundary. Pure: the time is passed in.
export const PHASES = ['dawn', 'day', 'dusk', 'night'];
// The local hour each phase starts (the previous one ends there).
export const STARTS = { dawn: 5, day: 8, dusk: 17, night: 20 };
const FADE_HOURS = 0.5;

const wrapHours = (hours) => ((hours % 24) + 24) % 24;

export function phaseAt(hours) {
  const h = wrapHours(hours);
  if (h >= STARTS.night || h < STARTS.dawn) return 'night';
  if (h >= STARTS.dusk) return 'dusk';
  if (h >= STARTS.day) return 'day';
  return 'dawn';
}

// hours: local time in fractional hours. Returns { from, to, t }: draw `from`, then `to` over it at
// opacity t. Away from a boundary, from === to and t is 0.
export function skyAt(hours) {
  const h = wrapHours(hours);
  for (let i = 0; i < PHASES.length; i++) {
    const to = PHASES[i];
    const start = STARTS[to] - FADE_HOURS / 2;
    if (h >= start && h < start + FADE_HOURS) {
      return { from: PHASES[(i + PHASES.length - 1) % PHASES.length], to, t: (h - start) / FADE_HOURS };
    }
  }
  const phase = phaseAt(h);
  return { from: phase, to: phase, t: 0 };
}

// The sky for a page: `?time=dawn|day|dusk|night` in `search` pins one phase (anything else is
// ignored); otherwise it follows `date`'s local time.
export function skyFor(search, date) {
  const pinned = new URLSearchParams(search).get('time');
  if (PHASES.includes(pinned)) return { from: pinned, to: pinned, t: 0 };
  return skyAt(date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600);
}

// How much of each phase is showing; they sum to 1.
export function weights({ from, to, t }) {
  const w = Object.fromEntries(PHASES.map((p) => [p, 0]));
  w[from] += 1 - t;
  w[to] += t;
  return w;
}

// The phase that shows more, for things that don't crossfade (the title's colours).
export function dominant({ from, to, t }) {
  return t < 0.5 ? from : to;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add site/package.json site/sky.js site/test/helpers.js site/test/sky.test.js site/test/assets.test.js
git commit -m "Games page: the sky follows the local time, with ?time= to pin it"
```

### Task 5: Stages, scaling and motion

**Files:**
- Create: `site/layout.js`, `site/motion.js`, `site/test/layout.test.js`, `site/test/motion.test.js`

**Interfaces:**
- Produces, from `layout.js`:
  - `STAGES`: `{ landscape, portrait }`, each `{ w, h, title: [x,y,w,h], moon: [x,y], sun: [x,y], clouds: [yFar, yMid, yNear] }` in stage pixels;
  - `chooseView(cssW, cssH, dpr) → { layout, stage, scale, dpr, cw, ch, ox, oy }`:
    - `scale` is device pixels per scene pixel;
    - `cw` and `ch` are the canvas size in scene pixels;
    - `ox` and `oy` are the stage's top-left on the canvas;
  - `toCss([x,y,w,h], view) → { left, top, width, height }`.
- Produces, from `motion.js`:
  - the constants `BOB_AMP` (2), `LIFT` (3), `LIFT_STEP_MS` (40), `CLOUD_SPEEDS` (`[2, 4, 7]` px/s), `BIRD_EVERY`, `BIRD_MS`, `STAR_EVERY`, `STAR_MS` and `STAR_SPEED`;
  - `bob(tMs, period, phase)`;
  - `liftAt(active, from, since, tMs)`;
  - `frameAt(tMs, frames, ms)`;
  - `drift(tMs, speed, width)`;
  - `hash(n, seed)`;
  - `twinkles(cw, ch, count?) → [{ x, y, period, phase }]` and `twinkleFrame(tMs, star) → 0|1|2`;
  - `birdAt(tMs, cw, ch) → { x, y, dir, frame } | null`;
  - `shootingStarAt(tMs, cw, ch) → { x, y, age } | null`.

- [ ] **Step 1: Write the failing tests**

`site/test/layout.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, chooseView, toCss } from '../layout.js';

const pick = (v) => ({ layout: v.layout, scale: v.scale, cw: v.cw, ch: v.ch, ox: v.ox, oy: v.oy });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('a 1080p window shows the landscape stage at exactly 5x', () => {
  assert.deepEqual(pick(chooseView(1920, 1080, 1)), { layout: 'landscape', scale: 5, cw: 384, ch: 216, ox: 0, oy: 0 });
});

test('a taller window gets more sky above and below the stage', () => {
  assert.deepEqual(pick(chooseView(1920, 1200, 1)), { layout: 'landscape', scale: 5, cw: 384, ch: 240, ox: 0, oy: 12 });
});

test('a phone held upright gets the portrait stage, scaled in device pixels', () => {
  assert.deepEqual(pick(chooseView(390, 844, 3)), { layout: 'portrait', scale: 5, cw: 234, ch: 507, ox: 9, oy: 61 });
});

test('turning the phone sideways switches to the landscape stage', () => {
  assert.deepEqual(pick(chooseView(844, 390, 3)), { layout: 'landscape', scale: 5, cw: 507, ch: 234, ox: 61, oy: 9 });
});

test("when both stages fit equally well, the window's shape decides", () => {
  assert.equal(chooseView(1000, 1000, 1).layout, 'landscape');
  assert.equal(chooseView(999, 1000, 1).layout, 'portrait');
  assert.equal(chooseView(768, 1024, 1).layout, 'portrait');
});

test('a zoomed page (devicePixelRatio 1.25) still scales by whole device pixels', () => {
  assert.deepEqual(pick(chooseView(1366, 768, 1.25)), { layout: 'landscape', scale: 4, cw: 427, ch: 240, ox: 21, oy: 12 });
});

test('a window too small for the stage shows it at 1x, centred and cropped', () => {
  assert.deepEqual(pick(chooseView(200, 100, 1)), { layout: 'landscape', scale: 1, cw: 200, ch: 100, ox: -92, oy: -58 });
});

test('the canvas always covers the window, by less than one scene pixel too many', () => {
  const sizes = [[1920, 1080], [1366, 768], [1280, 720], [2560, 1080], [390, 844], [844, 390], [768, 1024], [3440, 1440]];
  for (const [w, h] of sizes) {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      const v = chooseView(w, h, dpr);
      const devW = Math.round(w * dpr), devH = Math.round(h * dpr);
      assert.ok(v.cw * v.scale >= devW && (v.cw - 1) * v.scale < devW, `${w}x${h}@${dpr} width`);
      assert.ok(v.ch * v.scale >= devH && (v.ch - 1) * v.scale < devH, `${w}x${h}@${dpr} height`);
      assert.equal(v.stage, STAGES[v.layout]);
      assert.ok(Number.isInteger(v.scale) && v.scale >= 1);
    }
  }
});

test('toCss maps a stage rectangle to CSS pixels on the page', () => {
  assert.deepEqual(toCss([10, 20, 30, 40], chooseView(1920, 1080, 2)), { left: 50, top: 100, width: 150, height: 200 });
  const phone = toCss([0, 0, 216, 384], chooseView(390, 844, 3));
  near(phone.left, 15);
  near(phone.top, 305 / 3);
  near(phone.width, 360);
  near(phone.height, 640);
});
```

`site/test/motion.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOB_AMP, LIFT, LIFT_STEP_MS, bob, liftAt, frameAt, drift, hash, twinkles, twinkleFrame,
  birdAt, BIRD_EVERY, BIRD_MS, shootingStarAt, STAR_EVERY, STAR_MS, STAR_SPEED,
} from '../motion.js';

test('islands bob in whole pixels, never more than BOB_AMP either way', () => {
  for (let t = 0; t < 10000; t += 7) {
    const y = bob(t, 4200, 0.3);
    assert.ok(Number.isInteger(y) && Math.abs(y) <= BOB_AMP, `bob(${t}) = ${y}`);
  }
  assert.equal(bob(0, 4000, 0), 0);
  assert.equal(bob(1000, 4000, 0), BOB_AMP);
  assert.equal(bob(3000, 4000, 0), -BOB_AMP);
  assert.equal(bob(0, 4000, 0.25), BOB_AMP);
  assert.equal(bob(4000, 4000, 0), 0); // a whole period later: 0, never -0
});

test('an active island rises a pixel every LIFT_STEP_MS up to LIFT, and sinks back the same way', () => {
  assert.equal(liftAt(true, 0, 1000, 1000), 0);
  assert.equal(liftAt(true, 0, 1000, 1000 + LIFT_STEP_MS - 1), 0);
  assert.equal(liftAt(true, 0, 1000, 1000 + LIFT_STEP_MS), 1);
  assert.equal(liftAt(true, 0, 1000, 1000 + 10 * LIFT_STEP_MS), LIFT);
  assert.equal(liftAt(true, 2, 1000, 1000 + LIFT_STEP_MS), 3);
  assert.equal(liftAt(false, LIFT, 1000, 1000 + 2 * LIFT_STEP_MS), LIFT - 2);
  assert.equal(liftAt(false, LIFT, 1000, 1000 + 10 * LIFT_STEP_MS), 0);
  assert.equal(liftAt(true, 0, 1000, 900), 0); // a clock that seems to go backwards changes nothing
});

test('animation frames loop', () => {
  assert.equal(frameAt(0, 8, 150), 0);
  assert.equal(frameAt(149, 8, 150), 0);
  assert.equal(frameAt(150, 8, 150), 1);
  assert.equal(frameAt(8 * 150 - 1, 8, 150), 7);
  assert.equal(frameAt(8 * 150, 8, 150), 0);
});

test('clouds drift in whole pixels and wrap at their strip width', () => {
  assert.equal(drift(0, 4, 384), 0);
  assert.equal(drift(999, 4, 384), 3);
  assert.equal(drift(1000, 4, 384), 4);
  assert.equal(drift(100000, 4, 384), 400 % 384);
});

test('hash is deterministic, in [0, 1), and spreads out', () => {
  let sum = 0;
  for (let i = 0; i < 2000; i++) {
    const h = hash(i, 3);
    assert.ok(h >= 0 && h < 1);
    assert.equal(h, hash(i, 3));
    sum += h;
  }
  assert.ok(Math.abs(sum / 2000 - 0.5) < 0.05);
  assert.notEqual(hash(1, 1), hash(1, 2));
  assert.notEqual(hash(1, 1), hash(2, 1));
});

test('twinkling stars sit in the upper sky, the same ones every frame', () => {
  const stars = twinkles(384, 216);
  assert.deepEqual(stars, twinkles(384, 216));
  for (const s of stars) {
    assert.ok(Number.isInteger(s.x) && s.x >= 0 && s.x < 384);
    assert.ok(Number.isInteger(s.y) && s.y >= 0 && s.y < 216 * 0.6);
    for (let t = 0; t < 5000; t += 97) assert.ok([0, 1, 2].includes(twinkleFrame(t, s)));
  }
});

test('a bird crosses the day sky now and then, in whole pixels, the way it faces', () => {
  assert.equal(birdAt(BIRD_MS, 384, 216), null);
  assert.equal(birdAt(BIRD_EVERY - 1, 384, 216), null);
  const a = birdAt(BIRD_EVERY + 1000, 384, 216);
  const b = birdAt(BIRD_EVERY + 5000, 384, 216);
  assert.ok(a && b);
  for (const p of [a, b]) assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y) && p.y >= 0 && p.y < 216 / 2);
  assert.ok((b.x - a.x) * a.dir > 0);
});

test('shooting stars are rare and brief, and fall down and to the left', () => {
  let cycle = 0;
  while (!shootingStarAt(cycle * STAR_EVERY, 384, 216)) cycle++;
  assert.ok(cycle < 10, 'one turns up within ten cycles');
  const start = shootingStarAt(cycle * STAR_EVERY, 384, 216);
  const later = shootingStarAt(cycle * STAR_EVERY + 300, 384, 216);
  const d = Math.floor(300 * STAR_SPEED);
  assert.deepEqual([later.x, later.y], [start.x - d, start.y + d]);
  assert.equal(shootingStarAt(cycle * STAR_EVERY + STAR_MS, 384, 216), null);
  const seen = Array.from({ length: 50 }, (_, i) => shootingStarAt(i * STAR_EVERY, 384, 216)).filter(Boolean).length;
  assert.ok(seen > 5 && seen < 50, `${seen} of 50 cycles have one`);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: FAIL. The cause is `Cannot find module '.../site/layout.js'` (and `motion.js`).

- [ ] **Step 3: Write `layout.js`**

`site/layout.js`:
```js
// The scene's two stages, in scene pixels, and where the fixed things sit on each. The canvas covers
// the whole window: the stage is centred in it and the sky carries on round it.
export const STAGES = {
  landscape: { w: 384, h: 216, title: [14, 12, 172, 30], moon: [336, 14], sun: [292, 160], clouds: [8, 60, 150] },
  portrait: { w: 216, h: 384, title: [12, 14, 172, 30], moon: [188, 18], sun: [160, 330], clouds: [40, 170, 320] },
};

// The view for a window of cssW x cssH CSS pixels at devicePixelRatio dpr. It picks the stage that can
// be drawn bigger, by the largest whole number of device pixels per scene pixel (at least 1); on a tie,
// the one that matches the window's shape. The canvas (cw x ch scene pixels) covers the window, and
// the stage's top-left sits at (ox, oy) on it.
export function chooseView(cssW, cssH, dpr = 1) {
  const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
  const fit = (s) => Math.max(1, Math.floor(Math.min(devW / s.w, devH / s.h)));
  const l = fit(STAGES.landscape), p = fit(STAGES.portrait);
  const layout = l > p || (l === p && cssW >= cssH) ? 'landscape' : 'portrait';
  const stage = STAGES[layout];
  const scale = layout === 'landscape' ? l : p;
  const cw = Math.ceil(devW / scale), ch = Math.ceil(devH / scale);
  return { layout, stage, scale, dpr, cw, ch, ox: Math.floor((cw - stage.w) / 2), oy: Math.floor((ch - stage.h) / 2) };
}

// A rectangle in stage pixels -> CSS pixels on the page.
export function toCss([x, y, w, h], view) {
  const k = view.scale / view.dpr;
  return { left: (x + view.ox) * k, top: (y + view.oy) * k, width: w * k, height: h * k };
}
```

- [ ] **Step 4: Write `motion.js`**

`site/motion.js`:
```js
// Everything in the scene that moves, as pure functions of time in milliseconds, so it's testable and
// never depends on the frame rate. Every position is a whole number of scene pixels.
export const BOB_AMP = 2; // islands bob this many pixels up and down
export const LIFT = 3; // an active island rises this many pixels...
export const LIFT_STEP_MS = 40; // ...one pixel every this many ms
export const CLOUD_SPEEDS = [2, 4, 7]; // px per second: far, mid, near
export const BIRD_EVERY = 45000, BIRD_MS = 16000; // a bird every 45 s, taking 16 s to cross
export const STAR_EVERY = 23000, STAR_MS = 600, STAR_SPEED = 0.15; // shooting stars: px per ms

export function bob(tMs, period, phase) {
  const px = Math.round(BOB_AMP * Math.sin(2 * Math.PI * (tMs / period + phase)));
  return px === 0 ? 0 : px; // never -0
}

// An active island's lift, rising one pixel per LIFT_STEP_MS up to LIFT from the moment it became
// active, and sinking back the same way. from: its lift at that moment; since: that moment (ms).
export function liftAt(active, from, since, tMs) {
  const steps = Math.max(0, Math.floor((tMs - since) / LIFT_STEP_MS));
  return active ? Math.min(LIFT, from + steps) : Math.max(0, from - steps);
}

// The animation frame showing at tMs, for `frames` frames of `ms` each.
export function frameAt(tMs, frames, ms) {
  return Math.floor(tMs / ms) % frames;
}

// How far a cloud layer drifting `speed` px/s has moved, wrapped to its strip's width.
export function drift(tMs, speed, width) {
  return Math.floor((tMs * speed) / 1000) % width;
}

// Deterministic noise in [0, 1) for whole numbers n and seed.
export function hash(n, seed = 0) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// The night's brighter stars, which twinkle: scattered over the upper 60% of the canvas.
export function twinkles(cw, ch, count = 14) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.floor(hash(i, 6) * cw),
    y: Math.floor(hash(i, 7) * ch * 0.6),
    period: 1600 + Math.floor(hash(i, 8) * 2400),
    phase: hash(i, 9),
  }));
}

// Which of the three twinkle sprites a star shows: dot, small cross, big cross, small cross, ...
export function twinkleFrame(tMs, star) {
  return [0, 1, 2, 1][Math.floor(((tMs / star.period + star.phase) % 1) * 4)];
}

// The odd bird crossing the day sky: one every BIRD_EVERY ms, taking BIRD_MS to cross the canvas,
// flying left or right at a height of its own, wings flapping.
export function birdAt(tMs, cw, ch) {
  const i = Math.floor(tMs / BIRD_EVERY);
  const k = (tMs - i * BIRD_EVERY) / BIRD_MS;
  if (k >= 1) return null;
  const dir = hash(i, 1) < 0.5 ? 1 : -1;
  const across = Math.floor(k * (cw + 16));
  const x = dir > 0 ? across - 8 : cw + 8 - across;
  const y = Math.floor(ch * (0.12 + 0.25 * hash(i, 2)) + 2 * Math.sin(k * 20));
  return { x, y, dir, frame: Math.floor(tMs / 200) % 2 };
}

// A shooting star: at most one every STAR_EVERY ms (about 60% of those have one), lasting STAR_MS,
// falling down and to the left. x, y is its head; age runs 0 -> 1 as it fades.
export function shootingStarAt(tMs, cw, ch) {
  const i = Math.floor(tMs / STAR_EVERY);
  const age = tMs - i * STAR_EVERY;
  if (age >= STAR_MS || hash(i, 3) < 0.4) return null;
  const d = Math.floor(age * STAR_SPEED);
  return { x: Math.floor(cw * (0.3 + 0.6 * hash(i, 4))) - d, y: Math.floor(ch * 0.4 * hash(i, 5)) + d, age: age / STAR_MS };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: PASS, all tests.

If the shooting-star test's `cycle < 10` or `seen` bounds fail, the cause is the hash seeds: change the seed numbers in `shootingStarAt` (not the test's bounds) until they hold.

- [ ] **Step 6: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add site/layout.js site/motion.js site/test/layout.test.js site/test/motion.test.js
git commit -m "Games page: stages, whole-pixel scaling and everything that moves"
```

### Task 6: games.json, and where the islands go

**Files:**
- Create: `site/games.json`, `site/islands.js`, `site/test/islands.test.js`
- Modify: `site/test/assets.test.js`, adding the island and weight checks.

**Interfaces:**
- Consumes:
  - from Task 5: `STAGES` (`layout.js`), and `BOB_AMP` and `LIFT` (`motion.js`);
  - from Tasks 2–3: the island JSONs.
- Produces, `games.json`:

  ```json
  {
    "games": [ { "id": "snake", "island": "island-snake", "at": { "landscape": [x, y], "portrait": [x, y] }, "bob": { "period": ms, "phase": 0..1 } }, ... ],
    "unfinished": { "island": "island-unfinished", "at": { ... }, "bob": { ... } }
  }
  ```

  `at` is the frame's top-left in stage pixels.
- Produces, from `islands.js`:
  - **`placeIslands(data, metas, layout)`** returns `[{ id, game, island, x, y, meta, bob, hit: [x,y,w,h] }]`:
    - the unfinished island comes first (`id: 'unfinished'`, `game: false`), then the games in the file's order;
    - `hit` is in stage pixels;
    - `metas` maps an island name (e.g. `'island-snake'`) to its JSON.
  - **`checkGames(data, metas)`** returns a list of problem sentences, empty when the file is fine.
  - **`overlaps(a, b)`**.

- [ ] **Step 1: Write the failing tests**

`site/test/islands.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeIslands, checkGames, overlaps } from '../islands.js';
import { readJson } from './helpers.js';

// Fixture art: two 100-wide game islands and a 60-wide unfinished one, their opaque boxes inset in their frames.
const META = {
  'island-a': { w: 110, h: 90, frames: 4, ms: 150, hit: [5, 4, 100, 80] },
  'island-b': { w: 110, h: 90, frames: 4, ms: 150, hit: [5, 4, 100, 80] },
  'island-u': { w: 70, h: 70, frames: 2, ms: 200, hit: [5, 5, 60, 60] },
};
const BOB = { period: 4000, phase: 0 };
const fixture = () => ({
  games: [
    { id: 'a', island: 'island-a', at: { landscape: [0, 60], portrait: [0, 50] }, bob: { ...BOB } },
    { id: 'b', island: 'island-b', at: { landscape: [130, 60], portrait: [0, 150] }, bob: { ...BOB } },
  ],
  unfinished: { island: 'island-u', at: { landscape: [260, 60], portrait: [0, 260] }, bob: { ...BOB } },
});
const metas = (changes = {}) => ({ ...META, ...changes });

test('a well-formed games.json has no problems', () => {
  assert.deepEqual(checkGames(fixture(), metas()), []);
});

test('the unfinished island is placed first, then the games, each with its hit box on the stage', () => {
  const placed = placeIslands(fixture(), metas(), 'landscape');
  assert.deepEqual(placed.map((p) => [p.id, p.game]), [['unfinished', false], ['a', true], ['b', true]]);
  assert.deepEqual(placed[1].hit, [5, 64, 100, 80]);
  assert.deepEqual([placed[1].x, placed[1].y], [0, 60]);
  assert.equal(placed[1].meta, META['island-a']);
  assert.equal(placed[1].island, 'island-a');
  assert.deepEqual(placeIslands(fixture(), metas(), 'portrait')[2].hit, [5, 154, 100, 80]);
});

test('islands that overlap (allowing for bob and lift) are reported', () => {
  const data = fixture();
  data.games[1].at.landscape = [60, 60];
  assert.deepEqual(checkGames(data, metas()), ['a and b overlap in the landscape layout']);
});

test('an island that runs off a stage, or covers the title, is reported', () => {
  const off = fixture();
  off.games[0].at.portrait = [150, 50];
  assert.deepEqual(checkGames(off, metas()), ['a: runs off the portrait stage']);
  const title = fixture();
  title.games[0].at.landscape = [0, 10];
  assert.deepEqual(checkGames(title, metas()), ['a: covers the title in the landscape layout']);
});

test('islands must be the right width', () => {
  assert.deepEqual(checkGames(fixture(), metas({ 'island-a': { ...META['island-a'], hit: [5, 4, 150, 80] } })),
    ['a: island is 150 px wide; it should be 96–140']);
  assert.deepEqual(checkGames(fixture(), metas({ 'island-u': { ...META['island-u'], hit: [5, 5, 100, 60] } })),
    ['unfinished: island is 100 px wide; it should be 48–80']);
});

test('every entry needs whole-pixel positions in both layouts, a bob, and art that exists', () => {
  const noPortrait = fixture();
  delete noPortrait.games[0].at.portrait;
  assert.deepEqual(checkGames(noPortrait, metas()), ['a: needs a whole-pixel [x, y] position for the portrait layout']);
  const fractional = fixture();
  fractional.games[0].at.landscape = [0.5, 60];
  assert.deepEqual(checkGames(fractional, metas()), ['a: needs a whole-pixel [x, y] position for the landscape layout']);
  const badBob = fixture();
  badBob.games[1].bob.period = 100;
  assert.deepEqual(checkGames(badBob, metas()), ['b: bob needs a whole-ms period of 2000–8000 and a phase in [0, 1)']);
  const noArt = fixture();
  noArt.games[0].island = 'island-z';
  assert.deepEqual(checkGames(noArt, metas()), ['a: no island art named "island-z"']);
});

test('game ids are unique, lowercase, and never "unfinished"', () => {
  const twice = fixture();
  twice.games[1].id = 'a';
  assert.deepEqual(checkGames(twice, metas()), ['game id "a" is listed twice']);
  const shouty = fixture();
  shouty.games[0].id = 'Snake!';
  assert.deepEqual(checkGames(shouty, metas()), ['game id "Snake!" must be lowercase letters, digits and dashes']);
  const reserved = fixture();
  reserved.games[0].id = 'unfinished';
  assert.deepEqual(checkGames(reserved, metas()), ['game id "unfinished" is kept for the unfinished island']);
});

test('games.json needs games and an unfinished island', () => {
  assert.deepEqual(checkGames({ games: [], unfinished: fixture().unfinished }, metas()), ['games.json needs a non-empty "games" list']);
  const noUnfinished = fixture();
  delete noUnfinished.unfinished;
  assert.deepEqual(checkGames(noUnfinished, metas()), ['games.json needs an "unfinished" island']);
});

test('overlaps: touching edges do not overlap', () => {
  assert.equal(overlaps([0, 0, 10, 10], [10, 0, 10, 10]), false);
  assert.equal(overlaps([0, 0, 10, 10], [9, 9, 10, 10]), true);
});

test('the real games.json fits its art in both layouts', () => {
  const data = readJson('games.json');
  const real = Object.fromEntries([data.unfinished, ...data.games].map((e) => [e.island, readJson(`assets/${e.island}.json`)]));
  assert.deepEqual(checkGames(data, real), []);
});
```

Append to `site/test/assets.test.js`:
```js
import { readdirSync, statSync } from 'node:fs';

test('each island sheet is its frames side by side, over a row of glows', () => {
  const data = readJson('games.json');
  for (const { island } of [data.unfinished, ...data.games]) {
    const meta = readJson(`assets/${island}.json`);
    assert.deepEqual(pngSize(`assets/${island}.png`), [meta.w * meta.frames, meta.h * 2], island);
    assert.ok(Number.isInteger(meta.ms) && meta.ms > 0 && rect(meta.hit), island);
  }
});

test('all the site art together stays under 300 KB', () => {
  const dir = siteFile('assets/');
  const total = readdirSync(dir).reduce((sum, f) => sum + statSync(new URL(f, dir)).size, 0);
  assert.ok(total < 300_000, `site/assets is ${total} bytes`);
});
```

Move the new `readdirSync, statSync` import up beside the file's other `node:fs` import, so there's one import line:

```js
import { existsSync, readdirSync, statSync } from 'node:fs';
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: FAIL. The cause is `Cannot find module '.../site/islands.js'`, and `games.json` not found.

- [ ] **Step 3: Write `islands.js`**

`site/islands.js`:
```js
// Where each island sits on a stage, and the checks that keep site/games.json honest.
import { STAGES } from './layout.js';
import { BOB_AMP, LIFT } from './motion.js';

const WIDTHS = { game: [96, 140], unfinished: [48, 80] };

// The islands in drawing order: the unfinished island first (it sits furthest back), then the games
// in the file's order. x, y: the frame's top-left in stage pixels. hit: the island's opaque box in
// stage pixels, where its link goes. metas maps an island's art name to its JSON.
export function placeIslands(data, metas, layout) {
  const place = (entry, id, game) => {
    const meta = metas[entry.island];
    const [x, y] = entry.at[layout];
    const [hx, hy, hw, hh] = meta.hit;
    return { id, game, island: entry.island, x, y, meta, bob: entry.bob, hit: [x + hx, y + hy, hw, hh] };
  };
  return [place(data.unfinished, 'unfinished', false), ...data.games.map((g) => place(g, g.id, true))];
}

export function overlaps([ax, ay, aw, ah], [bx, by, bw, bh]) {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

// Every problem with games.json, given the island art's JSON, as sentences; empty means it's fine.
export function checkGames(data, metas) {
  if (!Array.isArray(data?.games) || data.games.length === 0) return ['games.json needs a non-empty "games" list'];
  if (!data.unfinished) return ['games.json needs an "unfinished" island'];
  const problems = [];
  const seen = new Set();
  for (const g of data.games) {
    if (g.id === 'unfinished') problems.push('game id "unfinished" is kept for the unfinished island');
    else if (!/^[a-z0-9-]+$/.test(g.id ?? '')) problems.push(`game id "${g.id}" must be lowercase letters, digits and dashes`);
    else if (seen.has(g.id)) problems.push(`game id "${g.id}" is listed twice`);
    seen.add(g.id);
  }
  const entries = [['unfinished', data.unfinished, false], ...data.games.map((g) => [g.id, g, true])];
  for (const [id, e, game] of entries) {
    const meta = metas[e.island];
    if (!meta) {
      problems.push(`${id}: no island art named "${e.island}"`);
      continue;
    }
    const [lo, hi] = WIDTHS[game ? 'game' : 'unfinished'];
    if (meta.hit[2] < lo || meta.hit[2] > hi) problems.push(`${id}: island is ${meta.hit[2]} px wide; it should be ${lo}–${hi}`);
    for (const layout of Object.keys(STAGES)) {
      const at = e.at?.[layout];
      if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isInteger)) {
        problems.push(`${id}: needs a whole-pixel [x, y] position for the ${layout} layout`);
      }
    }
    const { period, phase } = e.bob ?? {};
    if (!Number.isInteger(period) || period < 2000 || period > 8000 || typeof phase !== 'number' || phase < 0 || phase >= 1) {
      problems.push(`${id}: bob needs a whole-ms period of 2000–8000 and a phase in [0, 1)`);
    }
  }
  if (problems.length) return problems;
  // Every entry is well formed, so check each layout's arrangement. Each island's box includes the room
  // it needs to bob and lift, and must stay on the stage, clear of the title and of the other islands.
  for (const [layout, stage] of Object.entries(STAGES)) {
    const boxes = placeIslands(data, metas, layout).map(({ id, hit: [x, y, w, h] }) => ({
      id, box: [x, y - BOB_AMP - LIFT, w, h + 2 * BOB_AMP + LIFT],
    }));
    for (const { id, box: [x, y, w, h] } of boxes) {
      if (x < 0 || y < 0 || x + w > stage.w || y + h > stage.h) problems.push(`${id}: runs off the ${layout} stage`);
      if (overlaps([x, y, w, h], stage.title)) problems.push(`${id}: covers the title in the ${layout} layout`);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (overlaps(boxes[i].box, boxes[j].box)) problems.push(`${boxes[i].id} and ${boxes[j].id} overlap in the ${layout} layout`);
      }
    }
  }
  return problems;
}
```

Note on ordering: in the "overlap" test the pair is reported as `a and b`, because the unfinished island comes first in `boxes` and `a` before `b`.

- [ ] **Step 4: Write `games.json`**

`site/games.json`. These are starting positions, planned from the frame sizes in Tasks 2–3:
```json
{
  "games": [
    { "id": "snake", "island": "island-snake", "at": { "landscape": [14, 72], "portrait": [4, 48] }, "bob": { "period": 4200, "phase": 0 } },
    { "id": "marrow", "island": "island-marrow", "at": { "landscape": [180, 20], "portrait": [84, 160] }, "bob": { "period": 5300, "phase": 0.4 } }
  ],
  "unfinished": { "island": "island-unfinished", "at": { "landscape": [300, 118], "portrait": [16, 290] }, "bob": { "period": 3700, "phase": 0.7 } }
}
```

- [ ] **Step 5: Run the tests, and fit the real positions**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`

- The fixture tests must PASS as written.
- If "the real games.json fits its art" fails, its message names each problem. Move the positions in `games.json` (only) until it passes, keeping the arrangement:
  - **landscape:** Snake low on the left, Marrow high in the middle-right, the unfinished island low on the far right;
  - **portrait:** Snake at the top-left, Marrow in the middle-right, the unfinished island at the bottom-left.

  If the style test's positions in `art/site/style-test.lua` no longer match, update its `ISLANDS` table to match.

Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add site/games.json site/islands.js site/test/islands.test.js site/test/assets.test.js art/site/style-test.lua
git commit -m "Games page: games.json, island placement and its checks"
```

### Task 7: The sign's words

**Files:**
- Create: `site/sign.js`, `site/test/sign.test.js`
- Modify: `site/test/assets.test.js`, adding the sign art check.

**Interfaces:**
- Produces, from `sign.js`:
  - **`SIGN`:** `{ pad: 7, line: 10, text: 8, gap: 3, maxW: 200, margin: 4, drop: 5, min: 16 }`.
  - **`wrap(text, maxW, measure) → string[]`.**
  - **`layoutSign({ name, blurb, controls }, measure, maxW) → { w, h, rows: [{ text, style, y }] }`:**
    - `measure(text, style)` returns a width in pixels;
    - `style` is `'name' | 'blurb' | 'controls'`;
    - each row's `y` is its text's top, relative to the board.
  - **`placeSign(hit, w, h, bounds) → { x, y, hanging }`:** `hit` and `bounds` are `[x,y,w,h]` in stage pixels. `bounds` is the visible canvas, `[-ox, -oy, cw, ch]`.

- [ ] **Step 1: Write the failing tests**

`site/test/sign.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGN, wrap, layoutSign, placeSign } from '../sign.js';

const mono = (s) => s.length * 6;
const byStyle = (s, style) => s.length * (style === 'name' ? 7 : 6); // the name is bold, so wider

test('wrap fills each line as far as it fits', () => {
  assert.deepEqual(wrap('one two three', 40, mono), ['one', 'two', 'three']);
  assert.deepEqual(wrap('one two three', 60, mono), ['one two', 'three']);
  assert.deepEqual(wrap('  one   two  ', 60, mono), ['one two']);
  assert.deepEqual(wrap('', 60, mono), []);
});

test('a word too long for any line gets a line to itself', () => {
  assert.deepEqual(wrap('a supercalifragilistic b', 30, mono), ['a', 'supercalifragilistic', 'b']);
});

test('the sign lays out name, blurb and controls, measuring each in its own font', () => {
  const sign = layoutSign({ name: 'Snake', blurb: "Eat, grow, don't bite yourself.", controls: 'Arrow keys, WASD, or swipe.' }, byStyle, 120);
  assert.deepEqual(sign.rows, [
    { text: 'Snake', style: 'name', y: 7 },
    { text: "Eat, grow, don't", style: 'blurb', y: 20 },
    { text: 'bite yourself.', style: 'blurb', y: 30 },
    { text: 'Arrow keys, WASD,', style: 'controls', y: 43 },
    { text: 'or swipe.', style: 'controls', y: 53 },
  ]);
  assert.equal(sign.w, 102 + 2 * SIGN.pad);
  assert.equal(sign.h, 53 + SIGN.text + SIGN.pad);
});

test('an empty section leaves no gap, and the board is never smaller than SIGN.min', () => {
  const sign = layoutSign({ name: 'X', blurb: 'y', controls: '' }, byStyle, 120);
  assert.deepEqual(sign.rows.map((r) => [r.text, r.y]), [['X', 7], ['y', 20]]);
  assert.equal(sign.h, 20 + SIGN.text + SIGN.pad);
  assert.equal(sign.w, Math.max(SIGN.min, 7 + 2 * SIGN.pad));
});

test('the board is as wide as its widest line, rounded up to a whole pixel', () => {
  const sign = layoutSign({ name: 'Abc', blurb: 'c', controls: 'd' }, (s) => s.length * 5.5, 120);
  assert.equal(sign.w, 17 + 2 * SIGN.pad);
});

const W = 116, H = 68, STAGE = [0, 0, 384, 216];

test('the sign hangs centred under the island when there is room', () => {
  assert.deepEqual(placeSign([100, 50, 80, 60], W, H, STAGE), { x: 82, y: 115, hanging: true });
});

test('near the bottom of the canvas it goes above the island instead', () => {
  assert.deepEqual(placeSign([100, 120, 80, 60], W, H, STAGE), { x: 82, y: 47, hanging: false });
});

test('it stays inside the canvas at the sides', () => {
  assert.equal(placeSign([0, 50, 40, 60], W, H, STAGE).x, SIGN.margin);
  assert.equal(placeSign([360, 50, 40, 60], W, H, STAGE).x, 384 - SIGN.margin - W);
});

test('it may use the sky beyond the stage when the canvas is bigger', () => {
  assert.deepEqual(placeSign([360, 50, 40, 60], W, H, [-61, -9, 507, 234]), { x: 322, y: 115, hanging: true });
});

test('on a canvas narrower than the sign, its left edge stays in view', () => {
  assert.equal(placeSign([10, 10, 40, 40], W, H, [0, 0, 100, 300]).x, SIGN.margin);
});
```

Append to `site/test/assets.test.js`:
```js
import { SIGN } from '../sign.js';

test('the sign art has its 9-slice, rope and text colours, and the words clear its frame', () => {
  const sign = readJson('assets/sign.json');
  assert.deepEqual(sign.size, [16, 16]);
  assert.equal(sign.slice, 5);
  assert.deepEqual(sign.rope, [16, 0, 1, 4]);
  assert.match(sign.fill, HEX);
  for (const k of ['name', 'blurb', 'controls']) assert.match(sign.text[k], HEX, k);
  assert.deepEqual(pngSize('assets/sign.png'), [17, 16]);
  assert.ok(SIGN.pad > sign.slice && SIGN.min >= 2 * sign.slice);
});
```

Move the new import to the top of the file, with the others.

- [ ] **Step 2: Run them to see them fail**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: FAIL. The cause is `Cannot find module '.../site/sign.js'`.

- [ ] **Step 3: Write `sign.js`**

`site/sign.js`:
```js
// The sign that hangs under the active island: the game's name, blurb and controls, word-wrapped on a
// small board. Pure: it measures text with the function it's given, so it fits whatever font is in use.
export const SIGN = {
  pad: 7, // from the board's edge to the words (the frame is 5 px)
  line: 10, // from one line's top to the next
  text: 8, // how tall a line of 8px Silkscreen is
  gap: 3, // extra space between the name, the blurb and the controls
  maxW: 200, // the widest a board gets
  margin: 4, // kept clear at the canvas's edges
  drop: 5, // from the island's hit box down to a hanging board
  min: 16, // the smallest a board gets
};

// Greedy word wrap. measure(text) is its width in pixels. A word wider than maxW gets a line to itself.
export function wrap(text, maxW, measure) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// The board's size and its rows of words. measure(text, style) is a width in pixels, where style is
// 'name', 'blurb' or 'controls' (the name is bold). An empty section is left out, gap and all.
export function layoutSign({ name, blurb, controls }, measure, maxW = SIGN.maxW) {
  const inner = maxW - 2 * SIGN.pad;
  const rows = [];
  let y = SIGN.pad;
  for (const [text, style] of [[name, 'name'], [blurb, 'blurb'], [controls, 'controls']]) {
    const lines = wrap(text ?? '', inner, (s) => measure(s, style));
    if (!lines.length) continue;
    if (rows.length) y += SIGN.gap;
    for (const line of lines) {
      rows.push({ text: line, style, y });
      y += SIGN.line;
    }
  }
  const widest = Math.max(0, ...rows.map((r) => measure(r.text, r.style)));
  return {
    w: Math.max(SIGN.min, Math.ceil(widest) + 2 * SIGN.pad),
    h: Math.max(SIGN.min, rows.length ? y - SIGN.line + SIGN.text + SIGN.pad : 2 * SIGN.pad),
    rows,
  };
}

// Where the board goes: centred under the island's hit box, hanging SIGN.drop below it, or above the
// island if it would run off the bottom of the canvas, and kept SIGN.margin inside the canvas's sides.
// bounds: the visible canvas in stage pixels. hanging: true when it's under the island (so it has ropes).
export function placeSign([hx, hy, hw, hh], w, h, [bx, by, bw, bh]) {
  const x = Math.max(bx + SIGN.margin, Math.min(Math.round(hx + hw / 2 - w / 2), bx + bw - SIGN.margin - w));
  const below = hy + hh + SIGN.drop;
  if (below + h <= by + bh - SIGN.margin) return { x, y: below, hanging: true };
  return { x, y: Math.max(by + SIGN.margin, hy - SIGN.drop - h), hanging: false };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add site/sign.js site/test/sign.test.js site/test/assets.test.js
git commit -m "Games page: the sign's word wrap, size and placement"
```

---

## Phase 3 — The scene on the page

### Task 8: Loading the art and drawing the scene

**Files:**
- Create: `site/load.js`, `site/render.js`, `site/test/load.test.js`, `site/test/render.test.js`

**Interfaces:**
- Consumes:
  - from Task 4: `PHASES`, `weights` and `dominant`;
  - from Task 5: `STAGES`, and from `motion.js` `bob`, `liftAt`, `frameAt`, `drift`, `twinkles`, `twinkleFrame`, `birdAt`, `shootingStarAt`, `LIFT` and `CLOUD_SPEEDS`;
  - from Task 6: `placeIslands`' island objects;
  - from Task 7: `SIGN`, `layoutSign` and `placeSign`.
- Produces:
  - **`loadScene(base?, io?) → art`**, where `art` is:

    ```
    { games, sky, skies: { <layout>: { <phase>: image } }, clouds, atlas,
      metas: { <island name>: json }, images: { <island name>: image }, sign: { meta, image } }
    ```

    `base` defaults to `site/`. `io` is `{ image(url), json(url) }` for tests. Any failure rejects.
  - **`loadImage` and `loadJson`**, the browser loaders.
  - **`createRenderer(ctx, art, info)`**, where `info(id)` returns `{ name, blurb, controls }`. It returns `{ draw(frame) }`, with:

    ```
    frame = { view, islands, sky, now, anim, reduced, active }
    ```

    - `view` comes from `chooseView`, `islands` from `placeIslands`, and `sky` from `skyFor`;
    - `now` is the frame time in ms, and drives the lift;
    - `anim` is ms since the scene started, and drives everything that loops;
    - `reduced` means reduced motion;
    - `active` is the active game's id, or null.
  - The constants **`TITLE`** and **`SUBTITLE`**.

- [ ] **Step 1: Write the failing tests**

`site/test/load.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScene } from '../load.js';

const BOB = { period: 4000, phase: 0 };
const GAMES = {
  games: [{ id: 'snake', island: 'island-snake', at: { landscape: [0, 0], portrait: [0, 0] }, bob: BOB }],
  unfinished: { island: 'island-unfinished', at: { landscape: [0, 0], portrait: [0, 0] }, bob: BOB },
};
const BASE = 'https://example.test/site/';

// Loaders that record every URL asked for and hand back a stand-in named after it.
function fakeIo(failing) {
  const asked = [];
  const answer = (url, value) => {
    asked.push(url.slice(BASE.length));
    if (url === failing) return Promise.reject(new Error(`couldn't load ${url}`));
    return Promise.resolve(value);
  };
  return {
    asked,
    io: {
      json: (url) => answer(url, url.endsWith('games.json') ? GAMES : { name: url.slice(BASE.length) }),
      image: (url) => answer(url, { src: url.slice(BASE.length) }),
    },
  };
}

test('it loads games.json and every picture and data file the scene needs', async () => {
  const { asked, io } = fakeIo();
  const art = await loadScene(new URL(BASE), io);
  const skies = ['landscape', 'portrait'].flatMap((l) => ['dawn', 'day', 'dusk', 'night'].map((p) => `assets/sky-${p}-${l}.png`));
  assert.deepEqual(asked.sort(), [
    'games.json', 'assets/sky.json', 'assets/sign.json', 'assets/island-unfinished.json', 'assets/island-snake.json',
    'assets/island-unfinished.png', 'assets/island-snake.png', 'assets/clouds.png', 'assets/sky.png', 'assets/sign.png', ...skies,
  ].sort());
  assert.equal(art.games, GAMES);
  assert.deepEqual(art.sky, { name: 'assets/sky.json' });
  assert.deepEqual(art.skies.portrait.night, { src: 'assets/sky-night-portrait.png' });
  assert.deepEqual(art.skies.landscape.dawn, { src: 'assets/sky-dawn-landscape.png' });
  assert.deepEqual(art.metas['island-snake'], { name: 'assets/island-snake.json' });
  assert.deepEqual(art.images['island-unfinished'], { src: 'assets/island-unfinished.png' });
  assert.deepEqual(art.clouds, { src: 'assets/clouds.png' });
  assert.deepEqual(art.atlas, { src: 'assets/sky.png' });
  assert.deepEqual(art.sign, { meta: { name: 'assets/sign.json' }, image: { src: 'assets/sign.png' } });
});

test('a file that fails to load fails the whole load', async () => {
  const { io } = fakeIo(`${BASE}assets/island-snake.png`);
  await assert.rejects(loadScene(new URL(BASE), io), /island-snake\.png/);
});
```

`site/test/render.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, TITLE, SUBTITLE } from '../render.js';
import { chooseView } from '../layout.js';
import { placeIslands } from '../islands.js';
import { LIFT, LIFT_STEP_MS } from '../motion.js';

const PHASES = ['dawn', 'day', 'dusk', 'night'];
const img = (name, width, height) => ({ name, width, height });
const META = {
  'island-snake': { w: 120, h: 100, frames: 8, ms: 150, hit: [8, 6, 104, 88] },
  'island-marrow': { w: 120, h: 120, frames: 8, ms: 150, hit: [8, 6, 104, 108] },
  'island-unfinished': { w: 70, h: 70, frames: 4, ms: 200, hit: [5, 5, 60, 60] },
};
const GAMES = {
  games: [
    { id: 'snake', island: 'island-snake', at: { landscape: [20, 70], portrait: [4, 50] }, bob: { period: 4000, phase: 0 } },
    { id: 'marrow', island: 'island-marrow', at: { landscape: [180, 30], portrait: [90, 170] }, bob: { period: 5000, phase: 0.5 } },
  ],
  unfinished: { island: 'island-unfinished', at: { landscape: [310, 130], portrait: [20, 300] }, bob: { period: 3000, phase: 0.2 } },
};
const INFO = {
  snake: { name: 'Snake', blurb: "Eat, grow, don't bite yourself.", controls: 'Arrow keys, WASD, or swipe.' },
  marrow: { name: 'Marrow', blurb: 'A duel.', controls: 'Keyboard.' },
};
const ART = {
  games: GAMES,
  sky: {
    order: PHASES,
    phases: Object.fromEntries(PHASES.map((p) => [p, { top: '#000001', bottom: '#000002', title: '#ffffff', shadow: '#000000', subtitle: '#eeeeee' }])),
    clouds: { w: 384, h: 48, layers: 3 },
    sprites: { moon: [0, 0, 14, 14], sun: [16, 0, 20, 20], bird: [[38, 0, 7, 4], [46, 0, 7, 4]], twinkle: [[38, 6, 5, 5], [44, 6, 5, 5], [50, 6, 5, 5]] },
    shooting: '#fff6dc',
  },
  skies: {
    landscape: Object.fromEntries(PHASES.map((p) => [p, img(`sky-${p}-landscape`, 384, 216)])),
    portrait: Object.fromEntries(PHASES.map((p) => [p, img(`sky-${p}-portrait`, 216, 384)])),
  },
  clouds: img('clouds', 384, 576),
  atlas: img('atlas', 56, 20),
  metas: META,
  images: Object.fromEntries(Object.entries(META).map(([k, m]) => [k, img(k, m.w * m.frames, m.h * 2)])),
  sign: {
    meta: { size: [16, 16], slice: 5, rope: [16, 0, 1, 4], fill: '#f3e6c4', text: { name: '#111111', blurb: '#222222', controls: '#333333' } },
    image: img('sign', 17, 16),
  },
};

// A 2D context that records what's drawn, with the alpha and font in force at the time.
function fakeContext() {
  const calls = [];
  return {
    calls, globalAlpha: 1, fillStyle: '', font: '', textBaseline: '', imageSmoothingEnabled: true,
    setTransform() {},
    fillRect(...args) { calls.push({ op: 'fillRect', args, alpha: this.globalAlpha, style: this.fillStyle }); },
    drawImage(image, ...args) { calls.push({ op: 'drawImage', img: image.name, args, alpha: this.globalAlpha }); },
    fillText(text, x, y) { calls.push({ op: 'fillText', text, args: [x, y], alpha: this.globalAlpha, style: this.fillStyle, font: this.font }); },
    measureText(text) { return { width: text.length * 6 }; },
  };
}

function setup(size = [1920, 1080, 1]) {
  const ctx = fakeContext();
  const renderer = createRenderer(ctx, ART, (id) => INFO[id]);
  const view = chooseView(...size);
  const islands = placeIslands(GAMES, META, view.layout);
  const draw = (frame = {}) => {
    ctx.calls.length = 0;
    renderer.draw({ view, islands, sky: { from: 'day', to: 'day', t: 0 }, now: 1000, anim: 1234, reduced: false, active: null, ...frame });
    return [...ctx.calls];
  };
  return { draw, view };
}

// Where each call puts pixels on the canvas.
function destination(c) {
  if (c.op === 'drawImage') return c.args.length === 8 ? c.args.slice(4, 6) : c.args.slice(0, 2);
  return c.args.slice(0, 2);
}

test('everything is drawn at whole scene pixels', () => {
  const cases = [
    [[1920, 1080, 1], { active: 'snake', sky: { from: 'night', to: 'dawn', t: 0.4 }, anim: 45123 }],
    [[390, 844, 3], { active: 'marrow', sky: { from: 'dusk', to: 'night', t: 0.5 }, anim: 1 }],
    [[1366, 768, 1.25], { active: 'snake', anim: 99999 }],
  ];
  for (const [size, frame] of cases) {
    for (const c of setup(size).draw(frame)) {
      assert.ok(destination(c).every(Number.isInteger), `${c.op} ${c.img ?? c.text ?? ''} at ${destination(c)}`);
    }
  }
});

test('the incoming phase is drawn over the outgoing one at the crossfade opacity', () => {
  const calls = setup().draw({ sky: { from: 'night', to: 'dawn', t: 0.25 } });
  const night = calls.findIndex((c) => c.img === 'sky-night-landscape');
  const dawn = calls.findIndex((c) => c.img === 'sky-dawn-landscape');
  assert.ok(night >= 0 && dawn > night);
  assert.equal(calls[night].alpha, 1);
  assert.equal(calls[dawn].alpha, 0.25);
});

test('the moon only shows at night, the sun only at dawn', () => {
  const moon = (calls) => calls.filter((c) => c.img === 'atlas' && c.args.slice(0, 4).join() === '0,0,14,14');
  const sun = (calls) => calls.filter((c) => c.img === 'atlas' && c.args.slice(0, 4).join() === '16,0,20,20');
  const { draw } = setup();
  assert.equal(moon(draw({ sky: { from: 'day', to: 'day', t: 0 } })).length, 0);
  assert.equal(moon(draw({ sky: { from: 'night', to: 'night', t: 0 } })).length, 1);
  assert.equal(sun(draw({ sky: { from: 'dawn', to: 'dawn', t: 0 } })).length, 1);
  assert.equal(sun(draw({ sky: { from: 'dusk', to: 'dusk', t: 0 } })).length, 0);
});

test('the active island glows behind itself, and its sign is drawn over everything', () => {
  const calls = setup().draw({ active: 'snake' });
  const snake = calls.filter((c) => c.img === 'island-snake');
  assert.deepEqual(snake.map((c) => c.args[1]), [META['island-snake'].h, 0], 'the glow row, then the island');
  const lastIsland = calls.findLastIndex((c) => c.img?.startsWith('island-'));
  const name = calls.findIndex((c) => c.op === 'fillText' && c.text === 'Snake');
  assert.ok(name > lastIsland, 'the sign comes after the islands');
  assert.equal(calls[name].font, '700 8px Silkscreen, monospace');
  assert.equal(calls.filter((c) => c.img === 'island-marrow').length, 1, 'other islands have no glow');
});

test('with nothing active there is no sign: only the title is lettered', () => {
  const texts = new Set(setup().draw().filter((c) => c.op === 'fillText').map((c) => c.text));
  assert.deepEqual(texts, new Set([TITLE, SUBTITLE]));
});

test('with reduced motion the scene holds still', () => {
  const { draw } = setup();
  const a = JSON.stringify(draw({ reduced: true, anim: 0 }));
  const b = JSON.stringify(draw({ reduced: true, anim: 98765 }));
  assert.equal(a, b);
});

test('an active island rises LIFT pixels a step at a time, and sinks back when it stops being active', () => {
  const { draw, view } = setup();
  const snakeY = (calls) => calls.filter((c) => c.img === 'island-snake').at(-1).args[5];
  const rest = view.oy + 70; // snake's landscape y; bob(0, 4000, 0) is 0
  assert.equal(snakeY(draw({ anim: 0, now: 1000, active: 'snake' })), rest);
  assert.equal(snakeY(draw({ anim: 0, now: 1000 + LIFT_STEP_MS, active: 'snake' })), rest - 1);
  assert.equal(snakeY(draw({ anim: 0, now: 2000, active: 'snake' })), rest - LIFT);
  assert.equal(snakeY(draw({ anim: 0, now: 2040, active: null })), rest - LIFT);
  assert.equal(snakeY(draw({ anim: 0, now: 2040 + LIFT_STEP_MS, active: null })), rest - LIFT + 1);
  assert.equal(snakeY(draw({ anim: 0, now: 3000, active: null })), rest);
});

test('with reduced motion the lift is immediate', () => {
  const { draw, view } = setup();
  const snakeY = (calls) => calls.filter((c) => c.img === 'island-snake').at(-1).args[5];
  assert.equal(snakeY(draw({ reduced: true, now: 1000, active: 'snake' })), view.oy + 70 - LIFT);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: FAIL. The cause is `Cannot find module '.../site/load.js'` (and `render.js`).

- [ ] **Step 3: Write `load.js`**

`site/load.js`:
```js
// Loads the scene's art: site/games.json and everything the scripts in art/site/ wrote to site/assets/.
// `io` replaces the browser's loaders (for the tests). Any file that fails to load fails the whole load.
import { PHASES } from './sky.js';
import { STAGES } from './layout.js';

export async function loadScene(base = new URL('./', import.meta.url), io = {}) {
  const { image = loadImage, json = loadJson } = io;
  const at = (path) => new URL(path, base).href;
  const [games, sky, signMeta] = await Promise.all([json(at('games.json')), json(at('assets/sky.json')), json(at('assets/sign.json'))]);
  const names = [games.unfinished.island, ...games.games.map((g) => g.island)];
  const layouts = Object.keys(STAGES);
  const [metaList, imageList, skyList, [clouds, atlas, signImage]] = await Promise.all([
    Promise.all(names.map((n) => json(at(`assets/${n}.json`)))),
    Promise.all(names.map((n) => image(at(`assets/${n}.png`)))),
    Promise.all(layouts.flatMap((l) => PHASES.map((p) => image(at(`assets/sky-${p}-${l}.png`))))),
    Promise.all(['clouds', 'sky', 'sign'].map((n) => image(at(`assets/${n}.png`)))),
  ]);
  const skies = Object.fromEntries(layouts.map((l, i) => [l, Object.fromEntries(PHASES.map((p, j) => [p, skyList[i * PHASES.length + j]]))]));
  return {
    games, sky, skies, clouds, atlas,
    metas: Object.fromEntries(names.map((n, i) => [n, metaList[i]])),
    images: Object.fromEntries(names.map((n, i) => [n, imageList[i]])),
    sign: { meta: signMeta, image: signImage },
  };
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
```

- [ ] **Step 4: Write `render.js`**

`site/render.js`:
```js
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
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add site/load.js site/render.js site/test/load.test.js site/test/render.test.js
git commit -m "Games page: load the art and draw the living scene"
```

### Task 9: The page: links over the islands, the boot, and the fallback

**Files:**
- Create: `site/links.js`, `site/main.js`, `site/test/links.test.js`, `site/test/page.test.js`
- Modify: `index.html`, replacing it entirely.

**Interfaces:**
- Consumes:
  - from Task 4: `skyFor`;
  - from Task 5: `chooseView` and `toCss`;
  - from Task 6: `placeIslands`;
  - from Task 8: `loadScene` and `createRenderer`.
- Produces:
  - `tapDecision(armed, tapped) → 'arm' | 'go'`;
  - `activeIsland({ hovered, armed, focused }) → id | null`;
  - `createLinks(doc, win) → { info(id), active(), place(islands, view) }`.
- The page's link format, as given in the Global Constraints.

- [ ] **Step 1: Write the failing tests**

`site/test/links.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapDecision, activeIsland } from '../links.js';

test('on touch, the first tap on an island arms it and a second tap on it plays', () => {
  assert.equal(tapDecision(null, 'snake'), 'arm');
  assert.equal(tapDecision('snake', 'snake'), 'go');
  assert.equal(tapDecision('snake', 'marrow'), 'arm'); // tapping another island moves the sign, it doesn't play
});

test('the mouse wins over a tapped island, which wins over keyboard focus', () => {
  assert.equal(activeIsland({ hovered: 'a', armed: 'b', focused: 'c' }), 'a');
  assert.equal(activeIsland({ hovered: null, armed: 'b', focused: 'c' }), 'b');
  assert.equal(activeIsland({ hovered: null, armed: null, focused: 'c' }), 'c');
  assert.equal(activeIsland({ hovered: null, armed: null, focused: null }), null);
});
```

`site/test/page.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readJson, siteFile } from './helpers.js';

const html = readFileSync(siteFile('../index.html'), 'utf8');
const links = [...html.matchAll(/<a href="([^"]*)" data-game="([^"]*)">([\s\S]*?)<\/a>/g)].map(([, href, id, body]) => ({ href, id, body }));

test('the page lists exactly the games in games.json, in order, each linking to its folder', () => {
  assert.deepEqual(links.map((l) => l.id), readJson('games.json').games.map((g) => g.id));
  for (const { href, id } of links) {
    assert.equal(href, `./${id}/`);
    assert.ok(existsSync(siteFile(`../${id}/index.html`)), `${id}/index.html exists`);
  }
});

test('each link carries the words for its sign: a name, a blurb and the controls', () => {
  for (const { id, body } of links) {
    assert.match(body, /^<strong>[^<]+<\/strong> <span class="blurb">[^<]+<\/span> <span class="controls">[^<]+<\/span>$/, id);
  }
});

test('the page starts the scene as a module, and keeps the plain list as the fallback', () => {
  assert.match(html, /<canvas id="scene" aria-hidden="true"><\/canvas>/);
  assert.match(html, /<script type="module" src="\.\/site\/main\.js"><\/script>/);
  assert.match(html, /<script nomodule>document\.documentElement\.classList\.remove\('js'\);<\/script>/);
  assert.match(html, /document\.documentElement\.classList\.add\('js'\);/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: FAIL. The cause is `Cannot find module '.../site/links.js'`, and the page test fails against the old `index.html`.

- [ ] **Step 3: Write `links.js`**

`site/links.js`:
```js
// The real links over the islands. They're the ordinary <a> elements of index.html's list, so keyboard
// focus, screen readers, hover, middle-click and "open in new tab" all just work. This lays each one
// invisibly over its island, reads the words for its sign, and keeps track of which island is hovered,
// focused from the keyboard, or (on a touch screen) tapped once.
import { toCss } from './layout.js';

// On a touch screen the first tap on an island shows its sign and a second tap on the same island plays
// it. 'arm' means show the sign and don't follow the link yet.
export function tapDecision(armed, tapped) {
  return armed === tapped ? 'go' : 'arm';
}

// The island whose sign shows: the one under the mouse, else the one tapped, else the one focused.
export function activeIsland({ hovered, armed, focused }) {
  return hovered ?? armed ?? focused ?? null;
}

export function createLinks(doc, win) {
  const byId = new Map([...doc.querySelectorAll('.games a[data-game]')].map((a) => [a.dataset.game, a]));
  let hovered = null, armed = null, lastPointer = null;
  for (const [id, a] of byId) {
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') hovered = id;
    });
    a.addEventListener('pointerleave', () => {
      if (hovered === id) hovered = null;
    });
    a.addEventListener('click', (e) => {
      // A click from the keyboard (detail 0) or from a mouse always plays.
      if (e.detail === 0 || lastPointer !== 'touch') return;
      if (tapDecision(armed, id) === 'arm') {
        e.preventDefault();
        armed = id;
      }
    });
  }
  // Every press notes what made it; a press anywhere but on a link puts an armed sign away.
  doc.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType;
    if (!(e.target instanceof Element && e.target.closest('.games a'))) armed = null;
  }, true);
  doc.addEventListener('keydown', () => (lastPointer = null), true);
  // Coming back with the Back button can restore the page as it was left: start it fresh.
  win.addEventListener('pageshow', () => {
    hovered = null;
    armed = null;
  });
  return {
    info(id) {
      const a = byId.get(id);
      const text = (selector) => a?.querySelector(selector)?.textContent.trim() ?? '';
      return { name: text('strong'), blurb: text('.blurb'), controls: text('.controls') };
    },
    active() {
      const f = doc.activeElement;
      const id = f?.dataset?.game;
      const focused = id && byId.get(id) === f && f.matches(':focus-visible') ? id : null;
      return activeIsland({ hovered, armed, focused });
    },
    // Lays each game's link over its island's hit box.
    place(islands, view) {
      for (const island of islands) {
        const a = byId.get(island.id);
        if (!a) continue;
        const r = toCss(island.hit, view);
        Object.assign(a.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      }
    },
  };
}
```

- [ ] **Step 4: Write `main.js`**

`site/main.js`:
```js
// The games page: loads the scene's art, then draws the living scene every frame, with each game's link
// from index.html laid invisibly over its island. If anything fails, the page shows the plain list of
// links instead (see the scripts in index.html's <head>).
import { skyFor } from './sky.js';
import { chooseView } from './layout.js';
import { placeIslands } from './islands.js';
import { loadScene } from './load.js';
import { createLinks } from './links.js';
import { createRenderer } from './render.js';

const root = document.documentElement;
root.classList.add('js', 'booting'); // index.html's fallback timer leaves a booting page alone

function fail(err) {
  console.error(err);
  root.classList.remove('js', 'booting', 'scene');
}

async function boot() {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const [art] = await Promise.all([
    loadScene(),
    Promise.all(['16px Silkscreen', '8px Silkscreen', '700 8px Silkscreen'].map((font) => document.fonts.load(font)))
      .catch((err) => console.warn('Silkscreen not loaded; using the fallback font', err)),
  ]);
  const links = createLinks(document, window);
  const renderer = createRenderer(ctx, art, links.info);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let view, islands;
  const fit = () => {
    view = chooseView(innerWidth, innerHeight, devicePixelRatio || 1);
    canvas.width = view.cw;
    canvas.height = view.ch;
    canvas.style.width = `${(view.cw * view.scale) / view.dpr}px`;
    canvas.style.height = `${(view.ch * view.scale) / view.dpr}px`;
    islands = placeIslands(art.games, art.metas, view.layout);
    links.place(islands, view);
  };
  addEventListener('resize', fit);
  fit();
  root.classList.add('scene');
  root.classList.remove('booting');
  // requestAnimationFrame doesn't run in a hidden tab, so the scene pauses there by itself.
  let start;
  const frame = (now) => {
    try {
      start ??= now;
      renderer.draw({
        view, islands, now, anim: now - start, reduced: reduceMotion.matches,
        sky: skyFor(location.search, new Date()), active: links.active(),
      });
      requestAnimationFrame(frame);
    } catch (err) {
      fail(err);
    }
  };
  requestAnimationFrame(frame);
}

boot().catch(fail);
```

- [ ] **Step 5: Rewrite `index.html`**

`index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Games</title>
  <link rel="icon" href="data:,">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap" rel="stylesheet">
  <script>
    // With JavaScript, the plain list waits unseen while the scene starts (site/main.js). If the scene
    // hasn't started within 4 seconds (a browser too old for it, or a script that never arrived), the
    // list comes back. Once main.js is running it brings the list back itself if anything fails.
    document.documentElement.classList.add('js');
    setTimeout(function () {
      var root = document.documentElement.classList;
      if (!root.contains('booting') && !root.contains('scene')) root.remove('js');
    }, 4000);
  </script>
  <script nomodule>document.documentElement.classList.remove('js');</script>
  <style>
    /* The plain page: what shows without JavaScript, or when the scene can't start. */
    :root { --bg: #fafaf9; --text: #1c1917; --muted: #78716c; --accent: #2563eb; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #1c1917; --text: #f5f5f4; --muted: #a8a29e; --accent: #60a5fa; }
    }
    body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
    main { max-width: 640px; margin: 0 auto; padding: 48px 16px; }
    h1 { margin: 0 0 4px; font-size: 2rem; }
    .intro { margin: 0 0 24px; color: var(--muted); }
    .games { margin: 0; padding: 0; list-style: none; }
    .games li + li { margin-top: 16px; }
    .games a { display: block; color: inherit; text-decoration: none; }
    .games strong { display: block; color: var(--accent); font-size: 1.15rem; }
    .games a:hover strong, .games a:focus-visible strong { text-decoration: underline; }
    .games span { display: block; color: var(--muted); }
    #scene { display: none; }

    /* While the scene starts, the list waits unseen. */
    .js body { background: #232640; }
    .js main { visibility: hidden; }

    /* The scene: the canvas covers the window, and each link lies invisibly over its island. The words
       stay in the links for screen readers; the canvas letters them on the island's sign. */
    .scene body { overflow: hidden; }
    .scene #scene { display: block; position: fixed; left: 0; top: 0; image-rendering: crisp-edges; image-rendering: pixelated; }
    .scene main { visibility: visible; padding: 0; }
    .scene h1, .scene .intro, .scene .games a > * {
      position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
    }
    .scene .games a { position: fixed; outline: none; -webkit-tap-highlight-color: transparent; }
  </style>
</head>
<body>
  <canvas id="scene" aria-hidden="true"></canvas>
  <main>
    <h1>Games</h1>
    <p class="intro">Little things I've built. Click one to play.</p>
    <!-- Each link is also the words on its island's sign. To add a game, see "Adding a game" in README.md. -->
    <ul class="games">
      <li><a href="./snake/" data-game="snake"><strong>Snake</strong> <span class="blurb">Eat, grow, don't bite yourself.</span> <span class="controls">Arrow keys, WASD, or swipe.</span></a></li>
      <li><a href="./marrow/" data-game="marrow"><strong>Marrow</strong> <span class="blurb">A one-hit-kill duel through three nightmare worlds.</span> <span class="controls">Keyboard: A/D move, W/S stance, F attack, G jump.</span></a></li>
    </ul>
  </main>
  <script type="module" src="./site/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd /Users/nathan/Documents/code/games/site && npm test`
Expected: PASS, all tests.

- [ ] **Step 7: Browser smoke check (Playwright MCP)**

Load the Playwright tools with ToolSearch (`select:mcp__plugin_playwright_playwright__browser_navigate,...`). Save every screenshot under `/Users/nathan/Documents/code/.playwright-mcp/`, which is the only allowed place.

1. Start a server from the repo root in the background: `python3 -m http.server 8123`.
2. Resize to 1280×720. Open `http://localhost:8123/?time=day` and wait a second.
   - `browser_console_messages` shows **no errors**.
   - Screenshot it, and look: the sky, clouds, title and three bobbing islands.
3. Hover the Snake link (take its ref from `browser_snapshot`), then screenshot. Snake must be lifted and glowing, with its sign reading **Snake** / the blurb / the controls, legibly.
4. Reload. Press Tab once, then screenshot. The keyboard-focused Snake island must show its sign.
5. Click the Marrow link. The URL must end in `/marrow/`. Go back.
6. Resize to 390×844, then screenshot. You should see the portrait stage.
   - `browser_evaluate` `document.querySelector('[data-game=snake]').getBoundingClientRect()`: the rectangle must lie within the viewport and over the Snake island in the screenshot.
7. Open `http://localhost:8123/?time=night`, then screenshot. Check: the moon, the stars, and the islands still readable.
8. Stop the server.

Fix anything wrong and re-run the tests. The following are allowed adjustments, with a re-run of `npm test` after each:
- If the title's lettering is wider or taller than `STAGES.<layout>.title`, widen the box in `layout.js`, and move the islands in `games.json` so `checkGames` still passes.
- Moving the clouds' `y`, or the moon's or sun's position, in `STAGES` for looks.

- [ ] **Step 8: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add index.html site/links.js site/main.js site/test/links.test.js site/test/page.test.js site/layout.js site/games.json
git commit -m "Games page: the living scene on the page, with its links over the islands"
```

### Task 10: README, and the full browser pass

**Files:**
- Modify: `README.md`, replacing the "Adding a game" section and adding "The games page".
- Modify: `docs/superpowers/specs/2026-09-23-games-islands-design.md`, but only if something built differs from it.

- [ ] **Step 1: Update the README**

In `README.md`, replace the whole `## Adding a game` section (its heading and its three numbered steps) with:

````markdown
## Adding a game

1. Make a folder for it, e.g. `pong/`, with an `index.html` inside.
2. Add its link to the list in the root `index.html`, in the same form as the others, on one line:
   `<li><a href="./pong/" data-game="pong"><strong>Pong</strong> <span class="blurb">…</span> <span class="controls">…</span></a></li>`.
   Browsers that can't show the scene show this list, and the scene writes these words on the island's sign.
3. Paint its island: copy `art/site/island-snake.lua` to `art/site/island-pong.lua` and repaint it in the game's own style, copying the colours you borrow into `art/site/palette.lua`. Keep it 96–140 px wide.
4. Add it to `site/games.json` with its id, `"island": "island-pong"`, a bob, and a spot in both layouts. Give it the unfinished island's spot and move the unfinished island somewhere free.
5. Rebuild the site art (see "The games page") and run the tests: `cd site && npm test`. They check that every link has an island and that nothing overlaps.
6. Commit and push to `main`. Pages redeploys automatically (about a minute).
````

Then add this section after `## Running locally`:

````markdown
## The games page

The front page is a living pixel-art scene. Each game floats as its own island, painted in that game's style, in a sky that follows your local time of day. The design spec is `docs/superpowers/specs/2026-09-23-games-islands-design.md`.

- Code: `site/`, plain ES modules with no build step. Tests (Node 22, no dependencies): `cd site && npm test`.
- See any time of day: `/?time=dawn`, `day`, `dusk` or `night`.
- Art: each piece has a script in `art/site/`, and `palette.lua` holds every colour. Rebuild it all from the repo root. It's deterministic: an unchanged script rebuilds its files byte for byte.

  ```sh
  for s in sky island-snake island-marrow island-unfinished sign; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/$s.lua; done
  ```

  `aseprite -b --script art/site/style-test.lua` writes `art/site/preview-style.png`, which shows all four skies with the islands, and each island script writes a preview GIF. Previews aren't committed.
````

- [ ] **Step 2: The full browser pass (Playwright MCP)**

Serve from the repo root on port 8123, as in Task 9. Save screenshots to `/Users/nathan/Documents/code/.playwright-mcp/islands-<name>.png`.

1. **Every phase at 1280×720.** Open `?time=dawn`, `day`, `dusk` and `night`, and screenshot each. Each must have no console errors, and in each the islands and title must read clearly.
2. **Portrait phone.** At 390×844, screenshot `?time=day` and `?time=night`.
3. **Signs at dusk.** Hover Marrow, then Snake, at `?time=dusk`. Each sign must be legible and inside the canvas.
4. **Reduced motion.** Run `browser_emulate_media` with `reducedMotion: 'reduce'`, and reload `?time=day`. Take `document.getElementById('scene').toDataURL()` twice, 1.5 s apart, with `browser_evaluate`. They must be equal. Then turn reduced motion back off.
5. **Motion.** Without reduced motion, the same two `toDataURL()` values must differ: the scene moves.
6. **The fallback list.** Run `browser_evaluate`: `document.documentElement.className = ''`, then screenshot. The plain list must show: Games, the intro, and both games with their blurbs and controls.
7. **A failed load.** Run `browser_run_code_unsafe` (or `browser_evaluate`) to reload with the art blocked, e.g. `page.route('**/site/assets/sky.json', r => r.abort())`, then reload. The plain list must show, and the console has one error from `main.js` and nothing else.
8. Run the tests one last time: `cd site && npm test`, which must all pass. Check that `git status` is clean after the art rebuild loop.

Fix anything wrong. If the build now differs from the spec anywhere, edit the spec to match and say why in the commit.

- [ ] **Step 3: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add README.md docs/superpowers/specs/2026-09-23-games-islands-design.md
git commit -m "Games page: README for the island scene and adding a game"
```
