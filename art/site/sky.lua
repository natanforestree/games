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
