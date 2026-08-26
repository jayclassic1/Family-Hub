import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createWalletActor, formatMoney } from "../../walletApi.js";

export default function LedgerDetail() {
  const { ledgerId } = useParams();
  const { identity, profile } = useAuth();
  const [walletActor, setWalletActor] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [error, setError] = useState(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitAmong, setSplitAmong] = useState([]);
  const [saving, setSaving] = useState(false);

  const [inviteSel, setInviteSel] = useState("");

  const numericLedgerId = Number(ledgerId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const w = await createWalletActor(identity);
      const a = await createAuthActor(identity);
      setWalletActor(w);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!walletActor) return;
    try {
      const [l, ex, bal] = await Promise.all([
        walletActor.getLedger(numericLedgerId),
        walletActor.getExpenses(numericLedgerId),
        walletActor.getBalances(numericLedgerId),
      ]);
      const foundLedger = l.length > 0 ? l[0] : null;
      setLedger(foundLedger);
      setExpenses(ex);
      setBalances(bal);
      if (foundLedger && !paidBy) {
        setPaidBy(foundLedger.participants[0]?.toString() || "");
      }
      if (foundLedger && splitAmong.length === 0) {
        setSplitAmong(foundLedger.participants.map((p) => p.toString()));
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    // eslint-disable-next-line
  }, [walletActor, numericLedgerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const nameOf = (principalText) => {
    const u = allUsers.find((x) => x.id.toString() === principalText);
    return u ? u.username : principalText;
  };

  const toggleSplit = (idText) => {
    setSplitAmong((prev) =>
      prev.includes(idText) ? prev.filter((x) => x !== idText) : [...prev, idText]
    );
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!walletActor || !ledger || !description.trim() || !amount || !paidBy || splitAmong.length === 0) return;
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const paidByPrincipal = ledger.participants.find((p) => p.toString() === paidBy);
      const splitPrincipals = ledger.participants.filter((p) => splitAmong.includes(p.toString()));
      await walletActor.addExpense(numericLedgerId, description.trim(), amountNum, paidByPrincipal, splitPrincipals);
      setDescription("");
      setAmount("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!walletActor) return;
    setError(null);
    try {
      await walletActor.deleteExpense(expenseId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!walletActor || !inviteSel) return;
    setError(null);
    try {
      const target = allUsers.find((u) => u.id.toString() === inviteSel);
      if (target) {
        await walletActor.addParticipant(numericLedgerId, target.id);
        setInviteSel("");
        await refresh();
      }
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  if (!ledger) return <p className="chat-empty">Loading...</p>;

  const isCreator = profile && ledger.creator.toString() === profile.id.toString();
  const participantIds = new Set(ledger.participants.map((p) => p.toString()));
  const invitable = allUsers.filter((u) => !participantIds.has(u.id.toString()));

  return (
    <div>
      <Link to="/wallet/ledgers" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Ledgers
      </Link>

      <h1 className="page-title">{ledger.name}</h1>
      {ledger.description && <p className="page-subtitle">{ledger.description}</p>}
      <p className="tree-rel">
        Participants: {ledger.participants.map((p) => nameOf(p.toString())).join(", ")}
      </p>

      {isCreator && (
        <div className="tree-admin-panel" style={{ marginTop: 16 }}>
          <h2 className="tree-admin-title">Add a participant</h2>
          <form className="tree-admin-form" onSubmit={handleInvite}>
            <select value={inviteSel} onChange={(e) => setInviteSel(e.target.value)}>
              <option value="">Select someone...</option>
              {invitable.map((u) => (
                <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
              ))}
            </select>
            <button className="chat-send-button" type="submit">Add</button>
          </form>
        </div>
      )}

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Balances</h2>
      <div className="card-grid tree-grid">
        {balances.map((b) => (
          <div key={b.user.toString()} className="card tree-card">
            <div className="card-title">{nameOf(b.user.toString())}</div>
            <div className={"card-description" + (b.netAmount >= 0 ? " balance-positive" : " balance-negative")}>
              {b.netAmount >= 0 ? "Is owed " + formatMoney(b.netAmount) : "Owes " + formatMoney(-b.netAmount)}
            </div>
          </div>
        ))}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Add an expense</h2>
      <div className="tree-admin-panel">
        <form onSubmit={handleAddExpense}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="What was it for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Paid by</label>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {ledger.participants.map((p) => (
                <option key={p.toString()} value={p.toString()}>{nameOf(p.toString())}</option>
              ))}
            </select>
          </div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Split among</label>
          <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {ledger.participants.map((p) => (
              <label key={p.toString()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={splitAmong.includes(p.toString())}
                  onChange={() => toggleSplit(p.toString())}
                />
                {nameOf(p.toString())}
              </label>
            ))}
          </div>
          <button className="chat-send-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Add expense"}
          </button>
        </form>
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Expenses</h2>
      {expenses.length === 0 ? (
        <p className="chat-empty">No expenses yet.</p>
      ) : (
        <div className="chat-window" style={{ height: "auto" }}>
          {expenses.map((e) => (
            <div key={e.id.toString()} className="chat-message">
              <div className="chat-message-sender">{e.description} — {formatMoney(e.amount)}</div>
              <div className="chat-message-text">
                Paid by {e.paidByName}, split among {e.splitAmong.map((p) => nameOf(p.toString())).join(", ")}
              </div>
              <button className="tree-remove-btn" style={{ marginTop: 6 }} onClick={() => handleDeleteExpense(e.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
