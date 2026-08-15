import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as wallIdlFactory } from "./idl/wall.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_WALL_CANISTER_ID = "";

export async function createWallActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(wallIdlFactory, {
    agent,
    canisterId: resolveCanisterId("wall", FALLBACK_WALL_CANISTER_ID),
  });
}
