// The control panel: where it stands, its pages and their targets, presses by ray (pinch or
// trigger) or by fingertip, and what each target asks the trainer to do. Panel frame: x right, y up,
// z out of the face towards the player, origin at the centre, in metres. One panel size for every
// page (27,2 × 31,4 cm). What each page shows and where its targets stand is the look's
// (studio.js, direction A «Студія» of docs/trainer-ui-brief.md): the targets here are the boxes it
// draws, so a ray or a fingertip hits exactly what is drawn (brief §4.3).
import { invertRigid, transformPoint, transformDir, identity, multiply, translation, yawPose } from './mat.js';
import { WHITE_COUNT } from './geometry.js';
import { FALL_HEIGHT, WATERFALL_Z } from './scene.js';
import { compose, draw, TEX_W, TEX_H, PAGES as LOOK_PAGES, CARDS as LOOK_CARDS, C, font, roundRect, textWidth } from './studio.js';

export const PX_PER_M = 3000; // canvas pixels per metre of panel (3 a millimetre)
export const WIDTH = TEX_W / PX_PER_M; // 0.272
export const HEIGHT = TEX_H / PX_PER_M; // 0.314
export const PAD = 0.012; // the panel's side margin
// Text heights in metres (studio.js SIZE): the body, the smallest anywhere.
export const BODY_TEXT = 0.012;
export const MIN_TEXT = 0.01;

// The pages (App.panelLayout): who plays; the player's home; a block's songs; a song; a warm-up's card and a warm-up playing; playing; the tempo, the level and the
// keyboard's place; «Підлаштувати»; calibrating by two touches, the first step (calibrateFirst:
// nothing to start again from) and the second.
export const LAYOUTS = LOOK_PAGES;
export const calibrating = page => page === 'calibrate' || page === 'calibrateFirst';
// The layout of the panel's mode (App.panelMode) at the calibration's step: «Заново» only from the
// second touch on.
export const pageLayout = (mode, step) => (mode === 'calibrate' && step !== 'high' ? 'calibrateFirst' : mode);
// Songs a page of a block: six cards.
export const CARDS = LOOK_CARDS;

export function panelHeight(mode) {
  if (!LOOK_PAGES.includes(mode)) throw new RangeError(`panel mode ${mode}`);
  return HEIGHT;
}

// The targets of `page` in state `s` (App.panelState; without one, an empty state's):
// [{id, x0, x1, y0, y1, r, off}] in the panel frame (r: the corner's radius, metres).
export function layout(page, s = null) {
  return toTargets(compose(page, s || {}).buttons);
}

// The target at (x, y) of a page (its name, or its targets as layout gives them), or null. A
// target is hit inside its drawn outline, rounded corners and a pill's ends included (brief §4.3).
const targetsOf = page => (Array.isArray(page) ? page : layout(page));
export function insideTarget(b, x, y) {
  if (!(x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1)) return false;
  const r = b.r || 0;
  const dx = Math.max(b.x0 + r - x, 0, x - (b.x1 - r)), dy = Math.max(b.y0 + r - y, 0, y - (b.y1 - r));
  return dx * dx + dy * dy <= r * r;
}
export function buttonAt(page, x, y) {
  return targetsOf(page).find(b => insideTarget(b, x, y))?.id ?? null;
}

// Where a ray in world space meets the panel's face: [x, y] in the panel frame, or null (only from
// the front, towards the face).
export function rayPoint(panelMatrix, origin, dir) {
  const inv = invertRigid(panelMatrix);
  const o = transformPoint(inv, origin);
  const d = transformDir(inv, dir);
  if (d[2] >= -1e-6 || o[2] <= 0) return null;
  const s = -o[2] / d[2];
  return [o[0] + s * d[0], o[1] + s * d[1]];
}
// A ray in world space against the panel's face -> its target's id or null.
export function rayButton(page, panelMatrix, origin, dir) {
  const p = rayPoint(panelMatrix, origin, dir);
  return p ? buttonAt(page, p[0], p[1]) : null;
}

