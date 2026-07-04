/* ============================================================
   npc.js — the climbing partner (AI)
   The NPC follows the generated route (one node per ledge),
   moving with eased walks and parabolic jump arcs instead of
   full physics — robust, cheap, and reads naturally.
   Behavior: keeps a small lead, waits when the player falls
   behind, flinches at nearby hazards, chats occasionally.
   ============================================================ */

class NPC {
  constructor(world) {
    this.world = world;
    this.route = world.route;
    this.idx = 0;                       // current route node
    this.x = world.startX + 60;
    this.y = world.startY;
    this.facing = -1;
    this.state = 'idle';                // idle walk jump wait dodge + cinematic poses
    this.animT = 0;
    this.pose = null;                   // cinematic override: kneel/victory/sit/walk
    this.cineTargetX = null;

    this.jump = null;                   // active jump arc
    this.lead = 1;                      // how many nodes ahead he likes to be
    this.leadT = 0;
    this.dodgeT = 0;
    this.bubble = null;                 // {text, t}
    this.chatT = 8;
    this.waitLine = 0;
  }

  say(text, dur = 2.6) { this.bubble = { text, t: dur }; }

  /** Route index closest below/at the player (called with cached value). */
  static playerRouteIndex(route, player, cached) {
    let i = cached;
    while (i < route.length - 1 && route[i + 1].y >= player.y - 8) i++;
    while (i > 0 && route[i].y < player.y - 8) i--;
    return i;
  }

  update(dt, game) {
    this.animT += dt;
    if (this.bubble && (this.bubble.t -= dt) <= 0) this.bubble = null;

    /* ---------- cinematic override ---------- */
    if (this.pose) {
      if (this.pose === 'walk' && this.cineTargetX !== null) {
        const dx = this.cineTargetX - this.x;
        if (Math.abs(dx) > 6) {
          this.x += Math.sign(dx) * 120 * dt;
          this.facing = Math.sign(dx);
          this.state = 'walk';
        } else { this.cineTargetX = null; this.pose = 'idle'; this.state = 'idle'; }
      } else {
        this.state = this.pose;
      }
      return;
    }

    const player = game.player;
    const pIdx = game.playerRouteIdx;

    /* ---------- hazard flinch ---------- */
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.state = 'land';              // crouch pose
      return;
    }
    if (this.state !== 'jump' && game.obstacles.nearestThreat(this.x, this.y - 20, 70)) {
      this.dodgeT = .55;
      if (Math.random() < .5) this.say('Watch out!', 1.4);
      return;
    }

    /* ---------- decide target node ---------- */
    this.leadT -= dt;
    if (this.leadT <= 0) { this.leadT = 4 + Math.random() * 5; this.lead = (Math.random() * 3) | 0; }

    const ahead = this.idx - pIdx;
    if (ahead > 3) {
      // Too far ahead: wait, look back, tease.
      this.state = 'wait';
      this.facing = player.centerX() > this.x ? 1 : -1;
      this.chatT -= dt;
      if (this.chatT <= 0) {
        this.chatT = 5 + Math.random() * 4;
        const lines = ['Come on, slowpoke!', 'The view is great up here!', 'Take your time!', 'You got this!'];
        this.say(lines[this.waitLine++ % lines.length]);
      }
      return;
    }

    /* ---------- jump arc in progress ---------- */
    if (this.jump) {
      const j = this.jump;
      j.t += dt;
      const k = clamp(j.t / j.dur, 0, 1);
      this.x = lerp(j.x0, j.x1, k);
      // parabola: peak 40px above the higher endpoint
      const peak = Math.min(j.y0, j.y1) - 44;
      const a = k < .5
        ? lerp(j.y0, peak, k * 2)
        : lerp(peak, j.y1, (k - .5) * 2);
      this.y = a;
      this.state = k < .5 ? 'jump' : 'fall';
      this.facing = Math.sign(j.x1 - j.x0) || this.facing;
      if (k >= 1) {
        this.jump = null;
        this.idx = j.toIdx;
        this.state = 'idle';
        game.particles.dust(this.x, this.y, 3);
      }
      return;
    }

    /* ---------- walk toward next node & hop ---------- */
    const targetIdx = Math.min(pIdx + this.lead, this.route.length - 1);
    if (this.idx < targetIdx) {
      const next = this.route[this.idx + 1];
      const cur = this.route[this.idx];
      // walk to a take-off point near our current node first
      const takeoffX = cur.x + Math.sign(next.x - cur.x) * 26;
      if (Math.abs(this.x - takeoffX) > 10 && Math.abs(this.y - cur.y) < 6) {
        this.x += Math.sign(takeoffX - this.x) * 170 * dt;
        this.facing = Math.sign(takeoffX - this.x) || this.facing;
        this.state = 'run';
      } else {
        const d = dist(this.x, this.y, next.x, next.y);
        this.jump = {
          x0: this.x, y0: this.y, x1: next.x, y1: next.y,
          t: 0, dur: clamp(d / 330, .4, .9), toIdx: this.idx + 1,
        };
      }
    } else {
      // idle near the node, small shuffle toward its center
      const cur = this.route[this.idx];
      if (Math.abs(this.x - cur.x) > 30) {
        this.x += Math.sign(cur.x - this.x) * 120 * dt;
        this.state = 'walk';
        this.facing = Math.sign(cur.x - this.x) || this.facing;
      } else {
        this.state = 'idle';
        this.facing = player.centerX() > this.x ? 1 : -1;
      }
    }

    /* ---------- ambient chatter ---------- */
    this.chatT -= dt;
    if (this.chatT <= 0) {
      this.chatT = 9 + Math.random() * 7;
      const lines = ['Stay close!', 'Nice jump!', 'Almost there!', 'What a night, huh?', 'Don\'t look down!'];
      if (Math.random() < .6) this.say(lines[(Math.random() * lines.length) | 0]);
    }

    /* ---------- safety: never fall impossibly far behind ---------- */
    if (Math.abs(this.y - player.y) > 1400) {
      this.idx = Math.max(0, pIdx - 1);
      const n = this.route[this.idx];
      this.x = n.x; this.y = n.y;
      this.jump = null;
    }
  }

  draw(ctx) {
    const state = ({ wait: 'idle', dodge: 'land' })[this.state] || this.state;
    drawClimber(ctx, {
      x: this.x, y: this.y,
      facing: this.facing, state, t: this.animT,
      hair: 'short', accent: '#39d7ff',
      ring: state === 'kneel',
    });

    /* speech bubble */
    if (this.bubble) {
      ctx.font = '13px sans-serif';
      const tw = ctx.measureText(this.bubble.text).width;
      const bx = this.x - tw / 2 - 8, by = this.y - 86;
      ctx.fillStyle = 'rgba(14,18,34,.9)';
      ctx.strokeStyle = 'rgba(57,215,255,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + 16, 24, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8ecff';
      ctx.fillText(this.bubble.text, bx + 8, by + 16);
      // tail
      ctx.beginPath();
      ctx.moveTo(this.x - 4, by + 24); ctx.lineTo(this.x, by + 32); ctx.lineTo(this.x + 5, by + 24);
      ctx.fillStyle = 'rgba(14,18,34,.9)';
      ctx.fill();
    }
  }
}
