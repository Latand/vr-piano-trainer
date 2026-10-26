// A parsed MIDI file made playable: hands, the keyboard's range, and the song clock.
import { LOW, HIGH } from './geometry.js';
import { buildTempoMap } from './tempo.js';
import { LEAD, LEAD_RANGE } from './scene.js';

export const MIDDLE_C = 60;
const RIGHT_NAME = /\b(right|rh|treble|upper|soprano)\b|прав/i;
const LEFT_NAME = /\b(left|lh|bass|lower)\b|лів/i;
const DRUM_CHANNEL = 9;

// notes from parseSmf -> {notes: [{midi, start, end, hand}], hands: 'two'|'split'|'one', shifted}
export function prepareSong(smf, { low = LOW, high = HIGH } = {}) {
  const notes = smf.notes.filter(n => n.channel !== DRUM_CHANNEL && n.end >= n.start);
  // A voice is one track and channel; a format 0 file keeps its hands on two channels.
  const voices = new Map();
  for (const n of notes) {
    const key = `${n.track}:${n.channel}`;
    if (!voices.has(key)) voices.set(key, { key, track: n.track, sum: 0, count: 0 });
    const v = voices.get(key);
    v.sum += n.midi; v.count++;
  }
  const names = new Map(smf.tracks.map(t => [t.index, t.name || '']));
  const list = [...voices.values()];
  let handOf;
  let hands;
  const named = list.map(v => {
    const name = names.get(v.track);
    return RIGHT_NAME.test(name) ? 'right' : LEFT_NAME.test(name) ? 'left' : null;
  });
  if (list.length >= 2 && named.every(Boolean) && named.includes('right') && named.includes('left')) {
    const byKey = new Map(list.map((v, i) => [v.key, named[i]]));
    handOf = n => byKey.get(`${n.track}:${n.channel}`);
    hands = 'two';
  } else if (list.length === 2) {
    const [a, b] = list;
    const right = a.sum / a.count >= b.sum / b.count ? a.key : b.key;
    handOf = n => (`${n.track}:${n.channel}` === right ? 'right' : 'left');
    hands = 'two';
  } else if (list.length > 2) {
    const byKey = new Map(list.map(v => [v.key, v.sum / v.count >= MIDDLE_C ? 'right' : 'left']));
    handOf = n => byKey.get(`${n.track}:${n.channel}`);
    hands = new Set(byKey.values()).size === 2 ? 'two' : 'one';
  } else {
    // One voice: split at middle C (design §6.1).
    handOf = n => (n.midi >= MIDDLE_C ? 'right' : 'left');
    hands = 'split';
  }
  let shifted = 0;
  const out = notes.map(n => {
    let midi = n.midi;
    while (midi < low) midi += 12;
    while (midi > high) midi -= 12;
    if (midi !== n.midi) shifted++;
    return { midi, start: n.start, end: n.end, hand: handOf(n), velocity: n.velocity };
  });
  out.sort((a, b) => a.start - b.start || a.midi - b.midi);
  const title = smf.tracks.map(t => t.name).find(Boolean) || '';
  const end = out.reduce((m, n) => Math.max(m, n.end), 0);
  return {
    notes: out,
    hands,
    shifted,
    title,
    start: out.length ? out[0].start : 0,
    end,
    longest: out.reduce((m, n) => Math.max(m, n.end - n.start), 0),
    tempo: buildTempoMap({ ...smf, end }),
    // the file's own tempo events and time signatures, in seconds as smf.js read them: the clock
    // the notes were placed by, for the bar lines (barlines.js barGrid); the map above evens out
    // a played-in file's drift for the metronome and would let the lines drift off the notes
    timeline: { smpte: !!smf.smpte, tempos: smf.tempos || [], meters: smf.meters || [] },
  };
}

