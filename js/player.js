/* ============================================================
   player.js — the protagonist + shared character renderer
   Procedural vector characters (no sprite sheets needed):
   drawClimber() poses a small articulated figure per state,
   shared by the player and the NPC.
   ============================================================ */

/* ------------------------------------------------------------
   drawClimber(ctx, o)
   o = { x, y (feet center), facing (±1), state, t (anim time),
         hair: 'ponytail'|'short', accent, ring, scale }
   states: idle run jump fall climb hang land walk kneel victory sit
------------------------------------------------------------- */
function drawClimber(ctx, o) {
  const s = o.scale || 1;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(s * (o.facing || 1), s);

  const t = o.t || 0;
  let hipY = -20, shY = -36, headY = -45, lean = 0, bob = 0;
  // limb endpoints (relative to feet origin): [legA, legB, armA, armB]
  let legA = { kx: 3, ky: -10, fx: 5, fy: 0 };
  let legB = { kx: -3, ky: -10, fx: -5, fy: 0 };
  let armA = { ex: 8, ey: -28, hx: 10, hy: -20 };
  let armB = { ex: -8, ey: -28, hx: -10, hy: -20 };

  switch (o.state) {
    case 'idle': {
      bob = Math.sin(t * 2.2) * 1.2;
      armA = { ex: 7, ey: -28, hx: 8, hy: -19 };
      armB = { ex: -7, ey: -28, hx: -8, hy: -19 };
      break;
    }
    case 'walk':
    case 'run': {
      const f = o.state === 'run' ? 11 : 6.5;
      const sw = Math.sin(t * f), sw2 = Math.sin(t * f + Math.PI);
      lean = o.state === 'run' ? .18 : .08;
      bob = Math.abs(Math.cos(t * f)) * 2;
      legA = { kx: sw * 8 + 2, ky: -11, fx: sw * 14, fy: Math.max(0, -sw2 * 4) };
      legB = { kx: sw2 * 8 + 2, ky: -11, fx: sw2 * 14, fy: Math.max(0, -sw * 4) };
      armA = { ex: sw2 * 8, ey: -27, hx: sw2 * 13, hy: -21 };
      armB = { ex: sw * 8, ey: -27, hx: sw * 13, hy: -21 };
      break;
    }
    case 'jump': {
      lean = .1;
      legA = { kx: 6, ky: -14, fx: 4, fy: -6 };
      legB = { kx: -2, ky: -8, fx: -6, fy: -2 };
      armA = { ex: 9, ey: -40, hx: 13, hy: -48 };
      armB = { ex: -8, ey: -30, hx: -12, hy: -36 };
      break;
    }
    case 'fall': {
      const fl = Math.sin(t * 14) * 4;
      legA = { kx: 6, ky: -12, fx: 9 + fl * .3, fy: -4 };
      legB = { kx: -6, ky: -12, fx: -9, fy: -3 };
      armA = { ex: 10, ey: -42, hx: 15 + fl, hy: -47 };
      armB = { ex: -10, ey: -42, hx: -15 - fl, hy: -47 };
      break;
    }
    case 'climb': {
      // reach-over-reach up a rail on the facing side
      const ph = Math.sin(t * 7);
      lean = .1;
      armA = { ex: 9, ey: -44, hx: 12, hy: ph > 0 ? -56 : -40 };
      armB = { ex: 8, ey: -36, hx: 12, hy: ph > 0 ? -30 : -50 };
      legA = { kx: 6, ky: -12, fx: 9, fy: ph > 0 ? -6 : -1 };
      legB = { kx: 4, ky: -9, fx: 8, fy: ph > 0 ? -1 : -7 };
      break;
    }
    case 'hang': {
      const sway = Math.sin(t * 2.4) * 2;
      armA = { ex: 8, ey: -46, hx: 11, hy: -56 };
      armB = { ex: 5, ey: -45, hx: 9, hy: -55 };
      legA = { kx: 3 + sway * .4, ky: -9, fx: 2 + sway, fy: 0 };
      legB = { kx: -2 + sway * .4, ky: -9, fx: -3 + sway, fy: 0 };
      break;
    }
    case 'land': {
      hipY = -14; shY = -28; headY = -37;
      legA = { kx: 8, ky: -8, fx: 10, fy: 0 };
      legB = { kx: -8, ky: -8, fx: -10, fy: 0 };
      armA = { ex: 10, ey: -22, hx: 14, hy: -14 };
      armB = { ex: -10, ey: -22, hx: -14, hy: -14 };
      break;
    }
    case 'kneel': {
      hipY = -12; shY = -30; headY = -39; lean = .12;
      legA = { kx: 10, ky: -12, fx: 12, fy: 0 };        // front foot planted
      legB = { kx: -4, ky: -6, fx: -12, fy: 0 };        // back knee down
      armA = { ex: 14, ey: -26, hx: 22, hy: -28 };      // ring hand forward
      armB = { ex: -6, ey: -24, hx: -6, hy: -14 };
      break;
    }
    case 'victory': {
      const hop = Math.abs(Math.sin(t * 6)) * 6;
      bob = -hop;
      armA = { ex: 10, ey: -44, hx: 14, hy: -54 };
      armB = { ex: -10, ey: -44, hx: -14, hy: -54 };
      legA = { kx: 4, ky: -11, fx: 6, fy: -hop * .4 };
      legB = { kx: -4, ky: -11, fx: -6, fy: -hop * .4 };
      break;
    }
    case 'sit': {
      hipY = -8; shY = -24; headY = -33; lean = -.06;
      legA = { kx: 10, ky: -6, fx: 16, fy: 0 };
      legB = { kx: 8, ky: -5, fx: 14, fy: -1 };
      armA = { ex: 8, ey: -16, hx: 12, hy: -8 };
      armB = { ex: -6, ey: -16, hx: -8, hy: -8 };
      break;
    }
  }

  ctx.translate(0, bob);
  ctx.rotate(lean);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const BLACK = '#16181f';

  // subtle drop shadow
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(0, 1 - bob, 12, 3, 0, 0, Math.PI * 2); ctx.fill();

  const limb = (x1, y1, x2, y2, x3, y3, w) => {
    ctx.strokeStyle = BLACK; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x2, y2, x3, y3); ctx.stroke();
  };

  // legs
  limb(0, hipY, legA.kx, legA.ky, legA.fx, legA.fy, 5);
  limb(0, hipY, legB.kx, legB.ky, legB.fx, legB.fy, 5);
  // shoes (accent)
  ctx.fillStyle = o.accent;
  ctx.fillRect(legA.fx - 3, legA.fy - 2, 7, 3);
  ctx.fillRect(legB.fx - 4, legB.fy - 2, 7, 3);

  // torso
  ctx.strokeStyle = BLACK; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(0, shY); ctx.stroke();
  // accent chest stripe
  ctx.strokeStyle = o.accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-1, shY + 3); ctx.lineTo(1, hipY - 3); ctx.stroke();

  // arms
  limb(0, shY, armA.ex, armA.ey, armA.hx, armA.hy, 4.5);
  limb(0, shY, armB.ex, armB.ey, armB.hx, armB.hy, 4.5);

  // engagement ring in the forward hand
  if (o.ring) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(armA.hx + 2, armA.hy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(armA.hx + 2, armA.hy - 5, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  // head
  ctx.fillStyle = BLACK;
  ctx.beginPath(); ctx.arc(1, headY, 6.5, 0, Math.PI * 2); ctx.fill();
  // face hint
  ctx.fillStyle = '#e8c9a8';
  ctx.beginPath(); ctx.arc(3.4, headY + .5, 3.4, -1.1, 1.1); ctx.fill();

  // hair
  if (o.hair === 'ponytail') {
    const wag = Math.sin(t * 6) * 2 + (o.state === 'fall' ? -4 : 0);
    ctx.strokeStyle = BLACK; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-4, headY - 3);
    ctx.quadraticCurveTo(-12, headY + 2 + wag, -13, headY + 12 + wag);
    ctx.stroke();
  } else {
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.arc(0, headY - 3, 6, Math.PI, 0); ctx.fill();
  }

  ctx.restore();
}

