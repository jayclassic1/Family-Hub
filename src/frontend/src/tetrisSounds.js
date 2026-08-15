// Procedural sound effects for Tetris — synthesized live, no external
// audio files.

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function tone(ctx, { freq, start, duration, type = "sine", startGain = 0.14 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(startGain, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

const SOUNDS = {
  move: (ctx, t) => {
    tone(ctx, { freq: 300, start: t, duration: 0.04, type: "square", startGain: 0.06 });
  },
  rotate: (ctx, t) => {
    tone(ctx, { freq: 480, start: t, duration: 0.06, type: "triangle", startGain: 0.09 });
  },
  softDrop: (ctx, t) => {
    tone(ctx, { freq: 200, start: t, duration: 0.03, type: "square", startGain: 0.05 });
  },
  hardDrop: (ctx, t) => {
    tone(ctx, { freq: 140, start: t, duration: 0.1, type: "sawtooth", startGain: 0.16 });
  },
  lock: (ctx, t) => {
    tone(ctx, { freq: 220, start: t, duration: 0.08, type: "square", startGain: 0.1 });
  },
  hold: (ctx, t) => {
    tone(ctx, { freq: 600, start: t, duration: 0.07, type: "sine", startGain: 0.1 });
  },
  lineClear1: (ctx, t) => {
    tone(ctx, { freq: 523, start: t, duration: 0.15, type: "sine", startGain: 0.14 });
  },
  lineClear2: (ctx, t) => {
    [523, 659].forEach((f, i) => tone(ctx, { freq: f, start: t + i * 0.07, duration: 0.16, type: "sine", startGain: 0.14 }));
  },
  lineClear3: (ctx, t) => {
    [523, 659, 784].forEach((f, i) => tone(ctx, { freq: f, start: t + i * 0.07, duration: 0.18, type: "triangle", startGain: 0.15 }));
  },
  tetris: (ctx, t) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, { freq: f, start: t + i * 0.08, duration: 0.24, type: "triangle", startGain: 0.17 }));
  },
  levelUp: (ctx, t) => {
    [392, 523, 659, 784].forEach((f, i) => tone(ctx, { freq: f, start: t + i * 0.09, duration: 0.2, type: "sawtooth", startGain: 0.14 }));
  },
  gameOver: (ctx, t) => {
    [440, 370, 311, 220].forEach((f, i) => tone(ctx, { freq: f, start: t + i * 0.14, duration: 0.32, type: "sawtooth", startGain: 0.15 }));
  },
};

export function playTetrisSound(name) {
  try {
    const ctx = getCtx();
    const fn = SOUNDS[name];
    if (fn) fn(ctx, ctx.currentTime);
  } catch (e) {
    // Audio isn't critical — fail silently if the browser blocks it.
  }
}

export function lineClearSound(count) {
  if (count === 1) return "lineClear1";
  if (count === 2) return "lineClear2";
  if (count === 3) return "lineClear3";
  if (count >= 4) return "tetris";
  return null;
}
