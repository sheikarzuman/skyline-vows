/* ============================================================
   background.js — environment renderer
   Sky, stars, moon, parallax skyline (pre-rendered to offscreen
   canvases for speed), drifting clouds, rain, and the tower
   itself: facade per stage, ledges, rails, gondolas.
   ============================================================ */

class Background {
  constructor(world, seed) {
    this.world = world;
    this.t = 0;
    const rnd = mulberry32(seed ^ 0xBEEF);

    /* --- stars --- */
    this.stars = [];
    for (let i = 0; i < 140; i++)
      this.stars.push({ x: rnd(), y: rnd(), s: .5 + rnd() * 1.6, tw: rnd() * 6 });

    /* --- clouds --- */
    this.clouds = [];
    for (let i = 0; i < 10; i++)
      this.clouds.push({
        x: rnd() * 2400 - 700, y: rnd() * world.H,
        w: 260 + rnd() * 380, h: 46 + rnd() * 40,
        sp: 6 + rnd() * 18, a: .05 + rnd() * .08,
      });

    /* --- rain (recycled drops, positioned relative to camera) --- */
    this.rain = [];
    for (let i = 0; i < 150; i++)
      this.rain.push({ x: rnd(), y: rnd(), sp: 900 + rnd() * 500, l: 10 + rnd() * 14 });

    /* --- pre-rendered parallax skyline layers --- */
    this.layers = [
      this._makeSkyline(rnd, 2600, 520, '#10152b', '#243154', .12),
      this._makeSkyline(rnd, 2600, 700, '#161d38', '#31426e', .3),
    ];
  }

