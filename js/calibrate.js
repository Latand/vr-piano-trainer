// The keyboard's place in the room: calibration by two controller touches on the end C keys,
// the width measured once and locked, the fine nudge (thumbsticks, and place.js's ray slide in
// «Підлаштувати»), and the saved record (docs/piano-trainer-v2.md §4).
// Pure: positions are [x, y, z] in metres in a y-up reference space, times in seconds.
import { WHITE_PITCH, WHITE_COUNT, WHITE_LEN, FRONT_Z, DEPTH_RANGE } from './geometry.js';
import { sub, add, scale, length, multiply, translation, yawPose } from './mat.js';

// Centres of the lowest and highest C, in white pitches from the left edge of the lowest C.
export const LOW_C_CENTRE = 0.5;
export const HIGH_C_CENTRE = WHITE_COUNT - 0.5;
const MID_CENTRE = WHITE_COUNT / 2; // the middle of the keys, in white pitches from the left edge
// Accepted white pitch (22.8 mm ± 5 %): two touches further apart or closer were not on the end
// Cs, and a width nudge that would stretch the keys further stops there.
export const PITCH_MIN = 0.0217;
export const PITCH_MAX = 0.0240;
export const MAX_LEVEL_DIFF = 0.04;
// The target-ray origin of a Quest controller above the key its front edge touches. A guess
// until it is measured in the headset; the height nudge corrects it.
export const CONTROLLER_PAD = 0.015;

// Two controller touches (centres of the lowest and highest C, the target-ray origin `pad`
// above the key tops) -> the keyboard pose. pitch: the white pitch when the width is locked (the
// touches must then be its span apart within LOCKED_SLACK), or null to measure it from them.
// Returns {ok: true, position, yaw, pitch, span, levelDiff, measured} or {ok: false, reason:
// 'span' | 'locked' | 'level', span, levelDiff, off}; `off` is how much further apart the touches
// were than the locked span (negative: closer), metres.
export const LOCKED_SLACK = 0.012; // half a key: a touch off the middle of its C
export function solveTwoPoints(low, high, { padLow = CONTROLLER_PAD, padHigh = CONTROLLER_PAD, pitch = null } = {}) {
  const d = sub(high, low);
  const horizontal = [d[0], 0, d[2]];
  const span = length(horizontal);
  const levelDiff = Math.abs((high[1] - padHigh) - (low[1] - padLow));
  const ends = HIGH_C_CENTRE - LOW_C_CENTRE;
  let w = span / ends;
  if (pitch !== null) {
    const off = span - ends * pitch;
    if (Math.abs(off) > LOCKED_SLACK) return { ok: false, reason: 'locked', span, off };
    w = pitch;
  } else if (w < PITCH_MIN || w > PITCH_MAX) {
    return { ok: false, reason: 'span', span };
  }
  if (levelDiff > MAX_LEVEL_DIFF) return { ok: false, reason: 'level', span, levelDiff };
  if (span < 1e-6) return { ok: false, reason: 'span', span };
  const x = scale(horizontal, 1 / span);
  const yaw = Math.atan2(-x[2], x[0]);
  const mid = scale(add(low, high), 0.5);
  const surface = (low[1] - padLow + high[1] - padHigh) / 2;
  // the middle of the touches is the middle of the keys: a touch error splits between the ends
  const origin = sub([mid[0], surface, mid[2]], scale(x, MID_CENTRE * w));
  return { ok: true, position: origin, yaw, pitch: w, span, levelDiff, measured: pitch === null };
}

// The calibration: a touch on the lowest C, then one on the highest C, each a controller's tip
// on the key and its trigger (hands do not calibrate: docs/piano-trainer-v2.md §4.6). feed()
// takes this frame's trigger touches [{point, pad}] and returns {done: true, low, high, padLow,
// padHigh} once both are in. solve() turns them into a pose; a failure starts again with the reason.
export class CalibrationFlow {
  // pitch: the locked white pitch, or null to measure the width from the touches.
  constructor({ pitch = null } = {}) { this.pitch = pitch; this.restart(); }

  restart(problem = '') {
    this.step = 'low';
    this.problem = problem;
    this.holds = {};
  }

  feed(touches = []) {
    if (this.step === 'done') return null;
    for (const t of touches) {
      const r = this.take(t.point, t.pad);
      if (r) return r;
    }
    return null;
  }

  take(point, pad) {
    this.problem = '';
    if (this.step === 'low') {
      this.holds.low = point;
      this.holds.padLow = pad;
      this.step = 'high';
      return null;
    }
    this.holds.high = point;
    this.holds.padHigh = pad;
    this.step = 'done';
    return { done: true, ...this.holds };
  }

  // The pose, or null after restarting with the reason shown.
  solve() {
    const r = solveTwoPoints(this.holds.low, this.holds.high, { padLow: this.holds.padLow, padHigh: this.holds.padHigh, pitch: this.pitch });
    if (r.ok) return r;
    if (r.reason === 'locked') {
      const cm = (Math.abs(r.off) * 100).toFixed(1).replace('.', ',');
      this.restart(`На ${cm} см ${r.off < 0 ? 'ближче' : 'далі'}: торкнись середин До`);
    } else if (r.reason === 'span') this.restart(`Між дотиками ${Math.round(r.span * 100)} см, треба ≈ 80. Знову`);
    else this.restart(`Дотики на різній висоті: ${Math.round(r.levelDiff * 100)} см. Знову`);
    return null;
  }
}

