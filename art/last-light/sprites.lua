-- Last Light's sprites: the creatures and props the game draws in the world (so far the crawler and
-- the gaunt), in last-light/assets/sprites.png, with their frames and animations in sprites.json. Run
-- from the repo root:
--   aseprite -b --script art/last-light/sprites.lua
--
-- The Hungry are built from shared body parts (a skull with its eyes and jaw, a ribcage and spine,
-- tapered limbs posed by a joint angle or two-bone IK, long fingers) drawn into a frame that keeps how
-- much each pixel faces your lantern. `finish` turns that into bone-pale flesh, darker round the
-- silhouette's edge so it reads against the dark. A pose is a handful of numbers (where the body sits,
-- each limb's angle and where its hand or foot goes, how far the jaw hangs), so a change to a part
-- reaches every frame.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()
local C = P.c

---------------------------------------------------------------------------------------------------
-- The rig.
local R = {}

-- Light comes from your lantern, behind you: from the front, a little above and to the left.
local LX, LY, LZ = -0.3, -0.45, 0.84
do
  local n = math.sqrt(LX * LX + LY * LY + LZ * LZ)
  LX, LY, LZ = LX / n, LY / n, LZ / n
end
local AMBIENT = 0.18
local FAR = 0.62 -- how much dimmer limbs on a creature's far side are

-- A frame being drawn. Each pixel is { v = light 0..1, thin = no rim } for flesh, or { c = colour }.
function R.frame(w, h) return { w = w, h = h, px = {} } end
local function key(f, x, y) return y * f.w + x end
local function inside(f, x, y) return x >= 0 and y >= 0 and x < f.w and y < f.h end

function R.flesh(f, x, y, v, thin)
  x, y = math.floor(x), math.floor(y)
  if inside(f, x, y) then f.px[key(f, x, y)] = { v = v, thin = thin } end
end
function R.paint(f, x, y, c)
  x, y = math.floor(x), math.floor(y)
  if inside(f, x, y) then f.px[key(f, x, y)] = { c = c } end
end
function R.at(f, x, y)
  x, y = math.floor(x), math.floor(y)
  if inside(f, x, y) then return f.px[key(f, x, y)] end
end
-- Scales the light of flesh already drawn at (x, y): shadow in a hollow, or a highlight on a bone.
function R.tint(f, x, y, k)
  local p = R.at(f, x, y)
  if p and p.v then p.v = math.max(0, math.min(1, p.v * k)) end
end

local function lightOf(nx, ny, nz, tone)
  return tone * (AMBIENT + (1 - AMBIENT) * math.max(0, nx * LX + ny * LY + nz * LZ))
end

-- A rounded mass (ellipsoid) centred at (cx, cy). `tone` dims parts further from the light.
function R.blob(f, cx, cy, rx, ry, tone, thin)
  tone = tone or 1
  for y = math.floor(cy - ry), math.ceil(cy + ry) do
    for x = math.floor(cx - rx), math.ceil(cx + rx) do
      local nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
      local d2 = nx * nx + ny * ny
      if d2 <= 1 then R.flesh(f, x, y, lightOf(nx, ny, math.sqrt(1 - d2), tone), thin) end
    end
  end
end

-- A tapered limb from (x0, y0), radius r0, to (x1, y1), radius r1, rounded like a cylinder.
function R.limb(f, x0, y0, x1, y1, r0, r1, tone)
  tone = tone or 1
  local dx, dy = x1 - x0, y1 - y0
  local len2 = math.max(1e-6, dx * dx + dy * dy)
  local rm = math.max(r0, r1)
  for y = math.floor(math.min(y0, y1) - rm), math.ceil(math.max(y0, y1) + rm) do
    for x = math.floor(math.min(x0, x1) - rm), math.ceil(math.max(x0, x1) + rm) do
      local px, py = x + 0.5, y + 0.5
      local t = math.max(0, math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2))
      local qx, qy = x0 + dx * t, y0 + dy * t
      local ox, oy = px - qx, py - qy
      local d = math.sqrt(ox * ox + oy * oy)
      local r = r0 + (r1 - r0) * t
      if d <= r then
        local s = d / r
        local nx, ny = (d > 0) and ox / d * s or 0, (d > 0) and oy / d * s or 0
        R.flesh(f, x, y, lightOf(nx, ny, math.sqrt(math.max(0, 1 - s * s)), tone))
      end
    end
  end
end

-- A thin limb or bone, drawn as a crisp line: 1 px, or 2 px with a lit side and a shaded side.
function R.stroke(f, x0, y0, x1, y1, width, tone)
  tone = tone or 1
  local dx, dy = x1 - x0, y1 - y0
  local n = math.max(1, math.ceil(math.max(math.abs(dx), math.abs(dy))))
  local steep = math.abs(dy) >= math.abs(dx)
  for i = 0, n do
    local x, y = math.floor(x0 + dx * i / n + 0.5), math.floor(y0 + dy * i / n + 0.5)
    if width <= 1 then
      R.flesh(f, x, y, 0.72 * tone, true)
    elseif steep then
      R.flesh(f, x - 1, y, 0.8 * tone, true)
      R.flesh(f, x, y, 0.5 * tone, true)
    else
      R.flesh(f, x, y - 1, 0.8 * tone, true)
      R.flesh(f, x, y, 0.5 * tone, true)
    end
  end
