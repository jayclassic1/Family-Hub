import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createRecipesActor, starDisplay } from "../recipesApi.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

export default function Recipes() {
  const { identity, profile } = useAuth();
  const [recipesActor, setRecipesActor] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [creating, setCreating] = useState(false);
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
      const [recipeResult, chefResult] = await Promise.all([
        recipesActor.listRecipes(),
        recipesActor.listChefs(),
      ]);
      setRecipes(recipeResult);
      setChefs(chefResult);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [recipesActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCoverChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Cover photo must be a PNG or JPG.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Photo is too large (max ~3.3MB).");
      e.target.value = "";
      return;
    }
    setError(null);
    setCoverFile(f);
  };

  const handleLoveRecipe = async (e, recipeId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!recipesActor) return;
    setError(null);
    try {
      const ok = await recipesActor.loveThisRecipe(recipeId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!recipesActor || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const ingredients = ingredientsText.split("\n").map((s) => s.trim()).filter(Boolean);
      const steps = stepsText.split("\n").map((s) => s.trim()).filter(Boolean);
      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }
      await recipesActor.createRecipe(title.trim(), description.trim(), ingredients, steps, coverPhoto);
      setTitle("");
      setDescription("");
      setIngredientsText("");
      setStepsText("");
      setCoverFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const popular = [...recipes]
    .sort((a, b) => {
      if (b.ratingCount !== a.ratingCount) return Number(b.ratingCount) - Number(a.ratingCount);
      return b.averageRating - a.averageRating;
    })
    .slice(0, 4);

  const rankedChefs = [...chefs].sort((a, b) => {
    const scoreA = Number(a.recipeCount) + Number(a.totalRatings);
    const scoreB = Number(b.recipeCount) + Number(b.totalRatings);
    return scoreB - scoreA;
  });

  const newest = [...recipes].sort((a, b) => Number(b.recipe.created) - Number(a.recipe.created));

  return (
    <div>
      <h1 className="page-title">Recipes</h1>
      <p className="page-subtitle">Family recipes — browse, rate, and comment.</p>

      <h2 className="tree-admin-title" style={{ marginTop: 8 }}>Most Popular</h2>
      <div className="card-grid tree-grid">
        {popular.map((s) => (
          <Link key={s.recipe.id.toString()} to={"/recipes/" + s.recipe.id.toString()} className="card tree-card">
            {s.recipe.coverPhoto.length > 0 && (
              <img src={attachmentToUrl(s.recipe.coverPhoto[0])} alt={s.recipe.title} className="event-card-thumb" />
            )}
            <div className="card-title">{s.recipe.title}</div>
            <div className="recipe-card-stars">{starDisplay(s.averageRating)}</div>
            <div className="card-description">
              {s.ratingCount.toString()} {Number(s.ratingCount) === 1 ? "rating" : "ratings"}
            </div>
            <div className="tree-rel">by <Link to={"/profile/" + s.recipe.creator.toString()} onClick={(e) => e.stopPropagation()}>{s.recipe.creatorName}</Link></div>
            {profile && s.recipe.creator.toString() !== profile.id.toString() && (
              s.myLoveGiven ? (
                <p className="tree-rel" style={{ marginTop: 6 }}>💗 Love sent</p>
              ) : (
                <button
                  className="chat-send-button"
                  style={{ marginTop: 6, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
                  onClick={(e) => handleLoveRecipe(e, s.recipe.id)}
                >
                  💗 Love (1)
                </button>
              )
            )}
          </Link>
        ))}
        {popular.length === 0 && <p className="chat-empty">No recipes yet.</p>}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Chefs</h2>
      <div className="chef-row">
        {rankedChefs.map((c) => (
          <Link key={c.chef.toString()} to={"/recipes/chef/" + c.chef.toString()} className="chef-card">
            {c.chefPhoto.length > 0 ? (
              <img src={attachmentToUrl(c.chefPhoto[0])} alt={c.chefName} className="chef-avatar" />
            ) : (
              <div className="chef-avatar chef-avatar-placeholder">{c.chefName.charAt(0).toUpperCase()}</div>
            )}
            <div className="chef-name">{c.chefName}</div>
            <div className="tree-rel">{c.recipeCount.toString()} recipes · {c.totalRatings.toString()} ratings</div>
          </Link>
        ))}
        {rankedChefs.length === 0 && <p className="chat-empty">No chefs yet — add a recipe to become one!</p>}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Newest</h2>
      <div className="card-grid tree-grid">
        {newest.map((s) => (
          <Link key={s.recipe.id.toString()} to={"/recipes/" + s.recipe.id.toString()} className="card tree-card">
            {s.recipe.coverPhoto.length > 0 && (
              <img src={attachmentToUrl(s.recipe.coverPhoto[0])} alt={s.recipe.title} className="event-card-thumb" />
            )}
            <div className="card-title">{s.recipe.title}</div>
            <div className="recipe-card-stars">{starDisplay(s.averageRating)}</div>
            <div className="card-description">
              {s.ratingCount.toString()} {Number(s.ratingCount) === 1 ? "rating" : "ratings"}
            </div>
            <div className="tree-rel">by <Link to={"/profile/" + s.recipe.creator.toString()} onClick={(e) => e.stopPropagation()}>{s.recipe.creatorName}</Link></div>
            {profile && s.recipe.creator.toString() !== profile.id.toString() && (
              s.myLoveGiven ? (
                <p className="tree-rel" style={{ marginTop: 6 }}>💗 Love sent</p>
              ) : (
                <button
                  className="chat-send-button"
                  style={{ marginTop: 6, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
                  onClick={(e) => handleLoveRecipe(e, s.recipe.id)}
                >
                  💗 Love (1)
                </button>
              )
            )}
          </Link>
        ))}
        {newest.length === 0 && <p className="chat-empty">No recipes yet — add the first one below!</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Add a recipe</h2>
        <form onSubmit={handleCreate}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
            Recipe title
          </label>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
            Short description (optional)
          </label>
          <textarea
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10, minHeight: 50, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
            Ingredients (one per line)
          </label>
          <textarea
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10, minHeight: 100, resize: "vertical" }}
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
          />
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
            Steps (one per line)
          </label>
          <textarea
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10, minHeight: 100, resize: "vertical" }}
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
          />
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Cover photo (optional)</label>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handleCoverChange} />
            {coverFile && <div className="tree-rel" style={{ marginTop: 6 }}>Photo: {coverFile.name}</div>}
          </div>
          <button className="chat-send-button" type="submit" disabled={!title.trim() || creating}>
            {creating ? "Saving..." : "Add recipe"}
          </button>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
