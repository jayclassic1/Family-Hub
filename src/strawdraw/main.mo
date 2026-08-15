import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type StrawGame = Types.StrawGame;
  type StrawResultPublic = Types.StrawResultPublic;
  type StrawComment = Types.StrawComment;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  let games = Map.empty<Nat, StrawGame>();
  var gameCounter : Nat = 0;

  let assignments = Map.empty<Nat, Map.Map<Principal, Bool>>();
  let revealed = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let comments = Map.empty<Nat, StrawComment>();
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

  func isParticipant(list : [Principal], p : Principal) : Bool {
    switch (Array.find<Principal>(list, func(x : Principal) : Bool { Principal.equal(x, p) })) {
      case (?_) { true };
      case null { false };
    }
  };

  public shared ({ caller }) func createGame(
    name : Text,
    description : Text,
    participants : [Principal],
    shuffledForShortStraws : [Principal],
    shortStrawCount : Nat,
    coverPhoto : ?ChatAttachment
  ) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    if (participants.size() < 2) {
      Runtime.trap("Need at least 2 participants");
    };
    if (shortStrawCount < 1 or shortStrawCount >= participants.size()) {
      Runtime.trap("Short straw count must be between 1 and participants - 1");
    };
    if (shuffledForShortStraws.size() != participants.size()) {
      Runtime.trap("Shuffled order must match participant count");
    };

    let creatorName = await authUsername(caller);
    let id = gameCounter;

    let g : StrawGame = {
      id;
      creator = caller;
      creatorName;
      name;
      description;
      participants;
      shortStrawCount;
      coverPhoto;
      created = Time.now();
    };
    Map.add(games, Nat.compare, id, g);

    let m = Map.empty<Principal, Bool>();
    var i = 0;
    for (p in shuffledForShortStraws.vals()) {
      Map.add(m, Principal.compare, p, i < shortStrawCount);
      i += 1;
    };
    Map.add(assignments, Nat.compare, id, m);
    Map.add(revealed, Nat.compare, id, Map.empty<Principal, Bool>());

    gameCounter += 1;
    id
  };

  public query func listGames() : async [StrawGame] {
    Array.fromIter<StrawGame>(Map.values(games))
  };

  public query func getGame(gameId : Nat) : async ?StrawGame {
    Map.get(games, Nat.compare, gameId)
  };

  public shared ({ caller }) func revealMyStraw(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not isParticipant(g.participants, caller)) { return false };
      };
      case null { return false };
    };
    switch (Map.get(revealed, Nat.compare, gameId)) {
      case (?r) {
        Map.add(r, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public query func getResults(gameId : Nat) : async [StrawResultPublic] {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        let assignMap = switch (Map.get(assignments, Nat.compare, gameId)) {
          case (?m) { m };
          case null { Map.empty<Principal, Bool>() };
        };
        let revealMap = switch (Map.get(revealed, Nat.compare, gameId)) {
          case (?m) { m };
          case null { Map.empty<Principal, Bool>() };
        };
        Array.map<Principal, StrawResultPublic>(
          g.participants,
          func(p : Principal) : StrawResultPublic {
            let hasRevealed = switch (Map.get(revealMap, Principal.compare, p)) {
              case (?v) { v };
              case null { false };
            };
            let short = if (hasRevealed) {
              switch (Map.get(assignMap, Principal.compare, p)) {
                case (?v) { ?v };
                case null { null };
              }
            } else { null };
            {
              participant = p;
              participantName = "";
              revealed = hasRevealed;
              isShort = short;
            }
          }
        )
      };
      case null { [] };
    }
  };

  public query ({ caller }) func getMyStraw(gameId : Nat) : async ?Bool {
    switch (Map.get(revealed, Nat.compare, gameId)) {
      case (?r) {
        let hasRevealed = switch (Map.get(r, Principal.compare, caller)) {
          case (?v) { v };
          case null { false };
        };
        if (not hasRevealed) { return null };
        switch (Map.get(assignments, Nat.compare, gameId)) {
          case (?m) { Map.get(m, Principal.compare, caller) };
          case null { null };
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
    let c : StrawComment = {
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

  public query func getComments(gameId : Nat) : async [StrawComment] {
    Array.filter<StrawComment>(
      Array.fromIter<StrawComment>(Map.values(comments)),
      func(c : StrawComment) : Bool { c.gameId == gameId }
    )
  };
};
