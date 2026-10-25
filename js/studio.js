// The panel's look, direction A «Студія» (docs/trainer-ui-brief.md §5.1; the brief and its prototypes,
// docs/ui-prototypes/, are on the design branch pipeline/task-a32e90a5 at 6847814, not merged here; the
// § references in the trainer's code are to that brief): Luma's calm dark cards
// on one plate, one rose accent, Manrope with JetBrains Mono for the numbers. Every screen of the
// brief (§3.4) is laid out here in texture pixels (816 × 942, 3 px a millimetre) as a list of
// drawing operations; the buttons among them are the panel's targets (panel.js layout), so what a
// ray or a fingertip hits is what is drawn. Another direction would replace this file: panel.js
// asks it for compose(page, state) and draw(ctx, composed) only.
import { drawIcon, drawArt, drawAvatar, drawKeyboard61, BODY, CONTROL, PLAYER_SIGN, KEYBOARD_ASPECT } from './art.js';
import { WIDTHS } from './font-widths.js';
import { SPEEDS } from './song.js';

export const TEX_W = 816, TEX_H = 942;
// The colours (brief §5.1): the plate, a card or button and its edge, text, secondary, faint,
// the dark word on a light fill, the rose accent, a press, the amber of «Підлаштувати» and the
// calibration, the hands' (overlay.js), a strip that asks for something.
export const C = {
  plate: 'rgba(14, 19, 28, 0.97)', card: '#182131', cardHi: '#232E42', line: '#5B6A86', text: '#E9EDF5', sec: '#A3B1C6',
  dim: '#6F7C91', ink: '#0B0E15', rose: '#F3A1B5', press: '#4F4152', amber: '#FFB329', amberInk: '#1A1205', amberWord: '#FFD27A',
  right: '#7C6CFF', left: '#3CE0C0', track: '#2C374C', alert: '#2A3550', alertEdge: '#8C9AB6', alertSub: '#D6DDEA',
  primarySub: '#2A3242', selSub: '#2E1E26', avatar: '#2C374C',
};
const SANS = 'Manrope, system-ui, sans-serif';
const MONO_FAMILY = '"JetBrains Mono", ui-monospace, monospace';
export const FONTS = [{ family: 'Manrope', file: 'fonts/Manrope-var.woff', weight: '200 800' },
  { family: 'JetBrains Mono', file: 'fonts/JetBrainsMono-var.woff', weight: '100 800' }];
export const font = (weight, px, mono = false) => `${weight} ${px}px ${mono ? MONO_FAMILY : SANS}`;
// Ascent and descent of each family (their hhea), for placing a line's baseline in its line box
// as CSS does.
const ASC = { sans: 1.066, mono: 1.02 }, DESC = 0.3;
// The text roles in px (brief §4.2): the smallest 30 (Manrope's x-height 0.54: 5.4 mm), body 36,
// a button's word 39, a title 48, a big number 60.
export const SIZE = { min: 30, body: 36, word: 39, title: 48, big: 60 };

// Widths of texts, from a canvas of the page's own (the fonts the panel draws with), or else (node's
// tests) from each character's advance in the font files (font-widths.js; no kerning). Cached, at
// most MEASURED texts.
const MEASURED = 4000;
const widths = new Map();
let measurer;
function measureCtx() {
  if (measurer !== undefined) return measurer;
  measurer = null;
  try {
    if (typeof OffscreenCanvas === 'function') measurer = new OffscreenCanvas(8, 8).getContext('2d');
    else if (typeof document !== 'undefined') measurer = document.createElement('canvas').getContext('2d');
  } catch { measurer = null; }
  return measurer;
}
export function textWidth(t, f) {
  const key = `${f}\u0000${t}`;
  let w = widths.get(key);
  if (w !== undefined) return w;
  const ctx = measureCtx();
  if (ctx) { ctx.font = f; w = ctx.measureText(t).width; } else {
    const [, weight, px] = /^(\d+) (\d+(?:\.\d+)?)px/.exec(f);
    const kind = f.includes('Mono') ? 'mono' : 'sans';
    const table = WIDTHS[`${kind} ${weight}`] || WIDTHS[`${kind} ${kind === 'mono' ? 600 : 600}`];
    w = [...t].reduce((a, ch) => a + (table[ch] ?? 0.6), 0) * Number(px);
  }
  if (widths.size >= MEASURED) widths.clear();
  widths.set(key, w);
  return w;
}
// The fonts came in: what was measured with the fallback is measured again.
export function fontsChanged() { widths.clear(); }

// A line box of `px` and line height `lh` from `top`: its baseline (as CSS places it).
const baselineIn = (top, px, lh, mono = false) => top + (px * lh - px * ((mono ? ASC.mono : ASC.sans) + DESC)) / 2 + px * (mono ? ASC.mono : ASC.sans);
// A single line centred on `cy`.
const baselineAt = (cy, px, mono = false) => cy + px * ((mono ? ASC.mono : ASC.sans) - ((mono ? ASC.mono : ASC.sans) + DESC) / 2);

