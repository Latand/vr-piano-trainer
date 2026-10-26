// The metronome's clicks and the song's notes placed on the audio clock (docs/piano-audio-design.md
// §3). The transport (song.js) stays the only clock: each tick schedules what falls due in the next
// short window, each event placed by itself through the mapping from performance time to the
// context time the device plays at that moment (ClockMap), so nothing accumulates and the sound
// cannot drift from the falling notes. A change of what the transport maps (pause, play, restart,
// speed, lead, loop, level, song) cancels everything not yet started and schedules again. Pure:
// the audio itself is behind a port (audio.js Sound; the tests' fake device).
import { songAtLevel } from './levels.js';
import { START_GAP } from './song.js';

// Real s scheduled ahead of what the context renders (its output latency ahead of what is
// heard): 14 frames at 72 Hz, so a stalled frame of up to that long loses nothing.
export const LOOKAHEAD = 0.2;
// While the page has heavy work of its own on its thread (the samples decoding and trimmed after
// the first gesture stall frames by up to 0.35 s in Chrome), it looks this far ahead.
export const BUSY_LOOKAHEAD = 0.6;
export const LATE_DROP = 0.03; // an onset later than this is dropped: it would be heard as a wrong note
export const RELEASE_STOP = 0.03; // the fade of sounding notes at a pause, a stop or a new song
export const CLOCK_RING = 16; // output stamps the mapping's median is taken over
// When the mapping moves by more than this from the one an event was placed by (the first real
// output stamps after the context's start, another device), what is not started is placed again.
export const REPLACE_SHIFT = 0.004;
export const STATS_RING = 256; // the last events kept for the browser smoke
// A clock started again (a resume, a scrub let go) stands first for what the context renders
// ahead of what is heard, and this more, so its first onsets can still be heard on it; at most
// RESUME_MAX (s).
export const RESUME_SPARE = 0.01;
export const RESUME_MAX = 0.5;
const FRESH_BACK = 0.1; // a fresh play schedules from its press, at most this far back
// A change that moves the song time by more than this (song s; a loop's B set folds it back to the
// loop's start) lets nothing ring on; a speed or level change, seen a frame after it was made,
// moves it by a few milliseconds at most.
const MOVED = 0.05;

// The notes the song voice plays: every note of the level being played, both hands, with the
// file's own lengths (the operator's answer, §5.1). One array per song and level (levels.js
// caches it), so the scheduler sees a change by reference.
export function voiceNotes(song, level) {
  return song ? songAtLevel(song, level).notes : null;
}

// Performance time (s) -> the context time of the sample the device plays then. Each tick reads
// one output stamp; the mean of the middle half of the last CLOCK_RING offsets is used, so a
// few milliseconds of jitter are absorbed and a change of device is followed within CLOCK_RING ticks. Without a
// stamp (none yet, or no getOutputTimestamp) the context's time less its output latency. Right
// after the context starts Chrome gives empty stamps and an output latency of 0, then for about
// 0.1 s stamps whose context time stands still while their performance time runs (offsets 85 ms,
// then 41 ms off): a stamp counts once two in a row move together (both clocks advanced by the same
// time, STAMP_AGREE), and the first such drops every guess from the ring; from then on a tick
// without a stamp leaves the mapping as it is.
export const STAMP_AGREE = 0.01;
export class ClockMap {
  constructor() { this.ring = []; this.offset = 0; this.stamped = false; this.last = null; }

  // port: {currentTime, stamp() -> {contextTime, performanceTime (ms)} | null, outputLatency, baseLatency}
  update(port, now) {
    const st = port.stamp ? port.stamp() : null;
    let real = !!(st && st.contextTime > 0 && st.performanceTime > 0);
    if (real && !this.stamped) {
      // a new stamp: trusted when it moved on from the last one with the performance clock
      const c = st.contextTime, p = st.performanceTime / 1000, l = this.last;
      if (!l || c !== l.c) {
        if (l && c > l.c && p > l.p && Math.abs((c - l.c) - (p - l.p)) < STAMP_AGREE) { this.ring = []; this.stamped = true; }
        this.last = { c, p };
      }
      real = this.stamped;
    }
    if (!real && this.stamped) return this.offset;
    const off = real ? st.contextTime - st.performanceTime / 1000
      : port.currentTime - now - (port.outputLatency || port.baseLatency || 0);
    if (!Number.isFinite(off)) return this.offset;
    this.ring.push(off);
    if (this.ring.length > CLOCK_RING) this.ring.shift();
    // the mean of the middle half: outliers fall off either end, the jitter averages out
    const sorted = [...this.ring].sort((a, b) => a - b);
    const q = sorted.length >> 2, mid = sorted.slice(q, sorted.length - q);
    this.offset = mid.reduce((a, v) => a + v, 0) / mid.length;
    return this.offset;
  }

