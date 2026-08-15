import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Chess } from "chess.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { createChessActor, statusToVariant, statusLabel } from "../../chessApi.js";
import { playChessSound, playChessCaptureSound } from "../../chessSounds.js";
import ShareToChatButton from "../../components/ShareToChatButton.jsx";

const PIECE_UNICODE = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

function kingSquare(chess, color) {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.type === "k" && p.color === color) {
        return FILES[f] + RANKS[r];
      }
    }
  }
  return null;
}

export default function ChessBoard() {
  const { gameId } = useParams();
  const { identity, profile } = useAuth();
  const [chessActor, setChessActor] = useState(null);
  const [game, setGame] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [captureFlashSquare, setCaptureFlashSquare] = useState(null);
  const [endFlash, setEndFlash] = useState(null);
  const chessRef = useRef(new Chess());
  const numericGameId = Number(gameId);
  const prevFenRef = useRef(null);
  const prevMoveCountRef = useRef(null);
  const localMoveJustPlayedRef = useRef(false);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const c = await createChessActor(identity);
      setChessActor(c);
    })();
  }, [identity]);

  const applyMoveEffects = useCallback((moveResult, resultingChess, statusKey) => {
    setLastMove({ from: moveResult.from, to: moveResult.to });
    if (moveResult.captured) {
      setCaptureFlashSquare(moveResult.to);
      setTimeout(() => setCaptureFlashSquare(null), 500);
    }
    const inCheck = resultingChess.isCheck();
    if (inCheck) {
      const turnColor = resultingChess.turn();
      setCheckSquare(kingSquare(resultingChess, turnColor));
    } else {
      setCheckSquare(null);
    }

    if (statusKey === "whiteWon" || statusKey === "blackWon") {
      playChessSound("checkmate");
      const iWon = profile && (
        (statusKey === "whiteWon" && game && game.white.toString() === profile.id.toString()) ||
        (statusKey === "blackWon" && game && game.black.length > 0 && game.black[0].toString() === profile.id.toString())
      );
      setEndFlash(iWon ? "chess-flash-gold" : "chess-flash-grey");
      setTimeout(() => setEndFlash(null), 1000);
      setTimeout(() => playChessSound(iWon ? "win" : "draw"), 500);
    } else if (statusKey === "draw") {
      playChessSound("draw");
      setEndFlash("chess-flash-grey");
      setTimeout(() => setEndFlash(null), 1000);
    } else if (moveResult.san && moveResult.san.includes("#")) {
      // covered by checkmate branch above
    } else if (inCheck) {
      playChessSound("check");
    } else if (moveResult.captured) {
      playChessCaptureSound(moveResult.piece, moveResult.captured);
    } else {
      playChessSound("move");
    }
  }, [profile, game]);

  const refresh = useCallback(async () => {
    if (!chessActor) return;
    try {
      const result = await chessActor.getGame(numericGameId);
      if (result.length === 0) return;
      const newGame = result[0];
      const newMoveCount = newGame.moveHistory.length;

      if (
        !localMoveJustPlayedRef.current &&
        prevFenRef.current !== null &&
        prevMoveCountRef.current !== null &&
        newMoveCount > prevMoveCountRef.current
      ) {
        // Someone else's move landed since our last poll — replay it on a
        // scratch board to get the from/to squares for effects + sound.
        try {
          const scratch = new Chess(prevFenRef.current);
          const lastSan = newGame.moveHistory[newMoveCount - 1];
          const moveResult = scratch.move(lastSan);
          if (moveResult) {
            const statusKey = Object.keys(newGame.status)[0];
            applyMoveEffects(moveResult, scratch, statusKey);
          }
        } catch (replayErr) {
          // If replay fails for any reason, just skip effects silently.
        }
      }

      setGame(newGame);
      chessRef.current.load(newGame.fen);
      prevFenRef.current = newGame.fen;
      prevMoveCountRef.current = newMoveCount;
      localMoveJustPlayedRef.current = false;
    } catch (e) {
      setError(String(e));
    }
  }, [chessActor, numericGameId, applyMoveEffects]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!game) return <p className="chat-empty">Loading...</p>;

  const hasBlack = game.black.length > 0;
  const isWhitePlayer = profile && game.white.toString() === profile.id.toString();
  const isBlackPlayer = profile && hasBlack && game.black[0].toString() === profile.id.toString();
  const isMyTurn =
    (game.turnIsWhite && isWhitePlayer) || (!game.turnIsWhite && isBlackPlayer);
  const gameOngoing = Object.keys(game.status)[0] === "ongoing";
  const isParticipant = isWhitePlayer || isBlackPlayer;

  const handleSquareClick = async (square) => {
    if (!chessActor || !isMyTurn || !gameOngoing || submitting || !hasBlack) return;
    const chess = chessRef.current;

    if (!selectedSquare) {
      const piece = chess.get(square);
      if (!piece) return;
      const isMyPiece = (isWhitePlayer && piece.color === "w") || (isBlackPlayer && piece.color === "b");
      if (!isMyPiece) return;
      const moves = chess.moves({ square, verbose: true });
      if (moves.length === 0) return;
      setSelectedSquare(square);
      setLegalTargets(moves.map((m) => m.to));
      playChessSound("select");
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }

    if (!legalTargets.includes(square)) {
      const piece = chess.get(square);
      const isMyPiece = piece && ((isWhitePlayer && piece.color === "w") || (isBlackPlayer && piece.color === "b"));
      if (isMyPiece) {
        const moves = chess.moves({ square, verbose: true });
        setSelectedSquare(square);
        setLegalTargets(moves.map((m) => m.to));
        playChessSound("select");
      } else {
        setSelectedSquare(null);
        setLegalTargets([]);
      }
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
      if (!move) {
        setSelectedSquare(null);
        setLegalTargets([]);
        setSubmitting(false);
        return;
      }
      let newStatus = "ongoing";
      if (chess.isCheckmate()) {
        newStatus = move.color === "w" ? "whiteWon" : "blackWon";
      } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
        newStatus = "draw";
      }
      localMoveJustPlayedRef.current = true;
      applyMoveEffects(move, chess, newStatus);
      await chessActor.makeMove(numericGameId, chess.fen(), move.san, statusToVariant(newStatus));
      setSelectedSquare(null);
      setLegalTargets([]);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResign = async () => {
    if (!chessActor) return;
    setError(null);
    try {
      await chessActor.resign(numericGameId);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleJoin = async () => {
    if (!chessActor) return;
    setError(null);
    try {
      const ok = await chessActor.joinGame(numericGameId);
      if (!ok) setError("Could not join this game.");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const board = chessRef.current.board();
  const meText = profile ? profile.id.toString() : null;
  const canJoin =
    !hasBlack &&
    meText &&
    game.white.toString() !== meText &&
    (game.isOpen || (game.invitedPlayer.length > 0 && game.invitedPlayer[0].toString() === meText));

  return (
    <div>
      {endFlash && <div className={"chess-endgame-flash chess-flash-active " + endFlash} />}

      <Link to="/games/chess" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Chess
      </Link>

      <h1 className="page-title" style={{ textAlign: "center" }}>
        {game.whiteName} (White) vs {hasBlack ? game.blackName[0] + " (Black)" : "waiting for opponent"}
      </h1>
      <p className="page-subtitle" style={{ textAlign: "center" }}>{statusLabel(game.status)}</p>
      {game.wager > 0 && (
        <p className="page-subtitle" style={{ textAlign: "center" }}>
          💰 Wager: {game.wager.toString()} Love each — pot: {(Number(game.wager) * 2).toString()} Love
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <ShareToChatButton
          shareType="chess"
          shareTitle={game.whiteName + " vs " + (hasBlack ? game.blackName[0] : "?") + " — " + statusLabel(game.status)}
          shareLink={"/games/chess/" + gameId}
          compact
        />
      </div>

      {canJoin && (
        <div className="tree-admin-panel" style={{ marginBottom: 16, maxWidth: 624, marginLeft: "auto", marginRight: "auto" }}>
          <p style={{ margin: "0 0 10px" }}>
            {game.isOpen ? "This is an open game — join as Black?" : "You've been invited to play Black."}
          </p>
          <button className="chat-send-button" onClick={handleJoin}>Join as Black</button>
        </div>
      )}

      {!hasBlack && !canJoin && (
        <p className="tree-rel" style={{ marginBottom: 10, textAlign: "center" }}>
          Waiting for {game.isOpen ? "someone to join" : (game.invitedName[0] || "the invited player") + " to join"}...
        </p>
      )}

      {hasBlack && gameOngoing && isParticipant && (
        <p className="tree-rel" style={{ marginBottom: 10, textAlign: "center" }}>
          {isMyTurn ? "Your turn." : "Waiting for opponent..."}
        </p>
      )}

      {hasBlack && !isParticipant && (
        <p className="tree-rel" style={{ marginBottom: 10, textAlign: "center" }}>You're spectating this game.</p>
      )}

      <div className="chess-layout">
        <div className="chess-board">
          {(isBlackPlayer ? [1, 2, 3, 4, 5, 6, 7, 8] : RANKS).map((rank) =>
            (isBlackPlayer ? [...FILES].reverse() : FILES).map((file) => {
              const rIdx = 8 - rank;
              const fIdx = FILES.indexOf(file);
              const square = file + rank;
              const piece = board[rIdx][fIdx];
              const isLight = (rIdx + fIdx) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isTarget = legalTargets.includes(square);
              const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
              const isCheck = checkSquare === square;
              const isCaptureFlash = captureFlashSquare === square;
              return (
                <div
                  key={square}
                  className={
                    "chess-square" +
                    (isLight ? " chess-square-light" : " chess-square-dark") +
                    (isLastMove ? " chess-square-lastmove" : "") +
                    (isSelected ? " chess-square-selected" : "") +
                    (isTarget ? " chess-square-target" : "") +
                    (isCheck ? " chess-square-check" : "") +
                    (isCaptureFlash ? " chess-square-capture-flash" : "")
                  }
                  onClick={() => handleSquareClick(square)}
                >
                  {piece && (
                    <span className={"chess-piece" + (piece.color === "w" ? " chess-piece-white" : " chess-piece-black")}>
                      {PIECE_UNICODE[piece.color === "w" ? piece.type.toUpperCase() : piece.type]}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="chess-sidebar">
          <div className="tree-admin-panel">
            <h2 className="tree-admin-title">Moves</h2>
            <div className="chess-move-list">
              {game.moveHistory.length === 0 && <p className="chat-empty">No moves yet.</p>}
              {game.moveHistory.map((m, i) => (
                <span key={i} className="chess-move">
                  {i % 2 === 0 ? Math.floor(i / 2) + 1 + ". " : ""}{m}{" "}
                </span>
              ))}
            </div>
            {gameOngoing && isParticipant && hasBlack && (
              <button className="tree-remove-btn" style={{ marginTop: 14 }} onClick={handleResign}>
                Resign
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
