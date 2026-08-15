import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createEventsActor, formatEventKind } from "../events.js";
import { fileToAttachment, attachmentToUrl } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import StyledUserName from "../components/StyledUserName.jsx";
import { createShopActor } from "../shopApi.js";
import ShareToChatButton from "../components/ShareToChatButton.jsx";

const IMAGE_TYPES = ["image/png", "image/jpeg"];
import { MAX_UPLOAD_BYTES as MAX_PHOTO_BYTES } from "../chat.js";

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const isAdmin = profile && "admin" in profile.role;
  const [eventsActor, setEventsActor] = useState(null);
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [myRsvp, setMyRsvp] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [myEventLove, setMyEventLove] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [myShopProfile, setMyShopProfile] = useState(null);
  const fileInputRef = useRef(null);
  const numericEventId = Number(eventId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const e = await createEventsActor(identity);
      setEventsActor(e);
      try {
        const s = await createShopActor(identity);
        const sp = await s.getMyShopProfile();
        setMyShopProfile(sp);
      } catch (err) {}
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!eventsActor) return;
    try {
      const [ev, rs, mine, cm, ph, loved] = await Promise.all([
        eventsActor.getEvent(numericEventId),
        eventsActor.getRsvps(numericEventId),
        eventsActor.getMyRsvp(numericEventId),
        eventsActor.getEventComments(numericEventId),
        eventsActor.getEventPhotos(numericEventId),
        eventsActor.getMyEventLoveGiven(numericEventId),
      ]);
      setEvent(ev.length > 0 ? ev[0] : null);
      setRsvps(rs);
      setMyRsvp(mine.length > 0 ? Object.keys(mine[0])[0] : null);
      setComments(cm);
      setPhotos(ph);
      setMyEventLove(loved);
    } catch (e2) {
      setError(String(e2));
    }
  }, [eventsActor, numericEventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!eventsActor) return;
    if (!window.confirm("Delete this event? This can\'t be undone.")) return;
    setError(null);
    try {
      await eventsActor.deleteEvent(numericEventId);
      navigate("/events");
    } catch (e) {
      setError(String(e));
    }
  };

  const handleLoveEvent = async () => {
    if (!eventsActor) return;
    setError(null);
    try {
      const ok = await eventsActor.loveThisEvent(numericEventId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleLoveComment = async (commentId) => {
    if (!eventsActor) return;
    setError(null);
    try {
      const ok = await eventsActor.loveThisEventComment(commentId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleReactComment = async (commentId, isThumbsUp) => {
    if (!eventsActor) return;
    setError(null);
    try {
      await eventsActor.reactToEventComment(commentId, isThumbsUp);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!eventsActor) return;
    setError(null);
    try {
      await eventsActor.deleteEventComment(commentId);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRsvp = async (response) => {
    if (!eventsActor) return;
    setError(null);
    try {
      await eventsActor.rsvp(numericEventId, { [response]: null });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!eventsActor || !commentText.trim()) return;
    setError(null);
    try {
      await eventsActor.addEventComment(numericEventId, commentText.trim());
      setCommentText("");
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const handlePhotoUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !eventsActor) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Only PNG or JPG photos are supported.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      setError("Photo is too large (max ~3.3MB).");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const attachment = await fileToAttachment(f);
      await eventsActor.uploadEventPhoto(numericEventId, attachment);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (e2) {
      setError(String(e2));
    } finally {
      setUploading(false);
    }
  };

  if (!event) return <p className="chat-empty">Loading...</p>;

  const grouped = { yes: [], maybe: [], no: [] };
  rsvps.forEach((r) => {
    const key = Object.keys(r.response)[0];
    if (grouped[key]) grouped[key].push(r);
  });

  const coverUrl = event.coverPhoto.length > 0 ? attachmentToUrl(event.coverPhoto[0]) : null;

  return (
    <div>
      <Link to="/events" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Calendar
      </Link>

      {coverUrl && (
        <div className="event-cover-wrap">
          <img
            src={coverUrl}
            alt={event.title}
            className="zoomable-image event-cover-image"
            onClick={() => setLightboxSrc(coverUrl)}
          />
        </div>
      )}

      <h1 className="page-title">{event.title}</h1>
      <p className="page-subtitle">{formatEventKind(event)}</p>
      <p className="tree-rel">by <Link to={"/profile/" + event.creator.toString()}>{event.creatorName}</Link></p>
      <div style={{ marginBottom: 12 }}>
        <ShareToChatButton
          shareType="event"
          shareTitle={"Event: " + event.title}
          shareLink={"/events/" + eventId}
          compact
        />
      </div>
      {profile && (event.creator.toString() === profile.id.toString() || isAdmin) && (
        <button className="tree-remove-btn" style={{ marginBottom: 12 }} onClick={handleDelete}>
          {event.creator.toString() === profile.id.toString() ? "Delete event" : "Delete event (admin)"}
        </button>
      )}
      {profile && event.creator.toString() !== profile.id.toString() && (
        myEventLove ? (
          <p className="tree-rel" style={{ marginBottom: 12 }}>💗 Love sent</p>
        ) : (
          <button
            className="chat-send-button"
            style={{ marginBottom: 12, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
            onClick={handleLoveEvent}
          >
            💗 Love this event (1)
          </button>
        )
      )}

      {event.description && (
        <div className="tree-admin-panel">
          <p style={{ margin: 0 }}>{event.description}</p>
        </div>
      )}

      <div className="tree-admin-panel" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["yes", "maybe", "no"].map((r) => (
            <button
              key={r}
              className="chat-send-button"
              style={{ background: myRsvp === r ? "var(--orange-dark)" : "var(--orange)" }}
              onClick={() => handleRsvp(r)}
            >
              {r === "yes" ? "Yes" : r === "no" ? "No" : "Maybe"}
            </button>
          ))}
        </div>
        <div className="tree-rel">
          Yes: {grouped.yes.length} · Maybe: {grouped.maybe.length} · No: {grouped.no.length}
        </div>
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Photo Album</h2>
      <div className="tree-admin-panel">
        <div style={{ marginBottom: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handlePhotoUpload}
            disabled={uploading}
          />
          {uploading && <span className="tree-rel" style={{ marginLeft: 10 }}>Uploading...</span>}
        </div>
        {photos.length === 0 ? (
          <p className="chat-empty">No photos yet — add the first one!</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {photos.map((p) => {
              const url = attachmentToUrl(p.photo);
              return (
                <div key={p.id.toString()}>
                  <img
                    src={url}
                    alt={p.uploaderName + "'s photo"}
                    className="zoomable-image event-thumb-image"
                    onClick={() => setLightboxSrc(url)}
                  />
                  <div className="tree-rel" style={{ marginTop: 4 }}>by <Link to={"/profile/" + p.uploader.toString()}>{p.uploaderName}</Link></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Comments</h2>
      <div className="chat-window" style={{ height: "auto", minHeight: 100 }}>
        {comments.length === 0 && <p className="chat-empty">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id.toString()} className="chat-message">
            <div className="chat-message-sender">
              <Link to={"/profile/" + c.author.toString()}>
                <StyledUserName
                  userId={c.author}
                  name={c.authorName}
                  isMe={profile && c.author.toString() === profile.id.toString()}
                  myShopProfile={myShopProfile}
                />
              </Link>
            </div>
            <div className="chat-message-text">{c.text}</div>
            <div className="tree-rel" style={{ marginTop: 4 }}>
              👎 {c.thumbsDownCount.toString()}
            </div>
            {profile && c.author.toString() !== profile.id.toString() && (
              c.myReaction.length > 0 ? (
                <span className="tree-rel">You reacted: {c.myReaction[0] ? "👍" : "👎"}</span>
              ) : (
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => handleReactComment(c.id, true)}>
                    👍
                  </button>
                  <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => handleReactComment(c.id, false)}>
                    👎
                  </button>
                </div>
              )
            )}
            {profile && c.author.toString() !== profile.id.toString() && (
              c.myLoveGiven ? (
                <span className="tree-rel" style={{ marginLeft: 8 }}>💗 sent</span>
              ) : (
                <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12, marginLeft: 6, background: "#e0558f" }} onClick={() => handleLoveComment(c.id)}>
                  💗
                </button>
              )
            )}
            {profile && (c.author.toString() === profile.id.toString() || isAdmin) && (
              <button className="delete-x-btn" onClick={() => handleDeleteComment(c.id)} title={c.author.toString() === profile.id.toString() ? "Delete" : "Delete (admin)"}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={handleComment} style={{ marginTop: 10 }}>
        <input
          className="chat-text-input"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
        />
        <button className="chat-send-button" type="submit">Post</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
