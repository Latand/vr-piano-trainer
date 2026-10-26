// The page's own sound (docs/piano-audio-design.md §3.2, §4.2, §5.4-§5.5, §7): one AudioContext,
// made and resumed only inside a user's action and only while the metronome or the song voice is
// on; the clicks made here, the piano from the samples in piano/sounds; the port the scheduler
// (schedule.js) drives. Nothing here waits on audio: a context the browser keeps suspended, or one
// that cannot be made, gives one short notice, and playback goes on without sound.
import { Scheduler, RELEASE_STOP, LOOKAHEAD, BUSY_LOOKAHEAD } from './schedule.js';

// The samples: one every minor third from C2 (MIDI 36) to C7 (96), named as in the source.
const NAMES = ['C', 'Ds', 'Fs', 'A'];
export const SAMPLE_LOW = 36, SAMPLE_HIGH = 96;
export const SAMPLES = Array.from({ length: (SAMPLE_HIGH - SAMPLE_LOW) / 3 + 1 }, (_, i) => {
  const midi = SAMPLE_LOW + 3 * i;
  return { midi, name: `${NAMES[(midi % 12) / 3]}${Math.floor(midi / 12) - 1}` };
});
export const SAMPLE_KEEP = 8; // seconds of each sample kept, mono
export const SAMPLE_FADE = 0.25; // and faded out at its end
export const TARGET_RMS = 0.1; // a mezzo note's loudness (velocity MEZZO) after normalising
export const MEZZO = 80;
export const VOICES = 32; // sounding notes at most; past that the oldest is released
export const BLOCKED_AFTER = 1; // s: a context not running this long after resume() is blocked
export const NOTICE_SECONDS = 6;
// The clicks (§4.2): a sine with a 1 ms raised-cosine attack and an exponential decay, 60 ms.
export const CLICKS = {
  bar: { freq: 1760, peak: 1, tau: 0.009 },
  beat: { freq: 1320, peak: 0.6, tau: 0.008 },
  sub: { freq: 1320, peak: 0.35, tau: 0.006 },
};
export const CLICK_LEVEL = 0.3; // a bar click about 3 dB under a mezzo note's peak
export const NOTICES = {
  blocked: 'Звук не ввімкнувся: браузер не дав',
  failed: 'Звук не ввімкнувся: браузер не дав',
  samples: 'Звук пісні не завантажився',
};

// The sample a key plays: the nearest of SAMPLES, and the playback rate that tunes it.
export function sampleFor(midi) {
  const at = Math.min(SAMPLE_HIGH, Math.max(SAMPLE_LOW, SAMPLE_LOW + 3 * Math.round((midi - SAMPLE_LOW) / 3)));
  return { midi: at, rate: 2 ** ((midi - at) / 12) };
}

// A note's gain: the sample's normalising factor times the General MIDI curve, unity at MEZZO.
export function noteGain(normalise, velocity) {
  const v = Number.isFinite(velocity) ? velocity : MEZZO;
  return Math.min(2.5, Math.max(0.05, normalise * (v / MEZZO) ** 2));
}

// A bus's gain for a volume step in %: its square (30, 60, 100 % -> −21, −9, 0 dB).
export const busGain = volume => (volume / 100) ** 2;

// One click's samples at `rate`.
export function clickSamples(rate, { freq, peak, tau }) {
  const n = Math.round(0.06 * rate), attack = 0.001 * rate;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = i < attack ? 0.5 - 0.5 * Math.cos((Math.PI * i) / attack) : Math.exp(-(i - attack) / rate / tau);
    out[i] = peak * env * Math.sin((2 * Math.PI * freq * i) / rate);
  }
  return out;
}

// A decoded sample -> what is kept of it: the first SAMPLE_KEEP s mixed to mono with a SAMPLE_FADE
// fade at the end, where it starts (the first sample above 5 % of its peak, less 2 ms) and its
// loudness (RMS of the 150 ms after that). channels: [Float32Array]. -> {data, onset (s), rms}
export function trimSample(channels, rate) {
  const n = Math.min(channels[0].length, Math.round(SAMPLE_KEEP * rate));
  const data = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) data[i] += ch[i] / channels.length;
  const fade = Math.min(n, Math.round(SAMPLE_FADE * rate));
  for (let i = 0; i < fade; i++) data[n - fade + i] *= 1 - (i + 1) / fade;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
  let first = 0;
  while (first < n && Math.abs(data[first]) <= 0.05 * peak) first++;
  const start = Math.max(0, first - Math.round(0.002 * rate));
  const end = Math.min(n, start + Math.round(0.15 * rate));
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i] * data[i];
  const rms = end > start ? Math.sqrt(sum / (end - start)) : 0;
  return { data, onset: start / rate, rms };
}

