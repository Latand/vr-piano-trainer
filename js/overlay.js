// Builds the overlay in the keyboard frame: key outlines, lit keys, the hit line and the
// falling bars with their note names. Colours are the player's own palette (src/ui.cpp).
import { keyOutlines, glowRect, keyCentre, isBlack, LOW, HIGH, WHITE_COUNT, FRONT_Z, BACK_Z, BLACK_FRONT_Z, BLACK_HEIGHT } from './geometry.js';
import { FALL_HEIGHT, WATERFALL_Z, LABEL_MIN_HEIGHT } from './scene.js';
import { PANEL_BAR_ABOVE } from './place.js';
import { sub, add, scale, cross, normalize, length } from './mat.js';
import { buildHands3d } from './guide-hands.js';

export const INK = [1, 1, 1];
export const GLASS = [0.063, 0.071, 0.094];
export const ACCENT = [0.486, 0.424, 1.0]; // violet: the right hand
export const MINT = [0.235, 0.878, 0.753]; // mint: the left hand
export const HAND_COLOUR = { right: ACCENT, left: MINT };
// «Підлаштувати»: the frame, its handles and the controllers' rays in amber, a colour neither hand
// uses, so they read apart from the cues.
export const ADJUST = [1.0, 0.7, 0.16];
// The song under «Підлаштувати»: its bars and cues at this share of their alpha.
export const ADJUST_FADE = 0.3;
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
// The finger digits (docs/piano-fingering-design.md §4): cream, a colour of almost no hue, so it
// reads apart from both hands' colours and from amber, always over a dark band.
export const GUIDE = [1.0, 0.94, 0.82];

// On a white key (and the grey a passthrough camera makes of it) a pale cue reads by hue alone:
// there the keys take a deep tone of each hand's colour, the left hand's no lighter than the
// right's. A black key keeps the light colours of the bars.
export const KEY_COLOUR = { right: [0.33, 0.27, 0.8], left: [0, 0.4, 0.33] };
export function cueColour(hand, black) {
  return black ? HAND_COLOUR[hand] || ACCENT : KEY_COLOUR[hand] || KEY_COLOUR.right;
}

const rgba = (c, a) => [c[0], c[1], c[2], a];
// How a coming key shows, by its rank: the next onset of its hand, the one after, and every later
// one. Each fills from the back as its note nears (fill: the fill's alpha), and each has its own
// shape: the nearest a thick outline with the fill's front edge marked, the next a thin solid
// outline, the later ones the key's corners only.
export const RANK_STYLE = [
  { fill: 0.6, line: 1, width: 0.0024, shape: 'outline', edge: true },
  { fill: 0.32, line: 0.8, width: 0.0015, shape: 'outline', edge: false },
  { fill: 0.2, line: 0.65, width: 0.0015, shape: 'corners', edge: false },
];
const keyOrder = k => (k.level === 'now' ? -1 : k.rank);
// Each cue stands this far in from its key's sides, so cues on neighbouring keys keep a gap
// between them.
export const CUE_INSET = 0.0015;
export function cueRect(midi, pitch) {
  const g = glowRect(midi, pitch);
  return { ...g, x0: g.x0 + CUE_INSET, x1: g.x1 - CUE_INSET };
}
// The key to press now: its deep fill, ringed in white inside a dark band (no coming key has a
// ring), so the press reads as the strongest mark.
// inset: from the cue's sides (inside its dark outline); band: the dark band's width; core: the
// white line's, in the band's middle. A black key is narrower: a narrower band.
export const NOW_RING = { white: { inset: 0.0022, band: 0.0026, core: 0.0012 }, black: { inset: 0.0022, band: 0.002, core: 0.001 } };
const darker = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const lighter = (c, k) => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];

