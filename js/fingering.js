// Fingering: which hand and which finger (1-5, the thumb 1) plays each note of a song, and where
// each hand stands meanwhile (docs/piano-fingering-design.md §2-§3). A per-hand second-order
// Viterbi over onset groups, one finger set a group (a chord is one hand shape), scored by the
// rules of Parncutt et al. 1997 (Table 1, rules 1-12) on the hand's lead line and inside chords,
// plus this trainer's rules 13-18 (a time-gated jump, letting a held note go, a chord-shape move,
// rolled chords, the beginners' costs, a chord's fingers over its white keys). Pure, no DOM:
// runs in node (the tool, the tests), on the page and in a Worker. Deterministic: the same notes
// in any order give the same fingering.
import { CHORD, SPREAD_STEP, SPREAD, LEAD_RANGE, shownEnd, spanEnd } from './scene.js';
import { jumpTime } from './levels.js';
import { guideTrack } from './scene.js';
import { isBlack, keyCentre, noteName, LOW, HIGH } from './geometry.js';

// Raise whenever the cost model or the format changes: a stored file of another version is
// worked out again on the page, and the tool clears its `reviewed`.
export const FINGERING_VERSION = 2;
export const FORMAT_VERSION = 1;
export const MODELS = ['standard', 'five-finger'];
export const HOLD_SLACK = 0.1; // a shorter overlap of two notes is legato (metrics.js)
export const HELD_ON = 0.2; // a key still sounding this long past an onset is held through it
export const RELEASE_GAP = 0.05; // a note let go this long before the next is detached
export const FORBID = 1000; // a move no hand makes: the search takes it only when nothing else exists
export const MAX_KEYS = 5;
// For the tests: the search's inner steps, which grow with the groups times their states.
export const work = { steps: 0 };

// Parncutt et al. 1997, Table 1 (right hand, semitones; the left hand mirrored): for each finger
// pair, MinPrac MinComf MinRel MaxRel MaxComf MaxPrac.
export const TABLE_1 = {
  '1-2': [-5, -3, 1, 5, 8, 10], '1-3': [-4, -2, 3, 7, 10, 12], '1-4': [-3, -1, 5, 9, 12, 14], '1-5': [-1, 1, 7, 10, 13, 15],
  '2-3': [1, 1, 1, 2, 3, 5], '2-4': [1, 1, 3, 4, 5, 7], '2-5': [2, 2, 5, 6, 8, 10],
  '3-4': [1, 1, 1, 2, 2, 4], '3-5': [1, 1, 3, 4, 5, 7], '4-5': [1, 1, 1, 2, 3, 5],
};
// The five-finger model (the child and beginner arrangements, written round five-finger
// positions): Table 1 with MaxRel the widest the pair spans in a major or minor five-finger
// position and MaxComf one or two more (design §2.4), and no finger comfortable under the thumb
// (MinComf 1 for the thumb's pairs): a five-finger position never crosses.
export const FIVE_FINGER_TABLE = {
  '1-2': [-5, 1, 1, 2, 3, 10], '1-3': [-4, 1, 3, 4, 5, 12], '1-4': [-3, 1, 5, 5, 7, 14], '1-5': [-1, 1, 7, 7, 9, 15],
  '2-3': [1, 1, 1, 2, 3, 5], '2-4': [1, 1, 3, 3, 4, 7], '2-5': [2, 2, 5, 5, 6, 10],
  '3-4': [1, 1, 1, 2, 2, 4], '3-5': [1, 1, 3, 3, 4, 7], '4-5': [1, 1, 1, 2, 3, 5],
};
const MIN_PRAC = 0, MIN_COMF = 1, MIN_REL = 2, MAX_REL = 3, MAX_COMF = 4, MAX_PRAC = 5;

// The limits for a move from finger a to finger b (interval: b's pitch minus a's, mirrored for
// the left hand): a pair as printed, a reversed pair negated with Min and Max swapped, the same
// finger all zero (Parncutt et al. p. 346).
function limitsOf(table, a, b) {
  if (a === b) return [0, 0, 0, 0, 0, 0];
  if (a < b) return table[`${a}-${b}`];
  const t = table[`${b}-${a}`];
  return [-t[5], -t[4], -t[3], -t[2], -t[1], -t[0]];
}
const LIMITS = {};
for (const [model, table] of [['standard', TABLE_1], ['five-finger', FIVE_FINGER_TABLE]]) {
  LIMITS[model] = [];
  for (let a = 1; a <= 5; a++) { LIMITS[model][a] = []; for (let b = 1; b <= 5; b++) LIMITS[model][a][b] = limitsOf(table, a, b); }
}
export const limits = (model, a, b) => LIMITS[model][a][b];

// Where a finger sits in a relaxed hand, semitones above the thumb (the middle of MinRel..MaxRel
// of 1-f): the anchor of a hand shape (rule 15).
const REL = [0, 0, 3, 5, 7, 8.5];
// Weights this trainer sets over the paper's (tuned on the warm-ups' textbook fingerings, design
// §2.8): a jump's base, the thumb on a black key (rules 10 and 12 scaled), a repeated key struck
// by another finger (rule 19, ours; a beginner keeps a finger on its key).
export const WEIGHTS = { jump: 8, legatoJump: 10, thumbBlack: { standard: 4, 'five-finger': 1 }, needlessPass: 3, pass: 1, weak: { standard: 1, 'five-finger': 0.25 }, fourPass: 3, startRoom: 1, fastLeap: 6, chordShift: 1, octave: 8, repeat: { standard: 1, 'five-finger': 4 }, held: 12, prefer: 4, pinned: 40 };
const BAN_ROUNDS = 4;
const BROKEN = 4; // a wider step between two notes is a broken chord's
const DETACHED = 0.3;
const FAST_LEAP = 0.5;
export const SLOW_STEP = 0.5; // song seconds
// The widest short run (at most five notes) one hand position covers.
const STEP_13B = 6;
const RUN_RANGE = { standard: 10, 'five-finger': 9 };

// ------------------------------------------------------------------------------------------
// The notes a hand plays at one moment.

// Notes of one key that start within CHORD of each other are one key struck once: the later ones
// copy the first's hand and finger. The first is the longer, at a tie the right hand's.
function primaries(notes) {
  const order = [...notes].sort((a, b) => a.start - b.start || a.midi - b.midi || (b.end - b.start) - (a.end - a.start) || (a.hand === b.hand ? 0 : a.hand === 'right' ? -1 : 1) || a.i - b.i);
  const last = new Map();
  for (const n of order) {
    const p = last.get(n.midi);
    if (p && n.start - p.start <= CHORD) { n.copyOf = p; continue; }
    last.set(n.midi, n);
  }
  return order.filter(n => !n.copyOf);
}

