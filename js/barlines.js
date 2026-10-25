// Bar and beat lines in the waterfall, and the link under notes struck together: horizontal lines
// that fall with the notes, so two notes that start on one line are played at once and notes on
// different lines one after the other. A bar line marks each bar's start in the song's own meter
// (4/4, 3/4, 6/8, its changes followed), fainter beat lines its beats in the meter's beat (a dotted
// quarter in 6/8: tempo.js beatOf), and a link under the start edge of the notes one hand strikes
// together, in that hand's colour, by the chord window the keys and the levels use (scene.js CHORD,
// SPREAD_STEP, SPREAD; levels.js groupsOf); the two hands are never linked. The bar number stands
// small at the waterfall's right edge, every bar or every few bars where bars are short. Drawn
// behind everything else on the keys (App.items), the bar and beat lines in the panel's «Студія»
// colours; a player who switches them off («Лінії тактів: ні») has none of it worked out or drawn.
import { beatOf, metronome, indexAt } from './tempo.js';
import { FALL_HEIGHT, FALL_SPEED, LOOKAHEAD, WATERFALL_Z, BAR_INSET } from './scene.js';
import { groupsOf } from './levels.js';
import { keyCentre, keyWidth, WHITE_COUNT } from './geometry.js';
import { ADJUST_FADE, HAND_COLOUR } from './overlay.js';

const DEFAULT_US = 500000; // 120 BPM until the first tempo event (smf.js timeMap)
const DEFAULT_METER = { num: 4, den: 4 }; // and 4/4 until the first time signature (tempo.js)
const EPS = 1e-6; // quarters: a bar line this close to a meter change is that change

// What the lines look like, in metres: a dark band in the panel's plate colour with a light core,
// so each shows over a dark room and over the white body of a keyboard alike. A bar line is twice
// as wide and twice as strong as a beat line; the link under a chord is the strongest of the
// three, its core in the colour of the hand that plays the chord (overlay.js HAND_COLOUR), and
// spans only the chord's notes, under their start edge. The beat lines stop where beats
// come closer than BEAT_MIN apart (a fast 2/2), and a bar's number stands every bar, or every 2,
// 4 or 8 bars, so numbered bars stay NUMBER_SPACING apart.
export const PLATE = [0.055, 0.075, 0.11]; // studio.js C.plate
export const TEXT = [0.914, 0.929, 0.961]; // studio.js C.text
export const SEC = [0.639, 0.694, 0.776]; // studio.js C.sec
export const BAR_LINE = { band: 0.0024, core: 0.0009, bandAlpha: 0.6, coreAlpha: 0.4, colour: TEXT };
export const BEAT_LINE = { band: 0.0012, core: 0.0005, bandAlpha: 0.25, coreAlpha: 0.24, colour: SEC };
export const LINK = { band: 0.0034, core: 0.0016, bandAlpha: 0.85, coreAlpha: 1 }; // colour: its hand's
export const BEAT_MIN = 0.012;
// A number's digits are 16 mm tall: from the seat the waterfall's right edge is about 0.85 m away,
// where that is as large to the eye as the panel's smallest text (10 mm) at 0.55 m.
export const NUMBER = { height: 0.016, gap: 0.004, pad: 0.0015, alpha: 0.9, plateAlpha: 0.72,
  colour: SEC };
export const NUMBER_SPACING = 0.04;
export const LINE_Z = WATERFALL_Z - 0.002; // behind the C guides and the bars (overlay.js)

// For the tests: grids and links worked out (once a song, once a level and hand filter) and
// frames asked for, so a test can see that nothing is worked out while the lines are off and
// nothing again frame after frame.
export const work = { grids: 0, links: 0, frames: 0 };

// The song's beats as smf.js read them (song.js prepareSong timeline: the tempo events and time
// signatures in seconds), in quarter notes: -> {q(seconds), s(quarters)}, the same clock that
// placed the notes (smf.js timeMap), so a line and a note on one tick fall together exactly.
function clock(tempos) {
  const segs = [{ s: 0, q: 0, us: DEFAULT_US }];
  for (const t of tempos) {
    if (!(t.usPerQuarter > 0)) continue;
    const last = segs[segs.length - 1];
    if (t.seconds <= last.s) { last.us = t.usPerQuarter; continue; }
    segs.push({ s: t.seconds, q: last.q + ((t.seconds - last.s) * 1e6) / last.us, us: t.usPerQuarter });
  }
  const find = (key, v) => {
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid][key] <= v) lo = mid; else hi = mid - 1; }
    return segs[lo];
  };
  return {
    q: s => { const g = find('s', s); return g.q + ((s - g.s) * 1e6) / g.us; },
    s: q => { const g = find('q', q); return g.s + ((q - g.q) * g.us) / 1e6; },
  };
}

