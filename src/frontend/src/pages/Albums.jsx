import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAlbumsActor } from "../albums.js";
import { createChatActor, fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";
import JSZip from "jszip";

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
  const [chatMessages, setChatMessages] = useState([]);
  const [zipping, setZipping] = useState(false);

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
      setError("Something went wrong. Please try again.");
    }
  }, [albumsActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      try {
        const chatActor = await createChatActor(identity);
        const result = await chatActor.getMessages();
        setChatMessages(result);
      } catch (e) {}
    })();
  }, [identity]);

  const handleDownloadZip = async (scope) => {
    if (zipping) return;
    const targets = chatMessages.filter((m) => {
      if (m.attachment.length === 0) return false;
      if (scope === "all") return true;
      const daysOld = (Date.now() - Number(m.timestamp) / 1_000_000) / (1000 * 60 * 60 * 24);
      return 30 - daysOld <= 7;
    });
    if (targets.length === 0) {
      setError("No images match that option right now.");
      return;
    }
    setZipping(true);
    setError(null);
    try {
      const zip = new JSZip();
      targets.forEach((m) => {
        const a = m.attachment[0];
        zip.file(m.id.toString() + "_" + a.filename, new Uint8Array(a.data));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "home-chat-photos.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Something went wrong building the zip. Please try again.");
    } finally {
      setZipping(false);
    }
  };

  const handleCoverChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Cover photo must be a PNG or JPG.");
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
      setError("Something went wrong. Please try again.");
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
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div>
      <h1 className="page-title">Albums</h1>
      <p className="page-subtitle">Browse family photo albums, or start your own.</p>

      <div className="tree-admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="tree-admin-title">Home Chat photos</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="chat-send-button" onClick={() => handleDownloadZip("expiring")} disabled={zipping}>
            {zipping ? "Zipping..." : "📦 Download Expiring Soon"}
          </button>
          <button className="chat-send-button" onClick={() => handleDownloadZip("all")} disabled={zipping}>
            {zipping ? "Zipping..." : "📦 Download All Photos"}
          </button>
        </div>
      </div>

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