  ctxAt(p) { return p + this.offset; }
}

// First index of `list` (sorted by `of`) at or after v.
function lowerBound(list, v, of) {
  let lo = 0, hi = list.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (of(list[mid]) < v) lo = mid + 1; else hi = mid; }
  return lo;
}
const startOf = n => n.start;
const clickTime = c => c.t;

// port: the ClockMap's fields and click(when, click) -> handle, note(when, endWhen, note) ->
// handle (null: not playable now, e.g. samples not loaded), cancel(handle) for one not started,
// release(handle, at) for one sounding.
export class Scheduler {
  constructor(port) {
    this.port = port;
    this.map = new ClockMap();
    this.key = null; // what the pending events were made with (keyOf)
    this.until = null; // real time scheduled up to
    this.songUntil = null; // and the song time it ended at
    this.clickFrom = -Infinity; // a fresh play: no click before its press + START_GAP
    this.pending = []; // [{handle, kind, when, end, due, event, off}] (off: the mapping it was placed by)
    this.started = null; // after a move of the mapping: the events already started (replace)
    this.was = null; // a copy of the transport the pending events were made with
    this.lookahead = LOOKAHEAD; // BUSY_LOOKAHEAD while the page is busy (audio.js Sound.tick)
    this.stats = { scheduled: 0, late: 0, dropped: 0, cancelled: 0, replaced: 0, events: [] };
  }

  // Once a frame. now: performance time in seconds; view: null when nothing may sound, else
  // {transport, clicks: [{t, kind}] | null, notes: [{midi, start, end, velocity}] | null}.
  tick(now, view) {
    const port = this.port;
    const offset = this.map.update(port, now);
    const cur = port.currentTime;
    if (this.pending.some(p => p.when > cur && Math.abs(p.off - offset) > REPLACE_SHIFT)) this.replace(cur, offset);
    const key = view && view.transport ? keyOf(view) : null;
    const was = this.key;
    if (!sameKey(key, was)) {
      // the clock stopped, started again from the start, or another song: what sounds fades; a
      // change while playing lets it ring, unless it moved the song time (a loop's B set)
      const jump = !was || was[0] !== key?.[0] || was[9] !== key?.[9] || was[10] !== key?.[10];
      const moved = !jump && was[4] && key[4] && Math.abs(this.was.time(now) - view.transport.time(now)) > MOVED;
      const release = !key || !key[4] || jump || moved;
      this.flush(cur, release);
      this.key = key;
      this.was = key ? copyOf(view.transport) : null;
      this.songUntil = null;
      this.started = null;
      if (!key || !key[4]) { this.until = null; return; }
      const t = view.transport;
      if (!was || !was[4] || jump) {
        // a fresh play: from its press (what is already late follows the late rule)
        this.until = Math.max(t.anchorReal, now - FRESH_BACK);
        this.clickFrom = t.anchorReal + START_GAP;
      } else {
        // from what the context renders next, so nothing rendered is scheduled twice
        this.until = now + (cur - this.map.ctxAt(now));
        this.clickFrom = -Infinity;
      }
    }
    if (!key || !key[4]) { this.prune(cur); return; }
    const to = now + (cur - this.map.ctxAt(now)) + this.lookahead;
    if (to > this.until) {
      this.schedule(view, this.until, to, cur);
      this.until = to;
    }
    this.prune(cur);
  }

  // How far ahead of what is heard the context renders now (s), by the mapping as it stands; null
  // before the mapping has a stamp or a guess.
  latency(now) {
    return this.map.ring.length ? this.port.currentTime - this.map.ctxAt(now) : null;
  }

  // Real s a clock that starts moving now should stand first (Transport.play's hold): an onset
  // due sooner than the context's latency could not be heard on time, and would be late or
  // dropped. 0 without a mapping.
  lead(now) {
    const l = this.latency(now);
    return l === null ? 0 : Math.min(RESUME_MAX, Math.max(0, l) + RESUME_SPARE);
  }

  // The mapping moved: every event not started that the new mapping can still place in time is
  // cancelled, and the window goes back to the earliest of them, so this tick's schedule places
  // them again (what already started stays, and is not placed twice; one the new mapping would
  // put in the past keeps its place).
  replace(cur, offset) {
    const again = this.pending.filter(p => p.when > cur && p.due + offset >= cur);
    if (!again.length || this.until === null) return;
    const from = Math.min(...again.map(p => p.due));
    for (const p of again) { this.port.cancel(p.handle); this.stats.cancelled++; }
    this.pending = this.pending.filter(p => !again.includes(p));
    this.started = new Set(this.pending.filter(p => p.due >= from - 1e-6).map(p => p.event));
    this.until = Math.min(this.until, from - 1e-6);
    this.songUntil = null;
    this.stats.replaced += again.length;
  }

