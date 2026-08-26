import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createPokerActor, cardLabel, isRedSuit, phaseKey } from "../../pokerApi.js";
import { playPokerSound } from "../../pokerSounds.js";

const PHASE_LABELS = {
  waiting: "Waiting for players",
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  handComplete: "Hand complete",
};

function nextOccupiedIndex(seats, from, maxSeats) {
  for (let i = 1; i <= maxSeats; i++) {
    const idx = (from + i) % maxSeats;
    if (seats[idx] && seats[idx].length > 0) return idx;
  }
  return null;
}

function CardChip({ card, faceDown }) {
  if (faceDown) {
    return <span className="poker-card-back" />;
  }
  return (
    <span className={"poker-card " + (isRedSuit(card) ? "poker-card-red" : "poker-card-black")}>
      {cardLabel(card)}
    </span>
  );
}

function SeatSlot({ seatOpt, seatIndex, table, myIdx, onJoin, isBettingPhase, sbIdx, bbIdx, winnerIdxs, loserIdxs }) {
  if (seatOpt.length === 0) {
    return (
      <div className="poker-seat-empty">
        <p className="tree-rel" style={{ margin: 0 }}>Empty seat</p>
        {myIdx === null && (
          <button className="chat-send-button" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => onJoin(seatIndex)}>
            Join
          </button>
        )}
      </div>
    );
  }
  const seat = seatOpt[0];
  const isDealer = Number(table.dealerSeat) === seatIndex;
  const isToAct = Number(table.toActSeat) === seatIndex && isBettingPhase;
  const isMe = myIdx === seatIndex;
  const isWinner = winnerIdxs.includes(seatIndex);
  const isLoser = loserIdxs.includes(seatIndex);

  let seatClass = "poker-seat";
  if (isWinner) seatClass += " poker-seat-winner";
  else if (isLoser) seatClass += " poker-seat-loser";
  else if (isToAct) seatClass += " poker-seat-active";
  else if (seatIndex === bbIdx) seatClass += " poker-seat-bb";
  else if (seatIndex === sbIdx) seatClass += " poker-seat-sb";
  if (isMe) seatClass += " poker-seat-me";

  return (
    <div className={seatClass}>
      <div className="poker-seat-name">
        {seat.playerName}
        {isDealer && <span className="poker-dealer-chip">D</span>}
        {seatIndex === sbIdx && <span className="poker-badge-sb">SB</span>}
        {seatIndex === bbIdx && <span className="poker-badge-bb">BB</span>}
        {isMe && <span className="tree-rel">(you)</span>}
      </div>
      <div className="poker-stack">{seat.stack.toString()} Love</div>
      <div style={{ marginBottom: 6 }}>
        {seat.folded && <span className="poker-status-tag poker-status-folded">Folded</span>}
        {seat.allIn && <span className="poker-status-tag poker-status-allin">All-in</span>}
        {seat.betThisRound > 0 && <span className="poker-status-tag poker-status-bet">Bet {seat.betThisRound.toString()}</span>}
      </div>
      <div>
        {seat.holeCards.length > 0
          ? seat.holeCards.map((c, i) => <CardChip key={i} card={c} />)
          : seat.inHand ? [0, 1].map((i) => <CardChip key={i} faceDown />) : null}
      </div>
    </div>
  );
}

