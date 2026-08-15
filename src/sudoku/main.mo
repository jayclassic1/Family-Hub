import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Principal "mo:core/Principal";

persistent actor {

  // 36 hours, in nanoseconds — the length of one puzzle cycle.
  let CYCLE_NS : Int = 36 * 60 * 60 * 1_000_000_000;

  // Lifetime win count per user, across all difficulties and cycles.
  let winCounts = Map.empty<Principal, Nat>();

  // Which (cycleId, difficulty) combos each user has already claimed,
  // so the same puzzle can't be re-solved for extra points.
  let claimedWins = Map.empty<Principal, Map.Map<Text, Bool>>();

  func currentCycleId() : Int {
    Time.now() / CYCLE_NS
  };

  public query func getCurrentCycle() : async { cycleId : Int; cycleStart : Int; cycleEnd : Int } {
    let id = currentCycleId();
    let start = id * CYCLE_NS;
    { cycleId = id; cycleStart = start; cycleEnd = start + CYCLE_NS };
  };

  public shared ({ caller }) func recordWin(difficulty : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (difficulty != "easy" and difficulty != "medium" and difficulty != "hard") {
      return false;
    };
    let cycleId = currentCycleId();
    let key = Int.toText(cycleId) # "-" # difficulty;
    let mine = switch (Map.get(claimedWins, Principal.compare, caller)) {
      case (?m) { m };
      case null {
        let m = Map.empty<Text, Bool>();
        Map.add(claimedWins, Principal.compare, caller, m);
        m
      };
    };
    if (Map.get(mine, Text.compare, key) != null) { return false };
    Map.add(mine, Text.compare, key, true);
    let current = switch (Map.get(winCounts, Principal.compare, caller)) {
      case (?c) { c };
      case null { 0 };
    };
    Map.add(winCounts, Principal.compare, caller, current + 1);
    true
  };

  public query ({ caller }) func getMyWins() : async Nat {
    switch (Map.get(winCounts, Principal.compare, caller)) {
      case (?c) { c };
      case null { 0 };
    }
  };

  public query ({ caller }) func haveIWon(difficulty : Text) : async Bool {
    let cycleId = currentCycleId();
    let key = Int.toText(cycleId) # "-" # difficulty;
    switch (Map.get(claimedWins, Principal.compare, caller)) {
      case (?m) { Map.get(m, Text.compare, key) != null };
      case null { false };
    }
  };

  public query func getWinsFor(user : Principal) : async Nat {
    switch (Map.get(winCounts, Principal.compare, user)) {
      case (?c) { c };
      case null { 0 };
    }
  };
};
