// Column-major 4x4 matrices (as WebGL and WebXR use them) and 3-vectors as arrays.

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = a => Math.hypot(a[0], a[1], a[2]);
export const normalize = a => scale(a, 1 / (length(a) || 1));

export function identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export function translation(x, y, z) {
  const m = identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

// Rotation by `yaw` radians about +y, then translation to `position`.
export function yawPose(position, yaw) {
  const m = identity();
  const c = Math.cos(yaw), s = Math.sin(yaw);
  m[0] = c; m[2] = -s;
  m[8] = s; m[10] = c;
  m[12] = position[0]; m[13] = position[1]; m[14] = position[2];
  return m;
}

export function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

export function transformDir(m, d) {
  return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
}

// Inverse of a rotation-and-translation matrix.
export function invertRigid(m) {
  const out = identity();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[c * 4 + r] = m[r * 4 + c];
  const t = [m[12], m[13], m[14]];
  out[12] = -(out[0] * t[0] + out[4] * t[1] + out[8] * t[2]);
  out[13] = -(out[1] * t[0] + out[5] * t[1] + out[9] * t[2]);
  out[14] = -(out[2] * t[0] + out[6] * t[1] + out[10] * t[2]);
  return out;
}

export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f;
  m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

// View matrix of an eye at `eye` looking at `target`.
export function lookAt(eye, target, up = [0, 1, 0]) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  const m = identity();
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
  m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye);
  return m;
}

// Quaternion [x, y, z, w] of a rotation about +y.
export function yawQuaternion(yaw) {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

// Yaw of a matrix's x axis (the angle that yawPose would need).
export function yawOf(m) {
  return Math.atan2(-m[2], m[0]);
}

// A pose with its tilt removed: the position of `m` and the yaw of its x axis, upright about +y.
// The keyboard's base is always this (docs/piano-keyboard-handles-design.md §3.4): a saved
// anchor's rotation, kept up to date by the headset, may come back with a little roll or pitch.
export function levelPose(m) {
  return yawPose([m[12], m[13], m[14]], yawOf(m));
}

// The angle between a pose's up axis and +y, radians.
export function tiltOf(m) {
  return Math.acos(Math.max(-1, Math.min(1, m[5] / (Math.hypot(m[4], m[5], m[6]) || 1))));
}
