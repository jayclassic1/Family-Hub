import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createSpinsActor } from "../../spins.js";
import { attachmentToUrl } from "../../chat.js";

export default function SpinResults() {
  const { identity } = useAuth();
  const [spinsActor, setSpinsActor] = useState(null);
  const [spins, setSpins] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createSpinsActor(identity);
      setSpinsActor(s);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!spinsActor) return;
    try {
      const result = await spinsActor.listSpins();
      setSpins(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [spinsActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Important Spins</h1>
      <p className="page-subtitle">Results the family marked worth remembering.</p>

      <div className="card-grid tree-grid">
        {spins.map((s) => (
          <Link key={s.id.toString()} to={"/games/spin-results/" + s.id.toString()} className="card tree-card">
            {s.coverPhoto.length > 0 && (
              <img
                src={attachmentToUrl(s.coverPhoto[0])}
                alt={s.name}
                className="event-card-thumb"
              />
            )}
            <div className="card-title">{s.name}</div>
            <div className="card-description">Winner: {s.winner}</div>
            <div className="tree-rel">by <Link to={"/profile/" + s.spinner.toString()} onClick={(e) => e.stopPropagation()}>{s.spinnerName}</Link></div>
          </Link>
        ))}
        {spins.length === 0 && <p className="chat-empty">No important spins saved yet.</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
