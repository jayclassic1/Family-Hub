import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as chessIdlFactory } from "./idl/chess.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_CHESS_CANISTER_ID = "";

export async function createChessActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(chessIdlFactory, {
    agent,
    canisterId: resolveCanisterId("chess", FALLBACK_CHESS_CANISTER_ID),
  });
}

export function statusToVariant(status) {
  return { [status]: null };
}

export function statusLabel(statusVariant) {
  const key = Object.keys(statusVariant)[0];
  const labels = {
    ongoing: "In progress",
    whiteWon: "White won (checkmate)",
    blackWon: "Black won (checkmate)",
    draw: "Draw",
    resignedWhite: "White resigned",
    resignedBlack: "Black resigned",
  };
  return labels[key] || key;
}
