import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createSecretSantaActor } from "../../secretsanta.js";
import { attachmentToUrl } from "../../chat.js";
import Lightbox from "../../components/Lightbox.jsx";

export default function SecretSantaDetail() {
  const { exchangeId } = useParams();
  const { identity, profile } = useAuth();
  const [santaActor, setSantaActor] = useState(null);
  const [authActor, setAuthActor] = useState(null);
  const [exchange, setExchange] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [myMatch, setMyMatch] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const numericExchangeId = Number(exchangeId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createSecretSantaActor(identity);
      const a = await createAuthActor(identity);
      setSantaActor(s);
      setAuthActor(a);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!santaActor) return;
    try {
      const [ex, cm] = await Promise.all([
        santaActor.getExchange(numericExchangeId),
        santaActor.getSantaComments(numericExchangeId),
      ]);
      setExchange(ex.length > 0 ? ex[0] : null);
      setComments(cm);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [santaActor, numericExchangeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const nameOf = (principalText) => {
    const u = allUsers.find((x) => x.id.toString() === principalText);
    return u ? u.username : principalText;
  };

  const isParticipant =
    exchange && profile && exchange.participants.some((p) => p.toString() === profile.id.toString());

  const handleReveal = async () => {
    if (!santaActor) return;
    setLoadingMatch(true);
    setError(null);
    try {
      const result = await santaActor.getMyMatch(numericExchangeId);
      if (result.length > 0) {
        setMyMatch(result[0]);
        setRevealed(true);
      } else {
        setError("Couldn't find your match — are you part of this exchange?");
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoadingMatch(false);
    }
  };

  const commentingRef = useRef(false);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!santaActor || !commentText.trim()) return;
    if (commentingRef.current) return;
    commentingRef.current = true;
    setError(null);
    try {
      await santaActor.addSantaComment(numericExchangeId, commentText.trim());
      setCommentText("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      commentingRef.current = false;
    }
  };

  if (!exchange) return <p className="chat-empty">Loading...</p>;

  const coverUrl = exchange.coverPhoto.length > 0 ? attachmentToUrl(exchange.coverPhoto[0]) : null;

  return (
    <div>
      <Link to="/games/secret-santa" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Secret Santa
      </Link>

      {coverUrl && (
        <div className="event-cover-wrap">
          <img
            src={coverUrl}
            alt={exchange.name}
            className="zoomable-image event-cover-image"
            onClick={() => setLightboxSrc(coverUrl)}
          />
        </div>
      )}

      <h1 className="page-title">🎅 {exchange.name}</h1>
      {exchange.description && <p className="page-subtitle">{exchange.description}</p>}
      <p className="tree-rel">
        Organized by <Link to={"/profile/" + exchange.organizer.toString()}>{exchange.organizerName}</Link> — participants: {exchange.participants.map((p) => nameOf(p.toString())).join(", ")}
      </p>

      <div className="tree-admin-panel" style={{ marginTop: 16 }}>
        <h2 className="tree-admin-title">Your Match</h2>
        {!isParticipant ? (
          <p className="tree-rel">You're not part of this exchange.</p>
        ) : !revealed ? (
          <button className="chat-send-button" onClick={handleReveal} disabled={loadingMatch}>
            {loadingMatch ? "Checking the sack..." : "🎁 See who I got"}
          </button>
        ) : (
          <div className="santa-match-reveal">
            You got <strong>{myMatch.recipientName}</strong>! 🎄
          </div>
        )}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Comments</h2>
      <div className="chat-window" style={{ height: "auto", minHeight: 100 }}>
        {comments.length === 0 && <p className="chat-empty">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id.toString()} className="chat-message">
            <div className="chat-message-sender">
              <Link to={"/profile/" + c.author.toString()}>{c.authorName}</Link>
            </div>
            <div className="chat-message-text">{c.text}</div>
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={handleComment} style={{ marginTop: 10 }}>
        <textarea
          className="chat-text-input"
          rows={1}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleComment(e);
            }
          }}
        />
        <button className="chat-send-button" type="submit">Post</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
