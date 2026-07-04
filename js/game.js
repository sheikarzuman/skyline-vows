/* ============================================================
   game.js — core loop, camera, states, ending cinematic
   States: menu → playing ⇄ paused → cinematic → ended
   ============================================================ */

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.input = new Input();
    this.audio = new AudioMan();
    this.ui = new UI(this);

    this.state = 'menu';
    this.time = 0;
    this.cam = { x: 500, y: 0 };
    this.shake = 0;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.letterbox = 0;
    this.view = { x0: 0, y0: 0, x1: 0, y1: 0 };

    this._resize();
    addEventListener('resize', () => this._resize());

    this._last = performance.now();
    requestAnimationFrame(t => this._frame(t));
  }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    this.dpr = dpr;
    this.cw = innerWidth;
    this.ch = innerHeight;
  }

  /* ================= session setup ================= */
  start(atStage = 0) {
    const seed = (Math.random() * 1e9) | 0;
    this.world = generateWorld(seed);
    this.bg = new Background(this.world, seed);
    this.obstacles = new Obstacles(this.world);
    this.particles = new Particles();
    this.player = new Player(this.world.startX, this.world.startY);
    this.npc = new NPC(this.world);

    this.time = 0;
    this.stageIdx = 0;
    this.playerRouteIdx = 0;
    this.checkpointIdx = 0;
    this.progress = 0;
    this.heightM = 0;
    this.cam.x = 500;
    this.cam.y = this.world.startY - 160;
    this.zoom = this.zoomTarget = 1;
    this.letterbox = 0;
    this.cine = null;
    this._fireworkT = 0;

    this.state = 'playing';
    this.ui.show(null);
    this.ui.dialogue(null);
    this.audio.unlock();
    this.audio.music(true);
    if (atStage > 0) this.skipToStage(atStage);
    else this.ui.banner('STAGE 1 — LOWER FLOORS', STAGES[0].neon);
  }

  /**
   * Teleport to the checkpoint that opens stage s (0-based).
   * checkpoints[i] is the start of stage i+1; index 0 is the street.
   */
  skipToStage(s) {
    const cps = this.world.checkpoints;
    s = clamp(s, 0, Math.min(STAGES.length - 1, cps.length - 2));
    const cp = cps[s];
    this.checkpointIdx = s;
    this.player.x = cp.x - this.player.w / 2;
    this.player.y = cp.y - this.player.h;
    this.player.vx = this.player.vy = 0;
    this.player.climbing = false;
    this.player.stunT = 0;
    this.player.stamina = CFG.STAMINA_MAX;
    this.heightM = Math.max(0, (this.world.startY - cp.y) / CFG.PX_PER_M);
    this.progress = clamp(this.heightM / TOTAL_M, 0, 1);
    // sync route pointer + bring the partner along
    this.playerRouteIdx = NPC.playerRouteIndex(this.world.route, this.player, 0);
    this.npc.idx = this.playerRouteIdx;
    this.npc.x = cp.x + 44;
    this.npc.y = cp.y;
    this.npc.jump = null;
    this.cam.x = cp.x;
    this.cam.y = cp.y - 160;
    this.audio.sfx('checkpoint');
    this.particles.spark(cp.x, cp.y - 20, 12, 'rgba(53,224,161,');
    // stage banner fires via the stage-change check on the next update
  }

  /**
   * Jump straight to the rooftop. Works from the menu (starts a
   * fresh climb first) or mid-climb. The player drops onto the
   * roof slab, which triggers the proposal cinematic naturally.
   */
  skipToEnding() {
    if (!this.world || this.state === 'menu' || this.state === 'ended' ||
        this.state === 'cinematic') this.start();
    if (this.state === 'paused') this.resume();
    const cx = (this.world.towerL + this.world.towerR) / 2;
    this.player.x = cx - 120 - this.player.w / 2;
    this.player.y = this.world.rooftopY - this.player.h - 8;   // small drop → lands → cinematic
    this.player.vx = this.player.vy = 0;
    this.player.climbing = false;
    this.player.stunT = 0;
    this.checkpointIdx = this.world.checkpoints.length - 1;
    this.heightM = TOTAL_M;
    this.progress = 1;
    this.playerRouteIdx = this.world.route.length - 1;
    this.npc.x = cx + 140;
    this.npc.y = this.world.rooftopY;
    this.npc.idx = this.world.route.length - 1;
    this.npc.jump = null;
    this.cam.x = cx;
    this.cam.y = this.world.rooftopY - 120;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.show(null);
  }
  quitToMenu() {
    this.state = 'menu';
    this.audio.music(false);
    this.ui.show('menu');
    this.ui.dialogue(null);
  }

  addShake(amount) { this.shake = Math.min(14, this.shake + amount); }

  /* ================= main loop ================= */
  _frame(now) {
    const dt = Math.min((now - this._last) / 1000, 1 / 30);
    this._last = now;
    this._update(dt);
    this._render();
    requestAnimationFrame(t => this._frame(t));
  }

  _computeView() {
    const s = this.scale();
    this.view.x0 = this.cam.x - this.cw / 2 / s;
    this.view.x1 = this.cam.x + this.cw / 2 / s;
    this.view.y0 = this.cam.y - this.ch / 2 / s;
    this.view.y1 = this.cam.y + this.ch / 2 / s;
  }

  scale() { return Math.max(this.cw / 1250, this.ch / 850) * this.zoom; }

  /* ================= update ================= */
  _update(dt) {
    this.input.poll();

    if (this.input.consumePause()) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    if (this.state === 'playing') this._updatePlaying(dt);
    else if (this.state === 'cinematic') this._updateCinematic(dt);

    // ambient systems keep breathing in every visible state
    if (this.state !== 'menu' && this.bg) {
      const windNorm = this.obstacles ? clamp(Math.abs(this.obstacles.windForce) / 400, 0, 1) : 0;
      this.bg.update(dt, windNorm);
      this.particles.update(dt);
      this.audio.setWind(clamp(STAGES[this.stageIdx].wind + windNorm * .5, 0, 1));
    }

    // camera smoothing + shake decay
    if (this.player) {
      const k = 1 - Math.exp(-5 * dt);
      let ty, tx;
      if (this.state === 'cinematic' || this.state === 'ended') {
        tx = (this.world.towerL + this.world.towerR) / 2;
        ty = this.world.rooftopY - 90;
        this.zoomTarget = 1.25;
      } else {
        tx = lerp(500, this.player.centerX(), .35);
        ty = this.player.y - 110;
      }
      this.cam.x = lerp(this.cam.x, tx, k);
      this.cam.y = lerp(this.cam.y, ty, k);
      this.zoom = lerp(this.zoom, this.zoomTarget, k);
      this.cam.y = clamp(this.cam.y, this.world.rooftopY - 260, this.world.startY - 100);
    }
    this.shake = Math.max(0, this.shake - 30 * dt);

    // letterbox bars ease toward their target
    const lbTarget = (this.state === 'cinematic' || this.state === 'ended') ? 1 : 0;
    this.letterbox = lerp(this.letterbox, lbTarget, 1 - Math.exp(-4 * dt));
  }

  _updatePlaying(dt) {
    this.time += dt;
    this._computeView();

    // N: skip to the next stage checkpoint (handy shortcut / cheat)
    if (this.input.consumeSkip())
      this.skipToStage(Math.min(this.checkpointIdx + 1, STAGES.length - 1));

    // E: skip straight to the rooftop ending
    if (this.input.consumeEnd()) { this.skipToEnding(); return; }

    this.player.update(dt, this.input, this.world, this);
    this.playerRouteIdx = NPC.playerRouteIndex(this.world.route, this.player, this.playerRouteIdx);
    this.npc.update(dt, this);
    this.obstacles.update(dt, this);

    /* height / progress */
    this.heightM = Math.max(this.heightM,
      (this.world.startY - (this.player.y + this.player.h)) / CFG.PX_PER_M);
    this.progress = clamp(this.heightM / TOTAL_M, 0, 1);

    /* stage transitions */
    const si = stageIndexAt(
      (this.world.startY - (this.player.y + this.player.h)) / CFG.PX_PER_M);
    if (si !== this.stageIdx) {
      this.stageIdx = si;
      this.ui.banner(`STAGE ${si + 1} — ${STAGES[si].name}`, STAGES[si].neon);
      this.audio.sfx('checkpoint');
    }

    /* checkpoints */
    const cps = this.world.checkpoints;
    if (this.checkpointIdx < cps.length - 1 &&
        this.player.onGround &&
        this.player.y + this.player.h <= cps[this.checkpointIdx + 1].y + 6) {
      this.checkpointIdx++;
      this.audio.sfx('checkpoint');
      this.particles.spark(this.player.centerX(), this.player.y, 10, 'rgba(53,224,161,');
    }

    /* fell too far below the checkpoint → respawn */
    const cp = cps[this.checkpointIdx];
    if (this.player.y - cp.y > 950) {
      this.ui.fadeFlash(() => {
        this.player.x = cp.x - this.player.w / 2;
        this.player.y = cp.y - this.player.h;
        this.player.vx = this.player.vy = 0;
        this.player.stunT = 0;
        this.player.climbing = false;
        this.player.stamina = CFG.STAMINA_MAX * .8;
        this.cam.y = cp.y - 160;
      });
    }

    /* HUD */
    this.ui.updateHUD(this.heightM, this.player.stamina, this.progress, this.time);

    /* rooftop reached → cinematic */
    if (this.player.onGround && this.player.ground && this.player.ground.rooftop)
      this._startCinematic();
  }

  /* ================= ending cinematic ================= */
  _startCinematic() {
    this.state = 'cinematic';
    this.cine = { t: 0, mode: 'intro', shown: {} };
    this.ui.els.hud.classList.add('hidden');
    this.ui.els.touch.classList.add('hidden');
    const cx = (this.world.towerL + this.world.towerR) / 2;

    this.player.controlled = false;
    this.player.cineTargetX = cx - 34;

    // partner joins on the roof
    this.npc.idx = this.world.route.length - 1;
    this.npc.y = this.world.rooftopY;
    this.npc.x = clamp(this.npc.x, this.world.towerL + 60, this.world.towerR - 60);
    this.npc.pose = 'walk';
    this.npc.cineTargetX = cx + 34;
    this.npc.bubble = null;

    this.audio.music(false);
  }

  _updateCinematic(dt) {
    const c = this.cine;
    c.t += dt;
    this._computeView();

    this.player.update(dt, this.input, this.world, this);
    this.npc.update(dt, this);

    const once = (key, fn) => { if (!c.shown[key]) { c.shown[key] = true; fn(); } };

    if (c.mode === 'intro') {
      if (c.t > 2.0) once('kneel', () => {
        this.npc.pose = 'kneel';
        this.npc.facing = -1;
        this.player.facing = 1;
        this.audio.sfx('propose');
      });
      if (this.npc.pose === 'kneel' && Math.random() < dt * 6)
        this.particles.ringSparkle(this.npc.x + 22, this.npc.y - 28);
      if (c.t > 3.2) once('dlg', () =>
        this.ui.dialogue('He kneels, holding something small and bright…'));
      if (c.t > 4.6) once('choice', () => {
        this.ui.dialogue(null);
        this.ui.show('choice');
      });
    }

    else if (c.mode === 'accept') {
      // fireworks + hearts + victory dancing
      this.player.state = 'victory';
      this.npc.pose = 'victory';
      this._fireworkT -= dt;
      if (this._fireworkT <= 0) {
        this._fireworkT = .38;
        this.particles.firework(
          this.world.towerL + Math.random() * (this.world.towerR - this.world.towerL),
          this.world.rooftopY - 140 - Math.random() * 260);
        this.audio.sfx('firework');
      }
      if (Math.random() < dt * 6)
        this.particles.heart((this.player.centerX() + this.npc.x) / 2, this.world.rooftopY - 60);
      if (c.t > 1.2) once('dlg', () => this.ui.dialogue('<b>“YES!”</b>'));
      if (c.t > 3.4) once('dlg2', () => this.ui.dialogue(null));
      if (c.t > 6.5) once('credits', () => { this.state = 'ended'; this.ui.show('credits'); });
    }

    else if (c.mode === 'reject') {
      if (c.t > .1) once('dlg', () =>
        this.ui.dialogue('“Hmm. Ask me again after we take the <i>stairs</i> down.”'));
      if (c.t > 1.6) once('walk', () => {
        // she strides off dramatically, wind machine at full power
        this.player.cineTargetX = this.world.towerL + 40;
        this.audio.sfx('whoosh');
        this.audio.sfx('sad');
      });
      if (c.t > 1.6 && Math.random() < dt * 14)
        this.particles.streak(this.view.x1, this.world.rooftopY - 40 - Math.random() * 120, -1, 1);
      if (c.t > 3.0) once('sit', () => {
        this.ui.dialogue(null);
        this.npc.pose = 'sit';          // he plops down, processing
        this.npc.facing = -1;
      });
      if (c.t > 5.8) once('funny', () => { this.state = 'ended'; this.ui.show('funny'); });
    }
  }

  _hideAllChrome() {
    this.ui.show(null);
    this.ui.els.hud.classList.add('hidden');
    this.ui.els.touch.classList.add('hidden');
  }

  acceptProposal() {
    this._hideAllChrome();
    this.cine = { t: 0, mode: 'accept', shown: {} };
    this.audio.music(true, true);
  }

  rejectProposal() {
    this._hideAllChrome();
    this.cine = { t: 0, mode: 'reject', shown: {} };
  }

  /* ================= render ================= */
  _render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.state === 'menu' || !this.world) {
      // simple animated night sky behind the menu
      ctx.fillStyle = '#0a0d18';
      ctx.fillRect(0, 0, this.cw, this.ch);
      return;
    }

    const s = this.scale();
    this._computeView();

    /* screen-space background */
    this.bg.drawSky(ctx, this.cam, this.cw, this.ch, this.progress);
    this.bg.drawFar(ctx, this.cam, this.cw, this.ch);

    /* world-space pass */
    const shx = (Math.random() - .5) * this.shake;
    const shy = (Math.random() - .5) * this.shake;
    ctx.save();
    ctx.translate(this.cw / 2 + shx, this.ch / 2 + shy);
    ctx.scale(s, s);
    ctx.translate(-this.cam.x, -this.cam.y);

    this.bg.drawTower(ctx, this.view, this);
    this.obstacles.draw(ctx, this);
    this.npc.draw(ctx);
    this.player.draw(ctx);
    this.particles.draw(ctx, this.view);

    /* pigeon lands on him in the reject ending */
    if (this.cine && this.cine.mode === 'reject' && this.cine.t > 4.2) {
      const px = this.npc.x + 2, py = this.npc.y - 40;
      ctx.fillStyle = '#9aa0b5';
      ctx.beginPath(); ctx.ellipse(px, py, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 6, py - 3, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(px + 9, py - 3); ctx.lineTo(px + 13, py - 2); ctx.lineTo(px + 9, py - 1);
      ctx.fill();
    }

    ctx.restore();

    /* weather + vignette overlays (screen space) */
    const windNorm = clamp(this.obstacles.windForce / 400, -1, 1);
    this.bg.drawWeather(ctx, this.cam, this.cw, this.ch, windNorm);

    const vg = ctx.createRadialGradient(
      this.cw / 2, this.ch / 2, this.ch * .4,
      this.cw / 2, this.ch / 2, this.ch * .85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.cw, this.ch);

    /* cinematic letterbox */
    if (this.letterbox > 0.01) {
      const barH = this.ch * .11 * this.letterbox;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.cw, barH);
      ctx.fillRect(0, this.ch - barH, this.cw, barH);
    }
  }
}
