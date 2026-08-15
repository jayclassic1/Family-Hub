import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createGroupsActor } from "../groups.js";

export default function Groups() {
  const { identity, profile } = useAuth();
  const [groupsActor, setGroupsActor] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const g = await createGroupsActor(identity);
      try {
        await g.seedDefaultGroups();
      } catch (e) {}
      setGroupsActor(g);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!groupsActor) return;
    try {
      const [all, mine] = await Promise.all([groupsActor.listGroups(), groupsActor.getMyGroups()]);
      setAllGroups(all);
      setMyGroups(mine);
    } catch (e) {
      setError(String(e));
    }
  }, [groupsActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const myGroupIds = new Set(myGroups.map((g) => g.id.toString()));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupsActor || !name.trim()) return;
    setError(null);
    try {
      await groupsActor.createGroup(name.trim(), description.trim(), isPublic);
      setName("");
      setDescription("");
      setIsPublic(true);
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const handleJoin = async (groupId) => {
    if (!groupsActor) return;
    setError(null);
    try {
      const ok = await groupsActor.joinGroup(groupId);
      if (!ok) setError("Could not join — this group may be invite-only.");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <h1 className="page-title">Groups</h1>
      <p className="page-subtitle">Create a group chat, public or invite-only.</p>

      <Link to="/people" className="chat-send-button" style={{ display: "inline-block", textDecoration: "none", marginBottom: 16 }}>
        💬 DMs
      </Link>

      <h2 className="tree-admin-title">All groups</h2>
      <div className="card-grid tree-grid">
        {allGroups.map((g) => {
          const isMine = myGroupIds.has(g.id.toString());
          return (
            <div key={g.id.toString()} className="card tree-card">
              <div className="card-title">{g.name} {g.isPublic ? "" : "(Private)"}</div>
              <div className="card-description">{g.description}</div>
              {isMine ? (
                <Link to={"/groups/" + g.id.toString()} className="chat-send-button" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }}>
                  Open
                </Link>
              ) : g.isPublic ? (
                <button className="chat-send-button" style={{ marginTop: 10 }} onClick={() => handleJoin(g.id)}>
                  Join
                </button>
              ) : (
                <div className="tree-rel" style={{ marginTop: 10 }}>Invite-only</div>
              )}
            </div>
          );
        })}
        {allGroups.length === 0 && <p className="chat-empty">No groups yet — create the first one!</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Create a group</h2>
        <form className="tree-admin-form" onSubmit={handleCreate} style={{ flexWrap: "wrap" }}>
          <input
            className="chat-text-input"
            style={{ maxWidth: 220 }}
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ maxWidth: 280 }}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public (anyone can join)
          </label>
          <button className="chat-send-button" type="submit">Create</button>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