// song: prepareSong() (its timeline and end); pickup: quarter notes before the first bar line (a
// song that starts with an upbeat: the catalog's `pickup`). -> {bars: [{time, number, shown, q,
// num, den}], beats: [time]} in song seconds, both in time order; number counts the bars from 1
// (0: a pickup, unnumbered), shown: whether its number is drawn, q the bar line in quarter notes
// and num/den its meter (the audible metronome's clicks below follow them). A file that opens with a bar shorter than the
// next meter's and only one of it (a pickup written as its own time signature) has that bar
// unnumbered too. No beats (SMPTE time): none. Worked out once a song and pickup, shared by its
// levels (they share the timeline).
const grids = new WeakMap(); // timeline -> Map(pickup -> grid)
export function barGrid(song, pickup = 0) {
  const tl = song && song.timeline;
  if (!tl || tl.smpte) return { bars: [], beats: [] };
  pickup = Number.isFinite(pickup) && pickup > 0 ? pickup : 0;
  let byPickup = grids.get(tl);
  if (!byPickup) grids.set(tl, (byPickup = new Map()));
  const key = `${pickup}:${song.end}`;
  if (byPickup.has(key)) return byPickup.get(key);
  work.grids++;
  const c = clock(tl.tempos || []);
  const meters = (tl.meters || []).map(m => ({ q: c.q(m.seconds), num: m.num, den: m.den }));
  if (!meters.length || meters[0].q > EPS) meters.unshift({ q: 0, ...DEFAULT_METER });
  const endQ = c.q(song.end);
  const bars = [], beats = [];
  let number = 0;
  meters.forEach((m, i) => {
    const barQ = (m.num * 4) / m.den, beat = beatOf(m.num, m.den);
    const until = i + 1 < meters.length ? meters[i + 1].q : Infinity;
    let from = m.q;
    if (i === 0 && pickup > 0 && pickup < until - EPS) {
      // the upbeat: its beats counted back from the first bar line, no line where it starts
      for (let b = pickup - beat.quarters; b > EPS; b -= beat.quarters) beats.push(c.s(b));
      from = pickup;
    }
    // a pickup written as a time signature of its own: one short bar, then the song's meter
    const lone = i === 0 && !pickup && i + 1 < meters.length && Math.abs(until - m.q - barQ) < EPS &&
      barQ < (meters[1].num * 4) / meters[1].den;
    for (let k = 0; ; k++) {
      const q = from + k * barQ;
      if (q >= until - EPS || q > endQ + EPS) break;
      const time = c.s(q);
      const n = lone && k === 0 ? 0 : ++number;
      // its number every 1, 2, 4 or 8 bars: the fewest that keep numbered bars NUMBER_SPACING apart
      const metres = (c.s(q + barQ) - time) * FALL_SPEED;
      const every = [1, 2, 4, 8].find(e => e * metres >= NUMBER_SPACING) || 8;
      bars.push({ time, number: n, shown: n > 0 && (n - 1) % every === 0, q, num: m.num, den: m.den });
      const step = c.s(q + beat.quarters) - time;
      if (step * FALL_SPEED < BEAT_MIN) continue;
      for (let j = 1; j < beat.perBar; j++) {
        const b = q + j * beat.quarters;
        if (b < until - EPS) beats.push(c.s(b));
      }
    }
  });
  beats.sort((a, b) => a - b);
  const grid = { bars, beats };
  byPickup.set(key, grid);
  return grid;
}

// The audible metronome (docs/piano-audio-design.md §4): its clicks stand on the bar lines above
// and on their beats, so an accented click and a drawn bar line fall together.

// How far before time 0 the clicks run (song seconds), for the lead-in and the count-in.
export const GRID_BEFORE = 64;

