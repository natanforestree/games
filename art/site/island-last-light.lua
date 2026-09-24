-- The Last Light island for the games page: a floating chunk of the snowy clearing on a winter night.
-- A little log cabin stands in the snow with one window lit, snow thick on its roof and smoke from its
-- chimney, and dark pines crowd round it. Frozen earth hangs underneath, with icicles and roots. Flakes
-- drift off the edges, the window flickers, and now and then a pair of eyes opens in the pines. Run from
-- the repo root:
--   aseprite -b --script art/site/island-last-light.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local I = dofile(here .. "island.lua")
local W, H, N, MS = 120, 104, 12, 200
local C = P.lastLight
local OUTLINE = C.night1

local CX, CY, RX, RY = 60, 58, 50, 12 -- the snowy top
local TIPX, TIPY = 57, 90             -- where the underside narrows to

-- The window's brightness in each frame (1 dim .. 3 bright), and the frames in which the eyes are open.
local FLAME = { 2, 3, 2, 2, 1, 2, 3, 3, 2, 1, 2, 3 }
local EYES_OPEN = { [7] = true, [8] = true }
local EYES = { 85, 42 } -- the left eye; the right one is two pixels on

-- Light comes from the top-left, slightly toward the viewer (the moon, as on the other islands).
local function light(nx, ny, nz)
  local lx, ly, lz = -0.5, -0.7, 0.5
  local n = math.sqrt(nx * nx + ny * ny + nz * nz)
  return (nx * lx + ny * ly + nz * lz) / (n * math.sqrt(lx * lx + ly * ly + lz * lz))
end

-- Is pixel (x, y) inside the ellipse? Also returns its normalised offsets from the centre.
local function ell(x, y, cx, cy, rx, ry)
  local dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
  return dx * dx + dy * dy <= 1, dx, dy
end

local function copy(b)
  local c = L.buffer(b.w, b.h)
  for y = 0, b.h - 1 do for x = 0, b.w - 1 do c[y][x] = b[y][x] end end
  return c
end

-- A layer painted by fn(layer), outlined on its own and then drawn over b.
local function piece(b, fn)
  local one = L.buffer(W, H)
  fn(one)
  L.outline(one, OUTLINE)
  L.blit(b, one, 0, 0)
end

local function isSnow(c) return c == C.snow1 or c == C.snow2 or c == C.snow3 or c == C.snow4 end

-- The snowy top's lower edge at column x.
local function rimBelow(x)
  local u = math.max(-1, math.min(1, (x + 0.5 - CX) / RX))
  return CY + RY * math.sqrt(1 - u * u)
end

-------------------------------------------------------------------------------------------------
-- The island itself: frozen earth under a thick cap of snow

-- The underside: a band of packed snow under the rim, then a rough cone of frozen earth hanging to the
-- tip. Each side steps in and out by its own noise, and the columns hang by a pixel or two.
local function inUnderside(x, y)
  if y + 0.5 < CY then return false end
  for k = 1, 4 do if ell(x, y, CX, CY + k, RX - k * 0.5, RY) then return true end end
  local yy = y - math.floor(L.rnd(math.floor(x / 2), 0, 61) * 3)
  local t = (yy + 0.5 - CY) / (TIPY - CY)
  if t > 1 then return false end
  local c = CX + (TIPX - CX) * t
  local hw = (RX - 3) * (1 - t) ^ 0.8
  local band = math.floor(yy / 3)
  local left = c - hw - (L.rnd(band, 1, 62) - 0.5) * 5
  local right = c + hw + (L.rnd(band, 2, 62) - 0.5) * 5
  return x + 0.5 >= left and x + 0.5 <= right
end

