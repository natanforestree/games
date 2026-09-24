-- Marrow's 48x48 card icon for the games page, in the dusk world: a glowing duelist on the bone
-- causeway against the evening sky, the foetus sun above, the skull on the horizon, and a cyan blade
-- meeting its own. Run from the repo root: aseprite -b --script art/marrow/icon.lua
-- Writes art/marrow/icon.aseprite, marrow/icon.png and a 4x preview at art/marrow/preview-icon.png.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local R = dofile(here .. "rig.lua")(L, P)
local body = L.readJson("marrow/data/body.json")
local D = dofile(here .. "poses.lua")(body)
local Wd = P.worlds.dusk
local ink, vi, bl, bu, ro, bn = Wd.ink, Wd.violet, Wd.blood, Wd.burnt, Wd.rose, Wd.bone
local N, GROUND = 48, 39
local b = L.buffer(N, N)

local function inside(x, y) -- a tile with rounded corners
  local cx, cy = math.min(math.max(x, 6), 41), math.min(math.max(y, 6), 41)
  return (x - cx) ^ 2 + (y - cy) ^ 2 <= 36
end

-- the sky in dithered bands, the haze low down
local stops = { { 0, ink[2] }, { 8, vi[1] }, { 15, bl[2] }, { 22, bl[3] }, { 28, bu[1] }, { 33, ro[1] }, { GROUND, vi[4] } }
for y = 0, N - 1 do
  local a, c = stops[#stops], stops[#stops]
  for k = 1, #stops - 1 do if y >= stops[k][1] and y <= stops[k + 1][1] then a, c = stops[k], stops[k + 1]; break end end
  local t = (c[1] == a[1]) and 0 or (y - a[1]) / (c[1] - a[1])
  t = math.max(0, math.min(1, (t - 0.2) / 0.6))
  for x = 0, N - 1 do
    if inside(x, y) then b[y][x] = (t > L.bayer(x, y)) and c[2] or a[2] end
  end
end
-- the sun, a foetus curled in it, a halo
local SX, SY, SR = 33, 12, 7
for y = SY - 12, SY + 12 do
  for x = SX - 12, SX + 12 do
    local d = math.sqrt((x + 0.5 - SX) ^ 2 + (y + 0.5 - SY) ^ 2)
    if inside(x, y) and b[y] and b[y][x] then
      if d <= SR then b[y][x] = (d > SR - 1) and ro[2] or ((d > SR - 2.5) and ro[3] or ro[4])
      elseif d < SR + 4 and L.bayer(x, y) < (SR + 4 - d) / 5 then b[y][x] = ro[1] end
    end
  end
end
for _, p in ipairs({ { 1, -2 }, { 2, -2 }, { 2, -1 }, { 1, -1 }, { 0, -1 }, { -1, 0 }, { -2, 1 }, { -2, 2 }, { -1, 3 }, { 0, 3 }, { 1, 2 }, { 2, 1 }, { -1, 1 }, { 0, 0 }, { 0, 1 }, { 0, 2 } }) do
  L.set(b, SX + p[1], SY + p[2], bu[1])
end
-- the skull on the horizon, hazy, and a tower of bodies
for y = 27, GROUND do
  for x = 2, 22 do
    local u, v = (x + 0.5 - 12) / 10, (y + 0.5 - 36) / 9
    if inside(x, y) and u * u + v * v <= 1 then
      b[y][x] = (v < -0.4 and u < 0) and vi[4] or vi[3]
      if ((x == 8 or x == 9) or (x == 15 or x == 16)) and (y == 34 or y == 35) then b[y][x] = vi[1] end
    end
  end
end
for y = 14, GROUND do
  local w = (y < 20) and 0 or 1
  for x = 41 - w, 42 do if inside(x, y) then b[y][x] = vi[2] end end
  if y % 6 == 2 then L.set(b, 40, y, vi[2]); L.set(b, 43, y - 1, vi[2]) end
end
-- the causeway: a pale crust over dark bone
for y = GROUND, N - 1 do
  for x = 0, N - 1 do
    if inside(x, y) then
      local c = ink[1]
      if y == GROUND then c = ro[3] elseif y == GROUND + 1 then c = bn[4] elseif y == GROUND + 2 then c = bn[2]
      elseif (x + y * 3) % 11 == 0 then c = bn[1] end
      b[y][x] = c
    end
  end
end
-- the duelist in mid stance, a cyan blade meeting its own, and a spark where they cross
local mid = body.stances[2]
R.draw(b, 18, GROUND, D.poses.stand1)
R.blade(b, 18, GROUND, mid.height, mid.reach, body.hilt)
for x = 33, 44 do if inside(x, GROUND - mid.height) then L.set(b, x, GROUND - mid.height, (x < 36) and P.cyan[4] or P.cyan[3]) end end
L.set(b, 33, GROUND - mid.height - 1, P.amber[4]); L.set(b, 34, GROUND - mid.height + 1, P.amber[3])

L.save(b, "art/marrow/icon.aseprite", "marrow/icon.png")
L.save(L.scale(b, 4), nil, "art/marrow/preview-icon.png")
print("icon written")
