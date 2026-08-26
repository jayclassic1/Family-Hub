import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";

// Deterministically turns a username+password into the same kind of
// cryptographic identity Internet Identity would give someone — no
// password ever touches the backend, and no new canister state is
// needed. The same username+password always reconstructs the exact
// same identity, so this doubles as both "sign up" and "log in": if
// the derived identity already has a registered profile, it's a
// returning user; if not, it's treated as brand new.
//
// Security tradeoff, stated plainly: whoever knows the username and
// password *is* that person, with no second factor (unlike Internet
// Identity's passkeys, which never leave the device). This is the
// same tradeoff any ordinary username/password website makes.

const STORAGE_KEY = "chitzechat-password-identity";
const PBKDF2_ITERATIONS = 210000;

async function deriveSeed(username, password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const salt = enc.encode("chitzechat-password-login:" + username.trim().toLowerCase());
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function deriveIdentityFromPassword(username, password) {
  const seed = await deriveSeed(username, password);
  return Ed25519KeyIdentity.generate(seed);
}

export function savePasswordSession(identity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity.toJSON()));
}

export function loadPasswordSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return Ed25519KeyIdentity.fromJSON(raw);
  } catch (e) {
    return null;
  }
}

export function clearPasswordSession() {
  localStorage.removeItem(STORAGE_KEY);
}
