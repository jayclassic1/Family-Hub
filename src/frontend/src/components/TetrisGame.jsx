import { useState, useEffect, useRef, useCallback } from "react";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  createEmptyBoard,
  refillQueue,
  spawnPiece,
  getPieceColor,
  tryMove,
  tryRotate,
  hardDropRow,
  getGhostPiece,
  lockPiece,
  clearLines,
  scoreForLines,
  levelForLines,
  speedForLevel,
  pieceCells,
  isGameOver,
} from "../tetrisEngine.js";
import { playTetrisSound, lineClearSound } from "../tetrisSounds.js";
import { startTetrisMusic, stopTetrisMusic } from "../tetrisMusic.js";
import { useAuth } from "../context/AuthContext.jsx";
import { createTetrisActor } from "../tetrisApi.js";

// Module-level (not React state) so a game in progress survives leaving
// this page and coming back within the same browser session, resumed
// in a paused state.
let savedSession = null;

function makeInitialState() {
  const queue = refillQueue([]);
  const type = queue[0];
  return {
    board: createEmptyBoard(),
    piece: spawnPiece(type),
    queue: queue.slice(1),
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 0,
    gameOver: false,
    paused: false,
    clearingRows: [],
  };
}

function miniShape(type) {
  const shapes = {
    I: [[0, 0], [0, 1], [0, 2], [0, 3]],
    O: [[0, 1], [0, 2], [1, 1], [1, 2]],
    T: [[0, 1], [1, 0], [1, 1], [1, 2]],
    S: [[0, 1], [0, 2], [1, 0], [1, 1]],
    Z: [[0, 0], [0, 1], [1, 1], [1, 2]],
    J: [[0, 0], [1, 0], [1, 1], [1, 2]],
    L: [[0, 2], [1, 0], [1, 1], [1, 2]],
  };
  return shapes[type] || [];
}

function MiniPiece({ type }) {
  if (!type) {
    return <div className="tetris-mini-board" />;
  }
  const cells = miniShape(type);
  const color = getPieceColor(type);
  return (
    <div className="tetris-mini-board">
      {Array.from({ length: 8 }, (_, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const filled = cells.some(([cr, cc]) => cr === r && cc === c);
        return (
          <div
            key={i}
            className="tetris-mini-cell"
            style={{ background: filled ? color : "transparent" }}
          />
        );
      })}
    </div>
  );
}

