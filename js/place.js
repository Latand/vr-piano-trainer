// The keyboard's place by controller in «Підлаштувати» (docs/piano-trainer-v2.md §4.3): a
// controller's ray finds the keys or the waterfall from a distance, and the trigger slides the
// keyboard across the table one to one. Hands never move it. Also where the panel stands and
// whether a saved place is plausible. Pure: positions are [x, y, z] in metres in a y-up space.
import { WHITE_COUNT, BACK_Z, FRONT_Z, WHITE_LEN, DEPTH_RANGE } from './geometry.js';
import { FALL_HEIGHT, WATERFALL_Z } from './scene.js';
import { NUDGE_LIMIT, ZERO_NUDGE, PITCH_MIN, PITCH_MAX, keyboardMatrix, effectivePitch, depthOf } from './calibrate.js';
import { add, sub, scale, dot, length, normalize, cross, transformPoint, transformDir, invertRigid, yawPose, yawOf } from './mat.js';

// The middle of the keys from front to back; plausiblePlace measures from there.
export const HANDLE_Z = (BACK_Z + FRONT_Z) / 2;
// Where the old placing handles stood: nothing draws or takes them any more; the tests check that
// hands there move nothing.
export const END_OUT = 0.06;
export const HANDLE_Y = 0.012;
export const BAR_Z = FRONT_Z + 0.07;
export const BAR_HALF = 0.045;
export function handlesLocal(pitch) {
  const span = WHITE_COUNT * pitch;
  return { left: [-END_OUT, HANDLE_Y, HANDLE_Z], right: [span + END_OUT, HANDLE_Y, HANDLE_Z], move: [span / 2, HANDLE_Y, BAR_Z] };
}

// A ray hits the keyboard on the key tops (y = 0, from above) or on the waterfall (z =
// WATERFALL_Z, from in front and above the key tops), within RAY_MARGIN of their edges.
export const RAY_MARGIN = 0.05;

// model: the keyboard's matrix (rigid: K, not the drawn one); pitch: its white pitch; origin,
// dir: the ray in the world; depth: the keys' depth (the back edge FRONT_Z - depth).
// -> {distance, point (world), part: 'keys' | 'waterfall'} of the nearest hit, or null.
export function rayKeyboard(model, pitch, origin, dir, depth = WHITE_LEN) {
  const back = FRONT_Z - depth, fall = back - (BACK_Z - WATERFALL_Z);
  const inv = invertRigid(model);
  const o = transformPoint(inv, origin);
  const d = transformDir(inv, normalize(dir));
  const x0 = -RAY_MARGIN, x1 = WHITE_COUNT * pitch + RAY_MARGIN;
  const hits = [];
  if (d[1] < -1e-9 && o[1] > 0) {
    const s = -o[1] / d[1];
    const p = add(o, scale(d, s));
    if (p[0] >= x0 && p[0] <= x1 && p[2] >= back - RAY_MARGIN && p[2] <= FRONT_Z + RAY_MARGIN) hits.push({ s, p, part: 'keys' });
  }
  if (d[2] < -1e-9 && o[2] > fall && o[1] > 0) { // from under the key tops the keyboard is in the way
    const s = (fall - o[2]) / d[2];
    const p = add(o, scale(d, s));
    if (p[0] >= x0 && p[0] <= x1 && p[1] >= 0 && p[1] <= FALL_HEIGHT) hits.push({ s, p, part: 'waterfall' });
  }
  if (!hits.length) return null;
  const best = hits.reduce((a, b) => (b.s < a.s ? b : a));
  return { distance: best.s, point: transformPoint(model, best.p), part: best.part };
}

// How far along a ray it meets the face of a flat rectangle (centre origin, z out of the face;
// the panel's frame), from the front only; Infinity when it misses. width, height: its size.
export function rayFace(matrix, width, height, origin, dir) {
  const inv = invertRigid(matrix);
  const o = transformPoint(inv, origin);
  const d = transformDir(inv, normalize(dir));
  if (d[2] >= -1e-6 || o[2] <= 0) return Infinity;
  const s = -o[2] / d[2];
  const x = o[0] + s * d[0], y = o[1] + s * d[1];
  return Math.abs(x) <= width / 2 && Math.abs(y) <= height / 2 ? s : Infinity;
}