// settings(): {metronome: {on, volume}, voice: {on, volume}} now (App.soundSettings).
// now(): performance time in seconds. Context: the AudioContext class (none: sound fails).
export class Sound {
  constructor({ settings, now = () => performance.now() / 1000, Context = globalThis.AudioContext || globalThis.webkitAudioContext,
    fetch: get = globalThis.fetch && globalThis.fetch.bind(globalThis), log = console, timer = (f, ms) => setTimeout(f, ms), base = 'sounds/piano/' } = {}) {
    Object.assign(this, { settings, now, Context, get, log, timer, base });
    this.ctx = null;
    this.failed = false; // no context can be made: the rest of the page's life without sound
    this.blocked = false; // the browser keeps the context suspended
    this.samples = 'none'; // none | loading | ready | failed
    this.buffers = new Map(); // sample's midi -> {buffer, onset, normalise}
    this.voices = []; // sounding notes, oldest first
    this.scheduler = null;
    this.noticeShown = new Set(); // each kind of notice once a page load
    this.shown = null; // {kind, until}
    this.volumes = null; // the bus gains as set
    this.suspending = false;
    this.halted = false; // the scheduler was stopped since the context last rendered
  }

  // Both off: no sound at all.
  on() {
    const s = this.settings();
    return !!(s.metronome.on || s.voice.on);
  }

  // Called synchronously inside a user's action (a command, «Увійти», a select in the headset):
  // makes the context while a voice is on and asks it to run; the song voice's samples load after
  // the first. Returns at once.
  wake() {
    if (this.failed || !this.on()) return;
    if (!this.ctx) {
      try {
        if (typeof this.Context !== 'function') throw new Error('no AudioContext');
        this.ctx = new this.Context();
        this.build();
      } catch (e) {
        this.ctx = null;
        this.failed = true;
        this.log.warn(`[sound] failed: ${e.message}`);
        this.notify('failed');
        return;
      }
      this.ctx.onstatechange = () => this.stateChanged();
    }
    if (this.settings().voice.on && this.samples === 'none') this.loadSamples();
    if (this.ctx.state !== 'running') this.resume();
  }

  resume() {
    const ctx = this.ctx;
    this.suspending = false;
    try {
      const p = ctx.resume();
      if (p && p.catch) p.catch(e => this.log.warn(`[sound] resume: ${e.message}`));
    } catch (e) { this.log.warn(`[sound] resume: ${e.message}`); }
    this.timer(() => {
      if (this.ctx !== ctx || ctx.state === 'running' || !this.on() || this.suspending) return;
      this.blocked = true;
      this.log.warn(`[sound] blocked: the context is ${ctx.state} ${BLOCKED_AFTER} s after resume()`);
      this.notify('blocked');
    }, BLOCKED_AFTER * 1000);
  }

