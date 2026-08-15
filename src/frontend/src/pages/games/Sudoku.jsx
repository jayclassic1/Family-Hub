import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { createSudokuActor } from "../../sudokuApi.js";
import { generatePuzzle, isGridComplete, gridMatches } from "../../sudokuEngine.js";

const DIFFICULTIES = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

function formatRemaining(ms) {
  if (ms <= 0) return "New puzzle any moment...";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours + "h " + minutes + "m left on this puzzle";
}

export default function Sudoku() {
  const { identity } = useAuth();
  const [sudokuActor, setSudokuActor] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [difficulty, setDifficulty] = useState("easy");
  const [grid, setGrid] = useState(null);
  const [alreadyWon, setAlreadyWon] = useState(false);
  const [justWon, setJustWon] = useState(false);
  const [myWins, setMyWins] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createSudokuActor(identity);
      setSudokuActor(a);
    })();
  }, [identity]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const refreshCycleAndStatus = useCallback(async () => {
    if (!sudokuActor) return;
    try {
      const c = await sudokuActor.getCurrentCycle();
      setCycle(c);
      const [won, wins] = await Promise.all([
        sudokuActor.haveIWon(difficulty),
        sudokuActor.getMyWins(),
      ]);
      setAlreadyWon(won);
      setMyWins(wins);
    } catch (e) {
      setError(String(e));
    }
  }, [sudokuActor, difficulty]);

  useEffect(() => {
    refreshCycleAndStatus();
  }, [refreshCycleAndStatus]);

  const puzzleData = useMemo(() => {
    if (!cycle) return null;
    return generatePuzzle(cycle.cycleId.toString(), difficulty);
  }, [cycle, difficulty]);

  useEffect(() => {
    if (!puzzleData) return;
    setGrid(puzzleData.puzzle.map((row) => row.slice()));
    setJustWon(false);
  }, [puzzleData]);

  const handleCellChange = async (r, c, value) => {
    if (!puzzleData || puzzleData.puzzle[r][c] !== 0) return;
    const digit = value.replace(/[^1-9]/g, "").slice(-1);
    const next = grid.map((row) => row.slice());
    next[r][c] = digit ? Number(digit) : 0;
    setGrid(next);

    if (
      !alreadyWon &&
      isGridComplete(next) &&
      gridMatches(next, puzzleData.solution) &&
      sudokuActor
    ) {
      try {
        const ok = await sudokuActor.recordWin(difficulty);
        if (ok) {
          setJustWon(true);
          setAlreadyWon(true);
          const wins = await sudokuActor.getMyWins();
          setMyWins(wins);
        }
      } catch (e2) {
        setError(String(e2));
      }
    }
  };

  const handleClear = () => {
    if (!puzzleData) return;
    setGrid(puzzleData.puzzle.map((row) => row.slice()));
    setJustWon(false);
  };

  const cycleEndMs = cycle ? Number(cycle.cycleEnd) / 1_000_000 : null;
  const remainingMs = cycleEndMs ? cycleEndMs - now : null;

  return (
    <div>
      <h1 className="page-title">Sudoku</h1>
      <p className="page-subtitle">
        A new puzzle every 36 hours. Solve it to earn a win.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              className={difficulty === d.key ? "nav-item nav-item-active" : "chat-send-button"}
              style={{ padding: "6px 14px" }}
              onClick={() => setDifficulty(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
        {myWins !== null && (
          <div className="coin-toss-result" style={{ padding: "6px 14px" }}>
            🏆 {myWins.toString()} {myWins.toString() === "1" ? "win" : "wins"}
          </div>
        )}
      </div>

      {remainingMs !== null && (
        <p className="tree-rel" style={{ marginBottom: 12 }}>{formatRemaining(remainingMs)}</p>
      )}

      {justWon && (
        <div className="coin-toss-result" style={{ marginBottom: 16 }}>
          🎉 Solved! You earned a win for {difficulty} difficulty.
        </div>
      )}
      {!justWon && alreadyWon && (
        <p className="tree-rel" style={{ marginBottom: 16 }}>
          You've already solved today's {difficulty} puzzle — nice work! Come back after the next puzzle drops.
        </p>
      )}

      {grid && puzzleData && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(9, minmax(28px, 44px))",
            gridTemplateRows: "repeat(9, minmax(28px, 44px))",
            gap: 0,
            border: "3px solid var(--text-dark)",
            width: "fit-content",
            marginBottom: 16,
          }}
        >
          {grid.map((row, r) =>
            row.map((val, c) => {
              const isGiven = puzzleData.puzzle[r][c] !== 0;
              return (
                <input
                  key={r + "-" + c}
                  value={val === 0 ? "" : val}
                  onChange={(e) => handleCellChange(r, c, e.target.value)}
                  disabled={isGiven || alreadyWon}
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    height: "100%",
                    textAlign: "center",
                    fontSize: 18,
                    fontWeight: isGiven ? 700 : 400,
                    background: isGiven ? "var(--off-white)" : "white",
                    color: isGiven ? "var(--text-dark)" : "var(--orange-dark)",
                    border: "1px solid #ccc",
                    borderTop: r % 3 === 0 ? "3px solid var(--text-dark)" : "1px solid #ccc",
                    borderLeft: c % 3 === 0 ? "3px solid var(--text-dark)" : "1px solid #ccc",
                    borderRight: c === 8 ? "3px solid var(--text-dark)" : "1px solid #ccc",
                    borderBottom: r === 8 ? "3px solid var(--text-dark)" : "1px solid #ccc",
                  }}
                />
              );
            })
          )}
        </div>
      )}

      {!alreadyWon && (
        <button className="tree-remove-btn" onClick={handleClear}>
          Clear my entries
        </button>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