// The slide: the nudge that moves the keyboard by the controller's horizontal travel `delta`
// (world) from where the grab began (`from`: its nudge then), one to one, along the base pose's
// own axes; height, turn and width stay. base: the base pose's matrix. Each part stays within
// NUDGE_LIMIT.
export function slideNudge(from, base, delta) {
  const h = [delta[0], 0, delta[2]];
  const xb = [base[0], base[1], base[2]], zb = [base[8], base[9], base[10]];
  const n = { ...ZERO_NUDGE, ...from };
  const clamp = v => Math.max(-NUDGE_LIMIT, Math.min(NUDGE_LIMIT, v));
  return { ...n, x: clamp(n.x + dot(h, xb)), z: clamp(n.z + dot(h, zb)) };
}

// ----------------------------------------------------------------------------------------------
// The keyboard as a level rectangle (docs/piano-keyboard-handles-design.md §2): its origin O (the
// left edge of the lowest C, on the touch line, at the key tops), its yaw, white pitch, depth
// (front edge to back edge) and so its height O[1]. Its four corners all stand at that height, so
// no state of it can tilt. A record (base pose + nudge) maps onto it and back (nudgeFor).

const xAxis = yaw => [Math.cos(yaw), 0, -Math.sin(yaw)];
const zAxis = yaw => [Math.sin(yaw), 0, Math.cos(yaw)];
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// The rectangle of a record on a level base pose. -> {origin, yaw, pitch, depth}
export function rectOf(base, cal) {
  const K = keyboardMatrix(base, cal);
  return { origin: [K[12], K[13], K[14]], yaw: yawOf(K), pitch: effectivePitch(cal), depth: depthOf(cal) };
}

// The four corners of the white keys in the room: front-left, front-right, back-left, back-right.
export function cornersOf(rect) {
  const x = xAxis(rect.yaw), z = zAxis(rect.yaw);
  const fl = add(rect.origin, scale(z, FRONT_Z)), fr = add(fl, scale(x, WHITE_COUNT * rect.pitch));
  return { fl, fr, bl: sub(fl, scale(z, rect.depth)), br: sub(fr, scale(z, rect.depth)) };
}

// The nudge (in the frame of a level base pose) that puts the record's keyboard on `rect`:
// keyboardMatrix(base, {...cal, nudge}) has rect's origin and yaw, effectivePitch rect's pitch.
export function nudgeFor(base, cal, rect) {
  const beta = yawOf(base);
  const yaw = wrapAngle(rect.yaw - beta);
  const pitch = rect.pitch - cal.pitch;
  const d = sub(rect.origin, [base[12], base[13], base[14]]);
  // the origin in the base's frame: R(-beta) d
  const c = Math.cos(beta), s = Math.sin(beta);
  const o = [c * d[0] - s * d[2], d[1], s * d[0] + c * d[2]];
  const half = (WHITE_COUNT / 2) * rect.pitch, mid = (WHITE_COUNT / 2) * cal.pitch;
  // R(yaw)(-half, 0, 0) = (-half cos yaw, 0, half sin yaw)
  return { x: o[0] + half * Math.cos(yaw) - mid, y: o[1], z: o[2] - half * Math.sin(yaw), pitch, yaw };
}

// True when every part of a nudge stays within NUDGE_LIMIT (the record refuses more).
export function nudgeFits(n) {
  return ['x', 'y', 'z', 'yaw'].every(k => Math.abs(n[k] || 0) <= NUDGE_LIMIT) && Math.abs(n.pitch || 0) < 0.5;
}

