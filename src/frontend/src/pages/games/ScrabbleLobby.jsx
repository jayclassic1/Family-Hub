import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createScrabbleActor } from "../../scrabble.js";

export default function ScrabbleLobby() {
  const { identity, profile } = useAuth();
  const [games, setGames] = useState([]);
  const [newName, setNewName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!identity) return;
    try {
      const actor = await createScrabbleActor(identity);
      const result = await actor.listGames();
      setGames(result);
    } catch (e) {}
  }, [identity]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!identity || !newName.trim()) return;
    setCreating(true);
    try {
      const actor = await createScrabbleActor(identity);
      const id = await actor.createGame(newName.trim(), Number(maxPlayers));
      if (profile) await actor.setMyName(id, profile.username);
      setNewName("");
      await refresh();
    } catch (e) {
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (gameId) => {
    if (!identity) return;
    try {
      const actor = await createScrabbleActor(identity);
      await actor.joinGame(gameId);
      if (profile) await actor.setMyName(gameId, profile.username);
      await refresh();
    } catch (e) {}
  };

  const statusLabel = (status) => {
    if ("waiting" in status) return "Waiting for players";
    if ("active" in status) return "In progress";
    return "Finished";
  };

  return (
    <div className="scrabble-lobby">
      <h1 className="page-title">🔤 Scrabble</h1>
      <p className="page-subtitle">Honor-system scoring — place your tiles, call your score.</p>

      <form onSubmit={handleCreate} className="scrabble-panel" style={{ marginBottom: 20 }}>
        <h2 className="tree-admin-title">New Game</h2>
        <input
          className="chat-text-input"
          style={{ width: "100%", marginBottom: 10 }}
          placeholder="Game name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          className="chat-text-input"
          style={{ marginBottom: 10, marginRight: 10 }}
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(e.target.value)}
        >
          <option value={2}>2 players</option>
          <option value={3}>3 players</option>
          <option value={4}>4 players</option>
        </select>
        <button className="chat-send-button" type="submit" disabled={creating || !newName.trim()}>
          {creating ? "Creating..." : "Create Game"}
        </button>
      </form>

      <div className="card-grid">
        {games.length === 0 ? (
          <p className="chat-empty">No games yet — start one above!</p>
        ) : (
          games.map((g) => {
            const isIn = profile && g.players.some((p) => p.id.toString() === profile.id.toString());
            const isFull = g.players.length >= g.maxPlayers;
            const isWaiting = "waiting" in g.status;
            return (
              <div key={g.id.toString()} className="card">
                <h3>{g.name}</h3>
                <p className="tree-rel">
                  {g.players.length}/{g.maxPlayers} players &middot; {statusLabel(g.status)}
                </p>
                <p className="tree-rel">{g.players.map((p) => p.name).join(", ")}</p>
                {isIn ? (
                  <Link
                    to={"/games/scrabble/" + g.id.toString()}
                    className="chat-send-button"
                    style={{ textDecoration: "none", display: "inline-block" }}
                  >
                    {isWaiting ? "Enter Lobby" : "Continue Game"}
                  </Link>
                ) : (
                  !isFull &&
                  isWaiting && (
                    <button className="chat-send-button" onClick={() => handleJoin(g.id)}>
                      Join
                    </button>
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
