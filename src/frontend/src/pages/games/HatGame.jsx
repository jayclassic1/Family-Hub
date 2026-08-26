import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createHatGameActor } from "../../hatgame.js";
import { fileToAttachment, MAX_UPLOAD_BYTES } from "../../chat.js";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playNote(freq, startOffset, duration) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch (e) {}
}

function playHatMelody() {
  const notes = [523.25, 587.33, 659.25, 783.99, 659.25, 783.99, 880.0, 1046.5];
  notes.forEach((freq, i) => playNote(freq, i * 0.28, 0.35));
}

function playRevealChime() {
  [659.25, 987.77].forEach((freq, i) => playNote(freq, i * 0.1, 0.5));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function HatGame() {
  const { identity } = useAuth();
  const [hatGameActor, setHatGameActor] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [answers, setAnswers] = useState([]);
  const [participantText, setParticipantText] = useState("");
  const [participants, setParticipants] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [assignments, setAssignments] = useState(null);

  const [showImportantForm, setShowImportantForm] = useState(false);
  const [drawName, setDrawName] = useState("");
  const [drawDescription, setDrawDescription] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const h = await createHatGameActor(identity);
      setHatGameActor(h);
    })();
  }, [identity]);

  const addAnswer = (e) => {
    e.preventDefault();
    const val = answerText.trim();
    if (!val) return;
    setAnswers((prev) => [...prev, val]);
    setAnswerText("");
    setAssignments(null);
    setSaved(false);
  };

  const addParticipant = (e) => {
    e.preventDefault();
    const val = participantText.trim();
    if (!val) return;
    setParticipants((prev) => [...prev, val]);
    setParticipantText("");
    setAssignments(null);
    setSaved(false);
  };

  const removeAnswer = (i) => {
    setAnswers((prev) => prev.filter((_, idx) => idx !== i));
    setAssignments(null);
  };

  const removeParticipant = (i) => {
    setParticipants((prev) => prev.filter((_, idx) => idx !== i));
    setAssignments(null);
  };

  const clearAll = () => {
    setAnswers([]);
    setParticipants([]);
    setAssignments(null);
    setShowImportantForm(false);
    setSaved(false);
    setError(null);
  };

  const startNewDraw = () => {
    // Keeps the same answers/participants but clears the result so
    // the family can immediately draw again with the same setup.
    setAssignments(null);
    setShowImportantForm(false);
    setSaved(false);
    setError(null);
  };

  const canPlay = answers.length >= 2 && answers.length === participants.length;

  const handlePlay = () => {
    if (!canPlay || spinning) return;
    setAssignments(null);
    setShowImportantForm(false);
    setSaved(false);
    setSpinning(true);
    playHatMelody();

    const spinDuration = 2600;

    setTimeout(() => {
      const shuffledAnswers = shuffle(answers);
      const results = participants.map((p, i) => ({
        participant: p,
        answer: shuffledAnswers[i],
      }));
      setSpinning(false);
      setAssignments(results);
      playRevealChime();
    }, spinDuration);
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
    if (!hatGameActor || !drawName.trim() || !assignments) return;
    setSaving(true);
    setError(null);
    try {
      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }
      await hatGameActor.recordImportantDraw(answers, assignments, drawName.trim(), drawDescription.trim(), coverPhoto);
      setSaved(true);
      setShowImportantForm(false);
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", textDecoration: "none" }}>
          &lt; Back to Games
        </Link>
        <Link to="/games/hat-results" className="chat-send-button" style={{ textDecoration: "none", display: "inline-block" }}>
          🎩 Important Draws
        </Link>
      </div>

      <h1 className="page-title">Hat Draw</h1>
      <p className="page-subtitle">Put answers in the hat, add matching participants, and draw!</p>

      <div className="hat-game-layout">
        <div className="hat-game-stage">
          <div className={"hat-svg-wrap" + (spinning ? " hat-spinning" : "")}>
            <svg viewBox="0 0 200 200" className="hat-svg">
              <ellipse cx="100" cy="165" rx="85" ry="14" fill="var(--orange-dark)" />
              <rect x="55" y="55" width="90" height="110" rx="8" fill="var(--text-dark)" />
              <ellipse cx="100" cy="55" rx="45" ry="14" fill="var(--text-dark)" />
              <ellipse cx="100" cy="55" rx="30" ry="8" fill="#1a1310" />
              <rect x="55" y="120" width="90" height="14" fill="var(--orange)" />
            </svg>
            {spinning && (
              <>
                <div className="hat-sparkle hat-sparkle-1">✨</div>
                <div className="hat-sparkle hat-sparkle-2">✨</div>
                <div className="hat-sparkle hat-sparkle-3">✨</div>
              </>
            )}
          </div>

          {!assignments && (
            <button
              className="chat-send-button"
              style={{ marginTop: 20 }}
              onClick={handlePlay}
              disabled={!canPlay || spinning}
            >
              {spinning ? "Drawing..." : "Draw!"}
            </button>
          )}

          {!canPlay && !assignments && (
            <p className="tree-rel" style={{ marginTop: 10, textAlign: "center" }}>
              Add at least 2 answers, and the same number of participants.
            </p>
          )}

          {assignments && (
            <div className="hat-results">
              {assignments.map((a, i) => (
                <div key={i} className="hat-result-row" style={{ animationDelay: (i * 0.15) + "s" }}>
                  <strong>{a.participant}</strong> drew: <span>{a.answer}</span>
                </div>
              ))}
            </div>
          )}

          {assignments && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="chat-send-button" onClick={startNewDraw}>
                New Draw
              </button>
              <button className="tree-remove-btn" onClick={clearAll}>
                Start Over
              </button>
            </div>
          )}

          {assignments && !saved && (
            <div style={{ marginTop: 14, width: "100%" }}>
              {!showImportantForm ? (
                <button className="chat-send-button" onClick={() => setShowImportantForm(true)}>
                  Mark as important draw
                </button>
              ) : (
                <form onSubmit={handleSaveImportant} className="tree-admin-panel" style={{ marginTop: 10 }}>
                  <h2 className="tree-admin-title">Save this draw</h2>
                  <input
                    className="chat-text-input"
                    style={{ width: "100%", marginBottom: 10 }}
                    placeholder="Draw name (e.g. Secret Santa 2026)"
                    value={drawName}
                    onChange={(e) => setDrawName(e.target.value)}
                    autoFocus
                  />
                  <textarea
                    className="chat-text-input"
                    style={{ width: "100%", marginBottom: 10, minHeight: 60, resize: "vertical" }}
                    placeholder="Description (optional)"
                    value={drawDescription}
                    onChange={(e) => setDrawDescription(e.target.value)}
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
                    <button className="chat-send-button" type="submit" disabled={saving || !drawName.trim()}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {saved && (
            <p className="tree-rel" style={{ marginTop: 14 }}>
              Saved! <Link to="/games/hat-results">View all important draws</Link>
            </p>
          )}

          {error && <p className="auth-error">{error}</p>}
        </div>

        <div className="hat-game-controls">
          <div className="tree-admin-panel">
            <h2 className="tree-admin-title">Answers ({answers.length})</h2>
            <form onSubmit={addAnswer} className="spin-wheel-add-form">
              <input
                className="chat-text-input"
                placeholder="Add an answer..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
              <button className="chat-send-button" type="submit">Add</button>
            </form>
            {answers.length > 0 && (
              <ul className="spin-wheel-option-list">
                {answers.map((a, i) => (
                  <li key={i}>
                    <span>{a}</span>
                    <button className="tree-remove-btn" onClick={() => removeAnswer(i)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="tree-admin-panel" style={{ marginTop: 16 }}>
            <h2 className="tree-admin-title">Participants ({participants.length})</h2>
            <form onSubmit={addParticipant} className="spin-wheel-add-form">
              <input
                className="chat-text-input"
                placeholder="Add a participant..."
                value={participantText}
                onChange={(e) => setParticipantText(e.target.value)}
              />
              <button className="chat-send-button" type="submit">Add</button>
            </form>
            {participants.length > 0 && (
              <ul className="spin-wheel-option-list">
                {participants.map((p, i) => (
                  <li key={i}>
                    <span>{p}</span>
                    <button className="tree-remove-btn" onClick={() => removeParticipant(i)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(answers.length > 0 || participants.length > 0) && (
            <button className="tree-remove-btn" style={{ marginTop: 14 }} onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
