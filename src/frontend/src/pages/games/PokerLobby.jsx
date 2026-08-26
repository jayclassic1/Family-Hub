import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createPokerActor, phaseKey } from "../../pokerApi.js";

const PHASE_LABELS = {
  waiting: "Waiting for players",
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  handComplete: "Hand complete",
};

function countOccupied(seats) {
  return seats.filter((s) => s.length > 0).length;
}

export default function PokerLobby() {
  const navigate = useNavigate();
  const { identity } = useAuth();
  const [pokerActor, setPokerActor] = useState(null);
  const [tables, setTables] = useState([]);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("open");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const p = await createPokerActor(identity);
      setPokerActor(p);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!pokerActor) return;
    try {
      const result = await pokerActor.listTables();
      setTables(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [pokerActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!pokerActor) return;
    setCreating(true);
    setError(null);
    try {
      const maxSeats = mode === "headsUp" ? 2 : 8;
      const id = await pokerActor.createTable(name.trim(), maxSeats);
      navigate("/games/poker/" + id.toString());
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

      <h1 className="page-title">Poker</h1>
      <p className="page-subtitle">No-Limit Texas Hold'em. 20-50 Love buy-in, take your winnings anytime.</p>

      <div className="tree-admin-panel">
        <h2 className="tree-admin-title">Start a table</h2>
        <form onSubmit={handleCreate}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Table name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ marginBottom: 10, display: "flex", gap: 16 }}>
            <label>
              <input type="radio" checked={mode === "open"} onChange={() => setMode("open")} />{" "}
              Open table (up to 8 players)
            </label>
            <label>
              <input type="radio" checked={mode === "headsUp"} onChange={() => setMode("headsUp")} />{" "}
              1v1 Heads-Up
            </label>
          </div>
          <button className="chat-send-button" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create table"}
          </button>
        </form>
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Tables</h2>
      <div className="card-grid tree-grid">
        {tables.map((t) => {
          const occ = countOccupied(t.seats);
          const phase = phaseKey(t.phase);
          const isHeadsUp = Number(t.maxSeats) === 2;
          return (
            <Link key={t.id.toString()} to={"/games/poker/" + t.id.toString()} className="card tree-card">
              <div className="card-title">{t.name}</div>
              <div className="card-description">
                {isHeadsUp ? "Heads-Up" : "Open table"} — {occ}/{t.maxSeats.toString()} seated
              </div>
              <div className="tree-rel">{PHASE_LABELS[phase] || phase} — Pot: {t.pot.toString()} Love</div>
            </Link>
          );
        })}
        {tables.length === 0 && <p className="chat-empty">No tables yet — start one above!</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
