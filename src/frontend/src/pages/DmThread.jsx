import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createDmsActor } from "../dms.js";
import { fileToAttachment, attachmentToUrl, isImageAttachment } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import { Principal } from "@icp-sdk/core/principal";
import StyledUserName from "../components/StyledUserName.jsx";
import { createShopActor } from "../shopApi.js";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

import { MAX_UPLOAD_BYTES } from "../chat.js";

export default function DmThread() {
  const { userId } = useParams();
  const { identity, profile } = useAuth();
  const [otherName, setOtherName] = useState(userId);
  const [dmsActor, setDmsActor] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [myShopProfile, setMyShopProfile] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createAuthActor(identity);
      const result = await a.getUser(Principal.fromText(userId));
      if (result.length > 0) setOtherName(result[0].username);
      const d = await createDmsActor(identity);
      setDmsActor(d);
      try {
        const s = await createShopActor(identity);
        const sp = await s.getMyShopProfile();
        setMyShopProfile(sp);
      } catch (e) {}
    })();
  }, [identity, userId]);

  const handleLoveMessage = async (messageId) => {
    if (!dmsActor) return;
    try {
      await dmsActor.loveThisMessage(messageId);
      await refresh();
    } catch (e) {}
  };

  const handleReactMessage = async (messageId, isThumbsUp) => {
    if (!dmsActor) return;
    try {
      await dmsActor.reactToMessage(messageId, isThumbsUp);
      await refresh();
    } catch (e) {}
  };

  const handleDeleteMessage = async (messageId) => {
    if (!dmsActor) return;
    try {
      await dmsActor.deleteDirectMessage(messageId);
      await refresh();
    } catch (e) {}
  };

  const refresh = useCallback(async () => {
    if (!dmsActor) return;
    try {
      const result = await dmsActor.getConversation(Principal.fromText(userId));
      const sorted = [...result].sort((a, b) => Number(a.id) - Number(b.id));
      setMessages(sorted);
    } catch (e) {
      setError(String(e));
    }
  }, [dmsActor, userId]);

  useEffect(() => {
    if (!dmsActor) return;
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [dmsActor, refresh]);

  useEffect(() => {
    if (!dmsActor || !userId) return;
    dmsActor.markRead(Principal.fromText(userId)).catch(() => {});
  }, [dmsActor, userId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!dmsActor) return;
    if (!text.trim() && !file) return;

    setSending(true);
    setError(null);
    try {
      let attachment = [];
      if (file) {
        const a = await fileToAttachment(file);
        attachment = [a];
      }
      await dmsActor.sendDirectMessage(Principal.fromText(userId), text.trim(), attachment);
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
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

  return (
    <div className="chat-page">
      <h1 className="chat-title">DM — {otherName}</h1>

      <div className="chat-window">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => {
          const isMe = profile && m.sender.toString() === profile.id.toString();
          const attachment = m.attachment.length > 0 ? m.attachment[0] : null;
          const isImg = attachment ? isImageAttachment(attachment) : false;
          return (
            <div key={m.id.toString()} className={"chat-message" + (isMe ? " chat-message-me" : "")}>
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
              {isMe && (
                <button className="delete-x-btn" onClick={() => handleDeleteMessage(m.id)} title="Delete">
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          className="chat-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Message " + otherName + "..."}
          disabled={sending}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileChange}
          style={{ display: "none" }}
          id="dm-file-input"
        />
        <label htmlFor="dm-file-input" className="chat-attach-button">Attach</label>
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