// The record after a calibration: the new base pose; the height and depth nudges and the keys'
// depth carried over from `prev` (they correct the controller tip's geometry and belong to the
// instrument, the same next time), the rest zero; the width locked, with the time it was
// measured. now: an ISO time.
export function calibrated(prev, solved, now) {
  const n = { ...ZERO_NUDGE, ...(prev && prev.nudge) };
  const out = {
    position: solved.position, yaw: solved.yaw, pitch: solved.pitch,
    nudge: { x: 0, y: n.y, z: n.z, pitch: 0, yaw: 0 },
    widthLocked: true,
    measured: solved.measured ? now : (prev && prev.measured) || null,
    anchor: prev ? prev.anchor : null,
  };
  if (prev && prev.depth !== undefined) out.depth = prev.depth;
  return out;
}

// The keys' depth (front edge to back edge) of a record: its own, else the white keys' length.
export function depthOf(cal) {
  return cal && Number.isFinite(cal.depth) ? cal.depth : WHITE_LEN;
}

// The keyboard as drawn: the rigid, level frame K stretched along z by depth / WHITE_LEN, its
// front edge kept (docs/piano-keyboard-handles-design.md §2.3). Everything that inverts or
// composes the frame (rays, the panel's dock, the handles) uses K itself.
export function drawnMatrix(K, depth = WHITE_LEN) {
  const s = depth / WHITE_LEN;
  if (Math.abs(s - 1) < 1e-12) return K;
  const stretch = translation(0, 0, FRONT_Z * (1 - s));
  stretch[10] = s;
  return multiply(K, stretch);
}

// Locking the width folds its nudge into the base pitch, keeping the middle of the keys where it
// is: pitch' = pitch + Δ, nudge.pitch' = 0, nudge.x' = nudge.x - MID_CENTRE·Δ. keyboardMatrix
// gives the same matrix before and after.
export function foldWidth(cal) {
  const n = { ...ZERO_NUDGE, ...cal.nudge };
  return { ...cal, pitch: cal.pitch + n.pitch, nudge: { ...n, x: n.x - MID_CENTRE * n.pitch, pitch: 0 }, widthLocked: true };
}

// The keyboard's model matrix: the base pose (an anchor, or the stored pose) with the nudges.
// A pitch nudge and a turn keep the middle of the keyboard where it is.
export function keyboardMatrix(base, cal) {
  const n = { ...ZERO_NUDGE, ...cal.nudge };
  const middle = MID_CENTRE * cal.pitch;
  const pitch = cal.pitch + n.pitch;
  return multiply(base, multiply(yawPose([n.x + middle, n.y, n.z], n.yaw), translation(-MID_CENTRE * pitch, 0, 0)));
}

export function effectivePitch(cal) {
  return cal.pitch + ((cal.nudge && cal.nudge.pitch) || 0);
}

export const ZERO_NUDGE = Object.freeze({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0 });

// The thumbstick nudge, in «Підлаштувати» only. The right stick moves the keyboard along its
// keys (left, right) and away or nearer (forward, back); the left stick lifts or lowers it
// (forward, back) and turns it about its middle (left, right). The width is the front corners'
// (place.js dragRect). A push held past STICK_HOLD moves on at a speed growing with the square
// of the push; a push that reached STICK_FLICK moves at least one STEP in all, made up when it
// is let go, so a short flick moves one STEP and a longer push never less.
export const STICK_DEAD = 0.2;
export const STICK_FLICK = 0.6;
export const STICK_HOLD = 0.25; // seconds
export const STICK_SPEED = { move: 0.03, turn: (4 * Math.PI) / 180 }; // per second at full push
export const STEP = { move: 0.001, turn: (0.1 * Math.PI) / 180 };
export const NUDGE_LIMIT = 0.45; // metres and radians; the record refuses 0.5

const curve = a => {
  const m = Math.abs(a);
  if (m <= STICK_DEAD) return 0;
  return Math.sign(a) * ((Math.min(1, m) - STICK_DEAD) / (1 - STICK_DEAD)) ** 2;
};
const clampTo = (v, lim) => Math.max(-lim, Math.min(lim, v));

// The four stick axes: [stick, axis, what it moves].
const AXES = [['right', 0, 'x'], ['right', 1, 'z'], ['left', 1, 'y'], ['left', 0, 'yaw']];

export class StickNudger {
  constructor() { this.axes = new Map(); }

  reset() { this.axes.clear(); }

