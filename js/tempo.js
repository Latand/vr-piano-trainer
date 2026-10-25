// The song's tempo and meter as the player sets them on a metronome of his own, at the trainer's
// speed: the beats per minute, the meter, a finer click when the beat is too slow for a
// metronome, and a warning one bar before the tempo or the meter changes. Pure.

// Most metronomes go no slower than this; a slower beat is offered as a finer click too.
export const METRONOME_MIN = 40;
// Tempo events closer than this to the tempo shown are one tempo (a played-in file drifts a
// little on every beat). Drift that adds up past it starts a new tempo. The tempo shown for such
// a run is its mean over time: the beats of the run over its minutes, so a metronome set to it
// keeps up with the notes to the end of the run.
export const SAME_TEMPO = 0.02;
const DEFAULT_US = 500000; // 120 BPM until the first tempo event (the MIDI standard)
const DEFAULT_METER = { num: 4, den: 4 }; // and 4/4 until the first time signature

// Note values in quarters -> what a click falls on, after «на».
const VALUE_NAME = new Map([
  [4, 'цілі'], [3, 'половинні з крапкою'], [2, 'половинні'], [1.5, 'чверті з крапкою'], [1, 'чверті'],
  [0.75, 'восьмі з крапкою'], [0.5, 'восьмі'], [0.25, 'шістнадцяті'], [0.125, 'тридцять другі'], [0.0625, 'шістдесят четверті'],
]);

// smf.tempos [{seconds, usPerQuarter}], smf.meters [{seconds, num, den}] -> [{start, bpm, num, den}]:
// song seconds, quarter notes per minute at 100 %, the meter. Empty for a file without beats.
// end: where the song ends, in seconds (the last tempo lasts until then); without it the last
// tempo counts for one beat.
export function buildTempoMap({ tempos = [], meters = [], smpte = false, end = null } = {}) {
  if (smpte) return [];
  const times = [...new Set([0, ...tempos.map(t => t.seconds), ...meters.map(m => m.seconds)])].sort((a, b) => a - b);
  const at = (list, s, fallback) => {
    let v = fallback;
    for (const e of list) if (e.seconds <= s) v = e; else break;
    return v;
  };
  const valid = tempos.filter(t => t.usPerQuarter > 0);
  const map = [];
  let run = null; // {beats, seconds} of the last entry so far
  times.forEach((s, i) => {
    const bpm = 60e6 / at(valid, s, { usPerQuarter: DEFAULT_US }).usPerQuarter;
    const { num, den } = at(meters, s, DEFAULT_METER);
    const next = i + 1 < times.length ? times[i + 1] : end !== null && end > s ? end : s + 60 / bpm;
    const seconds = next - s;
    const last = map[map.length - 1];
    if (!last || last.num !== num || last.den !== den || Math.abs(bpm - last.bpm) >= last.bpm * SAME_TEMPO) {
      map.push({ start: s, bpm, num, den });
      run = { beats: 0, seconds: 0 };
    }
    run.beats += (bpm * seconds) / 60;
    run.seconds += seconds;
    if (run.seconds > 0) map[map.length - 1].bpm = (run.beats * 60) / run.seconds;
  });
  return map;
}

// The beat a metronome counts in a meter: a dotted quarter in 6/8, 9/8, 12/8; else the
// meter's own note. -> {perBar, quarters}
export function beatOf(num, den) {
  const note = 4 / den;
  if (den >= 8 && num % 3 === 0 && num > 3) return { perBar: num / 3, quarters: note * 3, compound: true };
  return { perBar: num, quarters: note, compound: false };
}

export function valueName(quarters) {
  return VALUE_NAME.get(quarters) || `${quarters} чверті`;
}

