// Difficulty levels: a song's notes reduced to what two hands can hold at once
// (docs/piano-trainer-v2.md §2). Level 1 is the melody, level 2 the melody and a simple bass,
// levels 3 and 4 add chord tones up to two and three notes a hand, level 5 is the file as it is.
// The melody and the bass are worked out once for the whole song, so level 1's melody is in
// levels 2-4 and level 2's bass in levels 3-4; chord tones then fill the free fingers by
// importance. Every limit is checked over the whole length of a note against every note that
// sounds with it, so no level ever holds more notes, or a hand wider, than it says. Pure and
// deterministic: the same notes in any order give the same result.
import { CHORD, SPREAD_STEP, SPREAD } from './scene.js';

export const LEVELS = [
  { id: 1, name: 'Мелодія', hint: 'права рука, по одній ноті', right: 1, left: 0 },
  { id: 2, name: 'Мелодія й бас', hint: 'по одній ноті в кожній руці', right: 1, left: 1 },
  { id: 3, name: 'До 4 нот', hint: 'по дві ноти в руці', right: 2, left: 2 },
  { id: 4, name: 'До 6 нот', hint: 'по три ноти в руці', right: 3, left: 3 },
  { id: 5, name: 'Усі ноти', hint: 'як у файлі', right: Infinity, left: Infinity },
];
export const FULL = 5;
export const DEFAULT_LEVEL = 3; // the operator asked for no more than 4 notes at once

export const SPAN = 12; // semitones one hand holds without moving: an octave
export const LEAP = 12; // a top note this far under the melody just heard is accompaniment
export const heldMin = q => Math.max(0.1, q / 4); // a shorter overlap of two notes is legato: the first lets go
export const gapReset = q => Math.max(0.4, q); // after this long a rest the melody may go on anywhere
export const bassWindow = q => Math.min(2, Math.max(0.5, 2 * q)); // level 2: one bass note per this window
export const ornament = q => Math.min(0.15, q / 4); // the longest note that may be a grace note
export const jumpTime = d => 0.15 + 0.015 * d; // seconds to move a hand d semitones past its reach, at 100 %
const ORNAMENT_GAP = 0.03;
const NO_TEMPO_Q = 0.5;
// For the tests: the inner steps reduceNotes takes (notes and moments looked at), which grow
// with the song's length times how many notes sound at once, whatever the machine's load.
export const work = { steps: 0 };
// The rank of an interval over the harmonic bass, in semitones mod 12, the most wanted first:
// thirds, sevenths, the rest, the fifth, the unison or octave.
const INTERVAL_RANK = [4, 2, 2, 0, 0, 2, 2, 3, 2, 2, 1, 1];

export function isLevel(level) { return Number.isInteger(level) && level >= 1 && level <= FULL; }

// The song at a level, for frameAt: the same object for level 5, else a copy with the reduced
// notes. Cached on the song (one entry per level, gone with the song).
export function songAtLevel(song, level) {
  if (!isLevel(level)) throw new RangeError(`level ${level}`);
  if (level === FULL) return song;
  if (!song.levels) Object.defineProperty(song, 'levels', { value: new Map(), enumerable: false });
  let view = song.levels.get(level);
  if (!view) {
    const notes = reduceNotes(song, level);
    view = { ...song, notes, longest: notes.reduce((m, n) => Math.max(m, n.end - n.start), 0), level };
    song.levels.set(level, view);
  }
  return view;
}

// song: prepareSong() (notes {midi, start, end, hand, velocity}, tempo) -> the notes of `level`,
// sorted by start, each with its `role`: 'melody', 'bass' or 'chord'. Level 5: song.notes itself.
export function reduceNotes(song, level) {
  if (!isLevel(level)) throw new RangeError(`level ${level}`);
  if (level === FULL) return song.notes;
  const { moments, melody, bass, quarter } = linesOf(song);
  if (level === 1) return finish(melody);
  if (level === 2) return finish([...melody, ...simpleBass(bass, quarter)]);
  return finish(chordTones(moments, melody, bass, LEVELS[level - 1], quarter));
}

// What levels 1-4 share, worked out for the song's notes once: the moments and the two lines.
const shared = new WeakMap(); // notes array -> {moments, melody, bass, quarter}

