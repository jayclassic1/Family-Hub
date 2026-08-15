import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createWalletActor } from "../walletApi.js";

export default function Wallet() {
  const { identity } = useAuth();
  const [loveBalance, setLoveBalance] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      try {
        const walletActor = await createWalletActor(identity);
        const love = await walletActor.getMyLove();
        setLoveBalance(love);
      } catch (e) {
        setLoveBalance(null);
      }
    })();
  }, [identity]);

  return (
    <div>
      <h1 className="page-title">Wallet</h1>
      <p className="page-subtitle">Money tools for the family.</p>

      {loveBalance !== null && (
        <div className="coin-toss-result" style={{ marginBottom: 20, display: "inline-block" }}>
          💗 {loveBalance.toString()} Love
        </div>
      )}

      <div className="card-grid tree-grid">
        <Link to="/wallet/calculator" className="card tree-card">
          <div className="card-emoji">🧮</div>
          <div className="card-title">Calculator</div>
          <div className="card-description">A simple calculator.</div>
        </Link>
        <Link to="/wallet/ledgers" className="card tree-card">
          <div className="card-emoji">📒</div>
          <div className="card-title">Expense Ledgers</div>
          <div className="card-description">Track who paid what on a trip or shared expense.</div>
        </Link>
        <Link to="/wallet/contacts" className="card tree-card">
          <div className="card-emoji">💸</div>
          <div className="card-title">E-Transfer Contacts</div>
          <div className="card-description">Keep a private list of emails for sending e-transfers.</div>
        </Link>
        <Link to="/wallet/debts" className="card tree-card">
          <div className="card-emoji">📋</div>
          <div className="card-title">Debts</div>
          <div className="card-description">Privately track what you owe and what's owed to you.</div>
        </Link>
      </div>
    </div>
  );
}
