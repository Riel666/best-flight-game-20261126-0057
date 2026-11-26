// Pure flight logic: no DOM, no canvas, so Node can smoke-test it directly.
// The plane flies along +z. x is lateral (0 = course centre), y is altitude in feet.
// Terrain height is a smooth seeded function of z; rings hang on a smooth path.
import { COURSE, LIVES, PLANE, RING, STEP } from './config.js';

export const EVENT_RING = 1;
export const EVENT_NEAR = 2;
export const EVENT_MISS = 4;
export const EVENT_HIT = 8;
export const EVENT_OVER = 16;
export const EVENT_DONE = 32;

/** Terrain height in feet at distance z, from seeded sine bumps. Flat near both runways. */
export function terrainHeight(random, z) {
  if (z < 250 || z > COURSE.length - 250) return 0;
  const t = (z - 250) / (COURSE.length - 500);
  // Ease the hills in and out so the runway ends stay flat.
  const env = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
  const a = 62 * Math.sin(z * 0.0016 + 1.7) + 45 * Math.sin(z * 0.0041 + 0.4) + 26 * Math.sin(z * 0.0093 + 2.9);
  return Math.max(0, a * env + 18 * env);
}

/** The ring path: a smooth lateral/altitude wander the pilot is meant to follow. */
export function ringPath(random, z) {
  return {
    x: 34 * Math.sin(z * 0.0011 + 0.6) + 14 * Math.sin(z * 0.0029 + 2.1),
    y: 175 + 85 * Math.sin(z * 0.0009 + 2.4) + 30 * Math.sin(z * 0.0023 + 0.8),
  };
}

function makeRings(random) {
  const rings = [];
  for (let z = RING.firstAt; z < COURSE.length - 350; z += RING.spacing) {
    const p = ringPath(random, z);
    rings.push({ z, x: p.x, y: Math.max(70, Math.min(360, p.y)), passed: false, result: null });
  }
  return rings;
}

export function createWorld(random) {
  const world = {
    state: null,
    reset() {
      this.state = {
        z: 0,
        x: 0,
        y: 150,
        bank: 0,
        pitch: 0,
        throttle: 65,
        speed: 140,
        heading: 90,
        score: 0,
        combo: 0,
        bestCombo: 0,
        ringsHit: 0,
        ringsNear: 0,
        ringsMissed: 0,
        lives: LIVES,
        timeLeft: COURSE.timeLimit,
        distance: 0,
        crashed: false,
        invulnerable: 0,
        finished: false,
        rings: makeRings(random),
        nextRing: 0,
        message: '',
        messageT: 0,
        warn: false,
        elapsed: 0,
      };
    },
    /** Advance the world one fixed step. steer: -1..1 lateral, pitch: -1..1 (1 = climb),
     *  throttleDelta: -1..1, idle: title-screen drift (no rings, no crashes). Returns events. */
    step(dt, steer, pitch, throttleDelta, idle) {
      const s = this.state;
      let events = 0;
      s.elapsed += dt;
      if (s.messageT > 0) s.messageT -= dt;
      if (s.invulnerable > 0) s.invulnerable -= dt;

      // Throttle and speed: speed chases the throttle's target.
      s.throttle = Math.max(0, Math.min(100, s.throttle + throttleDelta * PLANE.throttleRate * dt));
      const targetSpeed = COURSE.minSpeed + (COURSE.maxSpeed - COURSE.minSpeed) * (s.throttle / 100);
      s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 0.8);

      // Bank follows steering; heading drifts with the bank.
      const targetBank = steer * PLANE.maxBank;
      s.bank += (targetBank - s.bank) * Math.min(1, dt * 6);
      s.heading = (s.heading + s.bank * 0.12 * dt * 10 + 360) % 360;
      s.x = Math.max(-COURSE.halfWidth, Math.min(COURSE.halfWidth, s.x + (s.bank / PLANE.maxBank) * PLANE.lateralSpeed * dt));
      // Pitch follows the stick; climb rate also rises a little with speed.
      const targetPitch = pitch * 1;
      s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 5);
      s.y = Math.max(COURSE.minAlt, Math.min(COURSE.maxAlt, s.y + s.pitch * PLANE.climbRate * dt));

      if (!idle) {
        // A finished or failed run stays put: no more bonus, no negative clock.
        if (s.finished || s.lives <= 0) return 0;
        // Forward motion: speed in knots maps to course units per second.
        const dz = s.speed * 0.55 * dt;
        s.z += dz;
        s.distance += dz;
        s.timeLeft -= dt;

        // Rings: judge each one the plane flies past.
        while (s.nextRing < s.rings.length && s.rings[s.nextRing].z <= s.z) {
          const ring = s.rings[s.nextRing];
          s.nextRing += 1;
          const dx = s.x - ring.x;
          const dy = s.y - ring.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          ring.passed = true;
          if (d <= RING.radius) {
            s.combo = Math.min(RING.maxCombo, s.combo + 1);
            s.bestCombo = Math.max(s.bestCombo, s.combo);
            const pts = RING.points * s.combo;
            s.score += pts;
            s.ringsHit += 1;
            ring.result = 'hit';
            s.message = `RING +${pts}${s.combo > 1 ? `  x${s.combo} COMBO` : ''}`;
            s.messageT = 1.4;
            events |= EVENT_RING;
          } else if (d <= RING.radius * 1.8) {
            s.score += RING.nearPoints;
            s.ringsNear += 1;
            ring.result = 'near';
            s.message = `NEAR MISS +${RING.nearPoints}`;
            s.messageT = 1.0;
            events |= EVENT_NEAR;
          } else {
            s.combo = 0;
            s.ringsMissed += 1;
            ring.result = 'miss';
            s.message = 'RING MISSED';
            s.messageT = 1.0;
            events |= EVENT_MISS;
          }
        }

        // Terrain: crash when the belly touches the hills.
        const ground = terrainHeight(random, s.z);
        s.warn = s.y - ground < PLANE.warnClearance && s.invulnerable <= 0;
        if (s.y <= ground + 6 && s.invulnerable <= 0) {
          s.lives -= 1;
          s.combo = 0;
          s.crashed = true;
          s.invulnerable = PLANE.invulnerable;
          s.message = 'TERRAIN STRIKE!';
          s.messageT = 1.6;
          events |= EVENT_HIT;
          // Bounce back up to a safe altitude instead of ending the flight outright.
          s.y = Math.max(s.y, ground + 120);
          s.x = 0;
          s.bank = 0;
          if (s.lives <= 0) {
            events |= EVENT_OVER;
            return events;
          }
        }

        // The runway: crossing the far threshold ends the run with a landing bonus.
        if (s.z >= COURSE.length) {
          s.finished = true;
          const bonus = 250 + s.lives * 150;
          s.score += bonus;
          s.message = `COURSE COMPLETE  +${bonus} LANDING BONUS`;
          s.messageT = 3;
          events |= EVENT_DONE;
          return events;
        }
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          events |= EVENT_OVER;
          return events;
        }
      } else {
        // Title screen: gentle drift so the backdrop lives.
        s.z += s.speed * 0.4 * dt;
        if (s.z > 800) s.z = 0;
        s.y = 150 + 12 * Math.sin(s.elapsed * 0.5);
        s.bank = 6 * Math.sin(s.elapsed * 0.4);
      }
      return events;
    },
  };
  world.reset();
  return world;
}

/** Stars earned for a final score. */
export function starsFor(score, thresholds) {
  let stars = 0;
  for (const t of thresholds) if (score >= t) stars += 1;
  return stars;
}
