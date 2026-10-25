// What a song asks of the player, worked out from its notes (prepareSong), and the level and
// speed each player (a level of play: Просунутий, Середній, Новачок) starts it at. The catalog
// keeps these numbers for the bundled songs (piano/songs/catalog.json, checked by
// tests/catalog.test.mjs); a song of one's own gets them from the same function. Pure.
import { CHORD } from './scene.js';
import { LEVELS, FULL } from './levels.js';

// Who a song or warm-up was written for (the catalog's `audience`).
export const AUDIENCES = ['дитина', 'початківець', 'досвідчений'];
// The players, in the order «Хто грає?» lists them (profiles.js PLAYERS): Просунутий, Середній,
// Новачок. Their ids key the catalog's defaults and the page's memory (library.js).
export const PLAYER_IDS = ['advanced', 'intermediate', 'novice'];
// A key let go this little after the next one goes down is legato, not held with it.
export const HOLD_SLACK = 0.1;

// song: prepareSong() -> {seconds, hands, keysMax, keysAvg, handKeys, span, notesPerSecond, outside}
//   seconds         the length at 100 %, rounded
//   hands           1 when every note is in one hand, else 2
//   keysMax         the most keys down at once: the notes pressed together (within CHORD) and
//                   the ones still held then
//   keysAvg         the same on average over every press, to 0.1
//   handKeys        the most keys one hand holds at once
//   span            the widest one hand holds at once, in semitones
//   notesPerSecond  notes per second of play at 100 %, to 0.1
//   outside         notes beyond the 61 keys, which the song is played with an octave nearer
export function songMetrics(song) {
  const notes = song.notes;
  const seconds = Math.round(song.end || 0);
  const outside = song.shifted || 0;
  if (!notes.length) return { seconds, hands: 1, keysMax: 0, keysAvg: 0, handKeys: 0, span: 0, notesPerSecond: 0, outside };
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.midi - b.midi);
  let keysMax = 0, handKeys = 0, span = 0, sum = 0, moments = 0;
  let held = [];
  let i = 0;
  while (i < sorted.length) {
    const time = sorted[i].start;
    let j = i;
    while (j < sorted.length && sorted[j].start - time <= CHORD) j++;
    held = held.filter(n => n.end > time + HOLD_SLACK);
    const down = { right: new Set(), left: new Set() };
    for (const n of held) down[n.hand].add(n.midi);
    for (let k = i; k < j; k++) down[sorted[k].hand].add(sorted[k].midi);
    const total = down.right.size + down.left.size;
    keysMax = Math.max(keysMax, total);
    sum += total;
    moments++;
    for (const keys of [down.right, down.left]) {
      handKeys = Math.max(handKeys, keys.size);
      if (keys.size > 1) span = Math.max(span, Math.max(...keys) - Math.min(...keys));
    }
    for (let k = i; k < j; k++) held.push(sorted[k]);
    i = j;
  }
  const playing = Math.max(1, song.end - song.start);
  return {
    seconds,
    hands: new Set(notes.map(n => n.hand)).size === 1 ? 1 : 2,
    keysMax,
    keysAvg: round1(sum / moments),
    handKeys,
    span,
    notesPerSecond: round1(notes.length / playing),
    outside,
  };
}

const round1 = x => Math.round(x * 10) / 10;

// The level and speed a player starts at, and how fast a song may be before it starts slower
// (notes a second at 100 %). Просунутий and Новачок are the experienced and the beginner's starts
// as they were; Середній plays Просунутий's notes at 90 %, slower from 5 notes a second (4,5 played
// a second, between Новачок's 2,25 and Просунутий's 7).
const PLAN = {
  advanced: { level: 3, speed: 1, slower: [[7, 0.75], [12, 0.5]] },
  intermediate: { level: 3, speed: 0.9, slower: [[5, 0.75], [9, 0.5]] },
  novice: { level: 2, speed: 0.75, slower: [[3, 0.5]] },
};

// player id, songMetrics() -> {level, speed}. A song that already holds no more than the
// player's level allows (one hand only for level 1) starts with all its notes, as written.
export function playerDefaults(id, m) {
  const plan = PLAYER_IDS.includes(id) ? PLAN[id] : null;
  if (!plan) throw new RangeError(`player ${id}`);
  const cap = LEVELS[plan.level - 1];
  const fits = m.handKeys <= Math.min(cap.right, cap.left || cap.right) && (cap.left > 0 || m.hands === 1);
  let speed = plan.speed;
  for (const [nps, slower] of plan.slower) if (m.notesPerSecond > nps) speed = slower;
  return { level: fits ? FULL : plan.level, speed };
}

// The defaults of every player: what the catalog keeps beside each song.
export function allDefaults(m) {
  return Object.fromEntries(PLAYER_IDS.map(id => [id, playerDefaults(id, m)]));
}
