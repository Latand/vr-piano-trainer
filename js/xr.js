// The headset: an immersive-ar session over the room; the keyboard's place, locked once it is
// placed (docs/piano-trainer-v2.md §4); the panel pressed by fingertip or ray and carried by its
// bar; and a persistent anchor that brings the keyboard back in the next session. Every press is
// read from the sources each frame (input.js).
// Three modes: locked (nothing moves the keyboard; bare hands never do in any mode),
// «Підлаштувати» (a controller takes a corner or the height handle by its ray or tip and drags it,
// its ray and trigger on the keys slide the whole keyboard, the thumbsticks nudge it a millimetre
// a flick: docs/piano-keyboard-handles-design.md §4), and the calibration (a controller's tip on
// each end C and its trigger; the keyboard stays where it stands until the second touch). The
// keyboard always lies level (base()).
import { CalibrationFlow, StickNudger, keyboardMatrix, effectivePitch, basePose, serialize, deserialize, calibrated, foldWidth, depthOf, drawnMatrix, STORE_KEY, ZERO_NUDGE, CONTROLLER_PAD } from './calibrate.js';
import { settledPose, panelInFront, panelFacing, plausiblePlace, panelBarAt, rayKeyboard, rayFace, slideNudge, RELEASE_BACK,
  rectOf, dragRect, nudgeFor, nudgeFits, handlesOf, handleByTip, handleByRay } from './place.js';
import { PressTracker, PointHistory, inputKind, readPad, palmUp, PINCH_OFF } from './input.js';
import { guideLines, statusLine } from './guide.js';
import { rayButton, rayPoint, buttonAt, layout, Poke, panelInKeyboard, panelHeight, panelCovers, pageLayout, WIDTH as PANEL_WIDTH, HEIGHT as PANEL_HEIGHT } from './panel.js';
import { buildCalibrationMarks } from './overlay.js';
import { WHITE_PITCH } from './geometry.js';
import { scrubTime, scrubReach, rayWaterfall, tipWaterfall } from './scrub.js';
import { multiply, invertRigid, transformPoint, yawQuaternion, translation, add, sub, scale, length, levelPose, tiltOf } from './mat.js';

export const SESSION_INIT = { requiredFeatures: [], optionalFeatures: ['local-floor', 'hand-tracking', 'anchors'] };
// Seconds of visible frames to find a saved anchor before calibrating again. Time while the
// session is hidden (the Quest's boundary, its menu) does not count.
const RESTORE_DEADLINE = 6;
const LONGEST_FRAME = 0.1; // a longer gap between frames counts as this much
const LOST_PLACE = 'Місце не знайдено: калібруй знову';
const FAR_PLACE = 'Збережене місце далеко: калібруй знову';
const NO_PLACE = 'Ще немає місця: торкнись крайніх До';
const PALMS_HOLD = 1; // seconds both open palms face up to bring the panel in front
const CLOSING = 0.2; // seconds a pinch takes to close, looked back on when it takes the panel's bar
// On entry the panel goes beside the lowest C of a saved keyboard found no further than this from
// the eyes (every seat at the keys, tests/panel.test.mjs); a keyboard further away leaves it in front.
export const PANEL_REACH = 1.1;
// The sign over the waterfall hides when it would stand this close to the panel, as seen.
const SIGN_MARGIN = 0.01;
export const RAY_LENGTH = 1.5; // a controller's ray in «Підлаштувати» when it hits nothing, metres
const SLIDE_HISTORY = 0.3;

export async function xrSupported() {
  try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); }
  catch { return false; }
}

export async function startXR(app) {
  const session = await navigator.xr.requestSession('immersive-ar', SESSION_INIT);
  const xr = new XrRun(app, session);
  await xr.start();
  return xr;
}

export class XrRun {
  constructor(app, session) {
    this.app = app;
    this.session = session;
    this.space = null;
    this.cal = null; // {position, yaw, pitch, widthLocked, measured, nudge, anchor, saved}
    this.anchor = null; // XRAnchor of the saved place, when anchors are available
    this.restoring = null; // {waited} while waiting for a saved anchor
    this.lost = false; // the saved anchor was not found: its place is unknown in this session
    this.flow = null; // CalibrationFlow while calibrating
    this.adjust = null; // {entry: the record on entering, slide, drag} in «Підлаштувати»
    this.scrub = null; // {source, by: tip | ray, y, history} while a trigger holds the waterfall (App.scrubBegin)
    this.sticks = new StickNudger();
    this.nudging = false; // the sticks moved the keyboard; saved once they rest
    this.notice = '';
    this.panelPose = null; // the panel's matrix when it is not beside the keys; set in front of the eyes on the first frame
    this.panelDocked = false; // the panel stands beside the lowest C (after a calibration in this session)
    this.panelAuto = true; // the panel stands where entering put it: it docks once the saved keyboard is found within reach
    this.panelGrab = null; // {source, from, start} while the bar over the panel is held
    this.hereWanted = false; // put the panel in front on the next frame
    this.hereDown = new Set(); // controllers whose B/Y or stick button was down last frame
    this.palms = { since: null, fired: false }; // both open palms up: since when, and fired once
    this.dropped = false; // the saved place failed plausiblePlace: it is not drawn
    this.checkPlace = false; // check a saved place without an anchor on the next frame with a head
    this.pokes = { left: new Poke(), right: new Poke() };
    this.tips = { left: null, right: null }; // index fingertips, for pressing the panel
    this.points = new Map(); // input source -> where it grabs: between thumb and index, or the grip
    this.pointHistory = new Map(); // input source -> PointHistory of its grab point
    this.rays = new Map(); // input source -> its target ray this frame
    this.pads = new Map(); // controller -> readPad() this frame
    this.controllerTips = new Map(); // controller -> PointHistory of its target-ray origin
    this.presses = new PressTracker();
    this.kind = 'none'; // inputKind() of the sources this frame
    this.lastBase = null;
    this.lastTime = null;
    this.now = 0;
    this.generation = 0; // counts saved places; a late anchor for an older one is dropped
    // the largest tilt of the anchor's pose seen this session, degrees: what levelPose took away
    // (docs/piano-keyboard-handles-design.md §3.5), for the check in the headset
    this.anchorTilt = 0;
    this.keyboardFrame = null; // the keyboard's rigid, level frame this frame (K)
    this.keyboardModel = null; // as drawn: K stretched to the keys' depth (calibrate.js drawnMatrix)
    this.pitchNow = WHITE_PITCH;
    this.handles = []; // «Підлаштувати»: the handles in the room this frame (place.js handlesOf)
    this.draw = { rays: [], hover: false, grabbed: false, target: null, dim: false, aim: null, handles: [], eye: null };
    this.clock = () => new Date(); // the time a record is saved with; tests set their own
    if (typeof window !== 'undefined') window.__pianoXr = this;
  }

