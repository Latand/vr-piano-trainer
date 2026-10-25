// WebGL2 drawing: coloured and textured quads in batches, premultiplied alpha so the headset
// blends them over the room (immersive-ar) and the desktop over its background.
import { identity } from './mat.js';

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aColor;
layout(location=2) in vec2 aUv;
uniform mat4 uProj, uView, uModel;
out vec4 vColor; out vec2 vUv;
void main() { vColor = aColor; vUv = aUv; gl_Position = uProj * uView * uModel * vec4(aPos, 1.0); }`;
const FS = `#version 300 es
precision mediump float;
in vec4 vColor; in vec2 vUv;
uniform sampler2D uTex;
out vec4 outColor;
void main() { vec4 c = vColor * texture(uTex, vUv); outColor = vec4(c.rgb * c.a, c.a); }`;

const FLOATS = 9; // x y z r g b a u v
const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Quads collected in the keyboard, panel or world frame, uploaded once per frame.
export class Batch {
  constructor() { this.data = []; }
  clear() { this.data.length = 0; }
  get quads() { return this.data.length / (FLOATS * 6); }

  // Four corners in order around the quad, one colour, optional uv corners.
  quad(a, b, c, d, color, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = [a, b, c, d][i], t = uv[i];
      this.data.push(p[0], p[1], p[2], color[0], color[1], color[2], color[3], t[0], t[1]);
    }
  }

  // A quad of flat corners and one colour, with the default uv: put(ax, ay, az, bx, ..., dz, r, g, b, a).
  put(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, r, g, b, a) {
    this.data.push(ax, ay, az, r, g, b, a, 0, 0, bx, by, bz, r, g, b, a, 1, 0, cx, cy, cz, r, g, b, a, 1, 1,
      ax, ay, az, r, g, b, a, 0, 0, cx, cy, cz, r, g, b, a, 1, 1, dx, dy, dz, r, g, b, a, 0, 1);
  }

  // Upright rectangle in the plane z, facing +z.
  rectXY(x0, x1, y0, y1, z, color, uv) {
    this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, uv);
  }

  // Flat rectangle at height y.
  rectXZ(x0, x1, z0, z1, y, color) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
  }

  outlineXZ(x0, x1, z0, z1, y, t, color) {
    this.rectXZ(x0, x1, z1 - t, z1, y, color);
    this.rectXZ(x0, x1, z0, z0 + t, y, color);
    this.rectXZ(x0, x0 + t, z0 + t, z1 - t, y, color);
    this.rectXZ(x1 - t, x1, z0 + t, z1 - t, y, color);
  }

  // The four corners of a flat rectangle: two strokes of length len at each.
  cornersXZ(x0, x1, z0, z1, y, t, len, color) {
    for (const [x, sx] of [[x0, 1], [x1, -1]]) {
      for (const [z, sz] of [[z0, 1], [z1, -1]]) {
        this.rectXZ(Math.min(x, x + sx * len), Math.max(x, x + sx * len), Math.min(z, z + sz * t), Math.max(z, z + sz * t), y, color);
        this.rectXZ(Math.min(x, x + sx * t), Math.max(x, x + sx * t), Math.min(z + sz * t, z + sz * len), Math.max(z + sz * t, z + sz * len), y, color);
      }
    }
  }

  outlineXY(x0, x1, y0, y1, z, t, color) {
    this.rectXY(x0, x1, y0, y0 + t, z, color);
    this.rectXY(x0, x1, y1 - t, y1, z, color);
    this.rectXY(x0, x0 + t, y0 + t, y1 - t, z, color);
    this.rectXY(x1 - t, x1, y0 + t, y1 - t, z, color);
  }

  // A ring of `segments` facing the given axis frame (u, v unit vectors) around centre c.
  ring(c, u, v, r0, r1, color, fraction = 1, segments = 32) {
    const n = Math.max(1, Math.round(segments * fraction));
    const at = (r, a) => [c[0] + r * (Math.cos(a) * u[0] + Math.sin(a) * v[0]),
      c[1] + r * (Math.cos(a) * u[1] + Math.sin(a) * v[1]), c[2] + r * (Math.cos(a) * u[2] + Math.sin(a) * v[2])];
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI / 2 - (i / segments) * 2 * Math.PI, a1 = Math.PI / 2 - ((i + 1) / segments) * 2 * Math.PI;
      this.quad(at(r0, a0), at(r1, a0), at(r1, a1), at(r0, a1), color);
    }
  }
}

// A Batch kept in a Float32Array that grows and is never given back: for the guide's batches
// (the hands, their keep, letters and digits), whose thousands of corners a frame an Array would
// allocate again each frame. data: the filled part.
export class FloatBatch extends Batch {
  constructor() { super(); this.buf = new Float32Array(FLOATS * 6 * 256); this.n = 0; }
  get data() { return this.buf.subarray(0, this.n); }
  set data(v) { /* Batch's constructor */ }
  clear() { this.n = 0; }
  get quads() { return this.n / (FLOATS * 6); }
  room(more) {
    if (this.n + more <= this.buf.length) return;
    const b = new Float32Array(Math.max(this.buf.length * 2, this.n + more));
    b.set(this.buf.subarray(0, this.n));
    this.buf = b;
  }
  quad(a, b, c, d, color, uv) {
    this.put(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], color[0], color[1], color[2], color[3], uv);
  }
  rectXY(x0, x1, y0, y1, z, color, uv) {
    this.put(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z, color[0], color[1], color[2], color[3], uv);
  }
  rectXZ(x0, x1, z0, z1, y, color) {
    this.put(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0, color[0], color[1], color[2], color[3]);
  }
  // uv: the four corners' [u, v], or none for the default
  put(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, r, g, b, a, uv = UV) {
    this.room(FLOATS * 6);
    const f = this.buf, o = this.n;
    const [ua, ub, uc, ud] = uv;
    f[o] = ax; f[o + 1] = ay; f[o + 2] = az; f[o + 7] = ua[0]; f[o + 8] = ua[1];
    f[o + 9] = bx; f[o + 10] = by; f[o + 11] = bz; f[o + 16] = ub[0]; f[o + 17] = ub[1];
    f[o + 18] = cx; f[o + 19] = cy; f[o + 20] = cz; f[o + 25] = uc[0]; f[o + 26] = uc[1];
    f[o + 27] = ax; f[o + 28] = ay; f[o + 29] = az; f[o + 34] = ua[0]; f[o + 35] = ua[1];
    f[o + 36] = cx; f[o + 37] = cy; f[o + 38] = cz; f[o + 43] = uc[0]; f[o + 44] = uc[1];
    f[o + 45] = dx; f[o + 46] = dy; f[o + 47] = dz; f[o + 52] = ud[0]; f[o + 53] = ud[1];
    for (let v = o + 3; v < o + 54; v += FLOATS) { f[v] = r; f[v + 1] = g; f[v + 2] = b; f[v + 3] = a; }
    this.n = o + 54;
  }
}

export class Renderer {
  constructor(gl) {
    this.gl = gl;
    this.program = link(gl, VS, FS);
    this.u = {};
    for (const n of ['uProj', 'uView', 'uModel', 'uTex']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    this.buffer = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 28);
    gl.bindVertexArray(null);
    this.white = this.texture(null);
    this.scratch = new Float32Array(FLOATS * 6 * 4096);
  }

  // A texture from a canvas, or a 1x1 white one.
  texture(canvas, previous = null) {
    const gl = this.gl;
    const tex = previous || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (canvas) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, canvas ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (canvas) gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  begin(clear = [0, 0, 0, 0]) {
    const gl = this.gl;
    gl.clearColor(...clear);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  // Draws batches [{batch, model, texture, depth}] from one eye. Every batch is translucent and
  // drawn in order, over what came before, with no depth test, but for the guide hands' three
  // (overlay.js buildOverlay): depth 'keep' writes its quads' depth as the nearest there is and
  // draws no colour, so nothing drawn as a shell or tested lands there; 'shell' (a solid drawn
  // translucent) is drawn twice, its depth alone and then its colour where it is nearest, so each
  // pixel shows its front face once; 'test' draws where it is no farther than what is there.
  draw(proj, view, items) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(false); // everything is translucent; order of the items decides overlap
    gl.uniformMatrix4fv(this.u.uProj, false, proj);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniform1i(this.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const { batch, model = identity(), texture = this.white, depth = null } of items) {
      const n = batch.data.length;
      if (!n) continue;
      if (this.scratch.length < n) this.scratch = new Float32Array(n * 2);
      this.scratch.set(batch.data);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.scratch.subarray(0, n), gl.STREAM_DRAW);
      gl.uniformMatrix4fv(this.u.uModel, false, model);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const count = n / FLOATS;
      if (depth === 'keep') {
        gl.colorMask(false, false, false, false);
        gl.depthMask(true);
        gl.depthRange(0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, count);
        gl.depthRange(0, 1);
        gl.depthMask(false);
        gl.colorMask(true, true, true, true);
        continue;
      }
      if (depth === 'shell') {
        gl.colorMask(false, false, false, false);
        gl.depthMask(true);
        gl.depthFunc(gl.LESS);
        gl.drawArrays(gl.TRIANGLES, 0, count);
        gl.colorMask(true, true, true, true);
        gl.depthMask(false);
      }
      if (depth) gl.depthFunc(gl.LEQUAL);
      gl.drawArrays(gl.TRIANGLES, 0, count);
      gl.depthFunc(gl.ALWAYS);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }
}

function link(gl, vs, fs) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
