import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type HatDraw = Types.HatDraw;
  type HatAssignment = Types.HatAssignment;
  type HatComment = Types.HatComment;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  let draws = Map.empty<Nat, HatDraw>();
  var drawCounter : Nat = 0;

  let comments = Map.empty<Nat, HatComment>();
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

  public shared ({ caller }) func recordImportantDraw(
    answers : [Text],
    assignments : [HatAssignment],
    name : Text,
    description : Text,
    coverPhoto : ?ChatAttachment
  ) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let drawerName = await authUsername(caller);
    let id = drawCounter;
    let d : HatDraw = {
      id;
      drawer = caller;
      drawerName;
      answers;
      assignments;
      name;
      description;
      coverPhoto;
      created = Time.now();
    };
    Map.add(draws, Nat.compare, id, d);
    drawCounter += 1;
    id
  };

  public query func listDraws() : async [HatDraw] {
    Array.fromIter<HatDraw>(Map.values(draws))
  };

  public query func getDraw(drawId : Nat) : async ?HatDraw {
    Map.get(draws, Nat.compare, drawId)
  };

  public shared ({ caller }) func addDrawComment(drawId : Nat, text : Text) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    switch (Map.get(draws, Nat.compare, drawId)) {
      case (?_) {};
      case null { Runtime.trap("Draw not found") };
    };
    let authorName = await authUsername(caller);
    let id = commentCounter;
    let c : HatComment = {
      id;
      drawId;
      author = caller;
      authorName;
      text;
      timestamp = Time.now();
    };
    Map.add(comments, Nat.compare, id, c);
    commentCounter += 1;
    id
  };

  public query func getDrawComments(drawId : Nat) : async [HatComment] {
    Array.filter<HatComment>(
      Array.fromIter<HatComment>(Map.values(comments)),
      func(c : HatComment) : Bool { c.drawId == drawId }
    )
  };
};
