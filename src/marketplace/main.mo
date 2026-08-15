import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

persistent actor {

  let MAX_PHOTOS = 6;

  type ChatAttachment = { filename : Text; contentType : Text; data : [Nat8] };
  type UserProfilePublic = { username : Text; role : { #admin; #member } };

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type WalletActor = actor {
    spendLoveFor : shared (Principal, Nat) -> async Bool;
    earnLoveFor : shared (Principal, Nat) -> async Bool;
  };

  type ListingStatus = { #active; #sold; #cancelled };

  type Bid = {
    bidder : Principal;
    bidderName : Text;
    amount : Nat;
    timestamp : Int;
  };

  type Listing = {
    id : Nat;
    seller : Principal;
    sellerName : Text;
    title : Text;
    description : Text;
    photos : [ChatAttachment];
    lovePrice : ?Nat;
    offsiteNote : Text;
    bids : [Bid];
    status : ListingStatus;
    created : Int;
  };

  type ListingSummary = {
    id : Nat;
    seller : Principal;
    sellerName : Text;
    title : Text;
    description : Text;
    photoCount : Nat;
    lovePrice : ?Nat;
    offsiteNote : Text;
    bids : [Bid];
    status : ListingStatus;
    created : Int;
  };

  let listings = Map.empty<Nat, Listing>();
  var listingCounter : Nat = 0;

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

  func toSummary(l : Listing) : ListingSummary {
    {
      id = l.id;
      seller = l.seller;
      sellerName = l.sellerName;
      title = l.title;
      description = l.description;
      photoCount = l.photos.size();
      lovePrice = l.lovePrice;
      offsiteNote = l.offsiteNote;
      bids = l.bids;
      status = l.status;
      created = l.created;
    }
  };

  public shared ({ caller }) func createListing(
    title : Text,
    description : Text,
    lovePrice : ?Nat,
    offsiteNote : Text
  ) : async Nat {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Not signed in") };
    let sellerName = await authUsername(caller);
    let id = listingCounter;
    let l : Listing = {
      id;
      seller = caller;
      sellerName;
      title;
      description;
      photos = [];
      lovePrice;
      offsiteNote;
      bids = [];
      status = #active;
      created = Time.now();
    };
    Map.add(listings, Nat.compare, id, l);
    listingCounter += 1;
    id
  };

  public shared ({ caller }) func addListingPhoto(listingId : Nat, photo : ChatAttachment) : async Bool {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (not Principal.equal(l.seller, caller)) { return false };
        if (l.photos.size() >= MAX_PHOTOS) { return false };
        let updated = { l with photos = Array.concat<ChatAttachment>(l.photos, [photo]) };
        Map.add(listings, Nat.compare, listingId, updated);
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

  public shared ({ caller }) func removeListingPhoto(listingId : Nat, index : Nat) : async Bool {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (not Principal.equal(l.seller, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
        if (index >= l.photos.size()) { return false };
        let filtered = Array.tabulate<ChatAttachment>(
          l.photos.size() - 1,
          func(i : Nat) : ChatAttachment {
            if (i < index) { l.photos[i] } else { l.photos[i + 1] };
          },
        );
        Map.add(listings, Nat.compare, listingId, { l with photos = filtered });
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func deleteListing(listingId : Nat) : async Bool {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (not Principal.equal(l.seller, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
        ignore Map.remove(listings, Nat.compare, listingId);
        true
      };
      case null { false };
    }
  };

  public query func listListings() : async [ListingSummary] {
    let all = Array.fromIter<Listing>(Map.values(listings));
    Array.map<Listing, ListingSummary>(all, toSummary)
  };

  public query func getListing(listingId : Nat) : async ?ListingSummary {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) { ?toSummary(l) };
      case null { null };
    }
  };

  public query func getListingPhoto(listingId : Nat, index : Nat) : async ?ChatAttachment {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (index >= l.photos.size()) { null } else { ?l.photos[index] };
      };
      case null { null };
    }
  };

  public shared ({ caller }) func buyNow(listingId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (l.status != #active) { return false };
        if (Principal.equal(l.seller, caller)) { return false };
        let price = switch (l.lovePrice) {
          case (?p) { p };
          case null { return false };
        };
        switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
          case (?walletId) {
            let w : WalletActor = actor (walletId);
            let paid = await w.spendLoveFor(caller, price);
            if (not paid) { return false };
            ignore await w.earnLoveFor(l.seller, price);
            Map.add(listings, Nat.compare, listingId, { l with status = #sold });
            true
          };
          case null { false };
        }
      };
      case null { false };
    }
  };

  public shared ({ caller }) func placeBid(listingId : Nat, amount : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (amount == 0) { return false };
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (l.status != #active) { return false };
        if (Principal.equal(l.seller, caller)) { return false };
        let bidderName = await authUsername(caller);
        let newBid : Bid = { bidder = caller; bidderName; amount; timestamp = Time.now() };
        let updated = { l with bids = Array.concat<Bid>(l.bids, [newBid]) };
        Map.add(listings, Nat.compare, listingId, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func acceptBid(listingId : Nat, bidder : Principal) : async Bool {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (not Principal.equal(l.seller, caller)) { return false };
        if (l.status != #active) { return false };
        var amount : ?Nat = null;
        for (b in l.bids.vals()) {
          if (Principal.equal(b.bidder, bidder)) { amount := ?b.amount };
        };
        let bidAmount = switch (amount) {
          case (?a) { a };
          case null { return false };
        };
        switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
          case (?walletId) {
            let w : WalletActor = actor (walletId);
            let paid = await w.spendLoveFor(bidder, bidAmount);
            if (not paid) { return false };
            ignore await w.earnLoveFor(l.seller, bidAmount);
            Map.add(listings, Nat.compare, listingId, { l with status = #sold });
            true
          };
          case null { false };
        }
      };
      case null { false };
    }
  };

  public shared ({ caller }) func markSold(listingId : Nat) : async Bool {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (not Principal.equal(l.seller, caller)) { return false };
        if (l.status != #active) { return false };
        Map.add(listings, Nat.compare, listingId, { l with status = #sold });
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func cancelListing(listingId : Nat) : async Bool {
    switch (Map.get(listings, Nat.compare, listingId)) {
      case (?l) {
        if (not Principal.equal(l.seller, caller)) { return false };
        if (l.status != #active) { return false };
        Map.add(listings, Nat.compare, listingId, { l with status = #cancelled });
        true
      };
      case null { false };
    }
  };
};
