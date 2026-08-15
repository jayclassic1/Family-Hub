import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as albumsIdlFactory } from "./idl/albums.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_ALBUMS_CANISTER_ID = "";

export async function createAlbumsActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(albumsIdlFactory, {
    agent,
    canisterId: resolveCanisterId("albums", FALLBACK_ALBUMS_CANISTER_ID),
  });
}
