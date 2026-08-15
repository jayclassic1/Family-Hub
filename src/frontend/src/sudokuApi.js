import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as sudokuIdlFactory } from "./idl/sudoku.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_SUDOKU_CANISTER_ID = "";

export async function createSudokuActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(sudokuIdlFactory, {
    agent,
    canisterId: resolveCanisterId("sudoku", FALLBACK_SUDOKU_CANISTER_ID),
  });
}
