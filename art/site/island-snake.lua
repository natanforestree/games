-- The Snake island for the games page: the card icon's cozy meadow grown into a floating diorama, a
-- snake winding slowly round an apple patch. Run from the repo root:
--   aseprite -b --script art/site/island-snake.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local I = dofile(here .. "island.lua")
local W, H, N, MS = 136, 112, 24, 200
local C = P.snake

local CX, CY, RX, RY = 68, 46, 56, 17  -- the grass top
local TIPX, TIPY = 66, 92              -- where the underside narrows to
local LX, LY, LRX, LRY = 68, 46, 28, 9 -- the snake's loop round the apple patch
local LENGTH = 0.7                     -- how much of the loop the snake covers

-- Light comes from the top-left, slightly toward the viewer (as on the card icon).
local function light(nx, ny, nz)
  local lx, ly, lz = -0.5, -0.7, 0.5
  return (nx * lx + ny * ly + nz * lz) / math.sqrt(lx * lx + ly * ly + lz * lz)
end

-- The icon's five-step shading, from a light value in about -1..1.
local function ramp(v, a, b, c, d, e)
  if v > 0.8 then return e elseif v > 0.5 then return d elseif v > 0.15 then return c elseif v > -0.25 then return b else return a end
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

-- The grass top's lower edge at column x.
local function rimBelow(x)
  local u = math.max(-1, math.min(1, (x + 0.5 - CX) / RX))
  return CY + RY * math.sqrt(1 - u * u)
end

-------------------------------------------------------------------------------------------------
-- The island itself (the same in every frame)

-- The underside: an earth band under the rim, then a rough cone hanging to the tip. Each side steps
-- in and out by its own noise, and the columns hang by a pixel or two, so it looks torn from the ground.
local function inUnderside(x, y)
  if y + 0.5 < CY then return false end
  for k = 1, 5 do if ell(x, y, CX, CY + k, RX - k * 0.5, RY) then return true end end
  local yy = y - math.floor(L.rnd(math.floor(x / 2), 0, 12) * 3) -- ragged hanging columns
  local t = (yy + 0.5 - CY) / (TIPY - CY)
  if t > 1 then return false end
  local c = CX + (TIPX - CX) * t
  local hw = (RX - 3) * (1 - t) ^ 0.75
  local band = math.floor(yy / 3)
  local left = c - hw - (L.rnd(band, 1, 11) - 0.5) * 5
  local right = c + hw + (L.rnd(band, 2, 11) - 0.5) * 5
  return x + 0.5 >= left and x + 0.5 <= right
end

-- The earth's colour: layered d3, d2, d1 going down, lighter on the left (toward the light).
local function earth(x, y)
  local depth = y + 0.5 - rimBelow(x)
  local t = math.max(0, (y + 0.5 - CY) / (TIPY - CY))
  local hw = math.max(4, (RX - 3) * (1 - math.min(1, t)) ^ 0.75)
  local u = (x + 0.5 - (CX + (TIPX - CX) * t)) / hw -- -1 at the left edge, 1 at the right
  local v = depth + math.sin(x * 0.31) * 1.2 + math.sin(x * 0.11 + 2) * 1.5 + u * 4
  local c
  if v < 6 then c = C.d3 elseif v < 16 then c = C.d2 else c = C.d1 end
  local r = L.rnd(x, y, 13)
  if r < 0.05 then c = (c == C.d3) and C.d2 or C.d1 end
  if r > 0.975 and c ~= C.d3 then c = (c == C.d1) and C.d2 or C.d3 end
  if u < -0.8 and c == C.d2 then c = C.d3 end    -- the lit left edge
  if u > 0.8 and v > 8 then c = C.rock[1] end    -- the shaded right edge
  return c
end

