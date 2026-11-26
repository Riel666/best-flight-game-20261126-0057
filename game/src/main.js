// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over and course complete.
//
// ?seed=N fixes the course. ?shot=start|play|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, COURSE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_DONE, EVENT_HIT, EVENT_NEAR, EVENT_OVER, EVENT_RING } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.state.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Flying. Steer with the arrow keys, climb with up, throttle with shift.');
  }

  function endGame(done) {
    screen = done ? SCREEN_DONE : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      done
        ? `Course complete. Score ${world.state.score}. Best ${best}.`
        : `Flight over. Score ${world.state.score}. Best ${best}.`,
    );
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_DONE)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, 0, 0, true);
      return;
    }
    const events = world.step(STEP, input.steer(), input.pitch(), input.throttle(), false);
    if (events & EVENT_RING) audio.ring(world.state.combo);
    if (events & EVENT_NEAR) audio.near();
    if (events & EVENT_HIT) {
      audio.crash();
      announce(world.state.lives === 1 ? 'Terrain strike. 1 life left.' : `Terrain strike. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_DONE) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (screen === SCREEN_PLAY) audio.update(world.state.throttle, world.state.speed);
    renderer.draw(world.state, screen, best, world.state.elapsed);
  }

  // Leaving the tab pauses a running game rather than letting the plane fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Meridian Run. Press Space or click to take off.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
