import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createWalletActor } from "../walletApi.js";
import DailyLoveClaim from "../components/DailyLoveClaim.jsx";

export default function Wallet() {
  const { identity } = useAuth();
  const [loveBalance, setLoveBalance] = useState(null);

  const refreshBalance = async () => {
    if (!identity) return;
    try {
      const walletActor = await createWalletActor(identity);
      const love = await walletActor.getMyLove();
      setLoveBalance(love);
    } catch (e) {
      setLoveBalance(null);
    }
  };

  useEffect(() => {
    refreshBalance();
  }, [identity]);

  return (
    <div>
      <h1 className="page-title">Wallet</h1>
      <p className="page-subtitle">Money tools for the family.</p>

      {loveBalance !== null && (
        <div className="coin-toss-result" style={{ marginBottom: 12, display: "inline-block" }}>
          {String.fromCodePoint(0x1F49D)} {loveBalance.toString()} Love
        </div>
      )}

      <DailyLoveClaim onClaimed={refreshBalance} />

      <div className="card-grid tree-grid">
        <Link to="/wallet/calculator" className="card tree-card">
          <div className="card-emoji">{String.fromCodePoint(0x1F9EE)}</div>
          <div className="card-title">Calculator</div>
          <div className="card-description">A simple calculator.</div>
        </Link>
        <Link to="/wallet/ledgers" className="card tree-card">
          <div className="card-emoji">{String.fromCodePoint(0x1F4D2)}</div>
          <div className="card-title">Expense Ledgers</div>
          <div className="card-description">Track who paid what on a trip or shared expense.</div>
        </Link>
        <Link to="/wallet/contacts" className="card tree-card">
          <div className="card-emoji">{String.fromCodePoint(0x1F4B8)}</div>
          <div className="card-title">E-Transfer Contacts</div>
          <div className="card-description">Keep a private list of emails for sending e-transfers.</div>
        </Link>
        <Link to="/wallet/debts" className="card tree-card">
          <div className="card-emoji">{String.fromCodePoint(0x1F4CB)}</div>
          <div className="card-title">Debts</div>
          <div className="card-description">Privately track what you owe and what's owed to you.</div>
        </Link>
      </div>
    </div>
  );
}