// One hand's onsets as the keys show them (scene.js frameAt, levels.js groupsOf): notes within
// CHORD of the one before, or a chord spread out by hand while its notes sound.
function groupsOf(notes, hand) {
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

// A hand's pitch for the tables: the left hand mirrored, so its thumb is on the inside too.
const pitchOf = (midi, hand) => (hand === 'left' ? -midi : midi);
// The distinct keys of a group, low to high in the hand's own pitch (the lead note last).
function keysOf(notes, hand) {
  return [...new Set(notes.map(n => n.midi))].sort((a, b) => pitchOf(a, hand) - pitchOf(b, hand));
}

// Every rising finger set for `keys` (in the hand's pitch order) whose pairs all lie within
// MaxPrac. -> [[f...]]
function* fingerSets(m, from = 1, chosen = []) {
  if (chosen.length === m) { yield chosen; return; }
  for (let f = from; f <= 5 - (m - chosen.length - 1); f++) yield* fingerSets(m, f + 1, [...chosen, f]);
}
// Whether finger set `set` strikes `keys` (in the hand's pitch order) as one shape: every pair within
// MaxPrac, an octave at most and an octave on 1-5 or 1-4 (shapeAllowed, below).
function reachable(keys, hand, set) {
  return shapeAllowed(keys.map(k => pitchOf(k, hand)), set);
}
// keys: notes {midi} or key numbers.
export function blockFingerable(keys_, hand) {
  const keys = keysOf(keys_.map(k => (typeof k === 'number' ? { midi: k } : k)), hand);
  if (keys.length > MAX_KEYS) return false;
  if (!keys.length) return true;
  for (const set of fingerSets(keys.length)) if (reachable(keys, hand, set)) return true;
  return false;
}

// Step 1, the reach split (design §2.1): where a hand's keys at a moment are no one shape, its
// outer notes go to the other hand, the lowest from the right, the highest from the left, while
// the other hand can take them as one shape. Notes whose hand an override fixes stay.
function reachSplit(notes) {
  const all = [...groupsOf(notes, 'right'), ...groupsOf(notes, 'left')].sort((a, b) => a.start - b.start || (a.hand === 'right' ? -1 : 1));
  const moments = [];
  for (const g of all) {
    const m = moments[moments.length - 1];
    if (m && g.start - m.time <= CHORD && !m[g.hand]) m[g.hand] = g;
    else moments.push({ time: g.start, right: g.hand === 'right' ? g : null, left: g.hand === 'left' ? g : null });
  }
  let moved = 0;
  for (const m of moments) {
    for (const [h, o] of [['right', 'left'], ['left', 'right']]) {
      const own = m[h] ? [...m[h].notes] : [];
      const other = m[o] ? [...m[o].notes] : [];
      while (own.length && !blockFingerable(own, h)) {
        const free = own.filter(n => !n.fixedHand);
        if (!free.length) break;
        const outer = free.reduce((a, b) => (h === 'right' ? (b.midi < a.midi ? b : a) : (b.midi > a.midi ? b : a)));
        const same = own.filter(n => n.midi === outer.midi);
        if (!blockFingerable([...other, ...same], o)) break;
        for (const n of same) { n.hand = o; n.moved = true; moved++; own.splice(own.indexOf(n), 1); other.push(n); }
      }
    }
  }
  return moved + untangleAll(notes);
}

// Step 2: where the hands strike crossed keys together (within NEAR, both sounding: a left-hand
// key above a right-hand one), the keys struck then are split between the hands at one point
// instead: the split that moves the fewest notes and leaves the fewest crossings with the notes
// sounding round them, each hand one shape, the more even at a tie. Notes whose hand an override
// fixes stay. -> notes moved
export const NEAR = 0.1;
const together = (x, n) => Math.abs(x.start - n.start) <= NEAR && Math.min(x.end, n.end) - Math.max(x.start, n.start) > HOLD_SLACK;
const crossedPair = (x, n) => x.hand !== n.hand && (x.hand === 'left' ? x.midi > n.midi : x.midi < n.midi);
function untangleAll(input) {
  const notes = [...input].sort((a, b) => a.start - b.start || a.midi - b.midi);
  notes.forEach((n, i) => { n.at = i; });
  const longest = notes.reduce((m, n) => Math.max(m, n.end - n.start), 0);
  let moved = 0;
  // the notes starting within w of note n (the list is sorted by start)
  const near = (n, w) => {
    const out = [];
    for (let j = n.at; j >= 0 && n.start - notes[j].start <= w; j--) out.push(notes[j]);
    for (let j = n.at + 1; j < notes.length && notes[j].start - n.start <= w; j++) out.push(notes[j]);
    return out;
  };
  for (const n of notes) {
    const crossed = near(n, NEAR).filter(x => together(x, n) && crossedPair(x, n));
    if (!crossed.length) continue;
    const unit = new Set();
    for (const c of [n, ...crossed]) for (const x of near(c, CHORD)) unit.add(x);
    moved += untangle([...unit], near(n, NEAR + CHORD + longest)); // every note that can sound with it
  }
  return moved;
}
function untangle(unit, all) {
  const right = unit.filter(n => n.hand === 'right'), left = unit.filter(n => n.hand === 'left');
  if (!right.length || !left.length) return 0;
  const keys = [...new Set(unit.map(n => n.midi))].sort((a, b) => a - b);
  // the notes sounding round the unit, outside it
  const t0 = Math.min(...unit.map(n => n.start)), t1 = Math.max(...unit.map(n => n.end));
  const round = all.filter(x => !unit.includes(x) && x.start < t1 && x.end > t0);
  let best = null;
  for (let s = 0; s <= keys.length; s++) {
    const lo = unit.filter(n => n.midi < (keys[s] ?? Infinity)), hi = unit.filter(n => n.midi >= (keys[s] ?? Infinity));
    if (lo.some(n => n.fixedHand && n.hand !== 'left') || hi.some(n => n.fixedHand && n.hand !== 'right')) continue;
    if (!blockFingerable(lo, 'left') || !blockFingerable(hi, 'right')) continue;
    const moves = lo.filter(n => n.hand !== 'left').length + hi.filter(n => n.hand !== 'right').length;
    let crossings = 0;
    for (const [list, hand] of [[lo, 'left'], [hi, 'right']]) {
      for (const n of list) for (const x of round) if (Math.min(x.end, n.end) - Math.max(x.start, n.start) > HOLD_SLACK && crossedPair(x, { midi: n.midi, hand })) crossings++;
    }
    const uneven = Math.abs(lo.length - hi.length);
    const cost = moves + 2 * crossings;
    if (!best || cost < best.cost || (cost === best.cost && uneven < best.uneven)) best = { lo, hi, moves, cost, uneven };
  }
  if (!best) return 0;
  for (const n of best.lo) if (n.hand !== 'left') { n.hand = 'left'; n.moved = true; }
  for (const n of best.hi) if (n.hand !== 'right') { n.hand = 'right'; n.moved = true; }
  return best.moves;
}

// ------------------------------------------------------------------------------------------
// Costs (design §2.4). k: a key {p (the hand's pitch), black, midi}, f: its finger.

// Rules 1-3 between two keys a then b (or two keys of a chord, low to high).
function spanCost(L, d, fa, fb) {
  const thumb = fa === 1 || fb === 1 ? 1 : 2;
  return 2 * Math.max(0, d - L[MAX_COMF]) + 2 * Math.max(0, L[MIN_COMF] - d)
    + thumb * Math.max(0, L[MIN_REL] - d) + thumb * Math.max(0, d - L[MAX_REL]);
}

// Rule 18 (ours): in a chord, neighbouring fingers stand over the white keys between them, as in
// a five-finger position; 0.5 for each step off, from a fourth (four white keys) on any fingers
// do.
function fitCost(xa, xb, fa, fb) {
  const steps = Math.min(Math.abs(xb - xa), 4);
  return 0.5 * Math.max(0, Math.abs(Math.abs(fb - fa) - steps) - 0.5);
}

// A group's own cost in state `set`: its chord's spans and white-key fit between neighbouring
// keys, and a thumb on a black key (rule 10's base) on every key.
function verticalCost(model, g, set) {
  let c = 0;
  // a held key on a finger with no room under it (holdRoom)
  if (g.room) for (const [i, least] of g.room) if (set[i] < least) c += WEIGHTS.held;
  // a level's note on another finger than the full fingering's
  if (g.prefer) for (let i = 0; i < set.length; i++) if (g.prefer[i] && g.prefer[i] !== set[i]) c += g.preferWeight[i];
  // rule 21 (ours): a chord an octave or wider takes 1 and 5 on its outer keys, or 1 and 4 with its
  // outer key on a black one (the octave fingering every method teaches)
  const m = g.keys.length;
  if (m > 1 && !g.rolled && g.keys[m - 1].p - g.keys[0].p >= 12) {
    const outer = set[m - 1];
    if (set[0] !== 1 || !(outer === 5 || (outer === 4 && g.keys[m - 1].black))) c += WEIGHTS.octave;
  }
  for (let i = 0; i < g.keys.length; i++) {
    // rule 10's base: in a run the thumb on a black key is dear (the scales), in a chord as printed
    if (set[i] === 1 && g.keys[i].black) c += m > 1 ? 1 : WEIGHTS.thumbBlack[model];
    if (i === 0) continue;
    const a = g.keys[i - 1], b = g.keys[i];
    if (!g.rolled) c += spanCost(LIMITS[model][set[i - 1]][set[i]], b.p - a.p, set[i - 1], set[i]) + fitCost(a.x, b.x, set[i - 1], set[i]);
    else c += melodicCost(model, a, set[i - 1], b, set[i]);
  }
  return c;
}

// Rules 1-3, 6, 8-12 between two consecutive lead notes (a then b) that the fingers join.
function melodicCost(model, a, fa, b, fb) {
  const d = b.p - a.p;
  let c = 0;
  if (fa !== fb) c += spanCost(LIMITS[model][fa][fb], d, fa, fb);
  if (fb === 4 || fb === 5) c += WEIGHTS.weak[model]; // rule 6
  if (fa === 3 && fb === 4) c += 1; // rule 8
  if ((fa === 3 && fb === 4 && !a.black && b.black) || (fa === 4 && fb === 3 && a.black && !b.black)) c += 1; // rule 9
  // rule 10, its context: the thumb on a black key next to a white one, in steps (a broken chord
  // keeps its hand shape, the thumb where the chord puts it)
  if (Math.abs(d) <= BROKEN && fb === 1 && b.black && !a.black) c += 2 * WEIGHTS.thumbBlack[model];
  if (Math.abs(d) <= BROKEN && fa === 1 && a.black && !b.black) c += 2 * WEIGHTS.thumbBlack[model];
  if (d === 0 && fa !== fb) c += WEIGHTS.repeat[model]; // rule 19
  // rule 11
  if (fb === 5 && b.black && !a.black) c += 2;
  if (fa === 5 && a.black && !b.black) c += 2;
  const pass = passOf(d, fa, fb);
  if (pass) {
    // rule 12: on one level 1; the lower white by a finger and the upper black by the thumb 3
    const [lower, upper] = d > 0 ? [a, b] : [b, a];
    if (lower.black === upper.black) c += 1;
    else if (!lower.black && upper.black) c += 3 * WEIGHTS.thumbBlack[model];
    c += WEIGHTS.pass; // ours: a pass moves the whole hand, so fewer of them is better
    // ours: the scales cross 4 and the thumb a tone apart (C major's left hand, F and B-flat
    // major's right), which Table 1's MinComf of -1 for 1-4 charges as a stretch
    if ((fa === 4 || fb === 4) && Math.abs(d) <= 2) c -= WEIGHTS.fourPass;
    if (model === 'five-finger') c += 4; // rule 17
  }
  return c;
}
// A thumb passing under a finger, or a finger over the thumb (in the hand's pitch).
const passOf = (d, fa, fb) => (d > 0 && fa > 1 && fb === 1) || (d < 0 && fa === 1 && fb > 1);

// ------------------------------------------------------------------------------------------
// The search.

// Every state of a group: a rising finger set over its keys within MaxPrac (a rolled group: any
// rising set), less those an override excludes. Ordered by the finger string read low key to high.
function statesOf(g) {
  const out = [];
  const m = g.keys.length;
  if (m > MAX_KEYS || !m) return out;
  // an unrolled chord: the comfortable shapes only (realism, below)
  const comfy = !g.rolled && m > 1 ? shapes(g.keys.map(k => k.p), (g.held || []).map(p => ({ p }))) : null;
  for (const set of fingerSets(m)) {
    if (!g.rolled && !reachable(g.keys.map(k => k.midi), g.hand, set)) continue;
    if (comfy && !comfy.some(s => s.every((f, i) => f === set[i]))) continue;
    if (g.fixed && g.keys.some((k, i) => g.fixed.has(k.midi) && g.fixed.get(k.midi) !== set[i])) continue;
    if (g.roll && g.roll.some((f, i) => f !== set[i])) continue;
    out.push(set);
  }
  const low = s => (g.hand === 'left' ? [...s].reverse() : s).join('');
  return out.sort((a, b) => (low(a) < low(b) ? -1 : low(a) > low(b) ? 1 : 0));
}

// What one transition from group a (state sa) to group b (state sb) costs, and what it is:
// {cost, jump, forbid, release, pass, stretch}.
function transition(model, a, sa, b, sb) {
  const A = a.keys[a.keys.length - 1], B = b.keys[b.keys.length - 1];
  const fa = sa[sa.length - 1], fb = sb[sb.length - 1];
  const d = B.p - A.p, dt = b.start - a.start;
  const L = LIMITS[model][fa][fb];
  const chord = a.keys.length > 1 || b.keys.length > 1;
  // detached: the note before let go RELEASE_GAP and a third of the step before this one (a file's
  // own articulation, a tenth or a fifth of the step, still plays legato)
  const released = A.end <= b.start - Math.max(RELEASE_GAP, DETACHED * dt);
  let cost = 0, jump = false, forbid = false, early = false, fast = false;
  const out = (fa === fb && d !== 0) || d > L[MAX_PRAC] || d < L[MIN_PRAC];
  if (out) {
    jump = true;
    const excess = fa === fb ? Math.abs(d) : d > L[MAX_PRAC] ? d - L[MAX_PRAC] : L[MIN_PRAC] - d;
    // in time: jumpTime (levels.js) at 100 %; a fast leap (a stride bass, octaves) down to half of it
    const need = jumpTime(excess);
    const timely = dt >= need * FAST_LEAP;
    fast = timely && dt < need;
    if (model === 'five-finger' && fa === fb && Math.abs(d) <= 2 && dt >= 0.25 && !chord) { cost += STEP_13B; fast = false; } // rule 13b
    // a chord shape carried to the next chord by the same fingers (octaves, parallel thirds and
    // sixths): the hand moves as a whole, never legato; rule 15 prices the move
    else if (timely && chord && fa === fb) cost += WEIGHTS.chordShift;
    else if (timely && (chord || released)) cost += WEIGHTS.jump + Math.abs(d) / 2; // rule 13
    // a slow note (a bass under the pedal) the same finger moves on from: lifted, the pedal holds it
    else if (timely && fa === fb && dt >= SLOW_STEP) { early = true; cost += WEIGHTS.jump + Math.abs(d) / 2 + 2 + WEIGHTS.legatoJump; }
    else if (timely && fa !== fb) {
      // a leap out of a legato line: the note before is let go early; where some fingers would
      // have joined the two keys, a dear choice
      early = true;
      cost += WEIGHTS.jump + Math.abs(d) / 2 + 2 + (Math.abs(d) <= LIMITS.standard[1][5][MAX_PRAC] ? WEIGHTS.legatoJump : 0);
    } else { cost += FORBID + Math.abs(d); forbid = true; fast = false; }
    if (fast) cost += WEIGHTS.fastLeap;
    // the rest of the lead's rules, but no span: the hand leaves its place
    if (fb === 4 || fb === 5) cost += WEIGHTS.weak[model];
  } else {
    cost += melodicCost(model, A, fa, B, fb);
    // rule 20 (ours): a pass inside a short run the hand covers without one
    if (passOf(d, fa, fb) && b.step && b.step.count <= 5 && b.step.range <= RUN_RANGE[model]) cost += WEIGHTS.needlessPass;
  }
  // what no teacher writes (realism): a fast crossing on the wrong side, one finger on two keys
  // in a row
  if (badMove(d, fa, fb, dt) || sameStep(a.keys, sa, b.keys, sb, dt, b.start)) { cost += FORBID; forbid = true; }
  // rule 14: a note of a that still sounds and whose finger b needs, or that b's keys cannot reach;
  // (ours) dear where b strikes a key inside it by its finger or one outside it
  const release = holdConflict(model, a, sa, b, sb);
  if (release) cost += 2;
  if (heldCrossed(a, sa, b, sb)) cost += WEIGHTS.held;
  // rule 15: the hand's centre moves
  if (chord) {
    const M = Math.abs(anchorOf(b, sb) - anchorOf(a, sa));
    if (M > 2) cost += 1 + (M - 2) / 2;
  }
  return { cost, jump, forbid, fast, release: release || early, pass: !jump && passOf(d, fa, fb) };
}

// The runs of a chain's lead line: stretches that keep one direction (repeats go on with it).
// Each group gets the run its step from the group before belongs to: {count, range}.
function markRuns(chain) {
  let i = 0;
  while (i < chain.length - 1) {
    let j = i + 1, dir = 0;
    const p = g => g.keys[g.keys.length - 1].p;
    for (; j < chain.length; j++) {
      const s = Math.sign(p(chain[j]) - p(chain[j - 1]));
      if (s && dir && s !== dir) break;
      if (s) dir = s;
    }
    const part = chain.slice(i, j);
    const ps = part.map(p);
    const run = { count: part.length, range: Math.max(...ps) - Math.min(...ps) };
    for (let k = i + 1; k < j; k++) chain[k].step = run;
    i = j - 1;
  }
}

// Whether b in state sb strikes a key between a key of a still held (not by the thumb) and the
// thumb by the held key's finger or one outside it, where some shape would strike b's keys, keep
// the held one and come from the group before b (p, in state sp) by a move a hand makes: the hand
// lets go a note it could keep (realism's `held`).
function heldCrossed(a, sa, b, sb, p = a, sp = sa) {
  for (let i = 0; i < a.keys.length; i++) {
    const h = a.keys[i], fh = sa[i];
    if (fh === 1 || h.keep === false || h.end <= b.start + HELD_ON) continue;
    if (lets(b.keys.map(k => k.p), sb, h.p, fh, { keys: p.keys, fingers: sp, dt: b.start - p.start, at: b.start })) return true;
  }
  return false;
}
// The same on hand pitches: keys ps (low to high) on fingers set, a key hp held by fh; prev: the
// group before ({keys: [{p, end}], fingers, dt, at}), or null.
function lets(ps, set, hp, fh, prev) {
  if (ps.includes(hp)) return false;
  if (!ps.some((p, j) => p < hp && set[j] >= fh)) return false;
  const last = ps.length - 1;
  return holdSets(ps, hp, fh).some(s => !prev || !(badMove(ps[last] - prev.keys[prev.keys.length - 1].p, prev.fingers[prev.fingers.length - 1], s[last], prev.dt)
    || sameStep(prev.keys.map(k => ({ midi: k.p, end: k.end })), prev.fingers, ps.map(p => ({ midi: p })), s, prev.dt, prev.at)));
}
// The finger sets that strike keys ps (the hand's pitches, low to high) while key hp stays held by
// finger fh: one allowed shape over them all. Cached by the keys' distances from the held one.
const HOLD_CACHE = new Map();
function holdSets(ps, hp, fh) {
  const id = `${ps.map(p => p - hp).join(',')}|${fh}`;
  let out = HOLD_CACHE.get(id);
  if (out) return out;
  const all = [...ps, hp].sort((x, y) => x - y);
  const at = all.indexOf(hp);
  out = [];
  if (all.length <= MAX_KEYS) for (const set of fingerSets(all.length)) if (set[at] === fh && shapeAllowed(all, set, HELD_WIDE)) out.push(set.filter((f, i) => i !== at));
  if (HOLD_CACHE.size > 100000) HOLD_CACHE.clear();
  HOLD_CACHE.set(id, out);
  return out;
}

// The keys a hand strikes between a key it holds (pitch hp, sounding until `end`, struck in group
// ai with keys `own`) and the thumb, from the next group until it strikes one beyond it; and whether
// the hand can keep the key down over them all: no more than the fingers under the highest it can
// hold it with (5, less one for each key of its own group beyond it), all within the thumb's comfort
// of it. pOf: a group's keys as the hand's pitches. -> {count, keep}
function underHeld(groups, ai, hp, end, own, pOf) {
  const inner = new Set();
  let low = hp;
  for (let bi = ai + 1; bi < groups.length && groups[bi].start < end - HELD_ON; bi++) {
    const ps = pOf(groups[bi]);
    if (ps.some(p => p > hp)) break;
    for (const p of ps) if (p < hp && !own.includes(p)) { inner.add(p); low = Math.min(low, p); }
  }
  const top = 5 - own.filter(p => p > hp).length;
  return { count: inner.size, keep: inner.size <= top - 1 && hp - low <= LIMITS.standard[1][top][MAX_COMF] };
}

// A key the hand can keep down while it strikes keys between it and the thumb wants a finger with
// room for them: one more than the distinct keys struck, up to 5 (verticalCost charges a lower one
// as a let-go). A key it cannot keep is marked: letting it go is no fault (heldCrossed).
function holdRoom(groups) {
  const pOf = g => g.keys.map(k => k.p);
  groups.forEach((a, ai) => {
    a.keys.forEach((h, i) => {
      const { count, keep } = underHeld(groups, ai, h.p, h.end, pOf(a), pOf);
      h.keep = keep;
      if (!count || !keep || a.rolled) return;
      (a.room || (a.room = [])).push([i, Math.min(5, count + 1)]);
    });
  });
}

// Whether a note of group a still sounding at b's onset must be let go for b in state sb.
function holdConflict(model, a, sa, b, sb, at = b.start) {
  for (let i = 0; i < a.keys.length; i++) {
    const h = a.keys[i];
    if (h.end <= at + HOLD_SLACK) continue;
    const fh = sa[i];
    for (let j = 0; j < b.keys.length; j++) {
      const k = b.keys[j];
      if (k.midi === h.midi) continue;
      if (sb[j] === fh) return true;
      const L = LIMITS.standard[fh][sb[j]];
      const d = k.p - h.p;
      if (d > L[MAX_PRAC] || d < L[MIN_PRAC]) return true;
    }
  }
  return false;
}

const anchorOf = (g, s) => g.keys.reduce((sum, k, i) => sum + k.p - REL[s[i]], 0) / g.keys.length;

// Rules 4, 5 and 7 on the lead notes of three groups, and a note of the first still held at the
// third that the third cannot keep.
// sounds: whether a key of a still sounds at c's onset ({hold: any, keep: one that may count as held}),
// worked out once for the three groups.
function tripleCost(model, a, sa, b, sb, c, sc, sounds = { hold: true, keep: true }) {
  const A = a.keys[a.keys.length - 1], B = b.keys[b.keys.length - 1], C = c.keys[c.keys.length - 1];
  const f1 = sa[sa.length - 1], f2 = sb[sb.length - 1], f3 = sc[sc.length - 1];
  let cost = 0;
  const L = LIMITS[model][f1][f3];
  const d = C.p - A.p;
  if (!(f1 === f3 && d === 0)) {
    if (d > L[MAX_COMF] || d < L[MIN_COMF]) {
      const between = (B.p - A.p) * (C.p - B.p) > 0;
      cost += f2 === 1 && between && (d > L[MAX_PRAC] || d < L[MIN_PRAC]) ? 2 : 1; // rule 4
      cost += d > L[MAX_COMF] ? d - L[MAX_COMF] : L[MIN_COMF] - d; // rule 5
    }
  }
  if (d === 0 && A.midi === C.midi && f1 !== f3) cost += 1; // rule 4: a note re-fingered one note on
  if (f1 !== f2 && f2 !== f3 && f1 !== f3 && f1 + f2 + f3 === 12 && Math.min(f1, f2, f3) === 3) cost += 1; // rule 7
  if (sounds.hold && holdConflict(model, a, sa, c, sc) && !holdConflict(model, a, sa, b, sb)) cost += 2;
  if (sounds.keep && heldCrossed(a, sa, c, sc, b, sb)) cost += WEIGHTS.held;
  return cost;
}

// The second-order Viterbi over one chain of groups that all have states. -> chosen state index
// per group.
function searchChain(model, chain) {
  const n = chain.length;
  const states = chain.map(g => g.states);
  const vert = chain.map(g => g.states.map(s => verticalCost(model, g, s)));
  // A chain's first note: rule 6 spares it, and (ours) a line starts with the most fingers free
  // in the way it goes: rising from the thumb, falling from 5.
  const way = chain.length > 1 ? Math.sign(chain[1].keys[chain[1].keys.length - 1].p - chain[0].keys[chain[0].keys.length - 1].p) : 0;
  const start = s => { const f = s[s.length - 1]; return way ? WEIGHTS.startRoom * (way > 0 ? f - 1 : 5 - f) : 0; };
  if (n === 1) {
    let best = 0, bestCost = Infinity;
    states[0].forEach((s, i) => { const c = vert[0][i] + start(s); if (c < bestCost) { bestCost = c; best = i; } });
    const out = [best];
    out.cost = bestCost;
    return out;
  }
  const pairCost = g => {
    const A = states[g - 1], B = states[g];
    const m = new Float64Array(A.length * B.length);
    for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) m[i * B.length + j] = transition(model, chain[g - 1], A[i], chain[g], B[j]).cost;
    return m;
  };
  // dp over (state of g-1, state of g)
  let pc = pairCost(1);
  let dp = new Float64Array(states[0].length * states[1].length);
  for (let i = 0; i < states[0].length; i++) {
    for (let j = 0; j < states[1].length; j++) dp[i * states[1].length + j] = vert[0][i] + start(states[0][i]) + pc[i * states[1].length + j] + vert[1][j];
  }
  const back = [null, null];
  for (let g = 2; g < n; g++) {
    const A = states[g - 2], B = states[g - 1], C = states[g];
    const at = chain[g].start;
    const sounds = { hold: chain[g - 2].keys.some(k => k.end > at + HOLD_SLACK), keep: chain[g - 2].keys.some(k => k.keep !== false && k.end > at + HELD_ON) };
    pc = pairCost(g);
    const next = new Float64Array(B.length * C.length).fill(Infinity);
    const bp = new Int16Array(B.length * C.length);
    for (let j = 0; j < B.length; j++) {
      for (let k = 0; k < C.length; k++) {
        const base = pc[j * C.length + k] + vert[g][k];
        let best = Infinity, arg = 0;
        for (let i = 0; i < A.length; i++) {
          work.steps++;
          const prev = dp[i * B.length + j];
          if (prev === Infinity) continue;
          const c = prev + tripleCost(model, chain[g - 2], A[i], chain[g - 1], B[j], chain[g], C[k], sounds);
          if (c < best) { best = c; arg = i; }
        }
        next[j * C.length + k] = best + base;
        bp[j * C.length + k] = arg;
      }
    }
    back.push(bp);
    dp = next;
  }
  // the best last pair, then back
  const B = states[n - 2].length, C = states[n - 1].length;
  let bestCost = Infinity, bj = 0, bk = 0;
  for (let j = 0; j < B; j++) for (let k = 0; k < C; k++) if (dp[j * C + k] < bestCost) { bestCost = dp[j * C + k]; bj = j; bk = k; }
  const chosen = new Array(n);
  chosen[n - 1] = bk;
  chosen[n - 2] = bj;
  for (let g = n - 1; g >= 2; g--) chosen[g - 2] = back[g][chosen[g - 1] * states[g].length + chosen[g]];
  chosen.cost = bestCost;
  return chosen;
}

