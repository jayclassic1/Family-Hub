import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type DmMessage = Types.DmMessage;
  type DmMessagePublic = Types.DmMessagePublic;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type ProfilesActor = actor {
    addLike : shared (Principal) -> async Bool;
  };

  type WalletActor = actor {
    transferLoveBetween : shared (Principal, Principal, Nat) -> async Bool;
  };

  let messages = Map.empty<Nat, DmMessage>();
  var messageCounter : Nat = 0;

  // Per-viewer, last time they opened each conversation (keyed by the other person).
  let lastRead = Map.empty<Principal, Map.Map<Principal, Int>>();

  let reactions = Map.empty<Nat, Map.Map<Principal, Bool>>();
  let loveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  func thumbsDownCount(messageId : Nat) : Nat {
    switch (Map.get(reactions, Nat.compare, messageId)) {
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

  func myReaction(messageId : Nat, caller : Principal) : ?Bool {
    switch (Map.get(reactions, Nat.compare, messageId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  func myLoveGivenFor(messageId : Nat, caller : Principal) : Bool {
    switch (Map.get(loveGiven, Nat.compare, messageId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func toPublic(m : DmMessage, caller : Principal) : DmMessagePublic {
    {
      id = m.id;
      sender = m.sender;
      senderName = m.senderName;
      recipient = m.recipient;
      text = m.text;
      attachment = m.attachment;
      timestamp = m.timestamp;
      thumbsDownCount = thumbsDownCount(m.id);
      myReaction = myReaction(m.id, caller);
      myLoveGiven = myLoveGivenFor(m.id, caller);
    }
  };

  public shared ({ caller }) func sendDirectMessage(to : Principal, text : Text, attachment : ?ChatAttachment) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Anonymous callers cannot send messages");
    };
    if (Principal.equal(caller, to)) {
      Runtime.trap("Cannot message yourself");
    };

    let authIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:auth");
    let authId = switch (authIdOpt) {
      case (?id) { id };
      case null { Runtime.trap("auth canister id not configured") };
    };
    let authCanister : AuthActor = actor (authId);
    let profile = await authCanister.getUser(caller);
    let senderName = switch (profile) {
      case (?p) { p.username };
      case null { "Unknown" };
    };

    let id = messageCounter;
    let message : DmMessage = {
      id;
      sender = caller;
      senderName;
      recipient = to;
      text;
      attachment;
      timestamp = Time.now();
    };
    Map.add(messages, Nat.compare, id, message);
    messageCounter += 1;
    id
  };

  public query ({ caller }) func getConversation(withUser : Principal) : async [DmMessagePublic] {
    let mine = Array.filter<DmMessage>(
      Array.fromIter<DmMessage>(Map.values(messages)),
      func(m : DmMessage) : Bool {
        (Principal.equal(m.sender, caller) and Principal.equal(m.recipient, withUser)) or
        (Principal.equal(m.sender, withUser) and Principal.equal(m.recipient, caller))
      }
    );
    Array.map<DmMessage, DmMessagePublic>(
      mine,
      func(m : DmMessage) : DmMessagePublic { toPublic(m, caller) }
    )
  };

  public type ConversationSummary = {
    otherUser : Principal;
    lastMessage : DmMessage;
    hasUnread : Bool;
  };

  public query ({ caller }) func listConversations() : async [ConversationSummary] {
    if (Principal.isAnonymous(caller)) { return [] };
    let allMessages = Array.fromIter<DmMessage>(Map.values(messages));
    let latest = Map.empty<Principal, DmMessage>();
    for (m in allMessages.vals()) {
      let otherParty = if (Principal.equal(m.sender, caller)) { ?m.recipient }
        else if (Principal.equal(m.recipient, caller)) { ?m.sender }
        else { null };
      switch (otherParty) {
        case (?other) {
          switch (Map.get(latest, Principal.compare, other)) {
            case (?existing) {
              if (m.timestamp > existing.timestamp) {
                Map.add(latest, Principal.compare, other, m);
              };
            };
            case null {
              Map.add(latest, Principal.compare, other, m);
            };
          };
        };
        case null {};
      };
    };
    let mine = switch (Map.get(lastRead, Principal.compare, caller)) {
      case (?m) { m };
      case null { Map.empty<Principal, Int>() };
    };
    let otherParties = Array.fromIter<Principal>(Map.keys(latest));
    Array.map<Principal, ConversationSummary>(
      otherParties,
      func(other : Principal) : ConversationSummary {
        let last = switch (Map.get(latest, Principal.compare, other)) {
          case (?m) { m };
          case null { Runtime.trap("unreachable: missing conversation entry") };
        };
        let threshold = switch (Map.get(mine, Principal.compare, other)) {
          case (?t) { t };
          case null { 0 };
        };
        let unread = Principal.equal(last.sender, other) and last.timestamp > threshold;
        { otherUser = other; lastMessage = last; hasUnread = unread };
      }
    )
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

  public shared ({ caller }) func deleteDirectMessage(messageId : Nat) : async Bool {
    switch (Map.get(messages, Nat.compare, messageId)) {
      case (?m) {
        if (not Principal.equal(m.sender, caller)) { return false };
        ignore Map.remove(messages, Nat.compare, messageId);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func reactToMessage(messageId : Nat, isThumbsUp : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(messages, Nat.compare, messageId)) {
      case (?m) {
        if (Principal.equal(m.sender, caller)) { return false };
        let r = switch (Map.get(reactions, Nat.compare, messageId)) {
          case (?r) { r };
          case null {
            let r = Map.empty<Principal, Bool>();
            Map.add(reactions, Nat.compare, messageId, r);
            r
          };
        };
        if (Map.get(r, Principal.compare, caller) != null) { return false };
        Map.add(r, Principal.compare, caller, isThumbsUp);
        if (isThumbsUp) {
          switch (Runtime.envVar("PUBLIC_CANISTER_ID:profiles")) {
            case (?profilesId) {
              let p : ProfilesActor = actor (profilesId);
              ignore await p.addLike(m.sender);
            };
            case null {};
          };
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func loveThisMessage(messageId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(messages, Nat.compare, messageId)) {
      case (?m) {
        if (Principal.equal(m.sender, caller)) { return false };
        if (myLoveGivenFor(messageId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, m.sender, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let l = switch (Map.get(loveGiven, Nat.compare, messageId)) {
          case (?l) { l };
          case null {
            let l = Map.empty<Principal, Bool>();
            Map.add(loveGiven, Nat.compare, messageId, l);
            l
          };
        };
        Map.add(l, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func markRead(otherUser : Principal) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let mine = switch (Map.get(lastRead, Principal.compare, caller)) {
      case (?m) { m };
      case null {
        let m = Map.empty<Principal, Int>();
        Map.add(lastRead, Principal.compare, caller, m);
        m
      };
    };
    Map.add(mine, Principal.compare, otherUser, Time.now());
    true
  };

  public query ({ caller }) func hasUnread() : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let mine = switch (Map.get(lastRead, Principal.compare, caller)) {
      case (?m) { m };
      case null { Map.empty<Principal, Int>() };
    };
    let allMessages = Array.fromIter<DmMessage>(Map.values(messages));
    for (m in allMessages.vals()) {
      if (Principal.equal(m.recipient, caller)) {
        let threshold = switch (Map.get(mine, Principal.compare, m.sender)) {
          case (?t) { t };
          case null { 0 };
        };
        if (m.timestamp > threshold) {
          return true;
        };
      };
    };
    false
  };
};
