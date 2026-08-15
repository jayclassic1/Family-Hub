import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createHatGameActor } from "../../hatgame.js";
import { attachmentToUrl } from "../../chat.js";

export default function HatResults() {
  const { identity } = useAuth();
  const [hatGameActor, setHatGameActor] = useState(null);
  const [draws, setDraws] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const h = await createHatGameActor(identity);
      setHatGameActor(h);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!hatGameActor) return;
    try {
      const result = await hatGameActor.listDraws();
      setDraws(result);
    } catch (e) {
      setError(String(e));
    }
  }, [hatGameActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Important Draws</h1>
      <p className="page-subtitle">Hat Draw results the family marked worth remembering.</p>

      <div className="card-grid tree-grid">
        {draws.map((d) => (
          <Link key={d.id.toString()} to={"/games/hat-results/" + d.id.toString()} className="card tree-card">
            {d.coverPhoto.length > 0 && (
              <img
                src={attachmentToUrl(d.coverPhoto[0])}
                alt={d.name}
                className="event-card-thumb"
              />
            )}
            <div className="card-title">{d.name}</div>
            <div className="card-description">{d.assignments.length} participants</div>
            <div className="tree-rel">by <Link to={"/profile/" + d.drawer.toString()} onClick={(e) => e.stopPropagation()}>{d.drawerName}</Link></div>
          </Link>
        ))}
        {draws.length === 0 && <p className="chat-empty">No important draws saved yet.</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
