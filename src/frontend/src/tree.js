import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as treeIdlFactory } from "./idl/tree.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_TREE_CANISTER_ID = "";

export async function createTreeActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(treeIdlFactory, {
    agent,
    canisterId: resolveCanisterId("tree", FALLBACK_TREE_CANISTER_ID),
  });
}

export function isAdminRole(role) {
  return role && "admin" in role;
}
