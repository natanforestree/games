-- Builds the fighter sprite sheet from the rig and poses.
-- Run from the repo root: aseprite -b --script art/marrow/fighter.lua  (or dofile it via the MCP).
-- Writes art/marrow/fighter.aseprite, marrow/assets/fighter.png, marrow/assets/fighter.json,
-- marrow/assets/palette.json, and a 4x preview at art/marrow/preview-fighter.png.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local R = dofile(here .. "rig.lua")(L, P)
local body = L.readJson("marrow/data/body.json")
local D = dofile(here .. "poses.lua")(body)

local CW, CH, AX, AY, COLS = 48, 48, 24, 44, 16
local rows = math.ceil(#D.order / COLS)
local sheet = L.buffer(CW * COLS, CH * rows)
local index, swords = {}, {}
for i, name in ipairs(D.order) do
  local pose = assert(D.poses[name], "no pose named " .. name)
  local cx, cy = ((i - 1) % COLS) * CW + AX, ((i - 1) // COLS) * CH + AY
  R.draw(sheet, cx, cy, pose)
  index[name] = i - 1
  if pose.sword then swords[tostring(i - 1)] = pose.sword end
end

local anims = {}
for name, a in pairs(D.anims) do
  local frames = {}
  for _, p in ipairs(a.frames) do frames[#frames + 1] = assert(index[p], "anim " .. name .. " uses unknown pose " .. p) end
  anims[name] = { frames = frames, rate = a.rate or 0, loop = a.loop ~= false }
end

L.save(sheet, "art/marrow/fighter.aseprite", "marrow/assets/fighter.png")
L.writeText("marrow/assets/fighter.json", json.encode({ cell = { CW, CH }, anchor = { AX, AY }, cols = COLS, anims = anims, swords = swords }))
L.writeText("marrow/assets/palette.json", json.encode({ amber = P.amber, cyan = P.cyan }))

-- Preview: every frame on a dark ground; stance frames get their blades where the game draws them.
local prev = L.buffer(CW * COLS, CH * rows)
L.fillRect(prev, 0, 0, prev.w - 1, prev.h - 1, P.umber1)
L.blit(prev, sheet, 0, 0)
for s = 0, 2 do
  local i = index["stand" .. s]
  local st = body.stances[s + 1]
  R.blade(prev, (i % COLS) * CW + AX, (i // COLS) * CH + AY, st.height, st.reach, body.hilt)
end
L.save(L.scale(prev, 4), nil, "art/marrow/preview-fighter.png")
print("fighter: " .. #D.order .. " frames")
