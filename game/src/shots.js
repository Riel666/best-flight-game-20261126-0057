// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot that aims at
// the next ring's centre and holds the throttle, so the frame is what a short game really
// looks like and the same seed always gives the same frame. The end scene's pilot is
// deliberately sloppy about altitude, so it clips a hill and the frame shows the aftermath.
import { COURSE, STEP } from './config.js';
import { EVENT_DONE, EVENT_OVER } from './world.js';
import { SCREEN_DONE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;

/** Steer and pitch toward the next ring; throttle held at 80. */
function autopilot(state, sloppy) {
  const ring = state.rings[state.nextRing];
  if (!ring) return { steer: 0, pitch: 0, thr: 0 };
  const dx = ring.x - state.x;
  const dy = ring.y - state.y;
  const steer = Math.max(-1, Math.min(1, dx / 18));
  let pitch = Math.max(-1, Math.min(1, dy / 45));
  // The sloppy pilot flies well under the rings, into the hills.
  if (sloppy) pitch = Math.max(-1, Math.min(1, (dy - 130) / 45));
  const thr = state.throttle < 80 ? 1 : 0;
  return { steer, pitch, thr };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0, 0, true);
    // Back on the runway: the first ring waits a full 420 units ahead, not looming overhead.
    world.state.z = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const sloppy = name === 'end';
  for (let index = 0; index < limit / STEP; index += 1) {
    const cmd = autopilot(world.state, sloppy);
    const events = world.step(STEP, cmd.steer, cmd.pitch, cmd.thr, false);
    if (events & (EVENT_OVER | EVENT_DONE)) break;
  }
  const over = world.state.lives === 0 || world.state.timeLeft <= 0;
  const done = world.state.finished;
  return { screen: over ? SCREEN_OVER : done ? SCREEN_DONE : SCREEN_PLAY, best: world.state.score };
}
