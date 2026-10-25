// What the page remembers between sessions (the last song, who plays, and for each player each
// song's level and speed, the keys' lead, the lamps of songs and warm-ups played to their end,
// whether a song starts with the warm-up and whether the guide hands show), and a difficulty estimate for one's own songs, which
// have no catalog entry (docs/piano-trainer-v2.md §3.5-§3.6, docs/piano-warmups.md §4.2). Pure,
// apart from the storage object handed in.
import { SPEEDS } from './song.js';
import { LEAD, LEAD_CHOICES, CHORD } from './scene.js';
import { DEFAULT_LEVEL, isLevel } from './levels.js';
import { PLAYER_IDS } from './metrics.js';

// The players are the three levels (metrics.js PLAYER_IDS), and their memory starts empty under a
// key of its own: what the page kept for the people who played before ('piano-library') is never
// read, written or removed.
export const STORE_KEY = 'piano-levels';
export const STORE_VERSION = 1;
export const MAX_SONGS = 500; // remembered songs (and lamps) a player; the least recently changed go first
export const DEFAULT_SPEED = 1;
// Each player's metronome and song voice are remembered too, each its switch and volume (a
// record {on, volume} under `metronome` and `voice`, kept only once chosen): the volume steps, in
// %, and what a player starts with (docs/piano-audio-design.md §6.3): both on, at 60 %.
export const VOLUMES = [30, 60, 100];
export const SOUND_PARTS = ['metronome', 'voice'];
export const DEFAULT_SOUND = { on: true, volume: 60 };

const emptyPlayer = () => ({ lead: null, warm: false, fingers: null, last: null, songs: {}, played: {}, warmups: {} });
const emptyMemory = () => ({ profile: null, last: null, profiles: {} });
const validId = id => typeof id === 'string' && PLAYER_IDS.includes(id);
const isRecord = v => !!v && typeof v === 'object' && !Array.isArray(v);
const entries = v => (isRecord(v) ? Object.entries(v).slice(-MAX_SONGS) : []);

// One player's stored record -> its checked fields; what is wrong is dropped, the rest kept.
function readPlayer(v) {
  const p = emptyPlayer();
  if (!isRecord(v)) return p;
  if (LEAD_CHOICES.includes(v.lead)) p.lead = v.lead;
  if (typeof v.warm === 'boolean') p.warm = v.warm;
  if (typeof v.fingers === 'boolean') p.fingers = v.fingers;
  if (validFile(v.last)) p.last = v.last;
  for (const part of SOUND_PARTS) {
    const r = v[part];
    if (!isRecord(r)) continue;
    const kept = {};
    if (typeof r.on === 'boolean') kept.on = r.on;
    if (VOLUMES.includes(r.volume)) kept.volume = r.volume;
    if (Object.keys(kept).length) p[part] = kept;
  }
  // whether the waterfall shows its bar lines (barlines.js): kept once the player chose
  if (typeof v.barLines === 'boolean') p.barLines = v.barLines;
  for (const [file, s] of entries(v.songs)) {
    if (!validFile(file) || !isRecord(s)) continue;
    const entry = {};
    if (isLevel(s.level)) entry.level = s.level;
    if (SPEEDS.includes(s.speed)) entry.speed = s.speed;
    if (Object.keys(entry).length) p.songs[file] = entry;
  }
  for (const [file, speed] of entries(v.played)) if (validFile(file) && SPEEDS.includes(speed)) p.played[file] = speed;
  for (const [file, speeds] of entries(v.warmups)) {
    if (!validFile(file) || !Array.isArray(speeds)) continue;
    const kept = SPEEDS.filter(x => speeds.includes(x));
    if (kept.length) p.warmups[file] = kept;
  }
  return p;
}

// The stored text -> {profile, last, profiles: {id: {lead, warm, fingers, last, songs: {file: {level, speed}},
// played: {file: speed}, warmups: {file: [speeds]}}}}. Each field is checked on its own: what is
// wrong is dropped and the rest is kept; a player id is one of metrics.js PLAYER_IDS, any other is
// dropped.
export function readMemory(text) {
  const mem = emptyMemory();
  let v;
  try { v = JSON.parse(text); } catch { return mem; }
  if (!isRecord(v) || v.version !== STORE_VERSION) return mem;
  if (validFile(v.last)) mem.last = v.last;
  if (validId(v.profile)) mem.profile = v.profile;
  if (isRecord(v.profiles)) for (const [id, record] of Object.entries(v.profiles)) if (validId(id)) mem.profiles[id] = readPlayer(record);
  return mem;
}

