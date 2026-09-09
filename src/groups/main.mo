import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Timer "mo:core/Timer";
import Types "../shared/Types";

persistent actor {

  type Group = Types.Group;
  type GroupMessage = Types.GroupMessage;
  type GroupMessagePublic = Types.GroupMessagePublic;
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

  type GroupLoveEvent = {
    id : Nat;
    groupId : Nat;
    messageId : Nat;
    giver : Principal;
    receiver : Principal;
    lovedEffect : Text;
    sendEffect : Text;
    timestamp : Int;
  };

  let groups = Map.empty<Nat, Group>();
  var groupCounter : Nat = 0;

  let members = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let messages = Map.empty<Nat, GroupMessage>();
  let bannerMessageIds = Map.empty<Nat, Bool>();

  // Attachments older than this are cleared to keep storage costs down;
  // the message text itself is kept, with a placeholder shown in its place.
  let THIRTY_DAYS_NS : Int = 30 * 24 * 60 * 60 * 1_000_000_000;
  let expiredImageIds = Map.empty<Nat, Bool>();

  func cleanupExpiredImages() : async () {
    let cutoff = Time.now() - THIRTY_DAYS_NS;
    let toExpire = Array.filter<GroupMessage>(
      Array.fromIter<GroupMessage>(Map.values(messages)),
      func(m : GroupMessage) : Bool { m.attachment != null and m.timestamp < cutoff }
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

  let reactions = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let loveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let groupLoveEvents = Map.empty<Nat, GroupLoveEvent>();
  var groupLoveEventCounter : Nat = 0;

  func pruneGroupLoveEvents() {
    if (groupLoveEventCounter > 50) {
      let cutoff : Nat = groupLoveEventCounter - 50;
      let toRemove = Array.filter<Nat>(
        Array.fromIter<Nat>(Map.keys(groupLoveEvents)),
        func(id : Nat) : Bool { id < cutoff }
      );
      for (id in toRemove.vals()) {
        Map.remove(groupLoveEvents, Nat.compare, id);
      };
    };
  };

  func myLoveGivenFor(messageId : Nat, caller : Principal) : Bool {
    switch (Map.get(loveGiven, Nat.compare, messageId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
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

  func myReaction(messageId : Nat, caller : Principal) : ?Bool {
    switch (Map.get(reactions, Nat.compare, messageId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  func toPublic(m : GroupMessage, caller : Principal) : GroupMessagePublic {
    {
      id = m.id;
      groupId = m.groupId;
      sender = m.sender;
      senderName = m.senderName;
      text = m.text;
      attachment = m.attachment;
      timestamp = m.timestamp;
      thumbsDownCount = thumbsDownCount(m.id);
      myReaction = myReaction(m.id, caller);
      myLoveGiven = myLoveGivenFor(m.id, caller);
      isBanner = switch (Map.get(bannerMessageIds, Nat.compare, m.id)) { case (?b) { b }; case null { false } };
      imageExpired = Map.get(expiredImageIds, Nat.compare, m.id) != null;
    }
  };
  var messageCounter : Nat = 0;

  func getOrCreateMembers(groupId : Nat) : Map.Map<Principal, Bool> {
    switch (Map.get(members, Nat.compare, groupId)) {
      case (?m) { m };
      case null {
        let m = Map.empty<Principal, Bool>();
        Map.add(members, Nat.compare, groupId, m);
        m
      };
    }
  };

  func isMember(groupId : Nat, p : Principal) : Bool {
    switch (Map.get(members, Nat.compare, groupId)) {
      case (?m) { Map.get(m, Principal.compare, p) != null };
      case null { false };
    }
  };

  public shared ({ caller }) func createGroup(name : Text, description : Text, isPublic : Bool) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let id = groupCounter;
    let g : Group = { id; name; description; creator = caller; isPublic; created = Time.now(); restrictedKey = null };
    Map.add(groups, Nat.compare, id, g);
    let m = getOrCreateMembers(id);
    Map.add(m, Principal.compare, caller, true);
    groupCounter += 1;
    id
  };

  var defaultGroupsSeeded : Bool = false;

  func fetchEligibilityInfo(caller : Principal) : async (Text, Bool) {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:auth")) {
      case (?id) {
        let a : AuthActor = actor (id);
        switch (await a.getUser(caller)) {
          case (?profile) { (profile.gender, profile.isInLaw) };
          case null { ("", false) };
        };
      };
      case null { ("", false) };
    }
  };

  func isEligible(restrictedKey : ?Text, gender : Text, isInLaw : Bool) : Bool {
    switch (restrictedKey) {
      case (?"men") { gender == "male" };
      case (?"women") { gender == "female" };
      case (?"inlaws") { isInLaw };
      case (?_) { false };
      case null { true };
    }
  };

  public shared ({ caller }) func seedDefaultGroups() : async Bool {
    if (defaultGroupsSeeded) { return false };
    defaultGroupsSeeded := true;
    let menId = groupCounter;
    Map.add(
      groups,
      Nat.compare,
      menId,
      { id = menId; name = "Men"; description = "For the men of the family."; creator = caller; isPublic = false; created = Time.now(); restrictedKey = ?"men" },
    );
    groupCounter += 1;
    let womenId = groupCounter;
    Map.add(
      groups,
      Nat.compare,
      womenId,
      { id = womenId; name = "Women"; description = "For the women of the family."; creator = caller; isPublic = false; created = Time.now(); restrictedKey = ?"women" },
    );
    groupCounter += 1;
    let inLawsId = groupCounter;
    Map.add(
      groups,
      Nat.compare,
      inLawsId,
      { id = inLawsId; name = "In-Laws"; description = "For the in-laws of the family."; creator = caller; isPublic = false; created = Time.now(); restrictedKey = ?"inlaws" },
    );
    groupCounter += 1;
    true
  };

  public shared ({ caller }) func joinGroup(groupId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(groups, Nat.compare, groupId)) {
      case (?g) {
        if (not g.isPublic) { return false };
        let m = getOrCreateMembers(groupId);
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func loveThisGroupMessage(messageId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(messages, Nat.compare, messageId)) {
      case (?m) {
        if (Principal.equal(m.sender, caller)) { return false };
        if (not isMember(m.groupId, caller)) { return false };
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
            let event : GroupLoveEvent = {
              id = groupLoveEventCounter;
              groupId = m.groupId;
              messageId = messageId;
              giver = caller;
              receiver = m.sender;
              lovedEffect = receiverProfile.lovedEffect;
              sendEffect = giverProfile.sendEffect;
              timestamp = Time.now();
            };
            Map.add(groupLoveEvents, Nat.compare, groupLoveEventCounter, event);
            groupLoveEventCounter += 1;
            pruneGroupLoveEvents();
          };
          case null {};
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func inviteToGroup(groupId : Nat, userId : Principal) : async Bool {
    if (not isMember(groupId, caller)) { return false };
    switch (Map.get(groups, Nat.compare, groupId)) {
      case (?_) {
        let m = getOrCreateMembers(groupId);
        Map.add(m, Principal.compare, userId, true);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func leaveGroup(groupId : Nat) : async Bool {
    switch (Map.get(members, Nat.compare, groupId)) {
      case (?m) {
        ignore Map.remove(m, Principal.compare, caller);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func listGroups() : async [Group] {
    let (gender, isInLaw) = await fetchEligibilityInfo(caller);
    Array.filter<Group>(
      Array.fromIter<Group>(Map.values(groups)),
      func(g : Group) : Bool { isEligible(g.restrictedKey, gender, isInLaw) }
    )
  };

  public shared ({ caller }) func getMyGroups() : async [Group] {
    let (gender, isInLaw) = await fetchEligibilityInfo(caller);
    let all = Array.fromIter<Group>(Map.values(groups));
    for (g in all.vals()) {
      if (g.restrictedKey != null and isEligible(g.restrictedKey, gender, isInLaw) and not isMember(g.id, caller)) {
        let m = getOrCreateMembers(g.id);
        Map.add(m, Principal.compare, caller, true);
      };
    };
    Array.filter<Group>(
      all,
      func(g : Group) : Bool { isMember(g.id, caller) }
    )
  };

  public query ({ caller }) func getGroupMembers(groupId : Nat) : async [Principal] {
    if (not isMember(groupId, caller)) { return [] };
    switch (Map.get(members, Nat.compare, groupId)) {
      case (?m) { Array.fromIter<Principal>(Map.keys(m)) };
      case null { [] };
    }
  };

  public shared ({ caller }) func sendGroupMessage(groupId : Nat, text : Text, attachment : ?ChatAttachment, isBanner : Bool) : async Nat {
    if (not isMember(groupId, caller)) {
      Runtime.trap("Not a member of this group");
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
        case (?walletId) {
          let w : WalletActor = actor (walletId);
          actualBanner := await w.spendLoveFor(caller, 1);
        };
        case null {};
      };
    };

    let id = messageCounter;
    let message : GroupMessage = {
      id;
      groupId;
      sender = caller;
      senderName;
      text;
      attachment;
      timestamp = Time.now();
    };
    Map.add(messages, Nat.compare, id, message);
    if (actualBanner) {
      Map.add(bannerMessageIds, Nat.compare, id, true);
    };
    messageCounter += 1;
    id
  };

  public query ({ caller }) func getGroupMessages(groupId : Nat) : async [GroupMessagePublic] {
    if (not isMember(groupId, caller)) { return [] };
    let mine = Array.filter<GroupMessage>(
      Array.fromIter<GroupMessage>(Map.values(messages)),
      func(m : GroupMessage) : Bool { m.groupId == groupId }
    );
    Array.map<GroupMessage, GroupMessagePublic>(
      mine,
      func(m : GroupMessage) : GroupMessagePublic { toPublic(m, caller) }
    )
  };

  public shared ({ caller }) func reactToGroupMessage(messageId : Nat, isThumbsUp : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(messages, Nat.compare, messageId)) {
      case (?m) {
        if (Principal.equal(m.sender, caller)) { return false };
        if (not isMember(m.groupId, caller)) { return false };
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

  public shared ({ caller }) func deleteGroupMessage(messageId : Nat) : async Bool {
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

  public query func getGroupLoveEventsSince(groupId : Nat, afterId : Nat) : async [GroupLoveEvent] {
    Array.filter<GroupLoveEvent>(
      Array.fromIter<GroupLoveEvent>(Map.values(groupLoveEvents)),
      func(e : GroupLoveEvent) : Bool { e.id >= afterId and e.groupId == groupId }
    )
  };
};
