import { useState, useRef } from "react";
import { Link } from "react-router-dom";

const MAX_DICE = 6;

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function createNoiseBuffer(ctx, duration) {
  const size = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playClack(startOffset, freq, duration, gainPeak) {
  try {
    const ctx = getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    const start = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + duration);
  } catch (e) {}
}

function playRattle() {
  // A cluster of short, randomly-pitched clacks — closer to dice
  // knocking against each other and the table than a synth beep.
  let t = 0;
  for (let i = 0; i < 12; i++) {
    const freq = 1200 + Math.random() * 2200;
    const dur = 0.03 + Math.random() * 0.03;
    playClack(t, freq, dur, 0.35);
    t += 0.05 + Math.random() * 0.05;
  }
}

function playLandThud() {
  try {
    const ctx = getAudioCtx();
    // Low-frequency body for the "thud" of dice settling
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx, 0.25);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.25);
  } catch (e) {}
  // A couple of tiny final clacks as the dice settle
  playClack(0.02, 2600, 0.02, 0.2);
  playClack(0.06, 1900, 0.02, 0.15);
}

const PIP_LAYOUTS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

function Die({ value, rolling }) {
  const pips = PIP_LAYOUTS[value] || PIP_LAYOUTS[1];
  return (
    <div className={"die" + (rolling ? " die-rolling" : "")}>
      <svg viewBox="0 0 100 100">
        <rect x="4" y="4" width="92" height="92" rx="16" fill="#fff9f0" stroke="#a9791f" strokeWidth="4" />
        {pips.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="8" fill="#5a4224" />
        ))}
      </svg>
    </div>
  );
}

export default function DiceRoll() {
  const [diceCount, setDiceCount] = useState(1);
  const [values, setValues] = useState([1]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState([]);
  const timeoutRef = useRef(null);

  const addDie = () => {
    if (diceCount >= MAX_DICE || rolling) return;
    setDiceCount((c) => c + 1);
    setValues((v) => [...v, 1]);
  };

  const removeDie = () => {
    if (diceCount <= 1 || rolling) return;
    setDiceCount((c) => c - 1);
    setValues((v) => v.slice(0, -1));
  };

  const handleRoll = () => {
    if (rolling) return;
    setRolling(true);
    playRattle();

    let ticks = 0;
    const interval = setInterval(() => {
      setValues(Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6)));
      ticks += 1;
      if (ticks > 10) {
        clearInterval(interval);
      }
    }, 90);

    timeoutRef.current = setTimeout(() => {
      clearInterval(interval);
      const finalValues = Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6));
      setValues(finalValues);
      setRolling(false);
      playLandThud();
      const total = finalValues.reduce((a, b) => a + b, 0);
      setHistory((prev) => [{ values: finalValues, total }, ...prev].slice(0, 8));
    }, 950);
  };

  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div>
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Dice Roll</h1>
      

      <div className="coin-toss-layout">
        <div className="coin-toss-stage">
          {!rolling && (
            <div className="coin-toss-result" style={{ marginTop: 0, marginBottom: 20 }}>
              {diceCount > 1 ? "Total: " + total : "Rolled: " + total}
            </div>
          )}

          <div className="dice-tray">
            {values.map((v, i) => (
              <Die key={i} value={v} rolling={rolling} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center" }}>
            <button className="tree-remove-btn" onClick={removeDie} disabled={diceCount <= 1 || rolling}>
              − Die
            </button>
            <span className="tree-rel">{diceCount} {diceCount === 1 ? "die" : "dice"}</span>
            <button className="tree-remove-btn" onClick={addDie} disabled={diceCount >= MAX_DICE || rolling}>
              + Die
            </button>
          </div>

          <button className="chat-send-button" style={{ marginTop: 16 }} onClick={handleRoll} disabled={rolling}>
            {rolling ? "Rolling..." : "Roll!"}
          </button>
        </div>

        <div className="tree-admin-panel" style={{ minWidth: 220 }}>
          <h2 className="tree-admin-title">Recent rolls</h2>
          {history.length === 0 ? (
            <p className="chat-empty">No rolls yet.</p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="dice-history-row">
                {h.values.join(" + ")} {h.values.length > 1 ? "= " + h.total : ""}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
