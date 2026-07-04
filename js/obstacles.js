/* ============================================================
   obstacles.js — hazards & moving platforms
   Dynamic hazards (birds, debris, gusts, helicopter) spawn
   from pooled arrays scaled by stage rates and a difficulty
   multiplier. Fixed hazards (spotlights, cranes) come from
   world generation. Also animates gondolas & crumbling ledges.
   ============================================================ */

class Obstacles {
  constructor(world) {
    this.world = world;
    this.reset();
  }

  reset() {
    this.birds = [];
    this.debris = [];
    this.gust = null;              // one active gust at a time
    this.heli = null;
    this._birdT = 0; this._debrisT = 0; this._gustT = 0;
    this.windForce = 0;            // horizontal force applied to airborne bodies
  }

  /** Nearest active threat to a point (used by the NPC to flinch). */
  nearestThreat(x, y, r) {
    for (const b of this.birds)
      if (b.active && dist(x, y, b.x, b.y) < r) return b;
    for (const d of this.debris)
      if (d.active && dist(x, y, d.x, d.y) < r * 1.2) return d;
    return null;
  }

  update(dt, game) {
    const player = game.player;
    const st = STAGES[game.stageIdx];
    // Difficulty ramps with progress: 1x at street, ~2.2x at the roof.
    const D = 1 + game.progress * 1.2;

    this._updatePlatforms(dt, game);
    this._spawn(dt, game, st, D);
    this._updateBirds(dt, game, D);
    this._updateDebris(dt, game);
    this._updateGust(dt, game, st);
    this._updateSpots(dt, game);
    this._updateCranes(dt, game);
    this._updateHeli(dt, game, st, D);
  }

  /* ---------------- moving & crumbling platforms ---------------- */
  _updatePlatforms(dt, game) {
    for (const p of this.world.platforms) {
      if (p.move) {
        p.move.t += dt;
        const nx = p.move.cx + Math.sin(p.move.t * p.move.sp) * p.move.range;
        p.dx = nx - p.x;
        p.x = nx;
      }
      if (p.crumble) {
        if (p.cState === 1) {                     // shaking
          p.cT += dt;
          if (p.cT > 0.9) {
            p.cState = 2; p.collidable = false; p.cT = 0;
            game.audio.sfx('crumble');
            game.particles.dust(p.x + p.w / 2, p.y + 6, 14);
          }
        } else if (p.cState === 2) {              // gone → respawn later
          p.cT += dt;
          if (p.cT > 4) { p.cState = 0; p.collidable = true; p.cT = 0; }
        }
      }
    }
    // trigger crumble under the player
    const g = game.player.ground;
    if (g && g.crumble && g.cState === 0) { g.cState = 1; g.cT = 0; }
  }

  /* ---------------- spawning ---------------- */
  _spawn(dt, game, st, D) {
    const p = game.player;

    this._birdT -= dt;
    if (this._birdT <= 0 && st.birds > 0) {
      this._birdT = (2.6 / (st.birds * D)) * (0.6 + Math.random() * 0.8);
      const side = Math.random() < .5 ? -1 : 1;
      this.birds.push({
        active: true,
        x: side < 0 ? game.view.x0 - 60 : game.view.x1 + 60,
        y: p.y - 60 - Math.random() * 260,
        vx: -side * (150 + Math.random() * 110) * (0.8 + D * .3),
        phase: Math.random() * 6, r: 13,
      });
      if (this.birds.length > 12) this.birds.shift();
    }

    this._debrisT -= dt;
    if (this._debrisT <= 0 && st.debris > 0) {
      this._debrisT = (2.2 / (st.debris * D)) * (0.5 + Math.random());
      this.debris.push({
        active: true,
        x: clamp(p.x + (Math.random() - .5) * 500, this.world.towerL + 20, this.world.towerR - 20),
        y: game.view.y0 - 80,
        vy: 120 + Math.random() * 140, rot: Math.random() * 6,
        vr: (Math.random() - .5) * 8, r: 12, s: 9 + Math.random() * 9,
      });
      if (this.debris.length > 10) this.debris.shift();
    }

    this._gustT -= dt;
    if (this._gustT <= 0 && st.gusts > 0 && !this.gust) {
      this._gustT = (3 / (st.gusts * 10 * D)) * (2 + Math.random() * 3);
      this.gust = {
        dir: Math.random() < .5 ? -1 : 1,
        t: 0, dur: 1.6 + Math.random() * 1.4,
        power: (240 + Math.random() * 200) * (0.8 + D * .25),
      };
      game.audio.sfx('whoosh');
    }
  }

