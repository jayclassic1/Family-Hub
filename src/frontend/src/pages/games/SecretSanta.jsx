import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createSecretSantaActor, shuffleForSecretSanta } from "../../secretsanta.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../../chat.js";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playNote(freq, startOffset, duration, type) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.value = freq;
    const start = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch (e) {}
}

// Opening motif of "Jingle Bells": E E E | E E E | E G C D E
function playJingleBells() {
  const E = 659.25, G = 783.99, C = 523.25, D = 587.33;
  const notes = [
    [E, 0.0], [E, 0.35], [E, 0.7],
    [E, 1.15], [E, 1.5], [E, 1.85],
    [E, 2.3], [G, 2.65], [C, 3.0], [D, 3.35], [E, 3.8],
  ];
  notes.forEach(([freq, t]) => playNote(freq, t, 0.32, "triangle"));
}

export default function SecretSanta() {
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [santaActor, setSantaActor] = useState(null);
  const [authActor, setAuthActor] = useState(null);
  const [exchanges, setExchanges] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createSecretSantaActor(identity);
      const a = await createAuthActor(identity);
      setSantaActor(s);
      setAuthActor(a);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!santaActor) return;
    try {
      const result = await santaActor.listExchanges();
      setExchanges(result);
    } catch (e) {
      setError(String(e));
    }
  }, [santaActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const togglePerson = (idText) => {
    setSelectedPeople((prev) =>
      prev.includes(idText) ? prev.filter((x) => x !== idText) : [...prev, idText]
    );
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

  const nameOf = (idText) => {
    const u = allUsers.find((x) => x.id.toString() === idText);
    return u ? u.username : idText;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!santaActor || !name.trim() || selectedPeople.length < 2) return;
    setCreating(true);
    setError(null);
    playJingleBells();
    try {
      const participantIds = selectedPeople.map(
        (idText) => allUsers.find((u) => u.id.toString() === idText).id
      );
      const { givers, recipients } = shuffleForSecretSanta(participantIds);

      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }

      // Let the melody play out a bit before finishing, for the fun of it
      await new Promise((resolve) => setTimeout(resolve, 2200));

      const id = await santaActor.createExchange(
        name.trim(),
        description.trim(),
        givers,
        recipients,
        coverPhoto
      );
      navigate("/games/secret-santa/" + id.toString());
    } catch (e2) {
      setError(String(e2));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Secret Santa</h1>
      <p className="page-subtitle">Everyone gets a secret match. Only you can see who you got.</p>

      <div className="card-grid tree-grid">
        {exchanges.map((ex) => (
          <Link key={ex.id.toString()} to={"/games/secret-santa/" + ex.id.toString()} className="card tree-card">
            {ex.coverPhoto.length > 0 && (
              <img src={attachmentToUrl(ex.coverPhoto[0])} alt={ex.name} className="event-card-thumb" />
            )}
            <div className="card-title">🎅 {ex.name}</div>
            <div className="card-description">{ex.participants.length} participants</div>
            <div className="tree-rel">organized by <Link to={"/profile/" + ex.organizer.toString()} onClick={(e) => e.stopPropagation()}>{ex.organizerName}</Link></div>
          </Link>
        ))}
        {exchanges.length === 0 && <p className="chat-empty">No Secret Santa exchanges yet — start one below!</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Start a Secret Santa</h2>
        {creating ? (
          <div className="santa-sack-wrap">
            <svg viewBox="0 0 200 200" className="santa-sack-svg">
              <ellipse cx="100" cy="150" rx="70" ry="40" fill="#c0392b" />
              <path d="M 40 150 Q 30 90 60 60 Q 80 40 100 45 Q 120 40 140 60 Q 170 90 160 150 Z" fill="#c0392b" />
              <ellipse cx="100" cy="55" rx="30" ry="14" fill="#a93226" />
              <path d="M 70 55 Q 100 30 130 55" stroke="#f4d03f" strokeWidth="6" fill="none" />
            </svg>
            <p className="tree-rel" style={{ marginTop: 10 }}>🔔 Sorting the sack...</p>
          </div>
        ) : (
          <form onSubmit={handleCreate}>
            <input
              className="chat-text-input"
              style={{ width: "100%", marginBottom: 10 }}
              placeholder="Exchange name (e.g. Family Christmas 2026)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="chat-text-input"
              style={{ width: "100%", marginBottom: 10, minHeight: 60, resize: "vertical" }}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Cover photo (optional)</label>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handleCoverChange} />
              {coverFile && <div className="tree-rel" style={{ marginTop: 6 }}>Photo: {coverFile.name}</div>}
            </div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
              Participants (select at least 2)
            </label>
            <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {allUsers.map((u) => (
                <label key={u.id.toString()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={selectedPeople.includes(u.id.toString())}
                    onChange={() => togglePerson(u.id.toString())}
                  />
                  {u.username}
                </label>
              ))}
            </div>
            <button className="chat-send-button" type="submit" disabled={!name.trim() || selectedPeople.length < 2}>
              🎁 Draw Secret Santa
            </button>
          </form>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