  // sticks: {right: [x, y] | null, left: [x, y] | null}, xr-standard axes, y negative when
  // pushed forward. now: seconds; dt: since the last frame. -> {cal: a new record, or `cal`
  // itself when nothing moved}.
  update(cal, sticks, now, dt) {
    const n = { ...ZERO_NUDGE, ...cal.nudge };
    let moved = false;
    for (const [side, i, what] of AXES) {
      const a = sticks[side] ? sticks[side][i] || 0 : 0;
      const key = `${side}${i}`;
      const st = this.axes.get(key);
      const m = Math.abs(a);
      let amount = 0, target = what;
      if (m > STICK_DEAD) {
        if (!st || st.what !== what) this.axes.set(key, { since: now, peak: m, sign: Math.sign(a), what, held: 0 });
        else { st.peak = Math.max(st.peak, m); st.sign = Math.sign(a); }
        const s = this.axes.get(key);
        if (now - s.since >= STICK_HOLD) { amount = curve(a) * dt * rate(what); s.held += amount; }
      } else if (st) {
        this.axes.delete(key);
        // what the hold moved in this push, made up to one step
        target = st.what;
        if (st.peak >= STICK_FLICK && Math.abs(st.held) < step(target)) amount = st.sign * step(target) - st.held;
      }
      if (!amount || !target) continue;
      // forward is negative y: forward moves away (-z of the keyboard) and up (+y)
      if (target === 'x') n.x = clampTo(n.x + amount, NUDGE_LIMIT);
      else if (target === 'z') n.z = clampTo(n.z + amount, NUDGE_LIMIT);
      else if (target === 'y') n.y = clampTo(n.y - amount, NUDGE_LIMIT);
      else if (target === 'yaw') n.yaw = clampTo(n.yaw - amount, NUDGE_LIMIT);
      moved = true;
    }
    return { cal: moved ? { ...cal, nudge: n } : cal };
  }

  // True while some stick is out of its dead zone.
  get busy() { return this.axes.size > 0; }
}

const rate = what => (what === 'yaw' ? STICK_SPEED.turn : STICK_SPEED.move);
const step = what => (what === 'yaw' ? STEP.turn : STEP.move);

export function basePose(cal) {
  return yawPose(cal.position, cal.yaw);
}

// Saved calibration v2: {version, position, yaw, pitch, widthLocked, measured, nudge, anchor,
// saved} and an optional depth (metres, within DEPTH_RANGE; without it the white keys' length:
// a reader before it ignores it, so a rollback keeps the place); anything else is refused. A v1
// record (before the width lock) reads with its width nudge folded into the pitch (foldWidth)
// and the width locked; one saved before the turn nudge existed reads as unturned.
export const STORE_KEY = 'piano-calibration';
export const STORE_VERSION = 2;

export function serialize(cal, now = null) {
  return JSON.stringify({
    version: STORE_VERSION, position: cal.position, yaw: cal.yaw, pitch: cal.pitch,
    widthLocked: cal.widthLocked !== false, measured: cal.measured || null,
    nudge: { ...ZERO_NUDGE, ...cal.nudge }, anchor: cal.anchor || null, saved: now || cal.saved || null,
    ...(Number.isFinite(cal.depth) ? { depth: cal.depth } : {}),
  });
}

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/;
const isoOrNull = v => v === null || v === undefined || (typeof v === 'string' && v.length <= 40 && ISO.test(v) && Number.isFinite(Date.parse(v)));

export function deserialize(text) {
  let v;
  try { v = JSON.parse(text); } catch { return null; }
  if (!v || typeof v !== 'object' || (v.version !== 1 && v.version !== STORE_VERSION)) return null;
  const num = x => typeof x === 'number' && Number.isFinite(x);
  if (!Array.isArray(v.position) || v.position.length !== 3 || !v.position.every(num)) return null;
  if (!num(v.yaw) || !num(v.pitch) || v.pitch < PITCH_MIN || v.pitch > PITCH_MAX) return null;
  const n = v.nudge && typeof v.nudge === 'object' ? v.nudge : {};
  if (!['x', 'y', 'z', 'pitch'].every(k => num(n[k]) && Math.abs(n[k]) < 0.5)) return null;
  if (n.yaw !== undefined && !(num(n.yaw) && Math.abs(n.yaw) < 0.5)) return null;
  if (v.anchor !== null && v.anchor !== undefined && (typeof v.anchor !== 'string' || v.anchor.length > 200)) return null;
  if (v.depth !== undefined && !(num(v.depth) && v.depth >= DEPTH_RANGE[0] && v.depth <= DEPTH_RANGE[1])) return null;
  const cal = { position: v.position, yaw: v.yaw, pitch: v.pitch, nudge: { x: n.x, y: n.y, z: n.z, pitch: n.pitch, yaw: n.yaw || 0 }, anchor: v.anchor || null };
  if (v.depth !== undefined) cal.depth = v.depth;
  if (v.version === 1) {
    const folded = foldWidth(cal);
    if (folded.pitch < PITCH_MIN || folded.pitch > PITCH_MAX || Math.abs(folded.nudge.x) >= 0.5) return null;
    return { ...folded, widthLocked: true, measured: null, saved: null };
  }
  if (typeof v.widthLocked !== 'boolean' || !isoOrNull(v.measured) || !isoOrNull(v.saved)) return null;
  return { ...cal, widthLocked: v.widthLocked, measured: v.measured || null, saved: v.saved || null };
}

export { WHITE_PITCH };
