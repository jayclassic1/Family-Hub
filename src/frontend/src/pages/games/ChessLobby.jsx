import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createChessActor, statusLabel } from "../../chessApi.js";
import { createDmsActor } from "../../dms.js";

export default function ChessLobby() {
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [chessActor, setChessActor] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [inviteSel, setInviteSel] = useState("");
  const [wagerInput, setWagerInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const c = await createChessActor(identity);
      const a = await createAuthActor(identity);
      setChessActor(c);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!chessActor) return;
    try {
      const result = await chessActor.listAllGames();
      setAllGames(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [chessActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const opponents = allUsers.filter((u) => !profile || u.id.toString() !== profile.id.toString());
  const wager = wagerInput.trim() === "" ? 0 : Number(wagerInput);

  const handleCreateOpen = async () => {
    if (!chessActor) return;
    setCreating(true);
    setError(null);
    try {
      const id = await chessActor.createOpenGame(wager);
      navigate("/games/chess/" + id.toString());
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!chessActor || !inviteSel) return;
    setCreating(true);
    setError(null);
    try {
      const target = allUsers.find((u) => u.id.toString() === inviteSel);
      const id = await chessActor.createInviteGame(target.id, wager);
      try {
        const dmsActor = await createDmsActor(identity);
        const myName = profile ? profile.username : "Someone";
        const wagerText = wager > 0 ? " (wagering " + wager + " Love!)" : "";
        await dmsActor.sendDirectMessage(
          target.id,
          "♟️ " + myName + " challenged you to a game of Chess" + wagerText + "! Go to Games \u2192 Chess to accept.",
          []
        );
      } catch (dmErr) {}
      navigate("/games/chess/" + id.toString());
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (gameId) => {
    if (!chessActor) return;
    setJoiningId(gameId.toString());
    setError(null);
    try {
      const ok = await chessActor.joinGame(gameId);
      if (ok) {
        navigate("/games/chess/" + gameId.toString());
      } else {
        setError("Could not join — check the wager amount and your Love balance, or the game may already have both players.");
        await refresh();
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setJoiningId(null);
    }
  };

  const handleCancel = async (gameId) => {
    if (!chessActor) return;
    setError(null);
    try {
      await chessActor.cancelOpenGame(gameId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const isParticipant = (g) => {
    if (!profile) return false;
    const meText = profile.id.toString();
    if (g.white.toString() === meText) return true;
    if (g.black.length > 0 && g.black[0].toString() === meText) return true;
    return false;
  };

  return (
    <div>
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Chess</h1>
      <p className="page-subtitle">Open a game for anyone, or invite someone directly. All games can be watched by the family.</p>

      <div className="tree-admin-panel">
        <h2 className="tree-admin-title">Start a new game</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
            Wager (optional, Love)
          </label>
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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <button className="chat-send-button" onClick={handleCreateOpen} disabled={creating}>
            {creating ? "Starting..." : wager > 0 ? "Open game — wager " + wager + " Love" : "Open game (anyone can join)"}
          </button>
        </div>
        <form className="tree-admin-form" onSubmit={handleCreateInvite}>
          <select value={inviteSel} onChange={(e) => setInviteSel(e.target.value)}>
            <option value="">Invite a specific person...</option>
            {opponents.map((u) => (
              <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
            ))}
          </select>
          <button className="chat-send-button" type="submit" disabled={!inviteSel || creating}>
            {creating ? "Starting..." : "Send invite"}
          </button>
        </form>
        {opponents.length === 0 && (
          <p className="tree-rel" style={{ marginTop: 10 }}>No other family members registered yet — you can still open a public game.</p>
        )}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>All games</h2>
      <div className="card-grid tree-grid">
        {allGames.map((g) => {
          const waitingForOpponent = g.black.length === 0;
          const meText = profile ? profile.id.toString() : null;
          const canJoin =
            waitingForOpponent &&
            meText &&
            g.white.toString() !== meText &&
            (g.isOpen || (g.invitedPlayer.length > 0 && g.invitedPlayer[0].toString() === meText));
          const isMine = meText && g.white.toString() === meText;
          const canCancel = waitingForOpponent && isMine && Object.keys(g.status)[0] === "ongoing";

          return (
            <div key={g.id.toString()} className="card tree-card">
              <div className="card-title">
                <Link to={"/profile/" + g.white.toString()} onClick={(e) => e.stopPropagation()}>{g.whiteName}</Link> vs {waitingForOpponent ? (g.isOpen ? "Open" : "Invited: " + (g.invitedName[0] || "?")) : <Link to={"/profile/" + g.black[0].toString()} onClick={(e) => e.stopPropagation()}>{g.blackName[0]}</Link>}
              </div>
              <div className="card-description">{statusLabel(g.status)}</div>
              <div className="tree-rel">{g.moveHistory.length} moves</div>
              <div className="tree-rel">{g.wager > 0 ? "💰 Wager: " + g.wager.toString() + " Love each" : "No wager"}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {canJoin ? (
                  <button
                    className="chat-send-button"
                    onClick={() => handleJoin(g.id)}
                    disabled={joiningId === g.id.toString()}
                  >
                    {joiningId === g.id.toString() ? "Joining..." : g.wager > 0 ? "Join — pay " + g.wager.toString() + " Love" : "Join"}
                  </button>
                ) : (
                  <Link to={"/games/chess/" + g.id.toString()} className="chat-send-button" style={{ textDecoration: "none" }}>
                    {isParticipant(g) ? "Play" : "Watch"}
                  </Link>
                )}
                {canCancel && (
                  <button className="tree-remove-btn" onClick={() => handleCancel(g.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {allGames.length === 0 && <p className="chat-empty">No games yet — start one above!</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
