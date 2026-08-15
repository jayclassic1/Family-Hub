import { useState, useRef } from "react";
import { Link } from "react-router-dom";

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playFlipSound() {
  try {
    const ctx = getAudioCtx();
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1400 - i * 60;
      const start = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.09);
    }
  } catch (e) {}
}

function playLandSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

function CoinFace({ letter, label }) {
  return (
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="#e8b84b" stroke="#a9791f" strokeWidth="3" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#a9791f" strokeWidth="1.2" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="34"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fill="#5a4224"
      >
        {letter}
      </text>
      <text
        x="50"
        y="76"
        textAnchor="middle"
        fontSize="9"
        letterSpacing="1.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fill="#5a4224"
      >
        {label}
      </text>
    </svg>
  );
}

export default function CoinToss() {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState(null);
  const [spinCount, setSpinCount] = useState(0);
  const coinRef = useRef(null);
  const currentFaceRef = useRef(0);

  const handleFlip = () => {
    if (flipping) return;
    setResult(null);
    setFlipping(true);
    playFlipSound();

    const isHeads = Math.random() < 0.5;
    const targetFace = isHeads ? 0 : 180;
    const extraFullSpins = 6 + Math.floor(Math.random() * 3);
    const delta = (targetFace - currentFaceRef.current + 360) % 360;
    const finalRotation = extraFullSpins * 360 + delta;

    setSpinCount((c) => c + finalRotation);
    currentFaceRef.current = targetFace;

    setTimeout(() => {
      setFlipping(false);
      setResult(isHeads ? "heads" : "tails");
      playLandSound();
    }, 1800);
  };

  return (
    <div>
      <div className="coin-toss-page">
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 8, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Coin Toss</h1>

      <div className="coin-toss-stage">
        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          {result && (
            <div className="coin-toss-result">
              {result === "heads" ? "Heads!" : "Tails!"}
            </div>
          )}
        </div>

        <div className="coin-scene">
          <div
            ref={coinRef}
            className="coin"
            style={{
              transform: `rotateY(${spinCount}deg)`,
              transition: flipping ? "transform 1.8s cubic-bezier(0.2, 0.8, 0.3, 1)" : "none",
            }}
          >
            <div className="coin-face coin-face-heads">
              <CoinFace letter="H" label="HEADS" />
            </div>
            <div className="coin-face coin-face-tails">
              <CoinFace letter="T" label="TAILS" />
            </div>
          </div>
        </div>

        <button className="chat-send-button" style={{ marginTop: 24 }} onClick={handleFlip} disabled={flipping}>
          {flipping ? "Flipping..." : "Flip!"}
        </button>
      </div>
      </div>
    </div>
  );
}
