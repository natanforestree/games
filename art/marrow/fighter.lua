-- Builds the fighter sprite sheet from the rig and poses.
-- Run from the repo root: aseprite -b --script art/marrow/fighter.lua  (or dofile it via the MCP).
-- Writes art/marrow/fighter.aseprite, marrow/assets/fighter.png, marrow/assets/fighter.json,
-- marrow/assets/palette.json (the glow ramps the game swaps, the blade colors and the ichor ramps), and
-- a 4x preview at art/marrow/preview-fighter.png: every frame over each world's darkest and mid tones.
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
local bl = P.fighter.blade
L.writeText("marrow/assets/palette.json", json.encode({
  amber = P.amber, cyan = P.cyan,
  blade = { hilt = bl[1], body = bl[2], tip = bl[3] },
  ichor = { { P.amber[2], P.amber[3], P.amber[4] }, { P.cyan[2], P.cyan[3], P.cyan[4] } },
}))

-- Preview: the sheet once per world, on bands of that world's dark and mid background tones, amber
-- above and cyan below; stance frames get their blades where the game draws them.
local grounds = {
  cathedral = { P.worlds.cathedral.crimson[1], P.worlds.cathedral.shadow[2] },
  dusk = { P.worlds.dusk.violet[3], P.worlds.dusk.violet[2] },
  abyss = { P.worlds.abyss.abyss[2], P.worlds.abyss.abyss[1] },
}
local prev = L.buffer(CW * COLS, CH * rows * 2 * #P.worldOrder)
for w, name in ipairs(P.worldOrder) do
  for half = 0, 1 do
    local oy = ((w - 1) * 2 + half) * CH * rows
    for y = 0, CH * rows - 1 do
      for x = 0, CW * COLS - 1 do prev[oy + y][x] = grounds[name][((x // CW) % 2) + 1] end
    end
    local copy = L.buffer(sheet.w, sheet.h)
    L.blit(copy, sheet, 0, 0)
    for s = 0, 2 do
      local i = index["stand" .. s]
      if i then
        local st = body.stances[s + 1]
        R.blade(copy, (i % COLS) * CW + AX, (i // COLS) * CH + AY, st.height, st.reach, body.hilt)
      end
    end
    if half == 1 then R.swap(copy) end
    L.blit(prev, copy, 0, oy)
  end
end
L.save(L.scale(prev, 4), nil, "art/marrow/preview-fighter.png")
print("fighter: " .. #D.order .. " frames")
