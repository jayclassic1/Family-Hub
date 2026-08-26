import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";

export default function Admin() {
  const { identity, profile } = useAuth();
  const [authActor, setAuthActor] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [currentPassword, setCurrentPassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [blockHours, setBlockHours] = useState({});
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const isAdmin = profile && "admin" in profile.role;

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createAuthActor(identity);
      setAuthActor(a);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!authActor) return;
    try {
      const [list, pw] = await Promise.all([
        authActor.adminListAccessStatuses(),
        authActor.adminGetSignupPassword(),
      ]);
      setStatuses(list);
      setCurrentPassword(pw.length > 0 ? pw[0] : null);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [authActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (!authActor || !newPassword.trim()) return;
    setError(null);
    try {
      const ok = await authActor.adminSetSignupPassword(newPassword.trim());
      if (ok) {
        flash("Signup password updated.");
        setNewPassword("");
        await refresh();
      } else {
        setError("Could not update password.");
      }
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleBan = async (user) => {
    if (!authActor) return;
    setError(null);
    try {
      const ok = await authActor.adminBan(user);
      if (ok) { flash("User banned."); await refresh(); }
      else setError("Could not ban that user.");
    } catch (e) { setError("Something went wrong. Please try again."); }
  };

  const handleUnban = async (user) => {
    if (!authActor) return;
    setError(null);
    try {
      const ok = await authActor.adminUnban(user);
      if (ok) { flash("User unbanned."); await refresh(); }
      else setError("Could not unban that user.");
    } catch (e) { setError("Something went wrong. Please try again."); }
  };

  const handleBlock = async (user) => {
    if (!authActor) return;
    const hours = Number(blockHours[user.toString()] || 0);
    if (!hours || hours <= 0) {
      setError("Enter a number of hours to block for.");
      return;
    }
    setError(null);
    try {
      const ok = await authActor.adminBlock(user, hours);
      if (ok) { flash("User blocked for " + hours + " hour(s)."); await refresh(); }
      else setError("Could not block that user.");
    } catch (e) { setError("Something went wrong. Please try again."); }
  };

  const handleUnblock = async (user) => {
    if (!authActor) return;
    setError(null);
    try {
      const ok = await authActor.adminUnblock(user);
      if (ok) { flash("Block lifted."); await refresh(); }
      else setError("Could not unblock that user.");
    } catch (e) { setError("Something went wrong. Please try again."); }
  };

  const handleDeleteUser = async (user, username) => {
    if (!authActor) return;
    if (!window.confirm("Permanently delete " + username + "'s account? This cannot be undone.")) return;
    setError(null);
    try {
      const ok = await authActor.adminDeleteUser(user);
      if (ok) { flash("Account deleted."); await refresh(); }
      else setError("Could not delete that account.");
    } catch (e) { setError("Something went wrong. Please try again."); }
  };

  if (!isAdmin) {
    return (
      <div>
        <h1 className="page-title">Admin</h1>
        <p className="chat-empty">Only the family admin can access this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Admin</h1>
      <p className="page-subtitle">Family Hub controls — only you can see this.</p>

      {message && <div className="coin-toss-result" style={{ marginBottom: 16 }}>{message}</div>}

      <div className="tree-admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="tree-admin-title">Signup password</h2>
        {currentPassword !== null && (
          <p className="tree-rel" style={{ marginBottom: 10 }}>
            Current password: <strong>{currentPassword}</strong>
          </p>
        )}
        <form className="tree-admin-form" onSubmit={handleSetPassword}>
          <input
            className="chat-text-input"
            style={{ maxWidth: 260 }}
            placeholder="New signup password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button className="chat-send-button" type="submit" disabled={!newPassword.trim()}>
            Change password
          </button>
        </form>
      </div>

      <h2 className="tree-admin-title">Members</h2>
      <div className="card-grid tree-grid">
        {statuses.map((s) => {
          const isMe = profile && s.user.toString() === profile.id.toString();
          const blocked = s.blockedUntil.length > 0;
          const blockedDate = blocked ? new Date(Number(s.blockedUntil[0]) / 1_000_000) : null;
          return (
            <div key={s.user.toString()} className="card tree-card">
              <div className="card-title">{s.username}{isMe ? " (you)" : ""}</div>
              <div className="card-description">
                {s.isBanned ? "🚫 Banned" : blocked ? "⏸️ Blocked until " + blockedDate.toLocaleString() : "Active"}
              </div>
              {!isMe && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {s.isBanned ? (
                    <button className="chat-send-button" onClick={() => handleUnban(s.user)}>Unban</button>
                  ) : (
                    <button className="tree-remove-btn" onClick={() => handleBan(s.user)}>Ban permanently</button>
                  )}
                  {blocked ? (
                    <button className="chat-send-button" onClick={() => handleUnblock(s.user)}>Lift block</button>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        className="chat-text-input"
                        style={{ width: 80 }}
                        type="number"
                        min="1"
                        placeholder="Hours"
                        value={blockHours[s.user.toString()] || ""}
                        onChange={(e) => setBlockHours({ ...blockHours, [s.user.toString()]: e.target.value })}
                      />
                      <button className="tree-remove-btn" onClick={() => handleBlock(s.user)}>Block</button>
                    </div>
                  )}
                  <button
                    className="tree-remove-btn"
                    style={{ background: "#8b0000" }}
                    onClick={() => handleDeleteUser(s.user, s.username)}
                  >
                    Delete account permanently
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {statuses.length === 0 && <p className="chat-empty">No members found.</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
