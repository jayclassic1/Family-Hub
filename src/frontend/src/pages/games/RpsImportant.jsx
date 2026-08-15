import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createRpsActor } from "../../rpsApi.js";
import { attachmentToUrl } from "../../chat.js";

export default function RpsImportant() {
  const { identity } = useAuth();
  const [rpsActor, setRpsActor] = useState(null);
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const r = await createRpsActor(identity);
      setRpsActor(r);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!rpsActor) return;
    try {
      const result = await rpsActor.listImportantGames();
      setGames(result);
    } catch (e) {
      setError(String(e));
    }
  }, [rpsActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <Link to="/games/rock-paper-scissors" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Rock Paper Scissors
      </Link>

      <h1 className="page-title">Important Games</h1>
      <p className="page-subtitle">Rock Paper Scissors games the family marked worth remembering.</p>

      <div className="card-grid tree-grid">
        {games.map((g) => (
          <Link key={g.id.toString()} to={"/games/rock-paper-scissors/" + g.id.toString()} className="card tree-card">
            {g.coverPhoto.length > 0 && (
              <img src={attachmentToUrl(g.coverPhoto[0])} alt={g.name[0]} className="event-card-thumb" />
            )}
            <div className="card-title">{g.name[0]}</div>
            <div className="card-description">
              {g.isDraw ? "Draw" : "Winner: " + (g.winnerName.length > 0 ? g.winnerName[0] : "?")}
            </div>
            <div className="tree-rel">{g.creatorName} vs {g.opponentName.length > 0 ? g.opponentName[0] : "?"}</div>
          </Link>
        ))}
        {games.length === 0 && <p className="chat-empty">No important games saved yet.</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
