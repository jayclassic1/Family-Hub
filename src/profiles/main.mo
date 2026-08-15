import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type ProfileDetails = Types.ProfileDetails;
  type ChatAttachment = Types.ChatAttachment;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
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

  let MAX_PHOTOS = 10;

  let details = Map.empty<Principal, ProfileDetails>();

  func emptyDetails(owner : Principal) : ProfileDetails {
    {
      owner;
      address = null;
      postalCode = null;
      telephone = null;
      whatsapp = null;
      email = null;
      description = null;
      photos = [];
      totalLikes = 0;
    }
  };

  func getOrEmpty(owner : Principal) : ProfileDetails {
    switch (Map.get(details, Principal.compare, owner)) {
      case (?d) { d };
      case null { emptyDetails(owner) };
    }
  };

  // Treat empty-string input as "not set" so the UI can omit the field
  // entirely rather than showing a blank value.
  func normalize(t : ?Text) : ?Text {
    switch (t) {
      case (?s) { if (s == "") { null } else { ?s } };
      case null { null };
    }
  };

  public shared ({ caller }) func updateProfileDetails(
    address : ?Text,
    postalCode : ?Text,
    telephone : ?Text,
    whatsapp : ?Text,
    email : ?Text,
    description : ?Text
  ) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let existing = getOrEmpty(caller);
    let updated : ProfileDetails = {
      existing with
      address = normalize(address);
      postalCode = normalize(postalCode);
      telephone = normalize(telephone);
      whatsapp = normalize(whatsapp);
      email = normalize(email);
      description = normalize(description);
    };
    Map.add(details, Principal.compare, caller, updated);
    true
  };

  public shared ({ caller }) func addPhoto(photo : ChatAttachment) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let existing = getOrEmpty(caller);
    if (existing.photos.size() >= MAX_PHOTOS) { return false };
    let updated : ProfileDetails = {
      existing with photos = Array.concat<ChatAttachment>(existing.photos, [photo])
    };
    Map.add(details, Principal.compare, caller, updated);
    true
  };

  public shared ({ caller }) func removePhoto(index : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let existing = getOrEmpty(caller);
    if (index >= existing.photos.size()) { return false };
    let filtered = Array.tabulate<ChatAttachment>(
      existing.photos.size() - 1,
      func(i : Nat) : ChatAttachment {
        if (i < index) { existing.photos[i] } else { existing.photos[i + 1] }
      }
    );
    let updated : ProfileDetails = { existing with photos = filtered };
    Map.add(details, Principal.compare, caller, updated);
    true
  };

  public shared ({ caller }) func adminRemovePhoto(target : Principal, index : Nat) : async Bool {
    if (not (await isCallerAdmin(caller))) { return false };
    let existing = getOrEmpty(target);
    if (index >= existing.photos.size()) { return false };
    let filtered = Array.tabulate<ChatAttachment>(
      existing.photos.size() - 1,
      func(i : Nat) : ChatAttachment {
        if (i < index) { existing.photos[i] } else { existing.photos[i + 1] }
      }
    );
    let updated : ProfileDetails = { existing with photos = filtered };
    Map.add(details, Principal.compare, target, updated);
    true
  };

  // Called after a legitimate like action elsewhere in the app (e.g. a
  // photo thumbs-up) to bump the target's public "likes received" count.
  public shared ({ caller }) func addLike(target : Principal) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (Principal.equal(caller, target)) { return false };
    let existing = getOrEmpty(target);
    let updated : ProfileDetails = { existing with totalLikes = existing.totalLikes + 1 };
    Map.add(details, Principal.compare, target, updated);
    true
  };

  public query func getProfileDetails(owner : Principal) : async ProfileDetails {
    getOrEmpty(owner)
  };
};
