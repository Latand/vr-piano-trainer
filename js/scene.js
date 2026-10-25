// What to draw at a song time: falling bars and lit keys, in the keyboard frame (metres).
// The keys map is also the place for MIDI later: a judge would compare the pressed keys with it
// (design §7); nothing in this version listens to the instrument.
import { keyCentre, keyWidth, isBlack, noteName, BACK_Z } from './geometry.js';

export const FALL_HEIGHT = 0.35; // the bars fall from here to the hit line (design §7.1)
export const LOOKAHEAD = 3; // song seconds visible above the line
export const FALL_SPEED = FALL_HEIGHT / LOOKAHEAD;
// The keys themselves say what comes next: every key starts to fill LEAD real seconds before
// its note, whatever the speed, and is full when the note starts. Each hand's coming onsets are
// ranked, the nearest brightest; the RANKS-th and every later one share the faintest rank. A
// chord is one onset: notes within CHORD song seconds of the one before, or a chord played in
// by hand and spread out (each note within SPREAD_STEP of the one before while the chord's
// notes still sound, all within SPREAD of the first). A key flashes for HIT_FLASH real seconds
// when its note starts. LEAD is the default; the panel offers LEAD_CHOICES («через секунду…
// чуть-чуть раньше», docs/piano-trainer-v2.md §5).
export const LEAD = 1.5;
export const LEAD_CHOICES = [1, 1.5, 2, 3];
export const LEAD_RANGE = [0.5, 3]; // what the address may set (lead=<seconds>, parseLead)
export const RANKS = 3;
export const CHORD = 0.035;
export const SPREAD_STEP = 0.06;
export const SPREAD = 0.15;
export const HIT_FLASH = 0.25;
export const WATERFALL_Z = BACK_Z - 0.004; // just behind the keys
export const BAR_INSET = 0.12; // share of the key width left free between neighbouring bars
const REPEAT_GAP = 0.06; // song seconds cut from a note's end so a repeated key shows twice
export const LABEL_MIN_HEIGHT = 0.016;

export const HAND_FILTERS = ['both', 'right', 'left'];

// The address's lead=<seconds> -> seconds within LEAD_RANGE; LEAD for anything else (missing,
// empty, not a number, out of range).
export function parseLead(value) {
  if (value === null || value === undefined || String(value).trim() === '') return LEAD;
  const lead = Number(value);
  return Number.isFinite(lead) && lead >= LEAD_RANGE[0] && lead <= LEAD_RANGE[1] ? lead : LEAD;
}

