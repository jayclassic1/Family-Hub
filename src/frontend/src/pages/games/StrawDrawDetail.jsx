import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createAuthActor } from "../../auth.js";
import { createStrawDrawActor } from "../../strawdrawApi.js";
import { attachmentToUrl } from "../../chat.js";
import Lightbox from "../../components/Lightbox.jsx";

export default function StrawDrawDetail() {
  const { gameId } = useParams();
  const { identity, profile } = useAuth();
  const [strawActor, setStrawActor] = useState(null);
  const [authActor, setAuthActor] = useState(null);
  const [game, setGame] = useState(null);
  const [results, setResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [myStraw, setMyStraw] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const numericGameId = Number(gameId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createStrawDrawActor(identity);
      const a = await createAuthActor(identity);
      setStrawActor(s);
      setAuthActor(a);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!strawActor) return;
    try {
      const [g, res, mine, cm] = await Promise.all([
        strawActor.getGame(numericGameId),
        strawActor.getResults(numericGameId),
        strawActor.getMyStraw(numericGameId),
        strawActor.getComments(numericGameId),
      ]);
      setGame(g.length > 0 ? g[0] : null);
      setResults(res);
      setMyStraw(mine.length > 0 ? mine[0] : null);
      setComments(cm);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [strawActor, numericGameId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  const nameOf = (principalText) => {
    const u = allUsers.find((x) => x.id.toString() === principalText);
    return u ? u.username : principalText;
  };

  const isParticipant =
    game && profile && game.participants.some((p) => p.toString() === profile.id.toString());
  const hasRevealedAlready = myStraw !== null;

  const handleReveal = async () => {
    if (!strawActor) return;
    setRevealing(true);
    setError(null);
    try {
      await strawActor.revealMyStraw(numericGameId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setRevealing(false);
    }
  };

  const commentingRef = useRef(false);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!strawActor || !commentText.trim()) return;
    if (commentingRef.current) return;
    commentingRef.current = true;
    setError(null);
    try {
      await strawActor.addComment(numericGameId, commentText.trim());
      setCommentText("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      commentingRef.current = false;
    }
  };

  if (!game) return <p className="chat-empty">Loading...</p>;

  const coverUrl = game.coverPhoto.length > 0 ? attachmentToUrl(game.coverPhoto[0]) : null;

  return (
    <div>
      <Link to="/games/straw-draw" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Draw Straws
      </Link>

      {coverUrl && (
        <div className="event-cover-wrap">
          <img src={coverUrl} alt={game.name} className="zoomable-image event-cover-image" onClick={() => setLightboxSrc(coverUrl)} />
        </div>
      )}

      <h1 className="page-title">🥢 {game.name}</h1>
      {game.description && <p className="page-subtitle">{game.description}</p>}
      <p className="tree-rel">
        by <Link to={"/profile/" + game.creator.toString()}>{game.creatorName}</Link> — {game.shortStrawCount.toString()} short straw(s) among {game.participants.length} people
      </p>

      {isParticipant && (
        <div className="tree-admin-panel" style={{ marginTop: 16 }}>
          <h2 className="tree-admin-title">Your straw</h2>
          {hasRevealedAlready ? (
            <div className="coin-toss-result" style={{ marginTop: 0 }}>
              {myStraw ? "You drew the short straw!" : "You drew a long straw."}
            </div>
          ) : (
            <button className="chat-send-button" onClick={handleReveal} disabled={revealing}>
              {revealing ? "Revealing..." : "🥢 Reveal my straw"}
            </button>
          )}
        </div>
      )}

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Results</h2>
      <div className="card-grid tree-grid">
        {results.map((r) => (
          <div key={r.participant.toString()} className="card tree-card">
            <div className="card-title">{nameOf(r.participant.toString())}</div>
            {r.revealed ? (
              <div className="card-description">
                {r.isShort.length > 0 && r.isShort[0] ? "🥢 Short straw" : "Long straw"}
              </div>
            ) : (
              <div className="tree-rel">Not revealed yet</div>
            )}
          </div>
        ))}
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
        <textarea className="chat-text-input" rows={1} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(e); } }} />
        <button className="chat-send-button" type="submit">Post</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