-- A stone set in the earth, lit from the top-left.
local function stone(b, cx, cy, rx, ry)
  for y = math.floor(cy - ry), math.ceil(cy + ry) do
    for x = math.floor(cx - rx), math.ceil(cx + rx) do
      local inside, dx, dy = ell(x, y, cx, cy, rx, ry)
      if inside and b[y][x] then
        local v = light(dx, dy, math.sqrt(math.max(0, 1 - dx * dx - dy * dy)))
        b[y][x] = (v > 0.55) and C.rock[3] or ((v > -0.1) and C.rock[2] or C.rock[1])
      end
    end
  end
end

-- A root hanging from the bottom of column x0 down to yEnd, swaying and leaning a little: 2 px thick
-- (shaded on the right) where it leaves the earth, then 1 px to the tip. Returns its pixels, top to bottom.
local function root(b, x0, yEnd, phase, lean, color)
  local y0 = math.floor(rimBelow(x0))
  while b[y0 + 1][x0] do y0 = y0 + 1 end
  local path, px = {}, x0
  for y = y0 + 1, yEnd do
    local k = y - y0
    local x = math.floor(x0 + lean * k + (math.sin(k * 0.3 + phase) - math.sin(phase)) * 1.2 + 0.5)
    if math.abs(x - px) > 1 then L.set(b, (x + px) // 2, y - 1, color) end
    L.set(b, x, y, color)
    if k <= (yEnd - y0) * 0.35 and not L.get(b, x + 1, y) then L.set(b, x + 1, y, C.d1) end
    path[#path + 1] = { x, y }
    px = x
  end
  return path
end

-- A small outlined lump (the clump of earth or pebble at a root's end): rows of { x, y, colour }.
local function lump(b, pixels)
  local one = L.buffer(W, H)
  for _, p in ipairs(pixels) do L.set(one, p[1], p[2], p[3]) end
  L.outline(one, C.outline)
  L.blit(b, one, 0, 0)
end

local function flower(b, x, y, petal, center)
  L.set(b, x - 1, y, petal); L.set(b, x + 1, y, petal); L.set(b, x, y - 1, petal); L.set(b, x, y + 1, petal)
  L.set(b, x, y, center)
end

-- Soft shadow on the grass: darkens lit grass inside the ellipse.
local function grassShadow(b, cx, cy, rx, ry)
  for y = math.floor(cy - ry), math.ceil(cy + ry) do
    for x = math.floor(cx - rx), math.ceil(cx + rx) do
      local c = L.get(b, x, y)
      if ell(x, y, cx, cy, rx, ry) and (c == C.g3 or c == C.g4) then b[y][x] = C.g2 end
    end
  end
end

local function island()
  local b = L.buffer(W, H)
  -- the underside, then its stones
  for y = CY, TIPY + 4 do
    for x = 0, W - 1 do
      if inUnderside(x, y) then b[y][x] = earth(x, y) end
    end
  end
  for _, s in ipairs({ { 30, 58, 2.5, 1.8 }, { 49, 70, 3, 2 }, { 84, 66, 2.5, 1.8 }, { 99, 60, 2, 1.5 },
      { 62, 81, 2, 1.6 }, { 75, 76, 2.8, 2 }, { 40, 64, 1.6, 1.3 } }) do
    stone(b, s[1], s[2], s[3], s[4])
  end

  -- the grass top: lit toward the top-left, darker toward the front rim, with specks
  for y = CY - RY - 1, CY + RY + 1 do
    for x = CX - RX - 1, CX + RX + 1 do
      local top, dx, dy = ell(x, y, CX, CY, RX, RY)
      if top then
        local d = math.sqrt(dx * dx + dy * dy)
        local lit = -dx * 0.55 - dy * 0.8 + (L.rnd(x, y, 14) - 0.5) * 0.25
        local c = C.g3
        if lit > 0.35 and d < 0.9 then c = C.g4 end
        if d > 0.86 and dy > 0.15 then c = C.g2 end
        local r = L.rnd(x, y, 15)
        if r < 0.06 then c = C.g2 elseif r > 0.96 then c = C.g4 end
        b[y][x] = c
      end
    end
  end
  -- the grass lip hangs over the earth in places
  for x = CX - RX, CX + RX do
    local y = math.floor(rimBelow(x) + 0.5)
    if b[y] and b[y][x] and y > CY then
      b[y][x] = C.g2
      if L.rnd(x, 0, 16) < 0.35 then L.set(b, x, y + 1, C.g1) end
    end
  end
  -- tufts poking above the back rim
  for _, tx in ipairs({ 22, 33, 45, 60, 79, 93, 107, 117 }) do
    local u = (tx + 0.5 - CX) / RX
    local ty = math.floor(CY - RY * math.sqrt(1 - u * u) + 0.5)
    L.set(b, tx, ty - 1, C.g3); L.set(b, tx + 1, ty - 2, C.g4); L.set(b, tx + 2, ty - 1, C.g3)
    if L.rnd(tx, 1, 17) < 0.5 then L.set(b, tx - 1, ty - 2, C.g4) end
  end

  -- flowers, the mushroom and the apple patch's shadow
  flower(b, 24, 47, C.cream, C.yellow)
  flower(b, 46, 33, C.pink, C.yellow)
  flower(b, 88, 32, C.yellow, C.cream)
  flower(b, 40, 58, C.pink, C.cream)
  flower(b, 101, 56, C.cream, C.yellow)
  grassShadow(b, 68.5, 47, 10, 3.5)
  grassShadow(b, 112, 47.5, 4, 1.3)
  local mx, my = 109, 41 -- the icon's mushroom
  L.fillRect(b, mx + 2, my + 3, mx + 3, my + 4, C.mstem)
  L.fillRect(b, mx + 1, my, mx + 4, my, C.mcap)
  L.fillRect(b, mx, my + 1, mx + 5, my + 2, C.mcap)
  L.set(b, mx + 2, my, C.mcap2); L.set(b, mx + 1, my + 1, C.mcap2); L.set(b, mx + 2, my + 1, C.mcap2)
  L.set(b, mx + 3, my + 1, C.cream); L.set(b, mx + 1, my + 2, C.cream); L.set(b, mx + 4, my + 2, C.cream)

  L.outline(b, C.outline)

  -- roots and dangling bits, left thin: plain roots, two ending in a clump or a pebble, a leafy vine
  root(b, 42, 100, 0.5, -0.12, C.stem)
  root(b, 54, 104, 2.2, -0.05, C.d1)
  local e = root(b, 62, 102, 4.0, 0, C.stem)
  e = e[#e]
  lump(b, { { e[1] - 1, e[2] + 1, C.d3 }, { e[1], e[2] + 1, C.d2 }, { e[1] + 1, e[2] + 1, C.d2 },
    { e[1] - 1, e[2] + 2, C.d2 }, { e[1], e[2] + 2, C.d1 }, { e[1] + 1, e[2] + 2, C.d1 } })
  root(b, 70, 106, 1.2, 0.03, C.d1)
  e = root(b, 77, 101, 5.2, 0.06, C.stem)
  e = e[#e]
  lump(b, { { e[1], e[2] + 1, C.rock[3] }, { e[1] + 1, e[2] + 1, C.rock[2] }, { e[1], e[2] + 2, C.rock[2] }, { e[1] + 1, e[2] + 2, C.rock[1] } })
  local vine = root(b, 88, 103, 3.0, 0.1, C.g1)
  local l1, l2 = vine[math.floor(#vine * 0.4)], vine[math.floor(#vine * 0.75)]
  L.set(b, l1[1] + 1, l1[2], C.leaf); L.set(b, l1[1] + 2, l1[2] - 1, C.g3)
  L.set(b, l2[1] - 1, l2[2], C.leaf); L.set(b, l2[1] - 2, l2[2] - 1, C.g3)
  return b
end

-- The apple patch, on its own layer: three apples like the icon's (each outlined on its own, so the
-- front one overlaps the others cleanly), and a few fallen leaves.
local function apples()
  local a = L.buffer(W, H)
  local function apple(ax, ay, ar, leafDir)
    local one = L.buffer(W, H)
    for y = math.floor(ay - ar), math.ceil(ay + ar) do
      for x = math.floor(ax - ar), math.ceil(ax + ar) do
        local dx, dy = (x + 0.5 - ax) / ar, (y + 0.5 - ay) / ar
        local d2 = dx * dx + dy * dy
        if d2 <= 1 then one[y][x] = ramp(light(dx, dy, math.sqrt(1 - d2)), C.a1, C.a1, C.a2, C.a3, C.a4) end
      end
    end
    local sx, sy = math.floor(ax), math.floor(ay - ar)
    L.set(one, sx, sy, C.stem); L.set(one, sx, sy - 1, C.stem)
    L.set(one, sx + leafDir, sy - 1, C.leaf); L.set(one, sx + 2 * leafDir, sy - 1, C.leaf)
    L.set(one, sx + 2 * leafDir, sy - 2, C.leaf)
    L.outline(one, C.outline)
    L.blit(a, one, 0, 0)
  end
  apple(63.5, 43, 4.1, 1)
  apple(72.5, 42.5, 3.9, -1)
  apple(68, 47.5, 4.3, 1)
  L.set(a, 58, 48, C.leaf); L.set(a, 59, 48, C.g4) -- fallen leaves
  L.set(a, 77, 47, C.leaf); L.set(a, 78, 46, C.leaf)
  L.set(a, 62, 50, C.g4)
  return a
end

-------------------------------------------------------------------------------------------------
-- The snake, which goes round its loop once in N frames

-- The loop, sampled finely by arc length so the snake moves at an even pace.
local LOOP, LOOP_LEN = {}, 0
do
  local M, px, py = 2000, nil, nil
  for i = 0, M do
    local th = 2 * math.pi * i / M -- anticlockwise seen from above: right, back, left, front
    local x, y = LX + LRX * math.cos(th), LY - LRY * math.sin(th)
    if px then LOOP_LEN = LOOP_LEN + math.sqrt((x - px) ^ 2 + (y - py) ^ 2) end
    LOOP[#LOOP + 1] = { x = x, y = y, s = LOOP_LEN }
    px, py = x, y
  end
end

-- The point at loop fraction q (any real; wraps), and the unit direction of travel there.
local function along(q)
  local s = (q % 1) * LOOP_LEN
  local lo, hi = 1, #LOOP
  while hi - lo > 1 do
    local mid = (lo + hi) // 2
    if LOOP[mid].s <= s then lo = mid else hi = mid end
  end
  local a, b = LOOP[lo], LOOP[hi]
  local k = (b.s > a.s) and (s - a.s) / (b.s - a.s) or 0
  local tx, ty = b.x - a.x, b.y - a.y
  local tl = math.sqrt(tx * tx + ty * ty)
  return a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, tx / tl, ty / tl
end

-- Paints the snake with its head at loop fraction `head` into a layer, and records which pixels
-- belong to the back half of the loop (drawn behind the apples) and which to the front.
local function snake(head, tongue)
  local sn, front = L.buffer(W, H), L.buffer(W, H)
  local bodyLen = LENGTH * LOOP_LEN
  local samples = {}
  for i = math.floor(bodyLen * 4), 0, -1 do -- tail first, so the head end sits on top
    local s = i / 4
    local x, y, tx, ty = along(head - s / LOOP_LEN)
    local k = s / bodyLen
    local r = (k > 0.85) and (3 - 2 * (k - 0.85) / 0.15) or 3
    local px, py = -ty, tx
    if py < 0 then px, py = -px, -py end -- the perpendicular that points toward the viewer
    samples[#samples + 1] = { x = x, y = y, r = r, s = s, px = px, py = py }
  end
  local function disc(p, r, fn)
    for y = math.floor(p.y - r - 1), math.ceil(p.y + r + 1) do
      for x = math.floor(p.x - r - 1), math.ceil(p.x + r + 1) do
        local dx, dy = x + 0.5 - p.x, y + 0.5 - p.y
        if dx * dx + dy * dy <= r * r and x >= 0 and y >= 0 and x < W and y < H then fn(x, y, dx, dy) end
      end
    end
  end
  for _, p in ipairs(samples) do
    disc(p, p.r + 1, function(x, y) sn[y][x] = C.outline; front[y][x] = p.y >= LY end)
  end
  for _, p in ipairs(samples) do
    disc(p, p.r, function(x, y, dx, dy)
      local perp = math.max(-1, math.min(1, (dx * p.px + dy * p.py) / p.r))
      local ny = perp * p.py
      local v = light(perp * p.px, ny, math.sqrt(1 - perp * perp))
      local c = ramp(v, C.s1, C.s2, C.s3, C.s4, C.s5)
      if ny > 0.55 then
        c = (v > 0.1) and C.belly2 or C.belly1
      elseif math.floor(p.s / 2.2) % 3 == 1 and perp > -0.6 and perp < 0.15 and p.s < bodyLen * 0.93 then
        c = C.spot
      end
      sn[y][x] = c
      front[y][x] = p.y >= LY
    end)
  end
  -- the head: the icon's (a 5x4 ellipse with its eye, blush and tongue), held a little above the neck
  -- and facing the way it's going
  local hx, hy, fx = along(head + 2 / LOOP_LEN)
  local isFront = hy >= LY
  local face = (fx >= 0) and 1 or -1
  hx, hy = math.floor(hx) + 0.5, math.floor(hy - 1.5) + 0.5
  local function put(ox, oy, c) -- a pixel at an offset from the head's centre, mirrored to face
    local x, y = math.floor(hx + ox * face), math.floor(hy + oy)
    L.set(sn, x, y, c); L.set(front, x, y, isFront)
  end
  for pass = 1, 2 do
    local g = (pass == 1) and 1 or 0
    for oy = -6, 6 do
      for ox = -7, 7 do
        local dx, dy = ox / (5 + g), oy / (4 + g)
        if dx * dx + dy * dy <= 1 then
          local c = C.outline
          if pass == 2 then
            local v = light(dx * face, dy, math.sqrt(math.max(0, 1 - dx * dx - dy * dy)))
            c = ramp(v, C.s1, C.s2, C.s3, C.s4, C.s5)
            if dy > 0.45 and dx > -0.3 then c = (v > 0) and C.belly2 or C.belly1 end
          end
          put(ox, oy, c)
        end
      end
    end
  end
  put(1, -2, C.eye); put(2, -2, C.eye); put(1, -1, C.eye); put(2, -1, C.eye)
  put((face > 0) and 1 or 2, -2, C.white) -- the glint stays top-left
  put(3, 1, C.blush); put(4, 1, C.blush)
  if tongue then put(6, 2, C.tongue); put(7, 2, C.tongue); put(8, 1, C.tongue); put(8, 3, C.tongue) end
  -- the shadow the body casts on the grass just below it
  local shadow = {}
  for _, p in ipairs(samples) do
    disc({ x = p.x + 0.5, y = p.y + 2 }, p.r + 0.5, function(x, y) shadow[#shadow + 1] = { x, y } end)
  end
  return sn, front, shadow
end

-------------------------------------------------------------------------------------------------

local base, patch = island(), apples()

-- Frame f of N (0-based): the snake has gone f/N of the way round its loop.
local function paint(f)
  local b = copy(base)
  local sn, front, shadow = snake(f / N, f % 4 == 0)
  for _, p in ipairs(shadow) do
    local c = L.get(b, p[1], p[2])
    if c == C.g3 or c == C.g4 then b[p[2]][p[1]] = C.g2 end
  end
  for y = 0, H - 1 do for x = 0, W - 1 do if sn[y][x] and not front[y][x] then b[y][x] = sn[y][x] end end end
  L.blit(b, patch, 0, 0)
  for y = 0, H - 1 do for x = 0, W - 1 do if sn[y][x] and front[y][x] then b[y][x] = sn[y][x] end end end
  return b
end

local frames = {}
for f = 0, N - 1 do frames[#frames + 1] = paint(f) end
I.write("snake", frames, MS, P.glow.snake)
