import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createTetrisActor } from "../../tetrisApi.js";
import TetrisGame from "../../components/TetrisGame.jsx";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TetrisPractice() {
  const { identity } = useAuth();
  const [tetrisActor, setTetrisActor] = useState(null);
  const [topScores, setTopScores] = useState([]);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const t = await createTetrisActor(identity);
      setTetrisActor(t);
    })();
  }, [identity]);

  const refreshScores = useCallback(async () => {
    if (!tetrisActor) return;
    try {
      const result = await tetrisActor.getTopScores(3);
      setTopScores(result);
    } catch (e) {}
  }, [tetrisActor]);

  useEffect(() => {
    refreshScores();
  }, [refreshScores]);

  // Re-check periodically so a freshly-set high score shows up without
  // needing a manual page reload.
  useEffect(() => {
    const t = setInterval(refreshScores, 8000);
    return () => clearInterval(t);
  }, [refreshScores]);

  return (
    <div>
      <Link to="/games" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Games
      </Link>

      <h1 className="page-title">Tetris</h1>
      <p className="page-subtitle">Free play. Want to wager Love against family? Check out Tournaments below.</p>

      <Link to="/games/tetris/tournaments" className="chat-send-button" style={{ display: "inline-block", textDecoration: "none", marginBottom: 20 }}>
        🏆 Tetris Tournaments
      </Link>

      <div className="tetris-leaderboard">
        {[0, 1, 2].map((i) => {
          const entry = topScores[i];
          return (
            <div key={i} className={"tetris-leaderboard-slot" + (i === 0 ? " tetris-leaderboard-slot-1" : "")}>
              <div className="tetris-leaderboard-medal">{MEDALS[i]}</div>
              <div className="tetris-leaderboard-name">{entry ? entry.playerName : "—"}</div>
              <div className="tetris-leaderboard-score">{entry ? entry.score.toString() : "—"}</div>
            </div>
          );
        })}
      </div>

      <TetrisGame />
    </div>
  );
}
