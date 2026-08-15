import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createRpsActor, statusKey } from "../../rpsApi.js";
import { createDmsActor } from "../../dms.js";

export default function RpsLobby() {
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [rpsActor, setRpsActor] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [opponentSel, setOpponentSel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const r = await createRpsActor(identity);
      const a = await createAuthActor(identity);
      setRpsActor(r);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!rpsActor) return;
    try {
      const result = await rpsActor.listAllGames();
      setAllGames(result);
    } catch (e) {
      setError(String(e));
    }
  }, [rpsActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const opponents = allUsers.filter((u) => !profile || u.id.toString() !== profile.id.toString());

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!rpsActor || !opponentSel) return;
    setCreating(true);
    setError(null);
    try {
      const target = allUsers.find((u) => u.id.toString() === opponentSel);
      const id = await rpsActor.createGame(target.id);
      try {
        const dmsActor = await createDmsActor(identity);
        const myName = profile ? profile.username : "Someone";
        await dmsActor.sendDirectMessage(
          target.id,
          "\u270c\ufe0f " + myName + " challenged you to Rock Paper Scissors! Go to Games \u2192 Rock Paper Scissors to accept.",
          []
        );
      } catch (dmErr) {}
      navigate("/games/rock-paper-scissors/" + id.toString());
    } catch (e2) {
      setError(String(e2));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", textDecoration: "none" }}>
          &lt; Back to Games
        </Link>
        <Link to="/games/rock-paper-scissors/important" className="chat-send-button" style={{ textDecoration: "none", display: "inline-block" }}>
          ⭐ Important Games
        </Link>
      </div>

      <h1 className="page-title">Rock Paper Scissors</h1>
      <p className="page-subtitle">Challenge someone. Everyone can watch, only the two players choose.</p>

      <div className="tree-admin-panel">
        <h2 className="tree-admin-title">Challenge someone</h2>
        <form className="tree-admin-form" onSubmit={handleCreate}>
          <select value={opponentSel} onChange={(e) => setOpponentSel(e.target.value)}>
            <option value="">Choose an opponent...</option>
            {opponents.map((u) => (
              <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
            ))}
          </select>
          <button className="chat-send-button" type="submit" disabled={!opponentSel || creating}>
            {creating ? "Creating..." : "Challenge"}
          </button>
        </form>
        {opponents.length === 0 && (
          <p className="tree-rel" style={{ marginTop: 10 }}>No other family members registered yet.</p>
        )}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>All games</h2>
      <div className="card-grid tree-grid">
        {allGames.map((g) => {
          const status = statusKey(g.status);
          const label =
            status === "waitingForOpponent" ? "Waiting for opponent to confirm" :
            status === "waitingForChoices" ? "Choosing..." :
            g.isDraw ? "Draw" : "Winner: " + (g.winnerName.length > 0 ? g.winnerName[0] : "?");
          return (
            <Link key={g.id.toString()} to={"/games/rock-paper-scissors/" + g.id.toString()} className="card tree-card">
              <div className="card-title">
                <Link to={"/profile/" + g.creator.toString()} onClick={(e) => e.stopPropagation()}>{g.creatorName}</Link> vs {g.opponentName.length > 0 ? <Link to={"/profile/" + g.opponent[0].toString()} onClick={(e) => e.stopPropagation()}>{g.opponentName[0]}</Link> : "?"}
              </div>
              <div className="card-description">{label}</div>
              <div className="tree-rel">Round {g.round.toString()}</div>
            </Link>
          );
        })}
        {allGames.length === 0 && <p className="chat-empty">No games yet — challenge someone above!</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
