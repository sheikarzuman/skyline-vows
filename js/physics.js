/* ============================================================
   physics.js — tuning constants, math helpers, AABB collision
   ============================================================ */

/** Global gameplay tuning. World units are pixels. */
const CFG = {
  GRAVITY: 2300,        // px/s^2
  MOVE_SPEED: 270,      // ground run speed
  AIR_CONTROL: 0.72,    // fraction of steering while airborne
  ACCEL: 2600,          // horizontal acceleration
  JUMP_VEL: 780,        // jump impulse  (apex ~132 px)
  WALL_SLIDE: 150,      // max fall speed while pressed into a rail
  CLIMB_SPEED: 165,     // climbing up a rail
  WALL_JUMP_VX: 420,
  WALL_JUMP_VY: 700,
  COYOTE: 0.12,         // grace after leaving a ledge
  JUMP_BUFFER: 0.14,    // grace before landing
  STAMINA_MAX: 100,
  DRAIN_CLIMB: 11,      // stamina / s while climbing
  DRAIN_HANG: 4,        // stamina / s while hanging still
  REGEN: 32,            // stamina / s while standing
  PX_PER_M: 8,          // pixels per meter (for the HUD)
  MAX_FALL: 1400,
};

/* ------------------- math helpers ------------------- */
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;

/** Deterministic PRNG so a seed always builds the same tower. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randRange = (rnd, a, b) => a + rnd() * (b - a);

/* ------------------- geometry ------------------- */
/** Axis-aligned overlap between two {x,y,w,h} rects. */
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Circle vs rect — used for hazard hits. */
function circleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/** Distance between two points. */
function dist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ------------------- movement & collision -------------------
   Bodies are {x, y, w, h, vx, vy}. The world provides:
   - world.platforms : one-way ledges (land only from above)
   - world.walls     : solid, climbable rails/pipes
   After a step the body gains:
   - onGround, ground (platform ref), wallDir (-1 rail left,
     1 rail right, 0 none) and wallRef.
--------------------------------------------------------------- */
function moveAndCollide(body, dt, world) {
  body.onGround = false;
  body.ground   = null;
  body.wallDir  = 0;
  body.wallRef  = null;

  /* --- horizontal pass (walls are solid sideways) --- */
  body.x += body.vx * dt;
  for (const w of world.walls) {
    if (!aabb(body, w)) continue;
    const bodyCx = body.x + body.w / 2;
    const wallCx = w.x + w.w / 2;
    if (bodyCx < wallCx) {           // wall is on the body's right
      body.x = w.x - body.w;
      if (body.vx > 0) body.vx = 0;
    } else {                          // wall is on the body's left
      body.x = w.x + w.w;
      if (body.vx < 0) body.vx = 0;
    }
  }

  /* --- contact probe: is a rail within grab reach? --- */
  const probe = { x: body.x - 7, y: body.y + 4, w: body.w + 14, h: body.h - 8 };
  for (const w of world.walls) {
    if (!aabb(probe, w)) continue;
    body.wallRef = w;
    body.wallDir = (w.x + w.w / 2) > (body.x + body.w / 2) ? 1 : -1;
    break;
  }

  /* --- vertical pass --- */
  const prevBottom = body.y + body.h - body.vy * dt; // bottom before the move
  body.y += body.vy * dt;

  if (body.vy >= 0) {
    // Falling: land on one-way platforms crossed this frame.
    const bottom = body.y + body.h;
    for (const p of world.platforms) {
      if (p.collidable === false) continue;
      if (body.x + body.w <= p.x || body.x >= p.x + p.w) continue;
      if (prevBottom <= p.y + 6 && bottom >= p.y) {
        body.y = p.y - body.h;
        body.vy = 0;
        body.onGround = true;
        body.ground = p;
        break;
      }
    }
  } else {
    // Rising: solid rails can bonk the head.
    for (const w of world.walls) {
      if (!aabb(body, w)) continue;
      const prevTop = body.y - body.vy * dt;
      if (prevTop >= w.y + w.h - 4) {
        body.y = w.y + w.h;
        body.vy = 0;
      }
    }
  }

  body.vy = clamp(body.vy, -CFG.MAX_FALL, CFG.MAX_FALL);
}
