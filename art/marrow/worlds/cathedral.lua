-- World "cathedral" (ladder rung 0, the Rusher): the flesh cathedral. You're inside something alive,
-- and it's looking at you. Loaded by scenes.lua (and maw.lua for `maw`) as
--   dofile("worlds/cathedral.lua")({ L = lib, S = sculpt, G = common, P = this world's palette })
-- and returns { far, fog, scenes = { C, B1, B2, V }, colors, maw }.
--   far    a wall of crimson flesh folds all round; the vast half-open eye (its iris low, watching the
--          fight) above C, a puckered orifice above each V, small eyes, shafts of pale rose light
--   fog    violet-pink steam off the meat
--   scenes ribs that are giant finger bones ending in pale hands; torn veined membranes; a spine
--          coming apart in mid-air; every floor is a jaw of molars (B1's tunnel is a mouth, with a
--          row of upper teeth); pits are throats lined with inward teeth; B2's ledge is one great molar
--          and its pillar a stack of vertebrae; V is a vault of ribs over lips pressed shut in the floor
return function(env)
  local L, S, G, P = env.L, env.S, env.G, env.P
  local W, H, FW, FLOOR = G.W, G.H, G.FAR_W, G.FLOOR
  local sh, cr, fl, mg, bn = P.shadow, P.crimson, P.flesh, P.magenta, P.bone
  local smooth = G.smooth
  local KEY = { -0.55, -0.62, 0.56 } -- a pale key from the upper left, where the shafts come from
  local LIGHTER = G.chains({
    { P.void, sh[1], sh[2], sh[3], sh[4], bn[2], bn[3], bn[4] },
    { cr[1], cr[2], cr[3], cr[4], fl[3], fl[4], fl[5] },
    { fl[1], fl[2], fl[3], fl[4], fl[5] },
    { mg[1], mg[2], mg[3], fl[5] },
    { bn[1], bn[2], bn[3], bn[4] },
  })
  local EYE_U, EYE_Y = 400, 38                       -- the great eye, above screen C
  local ORIFICES = { { 160, 48 }, { 640, 48 } }       -- above V- and V+
  local EYE_SCREEN = { x = 160, y = 38 }              -- where the eye appears on C (for rim light)

  -------------------------------------------------------------------------------------------------
  -- far

  local function eyeShape(cx, cy, ax)
    local function span(x)
      local s = (x + 0.5 - cx) / ax
      return math.max(0, 1 - s * s), s
    end
    local function top(x) local q, s = span(x); return cy - 14 * q ^ 0.8 + 3 * s end
    local function bot(x) local q, s = span(x); return cy + 17 * q ^ 0.6 + 3 * s end
    return span, top, bot
  end

  local function far()
    local b = L.buffer(FW, H)
    S.gradient(b, { { 0, sh[1] }, { 50, cr[1] }, { 120, sh[2] }, { 179, sh[1] } })
    local g = S.new(FW, H, true)
    local folds = 35
    for i = 0, folds - 1 do -- flesh hanging in folds like curtains, all the way round
      local x0 = i * (FW / folds) + (L.rnd(i, 1, 101) - 0.5) * 8
      local r = 9 + L.rnd(i, 2, 101) * 5
      local ph = L.rnd(i, 3, 101) * 6.28
      S.tube(g, function(t)
        local y = -12 + t * 204
        return x0 + math.sin(y * 0.04 + ph) * 5, y
      end, function(t) return r * (0.8 + 0.2 * math.sin(t * 11 + ph)) end, "fold", 0)
    end
    -- the great eye's lids: a thick upper lid with a fold above it, a wet lower lid
    local AX = 58
    local span, lidTop, lidBot = eyeShape(EYE_U, EYE_Y, AX)
    local function lidCurve(fy, dy)
      return function(t)
        local x = EYE_U - AX - 3 + t * (2 * AX + 6)
        return x, fy(x) + dy(x)
      end
    end
    S.tube(g, lidCurve(lidTop, function(x) return -9 - 5 * span(x) end), function(t) return 2 + 5 * (1 - (2 * t - 1) ^ 2) end, "lid", 30)
    S.tube(g, lidCurve(lidTop, function(x) return -3 * span(x) - 1 end), function(t) return 2.5 + 6 * (1 - (2 * t - 1) ^ 2) end, "lid", 40)
    S.tube(g, lidCurve(lidBot, function(x) return 2 + 1.5 * span(x) end), function(t) return 1.8 + 4 * (1 - (2 * t - 1) ^ 2) end, "lid", 40)
    -- the orifices: swollen mounds, puckered shut
    for _, o in ipairs(ORIFICES) do S.ellipsoid(g, o[1], o[2], 40, 30, "ori", 20, nil, 14) end
    -- small eyes dotted over the wall, a few shut
    local small = { { 290, 20 }, { 512, 26 }, { 270, 84 }, { 536, 92 }, { 324, 66 }, { 480, 70 }, { 60, 90 },
      { 230, 30 }, { 100, 24 }, { 570, 40 }, { 700, 96 }, { 760, 30 }, { 20, 60 }, { 420, 104 } }
    for i, p in ipairs(small) do S.ellipsoid(g, p[1], p[2], 7, 5, "lid", 8, i) end

    local foldRamp = { sh[1], sh[2], cr[1], cr[2], cr[3], cr[4] }
    local lidRamp = { sh[1], cr[2], cr[3], fl[2], fl[3], fl[4] }
    local function focusGlow(x, y)
      local best = 0
      for _, f in ipairs({ { EYE_U, EYE_Y, 150, 90 }, { ORIFICES[1][1], ORIFICES[1][2], 110, 80 }, { ORIFICES[2][1], ORIFICES[2][2], 110, 80 } }) do
        local dx = (x + 0.5 - f[1]); dx = (dx + FW / 2) % FW - FW / 2
        local d = math.sqrt((dx / f[3]) ^ 2 + ((y + 0.5 - f[2]) / f[4]) ^ 2)
        best = math.max(best, 1 - d)
      end
      return best
    end
    S.shade(g, b, function(px)
      local lam = S.lambert(px, KEY[1], KEY[2], KEY[3])
      if px.m == "fold" then
        local v = 0.08 + lam * 0.55 + focusGlow(px.x, px.y) * 0.4 - smooth(90, 170, px.y) * 0.3
        local qx, qy = (px.x + 0.5 - EYE_U) / 84, (px.y + 0.5 - EYE_Y - 1) / 36 -- the eye's sunk socket
        local q = qx * qx + qy * qy
        if q < 1 then v = v - 0.5 * (1 - q) ^ 0.5 end
        if px.edge then v = v - 0.35 end
        v = v + (L.rnd(px.x, px.y, 102) - 0.5) * 0.08
        return S.pick(foldRamp, v, px.x, px.y, 0.4)
      elseif px.m == "ori" then
        -- radial folds converging on the pucker
        local o = (math.abs(px.x - ORIFICES[1][1]) < 60) and ORIFICES[1] or ORIFICES[2]
        local a = math.atan(px.y + 0.5 - o[2], px.x + 0.5 - o[1])
        local v = 0.15 + lam * 0.6 + math.sin(a * 13) * 0.18
        if px.edge then v = v - 0.3 end
        return S.pick(lidRamp, v, px.x, px.y, 0.4)
      else
        local v = 0.1 + lam * 0.85
        if px.edge then v = v - 0.3 end
        return S.pick(lidRamp, v, px.x, px.y, 0.4)
      end
    end, 4)

    -- the eyeball between the lids: a pale wet sphere, the iris low, watching the floor
    local IX, IY, IR = EYE_U + 3, EYE_Y + 7, 15
    for x = EYE_U - AX, EYE_U + AX do
      local top, bot = lidTop(x), lidBot(x)
      for y = math.floor(top) - 6, math.ceil(bot) + 2 do
        local i = S.index(g, x, y)
        if y > top - 3 and y < bot and g.m[i] ~= "lid" then
          local dx, dy = x + 0.5 - IX, y + 0.5 - IY
          local d = math.sqrt(dx * dx + dy * dy)
          local u, v = (x + 0.5 - EYE_U) / 62, (y + 0.5 - EYE_Y - 4) / 40
          local nz = math.sqrt(math.max(0, 1 - u * u - v * v))
          local lam = math.max(0, -u * KEY[1] - v * KEY[2] + nz * KEY[3])
          local shadow = smooth(5, 0, y - top)
          local c = S.pick({ cr[2], cr[3], fl[3], fl[4], fl[5] }, 0.25 + lam * 0.75 - shadow * 0.6, x, y, 0.3)
          if d <= IR then
            local ang = math.atan(dy, dx) -- the iris: glowing magenta rings with radial fibres
            local fib = math.sin(ang * 23 + L.rnd(math.floor(ang * 9), 1, 104) * 3) * 0.12
            local iv = 1.0 - (d / IR) * 0.7 + fib - shadow * 0.5
            if d > IR - 1.3 then iv = 0.08 end
            c = S.pick({ sh[2], sh[3], mg[1], mg[2], mg[3] }, iv, x, y, 0.35)
            local half = 2.8 * math.max(0, 1 - (dy / 13) ^ 2) -- the pupil: a slit lined with tiny teeth
            if math.abs(dx) <= half then c = P.void
            elseif math.abs(dx) <= half + 1 and half > 0.8 and (math.floor(y) % 2 == 0) then c = bn[4] end
          end
          b[y][x % FW] = c
        end
      end
    end
    for i = 0, 13 do -- blood vessels creeping over the white from both corners
      local side = (i % 2 == 0) and -1 or 1
      local x, y = EYE_U + side * (AX - 6), EYE_Y + 2 + (L.rnd(i, 1, 105) - 0.5) * 10
      local a = ((side < 0) and 0 or math.pi) + (L.rnd(i, 2, 105) - 0.5) * 1.4
      for s = 0, 34 do
        local c = L.get(b, x, y)
        if y <= lidTop(x) or y >= lidBot(x) or g.m[S.index(g, x, y)] == "lid" then break end
        if c ~= fl[3] and c ~= fl[4] and c ~= fl[5] and c ~= cr[3] then break end
        S.wset(b, x, y, (s < 12) and cr[4] or cr[3])
        a = a + (L.rnd(i, s, 106) - 0.5) * 0.9
        x, y = x + math.cos(a), y + math.sin(a) * 0.7
      end
    end
    L.fillRect(b, IX - 8, IY - 6, IX - 6, IY - 5, fl[5]) -- a wet reflection of the light
    L.set(b, IX - 4, IY - 7, fl[5])
    for i = 0, 19 do -- lashes: dark hooks curling off the upper lid
      local x = EYE_U - AX + 5 + i * 5.7
      local top = lidTop(x) + 2
      local lean = (x - EYE_U) / AX
      for k = 0, 5 + (i % 3) do S.wset(b, x + lean * k * 0.9, top + k * 0.55 + k * k * 0.05, sh[1]) end
    end
    for i, p in ipairs(small) do -- the small eyes: slits, most open and looking down
      for x = p[1] - 5, p[1] + 5 do
        local s = (x - p[1]) / 5.5
        local hgt = math.floor(2.0 * (1 - s * s) + 0.3)
        if i % 3 == 0 then
          S.wset(b, x, p[2], sh[1]); S.wset(b, x, p[2] + 1, cr[2])
        else
          for y = p[2] - hgt + 1, p[2] + hgt do S.wset(b, x, y, (y == p[2] - hgt + 1) and fl[3] or fl[4]) end
          S.wset(b, x, p[2] - hgt, sh[1]); S.wset(b, x, p[2] + hgt + 1, mg[2])
        end
      end
      if i % 3 ~= 0 then
        S.wset(b, p[1] + 1, p[2], mg[2]); S.wset(b, p[1] + 1, p[2] + 1, mg[1]); S.wset(b, p[1], p[2], mg[2])
        S.wset(b, p[1] + 1, p[2] - 1, P.void); S.wset(b, p[1] + 1, p[2], P.void)
      end
    end
    for _, o in ipairs(ORIFICES) do -- the orifices' creases, the dark pucker, a ring of small teeth
      for k = 0, 15 do
        local a = k / 16 * math.pi * 2 + L.rnd(k, o[1], 107) * 0.2
        for r = 6, 30 do
          local wob = math.sin(r * 0.4 + k) * 1.2
          local x, y = o[1] + math.cos(a) * r + wob * -math.sin(a), o[2] + math.sin(a) * r * 0.74 + wob * math.cos(a)
          if r < 26 or L.rnd(k, r, 108) > 0.5 then S.wset(b, x, y, (r < 14) and cr[2] or cr[3]) end
        end
      end
      for y = o[2] - 5, o[2] + 5 do
        for x = o[1] - 8, o[1] + 8 do
          local q = ((x + 0.5 - o[1]) / 7.5) ^ 2 + ((y + 0.5 - o[2]) / 4.6) ^ 2
          if q < 1 then S.wset(b, x, y, (q < 0.55) and P.void or sh[1]) end
          if q >= 1 and q < 1.45 and (x + y) % 2 == 0 then S.wset(b, x, y, bn[4]) end
        end
      end
    end

    -- shafts of pale rose light from the upper left, fading toward the floor
    local shafts = { { 0, 22 }, { 58, 10 }, { 118, 28 }, { 204, 14 }, { 258, 9 }, { 330, 18 }, { 402, 12 },
      { 470, 26 }, { 560, 10 }, { 610, 20 }, { 690, 12 }, { 744, 16 } }
    for y = 0, H - 1 do
      for x = 0, FW - 1 do
        local strength = 0
        for _, s in ipairs(shafts) do
          local u = (x - 0.5 * y - s[1] - 160) % FW
          if u < s[2] then strength = math.max(strength, (math.min(u, s[2] - u) / (s[2] * 0.5)) ^ 0.5) end
        end
        local k = strength * (0.1 + 0.9 * (1 - smooth(10, 150, y))) * 1.25
        for step = 0, 2 do
          if k > step * 0.4 + L.bayer(x + step, y + step * 2) * 0.6 then G.step(b, x, y, LIGHTER) end
        end
      end
    end
    return b
  end

  -------------------------------------------------------------------------------------------------
  -- fog: steam off the meat, violet low down, flesh-pink wisps higher up. Seamless.

  local function fog()
    local b = L.buffer(G.FOG_W, H)
    local k = 2 * math.pi / G.FOG_W
    for y = 70, H - 1 do
      for x = 0, G.FOG_W - 1 do
        local band = math.sin(y * 0.12 + math.sin(x * k * 3 + y * 0.03) * 1.8) * 0.5 + 0.5
        local depth = (y - 70) / (H - 70)
        local a = depth * 0.45 + band * 0.32 * depth
        if a > L.bayer(x, y) * 0.9 + 0.1 then b[y][x] = (a > 0.55) and (sh[4] .. "60") or (fl[2] .. "40") end
      end
    end
    return b
  end

  -------------------------------------------------------------------------------------------------
  -- solids: every solid is jaw. Molars along each top surface (and hanging from undersides: the
  -- upper jaw), wet gums, then marbled meat with magenta veins; walls are wet flesh.

  local function teethRow(seed)
    local t, x, k = {}, -12, 0
    while x < W + 12 do
      local w = 8 + math.floor(L.rnd(k, 1, seed) * 5)
      for i = 0, w do t[x + i] = { i, w, k } end
      x, k = x + w + 1, k + 1
    end
    return t
  end
  local TOP_TEETH, LOW_TEETH = teethRow(113), teethRow(114)

  -- The color of a tooth pixel `d` px into the tooth (from its biting edge) at column x, or nil for the
  -- gum below it. Shared by the floor's teeth and the tunnel's upper teeth.
  local function tooth(row, x, d, seed)
    local t = row[x]
    local tx, tw = t[1], t[2]
    local cx = (tx - (tw - 1) / 2) / (tw / 2)
    local gum = 5 + math.floor(2.2 * (1 - cx * cx) + 0.5)
    if d >= gum then return nil, gum end
    if tx == tw then return (d == 0) and cr[2] or P.void, gum end -- the gap between two teeth
    if L.rnd(t[3], 2, seed) > 0.88 and d == 0 then return (cx > 0.2) and cr[2] or bn[2], gum end -- cracked
    local lit = -cx * 0.5 + 0.5 - d * 0.07 + ((d == 0) and 0.5 or 0)
    local c = S.pick({ bn[1], bn[2], bn[3], bn[4] }, lit + 0.1, x, d, 0.5)
    if d == gum - 1 then c = bn[2] end
    return c, gum
  end

  local function paintSolids(b, grid, seed)
    local probe = G.probe(grid, 40)
    for y = 0, H - 1 do
      for x = 0, W - 1 do
        local up, down, side = probe(x, y)
        if up then
          local n = L.rnd(x, y, seed)
          local c, gum
          if side > 1 and up < 12 then c, gum = tooth(TOP_TEETH, x, up, seed) end
          if not c and side > 1 and down < 12 and up >= 12 then c, gum = tooth(LOW_TEETH, x, down, seed + 1) end
          gum = gum or 6
          if c then
            -- a tooth
          elseif side > 1 and up <= gum + 1 then
            c = (up == gum) and ((n > 0.75) and mg[3] or fl[4]) or fl[3]
          elseif side > 1 and down <= gum + 1 and up >= 12 then
            c = (down == gum) and ((n > 0.75) and mg[3] or fl[4]) or fl[3]
          elseif down == 0 then
            c = (n > 0.6) and mg[2] or fl[1]
          elseif side <= 1 then
            c = (n > 0.8) and mg[1] or fl[2]
          elseif side == 2 then
            c = fl[1]
          else
            -- marbled meat: long muscle grain, ridged-noise veins, darker away from the surface
            local depth = math.min(1, (math.min(up, down + 8) - gum) / 22)
            local grain = S.noise(x * 0.5, y * 2.2, seed, 9, nil, 2)
            local ridge = 1 - math.abs(S.noise(x, y * 1.4, seed + 5, 18, nil, 2) * 2 - 1)
            c = S.pick({ sh[1], sh[2], cr[1], cr[2], cr[3] }, 0.95 - depth * 0.6 + (grain - 0.5) * 0.7, x, y, 0.45)
            if up <= gum + 3 then c = fl[2] end
            if ridge > 0.955 then c = (depth < 0.45) and mg[1] or sh[3]
            elseif ridge > 0.93 and depth < 0.45 then c = cr[3] end
          end
          b[y][x] = c
        end
      end
    end
  end

  -- The dark below a pit: a throat going down, ringed with ridges, inward teeth at the rim, black at
  -- the bottom. Paints only the empty pixels under the floor line.
  local function pits(b, grid, anchors)
    for _, p in ipairs(G.pits(grid)) do
      local x0, x1 = p[1], p[2]
      local wdt = x1 - x0 + 1
      for y = FLOOR, H - 1 do
        for x = x0, x1 do
          if not G.solid(grid, x, y) then
            local u = ((x + 0.5 - x0) / wdt) * 2 - 1           -- -1 .. 1 across the throat
            local depth = (y - FLOOR) / (H - FLOOR)
            local ring = ((y - FLOOR) + math.floor(u * u * 5)) % 7 == 0
            local v = 0.8 - depth * 0.9 - math.abs(u) * -0.25 - (1 - math.abs(u)) * 0.35
            local c = S.pick({ P.void, sh[1], cr[1], cr[2] }, v, x, y, 0.4)
            if ring and depth < 0.8 then c = (math.abs(u) > 0.6) and cr[3] or cr[2] end
            b[y][x] = c
          end
        end
      end
      for s = 0, 1 do -- inward teeth hanging off both walls at the rim
        for k = 0, 2 do
          local ty = FLOOR + 1 + k * 5
          for i = 0, 4 - k do
            local len = 4 - math.abs(i - 2) - k
            for d = 0, len do
              local x = (s == 0) and (x0 + d) or (x1 - d)
              L.set(b, x, ty + i, (d == len) and bn[2] or bn[4])
            end
          end
        end
      end
      anchors.drips[#anchors.drips + 1] = { math.floor((x0 + x1) / 2) - 3, FLOOR + 4, H }
    end
  end

  -------------------------------------------------------------------------------------------------
  -- architecture shared by the screens

  -- A hand at the end of a rib: a palm, four spread fingers of three joints curling in, a thumb.
  -- `dir` is +1 for hands that reach right and -1 for those that reach left.
  local function hand(g, x, y, ang, size, curl, mat, z, dir)
    local ca, sa = math.cos(ang), math.sin(ang)
    local pxc, pyc = x + ca * 2.4 * size, y + sa * 2.4 * size
    S.ellipsoid(g, pxc, pyc, 3.4 * size, 3.0 * size, mat, z, 0.95)
    local lens = { 4.4, 5.8, 5.4, 4.0 }
    for f = 1, 4 do
      local a = ang + dir * math.rad(-36 + (f - 1) * 24)
      local off = (f - 2.5) * 1.9 * size * dir
      local fx, fy = pxc + ca * 2.2 * size - sa * off, pyc + sa * 2.2 * size + ca * off
      for k = 1, 3 do
        local l = lens[f] * size * ({ 1, 0.8, 0.62 })[k]
        local nx, ny = fx + math.cos(a) * l, fy + math.sin(a) * l
        S.ball(g, fx, fy, 1.2 * size, mat, z + 1, 1)
        S.tube(g, S.bezier({ fx, fy }, { (fx + nx) / 2, (fy + ny) / 2 }, { nx, ny }), (1.1 - k * 0.1) * size, mat, z + 1, 1)
        fx, fy = nx, ny
        a = a + dir * curl * k
      end
      S.ball(g, fx, fy, 0.85 * size, mat, z + 2, 2) -- the nail
    end
    local a = ang - dir * 1.4
    local tx, ty = pxc + sa * dir * 2.6 * size, pyc - ca * dir * 2.6 * size
    for k = 1, 2 do
      local nx, ny = tx + math.cos(a) * 3.8 * size, ty + math.sin(a) * 3.8 * size
      S.ball(g, tx, ty, 1.15 * size, mat, z + 1, 1)
      S.tube(g, S.bezier({ tx, ty }, { (tx + nx) / 2, (ty + ny) / 2 }, { nx, ny }), 1.1 * size, mat, z + 1, 1)
      tx, ty = nx, ny
      a = a + dir * curl * 1.6
    end
  end

  -- One vertebra seen end-on, tumbling at angle a: body, the arch over the canal (left open), a
  -- spine on top and a wing each side.
  local function vertebra(g, x, y, s, a, z)
    local ca, sa = math.cos(a), math.sin(a)
    local function R(dx, dy) return x + (dx * ca - dy * sa) * s, y + (dx * sa + dy * ca) * s end
    local function bone(pts, r0, r1, dz)
      local q = {}
      for i, p in ipairs(pts) do q[i] = { R(p[1], p[2]) } end
      S.tube(g, S.spline(q), function(t) return (r0 + (r1 - r0) * t) * s end, "rib0", z + (dz or 0))
    end
    bone({ { -3.2, 1.6 }, { 0, 2.4 }, { 3.2, 1.6 } }, 2.4, 2.4, 1)
    bone({ { -2.6, 0.4 }, { -2.8, -2.4 }, { 0, -4.4 }, { 2.8, -2.4 }, { 2.6, 0.4 } }, 1.1, 1.1)
    bone({ { 0, -4.4 }, { 0.6, -7.2 }, { 1.6, -9.6 } }, 1.2, 0.5)
    bone({ { -2.6, -2.2 }, { -5.2, -3.0 }, { -7.6, -2.2 } }, 1.1, 0.6)
    bone({ { 2.6, -2.2 }, { 5.2, -3.0 }, { 7.6, -2.2 } }, 1.1, 0.6)
  end

  -- Ribs: each { p0, p1, p2, p3 (the wrist), handSize (0: tapers to a hook), curl, depth 0..3 },
  -- in screen coordinates. Returns their curves for membranes.
  local function ribs(g, list)
    local out = {}
    for _, d in ipairs(list) do
      local i = d[7]
      local curve = S.bezier(d[1], d[2], d[3], d[4])
      local z = 60 - i * 12
      local mat = "rib" .. i
      local r0 = 4.8 - i * 0.5
      local taper = (d[5] > 0) and (2.2 - i * 0.2) or r0 - 0.6
      S.tube(g, curve, function(t) return r0 - t * taper + math.max(0, 1.2 - t * 8) end, mat, z)
      for k = 1, 3 do -- knuckled joints: each rib is one enormous finger bone
        local t = 0.28 + k * 0.17
        local x, y = curve(t)
        S.ball(g, x, y, r0 - t * 2.0 + 0.6, mat, z + 0.5)
      end
      local ex, ey = curve(1)
      local qx, qy = curve(0.96)
      if d[5] > 0 then hand(g, ex, ey, math.atan(ey - qy, ex - qx), d[5], d[6], mat, z, (ex > qx) and 1 or -1) end
      out[#out + 1] = { curve = curve, z = z }
    end
    return out
  end

  -- Torn membrane between two ribs over t in [t0, t1]. Tag 10+ marks the ragged edges of tears.
  local function membrane(g, r1, r2, t0, t1, seed)
    local z = math.min(r1.z, r2.z) - 5
    local function at(t, s)
      local x1, y1 = r1.curve(t)
      local x2, y2 = r2.curve(t)
      return x1 + (x2 - x1) * s, y1 + (y2 - y1) * s + 4 * s * (1 - s) * 8
    end
    for ti = 0, 460 do
      local t = t0 + ti / 460 * (t1 - t0)
      for si = 0, 70 do
        local s = si / 70
        local x, y = at(t, s)
        local n = S.noise(x, y, seed, 10, nil, 2)
        local open = s > 0.1 and s < 0.9 and t > t0 + 0.06
        if not (open and n > 0.64) then S.flat(g, x, y, "mem", z, 0, -0.3, 0.95, (open and n > 0.58) and 10 + s or s) end
      end
    end
    return at
  end

  -- Shades everything built above into the scene buffer. `glass` lights membranes like stained glass.
  local RAMPS = {
    [0] = { sh[2], bn[1], bn[2], bn[3], bn[4] },
    [1] = { sh[2], sh[3], bn[1], bn[2], bn[3], bn[4] },
    [2] = { sh[1], sh[2], sh[3], bn[1], bn[2], bn[3] },
    [3] = { sh[1], sh[2], cr[2], bn[1], bn[2] },
  }
  local function shadeScene(g, b, light, glass)
    S.shade(g, b, function(px)
      if px.m == "mem" then
        local s = px.t
        if s >= 10 or px.edge then return (L.rnd(px.x, px.y, 109) > 0.35) and fl[3] or fl[2] end
        if glass then -- panes of colored skin with dark leading between them, lit from behind
          local function pane(x, y) return math.floor(S.noise(x, y, 160, 8, nil, 1) * 5) end
          local k = pane(px.x, px.y)
          if pane(px.x + 1, px.y) ~= k or pane(px.x, px.y + 1) ~= k then return sh[1] end
          local glassC = { sh[3], mg[1], fl[2], fl[3], mg[2] }
          return glassC[k + 1] or fl[2]
        end
        if s < 0.1 or s > 0.9 then return ((px.x + px.y) % 2 == 0) and fl[2] or fl[1] end
        if (px.x + px.y) % 2 == 0 then return (px.y < 44) and fl[2] or fl[1] end
        return nil
      end
      local i = tonumber(px.m:sub(4)) or 0
      local lam = S.lambert(px, KEY[1], KEY[2], KEY[3])
      local v = 0.1 + lam * 1.0 - smooth(96, 154, px.y) * 0.5
      local ex, ey = light.x - px.x, light.y - px.y -- magenta rim light from the eye or orifice
      local el = math.sqrt(ex * ex + ey * ey) + 0.001
      local rim = (px.nx * ex + px.ny * ey) / el * (1 - px.nz)
      if px.edge and lam < 0.6 then return (i >= 2) and P.void or sh[1] end
      if rim > 0.42 and px.y < 118 then return (rim > 0.6 and i < 3) and mg[3] or mg[2] end
      if px.t == 2 then return (v > 0.55) and fl[4] or fl[2] end -- nails
      return S.pick(RAMPS[i] or RAMPS[0], v, px.x, px.y, 0.45)
    end, 3)
  end

  -- Veins spreading across a membrane from its ribs.
  local function veins(b, g, at, t0, t1, seed)
    for k = 0, 5 do
      local t = t0 + 0.1 + L.rnd(seed, k, 110) * (t1 - t0 - 0.12)
      local dt = (L.rnd(seed, k, 111) - 0.5) * 0.004
      for si = 0, 100 do
        local x, y = at(t, si / 100)
        local i = S.index(g, x, y)
        if i and g.m[i] == "mem" and (g.t[i] or 0) < 10 then L.set(b, x, y, (si < 40) and mg[1] or cr[3]) end
        t = t + dt + (L.rnd(seed * 7 + k, si, 112) - 0.5) * 0.006
        if si % 30 == 29 then dt = -dt end
      end
    end
  end

  -- Nerves hanging from above; their ends drip onto `floorY`, and vessels pulse along them.
  local function nerves(b, anchors, list)
    for i, s in ipairs(list) do
      local x0, y0, len, floorY = s[1], s[2], s[3], s[4] or FLOOR
      for y = y0, y0 + len do
        local sx = x0 + math.floor(math.sin(y * 0.14 + i) * 1.5)
        if not L.get(b, sx, y) or y > y0 + 3 then
          L.set(b, sx, y, (y % 7 == 0) and mg[1] or cr[2])
          if y % 9 == 0 then L.set(b, sx + 1, y, cr[3]) end
        end
        if y % 13 == 0 then anchors.vessels[#anchors.vessels + 1] = { sx, y } end
        if y == y0 + len then
          L.set(b, sx, y + 1, fl[3])
          anchors.drips[#anchors.drips + 1] = { sx, y + 2, floorY }
        end
      end
    end
  end

  local function mirror(list) -- mirror rib definitions to the right side
    local out = {}
    for _, d in ipairs(list) do
      local function m(p) return { W - p[1], p[2] } end
      out[#out + 1] = { m(d[1]), m(d[2]), m(d[3]), m(d[4]), d[5], d[6], d[7] }
    end
    return out
  end
  local function concat(a, b2) local o = {} for _, v in ipairs(a) do o[#o + 1] = v end for _, v in ipairs(b2) do o[#o + 1] = v end return o end

  -------------------------------------------------------------------------------------------------
  -- screens

  local C_RIBS = {
    { { 9, 154 }, { -22, 56 }, { 8, -8 }, { 52, 4 }, 2.2, 0.2, 0 },
    { { 32, 154 }, { 4, 62 }, { 40, 2 }, { 80, 16 }, 1.9, 0.3, 1 },
    { { 55, 154 }, { 32, 76 }, { 60, 30 }, { 88, 50 }, 1.7, 0.26, 2 },
    { { 77, 154 }, { 64, 98 }, { 66, 62 }, { 78, 44 }, 0, 0, 3 },
  }

  -- C: four ribs a side curl overhead into hands that reach for the eye; torn membranes stretch
  -- between them; a spine floats apart toward the pupil.
  local function sceneC(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local left, right = ribs(g, C_RIBS), ribs(g, mirror(C_RIBS))
    local mems = {}
    for i = 1, 3 do
      mems[#mems + 1] = { membrane(g, left[i], left[i + 1], 0.36, 0.92, 100 + i), 100 + i }
      mems[#mems + 1] = { membrane(g, right[i], right[i + 1], 0.36, 0.92, 110 + i), 110 + i }
    end
    local spine = { { 52, 96, 1.5, 0.15 }, { 80, 89, 1.36, 0.8 }, { 106, 82, 1.2, 1.7 }, { 129, 76, 1.05, 2.8 },
      { 149, 71, 0.92, 3.9 }, { 166, 67, 0.78, 5.1 } }
    for k, v in ipairs(spine) do vertebra(g, v[1], v[2], v[3], v[4], 80 - k) end
    shadeScene(g, b, EYE_SCREEN)
    for _, m in ipairs(mems) do veins(b, g, m[1], 0.36, 0.92, m[2]) end
    for k = 1, #spine - 1 do -- sinew threads between the floating vertebrae
      local a, c = spine[k], spine[k + 1]
      for s = 0, 24 do
        local t = s / 24
        G.under(b, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t + math.sin(t * math.pi) * 3, (s % 5 == 0) and mg[1] or cr[3])
      end
    end
    nerves(b, anchors, { { 30, 58, 40 }, { 52, 64, 24 }, { 268, 54, 34 }, { 290, 60, 48 }, { 110, 40, 22 }, { 214, 42, 30 } })
    paintSolids(b, grid, 31)
    return b, anchors
  end

  -- B1: the tunnel is a mouth. The palate overhead has a row of upper teeth biting down to the
  -- tunnel's 30 px; hands on ribs from both sides grip its corners; the pit past the exit is a
  -- throat.
  local function sceneB1(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local list = {
      { { 8, 154 }, { -18, 60 }, { 6, 4 }, { 44, 12 }, 2.0, 0.28, 0 },
      { { 30, 154 }, { 14, 90 }, { 26, 52 }, { 50, 56 }, 1.6, 0.34, 1 },
      { { 306, 154 }, { 330, 70 }, { 300, 14 }, { 236, 22 }, 2.0, 0.3, 0 },
      { { 290, 154 }, { 300, 110 }, { 296, 84 }, { 240, 76 }, 1.5, 0.36, 2 },
    }
    local r = ribs(g, list)
    local m1 = membrane(g, r[1], r[2], 0.4, 0.95, 121)
    shadeScene(g, b, { x = 140, y = -40 })
    veins(b, g, m1, 0.4, 0.95, 121)
    nerves(b, anchors, { { 20, 40, 44 }, { 262, 30, 70, H }, { 272, 26, 58, H }, { 300, 40, 38 } })
    paintSolids(b, grid, 41)
    for y = 0, 111 do -- the palate: ridged toward the teeth, lips rolled at both ends of the tunnel
      for x = 60, 219 do
        local edge = math.min(x - 60, 219 - x)
        if edge <= 3 then
          b[y][x] = ({ fl[1], fl[3], fl[4], fl[2] })[edge + 1]
        elseif y >= 90 then -- three soft ridges across the roof of the mouth
          local wob = math.sin(x * 0.07 + y * 0.3) * 2 + math.sin(x * 0.19) * 1.2
          local ridge = (y + math.floor(wob)) - 90
          if ridge == 2 or ridge == 9 or ridge == 15 then b[y][x] = fl[3]
          elseif ridge == 3 or ridge == 10 or ridge == 16 then b[y][x] = fl[2]
          elseif ridge == 4 or ridge == 11 then b[y][x] = cr[1] end
        end
      end
    end
    for _, e in ipairs({ { 96, 34 }, { 150, 58 }, { 190, 24 } }) do -- the palate has eyes too
      for x = e[1] - 6, e[1] + 6 do
        local s2 = (x - e[1]) / 6.5
        local hgt = math.floor(2.4 * (1 - s2 * s2) + 0.3)
        for y = e[2] - hgt, e[2] + hgt do b[y][x] = (y == e[2] - hgt) and sh[1] or fl[4] end
        b[e[2] + hgt + 1][x] = fl[1]
      end
      L.fillRect(b, e[1] - 1, e[2] - 1, e[1] + 1, e[2] + 1, mg[2]); L.set(b, e[1], e[2], P.void); L.set(b, e[1], e[2] - 1, P.void)
    end
    for k = 0, 8 do -- saliva on the upper teeth, and a pulse along the palate's ridges
      local x = 64 + k * 19
      anchors.drips[#anchors.drips + 1] = { x + 3, 120, FLOOR }
      anchors.vessels[#anchors.vessels + 1] = { x + 9, 92 + (k % 3) * 7 }
    end
    pits(b, grid, anchors)
    return b, anchors
  end

  -- B2: a throat to leap, one great molar to stand on, and a pillar of stacked vertebrae to climb.
  local function sceneB2(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local list = {
      { { 8, 154 }, { -20, 58 }, { 8, 0 }, { 56, 8 }, 2.2, 0.24, 0 },
      { { 34, 154 }, { 14, 80 }, { 36, 34 }, { 66, 38 }, 1.6, 0.34, 2 },
      { { 314, 154 }, { 336, 60 }, { 304, 2 }, { 256, 10 }, 2.2, 0.24, 0 },
    }
    local r = ribs(g, list)
    local m1 = membrane(g, r[1], r[2], 0.4, 0.95, 131)
    vertebra(g, 128, 64, 1.3, 0.6, 70)
    vertebra(g, 214, 52, 1.1, 2.2, 70)
    shadeScene(g, b, { x = 240, y = 48 })
    veins(b, g, m1, 0.4, 0.95, 131)
    nerves(b, anchors, { { 82, 30, 60, H }, { 96, 22, 44, H }, { 232, 30, 30 } })
    paintSolids(b, grid, 51)
    -- the molar: a crown with cusps along the top, a groove, the gum where it meets the jaw
    for y = 130, 149 do
      for x = 150, 209 do
        local u = (x - 150) / 59
        local cusp = math.abs(math.sin(u * math.pi * 3)) -- three cusps
        local lit = 0.85 - u * 0.5 - (y - 130) * 0.03 + cusp * 0.12
        local c = S.pick({ bn[1], bn[2], bn[3], bn[4] }, lit, x, y, 0.5)
        if y == 130 then c = (cusp > 0.3) and bn[4] or bn[3] end
        if y == 131 and cusp < 0.15 then c = bn[1] end
        if (x == 170 or x == 190) and y > 131 and y < 141 then c = bn[1] end -- grooves between cusps
        if x == 150 or x == 209 then c = bn[1] end
        if y >= 146 then c = (y == 146) and fl[4] or fl[3] end
        b[y][x] = c
      end
    end
    -- the pillar: vertebral bodies stacked on discs of wet cartilage, a flat cap to stand on
    for y = 110, 149 do
      for x = 250, 269 do
        local band = (y - 110) % 10
        local u = (x - 250) / 19
        local c
        if band >= 8 then c = (band == 8) and fl[3] or fl[2]
        else c = S.pick({ bn[1], bn[2], bn[3], bn[4] }, 0.95 - u * 0.75 - band * 0.03, x, y, 0.5) end
        if y == 110 then c = bn[4] end
        if x == 250 or x == 269 then c = (band >= 8) and fl[1] or bn[1] end
        b[y][x] = c
      end
      if (y - 110) % 10 == 9 then anchors.vessels[#anchors.vessels + 1] = { 252, y } end
    end
    pits(b, grid, anchors)
    return b, anchors
  end

  -- V: the vault. Ribs from both sides meet overhead in clasped hands; the membranes between them glow
  -- like stained glass; in the floor, lips pressed shut where the Maw will burst out.
  local function sceneV(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local list = {
      { { 8, 154 }, { -26, 40 }, { 60, -18 }, { 146, 14 }, 2.0, 0.34, 0 },
      { { 34, 154 }, { 4, 56 }, { 70, 0 }, { 136, 26 }, 1.7, 0.4, 1 },
      { { 60, 154 }, { 36, 78 }, { 82, 22 }, { 126, 38 }, 1.4, 0.46, 2 },
      { { 84, 154 }, { 70, 100 }, { 92, 50 }, { 118, 52 }, 0, 0, 3 },
    }
    local left, right = ribs(g, list), ribs(g, mirror(list))
    local mems = {}
    for i = 1, 3 do
      mems[#mems + 1] = { membrane(g, left[i], left[i + 1], 0.34, 0.9, 140 + i), 140 + i }
      mems[#mems + 1] = { membrane(g, right[i], right[i + 1], 0.34, 0.9, 150 + i), 150 + i }
    end
    shadeScene(g, b, { x = 160, y = 48 }, true)
    for _, m in ipairs(mems) do veins(b, g, m[1], 0.34, 0.9, m[2]) end
    nerves(b, anchors, { { 150, 30, 26 }, { 170, 34, 20 }, { 40, 60, 30 }, { 280, 60, 30 } })
    paintSolids(b, grid, 61)
    -- the lips: swollen, pressed shut along a dark seam, creased outward
    for x = 112, 208 do
      local d = (x - 160) / 48
      local hgt = math.floor((1 - d * d) * 6 + 0.5)
      for y = FLOOR, FLOOR + 2 * hgt + 1 do
        local k = y - FLOOR
        local c = (k == hgt) and P.void or ((k < hgt) and ((k == 0) and fl[4] or fl[3]) or ((k == hgt + 1) and cr[2] or fl[2]))
        if k == 0 and hgt == 0 then c = fl[3] end
        b[y][x] = c
      end
      if x % 6 == 0 then
        for k = 0, 6 do L.set(b, x + k * ((x < 160) and -1 or 1) * 0.6, FLOOR + 2 * hgt + 2 + k, cr[2]) end
      end
      if x % 8 == 0 then anchors.vessels[#anchors.vessels + 1] = { x, FLOOR + hgt + 1 } end
    end
    return b, anchors
  end

  -------------------------------------------------------------------------------------------------

  return {
    far = far,
    fog = fog,
    scenes = { C = sceneC, B1 = sceneB1, B2 = sceneB2, V = sceneV },
    colors = {
      vessel = { cr[3], mg[3] }, drip = mg[2], spore = fl[5], sporeAlpha = 0.35,
      hud = { text = bn[3], dim = bn[2], mark = sh[3], markEnd = cr[3], markHere = bn[4] },
      clear = P.void,
    },
    -- the Maw in this world: flesh-pink worm, ivory teeth, a wet magenta gullet
    maw = {
      skin = { P.void, sh[2], cr[2], fl[1], fl[2], fl[3], fl[4] }, ring = { cr[2], cr[3], fl[2] },
      teeth = { bn[1], bn[2], bn[3], bn[4] }, gullet = { P.void, cr[1], mg[1] }, rim = mg[3],
      lip = { fl[3], fl[4] }, outline = P.void, crust = { bn[3], bn[4], fl[3] },
    },
  }
end