export const POKE_PRESS = 0.006; // tip this close to the face over a button presses it
export const POKE_RELEASE = 0.02; // and must come back this far before the next press
export const POKE_HOVER = 0.06; // nearer than this over a target: it shows as aimed at
const POKE_MARGIN = 0.02;

// Fingertip presses for one hand. A press needs the tip to come from in front of the panel
// (hover) and fires once; the hand must withdraw past POKE_RELEASE or leave before it can press
// again, so a finger resting on a button does not repeat and sliding onto another one fires
// nothing. `hover`: the target under a tip that hovers, for the panel to show.
export class Poke {
  constructor() { this.state = 'idle'; this.pressed = null; this.hover = null; }

  // page: its name or its targets; tip in the panel frame, or null when the hand is not tracked.
  // Returns a target's id to fire.
  update(page, tip) {
    this.hover = null;
    if (!tip) { this.state = 'idle'; this.pressed = null; return null; }
    const inside = Math.abs(tip[0]) <= WIDTH / 2 + POKE_MARGIN && Math.abs(tip[1]) <= HEIGHT / 2 + POKE_MARGIN;
    const z = tip[2];
    if (!inside || z < -0.05) { this.state = 'idle'; this.pressed = null; return null; }
    if (this.state === 'pressed') {
      if (z > POKE_RELEASE) { this.state = 'hover'; this.pressed = null; }
      return null;
    }
    if (z > POKE_HOVER) { this.state = 'idle'; return null; }
    if (this.state === 'idle') {
      if (z > POKE_PRESS) { this.state = 'hover'; this.hover = buttonAt(page, tip[0], tip[1]); }
      return null;
    }
    // hover
    if (z <= POKE_PRESS) {
      const id = buttonAt(page, tip[0], tip[1]);
      this.state = 'pressed';
      this.pressed = id;
      return id;
    }
    this.hover = buttonAt(page, tip[0], tip[1]);
    return null;
  }
}

// The words of the desktop page's own buttons (index.html), in the current state.
const HAND_LABEL = { both: 'обидві', right: 'права', left: 'ліва' };
export function label(id, s) {
  switch (id) {
    case 'toggle': return s.playing ? ['Пауза', ''] : ['Грати', ''];
    case 'restart': return ['Спочатку', ''];
    // the metronome and the song voice (docs/piano-audio-design.md §6.4): on or off
    case 'metronome': return [s.sound && s.sound.metronome.on ? 'Метроном: так' : 'Метроном: ні', ''];
    case 'voice': return [s.sound && s.sound.voice.on ? 'Звук пісні: так' : 'Звук пісні: ні', ''];
    case 'speed': return [`${Math.round((s.speed ?? 1) * 100)} %`, 'темп'];
    // the waterfall's bar lines: the state, and what the next press does
    case 'barlines': return s.barLines === false ? ['Лінії тактів: ні', 'показати'] : ['Лінії тактів: так', 'сховати'];
    case 'loop': return !s.loop ? ['Петля', 'поставити початок'] : s.loop.b === undefined ? ['Петля', 'поставити кінець'] : ['Петля', 'зняти'];
    case 'hands': return s.level === 1 ? ['Руки: права', 'рівень 1'] : ['Руки:', HAND_LABEL[s.hands] || ''];
    case 'screens': return ['Екрани', ''];
    // the guide hands: the state, and what the next press does
    case 'fingers': return s.fingers ? ['Пальці: так', 'сховати'] : ['Пальці: ні', 'показати'];
    // «Клавіатура» from any page, and back from it (docs/piano-keyboard-handles-design.md §6.5)
    case 'keyboard': return s.layout === 'calibration' ? ['Назад з клавіатури', ''] : ['Клавіатура', ''];
    default: return [id, ''];
  }
}

