import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type RpsChoice = Types.RpsChoice;
  type RpsStatus = Types.RpsStatus;
  type RpsGamePublic = Types.RpsGamePublic;
  type RpsComment = Types.RpsComment;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type RpsGameInternal = {
    id : Nat;
    creator : Principal;
    creatorName : Text;
    opponent : ?Principal;
    opponentName : ?Text;
    status : RpsStatus;
    creatorChoice : ?RpsChoice;
    opponentChoice : ?RpsChoice;
    winner : ?Principal;
    winnerName : ?Text;
    isDraw : Bool;
    round : Nat;
    name : ?Text;
    description : ?Text;
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  let games = Map.empty<Nat, RpsGameInternal>();
  var gameCounter : Nat = 0;

  let comments = Map.empty<Nat, RpsComment>();
  var commentCounter : Nat = 0;

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

  func beats(a : RpsChoice, b : RpsChoice) : Bool {
    switch (a, b) {
      case (#rock, #scissors) { true };
      case (#scissors, #paper) { true };
      case (#paper, #rock) { true };
      case (_, _) { false };
    }
  };

  // Reveal choices only once both are locked in, so nobody can peek
  // at their opponent's move before committing their own.
  func toPublic(g : RpsGameInternal) : RpsGamePublic {
    let bothChosen = g.creatorChoice != null and g.opponentChoice != null;
    {
      id = g.id;
      creator = g.creator;
      creatorName = g.creatorName;
      opponent = g.opponent;
      opponentName = g.opponentName;
      status = g.status;
      creatorChoice = if (bothChosen) { g.creatorChoice } else { null };
      opponentChoice = if (bothChosen) { g.opponentChoice } else { null };
      winner = g.winner;
      winnerName = g.winnerName;
      isDraw = g.isDraw;
      round = g.round;
      name = g.name;
      description = g.description;
      coverPhoto = g.coverPhoto;
      created = g.created;
    }
  };

  public shared ({ caller }) func createGame(opponent : Principal) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    if (Principal.equal(caller, opponent)) {
      Runtime.trap("Cannot play yourself");
    };
    let creatorName = await authUsername(caller);
    let opponentName = await authUsername(opponent);
    let id = gameCounter;
    let g : RpsGameInternal = {
      id;
      creator = caller;
      creatorName;
      opponent = ?opponent;
      opponentName = ?opponentName;
      status = #waitingForOpponent;
      creatorChoice = null;
      opponentChoice = null;
      winner = null;
      winnerName = null;
      isDraw = false;
      round = 1;
      name = null;
      description = null;
      coverPhoto = null;
      created = Time.now();
    };
    Map.add(games, Nat.compare, id, g);
    gameCounter += 1;
    id
  };

  public shared ({ caller }) func confirmJoin(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        switch (g.opponent) {
          case (?opp) {
            if (not Principal.equal(opp, caller)) { return false };
          };
          case null { return false };
        };
        let updated = { g with status = #waitingForChoices };
        Map.add(games, Nat.compare, gameId, updated);
        true
      };
      case null { false };
    }
  };

  func isParticipant(g : RpsGameInternal, p : Principal) : Bool {
    if (Principal.equal(g.creator, p)) { return true };
    switch (g.opponent) {
      case (?o) { Principal.equal(o, p) };
      case null { false };
    }
  };

  public shared ({ caller }) func makeChoice(gameId : Nat, choice : RpsChoice) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (g.status != #waitingForChoices) { return false };
        if (not isParticipant(g, caller)) { return false };

        var updated = g;
        if (Principal.equal(g.creator, caller)) {
          updated := { g with creatorChoice = ?choice };
        } else {
          updated := { g with opponentChoice = ?choice };
        };

        switch (updated.creatorChoice, updated.opponentChoice) {
          case (?cc, ?oc) {
            if (cc == oc) {
              updated := { updated with isDraw = true; status = #finished; winner = null; winnerName = null };
            } else if (beats(cc, oc)) {
              updated := {
                updated with
                status = #finished;
                winner = ?g.creator;
                winnerName = ?g.creatorName;
                isDraw = false;
              };
            } else {
              let oppId = switch (g.opponent) { case (?o) { o }; case null { g.creator } };
              let oppName = switch (g.opponentName) { case (?n) { n }; case null { "Unknown" } };
              updated := {
                updated with
                status = #finished;
                winner = ?oppId;
                winnerName = ?oppName;
                isDraw = false;
              };
            };
          };
          case (_, _) {};
        };

        Map.add(games, Nat.compare, gameId, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func playAgain(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not isParticipant(g, caller)) { return false };
        if (g.status != #finished) { return false };
        let updated = {
          g with
          status = #waitingForChoices;
          creatorChoice = null;
          opponentChoice = null;
          winner = null;
          winnerName = null;
          isDraw = false;
          round = g.round + 1;
        };
        Map.add(games, Nat.compare, gameId, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func markImportant(
    gameId : Nat,
    name : Text,
    description : Text,
    coverPhoto : ?ChatAttachment
  ) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not isParticipant(g, caller)) { return false };
        let updated = { g with name = ?name; description = ?description; coverPhoto };
        Map.add(games, Nat.compare, gameId, updated);
        true
      };
      case null { false };
    }
  };

  public query func listAllGames() : async [RpsGamePublic] {
    Array.map<RpsGameInternal, RpsGamePublic>(
      Array.fromIter<RpsGameInternal>(Map.values(games)),
      toPublic
    )
  };

  public query func listImportantGames() : async [RpsGamePublic] {
    let named = Array.filter<RpsGameInternal>(
      Array.fromIter<RpsGameInternal>(Map.values(games)),
      func(g : RpsGameInternal) : Bool { g.name != null }
    );
    Array.map<RpsGameInternal, RpsGamePublic>(named, toPublic)
  };

  public query func getGame(gameId : Nat) : async ?RpsGamePublic {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) { ?toPublic(g) };
      case null { null };
    }
  };

  public query ({ caller }) func getMyChoice(gameId : Nat) : async ?RpsChoice {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (Principal.equal(g.creator, caller)) { g.creatorChoice }
        else {
          switch (g.opponent) {
            case (?o) { if (Principal.equal(o, caller)) { g.opponentChoice } else { null } };
            case null { null };
          }
        }
      };
      case null { null };
    }
  };

  public shared ({ caller }) func addComment(gameId : Nat, text : Text) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?_) {};
      case null { Runtime.trap("Game not found") };
    };
    let authorName = await authUsername(caller);
    let id = commentCounter;
    let c : RpsComment = {
      id;
      gameId;
      author = caller;
      authorName;
      text;
      timestamp = Time.now();
    };
    Map.add(comments, Nat.compare, id, c);
    commentCounter += 1;
    id
  };

  public query func getComments(gameId : Nat) : async [RpsComment] {
    Array.filter<RpsComment>(
      Array.fromIter<RpsComment>(Map.values(comments)),
      func(c : RpsComment) : Bool { c.gameId == gameId }
    )
  };
};
