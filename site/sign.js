// The sign that hangs under the active island: the game's name, blurb and controls, word-wrapped on a
// small board. Pure: it measures text with the function it's given, so it fits whatever font is in use.
export const SIGN = {
  pad: 7, // from the board's edge to the words (the frame is 5 px)
  line: 10, // from one line's top to the next
  text: 8, // how tall a line of 8px Silkscreen is
  gap: 3, // extra space between the name, the blurb and the controls
  maxW: 200, // the widest a board gets
  margin: 4, // kept clear at the canvas's edges
  drop: 5, // from the island's hit box down to a hanging board
  min: 16, // the smallest a board gets
};

// Greedy word wrap. measure(text) is its width in pixels. A word wider than maxW gets a line to itself.
export function wrap(text, maxW, measure) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// The board's size and its rows of words. measure(text, style) is a width in pixels, where style is
// 'name', 'blurb' or 'controls' (the name is bold). An empty section is left out, gap and all.
export function layoutSign({ name, blurb, controls }, measure, maxW = SIGN.maxW) {
  const inner = maxW - 2 * SIGN.pad;
  const rows = [];
  let y = SIGN.pad;
  for (const [text, style] of [[name, 'name'], [blurb, 'blurb'], [controls, 'controls']]) {
    const lines = wrap(text ?? '', inner, (s) => measure(s, style));
    if (!lines.length) continue;
    if (rows.length) y += SIGN.gap;
    for (const line of lines) {
      rows.push({ text: line, style, y });
      y += SIGN.line;
    }
  }
  const widest = Math.max(0, ...rows.map((r) => measure(r.text, r.style)));
  return {
    w: Math.max(SIGN.min, Math.ceil(widest) + 2 * SIGN.pad),
    h: Math.max(SIGN.min, rows.length ? y - SIGN.line + SIGN.text + SIGN.pad : 2 * SIGN.pad),
    rows,
  };
}

// Where the board goes: centred under the island's hit box, hanging SIGN.drop below it (a); if that
// doesn't fit, above the island, but only when the whole board fits above it (b); otherwise it still
// hangs below, pulled up to stay inside the canvas but never past the middle of the hit box, so it may
// cover the island's underside and roots but never its top half (c). bounds: the visible canvas in
// stage pixels. hanging: true when it's under the island (so it has ropes).
export function placeSign([hx, hy, hw, hh], w, h, [bx, by, bw, bh]) {
  const x = Math.max(bx + SIGN.margin, Math.min(Math.round(hx + hw / 2 - w / 2), bx + bw - SIGN.margin - w));
  const below = hy + hh + SIGN.drop;
  if (below + h <= by + bh - SIGN.margin) return { x, y: below, hanging: true }; // (a)
  const above = hy - SIGN.drop - h;
  if (above >= by + SIGN.margin) return { x, y: above, hanging: false }; // (b)
  const y = Math.max(by + bh - SIGN.margin - h, hy + Math.floor(hh / 2)); // (c)
  return { x, y, hanging: true };
}
