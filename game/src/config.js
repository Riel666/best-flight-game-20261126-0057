// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

// The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

// The course: distance units along the flight path. The runway sits at the far end.
export const COURSE = {
  length: 16000,
  // Seconds of flight time before the run is scored as unfinished.
  timeLimit: 180,
  // Lateral corridor the plane may use, in world units.
  halfWidth: 60,
  // Altitude band, in feet.
  minAlt: 40,
  maxAlt: 420,
  // Speed band, in knots, at throttle 0 and 100.
  minSpeed: 60,
  maxSpeed: 230,
  // How far ahead the renderer draws rings and terrain features.
  viewDistance: 1400,
};

export const PLANE = {
  // Lateral speed at full bank, world units per second.
  lateralSpeed: 55,
  // Climb / sink rate at full pitch, feet per second.
  climbRate: 95,
  // Bank angle the plane reaches at full steering, degrees.
  maxBank: 38,
  // Throttle change per second while held.
  throttleRate: 45,
  // Seconds of grace after a crash before another can happen.
  invulnerable: 2.0,
  // Terrain clearance that triggers the PULL UP warning, in feet.
  warnClearance: 35,
};

export const RING = {
  radius: 15,
  // Gap between rings along the course, in distance units.
  spacing: 260,
  // First ring starts this far along the course.
  firstAt: 420,
  // Points for a clean pass through the centre, multiplied by the combo.
  points: 100,
  // Points for a near miss (inside 1.8x the radius).
  nearPoints: 25,
  // Combo multiplier caps here.
  maxCombo: 5,
};

export const LIVES = 3;

// Stars at the end of a run, by score.
export const STARS = [5000, 11000, 18000];

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-run.best';

export const PALETTE = {
  skyTop: '#1e4d7b',
  skyMid: '#7db3d9',
  skyHorizon: '#ffd9a0',
  sun: '#fff3c4',
  sunCore: '#fffbe8',
  cloud: 'rgba(255,255,255,0.85)',
  mountainFar: '#7d8fb0',
  mountainNear: '#5a6d8f',
  ground: '#5d8a4a',
  groundDark: '#4c7a3e',
  fieldA: '#6da055',
  fieldB: '#87b364',
  fieldC: '#c2a95e',
  gridLine: 'rgba(255,255,255,0.18)',
  runway: '#3c3f46',
  runwayMark: '#f5f5f0',
  ring: '#ffd23e',
  ringGlow: 'rgba(255,210,62,0.35)',
  ringHit: '#7dff8a',
  planeBody: '#e8eef4',
  planeWing: '#d2453c',
  planeTrim: '#2b3a55',
  prop: 'rgba(40,50,70,0.35)',
  panel: 'rgba(10,18,32,0.72)',
  panelEdge: 'rgba(255,255,255,0.22)',
  text: '#eef1f5',
  muted: '#aeb9c9',
  warn: '#ff5d4d',
  good: '#7dff8a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
