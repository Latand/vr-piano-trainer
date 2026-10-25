// The guide hands in 3D (docs/piano-fingering-design.md §4.1-§4.2): for each hand a translucent
// hand resting on the keys, a palm and five jointed fingers, each fingertip over the key its
// finger covers in the hand's position (scene.js handsAt). The fingers of the next onset come
// down onto their keys as the keys fill and press into them at the onset; a finger holding a
// sounding note stays pressed; the others hover over their keys. The hand lifts a little while it
// slides to its next position. Keyboard frame, metres (geometry.js): y up from the white keys'
// tops, z towards the player, z = 0 the touch line.
import { BLACK_HEIGHT, BLACK_FRONT_Z } from './geometry.js';

export const HAND3D = {
  // where a fingertip touches: a white key on its touch line, a black key near its front
  tipZ: { white: 0.002, black: BLACK_FRONT_Z - 0.008 },
  thumbZ: 0.008, // on a white key the thumb touches this much nearer the player than the fingers
  lift: 0.016, // a finger not about to play hovers this far over its key
  press: 0.005, // a finger holding its note sinks this far into the key
  raise: 0.012, // the whole hand is this much higher halfway through a move
  over: 0.01, // a finger lifted over its neighbours: this much over a free finger
  // each finger's knuckle (MCP): its height over the white keys and how far in front of its tip
  knuckle: { y: [0, 0, 0.04, 0.042, 0.04, 0.034], z: [0, 0, 0.05, 0.055, 0.052, 0.042] },
  // the bones from the knuckle (the thumb: from its base in the palm) to the tip
  bone: [null, [0.045, 0.033, 0.027], [0.043, 0.025, 0.02], [0.046, 0.028, 0.021], [0.043, 0.026, 0.02], [0.034, 0.02, 0.018]],
  radius: [0, 0.0095, 0.0085, 0.0088, 0.0083, 0.0072], // at the knuckle; `taper` of it at the tip
  taper: 0.82,
  couple: [0, 0.5, 0.8, 0.8, 0.8, 0.8], // the last joint bends this share of the middle one
  splay: 0.55, // the knuckles stand this share of the way from the hand's middle out to the tips
  gap: 0.017, // and at least this far apart
  // the thumb's base from finger 2's knuckle, inwards; it follows a thumb stretched further in
  // by `follow` of the way, as the thumb's own joint at the wrist lets it; never further than
  // `joined` from that knuckle: a thumb stretched past it turns the whole hand towards it
  thumb: { x: 0.017, y: -0.014, z: 0.016, follow: 0.45, joined: 0.085 },
  // neighbouring fingers' middle joints and tips at least `min` apart: the outer knuckles (the
  // thumb's base, inwards) move `step` at a time, at most `steps` times
  clear: { min: 0.011, step: 0.003, steps: 8 },
  palm: { length: 0.07, thick: 0.024, wrist: 0.05, drop: 0.016, dome: 0.004 },
  sides: 6, // a finger's cross-section
  // Opacity: a hand never covers more than MAX of what is behind it, so the room, the keys and
  // the player's own fingers show through; the fingers about to play and the pressed ones a
  // little more than the rest.
  alpha: { palm: 0.32, rest: 0.38, next: 0.46, held: 0.5, rim: 0.5 }, MAX: 0.5,
  lighten: 0.6, // how far a pressed finger's tone goes towards PRESSED
  // The silhouette: the sides of a finger (those whose normal points up less than `rimUp` of the
  // way) and the palm's walls take the hand's deep rim colour, so every finger has an edge against
  // a white key (RIM_CONTRAST, overlay.test.mjs T12), the top of it staying the pale tone.
  rimUp: 0.75,
};
export const RIM_CONTRAST = 3; // a finger's rim over a white key, at the rim's opacity: at least this

// Quads a hand takes: per finger three bones and the tip's cap, each a prism of `sides`, and the
// cap's end; the palm's slab of three rows of four points.
export const HAND_QUADS = 5 * (4 * HAND3D.sides + (HAND3D.sides / 2 - 1)) + 22;

