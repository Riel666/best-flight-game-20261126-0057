// All canvas drawing: sky, sun, clouds, mountain ridges, the perspective ground with its
// patchwork fields and runway, the rings ahead, the courier plane itself, and the HUD with
// its instruments. The world is projected with a simple perspective: objects ahead shrink
// with distance, so a ring 260 units out looks close and one 1,400 out is a speck.
import { COURSE, FIELD, LIVES, PALETTE, RING, STARS } from './config.js';
import { createRandom } from './random.js';
import { starsFor, terrainHeight } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_DONE = 4;

const TAU = Math.PI * 2;

function makeClouds(random) {
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    clouds.push({
      x: random() * 1600 - 160,
      y: 40 + random() * 190,
      w: 90 + random() * 150,
      h: 18 + random() * 22,
      drift: 4 + random() * 9,
      par: 0.15 + random() * 0.35,
    });
  }
  return clouds;
}

function makeBillboards(random) {
  // Trees and barns scattered beside the course, at fixed world z slots.
  const items = [];
  for (let z = 300; z < COURSE.length; z += 90) {
    const side = random() < 0.5 ? -1 : 1;
    items.push({
      z: z + random() * 60,
      x: side * (75 + random() * 90),
      kind: random() < 0.7 ? 'tree' : 'barn',
      s: 0.8 + random() * 0.7,
    });
  }
  return items;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const random = createRandom(20261126);
  const clouds = makeClouds(random);
  const billboards = makeBillboards(random);
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }
  fit();
  window.addEventListener('resize', fit);

  function horizonY(s) {
    // Higher altitude pushes the horizon down the screen; pitching down lifts it.
    return Math.max(170, Math.min(470, 300 + (210 - s.y) * 0.32 - s.pitch * 55));
  }

  function drawSky(s, time) {
    const hy = horizonY(s);
    const g = ctx.createLinearGradient(0, 0, 0, hy + 40);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, hy + 40);
    // Sun, upper right, with a soft halo.
    const sunX = 1060 - s.x * 0.4;
    const sunY = 92;
    const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    halo.addColorStop(0, PALETTE.sunCore);
    halo.addColorStop(0.35, PALETTE.sun);
    halo.addColorStop(1, 'rgba(255,243,196,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 90, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, TAU);
    ctx.fill();
    // Clouds drift slowly and slide sideways with the plane.
    for (const c of clouds) {
      const cx = (((c.x + time * c.drift - s.x * c.par * 40) % 1600) + 1600) % 1600 - 160;
      ctx.fillStyle = PALETTE.cloud;
      ctx.beginPath();
      ctx.ellipse(cx, c.y, c.w / 2, c.h / 2, 0, 0, TAU);
      ctx.ellipse(cx + c.w * 0.28, c.y + 4, c.w / 3, c.h / 2.4, 0, 0, TAU);
      ctx.ellipse(cx - c.w * 0.3, c.y + 5, c.w / 3.4, c.h / 2.6, 0, 0, TAU);
      ctx.fill();
    }
    // Two mountain ridges on the horizon, parallaxed by lateral position.
    for (const [color, amp, base, par] of [
      [PALETTE.mountainFar, 46, hy - 6, 0.12],
      [PALETTE.mountainNear, 30, hy + 2, 0.3],
    ]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, hy + 4);
      for (let x = 0; x <= FIELD.width; x += 16) {
        const wx = x + s.x * par * 60 + s.z * 0.02;
        const y = base - amp * (0.55 + 0.45 * Math.sin(wx * 0.008 + (par > 0.2 ? 2 : 0))) * (0.6 + 0.4 * Math.sin(wx * 0.021 + 1));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(FIELD.width, hy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGround(s) {
    const hy = horizonY(s);
    const g = ctx.createLinearGradient(0, hy, 0, FIELD.height);
    g.addColorStop(0, PALETTE.ground);
    g.addColorStop(1, PALETTE.groundDark);
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, FIELD.width, FIELD.height - hy);
    const vpx = FIELD.width / 2 - s.bank * 3;
    // Patchwork fields: horizontal bands that stream toward the viewer.
    const bandDepth = 120;
    for (let i = 0; i < 10; i += 1) {
      const z0 = Math.floor(s.z / bandDepth) * bandDepth + i * bandDepth;
      const dz = z0 - s.z;
      if (dz < 0 || dz > COURSE.viewDistance) continue;
      const p0 = 700 / (dz + 60);
      const p1 = 700 / (dz + bandDepth + 60);
      const y0 = hy + (FIELD.height - hy) * (1 - p0 / 2.2);
      const y1 = hy + (FIELD.height - hy) * (1 - p1 / 2.2);
      if (y1 <= y0) continue;
      ctx.fillStyle = i % 3 === 0 ? PALETTE.fieldA : i % 3 === 1 ? PALETTE.fieldB : PALETTE.fieldC;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y0, FIELD.width, Math.max(1, y1 - y0));
      ctx.globalAlpha = 1;
    }
    // Converging grid lines, streaming with distance.
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(vpx + i * 26, hy);
      ctx.lineTo(vpx + i * 210, FIELD.height);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i += 1) {
      const dz = ((i * 120 + s.z * 1) % 1440);
      const p = 700 / (dz + 60);
      const y = hy + (FIELD.height - hy) * (1 - Math.min(1, p / 2.2));
      ctx.globalAlpha = 0.12 + 0.25 * (1 - dz / 1440);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Billboards: trees and barns beside the course, projected by depth.
    for (const b of billboards) {
      const dz = b.z - s.z;
      if (dz < 20 || dz > COURSE.viewDistance) continue;
      const p = 700 / (dz + 60);
      const sx = FIELD.width / 2 + (b.x - s.x) * p * 2.2;
      const sy = hy + (FIELD.height - hy) * (1 - Math.min(1, p / 2.2));
      const h = 34 * p * b.s;
      if (h < 2 || sx < -40 || sx > FIELD.width + 40) continue;
      if (b.kind === 'tree') {
        ctx.fillStyle = '#2f6b2f';
        ctx.beginPath();
        ctx.moveTo(sx, sy - h);
        ctx.lineTo(sx - h * 0.42, sy);
        ctx.lineTo(sx + h * 0.42, sy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6b4a2f';
        ctx.fillRect(sx - h * 0.06, sy - h * 0.12, h * 0.12, h * 0.12);
      } else {
        ctx.fillStyle = '#8a4a3a';
        ctx.fillRect(sx - h * 0.5, sy - h * 0.62, h, h * 0.62);
        ctx.fillStyle = '#5d3226';
        ctx.beginPath();
        ctx.moveTo(sx - h * 0.55, sy - h * 0.62);
        ctx.lineTo(sx, sy - h * 0.95);
        ctx.lineTo(sx + h * 0.55, sy - h * 0.62);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Runway at the far end of the course.
    if (s.z > COURSE.length - 700 && s.z < COURSE.length) drawRunway(s, hy, COURSE.length - s.z, false);
    if (s.z < 150) drawRunway(s, hy, 0 - s.z, true);
  }

  function drawRunway(s, hy, dz, behind) {
    // Clamp the projection: right over the threshold the strip fills the view, it never explodes.
    const p = Math.min(700 / (Math.max(0, dz) + 60), 2.2);
    const halfW = 26 * p * 2.2;
    const cx = FIELD.width / 2 - s.x * p * 2.2;
    const yTop = hy + (FIELD.height - hy) * (1 - Math.min(1, p / 2.2));
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(cx - halfW * 0.35, yTop);
    ctx.lineTo(cx + halfW * 0.35, yTop);
    ctx.lineTo(cx + halfW, FIELD.height);
    ctx.lineTo(cx - halfW, FIELD.height);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    ctx.fillStyle = PALETTE.runwayMark;
    for (let i = 0; i < 6; i += 1) {
      const t = i / 6;
      const y = yTop + (FIELD.height - yTop) * t;
      const w = halfW * (0.06 + t * 0.1);
      ctx.fillRect(cx - w / 2, y, w, Math.max(2, (FIELD.height - yTop) * 0.045));
    }
    ctx.font = 'bold 15px ' + 'system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.runwayMark;
    ctx.fillText(behind ? 'MERIDIAN FIELD' : 'RUNWAY 27', cx, Math.min(FIELD.height - 14, yTop + 26));
    ctx.textAlign = 'left';
  }

  function drawRings(s) {
    const ahead = s.rings.filter((r) => r.z > s.z && r.z - s.z < COURSE.viewDistance);
    ahead.sort((a, b) => b.z - a.z);
    for (const ring of ahead) {
      const dz = ring.z - s.z;
      const p = 700 / (dz + 60);
      const sx = FIELD.width / 2 + (ring.x - s.x) * p * 2.2;
      const sy = horizonY(s) - (ring.y - s.y) * p * 1.05;
      const r = RING.radius * p * 2.2;
      if (r < 2 || sx < -80 || sx > FIELD.width + 80 || sy < -60 || sy > FIELD.height + 60) continue;
      const passed = ring.passed;
      const col = passed ? (ring.result === 'hit' ? PALETTE.ringHit : 'rgba(160,170,185,0.7)') : PALETTE.ring;
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.strokeStyle = passed ? col : PALETTE.ringGlow;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.25, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = Math.max(2, r * 0.2);
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.stroke();
      if (!passed) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${Math.max(10, r * 0.34)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('◉', sx, sy + r * 0.12);
        ctx.textAlign = 'left';
      }
    }
  }

  function drawPlane(s, time) {
    const cx = FIELD.width / 2;
    const cy = 520 - s.pitch * 18;
    const ground = terrainHeight(null, s.z);
    const clearance = Math.max(0, s.y - ground);
    const shScale = Math.max(0.25, 1 - clearance / 500);
    ctx.save();
    ctx.globalAlpha = 0.25 * shScale;
    ctx.fillStyle = '#0c1a12';
    ctx.beginPath();
    ctx.ellipse(cx, 648, 62 * shScale, 10 * shScale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((s.bank * Math.PI) / 180);
    // Tail fin.
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-6, 52);
    ctx.lineTo(0, 78);
    ctx.lineTo(6, 52);
    ctx.closePath();
    ctx.fill();
    // Wings.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-14, 18);
    ctx.lineTo(-96, 44);
    ctx.lineTo(-96, 56);
    ctx.lineTo(-14, 34);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 18);
    ctx.lineTo(96, 44);
    ctx.lineTo(96, 56);
    ctx.lineTo(14, 34);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    const bodyGrad = ctx.createLinearGradient(0, -62, 0, 62);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(1, PALETTE.planeBody);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -66);
    ctx.quadraticCurveTo(15, -30, 13, 22);
    ctx.quadraticCurveTo(11, 58, 0, 64);
    ctx.quadraticCurveTo(-11, 58, -13, 22);
    ctx.quadraticCurveTo(-15, -30, 0, -66);
    ctx.fill();
    // Cockpit windows.
    ctx.fillStyle = '#9fd8ef';
    ctx.beginPath();
    ctx.ellipse(0, -38, 8, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-3, -42, 3, 6, 0.3, 0, TAU);
    ctx.fill();
    // Cheatline stripe.
    ctx.strokeStyle = PALETTE.planeWing;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.quadraticCurveTo(0, 10, 12, 6);
    ctx.stroke();
    // Spinning propeller disc at the nose.
    const propA = time * 0.9;
    ctx.fillStyle = PALETTE.prop;
    ctx.save();
    ctx.translate(0, -64);
    ctx.rotate(propA);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 26, 0, 0, TAU);
    ctx.fill();
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 26, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2b3a55';
    ctx.beginPath();
    ctx.arc(0, -64, 5, 0, TAU);
    ctx.fill();
    // Navigation lights, blinking.
    const blink = Math.sin(time * 6) > 0;
    ctx.fillStyle = blink ? '#ff4d4d' : 'rgba(255,77,77,0.35)';
    ctx.beginPath();
    ctx.arc(-96, 50, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = blink ? '#37e07a' : 'rgba(55,224,122,0.35)';
    ctx.beginPath();
    ctx.arc(96, 50, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Invulnerability shimmer after a crash.
    if (s.invulnerable > 0 && Math.floor(time * 8) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, 92, 0, TAU);
      ctx.fill();
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  function drawHud(s, best) {
    ctx.font = '13px ' + 'system-ui, sans-serif';
    // Top-left instruments.
    panel(16, 14, 300, 92);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('ALT', 30, 36);
    ctx.fillText('SPD', 30, 60);
    ctx.fillText('HDG', 30, 84);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + 'system-ui, sans-serif';
    ctx.fillText(`${Math.round(s.y)} ft`, 78, 38);
    ctx.fillText(`${Math.round(s.speed)} kt`, 78, 62);
    ctx.fillText(`${String(Math.round(s.heading)).padStart(3, '0')}°`, 78, 86);
    // Throttle bar.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + 'system-ui, sans-serif';
    ctx.fillText('THR', 196, 36);
    ctx.fillStyle = '#22304a';
    ctx.fillRect(196, 44, 104, 10);
    ctx.fillStyle = s.throttle > 85 ? PALETTE.warn : PALETTE.good;
    ctx.fillRect(196, 44, 104 * (s.throttle / 100), 10);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${Math.round(s.throttle)}%`, 196, 72);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BANK ${s.bank >= 0 ? '+' : ''}${Math.round(s.bank)}°`, 196, 92);
    // Top-right score.
    panel(FIELD.width - 316, 14, 300, 92);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + 'system-ui, sans-serif';
    ctx.fillText('SCORE', FIELD.width - 302, 36);
    ctx.fillText('TIME', FIELD.width - 302, 60);
    ctx.fillText('RINGS', FIELD.width - 302, 84);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + 'system-ui, sans-serif';
    ctx.fillText(String(s.score), FIELD.width - 226, 38);
    const mins = Math.floor(Math.max(0, s.timeLeft) / 60);
    const secs = Math.floor(Math.max(0, s.timeLeft) % 60);
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`, FIELD.width - 226, 62);
    const done = s.ringsHit + s.ringsNear + s.ringsMissed;
    ctx.fillText(`${s.ringsHit} / ${s.rings.length}`, FIELD.width - 226, 86);
    // Combo badge.
    if (s.combo > 1) {
      ctx.fillStyle = PALETTE.ring;
      ctx.font = 'bold 18px ' + 'system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${s.combo}`, FIELD.width / 2, 44);
      ctx.textAlign = 'left';
    }
    // Centre message.
    if (s.messageT > 0) {
      ctx.globalAlpha = Math.min(1, s.messageT);
      ctx.font = 'bold 30px ' + 'system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = s.message.includes('STRIKE') ? PALETTE.warn : PALETTE.text;
      ctx.fillText(s.message, FIELD.width / 2, 150);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    // PULL UP warning.
    if (s.warn) {
      const on = Math.floor(performance.now() / 250) % 2 === 0;
      if (on) {
        ctx.font = 'bold 34px ' + 'system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.warn;
        ctx.fillText('▲ PULL UP ▲', FIELD.width / 2, 200);
        ctx.textAlign = 'left';
      }
    }
    // Artificial horizon, bottom-left.
    const ax = 66;
    const ay = FIELD.height - 66;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 42, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#7db3d9';
    ctx.fillRect(ax - 42, ay - 42, 84, 42);
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(ax - 42, ay, 84, 42);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate((s.bank * Math.PI) / 180);
    ctx.translate(0, s.pitch * 12);
    ctx.fillStyle = '#7db3d9';
    ctx.fillRect(-46, -46, 92, 46);
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(-46, 0, 92, 46);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-46, 0);
    ctx.lineTo(46, 0);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 42, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax - 16, ay);
    ctx.lineTo(ax + 16, ay);
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, ay + 6);
    ctx.stroke();
    // Lives, bottom-left next to the gauge.
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px ' + 'system-ui, sans-serif';
    ctx.fillText('♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(Math.max(0, LIVES - s.lives)), 126, FIELD.height - 58);
    // Progress bar to the runway, bottom-right.
    const pw = 260;
    const px = FIELD.width - pw - 16;
    const py = FIELD.height - 44;
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, 22, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.ring;
    ctx.beginPath();
    ctx.roundRect(px + 3, py + 3, (pw - 6) * Math.min(1, s.z / COURSE.length), 16, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '13px ' + 'system-ui, sans-serif';
    ctx.fillText(`RUNWAY ${Math.max(0, Math.round((COURSE.length - s.z) / 100) / 10)} km`, px, py - 6);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`BEST ${best}`, px, py - 24);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8,14,26,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const h = 118 + lines.length * 34;
    const y = Math.max(60, (FIELD.height - h) / 2);
    panel(FIELD.width / 2 - 330, y, 660, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || PALETTE.text;
    ctx.font = 'bold 44px ' + 'system-ui, sans-serif';
    ctx.fillText(title, FIELD.width / 2, y + 68);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '19px ' + 'system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, y + 118 + i * 34));
    ctx.textAlign = 'left';
  }

  function drawTitle(s, best) {
    overlay('MERIDIAN RUN', [
      'Sky Courier — fly the dawn mail run through every ring,',
      'mind the hills, and bring her home to Runway 27.',
      '',
      '← → / A D steer    ↑ ↓ / W S climb & descend',
      'Shift throttle up    Ctrl throttle down    drag to steer',
      'P pause    M sound    R restart',
      best > 0 ? `Best score: ${best}` : 'First flight: the rings are your road.',
      '',
      'Press Space or click to take off',
    ]);
  }

  function drawOver(s, best, done) {
    const stars = starsFor(s.score, STARS);
    overlay(
      done ? 'COURSE COMPLETE' : 'FLIGHT OVER',
      [
        `Score ${s.score}   •   Rings ${s.ringsHit} clean, ${s.ringsNear} near, ${s.ringsMissed} missed`,
        `Best combo x${s.bestCombo}   •   Distance ${Math.round(s.distance)}   •   ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
        best > 0 ? `Best score: ${best}` : '',
        '',
        'Press Space or click to fly again',
      ],
      done ? PALETTE.good : PALETTE.warn,
    );
  }

  return {
    draw(state, screen, best, time) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      drawSky(state, time);
      drawGround(state);
      drawRings(state);
      drawPlane(state, time);
      if (screen === SCREEN_TITLE) {
        drawHud(state, best);
        drawTitle(state, best);
      } else if (screen === SCREEN_PLAY) {
        drawHud(state, best);
      } else if (screen === SCREEN_PAUSED) {
        drawHud(state, best);
        overlay('PAUSED', ['Press P or Space to keep flying', '', 'M sound    R restart']);
      } else if (screen === SCREEN_OVER || screen === SCREEN_DONE) {
        drawHud(state, best);
        drawOver(state, best, screen === SCREEN_DONE);
      }
    },
  };
}
