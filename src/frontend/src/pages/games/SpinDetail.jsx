import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createSpinsActor } from "../../spins.js";
import { attachmentToUrl } from "../../chat.js";
import Lightbox from "../../components/Lightbox.jsx";

export default function SpinDetail() {
  const { spinId } = useParams();
  const { identity } = useAuth();
  const [spinsActor, setSpinsActor] = useState(null);
  const [spin, setSpin] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const numericSpinId = Number(spinId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createSpinsActor(identity);
      setSpinsActor(s);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!spinsActor) return;
    try {
      const [sp, cm] = await Promise.all([
        spinsActor.getSpin(numericSpinId),
        spinsActor.getSpinComments(numericSpinId),
      ]);
      setSpin(sp.length > 0 ? sp[0] : null);
      setComments(cm);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [spinsActor, numericSpinId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const commentingRef = useRef(false);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!spinsActor || !commentText.trim()) return;
    if (commentingRef.current) return;
    commentingRef.current = true;
    setError(null);
    try {
      await spinsActor.addSpinComment(numericSpinId, commentText.trim());
      setCommentText("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      commentingRef.current = false;
    }
  };

  if (!spin) return <p className="chat-empty">Loading...</p>;

  const coverUrl = spin.coverPhoto.length > 0 ? attachmentToUrl(spin.coverPhoto[0]) : null;

  return (
    <div>
      <Link to="/games/spin-results" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Important Spins
      </Link>

      {coverUrl && (
        <div className="event-cover-wrap">
          <img
            src={coverUrl}
            alt={spin.name}
            className="zoomable-image event-cover-image"
            onClick={() => setLightboxSrc(coverUrl)}
          />
        </div>
      )}

      <h1 className="page-title">{spin.name}</h1>
      {spin.description && <p className="page-subtitle">{spin.description}</p>}
      <p className="tree-rel">Spun by <Link to={"/profile/" + spin.spinner.toString()}>{spin.spinnerName}</Link></p>

      <div className="tree-admin-panel" style={{ marginTop: 16 }}>
        <h2 className="tree-admin-title">Result</h2>
        <div style={{ fontSize: 20, marginBottom: 10 }}>🎉 <strong>{spin.winner}</strong></div>
        <div className="tree-rel">All options: {spin.options.join(", ")}</div>
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
