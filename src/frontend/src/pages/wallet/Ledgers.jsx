import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createWalletActor } from "../../walletApi.js";

export default function Ledgers() {
  const { identity, profile } = useAuth();
  const [walletActor, setWalletActor] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

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
      const result = await walletActor.listMyLedgers();
      setLedgers(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [walletActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const togglePerson = (idText) => {
    setSelectedPeople((prev) =>
      prev.includes(idText) ? prev.filter((x) => x !== idText) : [...prev, idText]
    );
  };

  const otherUsers = allUsers.filter((u) => !profile || u.id.toString() !== profile.id.toString());

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!walletActor || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const otherIds = selectedPeople.map((idText) => allUsers.find((u) => u.id.toString() === idText).id);
      await walletActor.createLedger(name.trim(), description.trim(), otherIds);
      setName("");
      setDescription("");
      setSelectedPeople([]);
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <Link to="/wallet" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Wallet
      </Link>

      <h1 className="page-title">Expense Ledgers</h1>
      <p className="page-subtitle">Only people you add can see and use a ledger.</p>

      <div className="card-grid tree-grid">
        {ledgers.map((l) => (
          <Link key={l.id.toString()} to={"/wallet/ledgers/" + l.id.toString()} className="card tree-card">
            <div className="card-title">{l.name}</div>
            <div className="card-description">{l.description}</div>
            <div className="tree-rel">{l.participants.length} people</div>
          </Link>
        ))}
        {ledgers.length === 0 && <p className="chat-empty">No ledgers yet — create one below!</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Create a ledger</h2>
        <form onSubmit={handleCreate}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Ledger name (e.g. Family Trip 2026)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
            Add people (you're automatically included)
          </label>
          <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {otherUsers.map((u) => (
              <label key={u.id.toString()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={selectedPeople.includes(u.id.toString())}
                  onChange={() => togglePerson(u.id.toString())}
                />
                {u.username}
              </label>
            ))}
            {otherUsers.length === 0 && <p className="tree-rel">No other family members registered yet.</p>}
          </div>
          <button className="chat-send-button" type="submit" disabled={!name.trim() || creating}>
            {creating ? "Creating..." : "Create ledger"}
          </button>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
