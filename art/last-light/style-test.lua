-- The style test: one review sheet of Last Light's art, scaled 3x into
-- art/last-light/preview-style.png (not committed). Top to bottom: the palette; every texture at
-- three light levels (full lantern light, half, and the dim edge of the light), shaded the way the
-- game shades them (last-light/src/shade.js); a slice of the sky; and every sprite's frames, at full
-- light and dim. Run it after the other scripts:
--   aseprite -b --script art/last-light/style-test.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()

-- shade.js's light tables, for one colour at level l (0-15).
local FOG, COLD, WARM = { 6, 8, 14 }, { 0.7, 0.8, 1.0 }, { 1.08, 0.92, 0.72 }
local glow = {}
for _, n in ipairs(P.glow) do glow[P.hex[n]] = true end
local function shade(hex, l)
  if glow[hex] then return hex end
  local k = l / 15
  local t = k ^ 1.4
  local r, g, b = L.channels(hex)
  local out = {}
  for i, v in ipairs({ r, g, b }) do
    local tint = COLD[i] + (WARM[i] - COLD[i]) * k
    out[i] = math.max(0, math.min(255, math.floor(FOG[i] + (v * tint - FOG[i]) * t + 0.5)))
  end
  return string.format("#%02x%02x%02x", out[1], out[2], out[3])
end
local function lit(src, l)
  local b = L.buffer(src.w, src.h)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then b[y][x] = shade(c:sub(1, 7), l) end
    end
  end
  return b
end

local tex = L.load(L.ASSETS .. "textures.png")
local texMeta = L.readJson(L.ASSETS .. "textures.json")
local sky = L.load(L.ASSETS .. "sky.png")
local spr = L.load(L.ASSETS .. "sprites.png")
local sprMeta = L.readJson(L.ASSETS .. "sprites.json").sprites
local names = {}
for name in pairs(sprMeta) do names[#names + 1] = name end
table.sort(names)

local LEVELS = { 15, 9, 4 }
local W = math.max(#texMeta.names * 34, 520)
local H = 12 + 3 * 34 + 72 + 8
for _, n in ipairs(names) do H = H + sprMeta[n].h * 2 + 6 end
local out = L.buffer(W, H)
L.fillRect(out, 0, 0, W - 1, H - 1, P.hex.void)
-- The palette, in index order.
for i, n in ipairs(P.order) do L.fillRect(out, (i - 1) * 8, 0, (i - 1) * 8 + 7, 7, P.hex[n]) end
-- The textures at three light levels.
local y = 12
for row, l in ipairs(LEVELS) do
  for i = 1, #texMeta.names do
    L.blit(out, lit(L.crop(tex, (i - 1) * 32, 0, 32, 32), l), (i - 1) * 34, y + (row - 1) * 34)
  end
end
y = y + 3 * 34
-- A slice of the sky at the night's level.
L.blit(out, lit(L.crop(sky, 0, math.max(0, sky.h - 72), math.min(W, sky.w), math.min(72, sky.h)), 4), 0, y)
y = y + 72 + 8
-- Every sprite: all frames lit, then dim.
for _, n in ipairs(names) do
  local s = sprMeta[n]
  local strip = L.crop(spr, s.x, s.y, s.w * s.count, s.h)
  L.blit(out, lit(strip, 15), 0, y)
  L.blit(out, lit(strip, 6), 0, y + s.h + 2)
  y = y + s.h * 2 + 6
end
L.save(L.scale(out, 3), nil, L.ART .. "preview-style.png")
print("style test written: " .. L.ART .. "preview-style.png")
