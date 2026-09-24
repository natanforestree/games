-- The unfinished island for the games page: a small bare rock with a patch of grass, where the next game
-- is being built. Wooden scaffolding stands on it, lashed with rope: a ladder up to the half-boarded
-- planks, a pail left on them, and a lantern still flickering on the crossbeam. Run from the repo root:
--   aseprite -b --script art/site/island-unfinished.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local I = dofile(here .. "island.lua")
local W, H, N, MS = 80, 84, 6, 180
local C = P.unfinished
local st, wd, ln = C.stone, C.wood, C.lantern

local CX, CY, RX, RY = 40, 47, 28, 3.6 -- the top face
local TIPX, TIPY = 38, 70              -- where the underside narrows to
local POSTS = { 23, 51 }               -- each post's left column (posts are 2 px wide), from y 16 down to CY
local POST_TOP, BEAM_Y, DECK_Y = 16, 18, 33 -- the posts' tops, the crossbeam's top row, the planks' top row
local LANTERN_X, LANTERN_Y = 58, 22    -- the lantern's middle column and its top row
local FLAME = { 3, 2, 3, 3, 1, 2 }     -- the flame's brightness in each frame, 1..3 (lantern[2..4] at its core)

-- Light comes from the top-left, slightly toward the viewer.
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

-- A layer painted by fn(layer), outlined on its own and then drawn over b, so each piece of timber
-- keeps its edge where it crosses another.
local function piece(b, fn)
  local one = L.buffer(W, H)
  fn(one)
  L.outline(one, C.outline)
  L.blit(b, one, 0, 0)
end