// ------------------------------------------------------------------------------------------
// Overrides (design §3.3): {at, key?, hand?, finger?, roll?, to?, why}.

export const KEY_NAME = /^([A-G]#?)(-?\d)$/;
export function keyName(midi) { return `${noteName(midi)}${Math.floor(midi / 12) - 1}`; }
export function parseKey(name) {
  const m = KEY_NAME.exec(name || '');
  if (!m) return null;
  const pc = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(m[1]);
  return pc < 0 ? null : (Number(m[2]) + 1) * 12 + pc;
}
const AT_EPS = 0.0006; // the reports print onsets to the millisecond
export const WHY_MAX = 120;

export class OverrideError extends Error {}

// The overrides checked and matched to the notes: an override that matches no note, matches two
// keys, or has no reason, throws.
function applyOverrides(notes, overrides) {
  const rolls = [];
  overrides.forEach((o, n) => {
    const where = `override ${n + 1} (at ${o && o.at})`;
    if (!o || typeof o !== 'object') throw new OverrideError(`${where}: not an object`);
    if (typeof o.why !== 'string' || !o.why.trim() || o.why.length > WHY_MAX) throw new OverrideError(`${where}: needs a reason of 1-${WHY_MAX} characters`);
    if (!Number.isFinite(o.at)) throw new OverrideError(`${where}: no time`);
    if (o.hand !== undefined && !['right', 'left'].includes(o.hand)) throw new OverrideError(`${where}: hand ${o.hand}`);
    if (o.finger !== undefined && !(Number.isInteger(o.finger) && o.finger >= 0 && o.finger <= 5)) throw new OverrideError(`${where}: finger ${o.finger}`);
    if (o.roll !== undefined) {
      if (o.key !== undefined || !o.hand || !(typeof o.roll === 'string' && /^[1-5]{0,5}$/.test(o.roll))) throw new OverrideError(`${where}: a roll needs a hand, no key, and fingers low to high`);
      if (o.to !== undefined && !(Number.isFinite(o.to) && o.to >= o.at)) throw new OverrideError(`${where}: to ${o.to}`);
      rolls.push(o);
      return;
    }
    if (o.key === undefined) throw new OverrideError(`${where}: needs a key`);
    const midi = parseKey(o.key);
    if (midi === null) throw new OverrideError(`${where}: key ${o.key}`);
    if (o.hand === undefined && o.finger === undefined) throw new OverrideError(`${where}: changes nothing`);
    const hit = notes.filter(x => Math.abs(x.start - o.at) <= AT_EPS && x.midi === midi);
    if (!hit.length) throw new OverrideError(`${where}: no note ${o.key} there`);
    for (const x of hit) {
      if (o.hand) { x.hand = o.hand; x.fixedHand = true; }
      if (o.finger !== undefined) x.fixedFinger = o.finger;
      if (o.finger > 0) x.pinned = true;
      x.override = true;
    }
  });
  return rolls;
}

// ------------------------------------------------------------------------------------------

// song: prepareSong() (or any {notes: [{midi, start, end, hand}]}); model: 'standard' |
// 'five-finger'; overrides: design §3.3. -> {hands: ['right'|'left'], fingers: [0-5], (per note of
// song.notes), groups: per hand the groups with their chosen state, moved, rolled, unfingered,
// forbidden: the FORBID moves taken (the groups they land on keep no finger), moves: those groups'
// notes, model}.
// fixed: (for comparing a fingering with the optimiser's) a finger for every note, the search
// then only scores it; result.cost is the path's cost.
// prefer: (a level's notes) a finger for every note to keep where the hand allows it, 0 for none;
// preferWeight: what giving each up costs (WEIGHTS.prefer where unset).
// keepHands: (a level's notes) every note stays in the hand it comes with: no note is moved to the
// other hand to reach a chord or uncross the hands.
export function fingerSong(song, { model = 'standard', overrides = [], fixed = null, prefer = null, preferWeight = null, keepHands = false } = {}) {
  if (!MODELS.includes(model)) throw new RangeError(`model ${model}`);
  const notes = song.notes.map((n, i) => ({ i, midi: n.midi, start: n.start, end: n.end, hand: n.hand === 'left' ? 'left' : 'right', fixedHand: keepHands || undefined }));
  const rolls = applyOverrides(notes, overrides);
  const used = new Set(); // the roll overrides that matched a chord
  if (fixed) notes.forEach((n, i) => { if (fixed[i] > 0) n.fixedFinger = fixed[i]; });
  if (prefer) notes.forEach((n, i) => { if (prefer[i] > 0) { n.prefer = prefer[i]; n.preferWeight = (preferWeight && preferWeight[i]) || WEIGHTS.prefer; } });
  const prim = primaries(notes);
  const moved = reachSplit(prim.filter(n => n.fixedFinger !== 0));
  const live = prim.filter(n => n.fixedFinger !== 0);
  const result = { hands: notes.map(n => n.hand), fingers: new Array(notes.length).fill(0), groups: {}, moved, rolled: 0, unfingered: 0, forbidden: 0, moves: 0, model, cost: 0,
    pinned: notes.map(n => !!(n.pinned || (n.copyOf && n.copyOf.pinned))) };
  for (const hand of ['right', 'left']) {
    const groups = groupsOf(live, hand);
    groups.forEach((g, gi) => {
      g.keys = keysOf(g.notes, hand).map(midi => {
        const ns = g.notes.filter(n => n.midi === midi);
        return { midi, p: pitchOf(midi, hand), black: isBlack(midi), x: pitchOf(keyCentre(midi, 1), hand), end: Math.max(...ns.map(n => n.end)) };
      });
      const fixed = g.notes.filter(n => n.fixedFinger > 0);
      if (fixed.length) g.fixed = new Map(fixed.map(n => [n.midi, n.fixedFinger]));
      const pref = g.notes.filter(n => n.prefer > 0);
      if (pref.length) {
        g.prefer = g.keys.map(k => (pref.find(n => n.midi === k.midi) || {}).prefer || 0);
        g.preferWeight = g.keys.map(k => (pref.find(n => n.midi === k.midi) || {}).preferWeight || 0);
      }
      const roll = rolls.find(o => o.hand === hand && (o.to === undefined ? Math.abs(g.start - o.at) <= AT_EPS : g.start >= o.at - AT_EPS && g.start <= o.to + AT_EPS));
      if (roll) {
        g.rolled = roll.to === undefined || !statesOf({ ...g, rolled: false }).length;
        if (g.rolled) {
          if (roll.to === undefined) {
            if (roll.roll.length !== g.keys.length) throw new OverrideError(`roll at ${roll.at}: ${roll.roll.length} fingers for ${g.keys.length} keys`);
            g.roll = (hand === 'left' ? [...roll.roll].reverse() : [...roll.roll]).map(Number);
          }
          used.add(roll);
        }
      }
      // the keys of earlier groups still held through this one (their shape is the hand's too)
      g.held = [];
      for (let j = gi - 1; j >= 0 && j >= gi - 16; j--) for (const k of groups[j].keys) if (k.end > g.start + HELD_ON && !g.keys.some(x => x.midi === k.midi) && !g.held.includes(k.p)) g.held.push(k.p);
      g.states = statesOf(g);
      if (g.rolled && g.states.length) result.rolled++;
    });
    holdRoom(groups);
    for (const o of rolls) if (o.hand === hand && o.to === undefined && !used.has(o)) throw new OverrideError(`roll at ${o.at}: no ${hand}-hand chord there`);
    // chains of groups with states, broken by the ones without; then, while a key held from further
    // back than the search sees is let go needlessly (heldCrossed), the states that do so are
    // banned and the search runs again
    const search = () => {
      let chain = [], cost = 0;
      const flush = () => {
        if (!chain.length) return;
        markRuns(chain);
        const chosen = searchChain(model, chain);
        cost += chosen.cost;
        chain.forEach((g, n) => { g.state = g.states[chosen[n]]; });
        chain = [];
      };
      for (const g of groups) {
        if (g.states.length) chain.push(g); else { flush(); g.state = null; }
      }
      flush();
      return cost;
    };
    let cost = search();
    // a needless let-go from further back than the search sees: the holding group keeps the
    // fingers it has (so the ban stays true) and the later group loses the states that let go; a
    // round that leaves more moves no hand makes is undone, and the rounds stop
    const forbids = () => groups.reduce((n, b, i) => n + (i && b.state && groups[i - 1].state && transition(model, groups[i - 1], groups[i - 1].state, b, b.state).forbid ? 1 : 0), 0);
    let worst = forbids();
    for (let round = 0; round < BAN_ROUNDS; round++) {
      const before = groups.map(g => [g.states, g.state]);
      const beforeCost = cost;
      let added = 0;
      groups.forEach((b, bi) => {
        if (!b.state) return;
        for (let ai = bi - 1; ai >= 0 && ai >= bi - 64; ai--) {
          const a = groups[ai];
          const p = groups[bi - 1];
          if (!a.state || !p.state || !heldCrossed(a, a.state, b, b.state, p, p.state)) continue;
          const left = b.states.filter(s => !heldCrossed(a, a.state, b, s, p, p.state));
          if (!left.length) continue;
          a.states = [a.state];
          b.states = left;
          added++;
        }
      });
      if (!added) break;
      cost = search();
      const now = forbids();
      if (now > worst) {
        groups.forEach((g, i) => { [g.states, g.state] = before[i]; });
        cost = beforeCost;
        break;
      }
      worst = now;
    }
    result.cost += cost;
    // a move no hand makes, left only where every way to the group makes one (a song of one's own
    // with a leap too fast for a hand): the group it lands on keeps no finger, so the guide shows
    // nothing a hand cannot play there and says so (design §4.8)
    for (let i = 1; i < groups.length; i++) {
      const a = groups[i - 1], b = groups[i];
      if (a.state && b.state && transition(model, a, a.state, b, b.state).forbid) { result.forbidden++; b.unplayable = !fixed; }
    }
    for (const g of groups) {
      for (const n of g.notes) {
        const k = g.keys.findIndex(x => x.midi === n.midi);
        result.fingers[n.i] = g.state && !g.unplayable ? g.state[k] : 0;
        if (g.unplayable) result.moves++;
      }
    }
    result.groups[hand] = groups;
  }
  for (const n of notes) {
    if (n.copyOf) { result.hands[n.i] = n.copyOf.hand; result.fingers[n.i] = result.fingers[n.copyOf.i]; continue; }
    result.hands[n.i] = n.hand;
    if (n.fixedFinger === 0) result.fingers[n.i] = 0;
  }
  result.unfingered = result.fingers.filter(f => f === 0).length;
  return result;
}

// ------------------------------------------------------------------------------------------
// What a fingering is made of, for the report, the audit and the tests: per hand its groups
// (onset, keys, fingers, notes) and per transition what it does.

// notes: [{midi, start, end}] with hands and fingers by index. -> {right: [...], left: [...]} of
// {start, end, keys: [midi] low to high in the hand's pitch, fingers: [f], ends: [each key's last
// end], starts: [each key's first start], spans: [each key's notes as [start, end], a key struck
// twice in a spread chord twice], notes: [index], rolled}
export function handGroups(notes, hands, fingers) {
  const list = notes.map((n, i) => ({ i, midi: n.midi, start: n.start, end: n.end, hand: hands[i], finger: fingers[i] }))
    .filter(n => n.finger > 0)
    .sort((a, b) => a.start - b.start || a.midi - b.midi || a.i - b.i);
  list.forEach((n, at) => { n.at = at; });
  const prim = primaries(list.map(n => ({ ...n })));
  // per hand and key, its notes in time: a group's copies are found among a few, not the whole list
  const byKey = new Map();
  const slot = (hand, midi) => (hand === 'left' ? 1000 : 0) + midi;
  for (const n of list) {
    const k = slot(n.hand, n.midi);
    let same = byKey.get(k);
    if (!same) byKey.set(k, (same = []));
    same.push(n);
  }
  const out = {};
  for (const hand of ['right', 'left']) {
    out[hand] = groupsOf(prim, hand).map(g => {
      const keys = g.notes.length === 1 ? [g.notes[0].midi] : keysOf(g.notes, hand);
      // each key's finger (its first note's) and end (its last to let go), and the group's end
      const fingersOf = new Array(keys.length).fill(0), ends = new Array(keys.length).fill(-Infinity), starts = new Array(keys.length).fill(Infinity);
      let end = -Infinity;
      for (const n of g.notes) {
        const k = keys.indexOf(n.midi);
        if (!fingersOf[k]) fingersOf[k] = n.finger;
        if (n.start < starts[k]) starts[k] = n.start;
        if (n.end > ends[k]) ends[k] = n.end;
        if (n.end > end) end = n.end;
      }
      const all = [], spans = keys.map(() => []);
      for (const m of g.notes) {
        const same = byKey.get(slot(hand, m.midi)) || [];
        let lo = 0, hi = same.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (same[mid].start < m.start - CHORD) lo = mid + 1; else hi = mid; }
        for (let j = lo; j < same.length && same[j].start <= m.start + CHORD; j++) {
          work.steps++;
          if (!all.includes(same[j])) all.push(same[j]);
        }
      }
      if (all.length > 1) all.sort((a, b) => a.at - b.at);
      for (const m of all) spans[keys.indexOf(m.midi)].push([m.start, m.end]);
      return { hand, start: g.start, end, keys, fingers: fingersOf, ends, starts, spans, notes: all.map(n => n.i) };
    });
  }
  return out;
}