function linesOf(song) {
  let s = shared.get(song.notes);
  if (!s) {
    const quarter = quarterAt(song.tempo || []);
    const notes = unique(song.notes);
    const groups = { right: groupsOf(notes, 'right'), left: groupsOf(notes, 'left') };
    for (const hand of ['right', 'left']) groups[hand] = dropOrnaments(groups[hand], quarter);
    const moments = momentsOf(groups);
    s = { moments, melody: melodyLine(moments, quarter), bass: inReach(bassLine(moments, quarter)), quarter };
    shared.set(song.notes, s);
  }
  return s;
}

const copy = (n, role, extra = {}) => ({ midi: n.midi, start: n.start, end: n.end, hand: n.hand, velocity: n.velocity, role, ...extra });

// Step 10: a key struck while another note still holds it ends that note.
function finish(input) {
  const list = input.map(({ src, ...n }) => n); // the lines are shared by the levels: copies only
  const byKey = new Map();
  for (const n of list) {
    if (!byKey.has(n.midi)) byKey.set(n.midi, []);
    byKey.get(n.midi).push(n);
  }
  for (const same of byKey.values()) {
    same.sort(order);
    for (let i = 1; i < same.length; i++) if (same[i].start < same[i - 1].end) same[i - 1].end = same[i].start;
  }
  return list.filter(n => n.end > n.start).sort(order);
}

// Full keys: start, key, the right hand first, the longer, the louder.
function order(a, b) {
  return a.start - b.start || a.midi - b.midi || (a.hand === b.hand ? 0 : a.hand === 'right' ? -1 : 1) ||
    b.end - a.end || (b.velocity || 0) - (a.velocity || 0);
}

// Quarter-note seconds at song time t, from the tempo map; 0.5 s without one.
function quarterAt(map) {
  return t => {
    if (!map.length) return NO_TEMPO_Q;
    let lo = 0, hi = map.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (map[mid].start <= t) lo = mid; else hi = mid - 1;
    }
    return 60 / map[lo].bpm;
  };
}

// Step 1: notes of one key starting within CHORD of each other are one: the longer stays, at a
// tie the right hand's. Unisons of the two hands and copies on other tracks go.
function unique(input) {
  const sorted = input.filter(n => n.end > n.start).map(n => copy(n, null)).sort(order);
  const out = [];
  const last = new Map(); // key -> index in out of its last note
  for (const n of sorted) {
    const i = last.get(n.midi);
    const prev = i === undefined ? null : out[i];
    if (prev && n.start - prev.start <= CHORD) {
      if (n.end - n.start > prev.end - prev.start) out[i] = n;
      continue;
    }
    last.set(n.midi, out.length);
    out.push(n);
  }
  return out.sort(order);
}

// Step 2: one hand's onsets as the keys show them (scene.js frameAt): notes within CHORD of the
// one before, or a chord spread out by hand. -> [{hand, start, notes}]
export function groupsOf(notes, hand) {
  const groups = [];
  let g = null, last = -Infinity, held = -Infinity;
  for (const n of notes) {
    if (n.hand !== hand) continue;
    const step = n.start - last;
    if (!g || !(step <= CHORD || (step <= SPREAD_STEP && n.start - g.start <= SPREAD && n.start < held))) {
      g = { hand, start: n.start, notes: [] };
      groups.push(g);
      held = -Infinity;
    }
    g.notes.push(n);
    last = n.start;
    held = Math.max(held, n.end);
  }
  return groups;
}

// Step 3: a lone short note just before a twice longer one at most a tone away is a grace note.
function dropOrnaments(groups, quarter) {
  return groups.filter((g, i) => {
    if (g.notes.length !== 1) return true;
    const n = g.notes[0], d = n.end - n.start, next = groups[i + 1];
    if (d > ornament(quarter(n.start)) || !next || next.start - n.start > d + ORNAMENT_GAP) return true;
    return !next.notes.some(m => Math.abs(m.midi - n.midi) <= 2 && m.end - m.start >= 2 * d);
  });
}