-- The underside's colour: the snow's crust under the rim, then frozen earth going from brown to a cold
-- blue-black with depth, lighter on the left (toward the light), with frost specks.
local function earth(x, y)
  local depth = y + 0.5 - rimBelow(x)
  local t = math.max(0, (y + 0.5 - CY) / (TIPY - CY))
  local hw = math.max(4, (RX - 3) * (1 - math.min(1, t)) ^ 0.8)
  local u = (x + 0.5 - (CX + (TIPX - CX) * t)) / hw -- -1 at the left edge, 1 at the right
  if depth < 2 then return (u < -0.2) and C.snow2 or C.snow1 end
  local v = depth + math.sin(x * 0.29) * 1.2 + math.sin(x * 0.13 + 1) * 1.5 + u * 4
  local c
  if v < 7 then c = C.bark3 elseif v < 14 then c = C.bark2 elseif v < 21 then c = C.stone0 else c = C.night3 end
  local r = L.rnd(x, y, 63)
  if r < 0.05 then c = (c == C.bark3) and C.bark2 or C.night3 end
  if r > 0.965 and v < 18 then c = C.snow0 end -- frost
  if u < -0.8 and c == C.bark2 then c = C.bark3 end -- the lit left edge
  if u > 0.75 and v > 6 then c = C.night3 end       -- the shaded right edge
  return c
end

-- A stone set in the earth, lit from the top-left, with frost on its top.
local function stone(b, cx, cy, rx, ry)
  for y = math.floor(cy - ry), math.ceil(cy + ry) do
    for x = math.floor(cx - rx), math.ceil(cx + rx) do
      local inside, dx, dy = ell(x, y, cx, cy, rx, ry)
      if inside and b[y][x] then
        local v = light(dx, dy, math.sqrt(math.max(0, 1 - dx * dx - dy * dy)))
        b[y][x] = (v > 0.75) and C.snow1 or ((v > 0.3) and C.stone2 or ((v > -0.2) and C.stone1 or C.stone0))
      end
    end
  end
end

-- The snowy top: moonlit toward the back-left, blue in the shade toward the front rim, with a glint or two.
local function snowTop(b)
  for y = CY - RY - 1, CY + RY + 1 do
    for x = CX - RX - 1, CX + RX + 1 do
      local top, dx, dy = ell(x, y, CX, CY, RX, RY)
      if top then
        local d = math.sqrt(dx * dx + dy * dy)
        local lit = -dx * 0.55 - dy * 0.8 + (L.rnd(x, y, 64) - 0.5) * 0.3
        local c = C.snow1
        if lit > 0.05 then c = C.snow2 end
        if lit > 0.55 and d < 0.9 then c = C.snow3 end
        if d > 0.84 and dy > 0.2 then c = C.snow1 end
        local r = L.rnd(x, y, 65)
        if r < 0.04 then c = C.snow0 elseif r > 0.97 and c ~= C.snow1 then c = C.snow3 end
        b[y][x] = c
      end
    end
  end
  -- the snow's lip hangs over the earth in places
  for x = CX - RX, CX + RX do
    local y = math.floor(rimBelow(x) + 0.5)
    if b[y] and b[y][x] and y > CY then
      b[y][x] = C.snow1
      if L.rnd(x, 0, 66) < 0.3 then L.set(b, x, y + 1, C.snow1) end
    end
  end
end

-- A shadow on the snow: each snow pixel inside the ellipse turns one step bluer.
local function snowShadow(b, cx, cy, rx, ry)
  for y = math.floor(cy - ry), math.ceil(cy + ry) do
    for x = math.floor(cx - rx), math.ceil(cx + rx) do
      local c = L.get(b, x, y)
      if ell(x, y, cx, cy, rx, ry) then
        if c == C.snow3 or c == C.snow4 then b[y][x] = C.snow2 elseif c == C.snow2 then b[y][x] = C.snow1 end
      end
    end
  end
end

-------------------------------------------------------------------------------------------------
-- The pines: dark tiers of needles, with snow lying along the top of each tier

