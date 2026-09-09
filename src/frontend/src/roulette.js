import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as rouletteIdlFactory } from "./idl/roulette.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_ROULETTE_CANISTER_ID = "";

export async function createRouletteActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(rouletteIdlFactory, {
    agent,
    canisterId: resolveCanisterId("roulette", FALLBACK_ROULETTE_CANISTER_ID),
  });
}
