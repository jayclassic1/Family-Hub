// Procedural sound effects for poker actions — no external audio files,
// everything is synthesized with the Web Audio API.

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

function tone(ctx, { freq, start, duration, type = "sine", startGain = 0.18, endGain = 0.0001 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(startGain, start);
  gain.gain.exponentialRampToValueAtTime(endGain, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function sweep(ctx, { fromFreq, toFreq, start, duration, type = "sine", startGain = 0.18 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromFreq, start);
  osc.frequency.exponentialRampToValueAtTime(toFreq, start + duration);
  gain.gain.setValueAtTime(startGain, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

const SOUNDS = {
  check: (ctx, t) => {
    tone(ctx, { freq: 520, start: t, duration: 0.09, type: "sine", startGain: 0.14 });
  },
  call: (ctx, t) => {
    tone(ctx, { freq: 460, start: t, duration: 0.12, type: "triangle", startGain: 0.16 });
  },
  raise: (ctx, t) => {
    tone(ctx, { freq: 440, start: t, duration: 0.1, type: "square", startGain: 0.14 });
    tone(ctx, { freq: 660, start: t + 0.09, duration: 0.14, type: "square", startGain: 0.14 });
  },
  fold: (ctx, t) => {
    sweep(ctx, { fromFreq: 380, toFreq: 140, start: t, duration: 0.35, type: "sawtooth", startGain: 0.12 });
  },
  allIn: (ctx, t) => {
    [440, 550, 660, 880].forEach((f, i) => {
      tone(ctx, { freq: f, start: t + i * 0.06, duration: 0.28, type: "sawtooth", startGain: 0.16 });
    });
  },
  flop: (ctx, t) => {
    [0, 0.1, 0.2].forEach((offset) => {
      tone(ctx, { freq: 900, start: t + offset, duration: 0.05, type: "square", startGain: 0.1 });
    });
  },
  turn: (ctx, t) => {
    tone(ctx, { freq: 900, start: t, duration: 0.06, type: "square", startGain: 0.12 });
  },
  river: (ctx, t) => {
    tone(ctx, { freq: 750, start: t, duration: 0.07, type: "square", startGain: 0.12 });
  },
  newHand: (ctx, t) => {
    [523, 659, 784].forEach((f, i) => {
      tone(ctx, { freq: f, start: t + i * 0.09, duration: 0.22, type: "triangle", startGain: 0.15 });
    });
  },
  endOfHand: (ctx, t) => {
    [784, 659, 523].forEach((f, i) => {
      tone(ctx, { freq: f, start: t + i * 0.1, duration: 0.3, type: "triangle", startGain: 0.15 });
    });
  },
};

export function playPokerSound(name) {
  try {
    const ctx = getCtx();
    const fn = SOUNDS[name];
    if (fn) fn(ctx, ctx.currentTime);
  } catch (e) {
    // Audio isn't critical — fail silently if the browser blocks it.
  }
}
