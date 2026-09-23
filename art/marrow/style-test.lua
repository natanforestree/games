-- The style test: the center screen (far + fog + scene) with the amber fighter in low, mid and high
-- stance and one cyan fighter facing them, at 3x, in art/marrow/style-test.png. For review only.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local R = dofile(here .. "rig.lua")(L, P)
local body = L.readJson("marrow/data/body.json")
local D = dofile(here .. "poses.lua")(body)

local img = L.buffer(320, 180)
L.blit(img, L.load("marrow/assets/far.png"), 0, 0)
L.blit(img, L.load("marrow/assets/fog.png"), 0, 0)
L.blit(img, L.load("marrow/assets/scene-C.png"), 0, 0)

local function fighter(x, stance, facing, cyan)
  local cell = L.buffer(48, 48)
  R.draw(cell, 24, 44, D.poses["stand" .. stance])
  local st = body.stances[stance + 1]
  R.blade(cell, 24, 44, st.height, st.reach, body.hilt)
  if cyan then R.swap(cell) end
  if facing < 0 then cell = L.flip(cell) end
  L.blit(img, cell, x - 24, 150 - 44)
end
fighter(70, 0, 1)
fighter(120, 1, 1)
fighter(170, 2, 1)
fighter(236, 1, -1, true)

L.save(L.scale(img, 3), nil, "art/marrow/style-test.png")
print("style test written")