  /* ---------------- birds ---------------- */
  _updateBirds(dt, game, D) {
    for (const b of this.birds) {
      if (!b.active) continue;
      b.phase += dt * 9;
      b.x += b.vx * dt;
      b.y += Math.sin(b.phase * .6) * 26 * dt;
      if (b.x < game.view.x0 - 120 || b.x > game.view.x1 + 120) { b.active = false; continue; }
      if (circleRect(b.x, b.y, b.r, game.player)) {
        game.player.hit(Math.sign(b.vx) * 260, -220, .45, game);
        b.active = false;
      }
    }
  }

  /* ---------------- falling debris ---------------- */
  _updateDebris(dt, game) {
    for (const d of this.debris) {
      if (!d.active) continue;
      d.vy += 500 * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      if (d.y > game.view.y1 + 120) { d.active = false; continue; }
      // shatter on ledges
      for (const p of this.world.platforms) {
        if (p.collidable === false) continue;
        if (d.x > p.x && d.x < p.x + p.w && d.y > p.y - 4 && d.y < p.y + 14) {
          d.active = false;
          game.particles.dust(d.x, p.y, 8);
          break;
        }
      }
      if (d.active && circleRect(d.x, d.y, d.r, game.player)) {
        game.player.hit((Math.random() - .5) * 200, 160, .6, game);
        game.addShake(7);
        d.active = false;
      }
    }
  }

  /* ---------------- wind gusts ---------------- */
  _updateGust(dt, game, st) {
    this.windForce = Math.sin(game.time * .7) * st.wind * 60;   // base sway
    if (!this.gust) return;
    const g = this.gust;
    g.t += dt;
    // ease in/out envelope
    const env = Math.sin(Math.PI * clamp(g.t / g.dur, 0, 1));
    this.windForce += g.dir * g.power * env;
    // streak particles across the view
    if (Math.random() < .5)
      game.particles.streak(
        g.dir < 0 ? game.view.x1 : game.view.x0,
        game.view.y0 + Math.random() * (game.view.y1 - game.view.y0),
        g.dir, env);
    if (g.t >= g.dur) this.gust = null;
  }

  /* ---------------- security spotlights ---------------- */
  _updateSpots(dt, game) {
    const p = game.player;
    for (const s of this.world.spots) {
      if (Math.abs(s.y - p.y) > 900) { s.caught = 0; continue; }
      s.phase += dt * s.sp;
      s.angle = Math.sin(s.phase) * 0.5 + (s.dir < 0 ? Math.PI : 0);   // sweep
      // beam catch test: distance + angular proximity
      const dx = p.x + p.w / 2 - s.x, dy = p.y + p.h / 2 - s.y;
      const d = Math.hypot(dx, dy);
      const beamA = s.angle;
      const toP = Math.atan2(dy, dx);
      let diff = Math.abs(toP - beamA);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (d < s.len && diff < 0.09 && !p.stunned()) {
        s.caught = (s.caught || 0) + dt;
        if (s.caught > 0.35) {
          s.caught = 0;
          game.audio.sfx('alarm');
          p.hit(-Math.sign(dx) * 180, -140, .7, game);
          p.stamina = Math.max(0, p.stamina - 12);
          game.addShake(5);
        }
      } else s.caught = 0;
    }
  }

  /* ---------------- construction cranes ---------------- */
  _updateCranes(dt, game) {
    const p = game.player;
    for (const c of this.world.cranes) {
      if (Math.abs(c.y - p.y) > 900) continue;
      c.phase += dt * c.sp;
      const a = Math.sin(c.phase) * 0.45 + (c.dir < 0 ? Math.PI : 0);
      c.hx = c.px + Math.cos(a) * c.len;         // hook position
      c.hy = c.y + Math.abs(Math.sin(a)) * 40 + 30;
      if (circleRect(c.hx, c.hy, 20, p)) {
        p.hit(Math.cos(a) * 300, -180, .6, game);
        game.addShake(8);
      }
    }
  }

