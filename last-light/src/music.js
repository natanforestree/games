// The score, as pure data and rules: which layers play at each hour, and which notes each layer plays
// on each eighth-note step. audio.js turns these into sound. It's in A minor at 66 beats a minute,
// over a four-bar round of Am, F, Dm, E; the night adds a layer every hour, from a wind drone at 9 PM
// to a pounding score at 4 AM, and thins to the drone and the music box in the lulls. At dawn the
// sunrise theme turns to A major.
export const BPM = 66;
export const STEP = 60 / BPM / 2; // seconds per eighth note
export const BAR = 8; // steps

// MIDI notes: A3 C4 E4, F3 A3 C4, D3 F3 A3, E3 G#3 B3.
export const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];

export const LAYERS = ['drone', 'pulse', 'strings', 'musicbox', 'ticks', 'choir', 'toms', 'brass'];

// The layers playing: one more each hour during a wave; the drone and music box in a lull.
export function layersFor(phase, wave) {
  if (phase === 'wave') return LAYERS.slice(0, Math.min(LAYERS.length, wave + 1));
  if (phase === 'lull' || phase === 'dusk') return ['drone', 'musicbox'];
  return [];
}

export const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// A deterministic 0..1 value per (step, salt), so the music box's melody is the same every night.
function pick(step, salt) {
  let n = (step * 2654435761 + salt * 40503) >>> 0;
  n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0;
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

// The notes a layer starts on global step `step`: [{ note, len (steps), vel (0..1) }]. Percussion
// layers use note 0.
export function notesAt(layer, step) {
  const bar = Math.floor(step / BAR), beat = step % BAR;
  const chord = CHORDS[bar % CHORDS.length];
  switch (layer) {
    case 'drone':
      return beat === 0 && bar % 2 === 0 ? [{ note: 33, len: BAR * 2, vel: 0.5 }, { note: 40, len: BAR * 2, vel: 0.3 }] : [];
    case 'pulse':
      return beat === 0 ? [{ note: 0, len: 1, vel: 1 }] : beat === 1 ? [{ note: 0, len: 1, vel: 0.6 }] : [];
    case 'strings':
      return beat === 0 ? chord.map((n) => ({ note: n - 12, len: BAR, vel: 0.35 })) : [];
    case 'musicbox': {
      // Two or three bell notes a bar, from the chord an octave or two up.
      if (pick(step, 1) > (beat === 0 ? 0.9 : 0.3)) return [];
      const n = chord[Math.floor(pick(step, 2) * 3)] + (pick(step, 3) < 0.4 ? 24 : 12);
      return [{ note: n, len: 2, vel: 0.25 + pick(step, 4) * 0.2 }];
    }
    case 'ticks':
      return [{ note: 0, len: 1, vel: beat % 2 === 0 ? 0.5 : 0.25 }];
    case 'choir':
      return beat === 0 ? chord.map((n) => ({ note: n, len: BAR, vel: 0.2 })) : [];
    case 'toms':
      return beat === 4 || beat === 6 || (beat === 7 && bar % 2 === 1) ? [{ note: beat === 7 ? 45 : 40, len: 1, vel: 0.8 }] : [];
    case 'brass':
      return beat === 0 || beat === 3 ? [{ note: chord[0] - 24, len: 2, vel: 0.5 }] : [];
    default:
      return [];
  }
}

// The sunrise theme: A major, rising, about 12 seconds. [{ step, note, len, voice }]
export const DAWN = [
  ...[45, 52, 57, 61, 64, 69].map((note, i) => ({ step: i, note, len: 10 - i, voice: 'strings' })),
  ...[69, 73, 76, 81, 80, 76, 78, 81].map((note, i) => ({ step: 8 + i * 2, note, len: 3, voice: 'musicbox' })),
  { step: 24, note: 57, len: 8, voice: 'choir' },
  { step: 24, note: 61, len: 8, voice: 'choir' },
  { step: 24, note: 64, len: 8, voice: 'choir' },
];