// Step 4: the groups of both hands that start within CHORD of each other, in time.
// -> [{time, right: group|null, left: group|null}]
function momentsOf(groups) {
  const all = [...groups.right, ...groups.left].sort((a, b) => a.start - b.start || (a.hand === 'right' ? -1 : 1));
  const moments = [];
  for (const g of all) {
    const m = moments[moments.length - 1];
    if (m && g.start - m.time <= CHORD && !m[g.hand]) m[g.hand] = g;
    else moments.push({ time: g.start, right: g.hand === 'right' ? g : null, left: g.hand === 'left' ? g : null });
  }
  return moments;
}

// A note of a line lets go when its line moves on (at the next note's start), and at a moment of
// its hand that comes within CHORD or heldMin of its end (step 6). -> the end.
function released(n, moments, from, hand, quarter) {
  let end = n.end;
  for (let i = from + 1; i < moments.length && moments[i].time < end; i++) {
    work.steps++;
    const m = moments[i];
    if (m[hand] && end - m.time <= Math.max(CHORD, heldMin(quarter(m.time)))) { end = m.time; break; }
  }
  return end;
}

// Step 5, the melody: the top note of each right-hand group, unless it sounds under a melody note
// still held (and higher), or falls more than LEAP under a melody that stopped less than gapReset
// ago (then it is accompaniment under a melody at rest).
function melodyLine(moments, quarter) {
  const line = [];
  moments.forEach((m, i) => {
    const g = m.right;
    if (!g) return;
    const top = g.notes.reduce((a, b) => (b.midi > a.midi ? b : a));
    const q = quarter(top.start);
    const prev = line[line.length - 1];
    if (prev) {
      const left = prev.end - top.start;
      if (left > heldMin(q) && prev.midi > top.midi) return;
      if (top.start - prev.end < gapReset(q) && top.midi < prev.midi - LEAP) return;
      if (prev.end > top.start) prev.end = top.start;
    }
    const n = copy(top, 'melody', { src: top });
    n.end = released(n, moments, i, 'right', quarter);
    line.push(n);
  });
  return line;
}

// Step 5, the bass: the bottom note of each left-hand group, unless it sounds over a bass note
// still held (and lower).
function bassLine(moments, quarter) {
  const line = [];
  moments.forEach((m, i) => {
    const g = m.left;
    if (!g) return;
    const low = g.notes.reduce((a, b) => (b.midi < a.midi ? b : a));
    const prev = line[line.length - 1];
    if (prev) {
      if (prev.end - low.start > heldMin(quarter(low.start)) && prev.midi < low.midi) return;
      if (prev.end > low.start) prev.end = low.start;
    }
    const n = copy(low, 'bass', { src: low });
    n.end = released(n, moments, i, 'left', quarter);
    line.push(n);
  });
  return line;
}

// The bass line as one hand plays it: a note the next one leaps away from faster than a hand moves
// there (past an octave by d semitones in under half jumpTime(d), a stride's fastest) goes, the
// latest first; in the song the right hand plays it (an arpeggio climbing into the treble and
// falling back to the bass). At levels 3-4 it may come back as a chord tone of a hand with room.
function inReach(line) {
  const out = [];
  for (let i = line.length - 1; i >= 0; i--) {
    work.steps++;
    const n = line[i], next = out[out.length - 1];
    const d = next ? Math.abs(next.midi - n.midi) - SPAN : 0;
    if (d > 0 && next.start - n.start < jumpTime(d) / 2) continue;
    out.push(n);
  }
  return out.reverse();
}

// Level 2's bass: of the bass line, a note no lower than the last one kept and within
// bassWindow of it goes; a kept note lasts until the next one kept, at least bassWindow (step 9).
function simpleBass(bass, quarter) {
  const kept = [];
  for (const b of bass) {
    const prev = kept[kept.length - 1];
    if (prev && b.midi >= prev.midi && b.start - prev.start < bassWindow(quarter(prev.start))) continue;
    kept.push({ ...b });
  }
  kept.forEach((b, i) => {
    const next = kept[i + 1];
    const end = Math.max(b.end, b.start + bassWindow(quarter(b.start)));
    b.end = next ? Math.min(end, next.start) : end;
  });
  return kept;
}

