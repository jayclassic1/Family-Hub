import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { playChatDing } from "../../soundEffects.js";
import { createScrabbleActor } from "../../scrabble.js";

function playTileClick() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 750;
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch (e) {}
}

const TILE_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, _: 0,
};

const TW = [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]];
const DW = [
  [1, 1], [2, 2], [3, 3], [4, 4], [1, 13], [2, 12], [3, 11], [4, 10],
  [13, 1], [12, 2], [11, 3], [10, 4], [13, 13], [12, 12], [11, 11], [10, 10],
];
const TL = [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]];
const DL = [
  [0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12],
  [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11],
];

const BONUS_MAP = (() => {
  const m = {};
  const set = (list, code) => list.forEach(([r, c]) => { m[r + "-" + c] = code; });
  set(TW, "TW");
  set(DW, "DW");
  set(TL, "TL");
  set(DL, "DL");
  m["7-7"] = "STAR";
  return m;
})();

const BONUS_LABEL = { TW: "3x\nWord", DW: "2x\nWord", TL: "3x\nLetter", DL: "2x\nLetter", STAR: "\u2605" };

// Client-side mirror of the backend's automatic scoring, used only to
// preview a turn's score before submitting. The backend recomputes it
// independently, so this never needs to be authoritative.
function previewTileAt(boardMap, pendingMap, r, c) {
  if (r < 0 || r > 14 || c < 0 || c > 14) return null;
  const key = r + "-" + c;
  if (pendingMap[key]) return pendingMap[key].letter;
  if (boardMap[key]) return boardMap[key];
  return null;
}

function previewWordScore(boardMap, pendingMap, startR, startC, dR, dC) {
  let r = startR;
  let c = startC;
  while (previewTileAt(boardMap, pendingMap, r - dR, c - dC) !== null) {
    r -= dR;
    c -= dC;
  }
  let wordMult = 1;
  let total = 0;
  let length = 0;
  while (true) {
    const letter = previewTileAt(boardMap, pendingMap, r, c);
    if (letter === null) break;
    let letterScore = TILE_VALUES[letter] || 0;
    const key = r + "-" + c;
    if (pendingMap[key]) {
      const bonus = BONUS_MAP[key];
      if (bonus === "DL") letterScore *= 2;
      if (bonus === "TL") letterScore *= 3;
      if (bonus === "DW" || bonus === "STAR") wordMult *= 2;
      if (bonus === "TW") wordMult *= 3;
    }
    total += letterScore;
    length += 1;
    r += dR;
    c += dC;
  }
  if (length <= 1) return 0;
  return total * wordMult;
}

function previewScoreFor(boardMap, pendingList) {
  if (pendingList.length === 0) return 0;
  const pendingMap = {};
  pendingList.forEach((p) => {
    pendingMap[p.row + "-" + p.col] = p;
  });
  let total = 0;
  if (pendingList.length === 1) {
    const p = pendingList[0];
    total += previewWordScore(boardMap, pendingMap, p.row, p.col, 0, 1);
    total += previewWordScore(boardMap, pendingMap, p.row, p.col, 1, 0);
  } else {
    const firstRow = pendingList[0].row;
    const firstCol = pendingList[0].col;
    const sameRow = pendingList.every((p) => p.row === firstRow);
    const sameCol = pendingList.every((p) => p.col === firstCol);
    if (sameRow) {
      total += previewWordScore(boardMap, pendingMap, firstRow, pendingList[0].col, 0, 1);
      pendingList.forEach((p) => {
        total += previewWordScore(boardMap, pendingMap, p.row, p.col, 1, 0);
      });
    } else if (sameCol) {
      total += previewWordScore(boardMap, pendingMap, pendingList[0].row, firstCol, 1, 0);
      pendingList.forEach((p) => {
        total += previewWordScore(boardMap, pendingMap, p.row, p.col, 0, 1);
      });
    }
  }
  if (pendingList.length === 7) total += 50;
  return total;
}

function statusLabel(status) {
  if ("waiting" in status) return "Waiting for players";
  if ("active" in status) return "In progress";
  return "Finished";
}

