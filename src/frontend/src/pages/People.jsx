import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createDmsActor } from "../dms.js";

function timeAgo(nanos) {
  const ms = Number(nanos) / 1_000_000;
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return Math.floor(diffSec / 60) + "m ago";
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + "h ago";
  return Math.floor(diffSec / 86400) + "d ago";
}

export default function People() {
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [dmsActor, setDmsActor] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createAuthActor(identity);
      const d = await createDmsActor(identity);
      setDmsActor(d);
      const all = await a.getAllUsers();
      setUsers(all);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!dmsActor) return;
    try {
      const result = await dmsActor.listConversations();
      const sorted = [...result].sort((a, b) => Number(b.lastMessage.timestamp) - Number(a.lastMessage.timestamp));
      setConversations(sorted);
    } catch (e) {}
  }, [dmsActor]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  const nameOf = (principalText) => {
    const u = users.find((x) => x.id.toString() === principalText);
    return u ? u.username : principalText;
  };

  const others = users.filter((u) => !profile || u.id.toString() !== profile.id.toString());
  const conversationIds = new Set(conversations.map((c) => c.otherUser.toString()));
  const noConversationYet = others.filter((u) => !conversationIds.has(u.id.toString()));

  return (
    <div>
      <h1 className="page-title">DMs</h1>
      <p className="page-subtitle">Your conversations.</p>

      <div className="card-grid tree-grid">
        {conversations.map((c) => {
          const otherId = c.otherUser.toString();
          const preview = c.lastMessage.text
            ? c.lastMessage.text
            : c.lastMessage.attachment.length > 0
            ? "📎 Attachment"
            : "";
          return (
            <div
              key={otherId}
              className={"card tree-card" + (c.hasUnread ? " topbar-button-glow" : "")}
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/dms/" + otherId)}
            >
              <div className="card-title">
                <Link to={"/profile/" + otherId} onClick={(e) => e.stopPropagation()}>
                  {nameOf(otherId)}
                </Link>
              </div>
              <div className="card-description">{preview}</div>
              <div className="tree-rel" style={{ marginTop: 6 }}>{timeAgo(c.lastMessage.timestamp)}</div>
            </div>
          );
        })}
        {conversations.length === 0 && <p className="chat-empty">No conversations yet.</p>}
      </div>

      {noConversationYet.length > 0 && (
        <>
          <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Start a new conversation</h2>
          <div className="card-grid tree-grid">
            {noConversationYet.map((u) => (
              <Link key={u.id.toString()} to={"/dms/" + u.id.toString()} className="card tree-card">
                <div className="card-title">{u.username}</div>
                <div className="card-description">Send a message</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
