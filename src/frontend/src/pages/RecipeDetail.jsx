import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createRecipesActor, starDisplay } from "../recipesApi.js";
import { attachmentToUrl } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import StyledUserName from "../components/StyledUserName.jsx";
import { createShopActor } from "../shopApi.js";

export default function RecipeDetail() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const isAdmin = profile && "admin" in profile.role;
  const [recipesActor, setRecipesActor] = useState(null);
  const [summary, setSummary] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [myShopProfile, setMyShopProfile] = useState(null);
  const numericRecipeId = Number(recipeId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const r = await createRecipesActor(identity);
      setRecipesActor(r);
      try {
        const s = await createShopActor(identity);
        const sp = await s.getMyShopProfile();
        setMyShopProfile(sp);
      } catch (e) {}
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!recipesActor) return;
    try {
      const [s, cm] = await Promise.all([
        recipesActor.getRecipe(numericRecipeId),
        recipesActor.getComments(numericRecipeId),
      ]);
      setSummary(s.length > 0 ? s[0] : null);
      setComments(cm);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [recipesActor, numericRecipeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!recipesActor) return;
    if (!window.confirm("Delete this recipe? This can\'t be undone.")) return;
    setError(null);
    try {
      await recipesActor.deleteRecipe(numericRecipeId);
      navigate("/recipes");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!recipesActor) return;
    setError(null);
    try {
      await recipesActor.deleteComment(commentId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleLoveRecipe = async () => {
    if (!recipesActor) return;
    setError(null);
    try {
      const ok = await recipesActor.loveThisRecipe(numericRecipeId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleLoveComment = async (commentId) => {
    if (!recipesActor) return;
    setError(null);
    try {
      const ok = await recipesActor.loveThisComment(commentId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleReactComment = async (commentId, isThumbsUp) => {
    if (!recipesActor) return;
    setError(null);
    try {
      await recipesActor.reactToComment(commentId, isThumbsUp);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const commentingRef = useRef(false);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!recipesActor || !commentText.trim()) return;
    if (commentingRef.current) return;
    commentingRef.current = true;
    setError(null);
    try {
      const ratingArg = rating > 0 ? [rating] : [];
      await recipesActor.addComment(numericRecipeId, commentText.trim(), ratingArg);
      setCommentText("");
      setRating(0);
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      commentingRef.current = false;
    }
  };

  if (!summary) return <p className="chat-empty">Loading...</p>;

  const r = summary.recipe;
  const coverUrl = r.coverPhoto.length > 0 ? attachmentToUrl(r.coverPhoto[0]) : null;

  return (
    <div>
      <Link to="/recipes" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Recipes
      </Link>

      {coverUrl && (
        <div className="event-cover-wrap">
          <img src={coverUrl} alt={r.title} className="zoomable-image event-cover-image" onClick={() => setLightboxSrc(coverUrl)} />
        </div>
      )}

      <h1 className="page-title">{r.title}</h1>
      {r.description && <p className="page-subtitle">{r.description}</p>}
      <p className="tree-rel">
        by <Link to={"/profile/" + r.creator.toString()}>{r.creatorName}</Link> — {summary.ratingCount > 0 ? starDisplay(summary.averageRating) + " (" + summary.ratingCount.toString() + " ratings)" : "No ratings yet"}
      </p>
      {profile && (r.creator.toString() === profile.id.toString() || isAdmin) && (
        <button className="tree-remove-btn" style={{ marginBottom: 12 }} onClick={handleDelete}>
          {r.creator.toString() === profile.id.toString() ? "Delete recipe" : "Delete recipe (admin)"}
        </button>
      )}
      {profile && r.creator.toString() !== profile.id.toString() && (
        summary.myLoveGiven ? (
          <p className="tree-rel" style={{ marginBottom: 12 }}>💗 Love sent</p>
        ) : (
          <button
            className="chat-send-button"
            style={{ marginBottom: 12, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
            onClick={handleLoveRecipe}
          >
            💗 Love this recipe (1)
          </button>
        )
      )}

      <div className="tree-admin-panel" style={{ marginTop: 16 }}>
        <h2 className="tree-admin-title">Ingredients</h2>
        {r.ingredients.length === 0 ? (
          <p className="chat-empty">No ingredients listed.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {r.ingredients.map((ing, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{ing}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 16 }}>
        <h2 className="tree-admin-title">Steps</h2>
        {r.steps.length === 0 ? (
          <p className="chat-empty">No steps listed.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {r.steps.map((step, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{step}</li>
            ))}
          </ol>
        )}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Comments & Ratings</h2>
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
              {c.rating.length > 0 && <span style={{ marginLeft: 8 }}>{starDisplay(c.rating[0])}</span>}
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
      <form onSubmit={handleComment} style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? 0 : n)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, padding: 0 }}
            >
              {n <= rating ? "\u2605" : "\u2606"}
            </button>
          ))}
          {rating > 0 && <span className="tree-rel" style={{ marginLeft: 6 }}>Rating: {rating}/5</span>}
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-text-input"
            rows={1}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment (and optional rating above)..."
            onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleComment(e);
            }
          }}
          />
          <button className="chat-send-button" type="submit">Post</button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