-- A pine whose trunk stands at (cx, by), h tall and hw wide at its lowest tier, in `tiers` tiers.
local function pine(s, cx, by, h, hw, tiers, seed)
  local top = by - h
  local crown = by - 3 -- the lowest tier's lower edge
  for y = crown - 2, by do L.set(s, cx - 1, y, C.bark2); L.set(s, cx, y, C.bark1) end
  local tierH = (crown - top) / tiers
  for y = top, crown do
    local k = (y - top) / tierH
    local i = math.min(tiers - 1, math.floor(k))
    local within = math.min(1, k - i) -- 0 at a tier's top, 1 at its bottom
    local reach = hw * (0.3 + 0.7 * (i + 1) / tiers)
    local half = (i == 0) and (0.5 + reach * within) or (reach * (0.45 + 0.55 * within))
    if within > 0.7 then half = half + (L.rnd(y, i, seed) - 0.5) * 1.5 end -- ragged bough tips
    for x = math.floor(cx - half), math.ceil(cx + half) - 1 do
      local u = (x + 0.5 - cx) / math.max(1, half)
      if not (within > 0.8 and math.abs(u) > 0.5 and L.rnd(x, y, seed + 1) < 0.3) then
        local v = -u * 0.7 - within * 0.5 + 0.1 + (L.rnd(x, y, seed + 2) - 0.5) * 0.4
        local c = (v > 0.45) and C.needle2 or ((v > -0.1) and C.needle1 or C.needle0)
        -- the snow on the tier: a band across its top that droops toward the bough tips, thick on the
        -- lit left and patchy on the shaded right
        local down = (y + 0.5 - top) - i * tierH
        local lie = (i == 0) and 1.2 or (0.9 + 1.8 * u * u)
        if down < lie + 0.4 and down > lie - 1.6 and u < 0.55 and (u < 0 or L.rnd(x, y, seed + 3) < 0.55) then
          c = (u < -0.35) and C.snow3 or C.snow2
          if u < -0.6 and down < lie - 0.6 then c = C.snow4 end
        end
        L.set(s, x, y, c)
      end
    end
  end
end

local function backPines(b)
  piece(b, function(s) pine(s, 21, 53, 27, 9, 3, 71) end)
  piece(b, function(s) pine(s, 97, 50, 24, 8, 3, 75) end)
  piece(b, function(s)
    pine(s, 86, 55, 40, 11, 4, 73)
    -- a dark pocket under a bough, where something waits
    for x = EYES[1] - 1, EYES[1] + 3 do L.set(s, x, EYES[2], C.needle0) end
    for x = EYES[1], EYES[1] + 2 do L.set(s, x, EYES[2] + 1, C.needle0) end
  end)
end

local function frontPine(b)
  piece(b, function(s) pine(s, 104, 64, 20, 7, 3, 81) end)
end

-------------------------------------------------------------------------------------------------
-- The cabin, like the game's icon: its gable end faces us, with the door and the lit window, its long
-- side runs back to the right, and snow lies thick on its steep roof. Each pixel is found by marching
-- back along the line of sight through the cabin's parts (world X right, Y up, Z back; on screen
-- x = X + Z and y = -Y - Z/2) and taking the first one it meets, and the face it came in through.

local X0, Y0 = 34, 65                -- the screen pixel of the front wall's bottom-left corner
local FW, DZ, WH, GH = 21, 14, 12, 10 -- the front's width, the depth, the walls' height, the roof's rise
local OHX, OHZ, ROOF = 2, 1, 3        -- how far the eaves overhang the sides and the front; the roof's thickness
local MID = FW / 2
local CHIM = { 14, 17, 9, 12, WH + GH + ROOF + 1 } -- the chimney: X from, to; Z from, to; its top

-- The roof's underside above X: the ridge runs back along the middle.
local function eave(X) return WH + GH * (1 - math.abs(X - MID) / MID) end