/* ============================================================
   Player — state machine + platforming physics
   ============================================================ */
class Player {
  constructor(x, y) {
    this.w = 22; this.h = 46;
    this.x = x - this.w / 2; this.y = y - this.h;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.state = 'idle';
    this.animT = 0;
    this.stamina = CFG.STAMINA_MAX;
    this.stunT = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.landT = 0;
    this.controlled = true;      // false during cinematics
    this.cineTargetX = null;     // auto-walk target for cinematics
    this.onGround = false;
    this.ground = null;
    this.wallDir = 0; this.wallRef = null;
    this.climbing = false;
  }

  stunned() { return this.stunT > 0; }

  /** Knockback + brief stun from a hazard. */
  hit(kx, ky, stun, game) {
    if (this.stunT > 0 || !this.controlled) return;
    this.vx = kx; this.vy = ky;
    this.stunT = stun;
    this.climbing = false;
    game.audio.sfx('hit');
    game.particles.hitBurst(this.x + this.w / 2, this.y + this.h / 2);
  }

  centerX() { return this.x + this.w / 2; }

  update(dt, input, world, game) {
    this.animT += dt;
    this.stunT = Math.max(0, this.stunT - dt);
    this.landT = Math.max(0, this.landT - dt);

    /* ---------- cinematic auto-walk ---------- */
    if (!this.controlled) {
      if (this.cineTargetX !== null) {
        const dx = this.cineTargetX - this.centerX();
        if (Math.abs(dx) > 6) {
          this.vx = Math.sign(dx) * 130;
          this.facing = Math.sign(dx);
          this.state = 'walk';
        } else { this.vx = 0; this.cineTargetX = null; if (this.state === 'walk') this.state = 'idle'; }
      } else this.vx = 0;
      this.vy += CFG.GRAVITY * dt;
      moveAndCollide(this, dt, world);
      return;
    }

    const wasGround = this.onGround;
    const fallSpeed = this.vy;

    /* ---------- timers ---------- */
    if (this.onGround) this.coyote = CFG.COYOTE;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (input.consumeJump()) this.jumpBuf = CFG.JUMP_BUFFER;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    const stunned = this.stunT > 0;

    /* ---------- climbing on rails ---------- */
    if (this.climbing) {
      const w = this.wallRef;
      const lostGrip = !w || !input.grabHeld || this.stamina <= 0 || stunned;
      if (lostGrip) {
        this.climbing = false;
      } else {
        // stick to rail side
        this.x = this.wallDir > 0 ? w.x - this.w : w.x + w.w;
        this.facing = this.wallDir;
        this.vx = 0;
        if (input.up)       { this.vy = -CFG.CLIMB_SPEED; this.stamina -= CFG.DRAIN_CLIMB * dt; }
        else if (input.down){ this.vy = CFG.CLIMB_SPEED * 1.3; this.stamina -= CFG.DRAIN_HANG * dt; }
        else                { this.vy = 0; this.stamina -= CFG.DRAIN_HANG * dt; }
        // climb ticks
        if (input.up && ((this.animT * 5) | 0) !== (((this.animT - dt) * 5) | 0))
          game.audio.sfx('climb');
        // auto-mantle over the top of a rail
        if (this.y + this.h < w.y + 6 && input.up) this.vy = -CFG.JUMP_VEL * .55;
        // wall jump
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0;
          this.climbing = false;
          this.vx = -this.wallDir * CFG.WALL_JUMP_VX + input.x * 60;
          this.vy = -CFG.WALL_JUMP_VY;
          this.facing = -this.wallDir;
          game.audio.sfx('jump');
          game.particles.dust(this.x + this.w / 2, this.y + this.h / 2, 5);
        }
        this.state = (input.up || input.down) ? 'climb' : 'hang';
        moveAndCollide(this, dt, world);
        if (this.onGround) this.climbing = false;
        this.stamina = clamp(this.stamina, 0, CFG.STAMINA_MAX);
        return;
      }
    }

