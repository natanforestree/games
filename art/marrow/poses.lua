-- Poses for the fighter rig and the animations built from them (see rig.lua for the format).
-- Stance poses put the front hand exactly on the hilt from marrow/data/body.json, where the game's
-- blade starts, so the drawn arm and the colliding blade always meet. Frames where the blade isn't
-- live carry a `sword` line (x0, y0, x1, y1) that the game draws while the fighter is armed.
return function(body)
  local hilt, ext = body.hilt, body.hilt + body.lungeExtend
  local H = {}
  for i, s in ipairs(body.stances) do H[i - 1] = s.height end

  local function copy(p)
    local o = {}
    for k, v in pairs(p) do o[k] = (type(v) == "table") and { table.unpack(v) } or v end
    return o
  end
  local function with(p, changes)
    local o = copy(p)
    for k, v in pairs(changes) do o[k] = v end
    return o
  end

  local poses, order, anims = {}, {}, {}
  local function add(name, pose)
    poses[name] = pose
    order[#order + 1] = name
  end
  local function anim(name, frames, rate, loop)
    anims[name] = { frames = frames, rate = rate or 0, loop = loop ~= false }
  end
  local function seq(prefix, n)
    local t = {}
    for i = 1, n do t[i] = prefix .. i end
    return t
  end

  -- standing in each stance, and unarmed (fists up)
  add("stand0", { hip = { -1, -10 }, chest = { 1, -16 }, head = { 3, -19 }, handF = { hilt, -H[0] }, handB = { -4, -12 }, footF = { 5, -1 }, footB = { -6, -1 } })
  add("stand1", { hip = { 0, -12 }, chest = { 1, -19 }, head = { 2, -22 }, handF = { hilt, -H[1] }, handB = { -3, -14 }, footF = { 4, -1 }, footB = { -4, -1 } })
  add("stand2", { hip = { 0, -12 }, chest = { 0, -19 }, head = { 1, -22 }, handF = { hilt, -H[2] }, handB = { -4, -15 }, footF = { 3, -1 }, footB = { -4, -1 } })
  add("standU", { hip = { 0, -12 }, chest = { 1, -19 }, head = { 2, -22 }, handF = { 5, -17 }, handB = { 2, -16 }, footF = { 4, -1 }, footB = { -4, -1 } })
  for s = 0, 2 do anim("stand" .. s, { "stand" .. s }) end
  anim("standU", { "standU" })

  -- walking in stance: chest and hands hold still (the blade mustn't move), the hips bob, the feet step
  local STEP = { { 1, 0, -1, -1 }, { 0, -2, 0, 0 }, { -1, -1, 1, 0 }, { 0, 0, 0, -2 } } -- dxF, dyF, dxB, dyB
  for s = 0, 2 do
    local base = poses["stand" .. s]
    for k, st in ipairs(STEP) do
      add("walk" .. s .. "_" .. k, with(base, {
        hip = { base.hip[1], base.hip[2] + (k % 2) },
        footF = { base.footF[1] + st[1], base.footF[2] + st[2] },
        footB = { base.footB[1] + st[3], base.footB[2] + st[4] },
      }))
    end
    anim("walk" .. s, seq("walk" .. s .. "_", 4), 8)
  end

  -- running: leaning in, arms pumping; an armed runner trails the sword low behind
  local RUN = {
    { F = { 6, -2 }, B = { -5, -3 }, hF = { -2, -13 }, hB = { 4, -15 }, hip = -11 },
    { F = { 4, -1 }, B = { -3, -6 }, hF = { -1, -12 }, hB = { 3, -14 }, hip = -12 },
    { F = { 0, -3 }, B = { 1, -4 }, hF = { 1, -12 }, hB = { 0, -13 }, hip = -11 },
    { F = { -5, -3 }, B = { 6, -2 }, hF = { 4, -15 }, hB = { -2, -13 }, hip = -11 },
    { F = { -3, -6 }, B = { 4, -1 }, hF = { 3, -14 }, hB = { -1, -12 }, hip = -12 },
    { F = { 1, -4 }, B = { 0, -3 }, hF = { 0, -13 }, hB = { 1, -12 }, hip = -11 },
  }
  for k, r in ipairs(RUN) do
    add("run_" .. k, { hip = { 0, r.hip }, chest = { 3, r.hip - 7 }, head = { 5, r.hip - 10 }, handF = r.hF, handB = r.hB, footF = r.F, footB = r.B,
      sword = { r.hF[1], r.hF[2], r.hF[1] - 10, r.hF[2] + 4 } })
  end
  anim("run", seq("run_", 6), 4)

  -- lunges: coil, thrust (hand out by lungeExtend), then back to the stance
  add("lunge0_1", with(poses.stand0, { hip = { -2, -10 }, chest = { 0, -16 }, head = { 2, -19 } }))
  add("lunge0_2", { hip = { 0, -10 }, chest = { 3, -15 }, head = { 6, -18 }, handF = { ext, -H[0] }, handB = { -4, -11 }, footF = { 7, -1 }, footB = { -6, -1 } })
  add("lunge1_1", with(poses.stand1, { hip = { -1, -11 }, chest = { 0, -19 }, head = { 1, -22 } }))
  add("lunge1_2", { hip = { 1, -11 }, chest = { 3, -18 }, head = { 5, -21 }, handF = { ext, -H[1] }, handB = { -4, -13 }, footF = { 7, -1 }, footB = { -5, -1 } })
  add("lunge2_1", with(poses.stand2, { hip = { -1, -12 }, chest = { -1, -19 }, head = { 0, -22 } }))
  add("lunge2_2", { hip = { 1, -11 }, chest = { 2, -19 }, head = { 4, -22 }, handF = { ext, -H[2] }, handB = { -4, -15 }, footF = { 6, -1 }, footB = { -5, -1 } })
  for s = 0, 2 do anim("lunge" .. s, { "lunge" .. s .. "_1", "lunge" .. s .. "_2", "stand" .. s }, 0, false) end

  -- the throw pose (sword raised over the head) and the throw
  add("throwpose", { hip = { 0, -12 }, chest = { 0, -19 }, head = { 2, -22 }, handF = { -2, -25 }, handB = { 3, -17 }, footF = { 4, -1 }, footB = { -4, -1 }, sword = { -2, -25, 8, -30 } })
  add("throw_1", { hip = { 1, -12 }, chest = { 2, -19 }, head = { 4, -22 }, handF = { 7, -19 }, handB = { -3, -15 }, footF = { 5, -1 }, footB = { -3, -1 } })
  add("throw_2", { hip = { 1, -12 }, chest = { 3, -18 }, head = { 5, -21 }, handF = { 8, -14 }, handB = { -3, -13 }, footF = { 5, -1 }, footB = { -3, -1 } })
  anim("throwpose", { "throwpose" })
  anim("throw", { "throw_1", "throw_2" }, 5, false)

  -- ducking (blade held low at crouchBlade height) and crawling
  add("crouch", { hip = { -2, -6 }, chest = { 0, -11 }, head = { 3, -12 }, handF = { hilt, -body.crouchBlade.height }, handB = { -3, -8 }, footF = { 5, -1 }, footB = { -5, -1 } })
  anim("crouch", { "crouch" })
  local CRAWL = { { 7, 3, -8, -10 }, { 8, 2, -7, -9 }, { 6, 4, -9, -8 }, { 6, 3, -9, -9 } } -- handF.x, handB.x, footF.x, footB.x
  for k, c in ipairs(CRAWL) do
    add("crawl_" .. k, { hip = { -5, -5 }, chest = { 3, -7 }, head = { 7, -9 }, handF = { c[1], -1 }, handB = { c[2], -1 }, footF = { c[3], -1 }, footB = { c[4], -2 }, sword = { -6, -9, 5, -10 } })
  end
  anim("crawl", seq("crawl_", 4), 8)

  -- rolls (a curled ball turning over) and cartwheels (a star pose turning over)
  for k = 1, 6 do add("roll_" .. k, { ball = (k - 1) * 60, sword = { -5, -8, 5, -2 } }) end
  anim("roll", seq("roll_", 6), 4)
  local star = { hip = { 0, -12 }, chest = { 0, -18 }, head = { 0, -22 }, handF = { 5, -23 }, handB = { -5, -23 }, footF = { 5, -2 }, footB = { -5, -2 } }
  for k = 1, 5 do add("cartwheel_" .. k, with(star, { rot = (k - 1) * 72 })) end
  anim("cartwheel", seq("cartwheel_", 5), 4, false)

  -- in the air (knees tucked, blade still in stance)
  add("air0", { hip = { 0, -11 }, chest = { 2, -17 }, head = { 4, -20 }, handF = { hilt, -H[0] }, handB = { -3, -13 }, footF = { 4, -5 }, footB = { -3, -3 } })
  add("air1", { hip = { 0, -13 }, chest = { 1, -20 }, head = { 2, -23 }, handF = { hilt, -H[1] }, handB = { -3, -15 }, footF = { 4, -5 }, footB = { -3, -3 } })
  add("air2", { hip = { 0, -13 }, chest = { 0, -20 }, head = { 1, -23 }, handF = { hilt, -H[2] }, handB = { -4, -16 }, footF = { 4, -5 }, footB = { -3, -3 } })
  add("airU", with(poses.air1, { handF = { 5, -18 } }))
  for s = 0, 2 do anim("air" .. s, { "air" .. s }) end
  anim("airU", { "airU" })

  -- kicks and punches: the foot or fist sits inside its hit box from body.json
  add("divekick", { hip = { -2, -10 }, chest = { -5, -17 }, head = { -6, -21 }, handF = { -1, -15 }, handB = { -8, -14 }, footF = { 6, -2 }, footB = { -2, -4 }, sword = { -8, -14, -17, -11 } })
  anim("divekick", { "divekick" })
  add("sweep_1", with(poses.crouch, { handF = { 3, -2 }, handB = { -4, -2 }, sword = { -3, -9, -12, -15 } }))
  add("sweep_2", { hip = { 2, -5 }, chest = { -2, -9 }, head = { -3, -12 }, handF = { 1, -1 }, handB = { -5, -1 }, footF = { 13, -1 }, footB = { -4, -1 }, sword = { -5, -1, -14, -6 } })
  anim("sweep", { "sweep_1", "sweep_2", "sweep_2", "sweep_1" }, 5, false)
  add("punch_1", with(poses.standU, { handF = { 2, -17 }, chest = { 0, -19 } }))
  add("punch_2", with(poses.standU, { chest = { 3, -19 }, head = { 4, -22 }, handF = { 11, -16 }, handB = { 0, -15 } }))
  anim("punch", { "punch_1", "punch_2", "punch_1" }, 4, false)

  -- knocked down, getting up
  add("knocked_1", { hip = { 0, -8 }, chest = { -4, -13 }, head = { -6, -16 }, handF = { 2, -14 }, handB = { -8, -15 }, footF = { 4, -1 }, footB = { 2, -3 }, sword = { -8, -15, -16, -10 } })
  add("knocked_2", { hip = { 1, -3 }, chest = { -5, -4 }, head = { -8, -4 }, handF = { -3, -6 }, handB = { -6, -1 }, footF = { 9, -2 }, footB = { 8, -1 }, sword = { -12, -1, -2, -1 } })
  anim("knocked", { "knocked_1", "knocked_2" }, 6, false)
  add("getup_1", { hip = { -1, -4 }, chest = { 1, -10 }, head = { 3, -12 }, handF = { 5, -5 }, handB = { -3, -1 }, footF = { 6, -1 }, footB = { 4, -1 } })
  anim("getup", { "getup_1", "crouch" }, 6, false)

  -- hanging from a ledge (its top is 22px above the feet; the hands grip the corner) and climbing up
  add("ledge", { hip = { 0, -8 }, chest = { 1, -15 }, head = { 2, -18 }, handF = { hilt, -22 }, handB = { hilt - 1, -23 }, footF = { 1, -1 }, footB = { -1, -2 }, sword = { -3, -21, -4, -9 } })
  anim("ledge", { "ledge" })
  add("climb_1", { hip = { 1, -14 }, chest = { 3, -21 }, head = { 5, -24 }, handF = { hilt + 1, -23 }, handB = { hilt, -23 }, footF = { 3, -6 }, footB = { 0, -4 } })
  add("climb_2", { hip = { 3, -22 }, chest = { 6, -28 }, head = { 8, -31 }, handF = { hilt + 5, -23 }, handB = { hilt + 3, -23 }, footF = { 5, -23 }, footB = { 1, -15 } })
  add("climb_3", { hip = { 7, -30 }, chest = { 8, -36 }, head = { 10, -39 }, handF = { hilt + 7, -30 }, handB = { hilt + 4, -29 }, footF = { 11, -23 }, footB = { 7, -23 } })
  anim("climb", { "climb_1", "climb_2", "climb_3" }, 5, false)

  -- on a wall, back to it (facing away, ready to leap), and running up it
  add("wallcling", { hip = { -1, -12 }, chest = { -2, -19 }, head = { -1, -22 }, handF = { 3, -15 }, handB = { -4, -20 }, footF = { 2, -3 }, footB = { -4, -7 }, sword = { -4, -5, -3, -20 } })
  add("wallrun_1", with(poses.wallcling, { footB = { -4, -9 }, footF = { 1, -5 } }))
  add("wallrun_2", with(poses.wallcling, { footB = { -4, -5 }, footF = { 3, -2 } }))
  anim("wallcling", { "wallcling" })
  anim("wallrun", { "wallrun_1", "wallrun_2" }, 4)

  -- the neck snap: kneeling over a downed opponent
  add("necksnap_1", { hip = { 0, -8 }, chest = { 3, -13 }, head = { 5, -15 }, handF = { 8, -4 }, handB = { 6, -5 }, footF = { 4, -1 }, footB = { -5, -1 } })
  add("necksnap_2", with(poses.necksnap_1, { handF = { 9, -6 }, handB = { 5, -3 }, head = { 4, -15 } }))
  anim("necksnap", { "necksnap_1", "necksnap_2", "necksnap_1", "necksnap_2" }, 5, false)

  -- death: a jolt, a crumple, gone (the ichor burst is drawn by the game)
  add("death_1", with(poses.stand1, { chest = { 0, -19 }, head = { 0, -22 }, handF = { 5, -21 }, handB = { -5, -20 } }))
  add("death_2", { hip = { 0, -8 }, chest = { -2, -13 }, head = { -4, -15 }, handF = { 4, -9 }, handB = { -6, -8 }, footF = { 3, -1 }, footB = { -3, -1 } })
  add("death_3", with(poses.knocked_2, { sword = false }))
  anim("death", { "death_1", "death_2", "death_3" }, 6, false)

  return { poses = poses, order = order, anims = anims }
end
