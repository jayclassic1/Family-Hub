// Procedural sound effects for chess gameplay — synthesized live, no
// external audio files.

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

function tone(ctx, { freq, start, duration, type = "sine", startGain = 0.16 }) {
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
  select: (ctx, t) => {
    tone(ctx, { freq: 700, start: t, duration: 0.05, type: "sine", startGain: 0.1 });
  },
  move: (ctx, t) => {
    tone(ctx, { freq: 340, start: t, duration: 0.09, type: "triangle", startGain: 0.14 });
  },
  capture: (ctx, t) => {
    tone(ctx, { freq: 220, start: t, duration: 0.12, type: "sawtooth", startGain: 0.16 });
    tone(ctx, { freq: 150, start: t + 0.06, duration: 0.14, type: "sawtooth", startGain: 0.14 });
  },
  check: (ctx, t) => {
    [660, 880].forEach((f, i) => {
      tone(ctx, { freq: f, start: t + i * 0.08, duration: 0.14, type: "square", startGain: 0.14 });
    });
  },
  checkmate: (ctx, t) => {
    [523, 440, 349, 262].forEach((f, i) => {
      tone(ctx, { freq: f, start: t + i * 0.12, duration: 0.3, type: "sawtooth", startGain: 0.16 });
    });
  },
  win: (ctx, t) => {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(ctx, { freq: f, start: t + i * 0.1, duration: 0.28, type: "triangle", startGain: 0.16 });
    });
  },
  draw: (ctx, t) => {
    [440, 440].forEach((f, i) => {
      tone(ctx, { freq: f, start: t + i * 0.22, duration: 0.2, type: "sine", startGain: 0.13 });
    });
  },
};

// Each piece type has its own characteristic "voice" (pitch + timbre).
// A capture plays the attacker's voice as a quick swing, then the
// victim's voice — pitched down and scaled by their value — as the
// impact, so every attacker/victim combination sounds distinct.
const PIECE_VOICE = {
  p: { freq: 720, type: "sine" },
  n: { freq: 520, type: "triangle" },
  b: { freq: 640, type: "sine" },
  r: { freq: 300, type: "square" },
  q: { freq: 460, type: "sawtooth" },
  k: { freq: 240, type: "square" },
};

const PIECE_WEIGHT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 4 };

export function playChessCaptureSound(attackerType, victimType) {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const a = PIECE_VOICE[attackerType] || PIECE_VOICE.p;
    const v = PIECE_VOICE[victimType] || PIECE_VOICE.p;
    const weight = PIECE_WEIGHT[victimType] || 1;

    // Swing — the attacking piece's voice, quick and light.
    tone(ctx, { freq: a.freq, start: t, duration: 0.08, type: a.type, startGain: 0.12 });

    // Impact — the captured piece's voice, pitched down, heavier and
    // louder the more valuable the piece was.
    const impactFreq = v.freq * 0.55;
    const impactDuration = 0.12 + weight * 0.025;
    const impactGain = Math.min(0.12 + weight * 0.012, 0.22);
    tone(ctx, { freq: impactFreq, start: t + 0.07, duration: impactDuration, type: v.type, startGain: impactGain });

    // Extra low flourish when a heavyweight (rook/queen) falls.
    if (weight >= 5) {
      tone(ctx, { freq: impactFreq * 0.6, start: t + 0.12, duration: impactDuration * 0.8, type: "sawtooth", startGain: 0.1 });
    }
  } catch (e) {
    // Audio isn't critical — fail silently if the browser blocks it.
  }
}

export function playChessSound(name) {
  try {
    const ctx = getCtx();
    const fn = SOUNDS[name];
    if (fn) fn(ctx, ctx.currentTime);
  } catch (e) {
    // Audio isn't critical — fail silently if the browser blocks it.
  }
}
