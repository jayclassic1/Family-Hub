import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createShopActor, NAME_FONTS } from "../shopApi.js";
import { getCachedShopProfile } from "../shopProfileCache.js";
import { attachmentToUrl } from "../chat.js";

const FONT_CSS = Object.fromEntries(NAME_FONTS.map((f) => [f.key, f.css]));

// Renders a display name styled with whatever Love Shop cosmetics that
// person owns (color, font, effect, badge). Falls back to plain text
// while loading or if they own nothing.
export default function StyledUserName({ userId, name, isMe, myShopProfile, hideAvatar }) {
  const { identity } = useAuth();
  const [shopProfile, setShopProfile] = useState(isMe ? myShopProfile : null);

  useEffect(() => {
    if (isMe) {
      setShopProfile(myShopProfile || null);
      return;
    }
    if (!identity || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await createShopActor(identity);
        const profile = await getCachedShopProfile(s, userId);
        if (!cancelled) setShopProfile(profile);
      } catch (e) {
        if (!cancelled) setShopProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identity, userId, isMe, myShopProfile]);

  const avatarUrl =
    shopProfile && shopProfile.pfpOwned && shopProfile.avatarPhoto.length > 0
      ? attachmentToUrl(shopProfile.avatarPhoto[0])
      : null;

  if (!shopProfile) {
    return <>{name}</>;
  }

  const style = {};
  if (shopProfile.nameColorOwned && shopProfile.nameColor) {
    style.color = shopProfile.nameColor;
  }
  if (shopProfile.nameFontOwned && shopProfile.nameFont && FONT_CSS[shopProfile.nameFont]) {
    style.fontFamily = FONT_CSS[shopProfile.nameFont];
  }

  return (
    <span className="styled-username-row">
      {avatarUrl && !hideAvatar && <img src={avatarUrl} alt="" className="user-avatar-sm" />}
      <span style={style}>
        {name}
        {shopProfile.badgeOwned && shopProfile.badgeText && (
          <span className="shop-badge">{shopProfile.badgeText}</span>
        )}
      </span>
    </span>
  );
}
