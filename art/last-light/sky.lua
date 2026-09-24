-- Last Light's sky: a 1024x128 night panorama in last-light/assets/sky.png that wraps all the way
-- round (column 0 carries on from column 1023), its bottom row on the horizon. The game stretches it
-- about twice as wide as it is tall, so the pines are drawn narrow. Run from the repo root:
--   aseprite -b --script art/last-light/sky.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()
local C = P.c
local W, H = 1024, 128

local function smooth(t) return t * t * (3 - 2 * t) end
-- Smooth noise along x in [0, 1), on a lattice of `cell` px that wraps round the panorama.
local function wave(x, cell, seed)
  local n = W // cell
  local f = x / cell
  local i = math.floor(f)
  local a, b = L.rnd(i % n, 0, seed), L.rnd((i + 1) % n, 0, seed)
  return a + (b - a) * smooth(f - i)
end
local function put(b, x, y, c)
  if y >= 0 and y < H then b[math.floor(y)][math.floor(x) % W] = c end
end

local sky = L.buffer(W, H)

-- The night: night1 overhead, deepening to night3 and night4 in a faint glow above the trees. The
-- bands are solid, with a few rows of dither where one meets the next.
local RAMP = { C.night1, C.night2, C.night3, C.night4 }
for y = 0, H - 1 do
  for x = 0, W - 1 do
    local t = math.max(0, (y - 6) / (H - 58))
    t = t ^ 1.5 * (0.92 + 0.16 * wave(x, 128, 1))
    local f = math.min(1, t) * (#RAMP - 1)
    local i = math.floor(f)
    local band = math.max(0, math.min(1, (f - i - 0.5) * 1.6 + 0.5))
    sky[y][x] = L.ramp(RAMP, (i + band) / (#RAMP - 1), x, y)
  end
end

-- Stars, sparse, thinning towards the horizon, never two touching.
for y = 0, 96 do
  for x = 0, W - 1 do
    local p = 0.0075 * (1 - y / 100) ^ 2
    if L.rnd(x, y, 7) < p then
      local clear = true
      for dy = -1, 1 do
        for dx = -1, 1 do
          if y + dy >= 0 and sky[y + dy][(x + dx) % W] == C.star then clear = false end
        end
      end
      if clear then sky[y][x] = C.star end
    end
  end
end

-- One pine's silhouette: a spire on top, then tiers of drooping boughs, each flaring wider than the
-- one above, with ragged edges.
local function pine(b, cx, h, slope, c, seed)
  local top = H - h
  local tier = math.max(3, math.floor(h / 6))
  for y = top, H - 1 do
    local d = y - top
    local k = (d % tier) / tier
    local hw = d * slope * (0.55 + 0.45 * k) + (L.rnd(cx, y, seed) - 0.5) * 0.9
    if d < 3 then hw = 0 end
    for x = math.floor(cx - hw + 0.5), math.floor(cx + hw + 0.5) do put(b, x, y, c) end
  end
end

-- The treeline. Far pines in night1, a band of them all round; near pines in black, their heights
-- rising and falling, with a few tall spires and a gap or two where the far trees show through.
local x = 0
while x < W do
  pine(sky, x, 30 + math.floor(L.rnd(x, 1, 11) * 16), 0.2, C.night1, 12)
  x = x + 4 + math.floor(L.rnd(x, 2, 11) * 5)
end
local GAPS = { { 300, 352 }, { 700, 738 } }
x = 3
while x < W do
  local gap = false
  for _, g in ipairs(GAPS) do if x > g[1] and x < g[2] then gap = true end end
  local r = L.rnd(x, 3, 13)
  local h = 27 + math.floor(wave(x, 64, 14) * 14 + r * 10)
  local slope = 0.2
  if r > 0.93 then h, slope = 50 + math.floor(L.rnd(x, 4, 13) * 7), 0.14 end
  if gap then h = 20 + math.floor(r * 5) end
  pine(sky, x, h, slope, C.void, 15)
  x = x + 5 + math.floor(L.rnd(x, 5, 13) * 6)
end
-- Below the trees it's solid black: the forest wall stands in front of this.
for y = H - 20, H - 1 do
  for xx = 0, W - 1 do sky[y][xx] = C.void end
end

L.checkPalette(sky, P, "sky")
L.save(sky, nil, L.ASSETS .. "sky.png")
