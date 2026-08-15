import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as dmsIdlFactory } from "./idl/dms.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_DMS_CANISTER_ID = "";

export async function createDmsActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(dmsIdlFactory, {
    agent,
    canisterId: resolveCanisterId("dms", FALLBACK_DMS_CANISTER_ID),
  });
}
