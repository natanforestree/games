-- The GO arrow: a glowing, twisted sinew with a barbed head, pointing right, pulsing over 4 frames of
-- 24x12 -> marrow/assets/arrow.png and arrow.json (+ art/marrow/arrow.aseprite). Drawn in the amber
-- ramp with the fighters' dark outline, so it reads over every world; the game swaps it to cyan for
-- the CPU and flips it to point left. Run from the repo root: aseprite -b --script art/marrow/ui.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local FW, FH, N = 24, 12, 4
local A, INK = P.amber, P.fighter.outline
local b = L.buffer(FW * N, FH)
for f = 1, N do
  local ox = (f - 1) * FW
  local hot = (f == 2 or f == 3)
  local cell = L.buffer(FW, FH)
  for x = 1, 14 do -- the sinew: a thick cord of twisted fibre, a pulse of light running along it
    local twist = (x + f) % 4 == 0
    local pulse = (x - f * 4) % 16 < 3
    local sag = (x < 5) and 1 or 0
    L.set(cell, x, 5 + sag, twist and A[1] or A[3])
    L.set(cell, x, 6 + sag, pulse and A[4] or (twist and A[2] or A[3]))
    L.set(cell, x, 7 + sag, twist and A[3] or A[2])
  end
  for x = 12, 22 do -- the barbed head: a spear point whose back corners hook back into barbs
    local half = (22 - x) * 0.5
    for y = 0, FH - 1 do
      local d = math.abs(y + 0.5 - 6)
      if d <= half + 0.5 and x >= 14 then
        local edge = d > half - 0.5
        L.set(cell, x, y, edge and (hot and A[4] or A[3]) or ((y < 6) and A[3] or A[2]))
      end
    end
  end
  for s = -1, 1, 2 do
    L.set(cell, 13, 6 + s * 4, hot and A[4] or A[3]); L.set(cell, 12, 6 + s * 5, A[3]); L.set(cell, 11, 6 + s * 5, A[2])
    L.set(cell, 14, 6 + s * 3, A[3])
  end
  local out = L.buffer(FW, FH) -- the dark outline round it all, so it reads over any world
  for y = 0, FH - 1 do
    for x = 0, FW - 1 do
      if not cell[y][x] then
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          if L.get(cell, x + d[1], y + d[2]) then out[y][x] = INK; break end
        end
      end
    end
  end
  L.blit(out, cell, 0, 0)
  L.blit(b, out, ox, 0)
end
L.save(b, "art/marrow/arrow.aseprite", "marrow/assets/arrow.png")
L.writeText("marrow/assets/arrow.json", json.encode({ frame = { FW, FH }, frames = N }))
L.save(L.scale(b, 8), nil, "art/marrow/preview-arrow.png")
print("arrow: " .. N .. " frames")
