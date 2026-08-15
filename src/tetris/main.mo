import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";

persistent actor {

  let MIN_PLAYERS = 2;
  let MAX_PLAYERS = 8;

  type UserProfilePublic = { username : Text; role : { #admin; #member } };

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type WalletActor = actor {
    spendLoveFor : shared (Principal, Nat) -> async Bool;
    earnLoveFor : shared (Principal, Nat) -> async Bool;
  };

  type TournamentStatus = { #waiting; #inProgress; #complete; #cancelled };

  type PlayerEntry = {
    player : Principal;
    playerName : Text;
    score : ?Nat;
  };

  type Tournament = {
    id : Nat;
    creator : Principal;
    name : Text;
    maxPlayers : Nat;
    wager : Nat;
    players : [PlayerEntry];
    status : TournamentStatus;
    winnerText : Text;
    created : Int;
  };

  let tournaments = Map.empty<Nat, Tournament>();
  var tournamentCounter : Nat = 0;

  func authUsername(caller : Principal) : async Text {
    let authIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:auth");
    let authId = switch (authIdOpt) {
      case (?id) { id };
      case null { Runtime.trap("auth canister id not configured") };
    };
    let authCanister : AuthActor = actor (authId);
    let profile = await authCanister.getUser(caller);
    switch (profile) {
      case (?p) { p.username };
      case null { "Unknown" };
    }
  };

  func getWallet() : async ?WalletActor {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
      case (?walletId) { ?(actor (walletId) : WalletActor) };
      case null { null };
    }
  };

  func isPlayerIn(players : [PlayerEntry], p : Principal) : Bool {
    for (entry in players.vals()) {
      if (Principal.equal(entry.player, p)) { return true };
    };
    false
  };

  public shared ({ caller }) func createTournament(name : Text, maxPlayers : Nat, wager : Nat) : async Nat {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Not signed in") };
    if (maxPlayers < MIN_PLAYERS or maxPlayers > MAX_PLAYERS) {
      Runtime.trap("maxPlayers must be between 2 and 8");
    };
    if (wager > 0) {
      switch (await getWallet()) {
        case (?w) {
          let paid = await w.spendLoveFor(caller, wager);
          if (not paid) { Runtime.trap("Not enough Love for that wager") };
        };
        case null { Runtime.trap("Wallet unavailable") };
      };
    };
    let creatorName = await authUsername(caller);
    let id = tournamentCounter;
    let t : Tournament = {
      id;
      creator = caller;
      name = if (name == "") { "Tetris Tournament " # Nat.toText(id) } else { name };
      maxPlayers;
      wager;
      players = [{ player = caller; playerName = creatorName; score = null }];
      status = #waiting;
      winnerText = "";
      created = Time.now();
    };
    Map.add(tournaments, Nat.compare, id, t);
    tournamentCounter += 1;
    id
  };

  public shared ({ caller }) func joinTournament(tournamentId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(tournaments, Nat.compare, tournamentId)) {
      case (?t) {
        if (t.status != #waiting) { return false };
        if (t.players.size() >= t.maxPlayers) { return false };
        if (isPlayerIn(t.players, caller)) { return false };
        if (t.wager > 0) {
          switch (await getWallet()) {
            case (?w) {
              let paid = await w.spendLoveFor(caller, t.wager);
              if (not paid) { return false };
            };
            case null { return false };
          };
        };
        let playerName = await authUsername(caller);
        let updated = {
          t with
          players = Array.concat<PlayerEntry>(t.players, [{ player = caller; playerName; score = null }]);
        };
        Map.add(tournaments, Nat.compare, tournamentId, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func startTournament(tournamentId : Nat) : async Bool {
    switch (Map.get(tournaments, Nat.compare, tournamentId)) {
      case (?t) {
        if (not Principal.equal(t.creator, caller)) { return false };
        if (t.status != #waiting) { return false };
        if (t.players.size() < MIN_PLAYERS) { return false };
        Map.add(tournaments, Nat.compare, tournamentId, { t with status = #inProgress });
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func cancelTournament(tournamentId : Nat) : async Bool {
    switch (Map.get(tournaments, Nat.compare, tournamentId)) {
      case (?t) {
        if (not Principal.equal(t.creator, caller)) { return false };
        if (t.status != #waiting) { return false };
        if (t.wager > 0) {
          switch (await getWallet()) {
            case (?w) {
              for (entry in t.players.vals()) {
                ignore await w.earnLoveFor(entry.player, t.wager);
              };
            };
            case null {};
          };
        };
        Map.add(tournaments, Nat.compare, tournamentId, { t with status = #cancelled });
        true
      };
      case null { false };
    }
  };

  func finalize(t : Tournament) : async Tournament {
    var bestScore : Nat = 0;
    var winners : [PlayerEntry] = [];
    var first = true;
    for (entry in t.players.vals()) {
      switch (entry.score) {
        case (?s) {
          if (first or s > bestScore) {
            bestScore := s;
            winners := [entry];
            first := false;
          } else if (s == bestScore) {
            winners := Array.concat<PlayerEntry>(winners, [entry]);
          };
        };
        case null {};
      };
    };

    let pot = t.wager * t.players.size();
    if (pot > 0 and winners.size() > 0) {
      let share = pot / winners.size();
      let remainder = pot - share * winners.size() : Nat;
      switch (await getWallet()) {
        case (?w) {
          var first2 = true;
          for (entry in winners.vals()) {
            let extra = if (first2) { remainder } else { 0 };
            ignore await w.earnLoveFor(entry.player, share + extra);
            first2 := false;
          };
        };
        case null {};
      };
    };

    var names = "";
    var firstName = true;
    for (entry in winners.vals()) {
      names := names # (if (firstName) { "" } else { " and " }) # entry.playerName;
      firstName := false;
    };
    let winText = if (winners.size() == 0) { "No scores submitted." }
      else if (winners.size() == 1) { names # " wins with " # Nat.toText(bestScore) # " points!" }
      else { names # " tie with " # Nat.toText(bestScore) # " points and split the pot!" };

    { t with status = #complete; winnerText = winText }
  };

  public shared ({ caller }) func submitScore(tournamentId : Nat, score : Nat) : async Bool {
    switch (Map.get(tournaments, Nat.compare, tournamentId)) {
      case (?t) {
        if (t.status != #inProgress) { return false };
        if (not isPlayerIn(t.players, caller)) { return false };
        var alreadySubmitted = false;
        for (entry in t.players.vals()) {
          if (Principal.equal(entry.player, caller) and entry.score != null) { alreadySubmitted := true };
        };
        if (alreadySubmitted) { return false };

        let newPlayers = Array.map<PlayerEntry, PlayerEntry>(
          t.players,
          func(entry : PlayerEntry) : PlayerEntry {
            if (Principal.equal(entry.player, caller)) { { entry with score = ?score } } else { entry };
          },
        );
        var updated = { t with players = newPlayers };

        var allDone = true;
        for (entry in updated.players.vals()) {
          if (entry.score == null) { allDone := false };
        };
        if (allDone) {
          updated := await finalize(updated);
        };
        Map.add(tournaments, Nat.compare, tournamentId, updated);
        true
      };
      case null { false };
    }
  };

  public query func listTournaments() : async [Tournament] {
    Array.fromIter<Tournament>(Map.values(tournaments))
  };

  public query func getTournament(tournamentId : Nat) : async ?Tournament {
    Map.get(tournaments, Nat.compare, tournamentId)
  };

  type HighScore = {
    player : Principal;
    playerName : Text;
    score : Nat;
    timestamp : Int;
  };

  var highScores : [HighScore] = [];
  let MAX_HIGH_SCORES = 50;

  public shared ({ caller }) func recordHighScore(score : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (score == 0) { return false };
    let playerName = await authUsername(caller);
    let entry : HighScore = { player = caller; playerName; score; timestamp = Time.now() };
    let combined = Array.concat<HighScore>(highScores, [entry]);
    let sorted = Array.sort<HighScore>(
      combined,
      func(a : HighScore, b : HighScore) : Order.Order {
        if (a.score > b.score) { #less } else if (a.score < b.score) { #greater } else { #equal };
      },
    );
    highScores := if (sorted.size() > MAX_HIGH_SCORES) {
      Array.tabulate<HighScore>(MAX_HIGH_SCORES, func(i : Nat) : HighScore { sorted[i] });
    } else { sorted };
    true
  };

  public query func getTopScores(n : Nat) : async [HighScore] {
    let count = Nat.min(n, highScores.size());
    Array.tabulate<HighScore>(count, func(i : Nat) : HighScore { highScores[i] })
  };
};
