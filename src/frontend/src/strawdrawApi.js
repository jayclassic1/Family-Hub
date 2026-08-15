import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as strawdrawIdlFactory } from "./idl/strawdraw.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_STRAWDRAW_CANISTER_ID = "";

export async function createStrawDrawActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(strawdrawIdlFactory, {
    agent,
    canisterId: resolveCanisterId("strawdraw", FALLBACK_STRAWDRAW_CANISTER_ID),
  });
}

export function shuffleForStraws(participants) {
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
