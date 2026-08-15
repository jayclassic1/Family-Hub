import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createChatActor } from "../chat.js";

export default function ShareToChatButton({ shareType, shareTitle, shareLink, compact }) {
  const { identity } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const doShare = async (animated) => {
    if (!identity || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const chatActor = await createChatActor(identity);
      await chatActor.sendShareMessage(shareType, shareTitle, shareLink, animated);
      setStatus("Shared!");
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setStatus("Couldn't share");
      setTimeout(() => setStatus(null), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        className="chat-send-button"
        style={compact ? { padding: "4px 10px", fontSize: 12 } : undefined}
        onClick={() => doShare(false)}
        disabled={busy}
        type="button"
      >
        📤 Share to Chat
      </button>
      <button
        className="chat-send-button"
        style={{ background: "#f2b84c", ...(compact ? { padding: "4px 10px", fontSize: 12 } : {}) }}
        onClick={() => doShare(true)}
        disabled={busy}
        type="button"
        title="Adds an animated reveal in chat"
      >
        ✨ Animated (1 Love)
      </button>
      {status && <span className="tree-rel">{status}</span>}
    </div>
  );
}
