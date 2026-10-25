// Who plays, and what the trainer offers them (docs/piano-warmups.md §4.2): the players, the
// songs each sees and in what order, the level and speed a song starts at for each, and a warm-up
// session (the player's warm-ups, then the song) step by step. Pure: no layout, no drawing
// (panel.js draws it; docs/piano-warmups.md §5 is the contract between the two).
import { PLAYER_IDS, playerDefaults } from './metrics.js';
import { DEFAULT_LEVEL, isLevel } from './levels.js';
import { SPEEDS } from './song.js';
import { warmupPlan, planSeconds } from './warmups.js';

// The players are three levels of play, no one's name, in the order «Хто грає?» lists them
// (metrics.js PLAYER_IDS). id: the key of their memory (library.js) and of the catalog's
// defaults; name: what the panel calls them; songs: the catalog audiences whose songs they see
// (Новачок the child songs too, the easiest there are); warmups: the warm-up groups they play
// before a song (warmups.js warmupPlan); hands: what the keys show at first; lead: how early a key
// starts to light (scene.js LEAD_CHOICES); hint: the start the catalog gives a song (metrics.js
// playerDefaults, checked by tests/profiles.test.mjs): the level, «+» when a song that already
// holds no more than that level starts with all its notes, and the speed.
export const PLAYERS = Object.freeze([
  { id: 'advanced', name: 'Просунутий', songs: ['досвідчений'], warmups: ['hanon-1', 'hanon-2', 'scale-arpeggio'],
    hands: 'both', lead: 1.5, hint: 'рівень 3+ · 100 %' },
  { id: 'intermediate', name: 'Середній', songs: ['початківець', 'досвідчений'], warmups: ['five-finger', 'hanon-1', 'scale-arpeggio'],
    hands: 'both', lead: 2, hint: 'рівень 3+ · 90 %' },
  { id: 'novice', name: 'Новачок', songs: ['дитина', 'початківець'], warmups: ['drop-roll', 'five-finger', 'scale'],
    hands: 'both', lead: 2, hint: 'рівень 2+ · 75 %' },
].map(p => Object.freeze({ ...p, songs: Object.freeze(p.songs), warmups: Object.freeze(p.warmups) })));

// The player `id`, or the first.
export function playerOf(id) {
  return PLAYERS.find(p => p.id === id) || PLAYERS[0];
}

// The level and speed a song starts at for a player: the catalog's (a bundled song), else
// worked out from the song's metrics (one's own, once read), else the trainer's usual start.
export function songDefaults(entry, playerId, metrics = null) {
  const d = entry && entry.defaults && PLAYER_IDS.includes(playerId) ? entry.defaults[playerId] : null;
  if (d && isLevel(d.level) && SPEEDS.includes(d.speed)) return { level: d.level, speed: d.speed };
  if (metrics && PLAYER_IDS.includes(playerId)) return playerDefaults(playerId, metrics);
  return { level: DEFAULT_LEVEL, speed: 1 };
}

// A song's difficulty 1-5 and its keys at once: the catalog's, else (one's own) what the page
// worked out from its notes so far (estimates: file -> {seconds, estimate, metrics}), else null.
const known = (entry, estimates) => (estimates && estimates.get(entry.file)) || null;
export function difficultyOf(entry, estimates) {
  if (Number.isInteger(entry.difficulty)) return entry.difficulty;
  const k = known(entry, estimates);
  return k && Number.isInteger(k.estimate) ? k.estimate : null;
}
export function keysOf(entry, estimates) {
  if (entry.metrics && Number.isInteger(entry.metrics.keysMax)) return entry.metrics.keysMax;
  const k = known(entry, estimates);
  return k && k.metrics && Number.isInteger(k.metrics.keysMax) ? k.metrics.keysMax : null;
}
function secondsOf(entry, estimates) {
  if (Number.isInteger(entry.seconds)) return entry.seconds;
  const k = known(entry, estimates);
  return k && Number.isFinite(k.seconds) ? Math.round(k.seconds) : null;
}

const collator = new Intl.Collator('uk');
// For the tests: how many times profileSongs sorted the songs, and blockSongs or playerCounts went
// through them (App asks for its order, a block, the home and the players once per change of what
// they are made of, never a frame).
export const work = { sorts: 0, filters: 0 };