// `t` broken between words into lines of at most `room` px in font `f` (a word longer than the room
// stands alone on its line).
export function wrap(t, room, f) {
  const out = [];
  let line = '';
  for (const w of String(t).split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (!line || textWidth(next, f) <= room) line = next;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}

// A catalog title: the name, then from the comma before a catalogue number or a part («Op. 9 № 2»,
// «BWV 846», «тема») the rest (second line, smaller); a movement's numeral stays on the name's line
// with its comma («K. 545, I»), and a comma inside a name («Twinkle, Twinkle, Little Star») does
// not split it. A catalogue number is kept on one line («Op. 39», «№ 16»).
const PART = /^(Op\.|BWV|Anh\.|K\.|D\.|WoO|№|тема(?=[\s(]|$))/u, NUMERAL = /^[IVX]+$/;
export function splitTitle(t) {
  const s = String(t || '').replace(/(Op\.|№|BWV|Anh\.|K\.|D\.|WoO) /g, '$1\u00a0');
  for (let i = s.indexOf(', '); i >= 0; i = s.indexOf(', ', i + 1)) {
    const rest = s.slice(i + 2);
    if (NUMERAL.test(rest)) return [`${s.slice(0, i)},\u00a0${rest}`, ''];
    if (PART.test(rest)) return [s.slice(0, i), rest];
  }
  return [s, ''];
}
// A number and its unit stay together.
const nb = t => String(t).replace(/(\d) (?=%|с\b|хв|мм|см|BPM)/g, '$1\u00a0');
const clock = s => (s == null || !Number.isFinite(s) ? '' : `${Math.floor(Math.max(0, Math.round(s)) / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`);
const pct = v => `${Math.round(v * 100)}\u00a0%`;
const secs = v => `${String(v).replace('.', ',')}\u00a0с`;
const lowerFirst = t => (t ? t[0].toLocaleLowerCase('uk') + t.slice(1) : '');

// The operations of one screen: drawn in order; `buttons` the targets ({id, x, y, w, h, r} in px,
// off: does nothing now), `cut` texts that did not fit (none may), `shortened` texts that may give
// way (a composer on a card).
class Ops {
  constructor() { this.list = []; this.buttons = []; this.cut = []; this.shortened = []; this.texts = []; }
  push(op) { this.list.push(op); return op; }
  // A text from (x, baseline); at most `room` px: else cut (and recorded) unless it may shorten.
  text(t, x, y, f, colour, { align = 'left', room = Infinity, shorten = false, spacing = 0 } = {}) {
    if (!t) return 0;
    let shown = String(t);
    let w = textWidth(shown, f) + spacing * [...shown].length;
    if (w > room + 0.5) {
      (shorten ? this.shortened : this.cut).push(shown);
      while (shown.length > 1 && textWidth(`${shown}…`, f) > room) shown = shown.slice(0, -1).trimEnd();
      shown = `${shown}…`;
      w = textWidth(shown, f);
    }
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(f)[1]);
    this.texts.push({ t: shown, x0, x1: x0 + w, y, px, f, colour });
    this.push({ op: 'text', t: shown, x, y, f, colour, align, spacing });
    return w;
  }
  rect(x, y, w, h, r, fill, stroke = null, lw = 0, dash = null) { this.push({ op: 'rect', x, y, w, h, r, fill, stroke, lw, dash }); }
  circle(cx, cy, r, fill, stroke = null, lw = 0, dash = null) { this.push({ op: 'circle', cx, cy, r, fill, stroke, lw, dash }); }
  icon(name, x, y, size, colour, opts = {}) { this.push({ op: 'icon', name, x, y, size, colour, opts }); }
  art(parts, x, y, size, colours) { this.push({ op: 'art', parts, x, y, size, colours }); }
  custom(draw) { this.push({ op: 'custom', draw }); }
  // A target: its box, its look and what is drawn in it (fill(o) adds those operations).
  button(spec, fill) {
    const b = { id: spec.id, x: spec.x, y: spec.y, w: spec.w, h: spec.h, r: spec.r ?? 12, off: !!spec.off };
    this.buttons.push(b);
    const inner = new Ops();
    inner.texts = this.texts;
    inner.cut = this.cut;
    inner.shortened = this.shortened;
    fill(inner, b);
    this.push({ op: 'button', ...spec, r: b.r, children: inner.list });
    return b;
  }
}

// What each look of a target paints: its fill and edge, its word, its second line, its icon.
const TONE = {
  plain: { fill: C.card, edge: C.line, word: C.text, sub: C.sec, icon: C.text },
  primary: { fill: C.text, edge: C.text, word: C.ink, sub: C.primarySub, icon: C.ink },
  chosen: { fill: C.rose, edge: C.rose, word: C.ink, sub: C.selSub, icon: C.ink },
  band: { fill: C.amberInk, edge: C.amberInk, word: C.amberWord, sub: C.amberWord, icon: C.amberWord },
};
const EDGE = 4; // 1,3 mm: a target's edge (brief §4.4), the plate's

// Content laid out in a box as CSS flex does: items in a row (or a column), centred or from the
// left after `pad`, each centred across. item: {w, h, draw(o, x, y)}.
function flow(o, box, items, { col = false, align = 'center', pad = 26, gap = 14 } = {}) {
  items = items.filter(Boolean);
  if (col) {
    const total = items.reduce((a, i) => a + i.h, 0) + gap * (items.length - 1);
    let y = box.y + (box.h - total) / 2;
    for (const i of items) { i.draw(o, box.x + (box.w - i.w) / 2, y); y += i.h + gap; }
    return;
  }
  const total = items.reduce((a, i) => a + i.w, 0) + gap * (items.length - 1);
  let x = align === 'center' ? box.x + (box.w - total) / 2 : box.x + EDGE + pad;
  for (const i of items) { i.draw(o, x, box.y + (box.h - i.h) / 2); x += i.w + gap; }
}
const iconItem = (name, size, colour, opts) => ({ w: size, h: size, draw: (o, x, y) => o.icon(name, x, y, size, colour, opts) });
// Lines one under another: [{t, f, px, lh, colour, mono, spacing}], from the left or centred.
function linesItem(lines, { center = false, room = Infinity } = {}) {
  lines = lines.filter(l => l && (l.t || l.draw));
  const w = Math.min(room, Math.max(0, ...lines.map(l => (l.draw ? l.w : textWidth(l.t, l.f) + (l.spacing || 0) * [...l.t].length))));
  const h = lines.reduce((a, l) => a + l.px * l.lh + (l.gap || 0), 0);
  return {
    w, h,
    draw(o, x, y) {
      let top = y;
      for (const l of lines) {
        if (l.draw) { l.draw(o, x, top + (l.gap || 0)); top += l.px * l.lh + (l.gap || 0); continue; }
        o.text(l.t, center ? x + w / 2 : x, baselineIn(top, l.px, l.lh, l.mono), l.f, l.colour, { align: center ? 'center' : 'left', room, shorten: !!l.shorten, spacing: l.spacing || 0 });
        top += l.px * l.lh;
      }
    },
  };
}
const word = (t, tone, { px = SIZE.word, weight = 600, mono = false, lh = 1.1 } = {}) => ({ t, f: font(weight, px, mono), px, lh, colour: tone.word, mono });
const second = (t, tone, { px = SIZE.min, weight = 500, lh = 1.15 } = {}) => ({ t, f: font(weight, px), px, lh, colour: tone.sub });
const kick = (t, tone) => ({ t: t.toLocaleUpperCase('uk'), f: font(700, 30), px: 30, lh: 1.1, colour: tone.sub, spacing: 3 });

// A target with an icon (or another shape) and its words. spec: {id, x, y, w, h, r, look, off,
// icon, iconSize, pre (an item), words: [lines], col, align, pad, gap, post (an item)}.
function target(o, s, spec) {
  const look = spec.look || 'plain';
  const tone = TONE[look];
  return o.button({ ...spec, look, pressed: !!(s.pressed && s.pressed.has(spec.id)) }, (inner, box) => {
    const items = [spec.icon && iconItem(spec.icon, spec.iconSize || 44, spec.iconColour || tone.icon, spec.iconOpts), spec.pre,
      spec.words && linesItem(spec.words(tone), { center: !!spec.col, room: spec.room }), spec.post];
    flow(inner, box, items, { col: !!spec.col, align: spec.align || 'center', pad: spec.pad ?? 26, gap: spec.gap ?? 14 });
  });
}

// ----------------------------------------------------------------------------------------------
// The frame of every screen: the plate, the top bar (34 mm) and the bottom bar (42 mm) around the
// content (brief §3.3).
const LEFT = 36, RIGHT = 780, INSIDE = RIGHT - LEFT;
const TOP = { y: 30, h: 102 }, CONTENT = { y: 156, h: 606 }, BOTTOM = { y: 786, h: 126 };
const BAR_H = 96, ROW_H = 108, MAIN_H = 150;
const contentBottom = CONTENT.y + CONTENT.h;

function plate(o) {
  o.rect(0, 0, TEX_W, TEX_H, 24, C.plate);
  o.rect(EDGE / 2, EDGE / 2, TEX_W - EDGE, TEX_H - EDGE, 24 - EDGE / 2, null, C.line, EDGE);
}

// What the headset sees, as an icon in a ring (brief §3.1.6): hands, controllers, neither, or the
// desktop preview's screen.
function status(o, s, x) {
  const cy = TOP.y + TOP.h / 2;
  o.circle(x + 36, cy, 36 - 1.5, null, C.line, 3);
  const kind = s.input;
  if (kind === 'hands') o.icon('handsolid', x + 13, cy - 23, 46, C.sec);
  else o.icon(kind === 'controllers' || kind === 'mixed' ? 'controller' : kind === 'none' ? 'unseen' : 'monitor', x + 12, cy - 24, 48, C.sec);
  return 72;
}

// The top bar: on the left the way back (or the player's chip, or the way out of the warm-up),
// then the screen's title (at the first of `sizes` it fits, `after` beside it in grey); on the
// right what the headset sees and «Екрани» (none where no PC stands behind the page: s.screens
// 'none').
function top(o, s, { left = null, title = '', input = true, screens = false, sizes = [SIZE.title], after = '' }) {
  const y = TOP.y + (TOP.h - BAR_H) / 2;
  let x = LEFT;
  if (left) x = left(o, y).x1 + 24;
  let right = RIGHT;
  if (screens && s.screens !== 'none') right = screensButton(o, s, y) - 24;
  if (input) right -= status(o, s, right - 72) + 24;
  if (title) {
    const af = font(600, 33, true), aw = after ? 24 + textWidth(after, af) : 0;
    const px = sizes.find(v => textWidth(title, font(700, v)) <= right - x - aw) || sizes[sizes.length - 1];
    const f = font(700, px);
    const tw = o.text(title, x, baselineAt(TOP.y + TOP.h / 2, px), f, C.text, { room: right - x - aw });
    if (after) o.text(after, x + tw + 24, baselineAt(TOP.y + TOP.h / 2, 33, true), af, C.sec, { room: right - x - tw - 24 });
  }
}
// Each kind of way back: its words and what it opens (panel.js buttonCommand).
const backButton = label => (o, y, s) => {
  const f = font(600, SIZE.word);
  const w = EDGE * 2 + 26 * 2 + 44 + 14 + textWidth(label, f);
  const b = target(o, s, { id: 'back', x: LEFT, y, w, h: BAR_H, icon: 'back', words: t => [word(label, t)] });
  return { x1: b.x + b.w };
};
function exitButton(o, y, s) {
  const label = 'Вийти з розігріву', f = font(600, 33);
  const w = EDGE * 2 + 26 * 2 + 44 + 14 + textWidth(label, f);
  const b = target(o, s, { id: 'session:exit', x: LEFT, y, w, h: BAR_H, icon: 'close', words: t => [word(label, t, { px: 33 })] });
  return { x1: b.x + b.w };
}
// The player's chip: their sign, their name, «змінити» (back to «Хто грає?»). A name of up to 16
// letters is shown whole: from 36 px down to 30, else in two lines at 30 px without «змінити».
const CHIP_ROOM = 282; // the name's room: the chip ends 24 px before what the headset sees and «Екрани»
export function chipName(name) {
  for (const px of [36, 33, 30]) if (textWidth(name, font(600, px)) <= CHIP_ROOM) return [{ t: name, px }];
  const letters = [...name];
  let cut = Math.ceil(letters.length / 2);
  const at = name.indexOf(' ');
  if (at > 0 && textWidth(name.slice(0, at), font(600, 30)) <= CHIP_ROOM && textWidth(name.slice(at + 1), font(600, 30)) <= CHIP_ROOM) return [{ t: name.slice(0, at), px: 30 }, { t: name.slice(at + 1), px: 30 }];
  return [{ t: letters.slice(0, cut).join(''), px: 30 }, { t: letters.slice(cut).join(''), px: 30 }];
}
function chip(o, y, s) {
  const p = s.player || { id: 'advanced', name: '' };
  const name = chipName(p.name);
  const w = EDGE * 2 + 12 + 22 + 68 + 14 + Math.max(...name.map(l => textWidth(l.t, font(600, l.px))), name.length > 1 ? 0 : textWidth('змінити', font(500, 30)));
  const b = target(o, s, {
    id: 'who', x: LEFT, y, w, h: BAR_H, align: 'left', pad: 12,
    pre: { w: 68, h: 68, draw: (q, x, yy) => q.custom(ctx => drawAvatar(ctx, PLAYER_SIGN[p.id], x, yy, 68, C.avatar, C.text)) },
    words: t => [...name.map(l => word(l.t, t, { px: l.px })), name.length === 1 && second('змінити', t)],
  });
  return { x1: b.x + b.w };
}
// «Екрани»: back to vrplay's screens; while the PC opens them it does nothing and says so.
function screensButton(o, s, y) {
  const busy = s.screens === 'busy';
  const words = busy ? [['Повертаю', 33, 'до екранів…']] : [['Екрани', SIZE.word, '']];
  const [w1, px, w2] = words[0];
  const wide = Math.max(textWidth(w1, font(600, px)), w2 ? textWidth(w2, font(500, 30)) : 0);
  const w = EDGE * 2 + 26 * 2 + 44 + 14 + wide;
  target(o, s, { id: 'screens', x: RIGHT - w, y, w, h: BAR_H, off: busy, icon: 'screens', words: t => [word(w1, t, { px }), w2 && { ...second(w2, t), colour: busy ? C.text : t.sub }] });
  return RIGHT - w;
}
// The amber band of «Підлаштувати» and the calibration: «Скасувати», the mode's sign and words.
const BAND_PAD = 18;
function band(o, s, { cancel, icon, title, sub }) {
  o.rect(LEFT, TOP.y, INSIDE, TOP.h, 15, C.amber);
  const label = 'Скасувати', f = font(600, SIZE.word);
  const w = EDGE * 2 + 26 * 2 + 44 + 14 + textWidth(label, f);
  const b = target(o, s, { id: cancel, x: LEFT + 3, y: TOP.y + 3, w, h: BAR_H, look: 'band', icon: 'close', words: t => [word(label, t)] });
  const x = b.x + b.w + 14;
  o.icon(icon, x, TOP.y + TOP.h / 2 - 26, 52, C.amberInk);
  // the words end 6 mm before the band does (as the way back's words stand inside it), the title
  // smaller when it would reach nearer
  const room = RIGHT - BAND_PAD - (x + 68);
  const px = [SIZE.word, 36, 33].find(v => textWidth(title, font(700, v)) <= room) || 33;
  const lines = linesItem([{ t: title, f: font(700, px), px, lh: 1.05, colour: C.amberInk },
    { t: sub, f: font(600, 30), px: 30, lh: 1.15, colour: C.amberInk }], { room });
  lines.draw(o, x + 52 + 16, TOP.y + (TOP.h - lines.h) / 2);
}

// The bottom bar: on the left the screen's own (paging, «Клавіатура», a step back); «Панель сюди»
// always at the right (brief §3.1.3).
function bottom(o, s, left = null, { y = BOTTOM.y, h = BOTTOM.h } = {}) {
  const by = y + (h - ROW_H) / 2;
  if (left) left(o, by);
  const w = hereWidth();
  target(o, s, { id: 'here', x: RIGHT - w, y: by, w, h: ROW_H, icon: 'here', pad: 22, words: t => [word('Панель', t, { px: 33 }), second('сюди', t)] });
}
const hereWidth = () => EDGE * 2 + 22 * 2 + 44 + 14 + Math.max(textWidth('Панель', font(600, 33)), textWidth('сюди', font(500, 30)));
// «Клавіатура» at the left of the bottom bar of every page but the keyboard's own, the
// calibration's and the home while no keyboard stands (docs/piano-keyboard-handles-design.md §6.2):
// its icon over its word, KEYBOARD_W wide. The page's own target of the bottom bar stands after it,
// from OWN_X to 24 px before «Панель сюди» (ownWidth).
export const KEYBOARD_W = EDGE * 2 + 14 * 2 + 163;
export const OWN_X = LEFT + KEYBOARD_W + 24;
export const ownWidth = () => RIGHT - hereWidth() - 24 - OWN_X;
function keyboardButton(o, s, y) {
  target(o, s, { id: 'keyboard', x: LEFT, y, w: KEYBOARD_W, h: ROW_H, col: true, icon: 'keyboard', iconSize: 40, gap: 4, words: t => [word('Клавіатура', t, { px: SIZE.min })] });
}
// The bottom bar's left: «Клавіатура», then the page's own target (own(o, y, x, w)) if any.
const keyboardBar = (s, own = null) => (o, y) => {
  keyboardButton(o, s, y);
  if (own) own(o, y, OWN_X, ownWidth());
};
// A plain button of the bottom bar's left beside «Клавіатура»: a word at 36 px over a second line,
// without an icon.
const barButton = (s, id, label, sub = '', { off = false } = {}) => keyboardBar(s, (o, y, x) => {
  const wide = Math.max(textWidth(label, font(600, 36)), sub ? textWidth(sub, font(500, 30)) : 0);
  target(o, s, { id, x, y, w: EDGE * 2 + 26 * 2 + wide, h: ROW_H, off, words: t => [word(label, t, { px: 36 }), sub && second(sub, t)] });
});
// Paging beside «Клавіатура»: «вище» and «нижче», each its icon over its word, the two sharing the
// room 24 px apart, as every target of the bar stands from the next; at an end the arrow is faint
// and does nothing (the top bar says «1 з 3» after the block's name).
const pager = (s, page, pages) => keyboardBar(s, (o, y, x, w) => {
  const first = page <= 0, last = page >= pages - 1;
  const pw = (w - 24) / 2;
  const pg = (id, icon, label, off, px) => target(o, s, { id, x: px, y, w: pw, h: ROW_H, off, col: true, icon, iconSize: 36, gap: 2,
    words: t => [word(label, t, { px: 30 })] });
  pg('listUp', 'up', 'вище', first, x);
  pg('listDown', 'down', 'нижче', last, x + pw + 24);
});

// The strip that asks for something (brief §3.1.6): «!», the words in bold, why under them.
function alertBar(o, x, y, w, alert, { compact = false } = {}) {
  if (compact) {
    const f = font(700, 33), room = w - 2 * EDGE - 36 - 38 - 14;
    const lines = wrap(alert.title, room, f).slice(0, 2);
    const h = 54 + (lines.length - 1) * 38;
    o.rect(x, y, w, h, 15, C.alert, C.alertEdge, EDGE);
    o.icon('alert', x + 18 + EDGE, y + 8, 38, C.text);
    lines.forEach((l, i) => o.text(l, x + EDGE + 18 + 38 + 14, baselineAt(y + 27 + i * 38, 33), f, C.text, { room }));
    if (wrap(alert.title, room, f).length > 2) o.cut.push(alert.title);
    return h;
  }
  const room = w - 2 * EDGE - 48 - 48 - 18;
  const titles = wrap(alert.title, room, font(700, 36)).slice(0, 2);
  const lines = [...titles.map(t => ({ t, f: font(700, 36), px: 36, lh: 1.15, colour: C.text })),
    alert.sub && { t: alert.sub, f: font(500, 30), px: 30, lh: 1.2, colour: C.alertSub }].filter(Boolean);
  const item = linesItem(lines, { room });
  const h = Math.max(96, item.h + 2 * 10 + 2 * EDGE);
  o.rect(x, y, w, h, 15, C.alert, C.alertEdge, EDGE);
  o.icon('alert', x + EDGE + 24, y + (h - 48) / 2, 48, C.text);
  item.draw(o, x + EDGE + 24 + 48 + 18, y + (h - item.h) / 2);
  return h;
}

// A lamp: a rose dot, filled when that pass (or speed) was played to its end; dashed when left out.
function lampItem(at, on, { skipped = false, px = 30 } = {}) {
  const t = skipped ? `${at}\u00a0% пропущено` : `${at}\u00a0%`;
  const f = font(600, px);
  return {
    w: 22 + 8 + textWidth(t, f), h: px * 1.15,
    draw(o, x, y) {
      o.circle(x + 11, y + (px * 1.15) / 2, 11 - 1.5, on ? C.rose : null, skipped ? C.sec : C.rose, 3, skipped ? [4, 3] : null);
      o.text(t, x + 30, baselineIn(y, px, 1.15), f, skipped ? C.sec : C.text);
    },
  };
}
function row(o, items, x, y, gap) {
  let at = x;
  const h = Math.max(...items.map(i => i.h));
  for (const i of items) { i.draw(o, at, y + (h - i.h) / 2); at += i.w + gap; }
  return at - gap - x;
}

// ----------------------------------------------------------------------------------------------
// The screens (brief §3.4). Each: (o, s) with s App.panelState.

const S = {};

// S1 «Хто грає?»: a card a player, the whole card the target: their sign, name, the start the
// catalog gives their songs and how many of their songs they played to the end; «востаннє» on who
// played last.
S.who = (o, s) => {
  top(o, s, { title: 'Хто грає?', screens: true });
  const players = s.profiles || [];
  const n = Math.max(1, players.length);
  const h = Math.min(178, (CONTENT.h - (n - 1) * 36) / n);
  players.forEach((p, k) => {
    const y = CONTENT.y + k * (h + 36);
    const sub = `${p.hint} · зіграно ${p.played ?? 0} з ${p.total ?? 0}`;
    const last = s.profile === p.id;
    const tagF = font(700, 30), tagW = last ? textWidth('востаннє', tagF) + 32 : 0;
    // the name whole (up to 16 of the widest letters): from 39 px down to 30, clear of «востаннє»
    const room = INSIDE - 2 * EDGE - 60 - 116 - 30;
    const nameRoom = room - (tagW ? tagW + 26 - 30 : 0);
    const px = [39, 36, 33, 30].find(v => textWidth(p.name, font(600, v)) <= nameRoom) || 30;
    target(o, s, {
      id: `profile:${k}`, x: LEFT, y, w: INSIDE, h, align: 'left', pad: 30, gap: 30, room,
      pre: { w: 116, h: 116, draw: (q, x, yy) => q.custom(ctx => drawAvatar(ctx, PLAYER_SIGN[p.id], x, yy, 116, C.avatar, C.text)) },
      words: t => [word(p.name, t, { px }), second(sub, t)],
    });
    if (last) {
      // at the top right; under a name that reaches it, at the bottom right
      const tx = RIGHT - EDGE - 26 - tagW;
      const nameEnd = LEFT + EDGE + 30 + 116 + 30 + textWidth(p.name, font(600, px));
      const ty = nameEnd > tx - 12 ? y + h - EDGE - 22 - 42.5 : y + EDGE + 22;
      o.rect(tx, ty, tagW, 42.5, 21, C.rose);
      o.text('востаннє', tx + 16, baselineIn(ty + 4, 30, 1.15), tagF, C.ink);
    }
  });
  bottom(o, s, keyboardBar(s));
};

// A block's difficulty as five dots, filled up to it (white, no hue: brief §5.1); one's own songs
// a note.
const BLOCK_NAME = { 1: 'Найлегші', 2: 'Легкі', 3: 'Середні', 4: 'Складні', 5: 'Найскладніші', own: 'Мої', all: 'Усі пісні' };
export const blockName = b => BLOCK_NAME[b] || BLOCK_NAME.all;
function dotsItem(n, colour) {
  return {
    w: 14, h: 86,
    draw(o, x, y) {
      for (let i = 0; i < 5; i++) {
        const cy = y + 86 - 7 - i * 18;
        o.circle(x + 7, cy, 7 - 1.5, i < n ? colour : null, colour, 3);
      }
    },
  };
}
const playedOf = b => `зіграно ${b.k} з ${b.n}`;
function blockButton(o, s, b, x, y, w) {
  target(o, s, {
    id: `block:${b.block}`, x, y, w, h: ROW_H, align: 'left', pad: 22,
    pre: b.block === 'own' ? iconItem('note', 40, C.sec) : dotsItem(b.block, C.text),
    words: t => [word(blockName(b.block), t), second(playedOf(b), t)],
  });
}
function blocksGrid(o, s, blocks, y, gap = 36) {
  const w = (INSIDE - 24) / 2;
  blocks.forEach((b, i) => blockButton(o, s, b, LEFT + (i % 2) * (w + 24), y + Math.floor(i / 2) * (ROW_H + gap), w));
}

// S2 the player's home: «Продовжити» with their last song, else the first block «Почни тут»; the
// blocks of their songs by difficulty and «Мої»; «Розігрів», the player's warm-up before that
// song, at the bottom left (the one place from the brief's S2 that is not in its prototype); the
// keyboard not standing: the strip in one line and «Калібрувати» instead of «Продовжити», the
// blocks closer, «Розігрів» over «Калібрувати» and doing nothing until the keyboard stands.
const HERE_W = EDGE * 2 + 22 * 2 + 44 + 14 + Math.max(textWidth('Панель', font(600, 33)), textWidth('сюди', font(500, 30)));
// The way to the song in a word: «6 вправ › пісня», the steps the session counts («Вправа N з 6»).
const exercises = n => `${n}\u00a0${n % 10 === 1 && n % 100 !== 11 ? 'вправа' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'вправи' : 'вправ'}`;
// compact: beside «Клавіатура», where «Розігрів · ≈ 4 хв» and its way do not fit beside the icon:
// the icon and «Розігрів» at the word's size as ever, the minutes under it (or why it is off).
function homeWarm(o, s, w, x, y, wide, why = '', { compact = false } = {}) {
  const reason = why || (!w ? 'вправ немає' : !Number.isInteger(w.index) ? 'немає пісні' : '');
  const pad = compact ? 12 : 26, gap = compact ? 8 : 14;
  const room = wide - 2 * EDGE - 2 * pad - 44 - gap;
  if (compact) {
    target(o, s, { id: 'homeWarm', x, y, w: wide, h: ROW_H, off: !!reason, align: 'left', pad, gap, icon: 'warm', room,
      words: t => [word('Розігрів', t), second(reason || nb(`≈ ${w.minutes} хв`), t)] });
    return;
  }
  const path = reason ? null : pathItem([exercises(w.count)], room);
  target(o, s, { id: 'homeWarm', x, y, w: wide, h: ROW_H, off: !!reason, align: 'left', pad, icon: 'warm',
    room,
    words: t => [word(w ? nb(`Розігрів · ≈ ${w.minutes} хв`) : 'Розігрів', t), path ? { draw: path.draw, w: path.w, px: 30, lh: 1.15, gap: 6 } : second(reason, t)] });
}
S.home = (o, s) => {
  const h = s.home || { last: null, blocks: [], warm: null };
  top(o, s, { left: (q, y) => chip(q, y, s), screens: true });
  if (s.alert && s.alert.calibrate) {
    const ah = alertBar(o, LEFT, CONTENT.y, INSIDE, s.alert, { compact: true });
    blocksGrid(o, s, h.blocks, CONTENT.y + ah + 24, 24);
    const y = 762, hh = 150;
    homeWarm(o, s, h.warm, LEFT, y - 24 - ROW_H, INSIDE - 48 - HERE_W, 'спершу калібруй');
    target(o, s, { id: 'calibrate', x: LEFT, y, w: INSIDE - 48 - HERE_W, h: hh, r: hh / 2, look: 'primary', align: 'left', pad: 36, icon: 'target', iconSize: 56,
      words: t => [word('Калібрувати', t, { weight: 700 }), second('двома дотиками', t, { weight: 600 })] });
    bottom(o, s, null, { y, h: hh });
    return;
  }
  const y = CONTENT.y + 21;
  let blocks = h.blocks;
  if (h.last) {
    const room = INSIDE - 2 * EDGE - 96 - 56 - 14;
    const lines = wrap(nb(h.last.title), room, font(600, 30)).slice(0, 2);
    target(o, s, { id: 'continue', x: LEFT, y, w: INSIDE, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'play', iconSize: 56, pad: 48, room,
      words: t => [word('Продовжити', t, { weight: 700 }), ...lines.map(l => second(l, t, { weight: 600 }))] });
  } else if (blocks.length) {
    const b = blocks[0];
    blocks = blocks.slice(1);
    target(o, s, { id: `block:${b.block}`, x: LEFT, y, w: INSIDE, h: MAIN_H, r: MAIN_H / 2, look: 'primary', pad: 48,
      words: t => [kick('Почни тут', t), word(blockName(b.block), t, { weight: 700 }), second(playedOf(b), t, { weight: 600 })],
      post: b.block === 'own' ? iconItem('note', 40, C.ink) : dotsItem(b.block, C.ink) });
  }
  blocksGrid(o, s, blocks, y + MAIN_H + 24);
  bottom(o, s, keyboardBar(s, (q, by, x, w) => homeWarm(q, s, h.warm, x, by, w, '', { compact: true })));
};

// S3 a block's songs: six cards, the whole card the target: the title (its part after the first
// comma under it, smaller), who wrote it (the only text that may shorten), the lamp or «зараз», the
// length and the most keys at once.
export const CARDS = 6;
S.songs = (o, s) => {
  const g = s.grid || { page: 0, pages: 1, cards: [] };
  top(o, s, { left: (q, y) => backButton('Блоки')(q, y, s), title: blockName(g.block), sizes: [SIZE.title, 42, 36, 33, SIZE.min], after: `${g.page + 1} з ${g.pages}` });
  const w = (INSIDE - 24) / 2, h = 186;
  g.cards.forEach((c, k) => songCard(o, s, c, `card:${k}`, LEFT + (k % 2) * (w + 24), CONTENT.y + Math.floor(k / 2) * (h + 24), w, h));
  bottom(o, s, pager(s, g.page, g.pages));
};
// A card's title in at most two lines: the name in bold at 33 or 30 px and its rest (splitTitle)
// smaller in grey, on a line of its own, or after the name's comma in one run of words when that
// keeps it to two lines; else (two of the catalog's) three lines at 30 px. -> {px, lines: [[{t, f, colour}]]}
export function cardTitle(title, room) {
  const [main, rest] = splitTitle(title);
  const restF = font(600, 30);
  // the name's lines, then the rest's
  const apart = px => [...wrap(main, room, font(700, px)).map(t => [{ t, f: font(700, px), colour: C.text }]),
    ...(rest ? wrap(rest, room, restF).map(t => [{ t, f: restF, colour: C.sec }]) : [])];
  const run = px => {
    const words = [...`${main},`.split(' ').map(t => ({ t, f: font(700, px), colour: C.text })), ...rest.split(' ').map(t => ({ t, f: restF, colour: C.sec }))];
    const lines = [];
    let line = null;
    const width = l => l.reduce((a, part) => a + textWidth(part.t, part.f), 0);
    for (const wd of words) {
      if (line && width(line) + textWidth(` ${wd.t}`, wd.f) > room) { lines.push(line); line = null; }
      if (!line) { line = [{ ...wd }]; continue; }
      const prev = line[line.length - 1];
      if (prev.f === wd.f) prev.t += ` ${wd.t}`;
      else line.push({ ...wd, t: ` ${wd.t}` });
    }
    if (line) lines.push(line);
    return lines;
  };
  for (const px of [33, 30]) { const lines = apart(px); if (lines.length <= 2) return { px, lines }; }
  if (rest) for (const px of [33, 30]) { const lines = run(px); if (lines.length <= 2) return { px, lines }; }
  const lines = apart(30);
  if (lines.length <= 3) return { px: 30, lines };
  // one's own file name longer than three lines: its third line ends in «…»
  const last = lines[2][0];
  let t = last.t;
  while (t.length > 1 && textWidth(`${t}…`, last.f) > room) t = t.slice(0, -1).trimEnd();
  return { px: 30, lines: [...lines.slice(0, 2), [{ ...last, t: `${t}…` }]], shortened: true };
}
function songCard(o, s, c, id, x, y, w, h) {
  const pressed = !!(s.pressed && s.pressed.has(id));
  o.button({ id, x, y, w, h, r: 15, look: 'plain', pressed, edge: c.current ? C.rose : C.line }, q => {
    const inner = w - 2 * EDGE - 28, x0 = x + EDGE + 14;
    const t = cardTitle(c.title, inner);
    if (t.shortened) q.shortened.push(c.title);
    // a title of three lines (two of the catalog's, at 30 px) sits closer, so who wrote it keeps
    // its line
    const three = t.lines.length > 2, lh = three ? 1.04 : 1.12, pad = three ? 8 : 12, rowLh = three ? 1.1 : 1.15;
    let top = y + EDGE + pad;
    const right = c.current ? 'now' : c.played != null ? 'lamp' : null;
    // who wrote it under the title (the only text that may shorten); the lamp or «зараз» on its line
    const composer = c.own ? 'моя' : c.composer;
    for (const line of t.lines) {
      let at = x0;
      for (const part of line) at += q.text(part.t, at, baselineIn(top, t.px, lh), part.f, part.colour, { room: inner - (at - x0) });
      top += t.px * lh;
    }
    const ry = top + (three ? 0 : 2);
    let rw = 0;
    if (right === 'now') {
      const f = font(700, 30), ph = three ? 32 : 36; rw = textWidth('зараз', f) + 24;
      q.rect(x0 + inner - rw, ry, rw, ph, 8, C.rose);
      q.text('зараз', x0 + inner - rw + 12, baselineIn(ry, 30, ph / 30), f, C.ink);
    } else if (right === 'lamp') {
      const l = lampItem(Math.round(c.played * 100), true);
      rw = l.w;
      l.draw(q, x0 + inner - rw, ry);
    }
    if (composer) q.text(composer, x0, baselineIn(ry, 30, 1.15), font(500, 30), C.sec, { room: inner - (rw ? rw + 12 : 0), shorten: true });
    const facts = [];
    if (c.seconds != null) facts.push({ w: textWidth(clock(c.seconds), font(600, 30, true)), h: 34.5, draw: (qq, xx, yy) => qq.text(clock(c.seconds), xx, baselineIn(yy, 30, 1.15, true), font(600, 30, true), C.text) });
    if (c.keys != null) {
      const t = `${c.keys} разом`;
      facts.push({ w: 8 + 34 + 8 + textWidth(t, font(500, 30)), h: 34.5, draw: (qq, xx, yy) => { qq.icon('keys', xx + 8, yy, 34, C.sec, { stroke: 5 }); qq.text(t, xx + 50, baselineIn(yy, 30, 1.15), font(500, 30), C.sec); } });
    } else if (c.own && c.seconds == null) facts.push({ w: textWidth('рахую…', font(500, 30)), h: 34.5, draw: (qq, xx, yy) => qq.text('рахую…', xx, baselineIn(yy, 30, 1.15), font(500, 30), C.sec) });
    row(q, facts, x0, y + h - EDGE - pad - 30 * rowLh, 10);
  });
}

// S4 a song: its whole title, who wrote it, length and keys at once, the player's level and tempo
// of it, its lamps at 50 / 75 / 100 %; «Грати», and «Спершу розігрів» with the way through the
// warm-ups to the song.
S.song = (o, s) => {
  const p = s.pick;
  if (!p) { top(o, s, { left: (q, y) => backButton('Пісні')(q, y, s) }); bottom(o, s, keyboardBar(s)); return; }
  top(o, s, { left: (q, y) => backButton(blockName(p.block))(q, y, s) });
  const [main, rest] = splitTitle(p.title);
  let y = CONTENT.y;
  const tf = font(700, SIZE.title);
  for (const l of wrap(main, INSIDE, tf)) { o.text(l, LEFT, baselineIn(y, 48, 1.08), tf, C.text, { room: INSIDE }); y += 48 * 1.08; }
  for (const l of rest ? wrap(rest, INSIDE, font(600, 36)) : []) { o.text(l, LEFT, baselineIn(y, 36, 1.2), font(600, 36), C.sec, { room: INSIDE }); y += 36 * 1.2; }
  const fact = (t, f = font(500, 30), colour = C.sec) => ({ w: textWidth(t, f), h: 36, draw: (q, x, yy) => q.text(t, x, baselineIn(yy, 30, 1.2, f.includes('Mono')), f, colour) });
  const facts = [fact(p.own ? 'моя пісня' : p.composer), p.seconds != null && fact(clock(p.seconds), font(600, 30, true), C.text),
    p.keys != null && { w: textWidth('клавіш разом: ', font(500, 30)) + textWidth(String(p.keys), font(600, 30)), h: 36,
      draw: (q, x, yy) => { const a = q.text('клавіш разом: ', x, baselineIn(yy, 30, 1.2), font(500, 30), C.sec); q.text(String(p.keys), x + a, baselineIn(yy, 30, 1.2), font(600, 30), C.text); } }].filter(Boolean);
  y += 10;
  row(o, facts, LEFT, y, 18);
  y += 36 + 10;
  const warmY = contentBottom - 120, playY = warmY - 24 - MAIN_H;
  // a song that did not read says so where its level and lamps stand
  if (p.problem) alertBar(o, LEFT, y, INSIDE, { title: p.problem }, { compact: true });
  else {
    const lamps = songLamps(o, p, y);
    // notes past the 61 keys, played an octave nearer: a fact in grey, never a strip (there is
    // nothing to do about it); under the lamps, else beside the level and tempo in short, else
    // (a title of one's own of three lines) left out
    if (p.octave) {
      const f = font(500, 30), long = notesMoved(p.octave), short = notesMoved(p.octave, true);
      if (lamps.y + 8 + 36 <= playY - 12) o.text(long, LEFT, baselineIn(lamps.y + 8, 30, 1.2), f, C.sec, { room: INSIDE });
      else if (lamps.pills + 24 + textWidth(short, f) <= RIGHT) o.text(short, lamps.pills + 24, baselineIn(y + 5, 30, 1.2), f, C.sec);
      else o.shortened.push(long);
    }
  }
  target(o, s, { id: 'songPlay', x: LEFT, y: playY, w: INSIDE, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'play', iconSize: 56,
    words: t => [word('Грати', t, { weight: 700 })] });
  const w = p.warm, warmRoom = INSIDE - 2 * EDGE - 56 - 44 - 14;
  const path = w ? pathItem(w.path, warmRoom) : null;
  target(o, s, { id: 'songWarm', x: LEFT, y: warmY, w: INSIDE, h: 120, off: !w, align: 'left', pad: 28, icon: 'warm',
    words: t => [word(w ? nb(`Спершу розігрів · ≈ ${w.minutes} хв`) : 'Спершу розігрів', t), w ? { draw: path.draw, w: path.w, px: 30, lh: 1.15, gap: 6 } : second('для цього гравця вправ немає', t)],
    room: warmRoom });
  bottom(o, s, keyboardBar(s));
};
// The player's level and tempo of a song, and its lamps at 50 / 75 / 100 %. -> {y under them, x
// where the level and tempo end}.
function songLamps(o, p, y) {
  const pill = t => ({ w: textWidth(t, font(600, 30)) + 34, h: 46, draw: (q, x, yy) => { q.rect(x + 1.5, yy + 1.5, textWidth(t, font(600, 30)) + 31, 43, 21, null, C.line, 3); q.text(t, x + 17, baselineIn(yy + 5, 30, 1.2), font(600, 30), C.text); } });
  const pills = LEFT + row(o, [pill(`рівень ${p.level}`), pill(`темп ${pct(p.speed)}`)], LEFT, y, 18);
  y += 46 + 10;
  const said = { w: textWidth('зіграно до кінця:', font(500, 30)), h: 36, draw: (q, x, yy) => q.text('зіграно до кінця:', x, baselineIn(yy, 30, 1.2), font(500, 30), C.sec) };
  row(o, [said, ...[50, 75, 100].map(at => lampItem(at, p.played != null && p.played * 100 >= at))], LEFT, y, 18);
  return { y: y + 36, pills };
}
// «14 нот перенесено на октаву» (short: «14 нот на октаву ближче»): the song's notes beyond the 61
// keys (metrics.js outside).
export function notesMoved(n, short = false) {
  const one = n % 10 === 1 && n % 100 !== 11, few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  if (short) return `${n}\u00a0${one ? 'нота' : few ? 'ноти' : 'нот'} на октаву ближче`;
  return `${n}\u00a0${one ? 'ноту' : few ? 'ноти' : 'нот'} перенесено на октаву`;
}
// The way through the warm-ups to the song in `room` px: their short names, a chevron between,
// «пісня» last; the names alone when «пісня» would not fit beside them (the line above says the
// song comes after), and a way longer than the room is cut (and recorded).
function pathItem(names, room = Infinity) {
  const f = font(500, 30), song = font(700, 30), step = 6 + 26 + 6;
  const widthOf = parts => parts.reduce((a, t, i) => a + textWidth(t, i === names.length ? song : f), 0) + (parts.length - 1) * step;
  let parts = [...names, 'пісня'];
  if (names.length && widthOf(parts) > room + 0.5) parts = [...names];
  return {
    w: Math.min(widthOf(parts), room), h: 34.5,
    draw(o, x, y) {
      let at = x;
      parts.forEach((t, i) => {
        const last = i === parts.length - 1, isSong = i === names.length;
        at += o.text(t, at, baselineIn(y, 30, 1.15), isSong ? song : f, isSong ? C.text : C.sec, { room: x + room - at });
        if (!last) { o.icon('next', at + 6, y + 4, 26, C.dim, { stroke: 5 }); at += step; }
      });
    },
  };
}

// ----------------------------------------------------------------------------------------------
// The warm-up (brief §3.4 W1-W4): the way out at the top left; a dot a step, the one now a long
// rose pill, done white, left out a dashed ring.
function stepDots(marks) {
  const w = marks.reduce((a, m) => a + (m === 'now' ? 64 : 26), 0) + 14 * (marks.length - 1);
  return {
    w, h: 26,
    draw(o, x, y) {
      let at = x;
      for (const m of marks) {
        const wide = m === 'now' ? 64 : 26;
        if (m === 'now') o.rect(at, y, 64, 26, 13, C.rose);
        else if (m === 'done') o.circle(at + 13, y + 13, 13, C.text);
        else if (m === 'skipped') o.circle(at + 13, y + 13, 13 - 1.5, null, C.sec, 3, [4, 3]);
        else o.circle(at + 13, y + 13, 13 - 1.5, C.cardHi, C.line, 3);
        at += wide + 14;
      }
    },
  };
}
// The steps' marks for the warm-ups alone (the song is the session's last step).
const warmMarks = x => x.marks.slice(0, x.warmups);
function stepLine(o, x, y) {
  const f = font(700, 36);
  o.text(`Вправа ${x.number} з ${x.warmups}`, LEFT, baselineIn(y, 36, 1.1), f, C.text);
  const d = stepDots(warmMarks(x));
  d.draw(o, RIGHT - d.w, y + (39.6 - 26) / 2);
  return 39.6;
}
// A warm-up's title and its pass's speed in a pill beside it, or under it when they do not fit.
function warmTitle(o, title, speed, y) {
  const f = font(700, SIZE.title), pf = font(600, SIZE.title), t = `${Math.round(speed * 100)}\u00a0%`;
  const pw = textWidth(t, pf) + 34, lh = 48 * 1.1;
  const lines = wrap(title, INSIDE, f);
  let at = y;
  lines.forEach(l => { o.text(l, LEFT, baselineIn(at, 48, 1.1), f, C.text, { room: INSIDE }); at += lh; });
  const lastW = textWidth(lines[lines.length - 1] || '', f);
  let px = LEFT + lastW + 20, py = at - lh;
  if (lastW + 20 + pw > INSIDE) { px = LEFT; py = at + 8; at += lh + 8; }
  o.rect(px, py + 1, pw, lh - 2, 22, null, C.line, 3);
  o.text(t, px + 17, baselineIn(py, 48, 1.1), pf, C.text);
  return at - y;
}
const exitTop = (o, s) => top(o, s, { left: (q, y) => exitButton(q, y, s) });

S.session = (o, s) => {
  const x = s.session;
  if (!x) { exitTop(o, s); bottom(o, s, keyboardBar(s)); return; }
  if (x.intro) return warmBody(o, s);
  if (x.next && x.next.kind === 'song') return warmDone(o, s, x);
  exitTop(o, s);
  const n = x.next;
  let y = CONTENT.y;
  y += stepLine(o, x, y) + 18;
  y += warmTitle(o, n.title, n.speed, y) + 14;
  const how = wrap(n.summary || '', INSIDE, font(500, 36)).slice(0, 3);
  for (const l of how) { o.text(l, LEFT, baselineIn(y, 36, 1.25), font(500, 36), C.text, { room: INSIDE }); y += 45; }
  y += 14;
  if (x.problem) {
    y += alertBar(o, LEFT, y, INSIDE, { title: x.problem }, { compact: true }) + 8;
  } else if (x.last) {
    const t = `${x.last.result === 'done' ? 'Зіграно' : 'Пропущено'}: ${x.last.title}`;
    o.icon(x.last.result === 'done' ? 'check' : 'skip', LEFT, y + 1, 34, C.text, { stroke: 6 });
    for (const l of wrap(nb(t), INSIDE - 46, font(500, 30)).slice(0, 2)) { o.text(l, LEFT + 46, baselineIn(y, 30, 1.2), font(500, 30), C.sec, { room: INSIDE - 46 }); y += 36; }
    y += 8;
  }
  const said = { w: textWidth('Проходи:', font(500, 30)), h: 36, draw: (q, xx, yy) => q.text('Проходи:', xx, baselineIn(yy, 30, 1.2), font(500, 30), C.sec) };
  row(o, [said, ...n.lamps.map(l => lampItem(Math.round(l.speed * 100), l.on))], LEFT, y, 22);
  const by = contentBottom - MAIN_H;
  target(o, s, { id: 'session:start', x: LEFT, y: by, w: 432, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'play', iconSize: 56, words: t => [word('Почати', t, { weight: 700 })] });
  target(o, s, { id: 'session:skip', x: LEFT + 432 + 24, y: by, w: INSIDE - 432 - 24, h: MAIN_H, col: true, icon: 'skip', iconSize: 44, gap: 4, words: t => [word('Пропустити', t, { px: 33 })] });
  bottom(o, s, barButton(s, 'session:repeat', 'Повторити', 'попередню', { off: x.at === 0 }));
};
function warmBody(o, s) {
  top(o, s, { left: (q, y) => exitButton(q, y, s) });
  const lf = font(700, SIZE.word), llh = 43;
  const y = CONTENT.y;
  o.text('Розминка без клавіш', LEFT, baselineIn(y, 48, 1.1), font(700, SIZE.title), C.text, { room: INSIDE - 140 });
  o.text('20\u00a0с', RIGHT, baselineIn(y, 48, 1.1, true), font(700, SIZE.title, true), C.text, { align: 'right' });
  const my = y + 52.8 + 26, w = (INSIDE - 48) / 3;
  [['wrists', 'Кола'], ['fists', 'Кулачки'], ['shoulders', 'Плечі']].forEach(([k, label], i) => {
    const x = LEFT + i * (w + 24);
    o.rect(x, my, w, 240, 15, C.card, C.line, EDGE);
    o.art(BODY[k], x + (w - 150) / 2, my + (240 - 150 - 8 - llh) / 2, 150, { fg: C.text, accent: C.rose });
    o.text(label, x + w / 2, baselineIn(my + (240 - 150 - 8 - llh) / 2 + 158, Number(/(\d+)px/.exec(lf)[1]), 1.1), lf, C.text, { align: 'center', room: w - 16 });
  });
  const by = contentBottom - MAIN_H;
  target(o, s, { id: 'session:start', x: LEFT, y: by, w: 432, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'check', iconSize: 56, words: t => [word('Готово', t, { weight: 700 })] });
  target(o, s, { id: 'session:skipBody', x: LEFT + 432 + 24, y: by, w: INSIDE - 432 - 24, h: MAIN_H, col: true, icon: 'skip', gap: 4,
    words: t => [word('Пропустити', t, { px: 33 }), second('розминку', t)] });
  bottom(o, s, keyboardBar(s));
}

function warmDone(o, s, x) {
  exitTop(o, s);
  let y = CONTENT.y;
  o.icon('check', LEFT, y + 6, 52, C.text);
  o.text('Розігрів пройдено', LEFT + 72, baselineIn(y, 48, 1.1), font(700, SIZE.title), C.text, { room: INSIDE - 72 });
  y += 52.8 + 6;
  o.text(`Зіграно ${x.played ?? 0}, пропущено ${x.skipped ?? 0}`, LEFT, baselineIn(y, 36, 1.25), font(500, 36), C.sec);
  y += 45 + 22;
  const rows = x.rows || [];
  const bottomY = contentBottom - 16 - MAIN_H - 24 - (x.problem ? 54 + 14 : 0);
  for (const r of rows) {
    const lamps = r.passes.map(p => lampItem(Math.round(p.speed * 100), p.result === 'done', { skipped: p.result === 'skipped' }));
    const lw = lamps.reduce((a, l) => a + l.w, 0) + 22 * (lamps.length - 1);
    const lines = wrap(r.title, INSIDE - 40 - lw - 16, font(600, 30)).slice(0, 2);
    const h = 24 + lines.length * 36;
    // a warm-up the card has no room for is a cut (tests/preview.mjs draws every plan)
    if (y + h > bottomY) { o.cut.push(r.title); break; }
    o.rect(LEFT, y, INSIDE, h, 12, C.card);
    row(o, lamps, RIGHT - 20 - lw, y + (h - 34.5) / 2, 22);
    lines.forEach((l, i) => o.text(l, LEFT + 20, baselineIn(y + 12 + i * 36, 30, 1.2), font(600, 30), C.text, { room: INSIDE - 40 - lw - 16 }));
    y += h + 14;
  }
  const py = contentBottom - 16 - MAIN_H;
  if (x.problem) alertBar(o, LEFT, py - 24 - 54, INSIDE, { title: x.problem }, { compact: true });
  const room2 = INSIDE - 2 * EDGE - 96 - 56 - 14;
  const lines = wrap(nb(`Грати: ${x.next.title}`), room2, font(700, 36)).slice(0, 2);
  target(o, s, { id: 'session:start', x: LEFT, y: py, w: INSIDE, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'play', iconSize: 56, pad: 48, room: room2,
    words: t => lines.map(l => word(l, t, { px: 36, weight: 700 })) });
  bottom(o, s, barButton(s, 'session:repeat', 'Повторити', 'останню'));
}

// ----------------------------------------------------------------------------------------------
// P1 playing (a warm-up playing is W3): the title, who wrote it, the metronome's value big, its
// click; the time and the hands' colours, or the strip that asks for something; the main action
// «Спочатку» and «Звук»; four settings that each say their state and what the next press does.
// Nothing moves while a song plays (brief §3.1.9): every target stands where it stands in every
// state.
const PLAY_ROWS = { main: 348, grid: [522, 654] };
// The main row of P1 and W3 (docs/piano-audio-design.md §6.2): the main action, «Спочатку», and
// the door to the «Звук» page, each 24 px apart.
const MAIN_W = 428, RESTART_W = 168, DOOR_X = LEFT + MAIN_W + 24 + RESTART_W + 24;
const restartButton = (o, s, id, y) => target(o, s, { id, x: LEFT + MAIN_W + 24, y, w: RESTART_W, h: MAIN_H, col: true, icon: 'restart', gap: 8,
  words: t => [word('Спочатку', t, { px: SIZE.min })] });
// «Звук» and its state in a word: «так» while the metronome or the song voice is on, else «ні».
function soundDoor(o, s, y) {
  const on = !!(s.sound && s.sound.any);
  target(o, s, { id: 'section:sound', x: DOOR_X, y, w: RIGHT - DOOR_X, h: MAIN_H, col: true, icon: on ? 'sound' : 'soundOff', iconSize: 44, iconOpts: { stroke: 5 }, gap: 4,
    words: t => [word('Звук', t, { px: 33 }), second(on ? 'так' : 'ні', t)] });
}
// The title in one line at 48 px or as small as 36, else in two lines at 36, 33 or 30: whatever
// fits the room beside the metronome. -> {px, lines}
export function playTitle(main, room) {
  for (const px of [48, 42, 36]) if (textWidth(main, font(700, px)) <= room) return { px, lines: [main] };
  for (const px of [36, 33, 30]) { const lines = wrap(main, room, font(700, px)); if (lines.length <= 2 && lines.every(l => textWidth(l, font(700, px)) <= room)) return { px, lines }; }
  return { px: 30, lines: wrap(main, room, font(700, 30)).slice(0, 2) };
}
function playHead(o, s, p) {
  const m = p.metronome || {};
  const bigF = font(700, SIZE.big, true), uF = font(600, 30);
  const bpm = m.bpm || '—';
  const bw = textWidth(bpm, bigF) + 10 + textWidth('BPM', uF);
  const [main, rest] = splitTitle(p.title);
  const t = playTitle(main, INSIDE - bw - 24);
  let y = CONTENT.y;
  const lh = t.px * 1.08;
  // the title's first line and the metronome's value on one baseline (the value's line box 60 px)
  const firstBase = baselineIn(y, 60, 1, true);
  t.lines.forEach((l, i) => o.text(l, LEFT, firstBase + i * lh, font(700, t.px), C.text, { room: INSIDE - bw - 24 }));
  // the metronome's value on the title's first baseline
  o.text('BPM', RIGHT, firstBase, uF, C.sec, { align: 'right' });
  o.text(bpm, RIGHT - textWidth('BPM', uF) - 10, firstBase, bigF, C.text, { align: 'right' });
  y += 60 + (t.lines.length - 1) * lh;
  // second line: the title's rest and who wrote it; at the right the click (its finer click left
  // out when both do not fit), or the change ahead in bold; who wrote it shortened, not left out
  const lf = font(500, 30);
  const who = p.own ? 'моя пісня' : p.composer;
  const leftWords = [rest, who].filter(Boolean).join(' · ');
  const rf = m.warn ? font(700, 30) : lf;
  let right = m.warn ? m.warn : m.note ? `клац: ${m.note}` : '';
  if (!m.warn && m.note && m.note.includes(' · ') && leftWords && textWidth(leftWords, lf) + 24 + textWidth(right, rf) > INSIDE) right = `клац: ${m.note.split(' · ')[0]}`;
  const rw = textWidth(right, rf);
  o.text(right, RIGHT, baselineIn(y, 30, 1.25), rf, m.warn ? C.text : C.sec, { align: 'right', room: INSIDE });
  const lroom = INSIDE - rw - (rw ? 24 : 0);
  // a change ahead that leaves no room for five letters (a new meter and an unusual click, for one
  // bar) has the line to itself
  const beside = !(m.warn && lroom < 150);
  if (beside && rest && who && textWidth(leftWords, lf) > lroom) {
    const a = o.text(`${rest} · `, LEFT, baselineIn(y, 30, 1.25), lf, C.sec, { room: lroom });
    o.text(who, LEFT + a, baselineIn(y, 30, 1.25), lf, C.sec, { room: lroom - a, shorten: true });
  } else if (beside && leftWords) o.text(leftWords, LEFT, baselineIn(y, 30, 1.25), lf, C.sec, { room: lroom, shorten: !!who });
  y += 37.5;
  if (p.alert) {
    alertBar(o, LEFT, y + 14, INSIDE, p.alert, { compact: true });
    return;
  }
  // the time, how far along, the hands' colours
  y += 12;
  const tf = font(600, 36, true), time = `${clock(p.ended ? p.length : p.time)} / ${clock(p.length)}`;
  const tw = o.text(time, LEFT, baselineIn(y, 36, 1, true), tf, C.text);
  const legend = handsLegend(p.hands);
  const lw = row(o, legend, RIGHT - legendWidth(legend), y + 4, 10);
  const bx = LEFT + tw + 18, bw2 = RIGHT - lw - 18 - bx;
  if (bw2 > 40) {
    const f = p.length ? Math.max(0, Math.min(1, (p.ended ? p.length : p.time) / p.length)) : 0;
    o.rect(bx, y + 18 - 6, bw2, 12, 6, C.track);
    if (f > 0) o.rect(bx, y + 12, Math.max(12, bw2 * f), 12, 6, C.rose);
  }
}
function handsLegend(hands) {
  const part = (hand, t) => ({ w: 22 + 10 + textWidth(t, font(600, 30)), h: 34.5,
    draw: (o, x, y) => { o.circle(x + 11, y + 17, 11, hand === 'right' ? C.right : C.left); o.text(t, x + 32, baselineIn(y, 30, 1.15), font(600, 30), C.text); } });
  if (hands === 'right') return [part('right', 'права')];
  if (hands === 'left') return [part('left', 'ліва')];
  return [part('right', 'права'), part('left', 'ліва')];
}
const legendWidth = items => items.reduce((a, i) => a + i.w, 0) + 10 * (items.length - 1);

S.play = (o, s) => {
  const p = s.play || {};
  top(o, s, { left: (q, y) => backButton('Пісні')(q, y, s), screens: true });
  playHead(o, s, p);
  const y = PLAY_ROWS.main;
  if (p.ended) {
    target(o, s, { id: 'again', x: LEFT, y, w: MAIN_W, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'play', iconSize: 56, pad: 40,
      words: t => [word('Ще раз', t, { weight: 700 }), second(nb(`зіграно до кінця · ${pct(s.speed)}`), t, { weight: 600 })] });
  } else {
    target(o, s, { id: 'toggle', x: LEFT, y, w: MAIN_W, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: s.playing ? 'pause' : 'play', iconSize: 56,
      words: t => [word(s.playing ? 'Пауза' : 'Грати', t, { weight: 700 })] });
  }
  restartButton(o, s, 'restart', y);
  soundDoor(o, s, y);
  settings(o, s, PLAY_ROWS.grid);
  bottom(o, s, playBar(s));
};
// P1's bottom bar: «Клавіатура» in a column (its icon over its word, as on every page), then the
// guide hands' «Пальці: так / ні» with what the next press does (docs/piano-fingering-design.md
// §5), chosen while on; «Панель сюди» after them (bottom).
const playBar = s => keyboardBar(s, (o, y, x, w) => {
  const on = !!s.fingers;
  target(o, s, { id: 'fingers', x, y, w, h: ROW_H, look: on ? 'chosen' : 'plain', col: true, gap: 2,
    words: t => [word(on ? 'Пальці: так' : 'Пальці: ні', t, { px: 33 }), second(on ? 'сховати' : 'показати', t)] });
});
// The four settings, two fixed columns: each its state in words and what the next press does.
function settings(o, s, [y1, y2]) {
  const w = (INSIDE - 24) / 2;
  const cell = (id, x, y, icon, label, sub, extra = {}) => target(o, s, { id, x, y, w, h: ROW_H, align: 'left', pad: 14, gap: 12, icon, iconSize: 36, room: w - 2 * EDGE - 28 - 36 - 12, ...extra,
    words: t => [word(label, t, { px: 36 }), second(sub, t)] });
  // the loop: what is set, and what the next press does (brief §3.4 P1)
  const loop = s.loop;
  const [loopWord, loopSub] = !loop ? ['Петля', 'поставити початок'] : loop.b === undefined ? [`Петля від ${clock(loop.a)}`, 'поставити кінець']
    : ['Петля', `${clock(loop.a)}–${clock(loop.b)}: зняти`];
  cell('loop', LEFT, y1, 'loop', loopWord, loopSub, { look: loop ? 'chosen' : 'plain' });
  cell('section:tempo', LEFT + w + 24, y1, 'tempo', nb(`Темп ${pct(s.speed)}`), `підсвітка ${secs(s.lead)}`);
  const lvl = (s.levels || []).find(l => l.id === s.level);
  cell('section:level', LEFT, y2, 'level', `Рівень ${s.level}`, lvl ? lowerFirst(lvl.name) : '');
  const one = s.level === 1;
  const NEXT = { both: 'права', right: 'ліва', left: 'обидві' };
  const NAME = { both: 'обидві', right: 'права', left: 'ліва' };
  const hands = one ? 'right' : s.hands || 'both';
  const dots = { w: 44, h: 60, draw: (q, x, y) => {
    if (hands === 'both') { q.circle(x + 22, y + 13, 13, C.right); q.circle(x + 22, y + 47, 13, C.left); } else q.circle(x + 22, y + 30, 13, hands === 'right' ? C.right : C.left);
  } };
  target(o, s, { id: 'hands', x: LEFT + w + 24, y: y2, w, h: ROW_H, align: 'left', pad: 14, gap: 12, off: one, pre: dots, room: w - 2 * EDGE - 28 - 44 - 12,
    words: t => [word(`Руки: ${NAME[hands]}`, t, { px: 36 }), second(one ? 'на рівні 1' : `далі: ${NEXT[hands]}`, t)] });
}

// W3 a warm-up playing: where the session stands, the warm-up and its pass, the time, how to play
// it in a line, the metronome in its box; «Пауза» / «Грати», «Спочатку», «Пропустити».
S.warmup = (o, s) => {
  const x = s.session, p = s.play || {};
  exitTop(o, s);
  if (!x) { bottom(o, s, keyboardBar(s)); return; }
  const n = x.next;
  let y = CONTENT.y;
  y += stepLine(o, x, y) + 18;
  y += warmTitle(o, n.title, n.speed, y) + 18;
  const boxW = 232, room = INSIDE - boxW - 24;
  const m = p.metronome || {};
  o.rect(RIGHT - boxW, y, boxW, 168, 15, C.card, C.line, EDGE);
  o.text('метроном', RIGHT - boxW + EDGE + 20, baselineIn(y + 14 + EDGE, 30, 1.2), font(600, 30), C.sec);
  o.text(m.bpm || '—', RIGHT - boxW + EDGE + 20, baselineIn(y + 14 + EDGE + 36, 60, 1, true), font(700, SIZE.big, true), C.text, { room: boxW - 48 });
  o.text('BPM', RIGHT - boxW + EDGE + 20, baselineIn(y + 14 + EDGE + 96, 30, 1.2), font(600, 30), C.sec);
  // how to play it starts under the time, or under a strip of two lines
  let howY = y + 60;
  if (p.alert) {
    howY = Math.max(howY, y + alertBar(o, LEFT, y, room, p.alert, { compact: true }) + 14);
  } else {
    const tf = font(600, 36, true), time = `${clock(p.time)} / ${clock(p.length)}`;
    const tw = o.text(time, LEFT, baselineIn(y + 6, 36, 1, true), tf, C.text);
    const bx = LEFT + tw + 18, bw = LEFT + room - bx;
    const f = p.length ? Math.max(0, Math.min(1, p.time / p.length)) : 0;
    o.rect(bx, y + 6 + 12, bw, 12, 6, C.track);
    if (f > 0) o.rect(bx, y + 18, Math.max(12, bw * f), 12, 6, C.rose);
  }
  // how to play it, whole: as many lines as it takes above the main action
  const how = wrap(n.summary || '', room, font(500, 30));
  const fit = Math.floor((contentBottom - MAIN_H - 12 - howY) / 37.5);
  how.slice(0, fit).forEach((l, i) => o.text(l, LEFT, baselineIn(howY + i * 37.5, 30, 1.25), font(500, 30), C.text, { room }));
  if (how.length > fit) o.cut.push(n.summary);
  const by = contentBottom - MAIN_H;
  target(o, s, { id: 'toggle', x: LEFT, y: by, w: MAIN_W, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: s.playing ? 'pause' : 'play', iconSize: 56, words: t => [word(s.playing ? 'Пауза' : 'Грати', t, { weight: 700 })] });
  restartButton(o, s, 'session:repeat', by);
  soundDoor(o, s, by);
  bottom(o, s, keyboardBar(s, (q, y, bx) => target(q, s, { id: 'session:skip', x: bx, y, w: EDGE * 2 + 14 * 2 + Math.ceil(textWidth('Пропустити', font(600, SIZE.min))), h: ROW_H,
    col: true, icon: 'skip', iconSize: 36, gap: 4, words: t => [word('Пропустити', t, { px: SIZE.min })] })));
};

// ----------------------------------------------------------------------------------------------
// P2 the tempo: the speed and how early the keys light, the chosen filled rose with a tick; the
// metronome at this speed; «Готово» back to playing, and «Лінії тактів: так / ні» beside it. Six
// speeds (song.js SPEEDS) leave a pill too narrow for «100 %» at 36 px: the pills show the number,
// the row's name the unit.
S.tempo = (o, s) => {
  top(o, s, { left: (q, y) => backButton('Гра')(q, y, s), title: 'Темп' });
  let y = CONTENT.y;
  const group = (label, ids, values, chosen, fmt) => {
    o.text(label, LEFT, baselineIn(y, 36, 1.1), font(700, 36), C.text);
    y += 39.6 + 10;
    const w = (INSIDE - 24 * (values.length - 1)) / values.length;
    values.forEach((v, i) => {
      const on = chosen(v);
      target(o, s, { id: ids(v), x: LEFT + i * (w + 24), y, w, h: ROW_H, col: true, look: on ? 'chosen' : 'plain', gap: 2,
        pre: on ? iconItem('check', 30, C.ink, { stroke: 6 }) : null, words: t => [word(fmt(v), t, { px: 36, weight: 700, mono: true, lh: 1.1 })] });
    });
    y += ROW_H;
  };
  group('Швидкість, %', v => `speed:${v}`, SPEEDS.map(v => Math.round(v * 100)), v => Math.round((s.speed || 0) * 100) === v, v => String(v));
  y += 18;
  group('Підсвітка наперед', v => `lead:${v}`, s.leads || [1, 1.5, 2, 3], v => s.lead === v, v => secs(v));
  y += 16;
  const m = (s.play && s.play.metronome) || {};
  if (m.bpm) {
    // at this speed: the click's value and note, the finer click on a second line when it is long
    o.icon('tempo', LEFT, y + 1, 34, C.text, { stroke: 6 });
    const [first, finer] = (m.note || '').split(' · ');
    const main = `${m.bpm}\u00a0BPM${first ? ` на ${first}` : ''}`;
    const room = INSIDE - 46, pf = font(500, 30), mf = font(700, 30);
    const fits = (prefix, t) => textWidth(prefix, pf) + textWidth(t, mf) <= room;
    const long = nb(`Метроном при ${pct(s.speed)}: `), short = nb(`При ${pct(s.speed)}: `);
    // the prefix and the value on one line, the finer click under them; else the value under the
    // prefix (no finer click), else the shorter prefix
    const [prefix, below] = fits(long, main) ? [long, false] : !finer ? [long.trimEnd(), true] : [short, false];
    const a = o.text(prefix, LEFT + 46, baselineIn(y, 30, 1.2), pf, C.sec);
    o.text(main, below ? LEFT + 46 : LEFT + 46 + a, baselineIn(below ? y + 36 : y, 30, 1.2), mf, C.sec, { room: below ? room : room - a });
    if (finer) o.text(finer, LEFT + 46, baselineIn(y + 36, 30, 1.2), mf, C.sec, { room });
  }
  // «Готово», and beside it the waterfall's bar lines (barlines.js): the state, and what the next
  // press does, chosen while on, as «Спочатку» stands beside «Грати» on P1
  const by = contentBottom - 16 - MAIN_H, on = s.barLines !== false;
  target(o, s, { id: 'done', x: LEFT, y: by, w: 432, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'check', iconSize: 56, words: t => [word('Готово', t, { weight: 700 })] });
  target(o, s, { id: 'barlines', x: LEFT + 432 + 24, y: by, w: INSIDE - 432 - 24, h: MAIN_H, col: true, look: on ? 'chosen' : 'plain', gap: 4,
    words: t => [word(on ? 'Лінії тактів: так' : 'Лінії тактів: ні', t, { px: 33 }), second(on ? 'сховати' : 'показати', t)] });
  bottom(o, s, keyboardBar(s));
};
// P4 the sound (docs/piano-audio-design.md §6.2): the metronome and the song voice, each on or off
// (its state, then what the next press does; chosen while on) with its volume in three steps (the
// chosen filled rose with a tick; pressed, it turns the voice on); what the count-in and the song
// voice do, or why there is no sound; «Готово» back to the page it was opened from.
const SOUND_ROWS = [202, 334], SOUND_W = 384, PILL_W = 96;
const VOLUME_STEPS = [30, 60, 100];
S.sound = (o, s) => {
  const x = s.sound || {};
  top(o, s, { left: (q, y) => backButton(x.from === 'warmup' ? 'Вправа' : 'Гра')(q, y, s), title: 'Звук' });
  o.text('гучність, %', RIGHT, baselineIn(CONTENT.y, 30, 1.2), font(500, 30), C.sec, { align: 'right' });
  [['metronome', 'Метроном', 'tempo'], ['voice', 'Звук пісні', 'sound']].forEach(([part, name, icon], row) => {
    const r = x[part] || { on: true, volume: 60 }, y = SOUND_ROWS[row];
    target(o, s, { id: part, x: LEFT, y, w: SOUND_W, h: ROW_H, look: r.on ? 'chosen' : 'plain', align: 'left', pad: 14, gap: 12,
      icon: !r.on && part === 'voice' ? 'soundOff' : icon, iconSize: 36, iconOpts: part === 'voice' ? { stroke: 4.5 } : undefined, room: SOUND_W - 2 * EDGE - 28 - 36 - 12,
      words: t => [word(`${name}: ${r.on ? 'так' : 'ні'}`, t, { px: 36 }), second(r.on ? 'вимкнути' : 'увімкнути', t)] });
    VOLUME_STEPS.forEach((v, i) => {
      const chosen = r.volume === v;
      target(o, s, { id: `${part}Volume:${v}`, x: RIGHT - PILL_W - (VOLUME_STEPS.length - 1 - i) * (PILL_W + 24), y, w: PILL_W, h: ROW_H, col: true,
        look: chosen ? 'chosen' : 'plain', gap: 2, pre: chosen ? iconItem('check', 30, C.ink, { stroke: 6 }) : null,
        words: t => [word(String(v), t, { px: 36, weight: 700, mono: true, lh: 1.1 })] });
    });
  });
  let y = SOUND_ROWS[1] + ROW_H + 18;
  const metronome = x.metronome && x.metronome.on;
  const before = x.warmup ? 'Перед вправою' : 'Перед піснею';
  o.text(metronome ? `${before} — такт відліку` : 'Без метронома відліку немає', LEFT, baselineIn(y, 30, 1.25), font(500, 30), C.sec, { room: INSIDE });
  y += 37.5 + 8;
  if (x.problem) {
    alertBar(o, LEFT, y, INSIDE, { title: x.problem }, { compact: true });
  } else {
    const voice = x.voice && x.voice.on;
    const t = !voice ? 'Звук пісні вимкнено' : x.loading ? 'Звук пісні завантажується…' : x.warmup ? 'Звук пісні: ноти вправи' : `Звук пісні: ноти рівня ${s.level}`;
    o.text(t, LEFT, baselineIn(y, 30, 1.25), font(500, 30), C.sec, { room: INSIDE });
  }
  doneButton(o, s);
  bottom(o, s, keyboardBar(s));
};
function doneButton(o, s) {
  target(o, s, { id: 'done', x: LEFT, y: contentBottom - 16 - MAIN_H, w: INSIDE, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'check', iconSize: 56, words: t => [word('Готово', t, { weight: 700 })] });
}

// P3 the level: five levels 2 × 3 (a number in a ring, the name, a hint), the sixth place the
// note on level 1's hands; «Готово».
S.level = (o, s) => {
  top(o, s, { left: (q, y) => backButton('Гра')(q, y, s), title: 'Рівень' });
  const w = (INSIDE - 24) / 2;
  const HINT = { 1: 'права рука', 2: 'по ноті в руці', 3: 'по дві ноти в руці', 4: 'по три ноти в руці', 5: 'як у файлі' };
  (s.levels || []).forEach((l, i) => {
    const on = s.level === l.id;
    const x = LEFT + (i % 2) * (w + 24), y = CONTENT.y + Math.floor(i / 2) * 144;
    // the name from 36 px down to 30 and the hint in up to two lines, clear of the chosen's tick
    const room = w - 2 * EDGE - 32 - 50 - 14 - (on ? 36 + 8 : 0);
    const px = [36, 33, 30].find(v => textWidth(l.name, font(600, v)) <= room) || 30;
    const hint = wrap(HINT[l.id] || lowerFirst(l.hint || ''), room, font(500, 30)).slice(0, 2);
    target(o, s, { id: `level:${l.id}`, x, y, w, h: 120, look: on ? 'chosen' : 'plain', align: 'left', pad: 16, gap: 14, room,
      pre: { w: 50, h: 50, draw: (q, xx, yy) => { q.circle(xx + 25, yy + 25, 25 - 1.5, null, on ? C.ink : C.text, 3); q.text(String(l.id), xx + 25, baselineAt(yy + 25, 30, true), font(700, 30, true), on ? C.ink : C.text, { align: 'center' }); } },
      words: t => [word(l.name, t, { px }), ...hint.map(h => second(h, t, { lh: hint.length > 1 ? 1.05 : 1.15 }))] });
    if (on) o.icon('check', x + w - EDGE - 16 - 36, y + 42, 36, C.ink, { stroke: 6 });
  });
  const nx = LEFT + w + 24 + 6, ny = CONTENT.y + 2 * 144;
  o.circle(nx + 11, ny + 60 - 18, 11, C.right);
  const lines = wrap('На рівні 1 «Руки»: лише права', w - 46, font(500, 30));
  lines.forEach((l, i) => o.text(l, nx + 36, baselineIn(ny + 60 - (lines.length * 36) / 2 + i * 36, 30, 1.2), font(500, 30), C.sec));
  doneButton(o, s);
  bottom(o, s, keyboardBar(s));
};

// K1 the keyboard: locked (a padlock and the word) or not placed; the width measured or usual and
// when it was saved, and the depth; «Підлаштувати» (placed) or «Калібрувати» (not)
// the main action. Its way back names the page it was opened from (App.keyboardFrom).
// The key pitch to a tenth of a millimetre and the keys' depth to a millimetre, as shown (a comma):
// every measure on the panel in millimetres.
export const pitchMm = m => (Math.round(m * 1e4) / 10).toFixed(1).replace('.', ',');
export const depthMm = m => String(Math.round(m * 1e3));
S.calibration = (o, s) => {
  const c = s.calibration || {};
  top(o, s, { left: (q, y) => backButton(s.keyboardBack || 'Гра')(q, y, s), title: 'Клавіатура', sizes: [SIZE.title, 42, 36, 33] });
  const placed = c.pitch != null;
  let y = CONTENT.y;
  o.icon(placed ? 'lock' : 'target', LEFT, y + (52.8 - 60) / 2 + 4, 60, C.text);
  o.text(placed ? (c.locked === false ? 'Підлаштовую' : 'Заблоковано') : 'Не поставлено', LEFT + 82, baselineIn(y, 48, 1.1), font(700, SIZE.title), C.text);
  y += 52.8 + 8;
  o.text(placed ? 'Руки клавіатуру не рухають' : 'Два дотики контролером до крайніх До', LEFT, baselineIn(y, 36, 1.2), font(500, 36), C.sec, { room: INSIDE });
  y += 43.2 + 18;
  if (placed) {
    const facts = [['width', c.measured ? `Ширину виміряно ${day(c.measured)}` : 'Ширина звичайна, ще не виміряна'],
      [c.saved ? 'check' : null, c.saved ? `Місце збережено ${day(c.saved)} о ${hm(c.saved)}` : 'Місце ще не збережено']];
    for (const [icon, t] of facts) {
      // nothing saved yet: an empty dashed ring, no tick
      if (icon) o.icon(icon, LEFT, y + 1, 40, C.text, { stroke: 6 });
      else o.circle(LEFT + 20, y + 21, 20 - 1.5, null, C.sec, 3, [4, 3]);
      o.text(t, LEFT + 56, baselineIn(y, 36, 1.2), font(500, 36), C.text, { room: INSIDE - 56 });
      y += 43.2 + 14;
    }
    // the width once (the line above says whether it was measured), the depth here
    if (c.depth != null) o.text(nb(`Глибина клавіш ${depthMm(c.depth)} мм`), LEFT + 56, baselineIn(y, 30, 1.2), font(500, 30), C.sec, { room: INSIDE - 56 });
  }
  const by = contentBottom - MAIN_H;
  if (placed) {
    target(o, s, { id: 'adjust', x: LEFT, y: by, w: 432, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'unlock', iconSize: 52, words: t => [word('Підлаштувати', t, { weight: 700 })] });
    target(o, s, { id: 'calibrate', x: LEFT + 432 + 24, y: by, w: INSIDE - 432 - 24, h: MAIN_H, col: true, icon: 'target', gap: 8, words: t => [word('Калібрувати', t, { px: 33 })] });
  } else {
    target(o, s, { id: 'calibrate', x: LEFT, y: by, w: 432, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'target', iconSize: 52, words: t => [word('Калібрувати', t, { weight: 700 })] });
    target(o, s, { id: 'adjust', x: LEFT + 432 + 24, y: by, w: INSIDE - 432 - 24, h: MAIN_H, col: true, off: true, icon: 'unlock', gap: 4,
      words: t => [word('Підлаштувати', t, { px: 33 }), second('спершу калібруй', t)] });
  }
  bottom(o, s);
};
const two = n => String(n).padStart(2, '0');
const day = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${two(d.getDate())}.${two(d.getMonth() + 1)}`; };
const hm = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${two(d.getHours())}:${two(d.getMinutes())}`; };

