import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as spinsIdlFactory } from "./idl/spins.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_SPINS_CANISTER_ID = "";

export async function createSpinsActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(spinsIdlFactory, {
    agent,
    canisterId: resolveCanisterId("spins", FALLBACK_SPINS_CANISTER_ID),
  });
}
