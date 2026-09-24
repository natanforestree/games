// Marrow's sound, all generated live with Web Audio (there are no audio files): a low drone that
// swells as the fighters close in, and wet, metallic effects for what happens in a match. Browsers
// only allow audio after a key press, so start() is called on the first one. M mutes, remembered.
const MUTE_KEY = 'marrow-muted';

export function createAudio(storage) {
  let ctx = null, master = null, droneFilter = null, droneGain = null, noise = null, tension = 0;
  let muted = storage.get(MUTE_KEY) === '1';

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the drone: detuned saws under a breathing low-pass
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 160;
    droneFilter.Q.value = 6;
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    for (const f of [41.2, 41.9, 82.1]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(droneFilter);
      o.start();
    }
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 0.13;
    depth.gain.value = 40;
    lfo.connect(depth).connect(droneFilter.frequency);
    lfo.start();
    droneFilter.connect(droneGain).connect(master);
  }

  // A tone sliding from f0 to f1 Hz over dur seconds.
  function tone(f0, f1, dur, type = 'sine', gain = 0.3, when = 0) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // A burst of noise through a filter sweeping from f0 to f1 Hz.
  function hiss(f0, f1, dur, type = 'lowpass', gain = 0.3) {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    clash: () => {
      for (const f of [1180, 1760, 2390]) tone(f, f * 0.98, 0.3, 'square', 0.05);
      hiss(4000, 2000, 0.05, 'highpass', 0.2);
    },
    disarm: () => {
      SOUNDS.clash();
      tone(900, 1500, 0.2, 'triangle', 0.15, 0.03);
    },
    deflect: () => {
      tone(1500, 1400, 0.15, 'square', 0.05);
      tone(2300, 2200, 0.12, 'square', 0.04);
    },
    swordwall: () => {
      tone(700, 500, 0.1, 'square', 0.05);
      hiss(3000, 1000, 0.08, 'bandpass', 0.15);
    },
    kill: () => {
      hiss(1400, 150, 0.35, 'lowpass', 0.5);
      tone(110, 40, 0.3, 'sine', 0.5);
    },
    throw: () => hiss(500, 2000, 0.25, 'bandpass', 0.25),
    kick: () => {
      tone(150, 60, 0.12, 'sine', 0.4);
      hiss(800, 300, 0.05, 'lowpass', 0.2);
    },
    punch: () => {
      tone(160, 70, 0.1, 'sine', 0.3);
      hiss(700, 300, 0.04, 'lowpass', 0.15);
    },
    knockdown: () => tone(90, 45, 0.25, 'sine', 0.35),
    pickup: () => tone(600, 900, 0.08, 'triangle', 0.12),
    respawn: () => tone(60, 120, 0.5, 'sine', 0.25),
    slide: () => hiss(300, 120, 0.4, 'lowpass', 0.3),
    arrow: () => tone(220, 330, 0.18, 'triangle', 0.1),
    maw: () => {
      tone(55, 30, 2.2, 'sawtooth', 0.3);
      hiss(250, 60, 2.0, 'lowpass', 0.5);
    },
    swallow: () => {
      hiss(600, 80, 0.6, 'lowpass', 0.6);
      tone(80, 30, 0.6, 'sine', 0.5);
    },
  };

  return {
    start,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      storage.set(MUTE_KEY, muted ? '1' : '0');
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.02);
      return muted;
    },
    // A hidden tab's game is frozen, so its sound sleeps too. Back in view it wakes, if it had started
    // and isn't muted; muted, it sleeps on until M unmutes it (the key press calls start()).
    suspend() {
      ctx?.suspend().catch(() => {});
    },
    resume() {
      if (ctx && !muted) ctx.resume().catch(() => {});
    },
    // Once per tick: play that tick's events, and let the drone follow how close the fighters are.
    onTick(events, state, inMatch = true) {
      if (!ctx || ctx.state !== 'running') return;
      for (const e of events) SOUNDS[e.type]?.();
      const [a, b] = state.fighters;
      const alive = (f) => f.state !== 'dead' && f.state !== 'gone';
      const next = inMatch && alive(a) && alive(b) ? Math.max(0, 1 - Math.abs(a.x - b.x) / 200) : 0;
      if (Math.abs(next - tension) > 0.02) {
        tension = next;
        droneFilter.frequency.setTargetAtTime(160 + 500 * tension, ctx.currentTime, 0.3);
        droneGain.gain.setTargetAtTime(0.05 + 0.1 * tension, ctx.currentTime, 0.3);
      }
    },
  };
}