export const SPEEDS = [0.1, 0.25, 0.5, 0.75, 0.9, 1];
export const LEAD_IN = 3; // song seconds before the first note: one full fall
export const LOOP_PREROLL = 1;
// At the slow speeds a song-time wait would stretch: 3 song seconds take 30 s at 10 %. The wait
// before the first note and the loop's pre-roll stop at these real seconds (50 % reaches both).
export const LEAD_IN_MAX = 6;
export const LOOP_PREROLL_MAX = 2;
// The loop's pre-roll is never shorter than the keys' build-up (scene.js LEAD) and this many real
// seconds more, so after each wrap the first note's key starts empty and fills all the way.
export const PREROLL_SPARE = 0.25;
// With the metronome on, the lead-in holds one whole bar of clicks before the bar of the first
// note (its last COUNT_IN_MAX real seconds at the slowest speeds), and the first click comes
// START_GAP real seconds after the press: the context the press makes holds the page and its frames
// until about 0.35 s after it, its first output stamps to trust are read about 0.4 s after it, and
// it renders about 0.17 s ahead (headless Chrome, measured), so the first click is placed by them
// (docs/piano-audio-design.md §3.3, §4.3).
export const COUNT_IN_MAX = 12;
export const START_GAP = 0.8;
// A seek with an A–B loop stops this many song seconds before B (time() folds B itself back).
export const SEEK_BEFORE_B = 0.001;

// The song clock. Song time runs at `speed` times real time while playing. Every method takes
// the real time `now` in seconds, so tests drive it without a clock.
export class Transport {
  // lead: real seconds a key builds up before its note (scene.js frameAt).
  constructor(song, now = 0, { lead = LEAD } = {}) {
    this.song = song;
    this.speed = 1;
    this.lead = lead;
    this.loop = null; // {a} while choosing, {a, b} while looping
    this.countIn = null; // {line, bar} (barlines.js countInBar) while the metronome is on
    this.restart(now);
  }

  restart(now) {
    this.starts = (this.starts || 0) + 1; // counts the starts from the lead-in (schedule.js)
    this.playing = false;
    this.anchorSong = this.startTime();
    this.anchorReal = now;
  }

  // Where restart puts the clock: the lead-in before the first note, at most LEAD_IN_MAX real s,
  // and at least the keys' lead and PREROLL_SPARE real s, so the first key fills all the way;
  // with a count-in, early enough for one bar of clicks (at most COUNT_IN_MAX real s of it)
  // START_GAP real s after the press.
  startTime() {
    const t = this.song.start - Math.max(Math.min(LEAD_IN, LEAD_IN_MAX * this.speed), (this.lead + PREROLL_SPARE) * this.speed);
    const c = this.countIn;
    if (!c) return t;
    return Math.min(t, c.line - Math.min(c.bar, COUNT_IN_MAX * this.speed) - START_GAP * this.speed);
  }

  get endTime() { return this.song.end + 1; }

  // Before anchorReal (a play's hold) the clock stands at anchorSong.
  time(now) {
    let t = this.anchorSong + (this.playing ? Math.max(0, now - this.anchorReal) * this.speed : 0);
    if (this.loop && this.loop.b !== undefined && t >= this.loop.b) {
      const from = this.loopFrom();
      t = from + ((t - this.loop.b) % (this.loop.b - from));
    }
    return Math.min(t, this.endTime);
  }

  ended(now) { return this.time(now) >= this.endTime; }

  // Where a loop starts again: LOOP_PREROLL song seconds before A, at most LOOP_PREROLL_MAX real
  // seconds, and at least the keys' lead and PREROLL_SPARE in real seconds.
  loopFrom() {
    const real = Math.max(Math.min(LOOP_PREROLL / this.speed, LOOP_PREROLL_MAX), this.lead + PREROLL_SPARE);
    return this.loop.a - real * this.speed;
  }

  rebase(now) {
    this.anchorSong = this.time(now);
    this.anchorReal = now;
  }