// The checks the bundled data must pass and the numbers the audit prints (design §6.1, §7.2 T2).
// -> {faults: [text], passes, stretches, releases, jumps, forbidden, groups}
export function analyse(notes, hands, fingers, { model = 'standard', rolled = () => false } = {}) {
  const G = handGroups(notes, hands, fingers);
  const faults = [], flags = [];
  let passes = 0, stretches = 0, releases = 0, jumps = 0, forbidden = 0, fastLeaps = 0;
  for (const hand of ['right', 'left']) {
    const groups = G[hand].map(g => ({ ...g, keys: g.keys.map((midi, i) => ({ midi, p: pitchOf(midi, hand), black: isBlack(midi), x: pitchOf(keyCentre(midi, 1), hand), end: g.ends[i] })) }));
    groups.forEach((g, gi) => {
      g.rolled = rolled(hand, g.start);
      const set = g.fingers;
      for (let i = 1; i < set.length; i++) if (!(set[i] > set[i - 1])) faults.push(`${hand} ${g.start.toFixed(3)}: fingers ${set.join('')} do not rise with the keys`);
      if (!g.rolled && set.every((f, i) => i === 0 || f > set[i - 1]) && !reachable(g.keys.map(k => k.midi), hand, set)) faults.push(`${hand} ${g.start.toFixed(3)}: chord ${g.keys.map(k => keyName(k.midi)).join(' ')} wider than ${set.join('')} reach`);
      for (let i = 1; i < set.length; i++) {
        const L = LIMITS[model][set[i - 1]][set[i]];
        const d = g.keys[i].p - g.keys[i - 1].p;
        if (d > L[MAX_COMF] + 1) { stretches++; flags.push({ kind: 'F3', hand, at: g.start, text: `chord stretch ${keyName(g.keys[i - 1].midi)}·${set[i - 1]} ${keyName(g.keys[i].midi)}·${set[i]}` }); }
      }
      if (gi === 0) return;
      const a = groups[gi - 1];
      if (!a.fingers.every((f, i) => i === 0 || f > a.fingers[i - 1]) || !set.every((f, i) => i === 0 || f > set[i - 1])) return;
      const t = transition(model, a, a.fingers, g, set);
      if (t.forbid) { forbidden++; faults.push(`${hand} ${g.start.toFixed(3)}: no hand makes this move (${keyName(a.keys[a.keys.length - 1].midi)}·${a.fingers[a.fingers.length - 1]} → ${keyName(g.keys[g.keys.length - 1].midi)}·${set[set.length - 1]})`); }
      if (t.jump) jumps++;
      if (t.fast) { fastLeaps++; flags.push({ kind: 'F4', hand, at: g.start, text: `fast leap ${keyName(a.keys[a.keys.length - 1].midi)}·${a.fingers[a.fingers.length - 1]} → ${keyName(g.keys[g.keys.length - 1].midi)}·${set[set.length - 1]} in ${Math.round((g.start - a.start) * 1000)} ms` }); }
      // a note held from the group before, or from the one before that, let go for this one
      const z = gi >= 2 ? groups[gi - 2] : null;
      const older = z && z.fingers.every((f, i) => i === 0 || f > z.fingers[i - 1]) && !holdConflict(model, z, z.fingers, a, a.fingers) && holdConflict(model, z, z.fingers, g, set);
      if (t.release || older) { releases++; flags.push({ kind: 'F8', hand, at: g.start, text: 'a held note let go early' }); }
      if (t.pass) {
        passes++;
        const A = a.keys[a.keys.length - 1], B = g.keys[g.keys.length - 1];
        flags.push({ kind: 'F2', hand, at: g.start, text: `pass ${keyName(A.midi)}·${a.fingers[a.fingers.length - 1]} → ${keyName(B.midi)}·${set[set.length - 1]}` });
      }
      // F5: the thumb or 5 on a black key between white ones, in fast notes
      const nx = groups[gi + 1];
      const B = g.keys[g.keys.length - 1], fB = set[set.length - 1];
      if (nx && (fB === 1 || fB === 5) && B.black && !a.keys[a.keys.length - 1].black && !nx.keys[nx.keys.length - 1].black
        && (g.start - a.start < 0.2 || nx.start - g.start < 0.2)) flags.push({ kind: 'F5', hand, at: g.start, text: `${fB === 1 ? 'thumb' : '5'} on ${keyName(B.midi)} between white keys, fast` });
      if (!t.jump && a.keys.length === 1 && g.keys.length === 1) {
        const L = LIMITS[model][a.fingers[0]][set[0]], d = g.keys[0].p - a.keys[0].p;
        if (d > L[MAX_COMF] || d < L[MIN_COMF]) { stretches++; flags.push({ kind: 'F3', hand, at: g.start, text: `stretch ${keyName(a.keys[0].midi)}·${a.fingers[0]} → ${keyName(g.keys[0].midi)}·${set[0]}` }); }
      }
    });
  }
  // F6 (five-finger songs): a pass inside a run (one direction, repeats going on with it) of at most
  // six notes whose range fits nine semitones: one five-finger position covers it
  if (model === 'five-finger') {
    for (const f of flags.filter(x => x.kind === 'F2')) {
      const lead = G[f.hand].map(g => ({ start: g.start, key: g.keys[g.keys.length - 1] }));
      const i = lead.findIndex(x => x.start === f.at);
      const dir = Math.sign(lead[i].key - lead[i - 1].key);
      let a = i - 1, b = i;
      while (a > 0 && Math.sign(lead[a].key - lead[a - 1].key) * dir >= 0) a--;
      while (b + 1 < lead.length && Math.sign(lead[b + 1].key - lead[b].key) * dir >= 0) b++;
      const keys = lead.slice(a, b + 1).map(x => x.key);
      if (keys.length <= 6 && Math.max(...keys) - Math.min(...keys) <= 9) flags.push({ kind: 'F6', hand: f.hand, at: f.at, text: `pass in a short run: ${f.text}` });
    }
  }
  return { faults, flags, passes, stretches, releases, jumps, forbidden, fastLeaps, groups: G };
}

