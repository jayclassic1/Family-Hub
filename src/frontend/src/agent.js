import { HttpAgent } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";

const isLocal = window.location.hostname.includes("localhost");

export const AGENT_HOST = isLocal ? "http://localhost:8000" : "https://icp-api.io";

export function getCanisterEnv() {
  return safeGetCanisterEnv();
}

export function resolveCanisterId(name, fallback) {
  const env = getCanisterEnv();
  return env?.[`PUBLIC_CANISTER_ID:${name}`] || fallback;
}

export async function createAgent(identity) {
  const env = getCanisterEnv();
  return HttpAgent.create({
    host: AGENT_HOST,
    identity,
    fetch: window.fetch.bind(window),
    rootKey: env?.IC_ROOT_KEY,
  });
}