local function part(X, Y, Z)
  if X >= CHIM[1] and X < CHIM[2] and Z >= CHIM[3] and Z < CHIM[4] and Y >= WH and Y < CHIM[5] then return "chimney" end
  if X >= -OHX and X < FW + OHX and Z >= -OHZ and Z < DZ + OHZ then
    local e = eave(X)
    if Y >= e and Y < e + ROOF then return "roof" end
  end
  if X >= 0 and X < FW and Z >= 0 and Z < DZ and Y >= 0 then
    if Y < WH then return "wall" end
    if Y < eave(X) then return "gable" end
  end
end

-- The face a line of sight came in through, from the last empty point before it: the front (facing us),
-- the side (facing right) or the top.
local function face(kind, X, Y, Z)
  local x1, z0 = FW, 0
  if kind == "roof" then x1, z0 = FW + OHX, -OHZ elseif kind == "chimney" then x1, z0 = CHIM[2], CHIM[3] end
  if Z < z0 then return "front" end
  if X >= x1 then return "side" end
  return "top"
end

local SURF = L.buffer(W, H)
do
  local STEP = 0.05
  for y = 10, Y0 do
    for x = X0 - OHX - OHZ - 1, X0 + FW + OHX + DZ + OHZ + 1 do
      for i = math.floor(-(OHZ + 1) / STEP), math.ceil((DZ + OHZ) / STEP) do
        local Z = i * STEP
        local X, Y = x + 0.5 - X0 - Z, Y0 + 1 - (y + 0.5) - Z / 2
        local kind = part(X, Y, Z)
        if kind then
          SURF[y][x] = { kind = kind, face = face(kind, X + STEP, Y + STEP / 2, Z - STEP), X = X, Y = Y, Z = Z }
          break
        end
      end
    end
  end
end

-- The window in the front wall (its glass is lit frame by frame) and the door beside it.
local WIN = { 12, 19, 3, 10 } -- X from, to; Y from, to
local function onWindow(p) return p.kind == "wall" and p.face == "front" and p.X >= WIN[1] and p.X < WIN[2] and p.Y >= WIN[3] and p.Y < WIN[4] end
local function onGlass(p)
  if not onWindow(p) then return false end
  local gx, gy = math.floor(p.X) - WIN[1], math.floor(p.Y) - WIN[3]
  return gx ~= 0 and gx ~= 3 and gx ~= 6 and gy ~= 0 and gy ~= 3 and gy ~= 6
end

local function cabinColour(p, x, y)
  local row = math.floor(p.Y) % 3 -- logs are three rows: a lit top, the middle, a dark seam under
  if p.kind == "chimney" then
    if p.face == "top" then return C.stone0 end
    local c = (p.face == "front") and C.stone2 or C.stone1
    if L.rnd(x, y, 96) < 0.2 then c = (p.face == "front") and C.stone3 or C.stone0 end
    if p.Y >= CHIM[5] - 1 then c = (p.face == "front") and C.snow4 or C.snow3 end -- snow on its rim
    return c
  elseif p.kind == "roof" then
    local up = p.Y - eave(p.X) -- 0 at the eave's board, up to ROOF at the snow's top
    if p.face == "front" then  -- the snow's thick edge along the gable, lit on the left
      return (p.X < MID) and C.snow4 or C.snow3
    elseif p.face == "side" then -- the eave's edge along the long side, in shade
      return (up < 1) and C.wood0 or C.snow2
    end
    -- the right-hand slope, turned from the light: brighter at the ridge, bluer toward the eave
    local down = (p.X - MID) / (MID + OHX)
    local c = (down < 0.15) and C.snow4 or ((down < 0.6) and C.snow3 or C.snow2)
    if L.rnd(x, y, 91) < 0.07 then c = (c == C.snow2) and C.snow1 or C.snow2 end
    return c
  elseif p.kind == "gable" then -- the gable end above the door: lit logs, a little dark vent
    local c = (row == 2) and C.wood3 or ((row == 1) and C.wood2 or C.wood1)
    if math.abs(p.X - MID) < 1.5 and p.Y >= WH + 4 and p.Y < WH + 6 then c = C.void end
    return c
  elseif p.face == "front" then -- the front wall: lit logs, their cut ends at the corners
    local c = (row == 2) and C.wood4 or ((row == 1) and C.wood3 or C.wood1)
    if row == 2 and L.rnd(x, y, 92) < 0.2 then c = C.wood3 end
    if row == 1 and L.rnd(x, y, 97) < 0.15 then c = C.wood2 end
    if p.X < 1 or p.X >= FW - 1 then c = (row == 0) and C.wood0 or ((row == 2) and C.wood5 or C.wood3) end
    if p.X >= 3 and p.X < 8 and p.Y < 9 then -- the door
      c = (p.X < 4 or p.Y >= 8) and C.wood0 or ((math.floor(p.X) == 5) and C.wood2 or C.wood1)
      if math.floor(p.X) == 6 and math.floor(p.Y) == 4 then c = C.brass1 end
    end
    if onWindow(p) then c = C.wood1 end -- the frame (the glass is lit each frame)
    return c
  else -- the long side wall, turned from the light
    local c = (row == 2) and C.wood2 or ((row == 1) and C.wood1 or C.wood0)
    if p.Z < 1 then c = (row == 0) and C.wood0 or C.wood3 end -- the corner's log ends
    if p.Y > WH - 1.5 and p.Z > 1 then c = C.wood0 end        -- the eave's shadow
    return c
  end
