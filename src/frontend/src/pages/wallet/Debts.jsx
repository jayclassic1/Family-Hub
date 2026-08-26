import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createWalletActor, formatMoney } from "../../walletApi.js";

export default function Debts() {
  const { identity } = useAuth();
  const [walletActor, setWalletActor] = useState(null);
  const [debts, setDebts] = useState([]);
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("owedByMe");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const w = await createWalletActor(identity);
      setWalletActor(w);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!walletActor) return;
    try {
      const result = await walletActor.listDebts();
      setDebts(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [walletActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!walletActor || !description.trim() || !counterparty.trim() || !amount) return;
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    setError(null);
    try {
      await walletActor.addDebt(description.trim(), counterparty.trim(), amountNum, direction === "owedByMe");
      setDescription("");
      setCounterparty("");
      setAmount("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleTogglePaid = async (id) => {
    if (!walletActor) return;
    setError(null);
    try {
      await walletActor.toggleDebtPaid(id);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleRemove = async (id) => {
    if (!walletActor) return;
    setError(null);
    try {
      await walletActor.removeDebt(id);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const unpaid = debts.filter((d) => !d.isPaid);
  const paid = debts.filter((d) => d.isPaid);

  const totalOwedByMe = unpaid.filter((d) => d.isOwedByMe).reduce((sum, d) => sum + Number(d.amount), 0);
  const totalOwedToMe = unpaid.filter((d) => !d.isOwedByMe).reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div>
      <Link to="/wallet" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Wallet
      </Link>

      <h1 className="page-title">Debts</h1>
      <p className="page-subtitle">Private to you — only you can see this list.</p>

      <div className="card-grid tree-grid" style={{ marginBottom: 20 }}>
        <div className="card tree-card">
          <div className="card-title">You owe</div>
          <div className="card-description balance-negative">{formatMoney(totalOwedByMe)}</div>
        </div>
        <div className="card tree-card">
          <div className="card-title">Owed to you</div>
          <div className="card-description balance-positive">{formatMoney(totalOwedToMe)}</div>
        </div>
      </div>

      <div className="tree-admin-panel">
        <h2 className="tree-admin-title">Add a debt</h2>
        <form onSubmit={handleAdd}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="What's it for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Who's it with? (e.g. Mom, the bank, Alex)"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ width: 140, marginBottom: 10 }}
            placeholder="Amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div style={{ marginBottom: 14, display: "flex", gap: 16 }}>
            <label>
              <input type="radio" checked={direction === "owedByMe"} onChange={() => setDirection("owedByMe")} /> I owe them
            </label>
            <label>
              <input type="radio" checked={direction === "owedToMe"} onChange={() => setDirection("owedToMe")} /> They owe me
            </label>
          </div>
          <button className="chat-send-button" type="submit" disabled={!description.trim() || !counterparty.trim() || !amount}>
            Add debt
          </button>
        </form>
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Outstanding</h2>
      {unpaid.length === 0 ? (
        <p className="chat-empty">Nothing outstanding.</p>
      ) : (
        <div className="card-grid tree-grid">
          {unpaid.map((d) => (
            <div key={d.id.toString()} className="card tree-card">
              <div className="card-title">{d.description}</div>
              <div className={"card-description" + (d.isOwedByMe ? " balance-negative" : " balance-positive")}>
                {d.isOwedByMe ? "You owe " + d.counterparty : d.counterparty + " owes you"} — {formatMoney(d.amount)}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="chat-send-button" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleTogglePaid(d.id)}>
                  Mark paid
                </button>
                <button className="tree-remove-btn" onClick={() => handleRemove(d.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paid.length > 0 && (
        <>
          <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Paid</h2>
          <div className="card-grid tree-grid">
            {paid.map((d) => (
              <div key={d.id.toString()} className="card tree-card" style={{ opacity: 0.6 }}>
                <div className="card-title" style={{ textDecoration: "line-through" }}>{d.description}</div>
                <div className="card-description">
                  {d.isOwedByMe ? "Paid " + d.counterparty : d.counterparty + " paid you"} — {formatMoney(d.amount)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="chat-send-button" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleTogglePaid(d.id)}>
                    Mark unpaid
                  </button>
                  <button className="tree-remove-btn" onClick={() => handleRemove(d.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
