import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Timer "mo:core/Timer";
import Types "../shared/Types";

persistent actor {

  type ChatMessage = Types.ChatMessage;
  type ChatMessagePublic = Types.ChatMessagePublic;
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
    spendLoveFor : shared (Principal, Nat) -> async Bool;
  };

  type ShopProfile = {
    lovedEffect : Text;
    sendEffect : Text;
  };

  type ShopActor = actor {
    getShopProfileFor : shared query (Principal) -> async ShopProfile;
  };

  type LoveEvent = {
    id : Nat;
    messageId : Nat;
    giver : Principal;
    receiver : Principal;
    lovedEffect : Text;
    sendEffect : Text;
    timestamp : Int;
  };

  let messages = Map.empty<Nat, ChatMessage>();

  // Attachments older than this are cleared to keep storage costs down;
  // the message text itself is kept, with a placeholder shown in its place.
  let THIRTY_DAYS_NS : Int = 30 * 24 * 60 * 60 * 1_000_000_000;
  let expiredImageIds = Map.empty<Nat, Bool>();

  func cleanupExpiredImages() : async () {
    let cutoff = Time.now() - THIRTY_DAYS_NS;
    let toExpire = Array.filter<ChatMessage>(
      Array.fromIter<ChatMessage>(Map.values(messages)),
      func(m : ChatMessage) : Bool { m.attachment != null and m.timestamp < cutoff }
    );
    for (m in toExpire.vals()) {
      let updated = { m with attachment = null };
      Map.add(messages, Nat.compare, m.id, updated);
      Map.add(expiredImageIds, Nat.compare, m.id, true);
    };
  };

  // Re-registered on every init/upgrade, since timer registrations do not
  // themselves persist in stable memory -- this runs once a day.
  ignore Timer.recurringTimer<system>(#seconds(86400), cleanupExpiredImages);
  var messageCounter : Nat = 0;

  let reactions = Map.empty<Nat, Map.Map<Principal, Bool>>();
  let loveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let loveEvents = Map.empty<Nat, LoveEvent>();
  var loveEventCounter : Nat = 0;

  func pruneLoveEvents() {
    if (loveEventCounter > 50) {
      let cutoff : Nat = loveEventCounter - 50;
      let toRemove = Array.filter<Nat>(
        Array.fromIter<Nat>(Map.keys(loveEvents)),
        func(id : Nat) : Bool { id < cutoff }
      );
      for (id in toRemove.vals()) {
        Map.remove(loveEvents, Nat.compare, id);
      };
    };
  };

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

  func thumbsUpCount(messageId : Nat) : Nat {
    switch (Map.get(reactions, Nat.compare, messageId)) {
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

  func loveCount(messageId : Nat) : Nat {
    switch (Map.get(loveGiven, Nat.compare, messageId)) {
      case (?m) { Map.size(m) };
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

  func toPublic(m : ChatMessage, caller : Principal) : ChatMessagePublic {
    {
      id = m.id;
      sender = m.sender;
      senderName = m.senderName;
      text = m.text;
      attachment = m.attachment;
      timestamp = m.timestamp;
      thumbsDownCount = thumbsDownCount(m.id);
      thumbsUpCount = thumbsUpCount(m.id);
      loveCount = loveCount(m.id);
      myReaction = myReaction(m.id, caller);
      myLoveGiven = myLoveGivenFor(m.id, caller);
      shareType = m.shareType;
      shareTitle = m.shareTitle;
      shareLink = m.shareLink;
      animated = m.animated;
      isBanner = m.isBanner;
      isPinned = m.isPinned;
      imageExpired = Map.get(expiredImageIds, Nat.compare, m.id) != null;
    }
  };

  public shared ({ caller }) func sendMessage(text : Text, attachment : ?ChatAttachment, isBanner : Bool, isPinned : Bool) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Anonymous callers cannot send messages");
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

    var actualBanner = false;
    if (isBanner) {
      switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
        case (?id) {
          let w : WalletActor = actor (id);
          actualBanner := await w.spendLoveFor(caller, 1);
        };
        case null {};
      };
    };

    var actualPinned = false;
    if (isPinned) {
      switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
        case (?id) {
          let w : WalletActor = actor (id);
          actualPinned := await w.spendLoveFor(caller, 2);
        };
        case null {};
      };
    };

    let id = messageCounter;
    let message : ChatMessage = {
      id;
      sender = caller;
      senderName;
      text;
      attachment;
      timestamp = Time.now();
      shareType = null;
      shareTitle = null;
      shareLink = null;
      animated = false;
      isBanner = actualBanner;
      isPinned = actualPinned;
    };
    Map.add(messages, Nat.compare, id, message);
    messageCounter += 1;
    id
  };

  public shared ({ caller }) func unpinMessage(messageId : Nat) : async Bool {
    switch (Map.get(messages, Nat.compare, messageId)) {
      case (?m) {
        if (not Principal.equal(m.sender, caller)) { return false };
        let updated : ChatMessage = { m with isPinned = false };
        Map.add(messages, Nat.compare, messageId, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func sendShareMessage(shareType : Text, shareTitle : Text, shareLink : Text, animated : Bool) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Anonymous callers cannot send messages");
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

    var actualAnimated = false;
    if (animated) {
      switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
        case (?id) {
          let w : WalletActor = actor (id);
          actualAnimated := await w.spendLoveFor(caller, 1);
        };
        case null {};
      };
    };

    let id = messageCounter;
    let message : ChatMessage = {
      id;
      sender = caller;
      senderName;
      text = "";
      attachment = null;
      timestamp = Time.now();
      shareType = ?shareType;
      shareTitle = ?shareTitle;
      shareLink = ?shareLink;
      animated = actualAnimated;
      isBanner = false;
      isPinned = false;
    };
    Map.add(messages, Nat.compare, id, message);
    messageCounter += 1;
    id
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

  public shared ({ caller }) func deleteMessage(messageId : Nat) : async Bool {
    switch (Map.get(messages, Nat.compare, messageId)) {
      case (?m) {
        if (not Principal.equal(m.sender, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
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
        switch (Runtime.envVar("PUBLIC_CANISTER_ID:shop")) {
          case (?shopId) {
            let shopActor : ShopActor = actor (shopId);
            let receiverProfile = await shopActor.getShopProfileFor(m.sender);
            let giverProfile = await shopActor.getShopProfileFor(caller);
            let event : LoveEvent = {
              id = loveEventCounter;
              messageId = messageId;
              giver = caller;
              receiver = m.sender;
              lovedEffect = receiverProfile.lovedEffect;
              sendEffect = giverProfile.sendEffect;
              timestamp = Time.now();
            };
            Map.add(loveEvents, Nat.compare, loveEventCounter, event);
            loveEventCounter += 1;
            pruneLoveEvents();
          };
          case null {};
        };
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func getMessages() : async [ChatMessagePublic] {
    Array.map<ChatMessage, ChatMessagePublic>(
      Array.fromIter<ChatMessage>(Map.values(messages)),
      func(m : ChatMessage) : ChatMessagePublic { toPublic(m, caller) }
    )
  };

  public query ({ caller }) func getMessagesSince(afterId : Nat) : async [ChatMessagePublic] {
    let mine = Array.filter<ChatMessage>(
      Array.fromIter<ChatMessage>(Map.values(messages)),
      func(m : ChatMessage) : Bool { m.id >= afterId }
    );
    Array.map<ChatMessage, ChatMessagePublic>(
      mine,
      func(m : ChatMessage) : ChatMessagePublic { toPublic(m, caller) }
    )
  };

  public query ({ caller }) func getPinnedMessages() : async [ChatMessagePublic] {
    let pinned = Array.filter<ChatMessage>(
      Array.fromIter<ChatMessage>(Map.values(messages)),
      func(m : ChatMessage) : Bool { m.isPinned }
    );
    Array.map<ChatMessage, ChatMessagePublic>(
      pinned,
      func(m : ChatMessage) : ChatMessagePublic { toPublic(m, caller) }
    )
  };

  public query func getLoveEventsSince(afterId : Nat) : async [LoveEvent] {
    Array.filter<LoveEvent>(
      Array.fromIter<LoveEvent>(Map.values(loveEvents)),
      func(e : LoveEvent) : Bool { e.id >= afterId }
    )
  };
};