  // The context stopped rendering (suspended, blocked): what is pending goes, and so do the
  // output stamps, whose clock stood meanwhile.
  stop(cur) {
    this.flush(cur, true);
    this.key = null;
    this.until = null;
    this.songUntil = null;
    this.map = new ClockMap();
  }

  // Everything not started is cancelled (it never plays); with release, what sounds fades.
  flush(cur, release) {
    const keep = [];
    for (const p of this.pending) {
      if (p.when > cur) { this.port.cancel(p.handle); this.stats.cancelled++; continue; }
      if (release && p.kind === 'note' && p.end > cur) { this.port.release(p.handle, cur); continue; }
      keep.push(p);
    }
    this.pending = keep;
  }

  prune(cur) {
    if (this.pending.some(p => p.end < cur)) this.pending = this.pending.filter(p => p.end >= cur);
  }

  schedule(view, r0, r1, cur) {
    const t = view.transport;
    const loop = t.loop && t.loop.b !== undefined ? t.loop : null;
    const spans = t.spans(r0, r1);
    spans.forEach((s, i) => {
      // the window goes on from the song time the last one ended at, so an event on the
      // boundary is neither left out nor scheduled twice
      const from = i === 0 && this.songUntil !== null && Math.abs(s.from - this.songUntil) < 1e-6 ? this.songUntil : s.from;
      const due = x => s.at + (x - s.from) / t.speed;
      if (view.clicks) {
        const list = view.clicks;
        for (let k = lowerBound(list, from, clickTime); k < list.length && list[k].t < s.to; k++) {
          const d = due(list[k].t);
          if (d < this.clickFrom - 1e-9) continue;
          this.emit('click', d, null, list[k], cur);
        }
      }
      if (view.notes) {
        const list = view.notes;
        // a note sounding into the loop's B is released there
        const cap = loop && s.from < loop.b ? loop.b : Infinity;
        for (let k = lowerBound(list, from, startOf); k < list.length && list[k].start < s.to; k++) {
          const n = list[k];
          this.emit('note', due(n.start), due(Math.min(n.end, cap)), n, cur);
        }
      }
    });
    if (spans.length) this.songUntil = spans[spans.length - 1].wrap === null ? spans[spans.length - 1].to : null;
    this.started = null;
  }

  emit(kind, due, endDue, event, cur) {
    if (this.started && this.started.has(event)) return; // placed again after a move: it already started
    let when = this.map.ctxAt(due);
    let late = false;
    if (when < cur) {
      if (cur - when > LATE_DROP) { this.stats.dropped++; this.record({ kind, t: kind === 'note' ? event.start : event.t, due, when, dropped: cur - when }); return; }
      when = cur;
      late = true;
      this.stats.late++;
    }
    const end = kind === 'note' ? Math.max(when + 0.05, this.map.ctxAt(endDue)) : when + 0.1;
    const handle = kind === 'note' ? this.port.note(when, end, event) : this.port.click(when, event);
    if (handle === null || handle === undefined) return;
    this.pending.push({ handle, kind, when, end: kind === 'note' ? end + 0.4 : end, due, event, off: this.map.offset });
    this.stats.scheduled++;
    this.record({ kind, t: kind === 'note' ? event.start : event.t, due, when, late, ...(kind === 'note' ? { midi: event.midi } : { click: event.kind }) });
  }

  // the last STATS_RING events, scheduled or dropped (dropped: how late it was, s)
  record(e) {
    const ev = this.stats.events;
    ev.push(e);
    if (ev.length > STATS_RING) ev.shift();
  }
}

// The transport as it is now, to tell later where its song time stood (time()).
function copyOf(t) {
  return Object.assign(Object.create(Object.getPrototypeOf(t)), t, { loop: t.loop && { ...t.loop } });
}

// What the pending events were made with: the transport, its mapping, and what may sound.
function keyOf(v) {
  const t = v.transport;
  return [t, t.anchorSong, t.anchorReal, t.speed, t.playing, t.loop ? t.loop.a : null, t.loop ? t.loop.b ?? null : null, v.clicks, v.notes, t.song, t.starts];
}
function sameKey(a, b) {
  if (!a || !b) return a === b;
  return a.every((v, i) => v === b[i]);
}
