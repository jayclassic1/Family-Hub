import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as walletIdlFactory } from "./idl/wallet.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_WALLET_CANISTER_ID = "";

export async function createWalletActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(walletIdlFactory, {
    agent,
    canisterId: resolveCanisterId("wallet", FALLBACK_WALLET_CANISTER_ID),
  });
}

export function formatMoney(n) {
  const num = Number(n);
  const sign = num < 0 ? "-" : "";
  return sign + "$" + Math.abs(num).toFixed(2);
}