// Each hand in a pale tone of its own colour (overlay.js HAND_COLOUR 60 % of the way to white): a
// hue no skin, no controller and no ray has, so the guide never reads as the player's hand or a
// controller, and lighter than the keys under it. A finger coming down lightens towards PRESSED.
export const HAND_TONE = { right: [0.8, 0.77, 1.0], left: [0.7, 0.95, 0.9] };
export const PRESSED = [1, 1, 1];
// The rim of each hand: a very deep tone of the same hue (its colour in overlay.js HAND_COLOUR at
// a tenth of its light), whatever the finger is doing.
export const HAND_RIM = { right: [0.05, 0.04, 0.12], left: [0.01, 0.05, 0.04] };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const LIGHT = norm([-0.25, 1, 0.6]); // from above, a little towards the player
// A face turned from the light keeps this share of its tone: the hand stays lighter than a grey
// key, so a cue drawn over it keeps the contrast it has on a bare key (overlay.test.mjs T12).
export const SHADE = 0.8;

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// φ, the bend of a finger's middle joint, within these (radians).
const PHI = [0.1, 2.2];
// The chain's end bent φ (couple: the last joint's share of φ), its first bone level: END = [x, y].
const END = new Float64Array(2);
function chainEnd(bones, couple, phi) {
  const a2 = phi * (1 + couple);
  END[0] = bones[0] + bones[1] * Math.cos(phi) + bones[2] * Math.cos(a2);
  END[1] = bones[1] * Math.sin(phi) + bones[2] * Math.sin(a2);
}
function chainReach(bones, couple, phi) { chainEnd(bones, couple, phi); return Math.hypot(END[0], END[1]); }
// φ for a reach: from a table of the chain's reach (falling as φ grows), made once a finger and
// read by halving and a straight line between its steps (a few micrometres from the exact bend).
const TABLE_STEPS = 128, tables = new WeakMap(); // bones -> {couple, r}
function bendFor(bones, couple, dist) {
  let t = tables.get(bones);
  if (!t || t.couple !== couple) {
    t = { couple, r: new Float64Array(TABLE_STEPS + 1) };
    for (let i = 0; i <= TABLE_STEPS; i++) t.r[i] = chainReach(bones, couple, PHI[0] + ((PHI[1] - PHI[0]) * i) / TABLE_STEPS);
    tables.set(bones, t);
  }
  const r = t.r;
  if (dist >= r[0]) return PHI[0];
  if (dist <= r[TABLE_STEPS]) return PHI[1];
  let lo = 0, hi = TABLE_STEPS;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (r[mid] > dist) lo = mid; else hi = mid; }
  const k = (r[lo] - dist) / (r[lo] - r[hi]);
  return PHI[0] + ((PHI[1] - PHI[0]) * (lo + k)) / TABLE_STEPS;
}

// A base too far from its target, sideways, moved along x until the finger reaches it (a hand
// turning towards a stretched finger): -> the base.
export function withinReach(K, T, bones, couple, spare = 0.98) {
  const r = chainReach(bones, couple, PHI[0]) * spare;
  const dz = T[2] - K[2], dy = K[1] - T[1], dx = T[0] - K[0];
  const room = r * r - dz * dz - dy * dy;
  if (dx * dx <= room || room <= 0) return K;
  return [T[0] - Math.sign(dx) * Math.sqrt(room), K[1], K[2]];
}

// A finger from base K to tip target T in the upright plane through both: three bones, the first
// at angle θ under the horizontal, each next one bent φ further (the last couple·φ). φ is found
// so the chain's reach is the distance to T (the reach falls as φ grows), then θ turns it onto T.
// -> the four joints K..tip. A target out of reach leaves the finger straight towards it.
export function solveFinger(K, T, bones, couple) {
  const dx = T[0] - K[0], dz = T[2] - K[2], hd = Math.hypot(dx, dz), h = K[1] - T[1];
  const dist = Math.hypot(hd, h);
  const phi = bendFor(bones, couple, dist);
  chainEnd(bones, couple, phi);
  const ex = END[0], ey = END[1];
  const theta = Math.atan2(h, hd) - Math.atan2(ey, ex);
  const u = hd > 1e-9 ? [dx / hd, 0, dz / hd] : [0, 0, -1];
  const joints = [K];
  const a = [theta, theta + phi, theta + phi * (1 + couple)];
  for (let i = 0; i < 3; i++) {
    const p = joints[i];
    joints.push([p[0] + bones[i] * Math.cos(a[i]) * u[0], p[1] - bones[i] * Math.sin(a[i]), p[2] + bones[i] * Math.cos(a[i]) * u[2]]);
  }
  return joints;
}

