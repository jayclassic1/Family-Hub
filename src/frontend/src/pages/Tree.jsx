import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createTreeActor, isAdminRole } from "../tree.js";

export default function Tree() {
  const { identity, profile, reloadProfile } = useAuth();
  const [authActor, setAuthActor] = useState(null);
  const [treeActor, setTreeActor] = useState(null);
  const [users, setUsers] = useState([]);
  const [edges, setEdges] = useState([]);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const [parentSel, setParentSel] = useState("");
  const [childSel, setChildSel] = useState("");
  const [spouseASel, setSpouseASel] = useState("");
  const [spouseBSel, setSpouseBSel] = useState("");

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createAuthActor(identity);
      const t = await createTreeActor(identity);
      setAuthActor(a);
      setTreeActor(t);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!authActor || !treeActor) return;
    try {
      const [u, e] = await Promise.all([authActor.getAllUsers(), treeActor.getAllEdges()]);
      setUsers(u);
      setEdges(e);
    } catch (err) {
      setError(String(err));
    }
  }, [authActor, treeActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isAdmin = profile && isAdminRole(profile.role);
  const anyAdminExists = users.some((u) => isAdminRole(u.role));

  const nameOf = (principalText) => {
    const u = users.find((x) => x.id.toString() === principalText);
    return u ? u.username : principalText;
  };

  const handleClaimAdmin = async () => {
    if (!authActor) return;
    setClaiming(true);
    setError(null);
    try {
      const ok = await authActor.claimAdminIfNoneExists();
      if (!ok) {
        setError("Could not claim admin — one may already exist.");
      } else {
        await reloadProfile();
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setClaiming(false);
    }
  };

  const handleAddParentChild = async (e) => {
    e.preventDefault();
    if (!treeActor || !parentSel || !childSel) return;
    setError(null);
    try {
      await treeActor.addParentChild(
        [...users].find((u) => u.id.toString() === parentSel).id,
        [...users].find((u) => u.id.toString() === childSel).id
      );
      setParentSel("");
      setChildSel("");
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const handleAddSpouse = async (e) => {
    e.preventDefault();
    if (!treeActor || !spouseASel || !spouseBSel) return;
    setError(null);
    try {
      await treeActor.addSpouse(
        [...users].find((u) => u.id.toString() === spouseASel).id,
        [...users].find((u) => u.id.toString() === spouseBSel).id
      );
      setSpouseASel("");
      setSpouseBSel("");
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const handleRemove = async (edgeId) => {
    if (!treeActor) return;
    setError(null);
    try {
      await treeActor.removeEdge(edgeId);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const relatedTo = (userIdText) => {
    const parents = edges
      .filter((e) => "parent" in e.relation && e.to.toString() === userIdText)
      .map((e) => nameOf(e.from.toString()));
    const children = edges
      .filter((e) => "parent" in e.relation && e.from.toString() === userIdText)
      .map((e) => nameOf(e.to.toString()));
    const spouses = edges
      .filter(
        (e) =>
          "spouse" in e.relation &&
          (e.from.toString() === userIdText || e.to.toString() === userIdText)
      )
      .map((e) => nameOf(e.from.toString() === userIdText ? e.to.toString() : e.from.toString()));
    return { parents, children, spouses };
  };

  return (
    <div>
      <h1 className="page-title">Family Tree</h1>
      <p className="page-subtitle">Tap a name to view their profile.</p>

      {!anyAdminExists && !isAdmin && (
        <div className="tree-claim-banner">
          No admin has been set up yet. Anyone can claim it once.
          <button className="auth-button" style={{ marginTop: 8 }} onClick={handleClaimAdmin} disabled={claiming}>
            {claiming ? "Claiming..." : "Claim admin"}
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="tree-admin-panel">
          <h2 className="tree-admin-title">Manage relationships (admin)</h2>

          <form className="tree-admin-form" onSubmit={handleAddParentChild}>
            <select value={parentSel} onChange={(e) => setParentSel(e.target.value)}>
              <option value="">Select parent</option>
              {users.map((u) => (
                <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
              ))}
            </select>
            <span>is parent of</span>
            <select value={childSel} onChange={(e) => setChildSel(e.target.value)}>
              <option value="">Select child</option>
              {users.map((u) => (
                <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
              ))}
            </select>
            <button className="chat-send-button" type="submit">Add</button>
          </form>

          <form className="tree-admin-form" onSubmit={handleAddSpouse}>
            <select value={spouseASel} onChange={(e) => setSpouseASel(e.target.value)}>
              <option value="">Select person</option>
              {users.map((u) => (
                <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
              ))}
            </select>
            <span>is spouse/partner of</span>
            <select value={spouseBSel} onChange={(e) => setSpouseBSel(e.target.value)}>
              <option value="">Select person</option>
              {users.map((u) => (
                <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
              ))}
            </select>
            <button className="chat-send-button" type="submit">Add</button>
          </form>

          {edges.length > 0 && (
            <ul className="tree-edge-list">
              {edges.map((e) => (
                <li key={e.id.toString()}>
                  {nameOf(e.from.toString())} {"parent" in e.relation ? "→ parent of →" : "↔ spouse of ↔"} {nameOf(e.to.toString())}
                  <button className="tree-remove-btn" onClick={() => handleRemove(e.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card-grid tree-grid">
        {users.map((u) => {
          const rel = relatedTo(u.id.toString());
          return (
            <Link key={u.id.toString()} to={"/profile/" + u.id.toString()} className="card tree-card">
              <div className="card-title">{u.username}</div>
              {rel.spouses.length > 0 && <div className="tree-rel">Spouse: {rel.spouses.join(", ")}</div>}
              {rel.parents.length > 0 && <div className="tree-rel">Parents: {rel.parents.join(", ")}</div>}
              {rel.children.length > 0 && <div className="tree-rel">Children: {rel.children.join(", ")}</div>}
            </Link>
          );
        })}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
