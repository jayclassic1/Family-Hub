import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createTetrisActor, tournamentStatusKey } from "../../tetrisApi.js";

const STATUS_LABELS = {
  waiting: "Waiting for players",
  inProgress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

export default function TetrisTournaments() {
  const navigate = useNavigate();
  const { identity } = useAuth();
  const [tetrisActor, setTetrisActor] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [wagerInput, setWagerInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const t = await createTetrisActor(identity);
      setTetrisActor(t);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!tetrisActor) return;
    try {
      const result = await tetrisActor.listTournaments();
      setTournaments(result);
    } catch (e) {
      setError(String(e));
    }
  }, [tetrisActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!tetrisActor) return;
    setCreating(true);
    setError(null);
    try {
      const wager = wagerInput.trim() === "" ? 0 : Number(wagerInput);
      const id = await tetrisActor.createTournament(name.trim(), Number(maxPlayers), wager);
      navigate("/games/tetris/tournaments/" + id.toString());
    } catch (e2) {
      setError(String(e2));
    } finally {
      setCreating(false);
    }
  };

  const active = tournaments.filter((t) => tournamentStatusKey(t.status) !== "cancelled");

  return (
    <div>
      <Link to="/games/tetris" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Tetris
      </Link>

      <h1 className="page-title">🏆 Tetris Tournaments</h1>
      <p className="page-subtitle">Everyone plays their own game — highest score takes the pot.</p>

      <div className="tree-admin-panel" style={{ marginBottom: 24 }}>
        <h2 className="tree-admin-title">Start a tournament</h2>
        <form onSubmit={handleCreate}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Tournament name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Max players</label>
              <select value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)}>
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Wager per player (Love, optional)</label>
              <input
                className="chat-text-input"
                style={{ width: 140 }}
                type="number"
                min="0"
                placeholder="0"
                value={wagerInput}
                onChange={(e) => setWagerInput(e.target.value)}
              />
            </div>
          </div>
          <button className="chat-send-button" type="submit" disabled={creating}>
            {creating ? "Starting..." : "Create tournament"}
          </button>
        </form>
      </div>

      <h2 className="tree-admin-title">Tournaments</h2>
      <div className="card-grid tree-grid">
        {active.map((t) => {
          const status = tournamentStatusKey(t.status);
          return (
            <Link key={t.id.toString()} to={"/games/tetris/tournaments/" + t.id.toString()} className="card tree-card">
              <div className="card-title">{t.name}</div>
              <div className="card-description">
                {t.players.length.toString()}/{t.maxPlayers.toString()} players — {t.wager > 0 ? t.wager.toString() + " Love each" : "No wager"}
              </div>
              <div className="tree-rel">{STATUS_LABELS[status] || status}</div>
            </Link>
          );
        })}
        {active.length === 0 && <p className="chat-empty">No tournaments yet — start one above!</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
