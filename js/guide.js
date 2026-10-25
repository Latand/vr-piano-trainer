// What the panel says: the input the headset gives now (its top row) and what to do next (its
// lines), for every state and every kind of input; and the song's own lines while playing. Pure.
import { KIND_LINE } from './input.js';
import { formatTime } from './scene.js';
import { metronomeLines } from './tempo.js';

// The top row. While playing, hands are wanted: controllers in hand get asked to be put down.
export function statusLine(kind, state) {
  if (state === 'play' && kind === 'controllers') return 'Бачу: контролери. Поклади їх';
  return KIND_LINE[kind] || KIND_LINE.none;
}

const STEP_TITLE = { low: 'Калібрування 1/2: найнижча До', high: 'Калібрування 2/2: найвища До' };

// s: {state: 'calibrate' | 'adjust' | 'restore', kind, step, problem, pitch, notice}
// -> [title, line2, line3] ([title, four lines, a notice] in «Підлаштувати»), or null for the
// song's own lines. The keyboard is calibrated and adjusted by controller only
// (docs/piano-trainer-v2.md §4).
export function guideLines(s) {
  switch (s.state) {
    case 'calibrate': {
      const title = STEP_TITLE[s.step] || STEP_TITLE.low;
      const lines = s.kind === 'controllers' || s.kind === 'mixed'
        ? ['Кінчик контролера на клавішу', 'і натисни курок']
        : ['Візьми контролер:', 'кінчик на клавішу й курок'];
      return [title, lines[0], s.problem || lines[1]];
    }
    case 'adjust':
      // what moves the keyboard (the panel's four cells, docs/piano-keyboard-handles-design.md
      // §6.4), then what the page has to say (drawPanel draws it as a warning)
      return ['Підлаштувати', 'Кути: тягни — довжина, поворот, глибина', 'Ручка ⇕: висота',
        'Курок на клавішах: пересунути всю', 'Стіки: точно, 1 мм і 0,1°', s.notice || ''];
    case 'restore':
      return ['Шукаю збережене місце клавіатури…', '', ''];
    default:
      return null;
  }
}

// The hands as the keys show them: each hand's name after a dot in its colour (drawPanel), the
// hand left out not named.
export function handsLegend(hands, split = false) {
  const parts = hands === 'both'
    ? [{ hand: 'right', text: 'права' }, { hand: 'left', text: 'ліва' }]
    : [{ hand: hands, text: hands === 'left' ? 'ліва рука' : 'права рука' }];
  if (split) parts.push({ text: 'поділ за середньою C' });
  return { parts };
}

// The panel while playing: s {song, time, ended, speed, loop, hands, message, notice} ->
// [title, time and speed, the metronome {label, value}, the note its click falls on (and the
// finer click), a warning a bar before a tempo change {text, tone: 'warn'} or else what the page
// has to say (a song that failed, a notice), the hands legend]. Both the warning and a message:
// the message takes the legend's place for that bar. The metronome's value is the click to set
// now: during a warning the finer one when the beat is too slow for a metronome.
export function songLines(s) {
  const { song } = s;
  const loop = !s.loop ? '' : s.loop.b === undefined ? ` · петля від ${formatTime(s.loop.a)}` : ` · петля ${formatTime(s.loop.a)}–${formatTime(s.loop.b)}`;
  const state = s.ended ? 'кінець' : formatTime(s.time);
  const m = metronomeLines(song.tempo, s.time, s.speed);
  const said = s.message || s.notice || '';
  const legend = handsLegend(s.hands, song.hands === 'split');
  // the length as the song list gives it (whole seconds), so one song reads one length
  const length = Number.isFinite(song.seconds) ? song.seconds : Math.round(song.end);
  return [song.name, `${state} / ${formatTime(length)} · ${Math.round(s.speed * 100)} %${loop}`,
    { label: 'Метроном', value: m.value }, m.note,
    m.warn ? { text: m.warn, tone: 'warn' } : said, m.warn && said ? said : legend];
}

// A panel line as plain text: the page's own copy of the panel (index.html) and the tests.
export function lineText(line) {
  if (!line) return '';
  if (typeof line === 'string') return line;
  if (line.parts) return line.parts.map(p => p.text).join(' · ');
  if (line.label) return `${line.label} ${line.value}`;
  return line.text || '';
}
