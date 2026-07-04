/* ============================================================
   input.js — unified keyboard + touch input
   Exposes a simple polled state:
     input.x (-1..1), input.up, input.down,
     input.jumpHeld, input.grabHeld
   Edge-triggered events use consume*(): jump, pause.
   ============================================================ */

class Input {
  constructor() {
    this.x = 0; this.up = false; this.down = false;
    this.jumpHeld = false; this.grabHeld = false;
    this._jumpPressed = false;
    this._pausePressed = false;

    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    // keyboard state
    this._keys = {};
    addEventListener('keydown', e => this._onKey(e, true));
    addEventListener('keyup',   e => this._onKey(e, false));

    // touch joystick state
    this._joyId = null;
    this._joyOrigin = { x: 0, y: 0 };
    this._joyVec = { x: 0, y: 0 };
    this._touchJump = false;
    this._touchGrab = false;
  }

  /* ---------------- keyboard ---------------- */
  _onKey(e, down) {
    const k = e.code;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(k)) e.preventDefault();
    this._keys[k] = down;

    if (down && !e.repeat) {
      if (k === 'Space' || k === 'KeyK') this._jumpPressed = true;
      if (k === 'KeyP' || k === 'Escape') this._pausePressed = true;
      if (k === 'KeyN') this._skipPressed = true;
      if (k === 'KeyE') this._endPressed = true;
    }
  }

  /* ---------------- touch controls ----------------
     Called once by UI after the DOM exists. */
  bindTouch(els) {
    const { joyZone, joyBase, joyKnob, btnJump, btnGrab } = els;

    const setKnob = (dx, dy) => {
      const max = 42;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, max);
      const nx = dx / len * cl, ny = dy / len * cl;
      joyKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
      this._joyVec.x = nx / max;
      this._joyVec.y = ny / max;
    };

    joyZone.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._joyId = t.identifier;
      const r = joyBase.getBoundingClientRect();
      this._joyOrigin.x = r.left + r.width / 2;
      this._joyOrigin.y = r.top + r.height / 2;
      setKnob(t.clientX - this._joyOrigin.x, t.clientY - this._joyOrigin.y);
    }, { passive: false });

    joyZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches)
        if (t.identifier === this._joyId)
          setKnob(t.clientX - this._joyOrigin.x, t.clientY - this._joyOrigin.y);
    }, { passive: false });

    const joyEnd = e => {
      for (const t of e.changedTouches)
        if (t.identifier === this._joyId) {
          this._joyId = null;
          this._joyVec.x = this._joyVec.y = 0;
          joyKnob.style.transform = 'translate(-50%,-50%)';
        }
    };
    joyZone.addEventListener('touchend', joyEnd);
    joyZone.addEventListener('touchcancel', joyEnd);

    const bind = (el, on, off) => {
      el.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener('touchend',   e => { e.preventDefault(); off(); });
      el.addEventListener('touchcancel', () => off());
    };
    bind(btnJump, () => { this._touchJump = true; this._jumpPressed = true; },
                  () => { this._touchJump = false; });
    bind(btnGrab, () => { this._touchGrab = true; }, () => { this._touchGrab = false; });
  }

  /* ---------------- polled state ---------------- */
  poll() {
    const k = this._keys;
    let x = 0;
    if (k['ArrowLeft'] || k['KeyA'])  x -= 1;
    if (k['ArrowRight'] || k['KeyD']) x += 1;
    x += clamp(this._joyVec.x * 1.4, -1, 1);
    this.x = clamp(x, -1, 1);

    this.up   = !!(k['ArrowUp'] || k['KeyW'])   || this._joyVec.y < -0.45;
    this.down = !!(k['ArrowDown'] || k['KeyS']) || this._joyVec.y > 0.45;
    this.jumpHeld = !!(k['Space'] || k['KeyK']) || this._touchJump;
    this.grabHeld = !!(k['ShiftLeft'] || k['ShiftRight'] || k['KeyJ']) || this._touchGrab;
  }

  consumeJump()  { const v = this._jumpPressed;  this._jumpPressed = false;  return v; }
  consumePause() { const v = this._pausePressed; this._pausePressed = false; return v; }
  consumeSkip()  { const v = this._skipPressed;  this._skipPressed = false;  return v; }
  consumeEnd()   { const v = this._endPressed;   this._endPressed = false;   return v; }
}
