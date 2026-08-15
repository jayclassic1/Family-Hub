import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as authIdlFactory } from "./idl/auth.idl.js";
import { AUTH_CANISTER_ID as FALLBACK_AUTH_CANISTER_ID } from "./canisterIds.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const isLocal = window.location.hostname.includes("localhost");

export const IDENTITY_PROVIDER = isLocal
  ? "http://id.ai.localhost:8000/authorize"
  : "https://id.ai/authorize";

// 30 days in nanoseconds (the max Internet Identity allows)
export const THIRTY_DAYS_NS = BigInt(30 * 24 * 60 * 60) * 1_000_000_000n;

export async function createAuthActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(authIdlFactory, {
    agent,
    canisterId: resolveCanisterId("auth", FALLBACK_AUTH_CANISTER_ID),
  });
}
