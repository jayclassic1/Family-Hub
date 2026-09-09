import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type FamilyEvent = Types.FamilyEvent;
  type FamilyEventPublic = Types.FamilyEventPublic;
  type EventKind = Types.EventKind;
  type Visibility = Types.Visibility;
  type RsvpResponse = Types.RsvpResponse;
  type RsvpEntry = Types.RsvpEntry;
  type EventComment = Types.EventComment;
  type EventCommentPublic = Types.EventCommentPublic;
  type ChatAttachment = Types.ChatAttachment;
  type EventPhoto = Types.EventPhoto;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type WalletActor = actor {
    earnLoveFor : shared (Principal, Nat) -> async Bool;
    transferLoveBetween : shared (Principal, Principal, Nat) -> async Bool;
  };

  type ProfilesActor = actor {
    addLike : shared (Principal) -> async Bool;
  };

  let events = Map.empty<Nat, FamilyEvent>();
  var eventCounter : Nat = 0;
  let birthdayEventIds = Map.empty<Principal, Nat>();
  let rsvpEnabledEventIds = Map.empty<Nat, Bool>();

  func toPublicEvent(e : FamilyEvent) : FamilyEventPublic {
    { e with allowRsvp = switch (Map.get(rsvpEnabledEventIds, Nat.compare, e.id)) { case (?true) { true }; case _ { false } } }
  };

  let rsvps = Map.empty<Nat, Map.Map<Principal, RsvpResponse>>();

  let comments = Map.empty<Nat, EventComment>();

  let eventCommentReactions = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let eventLoveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();
  let eventCommentLoveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  func myEventLoveGivenFor(eventId : Nat, caller : Principal) : Bool {
    switch (Map.get(eventLoveGiven, Nat.compare, eventId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func myEventCommentLoveGivenFor(commentId : Nat, caller : Principal) : Bool {
    switch (Map.get(eventCommentLoveGiven, Nat.compare, commentId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func eventCommentThumbsDownCount(commentId : Nat) : Nat {
    switch (Map.get(eventCommentReactions, Nat.compare, commentId)) {
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

  func myEventCommentReaction(commentId : Nat, caller : Principal) : ?Bool {
    switch (Map.get(eventCommentReactions, Nat.compare, commentId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  func toPublicEventComment(c : EventComment, caller : Principal) : EventCommentPublic {
    {
      id = c.id;
      eventId = c.eventId;
      author = c.author;
      authorName = c.authorName;
      text = c.text;
      timestamp = c.timestamp;
      thumbsDownCount = eventCommentThumbsDownCount(c.id);
      myReaction = myEventCommentReaction(c.id, caller);
      myLoveGiven = myEventCommentLoveGivenFor(c.id, caller);
    }
  };
  var commentCounter : Nat = 0;

  let photos = Map.empty<Nat, EventPhoto>();
  var photoCounter : Nat = 0;

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

  func canView(e : FamilyEvent, caller : Principal) : Bool {
    if (Principal.equal(e.creator, caller)) { return true };
    switch (e.visibility) {
      case (#everyone) { true };
      case (#selected(list)) {
        switch (Array.find<Principal>(list, func(p : Principal) : Bool { Principal.equal(p, caller) })) {
          case (?_) { true };
          case null { false };
        }
      };
    }
  };

  public shared ({ caller }) func createEvent(
    title : Text,
    description : Text,
    kind : EventKind,
    visibility : Visibility,
    coverPhoto : ?ChatAttachment,
    allowRsvp : Bool
  ) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let creatorName = await authUsername(caller);
    let id = eventCounter;
    let e : FamilyEvent = {
      id;
      creator = caller;
      creatorName;
      title;
      description;
      kind;
      visibility;
      coverPhoto;
      created = Time.now();
    };
    Map.add(events, Nat.compare, id, e);
    if (allowRsvp) {
      Map.add(rsvpEnabledEventIds, Nat.compare, id, true);
    };
    eventCounter += 1;
    id
  };

  // Called only by the auth canister when a member sets or updates their
  // birthday, so it can keep a recurring annual calendar event in sync.
  public shared ({ caller }) func setBirthdayEvent(owner : Principal, ownerName : Text, month : Nat, day : Nat) : async Bool {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:auth")) {
      case (?authId) {
        if (Principal.toText(caller) != authId) { return false };
      };
      case null { return false };
    };
    let kind : EventKind = #annual { month; day };
    let title = ownerName # "'s Birthday";
    switch (Map.get(birthdayEventIds, Principal.compare, owner)) {
      case (?existingId) {
        switch (Map.get(events, Nat.compare, existingId)) {
          case (?e) {
            let updated = { e with kind; title };
            Map.add(events, Nat.compare, existingId, updated);
          };
          case null {
            let id = eventCounter;
            let e : FamilyEvent = {
              id;
              creator = owner;
              creatorName = ownerName;
              title;
              description = "";
              kind;
              visibility = #everyone;
              coverPhoto = null;
              created = Time.now();
            };
            Map.add(events, Nat.compare, id, e);
            Map.add(birthdayEventIds, Principal.compare, owner, id);
            Map.add(rsvpEnabledEventIds, Nat.compare, id, true);
            eventCounter += 1;
          };
        };
      };
      case null {
        let id = eventCounter;
        let e : FamilyEvent = {
          id;
          creator = owner;
          creatorName = ownerName;
          title;
          description = "";
          kind;
          visibility = #everyone;
          coverPhoto = null;
          created = Time.now();
        };
        Map.add(events, Nat.compare, id, e);
        Map.add(birthdayEventIds, Principal.compare, owner, id);
        Map.add(rsvpEnabledEventIds, Nat.compare, id, true);
        eventCounter += 1;
      };
    };
    true
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

  public shared ({ caller }) func deleteEvent(eventId : Nat) : async Bool {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (not Principal.equal(e.creator, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
        ignore Map.remove(events, Nat.compare, eventId);
        ignore Map.remove(rsvps, Nat.compare, eventId);
        ignore Map.remove(rsvpEnabledEventIds, Nat.compare, eventId);
        let commentsToRemove = Array.filter<EventComment>(
          Array.fromIter<EventComment>(Map.values(comments)),
          func(c : EventComment) : Bool { c.eventId == eventId }
        );
        for (c in commentsToRemove.vals()) {
          ignore Map.remove(comments, Nat.compare, c.id);
        };
        let photosToRemove = Array.filter<EventPhoto>(
          Array.fromIter<EventPhoto>(Map.values(photos)),
          func(p : EventPhoto) : Bool { p.eventId == eventId }
        );
        for (p in photosToRemove.vals()) {
          ignore Map.remove(photos, Nat.compare, p.id);
        };
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func getVisibleEvents() : async [FamilyEventPublic] {
    let visible = Array.filter<FamilyEvent>(
      Array.fromIter<FamilyEvent>(Map.values(events)),
      func(e : FamilyEvent) : Bool { canView(e, caller) }
    );
    Array.map<FamilyEvent, FamilyEventPublic>(visible, toPublicEvent)
  };

  public query ({ caller }) func getEvent(eventId : Nat) : async ?FamilyEventPublic {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) { if (canView(e, caller)) { ?toPublicEvent(e) } else { null } };
      case null { null };
    }
  };

  public shared ({ caller }) func rsvp(eventId : Nat, response : RsvpResponse) : async Bool {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (not canView(e, caller)) { return false };
        let m = switch (Map.get(rsvps, Nat.compare, eventId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, RsvpResponse>();
            Map.add(rsvps, Nat.compare, eventId, m);
            m
          };
        };
        let previous = Map.get(m, Principal.compare, caller);
        let wasAlreadyYes = switch (previous) {
          case (?#yes) { true };
          case _ { false };
        };
        Map.add(m, Principal.compare, caller, response);
        let isNowYes = switch (response) {
          case (#yes) { true };
          case _ { false };
        };
        if (isNowYes and not wasAlreadyYes and not Principal.equal(caller, e.creator)) {
          switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
            case (?walletId) {
              let w : WalletActor = actor (walletId);
              ignore await w.earnLoveFor(e.creator, 1);
            };
            case null {};
          };
        };
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func getRsvps(eventId : Nat) : async [RsvpEntry] {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (not canView(e, caller)) { return [] };
        switch (Map.get(rsvps, Nat.compare, eventId)) {
          case (?m) {
            Array.map<Principal, RsvpEntry>(
              Array.fromIter<Principal>(Map.keys(m)),
              func(p : Principal) : RsvpEntry {
                let r = switch (Map.get(m, Principal.compare, p)) {
                  case (?r) { r };
                  case null { #no };
                };
                { user = p; response = r }
              }
            )
          };
          case null { [] };
        }
      };
      case null { [] };
    }
  };

  public query ({ caller }) func getMyRsvp(eventId : Nat) : async ?RsvpResponse {
    switch (Map.get(rsvps, Nat.compare, eventId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  public shared ({ caller }) func addEventComment(eventId : Nat, text : Text) : async Nat {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (not canView(e, caller)) {
          Runtime.trap("Cannot comment on an event you cannot see");
        };
      };
      case null {
        Runtime.trap("Event not found");
      };
    };
    let authorName = await authUsername(caller);
    let id = commentCounter;
    let c : EventComment = {
      id;
      eventId;
      author = caller;
      authorName;
      text;
      timestamp = Time.now();
    };
    Map.add(comments, Nat.compare, id, c);
    commentCounter += 1;
    id
  };

  public query ({ caller }) func getEventComments(eventId : Nat) : async [EventCommentPublic] {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (not canView(e, caller)) { return [] };
      };
      case null { return [] };
    };
    let mine = Array.filter<EventComment>(
      Array.fromIter<EventComment>(Map.values(comments)),
      func(c : EventComment) : Bool { c.eventId == eventId }
    );
    Array.map<EventComment, EventCommentPublic>(
      mine,
      func(c : EventComment) : EventCommentPublic { toPublicEventComment(c, caller) }
    )
  };

  public shared ({ caller }) func reactToEventComment(commentId : Nat, isThumbsUp : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(comments, Nat.compare, commentId)) {
      case (?c) {
        if (Principal.equal(c.author, caller)) { return false };
        let m = switch (Map.get(eventCommentReactions, Nat.compare, commentId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(eventCommentReactions, Nat.compare, commentId, m);
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

  public shared ({ caller }) func loveThisEvent(eventId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (Principal.equal(e.creator, caller)) { return false };
        if (myEventLoveGivenFor(eventId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, e.creator, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(eventLoveGiven, Nat.compare, eventId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(eventLoveGiven, Nat.compare, eventId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func getMyEventLoveGiven(eventId : Nat) : async Bool {
    myEventLoveGivenFor(eventId, caller)
  };

  public shared ({ caller }) func loveThisEventComment(commentId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(comments, Nat.compare, commentId)) {
      case (?c) {
        if (Principal.equal(c.author, caller)) { return false };
        if (myEventCommentLoveGivenFor(commentId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, c.author, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(eventCommentLoveGiven, Nat.compare, commentId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(eventCommentLoveGiven, Nat.compare, commentId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func deleteEventComment(commentId : Nat) : async Bool {
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

  public shared ({ caller }) func uploadEventPhoto(eventId : Nat, photo : ChatAttachment) : async Nat {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (not canView(e, caller)) {
          Runtime.trap("Cannot upload to an event you cannot see");
        };
      };
      case null {
        Runtime.trap("Event not found");
      };
    };
    let uploaderName = await authUsername(caller);
    let id = photoCounter;
    let p : EventPhoto = {
      id;
      eventId;
      uploader = caller;
      uploaderName;
      photo;
      timestamp = Time.now();
    };
    Map.add(photos, Nat.compare, id, p);
    photoCounter += 1;
    id
  };

  public query ({ caller }) func getEventPhotos(eventId : Nat) : async [EventPhoto] {
    switch (Map.get(events, Nat.compare, eventId)) {
      case (?e) {
        if (not canView(e, caller)) { return [] };
      };
      case null { return [] };
    };
    Array.filter<EventPhoto>(
      Array.fromIter<EventPhoto>(Map.values(photos)),
      func(p : EventPhoto) : Bool { p.eventId == eventId }
    )
  };
};
