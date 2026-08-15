import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as tetrisIdlFactory } from "./idl/tetris.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_TETRIS_CANISTER_ID = "";

export async function createTetrisActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(tetrisIdlFactory, {
    agent,
    canisterId: resolveCanisterId("tetris", FALLBACK_TETRIS_CANISTER_ID),
  });
}

export function tournamentStatusKey(status) {
  return Object.keys(status)[0];
}