// -> {bars: [...], keys: Map(midi -> key)}; a key is {hand, level: 'now', flash: 1..0} while its
// note sounds, or {hand, level: 'next', rank: 0..RANKS-1, progress: 0..1} while it builds up.
// A key that still sounds, or whose nearer note is coming, starts its next build-up after that.
// A song view with `fingers` (the guide on, App.guidedView) gives each bar its note's finger.
export function frameAt(song, t, { pitch, speed = 1, hands = 'both', lead = LEAD } = {}) {
  const fingers = song.fingers;
  const bars = [];
  const keys = new Map();
  const leadSpan = lead * speed;
  const flashSpan = HIT_FLASH * speed;
  const ahead = Math.max(LOOKAHEAD, leadSpan);
  const onsets = {};
  const notes = song.notes;
  for (let i = firstLive(song, t); i < notes.length; i++) {
    const n = notes[i];
    if (n.start - t > ahead) break; // notes are sorted by start
    if (hands !== 'both' && n.hand !== hands) continue;
    const end = shownEnd(n.start, n.end);
    if (end <= t) continue;
    const active = n.start <= t;
    if (n.start - t <= LOOKAHEAD) {
      const y0 = Math.max(0, (n.start - t) * FALL_SPEED);
      const y1 = Math.min(FALL_HEIGHT, (end - t) * FALL_SPEED);
      const black = isBlack(n.midi);
      const width = keyWidth(n.midi, pitch) * (1 - BAR_INSET);
      const bar = { midi: n.midi, hand: n.hand, black, x: keyCentre(n.midi, pitch), width, y0, y1, active,
        label: black ? null : noteName(n.midi) };
      if (fingers) bar.finger = fingers[i];
      bars.push(bar);
    }
    if (active) {
      keys.set(n.midi, { hand: n.hand, level: 'now', flash: Math.max(0, 1 - (t - n.start) / flashSpan) });
      continue;
    }
    if (n.start - t > leadSpan) continue;
    const o = onsets[n.hand] || (onsets[n.hand] = { rank: -1, first: -Infinity, last: -Infinity, held: -Infinity });
    const step = n.start - o.last;
    if (!(step <= CHORD || (step <= SPREAD_STEP && n.start - o.first <= SPREAD && n.start < o.held))) {
      o.rank++;
      o.first = n.start;
      o.held = -Infinity;
    }
    o.last = n.start;
    o.held = Math.max(o.held, n.end);
    if (keys.has(n.midi)) continue;
    keys.set(n.midi, { hand: n.hand, level: 'next', rank: Math.min(o.rank, RANKS - 1),
      progress: Math.min(1, Math.max(0, 1 - (n.start - t) / leadSpan)) });
  }
  return { bars, keys };
}

// The guide hands (docs/piano-fingering-design.md §4.4). positions: fingering.js handPositions of
// a guided view. -> per hand {groups: [{start, end, keys, fingers, spans, shape, release, notes (the
// view's note indices), roll (a rolled chord's step: 0, 1, ...), pos}], positions, longest}, the
// groups in order (each key's own notes, the hand's shape for the onset and when each key is let go
// early), for handsAt; worked out once a view.
export function guideTrack(positions) {
  const out = {};
  for (const hand of ['right', 'left']) {
    const groups = [];
    (positions[hand] || []).forEach((p, pos) => { for (const g of p.groups) groups.push({ start: g.start, end: g.end, keys: g.keys, fingers: g.fingers, spans: g.spans, shape: g.shape, release: g.release, notes: g.notes, roll: g.roll, pos }); });
    out[hand] = { groups, positions: positions[hand] || [], longest: groups.reduce((m, g) => Math.max(m, g.end - g.start), 0) };
  }
  return out;
}

export const HAND_SLIDE = 0.15; // real seconds a hand takes to slide to its next position