  stateChanged() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.log.info(`[sound] context ${ctx.state}`);
    if (ctx.state === 'running') {
      this.blocked = false;
      if (!this.latencyLogged) {
        this.latencyLogged = true;
        this.log.info(`[sound] output latency ${Math.round((ctx.outputLatency || 0) * 1000)} ms, base ${Math.round((ctx.baseLatency || 0) * 1000)} ms, ${ctx.sampleRate} Hz`);
      }
    }
  }

  // The graph: clicks and notes on their buses, a master gain, a compressor, the speakers.
  build() {
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    const set = (param, v) => { if (param) param.value = v; };
    set(comp.threshold, -10); set(comp.knee, 6); set(comp.ratio, 6); set(comp.attack, 0.003); set(comp.release, 0.1);
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this.clickBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.clickBus.connect(this.master);
    this.voiceBus.connect(this.master);
    this.clickBuffers = {};
    for (const [kind, spec] of Object.entries(CLICKS)) {
      const data = clickSamples(ctx.sampleRate, spec);
      const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      this.clickBuffers[kind] = b;
    }
    this.scheduler = new Scheduler(this.port());
  }

  // The 21 samples, one at a time (at most one decoded file in memory besides those kept).
  async loadSamples() {
    const ctx = this.ctx;
    this.samples = 'loading';
    const t0 = this.now();
    try {
      for (const s of SAMPLES) {
        const res = await this.get(`${this.base}${s.name}.mp3`, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${s.name}.mp3`);
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
        const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
        const { data, onset, rms } = trimSample(channels, decoded.sampleRate);
        if (!(rms > 0)) throw new Error(`${s.name}.mp3 is silent`);
        const buffer = ctx.createBuffer(1, data.length, decoded.sampleRate);
        buffer.getChannelData(0).set(data);
        this.buffers.set(s.midi, { buffer, onset, normalise: TARGET_RMS / rms });
      }
      this.samples = 'ready';
      this.log.info(`[sound] samples ready: ${this.buffers.size} in ${Math.round((this.now() - t0) * 1000)} ms`);
    } catch (e) {
      this.samples = 'failed';
      this.buffers.clear();
      this.log.warn(`[sound] samples failed: ${e.message}`);
      this.notify('samples');
    }
  }

  // The port schedule.js drives.
  port() {
    const ctx = this.ctx;
    const sound = this;
    return {
      get currentTime() { return ctx.currentTime; },
      get outputLatency() { return ctx.outputLatency; },
      get baseLatency() { return ctx.baseLatency; },
      stamp: () => (ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null),
      click(when, click) {
        const src = ctx.createBufferSource();
        src.buffer = sound.clickBuffers[click.kind] || sound.clickBuffers.beat;
        src.connect(sound.clickBus);
        src.onended = () => src.disconnect();
        src.start(when);
        return { src };
      },
      note(when, end, note) {
        const s = sampleFor(note.midi);
        const sample = sound.buffers.get(s.midi);
        if (!sample) return null; // the samples are not in yet: the note is left out
        const src = ctx.createBufferSource();
        src.buffer = sample.buffer;
        src.playbackRate.value = s.rate;
        const gain = ctx.createGain();
        const g = noteGain(sample.normalise, note.velocity);
        gain.gain.setValueAtTime(g, 0);
        gain.gain.setValueAtTime(g, end);
        gain.gain.setTargetAtTime(0, end, 0.06);
        src.connect(gain);
        gain.connect(sound.voiceBus);
        src.onended = () => { src.disconnect(); gain.disconnect(); };
        src.start(when, sample.onset);
        src.stop(end + 0.4);
        const h = { src, gain, when, end: end + 0.4 };
        sound.voice(h, when);
        return h;
      },
      // not started: it never plays, nor counts among the sounding notes
      cancel(h) {
        try { h.src.stop(0); } catch { /* stopped */ }
        try { h.src.disconnect(); } catch { /* gone */ }
        if (sound.voices.includes(h)) sound.voices = sound.voices.filter(v => v !== h);
      },
      // sounding: a short fade from `at`
      release(h, at) { sound.fade(h, at, RELEASE_STOP); },
    };
  }

  fade(h, at, seconds) {
    if (!h.gain) return;
    const g = h.gain.gain;
    g.cancelScheduledValues(at);
    g.setTargetAtTime(0, at, seconds / 3);
    try { h.src.stop(at + seconds * 2); } catch { /* stopped */ }
    h.end = Math.min(h.end, at + seconds * 2);
  }

  // A new sounding note: past VOICES the oldest is released over 20 ms where the new one starts.
  voice(h, when) {
    const cur = this.ctx.currentTime;
    this.voices = this.voices.filter(v => v.end > cur);
    this.voices.push(h);
    while (this.voices.length > VOICES) this.fade(this.voices.shift(), Math.max(cur, when), 0.02);
  }

  // Real s a clock started again now should stand first, so that what it plays first is heard on
  // it (schedule.js Scheduler.lead); 0 while nothing renders.
  lead() {
    if (!this.ctx || this.halted || this.ctx.state !== 'running' || !this.on()) return 0;
    return this.scheduler.lead(this.now());
  }

  // Each frame, and inside a user's action that changes what sounds (App.soundNow), so a frame
  // that comes late neither lets a held song ring on nor makes a resume's first onsets late.
  // view: schedule.js Scheduler.tick's (null: nothing may sound).
  tick(view) {
    if (!this.ctx) return;
    const s = this.settings();
    const gains = [busGain(s.metronome.volume) * CLICK_LEVEL, busGain(s.voice.volume)];
    if (!this.volumes || gains.some((v, i) => v !== this.volumes[i])) {
      this.volumes = gains;
      this.clickBus.gain.value = gains[0];
      this.voiceBus.gain.value = gains[1];
    }
    const on = s.metronome.on || s.voice.on;
    if (this.ctx.state !== 'running' || !on) {
      // not rendering, or both off: nothing pending, no stamps kept; both off, a suspended
      // context renders nothing
      if (!this.halted) { this.scheduler.stop(this.ctx.currentTime); this.halted = true; }
      if (!on && this.ctx.state === 'running' && !this.suspending) {
        this.suspending = true;
        try { const p = this.ctx.suspend(); if (p && p.catch) p.catch(() => {}); } catch { /* closed */ }
      }
      return;
    }
    this.halted = false;
    // the samples loading stall frames: look further ahead meanwhile
    this.scheduler.lookahead = this.samples === 'loading' ? BUSY_LOOKAHEAD : LOOKAHEAD;
    this.scheduler.tick(this.now(), view);
  }

  // A notice for the playing pages, each kind once a page load, for NOTICE_SECONDS.
  notify(kind) {
    if (this.noticeShown.has(kind)) return;
    this.noticeShown.add(kind);
    this.shown = { kind, until: this.now() + NOTICE_SECONDS };
  }

  // The strip the playing pages show now, or null.
  notice() {
    if (!this.shown || this.now() >= this.shown.until) return null;
    return { title: NOTICES[this.shown.kind] };
  }

  // What the «Звук» page says about the sound itself: why it is silent, or that the samples are
  // on their way; '' when all is well. -> {problem, loading}
  status() {
    const problem = this.failed || this.blocked ? NOTICES.blocked : this.samples === 'failed' ? NOTICES.samples : '';
    return { problem, loading: this.samples === 'loading' };
  }

  get stats() { return this.scheduler ? this.scheduler.stats : null; }
}
