import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createStrawDrawActor, shuffleForStraws } from "../../strawdrawApi.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../../chat.js";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

export default function StrawDraw() {
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [strawActor, setStrawActor] = useState(null);
  const [authActor, setAuthActor] = useState(null);
  const [games, setGames] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [shortCount, setShortCount] = useState(1);
  const [coverFile, setCoverFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createStrawDrawActor(identity);
      const a = await createAuthActor(identity);
      setStrawActor(s);
      setAuthActor(a);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!strawActor) return;
    try {
      const result = await strawActor.listGames();
      setGames(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [strawActor]);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!strawActor || !name.trim() || selectedPeople.length < 2) return;
    if (shortCount < 1 || shortCount >= selectedPeople.length) return;
    setCreating(true);
    setError(null);
    try {
      const participantIds = selectedPeople.map(
        (idText) => allUsers.find((u) => u.id.toString() === idText).id
      );
      const shuffled = shuffleForStraws(participantIds);

      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }

      const id = await strawActor.createGame(
        name.trim(),
        description.trim(),
        participantIds,
        shuffled,
        shortCount,
        coverPhoto
      );
      navigate("/games/straw-draw/" + id.toString());
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Draw Straws</h1>
      <p className="page-subtitle">Everyone gets a straw. Reveal yours whenever you're ready — short or long, for all to see.</p>

      <div className="card-grid tree-grid">
        {games.map((g) => (
          <Link key={g.id.toString()} to={"/games/straw-draw/" + g.id.toString()} className="card tree-card">
            {g.coverPhoto.length > 0 && (
              <img src={attachmentToUrl(g.coverPhoto[0])} alt={g.name} className="event-card-thumb" />
            )}
            <div className="card-title">🥢 {g.name}</div>
            <div className="card-description">{g.participants.length} participants — {g.shortStrawCount.toString()} short straw(s)</div>
            <div className="tree-rel">by <Link to={"/profile/" + g.creator.toString()} onClick={(e) => e.stopPropagation()}>{g.creatorName}</Link></div>
          </Link>
        ))}
        {games.length === 0 && <p className="chat-empty">No straw draws yet — start one below!</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Start a straw draw</h2>
        <form onSubmit={handleCreate}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Game name (e.g. Who does the dishes)"
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

          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
            How many short straws?
          </label>
          <input
            type="number"
            min="1"
            max={Math.max(1, selectedPeople.length - 1)}
            className="chat-text-input"
            style={{ width: 100, marginBottom: 14 }}
            value={shortCount}
            onChange={(e) => setShortCount(Number(e.target.value))}
          />

          <div>
            <button
              className="chat-send-button"
              type="submit"
              disabled={!name.trim() || selectedPeople.length < 2 || shortCount < 1 || shortCount >= selectedPeople.length || creating}
            >
              {creating ? "Starting..." : "🥢 Draw Straws"}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
