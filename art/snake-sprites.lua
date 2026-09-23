-- Snake game sprite sheet: grass, apple and every snake piece, 12x12 tiles (drawn at 2x in the game).
-- Regenerate with the Aseprite MCP (run_lua_script: dofile this file), or from a shell:
--   aseprite -b --script art/snake-sprites.lua
-- Writes art/snake-sprites.aseprite (editable source) and snake/sprites.png (used by the game).
--
-- Sheet layout (column = rotation: facing/pointing right, down, left, up):
--   row 0  head                 row 1  head after a crash (X eyes)
--   row 2  tail (body to the right in column 0, then rotated)
--   row 3  straight body: horizontal, vertical, then the same with a spot
--   row 4  corner joining left+up, then rotated     row 5  the same with a spot
--   row 6  grass light, grass dark, apple, apple shadow
--   row 7  decorations on transparent: pink flower, cream flower, grass tuft, pebble

local T = 12
local COLS, ROWS = 4, 8
local W, H = T * COLS, T * ROWS
local ROOT = debug.getinfo(1, "S").source:sub(2):match("^(.-)art/[^/]+$") or ""
local function hex(h)
  return app.pixelColor.rgba(tonumber(h:sub(2,3),16), tonumber(h:sub(4,5),16), tonumber(h:sub(6,7),16), 255)
end
-- Same palette as art/snake-icon.lua so the game matches its card.
local C = {
  outline=hex("#2a2f26"),
  s1=hex("#2e5a4c"), s2=hex("#3f7a4d"), s3=hex("#5f9c48"), s4=hex("#8dbf4f"), s5=hex("#c9df7e"),
  spot=hex("#35664a"),
  g1=hex("#3d6a3c"), g2=hex("#55893f"), g3=hex("#77aa47"), g4=hex("#a2cc5c"),
  gl1=hex("#b4d672"), gl2=hex("#a8cf66"), gd1=hex("#9cc55e"), gd2=hex("#92bd57"),
  a1=hex("#9e2f2a"), a2=hex("#d2493b"), a3=hex("#ee7a5c"), a4=hex("#ffd2b8"),
  stem=hex("#5a3b24"), leaf=hex("#c2e27a"),
  eye=hex("#1d2230"), white=hex("#fffaf0"), blush=hex("#f2a09a"),
  yellow=hex("#f7d16b"), pink=hex("#f5a8bd"), cream=hex("#fff3dc"),
  pebble1=hex("#8a8f7c"), pebble2=hex("#b9bca8"),
  shadow=app.pixelColor.rgba(42, 47, 38, 70),
}

local buf = {}
for y = 0, H-1 do buf[y] = {} end
local function set(x, y, c) if x >= 0 and x < W and y >= 0 and y < H then buf[y][x] = c end end

-- Deterministic noise so the grass is identical on every run.
local function rnd(x, y)
  local n = (x * 374761393 + y * 668265263) % 2147483647
  n = ((n ~ (n >> 13)) * 1274126177) % 2147483647
  return (n % 1000) / 1000
end

-- Light comes from the top-left, slightly toward the viewer.
local function light(nx, ny, nz)
  local lx, ly, lz = -0.5, -0.7, 0.5
  local l = math.sqrt(lx*lx + ly*ly + lz*lz)
  return (nx*lx + ny*ly + nz*lz) / l
end
local function ramp(v, a, b, c, d, e)
  if v > 0.8 then return e elseif v > 0.5 then return d elseif v > 0.15 then return c elseif v > -0.25 then return b else return a end
end

-- Snake pieces are modelled once, facing right, in coordinates centred on the tile (-6..6).
-- Each tile is then rendered rotated a quarter turn at a time (clockwise on screen), and the
-- surface normal is rotated back so the light stays top-left whichever way the piece points.
local function rotate(x, y, k)  -- k clockwise quarter turns, screen coords (y down)
  for _ = 1, k % 4 do x, y = -y, x end
  return x, y
end

local R = 3.2        -- body radius in pixels, not counting the outline
local HEAD_R = 4.3   -- head is a bit wider than the body

-- Nearest point on a centreline given as dense samples.
local function nearest(line, u, v)
  local best, bx, by = math.huge, 0, 0
  for _, p in ipairs(line) do
    local d = (u - p[1])^2 + (v - p[2])^2
    if d < best then best, bx, by = d, p[1], p[2] end
  end
  return math.sqrt(best), bx, by
