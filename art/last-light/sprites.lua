-- Last Light's sprites: the creatures and props the game draws in the world (the crawler, gaunt,
-- leaper and the Mother; the stove, well and lone pine; a burning flare and the three pickups), in
-- last-light/assets/sprites.png, with their frames and animations in sprites.json. Run from the repo
-- root:
--   aseprite -b --script art/last-light/sprites.lua
--
-- The after-eaters are built from shared body parts (a skull with its eyes and jaw, a ribcage and spine,
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

-- A wide mouth full of teeth: a `w` x `h` dark gape at (x, y) (top-left), a row of teeth along the top
-- and, if it gapes 3 px or more, along the bottom too.
function R.grin(f, x, y, w, h)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do R.paint(f, xx, yy, C.mouth) end
  end
  for xx = x, x + w - 1 do
    R.paint(f, xx, y, ((xx - x) % 2 == 0) and C.flesh4 or C.gum)
    if h >= 3 then R.paint(f, xx, y + h - 1, ((xx - x) % 2 == 1) and C.flesh3 or C.mouth) end
  end
end

-- A spine: a sharp bony spike from its root (x0, y0) to its tip (x1, y1), two-tone at the root.
function R.spike(f, x0, y0, x1, y1, tone)
  local mx, my = x0 + (x1 - x0) * 0.6, y0 + (y1 - y0) * 0.6
  R.stroke(f, x0, y0, mx, my, 2, tone)
  R.stroke(f, mx, my, x1, y1, 1, (tone or 1) * 1.15)
end

-- The topmost flesh in column x at or below row y0, or nil.
function R.top(f, x, y0)
  for y = math.max(0, math.floor(y0)), f.h - 1 do
    if R.at(f, x, y) then return y end
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

---------------------------------------------------------------------------------------------------
-- The leaper: 32x32, hunched on frog legs, long arms, a crest of spines along its back and a wide
-- mouth full of teeth.
local LW, LH = 32, 32

-- The leaper's head from the front: a broad flat skull, the eyes set wide and high under heavy brows,
-- and a frog's wide mouth. (cx, cy) is the skull's centre; `jaw` how far the mouth gapes.
local function leaperFace(f, cx, cy, s, jaw, eyes)
  R.blob(f, cx, cy, 4.3 * s, 2.8 * s)
  R.blob(f, cx, cy + 1.7 * s, 3.5 * s, 1.9 * s)
  local ey = math.floor(cy - 1.0 * s)
  local lx, rx = math.floor(cx - 2.2 * s), math.floor(cx + 2.2 * s - 0.5)
  for _, x in ipairs({ lx - 1, lx, lx + 1, rx - 1, rx, rx + 1 }) do R.tint(f, x, ey - 1, 1.3) end
  for _, x in ipairs({ lx - 1, lx, rx, rx + 1 }) do R.paint(f, x, ey + 1, C.flesh0) end
  local mw = math.floor(6 * s + 0.5)
  if mw % 2 == 1 then mw = mw + 1 end
  local mx, my = math.floor(cx - mw / 2 + 0.5), math.floor(cy + 1.2 * s)
  R.grin(f, mx, my, mw, jaw)
  R.eye(f, lx, ey, -1, 0, eyes)
  R.eye(f, rx, ey, 1, 0, eyes)
end

-- The crest of spines from the front: they stand up in a fan behind the shoulders. `k` scales them
-- (raised when it's about to leap); `lean` tips them sideways.
local function leaperCrest(f, cx, y, k, lean)
  for _, s in ipairs({ { -4.5, -2.2, 3.2 }, { -2.3, -1, 4.6 }, { 0, 0, 6 }, { 2.3, 1, 4.6 }, { 4.5, 2.2, 3.2 } }) do
    local len = s[3] * k
    R.spike(f, cx + s[1], y + 2, cx + s[1] + s[2] * k + (lean or 0), y + 2 - len, 0.95)
  end
end

-- The leaper from the front. p: `drop` (how far it sinks), `rear` (the shoulders' lift), the head
-- (hx, hy, size, jaw, eyes), the spines (`spines` scale, `lean`), and for each limb the upper bone's
-- angle and where the hand or foot is: la/ra = { angle, x, y, finger angle }, ll/rl = { angle, x, y }.
-- `tone` dims the legs (they're behind it when it's in the air).
local function leaperFront(p)
  local f = R.frame(LW, LH)
  local d, sx = p.drop or 0, p.sx or 0
  local hip = 22 + d
  local sy = 13 + d - (p.rear or 0)
  local c = 16 + sx
  -- The frog legs, folded like springs: the thick thighs rise from its hips to knees jutting up
  -- beside its shoulders, and the long shins run down to long-toed feet.
  for _, lg in ipairs({ { c - 4, p.ll, math.pi * 0.75 }, { c + 4, p.rl, math.pi * 0.25 } }) do
    local g = lg[2]
    local tone = p.legTone or 0.88
    local kx, ky = lg[1] + math.cos(math.rad(g[1])) * (g[4] or 13), hip + math.sin(math.rad(g[1])) * (g[4] or 13)
    R.limb(f, lg[1], hip, kx, ky, 3.0, 1.9, tone)
    R.stroke(f, kx, ky, g[2], g[3], 2, tone)
    R.blob(f, kx, ky, 1.9, 1.7, tone * 1.1, true)
    for i = -1, 1 do
      local fa = (g[5] or lg[3]) + i * 0.6
      R.stroke(f, g[2], g[3], g[2] + math.cos(fa) * 2.5, g[3] + math.sin(fa) * 2.5, 1, tone)
    end
  end
  -- The spines, standing up along its back behind the shoulders.
  leaperCrest(f, c, sy - 5, p.spines or 1, p.lean)
  -- The hunched back and shoulders, a dome over its head; the belly slung low behind.
  R.blob(f, c, hip - 1, 4.0, 3.0, 0.7)
  R.blob(f, c, sy + 0.5, 6.2, 5.2)
  R.blob(f, c - 5, sy + 0.5, 2.4, 2.4); R.blob(f, c + 5, sy + 0.5, 2.4, 2.4)
  R.spine(f, c - 3, c + 3, 0)
  -- The long arms, hanging straight down either side of its head to knuckles on the ground.
  for _, arm in ipairs({ { c - 5.5, p.la }, { c + 5.5, p.ra } }) do
    local a = arm[2]
    R.arm(f, { x = arm[1], y = sy + 1, a1 = a[1], l1 = a[5] or 8.5, tx = a[2], ty = a[3], r1 = 1.7, r2 = 1.3, knob = 1.5, fingers = 3, fa = a[4] or math.pi / 2, fl = p.fl or 2.5, fs = 0.6 })
  end
  leaperFace(f, c + (p.hx or 0), sy + 5 + (p.hy or 0), p.size or 1, p.jaw or 2, p.eyes or 2)
  return R.finish(f)
end

-- A frog's hind leg side-on: the thick thigh from the hip (hx, hy) to the knee, the shin folded back to
-- the heel, and the long foot to its toes. g = { knee, heel, toes } as { x, y } pairs.
local function frogLeg(f, hx, hy, g, tone)
  local k, e, t = g[1], g[2], g[3]
  R.limb(f, k[1], k[2], e[1], e[2], 1.3, 1.0, tone)
  R.limb(f, hx, hy, k[1], k[2], 3.0, 1.9, tone)
  R.blob(f, k[1], k[2], 1.7, 1.6, tone * 1.1, true)
  R.stroke(f, e[1], e[2], t[1], t[2], 2, tone)
  for i = -1, 1 do
    local a = math.atan(t[2] - e[2], t[1] - e[1]) + i * 0.45
    R.stroke(f, t[1], t[2], t[1] + math.cos(a) * 2, t[2] + math.sin(a) * 2, 1, tone)
  end
end

-- Spines along a back: at each x in `xs`, a spike from the topmost flesh, `lens` long, raked back by
-- `rake` (px sideways per px up; negative rakes towards -x).
local function backSpines(f, xs, lens, rake, k)
  for i, x in ipairs(xs) do
    local y = R.top(f, math.floor(x), 0)
    if y then
      local len = lens[i] * (k or 1)
      R.spike(f, x, y + 1.5, x - len * rake, y + 1.5 - len, 1.0)
    end
  end
end

-- The leaper side-on, facing right: the back arched high with the spines along it, the frog legs
-- folded under, the long arms planted in front, the flat head low and forward. p: `by` (the body's
-- lift), `jaw`, the legs nl/fl = { knee, heel, toes } and the arms na/fa = { elbow, hand } as
-- { x, y } pairs.
local function leaperSide(p)
  local f = R.frame(LW, LH)
  local by = p.by or 0
  local hipX, hipY, shX, shY = 9, 20 + by, 19, 13.5 + by
  local function arm(a, tone, r)
    R.limb(f, shX, shY + 1, a[1][1], a[1][2], r, r * 0.75, tone)
    R.limb(f, a[1][1], a[1][2], a[2][1], a[2][2], r * 0.75, r * 0.6, tone)
    R.blob(f, a[1][1], a[1][2], 1.3, 1.3, tone * 1.1, true)
    for i = -1, 1 do
      R.stroke(f, a[2][1], a[2][2], a[2][1] + 2 + i * 0.5, a[2][2] + (i + 1) * 0.5, 1, tone)
    end
  end
  arm(p.fa, FAR, 1.6)
  frogLeg(f, hipX + 1.5, hipY - 0.5, p.fl, FAR)
  -- The body: the pelvis, the back arched high over a deep, ribbed chest.
  R.blob(f, hipX, hipY, 3.4, 3.0)
  R.limb(f, hipX + 1, hipY - 1.5, shX - 3, shY - 1, 3.2, 3.6)
  R.blob(f, shX - 2.5, shY + 1.5, 4.6, 3.8)
  R.blob(f, shX, shY - 0.5, 2.6, 2.3)
  R.flankRibs(f, shX - 6, shY + 1.5, 4, 2, 3, -1)
  backSpines(f, { 7, 10, 13, 16 }, { 3.5, 5, 6, 5 }, p.rake or 0.7, p.spines)
  R.spine(f, hipX - 3, shX + 1, 0)
  frogLeg(f, hipX, hipY, p.nl, 1)
  -- The neck, and the flat head hanging low in front, its wide mouth along its side.
  local hx, hy = 25 + (p.hx or 0), 16.5 + by + (p.hy or 0)
  R.limb(f, shX + 1, shY, hx - 2, hy - 0.5, 2.3, 1.9)
  R.blob(f, hx, hy, 3.6, 2.4)
  R.blob(f, hx + 0.5, hy + 1.6, 3.0, 1.5)
  R.tint(f, hx - 1, hy - 2, 1.3); R.tint(f, hx, hy - 2, 1.3); R.tint(f, hx + 1, hy - 2, 1.3)
  local jaw = p.jaw or 1
  local mx, my = math.floor(hx - 2), math.floor(hy + 1)
  for yy = my, my + jaw - 1 do
    for xx = mx + math.floor((yy - my) * 0.5), mx + 5 do R.paint(f, xx, yy, C.mouth) end
  end
  for xx = mx, mx + 5 do R.paint(f, xx, my, ((xx - mx) % 2 == 1) and C.flesh4 or C.gum) end
  if jaw >= 2 then R.paint(f, mx + 5, my + jaw - 1, C.flesh3) end
  R.paint(f, math.floor(hx), math.floor(hy - 1), C.flesh0)
  R.eye(f, math.floor(hx) + 1, math.floor(hy - 1), -1, 0, p.eyes or 2)
  arm(p.na, 1, 1.8)
  return R.finish(f)
end

-- The leaper in mid-air, side-on and facing right: stretched out flat, arms reaching ahead, legs
-- kicked out behind, spines laid back.
local function leaperFlying()
  local f = R.frame(LW, LH)
  R.arm(f, { x = 19, y = 13, a1 = -5, l1 = 6, tx = 29, ty = 10, r1 = 1.4, r2 = 1, tone = FAR, fingers = 3, fa = -0.3, fl = 3, fs = 0.5 })
  frogLeg(f, 11, 14.5, { { 6, 19 }, { 2, 16 }, { 0, 12 } }, FAR)
  R.blob(f, 10, 15, 3.4, 2.8)
  R.limb(f, 10.5, 14.5, 17, 13.5, 3.0, 3.3)
  R.blob(f, 16.5, 14.5, 4.3, 3.4)
  R.flankRibs(f, 13, 14.5, 4, 2, 3, -1)
  backSpines(f, { 8, 11, 14, 17 }, { 3, 4, 4.5, 4 }, 1.4)
  R.spine(f, 6, 20, 0)
  frogLeg(f, 9.5, 15.5, { { 5, 21 }, { 1, 19 }, { 0, 16 } }, 1)
  R.arm(f, { x = 19.5, y = 14, a1 = 0, l1 = 6, tx = 30, ty = 13, r1 = 1.7, r2 = 1, knob = 1.3, fingers = 3, fa = 0, fl = 3, fs = 0.6 })
  local hx, hy = 24, 15.5
  R.limb(f, 19.5, 14, hx - 2, hy, 2.2, 1.8)
  R.blob(f, hx, hy, 3.6, 2.4)
  R.blob(f, hx + 0.5, hy + 2, 3.0, 1.6)
  local mx, my = math.floor(hx - 2), math.floor(hy + 1)
  for yy = my, my + 2 do
    for xx = mx + math.floor((yy - my) * 0.5), mx + 5 do R.paint(f, xx, yy, C.mouth) end
  end
  for xx = mx, mx + 5 do R.paint(f, xx, my, ((xx - mx) % 2 == 1) and C.flesh4 or C.gum) end
  R.paint(f, mx + 5, my + 2, C.flesh3); R.paint(f, mx + 3, my + 2, C.flesh3)
  R.paint(f, math.floor(hx), math.floor(hy - 1), C.flesh0)
  R.eye(f, math.floor(hx) + 1, math.floor(hy - 1), -1, 0, 2)
  return R.finish(f)
end

-- The leaper fallen in a heap: its back flattened out with the spines lying over, its legs and arms
-- sprawled along the ground, and its head on the snow in front. p: the back's height `y`, the spread
-- of the limbs, and the head (hy, jaw, eyes).
local function leaperHeap(p)
  local f = R.frame(LW, LH)
  local G = LH - 1
  local y, w = p.y, p.w or 7
  for _, s in ipairs({ { -1, 1 }, { 1, 1 } }) do
    local x0 = 16 + s[1] * 3
    R.limb(f, x0, y + 2, 16 + s[1] * (w + 3), G - 1.5, 2.4, 1.6, 0.85)
    R.stroke(f, 16 + s[1] * (w + 3), G - 1.5, 16 + s[1] * (w + 7), G, 2, 0.85)
  end
  for i, s in ipairs({ { -4, 1.2, 3 }, { -1.5, 1.5, 4 }, { 1, 1.8, 4 }, { 3.5, 2, 3 } }) do
    R.spike(f, 16 + s[1], y - 1, 16 + s[1] + s[3] * s[2] * (p.lie or 0.7), y - 1 - s[3] * 0.8, 0.95)
  end
  R.blob(f, 16, y + 1, w, 3.4)
  R.blob(f, 16 - w * 0.55, y, 2.2, 2.0); R.blob(f, 16 + w * 0.55, y, 2.2, 2.0)
  R.spine(f, 14, 18, 0)
  R.arm(f, { x = 16 - w * 0.6, y = y + 1, a1 = 160, l1 = 6, tx = 3, ty = G, r1 = 1.5, r2 = 1.1, knob = 1.3, fingers = 3, fa = math.pi * 0.85, fl = 2.5, fs = 0.6 })
  R.arm(f, { x = 16 + w * 0.6, y = y + 1, a1 = 20, l1 = 6, tx = 29, ty = G, r1 = 1.5, r2 = 1.1, knob = 1.3, fingers = 3, fa = math.pi * 0.15, fl = 2.5, fs = 0.6 })
  leaperFace(f, 16 + (p.hx or 0), p.hy, p.size or 0.95, p.jaw or 1, p.eyes or 1)
  return R.finish(f)
end

local function leaper()
  local G = LH - 1
  local frames = {}
  local D = math.pi / 2
  -- 0-3 walk (front): a prowl on its knuckles. Each arm reaches forward in turn (towards you, so it
  -- looks shorter), the body rolling over the planted side.
  local walk = {
    { sx = -1, la = { 112, 9, 25, D, 7 }, ra = { 86, 21, G }, ll = { -118, 2, G }, rl = { -62, 29, G } },
    { la = { 94, 10, G }, ra = { 86, 22, G }, ll = { -117, 2, G }, rl = { -63, 30, G }, drop = 0.5 },
    { sx = 1, la = { 94, 10, G }, ra = { 68, 23, 25, D, 7 }, ll = { -118, 3, G }, rl = { -62, 30, G } },
    { la = { 94, 10, G }, ra = { 86, 22, G }, ll = { -117, 2, G }, rl = { -63, 30, G }, drop = 0.5, hx = 1 },
  }
  for _, p in ipairs(walk) do frames[#frames + 1] = leaperFront(p) end
  -- 4-7 side-walk: a slinking prowl. The arms step in turn, one planted while the other swings
  -- through; the legs shuffle after them and the body dips over each planted hand.
  local side = {
    { na = { { 21, 22 }, { 26, G } }, fa = { { 18.5, 22 }, { 21.5, G } }, nl = { { 15, 18 }, { 7, 26 }, { 13, G } }, fl = { { 16, 18.5 }, { 9, 26 }, { 15, G } } },
    { na = { { 20, 22 }, { 23.5, G } }, fa = { { 21, 21 }, { 25, G - 3 } }, nl = { { 15, 18 }, { 7, 26 }, { 13, G } }, fl = { { 16.5, 18 }, { 9.5, 25.5 }, { 16, G - 1 } }, by = -0.5, jaw = 2 },
    { na = { { 18.5, 22 }, { 21.5, G } }, fa = { { 21, 22 }, { 26, G } }, nl = { { 15.5, 18 }, { 8, 25.5 }, { 14.5, G - 1 } }, fl = { { 16, 18.5 }, { 9, 26 }, { 15, G } } },
    { na = { { 21, 21 }, { 25, G - 3 } }, fa = { { 20, 22 }, { 23.5, G } }, nl = { { 15, 18 }, { 7, 26 }, { 13, G } }, fl = { { 16, 18.5 }, { 9, 26 }, { 15, G } }, by = -0.5, jaw = 2 },
  }
  for _, p in ipairs(side) do frames[#frames + 1] = leaperSide(p) end
  -- 8 crouch: sunk low and coiled, knees high, arms braced wide, spines up, shrieking.
  frames[#frames + 1] = leaperFront({ drop = 6, spines = 1.5, jaw = 3, size = 1.05, hy = -1, la = { 128, 4, G, D * 1.4, 7 }, ra = { 52, 28, G, D * 0.6, 7 }, ll = { -104, 2, G, 17 }, rl = { -76, 30, G, 17 } })
  -- 9 leap: flying at you, arms flung wide to grab, legs trailing behind, jaws wide.
  frames[#frames + 1] = leaperFront({ drop = -5, spines = 1.1, jaw = 4, size = 1.3, legTone = FAR, fl = 4, la = { -165, 1, 13, -math.pi * 0.95, 7 }, ra = { -15, 31, 13, -math.pi * 0.05, 7 }, ll = { 160, 2, 25, 8, math.pi * 1.1 }, rl = { 20, 30, 25, 8, -math.pi * 0.1 } })
  -- 10 side-leap: flat out in the air.
  frames[#frames + 1] = leaperFlying()
  -- 11-12 attack: it rears up with claws raised, then rakes down at you, biting.
  frames[#frames + 1] = leaperFront({ rear = 3, spines = 1.25, jaw = 3, la = { -125, 3, 4, -math.pi * 0.62, 7 }, ra = { -55, 29, 4, -math.pi * 0.38, 7 }, ll = { -112, 2, G, 12 }, rl = { -68, 30, G, 12 } })
  frames[#frames + 1] = leaperFront({ drop = 1, hy = 1, jaw = 4, size = 1.3, fl = 3.5, la = { 150, 9, 25, D * 0.55, 6 }, ra = { 30, 23, 25, D * 1.45, 6 }, ll = { -118, 2, G }, rl = { -62, 30, G } })
  -- 13 hurt: it recoils, head snapped back and aside, arms flung out.
  frames[#frames + 1] = leaperFront({ rear = 1, hx = 2, hy = -3, size = 0.85, jaw = 3, lean = 2, la = { 165, 1, 21, D * 1.3 }, ra = { 15, 31, 23, D * 0.7 }, ll = { -120, 2, G }, rl = { -60, 30, G } })
  -- 14-18 die: it shrieks, its legs go out from under it, it sprawls, and sinks into a heap as its
  -- eyes go dim.
  frames[#frames + 1] = leaperFront({ rear = 3, hy = -2, jaw = 4, spines = 1.25, lean = -1, la = { -150, 2, 8, -math.pi * 0.7 }, ra = { -35, 30, 12, -math.pi * 0.3 }, ll = { -115, 2, G, 12 }, rl = { -65, 30, G, 12 } })
  frames[#frames + 1] = leaperFront({ drop = 4, hx = 2, hy = 1, jaw = 3, lean = 2, la = { 135, 4, G, D * 1.3 }, ra = { 45, 27, G, D * 0.7 }, ll = { -140, 1, G, 11 }, rl = { -40, 31, G, 11 } })
  frames[#frames + 1] = leaperFront({ drop = 7, hx = 2, hy = 1, jaw = 2, spines = 0.8, lean = 3, eyes = 1, la = { 160, 2, G, D * 1.5 }, ra = { 20, 29, G, D * 0.6 }, ll = { -160, 0, G, 10 }, rl = { -20, 31, G, 10 } })
  frames[#frames + 1] = leaperHeap({ y = 24, w = 7, hx = 1, hy = 27, jaw = 1, eyes = 1, lie = 0.8 })
  frames[#frames + 1] = leaperHeap({ y = 26, w = 8, hx = 2, hy = 28.5, jaw = 1, eyes = 1, size = 0.9, lie = 1.1 })
  return frames
end

---------------------------------------------------------------------------------------------------
-- The Mother: 64x96, a towering swollen mass of the same pale flesh on too many limbs, a gaunt head,
-- and a crown of glowing eyes that reads from across the clearing.
local MW, MH = 64, 96

-- A limb through explicit joints: root -> joint -> end, radii r1 (upper) and r2 (lower), a bony knob
-- at the joint, and `claws` long fingers splayed from the end at angle `fa`.
local function bones(f, a)
  local tone = a.tone or 1
  R.limb(f, a.root[1], a.root[2], a.joint[1], a.joint[2], a.r1, a.r1 * 0.8, tone)
  R.limb(f, a.joint[1], a.joint[2], a.tip[1], a.tip[2], a.r2, a.r2 * 0.65, tone)
  R.blob(f, a.joint[1], a.joint[2], a.knob or a.r1 * 1.1, a.knob or a.r1 * 1.1, tone * 1.1, true)
  if a.claws then
    for i = 1, a.claws do
      local off = i - (a.claws + 1) / 2
      local fa = a.fa + off * (a.fs or 0.4)
      local fl = a.fl * (1 - 0.25 * math.abs(off) / math.max(1, (a.claws - 1) / 2))
      R.stroke(f, a.tip[1], a.tip[2], a.tip[1] + math.cos(fa) * fl, a.tip[2] + math.sin(fa) * fl, a.cw or 2, tone * 0.95)
    end
  end
end

-- One of the Mother's crown of eyes: a hot eye2 core over an eye1 rim, in a dark socket. `lit` 2 is
-- open, 1 is dimming (the core goes out), 0 is shut.
local function crownEye(f, x, y, lit)
  if lit == 0 then return end
  for _, d in ipairs({ { -1, 0 }, { 2, 0 }, { -1, 1 }, { 2, 1 }, { 0, 2 }, { 1, 2 }, { 0, -1 }, { 1, -1 } }) do
    if R.at(f, x + d[1], y + d[2]) then R.paint(f, x + d[1], y + d[2], C.flesh0) end
  end
  if lit >= 2 then
    R.paint(f, x, y, C.eye2); R.paint(f, x + 1, y, C.eye2)
    R.paint(f, x, y + 1, C.eye1); R.paint(f, x + 1, y + 1, C.eye1)
  else
    R.paint(f, x, y + 1, C.eye1); R.paint(f, x + 1, y + 1, C.eye1)
  end
end

-- The Mother's head from the front: a broad brow crowned with bony spikes and ringed with five eyes,
-- the face narrowing to a long hanging jaw. (cx, cy) is the brow's centre.
local function motherFace(f, cx, cy, s, jaw, eyes)
  -- The crown: bony spikes standing up round the top of the skull.
  for _, k in ipairs({ -2, -1, 0, 1, 2 }) do
    local x = cx + k * 4.2 * s
    local y = cy - 5 * s + math.abs(k) * 1.4
    R.spike(f, x, y + 1, x + k * 1.2, y - (5.5 - math.abs(k)) * s, 1.0)
  end
  R.blob(f, cx, cy, 10 * s, 6.5 * s)
  R.blob(f, cx, cy + 6 * s, 6 * s, 5.5 * s)
  R.blob(f, cx, cy + 10.5 * s, 4 * s, 3.5 * s)
  -- Hollow cheeks and a dark nose pit.
  for _, dy in ipairs({ 5, 6, 7 }) do
    R.tint(f, cx - 4.5 * s, cy + dy * s, 0.5); R.tint(f, cx + 4.5 * s - 1, cy + dy * s, 0.5)
  end
  R.paint(f, cx - 1, cy + 3.5 * s, C.flesh0); R.paint(f, cx, cy + 3.5 * s, C.flesh0)
  -- The mouth: a long dark gape with fangs.
  local mw = math.floor(5 * s + 0.5)
  if mw % 2 == 1 then mw = mw + 1 end
  local mx, my = math.floor(cx - mw / 2 + 0.5), math.floor(cy + 6.5 * s)
  if jaw > 0 then
    R.mouth(f, mx, my, mw, jaw, true)
    if jaw >= 3 then R.paint(f, mx + 1, my + 1, C.flesh4); R.paint(f, mx + mw - 2, my + 1, C.flesh4) end
  end
  -- The crown of eyes, arching over the brow.
  for _, e in ipairs({ { -8.5, 1.5 }, { -4.5, -0.5 }, { -0.5, -1.5 }, { 3.5, -0.5 }, { 7.5, 1.5 } }) do
    crownEye(f, math.floor(cx + e[1] * s + 0.5), math.floor(cy + e[2] * s + 0.5), eyes)
  end
end

-- Veins over the swollen belly, and the knees and skulls of what's curled up inside pressing out.
local function bellyMarks(f, cx, cy, rx, ry)
  for _, v in ipairs({ { -0.75, -0.45, -0.3, 0.05, -0.05, 0.6 }, { 0.65, -0.55, 0.35, -0.05, 0.5, 0.45 }, { -0.1, -0.85, 0.1, -0.35, -0.2, 0.2 } }) do
    local pts = { { v[1], v[2] }, { v[3], v[4] }, { v[5], v[6] } }
    for k = 1, 2 do
      local a, b = pts[k], pts[k + 1]
      for i = 0, 14 do
        local t = i / 14
        R.tint(f, cx + (a[1] + (b[1] - a[1]) * t) * rx + math.sin(t * 7 + k) * 0.7, cy + (a[2] + (b[2] - a[2]) * t) * ry, 0.6)
      end
    end
  end
  for _, b in ipairs({ { -0.45, 0.1, 2.6 }, { -0.2, 0.35, 2.0 }, { 0.3, -0.15, 2.4 }, { 0.15, 0.5, 1.8 } }) do
    R.blob(f, cx + b[1] * rx, cy + b[2] * ry, b[3], b[3] * 0.85, 1.05)
  end
end

-- A spider leg: from its root out and up to a high, knobbled knee, then down to a pointed foot.
local function spiderLeg(f, root, knee, foot, tone)
  R.limb(f, root[1], root[2], knee[1], knee[2], 2.6, 1.9, tone)
  R.limb(f, knee[1], knee[2], foot[1], foot[2], 1.7, 1.0, tone)
  R.blob(f, knee[1], knee[2], 2.1, 2.1, tone * 1.1, true)
end

-- The Mother from the front. p: `drop` and `rear` (how far the body sinks and the upper body lifts),
-- `sx` (sway), the head (hx, hy, size, jaw, eyes), the arms la/ra = { elbow, hand, claw angle } and the
-- spider legs lg = { four { knee, foot } pairs: outer left, inner left, inner right, outer right }.
local function motherFront(p)
  local f = R.frame(MW, MH)
  local d, sx, up = p.drop or 0, p.sx or 0, p.rear or 0
  local c = 32 + sx
  local q = p.squash or 0 -- dying, the belly slumps and spreads on the ground
  local brx, bry = 18.5 * (1 + 0.35 * q), 19 * (1 - q)
  local by = math.min(62 + d, MH - 4 - bry) -- the belly's centre
  local sy = 32 + d - up -- the shoulders
  -- Under the belly, two short legs, far back and dim.
  spiderLeg(f, { c - 7, by + 10 }, { c - 13, by + 18 }, p.under and p.under[1] or { c - 11, MH - 1 }, FAR)
  spiderLeg(f, { c + 7, by + 10 }, { c + 13, by + 18 }, p.under and p.under[2] or { c + 11, MH - 1 }, FAR)
  -- The spider legs out of her flanks, knees jutting high.
  local roots = { { c - 15, by - 6 }, { c - 14, by + 6 }, { c + 14, by + 6 }, { c + 15, by - 6 } }
  for i, g in ipairs(p.lg) do spiderLeg(f, roots[i], g[1], g[2], (i == 2 or i == 3) and 0.8 or 0.92) end
  -- The swollen belly, lopsided and sagging, veined, things curled inside pressing out.
  R.blob(f, c, by + 3, brx, bry, 0.95)
  bellyMarks(f, c, by + 3, brx * 0.8, bry * 0.8)
  -- The gaunt upper body swelling up out of it: a ribbed chest and great hunched shoulders.
  R.limb(f, c, sy + 12, c, by - 8, 9, 11, 0.85)
  R.blob(f, c, sy + 7, 11, 9)
  R.ribs(f, c, sy + 4, 5, 2.5, 10, 2.5)
  R.blob(f, c - 12, sy, 5, 4.5); R.blob(f, c + 12, sy, 5, 4.5)
  R.limb(f, c - 12, sy, c, sy - 2, 4, 4.5, 0.9); R.limb(f, c + 12, sy, c, sy - 2, 4, 4.5, 0.9)
  R.stroke(f, c - 10, sy + 3, c - 2, sy + 5, 1, 1.3); R.stroke(f, c + 10, sy + 3, c + 2, sy + 5, 1, 1.3)
  -- The great arms, their claws long as a man's forearm.
  for _, arm in ipairs({ { c - 14, p.la, math.pi * 0.6 }, { c + 14, p.ra, math.pi * 0.4 } }) do
    local a = arm[2]
    bones(f, { root = { arm[1], sy + 1 }, joint = a[1], tip = a[2], r1 = 3.8, r2 = 3.2, knob = 3.2, claws = 3, fa = a[3] or arm[3], fl = 7, fs = 0.45 })
  end
  motherFace(f, c + (p.hx or 0), sy - 9 + (p.hy or 0), p.size or 1, p.jaw or 5, p.eyes or 2)
  return R.finish(f)
end

-- The Mother side-on, facing right: the swollen belly slung behind, the upper body hunched forward
-- over it with the head thrust out, the great arms planted in front, and the spider legs walking
-- under her. p: `by` (bob), the arms na/fa = { elbow, hand }, and the legs nl/fl = three { knee, foot }
-- pairs each (rear to front).
local function motherSide(p)
  local f = R.frame(MW, MH)
  local b = p.by or 0
  local roots = { { 12, 54 + b }, { 17, 74 + b }, { 29, 75 + b } }
  -- The far arm and far legs, dim, behind.
  bones(f, { root = { 40, 33 + b }, joint = p.fa[1], tip = p.fa[2], r1 = 3.2, r2 = 2.6, knob = 2.8, claws = 3, fa = 0.1, fl = 6, fs = 0.4, tone = FAR })
  for i, g in ipairs(p.fl) do spiderLeg(f, { roots[i][1] + 3, roots[i][2] - 2 }, g[1], g[2], FAR) end
  -- The belly, and the things curled up inside it.
  R.blob(f, 22, 60 + b, 18, 18, 0.95)
  bellyMarks(f, 21, 61 + b, 14, 14)
  -- The upper body swelling up out of it, hunched over: ribs, the shoulder's hump, the spine.
  R.limb(f, 29, 52 + b, 39, 32 + b, 10.5, 8.5, 0.9)
  R.blob(f, 42, 38 + b, 7.5, 8.5)
  R.sideRibs(f, 37, 48, 33 + b, 5, 2.5, 0.4)
  R.blob(f, 39, 27 + b, 7, 6)
  R.spine(f, 22, 44, 0)
  -- The near spider legs.
  for i, g in ipairs(p.nl) do spiderLeg(f, roots[i], g[1], g[2], 0.95) end
  -- The neck and head, hanging forward below the hump: the crown spikes raked back, the long jaw open.
  local hx, hy = 52 + (p.hx or 0), 30 + b + (p.hy or 0)
  R.limb(f, 42, 29 + b, hx - 3, hy, 5, 4, 0.95)
  for _, k in ipairs({ 0, 1, 2, 3 }) do
    local x = hx + 3.5 - k * 3.2
    local y = hy - 5 + k * 0.5
    R.spike(f, x, y + 1, x - 2.5 - k * 0.4, y - 4.5 + k * 0.5, 1.0)
  end
  R.blob(f, hx, hy, 6.5, 5.5)
  R.blob(f, hx + 2.5, hy + 5, 4.2, 3.3)
  local jaw = p.jaw or 5
  R.limb(f, hx - 2, hy + 7 + jaw * 0.5, hx + 5, hy + 8 + jaw, 1.8, 1.4)
  for yy = hy + 7, hy + 7 + jaw do
    for xx = math.floor(hx + 1 + (yy - hy - 7) * 0.4), math.floor(hx + 6) do R.paint(f, xx, yy, C.mouth) end
  end
  for xx = math.floor(hx + 1), math.floor(hx + 6) do R.paint(f, xx, math.floor(hy + 7), C.gum) end
  R.paint(f, math.floor(hx + 5), math.floor(hy + 8), C.flesh4); R.paint(f, math.floor(hx + 2), math.floor(hy + 8), C.flesh4)
  R.paint(f, math.floor(hx + 5), math.floor(hy + 6 + jaw), C.flesh3)
  for yy = 4, 6 do R.tint(f, hx + 1, hy + yy, 0.5) end
  crownEye(f, math.floor(hx + 4), math.floor(hy - 0.5), p.eyes or 2)
  crownEye(f, math.floor(hx + 0.5), math.floor(hy - 2.5), p.eyes or 2)
  crownEye(f, math.floor(hx - 3.5), math.floor(hy - 3), p.eyes or 2)
  -- The near arm, planted in front of her.
  bones(f, { root = { 43, 33 + b }, joint = p.na[1], tip = p.na[2], r1 = 3.8, r2 = 3.2, knob = 3.2, claws = 3, fa = 0.15, fl = 7, fs = 0.4 })
  return R.finish(f)
end

local function mother()
  local G = MH - 1
  local frames = {}
  local D = math.pi / 2
  local legs = { { { 3, 36 }, { 2, G } }, { { 8, 56 }, { 8, G } }, { { 56, 56 }, { 56, G } }, { { 61, 36 }, { 62, G } } }
  -- 0-3 walk (front): a heavy lurch. The arms swing, the legs step in pairs, the belly sways.
  local walk = {
    { sx = -1, la = { { 13, 55 }, { 15, 84 } }, ra = { { 51, 54 }, { 50, G } }, lg = legs },
    { drop = 1, la = { { 12, 57 }, { 14, G } }, ra = { { 52, 57 }, { 50, G } }, lg = { { { 4, 43 }, { 2, G } }, { { 9, 60 }, { 10, G - 4 } }, { { 56, 62 }, { 55, G } }, { { 60, 43 }, { 62, G } } } },
    { sx = 1, la = { { 13, 54 }, { 14, G } }, ra = { { 51, 55 }, { 49, 84 } }, lg = legs },
    { drop = 1, la = { { 12, 57 }, { 14, G } }, ra = { { 52, 57 }, { 50, G } }, lg = { { { 4, 43 }, { 2, G } }, { { 8, 62 }, { 9, G } }, { { 55, 60 }, { 54, G - 4 } }, { { 60, 43 }, { 62, G } } }, hx = 1 },
  }
  for _, p in ipairs(walk) do frames[#frames + 1] = motherFront(p) end
  -- 4-7 side-walk: the legs ripple, front to back, the arms haul her along in turn.
  local function legs3(a, bb, c2)
    return { { { 3 + a[1], 36 - a[2] }, { 2 + a[1], G - a[2] } }, { { 11 + bb[1], 82 - bb[2] }, { 10 + bb[1], G - bb[2] } }, { { 35 + c2[1], 82 - c2[2] }, { 37 + c2[1], G - c2[2] } } }
  end
  local side = {
    { na = { { 50, 60 }, { 57, G } }, fa = { { 45, 60 }, { 46, G } }, nl = legs3({ 0, 0 }, { -1, 0 }, { 2, 0 }), fl = legs3({ 2, 3 }, { 3, 0 }, { 0, 3 }) },
    { by = -1, na = { { 48, 60 }, { 53, G } }, fa = { { 47, 59 }, { 50, G - 4 } }, nl = legs3({ 1, 3 }, { -2, 0 }, { 3, 3 }), fl = legs3({ 1, 0 }, { 2, 0 }, { 0, 0 }) },
    { na = { { 45, 60 }, { 48, G } }, fa = { { 48, 59 }, { 55, G } }, nl = legs3({ 1, 0 }, { 0, 3 }, { 1, 0 }), fl = legs3({ 0, 0 }, { 1, 0 }, { 2, 0 }) },
    { by = -1, na = { { 48, 59 }, { 53, G - 4 } }, fa = { { 46, 60 }, { 50, G } }, nl = legs3({ 0, 0 }, { -1, 0 }, { 2, 0 }), fl = legs3({ 1, 3 }, { 2, 3 }, { 1, 0 }) },
  }
  for _, p in ipairs(side) do frames[#frames + 1] = motherSide(p) end
  -- 8 windup: she rears up, both arms high over her crown.
  frames[#frames + 1] = motherFront({ rear = 8, jaw = 7, la = { { 5, 24 }, { 11, 3 }, -math.pi * 0.25 }, ra = { { 59, 24 }, { 53, 3 }, -math.pi * 0.75 }, lg = legs })
  -- 9-10 attack: the slam comes down, and hits the ground in front of her.
  frames[#frames + 1] = motherFront({ drop = 2, hy = 2, jaw = 6, size = 1.05, la = { { 5, 40 }, { 18, 62 }, D * 0.8 }, ra = { { 59, 40 }, { 46, 62 }, D * 1.2 }, lg = legs })
  frames[#frames + 1] = motherFront({ drop = 6, hy = 4, jaw = 6, size = 1.1, la = { { 8, 60 }, { 22, G }, D * 0.6 }, ra = { { 56, 60 }, { 42, G }, D * 1.4 }, lg = legs })
  -- 11 hurt: she recoils, head thrown back and aside, arms flung out.
  frames[#frames + 1] = motherFront({ rear = 3, hx = 3, hy = -3, size = 0.95, jaw = 5, la = { { 4, 38 }, { 1, 62 }, D * 1.2 }, ra = { { 60, 38 }, { 63, 62 }, D * 0.8 }, lg = legs })
  -- 12-16 die: she rears and shrieks, her legs buckle, she sags, and collapses in a heap, eyes going out.
  frames[#frames + 1] = motherFront({ rear = 6, hy = -2, jaw = 7, la = { { 4, 26 }, { 6, 8 }, -math.pi * 0.6 }, ra = { { 60, 30 }, { 62, 14 }, -math.pi * 0.4 }, lg = legs })
  frames[#frames + 1] = motherFront({ drop = 8, sx = 2, hx = 2, hy = 3, jaw = 5, squash = 0.1, la = { { 7, 62 }, { 5, G } }, ra = { { 58, 62 }, { 60, G } }, lg = { { { 3, 52 }, { 1, G } }, { { 8, 68 }, { 7, G } }, { { 58, 68 }, { 58, G } }, { { 62, 52 }, { 63, G } } } })
  frames[#frames + 1] = motherFront({ drop = 16, sx = 2, hx = 3, hy = 5, jaw = 4, squash = 0.25, la = { { 5, 74 }, { 2, G } }, ra = { { 60, 74 }, { 63, G } }, lg = { { { 2, 70 }, { 0, G } }, { { 8, 80 }, { 5, G } }, { { 58, 80 }, { 60, G } }, { { 62, 70 }, { 63, G } } } })
  frames[#frames + 1] = motherFront({ drop = 22, sx = 1, hx = 3, hy = 6, jaw = 3, eyes = 1, squash = 0.4, la = { { 5, 84 }, { 1, G } }, ra = { { 60, 84 }, { 63, G } }, lg = { { { 3, 80 }, { 0, G - 2 } }, { { 9, 86 }, { 4, G } }, { { 57, 86 }, { 61, G } }, { { 62, 80 }, { 63, G - 2 } } }, under = { { 22, G }, { 42, G } } })
  frames[#frames + 1] = motherFront({ drop = 24, hx = 3, hy = 10, jaw = 2, eyes = 1, size = 0.95, squash = 0.45, la = { { 8, 76 }, { 15, 70 }, -math.pi * 0.2 }, ra = { { 56, 76 }, { 49, 70 }, -math.pi * 0.8 }, lg = { { { 4, 68 }, { 12, 62 } }, { { 7, 76 }, { 14, 70 } }, { { 57, 76 }, { 50, 70 } }, { { 60, 68 }, { 52, 62 } } }, under = { { 22, G - 2 }, { 42, G - 2 } } })
  return frames
end

---------------------------------------------------------------------------------------------------
-- The props, the pickups and the burning flare, painted straight in palette colours and lit like the
-- after-eaters: from the front, a little above and to the left. Fire and the flare's red are glow colours,
-- so they shine in the dark.
local IRON = { C.iron0, C.iron1, C.iron2, C.stone1 }
local STONE = { C.stone0, C.stone1, C.stone2, C.stone3 }
local NEEDLE = { C.needle0, C.needle1, C.needle2, C.needle3 }
local SNOW = { C.snow1, C.snow2, C.snow3, C.snow4 }

-- Picks from a ramp (dark -> light) by v in [0, 1], without dither: for smooth metal and stone.
local function pick(list, v)
  return list[math.max(1, math.min(#list, math.floor(v * (#list - 1) + 0.5) + 1))]
end

-- A small picture from rows of characters, each character a colour from `key` ('.' is empty).
local function picture(rows, key)
  local b = L.buffer(#rows[1], #rows)
  for y, row in ipairs(rows) do
    assert(#row == b.w, "picture row " .. y .. " is " .. #row .. " wide, not " .. b.w)
    for x = 1, #row do
      local ch = row:sub(x, x)
      if ch ~= "." then b[y - 1][x - 1] = assert(key[ch], "no colour for '" .. ch .. "'") end
    end
  end
  return b
end

-- The stove: 24x28, a black iron pot-belly on four legs, its pipe going up, the fire glowing through
-- the mica of its door and the slot of its ash pan. `flick` (0 or 1) moves the flames.
local function stove(flick)
  local b = L.buffer(24, 28)
  -- The pipe, with a collar joint and a damper key.
  for y = 0, 8 do
    for x = 10, 13 do
      local v = 0.62 - 0.22 * (x - 10) + ((y == 3) and 0.25 or 0) - ((y == 4) and 0.2 or 0)
      L.set(b, x, y, pick(IRON, v))
    end
  end
  L.set(b, 9, 6, C.iron2); L.set(b, 8, 6, C.stone1)
  -- The top plate with its lip, and the round collar where the pipe meets it.
  for x = 9, 14 do L.set(b, x, 8, (x < 11) and C.stone1 or C.iron2) end
  for x = 4, 19 do
    L.set(b, x, 9, (x < 9) and C.stone2 or (x < 14) and C.stone1 or C.iron2)
    L.set(b, x, 10, (x < 12) and C.iron2 or C.iron1)
    L.set(b, x, 11, C.iron0)
  end
  -- The belly: a round iron pot, lit from the left, a highlight running down its curve.
  local span = { [12] = { 6, 17 }, [13] = { 5, 18 }, [22] = { 5, 18 }, [23] = { 6, 17 } }
  for y = 12, 23 do
    local r = span[y] or { 4, 19 }
    for x = r[1], r[2] do
      local u, w = (x + 0.5 - 12) / 8, (y + 0.5 - 17.5) / 7
      local v = 0.45 - 0.4 * u - 0.1 * w
      if x == r[1] then v = 0.3 end
      if x == r[1] + 1 or x == r[1] + 2 then v = 0.95 end
      if x == r[2] then v = 0 end
      L.set(b, x, y, pick(IRON, v))
    end
  end
  -- The door, arched, with a lit iron rim warmed along its sill, and the fire behind its mica.
  for y = 13, 21 do
    for x = 7, 16 do
      local inDoor = (y > 13 or (x > 7 and x < 16)) and not (y == 13 and (x == 8 or x == 15))
      if inDoor then
        local rim = (x == 7 or x == 16 or y == 13 or y == 21 or (y == 14 and (x == 8 or x == 15)))
        if rim then
          L.set(b, x, y, (y == 21) and ((x < 12) and C.fire1 or C.ember0) or (x < 12 and y < 18) and C.stone2 or (x < 12) and C.stone1 or C.iron0)
        else
          local fx, fy = 11.5 + ((flick == 1) and 0.8 or -0.6), 20
          local e = math.sqrt(((x + 0.5 - fx) / 3.4) ^ 2 + ((y + 0.5 - fy) / 4.6) ^ 2) + 0.2 * L.rnd(x, y, 70 + flick)
          L.set(b, x, y, (e < 0.42) and C.fire4 or (e < 0.72) and C.fire3 or (e < 0.98) and C.fire2 or C.ember0)
        end
      end
    end
  end
  -- A bar across the door's mica.
  for x = 8, 15 do if L.get(b, x, 16) ~= C.fire4 then L.set(b, x, 16, C.iron1) end end
  L.set(b, 17, 17, C.stone2); L.set(b, 17, 18, C.iron2) -- the latch
  -- The ash pan's slot, glowing, and the base plate.
  for x = 9, 14 do L.set(b, x, 22, ((x == 11 or x == 12 + flick) and C.fire2) or C.ember0) end
  for x = 4, 19 do L.set(b, x, 24, (x < 9) and C.stone1 or C.iron2); L.set(b, x, 25, C.iron0) end
  -- Four legs: the back two in shadow, the front two splayed on curled feet.
  for y = 25, 26 do L.set(b, 9, y, C.iron0); L.set(b, 14, y, C.iron0) end
  for y = 25, 27 do
    L.set(b, 5, y, C.iron2); L.set(b, 6, y, C.iron1)
    L.set(b, 17, y, C.iron1); L.set(b, 18, y, C.iron0)
  end
  L.set(b, 4, 27, C.iron2); L.set(b, 19, 27, C.iron1)
  return b
end

-- The well: 32x24, a low ring of fieldstones under a cap of snow round a black hole, and a wooden
-- crank post on its right with the rope wound on its roller.
local function well()
  local b = L.buffer(32, 24)
  local cx, top, rx, ry = 14, 9.5, 12.5, 3
  -- The stone ring, course by course, curving round the front.
  for x = 1, 27 do
    local u = (x + 0.5 - cx) / rx
    if math.abs(u) <= 1 then
      local front = top + ry * math.sqrt(1 - u * u)
      local bottom = 21 + 1.5 * math.sqrt(1 - u * u)
      for y = math.floor(front), math.floor(bottom) do
        local depth = y + 0.5 - front
        local k = math.floor(depth / 4)
        local t = (depth - k * 4) / 4
        local sPos = x + k * 3 + 2 * L.rnd(k, 0, 5)
        local j = math.floor(sPos / 5.5)
        local sl = (sPos - j * 5.5) / 5.5
        -- Each fieldstone a rounded lump in its cell, lit from the upper left.
        local ex, ey = (sl - 0.5) / 0.52, (t - 0.55) / 0.5
        if ex * ex + ey * ey > 1 + 0.25 * (L.rnd(x, y, 6) - 0.5) then
          L.set(b, x, y, (ey < 0) and C.stone0 or C.void)
        else
          local v = 0.42 + 0.3 * L.rnd(j, k, 7) - 0.35 * ex * 0.6 - 0.35 * ey - 0.35 * u
          L.set(b, x, y, pick(STONE, v))
          if ey < -0.55 and L.rnd(j, k, 8) < 0.45 then L.set(b, x, y, C.snow3) end
        end
      end
    end
  end
  -- The snow cap on the rim, drifting over the front edge, and the black hole in the middle.
  for y = 5, 13 do
    for x = 0, 28 do
      local u, w = (x + 0.5 - cx) / (rx + 0.5), (y + 0.5 - top) / (ry + 0.6)
      if u * u + w * w <= 1 then
        local iu, iw = (x + 0.5 - cx) / (rx - 3.5), (y + 0.5 - top + 0.4) / (ry - 1.4)
        if iu * iu + iw * iw <= 1 then
          L.set(b, x, y, (y <= top - 1) and C.night1 or C.void)
        else
          L.set(b, x, y, L.ramp(SNOW, 0.72 - 0.35 * u + 0.25 * w, x, y))
        end
      end
    end
  end
  for x = 3, 25 do
    local u = (x + 0.5 - cx) / rx
    local front = top + ry * math.sqrt(math.max(0, 1 - u * u))
    if L.rnd(x, 0, 9) < 0.45 then L.set(b, x, math.floor(front) + 1, C.snow3) end
  end
  -- Snow drifted round its foot.
  for x = 0, 31 do
    local h = 1.5 + 1.5 * L.rnd(math.floor(x / 3), 0, 11) + ((x > 3 and x < 26) and 0.8 or 0)
    for y = math.floor(23 - h + 1), 23 do L.set(b, x, y, L.ramp(SNOW, 0.62 - 0.3 * (x - 14) / 16 + 0.15 * (y - 21), x, y)) end
  end
  -- The crank post, its roller reaching over the hole, the rope wound on it and hanging down.
  for y = 2, 22 do
    L.set(b, 26, y, C.wood4); L.set(b, 27, y, (L.rnd(27, y, 12) < 0.2) and C.wood2 or C.wood3); L.set(b, 28, y, C.wood2)
  end
  for x = 25, 29 do L.set(b, x, 1, (x < 28) and C.snow4 or C.snow3) end
  L.set(b, 26, 0, C.snow3); L.set(b, 27, 0, C.snow3)
  for x = 12, 25 do
    L.set(b, x, 4, C.wood4); L.set(b, x, 5, C.wood3); L.set(b, x, 6, C.wood2)
    if x >= 15 and x <= 20 then
      for y = 4, 6 do L.set(b, x, y, ((x + y) % 3 == 0) and C.wood2 or C.wood5) end
    end
    if L.rnd(x, 3, 13) < 0.7 then L.set(b, x, 3, (x < 18) and C.snow4 or C.snow3) end
  end
  L.set(b, 12, 5, C.wood5); L.set(b, 12, 4, C.wood5)
  for y = 7, 9 do L.set(b, 16, y, C.wood4) end
  -- The crank's iron handle, and its wooden grip.
  L.set(b, 29, 5, C.iron2); L.set(b, 30, 5, C.iron2); L.set(b, 30, 6, C.iron2); L.set(b, 30, 7, C.iron2)
  L.set(b, 31, 7, C.wood4); L.set(b, 31, 8, C.wood3)
  return b
end

-- A lone pine: 40x96, tiers of boughs sagging under snow, a short trunk at the base in a drift.
local function pine()
  local b = L.buffer(40, 96)
  local cx = 20
  -- The trunk, and the drift round its foot.
  for y = 78, 95 do
    for x = 18, 21 do L.set(b, x, y, ({ C.bark3, C.bark2, C.bark1, C.bark0 })[x - 17]) end
    if L.rnd(0, y, 20) < 0.3 then L.set(b, 19, y, C.bark1) end
  end
  for y = 90, 95 do
    for x = 8, 31 do
      local u, w = (x + 0.5 - cx) / 12, (y + 0.5 - 96) / 5.5
      if u * u + w * w <= 1 then L.set(b, x, y, L.ramp(SNOW, 0.7 - 0.35 * u - 0.1 * (y - 92), x, y)) end
    end
  end
  -- The tiers, from the bottom up, each a skirt of boughs: {top, bottom, half-width, droop}. The upper
  -- tiers overlap the lower ones, so the snow on each shows as a shelf round its outer edge.
  local tiers = { { 2, 11, 4.5, 1, 0 }, { 7, 20, 7.5, 2, 1 }, { 14, 30, 10, 2.5, -1 }, { 23, 42, 13, 3, 1 }, { 33, 54, 14.5, 3.5, -1 }, { 45, 67, 17, 4, 1 }, { 57, 81, 19.5, 4.5, 0 } }
  for i = #tiers, 1, -1 do
    local t1, t2, hw, droop, lean = tiers[i][1], tiers[i][2], tiers[i][3], tiers[i][4], tiers[i][5]
    for y = t1, t2 + math.ceil(droop) + 1 do
      for x = 0, 39 do
        local rel = x + 0.5 - cx - lean * 0.6
        local dx = math.abs(rel)
        local a = dx / (hw + ((rel < 0) and lean * -0.5 or lean * 0.5))
        local jag = (L.rnd(math.floor(x / 2), y, 30 + i) - 0.5) * 2
        local topEdge = t1 + (t2 - t1 + droop) * (a ^ 0.85)
        local botEdge = t2 + droop * a * a - ((L.rnd(math.floor(x / 2), 0, 40 + i) < 0.35) and 1.5 or 0)
        if a <= 1 + jag / hw and y >= topEdge - 0.5 and y <= botEdge then
          local depth = (y - topEdge) / math.max(1, botEdge - topEdge)
          local side = rel / hw
          -- Snow lies thick on the top of each tier, thickest out towards the sagging tips.
          local snowDepth = 1.8 + 2.8 * a + 1.2 * L.rnd(math.floor(x / 2), i, 50)
          if y - topEdge < snowDepth and L.rnd(x, y, 60 + i) > 0.06 then
            local v = 0.95 - 0.45 * math.max(0, side) - 0.12 * (y - topEdge)
            L.set(b, x, y, pick(SNOW, v + 0.12 * (L.rnd(x, y, 65) - 0.5)))
          else
            local v = 0.6 - 0.6 * depth - 0.3 * side + 0.3 * (L.rnd(math.floor(x / 2), y, 70 + i) - 0.5)
            L.set(b, x, y, pick(NEEDLE, v))
          end
        end
      end
    end
    -- Snow lying along the boughs across the tier's face, sagging out to the tips, with shadow under.
    for k = 1, 2 do
      for x = 0, 39 do
        local rel = x + 0.5 - cx - lean * 0.6
        local a = math.abs(rel) / hw
        if a > 0.12 and a < 0.95 then
          local yk = t1 + (t2 - t1) * (0.28 + 0.3 * k) + (droop + 1.5) * a * a
          local yy = math.floor(yk)
          local open = L.rnd(math.floor(x / 3) + k * 7, i, 90) > 0.3 and L.rnd(x, k, 91 + i) > 0.15
          if open and yy > t1 and L.get(b, x, yy) and L.get(b, x, yy + 1) then
            local side = rel / hw
            L.set(b, x, yy, pick(SNOW, 0.95 - 0.45 * math.max(0, side)))
            if L.rnd(x, yy, 92) < 0.5 then L.set(b, x, yy - 1, pick(SNOW, 0.8 - 0.45 * math.max(0, side))) end
            L.set(b, x, yy + 1, C.needle0)
          end
        end
      end
    end
    -- Clumps of snow hanging off the tips.
    for _, sgn in ipairs({ -1, 1 }) do
      local tx = math.floor(cx + sgn * (hw - 1) + lean * 0.6)
      local ty = math.floor(t2 + droop)
      if i > 1 then L.set(b, tx, ty + 1, C.snow3); L.set(b, tx - sgn, ty + 1, C.snow2) end
    end
  end
  -- The leader, and a tuft of snow on it.
  L.set(b, 20, 0, C.needle2); L.set(b, 20, 1, C.snow3); L.set(b, 19, 1, C.snow4)
  return b
end

-- The flare, stuck in the snow and burning: 8x12, three flickering frames of flame and sparks.
local FLARE_KEY = { Y = C.fire4, O = C.fire3, F = C.flare2, R = C.flare1, h = C.hurt, k = C.iron1, K = C.iron2, S = C.snow3, W = C.snow4, s = C.snow2 }
local function flareFrames()
  local flames = {
    { "..F.....", "...Y..F.", "..FYY...", ".F.YY...", "...RR.F." },
    { "....F...", ".F.Y....", "...YYF..", "..FYY...", "...RR..." },
    { "...F..F.", "..FY....", "..YYF...", "...YY.F.", "F..RR..." },
  }
  local frames = {}
  for _, fl in ipairs(flames) do
    local rows = {}
    for i = 1, 5 do rows[i] = fl[i] end
    for _, r in ipairs({ "...Rh...", "...Rh...", "...Rh...", "...Kk...", "..WKkS..", ".WWSSSs.", "SSSSSsss" }) do rows[#rows + 1] = r end
    frames[#frames + 1] = picture(rows, FLARE_KEY)
  end
  return frames
end

local PICKUP_KEY = {
  F = C.flare2, R = C.flare1, h = C.hurt, k = C.iron1, K = C.iron2, i = C.iron0, g = C.stone2, G = C.stone3,
  B = C.brass1, b = C.brass0, W = C.snow4, S = C.snow3, s = C.snow2, d = C.snow1, m = C.mouth,
  ["5"] = C.wood5, ["4"] = C.wood4, ["3"] = C.wood3, ["2"] = C.wood2, ["1"] = C.wood1, ["0"] = C.wood0,
}

-- A spare flare lying in the snow: 12x8.
local function pickupFlare()
  return picture({
    "............",
    "............",
    "........KKK.",
    "..FFFFFRRkk.",
    ".RRRRWRhhkki",
    ".hhhhWhhh...",
    ".ddddddddds.",
    "sSSSSSSSSSSs",
  }, PICKUP_KEY)
end

-- A cardboard box of shotgun shells in the snow: the lid folded back on the brass heads, a torn side
-- showing the red hulls, and a loose shell beside it. 16x10.
local function pickupShells()
  return picture({
    "..555555554.....",
    ".4BbBbBbBbB3....",
    ".4bBbBbBbBb3....",
    ".44444444442....",
    ".3hhhhh33332.hhB",
    ".3mmmmm33332hhhB",
    ".33333333332mmmb",
    ".33333333332....",
    "d22222222221ddd.",
    "sSSSSSSSSSSSSSss",
  }, PICKUP_KEY)
end

-- The double-barrelled shotgun, lying on its side in the snow: 28x8.
local function pickupShotgun()
  return picture({
    "............KK.............G",
    ".4555544...KgKGgGGgGGgGGGGgG",
    "i44444444443KKkkkkkkkkkkkkkk",
    "i3333334443KKKgKKKKKKKKKKKKK",
    "i333332...kKk44444443kkkkkkk",
    ".22.......kk.2222222........",
    "..ddddddddddddddddddddddds..",
    "sSSSSSSSSSSSSSSSSSSSSSSSSSSs",
  }, PICKUP_KEY)
end

L.writeSprites(P, {
  { name = "crawler", frames = crawler(), height = 0.35, stride = 0.35,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, attack = { 8, 9 }, hurt = { 10 }, die = { 11, 12, 13, 14, 15 } } },
  { name = "gaunt", frames = gaunt(), height = 1.1, stride = 0.5,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, windup = { 8 }, attack = { 9, 10 }, hurt = { 11 }, die = { 12, 13, 14, 15, 16 } } },
  { name = "leaper", frames = leaper(), height = 0.7, stride = 0.4,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, crouch = { 8 }, leap = { 9 }, ["side-leap"] = { 10 }, attack = { 11, 12 }, hurt = { 13 }, die = { 14, 15, 16, 17, 18 } } },
  { name = "mother", frames = mother(), height = 2.2, stride = 0.7,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, windup = { 8 }, attack = { 9, 10 }, hurt = { 11 }, die = { 12, 13, 14, 15, 16 } } },
  { name = "stove", frames = { stove(0), stove(1) }, height = 0.65, ms = 120, anims = { idle = { 0, 1 } } },
  { name = "well", frames = { well() }, height = 0.55, anims = { idle = { 0 } } },
  { name = "pine", frames = { pine() }, height = 2.6, anims = { idle = { 0 } } },
  { name = "flare", frames = flareFrames(), height = 0.25, ms = 80, anims = { idle = { 0, 1, 2 } } },
  { name = "pickup-flare", frames = { pickupFlare() }, height = 0.2, anims = { idle = { 0 } } },
  { name = "pickup-shells", frames = { pickupShells() }, height = 0.2, anims = { idle = { 0 } } },
  { name = "pickup-shotgun", frames = { pickupShotgun() }, height = 0.2, anims = { idle = { 0 } } },
})
