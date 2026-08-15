import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as pokerIdlFactory } from "./idl/poker.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_POKER_CANISTER_ID = "";

export async function createPokerActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(pokerIdlFactory, {
    agent,
    canisterId: resolveCanisterId("poker", FALLBACK_POKER_CANISTER_ID),
  });
}

const SUIT_SYMBOLS = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const RANK_LABELS = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export function cardLabel(card) {
  const rankText = RANK_LABELS[Number(card.rank)] || card.rank.toString();
  const suitKey = Object.keys(card.suit)[0];
  return rankText + SUIT_SYMBOLS[suitKey];
}

export function isRedSuit(card) {
  const suitKey = Object.keys(card.suit)[0];
  return suitKey === "hearts" || suitKey === "diamonds";
}

export function phaseKey(phase) {
  return Object.keys(phase)[0];
}
