-- The Maw: an eyeless worm with a ring of bone teeth. On a victory screen it bursts from the floor,
-- swallows the winner and sinks back. One design, shaded in each world's palette (the `maw` table
-- each worlds/<world>.lua returns). 12 frames of 160x120 in one row. Inside a frame the floor line is
-- y = 110; the game centres a frame on the winner and puts that line on the floor (y = 150).
-- Run from the repo root: aseprite -b --script art/marrow/maw.lua
-- Writes marrow/assets/<world>/maw.png (+ art/marrow/<world>/maw.aseprite) for every world, the shared
-- marrow/assets/maw.json, and a preview of all three at art/marrow/preview-maw.png.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local S = dofile(here .. "sculpt.lua")(L)
local G = dofile(here .. "worlds/common.lua")(L)
local FW, FH, N, FLOOR = 160, 120, 12, 110
local RISE = { 12, 36, 64, 84, 90, 86, 70, 46, 28, 14, 5, 0 } -- head height above the floor
local OPEN = { 0.3, 0.7, 1.0, 1.0, 0.8, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0 } -- how far the mouth is open
local SHARDS = { 0.2, 1.0, 0.8, 0.45, 0.1, 0, 0, 0, 0, 0, 0, 0 } -- floor thrown up as it bursts out

local function frame(sheet, f, M)
  local ox = (f - 1) * FW
  local rise, open = RISE[f], OPEN[f]
  local top = FLOOR - rise
  local function sway(y) return math.sin((y - top) * 0.045 + f * 0.5) * 7 * math.min(1, rise / 40) end
  local b = L.buffer(FW, FH)
  if rise > 0 then
    -- the body: a thick ringed tube rising out of the floor, lit from the upper left, rimmed right
    local g = S.new(FW, FH, false)
    local len = FH + 8 - top
    S.tube(g, function(t)
      local y = FH + 8 - t * len
      return FW / 2 + sway(y), y
    end, function(t) return 30 - t * 6 + G.smooth(0.8, 1, t * len / (len - 4)) * 6 end, "body", 0) -- flared at the head
    S.shade(g, b, function(px)
      local ring = ((px.y - top) + math.floor(px.nx * px.nx * 4)) % 9 < 2
      local v = 0.15 + S.lambert(px, -0.5, -0.4, 0.75) * 0.9
      if px.edge then return M.outline end
      if px.nx > 0.72 and px.nz < 0.6 then return M.rim end
      if ring then return S.pick(M.ring, v, px.x, px.y, 0.5) end
      return S.pick(M.skin, v, px.x, px.y, 0.45)
    end, 3)
    -- the head: a lipped ring of inward-pointing bone teeth around the throat
    local cx = FW / 2 + sway(top)
    local mw, mh = 28, 3 + 13 * open
    for y = math.floor(top - mh - 4), math.ceil(top + mh + 4) do
      for x = math.floor(cx - mw - 4), math.ceil(cx + mw + 4) do
        local dx, dy = (x + 0.5 - cx), (y + 0.5 - top)
        local lip = (dx / (mw + 4)) ^ 2 + (dy / (mh + 4)) ^ 2
        local inner = (dx / mw) ^ 2 + (dy / math.max(1, mh)) ^ 2
        if lip <= 1 then
          local c
          if inner > 1 then -- the lip: a swollen rim, lit on its top edge
            c = (dy < 0) and M.lip[2] or M.lip[1]
            if lip > 0.9 then c = M.outline end
          else
            local d = math.sqrt(inner)
            local a = math.atan(dy / math.max(1, mh), dx / mw)
            local k = (a / (2 * math.pi) * 18) % 1 -- 18 teeth round the ring
            local toothW = 0.5 * (d - 0.42) / 0.58
            if open < 0.05 then
              c = (math.abs(dy) < 1) and M.gullet[1] or M.lip[1] -- shut: a puckered seam
              if math.abs(dy) >= 1 and (x % 5 == 0) then c = M.outline end
            elseif d > 0.42 and math.abs(k - 0.5) < toothW then
              c = S.pick(M.teeth, 1.15 - d * 0.9 + ((dy < 0) and 0 or 0.15), x, y, 0.5)
            elseif d > 0.9 then
              c = M.gullet[2]
            else
              c = S.pick(M.gullet, (1 - d) * 0.9 * open, x, y, 0.4)
            end
          end
          L.set(b, x, y, c)
        end
      end
    end
    -- the hole it tore in the floor
    for x = math.floor(FW / 2 - 40), math.ceil(FW / 2 + 40) do
      local d = (x + 0.5 - FW / 2) / 40
      local hgt = math.floor((1 - d * d) * 4)
      for y = FLOOR - 1, FLOOR + hgt do
        if not b[y][x] or math.abs(d) > 0.82 then L.set(b, x, y, (y == FLOOR - 1) and M.crust[1] or M.outline) end
      end
    end
  end
  -- shards of floor thrown up around it
  local n = math.floor(SHARDS[f] * 18)
  for i = 0, n - 1 do
    local sx = math.floor(FW / 2 + (L.rnd(f, i, 81) - 0.5) * 120)
    local sy = math.floor(FLOOR - 4 - L.rnd(i, f, 82) * 34 * SHARDS[f] - math.abs(sx - FW / 2) * 0.1)
    local c = M.crust[1 + (i % 3)]
    L.fillRect(b, sx, sy, sx + 1 + (i % 2), sy, c)
    L.set(b, sx, sy + 1, M.outline)
  end
  L.blit(sheet, b, ox, 0)
end

local worlds = {}
for _, name in ipairs(P.worldOrder) do
  local world = dofile(here .. "worlds/" .. name .. ".lua")({ L = L, S = S, G = G, P = P.worlds[name], PAL = P })
  local sheet = L.buffer(FW * N, FH)
  for f = 1, N do frame(sheet, f, world.maw) end
  L.save(sheet, "art/marrow/" .. name .. "/maw.aseprite", "marrow/assets/" .. name .. "/maw.png")
  worlds[#worlds + 1] = sheet
end
L.writeText("marrow/assets/maw.json", json.encode({ frame = { FW, FH }, frames = N, floor = FLOOR, rate = 10 }))

-- preview: each world's sheet over a strip of that world's dark, frames 1-12
local prev = L.buffer(FW * N, FH * #worlds)
for i, sheet in ipairs(worlds) do
  local w = P.worlds[P.worldOrder[i]]
  L.fillRect(prev, 0, (i - 1) * FH, prev.w - 1, i * FH - 1, w.void)
  L.blit(prev, sheet, 0, (i - 1) * FH)
end
L.save(L.scale(prev, 2), nil, "art/marrow/preview-maw.png")
print("maw: " .. N .. " frames x " .. #worlds .. " worlds")
