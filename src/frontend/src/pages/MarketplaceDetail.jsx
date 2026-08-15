import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createMarketplaceActor, statusKey } from "../marketplaceApi.js";
import { attachmentToUrl } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";

function ListingPhoto({ listingId, index, marketplaceActor, onZoom }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await marketplaceActor.getListingPhoto(listingId, index);
        if (!cancelled && result.length > 0) setUrl(attachmentToUrl(result[0]));
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [listingId, index, marketplaceActor]);

  if (!url) {
    return (
      <div style={{ width: 160, height: 160, borderRadius: 10, background: "var(--off-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="tree-rel">Loading...</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="zoomable-image"
      style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 10, cursor: "pointer" }}
      onClick={() => onZoom(url)}
    />
  );
}

export default function MarketplaceDetail() {
  const { listingId } = useParams();
  const { identity, profile } = useAuth();
  const [marketplaceActor, setMarketplaceActor] = useState(null);
  const [listing, setListing] = useState(null);
  const [bidInput, setBidInput] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const numericListingId = Number(listingId);

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
      const result = await marketplaceActor.getListing(numericListingId);
      setListing(result.length > 0 ? result[0] : null);
    } catch (e) {
      setError(String(e));
    }
  }, [marketplaceActor, numericListingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!listing) {
    return (
      <div>
        <Link to="/shop/marketplace" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
          &lt; Back to Marketplace
        </Link>
        <p className="chat-empty">Loading listing...</p>
      </div>
    );
  }

  const isSeller = profile && listing.seller.toString() === profile.id.toString();
  const isAdmin = profile && "admin" in profile.role;
  const status = statusKey(listing.status);
  const isActive = status === "active";

  const handleBuyNow = async () => {
    if (!marketplaceActor) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await marketplaceActor.buyNow(numericListingId);
      if (!ok) setError("Could not buy — check your Love balance.");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!marketplaceActor || !bidInput) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await marketplaceActor.placeBid(numericListingId, Number(bidInput));
      if (!ok) setError("Could not place bid.");
      setBidInput("");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptBid = async (bidder) => {
    if (!marketplaceActor) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await marketplaceActor.acceptBid(numericListingId, bidder);
      if (!ok) setError("Could not accept that bid — the bidder may not have enough Love anymore.");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleMarkSold = async () => {
    if (!marketplaceActor) return;
    setBusy(true);
    setError(null);
    try {
      await marketplaceActor.markSold(numericListingId);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!marketplaceActor) return;
    if (!window.confirm("Cancel this listing?")) return;
    setBusy(true);
    setError(null);
    try {
      await marketplaceActor.cancelListing(numericListingId);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!marketplaceActor) return;
    if (!window.confirm("Permanently delete this listing? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await marketplaceActor.deleteListing(numericListingId);
      if (ok) {
        window.location.href = "/shop/marketplace";
      } else {
        setError("Could not delete listing.");
        setBusy(false);
      }
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/shop/marketplace" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Marketplace
      </Link>

      <h1 className="page-title">{listing.title}</h1>
      <p className="page-subtitle">
        by <Link to={"/profile/" + listing.seller.toString()}>{listing.sellerName}</Link>
        {status !== "active" && " — " + (status === "sold" ? "Sold" : "Cancelled")}
      </p>

      {listing.photoCount > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {Array.from({ length: Number(listing.photoCount) }, (_, i) => (
            <ListingPhoto key={i} listingId={numericListingId} index={i} marketplaceActor={marketplaceActor} onZoom={setLightboxSrc} />
          ))}
        </div>
      )}
      {listing.photoCount === 0 && <p className="chat-empty" style={{ marginBottom: 16 }}>No photos added.</p>}

      {listing.description && (
        <div className="tree-admin-panel" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{listing.description}</p>
        </div>
      )}

      <div className="tree-admin-panel" style={{ marginBottom: 16 }}>
        {listing.lovePrice.length > 0 && (
          <p className="tree-rel" style={{ marginBottom: 8 }}>💰 Buy Now: {listing.lovePrice[0].toString()} Love</p>
        )}
        {listing.offsiteNote && (
          <p className="tree-rel" style={{ marginBottom: 8 }}>📍 {listing.offsiteNote}</p>
        )}

        {isActive && !isSeller && listing.lovePrice.length > 0 && (
          <button className="chat-send-button" onClick={handleBuyNow} disabled={busy} style={{ marginRight: 8 }}>
            Buy Now for {listing.lovePrice[0].toString()} Love
          </button>
        )}

        {isActive && isSeller && (
          <>
            <button className="tree-remove-btn" onClick={handleMarkSold} disabled={busy} style={{ marginRight: 8 }}>
              Mark Sold
            </button>
            <button className="tree-remove-btn" onClick={handleCancel} disabled={busy}>
              Cancel Listing
            </button>
          </>
        )}

        {(isSeller || isAdmin) && (
          <button className="tree-remove-btn" onClick={handleDeleteListing} disabled={busy} style={{ marginTop: 8, background: "#8b0000", display: "block" }}>
            {isSeller ? "Delete Listing" : "Delete Listing (admin)"}
          </button>
        )}
      </div>

      {isActive && !isSeller && (
        <div className="tree-admin-panel" style={{ marginBottom: 16 }}>
          <h2 className="tree-admin-title">Place a bid</h2>
          <form onSubmit={handlePlaceBid} style={{ display: "flex", gap: 8 }}>
            <input
              className="chat-text-input"
              style={{ width: 120 }}
              type="number"
              min="1"
              placeholder="Love amount"
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
            />
            <button className="chat-send-button" type="submit" disabled={busy || !bidInput}>Bid</button>
          </form>
        </div>
      )}

      <div className="tree-admin-panel">
        <h2 className="tree-admin-title">Bids</h2>
        {listing.bids.length === 0 && <p className="chat-empty">No bids yet.</p>}
        {listing.bids.map((b, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="tree-rel">
              <Link to={"/profile/" + b.bidder.toString()}>{b.bidderName}</Link> — {b.amount.toString()} Love
            </span>
            {isActive && isSeller && (
              <button className="chat-send-button" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleAcceptBid(b.bidder)} disabled={busy}>
                Accept
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
