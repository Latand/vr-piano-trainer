// The trainer: songs, the clock, panel commands, and the desktop preview.
// URL parameters (the preview and screenshots): song=<file>, t=<song seconds> (frozen),
// speed=10|25|50|75|90|100, hands=both|right|left, loop=<a>,<b>, view=front|seat, cal=low|high
// (calibrating, at that step), input=hands|controllers|mixed|none (what the headset would see),
// lead=<seconds> (how long a key builds up before its note, LEAD_RANGE), level=1..5,
// tab=who|home|songs|song|level|tempo|calibration (a page of the panel; song: the song loaded, on
// its own page), adjust=1 («Підлаштувати»), page=N (of the
// grid), profile=advanced|intermediate|novice (who plays), warm=1|0 (the warm-up before a song
// on or off), filter=all|1..5|own (the block the grid shows), place=lost|far|none (the desktop
// preview: no keyboard placed, and why), hover=<target> (the desktop preview: a ray's cursor on a
// target), session=N (a warm-up session before the song, at step N's card; intro=1 at the warm-up
// without keys before it; with tab=warmup step N playing, t its time), fingers=1|0 (the
// guide hands and finger numbers on or off).
// The page opens where the address says; else a song or a moment asked for (song=, t=) opens
// playing; else the home of the player who played last, or «Хто грає?» before anyone has.
// The address wins over what the page remembers (library.js) and is not remembered itself.
// barlines=1|0: the waterfall's bar lines (barlines.js) on or off.
import { parseSmf, SmfError } from './smf.js';
import { prepareSong, Transport, SPEEDS } from './song.js';
import { frameAt, parseLead, HAND_FILTERS, WATERFALL_Z, LEAD_CHOICES, formatTime, handsAt } from './scene.js';
import { readStored, fingerSong, levelFingering, guidedSong, modelFor } from './fingering.js';
import { songAtLevel, LEVELS, DEFAULT_LEVEL, FULL, isLevel } from './levels.js';
import { SongMemory, estimateDifficulty, VOLUMES } from './library.js';
import { songMetrics } from './metrics.js';
import { PLAYERS, playerOf, songDefaults, profileSongs, gridPage, gridPageOf,
  warmupMinutes, makeSession, blockSongs, songBlock, profileBlocks, playerCounts, warmupPath, warmupSteps, keysOf, BLOCKS } from './profiles.js';
import { metronomeLines } from './tempo.js';
import { Sound } from './audio.js';
import { voiceNotes } from './schedule.js';
import { SongGrab, scrubTime, pointerRay, rayWaterfall, WHEEL_REST, WHEEL_LINE } from './scrub.js';
import { linesAt, buildBarLines, digitAtlas, clickGrid, countInBar } from './barlines.js';
import { WHITE_PITCH, WHITE_COUNT, WHITE_LEN, keyCentre, LOW, HIGH } from './geometry.js';
import { Renderer, Batch, FloatBatch } from './render.js';
import { buildOverlay, buildFakeKeyboard, fakeBody, buildCalibrationMarks, buildPanelBar, buildPanelAim, buildRays, buildHandles, letterAtlas, fingerAtlas } from './overlay.js';
import { renderPanel, drawSign, panelHeight, panelInKeyboard, signCorners, pageLayout, WIDTH as PANEL_W, PX_PER_M, SIGN_W, SIGN_H, BODY_TEXT, label,
  buttonCommand, CARDS, layout, plural } from './panel.js';
import { FONTS, fontsChanged, blockName } from './studio.js';
import { identity, multiply, perspective, lookAt, transformPoint } from './mat.js';
import { startXR, xrSupported } from './xr.js';
import { rectOf, handlesOf } from './place.js';
import { guideLines, statusLine, songLines, lineText } from './guide.js';
import { BackToScreens, askPc, WAITING, hasPc, HOST_NOTE } from './screens.js';

