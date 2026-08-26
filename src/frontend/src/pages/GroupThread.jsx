import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createGroupsActor } from "../groups.js";
import { fileToAttachment, attachmentToUrl, isImageAttachment } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import StyledUserName from "../components/StyledUserName.jsx";
import { createShopActor } from "../shopApi.js";
import { LovedEffectOverlay, SendEffectOverlay } from "../components/LoveEffects.jsx";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

import { MAX_UPLOAD_BYTES } from "../chat.js";

export default function GroupThread() {
  const { groupId } = useParams();
  const { identity, profile } = useAuth();
  const isAdmin = profile && "admin" in profile.role;
  const [groupsActor, setGroupsActor] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [inviteSel, setInviteSel] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [myShopProfile, setMyShopProfile] = useState(null);
  const [activeLovedEffects, setActiveLovedEffects] = useState({});
  const [activeSendEffects, setActiveSendEffects] = useState([]);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastLoveEventIdRef = useRef(0);
  const loveEventsInitRef = useRef(false);

  const numericGroupId = Number(groupId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const g = await createGroupsActor(identity);
      const a = await createAuthActor(identity);
      setGroupsActor(g);
      try {
        const s = await createShopActor(identity);
        const sp = await s.getMyShopProfile();
        setMyShopProfile(sp);
      } catch (e) {}
      const [allGroups, mems, users] = await Promise.all([
        g.listGroups(),
        g.getGroupMembers(numericGroupId),
        a.getAllUsers(),
      ]);
      const found = allGroups.find((x) => Number(x.id) === numericGroupId);
      setGroup(found || null);
      setMembers(mems);
      setAllUsers(users);
    })();
  }, [identity, numericGroupId]);

  const handleLoveMessage = async (messageId) => {
    if (!groupsActor) return;
    try {
      await groupsActor.loveThisGroupMessage(messageId);
      await refresh();
    } catch (e) {}
  };

  const handleReactMessage = async (messageId, isThumbsUp) => {
    if (!groupsActor) return;
    try {
      await groupsActor.reactToGroupMessage(messageId, isThumbsUp);
      await refresh();
    } catch (e) {}
  };

  const handleDeleteMessage = async (messageId) => {
    if (!groupsActor) return;
    try {
      await groupsActor.deleteGroupMessage(messageId);
      await refresh();
    } catch (e) {}
  };

  const refresh = useCallback(async () => {
    if (!groupsActor) return;
    try {
      const result = await groupsActor.getGroupMessages(numericGroupId);
      const sorted = [...result].sort((a, b) => Number(a.id) - Number(b.id));
      setMessages(sorted);
      const mems = await groupsActor.getGroupMembers(numericGroupId);
      setMembers(mems);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [groupsActor, numericGroupId]);

  const pollLoveEvents = useCallback(async () => {
    if (!groupsActor) return;
    try {
      const events = await groupsActor.getGroupLoveEventsSince(numericGroupId, lastLoveEventIdRef.current);
      if (events.length === 0) return;
      const sorted = [...events].sort((a, b) => Number(a.id) - Number(b.id));
      let maxNext = lastLoveEventIdRef.current;
      sorted.forEach((ev) => {
        const idNum = Number(ev.id);
        if (idNum + 1 > maxNext) maxNext = idNum + 1;
      });
      if (!loveEventsInitRef.current) {
        loveEventsInitRef.current = true;
        lastLoveEventIdRef.current = maxNext;
        return;
      }
      lastLoveEventIdRef.current = maxNext;
      sorted.forEach((ev) => {
        if (ev.lovedEffect) {
          const msgKey = ev.messageId.toString();
          setActiveLovedEffects((prev) => ({ ...prev, [msgKey]: ev.lovedEffect }));
        }
        if (ev.sendEffect) {
          const uid = ev.id.toString() + "-" + Date.now() + "-" + Math.random();
          setActiveSendEffects((prev) => [...prev, { uid, type: ev.sendEffect }]);
        }
      });
    } catch (e) {}
  }, [groupsActor, numericGroupId]);

  const removeLovedEffect = (messageId) => {
    setActiveLovedEffects((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  };

  const removeSendEffect = (uid) => {
    setActiveSendEffects((prev) => prev.filter((e) => e.uid !== uid));
  };

  useEffect(() => {
    lastLoveEventIdRef.current = 0;
    loveEventsInitRef.current = false;
    setActiveLovedEffects({});
    setActiveSendEffects([]);
  }, [numericGroupId]);

  useEffect(() => {
    if (!groupsActor) return;
    refresh();
    pollLoveEvents();
    const interval = setInterval(() => {
      refresh();
      pollLoveEvents();
    }, 4000);
    return () => clearInterval(interval);
  }, [groupsActor, refresh, pollLoveEvents]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const nameOf = (principalText) => {
    const u = allUsers.find((x) => x.id.toString() === principalText);
    return u ? u.username : principalText;
  };

  const sendingRef = useRef(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!groupsActor) return;
    if (!text.trim() && !file) return;
    if (sendingRef.current) return;
    sendingRef.current = true;

    setSending(true);
    setError(null);
    try {
      let attachment = [];
      if (file) {
        const a = await fileToAttachment(file);
        attachment = [a];
      }
      await groupsActor.sendGroupMessage(numericGroupId, text.trim(), attachment);
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Only images, PDFs, and Word documents are supported.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("File is too large (max ~3.3MB for now).");
      e.target.value = "";
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!groupsActor || !inviteSel) return;
    setError(null);
    try {
      const target = allUsers.find((u) => u.id.toString() === inviteSel);
      if (target) {
        await groupsActor.inviteToGroup(numericGroupId, target.id);
        setInviteSel("");
        await refresh();
      }
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  const memberIds = new Set(members.map((m) => m.toString()));
  const invitable = allUsers.filter((u) => !memberIds.has(u.id.toString()));

  return (
    <div className="chat-page">
      {activeSendEffects.map((e) => (
        <SendEffectOverlay key={e.uid} effectKey={e.type} onDone={() => removeSendEffect(e.uid)} />
      ))}
      <h1 className="chat-title">{group ? group.name : "Group"}</h1>

      <div className="tree-admin-panel" style={{ marginBottom: 12 }}>
        <div className="tree-rel">Members: {members.map((m) => nameOf(m.toString())).join(", ")}</div>
        <form className="tree-admin-form" onSubmit={handleInvite} style={{ marginTop: 10 }}>
          <select value={inviteSel} onChange={(e) => setInviteSel(e.target.value)}>
            <option value="">Invite someone...</option>
            {invitable.map((u) => (
              <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
            ))}
          </select>
          <button className="chat-send-button" type="submit">Invite</button>
        </form>
      </div>

      <div className="chat-window">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => {
          const isMe = profile && m.sender.toString() === profile.id.toString();
          const attachment = m.attachment.length > 0 ? m.attachment[0] : null;
          const isImg = attachment ? isImageAttachment(attachment) : false;
          return (
            <div key={m.id.toString()} className={"chat-message" + (isMe ? " chat-message-me" : "")} style={{ position: "relative" }}>
              {activeLovedEffects[m.id.toString()] && (
                <LovedEffectOverlay
                  effectKey={activeLovedEffects[m.id.toString()]}
                  onDone={() => removeLovedEffect(m.id.toString())}
                />
              )}
              <div className="chat-message-sender">
                <Link to={"/profile/" + m.sender.toString()}>
                  <StyledUserName userId={m.sender} name={m.senderName} isMe={isMe} myShopProfile={myShopProfile} />
                </Link>
              </div>
              {m.text ? <div className="chat-message-text">{m.text}</div> : null}
              {attachment && isImg ? (
                <img
                  className="chat-attachment-image zoomable-image"
                  src={attachmentToUrl(attachment)}
                  alt={attachment.filename}
                  onClick={() => setLightboxSrc(attachmentToUrl(attachment))}
                />
              ) : null}
              {attachment && !isImg ? (
                <a className="chat-attachment-file" href={attachmentToUrl(attachment)} download={attachment.filename}>Attachment: {attachment.filename}</a>
              ) : null}
              <div className="tree-rel" style={{ marginTop: 4 }}>
                👎 {m.thumbsDownCount.toString()}
              </div>
              {!isMe && (
                m.myReaction.length > 0 ? (
                  <span className="tree-rel">You reacted: {m.myReaction[0] ? "👍" : "👎"}</span>
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => handleReactMessage(m.id, true)}>
                      👍
                    </button>
                    <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => handleReactMessage(m.id, false)}>
                      👎
                    </button>
                  </div>
                )
              )}
              {!isMe && (
                m.myLoveGiven ? (
                  <span className="tree-rel" style={{ marginLeft: 8 }}>💗 sent</span>
                ) : (
                  <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12, marginLeft: 6, background: "#e0558f" }} onClick={() => handleLoveMessage(m.id)}>
                    💗
                  </button>
                )
              )}
              {(isMe || isAdmin) && (
                <button className="delete-x-btn" onClick={() => handleDeleteMessage(m.id)} title={isMe ? "Delete" : "Delete (admin)"}>
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSend}>
        <textarea
          className="chat-text-input"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileChange}
          style={{ display: "none" }}
          id="group-file-input"
        />
        <label htmlFor="group-file-input" className="chat-attach-button">Attach</label>
        <button className="chat-send-button" type="submit" disabled={sending}>
          {sending ? "..." : "Send"}
        </button>
      </form>
      {file ? <div className="chat-file-preview">Attached: {file.name}</div> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
