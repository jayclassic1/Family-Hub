import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createChatActor, fileToAttachment, attachmentToUrl, isImageAttachment } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import StyledUserName from "../components/StyledUserName.jsx";
import { createShopActor } from "../shopApi.js";
import { ThumbsUpIcon, ThumbsDownIcon, HeartIcon } from "../components/ReactionIcons.jsx";
import { LovedEffectOverlay, SendEffectOverlay } from "../components/LoveEffects.jsx";
import { createAuthActor } from "../auth.js";
import ChatBubbleSkin from "../components/ChatBubbleSkin.jsx";
import { useTopBarActions } from "../context/TopBarActionsContext.jsx";

function shareIcon(shareType) {
  const icons = {
    chess: "♟️",
    poker: "🃏",
    tetris: "🧱",
    rps: "✊",
    vote: "🗳️",
    event: "📅",
    invite: "✉️",
    recipe: "🍽️",
    album: "📷",
  };
  return icons[shareType] || "🔗";
}

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

import { MAX_UPLOAD_BYTES } from "../chat.js";
import { playChatDing } from "../soundEffects.js";

export default function Home() {
  const { profile, identity } = useAuth();
  const isAdmin = profile && "admin" in profile.role;
  const { setAction } = useTopBarActions() || {};
  const [chatActor, setChatActor] = useState(null);
  const [birthdayNames, setBirthdayNames] = useState([]);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      try {
        const authActor = await createAuthActor(identity);
        const allUsers = await authActor.getAllUsers();
        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();
        const names = allUsers
          .filter(
            (u) =>
              u.birthdayMonth.length > 0 &&
              u.birthdayDay.length > 0 &&
              Number(u.birthdayMonth[0]) === todayMonth &&
              Number(u.birthdayDay[0]) === todayDay
          )
          .map((u) => u.username);
        setBirthdayNames(names);
      } catch (e) {
        setBirthdayNames([]);
      }
    })();
  }, [identity]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [isBanner, setIsBanner] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [myShopProfile, setMyShopProfile] = useState(null);
  const [activeLovedEffects, setActiveLovedEffects] = useState({});
  const [activeSendEffects, setActiveSendEffects] = useState([]);
  const bottomRef = useRef(null);
  const chatWindowRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastLoveEventIdRef = useRef(0);
  const loveEventsInitRef = useRef(false);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const actor = await createChatActor(identity);
      setChatActor(actor);
      try {
        const s = await createShopActor(identity);
        const sp = await s.getMyShopProfile();
        setMyShopProfile(sp);
      } catch (e) {}
    })();
  }, [identity]);

  const handleLoveMessage = async (messageId) => {
    if (!chatActor) return;
    try {
      await chatActor.loveThisMessage(messageId);
      await refresh();
    } catch (e) {}
  };

  const handleReactMessage = async (messageId, isThumbsUp) => {
    if (!chatActor) return;
    try {
      await chatActor.reactToMessage(messageId, isThumbsUp);
      await refresh();
    } catch (e) {}
  };

  const handleDeleteMessage = async (messageId) => {
    if (!chatActor) return;
    try {
      await chatActor.deleteMessage(messageId);
      await refresh();
    } catch (e) {}
  };

  const refresh = useCallback(async () => {
    if (!chatActor) return;
    try {
      const result = await chatActor.getMessages();
      const sorted = [...result].sort((a, b) => Number(a.id) - Number(b.id));
      setMessages(sorted);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [chatActor]);

  const refreshPinned = useCallback(async () => {
    if (!chatActor) return;
    try {
      const result = await chatActor.getPinnedMessages();
      const sorted = [...result].sort((a, b) => Number(b.id) - Number(a.id));
      setPinnedMessages(sorted);
    } catch (e) {}
  }, [chatActor]);

  const pollLoveEvents = useCallback(async () => {
    if (!chatActor) return;
    try {
      const events = await chatActor.getLoveEventsSince(lastLoveEventIdRef.current);
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
  }, [chatActor]);

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

  const handleUnpin = async (messageId) => {
    if (!chatActor) return;
    try {
      await chatActor.unpinMessage(messageId);
      await refreshPinned();
    } catch (e) {}
  };

  useEffect(() => {
    if (!chatActor) return;
    refresh();
    refreshPinned();
    pollLoveEvents();
    const interval = setInterval(() => {
      refresh();
      refreshPinned();
      pollLoveEvents();
    }, 4000);
    return () => clearInterval(interval);
  }, [chatActor, refresh, refreshPinned, pollLoveEvents]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1].id.toString();
    if (lastId === lastMessageIdRef.current) return;
    const isFirstLoad = lastMessageIdRef.current === null;
    lastMessageIdRef.current = lastId;

    const el = chatWindowRef.current;
    const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 150 : true;
    if (isFirstLoad || nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: isFirstLoad ? "auto" : "smooth" });
    }
    if (!isFirstLoad) {
      playChatDing();
    }
  }, [messages]);

  useEffect(() => {
    if (!setAction) return;
    if (pinnedMessages.length > 0) {
      setAction(
        <div className="chat-pinned-box" onClick={() => setShowPinnedModal(true)}>
          {pinnedMessages.map((m) => {
            const pinAttachment = m.attachment.length > 0 ? m.attachment[0] : null;
            const pinIsImg = pinAttachment ? isImageAttachment(pinAttachment) : false;
            return (
              <div key={"pinned-row-" + m.id.toString()} className="chat-pinned-row">
                <span className="chat-pinned-row-icon">📌</span>
                <span className="chat-pinned-row-text">
                  <span className="chat-pinned-row-sender">{m.senderName}: </span>
                  {m.text || (m.shareTitle.length > 0 ? m.shareTitle[0] : pinAttachment ? "" : "Shared something")}
                </span>
                {pinAttachment && pinIsImg && (
                  <button
                    className="chat-pinned-photo-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxSrc(attachmentToUrl(pinAttachment));
                    }}
                    type="button"
                  >
                    📷 View photo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      );
    } else {
      setAction(null);
    }
    return () => setAction(null);
  }, [setAction, pinnedMessages]);

  const sendingRef = useRef(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!chatActor) return;
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
      const newId = await chatActor.sendMessage(text.trim(), attachment, isBanner, isPinned);
      setText("");
      setFile(null);
      setIsBanner(false);
      setIsPinned(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
      await refreshPinned();

      if (isBanner || isPinned) {
        try {
          const all = await chatActor.getMessages();
          const sent = all.find((x) => x.id.toString() === newId.toString());
          if (sent) {
            if (isPinned && !sent.isPinned) {
              alert("Not enough Love to pin this message — it sent as a normal message instead. Pinning costs 2 Love.");
            } else if (isBanner && !sent.isBanner) {
              alert("Not enough Love to shout this message — it sent as a normal message instead. Shouting costs 1 Love.");
            }
          }
        } catch (e2) {}
      }
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
    <div className={"chat-page" + (birthdayNames.length > 0 ? " chat-page-birthday" : "")}>
      {birthdayNames.length > 0 && (
        <div className="chat-birthday-banner">
          🎉 It{"\u2019"}s {birthdayNames.join(" & ")}{"\u2019"}s Birthday! 🎉
        </div>
      )}
      {activeSendEffects.map((e) => (
        <SendEffectOverlay key={e.uid} effectKey={e.type} onDone={() => removeSendEffect(e.uid)} />
      ))}
      {showPinnedModal && (
        <div className="chat-pinned-modal-overlay" onClick={() => setShowPinnedModal(false)}>
          <div className="chat-pinned-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-pinned-modal-header">
              <h2 className="tree-admin-title" style={{ margin: 0 }}>📌 Pinned Messages</h2>
              <button className="delete-x-btn" onClick={() => setShowPinnedModal(false)} title="Close">
                ✕
              </button>
            </div>
            {pinnedMessages.map((m) => {
              const isMe = profile && m.sender.toString() === profile.id.toString();
              return (
                <div key={"pinned-modal-" + m.id.toString()} className="chat-pinned-message" style={{ marginBottom: 10 }}>
                  <div className="chat-pinned-icon">📌</div>
                  <div className="chat-pinned-body">
                    <div className="chat-pinned-sender">
                      <Link to={"/profile/" + m.sender.toString()}>{m.senderName}</Link>
                    </div>
                    {m.text ? <div className="chat-pinned-text">{m.text}</div> : null}
                    {m.attachment.length > 0 && isImageAttachment(m.attachment[0]) ? (
                      <img
                        className="chat-attachment-image chat-attachment-image-large zoomable-image"
                        src={attachmentToUrl(m.attachment[0])}
                        alt={m.attachment[0].filename}
                        style={{ marginTop: 6 }}
                        onClick={() => setLightboxSrc(attachmentToUrl(m.attachment[0]))}
                      />
                    ) : null}
                    {m.shareType.length > 0 ? (
                      <Link
                        to={m.shareLink.length > 0 ? m.shareLink[0] : "/"}
                        className={"chat-share-card" + (m.animated ? " chat-share-card-animated" : "")}
                        style={{ marginTop: 6 }}
                      >
                        <div className="chat-share-icon">{shareIcon(m.shareType[0])}</div>
                        <div className="chat-share-title">{m.shareTitle.length > 0 ? m.shareTitle[0] : "Shared"}</div>
                      </Link>
                    ) : null}
                  </div>
                  {isMe && (
                    <button className="delete-x-btn" onClick={() => handleUnpin(m.id)} title="Unpin">
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="chat-window" ref={chatWindowRef}>
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet. Be the first to say something!</p>
        )}
        {messages.map((m) => {
          const isMe = profile && m.sender.toString() === profile.id.toString();
          const attachment = m.attachment.length > 0 ? m.attachment[0] : null;
          const isImg = attachment ? isImageAttachment(attachment) : false;
          return (
            <ChatBubbleSkin key={m.id.toString()} userId={m.sender} isMe={isMe} myShopProfile={myShopProfile}>
              {(skinClass) => (
            <div
              className={
                "chat-message" +
                (isMe ? " chat-message-me" : "") +
                (m.isBanner ? " chat-message-banner" : "") +
                skinClass
              }
              style={{ position: "relative" }}
            >
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
              {m.shareType.length > 0 ? (
                <Link
                  to={m.shareLink.length > 0 ? m.shareLink[0] : "/"}
                  className={"chat-share-card" + (m.animated ? " chat-share-card-animated" : "")}
                >
                  <div className="chat-share-icon">{shareIcon(m.shareType[0])}</div>
                  <div className="chat-share-title">{m.shareTitle.length > 0 ? m.shareTitle[0] : "Shared"}</div>
                </Link>
              ) : null}
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
                  className={"chat-attachment-image zoomable-image" + ((m.isBanner || m.isPinned) ? " chat-attachment-image-large" : "")}
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
              <div className="chat-reaction-row">
                <button
                  className={"chat-reaction-btn chat-reaction-btn-up" + (m.myReaction.length > 0 && m.myReaction[0] === true ? " chat-reaction-active" : "")}
                  onClick={() => handleReactMessage(m.id, true)}
                  disabled={isMe || m.myReaction.length > 0}
                  type="button"
                >
                  <ThumbsUpIcon />
                  <span>{m.thumbsUpCount.toString()}</span>
                </button>
                <button
                  className={"chat-reaction-btn chat-reaction-btn-down" + (m.myReaction.length > 0 && m.myReaction[0] === false ? " chat-reaction-active" : "")}
                  onClick={() => handleReactMessage(m.id, false)}
                  disabled={isMe || m.myReaction.length > 0}
                  type="button"
                >
                  <ThumbsDownIcon />
                  <span>{m.thumbsDownCount.toString()}</span>
                </button>
                <button
                  className={"chat-reaction-btn chat-reaction-btn-love" + (m.myLoveGiven ? " chat-reaction-active" : "")}
                  onClick={() => handleLoveMessage(m.id)}
                  disabled={isMe || m.myLoveGiven}
                  type="button"
                >
                  <HeartIcon />
                  <span>{m.loveCount.toString()}</span>
                </button>
              </div>
              {(isMe || isAdmin) && (
                <button className="delete-x-btn" onClick={() => handleDeleteMessage(m.id)} title={isMe ? "Delete" : "Delete (admin)"}>
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#8a7860" }}>
          <input type="checkbox" checked={isBanner} onChange={(e) => setIsBanner(e.target.checked)} />
          Shout (1 Love)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#8a7860" }}>
          <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
          Pin (2 Love)
        </label>
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
          id="chat-file-input"
        />
        <label htmlFor="chat-file-input" className="chat-attach-button">Attach</label>
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
