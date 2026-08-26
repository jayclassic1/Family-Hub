import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createHatGameActor } from "../../hatgame.js";
import { attachmentToUrl } from "../../chat.js";
import Lightbox from "../../components/Lightbox.jsx";

export default function HatDrawDetail() {
  const { drawId } = useParams();
  const { identity } = useAuth();
  const [hatGameActor, setHatGameActor] = useState(null);
  const [draw, setDraw] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const numericDrawId = Number(drawId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const h = await createHatGameActor(identity);
      setHatGameActor(h);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!hatGameActor) return;
    try {
      const [d, cm] = await Promise.all([
        hatGameActor.getDraw(numericDrawId),
        hatGameActor.getDrawComments(numericDrawId),
      ]);
      setDraw(d.length > 0 ? d[0] : null);
      setComments(cm);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [hatGameActor, numericDrawId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const commentingRef = useRef(false);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!hatGameActor || !commentText.trim()) return;
    if (commentingRef.current) return;
    commentingRef.current = true;
    setError(null);
    try {
      await hatGameActor.addDrawComment(numericDrawId, commentText.trim());
      setCommentText("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      commentingRef.current = false;
    }
  };

  if (!draw) return <p className="chat-empty">Loading...</p>;

  const coverUrl = draw.coverPhoto.length > 0 ? attachmentToUrl(draw.coverPhoto[0]) : null;

  return (
    <div>
      <Link to="/games/hat-results" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Important Draws
      </Link>

      {coverUrl && (
        <div className="event-cover-wrap">
          <img
            src={coverUrl}
            alt={draw.name}
            className="zoomable-image event-cover-image"
            onClick={() => setLightboxSrc(coverUrl)}
          />
        </div>
      )}

      <h1 className="page-title">{draw.name}</h1>
      {draw.description && <p className="page-subtitle">{draw.description}</p>}
      <p className="tree-rel">Drawn by <Link to={"/profile/" + draw.drawer.toString()}>{draw.drawerName}</Link></p>

      <div className="tree-admin-panel" style={{ marginTop: 16 }}>
        <h2 className="tree-admin-title">Results</h2>
        {draw.assignments.map((a, i) => (
          <div key={i} className="hat-result-row" style={{ animation: "none", opacity: 1 }}>
            <strong>{a.participant}</strong> drew: <span>{a.answer}</span>
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
