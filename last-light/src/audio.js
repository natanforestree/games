// All of Last Light's sound, made live with Web Audio (there are no audio files).
//   - Creatures are positional (HRTF): you hear where they are in the dark. At most 12 positional
//     voices play at once; a new sound takes a free voice, or the one playing farthest away.
//   - Around you: wind (quieter under the roof), the stove crackling near it, your footsteps.
//   - Guns crack and echo off the trees; the score (music.js) is scheduled a little ahead.
// Browsers only allow sound after a click, so start() is called from inside the click that starts a
// night (main.js). M mutes; the volume and mute are remembered.
import { layersFor, notesAt, midiToHz, STEP, DAWN } from './music.js';
import { FEEL } from './tuning.js';

const MUTE_KEY = 'last-light-muted', VOLUME_KEY = 'last-light-volume';
const VOICES = 12;
const AHEAD = 0.2; // seconds of music scheduled ahead

export function createAudio(storage) {
  let ctx = null, master = null, music = null, sfx = null, echo = null, noise = null;
  let wind = null, windGain = null, stoveGain = null;
  let voices = [];
  let muted = storage.get(MUTE_KEY) === '1';
  let volume = Number(storage.get(VOLUME_KEY) ?? 0.8);
  if (!(volume >= 0 && volume <= 1)) volume = 0.8;
  let nextStep = 0, stepAt = 0, dawnAt = -1, lastWalked = 0, heartAt = 0, idleAt = 0, crackleAt = 0;

  const level = () => (muted ? 0 : volume);

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.gain.value = 0.5;
    music.connect(master);
    sfx = ctx.createGain();
    sfx.connect(master);
    // The echo off the treeline: a filtered feedback delay the guns send into.
    echo = ctx.createDelay(1);
    echo.delayTime.value = 0.21;
    const fb = ctx.createGain(), tone = ctx.createBiquadFilter();
    fb.gain.value = 0.32;
    tone.type = 'lowpass';
    tone.frequency.value = 1400;
    echo.connect(tone).connect(fb).connect(echo);
    tone.connect(sfx);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Wind: looping noise through a slowly breathing low-pass.
    wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 0.09;
    depth.gain.value = 180;
    lfo.connect(depth).connect(wf.frequency);
    wind.connect(wf).connect(windGain).connect(sfx);
    wind.start();
    lfo.start();
    stoveGain = ctx.createGain();
    stoveGain.gain.value = 0;
    stoveGain.connect(sfx);
    voices = Array.from({ length: VOICES }, () => {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.rolloffFactor = 1.3;
      panner.maxDistance = 40;
      const gain = ctx.createGain();
      gain.connect(panner).connect(sfx);
      return { panner, gain, until: 0, x: 0, y: 0 };
    });
    nextStep = 0;
    stepAt = ctx.currentTime + 0.1;
  }

  // Sets a panner or listener position (Safari only has setPosition).
  function place(node, x, y) {
    if (node.positionX) {
      node.positionX.value = x;
      node.positionY.value = 0;
      node.positionZ.value = y;
    } else node.setPosition(x, 0, y);
  }

  // A positional voice for a sound lasting `len` seconds at (x, y); null before start(). Plain loops,
  // since it runs for every creature sound: the first free voice, else the one farthest from (lx, ly).
  function voiceAt(x, y, len, lx, ly) {
    if (!ctx) return null;
    const now = ctx.currentTime;
    let v = null;
    for (let i = 0; i < voices.length && !v; i++) if (voices[i].until <= now) v = voices[i];
    if (!v) {
      let far = -1;
      for (let i = 0; i < voices.length; i++) {
        const o = voices[i], dx = o.x - lx, dy = o.y - ly, d = Math.sqrt(dx * dx + dy * dy);
        if (d > far) {
          far = d;
          v = o;
        }
      }
    }
    v.until = now + len;
    v.x = x;
    v.y = y;
    place(v.panner, x, y);
    return v.gain;
  }

  // Building blocks. Each plays into `out` starting at time t.
  function burst(out, t, { len, type = 'bandpass', freq = 1000, q = 1, vol = 1, to }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + len);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5, len + 0.05);
    return g;
  }
  function tone(out, t, { len, type = 'sine', freq = 220, to, vol = 0.5, attack = 0.005, vib = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    if (vib) {
      const l = ctx.createOscillator(), dg = ctx.createGain();
      l.frequency.value = 7;
      dg.gain.value = vib;
      l.connect(dg).connect(o.frequency);
      l.start(t);
      l.stop(t + len);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    return g;
  }

  const CRY = [640, 260, 900, 140]; // death-cry pitch by kind
  const GROWL = [0, 75, 0, 48];

  // Plays the sounds for one update's events. (lx, ly) is where you are.
  function events(state) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, p = state.player, lx = p.x, ly = p.y;
    for (let i = 0; i < state.eventCount; i++) {
      const e = state.events[i];
      switch (e.type) {
        case 'shot':
          if (e.a === 0) {
            burst(sfx, t, { len: 0.09, freq: 1500, q: 0.7, vol: 0.9 }).connect(echo);
            tone(sfx, t, { len: 0.16, freq: 110, to: 38, vol: 0.9 });
            burst(sfx, t + 0.2, { len: 0.03, type: 'highpass', freq: 2800, vol: 0.4 }); // lever
            burst(sfx, t + 0.31, { len: 0.03, type: 'highpass', freq: 2200, vol: 0.4 });
          } else {
            burst(sfx, t, { len: 0.4, type: 'lowpass', freq: 1800, to: 300, vol: 1 }).connect(echo);
            tone(sfx, t, { len: 0.25, freq: 80, to: 30, vol: 1 });
          }
          break;
        case 'dry':
          burst(sfx, t, { len: 0.02, type: 'highpass', freq: 3000, vol: 0.3 });
          break;
        case 'reload':
          burst(sfx, t, { len: 0.03, freq: 2000, q: 3, vol: 0.35 });
          burst(sfx, t + 0.05, { len: 0.03, freq: 1400, q: 3, vol: 0.3 });
          break;
        case 'switch':
          burst(sfx, t, { len: 0.18, freq: 600, to: 1600, q: 0.8, vol: 0.15 });
          break;
        case 'hit': {
          const g = voiceAt(e.x, e.y, 0.9, lx, ly);
          burst(g, t, { len: 0.08, type: 'lowpass', freq: 500, vol: 0.9 });
          if (e.b) tone(g, t + 0.02, { len: 0.7, type: 'sawtooth', freq: CRY[e.a], to: CRY[e.a] * 0.35, vol: 0.35, vib: 18 });
          break;
        }
        case 'hurt':
          burst(sfx, t, { len: 0.12, type: 'lowpass', freq: 350, vol: 1 });
          tone(sfx, t, { len: 0.2, freq: 120, to: 70, vol: 0.5 });
          break;
        case 'windup': {
          const g = voiceAt(e.x, e.y, 0.7, lx, ly);
          tone(g, t, { len: 0.6, type: 'sawtooth', freq: GROWL[e.a] || 70, to: (GROWL[e.a] || 70) * 1.3, vol: 0.5, attack: 0.1, vib: 6 });
          break;
        }
        case 'shriek': {
          const g = voiceAt(e.x, e.y, 0.5, lx, ly);
          tone(g, t, { len: 0.45, type: 'sawtooth', freq: 600, to: 1500, vol: 0.4, attack: 0.03, vib: 40 });
          break;
        }
        case 'leap':
          burst(voiceAt(e.x, e.y, 0.3, lx, ly), t, { len: 0.25, freq: 400, to: 1200, vol: 0.5 });
          break;
        case 'birth':
          burst(voiceAt(e.x, e.y, 0.6, lx, ly), t, { len: 0.5, type: 'lowpass', freq: 250, to: 120, vol: 1 });
          break;
        case 'flareThrow':
          burst(sfx, t, { len: 0.2, freq: 900, to: 300, vol: 0.2 });
          burst(voiceAt(e.x, e.y, 0.6, lx, ly), t + 0.3, { len: 0.5, type: 'highpass', freq: 2500, vol: 0.6 });
          break;
        case 'pickup':
          tone(sfx, t, { len: 0.3, freq: 880, vol: 0.2 });
          tone(sfx, t + 0.08, { len: 0.4, freq: 1320, vol: 0.15 });
          break;
        case 'wave': {
          // A bell tolls the hour.
          for (const [ratio, vol] of [[1, 0.5], [2.76, 0.2], [5.4, 0.1]]) tone(sfx, t, { len: 3, freq: 98 * ratio, vol, attack: 0.01 });
          break;
        }
        case 'dawn':
          dawnAt = t + 0.5;
          break;
        case 'dead':
          tone(sfx, t, { len: 3, type: 'sawtooth', freq: 55, to: 30, vol: 0.4, attack: 0.3 });
          break;
      }
    }
  }

  function playNote(layer, n, t, len) {
    const out = music;
    switch (layer) {
      case 'drone':
        tone(out, t, { len: len * STEP, type: 'sawtooth', freq: midiToHz(n.note), vol: n.vel * 0.12, attack: 1.5 });
        break;
      case 'pulse':
        tone(out, t, { len: 0.25, freq: 55, to: 35, vol: n.vel * 0.8 });
        break;
      case 'strings':
      case 'choir':
        tone(out, t, { len: len * STEP, type: layer === 'strings' ? 'sawtooth' : 'triangle', freq: midiToHz(n.note), vol: n.vel * 0.1, attack: 0.8, vib: 2 });
        break;
      case 'musicbox':
        tone(out, t, { len: 1.6, freq: midiToHz(n.note), vol: n.vel * 0.4 });
        tone(out, t, { len: 0.8, freq: midiToHz(n.note) * 3.01, vol: n.vel * 0.06 });
        break;
      case 'ticks':
        burst(out, t, { len: 0.03, type: 'highpass', freq: 6000, vol: n.vel * 0.25 });
        break;
      case 'toms':
        tone(out, t, { len: 0.35, freq: midiToHz(n.note), to: midiToHz(n.note) * 0.6, vol: n.vel * 0.6 });
        break;
      case 'brass':
        tone(out, t, { len: len * STEP * 0.8, type: 'sawtooth', freq: midiToHz(n.note), vol: n.vel * 0.25, attack: 0.04 });
        break;
    }
  }

  // Called every frame: moves the listener, keeps the ambience right, schedules the score.
  function update(state, facing, screen) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, p = state.player, L = ctx.listener;
    place(L, p.x, p.y);
    const fx = Math.cos(facing), fz = Math.sin(facing);
    if (L.forwardX) {
      L.forwardX.value = fx;
      L.forwardY.value = 0;
      L.forwardZ.value = fz;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else L.setOrientation(fx, 0, fz, 0, 1, 0);

    const playing = screen === 'playing';
    const phase = state.night.phase;
    const indoors = state.map.roofed[Math.floor(p.y) * state.map.w + Math.floor(p.x)] === 1;
    const windTo = !playing ? 0.05 : (phase === 'lull' ? 0.5 : 0.3) * (indoors ? 0.35 : 1);
    windGain.gain.setTargetAtTime(windTo, t, 0.5);
    const sx = state.stove ? state.stove.x - p.x : 0, sy = state.stove ? state.stove.y - p.y : 0;
    const sd = state.stove ? Math.sqrt(sx * sx + sy * sy) : 99;
    stoveGain.gain.setTargetAtTime(playing ? Math.max(0, 1 - sd / 6) * 0.5 : 0, t, 0.3);
    if (!playing) return;

    // The stove's crackle, a click at a time.
    if (sd < 6 && t >= crackleAt) {
      crackleAt = t + 0.05 + Math.random() * 0.25;
      burst(stoveGain, t, { len: 0.02 + Math.random() * 0.03, type: 'highpass', freq: 1500 + Math.random() * 3000, vol: 0.3 + Math.random() * 0.5 });
    }
    // Footsteps: a crunch every 0.9 cells.
    if (p.walked - lastWalked > 0.9) {
      lastWalked = p.walked;
      burst(sfx, t, { len: 0.08, type: indoors ? 'bandpass' : 'lowpass', freq: indoors ? 300 : 700 + Math.random() * 300, vol: 0.18 });
    } else if (p.walked < lastWalked) lastWalked = p.walked;
    // A heartbeat when you're low.
    if (p.health > 0 && p.health <= FEEL.lowHealth && t >= heartAt) {
      heartAt = t + 0.9;
      tone(sfx, t, { len: 0.12, freq: 60, to: 40, vol: 0.6 });
      tone(sfx, t + 0.18, { len: 0.12, freq: 55, to: 38, vol: 0.4 });
    }
    // Now and then a nearby creature makes its sound: a skitter, a breath, a chitter, a moan.
    if (t >= idleAt) {
      idleAt = t + 0.3 + Math.random() * 0.8;
      let c = null, best = 10;
      for (const o of state.creatures) {
        if (!o.alive || o.dying) continue;
        const ox = o.x - p.x, oy = o.y - p.y, d = Math.sqrt(ox * ox + oy * oy) + Math.random() * 4;
        if (d < best) {
          best = d;
          c = o;
        }
      }
      if (c) {
        const g = voiceAt(c.x, c.y, 0.9, p.x, p.y);
        if (c.kind === 0) for (let k = 0; k < 4; k++) burst(g, t + k * 0.05, { len: 0.02, type: 'highpass', freq: 2500, vol: 0.4 });
        else if (c.kind === 1) burst(g, t, { len: 0.8, freq: 380, q: 2, vol: 0.5 });
        else if (c.kind === 2) for (let k = 0; k < 6; k++) tone(g, t + k * 0.04, { len: 0.03, type: 'square', freq: 1800, vol: 0.08 });
        else tone(g, t, { len: 1.2, type: 'sawtooth', freq: 45, to: 38, vol: 0.5, attack: 0.3, vib: 3 });
      }
    }
    // The score: every step due in the next AHEAD seconds.
    if (stepAt < t) stepAt = t + 0.02;
    const layers = layersFor(phase, state.night.wave);
    while (stepAt < t + AHEAD) {
      for (const layer of layers) for (const n of notesAt(layer, nextStep)) playNote(layer, n, stepAt, n.len);
      if (dawnAt >= 0) {
        const since = Math.round((stepAt - dawnAt) / STEP);
        for (const d of DAWN) if (d.step === since) playNote(d.voice, { note: d.note, vel: 0.9 }, stepAt, d.len);
        if (since > 40) dawnAt = -1;
      }
      nextStep++;
      stepAt += STEP;
    }
  }

  return {
    start,
    events,
    update,
    get muted() {
      return muted;
    },
    get volume() {
      return volume;
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      storage.set(VOLUME_KEY, volume);
      if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
    },
    toggleMute() {
      muted = !muted;
      storage.set(MUTE_KEY, muted ? '1' : '0');
      if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
    },
    suspend() {
      ctx?.suspend();
    },
    resume() {
      if (ctx?.state === 'suspended') ctx.resume();
    },
  };
}