// The trainer's command a target of the page sends in state `s` (App.panelState), or null when it
// does nothing now (drawn faint, its words saying why): a card opens its song (`open:<index in
// the song list>`), a player's card chooses them (`player:<id>`), the way back opens the page
// before, «Грати» and «Спершу розігрів» on a song start it without or with the warm-up, the home's
// «Розігрів» the player's warm-up before the song it leads to; the rest
// are the trainer's commands already (docs/piano-warmups.md §5.2). A command that is no target of
// the page (the desktop's own buttons, tests) passes as it is.
const BACK = { songs: 'home', song: 'grid', play: 'section:songs', level: 'section:none', tempo: 'section:none', calibration: 'keyboard', sound: 'section:none' };
export function buttonCommand(id, s) {
  const page = s.layout || s.mode || 'play';
  const target = LOOK_PAGES.includes(page) ? layout(page, s).find(b => b.id === id) : null;
  if (target && target.off) return null;
  const [kind, arg] = id.split(':');
  if (kind === 'card') {
    const c = s.grid && s.grid.cards[Number(arg)];
    return c ? `open:${c.index}` : null;
  }
  if (kind === 'profile') {
    const p = s.profiles && s.profiles[Number(arg)];
    return p ? `player:${p.id}` : null;
  }
  if (id === 'back') return BACK[page] || null;
  if (id === 'done') return 'section:none';
  if (id === 'songPlay') return s.pick ? `play:${s.pick.index}` : null;
  if (id === 'songWarm') return s.pick ? `warmFirst:${s.pick.index}` : null;
  if (id === 'homeWarm') {
    const w = (s.home && s.home.warm) || (s.grid && s.grid.warm);
    return w && Number.isInteger(w.index) ? `warmHome:${w.index}` : null;
  }
  if (id === 'session:skipBody') return 'session:start';
  return id;
}

// Draws the panel into a 2D canvas of WIDTH × HEIGHT metres at PX_PER_M. s: App.panelState.
// Returns the texts that did not fit and were cut (none may be).
export function drawPanel(ctx, s) {
  return renderPanel(ctx, s).cut;
}
// The same, and the targets drawn (as layout gives them), from one composition. -> {cut, targets}
export function renderPanel(ctx, s) {
  const page = s.layout || s.mode;
  const composed = compose(page, s);
  draw(ctx, composed);
  return { cut: composed.cut, targets: toTargets(composed.buttons) };
}
function toTargets(buttons) {
  const k = PX_PER_M;
  return buttons.map(b => ({
    id: b.id, x0: b.x / k - WIDTH / 2, x1: (b.x + b.w) / k - WIDTH / 2, y0: HEIGHT / 2 - (b.y + b.h) / k, y1: HEIGHT / 2 - b.y / k,
    r: Math.min(b.r, b.h / 2) / k, off: b.off,
  }));
}

// Ukrainian: 1 пісня, 2-4 пісні, 5-20 пісень, 21 пісня…
export function plural(n, [one, few, many]) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

// The sign over the waterfall (the tempo at the song's start, a tempo change a bar ahead):
// SIGN_W x SIGN_H metres at PX_PER_M, a bold line over a smaller one, in the panel's look.
export const SIGN_W = 0.3;
export const SIGN_H = 0.046;

export function drawSign(ctx, [big = '', small = ''] = []) {
  const cut = [];
  const k = PX_PER_M, W = SIGN_W * k, H = SIGN_H * k, room = W - 2 * PAD * k;
  ctx.clearRect(0, 0, W, H);
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = C.plate;
  ctx.fill();
  roundRect(ctx, 2, 2, W - 4, H - 4, 22);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  const line = (t, weight, px, y, colour) => {
    let size = px;
    while (size > px * 0.7 && textWidth(t, font(weight, size)) > room) size = Math.max(px * 0.7, size * 0.96);
    ctx.font = font(weight, size);
    let shown = t;
    if (textWidth(t, ctx.font) > room) {
      cut.push(t);
      while (shown.length > 1 && textWidth(`${shown}…`, ctx.font) > room) shown = shown.slice(0, -1);
      shown = `${shown}…`;
    }
    ctx.fillStyle = colour;
    ctx.fillText(shown, W / 2, y);
  };
  line(big, 700, 48, (small ? 0.022 : 0.029) * k, C.text);
  if (small) line(small, 500, 33, 0.038 * k, C.sec);
  ctx.textAlign = 'left';
  return cut;
}

