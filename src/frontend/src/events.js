import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as eventsIdlFactory } from "./idl/events.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_EVENTS_CANISTER_ID = "";

export async function createEventsActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(eventsIdlFactory, {
    agent,
    canisterId: resolveCanisterId("calendar", FALLBACK_EVENTS_CANISTER_ID),
  });
}

// --- Date helpers ---

export function eventOccursOnDate(event, date) {
  if ("oneTime" in event.kind) {
    const d = new Date(Number(event.kind.oneTime.dateMillis));
    return (
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );
  }
  const a = event.kind.annual;
  return Number(a.month) === date.getMonth() + 1 && Number(a.day) === date.getDate();
}

export function nextOccurrence(event, fromDate) {
  if ("oneTime" in event.kind) {
    const d = new Date(Number(event.kind.oneTime.dateMillis));
    return d >= startOfDay(fromDate) ? d : null;
  }
  const a = event.kind.annual;
  const month = Number(a.month) - 1;
  const day = Number(a.day);
  let candidate = new Date(fromDate.getFullYear(), month, day);
  if (candidate < startOfDay(fromDate)) {
    candidate = new Date(fromDate.getFullYear() + 1, month, day);
  }
  return candidate;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getUpcomingEvents(events, fromDate, limit) {
  const withNext = events
    .map((e) => ({ event: e, next: nextOccurrence(e, fromDate) }))
    .filter((x) => x.next !== null);
  withNext.sort((a, b) => a.next - b.next);
  return withNext.slice(0, limit);
}

export function getMonthGrid(year, monthIndex0) {
  const firstOfMonth = new Date(year, monthIndex0, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex0, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function formatEventKind(event) {
  if ("oneTime" in event.kind) {
    const d = new Date(Number(event.kind.oneTime.dateMillis));
    return d.toLocaleDateString();
  }
  const a = event.kind.annual;
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return monthNames[Number(a.month) - 1] + " " + Number(a.day) + " (yearly)";
}
