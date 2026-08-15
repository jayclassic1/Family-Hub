// Simple in-memory cache for other users' shop cosmetics, so a page full
// of chat messages from the same person doesn't trigger a query per
// message. Cache lives for the browser session.

const cache = new Map();
const inFlight = new Map();

export async function getCachedShopProfile(shopActor, principal) {
  const key = principal.toString();
  if (cache.has(key)) {
    return cache.get(key);
  }
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }
  const promise = shopActor
    .getShopProfileFor(principal)
    .then((profile) => {
      cache.set(key, profile);
      inFlight.delete(key);
      return profile;
    })
    .catch(() => {
      inFlight.delete(key);
      return null;
    });
  inFlight.set(key, promise);
  return promise;
}

export function invalidateShopProfileCache(principal) {
  cache.delete(principal.toString());
}
