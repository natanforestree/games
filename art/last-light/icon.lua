-- Last Light's 48x48 tab icon: the cabin in the snow under the night sky, its window lit, snow on its
-- roof and smoke from its chimney, and two pairs of eyes in the black pines behind it. Run from the
-- repo root: aseprite -b --script art/last-light/icon.lua
-- Writes art/last-light/icon.aseprite and last-light/icon.png.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()
local C = P.c
local N = 48
local b = L.buffer(N, N)

-- A tile with rounded corners.
local function inside(x, y)
  local cx, cy = math.min(math.max(x, 6), 41), math.min(math.max(y, 6), 41)
  return (x - cx) ^ 2 + (y - cy) ^ 2 <= 36
end
local function put(x, y, c) if inside(x, y) then L.set(b, x, y, c) end end

-- The sky, in bands dark at the top and lightening towards the trees, softened where they meet, and a
-- few stars.
local BANDS = { { 0, C.night1 }, { 12, C.night2 }, { 22, C.night3 }, { 29, C.night4 } }
for y = 0, N - 1 do
  for x = 0, N - 1 do
    local c = BANDS[1][2]
    for i, band in ipairs(BANDS) do
      if y >= band[1] then c = band[2] end
      if i > 1 and y >= band[1] - 2 and y < band[1] and L.bayer(x, y) < 0.35 * (y - band[1] + 3) then c = band[2] end
    end
    put(x, y, c)
  end
end
for _, s in ipairs({ { 9, 5 }, { 20, 3 }, { 33, 7 }, { 41, 4 }, { 14, 11 }, { 27, 12 }, { 38, 13 } }) do put(s[1], s[2], C.star) end

-- The pines behind the clearing: a black, jagged treeline, with a few tall spires.
for i, t in ipairs({ { -1, 16 }, { 4, 21 }, { 8, 15 }, { 12, 19 }, { 17, 14 }, { 22, 17 }, { 27, 15 }, { 32, 20 }, { 36, 14 }, { 40, 22 }, { 45, 17 }, { 49, 19 } }) do
  local top = 35 - t[2]
  for y = top, 36 do
    local half = (y - top) * 0.42 + ((y - top) % 4 == 3 and 1 or 0)
    for x = math.floor(t[1] - half), math.ceil(t[1] + half) do put(x, y, C.void) end
  end
end
-- Two pairs of eyes, watching from the trees.
for _, e in ipairs({ { 5, 28 }, { 41, 26 } }) do put(e[1], e[2], C.eye2); put(e[1] + 2, e[2], C.eye2) end

-- The snow of the clearing, and the window's light falling on it.
for y = 35, N - 1 do
  for x = 0, N - 1 do put(x, y, (y < 38) and C.snow1 or (y < 43) and C.snow2 or C.snow3) end
end
for y = 42, 46 do
  for x = 26 + (y - 42), 33 + (y - 42) do if L.bayer(x, y) < 0.6 - (y - 42) * 0.1 then put(x, y, C.fire3) end end
end

-- The cabin: log walls, the logs' ends at the corners, a door, the lit window.
for y = 29, 41 do
  for x = 11, 36 do
    local log = math.floor((y - 29) / 2)
    local c = ((y - 29) % 2 == 1) and C.wood1 or ((log % 2 == 0) and C.wood3 or C.wood2)
    if x == 11 or x == 36 then c = ((y - 29) % 2 == 0) and C.wood4 or C.wood0 end
    put(x, y, c)
  end
end
for y = 33, 41 do for x = 15, 19 do put(x, y, (x == 15 or y == 33) and C.wood0 or C.wood1) end end
put(18, 37, C.brass1)
for y = 31, 37 do
  for x = 25, 32 do
    local frame = x == 25 or x == 32 or y == 31 or y == 37 or x == 28 or x == 29 or y == 34
    put(x, y, frame and C.wood1 or ((x + y) % 5 == 0) and C.fire4 or C.window)
  end
end
for _, g in ipairs({ { 24, 33 }, { 24, 35 }, { 33, 33 }, { 33, 35 }, { 27, 30 }, { 30, 30 }, { 27, 38 }, { 30, 38 } }) do put(g[1], g[2], C.fire3) end
-- Drifts against the walls.
for x = 9, 38 do
  local h = 1 + ((x < 15 or x > 32) and 1 or 0) + ((x % 5 == 0) and 1 or 0)
  for y = 42 - h, 41 do if x < 15 or x > 19 then put(x, y, (x < 24) and C.snow3 or C.snow2) end end
end

-- The roof: a steep gable under a thick cap of snow, its eaves hanging over the walls.
for y = 18, 30 do
  local half = (y - 17) * 1.35 + 1
  for x = math.floor(24 - half), math.ceil(23 + half) do
    if x >= 8 and x <= 39 then
      local edge = y >= 28
      put(x, y, edge and ((y == 30) and C.wood0 or C.wood1) or ((x < 24) and C.snow4 or C.snow3))
    end
  end
end
for x = 8, 39 do if x % 3 == 0 then put(x, 30, C.snow3) end end
-- The chimney, and smoke going up from it.
for y = 17, 24 do for x = 30, 32 do put(x, y, (x == 30) and C.stone2 or C.stone1) end end
put(30, 16, C.snow3); put(31, 16, C.snow4); put(32, 16, C.snow3)
for i, s in ipairs({ { 31, 14 }, { 32, 12 }, { 31, 11 }, { 33, 9 }, { 34, 8 }, { 33, 6 } }) do put(s[1], s[2], (i < 4) and C.snow1 or C.snow0) end

L.save(b, L.ART .. "icon.aseprite", "last-light/icon.png")
print("icon written")