-- The pixels of a line from (x0, y0) to (x1, y1), one per step along its longer axis.
local function line(x0, y0, x1, y1)
  local pts, n = {}, math.max(math.abs(x1 - x0), math.abs(y1 - y0))
  for i = 0, n do
    local t = (n == 0) and 0 or i / n
    pts[#pts + 1] = { math.floor(x0 + (x1 - x0) * t + 0.5), math.floor(y0 + (y1 - y0) * t + 0.5) }
  end
  return pts
end

-------------------------------------------------------------------------------------------------
-- The rock (the same in every frame)

-- The underside: a short cliff under the rim, then a lumpy cone down to the tip. Its sides step in and
-- out by their own noise every few rows, so it looks broken off rather than turned.
local function inUnderside(x, y)
  if y + 0.5 < CY then return false end
  for k = 1, 3 do if ell(x, y, CX, CY + k, RX - k * 0.6, RY) then return true end end
  local t = (y + 0.5 - CY) / (TIPY - CY)
  if t > 1 then return false end
  local c = CX + (TIPX - CX) * t
  local hw = (RX - 2) * (1 - t) ^ 0.85
  local band = math.floor(y / 3)
  local left = c - hw - (L.rnd(band, 1, 41) - 0.5) * 4
  local right = c + hw + (L.rnd(band, 2, 41) - 0.5) * 4
  return x + 0.5 >= left and x + 0.5 <= right
end

-- The underside is split into flat facets (the nearest of a jittered grid of seeds), each shaded by which
-- way it faces: lit on the left, turning away from the light toward the right and the tip.
local SEEDS = {}
for j = 0, 3 do
  for i = 0, 5 do
    local sx = 10 + (i + 0.15 + L.rnd(i, j, 42) * 0.7) * 10
    local sy = CY + (j + 0.15 + L.rnd(i, j, 43) * 0.7) * 6.5
    SEEDS[#SEEDS + 1] = { x = sx, y = sy, jx = L.rnd(i, j, 44) - 0.5, jy = L.rnd(i, j, 45) - 0.5 }
  end
end

local function facet(x, y)
  local best, bi = math.huge, 1
  for i, s in ipairs(SEEDS) do
    local dx, dy = x + 0.5 - s.x, (y + 0.5 - s.y) * 1.5
    local d = dx * dx + dy * dy
    if d < best then best, bi = d, i end
  end
  return bi
end

local function facetLevel(i)
  local s = SEEDS[i]
  local t = math.max(0, math.min(1, (s.y - CY) / (TIPY - CY)))
  local hw = math.max(4, (RX - 2) * (1 - t) ^ 0.85)
  local u = (s.x - (CX + (TIPX - CX) * t)) / hw
  local v = light(u * 0.9 + s.jx * 0.6, 0.35 + t * 0.6 + s.jy * 0.4, 0.7)
  if v > 0.3 then return 3 elseif v > -0.2 then return 2 else return 1 end
end

local function underside(b)
  local level = {}
  for i = 1, #SEEDS do level[i] = facetLevel(i) end
  local ids = L.buffer(W, H)
  for y = CY, TIPY + 3 do
    for x = 0, W - 1 do
      if inUnderside(x, y) then ids[y][x] = facet(x, y) end
    end
  end
  for y = CY, TIPY + 3 do
    for x = 0, W - 1 do
      local id = ids[y][x]
      if id then
        local k = level[id]
        -- the cliff just under the rim faces the viewer, so it's a step lighter
        if y + 0.5 < CY + RY + 3 and k < 3 then k = k + 1 end
        -- a broken crack along each facet's lower and right edges, and a lit seam along its upper edge
        local right, below = ids[y][x + 1], ids[y + 1] and ids[y + 1][x]
        local above = ids[y - 1] and ids[y - 1][x]
        if ((right and right ~= id) or (below and below ~= id)) and L.rnd(x, y, 54) < 0.7 then k = k - 1
        elseif above and above ~= id and k < 3 and L.rnd(x, y, 55) < 0.6 then k = k + 1 end
        -- a little grit
        local r = L.rnd(x, y, 46)
        if r < 0.05 then k = k - 1 elseif r > 0.97 then k = k + 1 end
        b[y][x] = st[math.max(1, math.min(3, k))]
      end
    end
  end
end

-- The top face: bare stone, lit toward the back-left, with a patch of grass on the left and a few tufts.
local function top(b)
  for y = math.floor(CY - RY - 1), math.ceil(CY + RY + 1) do
    for x = CX - RX - 1, CX + RX + 1 do
      local inside, dx, dy = ell(x, y, CX, CY, RX, RY)
      if inside then
        local d = math.sqrt(dx * dx + dy * dy)
        local lit = -dx * 0.5 - dy * 0.8 + (L.rnd(x, y, 47) - 0.5) * 0.35
        local c = st[3]
        if lit > 0.25 and d < 0.92 then c = st[4] end
        if d > 0.85 and dy > 0.3 then c = st[2] end
        if L.rnd(x, y, 48) < 0.06 then c = st[2] end
        b[y][x] = c
      end
    end
  end
  -- the grass patch, ragged at its edge, darker toward the front
  for y = math.floor(CY - RY - 1), math.ceil(CY + RY + 1) do
    for x = 10, 50 do
      local _, dx, dy = ell(x, y, 29, CY - 0.3, 15, 3.2)
      local r = dx * dx + dy * dy
      if b[y][x] and r <= 0.7 + L.rnd(x, y, 49) * 0.5 then
        local c = (dy < 0.1 and L.rnd(x, y, 50) < 0.75) and C.grass[2] or C.grass[1]
        if r > 0.8 then c = C.grass[1] end
        b[y][x] = c
      end
    end
  end
  -- a lip of grass hanging over the front rim
  for x = 17, 38 do
    local u = (x + 0.5 - CX) / RX
    local y = math.floor(CY + RY * math.sqrt(1 - u * u) + 0.5)
    if L.rnd(x, 1, 51) < 0.5 and (b[y - 1][x] == C.grass[1] or b[y - 1][x] == C.grass[2]) then
      L.set(b, x, y, C.grass[1])
    end
  end
  -- tufts poking above the back rim
  for _, tx in ipairs({ 16, 27, 36, 63 }) do
    local u = (tx + 0.5 - CX) / RX
    local ty = math.floor(CY - RY * math.sqrt(1 - u * u) + 0.5)
    L.set(b, tx, ty - 1, C.grass[1]); L.set(b, tx + 1, ty - 2, C.grass[2]); L.set(b, tx + 2, ty - 1, C.grass[1])
  end
end

-- A root hanging from the bottom of column x0 down to yEnd, swaying and leaning a little: 2 px thick
-- (shaded on the right) where it leaves the rock, then 1 px to the tip.
local function root(b, x0, yEnd, phase, lean, color)
  local y0 = TIPY + 4
  while y0 > CY and not b[y0][x0] do y0 = y0 - 1 end
  local px = x0
  for y = y0 + 1, yEnd do
    local k = y - y0
    local x = math.floor(x0 + lean * k + (math.sin(k * 0.35 + phase) - math.sin(phase)) * 1.1 + 0.5)
    if math.abs(x - px) > 1 then L.set(b, (x + px) // 2, y - 1, color) end
    L.set(b, x, y, color)
    if k <= (yEnd - y0) * 0.35 and not L.get(b, x + 1, y) then L.set(b, x + 1, y, wd[1]) end
    px = x
  end
end

local function rock()
  local b = L.buffer(W, H)
  underside(b)
  top(b)
  L.outline(b, C.outline)
  root(b, 33, 76, 0.8, -0.08, wd[2])
  root(b, 39, 78, 2.6, 0, wd[1])
  root(b, 45, 75, 4.4, 0.08, wd[2])
  return b
end

-------------------------------------------------------------------------------------------------
-- The scaffolding (the same in every frame)

-- Rope wrapped round a joint: a band over the post above and below the timber it holds, and a turn
-- showing on either side.
local function lashing(b, px, y0, y1)
  for _, y in ipairs({ y0 - 1, y1 + 1 }) do L.set(b, px, y, C.rope); L.set(b, px + 1, y, C.rope) end
  L.set(b, px - 1, y0, C.rope); L.set(b, px + 2, y1, C.rope)
end

local function scaffolding(b)
  -- the diagonal brace, behind the posts, from under the beam on the left down to the planks on the right
  piece(b, function(s)
    for _, p in ipairs(line(POSTS[1] + 2, BEAM_Y + 4, POSTS[2] - 1, DECK_Y - 3)) do
      L.set(s, p[1], p[2], wd[3]); L.set(s, p[1], p[2] + 1, wd[2])
    end
  end)
  -- the posts: lit on the left, a knot here and there, the sawn tops catching the light
  for _, px in ipairs(POSTS) do
    piece(b, function(s)
      for y = POST_TOP, CY do
        s[y][px] = wd[3]
        s[y][px + 1] = (L.rnd(px, y, 52) < 0.12) and wd[1] or wd[2]
      end
      s[POST_TOP][px], s[POST_TOP][px + 1] = wd[4], wd[3]
    end)
  end
  -- the crossbeam, running out past the right post to hold the lantern
  piece(b, function(s)
    for x = 20, 61 do
      s[BEAM_Y][x] = (L.rnd(x, 0, 53) < 0.3) and wd[4] or wd[3]
      s[BEAM_Y + 1][x] = (L.rnd(x, 1, 53) < 0.1) and wd[1] or wd[2]
    end
  end)
  -- the platform: a ledger lashed across the posts, with boards laid over it (their tops lit, dark seams
  -- between them). The last bay isn't boarded yet.
  piece(b, function(s)
    for x = 21, 56 do
      s[DECK_Y + 2][x] = (L.rnd(x, 2, 53) < 0.25) and wd[4] or wd[3]
      s[DECK_Y + 3][x] = wd[2]
    end
  end)
  piece(b, function(s)
    for x = 22, 48 do
      local seam = (x - 22) % 4 == 3
      s[DECK_Y - 1][x] = seam and wd[2] or wd[4]
      s[DECK_Y][x] = seam and C.outline or wd[3]
    end
  end)
  for _, px in ipairs(POSTS) do
    lashing(b, px, BEAM_Y, BEAM_Y + 1)
    lashing(b, px, DECK_Y + 2, DECK_Y + 3)
  end
  -- a pail left on the planks
  piece(b, function(s)
    local bx, by = 28, DECK_Y - 2 -- its bottom-left
    L.set(s, bx + 1, by - 4, st[2]); L.set(s, bx + 2, by - 4, st[2]) -- the handle
    L.set(s, bx, by - 3, st[2]); L.set(s, bx + 3, by - 3, st[2])
    s[by - 2][bx], s[by - 2][bx + 1], s[by - 2][bx + 2], s[by - 2][bx + 3] = st[4], st[4], st[3], st[3]
    s[by - 1][bx], s[by - 1][bx + 1], s[by - 1][bx + 2], s[by - 1][bx + 3] = st[3], st[3], st[2], st[1]
    s[by][bx + 1], s[by][bx + 2] = st[3], st[2]
  end)
end

-- The ladder, leaning on the left post from the ground to the planks. It's outlined only on its outside,
-- so the sky shows between the rungs.
local function ladder(b)
  local foot, head = { 13, 17 }, { 17, 21 } -- the rails' x at the foot (y1) and the head (y0)
  local y0, y1 = DECK_Y - 4, CY + 1
  local function rail(i, y) return math.floor(head[i] + (foot[i] - head[i]) * (y - y0) / (y1 - y0) + 0.5) end
  local s = L.buffer(W, H)
  for y = y0, y1 do
    s[y][rail(1, y)] = wd[3]
    s[y][rail(2, y)] = wd[2]
    if (y1 - y) % 3 == 2 then for x = rail(1, y) + 1, rail(2, y) - 1 do s[y][x] = wd[3] end end
  end
  local o = copy(s)
  L.outline(o, C.outline)
  for y = y0, y1 do
    for x = rail(1, y) + 1, rail(2, y) - 1 do if not s[y][x] then o[y][x] = nil end end
  end
  L.blit(b, o, 0, 0)
end

-------------------------------------------------------------------------------------------------
-- The lantern, whose flame flickers from frame to frame

-- Its frame, row by row from LANTERN_Y: a ring, a roof, the glass box and a base.
local LANTERN = { "..F..", ".FFF.", "FFFFF", "FgggF", "FgggF", "FgggF", "FgggF", "FFFFF", ".FFF." }

local function lantern(b, level)
  local lx0 = LANTERN_X - 2
  local shape = L.buffer(W, H)
  for row, s in ipairs(LANTERN) do
    for i = 1, #s do
      local ch, x, y = s:sub(i, i), lx0 + i - 1, LANTERN_Y + row - 1
      if ch == "F" then shape[y][x] = ln[1]
      elseif ch == "g" then
        -- the glass: the flame's core in the middle column, its glow round it, dimmer at the corners
        local gx, gy = i - 3, row - 4 -- -1..1 across, 0..3 down
        local core = gx == 0 and (gy == 1 or gy == 2)
        local near = (gx == 0) or gy == 1 or gy == 2
        local k
        if core then k = level + 1 elseif near then k = level else k = level - 1 end
        if level == 1 and gx == 0 then k = 2 end -- dim: a thin flame down the middle, the rest dark
        shape[y][x] = ln[math.max(1, k)]
      end
    end
  end
  L.set(shape, LANTERN_X, LANTERN_Y - 1, C.rope) -- tied under the beam
  -- the halo: warm translucent pixels round the glass, fading out over 1 px when dim and 2 px when bright
  -- (by squared distance: each level's { reach, colour } rings, nearest first)
  local rings = ({
    { { 1, ln[2] .. "38" }, { 2, ln[2] .. "20" } },
    { { 1, ln[2] .. "68" }, { 2, ln[2] .. "48" }, { 4, ln[2] .. "24" } },
    { { 1, ln[2] .. "90" }, { 2, ln[2] .. "68" }, { 4, ln[2] .. "40" }, { 5, ln[2] .. "24" } },
  })[level]
  local halo = L.buffer(W, H)
  for y = LANTERN_Y, LANTERN_Y + #LANTERN + 2 do
    for x = lx0 - 3, lx0 + 7 do
      if not shape[y][x] and not b[y][x] then
        local best = 99
        for yy = LANTERN_Y + 2, LANTERN_Y + #LANTERN - 1 do
          for xx = lx0, lx0 + 4 do
            if shape[yy][xx] then best = math.min(best, (x - xx) ^ 2 + (y - yy) ^ 2) end
          end
        end
        for _, ring in ipairs(rings) do
          if best <= ring[1] then halo[y][x] = ring[2]; break end
        end
      end
    end
  end
  L.blit(b, shape, 0, 0)
  L.blit(b, halo, 0, 0)
end

-------------------------------------------------------------------------------------------------

local base = rock()
scaffolding(base)
ladder(base)

-- Frame f of N (0-based): the lantern burns at FLAME[f + 1].
local function paint(f)
  local b = copy(base)
  lantern(b, FLAME[f + 1])
  return b
end

local frames = {}
for f = 0, N - 1 do frames[#frames + 1] = paint(f) end
I.write("unfinished", frames, MS, P.glow.unfinished)
