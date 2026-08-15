import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as recipesIdlFactory } from "./idl/recipes.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_RECIPES_CANISTER_ID = "";

export async function createRecipesActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(recipesIdlFactory, {
    agent,
    canisterId: resolveCanisterId("recipes", FALLBACK_RECIPES_CANISTER_ID),
  });
}

export function starDisplay(avg) {
  const rounded = Math.round(Number(avg));
  return "\u2605".repeat(rounded) + "\u2606".repeat(5 - rounded);
}