end

local function cabin(b)
  piece(b, function(s)
    for y = 0, H - 1 do
      for x = 0, W - 1 do
        local p = SURF[y][x]
        if p then s[y][x] = cabinColour(p, x, y) end
      end
    end
  end)
  -- icicles along the long side's eave, over the dark wall
  for Z = 1, DZ - 1 do
    if L.rnd(Z, 4, 93) < 0.55 then
      local x = X0 + FW + OHX + Z - 1
      local y = math.floor(Y0 + 1 - eave(FW + OHX - 0.5) - Z / 2)
      local len = 1 + math.floor(L.rnd(Z, 5, 93) * 3)
      for k = 0, len - 1 do L.set(b, x, y + k, (k == 0) and C.snow3 or C.snow2) end
    end
  end
  -- snow drifted against the foot of the walls, dug clear in front of the door
  for x = X0 - 1, X0 + FW + DZ do
    local Z = math.max(0, x - X0 - FW + 1)
    local y = math.floor(Y0 - Z / 2)
    local h = (L.rnd(x, 1, 94) < 0.45) and 2 or 1
    if x < X0 + 2 or x > X0 + 8 then
      for k = 0, h - 1 do L.set(b, x, y - k, (x < X0 + FW) and C.snow3 or C.snow2) end
    end
  end
  -- footprints from the door out toward the edge
  for _, f in ipairs({ { 39, 67 }, { 37, 68 }, { 38, 69 }, { 35, 70 } }) do L.set(b, f[1], f[2], C.snow1) end
end

-- The window's glass in this frame: warm and flickering, brightest low in each pane, a faint glow on
-- the logs round it when it burns bright, and its light falling out across the snow.
local function window(b, level)
  local glass = { C.fire2, C.fire3, C.window, C.fire4 }
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      local p = SURF[y][x]
      if p and onGlass(p) then
        local low = ((math.floor(p.Y) - WIN[3]) % 3 == 1) and 1 or 0
        b[y][x] = glass[math.min(4, level + low)]
      end
    end
  end
  if level >= 2 then
    for _, g in ipairs({ { -1, 1 }, { -1, 5 }, { 7, 1 }, { 7, 5 }, { 1, -1 }, { 5, -1 }, { 2, 7 }, { 4, 7 } }) do
      L.set(b, X0 + WIN[1] + g[1], Y0 - WIN[3] - g[2], C.fire2)
    end
  end
  -- the light on the snow in front: a fan widening toward us, dithered out, reaching further when bright
  local reach = 2 + level
  for r = 1, reach do
    local y = Y0 + r
    for x = X0 + WIN[1] - r, X0 + WIN[2] - 1 + r do
      local k = 1 - r / (reach + 1)
      if isSnow(L.get(b, x, y)) and L.bayer(x, y) < k * 0.8 then L.set(b, x, y, (r <= 1) and C.window or C.fire3) end
    end
  end
