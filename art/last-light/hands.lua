-- Last Light's hands: the rifle, the shotgun and the lantern as you hold them, drawn over the view,
-- in last-light/assets/hands.png with each frame's place in hands.json. Run from the repo root:
--   aseprite -b --script art/last-light/hands.lua
--
-- The guns, the lantern and your hands are built as small solid models (capsules, boxes and
-- ellipsoids, in metres, in front of your eye) and ray-traced through the game's own camera: the
-- view is 480x270 (1080p at 4x) with the focal length the game uses. Each surface is lit by the
-- lantern in your left hand and quantised to a palette ramp for its material, and each part's
-- silhouette is darkened a step so the forms read. Muzzle flashes and the lantern's glow are painted
-- over the top, with alpha.
--
-- Each frame is cropped from a view-sized canvas, so its (ox, oy) is exact: where its top-left sits
-- relative to the bottom centre of the view. Every frame reaches the bottom of the view, and nothing
-- comes within 5 px of the crosshair at any view height the game draws at (checked at the end).
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()
local C = P.c

local VW, VH = 480, 270
local CX, CY = VW / 2, VH / 2
local F = VH / 2 / 0.5625 -- the game's focal length in pixels (a 0.5625 tangent to the top of the view)

-- A colour with alpha a (0..1).
local function A(hex, a) return hex .. string.format("%02x", math.max(0, math.min(255, math.floor(a * 255 + 0.5)))) end

---------------------------------------------------------------------------------------------------
-- Vectors: { x, y, z } with x right, y down, z forward from your eye.
local function V(x, y, z) return { x, y, z } end
local function add(a, b) return { a[1] + b[1], a[2] + b[2], a[3] + b[3] } end
local function sub(a, b) return { a[1] - b[1], a[2] - b[2], a[3] - b[3] } end
local function mul(a, k) return { a[1] * k, a[2] * k, a[3] * k } end
local function dot(a, b) return a[1] * b[1] + a[2] * b[2] + a[3] * b[3] end
local function cross(a, b) return { a[2] * b[3] - a[3] * b[2], a[3] * b[1] - a[1] * b[3], a[1] * b[2] - a[2] * b[1] } end
local function norm(a) local l = math.sqrt(dot(a, a)); return { a[1] / l, a[2] / l, a[3] / l } end

-- Rotates v about the unit axis k by angle a (Rodrigues).
local function rot(v, k, a)
  local c, s = math.cos(a), math.sin(a)
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))
end

-- A pose: an origin, three axes and a scale. place() takes a point from the pose's space to the
-- world, turn() a direction.
local function pose(o, x, y, z, k) return { o = o, x = x, y = y, z = z, k = k or 1 } end
local function turn(p, v) return add(add(mul(p.x, v[1]), mul(p.y, v[2])), mul(p.z, v[3])) end
local function place(p, v) return add(p.o, mul(turn(p, v), p.k)) end
-- A pose at o, facing along `fwd`, with its y as near to straight down as it can be, then rolled
-- by `roll` radians about its facing, drawn `k` times life size.
local function aim(o, fwd, roll, k)
  local z = norm(fwd)
  local y = norm(sub(V(0, 1, 0), mul(z, z[2])))
  local x = cross(y, z)
  if roll and roll ~= 0 then x, y = rot(x, z, roll), rot(y, z, roll) end
  return pose(o, x, y, z, k)
end
-- The same pose turned about one of its own points `at` by angle a about its own axis `axis`.
local function pivot(p, at, axis, a)
  local w = place(p, at)
  local kw = norm(turn(p, axis))
  local x, y, z = rot(p.x, kw, a), rot(p.y, kw, a), rot(p.z, kw, a)
  local q = pose(V(0, 0, 0), x, y, z, p.k)
  return pose(sub(w, place(q, at)), x, y, z, p.k)
end

-- Where a point in the world lands in the view.
local function project(v) return CX + v[1] / v[3] * F, CY + v[2] / v[3] * F end

