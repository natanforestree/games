-- Poses for the fighter rig and the animations built from them (see rig.lua for the format).
-- Stance poses put the front hand exactly on the hilt from marrow/data/body.json, where the game's
-- blade starts, so the drawn arm and the colliding blade always meet.
return function(body)
  local hilt = body.hilt
  local H = {}
  for i, s in ipairs(body.stances) do H[i - 1] = s.height end

  local poses = {
    stand0 = { hip = { -1, -10 }, chest = { 1, -16 }, head = { 3, -19 }, handF = { hilt, -H[0] }, handB = { -4, -12 }, footF = { 5, -1 }, footB = { -6, -1 } },
    stand1 = { hip = { 0, -12 }, chest = { 1, -19 }, head = { 2, -22 }, handF = { hilt, -H[1] }, handB = { -3, -14 }, footF = { 4, -1 }, footB = { -4, -1 } },
    stand2 = { hip = { 0, -12 }, chest = { 0, -19 }, head = { 1, -22 }, handF = { hilt, -H[2] }, handB = { -4, -15 }, footF = { 3, -1 }, footB = { -4, -1 } },
    standU = { hip = { 0, -12 }, chest = { 1, -19 }, head = { 2, -22 }, handF = { 5, -17 }, handB = { 2, -16 }, footF = { 4, -1 }, footB = { -4, -1 } },
  }
  local order = { "stand0", "stand1", "stand2", "standU" }
  local anims = {
    stand0 = { frames = { "stand0" } },
    stand1 = { frames = { "stand1" } },
    stand2 = { frames = { "stand2" } },
    standU = { frames = { "standU" } },
  }
  return { poses = poses, order = order, anims = anims }
end
