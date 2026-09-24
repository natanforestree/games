-- Last Light's walls and floors: nine 32x32 tiles side by side in last-light/assets/textures.png, named
-- in textures.json, plus palette.json (the palette every image and the game's light tables use).
-- Each tile is painted as if lit evenly from the front: the game adds the lantern's warmth and the
-- dark. Every tile repeats seamlessly left to right, and the floors and ceiling (snow, planks,
-- rafters) top to bottom too. Run from the repo root:
--   aseprite -b --script art/last-light/textures.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()
local C = P.c
local S = 32

-- Pixel helpers that wrap round the tile's edges, so anything drawn across an edge carries on at the
-- other side and the tile repeats without a seam.
local function wrap(v) return math.floor(v) % S end
local function put(b, x, y, c)
  y = math.floor(y)
  if y >= 0 and y < S then b[y][wrap(x)] = c end
end
local function putw(b, x, y, c) b[wrap(y)][wrap(x)] = c end
local function at(b, x, y) return b[wrap(y)][wrap(x)] end
local function tile(c)
  local b = L.buffer(S, S)
  L.fillRect(b, 0, 0, S - 1, S - 1, c)
  return b
end
local function smooth(t) return t * t * (3 - 2 * t) end

-- Smooth value noise in [0, 1) on a lattice of `cell` px that repeats every 32 px both ways.
local function noise(x, y, cell, seed)
  local n = S // cell
  local fx, fy = x / cell, y / cell
  local ix, iy = math.floor(fx), math.floor(fy)
  local tx, ty = smooth(fx - ix), smooth(fy - iy)
  local function g(i, j) return L.rnd(i % n, j % n, seed) end
  local a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * tx
  local b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * tx
  return a + (b - a) * ty
end

-- One step lighter or darker along a ramp (a list, dark -> light), clamped at its ends.
local function step(ramp, c, d)
  for i, v in ipairs(ramp) do
    if v == c then return ramp[math.max(1, math.min(#ramp, i + d))] end
  end
  return c
end
local WOOD = { C.wood0, C.wood1, C.wood2, C.wood3, C.wood4, C.wood5 }
local BARK = { C.void, C.bark0, C.bark1, C.bark2, C.bark3 }

-- Horizontal wood grain: along row y from x0 to x1, runs of one tone lighter or darker, a few px long.
local function grain(b, y, x0, x1, seed, light, dark)
  for x = x0, x1 do
    local n = noise(x * 1.0, y * 7.0, 8, seed)
    local c = at(b, x, y)
    if n > 1 - light then putw(b, x, y, step(WOOD, c, 1))
    elseif n < dark then putw(b, x, y, step(WOOD, c, -1)) end
  end
end

-- A snow cap along the top of a tile: `depth(x)` rows deep, lit on top, with a soft lower edge.
local function snowCap(b, depth, seed)
  for x = 0, S - 1 do
    local d = depth(x)
    for y = 0, d - 1 do
      local c = C.snow3
      if y == 0 and L.rnd(x, 0, seed) < 0.55 then c = C.snow4 end
      if y == d - 1 then c = C.snow2 end
      put(b, x, y, c)
    end
    if d >= 1 then put(b, x, d, C.snow1) end
  end
end

-- A drift of snow banked against the foot of a wall, `h(x)` px high.
local function drift(b, h)
  for x = 0, S - 1 do
    local d = h(x)
    for k = 0, d - 1 do
      local y = S - 1 - k
      put(b, x, y, k == d - 1 and C.snow2 or C.snow1)
    end
  end
end

---------------------------------------------------------------------------------------------------
-- 1. trunks: the forest wall. Pine trunks shoulder to shoulder, lit a little from the left, with deep
-- gaps between them, low boughs across the top and snow caught here and there.

-- A bough of needles from x0 to x1 (may cross the tile's edge), drooping by `sag`, lit on top, with
-- tufts hanging underneath and snow lying along its back.
local function bough(b, x0, x1, y0, y1, sag, thick, seed)
  for x = x0, x1 do
    local t = (x - x0) / (x1 - x0)
    local cy = y0 + (y1 - y0) * t + sag * math.sin(math.pi * t)
    local th = thick * (0.3 + 0.7 * math.sin(math.pi * (0.15 + 0.85 * t)))
    local top, bot = math.floor(cy - th / 2 + 0.5), math.floor(cy + th / 2 + 0.5)
    local tuft = L.rnd(x, 1, seed)
    if tuft > 0.4 then bot = bot + 1 end
    if tuft > 0.8 then bot = bot + 1 end
    for y = top, bot do
      local c = C.needle2
      if y == top or (y == top + 1 and L.rnd(x, y, seed + 1) < 0.35) then c = C.needle3 end
      if y == bot and y > top then c = (tuft > 0.8) and C.needle0 or C.needle1 end
      if y == bot - 1 and y > top + 1 then c = C.needle1 end
      put(b, x, y, c)
    end
    if t > 0.08 and t < 0.9 then
      local n = noise(x * 1.0, seed * 1.0, 4, seed)
      if n > 0.3 then
        put(b, x, top, C.snow3)
        put(b, x, top - 1, (n > 0.62) and C.snow4 or C.snow3)
        if n > 0.5 then put(b, x, top - 2, C.snow2) end
      end
    end
  end
end

local function trunks()
  local b = tile(C.void)
  -- Far trunks, barely seen in the deep gaps.
  for y = 0, S - 1 do
    put(b, 14, y, C.bark0)
    put(b, 29, y, C.bark1)
    put(b, 30, y, C.bark0)
  end
  -- The near trunks: their left edge, and their shading across (BARK indices), lit from the left. The
  -- third stands a little further back, so it's darker.
  local T = {
    { x0 = 0, prof = { 4, 5, 5, 4, 3, 2 } },
    { x0 = 7, prof = { 4, 5, 5, 4, 4, 3, 2 } },
    { x0 = 16, prof = { 3, 4, 4, 3, 2 } },
    { x0 = 22, prof = { 4, 5, 5, 4, 3, 2 } },
  }
  for ti, t in ipairs(T) do
    local w = #t.prof
    -- Pine bark: plates split by a fissure that wanders down the trunk, each side breaking into
    -- plates at its own rows. A plate's top edge catches the light; the seam above it is dark.
    local fis = math.floor(w / 2)
    local breakL, breakR = {}, {}
    local y = math.floor(L.rnd(ti, 1, 3) * 5)
    while y < S do breakL[y] = true; y = y + 4 + math.floor(L.rnd(ti, y, 5) * 4) end
    y = 2 + math.floor(L.rnd(ti, 2, 3) * 4)
    while y < S do breakR[y] = true; y = y + 4 + math.floor(L.rnd(ti, y, 6) * 4) end
    for yy = 0, S - 1 do
      local j = L.rnd(ti, yy, 11)
      if (breakL[yy] or breakR[yy]) and j < 0.3 and fis > 2 then fis = fis - 1
      elseif (breakL[yy] or breakR[yy]) and j > 0.7 and fis < w - 2 then fis = fis + 1 end
      for i = 0, w - 1 do
        local k = t.prof[i + 1]
        local left = i < fis
        if i == fis then k = k - 2
        elseif left and breakL[yy] and i > 0 then k = k - 1
        elseif not left and breakR[yy] and i < w - 1 then k = k - 1
        elseif left and breakL[yy - 1] and i == 1 then k = k + 1
        elseif not left and breakR[yy - 1] and i == fis + 1 then k = k + 1 end
        put(b, t.x0 + i, yy, BARK[math.max(1, math.min(5, k))])
      end
    end
    -- The trunk flares a little at its root.
    for yy = S - 5, S - 1 do
      if at(b, t.x0 - 1, yy) == C.void and at(b, t.x0 - 2, yy) == C.void then put(b, t.x0 - 1, yy, C.bark1) end
      if at(b, t.x0 + w, yy) == C.void then put(b, t.x0 + w, yy, C.bark0) end
    end
  end
  -- Snow plastered on the windward side of two trunks, in streaks.
  for _, s in ipairs({ { 7, 9, 5 }, { 22, 15, 4 } }) do
    put(b, s[1], s[2], C.snow3)
    put(b, s[1], s[2] + 1, C.snow2)
    for k = 2, s[3] - 1 do put(b, s[1], s[2] + k, C.snow1) end
  end
  -- Broken branch stubs reaching into the gaps, with snow on them.
  put(b, 14, 18, C.bark3); put(b, 15, 18, C.bark2); put(b, 15, 19, C.bark0)
  put(b, 13, 17, C.snow2); put(b, 14, 17, C.snow3); put(b, 15, 17, C.snow3)
  put(b, 21, 25, C.bark2); put(b, 21, 26, C.bark0)
  put(b, 20, 24, C.snow2); put(b, 21, 24, C.snow3)
  -- Low boughs across the top rows.
  bough(b, -9, 11, 0.5, 4, 1.2, 4, 21)
  bough(b, 13, 29, 0, 3, 1.5, 3.4, 22)
  -- Snow drifted round the foot of the trees.
  drift(b, function(x) return 1 + math.floor(noise(x * 1.0, 0, 8, 31) * 3.2) end)
  return b
end

---------------------------------------------------------------------------------------------------
-- 2. logs: the cabin wall. Four logs 8 px high, each lit along its top, darker underneath, with dark
-- chinking between them, a few knots and a crack or two.
local LOG_ROWS = { C.wood4, C.wood4, C.wood3, C.wood3, C.wood3, C.wood2, C.wood1, C.wood0 }

local function knot(b, x, y)
  put(b, x, y, C.wood1); put(b, x + 1, y, C.wood1)
  put(b, x - 1, y, C.wood2); put(b, x + 2, y, C.wood2)
  put(b, x, y - 1, C.wood4); put(b, x + 1, y - 1, C.wood2)
  put(b, x, y + 1, C.wood2)
end
local function crack(b, x, y, n)
  for i = 0, n - 1 do
    put(b, x + i, y, C.wood1)
    if i > 0 and i < n - 1 then put(b, x + i, y + 1, step(WOOD, at(b, x + i, y + 1), 1)) end
  end
end

local function logs()
  local b = L.buffer(S, S)
  for y = 0, S - 1 do
    for x = 0, S - 1 do b[y][x] = LOG_ROWS[y % 8 + 1] end
  end
  for log = 0, 3 do
    local y0 = log * 8
    -- The lit top edge: long glints of wood5.
    for x = 0, S - 1 do
      if noise(x * 1.0, log * 5.0, 8, 40 + log) > 0.55 then putw(b, x, y0, C.wood5) end
    end
    -- Grain along the body.
    for r = 1, 5 do grain(b, y0 + r, 0, S - 1, 50 + log * 8 + r, 0.18, 0.2) end
    -- The underside is ragged where the bark was left on.
    for x = 0, S - 1 do
      if L.rnd(x, log, 61) < 0.25 then putw(b, x, y0 + 5, C.wood1) end
    end
  end
  knot(b, 5, 3); knot(b, 23, 12); knot(b, 13, 27); knot(b, 29, 20)
  crack(b, 9, 11, 7); crack(b, 18, 19, 5); crack(b, 25, 3, 4)
  return b
end

---------------------------------------------------------------------------------------------------
-- 3. window: the logs with a four-pane window set in the middle, glowing with the stove's light. The
-- panes are glow colours, so the window shines at night.
local function window()
  local b = logs()
  local x0, y0, x1, y1 = 7, 7, 24, 22 -- the frame's outer edge
  local mx, my = 15, 14 -- the mullions (2 px each: mx..mx+1, my..my+1)
  for y = y0, y1 do
    for x = x0, x1 do
      local edge = (x == x0 or x == x1 or y == y0 or y == y1)
      local inner = (x == x0 + 1 or x == x1 - 1 or y == y0 + 1 or y == y1 - 1)
      local bar = (x == mx or x == mx + 1 or y == my or y == my + 1)
      if edge then put(b, x, y, C.wood1)
      elseif inner or bar then
        -- The frame and mullions: lit on their top and left faces.
        local lit = (y == y0 + 1 or x == x0 + 1 or x == mx or y == my)
        local shaded = (y == y1 - 1 or x == x1 - 1)
        put(b, x, y, (lit and not shaded) and C.wood3 or C.wood2)
      else
        -- The glass: warm lamplight, brighter towards the top, deeper amber low down.
        local py = (y < my) and (y - (y0 + 2)) / (my - y0 - 2) or (y - (my + 2)) / (y1 - 1 - my - 2)
        put(b, x, y, (py > 0.75) and C.fire3 or C.window)
      end
    end
  end
  -- Glints across each pane.
  for _, p in ipairs({ { x0 + 2, y0 + 2 }, { mx + 2, y0 + 2 }, { x0 + 2, my + 2 }, { mx + 2, my + 2 } }) do
    put(b, p[1] + 1, p[2], C.fire4); put(b, p[1] + 2, p[2], C.fire4); put(b, p[1], p[2] + 1, C.fire4)
    put(b, p[1] + 1, p[2] + 1, C.fire4); put(b, p[1], p[2] + 2, C.fire4)
  end
  -- Frost in the panes' lower corners.
  for _, p in ipairs({ { x0 + 2, my - 1 }, { x1 - 2, my - 1 }, { x0 + 2, y1 - 2 }, { x1 - 2, y1 - 2 }, { mx - 1, y1 - 2 }, { mx + 2, y1 - 2 } }) do
    put(b, p[1], p[2], C.snow3)
  end
  put(b, x0 + 3, y1 - 2, C.snow2); put(b, x1 - 3, y1 - 2, C.snow2)
  -- The sill: a lit plank jutting out under the window, with a shadow beneath and snow on it.
  for x = x0 - 1, x1 + 1 do
    put(b, x, y1 + 1, C.wood4)
    put(b, x, y1 + 2, C.wood1)
    if x > x0 and x < x1 and noise(x * 1.0, 0, 4, 77) > 0.4 then put(b, x, y1 + 1, C.snow3) end
  end
  put(b, x0 - 1, y1 + 1, C.wood3); put(b, x1 + 1, y1 + 1, C.wood3)
  return b
end

---------------------------------------------------------------------------------------------------
-- 4. woodpile: split log ends stacked in rows, with bark rims, dark gaps and snow on top.

-- One log end at (cx, cy), radius r, lit from the upper left: a bark rim, the cut face with a growth
-- ring and a dark heart. A split piece (`cut`, the angle its split face looks along) keeps the half
-- away from that face, or with `wedge` a quarter; its split faces are fresh, lighter wood.
local function logEnd(b, cx, cy, r, cut, wedge, crack)
  local ca, sa = math.cos(cut or 0), math.sin(cut or 0)
  for y = math.floor(cy - r - 1), math.ceil(cy + r + 1) do
    for x = math.floor(cx - r - 1), math.ceil(cx + r + 1) do
      local dx, dy = x + 0.5 - cx, y + 0.5 - cy
      local d = math.sqrt(dx * dx + dy * dy)
      local a1, a2 = dx * ca + dy * sa, -dx * sa + dy * ca
      local inside = d <= r
      if cut then inside = inside and a1 <= 0.7 end
      if cut and wedge then inside = inside and a2 <= 0.7 end
      if inside then
        local c
        if cut and (a1 > -0.3 or (wedge and a2 > -0.3)) then c = C.wood3
        elseif d > r - 1 then c = C.wood1
        else
          local l = -(dx + dy) / r
          c = (l > 0.2) and C.wood5 or (l < -0.65) and C.wood3 or C.wood4
          if math.abs(d - r * 0.5) < 0.4 and l < 0.1 then c = C.wood3 end
          if d < 0.7 then c = C.wood2 end
        end
        put(b, x, y, c)
      end
    end
  end
  if crack then
    for k = 1, math.floor(r) - 1 do put(b, cx + math.cos(crack) * k, cy + math.sin(crack) * k, C.wood2) end
  end
end

local function woodpile()
  local b = tile(C.void)
  -- The ends of logs further back, just seen in the deep gaps.
  for y = 0, S - 1 do
    for x = 0, S - 1 do
      if noise(x * 1.0, y * 1.0, 4, 90) > 0.64 then b[y][x] = C.wood0 end
    end
  end
  for row = 0, 4 do
    for i = 0, 3 do
      local cx = 4 + i * 8 + ((row % 2 == 1) and 4 or 0) + (L.rnd(i, row, 91) - 0.5)
      local cy = 5 + row * 7 + (L.rnd(i, row, 94) - 0.5)
      local r = 3.6 + L.rnd(i, row, 92) * 0.45
      local pick = L.rnd(i, row, 93)
      local cut = (pick >= 0.55) and (math.floor(L.rnd(i, row, 95) * 4) * math.pi / 2 + math.pi / 4) or nil
      local crack = (L.rnd(i, row, 96) < 0.35) and (1 + L.rnd(i, row, 97) * 4) or nil
      logEnd(b, cx, cy, r, cut, pick > 0.92, crack)
    end
  end
  -- Snow heaped on top in mounds over the top logs, and a little lodged on the ledges below.
  snowCap(b, function(x)
    return 2 + math.floor(0.9 + 0.9 * math.cos((x - 4) * math.pi / 4) + noise(x * 1.0, 0, 8, 95) * 1.4)
  end, 96)
  for x = 0, S - 1 do
    for y = 8, S - 2 do
      if at(b, x, y) == C.wood1 and at(b, x, y - 1) == C.void and L.rnd(x, y, 98) < 0.15 then put(b, x, y - 1, C.snow2) end
    end
  end
  return b
end

---------------------------------------------------------------------------------------------------
-- 5. wagonSide: a covered wagon side-on. The canvas bonnet over hoop ribs fills the upper two thirds,
-- with sagging folds and snow along the top; below is the planked bed and a spoked wheel sunk in snow.
local BED = 20 -- the first row of the bed

-- The canvas: stretched over hoops every 16 px (the first at x = hoop), it puffs out a little between
-- them, and rolls away from the light at the top and where it's gathered at the hem.
local function canvas(b, y0, y1, hoop, seed)
  for y = y0, y1 do
    for x = 0, S - 1 do
      local v = math.cos((x - hoop - 8) * math.pi * 2 / 16)
      local t = (y - y0) / (y1 - y0)
      local round = 1 - 4 * (t - 0.35) * (t - 0.35)
      local val = v * 0.55 + round * 0.3 + 0.05 + (noise(x * 1.0, y * 1.0, 8, seed) - 0.5) * 0.3
      b[y][x] = (val > 0.62) and C.snow3 or (val > -0.05) and C.snow2 or (val > -0.45) and C.stone3 or C.stone2
    end
  end
end

local function wheel(b, cx, cy, r)
  for y = math.floor(cy - r - 1), math.ceil(cy + r + 1) do
    for x = math.floor(cx - r - 1), math.ceil(cx + r + 1) do
      local dx, dy = x + 0.5 - cx, y + 0.5 - cy
      local d = math.sqrt(dx * dx + dy * dy)
      if d <= r and d > r - 1.1 then put(b, x, y, (dx < 0) and C.iron2 or C.iron1)
      elseif d <= r - 1.1 and d > r - 2.3 then put(b, x, y, (dx < -1) and C.wood4 or C.wood3)
      elseif d <= r - 2.3 then
        -- Between the spokes: the dark under the wagon.
        put(b, x, y, (y < BED + 5) and C.wood1 or C.wood0)
      end
    end
  end
  for k = 0, 7 do
    local a = k * math.pi / 4 + math.pi / 8
    local c = (math.cos(a) < 0.2) and C.wood4 or C.wood3
    L.line(b, cx + math.cos(a) * 1.5, cy + math.sin(a) * 1.5, cx + math.cos(a) * (r - 2), cy + math.sin(a) * (r - 2), c)
  end
  L.disc(b, cx, cy, 2.2, C.wood2)
  put(b, cx - 1, cy - 1, C.wood5); put(b, cx, cy - 1, C.wood4)
  put(b, cx - 1, cy, C.wood4); put(b, cx, cy, C.iron1)
end

local function wagonSide()
  local b = tile(C.stone2)
  canvas(b, 0, BED - 1, 7, 101)
  -- The hoops press creases into the canvas, and it sags a little between them.
  for _, x0 in ipairs({ 7, 23 }) do
    for y = 3, BED - 3 do put(b, x0, y, C.stone2); put(b, x0 + 1, y, (y > 5 and y < 14) and C.stone3 or b[y][x0 + 1]) end
  end
  for _, x0 in ipairs({ 9, 25 }) do
    for x = x0, x0 + 11 do
      local t = (x - x0) / 11
      if t > 0.15 and t < 0.85 then put(b, x, 13 + 2.5 * math.sin(math.pi * t), C.stone3) end
    end
  end
  -- The hem, gathered and tied down along the bed.
  for x = 0, S - 1 do
    put(b, x, BED - 2, (x % 4 == 1) and C.stone1 or C.stone2)
    put(b, x, BED - 1, C.stone1)
  end
  -- The bed: two broad planks, lit on top, with dark seams, and two iron straps.
  for y = BED, S - 1 do
    local r = (y - BED) % 5
    local c = (r == 0) and C.wood4 or (r == 4) and C.wood1 or (r == 3) and C.wood2 or C.wood3
    for x = 0, S - 1 do b[y][x] = c end
  end
  for _, r in ipairs({ 1, 2, 6, 7 }) do grain(b, BED + r, 0, S - 1, 110 + r, 0.2, 0.2) end
  for _, x in ipairs({ 2, 29 }) do
    for y = BED, S - 1 do put(b, x, y, C.iron1) end
    put(b, x, BED + 2, C.iron2); put(b, x, BED + 7, C.iron2)
  end
  wheel(b, 15.5, 29.5, 10)
  -- Snow along the top, and banked round the wheel.
  snowCap(b, function(x) return 2 + math.floor(noise(x * 1.0, 0, 8, 120) * 2.2 + 0.5) end, 121)
  drift(b, function(x) return 1 + math.floor(noise(x * 1.0, 0, 8, 122) * 2.2) end)
  return b
end

---------------------------------------------------------------------------------------------------
-- 6. wagonEnd: the wagon's rear. The tailgate below, and above it the bonnet puckered round a dark oval
-- opening. Something could be in there.
local function wagonEnd()
  local b = tile(C.stone2)
  canvas(b, 0, BED - 1, 0, 131)
  local cx, cy, rx, ry = 16, 10, 5.4, 5.8
  -- Pleats radiating from the drawstring, fading out as they spread.
  for y = 0, BED - 3 do
    for x = 0, S - 1 do
      local dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
      local d = math.sqrt(dx * dx + dy * dy)
      local fade = 1 - (d - 1) / 1.1
      if d > 1 and fade > 0 then
        local p = math.sin(math.atan(dy, dx) * 9 + 0.5) * fade
        if p > 0.45 then put(b, x, y, C.snow3) elseif p < -0.55 then put(b, x, y, C.stone2)
        elseif p < -0.2 then put(b, x, y, C.stone3) end
      end
    end
  end
  -- The hoops at each side.
  for y = 0, BED - 1 do
    put(b, 0, y, C.stone2); put(b, 1, y, C.snow3); put(b, 30, y, C.stone3); put(b, 31, y, C.stone2)
  end
  -- The opening: a black oval with a ragged lip, the hem bunched round it.
  for y = 0, BED - 1 do
    for x = 0, S - 1 do
      local dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
      local d = math.sqrt(dx * dx + dy * dy)
      local wob = 0.06 * math.sin(math.atan(dy, dx) * 6)
      if d <= 1 + wob then put(b, x, y, C.void)
      elseif d <= 1.28 + wob then put(b, x, y, (dy > 0.25) and C.snow3 or (dy > -0.4) and C.stone3 or C.stone1) end
    end
  end
  -- Just inside the lower lip, the faintest hint of the wagon's inside.
  for x = 13, 18 do put(b, x, cy + ry - 1, C.night1) end
  -- The hem, tied down at the tailgate.
  for x = 0, S - 1 do
    put(b, x, BED - 2, (x % 5 == 2) and C.stone1 or C.stone2)
    put(b, x, BED - 1, C.stone1)
  end
  -- The tailgate: three planks, two iron straps and a hanging chain.
  for y = BED, S - 1 do
    local r = (y - BED) % 4
    local c = (r == 0) and C.wood4 or (r == 3) and C.wood1 or C.wood3
    for x = 2, S - 3 do b[y][x] = c end
  end
  for _, r in ipairs({ 1, 2, 5, 6, 9, 10 }) do grain(b, BED + r, 2, S - 3, 140 + r, 0.2, 0.2) end
  for _, x in ipairs({ 8, 23 }) do
    for y = BED, S - 1 do put(b, x, y, C.iron1); put(b, x + 1, y, C.iron2) end
  end
  for i = 0, 4 do put(b, 4 + i, BED + 1 + i, (i % 2 == 0) and C.iron2 or C.iron1) end
  -- The wheels, seen edge-on at each side, and the dark under the wagon.
  for y = BED, S - 1 do
    put(b, 0, y, C.iron1); put(b, 1, y, C.wood2); put(b, 30, y, C.wood1); put(b, 31, y, C.iron1)
  end
  for x = 2, S - 3 do put(b, x, S - 2, C.wood0); put(b, x, S - 1, C.void) end
  snowCap(b, function(x) return 2 + math.floor(noise(x * 1.0, 0, 8, 150) * 2.2 + 0.5) end, 151)
  drift(b, function(x) return 1 + math.floor(noise(x * 1.0, 0, 8, 152) * 2.2) end)
  return b
end

---------------------------------------------------------------------------------------------------
-- 7. snow: the ground. Soft and calm (it covers half the screen at a glancing angle, where busy
-- detail shimmers): gentle swells, faint wind ripples and a few glints.
local function snow()
  local b = tile(C.snow2)
  -- A few small, low swells of wind-crust, lit along their backs.
  for _, e in ipairs({ { 8, 9, 3.5, 1.1 }, { 25, 25, 4.2, 1.2 }, { 22, 12, 2.5, 0.9 } }) do
    for y = math.floor(e[2] - e[4] - 1), math.ceil(e[2] + e[4] + 1) do
      for x = math.floor(e[1] - e[3] - 1), math.ceil(e[1] + e[3] + 1) do
        local dx, dy = (x + 0.5 - e[1]) / e[3], (y + 0.5 - e[2]) / e[4]
        if dx * dx + dy * dy <= 1 then putw(b, x, y, C.snow3) end
      end
    end
  end
  -- Faint wind ripples: short lit crests, gently bowed.
  for _, d in ipairs({ { 3, 3, 5 }, { 15, 5, 4 }, { 26, 1, 4 }, { 10, 17, 6 }, { 27, 17, 3 }, { 2, 23, 4 }, { 14, 28, 5 } }) do
    local x0, y0, n = d[1], d[2], d[3]
    for i = 0, n - 1 do
      local lift = (i == 0 or i == n - 1) and 0 or -1
      putw(b, x0 + i, y0 + 1 + lift, C.snow3)
    end
  end
  -- The odd hollow, in shadow on its far side.
  putw(b, 19, 21, C.snow1); putw(b, 20, 21, C.snow1); putw(b, 5, 13, C.snow1)
  -- A few glints.
  for _, g in ipairs({ { 7, 3 }, { 21, 7 }, { 12, 23 } }) do putw(b, g[1], g[2], C.snow4) end
  return b
end

---------------------------------------------------------------------------------------------------

-- 8. planks: the cabin floor. Four boards running one way, with dark seams, staggered joints, grain
-- along the boards and a couple of nails.
local function planks()
  local b = L.buffer(S, S)
  local base = { C.wood3, C.wood3, C.wood2, C.wood3 }
  local joints = { 6, 22, 13, 29 }
  for x = 0, S - 1 do
    local board, i = x // 8, x % 8
    for y = 0, S - 1 do
      local c = base[board + 1]
      -- Each length of board is its own shade.
      local piece = ((y - joints[board + 1]) % S < 16) and 1 or 0
      if piece == 1 and board ~= 2 then c = step(WOOD, c, (board % 2 == 0) and 1 or -1) end
      if piece == 1 and board == 2 then c = C.wood3 end
      -- The board's edges: lit on one side, worn dark on the other.
      if i == 0 then c = step(WOOD, c, 1) elseif i == 6 then c = step(WOOD, c, -1) end
      if i == 7 then c = C.wood0 end
      b[y][x] = c
    end
  end
  -- Grain running along each board.
  for x = 0, S - 1 do
    local i = x % 8
    if i >= 1 and i <= 5 then
      for y = 0, S - 1 do
        local n = noise(x * 7.0, y * 1.0, 8, 300 + x)
        if n > 0.78 then b[y][x] = step(WOOD, b[y][x], 1) elseif n < 0.2 then b[y][x] = step(WOOD, b[y][x], -1) end
      end
    end
  end
  -- The joints and nails.
  for board = 0, 3 do
    local y = joints[board + 1]
    for i = 0, 6 do putw(b, board * 8 + i, y, C.wood0) end
  end
  putw(b, 2, 7, C.iron2); putw(b, 5, 7, C.iron2)
  putw(b, 18, 14, C.iron2); putw(b, 26, 28, C.iron2)
  return b
end

---------------------------------------------------------------------------------------------------
-- 9. rafters: the ceiling seen from below. Dark boards with one crossing beam.
local function rafters()
  local b = L.buffer(S, S)
  for y = 0, S - 1 do
    local r = y % 8
    for x = 0, S - 1 do
      local c = (r == 7) and C.wood0 or (r == 0) and C.wood2 or C.wood1
      b[y][x] = c
    end
    if r >= 1 and r <= 5 then
      for x = 0, S - 1 do
        if noise(x * 1.0, y * 7.0, 8, 400 + y) > 0.7 then b[y][x] = C.wood2 end
      end
    end
  end
  -- The beam, running across the boards, with its shadow on them.
  for y = 0, S - 1 do
    put(b, 11, y, C.wood2)
    for x = 12, 18 do put(b, x, y, C.wood3) end
    put(b, 19, y, C.wood2)
    put(b, 20, y, C.wood0)
    if noise(15.0, y * 1.0, 8, 410) > 0.62 then put(b, 14, y, C.wood4) end
    if noise(16.0, y * 1.0, 8, 411) < 0.3 then put(b, 17, y, C.wood2) end
  end
  return b
end

L.writePalette(P)
L.writeTextures(P, {
  { "trunks", trunks() },
  { "logs", logs() },
  { "window", window() },
  { "woodpile", woodpile() },
  { "wagonSide", wagonSide() },
  { "wagonEnd", wagonEnd() },
  { "snow", snow() },
  { "planks", planks() },
  { "rafters", rafters() },
})
