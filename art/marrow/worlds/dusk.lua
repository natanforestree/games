-- World "dusk" (ladder rung 1, the Waiter): the chamber has broken open onto an evening that shouldn't
-- exist. Loaded by scenes.lua (and maw.lua for `maw`) as
--   dofile("worlds/dusk.lua")({ L = lib, S = sculpt, G = common, P = this world's palette })
-- and returns { far, fog, scenes = { C, B1, B2, V }, colors, maw }.
--   far    a violet-to-oxblood sky in stratified bands; a pale sun with a foetus curled inside, its
--          cord sagging to a colossal skull sunk in the horizon (above C); cathedrals built of bodies
--          on the skyline above each V; towers of bodies with raised arms; tiny processions; crosses
--   fog    cold grey-blue haze lying along the horizon
--   scenes the chamber's snapped ribs and broken vault, backlit, with shrouded bodies hanging on
--          ropes; every floor is a causeway of fused skulls and bones with a pale crust; pits are gaps
--          in it with the dusk going on below; B1's tunnel runs under an ossuary slab; B2's ledge is a
--          bone altar and its pillar a stack of skulls; V is a gate of stacked vertebrae over a sealed
--          ring of teeth
-- The sun sits at far column 400, the centre of the map, so each screen's rim light comes from where
-- the sun appears on it, and the mirrored "-" screens stay consistent.
return function(env)
  local L, S, G, P = env.L, env.S, env.G, env.P
  local W, H, FW, FLOOR = G.W, G.H, G.FAR_W, G.FLOOR
  local ink, vi, bl, bu, ro, bn, co = P.ink, P.violet, P.blood, P.burnt, P.rose, P.bone, P.cold
  local smooth = G.smooth
  local SUN_U, SUN_Y, SUN_R = 400, 54, 20
  local HORIZON = 133
  local SKULL_U, SKULL_Y = 494, 112
  local CATHEDRALS = { 160, 640 } -- above V- and V+

  local SKY = { ink[2], vi[1], bl[1], bl[2], vi[2], bl[3], vi[3], ro[1], bu[1], vi[4], bu[2], ro[2], ro[3], ro[4] }
  local LIGHTER, DARKER = {}, {}
  for i = 1, #SKY - 1 do LIGHTER[SKY[i]] = SKY[i + 1]; DARKER[SKY[i + 1]] = SKY[i] end
  LIGHTER[co[1]] = co[2]; DARKER[co[2]] = co[1]; DARKER[co[1]] = vi[3]

  -- where the sun shows on each screen (screen coordinates), for rim light
  local function sunOn(base) return { x = SUN_U - G.farLeft(base), y = SUN_Y } end

  local function rimFrom(light)
    return function(px)
      local dx, dy = light.x - px.x, light.y - px.y
      local d = math.sqrt(dx * dx + dy * dy) + 0.001
      return (px.nx * dx / d + px.ny * dy / d) * (1 - px.nz * 0.7)
    end
  end

  -------------------------------------------------------------------------------------------------
  -- far

  -- A tower built of bodies: a leaning trunk with torsos fused into it on alternating sides, each with
  -- a head and an arm reaching up the tower, and a crown of raised arms.
  local function tower(g, cx, top, w, seed, mat, z)
    local base = HORIZON + 6
    local lean = (L.rnd(seed, 1, 201) - 0.5) * 10
    local function trunkX(y) return cx + lean * (base - y) / (base - top) + math.sin(y * 0.12 + seed) * 1.0 end
    local function width(y) return w * (1 - (base - y) / (base - top) * 0.6) end
    S.tube(g, function(t) local y = base - t * (base - top); return trunkX(y), y end, function(t) return w * (1 - t * 0.6) end, mat, z)
    local y, k = base - 6, 0
    while y > top + 8 do
      k = k + 1
      local sd = (k % 2 == 0) and -1 or 1
      local tw = width(y)
      local x = trunkX(y) + sd * tw * 0.7
      S.ellipsoid(g, x, y, tw * 0.75 + 1.2, 5.2, mat, z + 1)
      local hx, hy = x + sd * (tw * 0.5 + 1.6), y - 5.8
      S.ball(g, hx, hy, 2.4, mat, z + 2)
      S.tube(g, S.bezier({ x + sd * 1.5, y - 2 }, { hx + sd * 3.5, y - 3 }, { hx + sd * 2.5, hy - 7 }), 1.15, mat, z + 2)
      S.tube(g, S.bezier({ x, y + 3 }, { x + sd * 3, y + 7 }, { x + sd * 1.5, y + 10 }), 1.3, mat, z + 1)
      y = y - 9 - L.rnd(seed, k, 206) * 5
    end
    for a = -2, 2 do
      local ax = trunkX(top + 2) + a * 1.4
      S.tube(g, S.bezier({ ax, top + 4 }, { ax + a * 2.2, top - 3 }, { ax + a * 3.4, top - 8 - (2 - math.abs(a)) * 2.5 }), 1.05, mat, z + 2)
    end
  end

  -- A cathedral of bodies: a great central spire with two lesser ones, joined by arches of limbs,
  -- with lancet windows letting the sky through.
  local function cathedral(g, cx, seed)
    tower(g, cx, 12, 11, seed, "near", 30)
    tower(g, cx - 26, 44, 7, seed + 1, "near", 28)
    tower(g, cx + 26, 40, 7, seed + 2, "near", 28)
    for s = -1, 1, 2 do
      S.tube(g, S.bezier({ cx + s * 26, 104 }, { cx + s * 13, 84 }, { cx, 100 }), 3, "near", 29)
      S.tube(g, S.bezier({ cx + s * 26, 126 }, { cx + s * 14, 108 }, { cx, 124 }), 3.4, "near", 29)
    end
    S.ellipsoid(g, cx, 124, 30, 14, "near", 26) -- the nave, swelling out of the ground
  end

  local function far()
    local b = L.buffer(FW, H)
    S.gradient(b, { { 0, ink[2] }, { 16, vi[1] }, { 34, bl[1] }, { 52, bl[2] }, { 68, bl[3] }, { 84, bu[1] },
      { 98, bu[2] }, { 110, ro[1] }, { 122, vi[4] }, { HORIZON, vi[3] }, { 150, vi[2] }, { 179, vi[1] } }, nil, nil, 0.45)

    -- long flat clouds, dark against the glow, their undersides lit
    for i = 0, 21 do
      local y0 = 12 + math.floor(L.rnd(i, 1, 209) * 96)
      local x0 = math.floor(L.rnd(i, 2, 209) * FW)
      local len = 70 + math.floor(L.rnd(i, 3, 209) * 110)
      local th = 1 + math.floor(L.rnd(i, 4, 209) * 3)
      for dx = 0, len do
        local x = (x0 + dx) % FW
        local thick = math.floor(th * math.sin(math.pi * dx / len) + 0.5 + math.sin(dx * 0.3 + i) * 0.6)
        local y = y0 + math.floor(math.sin(dx * 0.035 + i) * 2.5)
        for k = 0, thick - 1 do G.step(b, x, y + k, DARKER) end
        if thick > 0 and L.bayer(x, y) < 0.6 then G.step(b, x, y + thick, LIGHTER) end
      end
    end

    -- the sun: a halo, a pale disc darkening at its limb, and a foetus curled inside
    for y = SUN_Y - 48, SUN_Y + 48 do
      for x = SUN_U - 60, SUN_U + 60 do
        local dx, dy = x + 0.5 - SUN_U, (y + 0.5 - SUN_Y) * 1.08
        local d = math.sqrt(dx * dx + dy * dy)
        if d > SUN_R + 1.5 and d < SUN_R + 44 then
          local k = (1 - (d - SUN_R) / 44) ^ 2
          if math.abs(d - SUN_R - 9) < 0.8 then k = k + 0.25 end
          if k > L.bayer(x, y) then G.step(b, x, y, LIGHTER, true) end
        elseif d <= SUN_R + 1.5 then
          b[y][x % FW] = (d > SUN_R + 0.5) and bu[2] or S.pick({ ro[2], ro[3], ro[4], ro[4] }, 1.1 - (d / SUN_R) ^ 3, x, y, 0.4)
        end
      end
    end
    do
      local g = S.new(FW, H, true)
      local X, Y = SUN_U, SUN_Y
      S.ball(g, X + 4, Y - 6, 7.5, "f", 5)
      S.tube(g, S.spline({ { X + 2, Y - 1 }, { X - 7, Y + 1 }, { X - 9, Y + 8 }, { X - 4, Y + 13 } }), function(t) return 5.2 - t * 1.4 end, "f", 4)
      S.tube(g, S.spline({ { X - 5, Y + 12 }, { X + 3, Y + 11 }, { X + 7, Y + 5 } }), 2.4, "f", 6)
      S.tube(g, S.spline({ { X + 7, Y + 5 }, { X + 5, Y + 12 }, { X + 9, Y + 14 } }), 1.8, "f", 7)
      S.tube(g, S.spline({ { X + 1, Y }, { X + 5, Y + 2 }, { X + 7, Y - 1 } }), 1.4, "f", 8)
      S.shade(g, b, function(px)
        if px.edge then return bl[3] end
        return S.pick({ bu[1], ro[1], ro[2] }, 0.35 - px.nx * 0.25 - px.ny * 0.1 + (1 - px.nz) * 0.2, px.x, px.y, 0.5)
      end, 2)
      L.set(b, X + 7, Y - 5, bl[3]); L.set(b, X + 8, Y - 5, bl[3]) -- the closed eye
    end

    -- the skyline: the colossal skull, towers of bodies, two cathedrals of bodies
    local g = S.new(FW, H, true)
    S.ellipsoid(g, SKULL_U, SKULL_Y - 4, 42, 34, "skull", 20, nil, 30)
    S.ellipsoid(g, SKULL_U, SKULL_Y + 14, 30, 12, "skull", 22)
    S.ellipsoid(g, SKULL_U - 31, SKULL_Y + 8, 11, 8, "skull", 26)
    S.ellipsoid(g, SKULL_U + 31, SKULL_Y + 8, 11, 8, "skull", 26)
    local towers = { { 264, 36, 7 }, { 304, 80, 4.5 }, { 344, 26, 6.5 }, { 446, 56, 5.5 }, { 378, 96, 3.5 }, { 548, 66, 4.5 },
      { 30, 60, 5 }, { 92, 84, 3.5 }, { 222, 70, 4 }, { 588, 40, 6 }, { 700, 62, 5 }, { 760, 86, 3.5 } }
    for i, t in ipairs(towers) do tower(g, t[1], t[2], t[3], i, "tower", 40) end
    for i, c in ipairs(CATHEDRALS) do cathedral(g, c, 20 + i * 3) end
    S.shade(g, b, function(px)
      local dx = (px.x - SUN_U + FW / 2) % FW - FW / 2
      local r = rimFrom({ x = px.x - dx, y = SUN_Y })(px)
      if px.m == "skull" then
        local v = 0.45 - px.ny * 0.35 + r * 0.35 - smooth(100, HORIZON, px.y) * 0.2
        if r > 0.55 and px.edge then return ro[1] end
        return S.pick({ vi[2], vi[3], vi[4] }, v, px.x, px.y, 0.5)
      end
      if px.m == "near" then -- nearer and bigger: darker, with a burning rim
        if r > 0.55 then return (px.y < 90) and ro[2] or bu[1] end
        if px.edge and r < 0.2 then return ink[2] end
        return (L.bayer(px.x, px.y) < 0.35) and vi[2] or ink[3]
      end
      if r > 0.5 then return vi[4] end
      return (px.y < 95 or L.bayer(px.x, px.y) < 0.5) and vi[2] or vi[3]
    end, 4)
    for y = SKULL_Y - 16, SKULL_Y + 24 do -- the skull's sockets, nose and teeth: deeper haze
      for x = SKULL_U - 40, SKULL_U + 40 do
        local function socket(cx, cy, rx, ry) return ((x + 0.5 - cx) / rx) ^ 2 + ((y + 0.5 - cy) / ry) ^ 2 end
        local s1, s2 = socket(SKULL_U - 16, SKULL_Y - 4, 11, 9), socket(SKULL_U + 16, SKULL_Y - 4, 11, 9)
        local nose = y > SKULL_Y + 5 and y < SKULL_Y + 15 and math.abs(x + 0.5 - SKULL_U) < (y - SKULL_Y - 5) * 0.4 + 0.5
        local teeth = y >= SKULL_Y + 20 and y <= SKULL_Y + 24 and math.abs(x - SKULL_U) < 22
        if s1 < 1 or s2 < 1 or nose then
          S.wset(b, x, y, (math.min(s1, s2) < 0.55 or nose) and vi[1] or vi[2])
        elseif teeth then
          S.wset(b, x, y, ((x - SKULL_U) % 5 == 0 or y == SKULL_Y + 24) and vi[1] or ((y == SKULL_Y + 20) and vi[4] or vi[3]))
        end
      end
    end
    for k = 0, 16 do S.wset(b, SKULL_U + 6 + math.floor(math.sin(k * 0.9) * 2 + k * 0.3), SKULL_Y - 37 + k, vi[1]) end
    for _, c in ipairs(CATHEDRALS) do -- lancet windows in the cathedrals, the sky showing through
      for w = -1, 1 do
        local wx, wy = c + w * 13, 108
        for y = wy - 9, wy + 6 do
          local half = (y < wy - 3) and math.max(0, (y - (wy - 9)) * 0.45) or 2.5
          for x = math.floor(wx - half), math.ceil(wx + half) do S.wset(b, x, y, (y > wy + 3) and bu[1] or ro[2]) end
        end
      end
    end

    -- the plain below the horizon, fading into haze at the skyline
    for y = HORIZON, H - 1 do
      for x = 0, FW - 1 do
        local c = b[y][x]
        if c == vi[3] or c == vi[2] or c == vi[1] then
          local t = (y - HORIZON) / 20
          b[y][x] = (t > L.bayer(x, y) + 0.3) and vi[1] or ((t > L.bayer(x, y)) and vi[2] or vi[3])
        end
      end
    end
    for x = 0, FW - 1 do if b[HORIZON][x] == vi[2] or b[HORIZON][x] == vi[3] then b[HORIZON][x] = vi[4] end end

    -- the cord: from the sun's belly, sagging across the sky to the skull's crown
    local cord = S.spline({ { SUN_U - 2, SUN_Y + 16 }, { SUN_U + 16, SUN_Y + 40 }, { SUN_U + 48, SUN_Y + 44 },
      { SKULL_U - 26, SKULL_Y - 34 }, { SKULL_U - 8, SKULL_Y - 37 } })
    for i = 0, 400 do
      local x, y = cord(i / 400)
      S.wset(b, x, y, (i < 30) and bu[1] or ink[3])
      if i % 23 == 0 then S.wset(b, x + 1, y, (i < 30) and bu[1] or ink[3]) end
    end
    -- processions of tiny figures along the skyline, walking toward the skull and the cathedrals
    for _, run in ipairs({ { 390, 18 }, { 96, 12 }, { 690, 12 } }) do
      for i = 0, run[2] - 1 do
        local x = run[1] + i * 4 + math.floor(L.rnd(i, run[1], 207) * 2)
        local h = 3 + math.floor(L.rnd(i, 2, 207) * 2)
        for k = 0, h - 1 do S.wset(b, x, HORIZON - k, ink[3]) end
        if i % 5 == 2 then S.wset(b, x + 1, HORIZON - h + 1, ink[3]); S.wset(b, x - 1, HORIZON - h + 1, ink[3]) end
      end
    end
    for i, x in ipairs({ 260, 288, 324, 358, 540, 20, 120, 200, 600, 720, 780 }) do -- crosses on the plain
      local hgt = 5 + (i % 3) * 2
      for k = 0, hgt do S.wset(b, x, HORIZON - k + 2, ink[3]) end
      S.wset(b, x - 1, HORIZON - hgt + 4, ink[3]); S.wset(b, x + 1, HORIZON - hgt + 4, ink[3])
    end
    return b
  end

  -------------------------------------------------------------------------------------------------
  -- fog: cold haze lying in bands along the horizon. Seamless.

  local function fog()
    local b = L.buffer(G.FOG_W, H)
    local k = 2 * math.pi / G.FOG_W
    for y = 96, H - 1 do
      for x = 0, G.FOG_W - 1 do
        local band = math.sin(y * 0.35 + math.sin(x * k * 2 + y * 0.05) * 2.2) * 0.5 + 0.5
        local a = math.max(0, 1 - math.abs(y - HORIZON) / 36) * (0.35 + band * 0.45)
        if a > L.bayer(x, y) * 0.8 + 0.2 then b[y][x] = (a > 0.6) and (co[2] .. "58") or (co[1] .. "48") end
      end
    end
    return b
  end

  -------------------------------------------------------------------------------------------------
  -- solids: a crust of bone along every top, lit pale by the sky, over a packed mass of skulls and
  -- long bones; undersides and walls catch a thin rim of rose light.

  local function boneMass(seed)
    local b = L.buffer(W, H)
    S.gradient(b, { { 0, ink[1] }, { H - 1, P.void } })
    local g = S.new(W, H, false)
    local skulls = {}
    for row = 0, 9 do
      local y = row * 18 + 6
      for k = 0, 16 do
        local x = k * 22 + (row % 2) * 11 + (L.rnd(k, row, seed) - 0.5) * 8
        local r = L.rnd(k, row, seed + 1)
        if r < 0.45 then
          S.ellipsoid(g, x, y, 7, 6, "skull", 10, k)
          S.ellipsoid(g, x, y + 6, 4.5, 3, "skull", 9, k)
          skulls[#skulls + 1] = { x, y }
        else
          local len = 10 + r * 10
          local a = (L.rnd(k, row, seed + 2) - 0.5) * 0.8
          local x1, y1 = x - math.cos(a) * len, y - math.sin(a) * len
          local x2, y2 = x + math.cos(a) * len, y + math.sin(a) * len
          S.tube(g, S.bezier({ x1, y1 }, { x, y + 1 }, { x2, y2 }), 2.2, "bone", 8)
          S.ball(g, x1, y1, 3.2, "bone", 8.5); S.ball(g, x2, y2, 3.2, "bone", 8.5)
        end
      end
    end
    S.shade(g, b, function(px)
      if px.edge then return ink[1] end
      return S.pick({ ink[2], ink[3], bn[1], bn[2] }, 0.2 + math.max(0, -px.ny) * 0.8 + (L.rnd(px.x, px.y, seed + 3) - 0.5) * 0.15, px.x, px.y, 0.5)
    end, 2)
    for _, s in ipairs(skulls) do
      local x, y = s[1], s[2]
      L.fillRect(b, x - 4, y, x - 2, y + 1, P.void); L.fillRect(b, x + 1, y, x + 3, y + 1, P.void)
      L.set(b, x, y + 3, P.void)
    end
    return b
  end

  local function paintSolids(b, grid, seed)
    local mass = boneMass(seed)
    local probe = G.probe(grid, 8)
    for y = 0, H - 1 do
      for x = 0, W - 1 do
        local up, down, side = probe(x, y)
        if up then
          local n = L.rnd(x, y, seed)
          local c
          if up == 0 then c = (n > 0.25) and ro[3] or bn[4]
          elseif up == 1 then c = (n > 0.4) and bn[4] or bn[3]
          elseif up == 2 then c = (n > 0.5) and bn[3] or bn[2]
          elseif up == 3 then c = bn[1]
          elseif down == 0 then c = ro[1]
          elseif down == 1 then c = bn[1]
          elseif side == 1 then c = ro[1]
          elseif side == 2 then c = ink[3]
          else c = mass[y][x] end
          if up <= 2 and (x % 23 == 0 or (x % 23 == 1 and up > 0)) then c = ink[3] end
          b[y][x] = c
        end
      end
    end
  end

  -- The dark below a pit: the dusk goes on underneath the causeway, haze thinning to black, and far
  -- below, something small falling.
  local function pits(b, grid, anchors)
    for pi, p in ipairs(G.pits(grid)) do
      local x0, x1 = p[1], p[2]
      for y = FLOOR, H - 1 do
        for x = x0, x1 do
          if not G.solid(grid, x, y) then
            local t = (y - FLOOR) / (H - FLOOR)
            local c = S.pick({ P.void, ink[1], vi[1], vi[2], co[1] }, 0.85 - t * 1.1, x, y, 0.4)
            if (y - FLOOR) % 9 == 4 and L.bayer(x, y) < 0.5 and t < 0.6 then c = co[1] end
            b[y][x] = c
          end
        end
      end
      local fx, fy = math.floor((x0 + x1) / 2) + 3, FLOOR + 17 -- a tiny falling figure
      for k = 0, 2 do L.set(b, fx, fy + k, ink[3]) end
      L.set(b, fx - 1, fy, ink[3]); L.set(b, fx + 1, fy - 1, ink[3])
      anchors.drips[#anchors.drips + 1] = { x0 + 3, FLOOR + 1, H }
    end
  end

  -------------------------------------------------------------------------------------------------
  -- architecture shared by the screens

  -- Snapped ribs: each { p0, p1, p2, p3, r0, r1 }; splinters at the broken end.
  local function brokenRibs(g, list, z0)
    for i, r in ipairs(list) do
      local curve = S.bezier(r[1], r[2], r[3], r[4])
      S.tube(g, curve, function(t) return r[5] + (r[6] - r[5]) * t end, "rib", (z0 or 30) - i)
      local ex, ey = curve(1)
      local qx, qy = curve(0.95)
      local a = math.atan(ey - qy, ex - qx)
      for s = -1, 1 do
        local l = 4 + (s + 1) * 2
        S.tube(g, S.bezier({ ex, ey }, { ex + math.cos(a + s * 0.3) * l * 0.5, ey + math.sin(a + s * 0.3) * l * 0.5 },
          { ex + math.cos(a + s * 0.35) * l, ey + math.sin(a + s * 0.35) * l }), function(t) return r[6] * 0.45 * (1 - t) + 0.3 end, "rib", (z0 or 30) - i)
      end
    end
  end

  -- A broken arch of the vault, ridged like a spine, along a curve.
  local function vault(g, curve, r0, r1, broken)
    S.tube(g, curve, function(t) return r0 + (r1 - r0) * t end, "vert", 20)
    for i = 0, 13 do
      local t = i / 13
      local x, y = curve(t)
      S.ball(g, x, y - 1, r0 + (r1 - r0) * t + 0.4, "vert", 20.5)
      S.tube(g, S.bezier({ x, y - 4 }, { x + 1, y - 8 }, { x + 2, y - 12 }), function(tt) return 1.8 * (1 - tt) + 0.4 end, "vert", 19)
    end
    if broken then
      local ex, ey = curve(1)
      local qx = curve(0.95)
      local d = (ex > qx) and 1 or -1
      for s = -1, 1 do
        S.tube(g, S.bezier({ ex, ey }, { ex + d * 3, ey + s * 2 }, { ex + d * 6, ey + s * 3.5 }), function(t) return 1.6 * (1 - t) + 0.3 end, "vert", 20)
      end
    end
  end

  -- Shrouded bodies hanging on ropes: { x, ropeTop, length }. Their feet drip; their chests pulse.
  local function shrouds(b, g, anchors, list)
    for i, h in ipairs(list) do
      local x, y0, len = h[1], h[2], h[3]
      local sway = (L.rnd(i, x, 208) - 0.5) * 3
      local bx, by = x + sway, y0 + len
      for y = y0, by - 10 do G.under(b, x + math.floor(sway * (y - y0) / len + 0.5), y, ink[2]) end
      local hgt = 11 + L.rnd(i, x, 209) * 6
      S.ellipsoid(g, bx, by, 3.6, hgt * 0.55, "shroud", 40, i)
      S.ellipsoid(g, bx, by - hgt * 0.5, 2.8, 3.2, "shroud", 41, i)
      S.ellipsoid(g, bx + 0.3, by + hgt * 0.45, 2.4, 3.2, "shroud", 41, i)
      anchors.drips[#anchors.drips + 1] = { math.floor(bx), math.floor(by + hgt * 0.45 + 4), h[4] or FLOOR }
      anchors.vessels[#anchors.vessels + 1] = { math.floor(bx), math.floor(by - 2) }
    end
  end

  local function shadeScene(g, b, light)
    local rim = rimFrom(light)
    S.shade(g, b, function(px)
      local r = rim(px)
      if px.m == "shroud" then
        local band = ((px.y + px.x * 0.6 + (px.t or 0) * 3) % 5) < 1
        if r > 0.45 then return (r > 0.7) and ro[3] or ro[2] end
        if px.edge or band then return ink[1] end
        return (px.nx < -0.2) and ink[3] or ink[2]
      end
      if px.edge and r < 0.4 then return P.void end
      if r > 0.62 then return ro[3] end
      if r > 0.4 then return (px.y > 100) and bu[1] or ro[2] end
      if r > 0.2 then return bn[1] end
      return (L.bayer(px.x, px.y) < 0.5 + px.ny * 0.3) and ink[2] or ink[1]
    end, 3)
  end

  -- A skull in relief, cut into a solid face (x, y = its centre), lit from above.
  local function reliefSkull(b, x, y, s)
    for yy = math.floor(y - 6 * s), math.ceil(y + 7 * s) do
      for xx = math.floor(x - 6 * s), math.ceil(x + 6 * s) do
        local u, v = (xx + 0.5 - x) / (6 * s), (yy + 0.5 - y) / (5.5 * s)
        local jaw = (yy > y + 3 * s) and math.abs(xx + 0.5 - x) < 3.6 * s and yy < y + 7 * s
        if u * u + v * v <= 1 or jaw then
          local c = (v < -0.3) and bn[3] or ((v < 0.4) and bn[2] or bn[1])
          if u * u + v * v > 0.8 and v > 0 then c = ink[3] end
          b[yy][xx] = c
        end
      end
    end
    L.fillRect(b, x - 3 * s, y, x - 1 * s, y + 1 * s, P.void); L.fillRect(b, x + 1 * s, y, x + 3 * s, y + 1 * s, P.void)
    L.set(b, x, y + 3 * s, P.void)
  end

  -------------------------------------------------------------------------------------------------
  -- screens

  -- C: the chamber broken open: snapped ribs, a sagging broken vault, shrouded bodies hanging.
  local function sceneC(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    brokenRibs(g, {
      { { 3, 154 }, { -16, 70 }, { 8, 8 }, { 44, -2 }, 7.0, 4.0 },
      { { 30, 154 }, { 14, 98 }, { 22, 62 }, { 38, 50 }, 5.0, 3.6 },
      { { 318, 154 }, { 338, 64 }, { 304, 4 }, { 266, -6 }, 7.0, 4.0 },
      { { 293, 154 }, { 312, 112 }, { 304, 80 }, { 288, 70 }, 5.0, 3.6 },
    })
    vault(g, S.bezier({ -8, 2 }, { 50, 22 }, { 106, 12 }), 6, 3.4, true)
    vault(g, S.bezier({ 328, 0 }, { 270, 20 }, { 216, 10 }), 6, 3.4, true)
    shrouds(b, g, anchors, { { 22, 11, 44 }, { 46, 15, 30 }, { 74, 17, 52 }, { 98, 15, 22 }, { 226, 14, 26 }, { 250, 16, 48 }, { 276, 15, 34 }, { 300, 10, 58 } })
    shadeScene(g, b, sunOn("C"))
    paintSolids(b, grid, 61)
    return b, anchors
  end

  -- B1: the tunnel runs under an ossuary slab, its underside a row of skulls hanging upside down;
  -- past the exit, a gap in the causeway with the dusk below and shrouds hanging over it.
  local function sceneB1(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    brokenRibs(g, {
      { { 4, 154 }, { -12, 80 }, { 10, 30 }, { 40, 22 }, 6.0, 3.6 },
      { { 314, 154 }, { 336, 70 }, { 306, 10 }, { 262, 2 }, 6.5, 3.8 },
    })
    vault(g, S.bezier({ 330, 20 }, { 290, 34 }, { 230, 26 }), 5, 3.2, true)
    shrouds(b, g, anchors, { { 26, 22, 40 }, { 244, 30, 40, H }, { 262, 28, 58, H }, { 284, 30, 44, H }, { 302, 24, 30 } })
    shadeScene(g, b, sunOn("B1"))
    paintSolids(b, grid, 71)
    for k = 0, 7 do -- the slab's underside: skulls hanging upside down along it
      local x = 70 + k * 20
      for yy = 108, 119 do
        for xx = x - 6, x + 6 do
          local u, v = (xx + 0.5 - x) / 6.4, (yy + 0.5 - 113) / 6
          if u * u + v * v <= 1 then b[yy][xx] = (v > 0.4) and ro[2] or ((v > -0.2) and bn[2] or bn[1]) end
        end
      end
      L.fillRect(b, x - 3, 112, x - 1, 113, P.void); L.fillRect(b, x + 1, 112, x + 3, 113, P.void); L.set(b, x, 110, P.void)
      L.fillRect(b, x - 3, 108, x + 3, 108, ink[3])
      anchors.drips[#anchors.drips + 1] = { x, 120, FLOOR }
    end
    for y = 0, 119 do -- rose light catching the slab's ends
      b[y][60] = ro[1]; b[y][219] = ro[2]
    end
    pits(b, grid, anchors)
    return b, anchors
  end

  -- B2: a gap in the causeway, a bone altar to stand on, and a pillar of stacked skulls to climb,
  -- under a broken arch.
  local function sceneB2(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    brokenRibs(g, {
      { { 4, 154 }, { -14, 60 }, { 12, 4 }, { 52, -2 }, 7.0, 4.0 },
      { { 316, 154 }, { 334, 90 }, { 318, 50 }, { 302, 40 }, 5.5, 3.6 },
    })
    vault(g, S.bezier({ 120, 154 }, { 150, 30 }, { 236, 24 }), 4.6, 3.0, true) -- a broken arch behind the altar
    shrouds(b, g, anchors, { { 30, 8, 36 }, { 84, 20, 44, H }, { 96, 16, 60, H }, { 280, 30, 30 } })
    shadeScene(g, b, sunOn("B2"))
    paintSolids(b, grid, 81)
    for y = 130, 149 do -- the altar: a slab of bone, skulls in relief along its face
      for x = 150, 209 do
        local c = (y <= 132) and ((y == 130) and ro[3] or bn[4]) or ((y <= 134) and bn[2] or ink[3])
        if y > 134 and (x == 150 or x == 209) then c = ro[1] end
        if y > 134 and (x == 151 or x == 208) then c = bn[1] end
        if y == 135 then c = ink[1] end
        b[y][x] = c
      end
    end
    for k = 0, 2 do reliefSkull(b, 162 + k * 18, 141, 0.8) end
    for y = 110, 149 do -- the pillar: skulls stacked on each other, a flat slab on top
      for x = 250, 269 do
        local c = ink[2]
        if y <= 112 then c = (y == 110) and ro[3] or bn[4] end
        if y > 112 and (x == 250) then c = ro[1] end
        b[y][x] = c
      end
    end
    for k = 0, 3 do reliefSkull(b, 260, 119 + k * 9, 0.72) end
    anchors.vessels[#anchors.vessels + 1] = { 260, 128 }
    pits(b, grid, anchors)
    return b, anchors
  end

  -- V: a gate of great stacked vertebrae frames the cathedral on the skyline; in the floor, a sealed
  -- ring of teeth.
  local function sceneV(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    for s = -1, 1, 2 do -- the gate's two posts: great vertebrae stacked up, and the arch between them
      local x = (s < 0) and 18 or 302
      for k = 0, 8 do
        local y = 150 - k * 15
        S.ellipsoid(g, x + math.sin(k * 1.7) * 3, y, 11, 7.5, "rib", 30)
        S.ball(g, x + s * -8 + math.sin(k) * 2, y - 8, 3.2, "rib", 31)
        S.tube(g, S.bezier({ x, y - 2 }, { x - s * 12, y - 6 }, { x - s * 14, y - 14 }), 1.6, "rib", 31)
      end
    end
    S.tube(g, S.bezier({ 18, 20 }, { 160, -34 }, { 302, 20 }), 7, "rib", 29)
    for k = 0, 12 do
      local x = 34 + k * 21
      local y = 20 - math.sin(k / 12 * math.pi) * 25
      S.ball(g, x, y + 8, 3.2, "rib", 30)
      S.tube(g, S.bezier({ x, y + 10 }, { x + 2, y + 16 }, { x, y + 22 }), 1.2, "rib", 30)
    end
    shrouds(b, g, anchors, { { 64, 14, 36 }, { 256, 14, 36 }, { 110, 2, 30 }, { 210, 2, 30 } })
    shadeScene(g, b, { x = 160, y = 70 })
    paintSolids(b, grid, 91)
    for x = 116, 204 do -- the sealed ring: two rows of teeth set into the causeway, clenched shut
      local d = (x - 160) / 44
      local mid = FLOOR + 1 + math.floor((1 - d * d) * 5 + 0.5) -- the seam dips toward the centre
      local zig = math.abs((x % 6) - 3)                           -- interlocking points
      for y = FLOOR, mid + 7 do
        local c
        if y < mid - zig then -- upper teeth, pointing down
          c = (y == FLOOR) and ro[4] or (((x % 6) == 0) and ink[3] or bn[3])
        elseif y <= mid + 3 - zig then -- lower teeth, pointing up, meeting them
          c = ((x % 6) == 3) and ink[3] or bn[2]
          if y == mid - zig then c = P.void end
        else
          c = (y == mid + 4 - zig) and ink[1] or ink[2]
        end
        b[y][x] = c
      end
      if x % 8 == 0 then anchors.vessels[#anchors.vessels + 1] = { x, mid } end
    end
    return b, anchors
  end

  -------------------------------------------------------------------------------------------------

  return {
    far = far,
    fog = fog,
    scenes = { C = sceneC, B1 = sceneB1, B2 = sceneB2, V = sceneV },
    colors = {
      vessel = { bl[2], bu[2] }, drip = bl[3], spore = ro[3], sporeAlpha = 0.3,
      hud = { text = ro[3], dim = ro[1], mark = vi[2], markEnd = bl[3], markHere = ro[4] },
      clear = P.void,
    },
    -- the Maw in this world: a dark worm backlit by the dusk, a rose rim, pale teeth
    maw = {
      skin = { P.void, ink[1], ink[2], ink[3], vi[2], vi[3], bn[1] }, ring = { ink[1], ink[2], bn[1] },
      teeth = { bn[1], bn[2], bn[4], ro[4] }, gullet = { P.void, ink[1], bl[1] }, rim = ro[3],
      lip = { ro[1], ro[2] }, outline = P.void, crust = { bn[3], bn[4], ro[3] },
    },
  }
end