end

-- The woodpile: split logs stacked end-on, snow on top, in the snow to the left of the cabin.
local function woodpile(b)
  piece(b, function(s)
    for _, l in ipairs({ { 19, 64 }, { 22, 64 }, { 25, 64 }, { 20.5, 61.5 }, { 23.5, 61.5 }, { 22, 59 } }) do
      local x, y = math.floor(l[1]), math.floor(l[2])
      -- each log's cut end: pale heartwood in a darker ring, shaded to the bottom-right
      L.fillRect(s, x - 1, y - 1, x + 1, y + 1, C.wood3)
      L.set(s, x, y - 1, C.wood4); L.set(s, x - 1, y, C.wood4); L.set(s, x, y, C.wood5)
      L.set(s, x, y + 1, C.wood2); L.set(s, x + 1, y, C.wood2); L.set(s, x + 1, y + 1, C.wood1)
    end
    for x = 20, 24 do L.set(s, x, 57, C.snow3) end
    L.set(s, 21, 56, C.snow4); L.set(s, 22, 56, C.snow3); L.set(s, 19, 58, C.snow3); L.set(s, 25, 58, C.snow2)
    L.set(s, 18, 60, C.snow3); L.set(s, 26, 60, C.snow2)
  end)
end

-------------------------------------------------------------------------------------------------
-- Things hanging underneath