end

-- Two-bone IK: where the middle joint of a limb from `root` (bones l1 then l2) goes to reach
-- `target`, bending to the side `bend` (+1 or -1). Returns the joint and the end (short of the
-- target if it's out of reach).
function R.ik(rx, ry, tx, ty, l1, l2, bend)
  local dx, dy = tx - rx, ty - ry
  local d = math.max(0.01, math.min(math.sqrt(dx * dx + dy * dy), l1 + l2 - 0.01))
  local a = math.atan(dy, dx)
  local c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  local jx = rx + math.cos(a + bend * math.acos(math.max(-1, math.min(1, c)))) * l1
  local jy = ry + math.sin(a + bend * math.acos(math.max(-1, math.min(1, c)))) * l1
  local ea = math.atan(ty - jy, tx - jx)
  return jx, jy, jx + math.cos(ea) * l2, jy + math.sin(ea) * l2
end

-- A whole limb from its root (x, y) to its hand or foot at (tx, ty). The middle joint is set either by
-- the upper bone's angle `a1` (degrees; 0 is right, -90 up) and length `l1`, or by two-bone IK
-- (`l1`, `l2`, `bend` +1/-1). The joint is a bony knob; long fingers (or toes) splay from the end at
-- angle `fa` (radians), `fl` px long, `fs` apart. Limbs thinner than r 1.3 are crisp strokes.
function R.arm(f, a)
  local jx, jy, ex, ey
  if a.a1 then
    jx, jy = a.x + math.cos(math.rad(a.a1)) * a.l1, a.y + math.sin(math.rad(a.a1)) * a.l1
    ex, ey = a.tx, a.ty
  else
    jx, jy, ex, ey = R.ik(a.x, a.y, a.tx, a.ty, a.l1, a.l2, a.bend)
  end
  local tone = a.tone or 1
  if a.r1 >= 1.3 then R.limb(f, a.x, a.y, jx, jy, a.r1, a.r1 * 0.75, tone)
  else R.stroke(f, a.x, a.y, jx, jy, 2, tone) end
  if a.r2 >= 1.3 then R.limb(f, jx, jy, ex, ey, a.r2, a.r2 * 0.8, tone)
  else R.stroke(f, jx, jy, ex, ey, a.r2 >= 0.9 and 2 or 1, tone) end
  -- The joint: a bony knob that catches the light.
  R.blob(f, jx, jy, a.knob or 1.1, a.knob or 1.1, tone * 1.1, true)
  if a.fingers then
    for i = 1, a.fingers do
      local off = i - (a.fingers + 1) / 2
      local fa = a.fa + off * (a.fs or 0.35)
      local fl = a.fl * (1 - 0.3 * math.abs(off) / math.max(1, (a.fingers - 1) / 2))
      R.stroke(f, ex, ey, ex + math.cos(fa) * fl, ey + math.sin(fa) * fl, 1, tone * 0.95)
    end
  end
  return jx, jy, ex, ey
end

-- Knobbles along a spine: the topmost flesh in each column from x0 to x1 (searching down from y0)
-- alternately catches the light and falls into shadow.
function R.spine(f, x0, x1, y0)
  for x = math.floor(x0), math.floor(x1) do
    for y = math.floor(y0), f.h - 1 do
      if R.at(f, x, y) then
        R.tint(f, x, y, (x % 2 == 0) and 1.25 or 0.8)
        break
      end
    end
  end
end

-- Ribs across a ribcage centred at cx: `n` ribs from row y0, `gap` apart, curving down `curve` px at
-- the sides, `hw` px either side. Each rib catches the light and the hollow under it is shadowed.
function R.ribs(f, cx, y0, n, gap, hw, curve)
  for k = 0, n - 1 do
    for x = math.floor(cx - hw), math.ceil(cx + hw) do
      local u = (x + 0.5 - cx) / hw
      if math.abs(u) <= 1 and math.abs(u) > 0.18 then
        local y = math.floor(y0 + k * gap + curve * u * u + 0.5)
        R.tint(f, x, y, 1.18)
        R.tint(f, x, y + 1, 0.55)
      end
    end
  end
end

-- Side-on ribs: arcs running down the flank from the spine at (x, y0), `n` of them `gap` apart.
function R.flankRibs(f, x0, y0, n, gap, len, lean)
  for k = 0, n - 1 do
    for i = 0, len do
      local x = math.floor(x0 + k * gap + lean * i / len + 0.5)
      local y = math.floor(y0 + i)
      R.tint(f, x, y, 1.15)
      R.tint(f, x + 1, y, 0.55)
    end
  end
end

-- Side-on ribs: `n` ribs from the back (x0) to the front of the chest (x1), `gap` apart from row y0,
-- sloping down towards the front.
function R.sideRibs(f, x0, x1, y0, n, gap, slope)
  for k = 0, n - 1 do
    for x = math.floor(x0), math.floor(x1) do
      local y = math.floor(y0 + k * gap + slope * (x - x0) + 0.5)
      R.tint(f, x, y, 1.18)
      R.tint(f, x, y + 1, 0.55)
    end
  end
end

-- An eye: an eye2 core with an eye1 rim beside it (at `dx`, `dy`). `lit` 2 is wide open, 1 is dimming
-- (a single eye1 pixel, as a creature dies), 0 is shut.
function R.eye(f, x, y, dx, dy, lit)
  if lit == 0 then return end
  if lit >= 2 then
    R.paint(f, x, y, C.eye2)
    if dx ~= 0 or dy ~= 0 then R.paint(f, x + dx, y + dy, C.eye1) end
  else
    R.paint(f, x, y, C.eye1)
  end
end

-- A dark open mouth: a `w` x `h` hole at (x, y) (top-left), gums along the top, fangs at its
-- corners (and, if it's wide, one lower down), so it reads as a mouth even at a few pixels.
function R.mouth(f, x, y, w, h, teeth)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do R.paint(f, xx, yy, C.mouth) end
  end
  for xx = x, x + w - 1 do R.paint(f, xx, y, C.gum) end
  if teeth and h >= 2 then
    R.paint(f, x, y + 1, C.flesh4)
    R.paint(f, x + w - 1, y + 1, C.flesh4)
    if w >= 5 and h >= 3 then R.paint(f, x + 2, y + h - 1, C.flesh3) end
  end
end

-- Turns a frame into palette colours. Flesh goes flesh1..flesh4 by its light; on the silhouette's
-- edge it drops to a darker rim (flesh0 where it's already in shade), except on thin parts.
local RAMP = { C.flesh0, C.flesh1, C.flesh2, C.flesh3, C.flesh4 }
local CUT = { 0.24, 0.42, 0.6, 0.8 }
function R.finish(f)
  local b = L.buffer(f.w, f.h)
  local function level(v)
    local i = 1
    for k, t in ipairs(CUT) do if v >= t then i = k + 1 end end
    return i
  end
  for y = 0, f.h - 1 do
    for x = 0, f.w - 1 do
      local p = f.px[key(f, x, y)]
      if p and p.c then b[y][x] = p.c
      elseif p then
        local i = math.max(2, level(p.v))
        if not p.thin then
          local edge = false
          for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
            if not R.at(f, x + d[1], y + d[2]) then edge = true end
          end
          if edge then i = math.max(1, i - 2) end
        end
        b[y][x] = RAMP[i]
      end
    end
  end
  return b
end

---------------------------------------------------------------------------------------------------
-- The crawler: 32x20, low and spidery on all fours, head thrust forward with the jaw hanging open.
local CW, CH = 32, 20

-- The crawler's head seen from the front: a narrow skull with deep sockets, the jaw hanging open.
-- (cx, cy) is the skull's centre; `jaw` how far the mouth gapes (px); `eyes` 2 bright, 1 dim, 0 shut.
local function crawlerFace(f, cx, cy, s, jaw, eyes)
  R.blob(f, cx, cy, 3.8 * s, 3.0 * s)
  -- The brow juts over deep sockets; cheekbones with hollows under them.
  local ey = math.floor(cy - 0.6 * s)
  local lx, rx = math.floor(cx - 1.6 * s), math.floor(cx + 1.6 * s - 0.5)
  for x = lx - 1, rx + 1 do R.tint(f, x, ey - 1, 1.25) end
  R.tint(f, cx - 3 * s, cy + 1, 0.55); R.tint(f, cx + 3 * s - 1, cy + 1, 0.55)
  -- The jaw hangs below, the mouth a dark gape between.
  local mw = (s >= 1.2) and 6 or (s < 0.9) and 2 or 4
  local mx = math.floor(cx - mw / 2 + 0.5)
  local my = math.floor(cy + 1.2 * s)
  R.limb(f, mx - 0.5, my + jaw, mx + mw + 0.5, my + jaw, 1.2, 1.2)
  R.stroke(f, mx - 1, my - 1, mx - 1, my + jaw, 1)
  R.stroke(f, mx + mw, my - 1, mx + mw, my + jaw, 1)
  R.mouth(f, mx, my, mw, jaw, true)
  -- The eyes, sunk in dark sockets.
  for _, x in ipairs({ lx - 1, lx, rx, rx + 1 }) do R.paint(f, x, ey + 1, C.flesh0) end
  R.eye(f, lx, ey, -1, 0, eyes)
  R.eye(f, rx, ey, 1, 0, eyes)
end

-- The crawler from the front. Its long arms reach up to elbows higher than its back, then splay down
-- and out to hands on the ground, like a spider's legs; the hind legs do the same behind, dimmer.
-- p: the head (hx, hy, size, jaw, eyes), the back's height, and for each limb the upper bone's angle
-- (le, re, lk, rk) and where the hand or foot is (lh, rh, lf, rf).
local function crawlerFront(p)
  local f = R.frame(CW, CH)
  local hx, hy = p.hx or 16, p.hy or 12.5
  local back = p.back or 7
  R.arm(f, { x = 13.5, y = back + 2, a1 = p.lk or -160, l1 = 7, tx = p.lf[1], ty = p.lf[2], r1 = 1.3, r2 = 0.9, tone = FAR, knob = 1.2 })
  R.arm(f, { x = 18.5, y = back + 2, a1 = p.rk or -20, l1 = 7, tx = p.rf[1], ty = p.rf[2], r1 = 1.3, r2 = 0.9, tone = FAR, knob = 1.2 })
  -- The back: a bony hump of shoulder blades, the spine down its middle.
  R.blob(f, 16, back, 4.4, 2.8, 0.95)
  R.blob(f, 12.8, back + 0.6, 2.2, 2.0); R.blob(f, 19.2, back + 0.6, 2.2, 2.0)
  for y = math.floor(back - 2), math.floor(back + 2) do R.tint(f, 15, y, (y % 2 == 0) and 1.25 or 0.7) end
  R.arm(f, { x = 12, y = back + 1.5, a1 = p.le or -122, l1 = 8.2, tx = p.lh[1], ty = p.lh[2], r1 = 1.6, r2 = 1, knob = 1.4, fingers = 3, fa = p.lfa or math.pi * 0.85, fl = 3, fs = 0.5 })
  R.arm(f, { x = 20, y = back + 1.5, a1 = p.re or -58, l1 = 8.2, tx = p.rh[1], ty = p.rh[2], r1 = 1.6, r2 = 1, knob = 1.4, fingers = 3, fa = p.rfa or math.pi * 0.15, fl = 3, fs = 0.5 })
  -- The neck and head, thrust forward and low.
  R.limb(f, 16, back + 1, hx, hy - 1, 1.8, 1.6, 0.85)
  crawlerFace(f, hx, hy, p.size or 1, p.jaw or 3, p.eyes or 2)
  return R.finish(f)
end

-- The crawler side-on, facing right: the back hunched high over the shoulders, elbows and knees
-- jutting up beside it, the head hanging low and forward. p: the body's lift `by`, the jaw, and for
-- each limb (near arm `na`, far arm `fa`, near leg `nl`, far leg `fl`) the upper bone's angle and the
-- hand or foot.
local function crawlerSide(p)
  local f = R.frame(CW, CH)
  local by = p.by or 0
  local hipX, hipY, shX, shY = 9, 9 + by, 18, 7.5 + by
  R.arm(f, { x = shX - 0.5, y = shY + 1, a1 = p.fa[1], l1 = 7, tx = p.fa[2], ty = p.fa[3], r1 = 1.3, r2 = 0.9, tone = FAR, fingers = 2, fa = 0.1, fl = 3, fs = 0.5 })
  R.arm(f, { x = hipX + 1, y = hipY, a1 = p.fl[1], l1 = 7, tx = p.fl[2], ty = p.fl[3], r1 = 1.3, r2 = 0.9, tone = FAR })
  -- The body: pelvis, a starved waist, a deep ribcage, the spine knobbling along the top.
  R.blob(f, hipX, hipY, 3.0, 2.6)
  R.limb(f, hipX + 1.5, hipY - 0.6, shX - 3.5, shY + 0.4, 2.0, 2.4)
  R.blob(f, shX - 2, shY + 1.2, 4.8, 3.6)
  R.blob(f, shX - 0.5, shY - 1, 2.4, 2.0) -- the shoulder blade
  R.flankRibs(f, shX - 6, shY + 0.5, 4, 2, 3, -1)
  R.spine(f, hipX - 2, shX + 1, 0)
  R.arm(f, { x = hipX, y = hipY + 0.5, a1 = p.nl[1], l1 = 7.5, tx = p.nl[2], ty = p.nl[3], r1 = 1.8, r2 = 1, knob = 1.3 })
  R.arm(f, { x = shX + 0.5, y = shY + 1.5, a1 = p.na[1], l1 = 7.5, tx = p.na[2], ty = p.na[3], r1 = 1.7, r2 = 1, knob = 1.3, fingers = 3, fa = 0.15, fl = 3, fs = 0.45 })
  -- The neck, and the head hanging low and forward, jaw open, in front of it all.
  local hx, hy = 25.5, 12.5 + by
  R.limb(f, shX + 1, shY + 0.5, hx - 1.5, hy - 1, 2.0, 1.5)
  R.blob(f, hx, hy, 3.0, 2.4)
  R.blob(f, hx + 2.3, hy + 0.4, 1.5, 1.2)
  local jaw = p.jaw or 3
  local mx, my = math.floor(hx - 0.5), math.floor(hy + 1.4)
  R.stroke(f, hx - 2, my + 0.5, mx + 4, my + jaw, 2)
  for yy = my, my + jaw - 1 do
    for xx = mx + (yy - my), mx + 4 do R.paint(f, xx, yy, C.mouth) end
  end
  for xx = mx, mx + 4 do R.paint(f, xx, my, C.gum) end
  R.paint(f, mx + 4, my + 1, C.flesh4); R.paint(f, mx + 2, my + 1, C.flesh4)
  R.tint(f, hx - 1, hy - 1.6, 1.3); R.tint(f, hx, hy - 1.6, 1.3); R.tint(f, hx + 1, hy - 1.6, 1.3)
  R.paint(f, math.floor(hx), math.floor(hy - 0.6), C.flesh0)
  R.eye(f, math.floor(hx) + 2, math.floor(hy - 0.6), -1, 0, p.eyes or 2)
  return R.finish(f)
end

local function crawler()
  local G = CH - 1 -- the ground row
  local frames = {}
  -- 0-3 walk (front): each arm lifts in turn (towards you, so it looks shorter), with the hind leg
  -- on the other side; the head sways away from the lifted arm.
  local walk = {
    { lh = { 6, 13 }, le = -110, rh = { 31, G }, lf = { 7, G }, rf = { 24, 16 }, rk = -10, hx = 17 },
    { lh = { 1, G }, rh = { 31, G }, lf = { 7, G }, rf = { 25, G }, back = 7.5, hy = 13, hx = 16 },
    { lh = { 1, G }, rh = { 26, 13 }, re = -70, lf = { 8, 16 }, lk = -170, rf = { 25, G }, hx = 15 },
    { lh = { 1, G }, rh = { 31, G }, lf = { 7, G }, rf = { 25, G }, back = 7.5, hy = 13, hx = 16 },
  }
  for _, p in ipairs(walk) do frames[#frames + 1] = crawlerFront(p) end
  -- 4-7 side-walk: diagonal pairs step together (near arm with far leg, far arm with near leg); each
  -- limb is planted forward, mid, back, then lifted and swung through.
  local gait = { { 1, 0 }, { 0, 0 }, { -1, 0 }, { 0, 1 } }
  for i = 1, 4 do
    local a, b = gait[i], gait[(i + 1) % 4 + 1]
    frames[#frames + 1] = crawlerSide({
      by = (a[2] + b[2] > 0) and -0.5 or 0,
      na = { -52 + 10 * a[1] - 12 * a[2], 28.5 + 2.5 * a[1], G - 4 * a[2] },
      fl = { -112 + 10 * a[1], 6.5 + 2.5 * a[1], G - 3 * a[2] },
      fa = { -62 + 10 * b[1] - 12 * b[2], 24.5 + 2.5 * b[1], G - 4 * b[2] },
      nl = { -128 + 10 * b[1], 3 + 2.5 * b[1], G - 3 * b[2] },
      jaw = (i % 2 == 1) and 3 or 2,
    })
  end
  -- 8-9 attack: it rears up, claws raised, then lunges at you, jaws wide.
  frames[#frames + 1] = crawlerFront({ lh = { 3, 4 }, le = -150, rh = { 29, 4 }, re = -30, lf = { 8, G }, rf = { 24, G }, back = 6, hy = 10.5, jaw = 4, lfa = -math.pi * 0.6, rfa = -math.pi * 0.4 })
  frames[#frames + 1] = crawlerFront({ lh = { 1, 12 }, le = -165, rh = { 31, 12 }, re = -15, lf = { 9, G }, rf = { 23, G }, back = 7, hy = 12.5, jaw = 5, size = 1.3, lfa = math.pi, rfa = 0 })
  -- 10 hurt: it recoils, head snapped back and aside, limbs pulled in.
  frames[#frames + 1] = crawlerFront({ lh = { 6, G }, le = -115, rh = { 27, G - 1 }, re = -70, lf = { 10, G }, rf = { 22, G }, back = 7, hx = 19, hy = 9.5, jaw = 4, size = 0.85 })
  -- 11-15 die: it rears and shrieks, buckles, sprawls, and sinks into a low heap as its eyes go dim.
  frames[#frames + 1] = crawlerFront({ lh = { 2, 5 }, le = -160, rh = { 30, 8 }, re = -20, lf = { 8, G }, rf = { 24, G }, back = 5.5, hx = 17, hy = 9, jaw = 5, size = 0.9, lfa = -math.pi * 0.7, rfa = -math.pi * 0.2 })
  frames[#frames + 1] = crawlerFront({ lh = { 1, G }, le = -165, rh = { 31, G }, re = -10, lf = { 7, G }, rf = { 25, G }, back = 10, hx = 19, hy = 14, jaw = 3 })
  frames[#frames + 1] = crawlerFront({ lh = { 1, G }, le = 175, rh = { 31, G }, re = 5, lf = { 6, G }, lk = 180, rf = { 26, G }, rk = 0, back = 13, hx = 18, hy = 16, jaw = 2, eyes = 1 })
  frames[#frames + 1] = crawlerFront({ lh = { 4, G }, le = 160, rh = { 28, G }, re = 20, lf = { 8, G }, lk = 170, rf = { 24, G }, rk = 10, back = 15, hx = 17, hy = 17, jaw = 1, eyes = 1, size = 0.9 })
  frames[#frames + 1] = crawlerFront({ lh = { 7, G }, le = 150, rh = { 25, G }, re = 30, lf = { 10, G }, lk = 160, rf = { 22, G }, rk = 20, back = 16.5, hx = 16, hy = 17.5, jaw = 1, eyes = 1, size = 0.85 })
  return frames
end

---------------------------------------------------------------------------------------------------
-- The gaunt: 24x56, tall and stooped, ribs showing, arms hanging to its knees.
local GW, GH = 24, 56

-- The gaunt's head from the front: a long skull, deep sockets, hollow cheeks, the jaw hanging a little.
local function gauntFace(f, cx, cy, s, jaw, eyes)
  R.blob(f, cx, cy - 1, 3.2 * s, 3.3 * s)
  R.blob(f, cx, cy + 2.2 * s, 2.3 * s, 2.4 * s)
  local ey = math.floor(cy - 0.8 * s)
  local lx, rx = math.floor(cx - 1.5 * s), math.floor(cx + 1.5 * s - 0.5)
  for x = lx - 1, rx + 1 do R.tint(f, x, ey - 1, 1.25) end
  for _, x in ipairs({ lx - 1, lx, rx, rx + 1 }) do R.paint(f, x, ey + 1, C.flesh0) end
  R.tint(f, cx - 2.6 * s, cy + 1.2, 0.5); R.tint(f, cx + 2.6 * s - 1, cy + 1.2, 0.5)
  R.tint(f, cx - 2.6 * s, cy + 2.2, 0.6); R.tint(f, cx + 2.6 * s - 1, cy + 2.2, 0.6)
  local mw = (s >= 1.1) and 4 or 2
  local mx, my = math.floor(cx - mw / 2 + 0.5), math.floor(cy + 2.2 * s)
  if jaw > 0 then R.mouth(f, mx, my, mw, jaw, jaw >= 2) end
  R.eye(f, lx, ey, -1, 0, eyes)
  R.eye(f, rx, ey, 1, 0, eyes)
end

-- The gaunt from the front. p: `drop` (how far the body sinks: a crouch, kneeling, a heap), `fold`
-- (0 upright to 1 bent double towards you, so the torso shortens and its back broadens), the head
-- (hx, hy offsets, size, jaw, eyes), and for each arm and leg the upper bone's angle and where the hand
-- or foot is: la/ra = { angle, x, y, finger angle, upper arm length }, ll/rl = { angle, x, y, thigh
-- length }.
local function gauntFront(p)
  local f = R.frame(GW, GH)
  local d, fold, sx = p.drop or 0, p.fold or 0, p.sx or 0
  local k, wide = 1 - 0.65 * fold, 1 + 0.45 * fold
  local hip = 30 + d
  local function Y(y) return hip + (y - 30) * k end
  local la, ra, ll, rl = p.la, p.ra, p.ll, p.rl
  -- The legs: long and thin, knobbly knees, the feet splayed.
  for _, leg in ipairs({ { 10, ll, -1 }, { 14, rl, 1 } }) do
    local x, g = leg[1], leg[2]
    R.arm(f, { x = x + sx, y = hip + 1, a1 = g[1], l1 = g[4] or 12, tx = g[2], ty = g[3], r1 = 1.6, r2 = 1, knob = 1.3 })
    R.stroke(f, g[2] - 1 + leg[3], g[3], g[2] + 1 + leg[3], g[3], 1, 0.9)
  end
  -- The pelvis and a starved belly, pinched in under the ribs.
  R.blob(f, 12 + sx, hip, 3.8, 2.2)
  R.tint(f, 9 + sx, hip - 1, 1.3); R.tint(f, 14 + sx, hip - 1, 1.3)
  R.limb(f, 12 + sx, Y(24), 12 + sx, Y(28.5), 2.0 * wide, 1.9 * wide, 0.75)
  -- The ribcage, every rib showing; bent over, its knobbled spine.
  R.blob(f, 12 + sx, Y(19.5), 4.1 * wide, 5.8 * k + 1)
  if fold < 0.5 then R.ribs(f, 12 + sx, Y(16), 5, 2 * k, 3.9, 1.6) else R.spine(f, 11 + sx, 13 + sx, 0) end
  -- Shoulders hunched up high, the head sunk forward between them, and the collarbones.
  local sw, sl = 5.5 * wide - (p.slump or 0) * 0.4, p.slump or 0
  local c = 12 + sx
  R.blob(f, c - sw, Y(12) + sl, 2.5, 2.3)
  R.blob(f, c + sw, Y(12) + sl, 2.5, 2.3)
  R.limb(f, c - sw + 0.5, Y(12) + sl, c, Y(12), 2.2, 2.2, 0.9)
  R.limb(f, c + sw - 0.5, Y(12) + sl, c, Y(12), 2.2, 2.2, 0.9)
  if fold < 0.5 then
    R.stroke(f, c - 4.5, Y(14), c - 1, Y(15), 1, 1.3)
    R.stroke(f, c + 4.5, Y(14), c + 1, Y(15), 1, 1.3)
  end
  -- The arms hang past its knees; long fingers.
  for _, arm in ipairs({ { c - sw - 1, la }, { c + sw + 1, ra } }) do
    local a = arm[2]
    R.arm(f, { x = arm[1], y = Y(12.5) + sl, a1 = a[1], l1 = a[5] or 13, tx = a[2], ty = a[3], r1 = 1.4, r2 = 1, knob = 1.3, fingers = 3, fa = a[4] or math.pi / 2, fl = 6, fs = 0.55 })
  end
  gauntFace(f, c + (p.hx or 0), Y(14) + (p.hy or 0), p.size or 1, p.jaw or 2, p.eyes or 2)
  return R.finish(f)
end

-- The gaunt fallen in a heap: the curve of its back with the spine down it and the shoulder blades
-- either side, the head slumped on the ground in front, arms sprawled out along the ground and knees
-- poking out behind. p: the back's centre (y), width and height, the head (hx, hy, size, eyes), and
-- the hands (lh, rh).
local function gauntHeap(p)
  local f = R.frame(GW, GH)
  local y, w, h = p.y, p.w, p.h
  -- The folded legs, knees out to the sides.
  R.arm(f, { x = 10, y = y + 1, a1 = 175, l1 = 6, tx = 3, ty = GH - 1, r1 = 1.4, r2 = 1, tone = FAR })
  R.arm(f, { x = 14, y = y + 1, a1 = 5, l1 = 6, tx = 21, ty = GH - 1, r1 = 1.4, r2 = 1, tone = FAR })
  R.blob(f, 12, y, w, h)
  R.blob(f, 12 - w * 0.5, y - h * 0.35, 2.3, 1.8); R.blob(f, 12 + w * 0.5, y - h * 0.35, 2.3, 1.8)
  for yy = math.floor(y - h), math.floor(y + h * 0.5) do R.tint(f, 12, yy, (yy % 2 == 0) and 1.25 or 0.7) end
  R.arm(f, { x = 12 - w * 0.7, y = y, a1 = p.la or 160, l1 = 6, tx = p.lh[1], ty = p.lh[2], r1 = 1.4, r2 = 1, knob = 1.2, fingers = 3, fa = math.pi * 0.7, fl = 5, fs = 0.5 })
  R.arm(f, { x = 12 + w * 0.7, y = y, a1 = p.ra or 20, l1 = 6, tx = p.rh[1], ty = p.rh[2], r1 = 1.4, r2 = 1, knob = 1.2, fingers = 3, fa = math.pi * 0.3, fl = 5, fs = 0.5 })
  gauntFace(f, 12 + (p.hx or 0), p.hy, p.size or 1, p.jaw or 0, p.eyes or 1)
  return R.finish(f)
end

-- The gaunt side-on, facing right: stooped, the back curved over, head thrust forward. p: `bob`, and
-- the hands and feet by IK: na/fa = { x, y } (near and far arm), nl/fl = { x, y } (near and far leg).
local function gauntSide(p)
  local f = R.frame(GW, GH)
  local b = p.bob or 0
  -- The far arm and leg, dimmer, behind.
  R.arm(f, { x = 12.5, y = 15 + b, tx = p.fa[1], ty = p.fa[2], l1 = 12, l2 = 12.5, bend = 1, r1 = 1.3, r2 = 0.9, tone = FAR, fingers = 3, fa = math.pi / 2 - 0.2, fl = 5, fs = 0.3 })
  R.arm(f, { x = 10, y = 33 + b, tx = p.fl[1], ty = p.fl[2], l1 = 11.5, l2 = 11.5, bend = -1, r1 = 1.5, r2 = 1, tone = FAR })
  R.stroke(f, p.fl[1] - 0.5, p.fl[2], p.fl[1] + 3, p.fl[2], 1, FAR)
  -- The body: pelvis, sunken belly, the ribcage jutting forward, the back hunched over.
  R.blob(f, 10.5, 32 + b, 2.8, 2.4)
  R.limb(f, 10.5, 30 + b, 11, 24 + b, 2.0, 2.4, 0.85)
  R.blob(f, 12.2, 19.5 + b, 3.8, 5.6)
  R.blob(f, 10, 16 + b, 2.8, 3.6)
  R.sideRibs(f, 10, 15, 15 + b, 5, 2, 0.35)
  R.spine(f, 6, 13, 0)
  -- The near leg: knee forward, a long thin foot.
  R.arm(f, { x = 10.5, y = 33.5 + b, tx = p.nl[1], ty = p.nl[2], l1 = 11.5, l2 = 11.5, bend = -1, r1 = 1.8, r2 = 1, knob = 1.4 })
  R.stroke(f, p.nl[1] - 0.5, p.nl[2], p.nl[1] + 3.5, p.nl[2], 1)
  -- The neck, thrust forward, and the head.
  R.blob(f, 13.5, 14.5 + b, 2.3, 2.0)
  R.limb(f, 14, 14 + b, 17.5, 14 + b, 1.6, 1.4)
  local hx, hy = 19 + (p.hx or 0), 13.5 + b + (p.hy or 0)
  R.blob(f, hx, hy, 2.8, 2.8)
  R.blob(f, hx + 1.8, hy + 1.8, 1.8, 1.5)
  R.tint(f, hx - 1, hy - 2, 1.25); R.tint(f, hx, hy - 2, 1.25); R.tint(f, hx + 1, hy - 2, 1.25)
  local jaw = p.jaw or 2
  local mx, my = math.floor(hx + 0.5), math.floor(hy + 2.5)
  R.stroke(f, hx - 1, my, mx + 3, my + jaw, 1)
  for yy = my, my + jaw - 1 do
    for xx = mx + (yy - my), mx + 3 do R.paint(f, xx, yy, C.mouth) end
  end
  for xx = mx, mx + 3 do R.paint(f, xx, my, C.gum) end
  R.paint(f, mx + 3, my + 1, C.flesh4)
  R.paint(f, math.floor(hx + 1), math.floor(hy), C.flesh0)
  R.eye(f, math.floor(hx + 2), math.floor(hy - 0.5), -1, 0, p.eyes or 2)
  -- The near arm, hanging in front, swinging.
  R.arm(f, { x = 13.5, y = 15.5 + b, tx = p.na[1], ty = p.na[2], l1 = 12, l2 = 12.5, bend = 1, r1 = 1.5, r2 = 1, knob = 1.3, fingers = 3, fa = math.pi / 2 - 0.2, fl = 5, fs = 0.3 })
  return R.finish(f)
end

local function gaunt()
  local G = GH - 1
  local frames = {}
  local D = math.pi / 2 -- fingers pointing down
  -- 0-3 walk (front): a slow shamble. Each step lifts a knee; the body sways over the planted foot
  -- and the opposite arm swings forward (towards you, so it looks shorter).
  local walk = {
    { sx = -1, la = { 97, 3, 41 }, ra = { 88, 17, 37 }, ll = { 100, 9, G }, rl = { 66, 15, G - 3, 9 } },
    { la = { 96, 4, 41 }, ra = { 84, 20, 41 }, ll = { 100, 9, G }, rl = { 80, 15, G }, drop = -1 },
    { sx = 1, la = { 92, 7, 37 }, ra = { 83, 21, 41 }, ll = { 114, 9, G - 3, 9 }, rl = { 80, 15, G } },
    { la = { 96, 4, 41 }, ra = { 84, 20, 41 }, ll = { 100, 9, G }, rl = { 80, 15, G }, drop = -1, hx = 1 },
  }
  for _, p in ipairs(walk) do frames[#frames + 1] = gauntFront(p) end
  -- 4-7 side-walk: contact, passing, contact, passing; the arms swing against the legs.
  local side = {
    { nl = { 17, G }, fl = { 4, G }, na = { 8, 38 }, fa = { 19, 36 } },
    { nl = { 11, G }, fl = { 12, G - 4 }, na = { 13, 39 }, fa = { 14, 39 }, bob = -1 },
    { nl = { 4, G }, fl = { 17, G }, na = { 19, 36 }, fa = { 8, 38 } },
    { nl = { 12, G - 4 }, fl = { 11, G }, na = { 14, 39 }, fa = { 13, 39 }, bob = -1 },
  }
  for _, p in ipairs(side) do frames[#frames + 1] = gauntSide(p) end
  -- 8 windup, the tell: it sinks on its knees and throws both arms up high, claws spread.
  frames[#frames + 1] = gauntFront({ drop = 5, hy = -2, jaw = 3, la = { -112, 3, 6, -math.pi * 0.56, 9 }, ra = { -68, 21, 6, -math.pi * 0.44, 9 }, ll = { 108, 8, G, 11 }, rl = { 72, 16, G, 11 } })
  -- 9-10 attack: the swipe comes down, then follows through, crossing low in front.
  frames[#frames + 1] = gauntFront({ drop = 3, hy = 2, size = 1.15, jaw = 3, la = { -122, 7, 23, D * 0.7, 6.5 }, ra = { -58, 17, 23, D * 1.3, 6.5 }, ll = { 108, 8, G, 11 }, rl = { 72, 16, G, 11 } })
  frames[#frames + 1] = gauntFront({ drop = 4, hy = 3, size = 1.15, jaw = 3, la = { 100, 15, 34, D * 0.7, 12 }, ra = { 80, 9, 34, D * 1.3, 12 }, ll = { 108, 8, G, 11 }, rl = { 72, 16, G, 11 } })
  -- 11 hurt: it recoils, head snapped back, arms flung out.
  frames[#frames + 1] = gauntFront({ drop = -1, hy = -3, size = 0.9, jaw = 3, la = { 110, 2, 34, D * 1.2, 11 }, ra = { 70, 22, 34, D * 0.8, 11 }, ll = { 100, 9, G }, rl = { 80, 15, G } })
  -- 12-16 die: the knees go, it kneels, folds over and falls in a heap as its eyes go dim.
  frames[#frames + 1] = gauntFront({ drop = 5, slump = 1, hx = 2, hy = 1, jaw = 3, la = { 102, 4, 43 }, ra = { 78, 20, 43 }, ll = { 115, 7, G, 9 }, rl = { 65, 17, G, 9 } })
  frames[#frames + 1] = gauntFront({ drop = 15, slump = 2, hx = 1, hy = 3, jaw = 3, la = { 95, 6, G, D, 11 }, ra = { 85, 18, G, D, 11 }, ll = { 150, 5, G, 5 }, rl = { 30, 19, G, 5 } })
  frames[#frames + 1] = gauntFront({ drop = 17, fold = 0.6, slump = 3, hx = 1, hy = 6, size = 1.05, jaw = 2, eyes = 1, la = { 80, 8, G, D, 8 }, ra = { 100, 16, G, D, 8 }, ll = { 160, 4, G, 6 }, rl = { 20, 20, G, 6 } })
  frames[#frames + 1] = gauntHeap({ y = 47, w = 6.5, h = 4.5, hx = 1, hy = 51, size = 1, eyes = 1, jaw = 1, lh = { 2, G }, rh = { 22, G }, la = 150, ra = 30 })
  frames[#frames + 1] = gauntHeap({ y = 50.5, w = 7.5, h = 3.2, hx = 2, hy = 53, size = 0.9, eyes = 1, lh = { 3, G }, rh = { 21, G }, la = 170, ra = 10 })
  return frames
end

L.writeSprites(P, {
  { name = "crawler", frames = crawler(), height = 0.45, stride = 0.35,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, attack = { 8, 9 }, hurt = { 10 }, die = { 11, 12, 13, 14, 15 } } },
  { name = "gaunt", frames = gaunt(), height = 1.25, stride = 0.5,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, windup = { 8 }, attack = { 9, 10 }, hurt = { 11 }, die = { 12, 13, 14, 15, 16 } } },
})
