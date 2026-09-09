import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { playChatDing } from "../../soundEffects.js";
import { createRouletteActor } from "../../roulette.js";

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const CHIP_VALUES = [1, 5, 10, 25, 50, 100];

const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const SEGMENT_ANGLE = 360 / WHEEL_ORDER.length;

function angleForNumber(n) {
  return WHEEL_ORDER.indexOf(n) * SEGMENT_ANGLE;
}

function buildWheelGradient() {
  const stops = WHEEL_ORDER.map((n, i) => {
    const color = n === 0 ? "#1a7a3c" : RED_NUMBERS.has(n) ? "#b8302a" : "#161616";
    const start = i * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
    const end = start + SEGMENT_ANGLE;
    return color + " " + start + "deg " + end + "deg";
  });
  return "conic-gradient(" + stops.join(", ") + ")";
}
const WHEEL_GRADIENT = buildWheelGradient();

const CELL_PX = 46;
const GAP_PX = 3;
const ZERO_W_PX = 50;
const GRID_PAD_PX = 10;

function colLeftPx(col) {
  return GRID_PAD_PX + ZERO_W_PX + GAP_PX + (col - 1) * (CELL_PX + GAP_PX);
}

function rowTopPx(gridRow) {
  return GRID_PAD_PX + (gridRow - 1) * (CELL_PX + GAP_PX);
}

function numberAt(gridRow, col) {
  return 3 * col - gridRow + 1;
}

function buildSplitZones() {
  const zones = [];
  for (let gridRow = 1; gridRow <= 3; gridRow++) {
    for (let col = 1; col <= 11; col++) {
      zones.push({ a: numberAt(gridRow, col), b: numberAt(gridRow, col + 1), orientation: "h", gridRow, col });
    }
  }
  for (let col = 1; col <= 12; col++) {
    for (let gridRow = 1; gridRow <= 2; gridRow++) {
      zones.push({ a: numberAt(gridRow, col), b: numberAt(gridRow + 1, col), orientation: "v", gridRow, col });
    }
  }
  return zones;
}
const SPLIT_ZONES = buildSplitZones();

function numberColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

function classifySelection(numbers) {
  const arr = [...numbers].sort((a, b) => a - b);
  if (arr.length === 2) return { kind: "split", label: "Split " + arr.join("-") };
  if (arr.length === 3) return { kind: "street", label: "Street " + arr.join("-") };
  if (arr.length === 4) return { kind: "corner", label: "Corner " + arr.join("-") };
  if (arr.length === 6) return { kind: "line", label: "Line " + arr.join("-") };
  return { kind: "straight", label: String(arr[0] ?? "") };
}

function playRollTick(ctx) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 280 + Math.random() * 160;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

function playLandSound(ctx) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {}
}