// songs: /songs/index.json entries; profile: a player (playerOf); filter: 'all', a difficulty 1-5 or
// 'own'. -> the indices into `songs` the profile's grid shows, in order: one's own songs first, by
// title (they stand still while their estimates come in), then the songs of the profile's
// audiences from the easiest: by difficulty, keys at once, notes a second, length, title.
export function profileSongs(songs, profile, { filter = 'all', estimates = null } = {}) {
  work.sorts++;
  const own = [], mine = [];
  songs.forEach((s, index) => {
    if (s.own) own.push(index);
    else if (profile.songs.includes(s.audience)) mine.push(index);
  });
  own.sort((a, b) => collator.compare(songs[a].title || songs[a].file, songs[b].title || songs[b].file) || a - b);
  const key = s => [s.difficulty ?? 9, s.metrics ? s.metrics.keysMax : 99, s.metrics ? s.metrics.notesPerSecond : 99, s.seconds ?? 1e9];
  mine.sort((a, b) => {
    const ka = key(songs[a]), kb = key(songs[b]);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return collator.compare(songs[a].title || '', songs[b].title || '') || a - b;
  });
  if (filter === 'own') return own;
  const all = [...own, ...mine];
  if (filter === 'all') return all;
  return all.filter(i => difficultyOf(songs[i], estimates) === filter);
}

// The filters the «Складність» button steps through for a profile: all, each difficulty its songs
// have (one's own by their estimate), then one's own songs alone. A single difficulty and no
// songs of one's own leave nothing to filter: ['all'].
export function profileFilters(songs, profile, estimates = null) {
  const all = profileSongs(songs, profile, { estimates });
  const levels = [...new Set(all.map(i => difficultyOf(songs[i], estimates)).filter(d => d !== null))].sort((a, b) => a - b);
  const own = all.some(i => songs[i].own);
  if (levels.length <= 1 && !own) return ['all'];
  return ['all', ...(levels.length > 1 ? levels : []), ...(own ? ['own'] : [])];
}

// The blocks of a player's home (docs/trainer-ui-brief.md §3.4 S2): the catalog's difficulties
// 1-5 that their songs have, then «Мої» (one's own songs, by their block only). order:
// profileSongs(songs, profile) unfiltered (no sorting here: App keeps that order).
export const BLOCKS = [1, 2, 3, 4, 5, 'own'];
export function blockSongs(songs, order, profile, block, estimates = null) {
  work.filters++;
  if (block === 'own') return order.filter(i => songs[i].own);
  if (!BLOCKS.includes(block)) return order;
  return order.filter(i => !songs[i].own && difficultyOf(songs[i], estimates) === block);
}
// The block a song stands in: its difficulty, «own», or 'all' for a song without one.
export const songBlock = entry => (entry.own ? 'own' : Number.isInteger(entry.difficulty) ? entry.difficulty : 'all');
// -> [{block, n, k}]: each block with songs, how many and how many the player played to the end
// (played: file -> speed, SongMemory.played).
export function profileBlocks(songs, order, profile, played = {}) {
  const out = [];
  for (const block of BLOCKS) {
    const list = blockSongs(songs, order, profile, block);
    if (list.length) out.push({ block, n: list.length, k: list.filter(i => Number.isFinite(played[songs[i].file])).length });
  }
  return out;
}
// A player's card on «Хто грає?»: how many of the songs for them they played to the end, of how
// many (one's own not counted). No sorting: the page is drawn every frame.
export function playerCounts(songs, profile, played = {}) {
  work.filters++;
  const mine = songs.filter(s => !s.own && profile.songs.includes(s.audience));
  return { played: mine.filter(s => Number.isFinite(played[s.file])).length, total: mine.length };
}

// A warm-up's group by a word or two, for the way through the warm-ups on a song's page.
const WARMUP_SHORT = { 'drop-roll': 'Опустити', 'five-finger': 'П’ять пальців', scale: 'Гама', 'hanon-1': 'Ганон 1', 'hanon-2': 'Ганон 2',
  'scale-arpeggio': 'Гама й арпеджіо' };
export const warmupShort = w => WARMUP_SHORT[w.group] || String(w.title || w.file).split(' (')[0];
export function warmupPath(warmups, profile) {
  return warmupPlan(warmups, profile.warmups, null).map(warmupShort);
}

