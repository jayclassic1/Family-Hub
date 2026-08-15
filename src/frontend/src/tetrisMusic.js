// A looping lo-fi, slowed-down rendition of "Korobeiniki" — the
// traditional 19th-century Russian folk melody long associated with
// Tetris. The melody itself is centuries old and in the public domain;
// this is an original procedural synthesis of it (soft detuned triangle
// tones through a lowpass filter, with a warm sub-octave bass layer),
// not a reproduction of any copyrighted arrangement or recording.

const NOTE_FREQ = {
  A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
  F5: 698.46, G5: 783.99, A5: 880.0, E4: 329.63,
};

// [note, duration in beats]. null note = rest.
const MELODY = [
  ["E5", 1], ["B4", 0.5], ["C5", 0.5], ["D5", 1], ["C5", 0.5], ["B4", 0.5],
  ["A4", 1], ["A4", 0.5], ["C5", 0.5], ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1.5], ["C5", 0.5], ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1], ["A4", 1], [null, 1],
  ["D5", 1.5], ["F5", 0.5], ["A5", 1], ["G5", 0.5], ["F5", 0.5],
  ["E5", 1.5], ["C5", 0.5], ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1], ["B4", 0.5], ["C5", 0.5], ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1], ["A4", 1], [null, 1],
];

// Much slower than a straight chiptune tempo — a relaxed, lo-fi pace.
const BEAT_SECONDS = 0.42;

let musicCtx = null;
let gainNode = null;
let filterNode = null;
let scheduledUntil = 0;
let schedulerTimer = null;
let playing = false;

function getMusicCtx() {
  if (!musicCtx) {
    musicCtx = new (window.AudioContext || window.webkitAudioContext)();
    filterNode = musicCtx.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.value = 1400;
    filterNode.Q.value = 0.6;
    gainNode = musicCtx.createGain();
    gainNode.gain.value = 0.1;
    filterNode.connect(gainNode);
    gainNode.connect(musicCtx.destination);
  }
  if (musicCtx.state === "suspended") {
    musicCtx.resume();
  }
  return musicCtx;
}

function scheduleNote(ctx, freq, start, duration) {
  if (!freq) return;

  // Two gently detuned soft-wave oscillators for warmth/chorus.
  const noteGain = ctx.createGain();
  noteGain.connect(filterNode);
  noteGain.gain.setValueAtTime(0, start);
  noteGain.gain.linearRampToValueAtTime(0.5, start + 0.04);
  noteGain.gain.exponentialRampToValueAtTime(0.0008, start + duration * 1.2);

  const osc1 = ctx.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.value = freq;
  osc1.detune.value = -5;
  osc1.connect(noteGain);
  osc1.start(start);
  osc1.stop(start + duration * 1.25);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = freq;
  osc2.detune.value = 6;
  osc2.connect(noteGain);
  osc2.start(start);
  osc2.stop(start + duration * 1.25);

  // Soft sub-octave bass layer under longer notes for lo-fi warmth.
  if (duration >= BEAT_SECONDS * 0.9) {
    const bassGain = ctx.createGain();
    bassGain.connect(filterNode);
    bassGain.gain.setValueAtTime(0, start);
    bassGain.gain.linearRampToValueAtTime(0.14, start + 0.06);
    bassGain.gain.exponentialRampToValueAtTime(0.0008, start + duration * 1.2);

    const bassOsc = ctx.createOscillator();
    bassOsc.type = "sine";
    bassOsc.frequency.value = freq / 2;
    bassOsc.connect(bassGain);
    bassOsc.start(start);
    bassOsc.stop(start + duration * 1.25);
  }
}

function scheduleAhead() {
  if (!playing) return;
  const ctx = getMusicCtx();
  const lookahead = 2.0;
  while (scheduledUntil < ctx.currentTime + lookahead) {
    for (const [note, beats] of MELODY) {
      const duration = beats * BEAT_SECONDS;
      scheduleNote(ctx, note ? NOTE_FREQ[note] : null, scheduledUntil, duration);
      scheduledUntil += duration;
    }
  }
}

export function startTetrisMusic() {
  if (playing) return;
  try {
    const ctx = getMusicCtx();
    playing = true;
    scheduledUntil = ctx.currentTime + 0.1;
    scheduleAhead();
    schedulerTimer = setInterval(scheduleAhead, 500);
  } catch (e) {
    // Audio isn't critical — fail silently if the browser blocks it.
  }
}

export function stopTetrisMusic() {
  playing = false;
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export function isTetrisMusicPlaying() {
  return playing;
}
