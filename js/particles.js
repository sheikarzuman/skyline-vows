/* ============================================================
   particles.js — pooled particle system
   One flat pool of recycled particle objects keeps GC pressure
   near zero. Types: dust, spark, streak, firework, heart, ring.
   ============================================================ */

class Particles {
  constructor(max = 500) {
    this.pool = [];
    for (let i = 0; i < max; i++) this.pool.push({ active: false });
    this.cursor = 0;
  }

  /** Grab the next free (or oldest) slot. */
  _get() {
    for (let i = 0; i < this.pool.length; i++) {
      this.cursor = (this.cursor + 1) % this.pool.length;
      if (!this.pool[this.cursor].active) break;
    }
    return this.pool[this.cursor];
  }

  _spawn(x, y, vx, vy, life, size, color, type, grav = 0) {
    const p = this._get();
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life;
    p.size = size; p.color = color; p.type = type; p.grav = grav;
  }

  /* ---------- effect recipes ---------- */

  dust(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI;      // upward fan
      const s = 40 + Math.random() * 90;
      this._spawn(x + (Math.random() - .5) * 14, y,
        Math.cos(a) * s * .6, Math.sin(a) * s * .35 - 30,
        .4 + Math.random() * .3, 2 + Math.random() * 3,
        'rgba(200,205,230,', 'dust', 300);
    }
  }

  spark(x, y, n = 8, color = 'rgba(255,209,102,') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 220;
      this._spawn(x, y, Math.cos(a) * s, Math.sin(a) * s,
        .35 + Math.random() * .3, 1.5 + Math.random() * 2, color, 'spark', 900);
    }
  }

  hitBurst(x, y) { this.spark(x, y, 10, 'rgba(255,92,92,'); this.dust(x, y, 4); }

  /** Horizontal wind streak. */
  streak(x, y, dir, strength = 1) {
    this._spawn(x, y, dir * (500 + Math.random() * 400) * strength,
      (Math.random() - .5) * 40, .5 + Math.random() * .4,
      1, 'rgba(180,220,255,', 'streak', 0);
  }

  firework(x, y) {
    const hues = ['255,209,102', '255,77,141', '57,215,255', '181,255,110', '200,160,255'];
    const c = 'rgba(' + hues[(Math.random() * hues.length) | 0] + ',';
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .2;
      const s = 130 + Math.random() * 160;
      this._spawn(x, y, Math.cos(a) * s, Math.sin(a) * s,
        1 + Math.random() * .7, 2 + Math.random() * 2, c, 'spark', 260);
    }
  }

  heart(x, y) {
    this._spawn(x + (Math.random() - .5) * 40, y,
      (Math.random() - .5) * 30, -60 - Math.random() * 60,
      1.4 + Math.random() * .8, 7 + Math.random() * 6,
      'rgba(255,77,141,', 'heart', -40);
  }

  ringSparkle(x, y) {
    for (let i = 0; i < 3; i++)
      this._spawn(x + (Math.random() - .5) * 10, y + (Math.random() - .5) * 10,
        (Math.random() - .5) * 20, -20 - Math.random() * 30,
        .6 + Math.random() * .4, 1.5 + Math.random() * 1.5,
        'rgba(255,230,150,', 'spark', 0);
  }

  /* ---------- simulation ---------- */

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'dust' || p.type === 'streak') { p.vx *= (1 - 2.4 * dt); }
    }
  }

  draw(ctx, view) {
    for (const p of this.pool) {
      if (!p.active) continue;
      if (p.x < view.x0 - 60 || p.x > view.x1 + 60 ||
          p.y < view.y0 - 60 || p.y > view.y1 + 60) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'streak') {
        ctx.strokeStyle = p.color + (a * .8) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * .06, p.y - p.vy * .06);
        ctx.stroke();
      } else if (p.type === 'heart') {
        ctx.fillStyle = p.color + a + ')';
        ctx.font = `${p.size * 2}px sans-serif`;
        ctx.fillText('❤', p.x, p.y);
      } else {
        ctx.fillStyle = p.color + a + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.type === 'dust' ? (2 - a) : a + .3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