// The clicks of a song at `speed`: [{t, kind}] in song seconds, sorted, kind 'bar' (a bar line of
// barGrid with the same pickup), 'beat' (its beats, tempo.js beatOf) or 'sub' (the finer click
// where tempo.js metronome() offers one at this speed: each beat divided by the factor the panel
// names). Before the first bar line the first full bar's meter goes on back, bar by bar, to
// GRID_BEFORE song seconds before 0, so an upbeat's beats and the count-in continue the grid; up
// to the song's last note's end. Empty for a file without beats (SMPTE time).
export function clickGrid(song, speed, pickup = 0) {
  const grid = barGrid(song, pickup);
  if (!grid.bars.length || !song.tempo || !song.tempo.length) return [];
  const c = clock(song.timeline.tempos || []);
  const first = grid.bars[0];
  const lead = first.number === 0 && grid.bars[1] ? grid.bars[1] : first; // past a lone short bar
  const leadQ = (lead.num * 4) / lead.den, fromQ = c.q(-GRID_BEFORE);
  const starts = [];
  for (let q = first.q - leadQ; q >= fromQ - EPS; q -= leadQ) starts.push({ q, num: lead.num, den: lead.den });
  starts.reverse().push(...grid.bars);
  const endQ = c.q(song.end) + EPS;
  const beats = []; // [{q, t, kind}]
  starts.forEach((b, i) => {
    const until = i + 1 < starts.length ? starts[i + 1].q : Infinity;
    const beat = beatOf(b.num, b.den);
    for (let j = 0; j < beat.perBar; j++) {
      const q = b.q + j * beat.quarters;
      if ((j > 0 && q >= until - EPS) || q > endQ) break;
      beats.push({ q, t: j === 0 && b.time !== undefined ? b.time : c.s(q), kind: j === 0 ? 'bar' : 'beat' });
    }
  });
  const out = [];
  beats.forEach((b, i) => {
    out.push({ t: b.t, kind: b.kind });
    const next = beats[i + 1];
    const m = metronome(song.tempo[indexAt(song.tempo, Math.max(0, b.t))], speed);
    if (!m.alt || !next) return;
    const f = Math.round(m.quarters / m.alt.quarters);
    for (let k = 1; k < f; k++) out.push({ t: c.s(b.q + ((next.q - b.q) * k) / f), kind: 'sub' });
  });
  return out;
}

// The count-in (§4.3): {line, bar} in song seconds, the bar line of clickGrid at or before the
// first note and the length of the bar before it; null for a file without beats.
export function countInBar(song, pickup = 0) {
  const bars = clickGrid(song, 1, pickup).filter(c => c.kind === 'bar');
  let i = -1;
  for (let k = 0; k < bars.length; k++) if (bars[k].t <= song.start + EPS) i = k; else break;
  if (i < 1) return null;
  return { line: bars[i].t, bar: bars[i].t - bars[i - 1].t };
}

// The chords of a song view (its notes as the keys show them), each hand's on its own, by the
// chord window the keys and the levels use: the notes one hand strikes within CHORD of each other,
// or spreads out by hand, are one chord (levels.js groupsOf). The two hands are never joined: a
// link stands under one hand's notes alone, in that hand's colour. -> [{start, low, high, hand}]
// in time order: each chord of two keys or more, its first note's start, its lowest and highest
// key, its hand. hands: the keys shown (scene.js HAND_FILTERS). Worked out once a view and hand
// filter.
const linkCache = new WeakMap(); // notes -> Map(hands -> links)
export function chordLinks(notes, hands = 'both') {
  let byHands = linkCache.get(notes);
  if (!byHands) linkCache.set(notes, (byHands = new Map()));
  if (byHands.has(hands)) return byHands.get(hands);
  work.links++;
  const links = [];
  for (const hand of hands === 'both' ? ['right', 'left'] : [hands]) {
    for (const g of groupsOf(notes, hand)) {
      const keys = g.notes.map(n => n.midi);
      const low = Math.min(...keys), high = Math.max(...keys);
      if (high > low) links.push({ start: g.start, low, high, hand });
    }
  }
  links.sort((a, b) => a.start - b.start || (a.hand === b.hand ? 0 : a.hand === 'right' ? -1 : 1));
  byHands.set(hands, links);
  return links;
}

// First index of a sorted list whose time is past t.
function after(list, t, time = x => x) {
  let lo = 0, hi = list.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (time(list[mid]) <= t) lo = mid + 1; else hi = mid; }
  return lo;
}

// What falls at song time t, in the waterfall's height (metres over the hit line, as scene.js
// frameAt places the bars): {bars: [{y, number}], beats: [y], links: [{y, low, high, hand}]}, the
// lines above the hit line and up to the waterfall's top. number: the bar's, or 0 where none is drawn.
// view: the song as the keys show it (its level); pickup: as barGrid.
export function linesAt(view, t, { hands = 'both', pickup = 0 } = {}) {
  work.frames++;
  const grid = barGrid(view, pickup);
  const out = { bars: [], beats: [], links: [] };
  const top = t + LOOKAHEAD;
  for (let i = after(grid.bars, t, b => b.time); i < grid.bars.length && grid.bars[i].time <= top; i++) {
    const b = grid.bars[i];
    out.bars.push({ y: (b.time - t) * FALL_SPEED, number: b.shown ? b.number : 0 });
  }
  for (let i = after(grid.beats, t); i < grid.beats.length && grid.beats[i] <= top; i++) {
    out.beats.push((grid.beats[i] - t) * FALL_SPEED);
  }
  const links = chordLinks(view.notes, hands);
  for (let i = after(links, t, l => l.start); i < links.length && links[i].start <= top; i++) {
    const l = links[i];
    out.links.push({ y: (l.start - t) * FALL_SPEED, low: l.low, high: l.high, hand: l.hand });
  }
  return out;
}