// One hand of scene.js handsAt as joints: -> {hand, side, fingers: [_, {joints, target, radius,
// alpha, state: 'rest' | 'next' | 'held'}], palm: {rows: [knuckles, middle, wrist], each four
// points across}, knuckles}. pitch: the white key pitch in metres.
export function handPose(h, pitch) {
  const S = HAND3D;
  const tipX = h.x.map(v => (v === null ? null : v * pitch));
  const side = h.hand === 'left' ? -1 : 1; // the thumb's side is the hand's, whatever a finger does
  const deep = h.deep || h.black.map(b => +b);
  const raise = S.raise * Math.sin(Math.PI * Math.max(0, Math.min(1, h.slide ?? 1)));
  const tipZ = f => S.tipZ.white + (S.tipZ.black - S.tipZ.white) * deep[f] + (f === 1 ? S.thumbZ * (1 - deep[f]) : 0);
  const keyTop = f => BLACK_HEIGHT * deep[f];
  const state = f => (h.held[f] ? 'held' : h.next[f] > 0 ? 'next' : 'rest');
  // a finger lifted over its neighbours (scene.js handsAt `up`: sliding onto a black key, or tucked
  // between two fingers on keys close together) stands at least `over` over the free fingers' height
  const hover = f => Math.max(S.lift * (1 - h.next[f]), h.up ? (S.lift + S.over) * h.up[f] : 0);
  const tipY = f => keyTop(f) + raise + (h.held[f] ? -S.press : hover(f));
  // the knuckles: spread from the middle of the five fingers towards their tips, at least `gap`
  // apart, the whole row as far forward as the tips are on average, each finger half its own way
  let mid = (tipX[1] + tipX[2] + tipX[3] + tipX[4] + tipX[5]) / 5;
  const kx = [null, null];
  for (let f = 2; f <= 5; f++) kx.push(mid + (tipX[f] - mid) * S.splay);
  for (let f = 3; f <= 5; f++) if ((kx[f] - kx[f - 1]) * side < S.gap) kx[f] = kx[f - 1] + side * S.gap;
  const meanZ = (tipZ(2) + tipZ(3) + tipZ(4) + tipZ(5)) / 4;
  const knuckles = [null, null];
  for (let f = 2; f <= 5; f++) knuckles.push([kx[f], S.knuckle.y[f] + raise, (tipZ(f) + meanZ) / 2 + S.knuckle.z[f]]);
  const fingers = [null];
  const base = knuckles[2][0] - side * S.thumb.x, inward = Math.min(0, (tipX[1] - base) * side);
  const thumbTarget = [tipX[1], tipY(1), tipZ(1)];
  const thumbBase = withinReach([base + side * inward * S.thumb.follow, knuckles[2][1] + S.thumb.y, knuckles[2][2] + S.thumb.z], thumbTarget, S.bone[1], S.couple[1]);
  // a base moved past `joined` brings the knuckles (and the palm) along with it
  const most = Math.sqrt(S.thumb.joined ** 2 - S.thumb.y ** 2 - S.thumb.z ** 2), off = thumbBase[0] - knuckles[2][0];
  if (Math.abs(off) > most) {
    const shift = off - Math.sign(off) * most;
    for (let f = 2; f <= 5; f++) knuckles[f][0] += shift;
    mid += shift;
  }
  for (let f = 1; f <= 5; f++) {
    const target = f === 1 ? thumbTarget : [tipX[f], tipY(f), tipZ(f)];
    const base = f === 1 ? thumbBase : withinReach(knuckles[f], target, S.bone[f], S.couple[f]);
    if (f > 1) knuckles[f] = base; // the palm follows a knuckle moved to reach
    const st = state(f);
    const alpha = st === 'held' ? S.alpha.held : S.alpha.rest + (S.alpha.next - S.alpha.rest) * (st === 'next' ? h.next[f] : 0);
    fingers.push({ joints: solveFinger(base, target, S.bone[f], S.couple[f]), target, radius: S.radius[f], alpha, state: st });
  }
  // two fingers on neighbouring keys whose joints would run into each other (one on a black key, one
  // on the white beside it) spread at the knuckles, the outer ones a few millimetres at a time
  const near = (p, q) => Math.min(dist(p[1], q[1]), dist(p[2], q[2]), dist(p[3], q[3]));
  for (let f = 2; f < 5; f++) {
    for (let n = 0; n < S.clear.steps && near(fingers[f].joints, fingers[f + 1].joints) < S.clear.min; n++) {
      for (let g = f + 1; g <= 5; g++) {
        const { target } = fingers[g];
        knuckles[g] = withinReach([knuckles[g][0] + side * S.clear.step, knuckles[g][1], knuckles[g][2]], target, S.bone[g], S.couple[g]);
        fingers[g].joints = solveFinger(knuckles[g], target, S.bone[g], S.couple[g]);
      }
    }
  }
  // a thumb whose joints would run into finger 2's (the thumb on a black key beside it) comes in
  // from further inside, as a hand turns it under, a few millimetres at a time while it stays joined
  const t = fingers[1], i2 = fingers[2].joints;
  for (let n = 0, b = t.joints[0]; n < S.clear.steps && near(t.joints, i2) < S.clear.min; n++) {
    b = withinReach([b[0] - side * S.clear.step, b[1], b[2]], thumbTarget, S.bone[1], S.couple[1]);
    if (dist(b, knuckles[2]) > S.thumb.joined) break;
    t.joints = solveFinger(b, thumbTarget, S.bone[1], S.couple[1]);
  }
  // the palm: its front edge along the knuckles (outermost widened by their fingers), its back
  // edge the wrist, lower and narrower, and a row between, the widest; both lean to the thumb
  const k = knuckles, P = S.palm;
  const front = [add(k[2], [-side * S.radius[2], 0, 0]), k[3], k[4], add(k[5], [side * S.radius[5], 0, 0])];
  const fy = (k[2][1] + k[5][1]) / 2, fz = (k[2][2] + k[3][2] + k[4][2] + k[5][2]) / 4;
  const row = (t, width, lean) => [0, 1, 2, 3].map(i => [mid - side * lean + side * width * (i / 3 - 0.5), fy - P.drop * t, fz + P.length * t]);
  const span = Math.abs(front[3][0] - front[0][0]);
  const middle = row(0.45, Math.max(span, P.wrist) * 1.02, 0.004), back = row(1, P.wrist, 0.004);
  return { hand: h.hand, side, fingers, palm: { rows: [front, middle, back] }, knuckles };
}

