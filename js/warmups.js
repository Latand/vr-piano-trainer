// The warm-ups before a song (docs/piano-warmups.md): which ones a player plays, in what order,
// and in which key. piano/songs/warmups/catalog.json lists them; each has a group (one kind of
// exercise), and a group written in several keys is played in the key that fits the song that
// follows. Pure.
import { PLAYER_IDS } from './metrics.js';
import { FULL } from './levels.js';

export const KIND = 'warmup';
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'C', 'F#', 'Bb' -> 0..11
export function tonicClass(key) {
  const m = /^([A-G])(#|b)?$/.exec(key);
  if (!m) throw new RangeError(`key ${key}`);
  return (PITCH[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
}

// A warm-up is played as written, by every player: every note, at the tempo written for it. The
// levels that thin a song out would take away what the exercise trains (the fifth of the drop,
// the chord at the end).
export function warmupDefaults() {
  return Object.fromEntries(PLAYER_IDS.map(id => [id, { level: FULL, speed: 1 }]));
}

// key ('C'), prepareSong() -> the share of the song's sounding time on the notes of that major
// scale, 0..1 to 0.01; null for a song without notes.
export function keyFit(key, song) {
  const tonic = tonicClass(key);
  const scale = new Set(MAJOR.map(d => (tonic + d) % 12));
  let inside = 0, total = 0;
  for (const n of song.notes) {
    const length = Math.max(0, n.end - n.start);
    total += length;
    if (scale.has(((n.midi % 12) + 12) % 12)) inside += length;
  }
  return total > 0 ? Math.round((inside / total) * 100) / 100 : null;
}

// The pitch class of the lowest note sounding at the song's last onset: where a tune usually
// comes home. null without notes.
export function finalClass(song) {
  if (!song.notes.length) return null;
  const last = Math.max(...song.notes.map(n => n.start));
  const low = Math.min(...song.notes.filter(n => n.start === last || (n.start < last && n.end > last)).map(n => n.midi));
  return ((low % 12) + 12) % 12;
}

// warmups: catalog entries; groups: the player's (profiles.js PLAYERS); song: prepareSong() of
// the song that follows, or null. -> the warm-ups of those groups to play, one a group, in catalog
// order. From a group written in several keys: the key with the best keyFit; at a tie the one
// whose tonic the song ends on; then the first listed. Without a song, the first listed of each
// group.
export function warmupPlan(warmups, groups, song = null) {
  const mine = warmups.filter(w => w.kind === KIND && groups.includes(w.group));
  const byGroup = new Map();
  for (const w of mine) {
    if (!byGroup.has(w.group)) byGroup.set(w.group, []);
    byGroup.get(w.group).push(w);
  }
  const home = song ? finalClass(song) : null;
  return [...byGroup.values()].map(options => {
    if (!song || options.length === 1) return options[0];
    const scored = options.map((w, i) => ({ w, i, fit: keyFit(w.key, song) ?? 0, home: tonicClass(w.key) === home ? 1 : 0 }));
    scored.sort((a, b) => b.fit - a.fit || b.home - a.home || a.i - b.i);
    return scored[0].w;
  });
}

// How long a plan takes to play: every warm-up once at each speed of its passes, in seconds.
export function planSeconds(plan) {
  return Math.round(plan.reduce((sum, w) => sum + (w.passes || [1]).reduce((t, speed) => t + w.seconds / speed, 0), 0));
}
