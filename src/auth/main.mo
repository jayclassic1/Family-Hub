import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Types "../shared/Types";

persistent actor {

  type UserProfile = Types.UserProfile;
  type UserProfilePublic = Types.UserProfilePublic;

  type AccessStatus = {
    isBanned : Bool;
    blockedUntil : ?Int;
  };

  type UserAccessInfo = {
    user : Principal;
    username : Text;
    isBanned : Bool;
    blockedUntil : ?Int;
  };

  let users = Map.empty<Principal, UserProfile>();
  let banStates = Map.empty<Principal, AccessStatus>();
  var signupPassword : Text = "Blue16";

  func isAdmin(p : Principal) : Bool {
    switch (Map.get(users, Principal.compare, p)) {
      case (?prof) {
        switch (prof.role) {
          case (#admin) { true };
          case (#member) { false };
        }
      };
      case null { false };
    }
  };

  // Effective status: treats an expired block as cleared.
  func effectiveStatus(p : Principal) : AccessStatus {
    switch (Map.get(banStates, Principal.compare, p)) {
      case (?s) {
        let stillBlocked = switch (s.blockedUntil) {
          case (?t) { if (t > Time.now()) { ?t } else { null } };
          case null { null };
        };
        { isBanned = s.isBanned; blockedUntil = stillBlocked }
      };
      case null { { isBanned = false; blockedUntil = null } };
    }
  };

  public shared ({ caller }) func register(username : Text, password : Text) : async Bool {
    if (Principal.isAnonymous(caller)) {
      return false;
    };
    if (password != signupPassword) {
      return false;
    };

    switch (Map.get(users, Principal.compare, caller)) {
      case (?_existing) { false };
      case null {
        let profile : UserProfile = {
          id = caller;
          var username = username;
          var role = #member;
          var gender = "";
          var isInLaw = false;
          created = Time.now();
        };
        Map.add(users, Principal.compare, caller, profile);
        true
      };
    }
  };

  public shared ({ caller }) func claimAdminIfNoneExists() : async Bool {
    switch (Map.get(users, Principal.compare, caller)) {
      case (?profile) {
        let allUsers = Array.fromIter<UserProfile>(Map.values(users));
        let anyAdmin = Array.find<UserProfile>(
          allUsers,
          func(p : UserProfile) : Bool {
            switch (p.role) {
              case (#admin) { true };
              case (#member) { false };
            }
          }
        );
        switch (anyAdmin) {
          case (?_) { false };
          case null {
            profile.role := #admin;
            true
          };
        }
      };
      case null { false };
    }
  };

  public shared query func isValidUser(userId : Principal) : async Bool {
    switch (Map.get(users, Principal.compare, userId)) {
      case (?_) { true };
      case null { false };
    }
  };

  public shared query func getUser(userId : Principal) : async ?UserProfilePublic {
    switch (Map.get(users, Principal.compare, userId)) {
      case (?profile) {
        ?{
          id = profile.id;
          username = profile.username;
          role = profile.role;
          gender = profile.gender;
          isInLaw = profile.isInLaw;
          created = profile.created;
        }
      };
      case null { null };
    }
  };

  public shared ({ caller }) func setGender(gender : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(users, Principal.compare, caller)) {
      case (?profile) {
        profile.gender := gender;
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func setIsInLaw(value : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(users, Principal.compare, caller)) {
      case (?profile) {
        profile.isInLaw := value;
        true
      };
      case null { false };
    }
  };

  public query func getAllUsers() : async [UserProfilePublic] {
    Array.map<UserProfile, UserProfilePublic>(
      Array.fromIter<UserProfile>(Map.values(users)),
      func(p : UserProfile) : UserProfilePublic {
        { id = p.id; username = p.username; role = p.role; gender = p.gender; isInLaw = p.isInLaw; created = p.created }
      }
    )
  };

  public query ({ caller }) func getMyAccessStatus() : async AccessStatus {
    effectiveStatus(caller)
  };

  public shared ({ caller }) func adminSetSignupPassword(newPassword : Text) : async Bool {
    if (not isAdmin(caller)) { return false };
    if (newPassword == "") { return false };
    signupPassword := newPassword;
    true
  };

  public query ({ caller }) func adminGetSignupPassword() : async ?Text {
    if (not isAdmin(caller)) { return null };
    ?signupPassword
  };

  public shared ({ caller }) func adminBan(target : Principal) : async Bool {
    if (not isAdmin(caller)) { return false };
    if (Principal.equal(target, caller)) { return false };
    let current = effectiveStatus(target);
    Map.add(banStates, Principal.compare, target, { isBanned = true; blockedUntil = current.blockedUntil });
    true
  };

  public shared ({ caller }) func adminUnban(target : Principal) : async Bool {
    if (not isAdmin(caller)) { return false };
    let current = effectiveStatus(target);
    Map.add(banStates, Principal.compare, target, { isBanned = false; blockedUntil = current.blockedUntil });
    true
  };

  public shared ({ caller }) func adminBlock(target : Principal, hours : Nat) : async Bool {
    if (not isAdmin(caller)) { return false };
    if (Principal.equal(target, caller)) { return false };
    if (hours == 0) { return false };
    let until = Time.now() + hours * 3_600_000_000_000;
    let current = effectiveStatus(target);
    Map.add(banStates, Principal.compare, target, { isBanned = current.isBanned; blockedUntil = ?until });
    true
  };

  public shared ({ caller }) func adminUnblock(target : Principal) : async Bool {
    if (not isAdmin(caller)) { return false };
    let current = effectiveStatus(target);
    Map.add(banStates, Principal.compare, target, { isBanned = current.isBanned; blockedUntil = null });
    true
  };

  public query ({ caller }) func adminListAccessStatuses() : async [UserAccessInfo] {
    if (not isAdmin(caller)) { return [] };
    Array.map<UserProfile, UserAccessInfo>(
      Array.fromIter<UserProfile>(Map.values(users)),
      func(p : UserProfile) : UserAccessInfo {
        let s = effectiveStatus(p.id);
        {
          user = p.id;
          username = p.username;
          isBanned = s.isBanned;
          blockedUntil = s.blockedUntil;
        }
      }
    )
  };

  public shared ({ caller }) func adminDeleteUser(target : Principal) : async Bool {
    if (not isAdmin(caller)) { return false };
    if (Principal.equal(target, caller)) { return false };
    switch (Map.get(users, Principal.compare, target)) {
      case (?_) {
        ignore Map.remove(users, Principal.compare, target);
        ignore Map.remove(banStates, Principal.compare, target);
        true
      };
      case null { false };
    }
  };

  public query func isAdminUser(p : Principal) : async Bool {
    isAdmin(p)
  };
};
