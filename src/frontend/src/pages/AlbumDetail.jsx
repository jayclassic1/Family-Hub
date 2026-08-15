import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createAlbumsActor } from "../albums.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

function AlbumPhotoCard({ meta, index, albumsActor, profile, onReact, onLove, onZoom, onResolved }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await albumsActor.getPhotoImage(meta.id);
        if (cancelled) return;
        if (result.length > 0) {
          const url = attachmentToUrl(result[0]);
          setImgUrl(url);
          if (onResolved) onResolved(index, url);
        } else {
          setImgError(true);
        }
      } catch (e) {
        if (!cancelled) setImgError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [albumsActor, meta.id]);

  const isOwnPhoto = profile && meta.uploader.toString() === profile.id.toString();

  return (
    <div className="card" style={{ padding: 10 }}>
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={meta.uploaderName + "'s photo"}
          className="zoomable-image"
          style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 10, marginBottom: 8 }}
          onClick={() => onZoom(index)}
        />
      ) : imgError ? (
        <div style={{ width: "100%", height: 180, borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--off-white)" }}>
          <span className="tree-rel">Couldn't load photo</span>
        </div>
      ) : (
        <div style={{ width: "100%", height: 180, borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--off-white)" }}>
          <span className="tree-rel">Loading...</span>
        </div>
      )}
      <div className="tree-rel">by <Link to={"/profile/" + meta.uploader.toString()}>{meta.uploaderName}</Link></div>
      <div className="tree-rel" style={{ marginTop: 4 }}>
        {meta.thumbsDownCount.toString()} {meta.thumbsDownCount.toString() === "1" ? "thumbs down" : "thumbs down"}
      </div>
      {isOwnPhoto ? (
        <p className="tree-rel" style={{ marginTop: 8 }}>This is your photo.</p>
      ) : meta.myReaction.length > 0 ? (
        <p className="tree-rel" style={{ marginTop: 8 }}>
          You reacted: {meta.myReaction[0] ? "👍 Thumbs up" : "👎 Thumbs down"}
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            className="chat-send-button"
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={() => onReact(meta.id, true)}
          >
            👍 Thumbs up
          </button>
          <button
            className="tree-remove-btn"
            onClick={() => onReact(meta.id, false)}
          >
            👎 Thumbs down
          </button>
        </div>
      )}
      {!isOwnPhoto && (
        meta.myLoveGiven ? (
          <p className="tree-rel" style={{ marginTop: 6 }}>💗 Love sent</p>
        ) : (
          <button
            className="chat-send-button"
            style={{ marginTop: 6, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
            onClick={() => onLove(meta.id)}
          >
            💗 Love (1)
          </button>
        )
      )}
    </div>
  );
}

export default function AlbumDetail() {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [albumsActor, setAlbumsActor] = useState(null);
  const [album, setAlbum] = useState(null);
  const [photoMetas, setPhotoMetas] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [inviteSel, setInviteSel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [resolvedUrls, setResolvedUrls] = useState({});

  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  const numericAlbumId = Number(albumId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const a = await createAlbumsActor(identity);
      const auth = await createAuthActor(identity);
      setAlbumsActor(a);
      const users = await auth.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!albumsActor) return;
    try {
      const [al, metas] = await Promise.all([
        albumsActor.getAlbum(numericAlbumId),
        albumsActor.getAlbumPhotoMetas(numericAlbumId),
      ]);
      setAlbum(al.length > 0 ? al[0] : null);
      setPhotoMetas(metas);
      if (al.length === 0) {
        setError("This album couldn't be found — it may have been deleted.");
      }
    } catch (e) {
      setError(String(e));
      setAlbum(null);
    } finally {
      setLoading(false);
    }
  }, [albumsActor, numericAlbumId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isCreator = album && profile && album.creator.toString() === profile.id.toString();
  const isAdmin = profile && "admin" in profile.role;
  const isContributor =
    album && profile && album.contributors.some((c) => c.toString() === profile.id.toString());

  const nameOf = (principalText) => {
    const u = allUsers.find((x) => x.id.toString() === principalText);
    return u ? u.username : principalText;
  };

  const handleDelete = async () => {
    if (!albumsActor) return;
    if (!window.confirm("Delete this album and all its photos? This can't be undone.")) return;
    setError(null);
    try {
      await albumsActor.deleteAlbum(numericAlbumId);
      navigate("/albums");
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSelectFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError(null);
    const valid = [];
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) {
        setError("Only PNG or JPG photos are supported — skipped " + f.name + ".");
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        setError("Photo too large (max ~1.7MB) — skipped " + f.name + ".");
        continue;
      }
      valid.push(f);
    }
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePhotos = async () => {
    if (!albumsActor || pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        setUploadProgress((i + 1) + " of " + pendingFiles.length);
        const attachment = await fileToAttachment(pendingFiles[i]);
        await albumsActor.uploadPhoto(numericAlbumId, attachment);
      }
      setPendingFiles([]);
      await refresh();
    } catch (e2) {
      setError(String(e2));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleLove = async (photoId) => {
    if (!albumsActor) return;
    setError(null);
    try {
      const ok = await albumsActor.loveThisPhoto(photoId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleReact = async (photoId, isThumbsUp) => {
    if (!albumsActor) return;
    setError(null);
    try {
      const ok = await albumsActor.reactToPhoto(photoId, isThumbsUp);
      if (!ok) setError("Could not record your reaction (maybe you already reacted, or it's your own photo).");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!albumsActor || !inviteSel) return;
    setError(null);
    try {
      const target = allUsers.find((u) => u.id.toString() === inviteSel);
      if (target) {
        await albumsActor.addContributor(numericAlbumId, target.id);
        setInviteSel("");
        await refresh();
      }
    } catch (e2) {
      setError(String(e2));
    }
  };

  if (loading) {
    return <p className="chat-empty">Loading...</p>;
  }

  if (!album) {
    return (
      <div>
        <Link to="/albums" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
          &lt; Back to Albums
        </Link>
        <p className="auth-error">{error || "This album couldn't be found."}</p>
      </div>
    );
  }

  const contributorIds = new Set(album.contributors.map((c) => c.toString()));
  const invitable = allUsers.filter((u) => !contributorIds.has(u.id.toString()));

  return (
    <div>
      <Link to="/albums" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Albums
      </Link>

      {album.coverPhoto.length > 0 && (
        <div className="event-cover-wrap">
          <img
            src={attachmentToUrl(album.coverPhoto[0])}
            alt={album.name}
            className="zoomable-image event-cover-image"
            onClick={() => setLightboxSrc(attachmentToUrl(album.coverPhoto[0]))}
          />
        </div>
      )}

      <h1 className="page-title">{album.name}</h1>
      {album.description && <p className="page-subtitle">{album.description}</p>}
      <p className="tree-rel">
        by <Link to={"/profile/" + album.creator.toString()}>{album.creatorName}</Link> — contributors: {album.contributors.map((c) => nameOf(c.toString())).join(", ")}
      </p>
      {(isCreator || isAdmin) && (
        <button className="tree-remove-btn" style={{ marginBottom: 12 }} onClick={handleDelete}>
          {isCreator ? "Delete album" : "Delete album (admin)"}
        </button>
      )}
      {isCreator && (
        <div className="tree-admin-panel" style={{ marginTop: 16 }}>
          <h2 className="tree-admin-title">Add a contributor</h2>
          <form className="tree-admin-form" onSubmit={handleInvite}>
            <select value={inviteSel} onChange={(e) => setInviteSel(e.target.value)}>
              <option value="">Select someone...</option>
              {invitable.map((u) => (
                <option key={u.id.toString()} value={u.id.toString()}>{u.username}</option>
              ))}
            </select>
            <button className="chat-send-button" type="submit">Add</button>
          </form>
        </div>
      )}

      <div className="tree-admin-panel" style={{ marginTop: 16 }}>
        {isCreator || isContributor ? (
          <>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
              Add photos — select one or several
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={handleSelectFiles}
              disabled={uploading}
            />

            {pendingFiles.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {pendingFiles.map((f, i) => (
                    <span key={i} className="coin-history-chip" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {f.name}
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        style={{ border: "none", background: "transparent", color: "#c62828", cursor: "pointer", fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <button className="chat-send-button" onClick={handleSavePhotos} disabled={uploading}>
                  {uploading ? "Uploading " + (uploadProgress || "") + "..." : "Save " + pendingFiles.length + " photo" + (pendingFiles.length === 1 ? "" : "s")}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="tree-rel">Only the creator or contributors can add photos to this album.</p>
        )}
      </div>

      {photoMetas.length === 0 ? (
        <p className="chat-empty">No photos yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginTop: 16 }}>
          {photoMetas.map((meta, i) => (
            <AlbumPhotoCard
              key={meta.id.toString()}
              meta={meta}
              index={i}
              albumsActor={albumsActor}
              profile={profile}
              onReact={handleReact}
              onLove={handleLove}
              onResolved={(idx, url) => setResolvedUrls((prev) => ({ ...prev, [idx]: url }))}
              onZoom={(idx) => {
                setLightboxIndex(idx);
                setLightboxSrc(resolvedUrls[idx]);
              }}
            />
          ))}
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}

      <Lightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
        images={photoMetas.map((_, i) => resolvedUrls[i])}
        index={lightboxIndex}
        onNavigate={(newIndex) => {
          setLightboxIndex(newIndex);
          setLightboxSrc(resolvedUrls[newIndex]);
        }}
      />
    </div>
  );
}