// K2 «Підлаштувати» (docs/piano-keyboard-handles-design.md §6.4): the amber band with an open
// padlock; what moves the keyboard, a picture a cell (the corners, the height handle, the trigger
// on the keys, the sticks); the key pitch and the depth as they are, and what moved since it was
// switched on; the strip «Візьми контролер» with hands or nothing seen, else a notice; «Готово»
// and «Калібрувати».
const signed = (v, digits = 0) => {
  const t = Math.abs(v).toFixed(digits).replace('.', ',');
  return Number(t.replace(',', '.')) === 0 ? t : `${v < 0 ? '−' : '+'}${t}`;
};
export const ADJUST_CELLS = [['corners', 'Кути', 'тягни: довжина, поворот, глибина'], ['height', 'Ручка ⇕', 'висота'],
  ['ray', 'Курок на клавішах', 'пересунути всю'], ['stick', 'Стіки', 'точно: 1 мм, 0,1°']];
const CELL_STEP = 100;
S.adjust = (o, s) => {
  band(o, s, { cancel: 'adjustCancel', icon: 'unlock', title: 'Підлаштувати', sub: 'увімкнено' });
  const c = s.calibration || {};
  const w = (INSIDE - 24) / 2;
  ADJUST_CELLS.forEach(([k, b, t], i) => {
    const x = LEFT + (i % 2) * (w + 24), y = CONTENT.y + Math.floor(i / 2) * CELL_STEP;
    o.art(CONTROL[k], x, y, 72, { fg: C.text, accent: C.amber });
    const tx = x + 84, room = w - 84;
    o.text(b, tx, baselineIn(y + 3, 30, 1.15), font(700, 30), C.text, { room });
    const lines = wrap(nb(t), room, font(500, 30));
    if (lines.length > 2) o.cut.push(t);
    lines.slice(0, 2).forEach((l, j) => o.text(l, tx, baselineIn(y + 37.5 + j * 30, 30, 1.0), font(500, 30), C.sec, { room }));
  });
  let y = CONTENT.y + 2 * CELL_STEP + 8;
  if (c.pitch != null && c.depth != null) {
    o.text(nb(`Крок клавіші ${pitchMm(c.pitch)} мм · глибина ${depthMm(c.depth)} мм`), LEFT, baselineIn(y, 30, 1.25), font(600, 30), C.text, { room: INSIDE });
    y += 37.5;
  }
  const a = c.adjust || { x: 0, y: 0, z: 0, yaw: 0 };
  const offset = `уздовж\u00a0${signed(a.x)}\u00a0мм · углиб\u00a0${signed(a.z)}\u00a0мм · вище\u00a0${signed(a.y)}\u00a0мм · поворот\u00a0${signed(a.yaw, 1)}°`;
  const head = 'Зсув від увімкнення: ';
  const hw = textWidth(head, font(500, 30));
  o.text(head, LEFT, baselineIn(y, 30, 1.25), font(500, 30), C.sec);
  const parts = offset.split(' · ');
  let line = '', lx = LEFT + hw, room = INSIDE - hw;
  const flush = () => { o.text(line, lx, baselineIn(y, 30, 1.25), font(600, 30), C.text, { room }); y += 37.5; line = ''; lx = LEFT; room = INSIDE; };
  for (const p of parts) {
    const next = line ? `${line} · ${p}` : p;
    if (line && textWidth(`${next} ·`, font(600, 30)) > room) { o.text(`${line} ·`, lx, baselineIn(y, 30, 1.25), font(600, 30), C.text, { room }); y += 37.5; line = p; lx = LEFT; room = INSIDE; } else line = next;
  }
  if (line) flush();
  const hands = s.input === 'hands' || s.input === 'none';
  const warn = hands ? 'Візьми контролер: руками не рухають' : s.notice || '';
  if (warn) {
    y += 16;
    o.rect(LEFT, y, INSIDE, 61.2, 12, C.alert);
    o.icon('alert', LEFT + 18, y + 12.6, 36, C.text);
    o.text(warn, LEFT + 18 + 36 + 14, baselineIn(y + 10, 30, 1.2), font(700, 30), C.text, { room: INSIDE - 86 });
  }
  const by = contentBottom - MAIN_H;
  target(o, s, { id: 'adjustDone', x: LEFT, y: by, w: 432, h: MAIN_H, r: MAIN_H / 2, look: 'primary', icon: 'check', iconSize: 56, words: t => [word('Готово', t, { weight: 700 })] });
  target(o, s, { id: 'calibrate', x: LEFT + 432 + 24, y: by, w: INSIDE - 432 - 24, h: MAIN_H, col: true, icon: 'target', gap: 8, words: t => [word('Калібрувати', t, { px: 33 })] });
  bottom(o, s);
};

