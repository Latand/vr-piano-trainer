// The fingering of one's own song, worked out off the page's frames (docs/piano-fingering-design.md
// §2.7): {id, notes: [{midi, start, end, hand}], model} -> {id, hands, fingers, unfingered, moves, ms} or
// {id, error}; and a level's (§3.5): {id, level, notes (the level's), song (the song's notes),
// full: {hands, fingers}, model}, or {id, level, notes, fullOf: the id of the song's own job before
// it, model} -> the same. The jobs run in the order they come; the last song's own fingering is
// kept (one, the one levels ask for) until the next.
import { fingerSong, levelFingering } from './fingering.js';

let last = null; // {id, notes, hands, fingers}

self.onmessage = ({ data }) => {
  const { id, notes, model } = data;
  try {
    const t0 = performance.now();
    let r;
    if (!data.level) {
      r = fingerSong({ notes }, { model });
      last = { id, notes, hands: r.hands, fingers: r.fingers };
    } else if (data.fullOf !== undefined) {
      if (!last || last.id !== data.fullOf) throw new Error(`no fingering of job ${data.fullOf}`);
      r = levelFingering(notes, { notes: last.notes }, last, { model });
    } else r = levelFingering(notes, { notes: data.song }, data.full, { model });
    self.postMessage({ id, hands: r.hands, fingers: r.fingers, unfingered: r.unfingered, moves: r.moves, ms: performance.now() - t0 });
  } catch (e) {
    self.postMessage({ id, error: e.message || String(e) });
  }
};