  /** Render a strip of building silhouettes with lit windows once. */
  _makeSkyline(rnd, w, h, color, winColor, parallax) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    let x = 0;
    while (x < w) {
      const bw = 60 + rnd() * 130;
      const bh = h * (.3 + rnd() * .65);
      g.fillStyle = color;
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = winColor;
      for (let wy = h - bh + 10; wy < h - 12; wy += 16)
        for (let wx = x + 6; wx < x + bw - 8; wx += 14)
          if (rnd() < .3) g.globalAlpha = .5 + rnd() * .5, g.fillRect(wx, wy, 6, 8);
      g.globalAlpha = 1;
      // occasional neon rooftop sign
      if (rnd() < .2) {
        g.fillStyle = ['#ff4d8d', '#39d7ff', '#ffd166'][(rnd() * 3) | 0];
        g.fillRect(x + bw * .3, h - bh - 6, bw * .4, 4);
      }
      x += bw + 4 + rnd() * 30;
    }
    return { canvas: c, parallax };
  }

  update(dt, wind) {
    this.t += dt;
    for (const cl of this.clouds) {
      cl.x += (cl.sp + wind * 40) * dt;
      if (cl.x > 1900) cl.x = -900;
      if (cl.x < -950) cl.x = 1850;
    }
  }

  /* ============ sky + far city (screen space) ============ */
  drawSky(ctx, cam, cw, ch, progress) {
    // Higher = darker, starrier.
    const top = lerp(0.22, 0.02, progress);
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, `rgba(${10 + top * 40}, ${12 + top * 55}, ${30 + top * 90}, 1)`);
    grad.addColorStop(.6, '#0d1226');
    grad.addColorStop(1, '#141a33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // stars twinkle, more visible with altitude
    ctx.fillStyle = '#dfe6ff';
    for (const s of this.stars) {
      const a = (.25 + progress * .6) * (.5 + .5 * Math.sin(this.t * 1.5 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillRect(s.x * cw, ((s.y * ch * 1.4) - cam.y * .03) % ch, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // moon
    const mx = cw * .82, my = ch * .16 + cam.y * .01;
    const glow = ctx.createRadialGradient(mx, my, 8, mx, my, 90);
    glow.addColorStop(0, 'rgba(235,240,255,.9)');
    glow.addColorStop(.25, 'rgba(200,215,255,.25)');
    glow.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
  }

  /** Parallax skyline layers + clouds (screen space). */
  drawFar(ctx, cam, cw, ch) {
    for (const L of this.layers) {
      const img = L.canvas;
      // horizontal wrap, vertical parallax against climb
      const oy = ch - img.height + (cam.y - this.world.startY) * L.parallax * -1;
      let ox = (-cam.x * L.parallax) % img.width;
      if (ox > 0) ox -= img.width;
      for (let xx = ox; xx < cw; xx += img.width)
        ctx.drawImage(img, xx, clamp(oy, ch - img.height, ch * .8));
    }
    // clouds drift between skyline and tower
    for (const cl of this.clouds) {
      const sy = (cl.y - cam.y) * .55 + ch * .5;
      if (sy < -120 || sy > ch + 120) continue;
      ctx.fillStyle = `rgba(190,200,235,${cl.a})`;
      ctx.beginPath();
      ctx.ellipse(cl.x - cam.x * .5, sy, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ============ the tower (world space, inside camera transform) ============ */
  drawTower(ctx, view, game) {
    const w = this.world;
    const y0 = Math.max(view.y0, w.rooftopY - 300);
    const y1 = Math.min(view.y1, w.startY + 200);

    /* facade body */
    ctx.fillStyle = '#131a30';
    ctx.fillRect(w.towerL, y0, w.towerR - w.towerL, y1 - y0);

    /* per-stage tint + window grid (only visible rows) */
    const P = CFG.PX_PER_M;
    const rowH = 44, colW = 52;
    const firstRow = Math.floor((y0 - w.rooftopY) / rowH);
    const lastRow  = Math.ceil((y1 - w.rooftopY) / rowH);
    for (let r = firstRow; r < lastRow; r++) {
      const wy = w.rooftopY + r * rowH;
      const m = (w.startY - wy) / P;
      if (m < 0 || m > TOTAL_M) continue;
      const st = STAGES[stageIndexAt(m)];
      // subtle stage tint band
      ctx.fillStyle = st.tint;
      ctx.globalAlpha = .16;
      ctx.fillRect(w.towerL, wy, w.towerR - w.towerL, rowH);
      ctx.globalAlpha = 1;
      // windows: deterministic pseudo-random lighting per cell
      for (let cx = w.towerL + 18; cx < w.towerR - 30; cx += colW) {
        const hsh = ((cx * 7 + r * 131) % 17);
        if (hsh < 6) {
          ctx.fillStyle = hsh < 2 ? st.neon : 'rgba(255,238,190,.5)';
          ctx.globalAlpha = hsh < 2 ? .55 : .3;
          ctx.fillRect(cx, wy + 8, 30, 22);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = 'rgba(80,100,150,.16)';
          ctx.fillRect(cx, wy + 8, 30, 22);
        }
      }
      // construction-zone scaffolding lines
      if (st.name === 'CONSTRUCTION ZONE' && r % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,168,50,.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w.towerL, wy); ctx.lineTo(w.towerR, wy);
        ctx.stroke();
      }
      // glass facade sheen
      if (st.name === 'GLASS FACADE') {
        ctx.fillStyle = 'rgba(84,255,216,.05)';
        ctx.fillRect(w.towerL + ((r * 37) % 300), wy, 90, rowH);
      }
    }

    /* tower edges */
    ctx.fillStyle = 'rgba(140,170,255,.14)';
    ctx.fillRect(w.towerL, y0, 5, y1 - y0);
    ctx.fillRect(w.towerR - 5, y0, 5, y1 - y0);

    /* rooftop details */
    if (view.y0 < w.rooftopY + 200) {
      const rx = (w.towerL + w.towerR) / 2;
      // antenna with blinking beacon
      ctx.strokeStyle = '#3a4666'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(rx, w.rooftopY); ctx.lineTo(rx, w.rooftopY - 140); ctx.stroke();
      const blink = (Math.sin(this.t * 4) + 1) / 2;
      ctx.fillStyle = `rgba(255,60,60,${.3 + blink * .7})`;
      ctx.beginPath(); ctx.arc(rx, w.rooftopY - 145, 5 + blink * 3, 0, Math.PI * 2); ctx.fill();
      // roof door
      ctx.fillStyle = '#1c2440';
      ctx.fillRect(rx - 130, w.rooftopY - 52, 44, 52);
    }

    /* street level */
    if (view.y1 > w.startY - 60) {
      ctx.fillStyle = '#1a2140';
      ctx.fillRect(view.x0, w.startY, view.x1 - view.x0, 200);
      ctx.fillStyle = 'rgba(255,209,102,.5)';
      for (let sx = Math.floor(view.x0 / 160) * 160; sx < view.x1; sx += 160) {
        ctx.fillRect(sx, w.startY - 34, 3, 34);              // street lamp pole
        ctx.beginPath(); ctx.arc(sx + 1, w.startY - 38, 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    this._drawPlatforms(ctx, view, game);
    this._drawWalls(ctx, view);
  }

  _drawPlatforms(ctx, view, game) {
    for (const p of this.world.platforms) {
      if (p.y > view.y1 + 40 || p.y + p.h < view.y0 - 40) continue;
      const st = STAGES[p.stage] || STAGES[0];
      let ox = 0;
      if (p.crumble && p.cState === 1) ox = Math.sin(game.time * 60) * 2;  // shaking
      if (p.crumble && p.cState === 2) continue;                            // gone

      if (p.gondola) {
        // hanging cables + bucket
        ctx.strokeStyle = 'rgba(160,175,220,.5)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 8, p.y); ctx.lineTo(p.x + 8, p.y - 400);
        ctx.moveTo(p.x + p.w - 8, p.y); ctx.lineTo(p.x + p.w - 8, p.y - 400);
        ctx.stroke();
      }

      // ledge body
      ctx.fillStyle = p.rooftop || p.base ? '#232c4c' : '#2b3558';
      ctx.fillRect(p.x + ox, p.y, p.w, p.h);
      if (p.gondola) {  // bucket lip
        ctx.fillStyle = '#3b4a75';
        ctx.fillRect(p.x + ox, p.y + p.h, p.w, 10);
      }
      // neon lip in the stage color
      ctx.fillStyle = p.checkpoint ? '#35e0a1' : st.neon;
      ctx.globalAlpha = p.checkpoint ? .9 : .6;
      ctx.fillRect(p.x + ox, p.y, p.w, 3);
      ctx.globalAlpha = 1;
      // cracks on crumbling ledges
      if (p.crumble) {
        ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w * .3 + ox, p.y);
        ctx.lineTo(p.x + p.w * .4 + ox, p.y + p.h);
        ctx.moveTo(p.x + p.w * .7 + ox, p.y);
        ctx.lineTo(p.x + p.w * .62 + ox, p.y + p.h);
        ctx.stroke();
      }
      // checkpoint flag
      if (p.checkpoint) {
        const fx = p.x + p.w / 2;
        ctx.strokeStyle = '#9aa5cf'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx, p.y); ctx.lineTo(fx, p.y - 30); ctx.stroke();
        ctx.fillStyle = '#35e0a1';
        ctx.beginPath();
        ctx.moveTo(fx, p.y - 30); ctx.lineTo(fx + 16, p.y - 24); ctx.lineTo(fx, p.y - 18);
        ctx.fill();
      }
    }
  }

  _drawWalls(ctx, view) {
    for (const w of this.world.walls) {
      if (w.y > view.y1 + 40 || w.y + w.h < view.y0 - 40) continue;
      const st = STAGES[w.stage] || STAGES[0];
      // rail pipe
      ctx.fillStyle = '#39466e';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(w.x + 2, w.y, 3, w.h);
      // rung marks so it reads as climbable
      ctx.fillStyle = st.neon;
      ctx.globalAlpha = .5;
      for (let ry = w.y + 10; ry < w.y + w.h - 6; ry += 26)
        ctx.fillRect(w.x - 2, ry, w.w + 4, 3);
      ctx.globalAlpha = 1;
    }
  }

  /** Rain, drawn in screen space over everything in-world. */
  drawWeather(ctx, cam, cw, ch, wind) {
    ctx.strokeStyle = 'rgba(170,195,255,.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const slant = wind * 60;
    for (const r of this.rain) {
      const x = ((r.x * cw + this.t * slant * 4) % cw + cw) % cw;
      const y = ((r.y * ch + this.t * r.sp * .55) % ch + ch) % ch;
      ctx.moveTo(x, y);
      ctx.lineTo(x + slant * .12, y + r.l);
    }
    ctx.stroke();
  }
}
