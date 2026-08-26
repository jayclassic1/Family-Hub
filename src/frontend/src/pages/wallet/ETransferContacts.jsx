import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createWalletActor } from "../../walletApi.js";

export default function ETransferContacts() {
  const { identity } = useAuth();
  const [walletActor, setWalletActor] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      const result = await walletActor.listContacts();
      setContacts(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [walletActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!walletActor || !name.trim() || !email.trim()) return;
    setError(null);
    try {
      await walletActor.addContact(name.trim(), email.trim());
      setName("");
      setEmail("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleRemove = async (id) => {
    if (!walletActor) return;
    setError(null);
    try {
      await walletActor.removeContact(id);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div>
      <Link to="/wallet" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Wallet
      </Link>

      <h1 className="page-title">E-Transfer Contacts</h1>
      <p className="page-subtitle">Private to you — only you can see this list.</p>

      <div className="tree-admin-panel">
        <h2 className="tree-admin-title">Add a contact</h2>
        <form className="tree-admin-form" onSubmit={handleAdd} style={{ flexWrap: "wrap" }}>
          <input
            className="chat-text-input"
            style={{ maxWidth: 220 }}
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ maxWidth: 260 }}
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="chat-send-button" type="submit">Add</button>
        </form>
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Your contacts</h2>
      {contacts.length === 0 ? (
        <p className="chat-empty">No contacts saved yet.</p>
      ) : (
        <div className="card-grid tree-grid">
          {contacts.map((c) => (
            <div key={c.id.toString()} className="card tree-card">
              <div className="card-title">{c.name}</div>
              <div className="card-description">{c.email}</div>
              <button className="tree-remove-btn" style={{ marginTop: 8 }} onClick={() => handleRemove(c.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