// ------------------------------------------------------------------------------------------
// What a teacher would not write (the audit's hard rules, every song at every level; design
// §6.4). -> [{kind, hand, at, text}]
//   octave  two keys an octave apart struck by one hand on other fingers than 1-5 or 1-4
//   wide    a chord one hand strikes unrolled wider than an octave (WIDE)
//   cross   in notes under CROSS_GAP apart, a fourth or less away: 5 on the wrong side of 2, 3 or
//           4, any long finger over another, or the thumb under 5 (5 over the thumb); or, an octave
//           or less away, a pass more than PASS_STRETCH past the pair's practical reach
//   held    a key struck between a held key and the thumb by the held key's finger or one outside
//           it (the held key's finger reused, or a finger crossing it)
//   hands   a key of the left hand above a key of the right hand struck or held with it
//   shape   a chord on a stretched shape where a comfortable one exists
//   same    one finger on two keys in a row, in notes under SAME_GAP apart: single notes, or a
//           single note while another key of the hand stays held
export const CROSS_GAP = 0.3;
export const SAME_GAP = 0.4;
export const CROSS_REACH = 5;
// A pass may reach this much past Table 1's MaxPrac (the thumb under 3 by a fourth in an arpeggio);
// further, the hand jumps.
export const PASS_STRETCH = 2;
// Keys one hand strikes together span an octave at most (wider, the chord is rolled, rule 16); a
// key it holds while it strikes others may lie a ninth from them (Table 1's 1-5 reaches a tenth,
// held down it stays within the practical reach a hand keeps, design §2.3 L5).
export const WIDE = 12;
export const HELD_WIDE = 14;

