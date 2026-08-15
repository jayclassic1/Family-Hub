import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type TreeEdge = Types.TreeEdge;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  let edges = Map.empty<Nat, TreeEdge>();
  var edgeCounter : Nat = 0;

  func requireAdmin(caller : Principal) : async () {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let authIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:auth");
    let authId = switch (authIdOpt) {
      case (?id) { id };
      case null { Runtime.trap("auth canister id not configured") };
    };
    let authCanister : AuthActor = actor (authId);
    let profile = await authCanister.getUser(caller);
    switch (profile) {
      case (?p) {
        switch (p.role) {
          case (#admin) {};
          case (#member) { Runtime.trap("Only an admin can edit the family tree") };
        };
      };
      case null { Runtime.trap("User not found") };
    };
  };

  public shared ({ caller }) func addParentChild(parentId : Principal, childId : Principal) : async Nat {
    await requireAdmin(caller);
    let id = edgeCounter;
    let edge : TreeEdge = { id; from = parentId; to = childId; relation = #parent };
    Map.add(edges, Nat.compare, id, edge);
    edgeCounter += 1;
    id
  };

  public shared ({ caller }) func addSpouse(personA : Principal, personB : Principal) : async Nat {
    await requireAdmin(caller);
    let id = edgeCounter;
    let edge : TreeEdge = { id; from = personA; to = personB; relation = #spouse };
    Map.add(edges, Nat.compare, id, edge);
    edgeCounter += 1;
    id
  };

  public shared ({ caller }) func removeEdge(edgeId : Nat) : async Bool {
    await requireAdmin(caller);
    switch (Map.get(edges, Nat.compare, edgeId)) {
      case (?_) {
        ignore Map.remove(edges, Nat.compare, edgeId);
        true
      };
      case null { false };
    }
  };

  public query func getAllEdges() : async [TreeEdge] {
    Array.fromIter<TreeEdge>(Map.values(edges))
  };
};