  /* ---------------- helicopter searchlight ---------------- */
  _updateHeli(dt, game, st, D) {
    const p = game.player;
    if (!st.heli) { this.heli = null; return; }
    if (!this.heli)
      this.heli = { x: p.x, y: p.y - 500, lx: p.x, ly: p.y, t: 0, caught: 0 };
    const h = this.heli;
    h.t += dt;
    // hover above and to the side of the player
    h.x = lerp(h.x, p.x + Math.sin(h.t * .6) * 320, dt * .8);
    h.y = lerp(h.y, p.y - 460, dt * 1.2);
    // searchlight wanders toward the player
    h.lx = lerp(h.lx, p.x + Math.sin(h.t * 1.7) * 130, dt * 1.4);
    h.ly = lerp(h.ly, p.y + Math.cos(h.t * 1.3) * 90, dt * 1.4);
    const inLight = dist(p.x + p.w / 2, p.y + p.h / 2, h.lx, h.ly) < 70;
    if (inLight && !p.stunned()) {
      h.caught += dt;
      if (h.caught > 0.5) {
        h.caught = 0;
        game.audio.sfx('alarm');
        p.hit((Math.random() - .5) * 260, -160, .6, game);
        game.addShake(6);
      }
    } else h.caught = Math.max(0, h.caught - dt);
  }

  /* ================= drawing ================= */
  draw(ctx, game) {
    const view = game.view;

    /* birds */
    ctx.fillStyle = '#0c0f1c';
    ctx.strokeStyle = '#0c0f1c';
    for (const b of this.birds) {
      if (!b.active) continue;
      const flap = Math.sin(b.phase) * 9;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - 12, b.y - flap);
      ctx.quadraticCurveTo(b.x, b.y - 4, b.x + 12, b.y - flap);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    /* debris */
    for (const d of this.debris) {
      if (!d.active) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = '#4a4a56';
      ctx.fillRect(-d.s / 2, -d.s / 2, d.s, d.s);
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(-d.s / 2, -d.s / 2, d.s, 3);
      ctx.restore();
    }

    /* spotlights: emitter + translucent beam */
    for (const s of this.world.spots) {
      if (s.y < view.y0 - 700 || s.y > view.y1 + 700) continue;
      const a = s.angle || 0;
      const grad = ctx.createLinearGradient(s.x, s.y,
        s.x + Math.cos(a) * s.len, s.y + Math.sin(a) * s.len);
      grad.addColorStop(0, 'rgba(255,240,200,.4)');
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(a - .07) * s.len, s.y + Math.sin(a - .07) * s.len);
      ctx.lineTo(s.x + Math.cos(a + .07) * s.len, s.y + Math.sin(a + .07) * s.len);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b3352';
      ctx.fillRect(s.x - 10, s.y - 10, 20, 20);
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    /* cranes: jib + cable + hook ball */
    for (const c of this.world.cranes) {
      if (c.y < view.y0 - 500 || c.y > view.y1 + 500 || c.hx === undefined) continue;
      ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(c.px, c.y); ctx.lineTo(c.hx, c.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,200,220,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.hx, c.y); ctx.lineTo(c.hx, c.hy); ctx.stroke();
      ctx.fillStyle = '#c73e3e';
      ctx.beginPath(); ctx.arc(c.hx, c.hy, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.beginPath(); ctx.arc(c.hx - 5, c.hy - 5, 5, 0, Math.PI * 2); ctx.fill();
    }

    /* helicopter + searchlight */
    if (this.heli) {
      const h = this.heli;
      // light cone
      const grad = ctx.createLinearGradient(h.x, h.y, h.lx, h.ly);
      grad.addColorStop(0, 'rgba(200,230,255,.35)');
      grad.addColorStop(1, 'rgba(200,230,255,.03)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y + 14);
      ctx.lineTo(h.lx - 70, h.ly);
      ctx.lineTo(h.lx + 70, h.ly);
      ctx.closePath(); ctx.fill();
      // light pool
      ctx.fillStyle = 'rgba(220,240,255,.14)';
      ctx.beginPath(); ctx.ellipse(h.lx, h.ly, 70, 40, 0, 0, Math.PI * 2); ctx.fill();
      // body
      ctx.fillStyle = '#10131f';
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(h.x + 20, h.y - 4, 34, 6);      // tail
      // rotor blur
      const r = Math.sin(h.t * 40) * 44;
      ctx.strokeStyle = 'rgba(200,210,240,.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(h.x - r, h.y - 16); ctx.lineTo(h.x + r, h.y - 16); ctx.stroke();
      // blinking nav light
      ctx.fillStyle = `rgba(255,70,70,${(Math.sin(h.t * 6) + 1) / 2})`;
      ctx.beginPath(); ctx.arc(h.x + 52, h.y - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
}
