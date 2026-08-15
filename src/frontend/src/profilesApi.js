import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as profilesIdlFactory } from "./idl/profiles.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_PROFILES_CANISTER_ID = "";
export const MAX_PROFILE_PHOTOS = 10;

export async function createProfilesActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(profilesIdlFactory, {
    agent,
    canisterId: resolveCanisterId("profiles", FALLBACK_PROFILES_CANISTER_ID),
  });
}

export function optToText(opt) {
  return opt && opt.length > 0 ? opt[0] : null;
}

export function textToOpt(text) {
  return text && text.trim() ? [text.trim()] : [];
}