export default function ScrabbleBoard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState([]); // [{row, col, letter, rackIndex}]
  const [selectedRackIndex, setSelectedRackIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragRackIndex, setDragRackIndex] = useState(null);
  const [rackOrder, setRackOrder] = useState([]);
  const [chatText, setChatText] = useState("");
  const [justMovedIndex, setJustMovedIndex] = useState(null);
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeSelected, setExchangeSelected] = useState(new Set());
  const [disputePopup, setDisputePopup] = useState(null);
  const seenResolvedDisputes = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const [turnChangePopup, setTurnChangePopup] = useState(null);
  const prevTurnPlayerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const prevChatLengthRef = useRef(-1);

  const refresh = useCallback(async () => {
    if (!identity || !gameId) return;
    try {
      const actor = await createScrabbleActor(identity);
      const result = await actor.getGame(Number(gameId));
      const g = result.length > 0 ? result[0] : null;
      if (g) {
        const curTurnId = g.currentTurnPlayer.length > 0 ? g.currentTurnPlayer[0].toString() : null;
        if (isFirstLoadRef.current) {
          g.disputes.forEach((d) => {
            if (d.resolved) seenResolvedDisputes.current.add(d.turnId.toString());
          });
          prevTurnPlayerRef.current = curTurnId;
          isFirstLoadRef.current = false;
        } else {
          if (curTurnId !== null && curTurnId !== prevTurnPlayerRef.current) {
            const tp = g.players.find((p) => p.id.toString() === curTurnId);
            if (tp) {
              setTurnChangePopup(tp.name);
              setTimeout(() => setTurnChangePopup(null), 3000);
            }
          }
          prevTurnPlayerRef.current = curTurnId;
          g.disputes.forEach((d) => {
            const key = d.turnId.toString();
            if (d.resolved && !seenResolvedDisputes.current.has(key)) {
              seenResolvedDisputes.current.add(key);
              const t = g.turns.find((tt) => tt.id === d.turnId);
              setDisputePopup({ turnId: d.turnId, upheld: t ? t.upheld : d.outcome, coinFlipped: d.coinFlipped });
              setTimeout(() => {
                setDisputePopup((cur) => (cur && cur.turnId === d.turnId ? null : cur));
              }, 4000);
            }
          });
        }
      }
      setGame(g);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [identity, gameId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!game) return;
    const len = game.chat.length;
    const isFirst = prevChatLengthRef.current === -1;
    if (!isFirst && len > prevChatLengthRef.current) {
      playChatDing();
    }
    prevChatLengthRef.current = len;
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [game ? game.chat.length : 0]);

  const myPlayer = useMemo(() => {
    if (!game || !profile) return null;
    return game.players.find((p) => p.id.toString() === profile.id.toString()) || null;
  }, [game, profile]);

  const myRack = myPlayer && myPlayer.myRack.length > 0 ? myPlayer.myRack[0] : [];

  useEffect(() => {
    setRackOrder((prev) => {
      if (prev.length === myRack.length) return prev;
      return myRack.map((_, i) => i);
    });
  }, [myRack.length]);

  const isMyTurn =
    game &&
    game.currentTurnPlayer.length > 0 &&
    profile &&
    game.currentTurnPlayer[0].toString() === profile.id.toString();

  const boardTileAt = useMemo(() => {
    const m = {};
    if (game) {
      game.board.forEach((t) => {
        m[t.row + "-" + t.col] = t.letter;
      });
    }
    return m;
  }, [game]);

  const pendingTileAt = useMemo(() => {
    const m = {};
    pending.forEach((p) => {
      m[p.row + "-" + p.col] = p;
    });
    return m;
  }, [pending]);

  const usedRackIndexes = useMemo(() => new Set(pending.map((p) => p.rackIndex)), [pending]);

  const previewScore = useMemo(() => previewScoreFor(boardTileAt, pending), [boardTileAt, pending]);

  const toggleExchangeTile = (idx) => {
    setExchangeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleStartExchange = () => {
    setExchangeMode(true);
    setExchangeSelected(new Set());
  };

  const handleCancelExchange = () => {
    setExchangeMode(false);
    setExchangeSelected(new Set());
  };

  const handleConfirmExchange = async () => {
    if (!identity || exchangeSelected.size === 0) return;
    setBusy(true);
    try {
      const actor = await createScrabbleActor(identity);
      const letters = Array.from(exchangeSelected).map((idx) => myRack[idx]);
      await actor.exchangeTiles(Number(gameId), letters);
      setExchangeMode(false);
      setExchangeSelected(new Set());
      await refresh();
    } catch (e) {
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!identity) return;
    setBusy(true);
    try {
      const actor = await createScrabbleActor(identity);
      await actor.startGame(Number(gameId));
      await refresh();
    } catch (e) {
    } finally {
      setBusy(false);
    }
  };

  const placeAt = (row, col, rackIndex) => {
    if (!isMyTurn) return;
    if (boardTileAt[row + "-" + col]) return;
    if (pendingTileAt[row + "-" + col]) return;
    if (usedRackIndexes.has(rackIndex)) return;
    const letter = myRack[rackIndex];
    setPending((prev) => [...prev, { row, col, letter, rackIndex }]);
  };

  const handleRackTap = (rackIndex) => {
    if (!isMyTurn || usedRackIndexes.has(rackIndex)) return;
    setSelectedRackIndex(selectedRackIndex === rackIndex ? null : rackIndex);
  };

  const handleCellTap = (row, col) => {
    if (pendingTileAt[row + "-" + col]) {
      setPending((prev) => prev.filter((p) => !(p.row === row && p.col === col)));
      return;
    }
    if (selectedRackIndex === null) return;
    placeAt(row, col, selectedRackIndex);
    setSelectedRackIndex(null);
  };

  const handleDrop = (row, col) => {
    if (!isMyTurn || dragRackIndex === null) return;
    placeAt(row, col, dragRackIndex);
    setDragRackIndex(null);
  };

  const handleRackDragEnter = (targetIndex) => {
    if (dragRackIndex === null || dragRackIndex === targetIndex) return;
    let moved = false;
    setRackOrder((prev) => {
      const from = prev.indexOf(dragRackIndex);
      const to = prev.indexOf(targetIndex);
      if (from === -1 || to === -1 || from === to) return prev;
      moved = true;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, dragRackIndex);
      return next;
    });
    if (moved) {
      playTileClick();
      setJustMovedIndex(targetIndex);
      setTimeout(() => setJustMovedIndex(null), 220);
    }
  };

  const handleRackDrop = () => {
    setDragRackIndex(null);
  };

  const handleRecall = () => {
    setPending([]);
  };

  const handleSubmit = async () => {
    if (!identity || pending.length === 0) return;
    setBusy(true);
    try {
      const actor = await createScrabbleActor(identity);
      const placements = pending.map((p) => ({ row: p.row, col: p.col, letter: p.letter }));
      const ok = await actor.placeTiles(Number(gameId), placements);
      if (ok) {
        setPending([]);
      }
      await refresh();
    } catch (e) {
    } finally {
      setBusy(false);
    }
  };

  const handlePass = async () => {
    if (!identity) return;
    setBusy(true);
    try {
      const actor = await createScrabbleActor(identity);
      await actor.passTurn(Number(gameId));
      await refresh();
    } catch (e) {
    } finally {
      setBusy(false);
    }
  };

  const handleDispute = async (turnId) => {
    if (!identity) return;
    try {
      const actor = await createScrabbleActor(identity);
      await actor.disputeTurn(Number(gameId), turnId);
      await refresh();
    } catch (e) {}
  };

  const handleVote = async (turnId, uphold) => {
    if (!identity) return;
    try {
      const actor = await createScrabbleActor(identity);
      await actor.voteDispute(Number(gameId), turnId, uphold);
      await refresh();
    } catch (e) {}
  };

  const handleDeleteGame = async () => {
    if (!identity) return;
    if (!window.confirm("Delete this game for everyone? This can't be undone.")) return;
    try {
      const actor = await createScrabbleActor(identity);
      const ok = await actor.deleteGame(Number(gameId));
      if (ok) navigate("/games/scrabble");
    } catch (e) {}
  };

  const handleLeaveGame = async () => {
    if (!identity) return;
    if (!window.confirm("Leave this game?")) return;
    try {
      const actor = await createScrabbleActor(identity);
      const ok = await actor.leaveGame(Number(gameId));
      if (ok) navigate("/games/scrabble");
    } catch (e) {}
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!identity || !chatText.trim()) return;
    try {
      const actor = await createScrabbleActor(identity);
      await actor.sendGameChat(Number(gameId), chatText.trim());
      setChatText("");
      await refresh();
    } catch (e) {}
  };

  if (error) return <p className="auth-error">{error}</p>;
  if (!game) return <p className="chat-empty">Loading...</p>;

  const isWaiting = "waiting" in game.status;
  const isFinished = "finished" in game.status;

  const rows = Array.from({ length: 15 }, (_, r) => r);
  const cols = Array.from({ length: 15 }, (_, c) => c);

  return (
    <div className="scrabble-page">
      {disputePopup && (
        <div className="scrabble-dispute-popup">
          <strong>Dispute Resolved</strong>
          <p>
            {disputePopup.upheld ? "Turn upheld" : "Turn overturned"}
            {disputePopup.coinFlipped ? " \u2014 decided by coin flip! 🪙" : ""}
          </p>
        </div>
      )}
      {turnChangePopup && (
        <div className="scrabble-turn-popup">
          It\u2019s <strong>{turnChangePopup}</strong>\u2019s turn!
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <Link to="/games/scrabble" className="tree-rel" style={{ display: "inline-block", textDecoration: "none" }}>
          &larr; Back to Scrabble games
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          {profile && game.creator.toString() === profile.id.toString() && (
            <button className="scrabble-dispute-btn" onClick={handleDeleteGame}>
              Delete Game
            </button>
          )}
          {profile && game.players.some((p) => p.id.toString() === profile.id.toString()) && (
            <button className="tree-remove-btn" onClick={handleLeaveGame}>
              Leave Game
            </button>
          )}
        </div>
      </div>
      <h1 className="page-title" style={{ marginTop: 10 }}>{game.name}</h1>
      <p className="page-subtitle">{statusLabel(game.status)}</p>
      <p className="tree-rel" style={{ fontSize: 13 }}>(No Auto-Dictionary, Honour System only)</p>

      <div className="scrabble-scoreboard">
        {game.players.map((p) => {
          const isTurn =
            game.currentTurnPlayer.length > 0 && game.currentTurnPlayer[0].toString() === p.id.toString();
          return (
            <div key={p.id.toString()} className={"scrabble-score-chip" + (isTurn ? " scrabble-score-chip-active" : "")}>
              <span className="scrabble-score-name">{p.name}</span>
              <span className="scrabble-score-value">{p.score.toString()}</span>
            </div>
          );
        })}
        {!isFinished && <div className="scrabble-bag-chip">Bag: {game.bagCount.toString()}</div>}
      </div>

      {isWaiting && (
        <div className="scrabble-panel" style={{ marginBottom: 20 }}>
          <p className="tree-rel">Waiting for players ({game.players.length}/{game.maxPlayers}).</p>
          {profile && game.creator.toString() === profile.id.toString() && game.players.length >= 2 && (
            <button className="chat-send-button" onClick={handleStart} disabled={busy}>
              Start Game
            </button>
          )}
        </div>
      )}

      {!isWaiting && (
        <>
          <div className="scrabble-board">
            {rows.map((r) =>
              cols.map((c) => {
                const key = r + "-" + c;
                const boardLetter = boardTileAt[key];
                const pendingTile = pendingTileAt[key];
                const bonus = BONUS_MAP[key];
                const isSelectable = isMyTurn && !boardLetter && !pendingTile;
                return (
                  <div
                    key={key}
                    className={
                      "scrabble-cell" +
                      (bonus ? " scrabble-cell-" + bonus : "") +
                      (isSelectable ? " scrabble-cell-open" : "")
                    }
                    onClick={() => handleCellTap(r, c)}
                    onDragOver={(e) => isSelectable && e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isSelectable) handleDrop(r, c);
                    }}
                  >
                    {boardLetter ? (
                      <div className="scrabble-tile scrabble-tile-locked">
                        <span className="scrabble-tile-letter">{boardLetter}</span>
                        <span className="scrabble-tile-value">{TILE_VALUES[boardLetter] || 0}</span>
                      </div>
                    ) : pendingTile ? (
                      <div className="scrabble-tile scrabble-tile-pending">
                        <span className="scrabble-tile-letter">{pendingTile.letter}</span>
                        <span className="scrabble-tile-value">{TILE_VALUES[pendingTile.letter] || 0}</span>
                      </div>
                    ) : bonus ? (
                      <span className="scrabble-cell-label">{BONUS_LABEL[bonus]}</span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="scrabble-rack-row">
            <div className="scrabble-rack">
              {rackOrder.map((idx) =>
                usedRackIndexes.has(idx) ? (
                  <div key={idx} className="scrabble-tile-slot scrabble-tile-slot-empty" />
                ) : (
                  <div
                    key={idx}
                    className={
                      "scrabble-tile scrabble-tile-rack" +
                      (selectedRackIndex === idx ? " scrabble-tile-selected" : "") +
                      (dragRackIndex === idx ? " scrabble-tile-dragging" : "") +
                      (justMovedIndex === idx ? " scrabble-tile-bounce" : "") +
                      (exchangeSelected.has(idx) ? " scrabble-tile-exchange-selected" : "") +
                      (isMyTurn ? " scrabble-tile-glow" : "")
                    }
                    draggable={!exchangeMode}
                    onDragStart={() => setDragRackIndex(idx)}
                    onDragEnd={() => setDragRackIndex(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => handleRackDragEnter(idx)}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleRackDrop();
                    }}
                    onClick={() => (exchangeMode ? toggleExchangeTile(idx) : handleRackTap(idx))}
                  >
                    <span className="scrabble-tile-letter">{myRack[idx] === "_" ? "" : myRack[idx]}</span>
                    <span className="scrabble-tile-value">{TILE_VALUES[myRack[idx]] || 0}</span>
                  </div>
                )
              )}
            </div>

            {isMyTurn && !isFinished && (
              <div className="scrabble-turn-actions">
                {exchangeMode ? (
                  <>
                    <span className="tree-rel">Select tiles to exchange ({exchangeSelected.size})</span>
                    <button className="chat-send-button" onClick={handleConfirmExchange} disabled={busy || exchangeSelected.size === 0}>
                      Confirm Exchange
                    </button>
                    <button className="tree-remove-btn" onClick={handleCancelExchange} disabled={busy}>
                      Cancel
                    </button>
                  </>
                ) : pending.length > 0 ? (
                  <>
                    <span className="scrabble-score-preview">Score: {previewScore}</span>
                    <button className="chat-send-button" onClick={handleSubmit} disabled={busy}>
                      Submit Turn
                    </button>
                    <button className="tree-remove-btn" onClick={handleRecall} disabled={busy}>
                      Recall Tiles
                    </button>
                  </>
                ) : (
                  <>
                    <button className="chat-send-button" onClick={handlePass} disabled={busy}>
                      Pass
                    </button>
                    <button
                      className="tree-remove-btn"
                      onClick={handleStartExchange}
                      disabled={busy || game.bagCount < 7}
                      title={game.bagCount < 7 ? "Need at least 7 tiles left in the bag to exchange" : ""}
                    >
                      Exchange Tiles
                    </button>
                  </>
                )}
              </div>
            )}
            {!isMyTurn && !isFinished && <p className="tree-rel">Waiting for your turn...</p>}
          </div>
        </>
      )}

      {game.turns.length > 0 && (
        <div className="scrabble-panel" style={{ marginTop: 20 }}>
          <h2 className="tree-admin-title">Turn History</h2>
          {[...game.turns].reverse().map((t) => {
            const dispute = game.disputes.find((d) => d.turnId === t.id);
            const myVote = dispute && profile ? dispute.votes.find((v) => v[0].toString() === profile.id.toString()) : null;
            const isLastTurn = game.turns.length > 0 && t.id === game.turns[game.turns.length - 1].id;
            const canDispute = !t.passed && !t.disputed && profile && isLastTurn;
            return (
              <div key={t.id.toString()} className="scrabble-turn-row">
                <div>
                  <strong>{t.playerName}</strong>{" "}
                  {t.word ? "played \"" + t.word + "\" and " : ""}
                  {t.passed ? "passed" : "scored " + t.score.toString() + " points"}
                  {t.disputed && !t.resolved && <span className="scrabble-dispute-tag"> &mdash; disputed, vote open</span>}
                  {t.disputed && t.resolved && (
                    <span className="scrabble-dispute-tag">
                      {" "}
                      &mdash; {t.upheld ? "upheld" : "overturned"}
                      {dispute && dispute.coinFlipped ? " (coin flip)" : ""}
                    </span>
                  )}
                </div>
                {canDispute && (
                  <button className="scrabble-dispute-btn" onClick={() => handleDispute(t.id)}>
                    Dispute
                  </button>
                )}
                {dispute && !dispute.resolved && !myVote && (
                  <div className="scrabble-vote-row">
                    <button className="chat-send-button" onClick={() => handleVote(t.id, true)}>
                      Uphold
                    </button>
                    <button className="tree-remove-btn" onClick={() => handleVote(t.id, false)}>
                      Overturn
                    </button>
                  </div>
                )}
                {dispute && !dispute.resolved && myVote && <span className="tree-rel">Vote cast &mdash; waiting on others</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="scrabble-panel" style={{ marginTop: 20 }}>
        <h2 className="tree-admin-title">Table Chat</h2>
        <div className="scrabble-chat-messages" ref={chatContainerRef}>
          {game.chat.length === 0 ? (
            <p className="chat-empty">No messages yet.</p>
          ) : (
            game.chat.map((m) => (
              <div key={m.id.toString()} className="scrabble-chat-msg">
                <strong>{m.senderName}:</strong> {m.text}
              </div>
            ))
          )}
        </div>
        <form onSubmit={handleSendChat} style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            className="chat-text-input"
            style={{ flex: 1 }}
            placeholder="Say something..."
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
          />
          <button className="chat-send-button" type="submit" disabled={!chatText.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