end
local function segment(x0, y0, x1, y1)
  local pts = {}
  for i = 0, 60 do local t = i / 60; pts[#pts + 1] = {x0 + (x1 - x0) * t, y0 + (y1 - y0) * t} end
  return pts
end

-- Centrelines (canonical orientation). Lines run a little past the tile edge so the tube
-- meets the neighbouring tile with no outline across the join.
local LINES = {
  straight = segment(-8, 0, 8, 0),
  -- Quarter circle around the top-left tile corner, joining the left edge to the top edge.
  corner = (function()
    local pts = {}
    for i = -10, 70 do
      local a = (i / 60) * (math.pi / 2)
      pts[#pts + 1] = {-6 + 6 * math.cos(a), -6 + 6 * math.sin(a)}
    end
    return pts
  end)(),
  -- Tail: comes in from the right edge and tapers to a point near the left side.
  tail = segment(-4.5, 0, 8, 0),
  neck = segment(-8, 0, 1, 0),
}

-- Returns the colour for canonical point (u, v), or nil for empty. `k` is the rotation, used
-- only to turn the normal back into screen space for lighting.
local function tube(line, radius, u, v, k, spotAt)
  local d, bx, by = nearest(line, u, v)
  if d > radius + 1 then return nil end
  if d > radius then return C.outline end
  local nx, ny = (u - bx) / radius, (v - by) / radius
  local nz = math.sqrt(math.max(0, 1 - nx*nx - ny*ny))
  local wx, wy = rotate(nx, ny, k)
  local c = ramp(light(wx, wy, nz), C.s1, C.s2, C.s3, C.s4, C.s5)
  -- A round spot on the back, leaving the brightest highlight showing through.
  if spotAt and (bx - spotAt[1])^2 + (by - spotAt[2])^2 + 1.3 * d * d < 4.2 and c ~= C.s5 then c = C.spot end
  return c
end

local PIECES = {}

function PIECES.straight(u, v, k, spotted)
  return tube(LINES.straight, R, u, v, k, spotted and {0, 0})
end

function PIECES.corner(u, v, k, spotted)
  local mid = math.cos(math.pi / 4) * 6 - 6
  return tube(LINES.corner, R, u, v, k, spotted and {mid, mid})
end

function PIECES.tail(u, v, k)
  -- Radius grows from a point at the tip to full width at the tile edge.
  local d, bx, by = nearest(LINES.tail, u, v)
  local r = R * math.min(1, math.max(0, (bx + 5) / 8)) ^ 1.3
  if d > r + 1 or u < -5 then return nil end
  if d > r then return C.outline end
  local nx, ny = (u - bx) / r, (v - by) / r
  local nz = math.sqrt(math.max(0, 1 - nx*nx - ny*ny))
  local wx, wy = rotate(nx, ny, k)
  return ramp(light(wx, wy, nz), C.s1, C.s2, C.s3, C.s4, C.s5)
end

function PIECES.head(u, v, k, dead)
  -- Head: a rounded blob just ahead of centre, joined to a neck coming in from the left edge.
  local hx, hrx, hry = 0.6, 5.0, HEAD_R
  local dx, dy = (u - hx) / (hrx + 1), v / (hry + 1)
  local inOutline = dx*dx + dy*dy <= 1
  dx, dy = (u - hx) / hrx, v / hry
  local e = dx*dx + dy*dy
  if e <= 1 then
    local nz = math.sqrt(math.max(0, 1 - e))
    local wx, wy = rotate(dx, dy, k)
    local c = ramp(light(wx, wy, nz), C.s1, C.s2, C.s3, C.s4, C.s5)
    -- Face: eyes on either side toward the front, rosy cheeks behind them.
    local px, py = math.floor(u + 6), math.floor(v + 6)  -- canonical pixel 0..11
    for _, side in ipairs({-1, 1}) do
      local ey = side < 0 and 3 or 8          -- eye rows (top / bottom of the head)
      if dead then
        if (px == 7 or px == 9) and (py == ey - side or py == ey + side) then c = C.eye end
        if px == 8 and py == ey then c = C.eye end
      elseif (px == 8 or px == 9) and (py == ey or py == ey - side) then
        -- 2x2 eye with its shine on whichever pixel is top-left on screen, so it matches the light.
        local sx, sy = rotate(px - 6, py - 6, k)
        local shine = true
        for _, q in ipairs({{8, ey}, {9, ey}, {8, ey - side}, {9, ey - side}}) do
          local qx, qy = rotate(q[1] - 6, q[2] - 6, k)
          if qx < sx or qy < sy then shine = false end
        end
        c = shine and C.white or C.eye
      end
      if px == 6 and py == ey then c = C.blush end
    end
    -- Nostrils.
    if not dead and px == 11 and (py == 5 or py == 6) then c = C.s2 end
    return c
  end
  if inOutline then return C.outline end
  return tube(LINES.neck, R, u, v, k)
end

-- Renders a piece into the sheet cell (col, row), rotated k quarter turns.
local function piece(col, row, k, fn, ...)
  local extra = {...}
  for y = 0, T-1 do for x = 0, T-1 do
    local u, v = rotate(x + 0.5 - 6, y + 0.5 - 6, -k)
    local c = fn(u, v, k, table.unpack(extra))
    if c then set(col * T + x, row * T + y, c) end
  end end
end

for k = 0, 3 do
  piece(k, 0, k, PIECES.head, false)
  piece(k, 1, k, PIECES.head, true)
  -- Tail modelled pointing left (body to the right); rotate so column 0 means "body is to the right".
  piece(k, 2, k, PIECES.tail)
  piece(k, 4, k, PIECES.corner, false)
  piece(k, 5, k, PIECES.corner, true)
end
piece(0, 3, 0, PIECES.straight, false)
piece(1, 3, 1, PIECES.straight, false)
piece(2, 3, 0, PIECES.straight, true)
piece(3, 3, 1, PIECES.straight, true)

-- Grass: two tones for a soft checkerboard, with a little speckle.
local function grass(col, base, alt, seed)
  for y = 0, T-1 do for x = 0, T-1 do
    local r = rnd(x + seed, y)
    local c = base
    if r < 0.12 then c = alt elseif r > 0.965 then c = C.g4 end
    set(col * T + x, 6 * T + y, c)
  end end
end
grass(0, C.gl1, C.gl2, 0)
grass(1, C.gd1, C.gd2, 31)

-- Apple (col 2, row 6): same shading as the icon's apple.
do
  local ox, oy = 2 * T, 6 * T
  local ax, ay, ar = 6, 6.8, 3.9
  for y = 0, T-1 do for x = 0, T-1 do
    local dx, dy = x + 0.5 - ax, y + 0.5 - ay
    if dx*dx + dy*dy <= (ar + 1)^2 then set(ox + x, oy + y, C.outline) end
  end end
  for y = 0, T-1 do for x = 0, T-1 do
    local dx, dy = (x + 0.5 - ax) / ar, (y + 0.5 - ay) / ar
    local d2 = dx*dx + dy*dy
    if d2 <= 1 then set(ox + x, oy + y, ramp(light(dx, dy, math.sqrt(1 - d2)), C.a1, C.a1, C.a2, C.a3, C.a4)) end
  end end
  set(ox + 6, oy + 2, C.stem); set(ox + 6, oy + 1, C.stem)
  set(ox + 7, oy + 1, C.leaf); set(ox + 8, oy + 1, C.leaf); set(ox + 8, oy + 0, C.leaf)
  set(ox + 5, oy + 1, C.outline); set(ox + 6, oy + 0, C.outline); set(ox + 7, oy + 0, C.outline)
  set(ox + 9, oy + 0, C.outline); set(ox + 9, oy + 1, C.outline); set(ox + 7, oy + 2, C.outline); set(ox + 8, oy + 2, C.outline)
end

-- Apple shadow (col 3, row 6): drawn under the apple, offset down-right.
do
  local ox, oy = 3 * T, 6 * T
  for y = 0, T-1 do for x = 0, T-1 do
    local dx, dy = (x + 0.5 - 6.5) / 4.6, (y + 0.5 - 10.3) / 1.6
    if dx*dx + dy*dy <= 1 then set(ox + x, oy + y, C.shadow) end
  end end
end

-- Decorations (row 7), transparent background, scattered over the grass by the game.
local function flower(col, cx, cy, petal, centre)
  local ox, oy = col * T, 7 * T
  for _, p in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do set(ox + cx + p[1], oy + cy + p[2], petal) end
  set(ox + cx, oy + cy, centre)
  set(ox + cx, oy + cy + 2, C.g2); set(ox + cx, oy + cy + 3, C.g2)
end
flower(0, 6, 5, C.pink, C.yellow)
flower(1, 5, 5, C.cream, C.yellow)
do -- tuft
  local ox, oy = 2 * T, 7 * T
  for _, p in ipairs({{4,6},{4,7},{5,5},{5,6},{5,7},{6,7},{7,4},{7,5},{7,6},{7,7},{8,6},{8,7}}) do
    set(ox + p[1], oy + p[2], C.g3)
  end
  set(ox + 5, oy + 5, C.g4); set(ox + 7, oy + 4, C.g4); set(ox + 7, oy + 5, C.g4)
end
do -- pebble
  local ox, oy = 3 * T, 7 * T
  for _, p in ipairs({{5,6},{6,6},{7,6},{5,7},{6,7},{7,7},{8,7},{6,5},{7,5}}) do set(ox + p[1], oy + p[2], C.pebble1) end
  set(ox + 6, oy + 5, C.pebble2); set(ox + 5, oy + 6, C.pebble2)
end

local spr = Sprite(W, H, ColorMode.RGB)
local img = spr.cels[1].image
for y = 0, H-1 do for x = 0, W-1 do
  if buf[y][x] then img:drawPixel(x, y, buf[y][x]) end
end end
spr:saveAs(ROOT .. "art/snake-sprites.aseprite")
spr:saveCopyAs(ROOT .. "snake/sprites.png")
print("wrote " .. ROOT .. "art/snake-sprites.aseprite and snake/sprites.png")
