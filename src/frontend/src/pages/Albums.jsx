import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAlbumsActor } from "../albums.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

export default function Albums() {
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [albumsActor, setAlbumsActor] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createAlbumsActor(identity);
      setAlbumsActor(a);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!albumsActor) return;
    try {
      const result = await albumsActor.listAlbums();
      setSummaries(result);
    } catch (e) {
      setError(String(e));
    }
  }, [albumsActor]);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!albumsActor || !name.trim()) return;
    setError(null);
    try {
      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }
      await albumsActor.createAlbum(name.trim(), description.trim(), coverPhoto);
      setName("");
      setDescription("");
      setCoverFile(null);
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const handleLoveAlbum = async (e, albumId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!albumsActor) return;
    setError(null);
    try {
      const ok = await albumsActor.loveThisAlbum(albumId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  return (
    <div>
      <h1 className="page-title">Albums</h1>
      <p className="page-subtitle">Browse family photo albums, or start your own.</p>

      <div className="card-grid tree-grid">
        {summaries.map((s) => {
          const a = s.album;
          const isOwn = profile && a.creator.toString() === profile.id.toString();
          return (
            <Link key={a.id.toString()} to={"/albums/" + a.id.toString()} className="card tree-card">
              {a.coverPhoto.length > 0 && (
                <img
                  src={attachmentToUrl(a.coverPhoto[0])}
                  alt={a.name}
                  className="event-card-thumb"
                />
              )}
              <div className="card-title">{a.name}</div>
              <div className="card-description">{a.description}</div>
              <div className="tree-rel">by <Link to={"/profile/" + a.creator.toString()} onClick={(e) => e.stopPropagation()}>{a.creatorName}</Link></div>
              {!isOwn && (
                s.myLoveGiven ? (
                  <p className="tree-rel" style={{ marginTop: 6 }}>💗 Love sent</p>
                ) : (
                  <button
                    className="chat-send-button"
                    style={{ marginTop: 6, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
                    onClick={(e) => handleLoveAlbum(e, a.id)}
                  >
                    💗 Love (1)
                  </button>
                )
              )}
            </Link>
          );
        })}
        {summaries.length === 0 && <p className="chat-empty">No albums yet — create the first one!</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Create an album</h2>
        <form onSubmit={handleCreate}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Album name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Cover photo (optional)</label>
            <input type="file" accept="image/png,image/jpeg" onChange={handleCoverChange} />
            {coverFile && <div className="tree-rel" style={{ marginTop: 6 }}>Photo: {coverFile.name}</div>}
          </div>
          <button className="chat-send-button" type="submit">Create album</button>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
