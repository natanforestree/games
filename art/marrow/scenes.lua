-- Marrow's backgrounds, drawn procedurally. Run from the repo root:
--   aseprite -b --script art/marrow/scenes.lua
-- Writes to marrow/assets/ (and .aseprite sources to art/marrow/):
--   far.png         distant tumor towers and organ-pipe spines over umber murk (opaque, slow parallax)
--   fog.png         sickly yellow-green haze (translucent, faster parallax)
--   scene-<X>.png   each screen type's architecture, painted over its collision grid from
--                   marrow/data/screens.json; transparent where the grid is empty
--   scenes.json     per scene: anchor points for the game's pulsing vessels and drips
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local W, H, TILE = 320, 180, 10
local grids = L.readJson("marrow/data/screens.json").screens

-- Solid test in pixels. Rows past the top or bottom repeat the edge row, and columns clamp, so floors
-- and ceilings continue past the frame instead of showing an edge.
local function solid(grid, x, y)
  local c = math.max(0, math.min(31, math.floor(x / TILE)))
  local r = math.max(0, math.min(#grid - 1, math.floor(y / TILE)))
  return grid[r + 1]:sub(c + 1, c + 1) == "#"
end

local function far()
  local b = L.buffer(W, H)
  local sky = { P.void, P.umber0, P.umber1, P.umber2 }
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      local t = (y / (H - 1)) * (#sky - 1)
      local i = math.floor(t)
      local c = sky[i + 1]
      if sky[i + 2] and (t - i) > L.bayer(x, y) then c = sky[i + 2] end
      b[y][x] = c
    end
  end
  -- tumor towers: stacks of swollen growths, lit faintly from the upper left
  for i = 0, 6 do
    local cx = 18 + i * 48 + math.floor(L.rnd(i, 1, 11) * 24)
    local y, r = H + 6, 14 + L.rnd(i, 2, 11) * 8
    local top = 30 + L.rnd(i, 3, 11) * 50
    while y - r > top and r > 3 do
      local bx = cx + (L.rnd(i, math.floor(y), 12) - 0.5) * 10
      for py = math.floor(y - r), math.floor(y + r) do
        for px = math.floor(bx - r), math.floor(bx + r) do
          local dx, dy = (px + 0.5 - bx) / r, (py + 0.5 - y) / r
          if dx * dx + dy * dy <= 1 then
            local lit = -dx * 0.6 - dy * 0.8
            local c = P.umber1
            if lit > 0.55 + L.rnd(px, py, 13) * 0.2 then c = P.umber3 elseif lit > 0.2 then c = P.umber2 end
            if L.rnd(px, py, 14) > 0.97 then c = P.umber0 end
            L.set(b, px, py, c)
          end
        end
      end
      y = y - r * 1.15
      r = r * (0.72 + L.rnd(i, math.floor(r), 15) * 0.15)
    end
  end
  -- organ-pipe spines: columns of stacked vertebrae in front of the towers
  for i = 0, 8 do
    local cx = 10 + i * 38 + math.floor(L.rnd(i, 4, 16) * 16)
    local top = 40 + math.floor(L.rnd(i, 5, 16) * 70)
    local w = 2 + math.floor(L.rnd(i, 6, 16) * 2)
    for y = top, H - 1 do
      local seg = (y - top) % 6
      local ww = (seg == 0) and w + 1 or w
      for x = cx - ww, cx + ww do
        local c = P.umber2
        if seg == 0 then c = P.umber3
        elseif x == cx - ww then c = P.umber1
        elseif x >= cx + ww - 1 then c = P.flesh0 end
        L.set(b, x, y, c)
      end
    end
    L.disc(b, cx + 0.5, top, w + 1.5, P.umber3)
    L.disc(b, cx + 1, top - 1, w - 0.5, P.flesh0)
  end
  return b
end

local function fog()
  local b = L.buffer(W, H)
  for y = 60, H - 1 do
    for x = 0, W - 1 do
      local band = math.sin(y * 0.09 + math.sin(x * 0.02) * 1.5) * 0.5 + 0.5
      local depth = (y - 60) / (H - 60)
      local a = depth * 0.5 + band * 0.25 * depth
      if a > L.bayer(x, y) * 0.9 + 0.1 then b[y][x] = (a > 0.55) and (P.sick1 .. "70") or (P.sick0 .. "60") end
    end
  end
  return b
end

-- Paints every solid tile as fused bone and flesh: a bone crust where it faces up (with vertebral
-- seams every 20px), wet flesh where it faces down or sideways, layered meat with sinew streaks
-- inside, darker with depth.
local function paintSolids(b, grid, seed)
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      if solid(grid, x, y) then
        local up = 0
        while up < 8 and solid(grid, x, y - up - 1) do up = up + 1 end
        local down = 0
        while down < 4 and solid(grid, x, y + down + 1) do down = down + 1 end
        local side = 99
        for d = 1, 3 do
          if not solid(grid, x - d, y) or not solid(grid, x + d, y) then side = d; break end
        end
        local n = L.rnd(x, y, seed)
        local c
        if up == 0 then c = (n > 0.3) and P.bone3 or P.bone2
        elseif up == 1 then c = P.bone2
        elseif up == 2 then c = (n > 0.5) and P.bone1 or P.flesh3
        elseif down < 2 then c = (down == 0) and P.rust1 or P.flesh1
        elseif side <= 1 then c = P.flesh1
        elseif side == 2 then c = P.flesh0
        else
          local depth = math.min(1, (up - 3) / 30)
          local streak = math.sin(x * 0.35 + math.sin(y * 0.2) * 2 + y * 0.05) > 0.85
          c = streak and P.flesh1 or ((depth + n * 0.3 > 0.6) and P.umber2 or P.umber3)
          if n > 0.985 then c = P.rust0 end
        end
        if up <= 2 and x % 20 == 0 then c = P.umber3 end
        b[y][x] = c
      end
    end
  end
end

-- C: a ribbed, cathedral-like chamber built from a ribcage over an open floor.
local function sceneC(grid)
  local b = L.buffer(W, H)
  local anchors = { vessels = {}, drips = {} }
  -- five pairs of ribs, far (dark, inner) to near (lighter, outer), bowing out and meeting overhead
  local bodyC = { P.bone0, P.flesh0, P.umber3, P.umber2, P.umber2 }
  local edgeC = { P.bone1, P.bone0, P.flesh0, P.umber3, P.umber3 }
  for i = 4, 0, -1 do
    for side = -1, 1, 2 do
      local fx = (side < 0) and (16 + i * 28) or (W - 16 - i * 28)
      local x0, y0 = fx, 150
      local x1, y1 = fx + side * 30, 30 + i * 6
      local x2, y2 = W / 2 + side * (4 + i * 5), 16 + i * 3
      for s = 0, 80 do
        local t = s / 80
        local u = 1 - t
        local x = u * u * x0 + 2 * u * t * x1 + t * t * x2
        local y = u * u * y0 + 2 * u * t * y1 + t * t * y2
        local r = 3.4 - 2.0 * t
        L.disc(b, x, y, r, bodyC[i + 1])
        L.disc(b, x - side * 0.9, y - 0.5, math.max(0.6, r - 1.8), edgeC[i + 1])
      end
    end
  end
  -- the spine along the top of the vault
  for x = 0, W - 1, 7 do
    local y = 10 + math.floor(math.sin(x * 0.04) * 2)
    L.disc(b, x + 3.5, y, 4, P.umber3)
    L.disc(b, x + 3, y - 1, 2.5, P.bone0)
    L.set(b, x, y, P.umber0)
  end
  -- sinews hanging from the spine; their ends drip, and vessels pulse along them
  for i = 0, 9 do
    local x = 28 + i * 29 + math.floor(L.rnd(i, 7, 21) * 10)
    local len = 24 + math.floor(L.rnd(i, 8, 21) * 60)
    for y = 14, 14 + len do
      local sx = x + math.floor(math.sin(y * 0.15 + i) * 1.5)
      L.set(b, sx, y, (y % 5 == 0) and P.rust1 or P.rust0)
      if y % 17 == 0 then anchors.vessels[#anchors.vessels + 1] = { sx, y } end
      if y == 14 + len then anchors.drips[#anchors.drips + 1] = { sx, y + 1, 150 } end
    end
  end
  paintSolids(b, grid, 31)
  return b, anchors
end

local SCENES = { C = sceneC }

L.save(far(), "art/marrow/far.aseprite", "marrow/assets/far.png")
L.save(fog(), "art/marrow/fog.aseprite", "marrow/assets/fog.png")
local meta = {}
for name, paint in pairs(SCENES) do
  local img, anchors = paint(grids[name])
  L.save(img, "art/marrow/scene-" .. name .. ".aseprite", "marrow/assets/scene-" .. name .. ".png")
  meta[name] = anchors
end
L.writeText("marrow/assets/scenes.json", json.encode(meta))
print("scenes written")
