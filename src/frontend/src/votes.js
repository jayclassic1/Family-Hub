import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as votesIdlFactory } from "./idl/votes.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_VOTES_CANISTER_ID = "";

export async function createVotesActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(votesIdlFactory, {
    agent,
    canisterId: resolveCanisterId("votes", FALLBACK_VOTES_CANISTER_ID),
  });
}

export function topResult(poll, counts) {
  let bestIndex = 0;
  let bestCount = 0;
  counts.forEach((c, i) => {
    const n = Number(c);
    if (n > bestCount) {
      bestCount = n;
      bestIndex = i;
    }
  });
  const total = counts.reduce((sum, c) => sum + Number(c), 0);
  const pct = total > 0 ? Math.round((bestCount / total) * 100) : 0;
  return { label: poll.options[bestIndex] || "No votes yet", pct, total };
}
