// What happened during an update, for sound, effects and the HUD to react to. The events live in a
// fixed pool that each update reuses, so nothing is allocated: read state.events[0 .. eventCount).
//
//   type          x, y            a                    b
//   shot          you             0 rifle, 1 shotgun
//   dry           you             weapon               (fired with nothing loaded)
//   reload        you             weapon               (a round or both shells went in)
//   switch        you             weapon now raising
//   hit           the creature    kind                 1 if it died
//   flareThrow    where it lands
//   flareOut      where it was
//   hurt          the attacker    damage
//   windup        the creature    kind                 (a gaunt or the Mother winding up)
//   shriek        the leaper                           (crouching to leap)
//   leap          the leaper
//   birth         the Mother
//   spawn         the creature    kind
//   pickup        the spot        0 flare, 1 shells, 2 shotgun
//   emberDrop     where it fell   value
//   ember         where it was    value                (you took it)
//   emberOut      where it was                         (it cooled out)
//   offer         the stove       how many cards
//   upgrade       you             upgrade id
//   alight        the creature    kind                 (set burning)
//   wave          -               wave index
//   lull          -               the next wave's index
//   dawn / dead   -
export const MAX_EVENTS = 128;

export function createEvents() {
  return Array.from({ length: MAX_EVENTS }, () => ({ type: '', x: 0, y: 0, a: 0, b: 0 }));
}

export function emit(state, type, x = 0, y = 0, a = 0, b = 0) {
  if (state.eventCount >= MAX_EVENTS) return;
  const e = state.events[state.eventCount++];
  e.type = type;
  e.x = x;
  e.y = y;
  e.a = a;
  e.b = b;
}
