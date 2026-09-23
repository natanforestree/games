-- Skeleton rig for Marrow's fighters: pale, faceless, lanky figures lit from the front by their glow.
-- A pose is a table of joint targets in pixels relative to the feet anchor (0, 0), facing right,
-- y up negative: hip, chest (the shoulders), head, handF/handB and footF/footB. Knees and elbows are
-- solved with two-bone IK, so every frame keeps the same limb lengths. `rot` rotates the whole pose
-- around the hip (cartwheels); `ball` draws a curled roll with the head at that angle instead.
return function(L, P)
  local R = {}
  local THIGH, SHIN, UPPER, FORE = 6, 6, 6, 6

  local function ik(ax, ay, tx, ty, l1, l2, bend)
    local dx, dy = tx - ax, ty - ay
    local d = math.sqrt(dx * dx + dy * dy)
    assert(d <= l1 + l2 + 0.01, string.format("limb can't reach (%.1f, %.1f) from (%.1f, %.1f)", tx, ty, ax, ay))
    d = math.max(math.abs(l1 - l2) + 0.01, math.min(l1 + l2 - 0.01, d))
    local a = math.acos(math.max(-1, math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    local base = math.atan(dy, dx)
    return ax + l1 * math.cos(base + bend * a), ay + l1 * math.sin(base + bend * a)
  end

  local function rotated(pose)
    if not pose.rot then return pose end
    local a = math.rad(pose.rot)
    local cx, cy = pose.hip[1], pose.hip[2]
    local out = {}
    for k, v in pairs(pose) do
      if type(v) == "table" and #v == 2 then
        local x, y = v[1] - cx, v[2] - cy
        out[k] = { cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a) }
      else
        out[k] = v
      end
    end
    return out
  end

  -- The silhouette is built as a mask of materials first: B = back limbs, T = torso, F = front
  -- limbs and neck, H = head. Shading then works from the mask's edges.
  local function newMask() return { cells = {} } end
  local function put(m, x, y, mat)
    x, y = math.floor(x), math.floor(y)
    m.cells[y] = m.cells[y] or {}
    m.cells[y][x] = mat
  end
  local function at(m, x, y)
    local row = m.cells[y]
    return row and row[x]
  end
  local function stamp(m, x, y, s, mat)
    local x0, y0 = math.floor(x - s / 2 + 0.5), math.floor(y - s / 2 + 0.5)
    for yy = y0, y0 + s - 1 do for xx = x0, x0 + s - 1 do put(m, xx, yy, mat) end end
  end
  local function seg(m, x0, y0, x1, y1, s, mat)
    local n = math.max(1, math.ceil(math.max(math.abs(x1 - x0), math.abs(y1 - y0)) * 2))
    for i = 0, n do
      local t = i / n
      stamp(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, s, mat)
    end
  end
  local function limb(m, rx, ry, tx, ty, l1, l2, bend, s, mat)
    local jx, jy = ik(rx, ry, tx, ty, l1, l2, bend)
    seg(m, rx, ry, jx, jy, s, mat)
    seg(m, jx, jy, tx, ty, s, mat)
  end

  -- An elongated, faceless skull along the neck's direction.
  local function head(m, p)
    local hx, hy = p.head[1], p.head[2]
    local nx, ny = hx - p.chest[1], hy - p.chest[2]
    local len = math.sqrt(nx * nx + ny * ny)
    if len == 0 then len = 1 end
    nx, ny = nx / len, ny / len
    for i = -1, 3 do
      stamp(m, hx + nx * (i - 1) * 0.9 + 0.4, hy + ny * (i - 1) * 0.9, (i == 3) and 2 or 3, "H")
    end
  end

  function R.mask(pose)
    local p = rotated(pose)
    local m = newMask()
    if p.ball then
      for y = -10, -1 do
        for x = -5, 4 do
          local dx, dy = x + 0.5, y + 5.5
          if dx * dx + dy * dy <= 22 then put(m, x, y, "T") end
        end
      end
      local a = math.rad(p.ball)
      stamp(m, 2.5 * math.cos(a), -5 + 2.5 * math.sin(a), 3, "H")
      return m
    end
    limb(m, p.hip[1], p.hip[2], p.footB[1], p.footB[2], THIGH, SHIN, p.kneeB or -1, 2, "B")
    limb(m, p.chest[1], p.chest[2], p.handB[1], p.handB[2], UPPER, FORE, p.elbowB or 1, 2, "B")
    seg(m, p.hip[1], p.hip[2], p.chest[1], p.chest[2], 4, "T")
    seg(m, p.chest[1], p.chest[2], p.head[1], p.head[2], 2, "F")
    limb(m, p.hip[1], p.hip[2], p.footF[1], p.footF[2], THIGH, SHIN, p.kneeF or -1, 2, "F")
    stamp(m, p.footF[1] + 1, p.footF[2], 2, "F")   -- a toe pointing forward
    limb(m, p.chest[1], p.chest[2], p.handF[1], p.handF[2], UPPER, FORE, p.elbowF or 1, 2, "F")
    head(m, p)
    return m
  end

  -- Rim light: the edge facing forward glows amber (hottest on the upper body), the pixel behind it
  -- is pale bone, the back edge is dark, and the torso shows ribs along the spine.
  function R.paint(b, ox, oy, m)
    local amber = P.amber
    for y, row in pairs(m.cells) do
      for x, mat in pairs(row) do
        local front, front2, back = not at(m, x + 1, y), not at(m, x + 2, y), not at(m, x - 1, y)
        local c
        if mat == "B" then
          c = front and amber[2] or (back and P.umber3 or P.bone0)
        elseif front then
          c = (y < -12) and amber[4] or amber[3]
        elseif front2 then
          c = P.bone3
        elseif back then
          c = P.bone0
        elseif mat == "T" and not at(m, x - 2, y) then
          c = (y % 2 == 0) and P.bone3 or P.umber3
        else
          c = P.bone2
        end
        L.set(b, ox + x, oy + y, c)
      end
    end
    -- outline: a dim glow just in front of the body, dark umber everywhere else
    local ring = {}
    for y, row in pairs(m.cells) do
      for x in pairs(row) do
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          local nx, ny = x + d[1], y + d[2]
          if not at(m, nx, ny) then ring[ny * 1000 + nx] = { nx, ny } end
        end
      end
    end
    for _, q in pairs(ring) do
      L.set(b, ox + q[1], oy + q[2], at(m, q[1] - 1, q[2]) and amber[1] or P.umber0)
    end
  end

  function R.draw(b, ox, oy, pose)
    R.paint(b, ox, oy, R.mask(pose))
  end

  -- A blade exactly where the game draws it (draw-fighters.js uses the same three colors):
  -- a 2px chitin hilt, a bone body and a pale 3px tip, `reach` pixels long starting at the hilt.
  function R.blade(b, ox, oy, h, reach, hilt)
    for i = 0, reach - 1 do
      local c = (i < 2) and P.bone0 or ((i >= reach - 3) and P.bone3 or P.bone2)
      L.set(b, ox + hilt + i, oy - h, c)
    end
  end

  -- Amber -> cyan, the same swap the game makes at load time (for previews).
  function R.swap(b)
    local map = {}
    for i = 1, 4 do map[P.amber[i]] = P.cyan[i] end
    for y = 0, b.h - 1 do
      for x = 0, b.w - 1 do
        local c = b[y][x]
        if c and map[c] then b[y][x] = map[c] end
      end
    end
  end

  return R
end
