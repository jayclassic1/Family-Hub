import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createMarketplaceActor, statusKey } from "../marketplaceApi.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

function ListingThumb({ listingId, marketplaceActor }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await marketplaceActor.getListingPhoto(listingId, 0);
        if (!cancelled && result.length > 0) setUrl(attachmentToUrl(result[0]));
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [listingId, marketplaceActor]);

  if (!url) {
    return (
      <div style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--off-white)" }}>
        <span className="tree-rel">No photo</span>
      </div>
    );
  }
  return <img src={url} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />;
}

export default function Marketplace() {
  const { identity } = useAuth();
  const [marketplaceActor, setMarketplaceActor] = useState(null);
  const [listings, setListings] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lovePriceInput, setLovePriceInput] = useState("");
  const [offsiteNote, setOffsiteNote] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const m = await createMarketplaceActor(identity);
      setMarketplaceActor(m);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!marketplaceActor) return;
    try {
      const result = await marketplaceActor.listListings();
      setListings(result);
    } catch (e) {
      setError(String(e));
    }
  }, [marketplaceActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    setPendingFiles((prev) => [...prev, ...valid].slice(0, 6));
  };

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!marketplaceActor || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const lovePrice = lovePriceInput.trim() === "" ? [] : [Number(lovePriceInput)];
      const listingId = await marketplaceActor.createListing(
        title.trim(),
        description.trim(),
        lovePrice,
        offsiteNote.trim()
      );
      for (const f of pendingFiles) {
        const attachment = await fileToAttachment(f);
        await marketplaceActor.addListingPhoto(listingId, attachment);
      }
      setTitle("");
      setDescription("");
      setLovePriceInput("");
      setOffsiteNote("");
      setPendingFiles([]);
      await refresh();
    } catch (e2) {
      setError(String(e2));
    } finally {
      setCreating(false);
    }
  };

  const activeListings = listings.filter((l) => statusKey(l.status) === "active");
  const otherListings = listings.filter((l) => statusKey(l.status) !== "active");

  return (
    <div>
      <Link to="/shop" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Love Shop
      </Link>

      <h1 className="page-title">🛍️ Marketplace</h1>
      <p className="page-subtitle">Sell or bid on physical stuff — with Love, or arrange cash off-site.</p>

      <div className="tree-admin-panel" style={{ marginBottom: 24 }}>
        <h2 className="tree-admin-title">List something</h2>
        <form onSubmit={handleCreate}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <input
              className="chat-text-input"
              style={{ width: 160 }}
              type="number"
              min="1"
              placeholder="Love price (optional)"
              value={lovePriceInput}
              onChange={(e) => setLovePriceInput(e.target.value)}
            />
            <input
              className="chat-text-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Off-site note (optional) — e.g. 'also open to cash, DM me'"
              value={offsiteNote}
              onChange={(e) => setOffsiteNote(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>
              Photos (up to 6)
            </label>
            <input type="file" accept="image/png,image/jpeg" multiple onChange={handleSelectFiles} />
            {pendingFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {pendingFiles.map((f, i) => (
                  <span key={i} className="coin-history-chip" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {f.name}
                    <button type="button" onClick={() => removePendingFile(i)} style={{ border: "none", background: "transparent", color: "#c62828", cursor: "pointer", fontWeight: 700 }}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button className="chat-send-button" type="submit" disabled={creating || !title.trim()}>
            {creating ? "Listing..." : "Create listing"}
          </button>
        </form>
      </div>

      <h2 className="tree-admin-title">For sale</h2>
      <div className="card-grid tree-grid">
        {activeListings.map((l) => (
          <Link key={l.id.toString()} to={"/shop/marketplace/" + l.id.toString()} className="card tree-card">
            <ListingThumb listingId={l.id} marketplaceActor={marketplaceActor} />
            <div className="card-title">{l.title}</div>
            <div className="card-description">
              {l.lovePrice.length > 0 ? l.lovePrice[0].toString() + " Love" : "No fixed price"}
              {l.bids.length > 0 ? " — " + l.bids.length.toString() + " bid" + (l.bids.length === 1 ? "" : "s") : ""}
            </div>
            <div className="tree-rel">by {l.sellerName}</div>
          </Link>
        ))}
        {activeListings.length === 0 && <p className="chat-empty">Nothing listed yet — be the first!</p>}
      </div>

      {otherListings.length > 0 && (
        <>
          <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Sold / cancelled</h2>
          <div className="card-grid tree-grid">
            {otherListings.map((l) => (
              <Link key={l.id.toString()} to={"/shop/marketplace/" + l.id.toString()} className="card tree-card" style={{ opacity: 0.6 }}>
                <div className="card-title">{l.title}</div>
                <div className="card-description">{statusKey(l.status) === "sold" ? "Sold" : "Cancelled"}</div>
                <div className="tree-rel">by {l.sellerName}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