// A song's file name as the server lists them: a MIDI file, no folder. This also keeps names
// such as __proto__ out of the record's object.
const validFile = f => typeof f === 'string' && f.length <= 255 && /\.midi?$/i.test(f) && !/[/\\\0]/.test(f) && !f.startsWith('.');

export function writeMemory(mem) {
  return JSON.stringify({ version: STORE_VERSION, profile: mem.profile, last: mem.last, profiles: mem.profiles });
}

// Moves `key` to the end of `map` with `value` and drops the oldest past MAX_SONGS.
function touch(map, key, value) {
  delete map[key];
  map[key] = value;
  const keys = Object.keys(map);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SONGS))) delete map[k];
}

// What the page remembers, read once and written on every change. storage: localStorage or a
// stand-in with getItem/setItem; a storage that throws (blocked, full) leaves memory for the
// session. Every per-player call names the player (metrics.js PLAYER_IDS); a record is made for a
// player the first time something of theirs is kept; any other id does nothing.
export class SongMemory {
  constructor(storage) {
    this.storage = storage;
    let text = null;
    try { text = storage ? storage.getItem(STORE_KEY) : null; } catch { /* blocked */ }
    this.mem = readMemory(text);
    this.revision = 0; // counts the changes kept, for what is worked out from the memory (App.homeState)
  }

  get last() { return this.mem.last; }
  // who played last, or null before anyone was chosen
  get profile() { return this.mem.profile; }
  player(id) { return validId(id) && Object.hasOwn(this.mem.profiles, id) ? this.mem.profiles[id] : null; }

  // The player's record, made when there is none yet.
  own(id) {
    if (!validId(id)) return null;
    if (!Object.hasOwn(this.mem.profiles, id)) this.mem.profiles[id] = emptyPlayer();
    return this.mem.profiles[id];
  }

  setProfile(id) {
    if (!validId(id)) return;
    this.mem.profile = id;
    this.save();
  }

  // The lead the player set, else `fallback` (the player's: profiles.js PLAYERS).
  lead(id, fallback = LEAD) { const p = this.player(id); return p && p.lead !== null ? p.lead : fallback; }

  setLead(id, lead) {
    const p = this.own(id);
    if (!p || !LEAD_CHOICES.includes(lead)) return;
    p.lead = lead;
    this.save();
  }

  // The metronome and the song voice for the player: {metronome: {on, volume}, voice: {on,
  // volume}}, what they chose, else DEFAULT_SOUND.
  sound(id) {
    const p = this.player(id);
    return Object.fromEntries(SOUND_PARTS.map(part => [part, { ...DEFAULT_SOUND, ...(p && p[part]) }]));
  }

  // Switches one of them (part: 'metronome' or 'voice') or sets its volume: change {on, volume}.
  setSound(id, part, { on, volume } = {}) {
    const p = this.own(id);
    if (!p || !SOUND_PARTS.includes(part)) return;
    const r = { ...DEFAULT_SOUND, ...p[part] };
    if (typeof on === 'boolean') r.on = on;
    if (VOLUMES.includes(volume)) r.volume = volume;
    p[part] = r;
    this.save();
  }

  // Whether the waterfall shows bar and beat lines and the chord links for the player
  // (barlines.js, «Лінії тактів»): what they chose, else on.
  barLines(id) { const p = this.player(id); return !(p && p.barLines === false); }

  setBarLines(id, on) {
    const p = this.own(id);
    if (!p) return;
    p.barLines = !!on;
    this.save();
  }

  // {level, speed} of a song for a player: what it remembers, else `defaults` (profiles.js
  // songDefaults).
  song(id, file, defaults = { level: DEFAULT_LEVEL, speed: DEFAULT_SPEED }) {
    const p = this.player(id);
    const s = p && Object.hasOwn(p.songs, file) ? p.songs[file] : {};
    return { level: s.level ?? defaults.level, speed: s.speed ?? defaults.speed };
  }

  // Remembers a player's level or speed of a song (and the song as the last one), most recent last.
  setSong(id, file, { level, speed } = {}) {
    const p = this.own(id);
    if (!p || !validFile(file)) return;
    const s = { ...(Object.hasOwn(p.songs, file) ? p.songs[file] : {}) };
    if (level !== undefined && isLevel(level)) s.level = level;
    if (speed !== undefined && SPEEDS.includes(speed)) s.speed = speed;
    touch(p.songs, file, s);
    p.last = file;
    this.mem.last = file;
    this.save();
  }

