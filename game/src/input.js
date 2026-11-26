// Keyboard and pointer input. Held keys give steering, pitch and throttle; one-shot presses
// (start or restart, pause, mute) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let thrUp = false;
  let thrDown = false;
  let actions = 0;
  // Pointer steering: drag horizontally to bank, vertically to pitch.
  let pointer = null;

  function onKey(event, isDown) {
    if (LEFT.has(event.code)) left = isDown;
    else if (RIGHT.has(event.code)) right = isDown;
    else if (UP.has(event.code)) up = isDown;
    else if (DOWN.has(event.code)) down = isDown;
    else if (THROTTLE_UP.has(event.code)) thrUp = isDown;
    else if (THROTTLE_DOWN.has(event.code)) thrDown = isDown;
    else if (!isDown) return;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else return;
    event.preventDefault();
  }

  window.addEventListener('keydown', (event) => onKey(event, true));
  window.addEventListener('keyup', (event) => onKey(event, false));
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = right = up = down = thrUp = thrDown = false;
    pointer = null;
  });
  target.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    if (pointer) pointer = { x: event.clientX, y: event.clientY };
  });
  target.addEventListener('pointerup', () => {
    pointer = null;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    steer() {
      if (pointer) {
        const rect = target.getBoundingClientRect();
        const nx = (pointer.x - rect.left) / rect.width - 0.5;
        return Math.max(-1, Math.min(1, nx * 3));
      }
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** 1 to climb, -1 to descend, 0 for level. */
    pitch() {
      if (pointer) {
        const rect = target.getBoundingClientRect();
        const ny = (pointer.y - rect.top) / rect.height - 0.5;
        return Math.max(-1, Math.min(1, -ny * 3));
      }
      return (up ? 1 : 0) - (down ? 1 : 0);
    },
    /** -1, 0 or 1: throttle down, hold, or up. */
    throttle() {
      return (thrUp ? 1 : 0) - (thrDown ? 1 : 0);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
