// Standard MIDI File reader: tracks, tempo map, time signatures, notes in seconds.
// A Note On with velocity 0 is a release (design §3.4). Throws SmfError on a file it cannot read.

export class SmfError extends Error {}

export function parseSmf(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const r = new Reader(bytes);
  if (r.ascii(4) !== 'MThd') throw new SmfError('not a MIDI file (no MThd)');
  const headerLen = r.u32();
  if (headerLen < 6) throw new SmfError('short MIDI header');
  const format = r.u16();
  const trackCount = r.u16();
  const division = r.u16();
  r.skip(headerLen - 6);
  if (format > 2) throw new SmfError(`unknown MIDI format ${format}`);
  if (format === 2) throw new SmfError('MIDI format 2 (independent sequences) is not supported');
  if (division === 0) throw new SmfError('MIDI division is zero');

  const tracks = [];
  for (let i = 0; i < trackCount && r.pos < bytes.length; i++) {
    const id = r.ascii(4);
    const len = r.u32();
    const end = r.pos + len;
    if (end > bytes.length) throw new SmfError(`track ${i} runs past the end of the file`);
    if (id !== 'MTrk') { r.pos = end; continue; }
    tracks.push(readTrack(new Reader(bytes.subarray(r.pos, end)), tracks.length));
    r.pos = end;
  }
  if (!tracks.length) throw new SmfError('no tracks');

  const allTempos = tracks.flatMap(t => t.tempos);
  const toSeconds = timeMap(division, allTempos);
  const smpte = !!(division & 0x8000);
  const notes = [];
  for (const t of tracks) {
    for (const n of t.notes) {
      notes.push({
        midi: n.midi, velocity: n.velocity, channel: n.channel, track: t.index,
        start: toSeconds(n.on), end: toSeconds(n.off),
      });
    }
  }
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi || a.track - b.track);
  return {
    format, division,
    tracks: tracks.map(t => ({ index: t.index, name: t.name, noteCount: t.notes.length })),
    notes,
    duration: notes.reduce((m, n) => Math.max(m, n.end), 0),
    // Frame-based (SMPTE) time has no beats: no tempos and no meters then.
    smpte,
    tempos: smpte ? [] : lastAtTick(allTempos).map(t => ({ seconds: toSeconds(t.tick), usPerQuarter: t.usPerQuarter })),
    meters: smpte ? [] : lastAtTick(tracks.flatMap(t => t.meters)).map(m => ({ seconds: toSeconds(m.tick), num: m.num, den: m.den })),
  };
}

// Events sorted by tick; of several at one tick the one read last counts.
function lastAtTick(events) {
  const byTick = new Map();
  for (const e of events) byTick.set(e.tick, e);
  return [...byTick.values()].sort((a, b) => a.tick - b.tick);
}

function readTrack(r, index) {
  const notes = [];
  const tempos = [];
  const meters = [];
  const open = new Map(); // channel*128+midi -> [{on, velocity}], oldest first
  let name = '';
  let tick = 0;
  let status = 0;
  while (r.pos < r.bytes.length) {
    tick += r.varlen();
    let b = r.u8();
    if (b === 0xff) {
      const type = r.u8();
      const len = r.varlen();
      const data = r.take(len);
      if (type === 0x51 && len === 3) tempos.push({ tick, usPerQuarter: (data[0] << 16) | (data[1] << 8) | data[2] });
      else if (type === 0x58 && len >= 2 && data[0] > 0 && data[1] < 8) meters.push({ tick, num: data[0], den: 2 ** data[1] });
      else if (type === 0x03 && !name) name = decodeText(data);
      else if (type === 0x2f) break;
      continue;
    }
    if (b === 0xf0 || b === 0xf7) { r.skip(r.varlen()); status = 0; continue; }
    if (b < 0x80) {
      if (!status) throw new SmfError(`running status without a status byte in track ${index}`);
      r.pos--;
      b = status;
    } else {
      status = b;
    }
    const kind = b & 0xf0;
    const channel = b & 0x0f;
    if (kind === 0xc0 || kind === 0xd0) { r.u8(); continue; }
    const d1 = r.u8();
    const d2 = r.u8();
    if (kind !== 0x90 && kind !== 0x80) continue;
    const key = channel * 128 + d1;
    if (kind === 0x90 && d2 > 0) {
      if (!open.has(key)) open.set(key, []);
      open.get(key).push({ on: tick, velocity: d2 });
    } else {
      const stack = open.get(key);
      if (!stack || !stack.length) continue; // a release without a press
      const n = stack.shift();
      notes.push({ midi: d1, channel, velocity: n.velocity, on: n.on, off: Math.max(tick, n.on) });
    }
  }
  // Notes still held at the end of the track end there.
  for (const [key, stack] of open) {
    for (const n of stack) notes.push({ midi: key % 128, channel: Math.floor(key / 128), velocity: n.velocity, on: n.on, off: Math.max(tick, n.on) });
  }
  return { index, name, notes, tempos, meters };
}

// Tick -> seconds through the tempo map (120 BPM until the first tempo event).
export function timeMap(division, tempos) {
  if (division & 0x8000) {
    const fps = 256 - (division >> 8);
    const perFrame = division & 0xff;
    const rate = (fps === 29 ? 29.97 : fps) * perFrame;
    return tick => tick / rate;
  }
  const sorted = [...tempos].sort((a, b) => a.tick - b.tick);
  const segments = [{ tick: 0, seconds: 0, usPerQuarter: 500000 }];
  for (const t of sorted) {
    const last = segments[segments.length - 1];
    const seconds = last.seconds + ((t.tick - last.tick) * last.usPerQuarter) / (division * 1e6);
    if (t.tick === last.tick) last.usPerQuarter = t.usPerQuarter;
    else segments.push({ tick: t.tick, seconds, usPerQuarter: t.usPerQuarter });
  }
  return tick => {
    let lo = 0, hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].tick <= tick) lo = mid; else hi = mid - 1;
    }
    const s = segments[lo];
    return s.seconds + ((tick - s.tick) * s.usPerQuarter) / (division * 1e6);
  };
}

function decodeText(data) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data).trim(); }
  catch { return String.fromCharCode(...data).trim(); }
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.pos = 0; }
  need(n) { if (this.pos + n > this.bytes.length) throw new SmfError('MIDI data ends early'); }
  u8() { this.need(1); return this.bytes[this.pos++]; }
  u16() { this.need(2); const v = (this.bytes[this.pos] << 8) | this.bytes[this.pos + 1]; this.pos += 2; return v; }
  u32() { this.need(4); const b = this.bytes, p = this.pos; this.pos += 4; return ((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3]; }
  take(n) { this.need(n); const v = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  skip(n) { this.need(n); this.pos += n; }
  ascii(n) { return String.fromCharCode(...this.take(n)); }
  varlen() {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new SmfError('variable-length number longer than four bytes');
  }
}