export default function PokerTable() {
  const { tableId } = useParams();
  const { identity, profile } = useAuth();
  const [pokerActor, setPokerActor] = useState(null);
  const [table, setTable] = useState(null);
  const [raiseInput, setRaiseInput] = useState("");
  const [joinSeatIndex, setJoinSeatIndex] = useState(null);
  const [buyInInput, setBuyInInput] = useState("20");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [toast, setToast] = useState(null);

  const numericTableId = Number(tableId);
  const prevPhaseRef = useRef(null);
  const prevWinnerTextRef = useRef("");
  const prevSnapshotRef = useRef(null);
  const lastLocalActionRef = useRef(null);

  const fireFlash = (color) => {
    setFlash(color);
    setTimeout(() => setFlash(null), 650);
  };

  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const p = await createPokerActor(identity);
      setPokerActor(p);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!pokerActor) return;
    try {
      const result = await pokerActor.getTable(numericTableId);
      setTable(result.length > 0 ? result[0] : null);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [pokerActor, numericTableId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  // Detect shared table-wide events (street changes, new hands, hand
  // endings) by diffing against the previously seen phase, so sound and
  // light effects fire for everyone watching, not just whoever acted.
  useEffect(() => {
    if (!table) return;
    const phase = phaseKey(table.phase);
    const prevPhase = prevPhaseRef.current;
    const phaseChanged = prevPhase !== null && prevPhase !== phase;

    if (phaseChanged) {
      if (phase === "preflop" && (prevPhase === "waiting" || prevPhase === "handComplete")) {
        playPokerSound("newHand");
        fireFlash("poker-flash-green");
        if (prevPhase === "waiting") fireToast("🃏 Your poker game has started!");
      } else if (phase === "flop") {
        playPokerSound("flop");
        fireFlash("poker-flash-blue");
      } else if (phase === "turn") {
        playPokerSound("turn");
        fireFlash("poker-flash-blue");
      } else if (phase === "river") {
        playPokerSound("river");
        fireFlash("poker-flash-blue");
      } else if (phase === "handComplete" || phase === "showdown") {
        playPokerSound("endOfHand");
        const won = profile && table.winnerText && table.winnerText.includes(profile.username || "\u0000");
        fireFlash(won ? "poker-flash-gold" : "poker-flash-white");
      }
    } else if (prevSnapshotRef.current) {
      // Same phase as last poll — diff individual seats to catch other
      // players' actions (fold/check/call/raise/all-in), so everyone at
      // the table hears them, not just the person who acted.
      const prev = prevSnapshotRef.current;
      const currentBetChanged = Number(table.currentBet) !== Number(prev.currentBet);
      const skipIdx = lastLocalActionRef.current;
      table.seats.forEach((seatOpt, i) => {
        if (i === skipIdx) return;
        const prevOpt = prev.seats[i];
        if (seatOpt.length === 0 || !prevOpt || prevOpt.length === 0) return;
        const seat = seatOpt[0];
        const prevSeat = prevOpt[0];
        const newBet = Number(seat.betThisRound);
        const oldBet = Number(prevSeat.betThisRound);

        if (seat.folded && !prevSeat.folded) {
          playPokerSound("fold");
        } else if (seat.allIn && !prevSeat.allIn && newBet > oldBet) {
          playPokerSound("allIn");
        } else if (newBet > oldBet) {
          playPokerSound(currentBetChanged ? "raise" : "call");
        } else if (seat.hasActed && !prevSeat.hasActed && newBet === oldBet) {
          playPokerSound("check");
        }
      });
    }

    prevPhaseRef.current = phase;
    prevWinnerTextRef.current = table.winnerText;
    prevSnapshotRef.current = { seats: table.seats, currentBet: table.currentBet };
    lastLocalActionRef.current = null;
  }, [table, profile]);

  if (!table) {
    return (
      <div>
        <Link to="/games/poker" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
          &lt; Back to Poker
        </Link>
        <p className="chat-empty">Loading table...</p>
      </div>
    );
  }

  let myIdx = null;
  table.seats.forEach((s, i) => {
    if (s.length > 0 && profile && s[0].player.toString() === profile.id.toString()) myIdx = i;
  });

  const phase = phaseKey(table.phase);
  const isBettingPhase = ["preflop", "flop", "turn", "river"].includes(phase);
  const myTurn = myIdx !== null && Number(table.toActSeat) === myIdx && isBettingPhase;
  const mySeat = myIdx !== null ? table.seats[myIdx][0] : null;
  const toCall = mySeat && Number(table.currentBet) > Number(mySeat.betThisRound)
    ? Number(table.currentBet) - Number(mySeat.betThisRound) : 0;
  const minRaiseTo = Number(table.currentBet) + 2;
  const maxRaiseTo = mySeat ? Number(mySeat.stack) + Number(mySeat.betThisRound) : 0;
  const maxSeats = Number(table.maxSeats);

  const sbIdx = isBettingPhase || phase === "handComplete" ? nextOccupiedIndex(table.seats, Number(table.dealerSeat), maxSeats) : null;
  const bbIdx = sbIdx !== null ? nextOccupiedIndex(table.seats, sbIdx, maxSeats) : null;

  const winnerIdxs = [];
  const loserIdxs = [];
  if (phase === "handComplete" && table.winnerText) {
    table.seats.forEach((s, i) => {
      if (s.length === 0) return;
      const name = s[0].playerName;
      if (table.winnerText.includes(name)) {
        winnerIdxs.push(i);
      } else if (s[0].holeCards.length > 0 || s[0].folded) {
        loserIdxs.push(i);
      }
    });
  }

  const toActPlayerName = (() => {
    const s = table.seats[Number(table.toActSeat)];
    return s && s.length > 0 ? s[0].playerName : null;
  })();

  const handleJoin = (seatIndex) => {
    setJoinSeatIndex(seatIndex);
    setBuyInInput("20");
  };

  const confirmJoin = async () => {
    if (!pokerActor || joinSeatIndex === null) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await pokerActor.joinTable(numericTableId, joinSeatIndex, Number(buyInInput));
      if (!ok) setError("Could not join — check you have enough Love and the seat is still open.");
      setJoinSeatIndex(null);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleAct = async (kind, amount) => {
    if (!pokerActor) return;
    setBusy(true);
    setError(null);
    try {
      const isAllIn = kind === "bet" && amount >= maxRaiseTo && maxRaiseTo > 0;
      const ok = await pokerActor.act(numericTableId, kind, amount || 0);
      if (ok) {
        if (isAllIn) playPokerSound("allIn");
        else if (kind === "bet") playPokerSound("raise");
        else if (kind === "call") playPokerSound("call");
        else playPokerSound(kind);
        lastLocalActionRef.current = myIdx;
      } else {
        setError("That action wasn't allowed — table may have moved on.");
      }
      setRaiseInput("");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!pokerActor) return;
    setBusy(true);
    setError(null);
    try {
      await pokerActor.leaveTable(numericTableId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleNextHand = async () => {
    if (!pokerActor) return;
    setBusy(true);
    setError(null);
    try {
      await pokerActor.startNextHand(numericTableId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSkipInactive = async () => {
    if (!pokerActor) return;
    setBusy(true);
    setError(null);
    try {
      await pokerActor.skipInactivePlayer(numericTableId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const topSeats = maxSeats > 4 ? table.seats.slice(0, 4) : table.seats.slice(0, maxSeats);
  const bottomSeats = maxSeats > 4 ? table.seats.slice(4, maxSeats) : [];

  const renderRow = (seatsSlice, offset) => (
    <div className="poker-row">
      {seatsSlice.map((seatOpt, i) => (
        <SeatSlot
          key={offset + i}
          seatOpt={seatOpt}
          seatIndex={offset + i}
          table={table}
          myIdx={myIdx}
          onJoin={handleJoin}
          isBettingPhase={isBettingPhase}
          sbIdx={sbIdx}
          bbIdx={bbIdx}
          winnerIdxs={winnerIdxs}
          loserIdxs={loserIdxs}
        />
      ))}
    </div>
  );

  return (
    <div>
      {flash && <div className={"poker-flash-overlay poker-flash-active " + flash} />}
      {toast && <div className="poker-toast">{toast}</div>}

      <Link to="/games/poker" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Poker
      </Link>

      <h1 className="page-title">{table.name}</h1>
      <p className="page-subtitle">{PHASE_LABELS[phase] || phase} — Hand #{table.handNumber.toString()}</p>

      {table.winnerText && (
        <div className="coin-toss-result" style={{ marginBottom: 16 }}>{table.winnerText}</div>
      )}

      {renderRow(topSeats, 0)}

      <div className="poker-felt" style={{ margin: "12px 0" }}>
        <div className="poker-pot-badge">💰 Pot: {table.pot.toString()} Love</div>
        <div>
          {table.community.map((c, i) => <CardChip key={i} card={c} />)}
          {table.community.length === 0 && <span className="poker-community-empty">No community cards yet</span>}
        </div>
      </div>

      {bottomSeats.length > 0 && renderRow(bottomSeats, 4)}

      {joinSeatIndex !== null && (
        <div className="tree-admin-panel" style={{ marginBottom: 16, marginTop: 16 }}>
          <p className="tree-rel" style={{ marginBottom: 8 }}>Buy in for seat {joinSeatIndex + 1} (20-50 Love):</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="chat-text-input"
              style={{ width: 100 }}
              type="number"
              min={20}
              max={50}
              value={buyInInput}
              onChange={(e) => setBuyInInput(e.target.value)}
            />
            <button className="chat-send-button" onClick={confirmJoin} disabled={busy}>Confirm buy-in</button>
            <button className="tree-remove-btn" onClick={() => setJoinSeatIndex(null)}>Cancel</button>
          </div>
        </div>
      )}

      {myIdx !== null && (
        <>
          {isBettingPhase && myTurn && !mySeat.folded && !mySeat.allIn && (
            <div className="tree-admin-panel" style={{ marginBottom: 16, marginTop: 16 }}>
              <p className="tree-rel" style={{ marginBottom: 10 }}>Your turn.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <button className="tree-remove-btn" onClick={() => handleAct("fold", 0)} disabled={busy}>Fold</button>
                {toCall === 0 ? (
                  <button className="chat-send-button" onClick={() => handleAct("check", 0)} disabled={busy}>Check</button>
                ) : (
                  <button className="chat-send-button" onClick={() => handleAct("call", 0)} disabled={busy}>Call {toCall}</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="chat-text-input"
                  style={{ width: 100 }}
                  type="number"
                  min={minRaiseTo}
                  max={maxRaiseTo}
                  placeholder="Raise to..."
                  value={raiseInput}
                  onChange={(e) => setRaiseInput(e.target.value)}
                />
                <button
                  className="chat-send-button"
                  onClick={() => handleAct("bet", Number(raiseInput))}
                  disabled={busy || !raiseInput || Number(raiseInput) < minRaiseTo || Number(raiseInput) > maxRaiseTo}
                >
                  Bet / Raise
                </button>
                <button className="chat-send-button" onClick={() => handleAct("bet", maxRaiseTo)} disabled={busy}>
                  All-in ({maxRaiseTo})
                </button>
              </div>
            </div>
          )}

          {isBettingPhase && !myTurn && toActPlayerName && (
            <div style={{ marginBottom: 16, marginTop: 16 }}>
              <p className="tree-rel">Waiting for {toActPlayerName}...</p>
              <button className="tree-remove-btn" onClick={handleSkipInactive} disabled={busy}>
                Skip inactive player
              </button>
            </div>
          )}

          {phase === "handComplete" && (
            <button className="chat-send-button" style={{ marginBottom: 16, marginTop: 16 }} onClick={handleNextHand} disabled={busy}>
              Start Next Hand
            </button>
          )}

          <div>
            <button className="tree-remove-btn" onClick={handleLeave} disabled={busy}>
              Leave Table (cash out {mySeat.stack.toString()} Love)
            </button>
          </div>
        </>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