// Into batch (render.js FloatBatch or Batch, untextured, drawn as a shell: render.js keeps only each pixel's nearest face): the
// hands of scene.js handsAt, flat shaded in their tone. letters (the finger atlas): «П» or «Л» on
// the back of each palm. fade: the song's fade in «Підлаштувати». letter: {w, h, uv: overlay.js
// glyphUv, colour: per hand}, the glyph's quad, so this module draws no atlas of its own.
export function buildHands3d(batch, letters, hands, pitch, { fade = 1, letter = null } = {}) {
  const S = HAND3D;
  for (const h of hands) {
    const pose = handPose(h, pitch);
    const tone = HAND_TONE[h.hand] || HAND_TONE.right, rim = HAND_RIM[h.hand] || HAND_RIM.right;
    // a face lit by LIGHT, its normal (across its diagonals) turned away from `inside`
    const face = lit => (a, b, c, d, inside, alpha, wall = false) => {
      const px = c[0] - a[0], py = c[1] - a[1], pz = c[2] - a[2], qx = d[0] - b[0], qy = d[1] - b[1], qz = d[2] - b[2];
      let nx = py * qz - pz * qy, ny = pz * qx - px * qz, nz = px * qy - py * qx;
      const l = Math.hypot(nx, ny, nz) || 1;
      const out = nx * ((a[0] + b[0] + c[0] + d[0]) / 4 - inside[0]) + ny * ((a[1] + b[1] + c[1] + d[1]) / 4 - inside[1]) + nz * ((a[2] + b[2] + c[2] + d[2]) / 4 - inside[2]);
      const sgn = out < 0 ? -1 / l : 1 / l;
      nx *= sgn; ny *= sgn; nz *= sgn;
      const k = wall ? 1 : SHADE + (1 - SHADE) * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const c0 = wall ? rim : lit;
      batch.put(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], c0[0] * k, c0[1] * k, c0[2] * k, (wall ? S.alpha.rim : alpha) * fade);
    };
    for (let f = 1; f <= 5; f++) {
      // a finger about to play lightens towards PRESSED as it comes down; a pressed one is it
      const { joints, radius, alpha, state } = pose.fingers[f];
      const k = state === 'held' ? 1 : state === 'next' ? h.next[f] : 0;
      tube(batch, mix(tone, PRESSED, k * S.lighten), alpha * fade, rim, S.alpha.rim * fade, joints, radius, S.taper);
    }
    slab(face(tone), pose.palm, S.palm, S.alpha.palm);
    if (letter && letters) {
      // on the back of the palm towards the wrist, where no knuckle stands in front of it from
      // the seat: lying on its middle face, a little over it, its foot towards the player
      const [top] = palmFaces(pose.palm, S.palm);
      const a = mul(add(top[1][1], top[1][2]), 0.5), b = mul(add(top[2][1], top[2][2]), 0.5);
      const c = mul(add(a, b), 0.5), slope = (b[1] - a[1]) / (b[2] - a[2]), w = letter.w / 2, d = letter.h / 2;
      const at = (dx, dz) => [c[0] + dx, c[1] + 0.0015 + slope * dz, c[2] + dz];
      const c0 = letter.colour[h.hand] || tone;
      letters.quad(at(-w, d), at(w, d), at(w, -d), at(-w, -d), [c0[0], c0[1], c0[2], fade], letter.uv(h.hand === 'left' ? 'Л' : 'П'));
    }
  }
}

