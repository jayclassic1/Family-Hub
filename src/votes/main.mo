import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type Poll = Types.Poll;
  type PollSummary = Types.PollSummary;
  type PollComment = Types.PollComment;
  type PollCommentPublic = Types.PollCommentPublic;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type WalletActor = actor {
    earnLoveFor : shared (Principal, Nat) -> async Bool;
    spendLoveFor : shared (Principal, Nat) -> async Bool;
    transferLoveBetween : shared (Principal, Principal, Nat) -> async Bool;
  };

  type ProfilesActor = actor {
    addLike : shared (Principal) -> async Bool;
  };



  let polls = Map.empty<Nat, Poll>();
  var pollCounter : Nat = 0;

  let pollCounts = Map.empty<Nat, Map.Map<Nat, Nat>>();
  let pollVoters = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let comments = Map.empty<Nat, PollComment>();

  let pollCommentReactions = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let pollLoveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();
  let pollCommentLoveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  func myPollLoveGivenFor(pollId : Nat, caller : Principal) : Bool {
    switch (Map.get(pollLoveGiven, Nat.compare, pollId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func myPollCommentLoveGivenFor(commentId : Nat, caller : Principal) : Bool {
    switch (Map.get(pollCommentLoveGiven, Nat.compare, commentId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func pollCommentThumbsDownCount(commentId : Nat) : Nat {
    switch (Map.get(pollCommentReactions, Nat.compare, commentId)) {
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

  func myPollCommentReaction(commentId : Nat, caller : Principal) : ?Bool {
    switch (Map.get(pollCommentReactions, Nat.compare, commentId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  func toPublicPollComment(c : PollComment, caller : Principal) : PollCommentPublic {
    {
      id = c.id;
      pollId = c.pollId;
      author = c.author;
      authorName = c.authorName;
      text = c.text;
      timestamp = c.timestamp;
      thumbsDownCount = pollCommentThumbsDownCount(c.id);
      myReaction = myPollCommentReaction(c.id, caller);
      myLoveGiven = myPollCommentLoveGivenFor(c.id, caller);
    }
  };
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

  func getOrCreateCounts(pollId : Nat) : Map.Map<Nat, Nat> {
    switch (Map.get(pollCounts, Nat.compare, pollId)) {
      case (?m) { m };
      case null {
        let m = Map.empty<Nat, Nat>();
        Map.add(pollCounts, Nat.compare, pollId, m);
        m
      };
    }
  };

  func getOrCreateVoters(pollId : Nat) : Map.Map<Principal, Bool> {
    switch (Map.get(pollVoters, Nat.compare, pollId)) {
      case (?m) { m };
      case null {
        let m = Map.empty<Principal, Bool>();
        Map.add(pollVoters, Nat.compare, pollId, m);
        m
      };
    }
  };

  func resultsFor(p : Poll) : [Nat] {
    let counts = switch (Map.get(pollCounts, Nat.compare, p.id)) {
      case (?c) { c };
      case null { Map.empty<Nat, Nat>() };
    };
    Array.tabulate<Nat>(
      p.options.size(),
      func(i : Nat) : Nat {
        switch (Map.get(counts, Nat.compare, i)) {
          case (?c) { c };
          case null { 0 };
        }
      }
    )
  };

  public shared ({ caller }) func createPoll(
    title : Text,
    description : Text,
    options : [Text],
    optionUsers : [?Principal],
    coverPhoto : ?ChatAttachment
  ) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    if (options.size() < 2 or options.size() > 8) {
      Runtime.trap("Polls need 2 to 8 options");
    };
    if (optionUsers.size() != options.size()) {
      Runtime.trap("optionUsers must match options length");
    };
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
      case (?walletId) {
        let w : WalletActor = actor (walletId);
        let paid = await w.spendLoveFor(caller, 3);
        if (not paid) {
          Runtime.trap("You need 3 Love to create a poll");
        };
      };
      case null {};
    };
    let creatorName = await authUsername(caller);
    let id = pollCounter;
    let p : Poll = {
      id;
      creator = caller;
      creatorName;
      title;
      description;
      options;
      optionUsers;
      coverPhoto;
      created = Time.now();
    };
    Map.add(polls, Nat.compare, id, p);
    pollCounter += 1;
    id
  };

  public shared ({ caller }) func vote(pollId : Nat, optionIndex : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(polls, Nat.compare, pollId)) {
      case (?p) {
        if (optionIndex >= p.options.size()) { return false };
        switch (p.optionUsers[optionIndex]) {
          case (?u) {
            if (Principal.equal(u, caller)) { return false };
          };
          case null {};
        };
        let voters = getOrCreateVoters(pollId);
        if (Map.get(voters, Principal.compare, caller) != null) {
          return false;
        };
        Map.add(voters, Principal.compare, caller, true);
        let counts = getOrCreateCounts(pollId);
        let current = switch (Map.get(counts, Nat.compare, optionIndex)) {
          case (?c) { c };
          case null { 0 };
        };
        Map.add(counts, Nat.compare, optionIndex, current + 1);
        switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
          case (?walletId) {
            let w : WalletActor = actor (walletId);
            ignore await w.earnLoveFor(caller, 1);
          };
          case null {};
        };
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func hasVoted(pollId : Nat) : async Bool {
    switch (Map.get(pollVoters, Nat.compare, pollId)) {
      case (?v) { Map.get(v, Principal.compare, caller) != null };
      case null { false };
    }
  };

  public query func getPoll(pollId : Nat) : async ?Poll {
    Map.get(polls, Nat.compare, pollId)
  };

  public query func getResults(pollId : Nat) : async [Nat] {
    switch (Map.get(polls, Nat.compare, pollId)) {
      case (?p) { resultsFor(p) };
      case null { [] };
    }
  };

  public query ({ caller }) func listPollsWithResults() : async [PollSummary] {
    Array.map<Poll, PollSummary>(
      Array.fromIter<Poll>(Map.values(polls)),
      func(p : Poll) : PollSummary {
        { poll = p; counts = resultsFor(p); myLoveGiven = myPollLoveGivenFor(p.id, caller) }
      }
    )
  };

  public shared ({ caller }) func loveThisPoll(pollId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(polls, Nat.compare, pollId)) {
      case (?p) {
        if (Principal.equal(p.creator, caller)) { return false };
        if (myPollLoveGivenFor(pollId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, p.creator, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(pollLoveGiven, Nat.compare, pollId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(pollLoveGiven, Nat.compare, pollId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func getMyPollLoveGiven(pollId : Nat) : async Bool {
    myPollLoveGivenFor(pollId, caller)
  };

  public shared ({ caller }) func loveThisPollComment(commentId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(comments, Nat.compare, commentId)) {
      case (?c) {
        if (Principal.equal(c.author, caller)) { return false };
        if (myPollCommentLoveGivenFor(commentId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, c.author, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(pollCommentLoveGiven, Nat.compare, commentId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(pollCommentLoveGiven, Nat.compare, commentId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

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

  public shared ({ caller }) func deletePoll(pollId : Nat) : async Bool {
    switch (Map.get(polls, Nat.compare, pollId)) {
      case (?p) {
        if (not Principal.equal(p.creator, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
        ignore Map.remove(polls, Nat.compare, pollId);
        ignore Map.remove(pollCounts, Nat.compare, pollId);
        ignore Map.remove(pollVoters, Nat.compare, pollId);
        let toRemove = Array.filter<PollComment>(
          Array.fromIter<PollComment>(Map.values(comments)),
          func(c : PollComment) : Bool { c.pollId == pollId }
        );
        for (c in toRemove.vals()) {
          ignore Map.remove(comments, Nat.compare, c.id);
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func addComment(pollId : Nat, text : Text) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let authorName = await authUsername(caller);
    let id = commentCounter;
    let c : PollComment = {
      id;
      pollId;
      author = caller;
      authorName;
      text;
      timestamp = Time.now();
    };
    Map.add(comments, Nat.compare, id, c);
    commentCounter += 1;
    id
  };

  public query ({ caller }) func getComments(pollId : Nat) : async [PollCommentPublic] {
    let mine = Array.filter<PollComment>(
      Array.fromIter<PollComment>(Map.values(comments)),
      func(c : PollComment) : Bool { c.pollId == pollId }
    );
    Array.map<PollComment, PollCommentPublic>(
      mine,
      func(c : PollComment) : PollCommentPublic { toPublicPollComment(c, caller) }
    )
  };

  public shared ({ caller }) func reactToComment(commentId : Nat, isThumbsUp : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(comments, Nat.compare, commentId)) {
      case (?c) {
        if (Principal.equal(c.author, caller)) { return false };
        let m = switch (Map.get(pollCommentReactions, Nat.compare, commentId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(pollCommentReactions, Nat.compare, commentId, m);
            m
          };
        };
        if (Map.get(m, Principal.compare, caller) != null) { return false };
        Map.add(m, Principal.compare, caller, isThumbsUp);
        if (isThumbsUp) {
          switch (Runtime.envVar("PUBLIC_CANISTER_ID:profiles")) {
            case (?profilesId) {
              let p : ProfilesActor = actor (profilesId);
              ignore await p.addLike(c.author);
            };
            case null {};
          };
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func deleteComment(commentId : Nat) : async Bool {
    switch (Map.get(comments, Nat.compare, commentId)) {
      case (?c) {
        if (not Principal.equal(c.author, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
        ignore Map.remove(comments, Nat.compare, commentId);
        true
      };
      case null { false };
    }
  };
};