// The sign's corners in the keyboard frame, around it from the lower left: over the middle of
// the waterfall, just above its top.
export function signCorners(pitch) {
  const mid = (WHITE_COUNT * pitch) / 2, y = FALL_HEIGHT + 0.012;
  const x0 = mid - SIGN_W / 2, x1 = mid + SIGN_W / 2;
  return [[x0, y, WATERFALL_Z], [x1, y, WATERFALL_Z], [x1, y + SIGN_H, WATERFALL_Z], [x0, y + SIGN_H, WATERFALL_Z]];
}

// True when, seen from `eye`, any part of the flat convex quad `corners` (world points, in
// order around it) lies within the panel's outline grown by `margin` on every side: drawn
// behind the panel it would read through the panel's text, drawn in front it would hide it.
// panel: its matrix (panel frame: origin at the centre, z out of the face); height: its height.
export function panelCovers(panel, height, eye, corners, margin = 0) {
  const inv = invertRigid(panel);
  const e = transformPoint(inv, eye);
  if (e[2] <= 0) return false; // the panel seen from behind
  const flat = [];
  for (const c of corners.map(p => transformPoint(inv, p))) {
    if (c[2] >= e[2]) return false; // not in front of the eyes on the panel's side
    const s = e[2] / (e[2] - c[2]); // along the ray from the eye to the corner, to the panel's plane
    flat.push([e[0] + s * (c[0] - e[0]), e[1] + s * (c[1] - e[1])]);
  }
  const w = WIDTH / 2 + margin, h = height / 2 + margin;
  return convexOverlap(flat, [[-w, -h], [w, -h], [w, h], [-w, h]]);
}

// Two convex polygons in a plane overlap unless an edge of one separates them.
function convexOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const n = [q[1] - p[1], p[0] - q[0]];
      const pa = a.map(v => v[0] * n[0] + v[1] * n[1]), pb = b.map(v => v[0] * n[0] + v[1] * n[1]);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
  }
  return true;
}

// Where the panel stands in the keyboard frame: beside the lowest C, past the left end of the
// keys, turned 10° towards the player and leaning back 30°, on its bottom edge (the middle of
// that edge at PANEL_EDGE, at the height of the keys' tops, 6 cm in front of the touch line), so
// it grows upwards and back, away from the keys. From any seat 26 cm left to 24 cm right of the
// middle, 35 to 55 cm above the keys and 25 to 50 cm in front, it covers neither the keys, the
// waterfall nor the sign over it, and 1 cm, 2 cm or 5° either way still clears them
// (tests/panel.test.mjs). Turned further towards the middle seat, its right edge would stand in
// front of the waterfall from the left seats; from the middle seat its face is 41° off square.
// In «Підлаштувати» it stands ADJUST_LEFT further left, so the front-left corner handle (the
// lowest C's, aligned first) has room round it for a ray: from the middle seat its edge passes
// 5 cm or more from that corner, as no panel passes near the other three
// (docs/piano-keyboard-handles-design.md §4.2; tests/panel.test.mjs). Further left, the seat 24 cm
// right of the middle would be out of PANEL_REACH.
export const PANEL_EDGE = [-0.165, 0, 0.06];
export const PANEL_TURN = (10 * Math.PI) / 180;
export const PANEL_LEAN = (30 * Math.PI) / 180;
export const ADJUST_LEFT = 0.04;

export function panelInKeyboard(mode) {
  const h = panelHeight(mode);
  const c = Math.cos(-PANEL_LEAN), s = Math.sin(-PANEL_LEAN);
  const tilt = identity();
  tilt[5] = c; tilt[6] = s; tilt[9] = -s; tilt[10] = c;
  const edge = mode === 'adjust' ? [PANEL_EDGE[0] - ADJUST_LEFT, PANEL_EDGE[1], PANEL_EDGE[2]] : PANEL_EDGE;
  return multiply(multiply(multiply(translation(...edge), yawPose([0, 0, 0], PANEL_TURN)), tilt), translation(0, h / 2, 0));
}