  // hold: real s the clock stands before it moves (the sound's lead, audio.js Sound.lead), so the
  // notes due right after a resume are heard where it puts them.
  play(now, hold = 0) {
    if (this.ended(now)) this.restart(now);
    this.rebase(now);
    this.anchorReal = now + hold;
    this.playing = true;
  }

  pause(now) {
    this.rebase(now);
    this.playing = false;
  }

  toggle(now) { if (this.playing) this.pause(now); else this.play(now); }

  // The clock put at song time `time` (a scrub, scrub.js), playing or standing as it was, clamped
  // to where it can stand: from where restart puts it (the lead-in) to the end, or with an A–B
  // loop to just before its B, so it is never folded back into the loop. -> the time it stands at.
  seek(time, now) {
    const lo = this.startTime();
    const hi = this.loop && this.loop.b !== undefined ? this.loop.b - SEEK_BEFORE_B : this.endTime;
    this.anchorSong = Math.max(lo, Math.min(hi, time));
    this.anchorReal = now;
    return this.anchorSong;
  }

  // A clock standing at the start of the song moves to the new speed's lead-in.
  setSpeed(speed, now) {
    if (!SPEEDS.includes(speed)) throw new RangeError(`speed ${speed}`);
    this.rebase(now);
    const atStart = !this.playing && this.anchorSong === this.startTime();
    this.speed = speed;
    if (atStart) this.anchorSong = this.startTime();
  }

  // A new lead (real seconds, within LEAD_RANGE); a clock standing at the start moves to the
  // lead-in it needs.
  setLead(lead, now) {
    if (!(Number.isFinite(lead) && lead >= LEAD_RANGE[0] && lead <= LEAD_RANGE[1])) throw new RangeError(`lead ${lead}`);
    this.rebase(now);
    const atStart = !this.playing && this.anchorSong === this.startTime();
    this.lead = lead;
    if (atStart) this.anchorSong = this.startTime();
  }

  // The count-in on (barlines.js countInBar) or off (null); a clock standing at the start moves to
  // the lead-in it needs.
  setCountIn(countIn, now) {
    this.rebase(now);
    const atStart = !this.playing && this.anchorSong === this.startTime();
    this.countIn = countIn || null;
    if (atStart) this.anchorSong = this.startTime();
  }

  // The song intervals the real interval [r0, r1) plays while playing: [{from, to, at, wrap}],
  // split at every loop wrap and ending at endTime; at: the real time of from; wrap: the loop's B
  // when the interval ends at a wrap, else null. Nothing when the clock stands.
  spans(r0, r1) {
    const out = [];
    r0 = Math.max(r0, this.anchorReal); // nothing plays in a hold
    if (!this.playing || !(r1 > r0)) return out;
    let r = r0, t = this.time(r0);
    for (let guard = 0; guard < 64 && r < r1 && t < this.endTime; guard++) {
      const loop = this.loop && this.loop.b !== undefined && t < this.loop.b ? this.loop : null;
      const stop = loop ? Math.min(loop.b, this.endTime) : this.endTime;
      const rStop = r + (stop - t) / this.speed;
      const rEnd = Math.min(r1, rStop);
      const wraps = !!loop && rEnd === rStop && stop === loop.b;
      out.push({ from: t, to: wraps ? stop : t + (rEnd - r) * this.speed, at: r, wrap: wraps ? loop.b : null });
      if (!wraps) break;
      r = rStop;
      t = this.loopFrom();
    }
    return out;
  }

  nextSpeed(now) { this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length], now); }

  // Off -> A here -> A..B looping -> off. A B no later than A clears the loop.
  cycleLoop(now) {
    const t = Math.max(this.song.start, this.time(now));
    if (!this.loop) { this.loop = { a: t }; return 'a'; }
    if (this.loop.b === undefined && t > this.loop.a + 0.25) {
      this.rebase(now);
      this.loop = { a: this.loop.a, b: t };
      return 'ab';
    }
    this.rebase(now);
    this.loop = null;
    return 'off';
  }
}
