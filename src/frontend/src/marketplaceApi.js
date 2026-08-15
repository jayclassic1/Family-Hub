import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as marketplaceIdlFactory } from "./idl/marketplace.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_MARKETPLACE_CANISTER_ID = "";

export async function createMarketplaceActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(marketplaceIdlFactory, {
    agent,
    canisterId: resolveCanisterId("marketplace", FALLBACK_MARKETPLACE_CANISTER_ID),
  });
}

export function statusKey(status) {
  return Object.keys(status)[0];
}
