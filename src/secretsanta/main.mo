import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type SecretSantaExchange = Types.SecretSantaExchange;
  type SantaMatch = Types.SantaMatch;
  type SantaComment = Types.SantaComment;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  let exchanges = Map.empty<Nat, SecretSantaExchange>();
  var exchangeCounter : Nat = 0;

  // giver -> recipient, kept private per exchange
  let assignments = Map.empty<Nat, Map.Map<Principal, Principal>>();

  let comments = Map.empty<Nat, SantaComment>();
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

  public shared ({ caller }) func createExchange(
    name : Text,
    description : Text,
    givers : [Principal],
    recipients : [Principal],
    coverPhoto : ?ChatAttachment
  ) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    if (givers.size() < 2 or givers.size() != recipients.size()) {
      Runtime.trap("Need at least 2 participants with a matching pairing");
    };

    let organizerName = await authUsername(caller);
    let id = exchangeCounter;

    let e : SecretSantaExchange = {
      id;
      organizer = caller;
      organizerName;
      name;
      description;
      participants = givers;
      coverPhoto;
      created = Time.now();
    };
    Map.add(exchanges, Nat.compare, id, e);

    let m = Map.empty<Principal, Principal>();
    var i = 0;
    while (i < givers.size()) {
      Map.add(m, Principal.compare, givers[i], recipients[i]);
      i += 1;
    };
    Map.add(assignments, Nat.compare, id, m);

    exchangeCounter += 1;
    id
  };

  public query func listExchanges() : async [SecretSantaExchange] {
    Array.fromIter<SecretSantaExchange>(Map.values(exchanges))
  };

  public query func getExchange(exchangeId : Nat) : async ?SecretSantaExchange {
    Map.get(exchanges, Nat.compare, exchangeId)
  };

  public shared ({ caller }) func getMyMatch(exchangeId : Nat) : async ?SantaMatch {
    switch (Map.get(exchanges, Nat.compare, exchangeId)) {
      case (?e) {
        if (not isParticipant(e.participants, caller)) { return null };
      };
      case null { return null };
    };
    switch (Map.get(assignments, Nat.compare, exchangeId)) {
      case (?m) {
        switch (Map.get(m, Principal.compare, caller)) {
          case (?recipientId) {
            let recipientName = await authUsername(recipientId);
            ?{ recipientId; recipientName }
          };
          case null { null };
        }
      };
      case null { null };
    }
  };

  public shared ({ caller }) func addSantaComment(exchangeId : Nat, text : Text) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    switch (Map.get(exchanges, Nat.compare, exchangeId)) {
      case (?_) {};
      case null { Runtime.trap("Exchange not found") };
    };
    let authorName = await authUsername(caller);
    let id = commentCounter;
    let c : SantaComment = {
      id;
      santaId = exchangeId;
      author = caller;
      authorName;
      text;
      timestamp = Time.now();
    };
    Map.add(comments, Nat.compare, id, c);
    commentCounter += 1;
    id
  };

  public query func getSantaComments(exchangeId : Nat) : async [SantaComment] {
    Array.filter<SantaComment>(
      Array.fromIter<SantaComment>(Map.values(comments)),
      func(c : SantaComment) : Bool { c.santaId == exchangeId }
    )
  };
};
