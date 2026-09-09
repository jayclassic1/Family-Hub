import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createShopActor } from "../shopApi.js";
import { getCachedShopProfile } from "../shopProfileCache.js";

// Fetches the MESSAGE SENDER's own shop profile (not the viewer's) and
// reports back the extra CSS class for their equipped chat bubble skin,
// via a render-prop -- so callers can wrap their EXISTING bubble markup
// (with all its other props/handlers intact) without restructuring it.
// Mirrors StyledUserName's per-sender fetch pattern, and shares its cache.
export default function ChatBubbleSkin({ userId, isMe, myShopProfile, children }) {
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

  const skinClass =
    shopProfile && shopProfile.chatBubbleOwned && shopProfile.chatBubbleSkin && shopProfile.chatBubbleSkin !== "default"
      ? " shop-bubble-" + shopProfile.chatBubbleSkin
      : "";

  return children(skinClass);
}