// One entry of the map at the trainer's speed -> {bpm, meter, quarters, alt: {bpm, quarters} | null}.
// A beat slower than METRONOME_MIN also comes as a click 2, 4 or 8 times as often (3 or 6 in a
// compound meter): the first that a metronome can give, else the finest.
export function metronome(entry, speed) {
  const beat = beatOf(entry.num, entry.den);
  const bpm = (entry.bpm * speed) / beat.quarters;
  let alt = null;
  if (bpm < METRONOME_MIN) {
    const factors = beat.compound ? [3, 6, 12] : [2, 4, 8];
    const f = factors.find(k => bpm * k >= METRONOME_MIN) || factors[factors.length - 1];
    alt = { bpm: bpm * f, quarters: beat.quarters / f };
  }
  return { bpm, meter: `${entry.num}/${entry.den}`, quarters: beat.quarters, alt };
}

// Seconds of one bar of this entry, in song time.
export function barSeconds(entry) {
  return (entry.num * (4 / entry.den) * 60) / entry.bpm;
}

export function indexAt(map, t) {
  let i = 0;
  while (i + 1 < map.length && map[i + 1].start <= t) i++;
  return i;
}

// The next entry when it starts within one bar (of the tempo now) after song time t.
export function upcomingChange(map, t) {
  if (!map.length) return null;
  const i = indexAt(map, t);
  const next = map[i + 1];
  if (!next || next.start - t > barSeconds(map[i])) return null;
  return { entry: next, in: next.start - t };
}

// 57,5, 28,8, 140: a value a metronome can be set to, one decimal at most, with the Ukrainian
// decimal comma (as the panel writes «1,5 с»).
export function formatBpm(bpm) {
  return String(Number(bpm.toFixed(1))).replace('.', ',');
}

// What the panel and the sign over the keys say at song time t and speed:
// {main, alt, set, warn, value, note} (empty strings where there is nothing to say). set names
// the click to set now: the finer one when the beat is too slow for a metronome, else main. A
// warning names the coming tempo, or for a beat too slow for a metronome, its finer click.
// value and note are the panel's: the click to show now as its BPM and meter (the one to set
// while a warning stands, else the beat), and under it the note it falls on when that is not a
// quarter, with the finer click.
export function metronomeLines(map, t, speed) {
  if (!map || !map.length) {
    const main = 'Метроном: у файлі немає темпу';
    return { main, alt: '', set: main, warn: '', value: 'у файлі немає темпу', note: '' };
  }
  const now = metronome(map[indexAt(map, t)], speed);
  const unit = now.quarters === 1 ? '' : ` на ${valueName(now.quarters)}`;
  const main = `Метроном ${formatBpm(now.bpm)} BPM${unit} · ${now.meter}`;
  const alt = now.alt ? `або ${formatBpm(now.alt.bpm)} BPM на ${valueName(now.alt.quarters)}` : '';
  const set = now.alt ? `Метроном ${formatBpm(now.alt.bpm)} BPM на ${valueName(now.alt.quarters)} · ${now.meter}` : main;
  // the beat's note first, then the finer click (its BPM said once on the line above)
  const finerNote = now.alt && unit ? `або ${formatBpm(now.alt.bpm)} на ${valueName(now.alt.quarters)}` : alt;
  const beat = { value: `${formatBpm(now.bpm)} BPM · ${now.meter}`, note: [unit.trim(), finerNote].filter(Boolean).join(' · ') };
  const finer = now.alt ? { value: `${formatBpm(now.alt.bpm)} BPM · ${now.meter}`, note: `на ${valueName(now.alt.quarters)}` } : beat;
  const change = upcomingChange(map, t);
  let warn = '';
  if (change) {
    const next = metronome(change.entry, speed);
    const meter = next.meter === now.meter ? '' : ` · ${next.meter}`;
    if (next.alt) {
      // too slow for a metronome: the finer click to set
      warn = `Через такт: ${formatBpm(next.alt.bpm)} BPM на ${valueName(next.alt.quarters)}${meter}`;
    } else {
      // the coming beat's note, when it differs from the click set now
      const nextUnit = next.quarters === (now.alt ? now.alt.quarters : now.quarters) ? '' : ` на ${valueName(next.quarters)}`;
      warn = `Через такт: ${formatBpm(next.bpm)} BPM${nextUnit}${meter}`;
    }
  }
  return { main, alt, set, warn, ...(warn ? finer : beat) };
}

