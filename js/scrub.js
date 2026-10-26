// Scrubbing the song: a controller's trigger held on the waterfall (xr.js), or the desktop
// preview's mouse dragging or wheeling over it (app.js), takes the falling notes and moves them up
// or down; the song time follows one to one, so a note under the ray stays under it. Dragging the
// notes down brings later ones in (forward), as the song itself moves them; up goes back. While
// the song is held its clock stands where the hand puts it and nothing sounds; let go, it goes on
// from there as it was, playing or paused.
import { FALL_SPEED, FALL_HEIGHT, WATERFALL_Z } from './scene.js';
import { FRONT_Z, BACK_Z, WHITE_COUNT } from './geometry.js';
import { invertRigid, transformPoint, transformDir, normalize, add, scale } from './mat.js';

// A press counts on the waterfall within this of its sides (metres), as rays on the keys do.
export const WATERFALL_MARGIN = 0.05;
// A controller's tip this close to the waterfall's face (in front or behind) takes it by the tip:
// then the tip's own height drags it, whatever way the ray points.
export const SCRUB_TIP = 0.04;
// While dragging, the ray's point on the waterfall's plane counts out to SCRUB_REACH_SCALE times
// the distance the ray took the waterfall from, and at least SCRUB_REACH (metres): a ray turned
// nearly along the plane meets it far off, and that would throw the song to one end.
export const SCRUB_REACH = 5;
export const SCRUB_REACH_SCALE = 2;
export const scrubReach = distance => Math.max(SCRUB_REACH, SCRUB_REACH_SCALE * distance);
// The desktop's wheel: a wheel standing still this long (real s) lets the song go.
export const WHEEL_REST = 0.25;
export const WHEEL_LINE = 40; // CSS pixels a wheel line counts as (WheelEvent deltaMode 1)

// The song time after the waterfall was dragged `dy` metres up (negative: down) from where it was
// taken at song time `from`. A bar's height over the hit line is (start - t)·FALL_SPEED in song
// seconds (scene.js frameAt), at every speed, so a note under the hand stays under it.
export const scrubTime = (from, dy) => from - dy / FALL_SPEED;

// The waterfall's plane in the keyboard's rigid frame K (z, the keys `depth` deep), as rayKeyboard
// (place.js) finds it.
const fallZ = depth => FRONT_Z - depth - (BACK_Z - WATERFALL_Z);

// Where a ray meets the waterfall, from in front of it: {distance, y (its height over the hit line,
// metres), point (world)}, or null. bounded: only within the waterfall (its width and WATERFALL_MARGIN
// to the sides, from the hit line to the top) and from over the key tops (from under them the
// keyboard is in the way); else anywhere on its plane up to `reach` away (dragging: scrubReach of
// the distance it was taken from).
export function rayWaterfall(K, pitch, depth, origin, dir, { bounded = true, reach = SCRUB_REACH } = {}) {
  const inv = invertRigid(K);
  const o = transformPoint(inv, origin);
  const d = transformDir(inv, normalize(dir));
  const z = fallZ(depth);
  if (!(d[2] < -1e-9) || !(o[2] > z)) return null;
  const s = (z - o[2]) / d[2];
  const p = add(o, scale(d, s));
  if (bounded) {
    if (o[1] <= 0 || p[0] < -WATERFALL_MARGIN || p[0] > WHITE_COUNT * pitch + WATERFALL_MARGIN || p[1] < 0 || p[1] > FALL_HEIGHT) return null;
  } else if (s > reach) return null;
  return { distance: s, y: p[1], point: transformPoint(K, p) };
}

// A controller's tip on the waterfall: within SCRUB_TIP of its face and over it (its width and
// height, SCRUB_TIP to spare). -> {y} or null. bounded: false gives the tip's height wherever it is.
export function tipWaterfall(K, pitch, depth, tip, { bounded = true } = {}) {
  const p = transformPoint(invertRigid(K), tip);
  if (bounded && (Math.abs(p[2] - fallZ(depth)) > SCRUB_TIP || p[0] < -SCRUB_TIP || p[0] > WHITE_COUNT * pitch + SCRUB_TIP ||
    p[1] < -SCRUB_TIP || p[1] > FALL_HEIGHT + SCRUB_TIP)) return null;
  return { y: p[1] };
}

// The desktop preview: the ray through a point of a camera's picture (ndc: -1..1 across, -1..1 up)
// for mat.js perspective() and a rigid lookAt() view. -> {origin, dir} in the world.
export function pointerRay(proj, view, ndcX, ndcY) {
  const camera = invertRigid(view);
  return { origin: [camera[12], camera[13], camera[14]], dir: transformDir(camera, [ndcX / proj[0], ndcY / proj[5], -1]) };
}

// One hold of the song: the transport (song.js) stands from the grab to the let-go, at the times
// the hand gives (seek clamps them to the song, and to an A–B loop's B); loops, level and speed are
// left as they are. playing: whether the song played when it was taken (App passes false for a
// frozen preview moment).
export class SongGrab {
  constructor(transport, now, playing = transport.playing) {
    this.transport = transport;
    this.playing = playing;
    transport.pause(now);
    this.from = transport.time(now);
  }

  to(time, now) { return this.transport.seek(time, now); }

  // Let go at `time` (null: where it stands): a song that played plays on from there, after
  // `hold` (Transport.play); one let go at its end stands there ended, as one played to its end
  // does, and is not started again.
  end(time, now, hold = 0) {
    const t = this.transport;
    if (time !== null && time !== undefined) t.seek(time, now);
    if (this.playing && !t.ended(now)) t.play(now, hold);
  }
}
