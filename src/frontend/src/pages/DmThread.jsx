import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createDmsActor } from "../dms.js";
import { fileToAttachment, attachmentToUrl, isImageAttachment } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import { Principal } from "@icp-sdk/core/principal";
import StyledUserName from "../components/StyledUserName.jsx";
import ChatBubbleSkin from "../components/ChatBubbleSkin.jsx";
import { playChatDing } from "../soundEffects.js";
import JSZip from "jszip";
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
      setError("Something went wrong. Please try again.");
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

  const lastMessageIdRef = useRef(null);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1].id.toString();
    if (lastId === lastMessageIdRef.current) return;
    const isFirstLoad = lastMessageIdRef.current === null;
    lastMessageIdRef.current = lastId;
    bottomRef.current?.scrollIntoView({ behavior: isFirstLoad ? "auto" : "smooth" });
    if (!isFirstLoad) {
      playChatDing();
    }
  }, [messages]);

  const [zipping, setZipping] = useState(false);

  const handleDownloadZip = async (scope) => {
    if (zipping) return;
    const targets = messages.filter((m) => {
      if (m.attachment.length === 0) return false;
      if (scope === "all") return true;
      const daysOld = (Date.now() - Number(m.timestamp) / 1_000_000) / (1000 * 60 * 60 * 24);
      return 30 - daysOld <= 7;
    });
    if (targets.length === 0) {
      setError("No images match that option right now.");
      return;
    }
    setZipping(true);
    setError(null);
    try {
      const zip = new JSZip();
      targets.forEach((m) => {
        const a = m.attachment[0];
        zip.file(m.id.toString() + "_" + a.filename, new Uint8Array(a.data));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dm-photos.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Something went wrong building the zip. Please try again.");
    } finally {
      setZipping(false);
    }
  };

  const sendingRef = useRef(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!dmsActor) return;
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
      await dmsActor.sendDirectMessage(Principal.fromText(userId), text.trim(), attachment);
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
    const willBeCompressed = f.type.startsWith("image/") && f.type !== "image/gif";
    if (!willBeCompressed && f.size > MAX_UPLOAD_BYTES) {
      setError("File is too large (max ~1.8MB for now).");
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
            <ChatBubbleSkin key={m.id.toString()} userId={m.sender} isMe={isMe} myShopProfile={myShopProfile}>
              {(skinClass) => (
            <div className={"chat-message" + (isMe ? " chat-message-me" : "") + skinClass}>
              <div className="chat-message-sender">
                <Link to={"/profile/" + m.sender.toString()}>
                  <StyledUserName userId={m.sender} name={m.senderName} isMe={isMe} myShopProfile={myShopProfile} />
                </Link>
              </div>
              {m.text ? <div className="chat-message-text">{m.text}</div> : null}
              {attachment && (() => {
                const daysOld = (Date.now() - Number(m.timestamp) / 1_000_000) / (1000 * 60 * 60 * 24);
                const daysRemaining = Math.max(0, Math.ceil(30 - daysOld));
                return daysRemaining <= 7 ? (
                  <div
                    className="tree-rel"
                    style={{
                      background: "#fff3d6",
                      border: "1px solid #f2b84c",
                      borderRadius: 8,
                      padding: "4px 8px",
                      marginTop: 4,
                      fontWeight: 700,
                      color: "#a3591f",
                    }}
                  >
                    ⚠️ Image expires in {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                  </div>
                ) : null;
              })()}
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
              {!attachment && m.imageExpired && (
                <div className="tree-rel" style={{ fontStyle: "italic" }}>🖼️ Image Expired</div>
              )}
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
              )}
            </ChatBubbleSkin>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="chat-send-button" onClick={() => handleDownloadZip("expiring")} disabled={zipping}>
          {zipping ? "Zipping..." : "📦 Download Expiring Soon"}
        </button>
        <button className="chat-send-button" onClick={() => handleDownloadZip("all")} disabled={zipping}>
          {zipping ? "Zipping..." : "📦 Download All Photos"}
        </button>
      </div>

      <form className="chat-input-row" onSubmit={handleSend}>
        <textarea
          className="chat-text-input"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Message " + otherName + "..."}
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
