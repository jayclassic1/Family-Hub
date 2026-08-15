import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type SpinResult = Types.SpinResult;
  type SpinComment = Types.SpinComment;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  let spins = Map.empty<Nat, SpinResult>();
  var spinCounter : Nat = 0;

  let comments = Map.empty<Nat, SpinComment>();
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

  public shared ({ caller }) func recordImportantSpin(
    options : [Text],
    winner : Text,
    name : Text,
    description : Text,
    coverPhoto : ?ChatAttachment
  ) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let spinnerName = await authUsername(caller);
    let id = spinCounter;
    let s : SpinResult = {
      id;
      spinner = caller;
      spinnerName;
      options;
      winner;
      name;
      description;
      coverPhoto;
      created = Time.now();
    };
    Map.add(spins, Nat.compare, id, s);
    spinCounter += 1;
    id
  };

  public query func listSpins() : async [SpinResult] {
    Array.fromIter<SpinResult>(Map.values(spins))
  };

  public query func getSpin(spinId : Nat) : async ?SpinResult {
    Map.get(spins, Nat.compare, spinId)
  };

  public shared ({ caller }) func addSpinComment(spinId : Nat, text : Text) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    switch (Map.get(spins, Nat.compare, spinId)) {
      case (?_) {};
      case null { Runtime.trap("Spin not found") };
    };
    let authorName = await authUsername(caller);
    let id = commentCounter;
    let c : SpinComment = {
      id;
      spinId;
      author = caller;
      authorName;
      text;
      timestamp = Time.now();
    };
    Map.add(comments, Nat.compare, id, c);
    commentCounter += 1;
    id
  };

  public query func getSpinComments(spinId : Nat) : async [SpinComment] {
    Array.filter<SpinComment>(
      Array.fromIter<SpinComment>(Map.values(comments)),
      func(c : SpinComment) : Bool { c.spinId == spinId }
    )
  };
};