export default function TetrisGame({ onGameOver, disabled }) {
  const { identity } = useAuth();
  const [started, setStarted] = useState(() => (savedSession ? savedSession.started : false));
  const [state, setState] = useState(() =>
    savedSession ? { ...savedSession.state, paused: true } : makeInitialState()
  );
  const [musicOn, setMusicOn] = useState(true);
  const dropTimerRef = useRef(null);
  const reportedRef = useRef(false);

  const doLock = useCallback((prev, piece) => {
    let board = lockPiece(prev.board, piece);
    let clearingRows = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (board[r].every((cell) => cell !== null)) clearingRows.push(r);
    }

    playTetrisSound("lock");

    if (clearingRows.length > 0) {
      const sound = lineClearSound(clearingRows.length);
      if (sound) setTimeout(() => playTetrisSound(sound), 120);
    }

    let nextQueue = refillQueue(prev.queue);
    const nextType = nextQueue[0];
    nextQueue = nextQueue.slice(1);
    const nextPiece = spawnPiece(nextType);
    const gameOver = isGameOver(board, nextPiece);
    if (gameOver) {
      setTimeout(() => playTetrisSound("gameOver"), 200);
    }

    return {
      ...prev,
      board,
      piece: nextPiece,
      queue: nextQueue,
      canHold: true,
      clearingRows,
      gameOver,
    };
  }, []);

  const tick = useCallback(() => {
    setState((prev) => {
      if (prev.gameOver || prev.paused || prev.clearingRows.length > 0) return prev;
      const moved = tryMove(prev.board, prev.piece, 1, 0);
      if (moved) {
        return { ...prev, piece: moved };
      }
      return doLock(prev, prev.piece);
    });
  }, [doLock]);

  // Persist progress across unmount (leaving the page) so it can resume,
  // paused, when the player comes back.
  useEffect(() => {
    return () => {
      if (started && !state.gameOver) {
        savedSession = { state, started };
      } else {
        savedSession = null;
      }
    };
  }, [started, state]);

  // Auto-pause when the tab/window loses visibility.
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden && started && !state.gameOver) {
        setState((prev) => ({ ...prev, paused: true }));
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [started, state.gameOver]);

  useEffect(() => {
    if (state.clearingRows.length > 0) {
      const t = setTimeout(() => {
        setState((prev) => {
          const { board: clearedBoard, linesCleared } = clearLines(prev.board);
          const newLines = prev.lines + linesCleared;
          const newLevel = levelForLines(newLines);
          const leveledUp = newLevel > prev.level;
          const gained = scoreForLines(linesCleared, prev.level);
          if (leveledUp) setTimeout(() => playTetrisSound("levelUp"), 50);
          return {
            ...prev,
            board: clearedBoard,
            lines: newLines,
            level: newLevel,
            score: prev.score + gained,
            clearingRows: [],
          };
        });
      }, 320);
      return () => clearTimeout(t);
    }
  }, [state.clearingRows]);

  useEffect(() => {
    if (!started || state.gameOver || disabled) return;
    if (state.clearingRows.length > 0) return;
    const speed = speedForLevel(state.level);
    dropTimerRef.current = setInterval(tick, speed);
    return () => clearInterval(dropTimerRef.current);
  }, [started, state.level, state.gameOver, state.paused, state.clearingRows.length, disabled, tick]);

  useEffect(() => {
    if (state.gameOver && !reportedRef.current) {
      reportedRef.current = true;
      if (onGameOver) onGameOver(state.score);
      if (identity && state.score > 0) {
        (async () => {
          try {
            const t = await createTetrisActor(identity);
            await t.recordHighScore(state.score);
          } catch (e) {}
        })();
      }
    }
  }, [state.gameOver, state.score, onGameOver, identity]);

  const handleKeyDown = useCallback(
    (e) => {
      if (disabled || state.gameOver || !started) return;
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "c", "C", "x", "X", "z", "Z", "p", "P"].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "p" || e.key === "P") {
        setState((prev) => ({ ...prev, paused: !prev.paused }));
        return;
      }
      if (state.paused) return;

      setState((prev) => {
        if (prev.gameOver || prev.clearingRows.length > 0) return prev;

        if (e.key === "ArrowLeft") {
          const moved = tryMove(prev.board, prev.piece, 0, -1);
          if (moved) { playTetrisSound("move"); return { ...prev, piece: moved }; }
          return prev;
        }
        if (e.key === "ArrowRight") {
          const moved = tryMove(prev.board, prev.piece, 0, 1);
          if (moved) { playTetrisSound("move"); return { ...prev, piece: moved }; }
          return prev;
        }
        if (e.key === "ArrowDown") {
          const moved = tryMove(prev.board, prev.piece, 1, 0);
          if (moved) {
            playTetrisSound("softDrop");
            return { ...prev, piece: moved, score: prev.score + 1 };
          }
          return doLock(prev, prev.piece);
        }
        if (e.key === "ArrowUp" || e.key === "x" || e.key === "X") {
          const rotated = tryRotate(prev.board, prev.piece);
          if (rotated) { playTetrisSound("rotate"); return { ...prev, piece: rotated }; }
          return prev;
        }
        if (e.key === " ") {
          const dropRow = hardDropRow(prev.board, prev.piece);
          const dropped = { ...prev.piece, row: dropRow };
          playTetrisSound("hardDrop");
          const bonus = dropRow - prev.piece.row;
          return doLock({ ...prev, score: prev.score + bonus * 2 }, dropped);
        }
        if (e.key === "c" || e.key === "C") {
          if (!prev.canHold) return prev;
          playTetrisSound("hold");
          if (prev.hold === null) {
            let nextQueue = refillQueue(prev.queue);
            const nextType = nextQueue[0];
            nextQueue = nextQueue.slice(1);
            return { ...prev, hold: prev.piece.type, piece: spawnPiece(nextType), queue: nextQueue, canHold: false };
          }
          return { ...prev, hold: prev.piece.type, piece: spawnPiece(prev.hold), canHold: false };
        }
        return prev;
      });
    },
    [disabled, state.gameOver, state.paused, started, doLock]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (musicOn && started && !state.gameOver && !state.paused) {
      startTetrisMusic();
    } else {
      stopTetrisMusic();
    }
    return () => stopTetrisMusic();
  }, [musicOn, started, state.gameOver, state.paused]);

  const ghost = state.gameOver || !started ? null : getGhostPiece(state.board, state.piece);
  const ghostCells = ghost ? pieceCells(ghost) : [];
  const pieceCellsList = state.gameOver || !started ? [] : pieceCells(state.piece);
  const pieceColor = getPieceColor(state.piece.type);

  const handleRestart = () => {
    reportedRef.current = false;
    savedSession = null;
    setState(makeInitialState());
    setStarted(true);
  };

  const handleStart = () => {
    setStarted(true);
  };

  const handleResume = () => {
    setState((prev) => ({ ...prev, paused: false }));
  };

  return (
    <div className="tetris-layout">
      <div className="tetris-sidebar">
        <div className="tetris-panel">
          <div className="tetris-panel-title">Hold</div>
          <MiniPiece type={state.hold} />
        </div>
        <div className="tetris-panel">
          <div className="tetris-panel-title">Score</div>
          <div className="tetris-score-value">{state.score}</div>
        </div>
        <div className="tetris-panel">
          <div className="tetris-panel-title">Lines / Level</div>
          <div className="tetris-score-value">{state.lines} / {state.level}</div>
        </div>
      </div>

      <div className="tetris-board-wrapper">
        <div className="tetris-board">
          {Array.from({ length: BOARD_HEIGHT }, (_, r) =>
            Array.from({ length: BOARD_WIDTH }, (_, c) => {
              const filledType = state.board[r][c];
              const isPieceCell = pieceCellsList.some(([pr, pc]) => pr === r && pc === c);
              const isGhostCell = !isPieceCell && ghostCells.some(([gr, gc]) => gr === r && gc === c);
              const isClearing = state.clearingRows.includes(r);
              let background = "transparent";
              let className = "tetris-cell";
              if (isPieceCell) {
                background = pieceColor;
                className += " tetris-cell-filled";
              } else if (filledType) {
                background = getPieceColor(filledType);
                className += " tetris-cell-filled";
              } else if (isGhostCell) {
                className += " tetris-cell-ghost";
              }
              if (isClearing) className += " tetris-cell-clearing";
              return <div key={r + "-" + c} className={className} style={{ background }} />;
            })
          )}
        </div>

        {!started && (
          <div className="tetris-gameover-overlay">
            <div style={{ fontSize: 24, fontWeight: 800 }}>🧱 Tetris</div>
            <div className="tree-rel" style={{ color: "#ccc", textAlign: "center", maxWidth: 200 }}>
              Stack the blocks, clear the lines, beat your score.
            </div>
            <button className="chat-send-button" onClick={handleStart} style={{ marginTop: 8 }}>
              Start Game
            </button>
          </div>
        )}

        {started && state.paused && !state.gameOver && (
          <div className="tetris-gameover-overlay">
            <div style={{ fontSize: 20, fontWeight: 800 }}>Paused</div>
            <div className="tree-rel" style={{ color: "#ccc" }}>Press P or click below to resume</div>
            <button className="chat-send-button" onClick={handleResume} style={{ marginTop: 8 }}>
              Resume
            </button>
          </div>
        )}

        {state.gameOver && (
          <div className="tetris-gameover-overlay">
            <div style={{ fontSize: 22, fontWeight: 800 }}>Game Over</div>
            <div style={{ fontSize: 16 }}>Score: {state.score}</div>
            {!disabled && (
              <button className="chat-send-button" onClick={handleRestart} style={{ marginTop: 8 }}>
                Play Again
              </button>
            )}
          </div>
        )}
      </div>

      <div className="tetris-sidebar">
        <div className="tetris-panel">
          <div className="tetris-panel-title">Next</div>
          <MiniPiece type={state.queue[0]} />
        </div>
        <div className="tetris-panel">
          <div className="tetris-panel-title">Controls</div>
          <div className="tetris-controls-hint">
            ← → move<br />
            ↓ soft drop<br />
            ↑ / X rotate<br />
            Space hard drop<br />
            C hold<br />
            P pause
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="chat-send-button"
            style={{ padding: "6px 10px", fontSize: 13, flex: 1 }}
            onClick={() => setState((prev) => ({ ...prev, paused: !prev.paused }))}
            disabled={!started || state.gameOver}
          >
            {state.paused ? "▶️ Resume" : "⏸️ Pause"}
          </button>
          <button
            className="chat-send-button"
            style={{ padding: "6px 10px", fontSize: 13, flex: 1 }}
            onClick={() => setMusicOn((prev) => !prev)}
          >
            {musicOn ? "🔊 Music" : "🔇 Music"}
          </button>
        </div>
      </div>
    </div>
  );
}