// A chord's stretch past comfort (Table 1's MaxComf, every model) on finger set `set` over keys
// `ps` (the hand's pitches, low to high): [the pairs more than a semitone past, the semitones past].
function stretchOf(ps, set) {
  let over = 0, excess = 0;
  for (let i = 1; i < ps.length; i++) {
    const e = ps[i] - ps[i - 1] - LIMITS.standard[set[i - 1]][set[i]][MAX_COMF];
    if (e > 1) over++;
    if (e > 0) excess += e;
  }
  return [over, excess];
}
// Whether finger set `set` strikes keys `ps` (the hand's pitches, low to high) as a teacher would:
// within reach, an octave at most (`wide`: a ninth with a key held), octaves on 1-5 or 1-4.
function shapeAllowed(ps, set, wide = WIDE) {
  if (ps.length > 1 && ps[ps.length - 1] - ps[0] > wide) return false;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const d = ps[j] - ps[i];
      const l = LIMITS.standard[set[i]][set[j]];
      if (d > l[MAX_PRAC] || d < l[MIN_PRAC]) return false;
      if (d === 12 && !(set[i] === 1 && (set[j] === 5 || set[j] === 4))) return false;
    }
  }
  return true;
}
// The comfortable shapes of keys `ps`: no pair more than a semitone past MaxComf and at most a
// semitone more stretch in all than the least any shape needs; null when no shape is allowed.
// wide: the widest the keys may span (WIDE struck together, HELD_WIDE with keys held).
function comfortable(ps, wide = WIDE) {
  const sets = [...fingerSets(ps.length)].filter(s => shapeAllowed(ps, s, wide));
  if (!sets.length) return null;
  const least = Math.min(...sets.map(s => stretchOf(ps, s)[1]));
  return sets.filter(s => { const [over, excess] = stretchOf(ps, s); return excess <= least + 1 && (over === 0 || !sets.some(t => stretchOf(ps, t)[0] === 0)); });
}
// One finger on two keys in a row, in notes under SAME_GAP apart: single notes, or a single note
// a fourth or less away, struck by a finger of the chord before while other keys of it stay held and
// another finger in order with them and with the key it leaves could strike it (the hand does not move; a chord carried whole, an octave beside
// a held key, moves its fingers together; an inner voice moves on the one finger left between the
// held ones). Keys: {midi, p (the hand's pitch; without it midi is one), end} in the hand's order,
// fingers by index. -> [key a, key
// b, finger] or null
const pitch = k => (k.p !== undefined ? k.p : k.midi);
function sameStep(ka, sa, kb, sb, dt, at) {
  if (dt >= SAME_GAP) return null;
  for (let i = 0; i < ka.length; i++) {
    for (let j = 0; j < kb.length; j++) {
      if (sa[i] !== sb[j] || ka[i].midi === kb[j].midi) continue;
      if (ka.length === 1 && kb.length === 1) return [ka[i], kb[j], sa[i]];
      if (kb.length > 1 || Math.abs(pitch(kb[j]) - pitch(ka[i])) > CROSS_REACH) continue;
      const held = ka.map((h, x) => [h, sa[x], x]).filter(([h, , x]) => x !== i && h.end > at + HOLD_SLACK && !kb.some(k => k.midi === h.midi));
      if (!held.length) continue;
      const pos = (h, fh, f) => (pitch(kb[j]) > pitch(h)) === (f > fh);
      const other = [1, 2, 3, 4, 5].some(f => f !== sb[j] && pos(ka[i], sa[i], f) && held.every(([h, fh]) => f !== fh && pos(h, fh, f)));
      if (other) return [ka[i], kb[j], sa[i]];
    }
  }
  return null;
}

// The comfortable shapes of keys ps (the hand's pitches, low to high) struck while keys held (each
// {p, f?}: its pitch, its finger where known) stay down: the chord's own, and those that are part
// of a comfortable shape over it and the held keys (a repeated chord under a held top note keeps
// the shape it was struck in). -> [set]
function shapes(ps, held) {
  const out = comfortable(ps) || [];
  if (held.length && ps.length + held.length <= MAX_KEYS) {
    const all = [...ps, ...held.map(h => h.p)].sort((x, y) => x - y);
    for (const set of comfortable(all, HELD_WIDE) || []) {
      if (held.some(h => h.f && set[all.indexOf(h.p)] !== h.f)) continue;
      const mine = ps.map(p => set[all.indexOf(p)]);
      if (!out.some(s => s.every((f, i) => f === mine[i]))) out.push(mine);
    }
  }
  return out;
}

// The kind of a move between two lead notes no teacher writes: d semitones (the hand's pitch)
// from finger fa to fb, dt seconds apart. -> a word or null
function badMove(d, fa, fb, dt) {
  if (d === 0 || dt >= CROSS_GAP) return null;
  const near = Math.abs(d) <= CROSS_REACH; // further, the hand leaps and any finger may land
  if (near && ((fa === 5 && fb > 1 && fb < 5 && d > 0) || (fb === 5 && fa > 1 && fa < 5 && d < 0))) return '5 on the wrong side';
  if (near && fa > 1 && fb > 1 && fa !== fb && Math.sign(fb - fa) !== Math.sign(d)) return 'a long finger over another';
  if (near && ((fa === 5 && fb === 1 && d > 0) || (fa === 1 && fb === 5 && d < 0))) return 'the thumb under 5';
  const L = LIMITS.standard[fa][fb];
  if (Math.abs(d) <= 12 && passOf(d, fa, fb) && (d > L[MAX_PRAC] + PASS_STRETCH || d < L[MIN_PRAC] - PASS_STRETCH)) return 'a pass past reach';
  return null;
}

export function realism(notes, hands, fingers, { rolled = () => false } = {}) {
  const G = handGroups(notes, hands, fingers);
  const out = [];
  const name = (midi, f) => `${keyName(midi)}·${f}`;
  for (const hand of ['right', 'left']) {
    const groups = G[hand];
    groups.forEach((g, gi) => {
      const ps = g.keys.map(k => pitchOf(k, hand));
      const roll = rolled(hand, g.start);
      const chord = g.keys.map((k, i) => name(k, g.fingers[i])).join('+');
      if (!roll && g.keys.length > 1) {
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
          if (ps[j] - ps[i] === 12 && !(g.fingers[i] === 1 && (g.fingers[j] === 5 || g.fingers[j] === 4))) out.push({ kind: 'octave', hand, at: g.start, text: `octave ${chord}` });
        }
        if (ps[ps.length - 1] - ps[0] > WIDE) out.push({ kind: 'wide', hand, at: g.start, text: `${ps[ps.length - 1] - ps[0]} semitones unrolled: ${chord}` });
        const held = [];
        for (let j = gi - 1; j >= 0 && j >= gi - 16; j--) groups[j].keys.forEach((k, i) => { if (groups[j].ends[i] > g.start + HELD_ON && !g.keys.includes(k) && !held.some(h => h.p === pitchOf(k, hand))) held.push({ p: pitchOf(k, hand), f: groups[j].fingers[i] }); });
        const ok = g.fingers.every((f, i) => i === 0 || f > g.fingers[i - 1]) && comfortable(ps) && shapes(ps, held);
        if (ok && !ok.some(s => s.every((f, i) => f === g.fingers[i]))) out.push({ kind: 'shape', hand, at: g.start, text: `stretched ${chord}, ${ok[0].join('')} fits` });
      }
      if (gi === 0) return;
      const a = groups[gi - 1];
      const la = a.keys.length - 1, lb = g.keys.length - 1;
      const d = pitchOf(g.keys[lb], hand) - pitchOf(a.keys[la], hand), dt = g.start - a.start;
      const fa = a.fingers[la], fb = g.fingers[lb];
      const bad = badMove(d, fa, fb, dt);
      if (bad) out.push({ kind: 'cross', hand, at: g.start, text: `${bad}: ${name(a.keys[la], fa)} → ${name(g.keys[lb], fb)} in ${Math.round(dt * 1000)} ms` });
      const same = sameStep(a.keys.map((midi, i) => ({ midi, p: pitchOf(midi, hand), end: a.ends[i] })), a.fingers, g.keys.map(midi => ({ midi, p: pitchOf(midi, hand) })), g.fingers, dt, g.start);
      if (same) out.push({ kind: 'same', hand, at: g.start, text: `${name(same[0].midi, same[2])} → ${name(same[1].midi, same[2])} in ${Math.round(dt * 1000)} ms` });
      // the keys still held at this onset, from any group before, that the hand can keep
      for (let hi = gi - 1; hi >= 0 && hi >= gi - 64; hi--) {
        const h = groups[hi];
        h.keys.forEach((hk, i) => {
          const fh = h.fingers[i];
          if (fh === 1 || h.ends[i] <= g.start + HELD_ON || g.keys.includes(hk)) return;
          const pOf = x => x.keys.map(k => pitchOf(k, hand));
          if (!underHeld(groups, hi, pitchOf(hk, hand), h.ends[i], pOf(h), pOf).keep) return;
          const prev = { keys: a.keys.map((k, x) => ({ p: pitchOf(k, hand), end: a.ends[x] })), fingers: a.fingers, dt, at: g.start };
          if (lets(ps, g.fingers, pitchOf(hk, hand), fh, prev)) out.push({ kind: 'held', hand, at: g.start, text: `${chord} while ${name(hk, fh)} is held` });
        });
      }
    });
  }
  // the hands crossed: a left-hand key above a right-hand key struck with it (within NEAR, both
  // sounding)
  const struck = notes.map((n, i) => ({ midi: n.midi, start: n.start, end: n.end, hand: hands[i] })).filter((n, i) => fingers[i] > 0).sort((a, b) => a.start - b.start);
  struck.forEach((n, i) => {
    if (n.hand !== 'right') return;
    for (let j = i; j >= 0 && struck[j].start >= n.start - NEAR; j--) check(struck[j]);
    for (let j = i + 1; j < struck.length && struck[j].start <= n.start + NEAR; j++) check(struck[j]);
    function check(x) {
      if (x.hand === 'left' && x.midi > n.midi && together(x, n)) out.push({ kind: 'hands', hand: 'both', at: Math.min(x.start, n.start), text: `left ${keyName(x.midi)} above right ${keyName(n.midi)}` });
    }
  });
  return out.sort((x, y) => x.at - y.at || (x.hand < y.hand ? -1 : x.hand > y.hand ? 1 : 0) || (x.kind < y.kind ? -1 : 1));
}

