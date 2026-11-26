// Synthesized sound only: an engine drone tied to throttle, wind tied to speed, a chime for
// rings and a thud for terrain strikes. No audio files, no network. Starts on the first user
// gesture (browsers block audio before that) and stays silent until then.
export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 70;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engine.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engine.start();
      // Wind: looped noise through a band-pass filter.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      wind = ctx.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      wind.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, when, dur, type, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  return {
    /** Call from a user gesture (start button / keypress) so audio may begin. */
    unlock() {
      ensure();
    },
    /** Continuous engine + wind levels, called every frame while flying. */
    update(throttle, speed) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engine.frequency.setTargetAtTime(55 + throttle * 1.1, t, 0.1);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + (throttle / 100) * 0.05, t, 0.1);
      windFilter.frequency.setTargetAtTime(300 + speed * 3, t, 0.1);
      windGain.gain.setTargetAtTime(0.02 + (speed / 230) * 0.06, t, 0.15);
    },
    ring(combo) {
      if (!ensure() || muted) return;
      const base = 660 + Math.min(combo, 5) * 60;
      const t = ctx.currentTime;
      tone(base, t, 0.25, 'sine', 0.18);
      tone(base * 1.5, t + 0.08, 0.3, 'sine', 0.14);
    },
    near() {
      if (!ensure() || muted) return;
      tone(520, ctx.currentTime, 0.15, 'sine', 0.1);
    },
    crash() {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      tone(70, t, 0.4, 'sine', 0.3);
      tone(45, t + 0.05, 0.5, 'triangle', 0.25);
    },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        const t = ctx.currentTime;
        if (engineGain) engineGain.gain.setTargetAtTime(0, t, 0.05);
        if (windGain) windGain.gain.setTargetAtTime(0, t, 0.05);
      }
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