// Where each guide hand stands at song time t: the shape of its last onset (fingering.js
// handPositions: each onset's fingers on its keys, the others where the hand last had them), or
// the next one's once that onset is within the lead (lead × speed song seconds, the lead that
// fills the keys); when the next onset is in another position the hand slides there over
// HAND_SLIDE real seconds from max(the last onset, the next − lead). A finger holding a note
// presses its key, in place and through a slide, until the key stops showing the note, or until
// the hand lets it go early (rule 14, the group's release: at max(the onset before, the onset that
// needs the finger or cannot keep the key − lead)); then it goes on with the hand, the key still
// lit. A hand shows while a note of it sounds or its next onset is within LOOKAHEAD.
// -> [{hand, x: [_, x1..x5] (white pitches), black: [_, bool] (the key under each finger), deep:
// [_, 0..1] (how far onto the black keys each finger reaches, sliding with x), up: [_, 0..1] (a
// finger lifted over its neighbours: one sliding onto a black key, over its front edge, or a free
// one tucked between two keyed neighbours close together: fingering.js tuckOf), next: [_, 0..1]
// (the fill of the fingers of its next onset, the key cue's own progress), held: [_, bool]
// (fingers pressing a note its key shows sounding), slide: 0..1}]
export function handsAt(track, t, { speed = 1, lead = LEAD, hands = 'both' } = {}) {
  const out = [];
  const L = lead * speed;
  for (const hand of ['right', 'left']) {
    if (hands !== 'both' && hands !== hand) continue;
    const tr = track[hand];
    if (!tr || !tr.groups.length) continue;
    const G = tr.groups;
    let lo = 0, hi = G.length;
    // n: the next onset after t (one struck at t is struck), p: the last one by t
    while (lo < hi) { const mid = (lo + hi) >> 1; if (G[mid].start <= t) lo = mid + 1; else hi = mid; }
    const n = lo < G.length ? G[lo] : null, p = lo > 0 ? G[lo - 1] : null;
    const held = [false, false, false, false, false, false];
    const key = []; // the key each pressing finger holds, the latest note first
    let sounding = false;
    for (let i = lo - 1; i >= 0 && G[i].start > t - tr.longest - 1e-9; i--) {
      const g = G[i];
      for (let k = 0; k < g.keys.length; k++) {
        // each of the key's notes from its own start to frameAt's end (cut short for a repeat)
        const spans = g.spans[k];
        let on = false;
        for (let q = 0; q < spans.length && !on; q++) on = spans[q][0] <= t && spanEnd(spans[q]) > t;
        if (!on) continue;
        sounding = true;
        const r = g.release[k], f = g.fingers[k];
        if (r && Math.max(r[0], r[1] - L) <= t) continue; // let go early: the finger moves on
        held[f] = true;
        if (key[f] === undefined) key[f] = g.keys[k];
      }
    }
    if (!sounding && !(n && n.start - t <= LOOKAHEAD)) continue;
    const soon = n && n.start - t <= L;
    let from = p && !(soon && n.pos === p.pos) ? p.shape : n.shape, to = from, slide = 1;
    if (p && soon && n.pos !== p.pos) {
      to = n.shape;
      slide = Math.min(1, Math.max(0, (t - Math.max(p.start, n.start - L)) / (HAND_SLIDE * speed)));
    }
    const x = [null], black = [false], deep = [0], up = [0];
    const onBlack = (shape, f) => shape.keys[f] !== null && isBlack(shape.keys[f]);
    for (let f = 1; f <= 5; f++) {
      if (key[f] !== undefined) {
        x.push(keyCentre(key[f], 1));
        black.push(isBlack(key[f]));
        deep.push(+isBlack(key[f]));
        up.push(0);
        continue;
      }
      x.push(from.slots[f] + (to.slots[f] - from.slots[f]) * slide);
      black.push(onBlack(slide < 0.5 ? from : to, f));
      deep.push(+onBlack(from, f) + (onBlack(to, f) - onBlack(from, f)) * slide);
      const tuck = s => (s.tuck ? s.tuck[f] : 0);
      up.push(Math.max(tuck(from) + (tuck(to) - tuck(from)) * slide, onBlack(to, f) && !onBlack(from, f) ? Math.sin(Math.PI * slide) : 0));
    }
    const next = [0, 0, 0, 0, 0, 0];
    if (soon) for (const f of n.fingers) next[f] = Math.min(1, Math.max(0, 1 - (n.start - t) / L));
    out.push({ hand, x, black, deep, up, next, held, slide });
  }
  return out;
}

// Where a note stops showing: REPEAT_GAP before its end (at most 30 % of it), so a repeated key
// shows twice.
export function shownEnd(start, end) { return Math.max(start + 0.02, end - Math.min(REPEAT_GAP, (end - start) * 0.3)); }
// The same for a guide group's span [start, end, from?]: a rolled chord's later step starts its key
// late (from: the note's own start), and the key stops showing where the note's own end puts it.
export const spanEnd = sp => shownEnd(sp.length > 2 ? sp[2] : sp[0], sp[1]);

// Index of the first note that can still be sounding at t (notes sorted by start).
function firstLive(song, t) {
  const from = t - song.longest;
  let lo = 0, hi = song.notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (song.notes[mid].start < from) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