// A drag of the handles from the rectangle `start` (§4.4). moves: {fl, fr, bl, br, height}, each
// the travel of the grip holding that handle (world, metres), absent when it is not held. The
// corners move by the horizontal travel alone, the height handle by the vertical travel alone.
// - The front corners: each held one moves by its travel, an unheld one stays; the keys run from
//   front-left to front-right, their pitch the length over 36 white keys, within PITCH_MIN to
//   PITCH_MAX: one corner held stops at the limit along the edge, two held keep their middle.
// - The back corners: the depth is the held corner's distance behind the front edge, square to
//   it (along-edge travel dropped: no shear); both held, the mean; within DEPTH_RANGE.
// - The height handle: the height by the vertical travel.
// -> a new rectangle.
export function dragRect(start, moves) {
  const flat = v => [v[0], 0, v[2]];
  const c = cornersOf(start);
  let yaw = start.yaw, pitch = start.pitch;
  let fl = c.fl;
  if (moves.fl || moves.fr) {
    const a = moves.fl ? add(c.fl, flat(moves.fl)) : c.fl, b = moves.fr ? add(c.fr, flat(moves.fr)) : c.fr;
    const span = sub(b, a);
    const len = length(span);
    const x = len > 1e-6 ? scale(span, 1 / len) : xAxis(start.yaw);
    yaw = Math.atan2(-x[2], x[0]);
    pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, len / WHITE_COUNT));
    const L = WHITE_COUNT * pitch;
    if (moves.fl && moves.fr) fl = sub(scale(add(a, b), 0.5), scale(x, L / 2));
    else if (moves.fr) fl = a;
    else fl = sub(b, scale(x, L));
  }
  const z = zAxis(yaw);
  let depth = start.depth;
  const backs = [];
  if (moves.bl) backs.push(add(c.bl, flat(moves.bl)));
  if (moves.br) backs.push(add(c.br, flat(moves.br)));
  if (backs.length) {
    const d = backs.reduce((acc, t) => acc + dot(sub(fl, t), z), 0) / backs.length;
    depth = Math.max(DEPTH_RANGE[0], Math.min(DEPTH_RANGE[1], d));
  }
  const height = start.origin[1] + (moves.height ? moves.height[1] : 0);
  const o = sub(fl, scale(z, FRONT_Z));
  return { origin: [o[0], height, o[2]], yaw, pitch, depth };
}

// The handles of «Підлаштувати» (§4.2), in the room: the four corners at the key tops plus 1 mm,
// and the height handle, a vertical double arrow HEIGHT_ARROW tall standing HEIGHT_OUT past the
// right end of the keys, halfway between their front and back edges: past the keys and the margin
// a ray still slides them in (RAY_MARGIN) with the cursor's dot, so that cursor never lands on it,
// and at the end away from the docked panel (panel.js panelInKeyboard).
// [{id, point}] (the height handle: {id, point: its middle, segment: [bottom, top]}).
export const HANDLE_LIFT = 0.001;
export const HEIGHT_OUT = 0.075;
export const HEIGHT_ARROW = 0.048;
export function handlesOf(rect) {
  const c = cornersOf(rect);
  const up = p => add(p, [0, HANDLE_LIFT, 0]);
  const x = xAxis(rect.yaw);
  const foot = add(scale(add(c.fr, c.br), 0.5), scale(x, HEIGHT_OUT));
  const top = add(foot, [0, HEIGHT_ARROW, 0]);
  return [{ id: 'fl', point: up(c.fl) }, { id: 'fr', point: up(c.fr) }, { id: 'bl', point: up(c.bl) }, { id: 'br', point: up(c.br) },
    { id: 'height', point: scale(add(foot, top), 0.5), segment: [foot, top] }];
}

// A handle is taken by a controller's tip within HANDLE_TIP of it, else by its ray passing within
// HANDLE_RAY of it (ahead of the controller) (§4.3). The nearest wins.
export const HANDLE_TIP = 0.04;
export const HANDLE_RAY = 0.025;
const closestOn = (h, p) => {
  if (!h.segment) return h.point;
  const [a, b] = h.segment, ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return add(a, scale(ab, t));
};
// The handle under a tip. -> {id, by: 'tip', distance} or null
export function handleByTip(handles, tip) {
  let best = null;
  for (const h of handles) {
    const d = length(sub(closestOn(h, tip), tip));
    if (d <= HANDLE_TIP && (!best || d < best.distance)) best = { id: h.id, by: 'tip', distance: d };
  }
  return best;
}
// The handle under a ray. -> {id, by: 'ray', miss: closest approach, distance: along the ray to
// it, point: the handle's point there} or null
export function handleByRay(handles, origin, dir) {
  const u = normalize(dir);
  let best = null;
  for (const h of handles) {
    let p = h.point;
    if (h.segment) {
      // the segment's point nearest the ray (two lines' closest points, clamped to the segment)
      const [a, b] = h.segment, e = sub(b, a), w = sub(a, origin);
      const ee = dot(e, e), eu = dot(e, u), denom = ee - eu * eu;
      const t = denom > 1e-12 ? Math.max(0, Math.min(1, (eu * dot(w, u) - dot(w, e)) / denom)) : 0;
      p = add(a, scale(e, t));
    }
    const along = dot(sub(p, origin), u);
    if (along <= 0) continue;
    const miss = length(sub(sub(p, origin), scale(u, along)));
    if (miss <= HANDLE_RAY && (!best || miss < best.miss)) best = { id: h.id, by: 'ray', miss, distance: along, point: p };
  }
  return best;
}