export default function RouletteTable() {
  const { identity, profile } = useAuth();
  const [actor, setActor] = useState(null);
  const [table, setTable] = useState(null);
  const [chat, setChat] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [chipValue, setChipValue] = useState(5);
  const [draggedChip, setDraggedChip] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [chatText, setChatText] = useState("");
  const chatContainerRef = useRef(null);
  const prevChatLengthRef = useRef(-1);
  const placingRef = useRef(false);
  const [ballAngle, setBallAngle] = useState(0);
  const [ballSpinning, setBallSpinning] = useState(false);
  const prevPhaseRef = useRef("idle");
  const audioCtxRef = useRef(null);
  const rollIntervalRef = useRef(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  };

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createRouletteActor(identity);
      setActor(a);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!actor) return;
    try {
      const [state, chatMsgs] = await Promise.all([actor.getTableState(), actor.getChat()]);
      setTable(state);
      setChat(chatMsgs);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [actor]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const len = chat.length;
    const isFirst = prevChatLengthRef.current === -1;
    if (!isFirst && len > prevChatLengthRef.current) {
      playChatDing();
    }
    prevChatLengthRef.current = len;
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chat.length]);

  const phase = table ? Object.keys(table.phase)[0] : "idle";
  const currentWinningNumber =
    table && table.lastResult.length > 0 ? Number(table.lastResult[0].winningNumber) : null;

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;

    if (phase === "spinning" && prevPhase !== "spinning") {
      setBallSpinning(true);
      const ctx = getAudioCtx();
      rollIntervalRef.current = setInterval(() => playRollTick(ctx), 180);
    }

    if (phase === "result" && prevPhase === "spinning" && currentWinningNumber !== null) {
      setBallSpinning(false);
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      setBallAngle(angleForNumber(currentWinningNumber) + 360 * 4);
      playLandSound(getAudioCtx());
    }

    if (phase === "idle" && prevPhase !== "idle") {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      setBallSpinning(false);
      setBallAngle(0);
    }

    prevPhaseRef.current = phase;
  }, [phase, currentWinningNumber]);
  const isBettingOpen = phase === "idle" || phase === "betting";

  const toggleNumber = (n) => {
    if (!isBettingOpen) return;
    setSelectedNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        if (next.size >= 6) return prev;
        next.add(n);
      }
      return next;
    });
  };

  const placeInsideBet = async () => {
    if (selectedNumbers.size === 0 || placingRef.current || !actor) return;
    placingRef.current = true;
    setPlacing(true);
    setError(null);
    try {
      const arr = [...selectedNumbers];
      const { kind, label } = classifySelection(arr);
      const ok = await actor.placeBet(arr, chipValue, { [kind]: null }, label);
      if (!ok) setError("Bet couldn\u2019t be placed \u2014 check your Love balance.");
      setSelectedNumbers(new Set());
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  const placeOutsideBet = async (numbers, kind, label) => {
    if (placingRef.current || !actor) return;
    placingRef.current = true;
    setPlacing(true);
    setError(null);
    try {
      const ok = await actor.placeBet(numbers, chipValue, { [kind]: null }, label);
      if (!ok) setError("Bet couldn\u2019t be placed \u2014 check your Love balance.");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  const handleChipDrop = async (e, numbers, kind, label) => {
    e.preventDefault();
    const value = draggedChip;
    setDraggedChip(null);
    if (!value || !isBettingOpen || placingRef.current || !actor) return;
    placingRef.current = true;
    setPlacing(true);
    setError(null);
    try {
      const ok = await actor.placeBet(numbers, value, { [kind]: null }, label);
      if (!ok) setError("Bet couldn\u2019t be placed \u2014 check your Love balance.");
      setSelectedNumbers(new Set());
      await refresh();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  const straightBetTotal = (n) => {
    if (!table) return 0;
    return table.currentBets
      .filter((b) => b.numbers.length === 1 && Number(b.numbers[0]) === n)
      .reduce((sum, b) => sum + Number(b.amount), 0);
  };

  const outsideBetTotal = (kind, label) => {
    if (!table) return 0;
    return table.currentBets
      .filter((b) => Object.keys(b.kind)[0] === kind && b.betLabel === label)
      .reduce((sum, b) => sum + Number(b.amount), 0);
  };

  const renderPlacedChip = (amount) =>
    amount > 0 ? <span className="roulette-placed-chip">{amount}</span> : null;

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || !actor) return;
    const text = chatText.trim();
    setChatText("");
    try {
      await actor.sendChat(text);
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  if (!table) return <p className="chat-empty">Loading...</p>;

  const rows = [];
  for (let r = 12; r >= 1; r--) {
    rows.push([3 * r - 2, 3 * r - 1, 3 * r]);
  }

  const secondsLeft = table.roundEndsAt
    ? Math.max(0, Math.round((Number(table.roundEndsAt) / 1_000_000 - Date.now()) / 1000))
    : 0;

  const lastResult = table.lastResult.length > 0 ? table.lastResult[0] : null;
  const selectionInfo = selectedNumbers.size > 0 ? classifySelection([...selectedNumbers]) : null;

  return (
    <div className="scrabble-page">
      <h1 className="page-title">Roulette</h1>

      <div className="scrabble-panel">
        {phase === "idle" && <p className="page-subtitle">Place a bet to start a new round.</p>}
        {phase === "betting" && <p className="page-subtitle">{"Betting open \u2014 "}{secondsLeft}s left</p>}
        {phase === "spinning" && <p className="page-subtitle">{"No more bets \u2014 spinning..."}</p>}
        {phase === "result" && lastResult && (
          <p className="page-subtitle">
            Winning number: <strong>{lastResult.winningNumber.toString()}</strong>{" "}
            ({numberColor(Number(lastResult.winningNumber))})
          </p>
        )}
        {phase === "result" && lastResult && profile && (() => {
          const myBets = lastResult.bets.filter((b) => b.player.toString() === profile.id.toString());
          if (myBets.length === 0) return null;
          const myWinnings = lastResult.winners.filter((w) => w[0].toString() === profile.id.toString());
          const myTotalWon = myWinnings.reduce((sum, w) => sum + Number(w[2]), 0);
          return myTotalWon > 0 ? (
            <p className="roulette-win-message">You won {myTotalWon} Love!</p>
          ) : (
            <p className="tree-rel">You didn\u2019t win this round.</p>
          );
        })()}
      </div>

      {table.history.length > 0 && (
        <div className="roulette-history">
          {table.history
            .slice()
            .reverse()
            .slice(0, 12)
            .map((r, i) => (
              <span
                key={i}
                className={"roulette-history-chip roulette-color-" + numberColor(Number(r.winningNumber))}
              >
                {r.winningNumber.toString()}
              </span>
            ))}
        </div>
      )}

      <div className="roulette-wheel-outer">
        <div className="roulette-wheel">
          <div className="roulette-wheel-wedges" style={{ background: WHEEL_GRADIENT }} />
          <div className="roulette-wheel-dividers" />
          {WHEEL_ORDER.map((n, i) => (
            <div
              key={n}
              className="roulette-number-label"
              style={{
                transform:
                  "rotate(" + i * SEGMENT_ANGLE + "deg) translate(0, -100px) rotate(" +
                  -(i * SEGMENT_ANGLE) + "deg)",
              }}
            >
              {n}
            </div>
          ))}
          <div
            className={"roulette-ball" + (ballSpinning ? " roulette-ball-spinning" : "")}
            style={
              !ballSpinning
                ? {
                    transform: "rotate(" + ballAngle + "deg) translate(0, -100px)",
                    transition: "transform 2.2s cubic-bezier(0.15, 0.85, 0.35, 1)",
                  }
                : undefined
            }
          />
          <div className="roulette-wheel-hub">
            <div className="roulette-wheel-center">
              {phase === "result" && currentWinningNumber !== null && (
                <span className={"roulette-center-number roulette-color-" + numberColor(currentWinningNumber)}>
                  {currentWinningNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="roulette-table-grid" style={{ position: "relative" }}>
        {SPLIT_ZONES.map((z, idx) => {
          const label = z.a + "-" + z.b;
          const style =
            z.orientation === "h"
              ? {
                  left: colLeftPx(z.col) + CELL_PX + GAP_PX / 2 - 6,
                  top: rowTopPx(z.gridRow),
                  width: 12,
                  height: CELL_PX,
                }
              : {
                  left: colLeftPx(z.col),
                  top: rowTopPx(z.gridRow) + CELL_PX + GAP_PX / 2 - 6,
                  width: CELL_PX,
                  height: 12,
                };
          return (
            <div
              key={"split-" + idx}
              className="roulette-split-zone"
              style={{ ...style, position: "absolute" }}
              onDragOver={(e) => {
                if (isBettingOpen) e.preventDefault();
              }}
              onDrop={(e) => handleChipDrop(e, [z.a, z.b], "split", label)}
            />
          );
        })}
        <button
          className={"roulette-zero-cell" + (selectedNumbers.has(0) ? " roulette-selected" : "")}
          style={{ gridColumn: 1, gridRow: "1 / span 3" }}
          onClick={() => toggleNumber(0)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, [0], "straight", "0")}
          disabled={!isBettingOpen}
        >
          0
          {renderPlacedChip(straightBetTotal(0))}
        </button>

        {Array.from({ length: 36 }, (_, idx) => idx + 1).map((n) => {
          const col = Math.ceil(n / 3);
          const rowInCol = (n - 1) % 3;
          const gridRow = 3 - rowInCol;
          return (
            <button
              key={n}
              className={
                "roulette-cell roulette-color-" +
                numberColor(n) +
                (selectedNumbers.has(n) ? " roulette-selected" : "")
              }
              style={{ gridColumn: col + 1, gridRow }}
              onClick={() => toggleNumber(n)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleChipDrop(e, [n], "straight", String(n))}
              disabled={!isBettingOpen}
            >
              {n}
              {renderPlacedChip(straightBetTotal(n))}
            </button>
          );
        })}

        {[1, 2, 3].map((rowIdx) => {
          const nums = Array.from({ length: 12 }, (_, i) =>
            rowIdx === 1 ? 3 * (i + 1) : rowIdx === 2 ? 3 * i + 2 : 3 * i + 1
          );
          return (
            <button
              key={"col-" + rowIdx}
              className="roulette-two-to-one"
              style={{ gridColumn: 14, gridRow: rowIdx }}
              onClick={() => placeOutsideBet(nums, "column", "2 to 1")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleChipDrop(e, nums, "column", "2 to 1")}
              disabled={!isBettingOpen}
            >
              2 to 1
              {renderPlacedChip(outsideBetTotal("column", "2 to 1"))}
            </button>
          );
        })}

        <button
          className="roulette-dozen"
          style={{ gridColumn: "2 / span 4", gridRow: 4 }}
          onClick={() => placeOutsideBet(Array.from({ length: 12 }, (_, i) => i + 1), "dozen", "1st 12")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from({ length: 12 }, (_, i) => i + 1), "dozen", "1st 12")}
          disabled={!isBettingOpen}
        >
          1st 12
          {renderPlacedChip(outsideBetTotal("dozen", "1st 12"))}
        </button>
        <button
          className="roulette-dozen"
          style={{ gridColumn: "6 / span 4", gridRow: 4 }}
          onClick={() => placeOutsideBet(Array.from({ length: 12 }, (_, i) => i + 13), "dozen", "2nd 12")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from({ length: 12 }, (_, i) => i + 13), "dozen", "2nd 12")}
          disabled={!isBettingOpen}
        >
          2nd 12
          {renderPlacedChip(outsideBetTotal("dozen", "2nd 12"))}
        </button>
        <button
          className="roulette-dozen"
          style={{ gridColumn: "10 / span 4", gridRow: 4 }}
          onClick={() => placeOutsideBet(Array.from({ length: 12 }, (_, i) => i + 25), "dozen", "3rd 12")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from({ length: 12 }, (_, i) => i + 25), "dozen", "3rd 12")}
          disabled={!isBettingOpen}
        >
          3rd 12
          {renderPlacedChip(outsideBetTotal("dozen", "3rd 12"))}
        </button>

        <button
          className="roulette-outside"
          style={{ gridColumn: "2 / span 2", gridRow: 5 }}
          onClick={() => placeOutsideBet(Array.from({ length: 18 }, (_, i) => i + 1), "highLow", "1-18")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from({ length: 18 }, (_, i) => i + 1), "highLow", "1-18")}
          disabled={!isBettingOpen}
        >
          1 to 18
          {renderPlacedChip(outsideBetTotal("highLow", "1-18"))}
        </button>
        <button
          className="roulette-outside"
          style={{ gridColumn: "4 / span 2", gridRow: 5 }}
          onClick={() => placeOutsideBet(Array.from({ length: 9 }, (_, i) => 2 * i + 2), "oddEven", "Even")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from({ length: 9 }, (_, i) => 2 * i + 2), "oddEven", "Even")}
          disabled={!isBettingOpen}
        >
          EVEN
          {renderPlacedChip(outsideBetTotal("oddEven", "Even"))}
        </button>
        <button
          className="roulette-outside roulette-outside-red"
          style={{ gridColumn: "6 / span 2", gridRow: 5 }}
          onClick={() => placeOutsideBet(Array.from(RED_NUMBERS), "redBlack", "Red")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from(RED_NUMBERS), "redBlack", "Red")}
          disabled={!isBettingOpen}
        >
          &#9670;
          {renderPlacedChip(outsideBetTotal("redBlack", "Red"))}
        </button>
        <button
          className="roulette-outside roulette-outside-black"
          style={{ gridColumn: "8 / span 2", gridRow: 5 }}
          onClick={() =>
            placeOutsideBet(
              Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => !RED_NUMBERS.has(n)),
              "redBlack",
              "Black"
            )
          }
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) =>
            handleChipDrop(
              e,
              Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => !RED_NUMBERS.has(n)),
              "redBlack",
              "Black"
            )
          }
          disabled={!isBettingOpen}
        >
          &#9670;
          {renderPlacedChip(outsideBetTotal("redBlack", "Black"))}
        </button>
        <button
          className="roulette-outside"
          style={{ gridColumn: "10 / span 2", gridRow: 5 }}
          onClick={() => placeOutsideBet(Array.from({ length: 9 }, (_, i) => 2 * i + 1), "oddEven", "Odd")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from({ length: 9 }, (_, i) => 2 * i + 1), "oddEven", "Odd")}
          disabled={!isBettingOpen}
        >
          ODD
          {renderPlacedChip(outsideBetTotal("oddEven", "Odd"))}
        </button>
        <button
          className="roulette-outside"
          style={{ gridColumn: "12 / span 2", gridRow: 5 }}
          onClick={() => placeOutsideBet(Array.from({ length: 18 }, (_, i) => i + 19), "highLow", "19-36")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleChipDrop(e, Array.from({ length: 18 }, (_, i) => i + 19), "highLow", "19-36")}
          disabled={!isBettingOpen}
        >
          19 to 36
          {renderPlacedChip(outsideBetTotal("highLow", "19-36"))}
        </button>
      </div>

      <div className="scrabble-panel">
        <p className="tree-rel">Drag a chip onto the board, or click numbers then Bet below.</p>
        <div className="roulette-chips">
          {CHIP_VALUES.map((v) => (
            <div
              key={v}
              draggable={isBettingOpen}
              onDragStart={(e) => {
                setDraggedChip(v);
                const ghost = document.createElement("div");
                ghost.textContent = String(v);
                ghost.style.cssText =
                  "position:absolute;top:-1000px;left:-1000px;width:44px;height:44px;" +
                  "border-radius:50%;background:#e8c25a;border:2px solid #caa24a;" +
                  "display:flex;align-items:center;justify-content:center;" +
                  "font-weight:bold;font-size:15px;color:#222;";
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 22, 22);
                setTimeout(() => document.body.removeChild(ghost), 0);
              }}
              onDragEnd={() => setDraggedChip(null)}
              className={"roulette-chip" + (chipValue === v ? " roulette-chip-active" : "")}
              onClick={() => setChipValue(v)}
            >
              {v}
            </div>
          ))}
        </div>
        {selectionInfo && (
          <button className="chat-send-button" disabled={!isBettingOpen || placing} onClick={placeInsideBet}>
            Bet {chipValue} Love on {selectionInfo.label}
          </button>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="scrabble-panel" style={{ marginTop: 20 }}>
        <h2 className="tree-admin-title">Table Chat</h2>
        <div className="scrabble-chat-messages" ref={chatContainerRef}>
          {chat.length === 0 ? (
            <p className="chat-empty">No messages yet.</p>
          ) : (
            chat.map((m) => (
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
