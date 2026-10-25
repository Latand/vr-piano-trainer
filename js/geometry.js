// The Yamaha NP-12's 61 keys (docs/piano-trainer-design.md §3.3), in metres.
// Keyboard frame: x to the right along the keys from the left edge of the lowest C, y up from
// the top of the white keys, z towards the player. z = 0 is the touch line, TOUCH_FROM_FRONT
// behind the front edge of the white keys: where a fingertip presses a key.

export const LOW = 36; // lowest C without transposition (Yamaha calls it C1)
export const HIGH = 96;
export const KEY_COUNT = HIGH - LOW + 1;
export const WHITE_COUNT = 36;
// White key pitch from the photos and the spec sheet's 1036 mm body; stretching by the handles fits it.
export const WHITE_PITCH = 0.0228;
// Lengths and heights below were not measured (design §3.3). The white keys' length is the
// default depth: the back corner handles fit it to the real keys (docs/piano-keyboard-handles-design.md
// §4.4), within DEPTH_RANGE.
export const WHITE_LEN = 0.135;
export const DEPTH_RANGE = [0.11, 0.17];
export const TOUCH_FROM_FRONT = 0.03;
export const BLACK_LEN = 0.085;
export const BLACK_HEIGHT = 0.011;
export const BLACK_WIDTH = 0.58; // in white pitches
export const FRONT_Z = TOUCH_FROM_FRONT;
export const BACK_Z = TOUCH_FROM_FRONT - WHITE_LEN;
export const BLACK_FRONT_Z = BACK_Z + BLACK_LEN;
// The part of a white key in front of the black keys that lights (design §7.1).
export const WHITE_GLOW_LEN = 0.045;

const WHITE_STEP = [0, null, 1, null, 2, 3, null, 4, null, 5, null, 6];
// Centre of each black key, in white pitches from the left edge of its octave's C.
const BLACK_CENTRE = { 1: 0.9, 3: 2.1, 6: 3.86, 8: 5.0, 10: 6.14 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function inRange(midi) {
  return Number.isInteger(midi) && midi >= LOW && midi <= HIGH;
}

export function isBlack(midi) {
  return WHITE_STEP[((midi % 12) + 12) % 12] === null;
}

export function noteName(midi) {
  return NAMES[((midi % 12) + 12) % 12];
}

// Number of the white key (0 for the lowest C); null for a black key.
export function whiteIndex(midi) {
  const step = WHITE_STEP[(midi - LOW) % 12];
  if (step === null) return null;
  return Math.floor((midi - LOW) / 12) * 7 + step;
}

// Centre of the key along x, in metres, for a white pitch w.
export function keyCentre(midi, w = WHITE_PITCH) {
  const octave = Math.floor((midi - LOW) / 12);
  const semitone = (midi - LOW) % 12;
  if (WHITE_STEP[semitone] !== null) return (octave * 7 + WHITE_STEP[semitone] + 0.5) * w;
  return (octave * 7 + BLACK_CENTRE[semitone]) * w;
}

export function keyWidth(midi, w = WHITE_PITCH) {
  return isBlack(midi) ? BLACK_WIDTH * w : w;
}

// The lit part of a key: x0..x1, z0 (back)..z1 (front), at height y.
export function glowRect(midi, w = WHITE_PITCH) {
  const c = keyCentre(midi, w);
  const half = keyWidth(midi, w) / 2;
  if (isBlack(midi)) return { x0: c - half, x1: c + half, z0: BACK_Z, z1: BLACK_FRONT_Z, y: BLACK_HEIGHT };
  return { x0: c - half, x1: c + half, z0: FRONT_Z - WHITE_GLOW_LEN, z1: FRONT_Z, y: 0 };
}

// Every key outline, white keys first so black keys draw over them.
export function keyOutlines(w = WHITE_PITCH) {
  const keys = [];
  for (let m = LOW; m <= HIGH; m++) if (!isBlack(m)) keys.push({ midi: m, ...outline(m, w) });
  for (let m = LOW; m <= HIGH; m++) if (isBlack(m)) keys.push({ midi: m, ...outline(m, w) });
  return keys;
}

function outline(midi, w) {
  const c = keyCentre(midi, w);
  const half = keyWidth(midi, w) / 2;
  if (isBlack(midi)) return { black: true, x0: c - half, x1: c + half, z0: BACK_Z, z1: BLACK_FRONT_Z, y: BLACK_HEIGHT };
  return { black: false, x0: c - half, x1: c + half, z0: BACK_Z, z1: FRONT_Z, y: 0 };
}
