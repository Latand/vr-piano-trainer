// The way back to vrplay's screens, and the mark that the trainer is what the headset shows: two
// requests to the trainer server on this PC (bridge.py, POST /quest/...), which hands them to
// vr-quest. The server serves them only with the page's own header.
export const WAITING = 'Повертаю до екранів…';
// What the page says where no PC stands behind it.
export const NO_PC = 'лише у версії на ПК';
// The words under the title of a copy without a PC (index.html #host-note).
export const HOST_NOTE = 'Онлайн-версія: лише пісні з набору. Свої пісні й «Назад до екранів» є у версії на ПК.';

// False in a copy of the page on a static host: piano/tools/export-static.mjs marks its
// index.html with <meta name="vrplay-host" content="static">, and no trainer server is behind it
// to take the page's requests. True everywhere else (bridge.py, the tests without a document).
export function hasPc(doc = globalThis.document) {
  return !(doc && typeof doc.querySelector === 'function' && doc.querySelector('meta[name="vrplay-host"][content="static"]'));
}

// -> {ok, message}; never throws. Without a PC (hasPc) nothing is sent.
export async function askPc(action, fetchImpl = globalThis.fetch, pc = hasPc()) {
  if (!pc) return { ok: false, message: NO_PC };
  let res;
  try {
    res = await fetchImpl(`quest/${action}`, { method: 'POST', headers: { 'X-Vrplay': '1' }, cache: 'no-store' });
  } catch {
    return { ok: false, message: 'сервер тренажера не відповідає' };
  }
  let reply = {};
  try { reply = await res.json(); } catch { /* not JSON: the status says enough */ }
  const message = reply && typeof reply.message === 'string' ? reply.message : '';
  if (res.ok && reply && reply.ok === true) return { ok: true, message };
  return { ok: false, message: message || `HTTP ${res.status}` };
}

// «Назад до екранів»: the PC opens WiVRn, then the page leaves AR. One request at a time; a
// press meanwhile does nothing. app: {message, detail, xr, changed()}. pc: false where no PC
// stands behind the page (hasPc): its «Екрани» are not drawn, and a press asks nothing.
export class BackToScreens {
  constructor(app, ask = askPc, pc = hasPc()) {
    this.app = app;
    this.ask = ask;
    this.busy = false;
    this.pc = pc;
  }

  // -> true when WiVRn was opened.
  async run() {
    const { app } = this;
    if (this.busy || !this.pc) return false;
    this.busy = true;
    app.message = WAITING;
    app.detail = '';
    app.changed();
    let reply;
    try {
      reply = await this.ask('screens');
    } finally {
      this.busy = false;
    }
    // A song chosen meanwhile says its own message; only ours is replaced.
    const ours = app.message === WAITING;
    if (!reply.ok) {
      // The panel's last line says why: in AR it is the only text there is.
      app.message = `Екрани: ${reply.message}`;
      app.changed();
      return false;
    }
    if (ours) app.message = '';
    // WiVRn in front may already have ended the session.
    const session = app.xr && app.xr.session;
    if (session) {
      try { await session.end(); } catch { /* ended meanwhile */ }
    }
    app.changed();
    return true;
  }
}