// ------------------------------------------------------------------------------------------
// Hand positions (design §4.4): per hand, the groups in order; a group opens a new position when
// one of its fingers already sits on another key of the current one, or a pair between the group
// and the position falls outside MinComf..MaxComf. In a five-finger song one finger moving at most
// a tone keeps the position. -> {right: [position], left: [position]}; a position: {start, last
// (its last onset), slots: [x of fingers 1-5 in white pitches], keys: [midi or null], groups:
// [{start, end, fingers, keys, ends, starts, spans, shape, release}]}
// A group's shape {keys, slots}: the hand as it plays that onset. Its fingers on their keys, every
// other finger on the key it last played in the position, and a finger not used yet on the first
// key it will play there where that keeps the fingers in order and within MinComf..MaxComf (else
// it goes between its neighbours as in slotsOf). So no two fingers ever stand on one key.
// A group's release, per key: null, or [the onset before, the onset] of the first later onset the
// finger holding that key cannot hold it through (rule 14): one struck while the key still shows
// sounding that needs the finger on another key or plays the key with another finger, or one
// whose shape cannot keep it (another finger on the key; in another position canHold), since the
// hand takes that shape ahead of it.
// handsAt lets the key go at max(the onset before, the onset − lead); the key keeps sounding (the
// pedal or the ear carries it), the finger goes on with the hand.

export function handPositions(notes, hands, fingers, { model = 'standard' } = {}) {
  const G = handGroups(notes, hands, fingers);
  const out = {};
  for (const hand of ['right', 'left']) {
    const positions = [];
    let cur = null;
    for (const g of G[hand].flatMap((g, i, all) => rollSteps(g, hand, all[i + 1], notes))) {
      if (cur && fits(model, hand, cur.keys, g)) {
        g.keys.forEach((k, i) => { cur.keys[g.fingers[i]] = k; });
        cur.groups.push(g);
        cur.last = g.start;
      } else {
        cur = { hand, start: g.start, last: g.start, keys: [null, null, null, null, null, null], groups: [g] };
        g.keys.forEach((k, i) => { cur.keys[g.fingers[i]] = k; });
        positions.push(cur);
      }
    }
    for (const p of positions) {
      p.slots = slotsOf(p.keys, hand);
      p.end = Math.max(...p.groups.map(g => g.end));
      // each finger's first key from each group on (walked back), then each group's shape
      const coming = [];
      let first = [null, null, null, null, null, null];
      for (let gi = p.groups.length - 1; gi >= 0; gi--) {
        first = first.slice();
        p.groups[gi].keys.forEach((k, i) => { first[p.groups[gi].fingers[i]] = k; });
        coming[gi] = first;
      }
      const last = [null, null, null, null, null, null];
      p.groups.forEach((g, gi) => {
        g.keys.forEach((k, i) => { last[g.fingers[i]] = k; });
        const keys = last.slice(), next = coming[gi + 1];
        if (next) for (let f = 1; f <= 5; f++) if (keys[f] === null && next[f] !== null && inComfort(keys, f, next[f], hand)) keys[f] = next[f];
        unsqueeze(keys, g.fingers, last);
        const slots = slotsOf(keys, hand);
        g.shape = { keys, slots, tuck: tuckOf(keys, slots) };
      });
    }
    const flat = [];
    positions.forEach((p, pos) => { for (const g of p.groups) flat.push([g, pos]); });
    flat.forEach(([g, pos], i) => {
      g.release = g.keys.map((key, k) => {
        const f = g.fingers[k], end = Math.max(...g.spans[k].map(spanEnd));
        // past its end plus the longest lead (speed at most 1) it is let go by its own end
        for (let j = i + 1; j < flat.length && flat[j][0].start < end + LEAD_RANGE[1]; j++) {
          const [h, hpos] = flat[j];
          const mine = h.fingers.indexOf(f), other = h.keys.indexOf(key);
          const needed = h.start < end && ((mine >= 0 && h.keys[mine] !== key) || (other >= 0 && h.fingers[other] !== f));
          // the shape the hand takes for it: in the same position no other finger on the key, in
          // another one, or where the shape leaves the finger free (unsqueeze), canHold
          const kept = hpos === pos && h.shape.keys[f] !== null ? !h.shape.keys.some((o, at) => at !== f && o === key) : canHold(h.shape, f, key, hand, flat[j - 1][0].shape);
          if (needed || !kept) return [flat[j - 1][0].start, h.start];
        }
        return null;
      });
    });
    out[hand] = { positions, flat: flat.map(([g]) => g) };
  }
  // a key one hand holds that the other hand strikes while it sounds is let go by the holding hand,
  // at max(its onset before the strike, the strike − lead), whatever it would have kept: one key, one
  // hand (the key shows the striking hand's colour)
  for (const [hand, other] of [['right', 'left'], ['left', 'right']]) {
    const mine = out[hand].flat, theirs = out[other].flat;
    mine.forEach((g, i) => {
      g.keys.forEach((key, k) => {
        const end = Math.max(...g.spans[k].map(spanEnd));
        let lo = 0, hi = theirs.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (theirs[mid].start <= g.start) lo = mid + 1; else hi = mid; }
        for (let j = lo; j < theirs.length && theirs[j].start < end; j++) {
          if (!theirs[j].keys.includes(key)) continue;
          const at = theirs[j].start;
          if (g.release[k] && g.release[k][1] <= at) break;
          let b = i;
          while (b + 1 < mine.length && mine[b + 1].start < at) b++;
          g.release[k] = [mine[b].start, at];
          break;
        }
      });
    });
  }
  return { right: out.right.positions, left: out.left.positions };
}

// A rolled group (a chord no one hand shape strikes: rule 16) as the guide draws it: one step a
// shape, lowest keys first, each step as many keys up as one allowed shape takes comfortably
// (shapeAllowed, no pair more than a semitone past MaxComf, as `comfortable`),
// ROLL_STEP song seconds apart (less where the hand's next onset or the shortest note comes sooner).
// A step is a group of its own, so the hand moves from shape to shape as through any onsets, and a
// key the next step's shape cannot hold is let go there, the key still lit. A later step's key is
// pressed from the step on, to where its note stops showing (its span keeps the note's start third:
// scene.js spanEnd). notes: the song's, which a group's `notes` index. -> [group]
const ROLL_STEP = 0.1;
function rollSteps(g, hand, next, notes) {
  const ps = g.keys.map(k => pitchOf(k, hand));
  if (g.keys.length < 2 || shapeAllowed(ps, g.fingers)) return [g];
  const order = g.keys.map((k, i) => i).sort((a, b) => g.keys[a] - g.keys[b]);
  const steps = [];
  let step = [];
  for (const i of order) {
    const take = [...step, i].sort((a, b) => ps[a] - ps[b]);
    const tp = take.map(x => ps[x]), tf = take.map(x => g.fingers[x]);
    if (step.length && !(shapeAllowed(tp, tf) && stretchOf(tp, tf)[0] === 0)) { steps.push(step); step = [i]; } else step = take;
  }
  steps.push(step);
  const shortest = Math.min(...g.spans.flat().map(([s, e]) => shownEnd(s, e) - s));
  const dt = Math.min(ROLL_STEP, ((next ? next.start : Infinity) - g.start) / steps.length, (shortest / 2) / (steps.length - 1));
  return steps.map((list, n) => {
    const at = g.start + n * dt;
    const pick = a => list.map(x => a[x]);
    const keys = pick(g.keys);
    return { ...g, start: at, keys, fingers: pick(g.fingers), ends: pick(g.ends), starts: pick(g.starts).map(s => Math.max(s, at)),
      spans: pick(g.spans).map(l => l.map(([s, e]) => (s < at ? [at, e, s] : [s, e]))), notes: g.notes.filter(i => keys.includes(notes[i].midi)), roll: n };
  });
}

// A shape whose free fingers would stand squeezed between two keyed neighbours (less than ROOM of a
// white key each) lets one of the two go free, so it stands outside its neighbours: a finger
// the hand keeps on its last key first, then one put on the key it plays later; a finger struck now
// stays. keys: the shape's keys by finger (changed in place), struck: the onset's fingers, last: the
// keys the fingers last played in the position.
const ROOM = 0.6;
function unsqueeze(keys, struck, last) {
  for (;;) {
    let free = 0;
    for (let a = 1; a <= 5 && !free; a++) {
      if (keys[a] === null) continue;
      let b = a + 1;
      while (b <= 5 && keys[b] === null) b++;
      if (b > 5 || b - a < 2 || Math.abs(keyCentre(keys[b], 1) - keyCentre(keys[a], 1)) >= ROOM * (b - a)) continue;
      const rank = f => (struck.includes(f) ? 0 : keys[f] === last[f] ? 2 : 1);
      if (rank(a) || rank(b)) free = rank(a) >= rank(b) ? a : b;
    }
    if (!free) return;
    keys[free] = null;
  }
}

function fits(model, hand, keys, g) {
  const want = keys.slice();
  for (let i = 0; i < g.keys.length; i++) {
    const f = g.fingers[i], k = g.keys[i];
    if (want[f] !== null && want[f] !== k) {
      if (!(model === 'five-finger' && g.keys.length === 1 && Math.abs(want[f] - k) <= 2)) return false;
    }
    want[f] = k;
  }
  for (let a = 1; a <= 5; a++) {
    for (let b = a + 1; b <= 5; b++) {
      if (want[a] === null || want[b] === null) continue;
      // a position is what the hand covers without moving: Table 1's comfort, whatever the model,
      // its fingers in order (a pass starts the next position)
      const L = LIMITS.standard[a][b], d = pitchOf(want[b], hand) - pitchOf(want[a], hand);
      if (d <= 0 || d < L[MIN_COMF] || d > L[MAX_COMF]) return false;
    }
  }
  return true;
}