---------------------------------------------------------------------------------------------------
-- Solids. Each has hit(ro, rd) -> distance, normal and an extra value (or nil), a screen box, a
-- material and an id (parts with the same id don't outline each other).

local function screenBox(points, r)
  local x0, y0, x1, y1 = 1e9, 1e9, -1e9, -1e9
  for _, p in ipairs(points) do
    local z = math.max(0.05, p[3] - r)
    local sx, sy = project(p)
    local pr = r / z * F
    x0, x1 = math.min(x0, sx - pr), math.max(x1, sx + pr)
    y0, y1 = math.min(y0, sy - pr), math.max(y1, sy + pr)
  end
  return { math.floor(x0) - 1, math.floor(y0) - 1, math.ceil(x1) + 1, math.ceil(y1) + 1 }
end

-- A capsule from a to b, radius r.
local function capsule(a, b, r, mat, id)
  local ba = sub(b, a)
  local baba = dot(ba, ba)
  local s = { mat = mat, id = id, box = screenBox({ a, b }, r) }
  function s.hit(ro, rd)
    local oa = sub(ro, a)
    local bard, baoa, rdoa, oaoa = dot(ba, rd), dot(ba, oa), dot(rd, oa), dot(oa, oa)
    local qa = baba - bard * bard
    local qb = baba * rdoa - baoa * bard
    local qc = baba * oaoa - baoa * baoa - r * r * baba
    local h = qb * qb - qa * qc
    if h < 0 then return nil end
    local t = (-qb - math.sqrt(h)) / qa
    local y = baoa + t * bard
    if y <= 0 or y >= baba then
      local oc = (y <= 0) and oa or sub(ro, b)
      local cb, cc = dot(rd, oc), dot(oc, oc) - r * r
      local h2 = cb * cb - cc
      if h2 <= 0 then return nil end
      t = -cb - math.sqrt(h2)
    end
    if t <= 0 then return nil end
    local p = add(ro, mul(rd, t))
    local k = math.max(0, math.min(1, dot(sub(p, a), ba) / baba))
    return t, mul(sub(p, add(a, mul(ba, k))), 1 / r), k
  end
  return s
end

-- A box: centre c, unit axes (u, v, w) and half-sizes h. `face(i, sign, q)` may paint a face with a
-- colour: i is the face's axis, q the hit in the box's own space (-1..1 on each axis).
local function box(c, u, v, w, h, mat, id, face)
  local pts = {}
  for _, sx in ipairs({ -1, 1 }) do
    for _, sy in ipairs({ -1, 1 }) do
      for _, sz in ipairs({ -1, 1 }) do pts[#pts + 1] = add(c, add(add(mul(u, h[1] * sx), mul(v, h[2] * sy)), mul(w, h[3] * sz))) end
    end
  end
  local s = { mat = mat, id = id, box = screenBox(pts, 0) }
  local ax = { u, v, w }
  function s.hit(ro, rd)
    local o = sub(ro, c)
    local tn, tf, ni, sgn = -1e9, 1e9, 1, 1
    for i = 1, 3 do
      local od, dd = dot(o, ax[i]), dot(rd, ax[i])
      if math.abs(dd) < 1e-9 then
        if math.abs(od) > h[i] then return nil end
      else
        local t1, t2 = (-h[i] - od) / dd, (h[i] - od) / dd
        local s1 = -1
        if t1 > t2 then t1, t2, s1 = t2, t1, 1 end
        if t1 > tn then tn, ni, sgn = t1, i, s1 end
        if t2 < tf then tf = t2 end
        if tn > tf then return nil end
      end
    end
    if tn <= 0 then return nil end
    local extra
    if face then
      local p = sub(add(ro, mul(rd, tn)), c)
      extra = face(ni, sgn, { dot(p, u) / h[1], dot(p, v) / h[2], dot(p, w) / h[3] })
    end
    return tn, mul(ax[ni], sgn), extra
  end
  return s
end

-- An ellipsoid: centre c, unit axes (u, v, w), radii r.
local function ellipsoid(c, u, v, w, r, mat, id)
  local s = { mat = mat, id = id, box = screenBox({ c }, math.max(r[1], r[2], r[3])) }
  function s.hit(ro, rd)
    local o = sub(ro, c)
    local lo = { dot(o, u) / r[1], dot(o, v) / r[2], dot(o, w) / r[3] }
    local ld = { dot(rd, u) / r[1], dot(rd, v) / r[2], dot(rd, w) / r[3] }
    local a, b, cc = dot(ld, ld), dot(lo, ld), dot(lo, lo) - 1
    local h = b * b - a * cc
    if h < 0 then return nil end
    local t = (-b - math.sqrt(h)) / a
    if t <= 0 then return nil end
    local q = add(lo, mul(ld, t))
    return t, norm(add(add(mul(u, q[1] / r[1]), mul(v, q[2] / r[2])), mul(w, q[3] / r[3]))), q
  end
  return s
end

-- Solids placed in a pose's own space: points, radii and sizes in its units.
local function cap(out, g, a, b, r, mat, id)
  local s = capsule(place(g, a), place(g, b), r * g.k, mat, id)
  out[#out + 1] = s
  return s
end
local function blk(out, g, c, h, mat, id, face)
  local s = box(place(g, c), g.x, g.y, g.z, { h[1] * g.k, h[2] * g.k, h[3] * g.k }, mat, id, face)
  out[#out + 1] = s
  return s
end
local function ell(out, g, c, u, v, r, mat, id)
  local uw, vw = norm(turn(g, u)), norm(turn(g, v))
  local s = ellipsoid(place(g, c), uw, vw, cross(uw, vw), { r[1] * g.k, r[2] * g.k, r[3] * g.k }, mat, id)
  out[#out + 1] = s
  return s
end

---------------------------------------------------------------------------------------------------
-- Materials, light and the renderer.

local MATS = {
  iron = { ramp = { C.void, C.iron0, C.iron1, C.iron2, C.stone1, C.stone2, C.stone3 }, amb = 0.12, spec = 0.55, shine = 30 },
  brass = { ramp = { C.wood0, C.wood1, C.brass0, C.brass1, C.fire3, C.fire4 }, amb = 0.12, spec = 0.5, shine = 24 },
  wood = { ramp = { C.wood0, C.wood1, C.wood2, C.wood3, C.wood4, C.wood5 }, amb = 0.14, spec = 0.12, shine = 10 },
  skin = { ramp = { C.wood0, C.skin0, C.skin1, C.skin2, C.wood5 }, amb = 0.22, spec = 0.1, shine = 8 },
  coat = { ramp = { C.void, C.needle0, C.needle1, C.needle2, C.needle3, C.stone2 }, amb = 0.2, spec = 0.05, shine = 4 },
  red = { ramp = { C.ichor0, C.mouth, C.hurt, C.flare1, C.flare2 }, amb = 0.3, spec = 0.3, shine = 16 },
  tin = { ramp = { C.void, C.iron0, C.iron1, C.iron2, C.stone1, C.stone2, C.stone3, C.fire3 }, amb = 0.12, spec = 0.6, shine = 14 },
}

-- Ray-traces a list of solids into a view-sized canvas, lit by a point light at `lamp`. A solid's
-- hit may return a colour (a painted detail), which is used as it is. A solid with `grain` has its
-- light scaled by grain(px, py, extra), where extra is what its hit returned (the figure in wood, the
-- folds in a sleeve).
local function render(solids, lamp)
  local b = L.buffer(VW, VH)
  local depth, ids, idx, ramps = {}, {}, {}, {}
  local x0, y0, x1, y1 = VW, VH, -1, -1
  for _, s in ipairs(solids) do
    x0, y0 = math.min(x0, s.box[1]), math.min(y0, s.box[2])
    x1, y1 = math.max(x1, s.box[3]), math.max(y1, s.box[4])
  end
  x0, y0, x1, y1 = math.max(0, x0), math.max(0, y0), math.min(VW - 1, x1), math.min(VH - 1, y1)
  local eye = V(0, 0, 0)
  for py = y0, y1 do
    for px = x0, x1 do
      local rd = norm(V((px + 0.5 - CX) / F, (py + 0.5 - CY) / F, 1))
      local best, bn, bs, bx
      for _, s in ipairs(solids) do
        local bb = s.box
        if px >= bb[1] and px <= bb[3] and py >= bb[2] and py <= bb[4] then
          local t, n, extra = s.hit(eye, rd)
          if t and (not best or t < best) then best, bn, bs, bx = t, n, s, extra end
        end
      end
      if best then
        local k = py * VW + px
        depth[k], ids[k] = best, bs.id
        if type(bx) == "string" then
          b[py][px] = bx
        else
          local m = MATS[bs.mat]
          local p = mul(rd, best)
          local l = sub(lamp, p)
          local dist = math.sqrt(dot(l, l))
          l = mul(l, 1 / dist)
          if dot(bn, rd) > 0 then bn = mul(bn, -1) end
          -- Soft light that wraps a little round each form, a highlight, and a faint fill from above.
          local diff = math.max(0, (dot(bn, l) + 0.3) / 1.3)
          local spec = m.spec * math.max(0, dot(bn, norm(sub(l, rd)))) ^ m.shine
          local v = m.amb + 0.1 * math.max(0, -bn[2]) + (0.72 * diff + spec) * math.min(1, 0.5 / dist)
          if bs.grain then v = v * bs.grain(px, py, bx) end
          local r = m.ramp
          local f = math.max(0, math.min(1, v)) * (#r - 1)
          local i = math.floor(f)
          if f - i > 0.25 + 0.5 * L.bayer(px, py) then i = i + 1 end
          i = math.max(1, math.min(#r, i + 1))
          idx[k], ramps[k] = i, r
          b[py][px] = r[i]
        end
      end
    end
  end
  -- Silhouettes: a pixel in front of empty space or of a farther part drops a step darker.
  for py = y0, y1 do
    for px = x0, x1 do
      local k = py * VW + px
      if idx[k] then
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          local qx, qy = px + d[1], py + d[2]
          if qy < VH and qx >= 0 and qx < VW and qy >= 0 then
            local q = qy * VW + qx
            if not depth[q] or (ids[q] ~= ids[k] and depth[q] > depth[k] + 0.012) then
              b[py][px] = ramps[k][math.max(1, idx[k] - 2)]
              break
            end
          end
        end
      end
    end
  end
  return b
end

-- The figure of wood: faint streaks, varying a part's light a little.
local function grain(seed)
  return function(px, py) return 0.93 + 0.14 * L.rnd(math.floor((px + py) / 3), math.floor((px - py) / 5), seed) end
end

-- Folds in a sleeve: soft creases across it, by how far along its capsule a pixel is (k, 0..1).
local function folds(n, seed)
  return function(px, py, k)
    local w = math.sin((k or 0) * n * math.pi * 2 + seed)
    return 1 - 0.28 * math.max(0, w) ^ 6 + 0.08 * math.max(0, -w)
  end
end

---------------------------------------------------------------------------------------------------
-- Painted light: glows and flashes, blended over the canvas.

-- A soft glow of `hex` fading out from (cx, cy) to radius r, at most `a` opaque; `behind` keeps it
-- to the empty air round what's drawn.
local function glow(b, cx, cy, r, hex, a, behind)
  local layer = L.buffer(VW, VH)
  for y = math.floor(cy - r), math.ceil(cy + r) do
    for x = math.floor(cx - r), math.ceil(cx + r) do
      local d = math.sqrt((x + 0.5 - cx) ^ 2 + (y + 0.5 - cy) ^ 2) / r
      if d < 1 and y >= 0 and y < VH and x >= 0 and x < VW then
        local k = (1 - d) ^ 1.8 * a
        if k > 0.03 and not (behind and b[y][x]) then layer[y][x] = A(hex, k) end
      end
    end
  end
  L.blit(b, layer, 0, 0)
end

-- A filled ellipse of one colour at (cx, cy), radii (rx, ry), turned by `ang`.
local function blot(b, cx, cy, rx, ry, ang, hex)
  local c, s = math.cos(ang), math.sin(ang)
  local r = math.max(rx, ry)
  for y = math.floor(cy - r), math.ceil(cy + r) do
    for x = math.floor(cx - r), math.ceil(cx + r) do
      local px, py = x + 0.5 - cx, y + 0.5 - cy
      local u, v = (c * px + s * py) / rx, (-s * px + c * py) / ry
      if u * u + v * v <= 1 and y >= 0 and y < VH and x >= 0 and x < VW then b[y][x] = hex end
    end
  end
end

-- A muzzle flash at the view point (fx, fy), blasting away along the unit direction (dx, dy).
local function flash(b, fx, fy, dx, dy, size)
  local ang = math.atan(dy, dx)
  glow(b, fx, fy, 8 * size, C.fire3, 0.6, true)
  for _, a in ipairs({ -1.1, -0.5, 0.5, 1.1 }) do
    local ex, ey = math.cos(ang + a), math.sin(ang + a)
    L.line(b, fx, fy, fx + ex * 7 * size, fy + ey * 7 * size, C.fire3, 2)
    L.line(b, fx, fy, fx + ex * 4.5 * size, fy + ey * 4.5 * size, C.fire4, 1)
  end
  for _, r in ipairs({ { 6.5, 3.8, C.fire3 }, { 4.5, 2.8, C.window }, { 2.5, 1.7, C.fire4 } }) do
    blot(b, fx + dx * r[1] * 0.7 * size, fy + dy * r[1] * 0.7 * size, r[1] * size, r[2] * size, ang, r[3])
  end
end

---------------------------------------------------------------------------------------------------
-- The lantern hangs low on your left, and lights everything else.
local LAMP = V(-0.23, 0.13, 0.46)

-- Your right hand, gripping a gun's wrist in the pose g: the back of the hand on the far side of the
-- grip, the thumb laid over the top, four fingers curled round under it and up the near side, and
-- the coat sleeve running back towards you. `lever` (0..1) swings the fingers down with the lever.
local function rightHand(out, g, lever)
  -- Working a lever, the whole hand swings down and back with it.
  lever = lever or 0
  g = pivot(g, V(0, 0.024, 0.15), V(1, 0, 0), lever * 0.55)
  cap(out, g, V(0.03, 0.015, -0.13), V(0.04, 0.28, -0.36), 0.047, "coat", "arm").grain = folds(5, 1)
  cap(out, g, V(0.028, 0.012, -0.105), V(0.036, 0.02, -0.15), 0.05, "coat", "cuff")
  cap(out, g, V(0.022, 0.004, -0.05), V(0.028, 0.012, -0.11), 0.026, "skin", "hand")
  ell(out, g, V(0.02, -0.004, -0.028), V(0.85, -0.53, 0), V(0.53, 0.85, 0), { 0.015, 0.03, 0.042 }, "skin", "hand")
  local fg = pivot(g, V(0, 0.024, 0.15), V(1, 0, 0), lever * 0.35)
  for i = 0, 3 do
    local z = 0.012 - i * 0.02
    local k, m, tip = V(0.024, 0.014, z), V(0.006, 0.034, z), V(-0.016, 0.022, z - 0.002)
    cap(out, fg, k, m, 0.0092 - i * 0.0006, "skin", "hand")
    cap(out, fg, m, tip, 0.0085 - i * 0.0006, "skin", "hand")
  end
  cap(out, g, V(0.016, -0.022, -0.05), V(0.0, -0.028, -0.018), 0.0115, "skin", "hand")
  cap(out, g, V(0.0, -0.028, -0.018), V(-0.012, -0.02, 0.012), 0.0098, "skin", "hand")
end

---------------------------------------------------------------------------------------------------
-- The lever-action rifle, in its own space: x right, y down, z forward along the barrel, with its
-- origin at the wrist where your hand holds it.
local SIZE = 1.25 -- the guns are drawn a size up, as games do, so they read

-- The way to face a gun held at `at` so that its muzzle (a point in its own space) lands on the view
-- point (tx, ty): found by nudging the facing until it does.
local function aimAt(at, muzzle, tx, ty)
  local fwd = V(0, 0, 1)
  for _ = 1, 60 do
    local mx, my = project(place(aim(at, fwd, 0, SIZE), muzzle))
    fwd = V(fwd[1] - (mx - tx) * 0.0015, fwd[2] - (my - ty) * 0.0015, 1)
  end
  return fwd
end

-- Where the muzzles end in a 270 px view: a little below and right of the crosshair.
local MUZZLE = { CX + 24, CY + 28 }
local RIFLE_AT = V(0.13, 0.2, 0.38)
local RIFLE_FWD = aimAt(RIFLE_AT, V(0, -0.024, 0.66), MUZZLE[1], MUZZLE[2])

-- p: lever (0 shut to 1 open); case (a spent case flying, 0..1); fire. There's no loading pose: the
-- rifle goes down out of the view to load (hud.js), and the rounds are heard going in.
local function rifle(p)
  local g = aim(RIFLE_AT, RIFLE_FWD, 0, SIZE)
  local s = {}
  -- The barrel and the magazine tube under it, held by a band near the muzzle; the sights.
  cap(s, g, V(0, -0.024, 0.16), V(0, -0.024, 0.66), 0.0092, "iron", "barrel")
  cap(s, g, V(0, -0.004, 0.16), V(0, -0.004, 0.62), 0.0072, "iron", "tube")
  blk(s, g, V(0, -0.015, 0.605), { 0.0105, 0.0185, 0.007 }, "iron", "band")
  blk(s, g, V(0, -0.036, 0.645), { 0.0018, 0.0045, 0.006 }, "iron", "sight")
  blk(s, g, V(0, -0.035, 0.30), { 0.0075, 0.0038, 0.003 }, "iron", "sight")
  -- The fore-end, walnut, round under the barrel.
  cap(s, g, V(0, -0.008, 0.19), V(0, -0.008, 0.40), 0.0165, "wood", "fore").grain = grain(3)
  -- The receiver: a brass box, a dark port on top, the loading gate on its right side, and a line of
  -- engraving round its side plate.
  blk(s, g, V(0, 0.0, 0.09), { 0.0135, 0.023, 0.074 }, "brass", "receiver", function(i, sg, q)
    if i == 1 and sg > 0 and q[3] > 0.05 and q[3] < 0.5 and q[2] > -0.05 and q[2] < 0.55 then
      if q[3] < 0.1 or q[3] > 0.45 or q[2] < 0 or q[2] > 0.5 then return C.brass0 end
      return C.iron1
    end
    if i == 1 and (math.abs(math.abs(q[2]) - 0.78) < 0.06 or math.abs(math.abs(q[3]) - 0.88) < 0.04) then return C.brass0 end
    if i == 1 and math.abs(q[3] + 0.55) < 0.08 and math.abs(q[2] - 0.3) < 0.12 then return C.wood1 end
  end)
  -- Its rounded top, with the bolt showing through the port.
  cap(s, g, V(0, -0.022, 0.03), V(0, -0.022, 0.15), 0.0135, "brass", "receiver")
  blk(s, g, V(0, -0.034, 0.075), { 0.005, 0.003, 0.035 }, "iron", "port")
  -- The hammer, cocked back at the rear of the receiver.
  cap(s, g, V(0, -0.03, 0.028), V(0, -0.05, 0.006), 0.0042, "iron", "hammer")
  -- The wrist and the butt stock, running back under your arm.
  cap(s, g, V(0, 0.004, 0.02), V(0, 0.016, -0.16), 0.0175, "wood", "stock").grain = grain(4)
  cap(s, g, V(0, 0.03, -0.16), V(0, 0.07, -0.4), 0.027, "wood", "stock").grain = grain(5)
  -- The lever: a bar back under the receiver from its pivot to the loop round your fingers.
  local lg = pivot(g, V(0, 0.024, 0.15), V(1, 0, 0), (p.lever or 0) * 0.95)
  local loop = { { 0.024, 0.15 }, { 0.027, 0.06 }, { 0.032, 0.035 }, { 0.058, 0.02 }, { 0.068, -0.02 }, { 0.058, -0.05 }, { 0.036, -0.055 }, { 0.026, -0.03 } }
  for i = 1, #loop - 1 do
    cap(s, lg, V(0, loop[i][1], loop[i][2]), V(0, loop[i + 1][1], loop[i + 1][2]), 0.0046, "iron", "lever")
  end
  cap(s, g, V(0, 0.022, 0.03), V(0, 0.038, 0.02), 0.0028, "iron", "trigger")
  -- A spent case flung up out of the port.
  if p.case then
    local c0 = V(0.01 + 0.05 * p.case, -0.045 - 0.05 * p.case, 0.075 - 0.01 * p.case)
    local d = mul(norm(V(math.cos(p.case * 5), math.sin(p.case * 5), 0.4)), 0.011)
    cap(s, g, sub(c0, d), add(c0, d), 0.005, "brass", "case")
  end
  -- Your hand on the wrist, working the lever with it.
  rightHand(s, g, p.lever)
  local b = render(s, LAMP)
  if p.fire then
    local mx, my = project(place(g, V(0, -0.024, 0.675)))
    local ex, ey = project(place(g, V(0, -0.024, 1.5)))
    local d = math.sqrt((ex - mx) ^ 2 + (ey - my) ^ 2)
    flash(b, mx, my, (ex - mx) / d, (ey - my) / d, 1.1)
  end
  return b, { project(place(g, V(0, -0.024, 0.66))) }
end

---------------------------------------------------------------------------------------------------
-- The double-barrelled shotgun, in its own space like the rifle: two barrels side by side on a rib,
-- a walnut fore-end, a case-hardened action with two hammers, and your hand on the wrist.
local SHOTGUN_AT = V(0.13, 0.2, 0.38)
local SHOTGUN_FWD = aimAt(SHOTGUN_AT, V(0, -0.02, 0.62), MUZZLE[1], MUZZLE[2])

-- The mottled colours of case-hardened steel.
local function mottle(q)
  local n = L.rnd(math.floor((q[1] + 2) * 4), math.floor((q[2] + 2) * 3) + math.floor((q[3] + 2) * 5) * 13, 9)
  return (n < 0.2) and C.brass0 or (n < 0.3) and C.wood3 or (n < 0.38) and C.stone2 or nil
end

-- p: open (0 shut, 1 broken open), shells (0 none, 1 half in, 2 home), tip and lower (the snap
-- shut), fire.
local function shotgun(p)
  local fwd = SHOTGUN_FWD
  if p.tip then fwd = rot(fwd, V(1, 0, 0), p.tip) end
  local g = aim(add(SHOTGUN_AT, V(0, p.lower or 0, 0)), fwd, 0, SIZE)
  local s = {}
  -- The barrels and the fore-end swing down together about the hinge when it's broken open.
  local bg = pivot(g, V(0, 0.01, 0.14), V(1, 0, 0), -(p.open or 0) * 0.7)
  for _, x in ipairs({ -0.0095, 0.0095 }) do cap(s, bg, V(x, -0.02, 0.11), V(x, -0.02, 0.62), 0.0094, "iron", "barrel" .. x) end
  blk(s, bg, V(0, -0.029, 0.37), { 0.0028, 0.002, 0.245 }, "iron", "rib")
  blk(s, bg, V(0, -0.031, 0.61), { 0.0015, 0.0015, 0.0015 }, "brass", "bead")
  cap(s, bg, V(0, -0.004, 0.14), V(0, -0.004, 0.33), 0.0185, "wood", "fore").grain = grain(6)
  -- The breech ends of the barrels: two chambers, empty or with the brass heads of shells in them.
  blk(s, bg, V(0, -0.017, 0.106), { 0.0195, 0.0115, 0.004 }, "iron", "breech", function(i, sg, q)
    if i ~= 3 or sg > 0 then return nil end
    for _, cx in ipairs({ -0.49, 0.49 }) do
      local d = math.sqrt(((q[1] - cx) / 0.4) ^ 2 + ((q[2] + 0.2) / 0.72) ^ 2)
      if d < 1 then
        if (p.shells or 0) >= 1 then return (d < 0.35) and C.brass0 or (d < 0.8) and C.brass1 or C.fire3 end
        return (d < 0.75) and C.void or C.iron0
      end
    end
  end)
  -- Shells half in: their red paper bodies stand out of the chambers, brass heads towards you.
  if (p.shells or 0) == 1 then
    for _, x in ipairs({ -0.0095, 0.0095 }) do
      cap(s, bg, V(x, -0.02, 0.078), V(x, -0.02, 0.102), 0.0084, "red", "shell" .. x)
      cap(s, bg, V(x, -0.02, 0.072), V(x, -0.02, 0.078), 0.0093, "brass", "head" .. x)
    end
  end
  -- The action: case-hardened steel, and its two hammers cocked back.
  blk(s, g, V(0, -0.006, 0.059), { 0.02, 0.022, 0.041 }, "iron", "action", function(_, _, q) return mottle(q) end)
  blk(s, g, V(0, 0.008, 0.12), { 0.016, 0.008, 0.022 }, "iron", "action", function(_, _, q) return mottle(q) end)
  cap(s, g, V(0, -0.024, 0.025), V(0, -0.024, 0.096), 0.0165, "iron", "action")
  for _, x in ipairs({ -0.011, 0.011 }) do
    cap(s, g, V(x, -0.03, 0.03), V(x * 1.2, -0.054, 0.008), 0.0048, "iron", "hammer" .. x)
    blk(s, g, V(x * 1.2, -0.056, 0.006), { 0.004, 0.0025, 0.005 }, "iron", "hammer" .. x)
  end
  -- The trigger guard and triggers.
  local guard = { { 0.016, 0.11 }, { 0.036, 0.085 }, { 0.042, 0.04 }, { 0.036, 0.005 }, { 0.022, -0.012 } }
  for i = 1, #guard - 1 do cap(s, g, V(0, guard[i][1], guard[i][2]), V(0, guard[i + 1][1], guard[i + 1][2]), 0.0036, "iron", "guard") end
  cap(s, g, V(0, 0.016, 0.06), V(0, 0.032, 0.052), 0.0028, "iron", "trigger")
  cap(s, g, V(0, 0.016, 0.045), V(0, 0.03, 0.036), 0.0028, "iron", "trigger")
  -- The wrist and the butt stock.
  cap(s, g, V(0, 0.004, 0.02), V(0, 0.018, -0.16), 0.019, "wood", "stock").grain = grain(7)
  cap(s, g, V(0, 0.032, -0.16), V(0, 0.075, -0.4), 0.029, "wood", "stock").grain = grain(8)
  rightHand(s, g, 0)
  local b = render(s, LAMP)
  if p.fire then
    for _, x in ipairs({ -0.0095, 0.0095 }) do
      local mx, my = project(place(bg, V(x, -0.02, 0.635)))
      local ex, ey = project(place(bg, V(x, -0.02, 1.5)))
      local d = math.sqrt((ex - mx) ^ 2 + (ey - my) ^ 2)
      flash(b, mx, my, (ex - mx) / d, (ey - my) / d, 1)
    end
  end
  return b
end

---------------------------------------------------------------------------------------------------
-- The lantern in your left hand: a tin hurricane lantern hanging from its wire bail, the flame burning
-- in its glass globe behind the guard wires, its cap and its fuel tank lit by the flame. Its own flame
-- lights it, and a warm glow hangs in the air round it.
local LANTERN_AT = V(-0.285, 0.272, 0.6)

-- A glowing glass globe: an ellipsoid painted by the flame inside it. `flick` (0 or 1) bends the
-- flame.
local function globe(c, r, flick)
  local s = ellipsoid(c, V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), r, "tin", "globe")
  local hit = s.hit
  function s.hit(ro, rd)
    local t, n, q = hit(ro, rd)
    if not t then return nil end
    local fx = q[1] - (flick == 1 and 0.08 or -0.05) * (0.4 - q[2])
    local tall = (flick == 1) and 0.62 or 0.5
    local f = math.abs(fx) / (0.3 * (1 - math.max(0, -q[2]) / tall)) + math.max(0, q[2] - 0.35) * 3
    local col
    if q[2] > -tall and q[2] < 0.45 and f < 0.5 then col = C.fire4
    elseif q[2] > -tall - 0.12 and q[2] < 0.55 and f < 0.95 then col = C.window
    elseif math.abs(q[1]) > 0.78 or q[2] < -0.78 or q[2] > 0.85 then col = C.fire2
    else col = C.fire3 end
    return t, n, col
  end
  return s
end

-- p: flick (0 or 1).
local function lantern(p)
  local g = pose(LANTERN_AT, V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), 1)
  local s = {}
  -- The forearm, coming up from the bottom left to the fist that holds the bail.
  local wr = place(g, V(-0.028, -0.124, -0.02))
  s[#s + 1] = capsule(add(wr, V(-0.014, 0.02, -0.02)), add(wr, V(-0.07, 0.3, -0.12)), 0.034, "coat", "arm")
  s[#s].grain = folds(4, 2)
  s[#s + 1] = capsule(add(wr, V(-0.002, 0.004, -0.004)), add(wr, V(-0.012, 0.04, -0.024)), 0.037, "coat", "cuff")
  s[#s + 1] = capsule(wr, add(wr, V(0.012, -0.004, 0.01)), 0.02, "skin", "fist")
  -- The fist round the top of the bail: knuckles forward, the thumb over the top.
  ell(s, g, V(-0.006, -0.134, 0.004), V(1, 0.2, 0), V(-0.2, 1, 0), { 0.033, 0.026, 0.03 }, "skin", "fist")
  for i = 0, 3 do
    local x = -0.024 + i * 0.0145
    cap(s, g, V(x, -0.146, -0.02), V(x + 0.003, -0.118, -0.026), 0.0085, "skin", "fist")
  end
  cap(s, g, V(-0.03, -0.152, 0.004), V(0.004, -0.158, -0.016), 0.0095, "skin", "fist")
  -- The bail: a wire arc from the cap's sides up into your fist.
  local prev
  for i = 0, 10 do
    local a = math.pi * i / 10
    local pt = V(-0.036 * math.cos(a), -0.042 - 0.08 * math.sin(a), 0)
    if prev then cap(s, g, prev, pt, 0.0024, "iron", "bail") end
    prev = pt
  end
  -- The cap and its chimney.
  ell(s, g, V(0, -0.05, 0), V(1, 0, 0), V(0, 1, 0), { 0.037, 0.013, 0.037 }, "tin", "cap")
  cap(s, g, V(0, -0.058, 0), V(0, -0.074, 0), 0.013, "tin", "cap")
  ell(s, g, V(0, -0.078, 0), V(1, 0, 0), V(0, 1, 0), { 0.019, 0.006, 0.019 }, "tin", "cap")
  -- The globe and the guard wires in front of it.
  s[#s + 1] = globe(place(g, V(0, 0, 0)), { 0.03, 0.043, 0.03 }, p.flick)
  for _, a in ipairs({ 0.2, 1.0, 1.8, 2.6, 3.4 }) do
    local x, z = math.cos(a + 2.9) * 0.034, math.sin(a + 2.9) * 0.034
    cap(s, g, V(x, 0.042, z), V(x * 0.95, -0.04, z * 0.95), 0.0022, "iron", "guard")
  end
  cap(s, g, V(-0.035, 0.0, 0), V(0.035, 0.0, 0), 0.0022, "iron", "guard")
  -- The fuel tank, and the brass wick key on its side.
  ell(s, g, V(0, 0.058, 0), V(1, 0, 0), V(0, 1, 0), { 0.045, 0.019, 0.045 }, "tin", "tank")
  cap(s, g, V(0, 0.07, 0), V(0, 0.078, 0), 0.036, "tin", "tank")
  cap(s, g, V(0.034, 0.05, -0.028), V(0.042, 0.05, -0.036), 0.005, "brass", "key")
  local b = render(s, place(g, V(0, -0.005, 0)))
  local cx, cy = project(place(g, V(0, -0.004, 0)))
  glow(b, cx, cy, (p.flick == 1) and 30 or 27, C.fire3, (p.flick == 1) and 0.3 or 0.26, true)
  return b
end

-- Throwing a flare: `back` (your hand drawn back and low, holding the lit flare) or forward (your arm
-- out towards the trees, the hand open and empty).
local function throw(p)
  local s = {}
  local b
  if p.back then
    -- The fist low on the left, the flare standing out of it, burning.
    local fist = V(-0.17, 0.15, 0.33)
    local g = pose(fist, V(0.94, 0.34, 0), V(-0.34, 0.94, 0), V(0, 0, 1), 1)
    s[#s + 1] = capsule(add(fist, V(-0.01, 0.02, -0.01)), add(fist, V(-0.16, 0.3, -0.16)), 0.038, "coat", "arm")
    ell(s, g, V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), { 0.027, 0.024, 0.03 }, "skin", "fist")
    for i = 0, 3 do cap(s, g, V(-0.018 + i * 0.012, -0.012, -0.022), V(-0.016 + i * 0.012, 0.012, -0.026), 0.007, "skin", "fist") end
    cap(s, g, V(0.02, -0.018, -0.012), V(0.004, -0.024, -0.024), 0.008, "skin", "fist")
    local top = place(g, V(0.01, -0.085, 0.006))
    s[#s + 1] = capsule(place(g, V(0.0, 0.03, 0.0)), top, 0.0105, "red", "flare")
    s[#s + 1] = capsule(place(g, V(0.0, 0.03, 0.0)), place(g, V(0.0, 0.045, 0.0)), 0.0115, "iron", "cap")
    b = render(s, add(top, V(0.03, 0.0, -0.06)))
    local fx, fy = project(top)
    glow(b, fx, fy - 4, 30, C.flare2, 0.55, true)
    for _, sp in ipairs({ { -8, -10 }, { 6, -12 }, { 10, -5 }, { -11, -3 }, { 2, -17 }, { -5, -15 }, { 8, 2 }, { -3, -21 } }) do L.set(b, fx + sp[1], fy + sp[2], C.fire4) end
    for _, sp in ipairs({ { -6, -6 }, { 4, -8 }, { -2, -12 }, { 7, -1 } }) do L.set(b, fx + sp[1], fy + sp[2], C.flare2) end
    blot(b, fx, fy - 6, 5.5, 9.5, 0.15, C.flare2)
    blot(b, fx, fy - 4, 3.5, 6, 0.15, C.fire4)
    blot(b, fx, fy - 2, 2, 3, 0, C.window)
  else
    -- The arm reaching out, the hand open, fingers spread, just let go.
    local hand = V(-0.14, 0.1, 0.48)
    local g = pose(hand, V(1, 0, 0), V(0, 0.8, -0.6), cross(V(1, 0, 0), V(0, 0.8, -0.6)), 1)
    s[#s + 1] = capsule(add(hand, V(-0.02, 0.03, -0.04)), add(hand, V(-0.12, 0.3, -0.3)), 0.037, "coat", "arm")
    ell(s, g, V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), { 0.03, 0.036, 0.014 }, "skin", "hand")
    for i = 0, 3 do
      local x = -0.021 + i * 0.014
      cap(s, g, V(x, -0.03, 0), V(x * 1.5, -0.075 + math.abs(x) * 0.4, -0.004), 0.0072, "skin", "hand")
    end
    cap(s, g, V(0.026, -0.004, 0), V(0.056, -0.03, -0.004), 0.0082, "skin", "hand")
    b = render(s, V(-0.2, 0.2, 0.3))
  end
  return b
end

---------------------------------------------------------------------------------------------------
-- Cropping and writing.

-- The crosshair must stay clear at every height the view can be. The game draws at the whole-number
-- scale nearest 270 px tall (view.js: h = ceil(device height / scale)), so h runs from 225 to 315 at
-- any scale from 3 up. hud.js anchors each frame to the bottom centre of the view, sways it up to 3 px
-- sideways as you walk (only ever down, never up), and puts the 7x7 crosshair at floor(w / 2) - 3,
-- floor(h / 2) - 3. Nothing drawn in any frame may come within 5 px of it: at any of those heights,
-- either width parity, and any sway. `clear[h]` keeps the nearest gap found at each height (the
-- empty pixels between a drawn pixel and the crosshair's box, counted square-wise) and whose it was.
local LOW, HIGH = 225, 315
local clear = {}
local function jsRound(x) return math.floor(x + 0.5) end
local function checkClear(name, b, ox, oy, lo, hi)
  local near = {}
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      if b[y][x] and math.abs(ox + x) < 40 and oy + y < -60 then near[#near + 1] = { ox + x, oy + y } end
    end
  end
  for h = lo, hi do
    local best = clear[h] or { math.huge, "nothing within 40 px" }
    for parity = 0, 1 do
      for sway = -6, 6 do
        local dx = jsRound(parity * 0.5 + sway * 0.5)
        for _, q in ipairs(near) do
          local gap = math.floor(math.max(math.abs(q[1] + dx) - 3, math.abs(q[2] + math.ceil(h / 2)) - 3) - 1)
          if gap < best[1] then best = { gap, name } end
        end
      end
    end
    clear[h] = best
  end
end

-- The bounding box of what's painted on a view-sized canvas, always reaching the bottom of the view,
-- checked for the crosshair's clearance.
local function crop(b, name)
  local x0, y0, x1 = VW, VH, -1
  for y = 0, VH - 1 do
    for x = 0, VW - 1 do
      if b[y][x] then
        if x < x0 then x0 = x end
        if x > x1 then x1 = x end
        if y < y0 then y0 = y end
      end
    end
  end
  assert(x1 >= 0, name .. " is empty")
  local piece = { name, L.crop(b, x0, y0, x1 - x0 + 1, VH - y0), x0 - VW / 2, y0 - VH }
  checkClear(name, piece[2], piece[3], piece[4], 150, HIGH)
  return piece
end

local idle, muzzle = rifle({})
print(string.format("rifle muzzle at %.1f, %.1f from the crosshair", muzzle[1] - CX, muzzle[2] - CY))
local pieces = {
  crop(idle, "rifle-idle"),
  crop(rifle({ fire = true }), "rifle-fire"),
  crop(rifle({ lever = 0.5, case = 0.25 }), "rifle-lever-1"),
  crop(rifle({ lever = 1, case = 0.8 }), "rifle-lever-2"),
  crop(shotgun({}), "shotgun-idle"),
  crop(shotgun({ fire = true }), "shotgun-fire"),
  crop(shotgun({ open = 1, lower = 0.02 }), "shotgun-reload-1"),
  crop(shotgun({ open = 1, lower = 0.02, shells = 1 }), "shotgun-reload-2"),
  crop(shotgun({ shells = 2, tip = -0.06, lower = -0.01 }), "shotgun-reload-3"),
  crop(lantern({ flick = 0 }), "lantern-1"),
  crop(lantern({ flick = 1 }), "lantern-2"),
  crop(throw({ back = true }), "throw-1"),
  crop(throw({}), "throw-2"),
}
for _, h in ipairs({ LOW, 240, 255, 270, HIGH }) do
  print(string.format("h %d: the nearest drawn pixel is %d px clear of the crosshair (%s)", h, clear[h][1], clear[h][2]))
end
local lowest = HIGH + 1
for h = HIGH, 150, -1 do
  if clear[h][1] < 5 then break end
  lowest = h
end
print(string.format("clear at every height from %d%s up to %d", lowest, (lowest == 150) and " (the lowest checked)" or "", HIGH))
for h = LOW, HIGH do
  assert(clear[h][1] >= 5, string.format("at h %d, %s comes %d px from the crosshair", h, clear[h][2], clear[h][1]))
end
for _, pc in ipairs(pieces) do print(string.format("%-18s %3dx%-3d at %4d, %4d", pc[1], pc[2].w, pc[2].h, pc[3], pc[4])) end
L.writePieces("hands", pieces)