// A finger's cross-section: each corner's cosine and sine, and each side's middle's (its
// outward normal).
const SIDES = HAND3D.sides;
const COS = new Float64Array(SIDES), SIN = new Float64Array(SIDES), MCOS = new Float64Array(SIDES), MSIN = new Float64Array(SIDES);
for (let k = 0; k < SIDES; k++) {
  COS[k] = Math.cos((k / SIDES) * 2 * Math.PI); SIN[k] = Math.sin((k / SIDES) * 2 * Math.PI);
  MCOS[k] = Math.cos(((k + 0.5) / SIDES) * 2 * Math.PI); MSIN[k] = Math.sin(((k + 0.5) / SIDES) * 2 * Math.PI);
}
const A = new Float64Array(3 * SIDES), B = new Float64Array(3 * SIDES);
const F = new Float64Array(6); // the bone's u and v, across it

// The corners round (cx, cy, cz), r out, in the plane of F's u and v.
function ring(out, cx, cy, cz, r) {
  for (let k = 0; k < SIDES; k++) {
    const c = COS[k] * r, s = SIN[k] * r;
    out[3 * k] = cx + c * F[0] + s * F[3]; out[3 * k + 1] = cy + c * F[1] + s * F[4]; out[3 * k + 2] = cz + c * F[2] + s * F[5];
  }
}
// The sides between rings A and B, each lit by LIGHT along its outward normal; those turned away
// from straight up are the finger's rim, in `rim`'s tone at the rim's opacity.
function band(d, lit, alpha, rim, rimAlpha) {
  for (let k = 0; k < SIDES; k++) {
    const j = k + 1 === SIDES ? 0 : k + 1, c = MCOS[k], s = MSIN[k];
    const edge = c * F[1] + s * F[4] < HAND3D.rimUp;
    const t = edge ? 1 : SHADE + (1 - SHADE) * Math.max(0, (c * F[0] + s * F[3]) * LIGHT[0] + (c * F[1] + s * F[4]) * LIGHT[1] + (c * F[2] + s * F[5]) * LIGHT[2]);
    const tone = edge ? rim : lit;
    d.put(A[3 * k], A[3 * k + 1], A[3 * k + 2], A[3 * j], A[3 * j + 1], A[3 * j + 2], B[3 * j], B[3 * j + 1], B[3 * j + 2], B[3 * k], B[3 * k + 1], B[3 * k + 2],
      tone[0] * t, tone[1] * t, tone[2] * t, edge ? rimAlpha : alpha);
  }
}

