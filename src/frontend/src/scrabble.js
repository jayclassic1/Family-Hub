import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as scrabbleIdlFactory } from "./idl/scrabble.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_SCRABBLE_CANISTER_ID = "";

export async function createScrabbleActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(scrabbleIdlFactory, {
    agent,
    canisterId: resolveCanisterId("scrabble", FALLBACK_SCRABBLE_CANISTER_ID),
  });
}