// One page of the songs, `size` a page (the layout's: panel.js CARDS). order: profileSongs;
// current: the file playing; played: file -> the fastest speed the profile played it to its end
// at (its lamp). -> {page, pages, cards: [{index, file, title, composer, own, difficulty,
// seconds, keys, played, current}]}; page clamped.
export function gridPage(songs, order, page, { size, current = null, played = null, estimates = null } = {}) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`page size ${size}`);
  const pages = Math.max(1, Math.ceil(order.length / size));
  const p = Math.max(0, Math.min(pages - 1, Number.isInteger(page) ? page : 0));
  const cards = order.slice(p * size, (p + 1) * size).map(index => {
    const s = songs[index];
    return {
      index, file: s.file, title: s.title || s.file, composer: s.composer || '', own: !!s.own,
      difficulty: difficultyOf(s, estimates), seconds: secondsOf(s, estimates), keys: keysOf(s, estimates),
      played: played && Number.isFinite(played[s.file]) ? played[s.file] : null, current: s.file === current,
    };
  });
  return { page: p, pages, cards };
}

// The page (`size` songs a page) that holds song `index`, or 0.
export function gridPageOf(order, index, size) {
  const at = order.indexOf(index);
  return at < 0 ? 0 : Math.floor(at / size);
}

// How long a profile's warm-up takes to play, in whole minutes (at least 1), or null without one.
export function warmupMinutes(warmups, profile) {
  const plan = warmupPlan(warmups, profile.warmups, null);
  return plan.length ? Math.max(1, Math.round(planSeconds(plan) / 60)) : null;
}

// How many warm-up steps a profile's session has (each warm-up once at every speed of its passes):
// the M of the session's «Вправа N з M», which the home's «Розігрів» shows before it starts.
export function warmupSteps(warmups, profile) {
  return sessionSteps(warmupPlan(warmups, profile.warmups, null), { index: 0, title: '' }).length - 1;
}

// The steps of a session: each warm-up of the plan once at every speed of its passes, then the
// song. plan: warmupPlan(); song: {index, title}.
export function sessionSteps(plan, song) {
  const steps = [];
  for (const w of plan) for (const speed of w.passes && w.passes.length ? w.passes : [1]) steps.push({ kind: 'warmup', entry: w, speed });
  steps.push({ kind: 'song', index: song.index, title: song.title });
  return steps;
}

// «Спершу розігрів, потім пісня»: where the session stands. It opens on the warm-up without keys
// (intro) until «Готово»; then phase 'ready' shows the next step's card and 'play' plays step
// `at`. results: per step 'done' (it ran to its end), 'skipped' or null. The song step ends the
// session: the app loads the song.
export class Session {
  constructor(steps) {
    this.steps = steps;
    this.at = 0;
    this.phase = 'ready';
    this.results = steps.map(() => null);
    this.last = null; // the step finished or skipped last, for the next card's first line
    this.intro = true;
    this.problem = ''; // why the step before did not play (a file that did not read), until the next one starts
  }

  // «Готово» after the warm-up without keys: the first step's card.
  ready() { this.intro = false; }

  get step() { return this.steps[this.at]; }
  get warmups() { return this.steps.filter(s => s.kind === 'warmup').length; }
  get onSong() { return this.step.kind === 'song'; }

  // «Почати»: plays the step (the app loads it). -> the step.
  begin() {
    this.intro = false;
    this.problem = '';
    this.phase = 'play';
    return this.step;
  }

  // The step played to its end: done, and the next one's card.
  finish() {
    if (this.phase !== 'play' || this.onSong) return;
    this.results[this.at] = 'done';
    this.last = this.at;
    this.at++;
    this.phase = 'ready';
  }

  // «Пропустити»: the step (playing or next) is left out; one played to its end before stays done.
  skip() {
    if (this.onSong) return;
    this.intro = false;
    if (this.results[this.at] !== 'done') this.results[this.at] = 'skipped';
    this.last = this.at;
    this.at++;
    this.phase = 'ready';
  }

  // «Повторити»: on a card, the step before it plays again; while playing, the app restarts it.
  // -> the step to play, or null when there is none before.
  repeat() {
    if (this.phase === 'play') return this.step;
    if (this.at === 0) return null;
    this.at--;
    this.phase = 'play';
    return this.step;
  }

  // Each step's mark for the panel's dots: done, skipped, now (the one playing or next) or ahead.
  marks() {
    return this.steps.map((s, i) => (i === this.at ? 'now' : this.results[i] || 'ahead'));
  }
}

// A session for `profile` before song `index` of `songs`: its warm-ups in the song's keys
// (warmupPlan). prepared: prepareSong() of the song, or null.
export function makeSession(warmups, profile, songs, index, prepared) {
  const plan = warmupPlan(warmups, profile.warmups, prepared);
  const s = songs[index];
  return new Session(sessionSteps(plan, { index, title: (s && (s.title || s.file)) || '' }));
}
