# Meridian Run — Sky Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Riel666/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Riel666/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Entry for the make.fun competition
[best-flight-game-20261126-0057](https://make.fun/c/best-flight-game-20261126-0057)
($500 pool).

## What it is

A chase-view flight game: you are the dawn mail courier for Meridian Field, flying a
prop plane through a course of glowing rings over rolling farmland, minding the hills,
and bringing her home to Runway 27 before the 3:00 clock runs out.

- **Fly the rings**: 59 rings hang on a winding path over the valley. A clean pass scores
  100 × your combo (up to ×5); a near miss is worth 25; a miss breaks the combo.
- **Mind the hills**: the valley floor rises into hills up to ~150 ft. Clip one and you
  lose a life (3 lives) and bounce back to a safe altitude. The PULL UP warning flashes
  when the ground gets close.
- **Beat the clock**: 3:00 to cover 16 km. Cruising at low throttle will not make it —
  push the throttle to finish with time to spare. Landing earns a bonus (250 + 150 per
  life left). Stars at 5,000 / 11,000 / 18,000 points.
- **Instruments**: altitude, speed, heading, throttle, bank, an artificial horizon, a
  compass of the course, a runway progress bar, and the ring count — all live on the HUD.
- **Controls**: ← → / A D steer, ↑ ↓ / W S climb & descend, Shift throttle up, Ctrl
  throttle down, drag to steer, Space start, P pause, M sound, R restart.
- **Sound**: synthesized WebAudio only — an engine drone tied to throttle, wind tied to
  speed, a chime for rings, a thud for terrain strikes. No audio files, no network.

## Run

Requires Node 22.18 or later (the grader runs Node 22.23.4). Serve the static game, then
open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Or run the entry program, which copies `game/` and `screenshots/` and writes the dossier:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Verification

`node main.ts` with `MAKEFUN_OUTPUT_DIR` set copies `game/` and `screenshots/` and writes `dossier.json` (400,140 bytes). Screenshots are real renders of the game in headless Chromium at 1280x800: `1-start.jpg` (88,471 bytes), `2-play.jpg` (94,994 bytes), `3-end.jpg` (79,483 bytes) — each under the 256 KiB cap.

Headless play-tests with the real rules: the autopilot flies the whole 16 km course in 2:29 (score 29,200, all 59 rings, 3 lives left); the sloppy pilot clips the hills and loses all 3 lives (game over at 3,517 m, 12 rings missed). Node smoke tests of the pure logic (terrain, ring path, ring scoring, terrain strikes, course completion) all pass.

## Files

- `main.ts` — the entrypoint; copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `game/index.html` — the page; a full-window canvas, no network requests
- `game/src/config.js` — every tuning number and colour
- `game/src/world.js` — the pure flight logic (terrain, rings, scoring, lives)
- `game/src/render.js` — one frame: sky, mountains, ground, rings, plane, HUD
- `game/src/input.js` — keyboard + pointer steering, throttle, pause, mute
- `game/src/audio.js` — synthesized engine, wind, chimes
- `game/src/shots.js` — posed states for honest screenshots (`?shot=start|play|end`)
- `game/src/main.js` — boot and the fixed-step loop
- `game/src/random.js` — seeded RNG (mulberry32)
- `serve.ts` — a tiny static server for local play
- `shots.json` — the screenshot manifest
- `LICENSE` — MIT
- `.makefun/owner.json` — payout wallet claim file

## License

MIT — see [LICENSE](LICENSE).
