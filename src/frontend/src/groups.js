import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as groupsIdlFactory } from "./idl/groups.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_GROUPS_CANISTER_ID = "";

export async function createGroupsActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(groupsIdlFactory, {
    agent,
    canisterId: resolveCanisterId("groups", FALLBACK_GROUPS_CANISTER_ID),
  });
}