// A finger into batch d: a tapering prism round each bone, every bone a little longer at both
// ends so the joints close, and a rounded cap at the tip, lit by LIGHT in `lit`.
function tube(d, lit, alpha, rim, rimAlpha, joints, r0, taper) {
  const n = joints.length - 1;
  for (let i = 0; i < n; i++) {
    const p = joints[i], q = joints[i + 1];
    let ax = q[0] - p[0], ay = q[1] - p[1], az = q[2] - p[2];
    const len = Math.hypot(ax, ay, az) || 1;
    ax /= len; ay /= len; az /= len;
    // u, v: across the bone (u level where the bone is not upright)
    let ux, uy, uz;
    if (Math.abs(ay) < 0.9) { ux = -az; uy = 0; uz = ax; } else { ux = 0; uy = az; uz = -ay; }
    const ul = Math.hypot(ux, uy, uz);
    F[0] = ux / ul; F[1] = uy / ul; F[2] = uz / ul;
    F[3] = ay * F[2] - az * F[1]; F[4] = az * F[0] - ax * F[2]; F[5] = ax * F[1] - ay * F[0];
    const ra = r0 * (1 - ((1 - taper) * i) / n), rb = r0 * (1 - ((1 - taper) * (i + 1)) / n);
    const back = i === 0 ? 0 : ra * 0.4, on = i === n - 1 ? 0 : rb * 0.4;
    ring(A, p[0] - ax * back, p[1] - ay * back, p[2] - az * back, ra);
    ring(B, q[0] + ax * on, q[1] + ay * on, q[2] + az * on, rb);
    band(d, lit, alpha, rim, rimAlpha);
    if (i === n - 1) {
      // the tip: a ring narrowing beyond the last joint, closed by a flat end facing along the bone
      const e = rb * 0.55;
      ring(A, q[0], q[1], q[2], rb);
      ring(B, q[0] + ax * e, q[1] + ay * e, q[2] + az * e, e);
      band(d, lit, alpha, rim, rimAlpha);
      const t = SHADE + (1 - SHADE) * Math.max(0, ax * LIGHT[0] + ay * LIGHT[1] + az * LIGHT[2]);
      for (let k = 1; k + 2 < SIDES; k += 2) {
        d.put(B[0], B[1], B[2], B[3 * k], B[3 * k + 1], B[3 * k + 2], B[3 * k + 3], B[3 * k + 4], B[3 * k + 5], B[3 * k + 6], B[3 * k + 7], B[3 * k + 8],
          lit[0] * t, lit[1] * t, lit[2] * t, alpha);
      }
    }
  }
}

// The palm: a slab `thick` deep at the knuckles, thinner towards the wrist, its back a little
// domed, through rows of four points each (knuckles to wrist).
// -> [top, bottom]: the rows' points on its back and its underside.
function palmFaces({ rows }, { thick, dome }) {
  const n = rows.length;
  const half = r => (thick / 2) * (1 - (0.25 * r) / (n - 1));
  return [rows.map((row, r) => row.map((p, i) => add(p, [0, half(r) + (i === 1 || i === 2 ? dome : 0), 0]))),
    rows.map((row, r) => row.map(p => sub(p, [0, half(r), 0])))];
}
function slab(face, palm, shape, alpha) {
  const { rows } = palm, n = rows.length;
  const [top, bot] = palmFaces(palm, shape);
  const all = rows.flat();
  const inside = mul(all.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / all.length);
  const m = rows[0].length;
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < m - 1; i++) {
      face(top[r][i], top[r][i + 1], top[r + 1][i + 1], top[r + 1][i], inside, alpha);
      face(bot[r][i], bot[r][i + 1], bot[r + 1][i + 1], bot[r + 1][i], inside, alpha);
    }
    for (const i of [0, m - 1]) face(top[r][i], top[r + 1][i], bot[r + 1][i], bot[r][i], inside, alpha, true);
  }
  for (const r of [0, n - 1]) for (let i = 0; i < m - 1; i++) face(top[r][i], top[r][i + 1], bot[r][i + 1], bot[r][i], inside, alpha, true);
}
