import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createShopActor, SHOP_ITEMS, NAME_COLORS, NAME_FONTS, LOVED_EFFECTS, SEND_EFFECTS, CHAT_BUBBLE_SKINS, PROFILE_THEMES } from "../shopApi.js";
import { createWalletActor } from "../walletApi.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";
import { Link } from "react-router-dom";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

export default function Shop() {
  const { identity } = useAuth();
  const [shopActor, setShopActor] = useState(null);
  const [walletActor, setWalletActor] = useState(null);
  const [shopProfile, setShopProfile] = useState(null);
  const [loveBalance, setLoveBalance] = useState(null);
  const [badgeInput, setBadgeInput] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const s = await createShopActor(identity);
      const w = await createWalletActor(identity);
      setShopActor(s);
      setWalletActor(w);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!shopActor || !walletActor) return;
    try {
      const [profile, love] = await Promise.all([
        shopActor.getMyShopProfile(),
        walletActor.getMyLove(),
      ]);
      setShopProfile(profile);
      setLoveBalance(love);
      setBadgeInput(profile.badgeText || "");
    } catch (e) {
      setError(String(e));
    }
  }, [shopActor, walletActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handlePurchase = async (itemKey) => {
    if (!shopActor) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await shopActor.purchase(itemKey);
      if (!ok) setError("Could not purchase — check your Love balance.");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSetNameColor = async (hex) => {
    if (!shopActor) return;
    setError(null);
    try {
      await shopActor.setNameColor(hex);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetNameFont = async (font) => {
    if (!shopActor) return;
    setError(null);
    try {
      await shopActor.setNameFont(font);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetLovedEffect = async (effect) => {
    if (!shopActor) return;
    setError(null);
    try {
      await shopActor.setLovedEffect(effect);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetSendEffect = async (effect) => {
    if (!shopActor) return;
    setError(null);
    try {
      await shopActor.setSendEffect(effect);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetBubble = async (skin) => {
    if (!shopActor) return;
    setError(null);
    try {
      await shopActor.setChatBubbleSkin(skin);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetTheme = async (theme) => {
    if (!shopActor) return;
    setError(null);
    try {
      await shopActor.setProfileTheme(theme);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSaveBadge = async () => {
    if (!shopActor) return;
    setError(null);
    try {
      const ok = await shopActor.setBadgeText(badgeInput.trim());
      if (!ok) setError("Badge text couldn't be saved — keep it to 16 characters or fewer.");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUploadPfp = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !shopActor) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("PFP must be a PNG or JPG.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Photo is too large (max ~1.7MB).");
      return;
    }
    setError(null);
    try {
      const attachment = await fileToAttachment(f);
      await shopActor.setAvatarPhoto(attachment);
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const handleUploadBanner = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !shopActor) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Banner must be a PNG or JPG.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Photo is too large (max ~1.7MB).");
      return;
    }
    setError(null);
    try {
      const attachment = await fileToAttachment(f);
      await shopActor.setBannerPhoto(attachment);
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  if (!shopProfile) {
    return <p className="chat-empty">Loading shop...</p>;
  }

  const ownedKey = (key) => key + "Owned";

  const renderCustomizer = (item) => {
    switch (item.key) {
      case "nameColor":
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {NAME_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => handleSetNameColor(c.key)}
                title={c.label}
                style={{
                  width: 28, height: 28, borderRadius: "50%", background: c.key,
                  border: shopProfile.nameColor === c.key ? "3px solid var(--text-dark)" : "2px solid white",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        );
      case "nameFont":
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {NAME_FONTS.map((f) => (
              <button
                key={f.key}
                className="chat-send-button"
                style={{
                  padding: "4px 10px", fontSize: 13, fontFamily: f.css,
                  background: shopProfile.nameFont === f.key ? "var(--orange-dark)" : "var(--orange)",
                }}
                onClick={() => handleSetNameFont(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        );
      case "chatBubble":
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {CHAT_BUBBLE_SKINS.map((f) => (
              <button
                key={f.key}
                className="chat-send-button"
                style={{ padding: "4px 10px", fontSize: 13, background: shopProfile.chatBubbleSkin === f.key ? "var(--orange-dark)" : "var(--orange)" }}
                onClick={() => handleSetBubble(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        );
      case "profileTheme":
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {PROFILE_THEMES.map((f) => (
              <button
                key={f.key}
                className="chat-send-button"
                style={{ padding: "4px 10px", fontSize: 13, background: shopProfile.profileTheme === f.key ? "var(--orange-dark)" : "var(--orange)" }}
                onClick={() => handleSetTheme(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        );
      case "badge":
        return (
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <input
              className="chat-text-input"
              style={{ width: 160 }}
              maxLength={16}
              placeholder="Your badge text"
              value={badgeInput}
              onChange={(e) => setBadgeInput(e.target.value)}
            />
            <button className="chat-send-button" style={{ padding: "4px 10px", fontSize: 13 }} onClick={handleSaveBadge}>
              Save
            </button>
          </div>
        );
      case "pfp":
        return (
          <div style={{ marginTop: 8 }}>
            {shopProfile.avatarPhoto.length > 0 && (
              <img
                src={attachmentToUrl(shopProfile.avatarPhoto[0])}
                alt="Your avatar"
                style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", marginBottom: 8, display: "block" }}
              />
            )}
            <input type="file" accept="image/png,image/jpeg" onChange={handleUploadPfp} />
          </div>
        );
      case "banner":
        return (
          <div style={{ marginTop: 8 }}>
            {shopProfile.bannerPhoto.length > 0 && (
              <img
                src={attachmentToUrl(shopProfile.bannerPhoto[0])}
                alt="Your banner"
                style={{ width: "100%", maxWidth: 320, height: 80, borderRadius: 8, objectFit: "cover", marginBottom: 8, display: "block" }}
              />
            )}
            <input type="file" accept="image/png,image/jpeg" onChange={handleUploadBanner} />
          </div>
        );
      default:
        return null;
    }
  };

  const renderEffectGrid = (effects, ownedList, activeKey, onBuy, onEquip) => (
    <div className="card-grid tree-grid">
      {effects.map((f) => {
        const owned = ownedList.includes(f.key);
        const active = activeKey === f.key;
        return (
          <div key={f.key} className="card tree-card">
            <div className="card-title">{f.label}</div>
            <div className="card-description">{f.description}</div>
            {owned ? (
              <>
                <p className="tree-rel" style={{ marginTop: 8 }}>
                  {active ? "✅ Equipped" : "✅ Owned"}
                </p>
                {!active && (
                  <button
                    className="chat-send-button"
                    style={{ marginTop: 6, padding: "4px 10px", fontSize: 13 }}
                    onClick={() => onEquip(f.key)}
                  >
                    Equip
                  </button>
                )}
              </>
            ) : (
              <button
                className="chat-send-button"
                style={{ marginTop: 10, padding: "6px 14px" }}
                onClick={() => onBuy(f.key)}
                disabled={busy}
              >
                Buy for {f.price} Love
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <h1 className="page-title">💗 Love Shop</h1>
      <p className="page-subtitle">Spend your Love on cosmetics and flair.</p>
      <Link to="/shop/marketplace" className="chat-send-button" style={{ display: "inline-block", textDecoration: "none", marginBottom: 16 }}>
        🛍️ Browse the Marketplace
      </Link>

      {loveBalance !== null && (
        <div className="coin-toss-result" style={{ marginBottom: 20, display: "inline-block" }}>
          💗 {loveBalance.toString()} Love
        </div>
      )}

      <p className="tree-rel" style={{ marginBottom: 20 }}>
        Note: purchases here unlock and let you customize each item, but showing them everywhere across the app (chat, profile, etc.) is still being wired up.
      </p>

      <div className="card-grid tree-grid">
        {SHOP_ITEMS.map((item) => {
          const owned = shopProfile[ownedKey(item.key)];
          return (
            <div key={item.key} className="card tree-card">
              <div className="card-title">{item.label}</div>
              <div className="card-description">{item.description}</div>
              {owned ? (
                <>
                  <p className="tree-rel" style={{ marginTop: 8 }}>✅ Owned</p>
                  {renderCustomizer(item)}
                </>
              ) : (
                <button
                  className="chat-send-button"
                  style={{ marginTop: 10, padding: "6px 14px" }}
                  onClick={() => handlePurchase(item.key)}
                  disabled={busy}
                >
                  Buy for {item.price} Love
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="page-title" style={{ fontSize: 22, marginTop: 32 }}>Loved Message Effects</h2>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        When your message gets loved, your equipped effect plays for everyone in chat.
      </p>
      {renderEffectGrid(
        LOVED_EFFECTS,
        shopProfile.lovedEffectsOwned,
        shopProfile.lovedEffect,
        handlePurchase,
        handleSetLovedEffect
      )}

      <h2 className="page-title" style={{ fontSize: 22, marginTop: 32 }}>Love Send Effects</h2>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        When you give love, your equipped effect hits the message for everyone in chat.
      </p>
      {renderEffectGrid(
        SEND_EFFECTS,
        shopProfile.sendEffectsOwned,
        shopProfile.sendEffect,
        handlePurchase,
        handleSetSendEffect
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
