

# Skyline Vows

A browser-based 2D night-climbing game. Two climbers in sleek black outfits scale an impossibly tall skyscraper through rain, wind, birds, cranes and searchlights — and at the rooftop, one of them kneels with a question. Entirely fictional; inspired by a concept, not by any real people or events.

## Run it

No build step, no server, no dependencies:

1. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge). Double-clicking the file works — the game uses classic scripts, so `file://` is fine.
2. Optional (nicer for mobile testing): `python3 -m http.server` in this folder, then visit `http://localhost:8000`.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | ← → / A D | Virtual joystick (bottom-left) |
| Climb up / down rails | ↑ ↓ / W S | Joystick up / down |
| Jump & wall-jump | Space / K | JUMP button |
| Grab rails | Shift / J | GRAB button (hold) |
| Pause | P / Esc | Pause button (top-right) |
| Skip to next stage | N | — |
| Skip to the ending | E | — |

You can also start directly from any stage using the numbered buttons on the main menu, or jump straight to the rooftop proposal with the ♥ button.

**How to play:** Jump between ledges. Hold GRAB against the glowing rails to climb them — climbing drains stamina, which refills when you stand on a ledge. Reach a green-lipped ledge to save a checkpoint; fall too far and you respawn there. Reach the rooftop.

## Stages

1. **Lower Floors** — learn to move; slow birds.
2. **Office Section** — window-cleaner gondolas (moving platforms), falling debris.
3. **Construction Zone** — swinging crane hooks, crumbling ledges, heavy debris.
4. **Glass Facade** — sparse ledges, long rail climbs, wind gusts, security spotlights.
5. **Upper Tower** — helicopter searchlight, strong wind, everything at once.
6. **Rooftop** — the cinematic. Your answer decides the ending: fireworks and credits, or a very dramatic exit and one emotionally supportive pigeon.

## Project structure

```
index.html          — page shell, menus, HUD, touch controls
css/styles.css      — neon night theme for all DOM chrome
js/
  physics.js        — tuning constants (CFG), math helpers, AABB collision
  particles.js      — pooled particle system (dust, sparks, fireworks, hearts…)
  input.js          — keyboard + virtual joystick/buttons, edge-triggered jump
  audio.js          — procedural Web Audio placeholders (SFX, wind, music)
  levels.js         — stage table + deterministic procedural tower generator
  background.js     — sky, stars, pre-rendered parallax skyline, rain, tower facade
  obstacles.js      — birds, debris, gusts, spotlights, cranes, helicopter,
                      gondola movement, crumbling-ledge logic
  player.js         — player state machine + shared procedural character renderer
  npc.js            — companion AI (route follower, waits/leads, flinches, chats)
  ui.js             — screen switching, HUD updates, banners, dialogue
  game.js           — game loop, camera, checkpoints, ending cinematic
  main.js           — bootstrap + roundRect polyfill
assets/
  images/           — empty; characters and world are drawn procedurally
  audio/            — empty; all sounds are synthesized placeholders
```

## Architecture notes

- **World** — one continuous vertical world (~680 m at 8 px/m), generated from a random seed. Each stage band tunes ledge spacing, rail frequency, hazard rates, colors. Route nodes recorded during generation drive the NPC.
- **Physics** — one-way ledges + solid climbable rails; coyote time, jump buffering, wall-slide, wall-jump, stamina-gated climbing, wind as a horizontal force.
- **NPC** — follows route nodes with eased walks and parabolic hops (cheap and stable), rubber-bands to the player: waits if >3 nodes ahead, sometimes leads by 0–2 nodes, crouches near hazards, teases you from above.
- **Performance** — pooled particles, pre-rendered skyline layers, visibility-culled windows/ledges/hazards, DPR-capped canvas, single rAF loop with clamped dt. Comfortably 60 FPS.
- **Audio** — everything synthesized via Web Audio so there are zero asset downloads. To use real assets, drop files into `assets/audio/` and replace the bodies of `AudioMan.sfx()` / `music()` with buffer playback.

## Future improvements

- Sprite-sheet character art and richer animation blending (procedural rigs are placeholder-friendly by design).
- More hazards: opening windows, AC-unit steam vents, billboard shorts (electric), umbrella updrafts.
- Extra levels: a second tower reached by zipline, an interior elevator-shaft stage, a storm variant with lightning timing puzzles.
- Co-op mode: second local player controls the partner.
- Speedrun timer with best-time persistence and a ghost replay.
- Difficulty settings, colorblind-safe palettes, gamepad support.
- Real music/SFX, and voice blips for the speech bubbles.
>>>>>>> 9dbda7c (Initial commit: Skyline Vows)
