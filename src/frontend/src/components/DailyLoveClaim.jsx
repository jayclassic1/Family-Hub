import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createWalletActor } from "../walletApi.js";

function playClaimSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch (e) {}
}

export default function DailyLoveClaim({ onClaimed }) {
  const { identity } = useAuth();
  const [claimable, setClaimable] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null);

  const refresh = async () => {
    if (!identity) return;
    try {
      const walletActor = await createWalletActor(identity);
      const eligible = await walletActor.canClaimDailyLove();
      setClaimable(Number(eligible));
    } catch (e) {
      setClaimable(0);
    }
  };

  useEffect(() => {
    refresh();
  }, [identity]);

  const handleClaim = async () => {
    if (!identity || claiming) return;
    setClaiming(true);
    setClaimError(null);
    setJustClaimed(null);
    try {
      const walletActor = await createWalletActor(identity);
      const amount = await walletActor.claimDailyLove();
      const amountNum = Number(amount);
      if (amountNum > 0) {
        playClaimSound();
        setJustClaimed(amountNum);
        if (onClaimed) onClaimed();
      } else {
        setClaimError("Already claimed today \u2014 come back tomorrow!");
      }
      await refresh();
    } catch (e) {
      setClaimError("Something went wrong. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {claimable > 0 ? (
        <button className="chat-send-button" onClick={handleClaim} disabled={claiming}>
          {claiming ? "Claiming..." : "🎁 Claim Love (" + claimable + ")"}
        </button>
      ) : justClaimed === null ? (
        <button className="chat-send-button" disabled style={{ opacity: 0.55, cursor: "not-allowed" }}>
          🎁 Already claimed today
        </button>
      ) : null}
      {justClaimed !== null && (
        <p className="roulette-win-message" style={{ marginTop: 8 }}>
          You claimed {justClaimed} Love!
        </p>
      )}
      {claimError && <p className="auth-error" style={{ marginTop: 8 }}>{claimError}</p>}
    </div>
  );
}