// The digits' atlas: a white cell (the lines' colour comes from the vertex), then 0-9, white on
// transparent, each cell as wide for its height as a digit's quad (DIGIT_ASPECT) and the digit
// filling most of its height.
export const ATLAS_CELLS = 11;
const CELL = { w: 46, h: 64 };
export const DIGIT_ASPECT = CELL.w / CELL.h;
export const DIGIT_EM = 1.1; // the font's size over the cell's height
export function digitAtlas(doc = document) {
  const canvas = doc.createElement('canvas');
  canvas.width = CELL.w * ATLAS_CELLS;
  canvas.height = CELL.h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(4, 4, CELL.w - 8, CELL.h - 8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${CELL.h * DIGIT_EM}px "JetBrains Mono", ui-monospace, monospace`;
  // a digit's height is about 0.73 of the font's size: its foot this far over the cell's foot
  for (let d = 0; d <= 9; d++) ctx.fillText(String(d), CELL.w * (d + 1.5), CELL.h * 0.9);
  return canvas;
}
const SOLID = (() => { const u = 0.5 / ATLAS_CELLS; return [[u, 0.5], [u, 0.5], [u, 0.5], [u, 0.5]]; })();
function digitUv(d) {
  const u0 = (d + 1) / ATLAS_CELLS, u1 = (d + 2) / ATLAS_CELLS;
  return [[u0, 1], [u1, 1], [u1, 0], [u0, 0]]; // canvas rows run downwards
}

// Fills `batch` (drawn with digitAtlas) with the lines of linesAt, across the keyboard of white
// key pitch `pitch`. look: how the keyboard shows (App.keyboardLook); under «Підлаштувати» the
// lines fade with the song (overlay.js ADJUST_FADE).
export function buildBarLines(batch, lines, pitch, { look = null } = {}) {
  const right = WHITE_COUNT * pitch;
  const fade = look && look.mode === 'adjust' ? ADJUST_FADE : 1;
  const rgba = (c, a) => [c[0], c[1], c[2], a * fade];
  const line = (x0, x1, y, look, z, colour = look.colour) => {
    batch.rectXY(x0, x1, y - look.band / 2, y + look.band / 2, z, rgba(PLATE, look.bandAlpha), SOLID);
    batch.rectXY(x0, x1, y - look.core / 2, y + look.core / 2, z + 0.0001, rgba(colour, look.coreAlpha), SOLID);
  };
  const inside = y => y > 0 && y <= FALL_HEIGHT;
  for (const y of lines.beats) if (inside(y)) line(0, right, y, BEAT_LINE, LINE_Z);
  for (const b of lines.bars) {
    if (!inside(b.y)) continue;
    line(0, right, b.y, BAR_LINE, LINE_Z + 0.0002);
    if (b.number) drawNumber(batch, b.number, right + NUMBER.gap, b.y, rgba);
  }
  // under the start edge of one hand's chord, from its lowest key's bar to its highest's, in its colour
  for (const l of lines.links) {
    if (!inside(l.y)) continue;
    const x0 = keyCentre(l.low, pitch) - (keyWidth(l.low, pitch) * (1 - BAR_INSET)) / 2;
    const x1 = keyCentre(l.high, pitch) + (keyWidth(l.high, pitch) * (1 - BAR_INSET)) / 2;
    const y = Math.max(LINK.band / 2, l.y - LINK.band / 2);
    line(x0, x1, y, LINK, LINE_Z + 0.0004, linkColour(l.hand));
  }
}

// The colour of a link's core: its hand's, as the hand's bars are drawn (overlay.js).
export const linkColour = hand => HAND_COLOUR[hand] || HAND_COLOUR.right;

// A bar's number, left-aligned at x, standing on the bar line at y, on a dark plate.
function drawNumber(batch, n, x, y, rgba) {
  const digits = String(n);
  const h = NUMBER.height, w = h * DIGIT_ASPECT, p = NUMBER.pad;
  const y0 = y + BAR_LINE.band / 2 + p;
  if (y0 + h + p > FALL_HEIGHT) return;
  batch.rectXY(x, x + digits.length * w + 2 * p, y0 - p, y0 + h + p, LINE_Z + 0.0002, rgba(PLATE, NUMBER.plateAlpha),
    SOLID);
  [...digits].forEach((d, i) => batch.rectXY(x + p + i * w, x + p + (i + 1) * w, y0, y0 + h, LINE_Z + 0.0003,
    rgba(NUMBER.colour, NUMBER.alpha), digitUv(Number(d))));
}