const params = new URLSearchParams(location.search);

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: true, xrCompatible: true });
    if (!this.gl) throw new Error('WebGL2 недоступний');
    this.renderer = new Renderer(this.gl);
    this.letters = this.renderer.texture(letterAtlas());
    this.fingerTex = this.renderer.texture(fingerAtlas()); // the finger digits (again once the panel's fonts are in)
    this.panelCanvas = document.createElement('canvas');
    this.panelTex = null;
    this.panelKey = '';
    this.signCanvas = document.createElement('canvas');
    this.signTex = null;
    this.signKey = '';
    this.batches = { fake: new Batch(), keys: new Batch(), bars: new Batch(), labels: new Batch(), panel: new Batch(), sign: new Batch(), panelBar: new Batch(),
      aim: new Batch(), marks: new Batch(), keep: new FloatBatch(), hands: new FloatBatch(), palms: new FloatBatch(), fingers: new FloatBatch() };
    this.songs = [];
    this.warmups = []; // /warmups/index.json: the warm-ups before a song
    this.songIndex = 0; // the last song loaded from the list (this.song, unless a warm-up plays)
    this.entry = null; // what this.song was loaded from: a song's or a warm-up's entry
    this.session = null; // «Спершу розігрів, потім пісня» (profiles.js Session)
    this.sessionTicket = 0; // the latest card pressed for a session; an older one that answers later is dropped
    this.sessionFrom = 'songs'; // the page a session was started from, to go back to: the grid or the home
    this.endSeen = false; // the clock reached the end, already counted (a lamp, a warm-up's step)
    this.panelReturn = null; // the page to go back to after calibrating or «Підлаштувати»
    // the page «Клавіатура» was opened from, to go back to (keyboardBack); null: playing
    this.keyboardFrom = null;
    this.stepFrom = null; // the song asked for last, loading or failed: ◀ ▶ go on from it
    this.song = null;
    this.transport = null;
    this.hands = HAND_FILTERS.includes(params.get('hands')) ? params.get('hands') : 'both';
    // The panel's page (panel.js LAYOUTS): who, home, songs (a block), song,
    // session, warmup, play, a page of playing (level, tempo, calibration), adjust or calibrate.
    this.panelMode = 'play';
    this.asked = false; // the address chose the opening page
    this.previewStep = ['low', 'high'].includes(params.get('cal')) ? params.get('cal') : null;
    this.previewInput = ['hands', 'controllers', 'mixed', 'none'].includes(params.get('input')) ? params.get('input') : null;
    this.previewAdjust = params.get('adjust') === '1' && !this.previewStep;
    if (this.previewStep) this.panelMode = 'calibrate';
    else if (this.previewAdjust) this.panelMode = 'adjust';
    else if (PAGES.includes(params.get('tab')) || ['who', 'home', 'song'].includes(params.get('tab'))) this.panelMode = params.get('tab');
    this.asked = this.panelMode !== 'play' || params.get('tab') === 'play';
    let storage = null;
    try { storage = globalThis.localStorage || null; } catch { /* blocked */ }
    this.memory = new SongMemory(storage);
    // Who plays: the address's (not remembered), else the one who played last, else the first
    // player until someone is chosen on «Хто грає?». The players are the three levels
    // (profiles.js PLAYERS), the same on every PC.
    this.players = PLAYERS;
    this.previewProfile = this.players.some(p => p.id === params.get('profile')) ? params.get('profile') : null;
    this.profileId = this.previewProfile || this.memory.profile || this.players[0].id;
    this.previewWarm = params.has('warm') ? params.get('warm') === '1' : null;
    // the guide hands (docs/piano-fingering-design.md §5): the address's, else the player's
    this.previewFingers = params.has('fingers') ? params.get('fingers') === '1' : null;
    this.fingerSeen = null; // the song whose «Без пальців» strip «Грати» put away
    this.fingerDetail = ''; // why a song's stored fingering was not used, for the page's status line
    this.fingerJobs = new Map(); // id -> {song, model}: fingerings being worked out
    this.fingerJob = 0;
    this.worker = undefined; // the fingering Worker, null where it cannot start
    this.guideDrawn = false; // the guide's batches were filled this frame (items)
    // the block the grid shows (profiles.js BLOCKS, or 'all')
    const filter = params.get('filter');
    this.filter = filter === 'own' ? 'own' : /^[1-5]$/.test(filter || '') ? Number(filter) : 'all';
    this.pick = null; // the song open on its own page (an index into this.songs)
    this.pickProblem = ''; // why «Грати» on it did not start it
    this.panelButtons = null; // the targets of the panel as last drawn (panel.js renderPanel)
    this.fontsReady = false; // the panel's fonts came in (studio.js FONTS)
    this.previewPlace = ['lost', 'far', 'none'].includes(params.get('place')) ? params.get('place') : null;
    this.previewHover = params.get('hover') || null;
    this.level = DEFAULT_LEVEL;
    this.listPage = Number.isInteger(Number(params.get('page'))) && params.has('page') ? Math.max(0, Number(params.get('page'))) : null;
    this.estimates = new Map(); // own song file -> {seconds, estimate, metrics}, worked out one at a time
    this.estimating = null; // the file being worked out
    this.gridCache = null; // the grid's order, a block of it and the home, and what they were worked out from (gridLists)
    this.rowsCache = null; // the players of «Хто грає?» and what they were counted from (playerRows)
    this.loading = 0; // the latest song request; an older one that answers later is dropped
    this.message = ''; // what the panel's last line says (a song that failed, notes moved)
    this.detail = ''; // and why, for the page's status line under the desktop preview
    this.frozen = params.has('t') ? Number(params.get('t')) : null;
    this.view = params.get('view') || 'front';
    this.lead = parseLead(params.get('lead'));
    this.pressed = new Set();
    this.xr = null;
    this.listeners = new Set();
    this.simulatedRoom = null; // a test sets this to draw a keyboard into the headset's view
    this.panelText = 0; // the desktop preview: the panel's body text on screen, CSS pixels (panelTextPx)
    this.back = new BackToScreens(this); // «Назад до екранів»
    // the metronome and the song voice (docs/piano-audio-design.md): the sound, its page's way
    // back (play or warmup), the clicks of the song at its speed
    this.sound = new Sound({ settings: () => this.soundSettings(), now: () => this.now() });
    // the address's metronome=1|0 and voice=1|0 preview them on or off (not remembered); tab=sound
    // opens their page
    this.previewSound = { metronome: params.has('metronome') ? params.get('metronome') === '1' : null, voice: params.has('voice') ? params.get('voice') === '1' : null };
    this.soundFrom = 'play';
    this.clickCache = null;
    // the waterfall's bar lines (barlines.js): their batch and digits, the address's word
    this.batches.lines = new Batch();
    this.digits = this.renderer.texture(digitAtlas());
    this.previewBarLines = params.has('barlines') ? params.get('barlines') === '1' : null;
    // the song held by a scrub (scrub.js SongGrab, with `by`: xr | mouse | wheel); the desktop
    // preview's cameras as last drawn, for the mouse ({proj, view, x, w}: CSS pixels across)
    this.scrub = null;
    this.eyes = [];
  }

  now() { return performance.now() / 1000; }

  async init() {
    try {
      const res = await fetch('songs/index.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const songs = (await res.json()).songs;
      this.songs = Array.isArray(songs) ? songs.filter(s => s && typeof s.file === 'string') : [];
    } catch (e) {
      this.message = `Список пісень недоступний: ${e.message}`;
    }
    if (!params.has('lead')) this.lead = this.memory.lead(this.profileId, this.profile().lead);
    if (!HAND_FILTERS.includes(params.get('hands'))) this.hands = this.profile().hands;
    // the warm-ups: without them the grid says «немає вправ» and a song starts at once
    let warmupsRead = false;
    try {
      const res = await fetch('warmups/index.json', { cache: 'no-store' });
      if (res.ok) {
        const list = (await res.json()).warmups;
        this.warmups = Array.isArray(list) ? list.filter(w => w && typeof w.file === 'string' && w.kind === 'warmup') : [];
        warmupsRead = true;
      }
    } catch { /* none */ }
    if (this.songs.length) this.memory.prune(this.songs.map(s => s.file), warmupsRead ? this.warmups.map(w => w.file) : null);
    // one's own songs are fingered in the Worker: started now, its modules are in before one loads
    if (this.songs.some(s => s.own)) this.fingerWorker();
    const wanted = params.get('song') || this.memory.last;
    const i = wanted ? this.songs.findIndex(s => s.file === wanted || s.name === wanted) : 0;
    if (this.songs.length) await this.loadSong(Math.max(0, i), { remember: false });
    if (!this.asked) this.panelMode = params.has('song') || params.has('t') ? 'play' : this.memory.profile || this.previewProfile ? 'home' : 'who';
    if (this.panelMode === 'song') this.pick = this.songIndex;
    if (this.listPage === null) this.listPage = gridPageOf(this.gridOrder(), this.songIndex, this.cards());
    if (params.has('session') && this.songs.length) await this.previewSession(Number(params.get('session')));
    const level = Number(params.get('level'));
    if (params.has('level') && isLevel(level)) { this.level = level; this.prepareGuide(); }
    if (this.transport) {
      const speed = Number(params.get('speed')) / 100;
      if (SPEEDS.includes(speed)) this.transport.setSpeed(speed, this.now());
      const loop = (params.get('loop') || '').split(',').map(Number);
      if (loop.length === 2 && loop.every(Number.isFinite) && loop[1] > loop[0]) this.transport.loop = { a: loop[0], b: loop[1] };
      else if (loop.length === 1 && params.get('loop') && Number.isFinite(loop[0])) this.transport.loop = { a: loop[0] };
    }
    this.changed();
  }

  // Reads a song or warm-up file (base: songs or warmups). -> {song} (prepareSong), {error}, or
  // null when a newer request was made meanwhile (only the latest request installs anything).
  async readSong(base, entry) {
    const ticket = ++this.loading;
    try {
      const res = await fetch(`${base}/${encodeURIComponent(entry.file)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (ticket !== this.loading) return null;
      const read = performance.now();
      const song = prepareSong(parseSmf(bytes));
      // from the file read to each level's guide ready, and the Worker's own ms on the way (the Quest
      // proxy in tests/preview.mjs, design §2.7)
      Object.defineProperty(song, 'timing', { value: { read, worker: { full: 0, levels: {} }, guide: {} }, enumerable: false });
      const stored = await this.readFingering(base, entry);
      if (ticket !== this.loading) return null;
      return { song, stored };
    } catch (e) {
      return ticket === this.loading ? { error: e } : null;
    }
  }

  // A catalog song's or warm-up's fingering file, once its MIDI has read (one's own, or a file the
  // catalog does not list, is worked out on the page). -> the file, {missing: why}, or null.
  async readFingering(base, entry) {
    if (entry.own || !(base === 'warmups' || typeof entry.audience === 'string')) return null;
    try {
      const res = await fetch(`fingering/${base === 'warmups' ? 'warmups/' : ''}${encodeURIComponent(entry.file.replace(/\.midi?$/i, ''))}.json`, { cache: 'no-store' });
      return res.ok ? await res.json() : { missing: `HTTP ${res.status}` };
    } catch (e) {
      return { missing: e.message || String(e) };
    }
  }

  // The fingering of a song just read (docs/piano-fingering-design.md §3.6): its stored file when
  // it fits the notes, else the optimiser's, worked out in the Worker (a stored file that does
  // not fit says why on the page's status line). Kept on the song, gone with it.
  attachFingering(song, entry, stored) {
    const model = modelFor(entry);
    this.fingerDetail = '';
    if (stored && !stored.missing) {
      const r = readStored(stored, song);
      if (!r.error) {
        song.fingering = { hands: r.hands, fingers: r.fingers, pinned: r.pinned, model: r.model, unfingered: r.fingers.filter(f => f === 0).length, source: 'file' };
        return; // its guided view once its level is set (startClock)
      }
      this.fingerDetail = `Аплікатуру ${entry.file} пораховано заново: ${r.error}`;
    } else if (stored && stored.missing) this.fingerDetail = `Аплікатуру ${entry.file} пораховано заново: ${stored.missing}`;
    this.computeFingering(song, model);
  }

  // The optimiser on a song, off the frames: in the Worker, or where it cannot start, in a task
  // after this one (and the reason in the console).
  computeFingering(song, model) {
    const id = ++this.fingerJob;
    song.fingeringPending = true;
    // the job a level's fingering asks the Worker to build on, before it is in (computeLevelFingering)
    Object.defineProperty(song, 'fingeringJob', { value: { id, model }, enumerable: false, configurable: true });
    this.fingerJobs.set(id, { song, model, t0: performance.now() });
    const worker = this.fingerWorker();
    const notes = song.notes.map(({ midi, start, end, hand }) => ({ midi, start, end, hand }));
    if (worker) worker.postMessage({ id, notes, model });
    else setTimeout(() => this.fingeringHere(id), 0);
  }

  // A level's fingering (design §3.5), worked out the same way off the frames: the optimiser on the
  // level's notes, the full fingering preferred. Kept on the song by level. While the song's own
  // fingering is still in the Worker, the level is asked for at once, on that job (fullOf): the
  // Worker takes its jobs in order, so it goes on to the level without a trip through the page.
  computeLevelFingering(song, level) {
    if (!song.levelFingers) Object.defineProperty(song, 'levelFingers', { value: new Map(), enumerable: false });
    if (!song.levelPending) Object.defineProperty(song, 'levelPending', { value: new Set(), enumerable: false });
    if (song.levelFingers.has(level) || song.levelPending.has(level)) return;
    const f = song.fingering;
    const from = !f && song.fingeringPending ? song.fingeringJob : null;
    if (!f && !from) return;
    const id = ++this.fingerJob;
    song.levelPending.add(level);
    const notes = songAtLevel(song, level).notes.map(({ midi, start, end, hand }) => ({ midi, start, end, hand }));
    const full = f ? { hands: f.hands, fingers: f.fingers, pinned: f.pinned } : null;
    this.fingerJobs.set(id, { song, model: f ? f.model : from.model, level, notes, full, t0: performance.now() });
    const worker = this.fingerWorker();
    if (worker) {
      if (from) worker.postMessage({ id, level, notes, fullOf: from.id, model: from.model });
      else worker.postMessage({ id, level, notes, song: song.notes.map(({ midi, start, end, hand }) => ({ midi, start, end, hand })), full, model: f.model });
    } else setTimeout(() => this.fingeringHere(id), 0);
  }

  fingerWorker() {
    if (this.worker !== undefined) return this.worker;
    try {
      this.worker = new Worker(new URL('./fingering-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => this.fingeringDone(data.id, data);
      // a Worker that cannot run (no module workers): every job here instead
      this.worker.onerror = e => {
        console.warn('fingering worker:', e.message || e);
        this.worker = null;
        for (const id of this.fingerJobs.keys()) setTimeout(() => this.fingeringHere(id), 0);
      };
    } catch (e) {
      console.warn('fingering worker:', e.message || e);
      this.worker = null;
    }
    return this.worker;
  }

  fingeringHere(id) {
    const job = this.fingerJobs.get(id);
    if (!job) return;
    try {
      // a level asked for on the song's own job: that job ran here first (the jobs keep their order)
      const full = job.full || job.song.fingering;
      if (job.level && !full) throw new Error('no fingering of the song');
      const r = job.level ? levelFingering(job.notes, job.song, full, { model: job.model }) : fingerSong(job.song, { model: job.model });
      this.fingeringDone(id, { hands: r.hands, fingers: r.fingers, unfingered: r.unfingered, moves: r.moves });
    } catch (e) {
      this.fingeringDone(id, { error: e.message || String(e) });
    }
  }

  fingeringDone(id, data) {
    const job = this.fingerJobs.get(id);
    if (!job) return;
    this.fingerJobs.delete(id);
    const timing = job.song.timing;
    if (timing && data.ms) { if (job.level) timing.worker.levels[job.level] = data.ms; else timing.worker.full = data.ms; }
    if (job.level) {
      job.song.levelPending.delete(job.level);
      if (data.error) console.warn('fingering, level', job.level, data.error);
      // a level that failed keeps no guide (null), and is not asked for again
      job.song.levelFingers.set(job.level, data.error ? null : { hands: data.hands, fingers: data.fingers, moves: data.moves || 0 });
      // the guided view now, between frames, so the first frame that draws it does no more work
      if (job.song === this.song && job.level === this.level) this.prepareGuide();
      this.changed();
      return;
    }
    job.song.fingeringPending = false;
    if (data.error) { console.warn('fingering:', data.error); this.changed(); return; }
    // ms: from the load to the fingering in place (the Worker's own time is data.ms)
    job.song.fingering = { hands: data.hands, fingers: data.fingers, model: job.model, unfingered: data.unfingered, moves: data.moves || 0, source: 'optimiser', ms: performance.now() - job.t0 };
    this.prepareGuide();
    this.changed();
  }

  // Whether the guide hands show: the address's word, else the player's (on by default).
  guideOn() { return this.previewFingers ?? this.memory.fingers(this.profileId); }

  setFingers(on) {
    this.memory.setFingers(this.profileId, on);
    this.previewFingers = null;
    this.prepareGuide();
  }

  // The guided view of the song at its level, worked out now, between frames, when the guide shows.
  prepareGuide() { if (this.song && this.guideOn()) this.guidedView(); }

  // The song as the guide shows it at its level (design §4.7, fingering.js guidedSong): level 5 the
  // song's notes in the hands its fingering plays them with, a lower level its own notes in the
  // hands levels.js gives them; each with its finger and the hands' positions. Cached on the song,
  // one entry a level; null before the fingering is in.
  guidedView() {
    const song = this.song;
    const f = song && song.fingering;
    if (!f) {
      // one's own song still in the Worker: its level goes in behind it
      if (song && song.fingeringPending && this.level !== FULL) this.computeLevelFingering(song, this.level);
      return null;
    }
    if (!song.guided) Object.defineProperty(song, 'guided', { value: new Map(), enumerable: false });
    let view = song.guided.get(this.level);
    if (!view) {
      if (this.level === FULL) view = guidedSong(song, f.hands, f.fingers, { model: f.model, moves: f.moves || 0 });
      else {
        // worked out in the Worker: no guide until it is in
        if (!song.levelFingers || !song.levelFingers.has(this.level)) { this.computeLevelFingering(song, this.level); return null; }
        const r = song.levelFingers.get(this.level);
        if (!r) return null;
        view = guidedSong(songAtLevel(song, this.level), r.hands, r.fingers, { model: f.model, moves: r.moves });
      }
      song.guided.set(this.level, view);
      if (song.timing) song.timing.guide[this.level] = { ms: performance.now() - song.timing.read, worker: song.timing.worker.full + (song.timing.worker.levels[this.level] || 0) };
    }
    return view;
  }

  // «Без пальців» (design §4.8): with the guide on, a song with notes no hand shape covers, or that
  // a move no hand makes leads to, at the level played says so until its first «Грати», the guide
  // is put away or another song loads. -> its words or null
  fingerNotice() {
    const f = this.song && this.song.fingering;
    if (!f || !this.guideOn() || this.fingerSeen === this.song) return null;
    // the notes without a finger at the level played (a bundled song's levels 1-4 give every note
    // of theirs one)
    const view = this.guidedView();
    const n = view ? view.unfingered : 0;
    if (!n) return null;
    if (view.moves) return `Без пальців: ${n} ${plural(n, ['нота, якої', 'ноти, яких', 'нот, яких'])} рука не бере`;
    return `Без пальців: ${n} ${plural(n, ['нота ширша', 'ноти ширші', 'нот ширші'])} за руку`;
  }

  // A file that did not read: the panel names it; the reason (often long) goes to the page's
  // status line.
  failed(entry, e) {
    this.message = `Не читається: ${entry.file}`;
    this.detail = e instanceof SmfError ? e.message : e.message || String(e);
    this.changed();
  }

  // A song from the list, at the level and speed the player left it at, or else the ones the
  // catalog (one's own song: its notes) gives the player. remember: false for the song the
  // page opens with (it is the last one already, or the address chose it); play: start at once
  // (a session's song). The song index moves only once the file reads: a file that fails leaves
  // the song playing the current one, so the panel, the grid and the level and speed saved name
  // one song. -> true once it loaded, false when it did not read (or is not listed), null when a
  // newer request was made meanwhile.
  async loadSong(index, { remember = true, play = false } = {}) {
    const entry = this.songs[index];
    if (!entry) return false;
    this.stepFrom = index;
    const read = await this.readSong('songs', entry);
    if (!read) return null;
    if (read.error) { this.failed(entry, read.error); return false; }
    this.song = read.song;
    this.song.name = entry.title || entry.name || entry.file;
    this.song.file = entry.file;
    this.attachFingering(this.song, entry, read.stored);
    // its length as the grid gives it: the catalog's, else the file's in whole seconds
    this.song.seconds = Number.isInteger(entry.seconds) ? entry.seconds : Math.round(this.song.end);
    this.entry = entry;
    this.songIndex = index;
    this.stepFrom = null;
    if (entry.own && !this.estimates.has(entry.file)) this.estimates.set(entry.file, estimateOf(this.song));
    const known = this.estimates.get(entry.file);
    const saved = this.memory.song(this.profileId, entry.file, songDefaults(entry, this.profileId, entry.metrics || (known && known.metrics)));
    this.level = saved.level;
    this.startClock(saved.speed);
    if (remember) this.memory.setSong(this.profileId, entry.file, {});
    if (play) this.transport.play(this.now());
    // notes moved an octave are a fact of the song (its page says so), nothing to act on
    this.message = '';
    this.detail = '';
    this.changed();
    return true;
  }

  // A new clock for this.song at `speed`, standing at its start; its level worked out now,
  // between frames.
  startClock(speed) {
    this.transport = new Transport(this.song, this.now(), { lead: this.lead });
    this.scrub = null; // a hold of the song before goes with it
    this.transport.setCountIn(this.countIn(), this.now());
    this.transport.setSpeed(speed, this.now());
    this.endSeen = false;
    songAtLevel(this.song, this.level);
    this.prepareGuide();
  }

  // A warm-up step of the session: every note (levels.js FULL) at the pass's speed, started.
  // Its record is not the song's: nothing about it is remembered but its lamps. -> whether it
  // plays.
  async playStep() {
    const x = this.session;
    const step = x && x.step;
    if (!step || step.kind !== 'warmup') return false;
    const read = await this.readSong('warmups', step.entry);
    if (!read || this.session !== x || x.step !== step || x.phase !== 'play') return false;
    if (read.error) {
      // left out, and the card says why
      x.skip();
      this.showPage('session');
      this.failed(step.entry, read.error);
      x.problem = this.message;
      return false;
    }
    this.song = read.song;
    this.song.name = step.entry.title;
    this.song.file = step.entry.file;
    this.song.warmup = true;
    this.attachFingering(this.song, step.entry, read.stored);
    this.song.seconds = Number.isInteger(step.entry.seconds) ? step.entry.seconds : Math.round(this.song.end);
    this.entry = step.entry;
    this.level = FULL;
    this.frozen = null;
    this.startClock(step.speed);
    this.transport.play(this.now());
    this.message = '';
    this.detail = '';
    this.changed();
    return true;
  }

  // «Почати пісню», the session's last step: the song, started, ends the session. The session
  // stays until it reads: a song that does not read leaves it on the song's card, which says why
  // (as a warm-up that does not read does), so a warm-up loaded never plays as the song.
  async playSessionSong() {
    const x = this.session;
    const loaded = await this.loadSong(x.step.index, { play: true });
    if (loaded === null || this.session !== x) return;
    if (loaded) {
      this.session = null;
      this.sessionTicket++;
      this.showPage('play');
    } else {
      x.problem = this.message;
      this.showPage('session');
    }
    this.changed();
  }

  // The player: one of profiles.js PLAYERS, with their start.
  profile() { return playerOf(this.profileId); }

  // «Хто грає?»: the player is remembered (not one the address chose), their lead and hands
  // apply, and the song loaded takes the level and speed it has for them.
  setProfile(id) {
    if (!this.players.some(p => p.id === id)) return;
    // a session is the player's own warm-up: another player leaves it
    if (this.session && id !== this.profileId) this.endSession();
    this.profileId = id;
    this.previewProfile = null;
    this.previewWarm = null;
    this.previewFingers = null;
    this.memory.setProfile(id);
    const p = this.profile();
    this.lead = this.memory.lead(id, p.lead);
    this.hands = p.hands;
    this.filter = 'all';
    if (this.song && !this.song.warmup && this.entry) {
      const known = this.estimates.get(this.entry.file);
      const saved = this.memory.song(id, this.entry.file, songDefaults(this.entry, id, this.entry.metrics || (known && known.metrics)));
      this.level = saved.level;
      songAtLevel(this.song, this.level);
      this.prepareGuide();
      this.transport.setLead(this.lead, this.now());
      this.transport.setSpeed(saved.speed, this.now());
    }
    // the sound is the new player's own: the address's preview gives way, the count-in follows
    this.previewSound = { metronome: null, voice: null };
    if (this.transport) this.transport.setCountIn(this.countIn(), this.now());
    this.listPage = gridPageOf(this.gridOrder(), this.songIndex, this.cards());
  }

  // Songs a page of the grid.
  cards() { return CARDS; }

  // Whether the waterfall shows its bar lines (barlines.js): the address's word, else the player's.
  barLinesOn() { return this.previewBarLines ?? this.memory.barLines(this.profileId); }

  // Whether a song chosen on the grid starts with the player's warm-up.
  warmOn() { return (this.previewWarm ?? this.memory.warm(this.profileId)) && this.warmups.length > 0; }

  // The player's songs in order (profiles.js profileSongs), the block's of them the grid shows
  // (blockSongs), and the home (its blocks, the last song, the warm-up: homeState). The panel asks
  // for them every frame its page is open: the order is sorted again only when what it is made of
  // changed (the song list, an estimate come in, who plays); a block filters it; the home is
  // worked out again only when the order, the warm-ups or what the player has played changed
  // (SongMemory.revision). One entry, App's own; estimates are only added.
  gridOrder() { return this.gridLists().order; }
  // The «Складність» button's steps (the old `filter` command): worked out when pressed only.
  gridFilters() { return ['all', ...this.homeState().blocks.map(b => b.block)]; }
  gridLists() {
    const p = this.profile();
    const key = [this.songs, this.songs.length, this.estimates.size, p.id];
    let c = this.gridCache;
    if (!c || !c.key.every((v, i) => v === key[i])) {
      c = this.gridCache = { key, all: Object.freeze(profileSongs(this.songs, p, { estimates: this.estimates })), block: null, order: null, home: null };
    }
    if (c.block !== this.filter || !c.order) {
      c.block = this.filter;
      c.order = Object.freeze(blockSongs(this.songs, c.all, p, this.filter, this.estimates));
    }
    return c;
  }

  // A card pressed: the song, or with the warm-up on, a session before it. The song is read
  // first (its keys choose the warm-ups' keys); a song that does not read gets the warm-ups in
  // their first keys. A newer card, or a page left meanwhile, drops it.
  async startSession(index) {
    const entry = this.songs[index];
    if (!entry) return;
    const ticket = ++this.sessionTicket;
    let prepared = null;
    try {
      const res = await fetch(`songs/${encodeURIComponent(entry.file)}`, { cache: 'no-store' });
      if (res.ok) prepared = prepareSong(parseSmf(new Uint8Array(await res.arrayBuffer())));
    } catch { /* the first keys */ }
    if (ticket !== this.sessionTicket || !['songs', 'song', 'home'].includes(this.panelMode)) return;
    this.session = makeSession(this.warmups, this.profile(), this.songs, index, prepared);
    this.sessionFrom = this.panelMode === 'home' ? 'home' : 'songs';
    this.panelMode = 'session';
    this.changed();
  }

  // The address's session (session=N): before the song loaded, at step N; the steps before it
  // played; with tab=warmup step N playing (frozen at t).
  async previewSession(n) {
    this.panelMode = 'songs';
    await this.startSession(this.songIndex);
    const x = this.session;
    if (!x) return;
    const at = Math.max(0, Math.min(x.steps.length - 1, Number.isInteger(n) ? n : 0));
    if (params.get('intro') !== '1') x.ready();
    while (x.at < at) { x.begin(); x.finish(); }
    if (params.get('tab') === 'warmup' && !x.onSong) {
      x.begin();
      this.panelMode = 'warmup';
      await this.playStep();
      // the moment the address asks for, standing still
      if (this.transport && params.has('t')) { this.frozen = Number(params.get('t')); this.transport.pause(this.now()); }
    }
  }

  // Leaves the session for the page it was started from (the player's home, else the grid); a
  // warm-up loaded gives way to the song it was before.
  endSession() {
    this.session = null;
    this.sessionTicket++;
    this.showPage(this.sessionFrom === 'home' ? 'home' : 'songs');
    return this.song && this.song.warmup && this.songs[this.songIndex] ? this.loadSong(this.songIndex, { remember: false }) : undefined;
  }

  // Opens a page, or the page to come back to while calibrating, in «Підлаштувати» or on
  // «Клавіатура» (a song that finishes loading meanwhile leaves them open).
  showPage(page) {
    const mode = this.panelMode === 'adjust' || this.panelMode === 'calibrate';
    if (mode && this.panelReturn !== 'calibration') this.panelReturn = page;
    else if (mode || this.panelMode === 'calibration') this.keyboardFrom = page;
    else this.panelMode = page;
  }

  // The page to show after calibrating or «Підлаштувати» (xr.js): the page they were entered
  // from, as it stands now: a session's page as the session stands, «Клавіатура»'s way back when
  // they were entered from it; with none, playing.
  pageAfterMode(page) {
    if (page === 'calibration') return this.keyboardBack();
    if (page === 'session' || page === 'warmup') return !this.session ? 'songs' : this.session.phase === 'play' ? 'warmup' : 'session';
    if (page === 'song') return this.songs[this.pick] ? 'song' : 'songs';
    return page && (PAGES.includes(page) || PANEL_PAGES.includes(page)) ? page : 'play';
  }

  // «Клавіатура» from any page (docs/piano-keyboard-handles-design.md §6.3): it remembers the
  // page it was opened from; pressed again (the desktop's button) it goes back there.
  openKeyboard() {
    if (this.panelMode === 'calibration') { this.panelMode = this.keyboardBack(); return; }
    this.keyboardFrom = this.panelMode;
    this.panelMode = 'calibration';
  }

  // Where «Клавіатура» goes back to: the page it was opened from, as that page stands now.
  keyboardBack() {
    return this.pageAfterMode(this.keyboardFrom === 'calibration' ? null : this.keyboardFrom);
  }

  // The words of «Клавіатура»'s way back: the page it leads to.
  keyboardBackLabel() {
    const to = this.keyboardBack();
    if (to === 'songs') return blockName(this.filter);
    return BACK_WORDS[to] || 'Гра';
  }

  // Each frame: the clock reached the end of what plays, once. A song lights its lamp for the
  // player (the fastest speed it was played to its end at); a warm-up's pass lights its own
  // and the session goes on to the next step's card.
  watchEnd(now) {
    const t = this.transport;
    if (!t || !this.song || this.frozen !== null) return;
    if (!(t.playing && t.ended(now))) { this.endSeen = false; return; }
    if (this.endSeen) return;
    this.endSeen = true;
    if (!this.song.warmup) {
      this.memory.setPlayed(this.profileId, this.song.file, t.speed);
      this.changed();
      return;
    }
    const x = this.session;
    if (!x || x.phase !== 'play' || !x.step.entry || x.step.entry.file !== this.song.file) return;
    if (t.speed === x.step.speed) this.memory.setLamp(this.profileId, this.song.file, t.speed);
    x.finish();
    t.pause(now);
    this.showPage('session');
    this.changed();
  }

  // Whether the song plays: a held song (a scrub) as it will once let go.
  playing() {
    if (this.scrub) return this.scrub.playing;
    return !!(this.transport && this.transport.playing && this.frozen === null);
  }

  // A scrub (scrub.js): the headset's trigger on the waterfall (xr.js), the desktop's mouse or wheel
  // over it. It takes the song wherever the waterfall shows it, outside calibrating and
  // «Підлаштувати» (their own presses own the keyboard then). A frozen preview moment (t=) becomes
  // the clock's, standing. -> the song time it starts from, or null.
  scrubBegin(now = this.now(), by = 'xr') {
    const t = this.transport;
    if (!t || !this.song || this.scrub || ['calibrate', 'adjust'].includes(this.panelMode) || this.previewStep || this.previewAdjust) return null;
    const playing = this.playing();
    if (this.frozen !== null) { t.seek(this.frozen, now); this.frozen = null; }
    this.scrub = Object.assign(new SongGrab(t, now, playing), { by });
    this.changed();
    return this.scrub.from;
  }

  // The held song to `time` (clamped: song.js seek). -> where it stands, or null when nothing is
  // held any more (a new song, «Спочатку», a warm-up's card): the hand lets it go.
  scrubTo(time, now = this.now()) {
    const g = this.scrub;
    if (!g || g.transport !== this.transport) { this.scrub = null; return null; }
    return g.to(time, now);
  }

  // Let go at `time` (null: where it stands): on as it was, playing or paused.
  scrubEnd(time = null, now = this.now()) {
    const g = this.scrub;
    if (!g) return;
    this.scrub = null;
    if (g.transport === this.transport) g.end(time, now);
    this.changed();
  }

  // The desktop preview: the waterfall under a point of the canvas (CSS pixels from its top left),
  // through the camera of the picture there (renderDesktop). bounded: on the waterfall only, else
  // anywhere on its plane. -> rayWaterfall's hit with its eye, or null.
  waterfallAt(x, y, { bounded = true, eye = null } = {}) {
    const h = this.canvas.clientHeight;
    const e = eye || this.eyes.find(c => x >= c.x && x < c.x + c.w);
    if (!e || !h) return null;
    const { origin, dir } = pointerRay(e.proj, e.view, ((x - e.x) / e.w) * 2 - 1, 1 - (y / h) * 2);
    const hit = rayWaterfall(identity(), WHITE_PITCH, WHITE_LEN, origin, dir, { bounded });
    return hit && { ...hit, eye: e };
  }

  // The mouse: pressed on the waterfall it takes the song (-> whether it did); moved, the song
  // follows the pointer one to one; let go, it goes on as it was.
  mouseDown(x, y) {
    if (this.xr) return false;
    const hit = this.waterfallAt(x, y);
    if (!hit) return false;
    const from = this.scrubBegin(this.now(), 'mouse');
    if (from === null) return false;
    this.scrub.mouse = { y: hit.y, eye: hit.eye };
    return true;
  }
  mouseMove(x, y) {
    const g = this.scrub;
    if (!g || g.by !== 'mouse') return;
    const hit = this.waterfallAt(x, y, { bounded: false, eye: g.mouse.eye });
    if (hit) this.scrubTo(scrubTime(g.from, hit.y - g.mouse.y));
  }
  mouseUp() { if (this.scrub && this.scrub.by === 'mouse') this.scrubEnd(); }

  // The wheel over the waterfall: the notes move as far on the screen as the wheel scrolled, a
  // wheel down taking them down (forward); the song goes on WHEEL_REST after the wheel stops.
  // deltaY and deltaMode as WheelEvent gives them. -> whether it took the wheel.
  wheel(x, y, deltaY, deltaMode = 0) {
    const g = this.scrub;
    if (this.xr || (g && g.by !== 'wheel')) return false;
    const px = deltaMode === 1 ? deltaY * WHEEL_LINE : deltaMode === 2 ? deltaY * this.canvas.clientHeight : deltaY;
    const at = this.waterfallAt(x, y);
    const to = at && this.waterfallAt(x, y + px, { bounded: false, eye: at.eye });
    if (!at || !to) return false;
    const now = this.now();
    if (!g && this.scrubBegin(now, 'wheel') === null) return false;
    const held = this.scrub;
    held.time = scrubTime(held.time ?? held.from, to.y - at.y);
    held.time = this.scrubTo(held.time, now);
    held.until = now + WHEEL_REST;
    return true;
  }

  songTime(now = this.now()) {
    if (this.frozen !== null) return this.frozen;
    return this.transport ? this.transport.time(now) : 0;
  }

  // The song as it plays at its level (levels.js; level 5 is the song itself).
  levelSong() { return this.song ? songAtLevel(this.song, this.level) : null; }

  // The hands as the keys show them: level 1 has the right hand alone.
  handsShown() { return this.level === 1 ? 'right' : this.hands; }

  // A warm-up plays as written: its level and speed are the pass's and are not remembered.
  setLevel(level) {
    if (!isLevel(level) || !this.song || this.song.warmup) return;
    this.level = level;
    songAtLevel(this.song, level);
    this.prepareGuide();
    this.memory.setSong(this.profileId, this.song.file, { level });
  }

  setSpeed(speed, now) {
    if (!this.transport || !SPEEDS.includes(speed) || (this.song && this.song.warmup)) return;
    this.transport.setSpeed(speed, now);
    if (this.song) this.memory.setSong(this.profileId, this.song.file, { speed });
  }

  setLead(lead, now) {
    if (!LEAD_CHOICES.includes(lead)) return;
    this.lead = lead;
    if (this.transport) this.transport.setLead(lead, now);
    this.memory.setLead(this.profileId, lead);
  }

  // The metronome and the song voice for the player now: what they chose (library.js), the
  // address's preview over it. -> {metronome: {on, volume}, voice: {on, volume}}
  soundSettings() {
    const s = this.memory.sound(this.profileId);
    for (const part of ['metronome', 'voice']) if (this.previewSound[part] !== null) s[part] = { ...s[part], on: this.previewSound[part] };
    return s;
  }

  // One of them switched or its volume set, remembered for the player; the count-in follows the
  // metronome, and a sound switched on may start (inside the command's gesture).
  setSound(part, change, now) {
    this.memory.setSound(this.profileId, part, change);
    this.previewSound[part] = null;
    if (this.transport) this.transport.setCountIn(this.countIn(), now);
    this.sound.wake();
  }

  // The song's upbeat in quarter notes (its entry's `pickup`): the bar lines and the clicks start
  // their bars after it.
  pickup() { return (this.entry && this.entry.pickup) || 0; }

  // The count-in of the song (barlines.js countInBar, worked out once a song) while the metronome is on.
  countIn() {
    if (!this.song || !this.soundSettings().metronome.on) return null;
    if (this.song.countIn === undefined) this.song.countIn = countInBar(this.song, this.pickup());
    return this.song.countIn;
  }

  // The clicks of the song at its speed (barlines.js clickGrid, on the bar lines the waterfall
  // draws), worked out when either changes.
  clicks() {
    const c = this.clickCache, speed = this.transport.speed;
    if (c && c.song === this.song && c.speed === speed) return c.grid;
    this.clickCache = { song: this.song, speed, grid: clickGrid(this.song, speed, this.pickup()) };
    return this.clickCache.grid;
  }

  // What may sound this frame (schedule.js Scheduler.tick's view): nothing without a song, at a
  // frozen moment (t=), while calibrating, or with both voices off; else the clock with the
  // clicks and the notes of the level, each null while it is off.
  soundView() {
    if (!this.song || !this.transport || this.frozen !== null || this.panelMode === 'calibrate' || this.previewStep) return null;
    const s = this.soundSettings();
    const clicks = s.metronome.on ? this.clicks() : null;
    const notes = s.voice.on ? voiceNotes(this.song, this.level) : null;
    return clicks || notes ? { transport: this.transport, clicks, notes } : null;
  }

  // The sound for the panel: the door on the playing pages, and the «Звук» page.
  soundState() {
    const s = this.soundSettings();
    const st = this.sound.status();
    return { metronome: s.metronome, voice: s.voice, any: s.metronome.on || s.voice.on, from: this.soundFrom,
      warmup: !!(this.song && this.song.warmup), problem: st.problem, loading: st.loading && s.voice.on };
  }

  // Panel and desktop buttons (docs/piano-trainer-v2.md §6.3, docs/piano-warmups.md §5): a
  // target of the panel's page (card:k, profile:k, back, …) becomes the trainer's own command
  // through panel.js buttonCommand (null: it does nothing now); the rest are those already. ->
  // the song's load for the list, ◀ ▶, song:<i>, play:<i>, pick:<i>, continue and the session's
  // steps, and the way back to the screens (promises), undefined for the rest.
  command(button) {
    // The pressed target flashes: with bare hands there is no click to feel.
    this.pressed.add(button);
    setTimeout(() => { this.pressed.delete(button); this.changed(); }, 180);
    // a user's action: the sound may start now (the autoplay rule), never waited on
    this.sound.wake();
    const id = buttonCommand(button, this.panelState(this.now()));
    if (id === null) { this.changed(); return undefined; }
    const now = this.now();
    const t = this.transport;
    let loading;
    const [kind, arg] = id.split(':');
    const free = !['adjust', 'calibrate'].includes(this.panelMode); // a page opens only outside those
    const x = this.session;
    const endSession = () => { if (this.session) { this.session = null; this.sessionTicket++; } };
    switch (arg === undefined ? id : kind) {
      case 'toggle':
        // while the song is held, what it does once let go
        if (t && this.scrub) { this.scrub.playing = !this.scrub.playing; break; }
        if (t) {
          if (this.frozen !== null) { t.anchorSong = this.frozen; this.frozen = null; }
          t.toggle(now);
          if (t.playing) this.fingerSeen = this.song; // «Без пальців» was read
        }
        break;
      case 'fingers': this.setFingers(!this.guideOn()); break;
      case 'restart': if (t) { this.scrub = null; this.frozen = null; t.restart(now); } break;
      // the song's end: again from its start, playing
      case 'again': if (t) { this.scrub = null; this.frozen = null; t.restart(now); t.play(now); this.endSeen = false; } break;
      case 'speed':
        if (arg === undefined) { if (t) this.setSpeed(SPEEDS[(SPEEDS.indexOf(t.speed) + 1) % SPEEDS.length], now); } else this.setSpeed(Number(arg) / 100, now);
        break;
      case 'lead': this.setLead(Number(arg), now); break;
      case 'level': this.setLevel(Number(arg)); break;
      case 'loop': if (t) t.cycleLoop(now); break;
      case 'songPrev': if (this.songs.length) loading = this.loadSong(((this.stepFrom ?? this.songIndex) + this.songs.length - 1) % this.songs.length); break;
      case 'songNext': if (this.songs.length) loading = this.loadSong(((this.stepFrom ?? this.songIndex) + 1) % this.songs.length); break;
      case 'song': {
        // the page's own list (index.html): the song, a session left
        const i = Number(arg);
        if (!Number.isInteger(i) || !this.songs[i]) break;
        endSession();
        loading = this.loadSong(i);
        if (PAGES.includes(this.panelMode) || ['who', 'home', 'song', 'session', 'warmup'].includes(this.panelMode)) this.panelMode = 'play';
        break;
      }
      case 'pick': {
        // a song chosen as the grid used to offer it: with the player's warm-up first when on
        const i = Number(arg);
        if (!free || !Number.isInteger(i) || !this.songs[i]) break;
        if (this.warmOn()) { this.panelMode = 'songs'; loading = this.startSession(i); break; }
        endSession();
        loading = this.loadSong(i);
        this.panelMode = 'play';
        break;
      }
      // a song's own page, and its two ways in: at once, or the player's warm-up first
      case 'open': {
        const i = Number(arg);
        if (!free || !Number.isInteger(i) || !this.songs[i]) break;
        this.pick = i;
        this.pickProblem = '';
        this.panelMode = 'song';
        break;
      }
      case 'play': {
        const i = Number(arg);
        if (!free || !Number.isInteger(i) || !this.songs[i]) break;
        loading = this.playPick(i);
        break;
      }
      case 'warmFirst': {
        const i = Number(arg);
        if (!free || !Number.isInteger(i) || !this.songs[i] || !this.warmups.length) break;
        this.panelMode = 'song';
        loading = this.startSession(i);
        break;
      }
      // the player's home: their warm-up, then the song «Продовжити» or «Почни тут» opens; leaving
      // it goes back home
      case 'warmHome': {
        const i = Number(arg);
        if (!free || !Number.isInteger(i) || !this.songs[i] || !this.warmups.length) break;
        this.panelMode = 'home';
        loading = this.startSession(i);
        break;
      }
      // the player's home: «Продовжити» their last song
      case 'continue': {
        if (!free) break;
        const i = this.lastIndex();
        if (i === null) break;
        if (i === this.songIndex && this.song && !this.song.warmup) { endSession(); this.panelMode = 'play'; break; }
        loading = this.playPick(i);
        break;
      }
      case 'home': if (free) this.panelMode = 'home'; break;
      case 'grid': if (free) this.panelMode = 'songs'; break;
      case 'block': {
        const b = arg === 'own' ? 'own' : arg === 'all' ? 'all' : Number(arg);
        if (!free || !(b === 'all' || BLOCKS.includes(b))) break;
        this.filter = b;
        this.listPage = gridPageOf(this.gridOrder(), this.songIndex, this.cards());
        this.panelMode = 'songs';
        break;
      }
      case 'player':
        if (!free || !this.players.some(p => p.id === arg)) break;
        this.setProfile(arg);
        this.panelMode = 'home';
        break;
      case 'who': if (['songs', 'home', 'song'].includes(this.panelMode)) this.panelMode = 'who'; break;
      case 'filter': {
        const filters = this.gridFilters();
        this.filter = filters[(filters.indexOf(this.filter) + 1) % filters.length];
        this.listPage = 0;
        break;
      }
      // the metronome and the song voice: on or off, a volume (which turns it on); its count-in
      case 'metronome': case 'voice':
        this.setSound(id, { on: !this.soundSettings()[id].on }, now);
        break;
      case 'metronomeVolume': case 'voiceVolume':
        this.setSound(kind === 'metronomeVolume' ? 'metronome' : 'voice', { on: true, volume: Number(arg) }, now);
        break;
      case 'barlines':
        this.memory.setBarLines(this.profileId, !this.barLinesOn());
        this.previewBarLines = null;
        break;
      case 'warm':
        if (!this.warmups.length) break;
        this.memory.setWarm(this.profileId, !this.warmOn());
        this.previewWarm = null;
        break;
      case 'session':
        if (!x || !free) break;
        if (arg === 'start' && x.phase === 'ready') {
          if (x.intro) { x.ready(); break; }
          if (x.onSong) { loading = this.playSessionSong(); break; }
          x.begin();
          this.panelMode = 'warmup';
          loading = this.playStep();
        } else if (arg === 'repeat') {
          if (x.phase === 'play') { if (t && this.song && this.song.warmup) { this.scrub = null; this.frozen = null; t.restart(now); t.play(now); this.endSeen = false; } break; }
          if (x.repeat()) { this.panelMode = 'warmup'; loading = this.playStep(); }
        } else if (arg === 'skip') {
          if (x.onSong) break;
          if (x.phase === 'play' && t) { this.scrub = null; t.pause(now); }
          x.skip();
          this.panelMode = 'session';
        } else if (arg === 'exit') {
          loading = this.endSession();
        }
        break;
      case 'listUp': this.listPage = Math.max(0, this.page() - 1); break;
      case 'listDown': this.listPage = this.page() + 1; this.listPage = this.page(); break;
      case 'section':
        if (!free) break;
        // «◀ Пісні» from playing: the block the song is in, at its page
        if (arg === 'songs') {
          const entry = this.songs[this.songIndex];
          if (entry) this.filter = songBlock(entry);
          this.listPage = gridPageOf(this.gridOrder(), this.songIndex, this.cards());
        }
        // back from «Хто грає?»: to the player's home once someone plays, else to the song
        if (arg === 'none' && this.panelMode === 'who' && (this.memory.profile || this.previewProfile)) { this.panelMode = 'home'; break; }
        // the «Звук» page from a warm-up goes back to it
        if (arg === 'sound') this.soundFrom = this.panelMode === 'warmup' || (this.panelMode === 'sound' && this.soundFrom === 'warmup') ? 'warmup' : 'play';
        if (arg === 'none' && this.panelMode === 'sound' && this.soundFrom === 'warmup' && this.session && this.session.phase === 'play') { this.panelMode = 'warmup'; break; }
        if (arg === 'calibration') { this.openKeyboard(); break; }
        this.panelMode = PAGES.includes(arg) ? arg : 'play';
        break;
      case 'keyboard': if (free) this.openKeyboard(); break;
      case 'hands': if (this.level !== 1) this.hands = HAND_FILTERS[(HAND_FILTERS.indexOf(this.hands) + 1) % HAND_FILTERS.length]; break;
      case 'screens': loading = this.back.run(); break;
      default: if (this.xr) this.xr.command(id); break;
    }
    this.changed();
    return loading;
  }

  // «Грати» on a song's page (and «Продовжити» on the home): the song at once, without the
  // warm-up; a song that does not read opens (or keeps) its page, its strip saying why, and its
  // way back leads to its block. A calibration or «Підлаштувати» that started while it loaded
  // keeps the panel and returns to that page. -> the load.
  async playPick(i) {
    if (this.session) { this.session = null; this.sessionTicket++; }
    const loaded = await this.loadSong(i);
    if (loaded === null) return;
    if (loaded) {
      this.pickProblem = '';
      this.showPage('play');
    } else {
      const shown = this.panelMode === 'adjust' || this.panelMode === 'calibrate' ? this.panelReturn : this.panelMode;
      if (shown === 'home' && this.songs[i]) {
        this.filter = songBlock(this.songs[i]);
        this.listPage = gridPageOf(this.gridOrder(), i, this.cards());
      }
      this.pick = i;
      this.pickProblem = this.message;
      this.showPage('song');
    }
    this.changed();
  }

  // The song the player chose last, as an index into the list, or null.
  lastIndex() {
    const file = this.memory.lastSong(this.profileId);
    const i = file ? this.songs.findIndex(s => s.file === file) : -1;
    return i < 0 ? null : i;
  }

  // The grid's page, clamped into the grid.
  page() { return gridPage(this.songs, this.gridOrder(), this.listPage ?? 0, { size: this.cards() }).page; }

  // One's own songs have no catalog length, difficulty or metrics: while the grid is open and the
  // song stands still, one of them is read and worked out at a time (at most one request).
  estimateNext() {
    if (this.estimating || this.panelMode !== 'songs' || (this.transport && this.transport.playing)) return;
    const entry = this.songs.find(s => s.own && !this.estimates.has(s.file));
    if (!entry) return;
    this.estimating = entry.file;
    fetch(`songs/${encodeURIComponent(entry.file)}`, { cache: 'no-store' })
      .then(res => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(buf => this.estimates.set(entry.file, estimateOf(prepareSong(parseSmf(new Uint8Array(buf))))),
        () => this.estimates.set(entry.file, { seconds: null, estimate: null, metrics: null }))
      .catch(() => this.estimates.set(entry.file, { seconds: null, estimate: null, metrics: null }))
      .finally(() => { this.estimating = null; this.changed(); });
  }

  changed() { for (const f of this.listeners) f(this); }

  // The panel's text lines under the title.
  panelLines(now) {
    if (this.xr && this.xr.panelLines) {
      const lines = this.xr.panelLines(now);
      if (lines) return lines;
    }
    if (!this.xr) {
      const kind = this.previewInput || 'controllers';
      const state = this.previewStep ? 'calibrate' : this.previewAdjust ? 'adjust' : null;
      if (state) return guideLines({ state, kind, step: this.previewStep, pitch: WHITE_PITCH });
    }
    const t = this.transport;
    if (!this.song || !t) return ['Пісню не завантажено', this.message, ''];
    return songLines({ song: this.song, time: this.songTime(now), ended: t.ended(now), speed: t.speed, loop: t.loop,
      hands: this.handsShown(), message: this.message, notice: this.xr ? this.xr.notice : '' });
  }

  // The sign over the waterfall: the metronome before the first note, and a tempo change a bar
  // ahead with the click to set until then. null when there is nothing to show.
  signLines(now) {
    if (!this.song || !this.transport) return null;
    const time = this.songTime(now);
    const m = metronomeLines(this.song.tempo, time, this.transport.speed);
    if (m.warn) return [m.warn, m.set.replace('Метроном', 'зараз')];
    if (time < this.song.start) return [m.main, m.alt];
    return null;
  }

  // Whether the sign may stand over the waterfall this frame: only while playing on a placed
  // keyboard (not while calibrating, placing or dragging it), and in the headset only where the
  // panel does not stand in front of it.
  signShown(pitch) {
    if (this.xr) return this.xr.signClear(signCorners(pitch));
    return !this.previewStep && !this.previewAdjust;
  }

  updateSign(lines) {
    const key = JSON.stringify(lines);
    if (key === this.signKey && this.signTex) return;
    this.signKey = key;
    const c = this.signCanvas;
    c.width = Math.round(SIGN_W * PX_PER_M);
    c.height = Math.round(SIGN_H * PX_PER_M);
    drawSign(c.getContext('2d'), lines);
    this.signTex = this.renderer.texture(c, this.signTex);
  }

  // What the panel shows (docs/piano-trainer-v2.md §7.2, docs/piano-warmups.md §5.2): nothing
  // in it changes every frame, so its JSON is the key that redraws the panel. mode: play | adjust |
  // calibrate; section: the page open (songs | level | tempo | calibration) or null; layout: the
  // panel.js page drawn; input: what the headset sees (null on the desktop preview). It is built
  // every frame, each page's own part only on that page (null on the others, which draw none of
  // it): the players on «Хто грає?», the blocks on the home, the grid on a block's songs, the song
  // on its own page, the song playing on the playing pages.
  panelState(now) {
    const t = this.transport;
    const mode = this.panelMode === 'adjust' || this.panelMode === 'calibrate' ? this.panelMode : 'play';
    const entry = this.song ? this.entry : null;
    const known = entry && this.estimates.get(entry.file);
    const player = this.profile();
    const layout = this.panelLayout();
    return {
      mode, section: PAGES.includes(this.panelMode) ? this.panelMode : null, layout,
      playing: this.playing(), speed: t ? t.speed : 1,
      loop: t ? t.loop : null, hands: this.handsShown(), lines: this.panelLines(now), pressed: this.pressed, status: this.statusLine(),
      song: entry && this.song ? {
        file: entry.file, title: entry.title || entry.file, composer: entry.composer || '',
        difficulty: Number.isInteger(entry.difficulty) ? entry.difficulty : null,
        estimate: known ? known.estimate : null,
        seconds: this.song.seconds, own: !!entry.own,
      } : null,
      level: this.level, levels: LEVELS.map(({ id, name, hint, right, left }) => ({ id, name, hint, right: Number.isFinite(right) ? right : null, left: Number.isFinite(left) ? left : null })),
      lead: this.lead, leads: LEAD_CHOICES, barLines: this.barLinesOn(),
      profile: this.previewProfile || this.memory.profile, player: { id: player.id, name: player.name },
      profiles: layout === 'who' ? this.playerRows() : null,
      warm: this.warmOn(), fingers: this.guideOn(),
      grid: layout === 'songs' ? this.gridState(entry) : null,
      home: layout === 'home' ? this.homeState() : null,
      pick: layout === 'song' ? this.pickState() : null,
      play: ['play', 'warmup', 'tempo'].includes(layout) ? this.playState(now) : null,
      session: this.sessionState(),
      calibration: this.xr ? this.xr.calibrationState() : this.previewCalibration(),
      keyboardBack: layout === 'calibration' ? this.keyboardBackLabel() : null,
      input: this.xr ? this.xr.kind : this.previewInput,
      screens: !this.back.pc ? 'none' : this.back.busy ? 'busy' : null, notice: this.xr ? this.xr.notice || '' : '',
      alert: layout === 'home' ? this.placeAlert() : null, fonts: this.fontsReady,
      sound: this.soundState(), // every page: the desktop's buttons below the view say it (label)
    };
  }

  // The players for «Хто грає?» (panelState): each with their start and how many of their songs
  // they played to the end. Counted again only when the songs, the players or what anyone played
  // changed.
  playerRows() {
    const key = [this.songs, this.songs.length, this.players, this.memory, this.memory.revision];
    const c = this.rowsCache;
    if (c && c.key.every((v, i) => v === key[i])) return c.rows;
    const rows = this.players.map(p => ({ ...p, ...playerCounts(this.songs, p, this.memory.played(p.id)) }));
    this.rowsCache = { key, rows };
    return rows;
  }

  // The player's home: their last song for «Продовжити», their blocks, and their warm-up
  // ({minutes, count: its steps as the session counts them, index: the song it leads to,
  // «Продовжити»'s or the first of «Почни тут»'s block; null without warm-ups for them). Kept with the order (gridLists) until the warm-ups or the player's memory
  // change.
  homeState() {
    const c = this.gridLists();
    const key = [this.memory, this.memory.revision, this.warmups, this.profileId];
    if (c.home && c.home.key.every((v, i) => v === key[i])) return c.home.state;
    const p = this.profile();
    const i = this.lastIndex();
    const e = i === null ? null : this.songs[i];
    const blocks = profileBlocks(this.songs, c.all, p, this.memory.played(this.profileId));
    const first = blocks.length ? blockSongs(this.songs, c.all, p, blocks[0].block)[0] : undefined;
    const minutes = warmupMinutes(this.warmups, p);
    const warm = minutes ? { minutes, count: warmupSteps(this.warmups, p), index: e ? i : first ?? null } : null;
    const state = Object.freeze({ last: e ? { index: i, title: e.title || e.file } : null, blocks, warm });
    c.home = { key, state };
    return state;
  }

  // A song's own page: what it is, where the player starts it (or left it), its lamps, the
  // player's warm-up (its minutes and the way through it) and why «Грати» did not start it.
  pickState() {
    const e = this.songs[this.pick];
    if (!e) return null;
    const p = this.profile();
    const known = this.estimates.get(e.file);
    const d = this.memory.song(this.profileId, e.file, songDefaults(e, p.id, e.metrics || (known && known.metrics)));
    const played = this.memory.played(this.profileId)[e.file];
    const minutes = this.warmups.length ? warmupMinutes(this.warmups, p) : null;
    const metrics = e.metrics || (known && known.metrics);
    return {
      index: this.pick, file: e.file, title: e.title || e.file, composer: e.composer || '', own: !!e.own,
      octave: metrics && Number.isInteger(metrics.outside) ? metrics.outside : 0,
      seconds: Number.isInteger(e.seconds) ? e.seconds : known && Number.isFinite(known.seconds) ? Math.round(known.seconds) : null,
      keys: keysOf(e, this.estimates), level: d.level, speed: d.speed, played: Number.isFinite(played) ? played : null,
      block: this.filter, warm: minutes ? { minutes, path: warmupPath(this.warmups, p) } : null, problem: this.pickProblem,
    };
  }

  // What plays (a song or a warm-up), for the playing pages: its title and who wrote it, the time,
  // the metronome now (its value, meter, the note it clicks on, a change a bar ahead) and the
  // strip that asks for something, the most pressing first.
  playState(now) {
    const t = this.transport;
    if (!this.song || !t) return { title: 'Пісню не завантажено', composer: '', time: 0, length: 0, ended: false, metronome: {}, hands: this.handsShown(), alert: this.playAlert() };
    const entry = this.entry || {};
    const time = this.songTime(now);
    return {
      title: this.song.name, composer: entry.composer || '', own: !!entry.own, file: entry.file || '',
      time: Math.max(0, Math.floor(time)), length: Number.isFinite(this.song.seconds) ? this.song.seconds : Math.round(this.song.end), ended: t.ended(now),
      metronome: metronomeView(metronomeLines(this.song.tempo, time, t.speed)), hands: this.handsShown(), alert: this.playAlert(),
    };
  }

  // The strip of the playing pages: «Екрани» that did not open, a song that did not read (or any
  // other word of the page's), the keyboard's place being looked for, a notice, then what the
  // headset sees when it should see something else.
  playAlert() {
    const m = this.message;
    if (m.startsWith('Екрани: ')) return { title: `Не вийшло: ${m.slice(8)}`, sub: 'Екрани не відкрито, тренажер працює далі' };
    if (m) return { title: m };
    const xr = this.xr;
    const restoring = xr ? xr.guideState() === 'restore' : false;
    if (restoring) return { title: 'Шукаю місце клавіатури…' };
    // the sound did not start (blocked, failed, the samples): once, for a few seconds
    const sound = this.sound.notice();
    if (sound) return sound;
    if (xr && xr.notice) return { title: xr.notice };
    const fingers = this.fingerNotice();
    if (fingers) return { title: fingers };
    const kind = xr ? xr.kind : this.previewInput;
    // controllers in hand while the song plays: the keys want hands (at a pause they press the panel)
    const playing = this.playing();
    if (kind === 'controllers' && playing && (!xr || xr.guideState() === 'play')) return { title: 'Бачу контролери: поклади їх', sub: 'грати треба руками' };
    if (kind === 'none' && xr) return { title: 'Не бачу ні рук, ні контролерів' };
    return null;
  }

  // The home's strip when no keyboard stands (lost, too far, never placed), with «Калібрувати».
  placeAlert() {
    const c = this.xr ? this.xr.calibrationState() : this.previewCalibration();
    if (c.placed !== false || (this.xr && this.xr.guideState() === 'restore')) return null;
    if (c.lost === 'lost') return { title: 'Місце клавіатури не знайдено', sub: 'шолом не впізнав кімнату', calibrate: true };
    if (c.lost === 'far') return { title: 'Збережене місце далеко', sub: 'калібруй знову двома дотиками', calibrate: true };
    return { title: 'Клавіатуру ще не поставлено', sub: 'два дотики контролером до крайніх До', calibrate: true };
  }

  // The grid's page for panelState: its cards and the block.
  gridState(entry) {
    const g = gridPage(this.songs, this.gridOrder(), this.listPage ?? 0,
      { size: this.cards(), current: entry && !this.song.warmup ? entry.file : null, played: this.memory.played(this.profileId), estimates: this.estimates });
    return { ...g, block: this.filter };
  }

  // The session for panelState: where it stands, a mark a step, how the step before went and
  // what comes next (a warm-up: its speed, length, the passes lit before and how to play it).
  sessionState() {
    const x = this.session;
    if (!x) return null;
    const step = x.step;
    const warmIndex = x.steps.slice(0, x.at + 1).filter(s => s.kind === 'warmup').length;
    const title = st => (st.kind === 'song' ? st.title : `${st.entry.title} · ${Math.round(st.speed * 100)}\u00a0%`); // the % kept with its number
    let next;
    if (step.kind === 'song') {
      const entry = this.songs[step.index];
      const known = entry && this.estimates.get(entry.file);
      const d = entry ? this.memory.song(this.profileId, entry.file, songDefaults(entry, this.profileId, entry.metrics || (known && known.metrics))) : null;
      next = { kind: 'song', title: step.title, facts: d ? `рівень ${d.level} · ${Math.round(d.speed * 100)} %` : '' };
    } else {
      const lit = this.memory.lamps(this.profileId, step.entry.file);
      next = { kind: 'warmup', title: step.entry.title, speed: step.speed, summary: step.entry.summary || '',
        facts: formatTime(Math.round(step.entry.seconds / step.speed)),
        lamps: (step.entry.passes || [1]).map(speed => ({ speed, on: lit.includes(speed) })) };
    }
    // the warm-ups as the card at the end lists them: each once, its passes and how each went
    const rows = [];
    x.steps.forEach((st, i) => {
      if (st.kind !== 'warmup') return;
      let r = rows.find(q => q.file === st.entry.file);
      if (!r) rows.push(r = { file: st.entry.file, title: st.entry.title, passes: [] });
      r.passes.push({ speed: st.speed, result: x.results[i] });
    });
    return {
      at: x.at, phase: x.phase, number: Math.max(1, warmIndex), warmups: x.warmups, marks: x.marks(),
      intro: x.intro,
      last: x.last !== null && x.last !== x.at ? { title: title(x.steps[x.last]), result: x.results[x.last] } : null,
      next, problem: x.problem,
      played: x.results.filter(r => r === 'done').length, skipped: x.results.filter(r => r === 'skipped').length, rows,
    };
  }

  // The panel's layout (panel.js pageLayout): the mode's, the calibration's at its step.
  panelLayout() {
    return pageLayout(this.panelMode, this.xr ? this.xr.flow && this.xr.flow.step : this.previewStep);
  }

  // The calibration's part of panelState on the desktop preview: a locked keyboard of the default
  // key width, or the state the address asks for.
  previewCalibration() {
    return {
      locked: !this.previewStep && !this.previewAdjust, pitch: Math.round(WHITE_PITCH * 1e4) / 1e4, depth: WHITE_LEN,
      measured: null, saved: null, anchored: false, step: this.previewStep, problem: '',
      controllers: this.previewInput === 'controllers' || this.previewInput === 'mixed',
      adjust: this.previewAdjust ? { x: 0, y: 0, z: 0, yaw: 0 } : null,
      placed: !this.previewPlace, lost: this.previewPlace === 'none' ? null : this.previewPlace,
    };
  }

  // The panel's top row: what the headset sees; the desktop preview says what it is.
  statusLine() {
    if (this.xr) return this.xr.statusLine();
    if (!this.previewInput) return 'Перегляд на екрані';
    const state = this.previewStep ? 'calibrate' : this.previewAdjust ? 'adjust' : 'play';
    return statusLine(this.previewInput, state);
  }

  // Redraws the panel texture when its content changed.
  updatePanel(now) {
    const s = this.panelState(now);
    const key = JSON.stringify({ ...s, pressed: [...s.pressed] });
    if (key === this.panelKey && this.panelTex) return;
    this.panelKey = key;
    const c = this.panelCanvas;
    c.width = Math.round(PANEL_W * PX_PER_M);
    c.height = Math.round(panelHeight(s.mode) * PX_PER_M);
    this.panelButtons = renderPanel(c.getContext('2d'), s).targets;
    this.panelButtonsPage = s.layout;
    this.panelTex = this.renderer.texture(c, this.panelTex);
  }

  // Draw lists for one frame. keyboard: model matrix of the keyboard or null; panel: its matrix.
  buildFrame(now, pitch, { fake = false } = {}) {
    const b = this.batches;
    for (const k of Object.keys(b)) if (k !== 'marks') b[k].clear();
    if (fake) buildFakeKeyboard(b.fake, WHITE_PITCH); // the real keyboard keeps its own pitch
    this.estimateNext();
    if (this.scrub && this.scrub.by === 'wheel' && now >= this.scrub.until) this.scrubEnd(null, now);
    this.watchEnd(now);
    this.sound.tick(this.soundView());
    // While calibrating the keys are outlines alone, faint, with the key to touch: no song over them.
    const look = this.keyboardLook(now);
    const shown = this.song && this.panelMode !== 'calibrate' && !this.previewStep;
    // the guide hands on: the guided view (its bars carry their fingers) and where the hands stand
    const guided = shown && this.guideOn() ? this.guidedView() : null;
    const time = this.songTime(now);
    const frame = shown ? frameAt(guided || this.levelSong(), time, { pitch, speed: this.transport.speed, hands: this.handsShown(), lead: this.lead }) : null;
    const guide = guided ? { hands: handsAt(guided.track, time, { speed: this.transport.speed, lead: this.lead, hands: this.handsShown() }) } : null;
    this.guideDrawn = !!guide;
    buildOverlay(b, frame, pitch, { look, guide });
    buildRays(b.marks, look.rays);
    buildHandles(b.marks, look.handles, look.eye);
    // the bar lines, worked out and drawn only while the player has them on
    if (frame && this.barLinesOn()) {
      const lines = linesAt(this.levelSong(), this.songTime(now), { hands: this.handsShown(), pickup: this.entry && this.entry.pickup });
      buildBarLines(b.lines, lines, pitch, { look });
    }
    const sign = frame && this.signShown(pitch) && this.signLines(now);
    if (sign) {
      this.updateSign(sign);
      const [a, , c] = signCorners(pitch);
      b.sign.rectXY(a[0], c[0], a[1], c[1], WATERFALL_Z, [1, 1, 1, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]);
    }
    this.updatePanel(now);
    const h = panelHeight(this.panelMode);
    b.panel.rectXY(-PANEL_W / 2, PANEL_W / 2, -h / 2, h / 2, 0, [1, 1, 1, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]);
    buildPanelBar(b.panelBar, PANEL_W, h, { held: !!(this.xr && this.xr.panelGrab) });
    // what a ray or a fingertip is on: drawn over the panel each frame, so the texture stays
    const aim = (this.xr ? this.xr.drawState() : this.previewDraw()).aim;
    if (aim) buildPanelAim(b.aim, (this.panelButtons || []).filter(t => aim.targets.includes(t.id)), aim.cursors);
  }

  // How the keyboard shows this frame beyond the song (overlay.js drawLook, buildRays): the mode,
  // the controllers' rays and whether one is on the keys or slides them, the key to touch while
  // calibrating, the faint keyboard under a calibration, and the pulse of that key (0..1).
  keyboardLook(now) {
    const d = this.xr ? this.xr.drawState() : this.previewDraw();
    const mode = this.panelMode === 'adjust' || this.panelMode === 'calibrate' ? this.panelMode : 'play';
    return { mode, rays: d.rays || [], hover: !!d.hover, grabbed: !!d.grabbed, dim: !!d.dim, target: d.target || null,
      handles: mode === 'adjust' ? d.handles || [] : [], eye: d.eye || null, pulse: 0.5 + 0.5 * Math.sin(now * 2 * Math.PI * PULSE_HZ) };
  }

  // The desktop preview's drawState: in «Підлаштувати» the handles, and the right controller over
  // the lap pointing its ray at E4; calibrating, the key of the step on the keyboard drawn faint.
  previewDraw() {
    if (this.previewAdjust) {
      const to = [keyCentre(64, WHITE_PITCH), 0, -0.04];
      const handles = handlesOf(rectOf(identity(), { pitch: WHITE_PITCH, nudge: {} })).map(h => ({ ...h, state: 'idle' }));
      return { rays: [{ from: [to[0] + 0.14, 0.24, 0.3], to, hit: true }], hover: true, grabbed: false, target: null, dim: false, handles, eye: PREVIEW_EYE };
    }
    if (this.previewStep) return { rays: [], hover: false, grabbed: false, target: this.previewStep, dim: true };
    // a ray's cursor on a target the address names (hover=<id>), as the headset draws it
    const t = this.previewHover && this.panelButtons && this.panelButtons.find(b => b.id === this.previewHover);
    const aim = t ? { targets: [t.id], cursors: [[t.x0 + (t.x1 - t.x0) * 0.68, t.y1 - (t.y1 - t.y0) * 0.62]] } : null;
    return { rays: [], hover: false, grabbed: false, target: null, dim: false, aim };
  }

  // room: where the simulated keyboard stands (the desktop preview and the XR smoke test only).
  items(keyboard, panel, room = null) {
    const b = this.batches;
    const out = [];
    if (room) out.push({ batch: b.fake, model: room });
    // the bar lines first: everything else on the keys lies over them
    if (keyboard) out.push({ batch: b.lines, model: keyboard, texture: this.digits });
    if (keyboard) {
      // the guide hands first, kept off the black keys' cues and the bars, so every key cue, bar
      // and digit lies over them
      if (this.guideDrawn) {
        out.push({ batch: b.keep, model: keyboard, depth: 'keep' }, { batch: b.hands, model: keyboard, depth: 'shell' },
          { batch: b.palms, model: keyboard, texture: this.fingerTex, depth: 'test' });
      }
      out.push({ batch: b.keys, model: keyboard });
      out.push({ batch: b.bars, model: keyboard }, { batch: b.labels, model: keyboard, texture: this.letters });
      if (this.guideDrawn) out.push({ batch: b.fingers, model: keyboard, texture: this.fingerTex });
      out.push({ batch: b.sign, model: keyboard, texture: this.signTex });
    }
    out.push({ batch: b.panel, model: panel, texture: this.panelTex }, { batch: b.aim, model: panel }, { batch: b.panelBar, model: panel }, { batch: b.marks, model: identity() });
    return out;
  }

  // Calibration as the headset draws it (xr.js drawMarks): the first touch taken, and the ring at
  // the controller's tip on the key of this step.
  previewMarks(b, pitch) {
    const at = midi => [keyCentre(midi, pitch), 0.015, 0];
    const tip = at(this.previewStep === 'low' ? LOW : HIGH);
    buildCalibrationMarks(b, { tips: [tip], holding: null, first: this.previewStep === 'high' ? at(LOW) : null });
  }

  // The desktop preview: a camera in front (a monitor's view) or at the seat (both eyes).
  renderDesktop() {
    const gl = this.gl;
    const now = this.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    const seat = this.view === 'seat';
    this.renderer.begin(seat ? [0.17, 0.16, 0.15, 1] : [0.035, 0.04, 0.05, 1]);
    const pitch = WHITE_PITCH;
    this.batches.marks.clear();
    if (this.previewStep) this.previewMarks(this.batches.marks, pitch);
    this.buildFrame(now, pitch, { fake: true }); // the keys under the overlay, as the room would show them
    const keyboard = identity();
    const panel = multiply(keyboard, panelInKeyboard(this.panelMode));
    const mid = (WHITE_COUNT * pitch) / 2;
    const items = this.items(keyboard, panel, keyboard);
    const eyes = [];
    if (seat) {
      // A seated player: eyes 45 cm over the keys and 38 cm in front of the touch line, a little
      // left of the middle, so both eyes see the panel beside the lowest C whole.
      const eye = PREVIEW_EYE, target = [mid - 0.2, 0.06, -0.16];
      for (const [i, dx] of [[0, -0.0315], [1, 0.0315]]) {
        gl.viewport((i * w) / 2, 0, w / 2, h);
        const proj = perspective((96 * Math.PI) / 180, w / 2 / h, 0.02, 10);
        const view = lookAt([eye[0] + dx, eye[1], eye[2]], [target[0] + dx, target[1], target[2]]);
        this.renderer.draw(proj, view, items);
        if (i === 0) this.panelText = panelTextPx(proj, view, panel, this.panelMode, h / dpr);
        eyes.push({ proj, view, x: (i * w) / 2 / dpr, w: w / 2 / dpr });
      }
    } else {
      const { proj, view } = frontCamera(this.panelMode, pitch, w / h);
      this.renderer.draw(proj, view, items);
      this.panelText = panelTextPx(proj, view, panel, this.panelMode, h / dpr);
      eyes.push({ proj, view, x: 0, w: w / dpr });
    }
    this.eyes = eyes;
  }
}

// The metronome as the panel shows it (tempo.js metronomeLines -> {bpm, meter, note, warn}): the
// click's value big, its meter, the note it falls on («чверть» unless the beat is another, then the
// finer click), and a change a bar ahead. A file without a tempo: no value, and why.
export function metronomeView(m) {
  const v = /^([\d,]+) BPM(?: · (\S+))?/.exec(m.value || '');
  if (!v) return { bpm: '', meter: '', note: m.value || '', warn: '' };
  const note = m.note || '';
  return { bpm: v[1], meter: v[2] || '', note: note.startsWith('на ') ? note.slice(3) : note ? `чверть · ${note}` : 'чверть',
    warn: m.warn ? m.warn[0].toLocaleLowerCase('uk') + m.warn.slice(1) : '' };
}

// The panel's pages (panel.js layouts) a section opens.
export const PAGES = ['songs', 'level', 'tempo', 'calibration', 'sound'];
// The other pages a mode or «Клавіатура» may go back to.
const PANEL_PAGES = ['who', 'home', 'song', 'session', 'warmup', 'play'];
// «Клавіатура»'s way back in words: the page it leads to (a block's songs: the block's name).
const BACK_WORDS = { who: 'Хто грає', home: 'Блоки', song: 'Пісня', session: 'Розігрів', warmup: 'Розігрів', play: 'Гра', level: 'Рівень', tempo: 'Темп', sound: 'Звук' };

// What the page works out from one's own song: its length, an estimated difficulty and the
// metrics the catalog keeps for a bundled one (metrics.js).
const estimateOf = song => ({ seconds: song.end, estimate: estimateDifficulty(song), metrics: songMetrics(song) });
const PULSE_HZ = 1.2; // the key to touch while calibrating
// The desktop preview's seat (view=seat): eyes 45 cm over the keys and 38 cm in front of the touch
// line, a little left of the middle; the handles' upright discs face it.
const PREVIEW_EYE = [(WHITE_COUNT * WHITE_PITCH) / 2 - 0.2, 0.45, 0.38];

// The front view: a camera FRONT_EYE over and in front of the keys, as high and far as a monitor
// looking at the piano, at least FRONT_FOV tall.
const FRONT_EYE = [0.42, 1.25], FRONT_AT = [0.1, -0.1], FRONT_FOV = (38 * Math.PI) / 180, FRONT_MARGIN = 1.05;

// A monitor's view of the keys and the panel beside them, both whole at any shape of window: the
// camera faces the middle of what it must show, the corners of the panel as `mode` docks it
// (panelInKeyboard) and of the piano's body, and its field of view grows until every corner
// stands inside with FRONT_MARGIN to spare, so a narrow window widens the view.
export function frontCamera(mode, pitch, aspect) {
  const h = panelHeight(mode), panel = panelInKeyboard(mode), body = fakeBody(pitch);
  const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => transformPoint(panel, [(x * PANEL_W) / 2, (y * h) / 2, 0]));
  for (const x of body.x) for (const y of body.y) for (const z of body.z) points.push([x, y, z]);
  const xs = points.map(p => p[0]);
  const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
  const view = lookAt([centre, ...FRONT_EYE], [centre, ...FRONT_AT]);
  let tan = Math.tan(FRONT_FOV / 2) / FRONT_MARGIN;
  for (const p of points) {
    const v = transformPoint(view, p);
    tan = Math.max(tan, Math.abs(v[1]) / -v[2], Math.abs(v[0]) / -v[2] / aspect);
  }
  return { proj: perspective(2 * Math.atan(tan * FRONT_MARGIN), aspect, 0.05, 20), view };
}

// Below this many CSS pixels the panel's body text is not read on a screen; the page then shows
// the panel's lines itself.
export const READABLE_PX = 10;
// Frames after a press of the page's button before it is brought back into the window (main):
// the press's state, then the lines over the view and the layout under them.
export const PRESSED_FRAMES = 3;

// How tall the panel's body text stands on the screen, in CSS pixels, or 0 when part of the
// panel is out of view. proj, view: the camera; panel: its matrix; cssHeight: the viewport's.
export function panelTextPx(proj, view, panel, mode, cssHeight) {
  const h = panelHeight(mode);
  const clip = multiply(proj, multiply(view, panel));
  const at = (x, y) => {
    const c = [0, 1, 2, 3].map(r => clip[r] * x + clip[4 + r] * y + clip[12 + r]);
    return c[3] > 0 ? [c[0] / c[3], c[1] / c[3]] : null;
  };
  const corners = [[-PANEL_W / 2, -h / 2], [PANEL_W / 2, -h / 2], [PANEL_W / 2, h / 2], [-PANEL_W / 2, h / 2]].map(([x, y]) => at(x, y));
  if (corners.some(c => !c || Math.abs(c[0]) > 1 || Math.abs(c[1]) > 1)) return 0;
  const tall = (Math.abs(corners[3][1] - corners[0][1]) + Math.abs(corners[2][1] - corners[1][1])) / 2;
  return ((tall / 2) * cssHeight * BODY_TEXT) / h;
}

// The panel's fonts (studio.js FONTS, piano/fonts): loaded before the panel is drawn with them;
// without them (a server without the files, a browser without FontFace) the panel keeps
// system-ui. -> whether they came in, within FONT_WAIT seconds.
export const FONT_WAIT = 5;
export async function loadFonts(doc = globalThis.document) {
  if (!doc || !doc.fonts || typeof FontFace !== 'function') return false;
  let timer;
  try {
    await Promise.race([
      Promise.all(FONTS.map(async f => { const face = new FontFace(f.family, `url(${f.file})`, { weight: f.weight }); await face.load(); doc.fonts.add(face); })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('fonts late')), FONT_WAIT * 1000); }),
    ]);
    fontsChanged();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function main() {
  const canvas = document.getElementById('view');
  const status = document.getElementById('status');
  const enter = document.getElementById('enter');
  let app;
  try {
    app = new App(canvas);
  } catch (e) {
    status.textContent = `Не вдалося запустити графіку: ${e.message}`;
    return;
  }
  window.__piano = app;
  let fontsSettled = false;
  loadFonts().then(ok => {
    app.fontsReady = ok;
    app.panelKey = '';
    if (ok) app.fingerTex = app.renderer.texture(fingerAtlas(document, 'Manrope, system-ui, sans-serif'), app.fingerTex);
    fontsSettled = true;
    app.changed();
  });
  const controls = document.querySelectorAll('[data-command]');
  // The panel's lines in the page, when the window shows the panel too small or not whole: the
  // song, its time and speed, the metronome and a coming change.
  const lines = document.getElementById('lines');
  let linesKey = '';
  const showLines = () => {
    const wanted = app.panelText < READABLE_PX && (app.panelMode === 'play' || app.panelMode === 'warmup' || PAGES.includes(app.panelMode)) && !app.previewStep;
    const texts = wanted ? app.panelLines(app.now()).slice(0, 5) : [];
    const key = JSON.stringify(texts);
    if (key === linesKey) return;
    linesKey = key;
    lines.replaceChildren(...texts.map((line, i) => {
      const el = document.createElement('span');
      el.textContent = lineText(line);
      el.className = i === 0 ? 'song' : line && line.label ? 'metronome' : line && line.tone === 'warn' ? 'warn' : '';
      return el;
    }).filter(el => el.textContent && el.textContent !== app.message));
    lines.hidden = !lines.childElementCount;
  };
  const refresh = () => {
    for (const el of controls) {
      const [big, small] = label(el.dataset.command, app.panelState(app.now()));
      el.textContent = small ? `${big} ${small}` : big;
    }
    status.textContent = app.detail ? `${app.message}: ${app.detail}` : app.message || app.fingerNotice() || app.fingerDetail;
  };
  // Who plays, the song, its level and the lead as lists (docs/piano-trainer-v2.md §6.5): each
  // sends the panel's command (who plays: as «Хто грає?» does); the page's state picks the option
  // shown.
  const picks = { song: document.getElementById('song'), level: document.getElementById('level'), lead: document.getElementById('lead'),
    metronomeVolume: document.getElementById('metronomeVolume'), voiceVolume: document.getElementById('voiceVolume') };
  const who = document.getElementById('profile');
  who.addEventListener('change', () => app.command(`player:${who.value}`));
  const option = (value, text) => Object.assign(document.createElement('option'), { value, textContent: text });
  picks.level.replaceChildren(...LEVELS.map(l => option(l.id, `${l.id} · ${l.name}`)));
  picks.lead.replaceChildren(...LEAD_CHOICES.map(v => option(v, `${String(v).replace('.', ',')} с`)));
  for (const el of [picks.metronomeVolume, picks.voiceVolume]) el.replaceChildren(...VOLUMES.map(v => option(v, `${v} %`)));
  for (const [kind, el] of Object.entries(picks)) el.addEventListener('change', () => app.command(`${kind}:${el.value}`));
  const refreshPicks = () => {
    if (picks.song.options.length !== app.songs.length) {
      picks.song.replaceChildren(...app.songs.map((e, i) => option(i, [e.title || e.file, e.own ? 'моя' : e.composer].filter(Boolean).join(' — '))));
    }
    picks.song.value = String(app.songIndex);
    if ([...who.options].map(o => `${o.value}=${o.textContent}`).join() !== app.players.map(p => `${p.id}=${p.name}`).join()) {
      who.replaceChildren(...app.players.map(p => option(p.id, p.name)));
    }
    who.value = app.profileId;
    picks.level.value = String(app.level);
    picks.lead.value = String(app.lead);
    const sound = app.soundSettings();
    picks.metronomeVolume.value = String(sound.metronome.volume);
    picks.voiceVolume.value = String(sound.voice.volume);
  };
  app.listeners.add(refresh);
  app.listeners.add(refreshPicks);
  // A button just pressed stays in the window: the page's lines that appear over the view (on
  // «Клавіатура» in a narrow window) push the footer down, and «Назад з клавіатури» must not leave
  // the window under the hand that pressed «Клавіатура». Checked once the lines have settled.
  let pressed = null;
  for (const el of controls) el.addEventListener('click', () => { pressed = { el, frames: PRESSED_FRAMES }; app.command(el.dataset.command); });
  const keepPressed = () => {
    if (!pressed || --pressed.frames > 0) return;
    const { el } = pressed;
    pressed = null;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest' });
  };
  for (const v of document.querySelectorAll('[data-view]')) {
    v.addEventListener('click', () => { app.view = v.dataset.view; });
  }
  // The waterfall taken by the mouse (left button) or wheeled; elsewhere the page scrolls as ever.
  const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !app.mouseDown(...at(e))) return;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => app.mouseMove(...at(e)));
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => app.mouseUp());
  canvas.addEventListener('wheel', e => { if (app.wheel(...at(e), e.deltaY, e.deltaMode)) e.preventDefault(); }, { passive: false });
  await app.init();
  refresh();
  refreshPicks();
  const supported = await xrSupported();
  // In the headset the trainer is what it shows: the PC's watcher keeps it after a sleep instead
  // of opening vrplay's screens over it. The way back is the button. A copy on a static host
  // (hasPc) has no PC behind it: no button, nothing asked, and a line that says so.
  const pc = hasPc();
  if (supported && pc) askPc('trainer');
  for (const el of document.querySelectorAll('[data-command="screens"]')) el.hidden = !supported || !pc;
  const note = document.getElementById('host-note');
  if (note && !pc) { note.textContent = HOST_NOTE; note.hidden = false; }
  enter.hidden = false;
  enter.disabled = !supported;
  document.getElementById('enter-note').textContent = supported
    ? 'Сядь за синтезатор і натисни «Увійти».'
    : 'Режим змішаної реальності тут недоступний. Нижче перегляд на екрані.';
  enter.addEventListener('click', async () => {
    // the click is the gesture the sound may start in, before the session takes the page
    app.sound.wake();
    try {
      await startXR(app);
      if (pc) askPc('trainer');
    } catch (e) {
      status.textContent = `Не вдалося увійти: ${e.message}`;
    }
  });
  let frames = 0;
  const loop = () => {
    if (!app.xr) {
      app.renderDesktop();
      showLines();
      keepPressed();
      // ready once the fonts are in and a guide being worked out is drawn
      const pending = app.song && app.guideOn() && (app.song.fingeringPending || (app.song.levelPending && app.song.levelPending.size > 0));
      if (fontsSettled && !pending && ++frames === 2) window.__pianoReady = true;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
