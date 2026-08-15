import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as rpsIdlFactory } from "./idl/rps.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_RPS_CANISTER_ID = "";

export async function createRpsActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(rpsIdlFactory, {
    agent,
    canisterId: resolveCanisterId("rps", FALLBACK_RPS_CANISTER_ID),
  });
}

export const CHOICE_EMOJI = { rock: "\u{1FAA8}", paper: "\u{1F4C4}", scissors: "\u{2702}\u{FE0F}" };

export function choiceKey(choiceOpt) {
  if (!choiceOpt || choiceOpt.length === 0) return null;
  return Object.keys(choiceOpt[0])[0];
}

export function statusKey(statusVariant) {
  return Object.keys(statusVariant)[0];
}
