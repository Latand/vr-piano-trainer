// The panel's icons and pictures as path data, drawn into a 2D canvas (Path2D): the line icons on a
// 24-unit grid, the players' signs, the moves of the warm-up without keys, the controller's parts and the 61 keys of the calibration. All drawn here from scratch (no
// emoji, no arrow characters: the headset's fonts may draw those as emoji, docs/piano-trainer-v2.md
// §6.3). The design they follow: docs/ui-prototypes/<A studio> on the design branch, brief
// docs/trainer-ui-brief.md §4.8 and §5.1.

// Line icons, 24 units: s is stroked (filled too in the 'fill' style when f), solid is filled.
export const ICONS = {
  back: [{ s: 'M15 4.5 7.5 12 15 19.5' }],
  next: [{ s: 'M9 4.5 16.5 12 9 19.5' }],
  close: [{ s: 'M6 6 18 18M18 6 6 18' }],
  play: [{ solid: 'M7.5 4.2v15.6a.8.8 0 0 0 1.2.7l12-7.8a.8.8 0 0 0 0-1.4l-12-7.8a.8.8 0 0 0-1.2.7z' }],
  pause: [{ solid: 'M6 4.5h4v15H6zM14 4.5h4v15h-4z' }],
  restart: [{ s: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3' }, { s: 'M4.5 3.5v4.5H9' }],
  prev: [{ s: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3' }, { s: 'M19.5 3.5v4.5H15' }],
  loop: [{ s: 'M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19' }, { s: 'M16 3l3 3-3 3' }, { s: 'M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5' }, { s: 'M8 21l-3-3 3-3' }],
  tempo: [{ s: 'M9 3.5h6l3.5 17h-13z', f: 1 }, { s: 'M12 15.5 17.5 6' }],
  level: [{ s: 'M5 20v-3M10 20v-7M15 20v-10M20 20V5' }],
  keyboard: [{ s: 'M2.5 6h19v12h-19z' }, { s: 'M7.25 13v5M12 13v5M16.75 13v5' }],
  here: [{ s: 'M4 2.5h16v9H4z', f: 1 }, { s: 'M12 14.5v7M7.5 17.5l4.5 4.3 4.5-4.3' }],
  screens: [{ s: 'M3 4h7.5v7H3zM13.5 4H21v7h-7.5zM3 14h7.5v6H3zM13.5 14H21v6h-7.5z' }],
  lock: [{ s: 'M5 11h14v10H5z', f: 1 }, { s: 'M8 11V8a4 4 0 0 1 8 0v3' }],
  unlock: [{ s: 'M5 11h14v10H5z', f: 1 }, { s: 'M8 11V8a4 4 0 0 1 7.7-1.6' }],
  check: [{ s: 'M4.5 12.5 9.5 17.5 19.5 6.5' }],
  star: [{ s: 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z', f: 1 }],
  up: [{ s: 'M5 15.5 12 8.5l7 7' }],
  down: [{ s: 'M5 8.5 12 15.5l7-7' }],
  alert: [{ solid: 'M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4zM10.4 5.8h3.2l-.5 8.6h-2.2zM12 15.6a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z', even: 1 }],
  skip: [{ s: 'M5 5.5 14 12l-9 6.5z', f: 1 }, { s: 'M18.5 5v14' }],
  warm: [{ s: 'M12 2c.8 3.4 3.6 5.2 5 8 1.2 2.3 1.3 4.9.2 7A6.4 6.4 0 0 1 5.6 16c-.3-2.5.8-4.6 2.3-6.2.2 1.5.8 2.6 1.9 3.2-.2-3.8.4-7.6 2.2-11z' },
    { s: 'M12 12.6c1.3 1.3 2.3 2.6 2.3 4.1a2.3 2.3 0 0 1-4.6 0c0-1.5 1-2.8 2.3-4.1z' }],
  controller: [{ s: 'M7 7.5h10a4.8 4.8 0 0 1 4.6 6.1l-1.1 4a2.4 2.4 0 0 1-4.1 1L14.6 16.5H9.4l-1.8 2.1a2.4 2.4 0 0 1-4.1-1l-1.1-4A4.8 4.8 0 0 1 7 7.5z', f: 1 },
    { solid: 'M15.3 11.3a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 0 0-2.6 0zM6.4 10h1.7v1.5h1.5v1.7H8.1v1.5H6.4v-1.5H4.9v-1.7h1.5z' }],
  handsolid: [{ solid: 'M6.2 7.4a1.3 1.3 0 0 1 2.6 0V12h.6V4.8a1.3 1.3 0 0 1 2.6 0V12h.6V4.2a1.3 1.3 0 0 1 2.6 0V12h.6V5.8a1.3 1.3 0 0 1 2.6 0V15a7 7 0 0 1-7 7h-.4a6 6 0 0 1-5-2.7l-3-4.6a1.4 1.4 0 0 1 2.2-1.7l1.6 1.9z' }],
  // nothing seen: a ring struck through
  unseen: [{ s: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z' }, { s: 'M6 18 18 6' }],
  // the screen of the desktop preview
  monitor: [{ s: 'M3 4.5h18v12H3z' }, { s: 'M8.5 20.5h7M12 16.5v4' }],
  keys: [{ s: 'M3 5h18v14H3zM9 13v6M15 13v6' }, { solid: 'M7.2 5h3.6v8H7.2zM13.2 5h3.6v8h-3.6z' }],
  note: [{ s: 'M9 17.5V5.5l10.5-2v12' }, { s: 'M3.5 17.5a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0zM14 15.5a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0z', f: 1 }],
  width: [{ s: 'M3 12h18M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5' }],
  target: [{ s: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z' }, { solid: 'M9.6 12a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 0 0-4.8 0z' }],
  // the sound: a speaker and its waves; off, the speaker struck through
  sound: [{ s: 'M2.5 9.2h3.6L11 5v14l-4.9-4.2H2.5z' }, { s: 'M15 8.6a4.8 4.8 0 0 1 0 6.8M18.4 5.4a9.4 9.4 0 0 1 0 13.2' }],
  soundOff: [{ s: 'M2.5 9.2h3.6L11 5v14l-4.9-4.2H2.5z' }, { s: 'M15.2 9.2l5.6 5.6M20.8 9.2l-5.6 5.6' }],
};

// Pictures on a 100-unit grid: each part a path with its fill and stroke (fg, accent and line
// name the colours the caller gives).
const sw = (w = 5) => ({ w, cap: 'round', join: 'round' });

// The players' signs: two palms (Просунутий), a star (Середній), a sprout (Новачок).
export const SIGNS = {
  palms: [{ d: 'M38 70V42a5 5 0 0 1 10 0v18M48 38a5 5 0 0 1 10 0v22M58 41a5 5 0 0 1 10 0v24M68 50a5 5 0 0 1 10 0v14c0 12-9 22-21 22h-4c-8 0-14-4-17-10l-8-13a5 5 0 0 1 8-6l4 5', stroke: 'fg', ...sw(6) }],
  sprout: [{ d: 'M50 86V52', stroke: 'fg', ...sw(7) }, { d: 'M50 56c-2-14-12-22-28-22 0 14 10 24 28 22zM50 50c2-16 14-26 30-26 0 18-12 28-30 26z', fill: 'fg' }],
  star: [{ d: 'M50 16l9.6 20.6 22.4 2.8-16.5 15.5 4.2 22.3L50 66.4 30.3 77.2l4.2-22.3L18 39.4l22.4-2.8z', fill: 'fg', stroke: 'fg', w: 4, join: 'round' }],
};
export const PLAYER_SIGN = { advanced: 'palms', intermediate: 'star', novice: 'sprout' };

// The warm-up without keys: wrist circles, fists open and close, shoulders down.
export const BODY = {
  wrists: [
    { d: 'M44 96V72M56 96V72', stroke: 'fg', ...sw() },
    { d: 'M42 72c-3-9-4-20-3-30 .6-6 4-9 8-9h6c4 0 7.4 3 8 9 1 10 0 21-3 30z', stroke: 'fg', ...sw() },
    { d: 'M39 50c-6-2-10-7-9-12', stroke: 'fg', ...sw() },
    { d: 'M84 52a34 34 0 1 1-10-26', stroke: 'accent', ...sw() }, { d: 'M76 14l-2 13 13 1', stroke: 'accent', ...sw() },
  ],
  fists: [
    { d: 'M24 94V70M36 94V70', stroke: 'fg', ...sw() },
    { d: 'M16 70V48a8 8 0 0 1 8-8h14a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8z', stroke: 'fg', ...sw() }, { d: 'M24 40v9M31 40v9M38 40v9', stroke: 'fg', ...sw() },
    { d: 'M66 94V72M78 94V72', stroke: 'fg', ...sw() },
    { d: 'M62 72V52a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v20z', stroke: 'fg', ...sw() }, { d: 'M66 48V24M72 48V18M78 48V20M84 50V28M62 60l-8-10', stroke: 'fg', ...sw() },
    { d: 'M47 30h10M53 25l5 5-5 5M57 40H47M51 35l-5 5 5 5', stroke: 'accent', ...sw() },
  ],
  shoulders: [
    { d: 'M50 20a12 12 0 1 1 0 24 12 12 0 0 1 0-24z', stroke: 'fg', ...sw() }, { d: 'M14 92c0-22 14-32 36-32s36 10 36 32', stroke: 'fg', ...sw() },
    { d: 'M18 24v20M10 36l8 8 8-8M82 24v20M74 36l8 8 8-8', stroke: 'accent', ...sw() },
  ],
};

// What moves the keyboard in «Підлаштувати»: its corners pulled, the height handle, the ray and
// trigger, a stick, the stick pressed.
export const CONTROL = {
  corners: [
    { d: 'M12 40h64v36H12z', stroke: 'fg', ...sw() },
    { d: 'M12 33a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM12 69a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM76 69a7 7 0 1 0 0 14 7 7 0 1 0 0-14z', fill: 'accent' },
    { d: 'M76 31a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', fill: 'accent' }, { d: 'M84 32 94 20M84 20h10v10', stroke: 'accent', ...sw() },
  ],
  height: [
    { d: 'M6 70h60v18H6z', stroke: 'fg', ...sw() },
    { d: 'M84 18v54M74 28l10-10 10 10M74 62l10 10 10-10', stroke: 'accent', ...sw() },
  ],
  ray: [
    { d: 'M14 52h26a12 12 0 0 1 11.5 15.3l-2.6 9.4a5.6 5.6 0 0 1-9.6 2.3L35 74H19l-4.3 5a5.6 5.6 0 0 1-9.6-2.3l-2.6-9.4A12 12 0 0 1 14 52z', stroke: 'fg', ...sw() },
    { d: 'M34 46 84 14', stroke: 'accent', ...sw() }, { d: 'M79 13a7 7 0 1 0 14 0 7 7 0 1 0-14 0z', fill: 'accent' },
  ],
  stick: [
    { d: 'M20 50a30 30 0 1 0 60 0 30 30 0 1 0-60 0z', stroke: 'fg', ...sw() }, { d: 'M37 50a13 13 0 1 0 26 0 13 13 0 1 0-26 0z', fill: 'fg' },
    { d: 'M50 8v8M50 84v8M8 50h8M84 50h8', stroke: 'accent', ...sw() },
  ],
  press: [
    { d: 'M20 58a30 30 0 1 0 60 0 30 30 0 1 0-60 0z', stroke: 'fg', ...sw() }, { d: 'M37 58a13 13 0 1 0 26 0 13 13 0 1 0-26 0z', fill: 'fg' },
    { d: 'M50 4v20M40 15l10 10 10-10', stroke: 'accent', ...sw() },
  ],
};

const cache = new Map();
// A Path2D of `d`, made once; null where there is no Path2D (node's tests draw no shapes).
function path(d) {
  if (typeof Path2D !== 'function') return null;
  let p = cache.get(d);
  if (!p) { p = new Path2D(d); cache.set(d, p); }
  return p;
}

// One line icon, its box's top left at (x, y), `size` px, the stroke `stroke` px whatever the size.
export function drawIcon(ctx, name, x, y, size, colour, { stroke = 7.5, style = 'line' } = {}) {
  const parts = ICONS[name];
  if (!parts) throw new RangeError(`icon ${name}`);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = (stroke * 24) / size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  for (const p of parts) {
    if (p.solid) { const s = path(p.solid); if (s) ctx.fill(s, p.even ? 'evenodd' : 'nonzero'); continue; }
    const s = path(p.s);
    if (!s) continue;
    if (style === 'fill' && p.f) ctx.fill(s);
    ctx.stroke(s);
  }
  ctx.restore();
}

// A picture of 100 units in a box of `size` px at (x, y); colours: {fg, accent, line}.
export function drawArt(ctx, parts, x, y, size, colours = {}) {
  const k = size / 100;
  const colour = c => colours[c] || (c === 'line' ? '#1d1b24' : c);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  for (const p of parts) {
    const s = path(p.d);
    if (!s) continue;
    if (p.fill) { ctx.fillStyle = colour(p.fill); ctx.fill(s, p.even ? 'evenodd' : 'nonzero'); }
    if (p.stroke) {
      ctx.strokeStyle = colour(p.stroke);
      ctx.lineWidth = p.w || 3;
      ctx.lineCap = p.cap || 'butt';
      ctx.lineJoin = p.join || 'miter';
      ctx.stroke(s);
    }
  }
  ctx.restore();
}

// A player's avatar: their sign in a circle.
export function drawAvatar(ctx, sign, x, y, size, bg, fg) {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, 2 * Math.PI);
  ctx.fill();
  drawArt(ctx, SIGNS[sign] || SIGNS.star, x, y, size, { fg });
}

// The 61 keys (36 white) with one C marked in `hi`: 'low' (the first step) or 'high', and a
// pointer under it; `width` px across, at (x, y).
export function drawKeyboard61(ctx, mark, x, y, width, { white = '#E9EDF5', black = '#15171B', line = '#5B6A86', hi = '#FFB329' } = {}) {
  const n = 36, k = width / 100, kw = 100 / n, h = 22;
  ctx.save();
  ctx.translate(x, y + k);
  ctx.scale(k, k);
  ctx.lineWidth = 0.25;
  ctx.strokeStyle = line;
  for (let i = 0; i < n; i++) {
    const on = (mark === 'low' && i === 0) || (mark === 'high' && i === n - 1);
    ctx.fillStyle = on ? hi : white;
    ctx.fillRect(i * kw, 0, kw, h);
    ctx.strokeRect(i * kw, 0, kw, h);
  }
  const pattern = [1, 1, 0, 1, 1, 1, 0]; // a black key after C, D, F, G, A
  ctx.fillStyle = black;
  for (let i = 0; i < n - 1; i++) if (pattern[i % 7]) ctx.fillRect((i + 1) * kw - kw * 0.3, 0, kw * 0.6, h * 0.6);
  const cx = mark === 'low' ? kw / 2 : 100 - kw / 2;
  ctx.fillStyle = hi;
  ctx.beginPath();
  ctx.moveTo(cx, h + 2.2);
  ctx.lineTo(cx - 2.6, h + 6.4);
  ctx.lineTo(cx + 2.6, h + 6.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
// The keyboard's picture's height for its width.
export const KEYBOARD_ASPECT = 0.29;
