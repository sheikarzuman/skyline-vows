/* ============================================================
   levels.js — stage definitions + procedural tower generation
   The tower is one continuous world split into 6 stages by
   height. Each stage tunes ledge spacing, hazard rates and
   colors. generateWorld(seed) is deterministic per seed.
   ============================================================ */

const STAGES = [
  { name: 'LOWER FLOORS', m0: 0,   m1: 110, tint: '#31405e', neon: '#ffb347',
    gap: [62, 100],  reach: 200, crumble: 0,    gondola: 0,    panel: .22,
    birds: .22, debris: .04, gusts: 0,   spot: 0, crane: 0, heli: 0, wind: .05 },

  { name: 'OFFICE SECTION', m0: 110, m1: 240, tint: '#2a4a63', neon: '#5ec8ff',
    gap: [70, 108],  reach: 220, crumble: .05, gondola: .18, panel: .28,
    birds: .3,  debris: .12, gusts: .03, spot: 0, crane: 0, heli: 0, wind: .12 },

  { name: 'CONSTRUCTION ZONE', m0: 240, m1: 380, tint: '#4d3d28', neon: '#ffa832',
    gap: [74, 114],  reach: 235, crumble: .26, gondola: .07, panel: .34,
    birds: .18, debris: .32, gusts: .05, spot: 0, crane: 1, heli: 0, wind: .2 },

  { name: 'GLASS FACADE', m0: 380, m1: 520, tint: '#1e4c50', neon: '#54ffd8',
    gap: [92, 150],  reach: 245, crumble: .12, gondola: .1,  panel: .7,
    birds: .26, debris: .14, gusts: .13, spot: 1, crane: 0, heli: 0, wind: .32 },

  { name: 'UPPER TOWER', m0: 520, m1: 660, tint: '#372a52', neon: '#b06bff',
    gap: [96, 156],  reach: 255, crumble: .2,  gondola: .05, panel: .75,
    birds: .3,  debris: .26, gusts: .17, spot: 1, crane: 0, heli: 1, wind: .5 },

  { name: 'ROOFTOP', m0: 660, m1: 680, tint: '#141b2e', neon: '#ff4d8d',
    gap: [78, 100],  reach: 190, crumble: 0,   gondola: 0,   panel: .6,
    birds: 0,  debris: 0,   gusts: .05, spot: 0, crane: 0, heli: 0, wind: .35 },
];

const TOTAL_M = 680;                      // tower height in meters

/** Stage index for a given climbed height (meters). */
function stageIndexAt(m) {
  for (let i = STAGES.length - 1; i >= 0; i--)
    if (m >= STAGES[i].m0) return i;
  return 0;
}

/**
 * Build the whole world.
 * Returns { platforms, walls, spots, cranes, route, checkpoints,
 *           towerL, towerR, startX, startY, rooftopY, H }
 */
function generateWorld(seed) {
  const rnd = mulberry32(seed);
  const P = CFG.PX_PER_M;
  const towerL = 140, towerR = 860;              // tower body in world x
  const H = TOTAL_M * P + 700;                   // total world height (px)
  const startY = H - 140;                        // street level (top of base slab)

  const world = {
    platforms: [], walls: [], spots: [], cranes: [],
    route: [], checkpoints: [],
    towerL, towerR, H, startY,
    startX: 500,
    rooftopY: startY - TOTAL_M * P,
  };

  // Street-level base slab.
  world.platforms.push({
    x: towerL - 120, y: startY, w: (towerR - towerL) + 240, h: 80, base: true, stage: 0,
  });
  world.route.push({ x: 500, y: startY });
  world.checkpoints.push({ x: 500, y: startY });

  let y = startY;
  let x = 500;
  let lastStage = 0;
  let spotSide = 1, craneSide = 1;
  let sinceSpot = 0, sinceCrane = 0;

  while (true) {
    const climbedM = (startY - y) / P;
    if (climbedM >= TOTAL_M - 12) break;         // leave room for the roof
    const si = stageIndexAt(climbedM);
    const st = STAGES[si];

    /* --- checkpoint ledge on every stage boundary --- */
    if (si !== lastStage) {
      lastStage = si;
      y -= 90;
      x = clamp(x + randRange(rnd, -120, 120), towerL + 130, towerR - 130);
      const cw = 230;
      world.platforms.push({ x: x - cw / 2, y, w: cw, h: 16, stage: si, checkpoint: true });
      world.route.push({ x, y });
      world.checkpoints.push({ x, y });
      continue;
    }

    /* --- regular ledge --- */
    const gap = randRange(rnd, st.gap[0], st.gap[1]);
    const ny = y - gap;
    let dx = randRange(rnd, -st.reach, st.reach);
    if (Math.abs(dx) < 70) dx = Math.sign(dx || 1) * 70;     // avoid stacking
    const nx = clamp(x + dx, towerL + 80, towerR - 80);
    const pw = randRange(rnd, 92, 172);
    const p = { x: nx - pw / 2, y: ny, w: pw, h: 14, stage: si };

    if (rnd() < st.crumble) {
      p.crumble = true; p.cState = 0; p.cT = 0; p.oy = ny;
    } else if (rnd() < st.gondola) {
      // Window-cleaner gondola: an oscillating moving platform.
      const range = randRange(rnd, 55, 95);
      p.move = { cx: nx - pw / 2, range, sp: randRange(rnd, .5, 1.1), t: rnd() * 6 };
      p.gondola = true;
    }
    world.platforms.push(p);
    world.route.push({ x: nx, y: ny });

    /* --- climbing rail when the gap is too tall to jump, or by chance --- */
    if (gap > 118 || rnd() < st.panel) {
      const side = rnd() < .5 ? -1 : 1;
      const wx = clamp(nx + side * (pw / 2 + 12), towerL + 16, towerR - 30);
      world.walls.push({ x: wx, y: ny - 14, w: 14, h: gap + 90, stage: si });
    }

    /* --- fixed hazard emplacements --- */
    sinceSpot += gap; sinceCrane += gap;
    if (st.spot && sinceSpot > 560) {
      sinceSpot = 0; spotSide = -spotSide;
      world.spots.push({
        x: spotSide < 0 ? towerL - 10 : towerR + 10, y: ny - 40,
        dir: -spotSide,                              // beam points into the tower
        len: 620, phase: rnd() * 6, sp: randRange(rnd, .45, .7),
      });
    }
    if (st.crane && sinceCrane > 720) {
      sinceCrane = 0; craneSide = -craneSide;
      world.cranes.push({
        px: craneSide < 0 ? towerL - 30 : towerR + 30, y: ny - 60,
        dir: -craneSide, len: randRange(rnd, 260, 340),
        phase: rnd() * 6, sp: randRange(rnd, .4, .6),
      });
    }

    y = ny; x = nx;
  }

  /* --- final approach rail + rooftop slab --- */
  const roofY = world.rooftopY;
  world.walls.push({
    x: clamp(x + 40, towerL + 40, towerR - 60), y: roofY - 10,
    w: 14, h: (y - roofY) + 80, stage: 5,
  });
  world.platforms.push({
    x: towerL, y: roofY, w: towerR - towerL, h: 46, rooftop: true, stage: 5,
  });
  world.route.push({ x: 500, y: roofY });
  world.checkpoints.push({ x: 500, y: roofY });

  return world;
}
