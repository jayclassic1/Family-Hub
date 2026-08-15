import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as hatgameIdlFactory } from "./idl/hatgame.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_HATGAME_CANISTER_ID = "";

export async function createHatGameActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(hatgameIdlFactory, {
    agent,
    canisterId: resolveCanisterId("hatgame", FALLBACK_HATGAME_CANISTER_ID),
  });
}