    /* ---------- normal movement ---------- */
    const steer = stunned ? 0 : input.x;
    const control = this.onGround ? 1 : CFG.AIR_CONTROL;
    const target = steer * CFG.MOVE_SPEED;
    this.vx = lerp(this.vx, target, clamp(CFG.ACCEL * control * dt / CFG.MOVE_SPEED, 0, 1));
    if (steer !== 0) this.facing = Math.sign(steer);

    // wind pushes airborne bodies (and slightly on the ground)
    this.vx += game.obstacles.windForce * (this.onGround ? .25 : 1) * dt;

    this.vy += CFG.GRAVITY * dt;

    // pressed into a rail while falling → wall slide
    const pressingWall = this.wallDir !== 0 &&
      (Math.sign(input.x) === this.wallDir || input.grabHeld);
    if (!this.onGround && pressingWall && this.vy > CFG.WALL_SLIDE)
      this.vy = CFG.WALL_SLIDE;

    // start climbing: touching a rail + holding grab
    if (this.wallDir !== 0 && input.grabHeld && !stunned && this.stamina > 4 && !this.onGround) {
      this.climbing = true;
      game.audio.sfx('grab');
    }

    // jump (with coyote + buffer)
    if (this.jumpBuf > 0 && this.coyote > 0 && !stunned) {
      this.jumpBuf = 0; this.coyote = 0;
      this.vy = -CFG.JUMP_VEL;
      game.audio.sfx('jump');
      game.particles.dust(this.x + this.w / 2, this.y + this.h, 6);
    }

