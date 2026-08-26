import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createTetrisActor, tournamentStatusKey } from "../../tetrisApi.js";
import TetrisGame from "../../components/TetrisGame.jsx";

const STATUS_LABELS = {
  waiting: "Waiting for players",
  inProgress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

export default function TetrisTournamentDetail() {
  const { tournamentId } = useParams();
  const { identity, profile } = useAuth();
  const [tetrisActor, setTetrisActor] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  const numericTournamentId = Number(tournamentId);

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
      const result = await tetrisActor.getTournament(numericTournamentId);
      setTournament(result.length > 0 ? result[0] : null);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [tetrisActor, numericTournamentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!tournament) {
    return (
      <div>
        <Link to="/games/tetris/tournaments" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
          &lt; Back to Tournaments
        </Link>
        <p className="chat-empty">Loading tournament...</p>
      </div>
    );
  }

  const status = tournamentStatusKey(tournament.status);
  const meText = profile ? profile.id.toString() : null;
  const myEntry = tournament.players.find((p) => p.player.toString() === meText);
  const isPlayer = !!myEntry;
  const isCreator = meText && tournament.creator.toString() === meText;
  const isFull = tournament.players.length >= Number(tournament.maxPlayers);
  const pot = Number(tournament.wager) * tournament.players.length;
  const hasSubmittedScore = myEntry && myEntry.score.length > 0;

  const handleJoin = async () => {
    if (!tetrisActor) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await tetrisActor.joinTournament(numericTournamentId);
      if (!ok) setError("Could not join — check your Love balance or the tournament may be full.");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!tetrisActor) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await tetrisActor.startTournament(numericTournamentId);
      if (!ok) setError("Need at least 2 players to start.");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!tetrisActor) return;
    setBusy(true);
    setError(null);
    try {
      await tetrisActor.cancelTournament(numericTournamentId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleGameOver = async (score) => {
    if (!tetrisActor || scoreSubmitted) return;
    setScoreSubmitted(true);
    try {
      await tetrisActor.submitScore(numericTournamentId, score);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const sortedPlayers = [...tournament.players].sort((a, b) => {
    const as = a.score.length > 0 ? Number(a.score[0]) : -1;
    const bs = b.score.length > 0 ? Number(b.score[0]) : -1;
    return bs - as;
  });

  return (
    <div>
      <Link to="/games/tetris/tournaments" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Tournaments
      </Link>

      <h1 className="page-title">🏆 {tournament.name}</h1>
      <p className="page-subtitle">
        {STATUS_LABELS[status] || status} — {tournament.players.length.toString()}/{tournament.maxPlayers.toString()} players
        {tournament.wager > 0 && " — Pot: " + pot.toString() + " Love"}
      </p>

      {tournament.winnerText && (
        <div className="coin-toss-result" style={{ marginBottom: 16 }}>{tournament.winnerText}</div>
      )}

      {status === "waiting" && (
        <div className="tree-admin-panel" style={{ marginBottom: 16 }}>
          {!isPlayer && !isFull && (
            <button className="chat-send-button" onClick={handleJoin} disabled={busy} style={{ marginRight: 8 }}>
              {tournament.wager > 0 ? "Join — pay " + tournament.wager.toString() + " Love" : "Join"}
            </button>
          )}
          {isCreator && tournament.players.length >= 2 && (
            <button className="chat-send-button" onClick={handleStart} disabled={busy} style={{ marginRight: 8 }}>
              Start Tournament
            </button>
          )}
          {isCreator && (
            <button className="tree-remove-btn" onClick={handleCancel} disabled={busy}>
              Cancel (refund everyone)
            </button>
          )}
        </div>
      )}

      <div className="tree-admin-panel" style={{ marginBottom: 16 }}>
        <h2 className="tree-admin-title">Players</h2>
        {sortedPlayers.map((p, i) => (
          <div key={p.player.toString()} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="tree-rel">
              {status === "complete" ? "#" + (i + 1) + " " : ""}
              <Link to={"/profile/" + p.player.toString()}>{p.playerName}</Link>
            </span>
            <span className="tree-rel">
              {p.score.length > 0 ? p.score[0].toString() + " pts" : status === "inProgress" ? "Playing..." : "—"}
            </span>
          </div>
        ))}
      </div>

      {status === "inProgress" && isPlayer && !hasSubmittedScore && (
        <TetrisGame onGameOver={handleGameOver} />
      )}

      {status === "inProgress" && isPlayer && hasSubmittedScore && (
        <p className="tree-rel">You scored {myEntry.score[0].toString()} — waiting for the others to finish...</p>
      )}

      {status === "inProgress" && !isPlayer && (
        <p className="tree-rel">You're spectating this tournament.</p>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