// The notes a hand holds: sorted by start, with the longest, for the queries below.
class HandNotes {
  constructor(list) {
    this.list = [...list].sort((a, b) => a.start - b.start);
    this.longest = this.list.reduce((m, n) => Math.max(m, n.end - n.start), 0);
  }

  add(n) {
    let i = this.list.length;
    while (i > 0 && this.list[i - 1].start > n.start) i--;
    this.list.splice(i, 0, n);
    this.longest = Math.max(this.longest, n.end - n.start);
  }

  // The first note starting at or after t, or null.
  after(t) {
    let lo = 0, hi = this.list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.list[mid].start < t) lo = mid + 1; else hi = mid;
    }
    return this.list[lo] || null;
  }

  // The notes sounding at some instant in [start, end).
  overlapping(start, end) {
    const out = [];
    let hi = this.list.length;
    let lo = 0;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.list[mid].start < end) lo = mid + 1; else hi = mid;
    }
    for (let i = lo - 1; i >= 0 && this.list[i].start > start - this.longest - 1e-9; i--) {
      work.steps++;
      const n = this.list[i];
      if (n.end > start && n.start < end) out.push(n);
    }
    return out;
  }
}

// The most notes of `notes` sounding at once within [start, end).
function mostAtOnce(notes, start, end) {
  const events = [];
  work.steps += notes.length;
  for (const n of notes) {
    events.push([Math.max(start, n.start), 1], [Math.min(end, n.end), -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0, most = 0;
  for (const [, d] of events) { now += d; most = Math.max(most, now); }
  return most;
}

// Steps 7-9: chord tones for the free fingers of each hand, moment by moment.
function chordTones(moments, melody, bass, limits, quarter) {
  const lineOf = new Map([...melody, ...bass].map(n => [n.src, n]));
  const held = { right: new HandNotes(melody), left: new HandNotes(bass) };
  const cap = { right: limits.right, left: limits.left };
  const out = [...melody, ...bass];
  const lastWindow = { right: null, left: null }; // {lo, hi, time} of the hand's last moment with notes
  moments.forEach((m, i) => {
    const t = m.time;
    const other = h => (h === 'right' ? 'left' : 'right');
    // The end a chord tone of `hand` (from a group of `from`) would have: its own, or the next
    // moment of either hand that plays it, or one within CHORD or heldMin of its end.
    const endOf = (n, hand, from) => {
      let end = n.end;
      for (let j = i + 1; j < moments.length && moments[j].time < end; j++) {
        work.steps++;
        const mj = moments[j];
        if (mj[hand] || mj[from] || end - mj.time <= Math.max(CHORD, heldMin(quarter(mj.time)))) { end = mj.time; break; }
      }
      return end;
    };
    const candidates = [];
    const lineHere = { right: [], left: [] }; // the line notes this moment starts, by hand
    for (const hand of ['right', 'left']) {
      if (!m[hand]) continue;
      for (const n of m[hand].notes) {
        const line = lineOf.get(n);
        if (line) lineHere[line.hand].push(line); else candidates.push({ n, from: hand });
      }
    }
    const chosen = [];
    if (!candidates.length) { noteWindows(); return; }
    // Whether hand `h` can take note n until `end`: a free finger all along, every note it holds
    // meanwhile within SPAN, no key already held, the hands not crossed, no jump to it faster than
    // jumpTime, nor from it to the hand's next note faster than half of it.
    const fits = (h, n, end) => {
      if (!cap[h]) return false;
      const with_ = held[h].overlapping(n.start, end);
      if (with_.some(x => x.midi === n.midi)) return false;
      if (with_.some(x => Math.abs(x.midi - n.midi) > SPAN)) return false;
      if (mostAtOnce(with_, n.start, end) + 1 > cap[h]) return false;
      // never across the other hand: no key of it above a right-hand note, or under a left-hand one
      const across = held[other(h)].overlapping(n.start, end);
      if (h === 'right' ? across.some(x => x.midi > n.midi) : across.some(x => x.midi < n.midi)) return false;
      // A jump the line itself makes is in the song; the guard is for what the level adds: the
      // move past the hand's last reach beyond the one this moment's line note makes anyway.
      const w = lastWindow[h];
      if (w && w.time < t) {
        const past = k => Math.max(0, k - w.lo - SPAN, w.hi - k - SPAN);
        const d = past(n.midi) - lineHere[h].reduce((most, x) => Math.max(most, past(x.midi)), 0);
        if (d > 0 && n.start - w.time < jumpTime(d)) return false;
      }
      // nor a tone the hand cannot leave in time for its next note (a stride's fastest leap, half
      // jumpTime, as the bass line's own)
      const next = held[h].after(end);
      const ahead = next ? Math.abs(next.midi - n.midi) - SPAN : 0;
      if (ahead > 0 && next.start - n.start < jumpTime(ahead) / 2) return false;
      return true;
    };
    const sounding = () => [...held.right.overlapping(t, t + 1e-6), ...held.left.overlapping(t, t + 1e-6), ...chosen];
    const take = (c, h, end) => {
      const n = copy(c.n, 'chord');
      n.hand = h;
      n.end = end;
      held[h].add(n);
      out.push(n);
      chosen.push(n);
    };
    let pool = candidates;
    // A hand with nothing to hold yet takes the edge note of its own group first.
    for (const h of ['right', 'left']) {
      if (!m[h] || lineHere[h].length || held[h].overlapping(t, t + 1e-6).length) continue;
      const own = pool.filter(c => c.from === h);
      if (!own.length) continue;
      const edge = own.reduce((a, b) => (h === 'right' ? (b.n.midi > a.n.midi ? b : a) : (b.n.midi < a.n.midi ? b : a)));
      const end = endOf(edge.n, h, h);
      if (fits(h, edge.n, end)) { take(edge, h, end); pool = pool.filter(c => c !== edge); }
    }
    for (;;) {
      const now = sounding();
      const classes = new Set(now.map(x => x.midi % 12));
      const base = now.length ? Math.min(...now.map(x => x.midi)) : null;
      let best = null;
      const keep = [];
      for (const c of pool) {
        work.steps++;
        let h = c.from, end = endOf(c.n, h, c.from);
        if (!fits(h, c.n, end)) {
          h = other(c.from);
          end = endOf(c.n, h, c.from);
          if (!fits(h, c.n, end)) continue; // nowhere to go: dropped
        }
        keep.push(c);
        const key = [
          classes.has(c.n.midi % 12) ? 1 : 0,
          base === null ? 0 : INTERVAL_RANK[(((c.n.midi - base) % 12) + 12) % 12],
          h === c.from ? 0 : 1,
          -(c.n.end - c.n.start),
          -(c.n.velocity || 0),
          h === 'right' ? -c.n.midi : c.n.midi,
          c.n.midi,
        ];
        if (!best || less(key, best.key)) best = { c, h, end, key };
      }
      pool = keep;
      if (!best) break;
      take(best.c, best.h, best.end);
      pool = pool.filter(c => c !== best.c);
    }
    noteWindows();

    function noteWindows() {
      for (const h of ['right', 'left']) {
        const notes = [...lineHere[h], ...chosen.filter(x => x.hand === h)];
        if (!notes.length) continue;
        const keys = notes.map(x => x.midi);
        lastWindow[h] = { lo: Math.min(...keys), hi: Math.max(...keys), time: t };
      }
    }
  });
  return out;
}

function less(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// The most notes each hand holds at once, and the widest a hand holds: for tests and reports.
// -> {right, left, total, span}
export function handLoad(notes) {
  const events = [];
  for (const n of notes) events.push([n.start, 1, n], [n.end, -1, n]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const now = { right: new Map(), left: new Map() };
  const most = { right: 0, left: 0, total: 0, span: 0 };
  for (const [, d, n] of events) {
    const h = now[n.hand];
    if (d > 0) h.set(n, n.midi); else h.delete(n);
    most[n.hand] = Math.max(most[n.hand], h.size);
    most.total = Math.max(most.total, now.right.size + now.left.size);
    if (d > 0 && h.size > 1) {
      const keys = [...h.values()];
      most.span = Math.max(most.span, Math.max(...keys) - Math.min(...keys));
    }
  }
  return most;
}
