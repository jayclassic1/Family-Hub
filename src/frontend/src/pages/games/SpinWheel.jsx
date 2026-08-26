import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createSpinsActor } from "../../spins.js";
import { fileToAttachment, MAX_UPLOAD_BYTES } from "../../chat.js";

const COLORS = [
  "#ff8c42", "#ffd166", "#e8702e", "#fff1dc",
  "#f4a259", "#ffe08a", "#d9822b", "#fff9f0",
];

const IMAGE_TYPES = ["image/png", "image/jpeg"];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTick() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch (e) {}
}

function playDing() {
  try {
    const ctx = getAudioCtx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch (e) {}
}

export default function SpinWheel() {
  const { identity } = useAuth();
  const [spinsActor, setSpinsActor] = useState(null);
  const [inputText, setInputText] = useState("");
  const [options, setOptions] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const tickTimeouts = useRef([]);

  const [showImportantForm, setShowImportantForm] = useState(false);
  const [spinName, setSpinName] = useState("");
  const [spinDescription, setSpinDescription] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createSpinsActor(identity);
      setSpinsActor(s);
    })();
  }, [identity]);

  const addOption = (e) => {
    e.preventDefault();
    const val = inputText.trim();
    if (!val) return;
    setOptions((prev) => [...prev, val]);
    setInputText("");
    setResult(null);
    setShowImportantForm(false);
    setSaved(false);
  };

  const removeOption = (i) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
  };

  const clearAll = () => {
    setOptions([]);
    setResult(null);
    setShowImportantForm(false);
    setSaved(false);
  };

  const scheduleTicks = useCallback((durationMs) => {
    tickTimeouts.current.forEach(clearTimeout);
    tickTimeouts.current = [];
    let t = 0;
    let gap = 60;
    while (t < durationMs - 200) {
      const id = setTimeout(playTick, t);
      tickTimeouts.current.push(id);
      t += gap;
      gap *= 1.12;
    }
  }, []);

  const handleSpin = () => {
    if (spinning || options.length < 2) return;
    setResult(null);
    setShowImportantForm(false);
    setSaved(false);
    setSpinning(true);

    const segmentAngle = 360 / options.length;
    const winnerIndex = Math.floor(Math.random() * options.length);
    const winnerCenterAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation =
      rotation + extraSpins * 360 + (360 - winnerCenterAngle) - (rotation % 360);

    const duration = 4200;
    scheduleTicks(duration);
    setRotation(targetRotation);

    setTimeout(() => {
      setSpinning(false);
      setResult(options[winnerIndex]);
      playDing();
    }, duration + 50);
  };

  const handleCoverChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Cover photo must be a PNG or JPG.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Photo is too large (max ~3.3MB).");
      e.target.value = "";
      return;
    }
    setError(null);
    setCoverFile(f);
  };

  const handleSaveImportant = async (e) => {
    e.preventDefault();
    if (!spinsActor || !spinName.trim() || !result) return;
    setSaving(true);
    setError(null);
    try {
      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }
      await spinsActor.recordImportantSpin(options, result, spinName.trim(), spinDescription.trim(), coverPhoto);
      setSaved(true);
      setShowImportantForm(false);
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const segmentAngle = options.length > 0 ? 360 / options.length : 360;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", textDecoration: "none" }}>
          &lt; Back to Games
        </Link>
        <Link to="/games/spin-results" className="chat-send-button" style={{ textDecoration: "none", display: "inline-block" }}>
          ⭐ Important Spins
        </Link>
      </div>

      <h1 className="page-title">Wheel Game</h1>
      <p className="page-subtitle">Add names or options, then spin to pick one at random.</p>

      <div className="spin-wheel-layout">
        <div className="spin-wheel-stage">
          <div className="spin-wheel-pointer" />
          <svg
            viewBox="0 0 300 300"
            className="spin-wheel-svg"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
            }}
          >
            <circle cx="150" cy="150" r="148" fill="var(--white)" stroke="var(--yellow)" strokeWidth="4" />
            {options.map((opt, i) => {
              const start = i * segmentAngle;
              const end = start + segmentAngle;
              const mid = start + segmentAngle / 2;
              const labelPos = polarToCartesian(150, 150, 95, mid);
              return (
                <g key={i}>
                  <path d={describeSlice(150, 150, 140, start, end)} fill={COLORS[i % COLORS.length]} stroke="var(--white)" strokeWidth="2" />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="var(--text-dark)"
                    transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                  >
                    {opt.length > 14 ? opt.slice(0, 13) + "…" : opt}
                  </text>
                </g>
              );
            })}
            <circle cx="150" cy="150" r="18" fill="var(--orange)" stroke="var(--white)" strokeWidth="3" />
          </svg>
        </div>

        <div className="spin-wheel-controls">
          <form onSubmit={addOption} className="spin-wheel-add-form">
            <input
              className="chat-text-input"
              placeholder="Add a name or option..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button className="chat-send-button" type="submit">Add</button>
          </form>

          {options.length > 0 && (
            <ul className="spin-wheel-option-list">
              {options.map((opt, i) => (
                <li key={i}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="spin-wheel-swatch" style={{ background: COLORS[i % COLORS.length] }} />
                    {opt}
                  </span>
                  <button className="tree-remove-btn" onClick={() => removeOption(i)}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              className="chat-send-button"
              onClick={handleSpin}
              disabled={spinning || options.length < 2}
            >
              {spinning ? "Spinning..." : "Spin!"}
            </button>
            {options.length > 0 && (
              <button className="tree-remove-btn" onClick={clearAll} disabled={spinning}>
                Clear all
              </button>
            )}
          </div>

          {options.length === 1 && (
            <p className="tree-rel" style={{ marginTop: 10 }}>Add at least 2 options to spin.</p>
          )}

          {result && (
            <div className="spin-wheel-result">
              🎉 <strong>{result}</strong> wins!
            </div>
          )}

          {result && !saved && (
            <div style={{ marginTop: 14 }}>
              {!showImportantForm ? (
                <button className="chat-send-button" onClick={() => setShowImportantForm(true)}>
                  Mark as important spin
                </button>
              ) : (
                <form onSubmit={handleSaveImportant} className="tree-admin-panel" style={{ marginTop: 10 }}>
                  <h2 className="tree-admin-title">Save this spin</h2>
                  <input
                    className="chat-text-input"
                    style={{ width: "100%", marginBottom: 10 }}
                    placeholder="Spin name (e.g. Who does the dishes tonight?)"
                    value={spinName}
                    onChange={(e) => setSpinName(e.target.value)}
                    autoFocus
                  />
                  <textarea
                    className="chat-text-input"
                    style={{ width: "100%", marginBottom: 10, minHeight: 60, resize: "vertical" }}
                    placeholder="Description (optional)"
                    value={spinDescription}
                    onChange={(e) => setSpinDescription(e.target.value)}
                  />
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Cover photo (optional)</label>
                    <input type="file" accept="image/png,image/jpeg" onChange={handleCoverChange} />
                    {coverFile && <div className="tree-rel" style={{ marginTop: 6 }}>Photo: {coverFile.name}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="tree-remove-btn" onClick={() => setShowImportantForm(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button className="chat-send-button" type="submit" disabled={saving || !spinName.trim()}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {saved && (
            <p className="tree-rel" style={{ marginTop: 14 }}>
              Saved! <Link to="/games/spin-results">View all important spins</Link>
            </p>
          )}

          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