// The note-name atlas: one row of letters, white on transparent.
export function letterAtlas(doc = document) {
  const cell = 96;
  const canvas = doc.createElement('canvas');
  canvas.width = cell * LETTERS.length;
  canvas.height = cell;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${cell * 0.78}px system-ui, sans-serif`;
  LETTERS.forEach((l, i) => ctx.fillText(l, cell * (i + 0.5), cell * 0.54));
  return canvas;
}

function letterUv(letter) {
  const i = LETTERS.indexOf(letter);
  const u0 = i / LETTERS.length, u1 = (i + 1) / LETTERS.length;
  // Bottom-left, bottom-right, top-right, top-left: canvas rows run downwards.
  return [[u0, 1], [u1, 1], [u1, 0], [u0, 0]];
}

// The finger atlas: the digits 1-5 in cream and the palm's «П» and «Л» in white (tinted by the
// hand's colour when drawn), each with a dark halo an eighth of its size, so it reads over a bar,
// a white keyboard and a dark room. family: the panel's bold face once loaded.
export const FINGER_GLYPHS = ['1', '2', '3', '4', '5', 'П', 'Л'];
// One glyph a cell; a glyph's cap height is CAP of the cell's height (Manrope's figures stand
// 0.72 em tall), so a quad of height size / CAP shows a digit `size` tall.
export const GLYPH_CELL = { w: 176, h: 192 }, CAP = 0.8;
const EM_CAP = 0.72;
export function fingerAtlas(doc = document, family = 'Manrope, system-ui, sans-serif') {
  const { w, h } = GLYPH_CELL;
  const canvas = doc.createElement('canvas');
  canvas.width = w * FINGER_GLYPHS.length;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const px = (CAP * h) / EM_CAP, cap = CAP * h;
  ctx.font = `800 ${px}px ${family}`;
  ctx.lineJoin = 'round';
  FINGER_GLYPHS.forEach((g, i) => {
    const x = w * (i + 0.5), y = (h + cap) / 2;
    ctx.lineWidth = cap / 4; // a dark halo an eighth of the glyph's height on each side
    ctx.strokeStyle = 'rgba(16, 18, 24, 0.92)';
    ctx.strokeText(g, x, y);
    ctx.fillStyle = i < 5 ? 'rgb(255, 240, 209)' : '#fff';
    ctx.fillText(g, x, y);
  });
  return canvas;
}
export function glyphUv(glyph) {
  const i = FINGER_GLYPHS.indexOf(glyph);
  const u0 = i / FINGER_GLYPHS.length, u1 = (i + 1) / FINGER_GLYPHS.length;
  return [[u0, 1], [u1, 1], [u1, 0], [u0, 0]];
}
// The digit on a falling bar, its height: so tall on a white key's bar and on a black key's, at
// least `least` of that on a bar too short for it (it then stands over the bar's top), its bottom
// `lift` above the bar's lower end. The note's letter goes above it on a bar `both` tall, else the
// digit takes the letter's place.
export const DIGIT = { white: 0.016, black: 0.013, least: 0.75, lift: 0.002, both: 0.036 };
// A glyph `size` tall as a quad at (x, bottom) -> [x0, x1, y0, y1]
export function glyphBox(x, bottom, size) {
  const hq = size / CAP, wq = (hq * GLYPH_CELL.w) / GLYPH_CELL.h;
  return [x - wq / 2, x + wq / 2, bottom - (hq - size) / 2, bottom - (hq - size) / 2 + hq];
}

// keys, bars, labels: Batch objects to fill. frame from scene.frameAt, or null for the keys'
// outlines alone (while calibrating: no song over the keys being placed). look: how the keyboard
// shows in «Підлаштувати» and while calibrating (keyboardLook). guide: with the guide hands on,
// {hands: scene.handsAt} and the batches `keep` (where the hands may not draw: every black key's
// cue, whose light colour a pale hand would wash out, and every bar with its digit; render.js
// draws it into depth alone, first), `hands` (next, as a shell, so every key cue, bar and digit
// lies over the hands), `palms` (the finger atlas: the hands' letters, after them) and `fingers`
// (the finger atlas: the bars' digits, after the labels); without it nothing of the guide is
// drawn.
export function buildOverlay({ keys, bars, labels, keep = null, hands = null, palms = null, fingers = null }, frame, pitch, { outlines = true, look = null, guide = null } = {}) {
  const right = WHITE_COUNT * pitch;
  if (outlines) drawOutlines(keys, pitch, !!(look && look.dim));
  if (!frame) { if (look) drawLook(keys, pitch, look); return; }
  // in «Підлаштувати» the song goes on faint under the frame
  const fade = look && look.mode === 'adjust' ? ADJUST_FADE : 1;
  const rgba = (c, a) => [c[0], c[1], c[2], a * fade];
  // The waterfall's floor: the hit line, and faint guides at every C so a bar's key is easy to
  // find. Both are a dark band with a light core, so they show over the white body of the
  // keyboard and over a dark room alike.
  bars.rectXY(0, right, -0.0025, 0.0025, WATERFALL_Z + 0.0008, rgba(GLASS, 0.7));
  bars.rectXY(0, right, -0.0008, 0.0008, WATERFALL_Z + 0.001, rgba(INK, 0.9));
  for (let m = LOW; m <= HIGH; m += 12) {
    const x = keyCentre(m, pitch) - pitch / 2;
    bars.rectXY(x - 0.001, x + 0.001, 0.0025, FALL_HEIGHT, WATERFALL_Z - 0.0012, rgba(GLASS, 0.28));
    bars.rectXY(x - 0.0003, x + 0.0003, 0.0025, FALL_HEIGHT, WATERFALL_Z - 0.001, rgba(INK, 0.3));
  }
  // The keys are the main cue. A coming key fills from its back edge towards the player and is
  // full when its note starts; the nearest onset of each hand is the strongest, and each rank has
  // its own shape (RANK_STYLE). A key whose note sounds is filled deep, and at the start it
  // flashes past its edges.
  // Drawn farthest rank first, so a nearer cue lies over a farther one.
  const order = [...frame.keys].sort((a, b) => keyOrder(b[1]) - keyOrder(a[1]));
  for (const [midi, k] of order) {
    const c = cueColour(k.hand, isBlack(midi));
    const g = cueRect(midi, pitch);
    if (guide && keep && isBlack(midi)) keepClear(keep, g);
    const y = g.y + 0.0015;
    if (k.level === 'now') {
      // Over a white key a deep colour stands out more than a pale one; the white ring marks the
      // press, and at its start the key flashes past its edges in the hand's light colour.
      // (sideways only into its own key's inset, so a neighbour's cue keeps its gap)
      if (k.flash > 0) {
        const grow = 0.007 * k.flash, side = (CUE_INSET - 0.0005) * k.flash;
        keys.rectXZ(g.x0 - side, g.x1 + side, g.z0 - grow, g.z1 + grow, y - 0.0003, rgba(lighter(HAND_COLOUR[k.hand] || ACCENT, 0.2), 0.9 * k.flash));
      }
      keys.rectXZ(g.x0, g.x1, g.z0, g.z1, y, rgba(c, 1));
      keys.outlineXZ(g.x0, g.x1, g.z0, g.z1, y + 0.0005, 0.0022, rgba(darker(c, 0.5), 1));
      const r = NOW_RING[isBlack(midi) ? 'black' : 'white'];
      const ring = (d, t, colour, lift) => keys.outlineXZ(g.x0 + d, g.x1 - d, g.z0 + d, g.z1 - d, y + lift, t, colour);
      ring(r.inset, r.band, rgba(GLASS, 0.9), 0.0007);
      ring(r.inset + (r.band - r.core) / 2, r.core, rgba(INK, 1), 0.0009);
    } else {
      const r = RANK_STYLE[Math.min(k.rank, RANK_STYLE.length - 1)];
      const z = g.z0 + (g.z1 - g.z0) * k.progress;
      if (k.progress > 0) keys.rectXZ(g.x0, g.x1, g.z0, z, y, rgba(c, r.fill));
      if (r.shape === 'corners') keys.cornersXZ(g.x0, g.x1, g.z0, g.z1, y + 0.0005, r.width, Math.min(0.006, (g.x1 - g.x0) / 3), rgba(c, r.line));
      else keys.outlineXZ(g.x0, g.x1, g.z0, g.z1, y + 0.0005, r.width, rgba(c, r.line));
      // the front of the fill, moving towards the touch line
      if (r.edge && k.progress > 0) keys.rectXZ(g.x0, g.x1, Math.max(g.z0, z - 0.0015), z, y + 0.0003, rgba(darker(c, 0.7), 0.95));
    }
  }
  for (const b of frame.bars) {
    const base = HAND_COLOUR[b.hand] || ACCENT;
    const c = b.black ? darker(base, 0.62) : base;
    const z = WATERFALL_Z + (b.black ? 0.003 : 0.002);
    const x0 = b.x - b.width / 2, x1 = b.x + b.width / 2;
    // The bars are context for the keys: the coming ones a little paler than the sounding ones.
    bars.rectXY(x0, x1, b.y0, b.y1, z, rgba(b.active ? lighter(c, 0.25) : c, b.active ? 0.95 : 0.62));
    bars.outlineXY(x0, x1, b.y0, b.y1, z + 0.0002, 0.0008, rgba(lighter(c, 0.5), b.active ? 0.9 : 0.7));
    if (b.active) bars.rectXY(x0 - 0.002, x1 + 0.002, 0, 0.006, z + 0.0004, rgba(lighter(c, 0.6), 0.95));
    const h = b.y1 - b.y0;
    if (guide && keep) keep.rectXY(x0 - 0.0025, x1 + 0.0025, Math.min(0, b.y0) - 0.001, b.y1 + 0.001, z, KEEP);
    if (guide && b.finger > 0) {
      const full = b.black ? DIGIT.black : DIGIT.white;
      const size = Math.max(full * DIGIT.least, Math.min(full, h - 2 * DIGIT.lift));
      const bottom = b.y0 + DIGIT.lift;
      const [x0, x1, y0, y1] = glyphBox(b.x, bottom, size);
      fingers.rectXY(x0, x1, y0, y1, z + 0.0008, rgba([1, 1, 1], 1), glyphUv(String(b.finger)));
      if (keep) keep.rectXY(x0, x1, y0, y1, z, KEEP);
      // the letter above the digit where the bar has room for both, else the digit in its place
      const at = bottom + size + 0.003, s = Math.min(b.width * 0.8, b.y1 - at - 0.002, 0.016);
      if (b.label && h >= DIGIT.both && s > 0.006) labels.rectXY(b.x - s / 2, b.x + s / 2, at, at + s, z + 0.0006, rgba([0.06, 0.07, 0.09], 0.95), letterUv(b.label));
    } else if (b.label && h >= LABEL_MIN_HEIGHT) {
      const s = Math.min(b.width * 0.8, h - 0.004, 0.016);
      const y = b.y0 + 0.002;
      labels.rectXY(b.x - s / 2, b.x + s / 2, y, y + s, z + 0.0006, rgba([0.06, 0.07, 0.09], 0.95), letterUv(b.label));
    }
  }
  if (guide) buildHands(hands, palms, guide.hands, pitch, fade);
  // the frame of «Підлаштувати» over the faint song
  if (look) drawLook(keys, pitch, look);
}

// Where a black key's cue can draw (its flash past its ends, its outline): the hands keep clear.
const KEEP = [0, 0, 0, 1];
function keepClear(keep, g) {
  keep.rectXZ(g.x0 - CUE_INSET, g.x1 + CUE_INSET, g.z0 - 0.008, g.z1 + 0.008, g.y + 0.002, KEEP);
}

// The guide hands (design §4.1-§4.2): guide-hands.js, a translucent hand on the keys for each
// hand, «П» or «Л» in the hand's colour on the back of its palm, HAND_LETTER tall.
export const HAND_LETTER = 0.016;
export function buildHands(batch, letters, hands, pitch, fade = 1) {
  const h = HAND_LETTER / CAP;
  buildHands3d(batch, letters, hands, pitch, { fade, letter: { w: (h * GLYPH_CELL.w) / GLYPH_CELL.h, h, uv: glyphUv, colour: HAND_COLOUR } });
}

// White keys: front and back edges, and the gaps between them, which run all the way back only
// where no black key covers them (E-F and B-C). Dark lines show on white keys, light ones on black
// keys.
function drawOutlines(keys, pitch, dim = false) {
  const right = WHITE_COUNT * pitch;
  const line = rgba(GLASS, dim ? 0.25 : 0.55), t = 0.0008, y = 0.001;
  keys.rectXZ(0, right, FRONT_Z - t, FRONT_Z, y, line);
  keys.rectXZ(0, right, BACK_Z, BACK_Z + t, y, line);
  for (let i = 0; i <= WHITE_COUNT; i++) {
    const covered = i > 0 && i < WHITE_COUNT && ![3, 0].includes(i % 7);
    keys.rectXZ(i * pitch - t / 2, i * pitch + t / 2, covered ? BLACK_FRONT_Z : BACK_Z, FRONT_Z, y, line);
  }
  for (const k of keyOutlines(pitch)) {
    if (!k.black) continue;
    keys.outlineXZ(k.x0, k.x1, k.z0, k.z1, k.y + 0.001, t, rgba(INK, dim ? 0.25 : 0.5));
  }
}

// The keyboard as the room would show it: for the desktop preview only.
// The drawn piano's body in the keyboard frame: {x: [left, right], y: [bottom, top], z: [back, front]}.
export const fakeBody = pitch => ({ x: [-0.102, WHITE_COUNT * pitch + 0.108], y: [-0.07, 0], z: [BACK_Z - 0.12, FRONT_Z + 0.012] });

export function buildFakeKeyboard(batch, pitch) {
  const { x: [left, right], y: [bottom], z: [back, front] } = fakeBody(pitch);
  batch.rectXZ(left, right, back, front, -0.012, [0.86, 0.86, 0.84, 1]); // body
  batch.rectXY(left, right, bottom, -0.012, front, [0.78, 0.78, 0.76, 1]);
  for (const k of keyOutlines(pitch)) {
    if (k.black) {
      batch.rectXZ(k.x0, k.x1, k.z0, k.z1, BLACK_HEIGHT, [0.08, 0.08, 0.09, 1]);
      batch.rectXY(k.x0, k.x1, 0, BLACK_HEIGHT, k.z1, [0.04, 0.04, 0.05, 1]);
    } else {
      batch.rectXZ(k.x0 + 0.0006, k.x1 - 0.0006, k.z0, k.z1, 0, [0.97, 0.97, 0.95, 1]);
      batch.rectXY(k.x0 + 0.0006, k.x1 - 0.0006, -0.012, 0, k.z1, [0.9, 0.9, 0.88, 1]);
    }
  }
}

// The bar over the panel's top edge that carries the panel (place.js panelBarAt), in the panel
// frame, in the accent while held.
export function buildPanelBar(batch, width, height, { held = false } = {}) {
  const y = height / 2 + PANEL_BAR_ABOVE, x = width / 2 - 0.02;
  const fill = held ? rgba(ACCENT, 0.9) : rgba(INK, 0.5), rim = held ? rgba(lighter(ACCENT, 0.3), 1) : rgba(INK, 0.95);
  batch.rectXY(-x, x, y - 0.004, y + 0.004, 0, fill);
  batch.outlineXY(-x - 0.002, x + 0.002, y - 0.006, y + 0.006, 0, 0.002, rim);
}

// What a ray or a fingertip is on, drawn over the panel each frame in the panel frame (the texture
// is not drawn again for it, brief §4.5): a white ring 2 mm round each target aimed at and its fill
// 8 % lighter, and where each ray meets the panel a white dot 6 mm across with a dark rim.
// targets: panel.js layout boxes {x0, x1, y0, y1, r}; cursors: [x, y] on the panel.
export const AIM = { ring: 0.002, z: 0.0006, dot: 0.003, rim: 0.0012 };
export function buildPanelAim(batch, targets = [], cursors = []) {
  const z = AIM.z, t = AIM.ring;
  const corners = (b, r) => [
    [[b.x1 - r, b.y1 - r, z], [1, 0, 0], [0, 1, 0]], [[b.x0 + r, b.y1 - r, z], [0, 1, 0], [-1, 0, 0]],
    [[b.x0 + r, b.y0 + r, z], [-1, 0, 0], [0, -1, 0]], [[b.x1 - r, b.y0 + r, z], [0, -1, 0], [1, 0, 0]]];
  for (const b of targets) {
    const r = Math.max(0, Math.min(b.r || 0, (b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2));
    const fill = rgba(INK, 0.08), ring = rgba(INK, 1);
    batch.rectXY(b.x0 + r, b.x1 - r, b.y0, b.y1, z, fill);
    batch.rectXY(b.x0, b.x0 + r, b.y0 + r, b.y1 - r, z, fill);
    batch.rectXY(b.x1 - r, b.x1, b.y0 + r, b.y1 - r, z, fill);
    batch.rectXY(b.x0 + r, b.x1 - r, b.y1, b.y1 + t, z, ring);
    batch.rectXY(b.x0 + r, b.x1 - r, b.y0 - t, b.y0, z, ring);
    batch.rectXY(b.x0 - t, b.x0, b.y0 + r, b.y1 - r, z, ring);
    batch.rectXY(b.x1, b.x1 + t, b.y0 + r, b.y1 - r, z, ring);
    for (const [c, u, v] of corners(b, r)) {
      if (r > 0) batch.ring(c, u, v, 0, r, fill, 0.25, 32);
      batch.ring(c, u, v, r, r + t, ring, 0.25, 32);
    }
  }
  for (const [x, y] of cursors) {
    batch.ring([x, y, 2 * z], [1, 0, 0], [0, 1, 0], AIM.dot, AIM.dot + AIM.rim, rgba(GLASS, 0.95), 1, 24);
    batch.ring([x, y, 2 * z], [1, 0, 0], [0, 1, 0], 0, AIM.dot, rgba(INK, 1), 1, 24);
  }
}

// Calibration marks in the room: a white ring round each controller tip (`tips`), and a mint dot
// where the first touch was taken (`first`). `holding` ({tip, progress}): a mint ring filling.
export function buildCalibrationMarks(batch, { tips = [], holding = null, first = null } = {}) {
  const flat = [[1, 0, 0], [0, 0, -1]];
  for (const tip of tips) batch.ring(tip, ...flat, 0.012, 0.0145, rgba(INK, 0.75));
  if (holding && holding.progress > 0) batch.ring(holding.tip, ...flat, 0.0145, 0.023, rgba(MINT, 0.95), holding.progress);
  if (first) batch.ring(first, ...flat, 0, 0.007, rgba(MINT, 0.95));
}

// How the keyboard shows beyond its keys and cues (docs/piano-trainer-v2.md §6.4).
// look: {mode: 'play' | 'adjust' | 'calibrate', hover, grabbed, dim, target: 'low' | 'high' | null,
// pulse: 0..1}. In «Підлаштувати» a frame round the keys (its handles: buildHandles): a dark
// band with an amber core (ADJUST), so it shows on a white keyboard body and on a dark room alike
// and reads apart from either hand's cues; wider while a controller's ray is on the keys, wider
// still and brighter while one slides them (buildOverlay fades the song under it). Calibrating
// over a placed keyboard: its outlines faint (dim) and the key to touch outlined in the accent,
// its fill pulsing.
export const FRAME_LOOK = {
  idle: { band: rgba(GLASS, 0.85), core: rgba(ADJUST, 1), wide: 0.004, coreWide: 0.002 },
  hover: { band: rgba(GLASS, 0.9), core: rgba(ADJUST, 1), wide: 0.007, coreWide: 0.003 },
  grabbed: { band: rgba(darker(ADJUST, 0.35), 0.95), core: rgba(lighter(ADJUST, 0.4), 1), wide: 0.01, coreWide: 0.004 },
};
export function drawLook(keys, pitch, look) {
  const y = 0.0012;
  if (look.mode === 'adjust') {
    const f = FRAME_LOOK[look.grabbed ? 'grabbed' : look.hover ? 'hover' : 'idle'];
    const x0 = -f.wide, x1 = WHITE_COUNT * pitch + f.wide, z0 = BACK_Z - f.wide, z1 = FRONT_Z + f.wide;
    keys.outlineXZ(x0, x1, z0, z1, y, f.wide, f.band);
    const m = (f.wide - f.coreWide) / 2;
    keys.outlineXZ(x0 + m, x1 - m, z0 + m, z1 - m, y + 0.0002, f.coreWide, f.core);
  }
  if (look.mode === 'calibrate' && look.target) {
    const k = keyOutlines(pitch).find(o => o.midi === (look.target === 'high' ? HIGH : LOW));
    const pulse = Math.max(0, Math.min(1, look.pulse ?? 1));
    keys.rectXZ(k.x0, k.x1, k.z0, k.z1, y, rgba(ACCENT, 0.2 + 0.3 * pulse));
    keys.outlineXZ(k.x0 - 0.003, k.x1 + 0.003, k.z0 - 0.003, k.z1 + 0.003, y + 0.0002, 0.003, rgba(GLASS, 0.92));
    keys.outlineXZ(k.x0 - 0.002, k.x1 + 0.002, k.z0 - 0.002, k.z1 + 0.002, y + 0.0004, 0.0015, rgba(lighter(ACCENT, 0.2), 1));
  }
}

// The handles of «Підлаштувати» in the room (XrRun.drawState handles: {id, point, segment, state},
// docs/piano-keyboard-handles-design.md §4.2, §4.5), drawn in world space so the keys' depth
// stretch never bends them. A corner: an amber disc in a dark band, lying on the key tops and a
// second one upright facing the eyes (so it reads from a seat that sees the key tops at 21°), a
// white dot with a dark rim on the exact corner. The height handle: a vertical double arrow, amber
// in a dark band, facing the eyes. Hovered: bigger and lighter; held: light amber in a wider band.
// The arrow hovered or held also stands in a ring (ARROW_RING), amber in its dark band, so a ray
// on it reads apart from the bare arrow at a glance.
// eye: where the eyes are (the upright shapes face it).
export const HANDLE_LOOK = {
  idle: { r: 0.012, band: 0.0025, core: rgba(ADJUST, 1), edge: rgba(GLASS, 0.9), arrow: 0.012, ring: false },
  hover: { r: 0.016, band: 0.003, core: rgba(lighter(ADJUST, 0.3), 1), edge: rgba(GLASS, 0.92), arrow: 0.016, ring: true },
  held: { r: 0.016, band: 0.0045, core: rgba(lighter(ADJUST, 0.55), 1), edge: rgba(darker(ADJUST, 0.3), 0.95), arrow: 0.016, ring: true },
};
export const HANDLE_DOT = { r: 0.0015, rim: 0.0008 };
export const ARROW = { shaft: 0.3, head: 0.012 }; // the shaft's width as a share of the arrow's, the heads' height
export const ARROW_RING = { gap: 0.008, wide: 0.003 }; // the ring: this far outside the arrow's tips, its core this wide
export function buildHandles(batch, handles = [], eye = null) {
  for (const h of handles) {
    const f = HANDLE_LOOK[h.state] || HANDLE_LOOK.idle;
    // towards the eyes, level: the upright shapes face it
    const to = eye ? sub(eye, h.point) : [0, 0, 1];
    let face = normalize([to[0], 0, to[2]]);
    if (length([to[0], 0, to[2]]) < 1e-6) face = [0, 0, 1];
    const side = [face[2], 0, -face[0]];
    if (h.segment) { buildArrow(batch, h.segment, f, side, face); continue; }
    const p = h.point;
    // flat on the key tops (the point stands 1 mm over them), then upright facing the eyes
    for (const [u, v, lift] of [[[1, 0, 0], [0, 0, -1], [0, 0.0003, 0]], [side, [0, 1, 0], scale(face, 0.0003)]]) {
      const c = add(p, lift);
      batch.ring(c, u, v, f.r, f.r + f.band, f.edge, 1, 28);
      batch.ring(add(c, lift), u, v, 0, f.r, f.core, 1, 28);
      batch.ring(add(c, scale(lift, 2)), u, v, HANDLE_DOT.r, HANDLE_DOT.r + HANDLE_DOT.rim, rgba(GLASS, 0.95), 1, 16);
      batch.ring(add(c, scale(lift, 3)), u, v, 0, HANDLE_DOT.r, rgba(INK, 1), 1, 16);
    }
  }
}
// A double arrow from a to b (vertical), `f.arrow` wide, upright facing the eyes, in its band.
function buildArrow(batch, [a, b], f, side, face) {
  const up = normalize(sub(b, a)), H = length(sub(b, a));
  const at = (x, y, out = 0) => add(add(add(a, scale(side, x)), scale(up, y)), scale(face, out));
  const shape = (grow, colour, out) => {
    const w = f.arrow / 2 + grow, s = (f.arrow * ARROW.shaft) / 2 + grow, hh = ARROW.head;
    batch.quad(at(-s, hh - grow, out), at(s, hh - grow, out), at(s, H - hh + grow, out), at(-s, H - hh + grow, out), colour);
    batch.quad(at(-w, hh, out), at(w, hh, out), at(0, -grow * 1.6, out), at(0, -grow * 1.6, out), colour);
    batch.quad(at(w, H - hh, out), at(-w, H - hh, out), at(0, H + grow * 1.6, out), at(0, H + grow * 1.6, out), colour);
  };
  shape(f.band, f.edge, 0);
  shape(0, f.core, 0.0004);
  if (f.ring) {
    const mid = at(0, H / 2, 0.0002), r = H / 2 + ARROW_RING.gap;
    batch.ring(mid, side, up, r - f.band, r + ARROW_RING.wide + f.band, f.edge, 1, 40);
    batch.ring(add(mid, scale(face, 0.0002)), side, up, r, r + ARROW_RING.wide, f.core, 1, 40);
  }
}

export const RAY_WIDTH = 0.002;
export const RAY_DOT = 0.006; // the dot's radius where a ray meets the keys (12 mm across)
export const RAY_RIM = 0.0018;

// The controllers' rays in «Підлаштувати», in the room (XrRun.drawState rays: {from, to, hit}):
// a line, white, or amber (ADJUST, neither hand's colour) where it meets the keys, there ending in
// an amber dot with a dark rim. Each line is two crossed strips, so it shows from any side.
export function buildRays(batch, rays = []) {
  for (const { from, to, hit } of rays) {
    const d = sub(to, from);
    if (length(d) < 1e-6) continue;
    const dir = normalize(d);
    const u = normalize(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const v = cross(dir, u);
    const colour = hit ? rgba(ADJUST, 0.95) : rgba(INK, 0.6);
    for (const side of [u, v]) {
      const h = scale(side, RAY_WIDTH / 2);
      batch.quad(sub(from, h), add(from, h), add(to, h), sub(to, h), colour);
    }
    if (hit) {
      for (const [a, b] of [[u, v], [[1, 0, 0], [0, 0, -1]]]) {
        batch.ring(to, a, b, RAY_DOT, RAY_DOT + RAY_RIM, rgba(GLASS, 0.9), 1, 20);
        batch.ring(to, a, b, 0, RAY_DOT, rgba(ADJUST, 1), 1, 20);
      }
    }
  }
}
