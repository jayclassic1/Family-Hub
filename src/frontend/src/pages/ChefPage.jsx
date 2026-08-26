import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createRecipesActor, starDisplay } from "../recipesApi.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";
import { Principal } from "@icp-sdk/core/principal";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

export default function ChefPage() {
  const { chefId } = useParams();
  const { identity, profile } = useAuth();
  const [recipesActor, setRecipesActor] = useState(null);
  const [summary, setSummary] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const r = await createRecipesActor(identity);
      setRecipesActor(r);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!recipesActor) return;
    try {
      const chefPrincipal = Principal.fromText(chefId);
      const [s, rs] = await Promise.all([
        recipesActor.getChefSummary(chefPrincipal),
        recipesActor.getChefRecipes(chefPrincipal),
      ]);
      setSummary(s.length > 0 ? s[0] : null);
      setRecipes(rs);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [recipesActor, chefId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isMe = profile && profile.id.toString() === chefId;

  const handlePhotoChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !recipesActor) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Photo must be a PNG or JPG.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Photo is too large (max ~3.3MB).");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const attachment = await fileToAttachment(f);
      await recipesActor.setChefPhoto(attachment);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!summary) return <p className="chat-empty">Loading...</p>;

  const photoUrl = summary.chefPhoto.length > 0 ? attachmentToUrl(summary.chefPhoto[0]) : null;

  return (
    <div>
      <Link to="/recipes" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Recipes
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
        {photoUrl ? (
          <img src={photoUrl} alt={summary.chefName} className="chef-avatar-large" />
        ) : (
          <div className="chef-avatar-large chef-avatar-placeholder">{summary.chefName.charAt(0).toUpperCase()}</div>
        )}
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{summary.chefName}</h1>
          <p className="tree-rel">{summary.recipeCount.toString()} recipes · {summary.totalRatings.toString()} total ratings</p>
          {isMe && (
            <div style={{ marginTop: 8 }}>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} disabled={uploading} />
              {uploading && <span className="tree-rel" style={{ marginLeft: 8 }}>Uploading...</span>}
            </div>
          )}
        </div>
      </div>

      <h2 className="tree-admin-title">Recipes by {summary.chefName}</h2>
      <div className="card-grid tree-grid">
        {recipes.map((s) => (
          <Link key={s.recipe.id.toString()} to={"/recipes/" + s.recipe.id.toString()} className="card tree-card">
            {s.recipe.coverPhoto.length > 0 && (
              <img src={attachmentToUrl(s.recipe.coverPhoto[0])} alt={s.recipe.title} className="event-card-thumb" />
            )}
            <div className="card-title">{s.recipe.title}</div>
            <div className="recipe-card-stars">{starDisplay(s.averageRating)}</div>
            <div className="card-description">
              {s.ratingCount.toString()} {Number(s.ratingCount) === 1 ? "rating" : "ratings"}
            </div>
          </Link>
        ))}
        {recipes.length === 0 && <p className="chat-empty">No recipes yet.</p>}
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
