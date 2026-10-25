// What the headset gives as input, read every frame. The Quest gives either tracked hands or
// controllers, and swaps them whenever the controllers are picked up or put down. A press is
// read from the source itself: a hand's pinch from its joints (thumb tip to index tip), a
// controller's trigger or grip from its gamepad. The session's select and squeeze events count
// too, but nothing waits for them: in the first try in the headset a hand's pinch near a handle
// took nothing. Pure: no WebXR objects are needed to test it.

// A hand pinches when its thumb and index tips come this close (joint centres, metres) and lets
// go once they part this far; the gap between the two keeps tracking jitter from flickering it.
export const PINCH_ON = 0.02;
export const PINCH_OFF = 0.04;

// 'hands', 'controllers', 'mixed' (one of each) or 'none'.
export function inputKind(sources) {
  let hands = 0, controllers = 0;
  for (const s of sources) {
    if (s.hand) hands++;
    else if (s.gripSpace || s.gamepad) controllers++;
  }
  if (hands && controllers) return 'mixed';
  if (hands) return 'hands';
  if (controllers) return 'controllers';
  return 'none';
}

export const KIND_LINE = {
  hands: 'Бачу: руки',
  controllers: 'Бачу: контролери',
  mixed: 'Бачу: руку й контролер',
  none: 'Не бачу ні рук, ні контролерів',
};

// The xr-standard gamepad of a controller: trigger, grip and thumbstick, and what brings the
// panel in front: `menu`, B / Y (button 5), and `stickPress`, the thumbstick pressed in (button
// 3; not in «Підлаштувати», where moving the stick presses it easily). `here`: either.
export function readPad(gamepad) {
  if (!gamepad) return { trigger: false, squeeze: false, stick: null, here: false, menu: false, stickPress: false };
  const b = gamepad.buttons || [];
  const a = gamepad.axes || [];
  const stick = a.length >= 4 ? [a[2] || 0, a[3] || 0] : null;
  const menu = !!(b[5] && b[5].pressed), stickPress = !!(b[3] && b[3].pressed);
  return { trigger: !!(b[0] && b[0].pressed), squeeze: !!(b[1] && b[1].pressed), stick, here: menu || stickPress, menu, stickPress };
}

// A palm faces up when its normal is within about 45° of straight up. The normal comes from the
// wrist and the index and little finger metacarpals: for a right hand their cross product
// points out of the palm, for a left hand out of the back.
export const PALM_UP = 0.7;

export function palmUp(side, wrist, indexBase, pinkyBase) {
  const a = [indexBase[0] - wrist[0], indexBase[1] - wrist[1], indexBase[2] - wrist[2]];
  const b = [pinkyBase[0] - wrist[0], pinkyBase[1] - wrist[1], pinkyBase[2] - wrist[2]];
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = Math.hypot(n[0], n[1], n[2]);
  if (len < 1e-9) return false;
  return (side === 'left' ? -n[1] : n[1]) / len >= PALM_UP;
}

// Presses of every source, from one frame's readings. A reading is {pinch: thumb-to-index
// distance or null when the joints are not tracked this frame, trigger, squeeze}. update()
// returns the sources whose press began and ended this frame; a source missing from the
// readings has gone and its press ends as lost.
export class PressTracker {
  constructor() {
    this.held = new Set(); // sources pressed now
    this.pinched = new Set(); // hands whose fingers are closed
    this.events = new Map(); // source -> Set of 'select' | 'squeeze' between start and end events
    this.absorb = false; // the next update takes presses already down as held, not as begun
  }

  event(source, kind, down) {
    let s = this.events.get(source);
    if (down) {
      if (!s) this.events.set(source, s = new Set());
      s.add(kind);
    } else if (s) {
      s.delete(kind);
      if (!s.size) this.events.delete(source);
    }
  }

  // readings: Map source -> {pinch, trigger, squeeze}. Returns {started: [], ended: [], lost: []}.
  update(readings) {
    const started = [], ended = [], lost = [];
    const absorb = this.absorb;
    this.absorb = false;
    for (const source of [...this.held]) {
      if (!readings.has(source)) { this.forget(source); lost.push(source); }
    }
    for (const source of [...this.pinched]) if (!readings.has(source)) this.pinched.delete(source);
    for (const source of [...this.events.keys()]) if (!readings.has(source)) this.events.delete(source);
    for (const [source, r] of readings) {
      if (r.pinch != null) {
        if (this.pinched.has(source)) { if (r.pinch > PINCH_OFF) this.pinched.delete(source); }
        else if (r.pinch < PINCH_ON) this.pinched.add(source);
      } // untracked joints keep the fingers as they were
      const down = this.pinched.has(source) || !!r.trigger || !!r.squeeze || this.events.has(source);
      if (down && !this.held.has(source)) { this.held.add(source); if (!absorb) started.push(source); }
      else if (!down && this.held.has(source)) { this.held.delete(source); ended.push(source); }
    }
    return { started, ended, lost };
  }

  forget(source) {
    this.held.delete(source);
    this.pinched.delete(source);
    this.events.delete(source);
  }

  // The session was hidden: every press ends, and a press still held when it comes back
  // counts as a new one only after it was let go.
  clear() {
    this.held.clear();
    this.pinched.clear();
    this.events.clear();
    this.absorb = true;
  }
}

// The last moments of a point, to take where it was just before a trigger was pulled: pulling
// it jolts the controller.
export class PointHistory {
  constructor(span = 0.15) { this.span = span; this.samples = []; }

  push(time, p) {
    this.samples.push({ time, p });
    while (this.samples.length > 1 && this.samples[0].time < time - this.span) this.samples.shift();
  }

  // The mean of the samples from `back` seconds before `time` and older; the oldest one if
  // none is that old.
  before(time, back = 0.05) {
    const old = this.samples.filter(s => s.time <= time - back);
    const use = old.length ? old : this.samples.slice(0, 1);
    if (!use.length) return null;
    const sum = use.reduce((a, s) => [a[0] + s.p[0], a[1] + s.p[1], a[2] + s.p[2]], [0, 0, 0]);
    return sum.map(v => v / use.length);
  }

  // The points of the last `back` seconds, newest first.
  recent(time, back) {
    return this.samples.filter(s => s.time >= time - back).map(s => s.p).reverse();
  }

  clear() { this.samples = []; }
}
