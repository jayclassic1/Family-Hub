import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as authIdlFactory } from "./idl/auth.idl.js";
import { AUTH_CANISTER_ID as FALLBACK_AUTH_CANISTER_ID } from "./canisterIds.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const isLocal = window.location.hostname.includes("localhost");

export const IDENTITY_PROVIDER = isLocal
  ? `http://id.ai.localhost:${window.location.port}/authorize`
  : "https://id.ai/authorize";

// The canister-ID URL is the "primary" origin where existing accounts already
// live. When the app is served from any other origin (e.g. a custom domain),
// tell Internet Identity to derive principals as if we were still on the
// primary origin, so everyone keeps the same account either way.
const PRIMARY_ORIGIN = "https://r25io-syaaa-aaaad-agv6a-cai.icp.net";
export const DERIVATION_ORIGIN =
  !isLocal && window.location.origin !== PRIMARY_ORIGIN ? PRIMARY_ORIGIN : undefined;

// 30 days in nanoseconds (the max Internet Identity allows)
export const THIRTY_DAYS_NS = BigInt(30 * 24 * 60 * 60) * 1_000_000_000n;

export async function createAuthActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(authIdlFactory, {
    agent,
    canisterId: resolveCanisterId("auth", FALLBACK_AUTH_CANISTER_ID),
  });
}