// K3 the calibration, a step at a time: the amber band with the step; the strip when hands are
// seen (a controller is needed) or a touch went wrong; the keys with the C to touch; one sentence.
// The action is the touch itself: no main button.
// The second step (panel.js pageLayout: «calibrate» from the second touch on) and the first.
S.calibrate = (o, s) => calibratePage(o, s, true);
S.calibrateFirst = (o, s) => calibratePage(o, s, false);
function calibratePage(o, s, high) {
  const c = s.calibration || {};
  band(o, s, { cancel: 'calibrateCancel', icon: 'target', title: `Калібрування ${high ? '2/2' : '1/2'}`, sub: high ? 'найвища До' : 'найнижча До' });
  let y = CONTENT.y;
  const alert = calibrationAlert(s);
  if (alert) y += alertBar(o, LEFT, y, INSIDE, alert) + 26;
  else y += 26;
  const ky = y;
  o.custom(ctx => drawKeyboard61(ctx, high ? 'high' : 'low', LEFT + 12, ky, 720, { white: C.text, line: C.line, hi: C.amber }));
  y += 720 * KEYBOARD_ASPECT + 16;
  const say = high && c.problem ? 'Торкнись середини найвищої До ще раз або почни заново'
    : `Торкнись кінчиком контролера середини ${high ? 'найвищої' : 'найнижчої'} До й натисни курок`;
  const lines = wrap(say, INSIDE, font(600, 36)).slice(0, 3);
  lines.forEach((l, i) => o.text(l, TEX_W / 2, baselineIn(y + i * 45, 36, 1.25), font(600, 36), C.text, { align: 'center', room: INSIDE }));
  bottom(o, s, high ? againButton(s) : null);
}
// «Заново» on the calibration's second step: an icon and a word over a second line.
const againButton = s => (o, y) => {
  const wide = Math.max(textWidth('Заново', font(600, SIZE.word)), textWidth('з найнижчої До', font(500, 30)));
  target(o, s, { id: 'calibrate', x: LEFT, y, w: EDGE * 2 + 26 * 2 + 44 + 14 + wide, h: ROW_H, icon: 'restart', words: t => [word('Заново', t), second('з найнижчої До', t)] });
};
// The calibration's strip: a touch that went wrong, else hands with no controller.
export function calibrationAlert(s) {
  const c = s.calibration || {};
  if (c.problem) {
    const p = String(c.problem);
    const i = p.indexOf(': '), j = p.indexOf('. ');
    const cut = i > 0 ? i : j > 0 ? j : -1;
    const head = cut > 0 ? p.slice(0, cut) : p, rest = cut > 0 ? p.slice(cut + 2) : '';
    return { title: `Не вийшло: ${lowerFirst(head)}`, sub: lowerFirst(rest.replace(/\.$/, '')) };
  }
  if (s.input === 'hands' || s.input === 'none') return { title: 'Візьми контролер', sub: 'руками клавіатуру не калібрують' };
  return null;
}