    moveAndCollide(this, dt, world);

    // ride moving gondolas
    if (this.ground && this.ground.dx) this.x += this.ground.dx;

    /* ---------- landing ---------- */
    if (!wasGround && this.onGround) {
      game.audio.sfx('land');
      game.particles.dust(this.x + this.w / 2, this.y + this.h, fallSpeed > 800 ? 12 : 6);
      this.landT = .16;
      if (fallSpeed > 1100) { this.stunT = .25; game.addShake(6); }
    }

    /* ---------- stamina ---------- */
    if (this.onGround) this.stamina += CFG.REGEN * dt;
    this.stamina = clamp(this.stamina, 0, CFG.STAMINA_MAX);

    /* ---------- animation state ---------- */
    if (this.onGround) {
      if (this.landT > 0) this.state = 'land';
      else if (Math.abs(this.vx) > 30) this.state = 'run';
      else this.state = 'idle';
    } else {
      if (pressingWall && this.vy > 0) this.state = 'hang';
      else this.state = this.vy < 0 ? 'jump' : 'fall';
    }

    // run dust
    if (this.state === 'run' && Math.random() < dt * 8)
      game.particles.dust(this.x + this.w / 2 - this.facing * 8, this.y + this.h, 1);
  }

  draw(ctx) {
    drawClimber(ctx, {
      x: this.x + this.w / 2, y: this.y + this.h,
      facing: this.facing, state: this.state, t: this.animT,
      hair: 'ponytail', accent: '#ff4d8d',
    });
    // stun stars
    if (this.stunT > 0) {
      ctx.fillStyle = 'rgba(255,209,102,.9)';
      for (let i = 0; i < 3; i++) {
        const a = this.animT * 6 + i * 2.1;
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2 + Math.cos(a) * 14,
                this.y - 8 + Math.sin(a) * 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