// keys (a shape's, null for a free finger) with finger f on key k: every pair in order and
// within MinComf..MaxComf, as a position holds them (fits)
function inComfort(keys, f, k, hand) {
  for (let o = 1; o <= 5; o++) {
    if (o === f || keys[o] === null) continue;
    const [a, ka, b, kb] = o < f ? [o, keys[o], f, k] : [f, k, o, keys[o]];
    const L = LIMITS.standard[a][b], d = pitchOf(kb, hand) - pitchOf(ka, hand);
    if (d <= 0 || d < L[MIN_COMF] || d > L[MAX_COMF]) return false;
  }
  return true;
}

// A finger f holding `key` while the hand takes `shape` (another position's) after `before` (the
// shape of the onset before): every other finger within Table 1's reach of it (MinPrac..REACH; a
// free finger by its slot, a white key ≈ 12/7 semitones) and on another key, none of 2-5 across
// it, and none passing over it from `before` to `shape` (the hand slides between the two).
export const SAME_KEY = 0.3; // white pitches: two tips nearer than this stand on one key (adjacent keys: 0.36 at least)
const REACH = MAX_PRAC;
export function canHold(shape, f, key, hand, before = shape) {
  const x = keyCentre(key, 1), dir = hand === 'left' ? -1 : 1;
  for (let o = 1; o <= 5; o++) {
    if (o === f) continue;
    const k = shape.keys[o], L = o < f ? LIMITS.standard[o][f] : LIMITS.standard[f][o];
    if (k === key) return false;
    const dx = (shape.slots[o] - x) * dir, was = (before.slots[o] - x) * dir;
    const d = k !== null ? (o < f ? -1 : 1) * (pitchOf(k, hand) - pitchOf(key, hand)) : (o < f ? -dx : dx) * 12 / 7;
    if (d < L[MIN_PRAC] || d > L[REACH]) return false;
    if (Math.abs(dx) < SAME_KEY || dx * was <= 0 || (o > 1 && f > 1 && dx * (o - f) < 0)) return false;
  }
  return true;
}

// The free fingers a shape leaves between two keyed neighbours closer than ROOM of a white key a
// finger (a chord's 1 and 3 on neighbouring keys): 1 for each, which the guide lifts over the
// others (scene.js handsAt `up`). -> [_, 0|1]
function tuckOf(keys, slots) {
  const out = [0, 0, 0, 0, 0, 0];
  for (let f = 2; f <= 4; f++) {
    if (keys[f] !== null) continue;
    let a = f - 1, b = f + 1;
    while (a >= 1 && keys[a] === null) a--;
    while (b <= 5 && keys[b] === null) b++;
    if (a >= 1 && b <= 5 && Math.abs(slots[b] - slots[a]) < ROOM * (b - a)) out[f] = 1;
  }
  return out;
}

const KEY_MIN = keyCentre(LOW, 1) - 0.5, KEY_MAX = keyCentre(HIGH, 1) + 0.5, SQUEEZE = 0.55;
// The five fingertips' x (white pitches): the used fingers on their keys, an unused one between
// its used neighbours where a relaxed hand has it (REL: the thumb further from 2 than the fingers
// from each other), outside them one white key a finger, closer at the keyboard's ends.
export function slotsOf(keys, hand) {
  const x = [null, null, null, null, null, null];
  const used = [];
  for (let f = 1; f <= 5; f++) if (keys[f] !== null && keys[f] !== undefined) { x[f] = keyCentre(keys[f], 1); used.push(f); }
  if (!used.length) return x;
  const dir = hand === 'left' ? -1 : 1; // from the thumb outwards
  for (let f = 1; f <= 5; f++) {
    if (x[f] !== null) continue;
    const below = used.filter(u => u < f).pop(), above = used.find(u => u > f);
    if (below !== undefined && above !== undefined) x[f] = x[below] + ((x[above] - x[below]) * (REL[f] - REL[below])) / (REL[above] - REL[below]);
  }
  // outside the used fingers one white key a finger, closer together where the keyboard ends
  // (at least SQUEEZE apart, so a hand at its end reaches a little past it)
  const out = (from, step, count) => {
    const side = dir * step, room = c => (side > 0 ? KEY_MAX - 0.5 - c : c - (KEY_MIN + 0.5));
    let at = Math.round(x[from] - 0.5) + 0.5, gap = 1;
    if (room(at) < count) { at = x[from]; gap = Math.max(SQUEEZE, Math.min(1, room(at) / count)); }
    for (let i = 1; i <= count; i++) x[from + step * i] = at + side * gap * i;
  };
  if (used[0] > 1) out(used[0], -1, used[0] - 1);
  if (used[used.length - 1] < 5) out(used[used.length - 1], 1, 5 - used[used.length - 1]);
  return x;
}

// ------------------------------------------------------------------------------------------
// The levels (design §3.5): a level's notes are fingered by the optimiser on their own, each note
// in the hand levels.js gives it (so the level's per-hand limits hold), and preferring the finger
// the full fingering gives it where the full fingering plays it with that hand too (much more
// where an override set it: full.pinned); so a level keeps the full fingering wherever its fewer
// notes leave that realistic, and changes it where they do not (a melody the full song plays in
// octaves on 5 becomes a five-finger line). A note the level gives the other hand, or adds, takes a
// free finger of its hand's shape; a note no shape covers keeps no finger.
// levelNotes: songAtLevel().notes; full: {hands, fingers, pinned?} of song.notes. -> {hands (the
// level's own), fingers, refingered (the level's groups whose fingers differ from the full ones),
// alone (their notes' indices)}

export function levelFingering(levelNotes, song, full, { model = 'standard' } = {}) {
  const key = (midi, start) => `${midi}@${Math.round(start * 2000)}`;
  const source = new Map();
  song.notes.forEach((n, i) => {
    const k = key(n.midi, n.start);
    if (!source.has(k)) source.set(k, []);
    source.get(k).push(i);
  });
  const prefer = [], weight = [], fingered = [];
  const notes = levelNotes.map((n, i) => {
    const hand = n.hand === 'left' ? 'left' : 'right';
    const from = source.get(key(n.midi, n.start)) || [];
    const j = from.find(x => full.hands[x] === hand && full.fingers[x] > 0);
    fingered[i] = from.some(x => full.fingers[x] > 0);
    prefer[i] = j === undefined ? 0 : full.fingers[j];
    weight[i] = j !== undefined && full.pinned && full.pinned[j] ? WEIGHTS.pinned : WEIGHTS.prefer;
    return { midi: n.midi, start: n.start, end: n.end, hand };
  });
  const r = fingerSong({ notes }, { model, prefer, preferWeight: weight, keepHands: true });
  const alone = new Set();
  // the notes the full fingering fingers that the level plays with another finger or hand
  notes.forEach((n, i) => { if (fingered[i] && r.fingers[i] !== prefer[i]) alone.add(i); });
  const G = handGroups(levelNotes, r.hands, r.fingers);
  const refingered = ['right', 'left'].reduce((sum, h) => sum + G[h].filter(g => g.notes.some(i => alone.has(i))).length, 0);
  return { hands: r.hands, fingers: r.fingers, unfingered: r.unfingered, moves: r.moves, refingered, alone };
}

// The song as the guide shows it (design §4.7): `base` (the song at a level) with its notes in
// `hands` (a level's own, or at level 5 the full fingering's), each with its finger, and the
// hands' positions as handsAt reads them (track). Linear in the notes: worked out between frames.
// moves: of the notes without a finger, those a move no hand makes leads to (fingerSong's moves).
export function guidedSong(base, hands, fingers, { model = 'standard', moves = 0 } = {}) {
  const notes = base.notes.every((n, i) => n.hand === hands[i]) ? base.notes : base.notes.map((n, i) => ({ ...n, hand: hands[i] }));
  const track = guideTrack(handPositions(notes, hands, fingers, { model }));
  return { ...base, notes, fingers, track, unfingered: fingers.filter(x => x === 0).length, moves };
}

// ------------------------------------------------------------------------------------------
// Stored files (design §3.2).

// FNV-1a 32-bit over one line a note: midi, start and end in ms, its hand's letter.
export function notesCheck(notes) {
  let h = 0x811c9dc5;
  const text = notes.map(n => `${n.midi}:${Math.round(n.start * 1000)}:${Math.round(n.end * 1000)}:${(n.hand || 'r')[0]}`).join('\n');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// A stored file -> {hands, fingers} for `song`, or {error} saying why it does not fit.
export function readStored(data, song) {
  if (!data || typeof data !== 'object') return { error: 'not a fingering file' };
  if (data.version !== FORMAT_VERSION) return { error: `version ${data.version}` };
  if (data.optimiser !== FINGERING_VERSION) return { error: `optimiser ${data.optimiser}` };
  const n = song.notes.length;
  if (data.notes !== n) return { error: `${data.notes} notes, the song has ${n}` };
  if (typeof data.hands !== 'string' || typeof data.fingers !== 'string' || data.hands.length !== n || data.fingers.length !== n) return { error: 'lengths' };
  if (!/^[rl]*$/.test(data.hands) || !/^[0-5]*$/.test(data.fingers)) return { error: 'characters' };
  if (data.check !== notesCheck(song.notes)) return { error: 'check' };
  if (!MODELS.includes(data.model)) return { error: `model ${data.model}` };
  // the notes whose finger an override sets (a level keeps them first)
  const set = (data.overrides || []).filter(o => o && o.finger > 0 && typeof o.key === 'string');
  const pinned = song.notes.map(n => set.some(o => Math.abs(o.at - n.start) <= AT_EPS && o.key === keyName(n.midi)));
  return {
    hands: [...data.hands].map(c => (c === 'l' ? 'left' : 'right')),
    fingers: [...data.fingers].map(Number),
    model: data.model,
    rolls: (data.overrides || []).filter(o => o && o.roll !== undefined),
    pinned,
  };
}

// The fields of a stored file from a result.
export function storedFields(song, result) {
  return {
    notes: song.notes.length,
    check: notesCheck(song.notes),
    model: result.model,
    optimiser: FINGERING_VERSION,
    hands: result.hands.map(h => h[0]).join(''),
    fingers: result.fingers.join(''),
  };
}

// Whether a rolled-group override covers the group of `hand` at `start`.
export function rolledBy(rolls) {
  return (hand, start) => rolls.some(o => o.hand === hand && (o.to === undefined ? Math.abs(start - o.at) <= AT_EPS : start >= o.at - AT_EPS && start <= o.to + AT_EPS));
}

// The model an entry of the catalog is fingered with (design §2.2): the child and beginner
// arrangements five-finger, every other song standard; a warm-up by its group.
export function modelFor(entry) {
  if (!entry) return 'standard';
  if (entry.kind === 'warmup') return ['steps', 'knock', 'drop-roll', 'five-finger'].includes(entry.group) ? 'five-finger' : 'standard';
  return entry.source === 'arrangement' && ['дитина', 'початківець'].includes(entry.audience) ? 'five-finger' : 'standard';
}
