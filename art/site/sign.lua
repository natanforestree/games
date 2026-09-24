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