// Letting go of a trigger jolts the controller before the headset reports the release, so the
// place kept is the one from RELEASE_BACK seconds before it, as screens in vrplay stop where they
// were a moment before the fist opened. history: [{time, pose}] oldest first.
export const RELEASE_BACK = 0.1;

export function settledPose(history, releaseTime) {
  let pick = history[0] || null;
  for (const h of history) if (h.time <= releaseTime - RELEASE_BACK) pick = h;
  return pick && pick.pose;
}

export function poseMatrix(pose) {
  return yawPose(pose.position, pose.yaw);
}

// Where the panel appears at every session start and on «Панель сюди»: 55 cm ahead of the eyes
// along the head's heading and 15 cm below them, its face turned to the eyes. Built from the
// head pose of this frame alone, so no saved place or shifted origin can put it far away.
export const PANEL_AHEAD = 0.55;
export const PANEL_BELOW = 0.15;

export function panelInFront(head) {
  const yaw = yawOf(head);
  const ahead = [-Math.sin(yaw), 0, -Math.cos(yaw)];
  return panelFacing(add([head[12], head[13] - PANEL_BELOW, head[14]], scale(ahead, PANEL_AHEAD)), head);
}

// The panel at `position` with its face (+z of the panel frame) towards the eyes and its top up.
export function panelFacing(position, head) {
  const eye = [head[12], head[13], head[14]];
  let z = sub(eye, position);
  if (length(z) < 1e-6) z = [0, 0, 1];
  z = normalize(z);
  let x = cross([0, 1, 0], z);
  x = length(x) < 1e-6 ? [1, 0, 0] : normalize(x);
  const y = cross(z, x);
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, position[0], position[1], position[2], 1];
}

// A saved place is used only where a keyboard could stand for a player who sits at it: the
// middle of the keys within REACH_MAX of the eyes, 5 cm to 1.4 m below them and, when the
// reference space knows the floor, key tops 40 cm to 1.3 m above it. A stale anchor or an
// origin moved by a boundary reset fails this and the keyboard is calibrated again.
export const REACH_MAX = 2.5;
export const BELOW_EYES = [0.05, 1.4];
export const TABLE_HEIGHT = [0.4, 1.3];

export function plausiblePlace(model, pitch, head, { floor = false } = {}) {
  const mid = transformPoint(model, [(WHITE_COUNT * pitch) / 2, 0, HANDLE_Z]);
  const eye = [head[12], head[13], head[14]];
  if (!mid.every(Number.isFinite) || !(length(sub(mid, eye)) <= REACH_MAX)) return false;
  const below = eye[1] - mid[1];
  if (below < BELOW_EYES[0] || below > BELOW_EYES[1]) return false;
  return !floor || (mid[1] >= TABLE_HEIGHT[0] && mid[1] <= TABLE_HEIGHT[1]);
}

// The handle on the panel: a bar along its top edge. A pinch, trigger or grip within
// PANEL_GRAB of it takes the panel, from above the panel's top edge only: below it stand the top
// bar's buttons (studio.js, 11 mm under the edge), which a grab must never take. Panel frame:
// origin at the centre, y up, z out of the face.
export const PANEL_BAR_ABOVE = 0.018; // the bar's centre line above the top edge
export const PANEL_GRAB = 0.045;

export function panelBarAt(panel, height, width, point) {
  const p = transformPoint(invertRigid(panel), point);
  const x = Math.max(-width / 2, Math.min(width / 2, p[0]));
  if (p[1] < height / 2 && Math.abs(p[0]) <= width / 2) return false;
  return length(sub(p, [x, height / 2 + PANEL_BAR_ABOVE, 0])) <= PANEL_GRAB;
}