  async start() {
    const { app, session } = this;
    const gl = app.gl;
    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: true, antialias: true }) });
    try { this.space = await session.requestReferenceSpace('local-floor'); this.spaceKind = 'local-floor'; }
    catch { this.space = await session.requestReferenceSpace('local'); this.spaceKind = 'local'; }
    // A boundary reset or recentre moves the origin: the panel goes in front again and docks as on
    // entry once the keyboard is found within reach, and a place kept without an anchor (it moved
    // with the origin) is checked again.
    this.space.addEventListener?.('reset', () => this.spaceReset());
    // The events only add to what the sources show each frame (PressTracker).
    for (const [type, kind, down] of [['selectstart', 'select', true], ['selectend', 'select', false],
      ['squeezestart', 'squeeze', true], ['squeezeend', 'squeeze', false]]) {
      session.addEventListener(type, e => {
        // a press may count as the user's action for the sound (docs/piano-audio-design.md §7)
        if (down && app.sound) app.sound.wake();
        this.presses.event(e.inputSource, kind, down);
      });
    }
    session.addEventListener('inputsourceschange', e => {
      for (const s of e.removed || []) { this.controllerTips.delete(s); this.pointHistory.delete(s); }
    });
    session.addEventListener('visibilitychange', () => this.visibilityChanged());
    document.body.classList.add('in-xr');
    session.addEventListener('end', () => {
      document.body.classList.remove('in-xr');
      if (this.scrub) this.cancelScrub();
      app.xr = null;
      if (app.panelMode === 'adjust' || app.panelMode === 'calibrate') leaveMode(app);
      app.changed();
    });
    app.xr = this;
    this.begin(deserialize(localStorage.getItem(STORE_KEY)));
    app.changed();
    session.requestAnimationFrame((t, f) => this.frame(t, f));
  }

  // The saved record at the session's start: its anchor looked for, or its pose checked by eye
  // without anchors; nothing saved: a calibration. A width left unlocked is locked.
  begin(saved) {
    if (saved && saved.widthLocked === false) saved = foldWidth(saved);
    if (saved && saved.anchor && this.session.restorePersistentAnchor) {
      this.restore(saved);
    } else if (saved) {
      // Without anchors the saved pose belongs to the old session's origin: check it by eye.
      this.cal = saved;
      this.notice = 'Без якоря: перевір клавіші';
      this.checkPlace = true;
    } else {
      this.beginCalibration();
    }
  }

  // Asks the headset for the saved anchor. An answer that comes after the deadline, or after a
  // calibration replaced the restore, changes nothing.
  restore(saved) {
    this.cal = saved;
    this.lost = false;
    const attempt = this.restoring = { waited: 0 };
    return this.session.restorePersistentAnchor(saved.anchor).then(a => {
      if (this.restoring === attempt) this.anchor = a;
    }, () => {
      if (this.restoring === attempt) this.restoreFailed();
    });
  }

  restoreFailed() {
    this.restoring = null;
    this.anchor = null;
    this.lost = true;
    this.beginCalibration(LOST_PLACE);
  }

  // The saved place came back where no keyboard stands for a seated player (plausiblePlace): it
  // is not drawn, and a calibration starts. The record stays until a new place is saved.
  dropPlace() {
    this.restoring = null;
    this.anchor = null;
    this.dropped = true;
    this.checkPlace = false;
    this.notice = '';
    this.beginCalibration(FAR_PLACE);
  }

  // True when the keyboard on `base` could stand in front of the eyes at `head`.
  plausible(base, head) {
    return plausiblePlace(keyboardMatrix(base, this.cal), effectivePitch(this.cal), head, { floor: this.spaceKind === 'local-floor' });
  }

  spaceReset() {
    this.panelPose = null;
    this.panelAuto = true;
    this.panelGrab = null;
    this.lastBase = null;
    if (this.cal && !this.anchor) this.checkPlace = true;
    this.app.changed();
  }

  // «Панель сюди», B or Y, a stick press, both palms up: the panel in front of the eyes, undocked.
  here(head) {
    this.hereWanted = false;
    this.panelGrab = null;
    this.panelDocked = false;
    this.panelAuto = false;
    this.panelPose = panelInFront(head);
    this.app.changed();
  }

  // A keyboard placed in this session that can be shown and adjusted.
  get placed() { return !!this.cal && !this.dropped && !this.lost && !this.restoring; }

  // A calibration from the first touch. A placed keyboard (and its anchor) stays, drawn where it
  // stands, until the new one is saved. A restore still waiting is given up and leaves the place
  // unknown: the stored pose of an anchored record belongs to an older session's origin, so it is
  // neither drawn nor gone back to by «Скасувати». The width is measured from the touches unless
  // it is locked.
  beginCalibration(problem = '') {
    this.releaseScrub();
    if (this.adjust) {
      // «Підлаштувати» ends with what it moved kept; an unlocked width stays so, to be measured
      if (this.adjust.slide) this.cancelSlide();
      if (this.adjust.drag) this.cancelDrag();
      this.adjust = null;
      this.sticks.reset();
      if (this.nudging) { this.nudging = false; this.save(); }
    }
    if (this.restoring) {
      this.restoring = null;
      this.anchor = null;
      this.lost = true;
    }
    this.panelAuto = false; // a calibration docks the panel when it ends
    this.flow = new CalibrationFlow({ pitch: this.cal && this.cal.widthLocked !== false ? effectivePitch(this.cal) : null });
    this.flow.problem = problem;
    enterMode(this.app, 'calibrate');
    this.app.changed();
  }

  endCalibration() {
    this.flow = null;
    leaveMode(this.app);
    this.app.changed();
  }

  // «Підлаштувати»: only for a keyboard that stands and is not being calibrated or looked for.
  beginAdjust() {
    if (this.adjust || this.flow || !this.placed) return;
    this.releaseScrub();
    this.adjust = { entry: cloneCal(this.cal), slide: null, drag: null };
    this.sticks.reset();
    this.nudging = false;
    // the panel beside the lowest C, off the keys being fitted, when that is within reach
    this.panelAuto = true;
    enterMode(this.app, 'adjust');
    this.app.changed();
  }

  // «Готово» (keep: true) saves the place, a width the corners changed folded into the pitch;
  // «Скасувати» puts back the record as it was on entering, its depth too. Both save.
  endAdjust({ keep }) {
    if (!this.adjust) return;
    if (this.adjust.slide) this.cancelSlide();
    if (this.adjust.drag) this.cancelDrag();
    this.cal = keep ? foldWidth(this.cal) : this.adjust.entry;
    this.adjust = null;
    this.nudging = false;
    this.sticks.reset();
    this.save();
    if (this.app.panelMode === 'adjust') leaveMode(this.app);
    this.app.changed();
  }

  command(id) {
    switch (id) {
      case 'here': this.hereWanted = true; return;
      case 'calibrate': this.beginCalibration(); return;
      case 'adjust': this.beginAdjust(); return;
      case 'adjustDone': this.endAdjust({ keep: true }); return;
      case 'adjustCancel': this.endAdjust({ keep: false }); return;
      case 'cancel':
      case 'calibrateCancel':
        // Back to the keyboard as it was; with no place to go back to the calibration goes on.
        if (!this.flow) return;
        if (!this.placed) { this.flow.problem = NO_PLACE; this.app.changed(); return; }
        if (this.cal.widthLocked === false) { this.cal = foldWidth(this.cal); this.save(); }
        this.endCalibration();
        return;
      default:
    }
  }

  // What the panel shows: the state, from the most pressing.
  guideState() {
    if (this.flow) return 'calibrate';
    if (this.adjust) return 'adjust';
    if (this.restoring) return 'restore';
    return 'play';
  }

  panelLines() {
    return guideLines({ state: this.guideState(), kind: this.kind, pitch: this.pitchNow, notice: this.notice,
      step: this.flow && this.flow.step, problem: this.flow && this.flow.problem });
  }

  statusLine() {
    return statusLine(this.kind, this.guideState());
  }

  // The calibration's part of App.panelState: rounded to what the panel shows, so it changes only
  // when the text would (docs/piano-trainer-v2.md §7.2).
  calibrationState() {
    const cal = this.cal;
    const n = { ...ZERO_NUDGE, ...(cal && cal.nudge) };
    let adjust = null;
    if (this.adjust) {
      const e = { ...ZERO_NUDGE, ...this.adjust.entry.nudge };
      const mm = v => Math.round(v * 1000);
      adjust = { x: mm(n.x - e.x), y: mm(n.y - e.y), z: mm(n.z - e.z), yaw: Math.round(((n.yaw - e.yaw) * 1800) / Math.PI) / 10 };
    }
    return {
      locked: !this.adjust && !this.flow,
      // the key pitch to a tenth of a millimetre and the depth to a millimetre, as the panel shows them
      pitch: cal ? Math.round(effectivePitch(cal) * 1e4) / 1e4 : null,
      depth: cal ? Math.round(depthOf(cal) * 1e3) / 1e3 : null,
      measured: (cal && cal.measured) || null,
      saved: (cal && cal.saved) || null,
      anchored: !!this.anchor,
      step: this.flow ? this.flow.step : null,
      problem: (this.flow && this.flow.problem) || '',
      controllers: this.kind === 'controllers' || this.kind === 'mixed',
      adjust,
      // a keyboard is placed in this session (the record, not this frame's pose: a frame without
      // the anchor's pose after a recentre changes nothing); else why not: its saved place not
      // found, or too far
      placed: this.placed, lost: this.lost ? 'lost' : this.dropped ? 'far' : null,
    };
  }

  // What overlay.js draws this frame beyond the keys: the controllers' rays ({from, to, hit}; hit:
  // on the keys in «Підлаштувати»), whether one is on the keyboard, whether it is held, the key to
  // touch while calibrating, whether the keyboard stands dimmed (calibrating over a placed one),
  // and on the panel (aim): the targets a ray or a fingertip is on and where the rays meet it.
  drawState() { return this.draw; }

  // Whether the sign over the waterfall may show this frame (corners: in the keyboard frame):
  // only while playing on a placed keyboard, and not where the panel stands in front of it.
  signClear(corners) {
    if (this.guideState() !== 'play' || !this.keyboardModel || !this.head) return false;
    if (!this.panelMatrix) return true;
    const eye = [this.head[12], this.head[13], this.head[14]];
    return !panelCovers(this.panelMatrix, panelHeight(this.app.panelMode), eye, corners.map(c => transformPoint(this.keyboardModel, c)), SIGN_MARGIN);
  }

  save() {
    if (!this.cal) return;
    const saved = this.clock().toISOString();
    this.cal = { ...this.cal, saved };
    try { localStorage.setItem(STORE_KEY, serialize(this.cal)); } catch { /* storage full or blocked: keeps working this session */ }
  }

  // The base pose this frame: the anchor's, or the stored one; null while there is none. Always
  // level: of the anchor's pose only its position and yaw count, since the headset may hand back
  // its rotation with a little roll or pitch (after a while, after a recentre), which would put
  // one end of the keys higher than the other.
  base(frame) {
    if (!this.cal || this.dropped || this.lost) return null;
    if (this.anchor) {
      const pose = frame.getPose(this.anchor.anchorSpace, this.space);
      if (pose) {
        const m = pose.transform.matrix;
        this.anchorTilt = Math.max(this.anchorTilt, (tiltOf(m) * 180) / Math.PI);
        return levelPose(m);
      }
      return this.lastBase; // a frame without tracking keeps the last place
    }
    if (this.restoring) return null;
    return basePose(this.cal);
  }

  // The session was hidden or blurred (the Quest's boundary, its menu): presses end, a slide goes
  // back to where it began and saves nothing, a stick nudge already made is saved. A calibration
  // keeps the touch it has.
  visibilityChanged() {
    // back from the Quest's menu or boundary: a context the system suspended runs again
    if (this.session.visibilityState === 'visible') { if (this.app.sound) this.app.sound.wake(); return; }
    this.presses.clear();
    if (this.adjust && this.adjust.slide) this.cancelSlide();
    if (this.adjust && this.adjust.drag) this.cancelDrag();
    if (this.scrub) this.cancelScrub();
    this.sticks.reset();
    if (this.nudging) { this.nudging = false; this.save(); }
    this.panelGrab = null;
    for (const h of this.controllerTips.values()) h.clear();
    for (const h of this.pointHistory.values()) h.clear();
    this.app.changed();
  }

  // A pinch, trigger or grip that starts at the bar over the panel takes the panel: where the
  // source is now, or anywhere it was while the fingers were closing. Returns true when it did.
  panelGrabStart(source, now = null) {
    if (this.panelGrab) return false;
    const point = this.points.get(source);
    const panel = this.panelMatrix;
    if (!point || !panel) return false;
    const h = now !== null && this.pointHistory.get(source);
    const passed = [point, ...(h ? h.recent(now, CLOSING) : [])];
    if (!passed.some(p => panelBarAt(panel, panelHeight(this.app.panelMode), PANEL_WIDTH, p))) return false;
    this.panelGrab = { source, from: point, start: [panel[12], panel[13], panel[14]] };
    this.panelDocked = false;
    this.panelAuto = false;
    this.panelPose = panel;
    this.app.changed();
    return true;
  }

  // «Підлаштувати»: a controller's trigger with its ray on the keyboard (nearer than the panel)
  // takes it. The grab counts from where the grip was just before the pull (the pull jolts it).
  slideStart(source, now) {
    if (!this.adjust || this.adjust.slide || this.adjust.drag || source.hand || !this.keyboardFrame) return false;
    const m = this.rays.get(source);
    if (!m) return false;
    const origin = [m[12], m[13], m[14]], dir = [-m[8], -m[9], -m[10]];
    const hit = rayKeyboard(this.keyboardFrame, this.pitchNow, origin, dir, depthOf(this.cal));
    if (!hit) return false;
    if (this.panelMatrix && rayFace(this.panelMatrix, PANEL_WIDTH, panelHeight(this.app.panelMode), origin, dir) < hit.distance) return false;
    const h = this.pointHistory.get(source);
    const from = (h && h.before(now)) || this.points.get(source);
    if (!from) return false;
    this.adjust.slide = { source, from, nudge: { ...ZERO_NUDGE, ...this.cal.nudge }, history: [] };
    this.app.changed();
    return true;
  }

  // The slide follows the grip, one to one across the table.
  advanceSlide(base, now) {
    const slide = this.adjust && this.adjust.slide;
    if (!slide || !base) return;
    const p = this.points.get(slide.source);
    if (!p) return; // a frame without tracking holds the last place
    const nudge = slideNudge(slide.nudge, base, sub(p, slide.from));
    this.cal = { ...this.cal, nudge };
    slide.history.push({ time: now, pose: nudge });
    while (slide.history.length > 1 && slide.history[0].time < now - SLIDE_HISTORY) slide.history.shift();
  }

  // The trigger let go: the place from RELEASE_BACK before it is saved.
  slideEnd(now) {
    const slide = this.adjust.slide;
    this.adjust.slide = null;
    const nudge = settledPose(slide.history, now);
    if (nudge) this.cal = { ...this.cal, nudge };
    else this.cal = { ...this.cal, nudge: slide.nudge };
    this.save();
    this.app.changed();
  }

  // A slide that ends without its trigger letting go (the source lost, the session hidden): the
  // keyboard goes back to where the slide began and nothing is saved.
  cancelSlide() {
    const slide = this.adjust.slide;
    this.adjust.slide = null;
    this.cal = { ...this.cal, nudge: slide.nudge };
    this.app.changed();
  }

  // «Підлаштувати»: the handle a controller's press takes (docs/piano-keyboard-handles-design.md
  // §4.3): by its tip within HANDLE_TIP, else by its ray within HANDLE_RAY where the panel's face is
  // not nearer along it. Hands never take a handle. -> {id, by, ...} or null.
  handleUnder(source, now = null) {
    if (source.hand || !this.handles.length) return null;
    const h = now !== null && this.controllerTips.get(source);
    const tip = (h && h.before(now)) || (this.touchTips && this.touchTips.get(source));
    const held = new Set(this.adjust && this.adjust.drag ? this.adjust.drag.grabs.map(g => g.handle) : []);
    const free = this.handles.filter(x => !held.has(x.id));
    const byTip = tip ? handleByTip(free, tip) : null;
    if (byTip) return byTip;
    const m = this.rays.get(source);
    if (!m) return null;
    const origin = [m[12], m[13], m[14]], dir = [-m[8], -m[9], -m[10]];
    const hit = handleByRay(free, origin, dir);
    if (!hit) return null;
    if (this.panelMatrix && rayFace(this.panelMatrix, PANEL_WIDTH, panelHeight(this.app.panelMode), origin, dir) < hit.distance) return null;
    return hit;
  }

  // A controller's trigger or grip that begins on a handle takes it, counted from where the grip
  // was just before the press. A second controller may take another handle; a slide running
  // refuses it.
  dragStart(source, now) {
    if (!this.adjust || this.adjust.slide || source.hand || !this.keyboardFrame) return false;
    if (this.adjust.drag && this.adjust.drag.grabs.some(g => g.source === source)) return false;
    const hit = this.handleUnder(source, now);
    if (!hit) return false;
    const h = this.pointHistory.get(source);
    const from = (h && h.before(now)) || this.points.get(source);
    if (!from) return false;
    const drag = this.adjust.drag || (this.adjust.drag = { grabs: [], first: { nudge: { ...ZERO_NUDGE, ...this.cal.nudge }, depth: this.cal.depth }, history: [], start: null });
    this.regrab();
    drag.grabs.push({ source, handle: hit.id, from });
    this.app.changed();
    return true;
  }

  // The set of grabs changes: the drag goes on from the keyboard as it stands, each grab held on
  // from where its grip is now.
  regrab() {
    const drag = this.adjust.drag;
    drag.start = rectOf(this.lastBase, this.cal);
    for (const g of drag.grabs) g.from = this.points.get(g.source) || g.from;
  }

  // The handles follow their grips one to one (place.js dragRect): a corner by the grip's
  // horizontal travel, the height handle by its vertical travel. A state past NUDGE_LIMIT is not
  // taken: the keyboard holds its last allowed place.
  advanceDrag(base, now) {
    const drag = this.adjust && this.adjust.drag;
    if (!drag || !base) return;
    const moves = {};
    for (const g of drag.grabs) {
      const p = this.points.get(g.source);
      if (p) moves[g.handle] = sub(p, g.from); // a frame without tracking holds the handle where it was
    }
    const rect = dragRect(drag.start, moves);
    const nudge = nudgeFor(base, this.cal, rect);
    if (nudgeFits(nudge)) this.cal = { ...this.cal, nudge, depth: rect.depth };
    drag.history.push({ time: now, pose: { nudge: this.cal.nudge, depth: this.cal.depth } });
    while (drag.history.length > 1 && drag.history[0].time < now - SLIDE_HISTORY) drag.history.shift();
  }

  // A trigger or grip let go: with other handles held the drag goes on from here; the last one
  // keeps the place from RELEASE_BACK before it, its width folded into the pitch, and saves it.
  dragEnd(source, now) {
    const drag = this.adjust.drag;
    drag.grabs = drag.grabs.filter(g => g.source !== source);
    if (drag.grabs.length) { this.regrab(); this.app.changed(); return; }
    this.adjust.drag = null;
    const settled = settledPose(drag.history, now) || drag.first;
    const was = this.cal.pitch + (drag.first.nudge.pitch || 0);
    const cal = foldWidth({ ...this.cal, nudge: settled.nudge, depth: settled.depth });
    if (Math.abs(cal.pitch - was) > 1e-9) cal.measured = this.clock().toISOString(); // the corners measured the width
    if (cal.depth === undefined) delete cal.depth;
    this.cal = cal;
    this.save();
    this.app.changed();
  }

  // A drag that ends without its press letting go (a source lost, the session hidden): the
  // keyboard goes back to where the drag began and nothing is saved.
  cancelDrag() {
    const drag = this.adjust.drag;
    this.adjust.drag = null;
    this.cal = { ...this.cal, nudge: drag.first.nudge, depth: drag.first.depth };
    if (this.cal.depth === undefined) delete this.cal.depth;
    this.app.changed();
  }

  // Where a controller's press would take the waterfall (scrub.js): by its tip on the waterfall's
  // face, else by its ray on the waterfall where the panel's face is not nearer along it; on a
  // placed keyboard, outside calibrating and «Підлаштувати» (they own the trigger then). -> {by,
  // y, point (by ray)} or null.
  waterfallUnder(source, now = null) {
    if (this.adjust || this.flow || !this.keyboardFrame || !this.cal) return null;
    const depth = depthOf(this.cal);
    const h = now !== null && this.controllerTips.get(source);
    const tip = (h && h.before(now)) || (this.touchTips && this.touchTips.get(source));
    const byTip = tip && tipWaterfall(this.keyboardFrame, this.pitchNow, depth, tip);
    if (byTip) return { by: 'tip', y: byTip.y };
    const m = this.rays.get(source);
    if (!m) return null;
    const origin = [m[12], m[13], m[14]], dir = [-m[8], -m[9], -m[10]];
    const hit = rayWaterfall(this.keyboardFrame, this.pitchNow, depth, origin, dir);
    if (!hit) return null;
    if (this.panelMatrix && rayFace(this.panelMatrix, PANEL_WIDTH, panelHeight(this.app.panelMode), origin, dir) < hit.distance) return null;
    return { by: 'ray', y: hit.y, point: hit.point, distance: hit.distance };
  }

  // The height the scrub's source holds the waterfall at this frame: its tip's, or where its ray
  // meets the waterfall's plane within its reach; null while it cannot tell (untracked, the ray
  // turned away or nearly along the plane).
  scrubHeight(s) {
    const depth = depthOf(this.cal);
    if (s.by === 'tip') {
      const tip = this.touchTips && this.touchTips.get(s.source);
      return tip ? tipWaterfall(this.keyboardFrame, this.pitchNow, depth, tip, { bounded: false }).y : null;
    }
    const m = this.rays.get(s.source);
    const hit = m && rayWaterfall(this.keyboardFrame, this.pitchNow, depth, [m[12], m[13], m[14]], [-m[8], -m[9], -m[10]], { bounded: false, reach: s.reach });
    return hit ? hit.y : null;
  }

  // A controller's trigger that begins on the waterfall takes the song (App.scrubBegin).
  scrubStart(source, now) {
    if (this.scrub || !this.app.scrubBegin) return false;
    const under = this.waterfallUnder(source, now);
    if (!under) return false;
    const from = this.app.scrubBegin(now);
    if (from === null || from === undefined) return false;
    this.scrub = { source, by: under.by, y: under.y, from, history: [], reach: under.by === 'ray' ? scrubReach(under.distance) : null };
    this.app.changed();
    return true;
  }

  // The song follows the held waterfall one to one; a frame that cannot tell holds it. The app may
  // have let it go meanwhile (a new song, «Спочатку»): then the hold ends.
  advanceScrub(now) {
    const s = this.scrub;
    if (!s || !this.keyboardFrame) return;
    const y = this.scrubHeight(s);
    if (y === null) return;
    const at = this.app.scrubTo(scrubTime(s.from, y - s.y), now);
    if (at === null || at === undefined) { this.scrub = null; return; }
    s.history.push({ time: now, pose: at });
    while (s.history.length > 1 && s.history[0].time < now - SLIDE_HISTORY) s.history.shift();
  }

  // The trigger let go: the song goes on from where it stood RELEASE_BACK before (the release jolts
  // the controller), as it was, playing or paused.
  scrubEnd(now) {
    const s = this.scrub;
    this.scrub = null;
    const at = settledPose(s.history, now);
    this.app.scrubEnd(at === null || at === undefined ? null : at, now);
  }

  // A scrub that ends without its trigger letting go (the source lost, the session hidden or
  // ended): the song goes back to where it was taken, as it was.
  cancelScrub() {
    const s = this.scrub;
    this.scrub = null;
    this.app.scrubEnd(s.from, this.now);
  }

  // Calibrating or «Підлаштувати» begins while the song is held: it is let go where it stands.
  releaseScrub() {
    if (!this.scrub) return;
    this.scrub = null;
    if (this.app.scrubEnd) this.app.scrubEnd(null, this.now);
  }

  // The thumbsticks, in «Підлаштувати» while nothing slides. Once they rest the nudge is saved.
  nudgeBySticks(now, dt) {
    if (!this.adjust || this.adjust.slide || this.adjust.drag || !this.cal) return;
    const sticks = { left: null, right: null };
    for (const [source, pad] of this.pads) {
      if (!pad.stick || !(source.handedness in sticks)) continue;
      sticks[source.handedness] = pad.stick;
    }
    const { cal } = this.sticks.update(this.cal, sticks, now, dt);
    if (cal !== this.cal) {
      this.cal = cal;
      this.nudging = true;
      this.app.changed();
    }
    if (this.nudging && !this.sticks.busy) {
      this.nudging = false;
      this.save();
      this.app.changed();
    }
  }

  // A new place from a calibration: saved at once, then given an anchor. If another place is
  // saved while this anchor is being made, this one's anchor is dropped and deleted.
  // pose: {position, yaw, pitch} and optionally the rest of a record (calibrated()).
  async commit(frame, pose) {
    const old = this.cal && this.cal.anchor;
    const generation = ++this.generation;
    this.cal = { position: pose.position, yaw: pose.yaw, pitch: pose.pitch, nudge: { ...ZERO_NUDGE, ...pose.nudge },
      widthLocked: pose.widthLocked !== false, measured: pose.measured || null, anchor: null };
    if (Number.isFinite(pose.depth)) this.cal.depth = pose.depth;
    this.anchor = null;
    this.dropped = false;
    this.lost = false;
    this.checkPlace = false;
    this.notice = '';
    this.save();
    this.app.changed();
    if (!frame.createAnchor) return;
    try {
      const p = pose.position, q = yawQuaternion(pose.yaw);
      const anchor = await frame.createAnchor(new XRRigidTransform({ x: p[0], y: p[1], z: p[2] }, { x: q[0], y: q[1], z: q[2], w: q[3] }), this.space);
      if (this.generation !== generation) { anchor.delete?.(); return; }
      this.anchor = anchor;
      if (anchor.requestPersistentHandle) {
        const handle = await anchor.requestPersistentHandle();
        if (this.generation !== generation) {
          this.session.deletePersistentAnchor?.(handle).catch(() => {});
          return;
        }
        this.cal.anchor = handle;
        this.save();
        if (old && old !== this.cal.anchor && this.session.deletePersistentAnchor) {
          this.session.deletePersistentAnchor(old).catch(() => {});
        }
      }
    } catch {
      // No anchor: the stored pose still works for this session.
    }
  }

  // Fingertips, grab points, rays and gamepads of every tracked source, and one reading each for
  // the presses.
  readInputs(frame, now) {
    const tips = { left: null, right: null };
    const points = new Map(), rays = new Map(), pads = new Map(), readings = new Map(), touchTips = new Map(), palms = new Set();
    for (const source of this.session.inputSources) {
      const ray = source.targetRaySpace && frame.getPose(source.targetRaySpace, this.space);
      if (ray) rays.set(source, ray.transform.matrix);
      if (source.hand) {
        const pose = name => { const j = source.hand.get(name); return j && frame.getJointPose(j, this.space); };
        const index = pose('index-finger-tip'), thumb = pose('thumb-tip');
        const wrist = pose('wrist'), indexBase = pose('index-finger-metacarpal'), pinkyBase = pose('pinky-finger-metacarpal');
        if (index && tips.hasOwnProperty(source.handedness)) {
          const p = index.transform.position;
          tips[source.handedness] = { tip: [p.x, p.y, p.z], radius: index.radius };
        }
        let pinch = null;
        if (index && thumb) {
          const a = index.transform.position, b = thumb.transform.position;
          points.set(source, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]);
          pinch = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        }
        const at = j => [j.transform.position.x, j.transform.position.y, j.transform.position.z];
        if (wrist && indexBase && pinkyBase && pinch !== null && pinch > PINCH_OFF &&
          palmUp(source.handedness, at(wrist), at(indexBase), at(pinkyBase))) palms.add(source.handedness);
        readings.set(source, { pinch, trigger: false, squeeze: false });
      } else {
        const pad = readPad(source.gamepad);
        pads.set(source, pad);
        readings.set(source, { pinch: null, trigger: pad.trigger, squeeze: pad.squeeze });
        const grip = source.gripSpace && frame.getPose(source.gripSpace, this.space);
        if (grip) { const p = grip.transform.position; points.set(source, [p.x, p.y, p.z]); }
        if (ray) {
          const m = ray.transform.matrix, tip = [m[12], m[13], m[14]];
          let h = this.controllerTips.get(source);
          if (!h) this.controllerTips.set(source, h = new PointHistory());
          h.push(now, tip);
          touchTips.set(source, tip);
        }
      }
    }
    for (const [source, p] of points) {
      let h = this.pointHistory.get(source);
      if (!h) this.pointHistory.set(source, h = new PointHistory(0.3));
      h.push(now, p);
    }
    return { tips, points, rays, pads, readings, touchTips, palms };
  }

  frame(time, frame) {
    const session = this.session;
    session.requestAnimationFrame((t, f) => this.frame(t, f));
    const app = this.app;
    const now = time / 1000;
    const { viewer, keyboard, panel, pitch } = this.step(now, frame);
    app.batches.marks.clear();
    this.drawMarks(app.batches.marks);
    app.buildFrame(now, pitch, { fake: !!app.simulatedRoom });
    const items = app.items(keyboard, panel || translation(0, -100, 0), app.simulatedRoom);
    const layer = session.renderState.baseLayer;
    const gl = app.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    app.renderer.begin([0, 0, 0, 0]);
    if (!viewer) return;
    for (const view of viewer.views) {
      const vp = layer.getViewport(view);
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      app.renderer.draw(view.projectionMatrix, view.transform.inverse.matrix, items);
    }
    this.frames = (this.frames || 0) + 1;
  }

  // One frame of input and state, without drawing: the sources, their presses, the restore, the
  // panel, the slide, the sticks and the calibration. Returns what the frame draws.
  step(now, frame) {
    const session = this.session;
    const app = this.app;
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(LONGEST_FRAME, now - this.lastTime));
    this.lastTime = now;
    this.now = now;
    const visible = session.visibilityState === undefined || session.visibilityState === 'visible';
    const viewer = frame.getViewerPose(this.space);
    const inputs = this.readInputs(frame, now);
    this.tips = inputs.tips;
    this.points = inputs.points;
    this.rays = inputs.rays;
    this.pads = inputs.pads;
    this.touchTips = inputs.touchTips;
    this.kind = inputKind(session.inputSources);
    const presses = visible ? this.presses.update(inputs.readings) : { started: [], ended: [], lost: [] };
    const slide = this.adjust && this.adjust.slide;
    if (slide && presses.lost.includes(slide.source)) this.cancelSlide();
    const drag = this.adjust && this.adjust.drag;
    if (drag && drag.grabs.some(g => presses.lost.includes(g.source))) this.cancelDrag();
    if (this.panelGrab && presses.lost.includes(this.panelGrab.source)) this.panelGrab = null;
    if (this.scrub && presses.lost.includes(this.scrub.source)) this.cancelScrub();
    for (const s of presses.ended) {
      if (this.panelGrab && this.panelGrab.source === s) this.panelGrab = null;
      if (this.scrub && this.scrub.source === s) this.scrubEnd(now);
      if (this.adjust && this.adjust.slide && this.adjust.slide.source === s) this.slideEnd(now);
      if (this.adjust && this.adjust.drag && this.adjust.drag.grabs.some(g => g.source === s)) this.dragEnd(s, now);
    }
    const head = viewer && viewer.transform.matrix;
    if (head) this.head = head;
    if (visible) this.readHere(inputs, now);

    if (this.restoring) {
      if (visible) this.restoring.waited += dt;
      const found = this.base(frame);
      if (found && head) {
        this.restoring = null;
        if (!this.plausible(found, head)) this.dropPlace();
      } else if (!found && this.restoring.waited > RESTORE_DEADLINE) {
        this.restoreFailed();
      }
    }
    if (this.checkPlace && head && !this.restoring && !this.flow) {
      const found = this.base(frame);
      if (found) {
        this.checkPlace = false;
        if (!this.plausible(found, head)) this.dropPlace();
      }
    }
    if (head && !this.panelPose) this.panelPose = panelInFront(head);
    if (head && this.hereWanted) this.here(head);

    // The keyboard stands on its base in every mode, a calibration's too: nothing carries it.
    const base = this.base(frame);
    if (base) this.lastBase = base;
    const before = base && this.cal ? keyboardMatrix(base, this.cal) : null;
    this.setKeyboard(base, before);

    // Entering with a saved keyboard: once it is found (and checked), the panel goes beside its
    // lowest C, off the waterfall and the sign, when that is within reach; else it stays in front.
    if (this.panelAuto && head && before && !this.flow && !this.restoring && !this.checkPlace) {
      this.panelAuto = false;
      const docked = multiply(before, panelInKeyboard(app.panelMode));
      if (length(sub([docked[12], docked[13], docked[14]], [head[12], head[13], head[14]])) <= PANEL_REACH) this.panelDocked = true;
    }
    if (this.panelGrab) {
      const p = this.points.get(this.panelGrab.source);
      if (p) {
        const at = add(this.panelGrab.start, sub(p, this.panelGrab.from));
        this.panelPose = head ? panelFacing(at, head) : this.panelPose;
      }
    }
    const panelAt = keyboard => (keyboard && this.panelDocked ? multiply(keyboard, panelInKeyboard(app.panelMode)) : this.panelPose);
    this.panelMatrix = panelAt(before);

    // Presses that began: the panel's bar, a panel button by ray, else (in «Підлаштувати») a
    // handle by tip or ray (trigger or grip), else the keyboard by ray (trigger), else
    // (calibrating) a controller's touch on the key, else (playing) the waterfall by tip or ray
    // (trigger): a scrub.
    const started = presses.started.filter(source => !this.panelGrabStart(source, now));
    const fired = this.handleInput(this.panelMatrix, started);
    this.aimNow = this.aimAt(this.panelMatrix);
    const pressed = started.filter(s => !s.hand && !fired.has(s) && this.pads.get(s));
    const taken = new Set();
    if (visible && this.adjust) for (const s of pressed) if (this.dragStart(s, now)) taken.add(s);
    // the trigger slides and touches
    const free = pressed.filter(s => !taken.has(s) && this.pads.get(s).trigger);
    if (visible && this.adjust) for (const s of free) if (this.slideStart(s, now)) break;
    if (visible) for (const s of free) if (this.scrubStart(s, now)) break;
    if (visible) {
      this.advanceScrub(now);
      this.advanceSlide(base, now);
      this.advanceDrag(base, now);
      this.nudgeBySticks(now, dt);
    }
    if (this.flow && visible) {
      const touches = [];
      for (const source of free) {
        const h = this.controllerTips.get(source);
        const point = h && h.before(now);
        if (point) touches.push({ point, pad: CONTROLLER_PAD });
      }
      const done = this.flow.feed(touches);
      if (done) {
        const solved = this.flow.solve();
        if (solved) {
          const record = calibrated(this.cal, solved, this.clock().toISOString());
          this.endCalibration();
          this.panelDocked = true; // beside the keys just touched: within reach, off the waterfall
          this.commit(frame, record);
        }
        app.changed();
      }
    }

    const after = this.base(frame); // a calibration may have saved a new place this frame
    if (after) this.lastBase = after;
    const keyboard = after && this.cal ? keyboardMatrix(after, this.cal) : null;
    this.setKeyboard(after, keyboard);
    const panel = panelAt(keyboard);
    this.panelMatrix = panel;
    this.draw = this.drawNow(keyboard);
    return { viewer, keyboard: this.keyboardModel, panel, pitch: this.pitchNow };
  }

  // The keyboard this frame: its rigid frame K, as drawn (stretched to its depth), its pitch, and
  // in «Підлаштувати» its handles.
  setKeyboard(base, K) {
    this.keyboardFrame = K;
    this.keyboardModel = K && drawnMatrix(K, depthOf(this.cal));
    this.pitchNow = this.cal ? effectivePitch(this.cal) : WHITE_PITCH;
    this.handles = this.adjust && K && base ? handlesOf(rectOf(base, this.cal)) : [];
  }

  // drawState() for this frame. A controller's ray shows on every page (brief §4.5), to where it
  // meets the panel or the keys in «Підлаштувати», else RAY_LENGTH long; a hand's pinch ray only
  // while it points at the panel.
  // In «Підлаштувати» the handles too ({id, point, segment, state: idle | hover | held}): a handle
  // under a free controller's ray or tip shows hovered, and the ray ends on it; a held one is
  // joined to its controller by its ray.
  drawNow(keyboard) {
    const rays = [];
    let hover = false;
    const drag = this.adjust && this.adjust.drag;
    const held = new Map(drag ? drag.grabs.map(g => [g.source, g.handle]) : []);
    const states = new Map(this.handles.map(h => [h.id, 'idle']));
    for (const id of held.values()) states.set(id, 'held');
    for (const [source, m] of this.rays) {
      const from = [m[12], m[13], m[14]], dir = [-m[8], -m[9], -m[10]];
      const panel = this.panelMatrix ? rayFace(this.panelMatrix, PANEL_WIDTH, panelHeight(this.app.panelMode), from, dir) : Infinity;
      if (source.hand) {
        if (panel < Infinity) rays.push({ from, to: add(from, scale(dir, panel / (length(dir) || 1))), hit: false });
        continue;
      }
      if (held.has(source)) {
        const h = this.handles.find(x => x.id === held.get(source));
        if (h) { rays.push({ from, to: h.point, hit: true }); continue; }
      }
      const handle = this.adjust && !held.has(source) && !(this.adjust.slide && this.adjust.slide.source === source) ? this.handleUnder(source) : null;
      if (handle) {
        if (states.get(handle.id) === 'idle') states.set(handle.id, 'hover');
        const point = handle.point || this.handles.find(x => x.id === handle.id).point;
        rays.push({ from, to: handle.by === 'ray' ? point : add(from, scale(dir, Math.min(panel, RAY_LENGTH) / (length(dir) || 1))), hit: handle.by === 'ray' });
        hover = true;
        continue;
      }
      // a ray on the waterfall ends there; the one holding it (a scrub) ends where it holds it,
      // with its dot, as far out as the hold counts (scrubHeight)
      if (this.scrub && this.scrub.source === source && this.scrub.by === 'ray' && this.keyboardFrame) {
        const at = rayWaterfall(this.keyboardFrame, this.pitchNow, depthOf(this.cal), from, dir, { bounded: false, reach: this.scrub.reach });
        if (at) { rays.push({ from, to: at.point, hit: true }); continue; }
      }
      const fall = !this.scrub || this.scrub.source !== source ? this.waterfallUnder(source) : null;
      if (fall && fall.by === 'ray') { rays.push({ from, to: fall.point, hit: false }); continue; }
      const hit = this.adjust && this.keyboardFrame ? rayKeyboard(this.keyboardFrame, this.pitchNow, from, dir, depthOf(this.cal)) : null;
      const on = !!hit && hit.distance <= panel;
      const reach = on ? hit.distance : Math.min(panel, RAY_LENGTH);
      rays.push({ from, to: add(from, scale(dir, reach / (length(dir) || 1))), hit: on });
      hover = hover || on;
    }
    const handles = this.handles.map(h => ({ ...h, state: states.get(h.id) }));
    return { rays, hover, grabbed: !!(this.adjust && (this.adjust.slide || this.adjust.drag)), target: this.flow ? this.flow.step : null, dim: !!(this.flow && keyboard),
      aim: this.aimNow || null, handles, eye: this.head ? [this.head[12], this.head[13], this.head[14]] : null };
  }

  // The panel's targets as drawn (App.panelButtons), else as the page lays them out now.
  targets() {
    const app = this.app;
    const page = pageLayout(app.panelMode, this.flow && this.flow.step);
    if (app.panelButtons && app.panelButtonsPage === page) return app.panelButtons;
    return app.panelState ? layout(page, app.panelState(this.now)) : page;
  }

  // What is aimed at on the panel this frame: the targets under a ray or a hovering fingertip, and
  // where each ray meets the panel's face (panel frame) -> {targets, cursors} or null.
  aimAt(panel) {
    if (!panel) return null;
    const targets = this.targets();
    const ids = new Set(), cursors = [];
    for (const [source, m] of this.rays) {
      if (this.panelGrab && this.panelGrab.source === source) continue;
      const p = rayPoint(panel, [m[12], m[13], m[14]], [-m[8], -m[9], -m[10]]);
      if (!p || Math.abs(p[0]) > PANEL_WIDTH / 2 || Math.abs(p[1]) > PANEL_HEIGHT / 2) continue;
      cursors.push(p);
      const id = buttonAt(targets, p[0], p[1]);
      if (id) ids.add(id);
    }
    for (const side of ['left', 'right']) if (this.pokes[side].hover) ids.add(this.pokes[side].hover);
    return ids.size || cursors.length ? { targets: [...ids], cursors } : null;
  }

  // The ways to bring the panel in front other than its button: B or Y, or (not in
  // «Підлаштувати») a thumbstick press, on a controller (the press that begins); both open palms
  // held up for PALMS_HOLD seconds (once per hold; Meta's own gesture is one palm towards the eyes
  // with a pinch).
  readHere(inputs, now) {
    const down = new Set();
    for (const [source, pad] of inputs.pads) {
      if (!(pad.menu || (pad.stickPress && !this.adjust))) continue;
      down.add(source);
      if (!this.hereDown.has(source)) this.hereWanted = true;
    }
    this.hereDown = down;
    const both = inputs.palms.has('left') && inputs.palms.has('right');
    if (!both) { this.palms = { since: null, fired: false }; return; }
    if (this.palms.since === null) this.palms.since = now;
    if (!this.palms.fired && now - this.palms.since >= PALMS_HOLD) {
      this.palms.fired = true;
      this.hereWanted = true;
    }
  }

  // Fingertip presses, and rays of the presses that began this frame, on the panel. The hand that
  // carries the panel presses nothing. Returns the sources whose ray pressed a button.
  handleInput(panel, started = []) {
    const app = this.app;
    const mode = this.targets();
    const fired = [];
    const byRay = new Set();
    const holding = new Set();
    if (this.panelGrab) holding.add(this.panelGrab.source.handedness);
    if (panel) {
      const inv = invertRigid(panel);
      for (const side of ['left', 'right']) {
        const h = holding.has(side) ? null : this.tips[side];
        const id = this.pokes[side].update(mode, h ? transformPoint(inv, h.tip) : null);
        if (id) fired.push(id);
      }
      for (const source of started) {
        const m = this.rays.get(source);
        const id = m && rayButton(mode, panel, [m[12], m[13], m[14]], [-m[8], -m[9], -m[10]]);
        if (id) { fired.push(id); byRay.add(source); }
      }
    }
    for (const id of fired) app.command(id);
    return byRay;
  }

  // Calibration: a ring at each controller tip, and a marker where the first touch was taken.
  drawMarks(b) {
    if (!this.flow) return;
    buildCalibrationMarks(b, { tips: [...(this.touchTips || new Map()).values()], holding: null, first: this.flow.holds.low || null });
  }
}

// Calibrating and «Підлаштувати» take the panel over the page that was open (the grid, a
// warm-up's card, …) and give it back when they end (App.pageAfterMode: as the session stands
// then); an app without pages goes back to playing.
function enterMode(app, mode) {
  if (app.panelMode !== 'adjust' && app.panelMode !== 'calibrate') app.panelReturn = app.panelMode;
  app.panelMode = mode;
}
function leaveMode(app) {
  app.panelMode = app.pageAfterMode ? app.pageAfterMode(app.panelReturn) : 'play';
  app.panelReturn = null;
}

// «Скасувати»'s copy of the record: the depth with it.
const cloneCal = cal => ({ ...cal, position: [...cal.position], nudge: { ...ZERO_NUDGE, ...cal.nudge } });
export { RELEASE_BACK };