-- A root hanging from the bottom of column x0 down to yEnd, swaying and leaning a little.
local function root(b, x0, yEnd, phase, lean, color)
  local y0 = math.floor(rimBelow(x0))
  while b[y0 + 1][x0] do y0 = y0 + 1 end
  local path, px = {}, x0
  for y = y0 + 1, yEnd do
    local k = y - y0
    local x = math.floor(x0 + lean * k + (math.sin(k * 0.3 + phase) - math.sin(phase)) * 1.2 + 0.5)
    if math.abs(x - px) > 1 then L.set(b, (x + px) // 2, y - 1, color) end
    L.set(b, x, y, color)
    if k <= (yEnd - y0) * 0.35 and not L.get(b, x + 1, y) then L.set(b, x + 1, y, C.bark1) end
    path[#path + 1] = { x, y }
    px = x
  end
  return path
end

-- Icicles down the face of the snow's crust under the rim.
local function icicles(b)
  for x = CX - RX + 4, CX + RX - 4 do
    if L.rnd(x, 2, 95) < 0.3 then
      local y = math.floor(rimBelow(x) + 0.5) + 1
      local len = 1 + math.floor(L.rnd(x, 3, 95) * 4)
      for k = 0, len - 1 do
        if b[y + k] and b[y + k][x] then b[y + k][x] = (k == 0) and C.snow4 or ((k < len - 1) and C.snow3 or C.snow2) end
      end
    end
  end
end

-- A long icicle hanging from the lowest pixel of column x.
local function hangingIce(b, x, len)
  local y = 0
  for yy = H - 1, 0, -1 do if b[yy][x] then y = yy; break end end
  for k = 1, len do L.set(b, x, y + k, (k < len) and C.snow3 or C.snow4) end
end

local function island()
  local b = L.buffer(W, H)
  for y = CY, TIPY + 4 do
    for x = 0, W - 1 do
      if inUnderside(x, y) then b[y][x] = earth(x, y) end
    end
  end
  for _, s in ipairs({ { 24, 66, 2.5, 1.8 }, { 44, 76, 3, 2 }, { 80, 72, 2.5, 1.8 }, { 96, 66, 2, 1.5 },
      { 60, 84, 2, 1.6 }, { 69, 79, 2.6, 1.9 } }) do
    stone(b, s[1], s[2], s[3], s[4])
  end
  snowTop(b)
  icicles(b)
  -- shadows cast away from the light: the cabin's and the pines'
  snowShadow(b, 76, 61, 9, 3)
  snowShadow(b, 94, 56, 9, 2.2)
  snowShadow(b, 27, 54, 6, 2)
  snowShadow(b, 108, 64, 4, 1.4)
  L.outline(b, OUTLINE)

  backPines(b)
  cabin(b)
  frontPine(b)
  woodpile(b)

  -- roots and dangling bits, left thin: roots, one ending in a clod of frozen earth, and long icicles
  root(b, 36, 96, 0.5, -0.12, C.bark2)
  root(b, 47, 99, 2.2, -0.05, C.bark1)
  local e = root(b, 61, 97, 4.0, 0.02, C.bark2)
  e = e[#e]
  local clod = L.buffer(W, H)
  for _, p in ipairs({ { e[1] - 1, e[2] + 1, C.bark3 }, { e[1], e[2] + 1, C.snow1 }, { e[1] + 1, e[2] + 1, C.bark2 },
      { e[1] - 1, e[2] + 2, C.bark2 }, { e[1], e[2] + 2, C.bark1 }, { e[1] + 1, e[2] + 2, C.bark1 } }) do
    L.set(clod, p[1], p[2], p[3])
  end
  L.outline(clod, OUTLINE)
  L.blit(b, clod, 0, 0)
  root(b, 72, 95, 1.2, 0.06, C.bark1)
  hangingIce(b, 28, 5)
  hangingIce(b, 54, 6)
  hangingIce(b, 84, 4)
  return b
end

-------------------------------------------------------------------------------------------------
-- What moves: flakes drifting off the edges, the chimney's smoke, the window and the eyes

-- Each flake leaves the island at (x, y) in frame `start`, then falls a pixel a frame, drifting outward.
local FLAKES = { { 11, 60, 0, -1 }, { 16, 66, 5, -1 }, { 108, 60, 3, 1 }, { 103, 67, 9, 1 }, { 22, 70, 8, -1 } }
local function flakes(b, f)
  for _, fl in ipairs(FLAKES) do
    local t = (f - fl[3]) % N
    if t < 9 then
      local x = fl[1] + fl[4] * math.floor(t / 3) + math.floor(math.sin(t * 0.9 + fl[1]) * 0.8 + 0.5)
      local y = fl[2] + t
      if not L.get(b, x, y) then L.set(b, x, y, (t < 4) and C.snow4 or ((t < 7) and C.snow3 or C.snow2)) end
    end
  end
end

-- Smoke puffs leaving the chimney top, each rising a pixel a frame and drifting right as it thins.
local PUFFS = { 0, 4, 8 }
local SMOKE = { math.floor(X0 + (CHIM[1] + CHIM[2]) / 2 + (CHIM[3] + CHIM[4]) / 2),
  math.floor(Y0 + 1 - CHIM[5] - (CHIM[3] + CHIM[4]) / 4) - 1 }
local function smoke(b, f)
  for _, p in ipairs(PUFFS) do
    local t = (f - p) % N
    local x = SMOKE[1] + math.floor(t * 0.4 + math.sin(t * 0.8) * 0.7 + 0.5)
    local y = SMOKE[2] - t
    local c = (t < 5) and C.snow1 or C.snow0
    if not L.get(b, x, y) then L.set(b, x, y, c) end
    if t >= 3 and t < 9 and not L.get(b, x + 1, y) then L.set(b, x + 1, y, c) end
  end
end

local base = island()

-- Frame f of N (0-based).
local function paint(f)
  local b = copy(base)
  window(b, FLAME[f + 1])
  if EYES_OPEN[f] then L.set(b, EYES[1], EYES[2], C.eye2); L.set(b, EYES[1] + 2, EYES[2], C.eye2) end
  smoke(b, f)
  flakes(b, f)
  return b
end

local frames = {}
for f = 0, N - 1 do frames[#frames + 1] = paint(f) end
I.write("last-light", frames, MS, P.glow["last-light"])
