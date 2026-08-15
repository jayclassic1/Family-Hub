import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as secretsantaIdlFactory } from "./idl/secretsanta.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_SANTA_CANISTER_ID = "";

export async function createSecretSantaActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(secretsantaIdlFactory, {
    agent,
    canisterId: resolveCanisterId("secretsanta", FALLBACK_SANTA_CANISTER_ID),
  });
}

// Rotation-based derangement: nobody gets themselves, as long as n >= 2.
export function shuffleForSecretSanta(participants) {
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const givers = shuffled;
  const recipients = shuffled.map((_, i) => shuffled[(i + 1) % shuffled.length]);
  return { givers, recipients };
}