// ----------------------------------------------------------------------------------------------
export const PAGES = Object.keys(S);

// The screen of `page` in state `s`: {list, buttons, cut, shortened, texts}.
export function compose(page, s) {
  const screen = S[page];
  if (!screen) throw new RangeError(`panel page ${page}`);
  const o = new Ops();
  plate(o);
  screen(o, s || {});
  return o;
}

// Draws a composed screen into a 2D context of TEX_W × TEX_H.
export function draw(ctx, composed) {
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.textBaseline = 'alphabetic';
  run(ctx, composed.list);
}
function run(ctx, list) {
  for (const op of list) {
    switch (op.op) {
      case 'rect': shape(ctx, op, () => roundRect(ctx, op.x, op.y, op.w, op.h, op.r)); break;
      case 'circle': shape(ctx, op, () => { ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, 2 * Math.PI); }); break;
      case 'text':
        ctx.font = op.f;
        ctx.fillStyle = op.colour;
        ctx.textAlign = op.align;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${op.spacing || 0}px`;
        ctx.fillText(op.t, op.x, op.y);
        if (op.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.textAlign = 'left';
        break;
      case 'icon': drawIcon(ctx, op.name, op.x, op.y, op.size, op.colour, op.opts); break;
      case 'art': drawArt(ctx, op.parts, op.x, op.y, op.size, op.colours); break;
      case 'custom': op.draw(ctx); break;
      case 'button': drawButton(ctx, op); break;
      default:
    }
  }
}
function shape(ctx, op, outline) {
  if (op.fill) { outline(); ctx.fillStyle = op.fill; ctx.fill(); }
  if (op.stroke) {
    outline();
    ctx.strokeStyle = op.stroke;
    ctx.lineWidth = op.lw;
    if (op.dash) ctx.setLineDash(op.dash);
    ctx.stroke();
    if (op.dash) ctx.setLineDash([]);
  }
}
// A target: its fill and edge by its look; off at 45 %; pressed: the press colour, sunk 1 mm on
// each side with a shadow inside (brief §4.5). Its contents drawn over it.
function drawButton(ctx, b) {
  const tone = TONE[b.look] || TONE.plain;
  ctx.save();
  if (b.off) ctx.globalAlpha = 0.45;
  if (b.pressed) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(0.95, 0.95);
    ctx.translate(-cx, -cy);
  }
  const fill = b.pressed ? C.press : tone.fill;
  roundRect(ctx, b.x, b.y, b.w, b.h, Math.min(b.r, b.h / 2));
  ctx.fillStyle = fill;
  ctx.fill();
  if (b.pressed) {
    ctx.save();
    roundRect(ctx, b.x, b.y, b.w, b.h, Math.min(b.r, b.h / 2));
    ctx.clip();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, Math.min(b.r, b.h / 2) + 6);
    ctx.stroke();
    ctx.restore();
  }
  roundRect(ctx, b.x + EDGE / 2, b.y + EDGE / 2, b.w - EDGE, b.h - EDGE, Math.max(0, Math.min(b.r, b.h / 2) - EDGE / 2));
  ctx.strokeStyle = b.edge || (b.pressed ? C.line : tone.edge);
  ctx.lineWidth = EDGE;
  ctx.stroke();
  const children = b.pressed && b.look !== 'plain' ? recolour(b.children, tone) : b.children;
  run(ctx, children);
  ctx.restore();
}
// A pressed primary or chosen target reads its words on the press colour: light, as a plain one's.
function recolour(list, tone) {
  const map = new Map([[tone.word, C.text], [tone.sub, C.text], [tone.icon, C.text]]);
  return list.map(op => (op.colour && map.has(op.colour) ? { ...op, colour: map.get(op.colour) } : op));
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