  // The song the player chose last («Продовжити» on their home), or null.
  lastSong(id) { const p = this.player(id); return p ? p.last : null; }

  // A song's lamp: the fastest speed the player played it to its end at, or null.
  played(id) { const p = this.player(id); return p ? p.played : {}; }

  setPlayed(id, file, speed) {
    const p = this.own(id);
    if (!p || !validFile(file) || !SPEEDS.includes(speed)) return;
    const was = Object.hasOwn(p.played, file) ? p.played[file] : 0;
    if (speed <= was) return;
    touch(p.played, file, speed);
    this.save();
  }

  // A warm-up's lamps: the speeds of its passes the player played to their end.
  lamps(id, file) {
    const p = this.player(id);
    return p && Object.hasOwn(p.warmups, file) ? p.warmups[file] : [];
  }

  setLamp(id, file, speed) {
    const p = this.own(id);
    if (!p || !validFile(file) || !SPEEDS.includes(speed)) return;
    const was = Object.hasOwn(p.warmups, file) ? p.warmups[file] : [];
    if (was.includes(speed)) return;
    touch(p.warmups, file, SPEEDS.filter(x => x === speed || was.includes(x)));
    this.save();
  }

  // Whether a song chosen on the grid starts with the player's warm-up.
  warm(id) { const p = this.player(id); return !!(p && p.warm); }

  setWarm(id, on) {
    const p = this.own(id);
    if (!p) return;
    p.warm = !!on;
    this.save();
  }

  // Whether the guide hands and finger numbers show for the player (docs/piano-fingering-design.md
  // §5): what they chose, else on.
  fingers(id) { const p = this.player(id); return !(p && p.fingers === false); }

  setFingers(id, on) {
    const p = this.own(id);
    if (!p) return;
    p.fingers = !!on;
    this.save();
  }

  // Songs no longer in the list are forgotten (the list is the bound), the last one too; with
  // `warmups`, the lamps of warm-ups no longer listed.
  prune(files, warmups = null) {
    const keep = new Set(files), keepWarm = warmups && new Set(warmups);
    let changed = false;
    for (const p of Object.values(this.mem.profiles)) {
      for (const map of [p.songs, p.played]) for (const f of Object.keys(map)) if (!keep.has(f)) { delete map[f]; changed = true; }
      if (keepWarm) for (const f of Object.keys(p.warmups)) if (!keepWarm.has(f)) { delete p.warmups[f]; changed = true; }
      if (p.last !== null && !keep.has(p.last)) { p.last = null; changed = true; }
    }
    if (this.mem.last !== null && !keep.has(this.mem.last)) { this.mem.last = null; changed = true; }
    if (changed) this.save();
  }

  save() {
    this.revision++;
    try { if (this.storage) this.storage.setItem(STORE_KEY, writeMemory(this.mem)); } catch { /* blocked or full */ }
  }
}

// An estimated difficulty 1-5 from all notes of a song (prepareSong), for a song with no catalog
// entry: moments (notes of both hands within CHORD of the first) per second of play, the densest
// ten seconds, and notes per moment. The tempo in a played-in file is the real one, so the
// estimate means something there; a bundled song keeps its catalog value.
export const ESTIMATE_BOUNDS = [2.5, 4, 5.5, 7];
export const PEAK_WINDOW = 10;

export function estimateScore(song) {
  const starts = song.notes.map(n => n.start).sort((a, b) => a - b);
  if (!starts.length) return 0;
  const moments = [];
  let first = -Infinity;
  for (const s of starts) {
    if (s - first > CHORD) { moments.push({ time: s, notes: 0 }); first = s; }
    moments[moments.length - 1].notes++;
  }
  const playing = Math.max(1, song.end - song.start);
  const rate = moments.length / playing;
  const window = Math.min(PEAK_WINDOW, playing);
  let most = 0;
  for (let i = 0, j = 0; i < moments.length; i++) {
    while (moments[i].time - moments[j].time >= window) j++;
    most = Math.max(most, i - j + 1);
  }
  const peak = most / window;
  const chord = starts.length / moments.length;
  return Math.sqrt(rate * peak) * (1 + 0.35 * (chord - 1));
}

export function estimateDifficulty(song) {
  const score = estimateScore(song);
  return 1 + ESTIMATE_BOUNDS.filter(b => score >= b).length;
}
