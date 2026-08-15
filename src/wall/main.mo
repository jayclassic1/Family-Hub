import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type ProfilesActor = actor {
    addLike : shared (Principal) -> async Bool;
  };

  type WalletActor = actor {
    spendLoveFor : shared (Principal, Nat) -> async Bool;
    transferLoveBetween : shared (Principal, Principal, Nat) -> async Bool;
  };

  type WallPost = {
    id : Nat;
    wallOwner : Principal;
    author : Principal;
    authorName : Text;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
  };

  type WallPostPublic = {
    id : Nat;
    wallOwner : Principal;
    author : Principal;
    authorName : Text;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
    thumbsUpCount : Nat;
    thumbsDownCount : Nat;
    loveCount : Nat;
    myReaction : ?Bool;
    myLoveGiven : Bool;
  };

  let posts = Map.empty<Nat, WallPost>();
  var postCounter : Nat = 0;

  let reactions = Map.empty<Nat, Map.Map<Principal, Bool>>();
  let loveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  func isCallerAdmin(caller : Principal) : async Bool {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:auth")) {
      case (?authId) {
        let authCanister : AuthActor = actor (authId);
        switch (await authCanister.getUser(caller)) {
          case (?p) {
            switch (p.role) {
              case (#admin) { true };
              case (#member) { false };
            };
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  func thumbsUpCount(postId : Nat) : Nat {
    switch (Map.get(reactions, Nat.compare, postId)) {
      case (?m) {
        var count = 0;
        for (v in Map.values(m)) {
          if (v) { count += 1 };
        };
        count
      };
      case null { 0 };
    }
  };

  func thumbsDownCount(postId : Nat) : Nat {
    switch (Map.get(reactions, Nat.compare, postId)) {
      case (?m) {
        var count = 0;
        for (v in Map.values(m)) {
          if (not v) { count += 1 };
        };
        count
      };
      case null { 0 };
    }
  };

  func loveCountFor(postId : Nat) : Nat {
    switch (Map.get(loveGiven, Nat.compare, postId)) {
      case (?m) { Map.size(m) };
      case null { 0 };
    }
  };

  func myReaction(postId : Nat, caller : Principal) : ?Bool {
    switch (Map.get(reactions, Nat.compare, postId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  func myLoveGivenFor(postId : Nat, caller : Principal) : Bool {
    switch (Map.get(loveGiven, Nat.compare, postId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func toPublic(p : WallPost, caller : Principal) : WallPostPublic {
    {
      id = p.id;
      wallOwner = p.wallOwner;
      author = p.author;
      authorName = p.authorName;
      text = p.text;
      attachment = p.attachment;
      timestamp = p.timestamp;
      thumbsUpCount = thumbsUpCount(p.id);
      thumbsDownCount = thumbsDownCount(p.id);
      loveCount = loveCountFor(p.id);
      myReaction = myReaction(p.id, caller);
      myLoveGiven = myLoveGivenFor(p.id, caller);
    }
  };

  func authUsername(caller : Principal) : async Text {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:auth")) {
      case (?authId) {
        let authCanister : AuthActor = actor (authId);
        switch (await authCanister.getUser(caller)) {
          case (?p) { p.username };
          case null { "Someone" };
        };
      };
      case null { "Someone" };
    };
  };

  public shared ({ caller }) func postToWall(wallOwner : Principal, text : Text, attachment : ?ChatAttachment) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (Text.size(text) == 0 and attachment == null) { return false };
    if (not Principal.equal(caller, wallOwner)) {
      switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
        case (?walletId) {
          let w : WalletActor = actor (walletId);
          let paid = await w.spendLoveFor(caller, 2);
          if (not paid) { return false };
        };
        case null { return false };
      };
    };
    let authorName = await authUsername(caller);
    let id = postCounter;
    let post : WallPost = {
      id;
      wallOwner;
      author = caller;
      authorName;
      text;
      attachment;
      timestamp = Time.now();
    };
    Map.add(posts, Nat.compare, id, post);
    postCounter += 1;
    true
  };

  public query ({ caller }) func getWallPosts(wallOwner : Principal) : async [WallPostPublic] {
    let mine = Array.filter<WallPost>(
      Array.fromIter<WallPost>(Map.values(posts)),
      func(p : WallPost) : Bool { Principal.equal(p.wallOwner, wallOwner) }
    );
    Array.map<WallPost, WallPostPublic>(mine, func(p : WallPost) : WallPostPublic { toPublic(p, caller) })
  };

  public shared ({ caller }) func reactToWallPost(postId : Nat, isThumbsUp : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(posts, Nat.compare, postId)) {
      case (?p) {
        if (Principal.equal(p.author, caller)) { return false };
        let r = switch (Map.get(reactions, Nat.compare, postId)) {
          case (?r) { r };
          case null {
            let r = Map.empty<Principal, Bool>();
            Map.add(reactions, Nat.compare, postId, r);
            r
          };
        };
        if (Map.get(r, Principal.compare, caller) != null) { return false };
        Map.add(r, Principal.compare, caller, isThumbsUp);
        if (isThumbsUp) {
          switch (Runtime.envVar("PUBLIC_CANISTER_ID:profiles")) {
            case (?profilesId) {
              let pActor : ProfilesActor = actor (profilesId);
              ignore await pActor.addLike(p.author);
            };
            case null {};
          };
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func loveWallPost(postId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(posts, Nat.compare, postId)) {
      case (?p) {
        if (Principal.equal(p.author, caller)) { return false };
        if (myLoveGivenFor(postId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, p.author, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let l = switch (Map.get(loveGiven, Nat.compare, postId)) {
          case (?l) { l };
          case null {
            let l = Map.empty<Principal, Bool>();
            Map.add(loveGiven, Nat.compare, postId, l);
            l
          };
        };
        Map.add(l, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func deleteWallPost(postId : Nat) : async Bool {
    switch (Map.get(posts, Nat.compare, postId)) {
      case (?p) {
        if (Principal.equal(p.author, caller) or Principal.equal(p.wallOwner, caller)) {
          ignore Map.remove(posts, Nat.compare, postId);
          return true;
        };
        if (await isCallerAdmin(caller)) {
          ignore Map.remove(posts, Nat.compare, postId);
          return true;
        };
        false
      };
      case null { false };
    }
  };
};
