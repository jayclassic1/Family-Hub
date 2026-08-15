import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type Album = Types.Album;
  type ChatAttachment = Types.ChatAttachment;
  type AlbumPhotoPublic = Types.AlbumPhotoPublic;
  type AlbumSummary = Types.AlbumSummary;
  type AlbumPhotoMeta = Types.AlbumPhotoMeta;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type ProfilesActor = actor {
    addLike : shared (Principal) -> async Bool;
  };

  type WalletActor = actor {
    earnLoveFor : shared (Principal, Nat) -> async Bool;
    transferLoveBetween : shared (Principal, Principal, Nat) -> async Bool;
  };

  type AlbumPhotoInternal = {
    id : Nat;
    albumId : Nat;
    uploader : Principal;
    uploaderName : Text;
    photo : ChatAttachment;
    timestamp : Int;
  };

  let albums = Map.empty<Nat, Album>();
  var albumCounter : Nat = 0;

  let photos = Map.empty<Nat, AlbumPhotoInternal>();
  var photoCounter : Nat = 0;

  let likes = Map.empty<Nat, Map.Map<Principal, Bool>>();

  // New thumbs up/down reaction system. Bool = true for thumbs up,
  // false for thumbs down. One reaction per user per photo, permanent.
  let reactions = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let loveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  let albumLoveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  func myAlbumLoveGivenFor(albumId : Nat, caller : Principal) : Bool {
    switch (Map.get(albumLoveGiven, Nat.compare, albumId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func myLoveGivenFor(photoId : Nat, caller : Principal) : Bool {
    switch (Map.get(loveGiven, Nat.compare, photoId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

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

  func canContribute(a : Album, caller : Principal) : Bool {
    if (Principal.equal(a.creator, caller)) { return true };
    switch (Array.find<Principal>(a.contributors, func(p : Principal) : Bool { Principal.equal(p, caller) })) {
      case (?_) { true };
      case null { false };
    }
  };

  func likeCountFor(photoId : Nat) : Nat {
    switch (Map.get(likes, Nat.compare, photoId)) {
      case (?m) { Map.size(m) };
      case null { 0 };
    }
  };

  func likedByMe(photoId : Nat, caller : Principal) : Bool {
    switch (Map.get(likes, Nat.compare, photoId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func thumbsDownCountFor(photoId : Nat) : Nat {
    switch (Map.get(reactions, Nat.compare, photoId)) {
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

  func myReactionFor(photoId : Nat, caller : Principal) : ?Bool {
    switch (Map.get(reactions, Nat.compare, photoId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  func toPublic(p : AlbumPhotoInternal, caller : Principal) : AlbumPhotoPublic {
    {
      id = p.id;
      albumId = p.albumId;
      uploader = p.uploader;
      uploaderName = p.uploaderName;
      photo = p.photo;
      likeCount = likeCountFor(p.id);
      likedByMe = likedByMe(p.id, caller);
      timestamp = p.timestamp;
    }
  };

  public shared ({ caller }) func createAlbum(name : Text, description : Text, coverPhoto : ?ChatAttachment) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let creatorName = await authUsername(caller);
    let id = albumCounter;
    let a : Album = {
      id;
      name;
      description;
      creator = caller;
      creatorName;
      contributors = [caller];
      coverPhoto;
      created = Time.now();
    };
    Map.add(albums, Nat.compare, id, a);
    albumCounter += 1;
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

  public shared ({ caller }) func deleteAlbum(albumId : Nat) : async Bool {
    switch (Map.get(albums, Nat.compare, albumId)) {
      case (?a) {
        if (not Principal.equal(a.creator, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
        ignore Map.remove(albums, Nat.compare, albumId);
        let photosToRemove = Array.filter<AlbumPhotoInternal>(
          Array.fromIter<AlbumPhotoInternal>(Map.values(photos)),
          func(p : AlbumPhotoInternal) : Bool { p.albumId == albumId }
        );
        for (p in photosToRemove.vals()) {
          ignore Map.remove(photos, Nat.compare, p.id);
          ignore Map.remove(likes, Nat.compare, p.id);
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func addContributor(albumId : Nat, userId : Principal) : async Bool {
    switch (Map.get(albums, Nat.compare, albumId)) {
      case (?a) {
        if (not Principal.equal(a.creator, caller)) { return false };
        let alreadyIn = switch (Array.find<Principal>(a.contributors, func(p : Principal) : Bool { Principal.equal(p, userId) })) {
          case (?_) { true };
          case null { false };
        };
        if (alreadyIn) { return true };
        let updated : Album = {
          id = a.id;
          name = a.name;
          description = a.description;
          creator = a.creator;
          creatorName = a.creatorName;
          contributors = Array.concat<Principal>(a.contributors, [userId]);
          coverPhoto = a.coverPhoto;
          created = a.created;
        };
        Map.add(albums, Nat.compare, albumId, updated);
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func listAlbums() : async [AlbumSummary] {
    let all = Array.fromIter<Album>(Map.values(albums));
    Array.map<Album, AlbumSummary>(
      all,
      func(a : Album) : AlbumSummary {
        { album = a; myLoveGiven = myAlbumLoveGivenFor(a.id, caller) }
      }
    )
  };

  public shared ({ caller }) func loveThisAlbum(albumId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(albums, Nat.compare, albumId)) {
      case (?a) {
        if (Principal.equal(a.creator, caller)) { return false };
        if (myAlbumLoveGivenFor(albumId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let walletCanister : WalletActor = actor (id);
            await walletCanister.transferLoveBetween(caller, a.creator, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(albumLoveGiven, Nat.compare, albumId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(albumLoveGiven, Nat.compare, albumId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public query func getAlbum(albumId : Nat) : async ?Album {
    Map.get(albums, Nat.compare, albumId)
  };

  public shared ({ caller }) func uploadPhoto(albumId : Nat, photo : ChatAttachment) : async Nat {
    switch (Map.get(albums, Nat.compare, albumId)) {
      case (?a) {
        if (not canContribute(a, caller)) {
          Runtime.trap("Only the album creator or contributors can add photos");
        };
      };
      case null {
        Runtime.trap("Album not found");
      };
    };
    let uploaderName = await authUsername(caller);
    let id = photoCounter;
    let p : AlbumPhotoInternal = {
      id;
      albumId;
      uploader = caller;
      uploaderName;
      photo;
      timestamp = Time.now();
    };
    Map.add(photos, Nat.compare, id, p);
    photoCounter += 1;
    id
  };

  public query ({ caller }) func getAlbumPhotos(albumId : Nat) : async [AlbumPhotoPublic] {
    let all = Array.filter<AlbumPhotoInternal>(
      Array.fromIter<AlbumPhotoInternal>(Map.values(photos)),
      func(p : AlbumPhotoInternal) : Bool { p.albumId == albumId }
    );
    Array.map<AlbumPhotoInternal, AlbumPhotoPublic>(
      all,
      func(p : AlbumPhotoInternal) : AlbumPhotoPublic { toPublic(p, caller) }
    )
  };

  public query ({ caller }) func getAlbumPhotoMetas(albumId : Nat) : async [AlbumPhotoMeta] {
    let all = Array.filter<AlbumPhotoInternal>(
      Array.fromIter<AlbumPhotoInternal>(Map.values(photos)),
      func(p : AlbumPhotoInternal) : Bool { p.albumId == albumId }
    );
    Array.map<AlbumPhotoInternal, AlbumPhotoMeta>(
      all,
      func(p : AlbumPhotoInternal) : AlbumPhotoMeta {
        {
          id = p.id;
          albumId = p.albumId;
          uploader = p.uploader;
          uploaderName = p.uploaderName;
          filename = p.photo.filename;
          contentType = p.photo.contentType;
          thumbsDownCount = thumbsDownCountFor(p.id);
          myReaction = myReactionFor(p.id, caller);
          myLoveGiven = myLoveGivenFor(p.id, caller);
          timestamp = p.timestamp;
        }
      }
    )
  };

  public shared ({ caller }) func reactToPhoto(photoId : Nat, isThumbsUp : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(photos, Nat.compare, photoId)) {
      case (?p) {
        if (Principal.equal(p.uploader, caller)) { return false };
        let m = switch (Map.get(reactions, Nat.compare, photoId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(reactions, Nat.compare, photoId, m);
            m
          };
        };
        if (Map.get(m, Principal.compare, caller) != null) {
          return false;
        };
        Map.add(m, Principal.compare, caller, isThumbsUp);
        if (isThumbsUp) {
          let profilesIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:profiles");
          let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
          switch (profilesIdOpt) {
            case (?id) {
              let profilesCanister : ProfilesActor = actor (id);
              ignore await profilesCanister.addLike(p.uploader);
            };
            case null {};
          };
          switch (walletIdOpt) {
            case (?id) {
              let walletCanister : WalletActor = actor (id);
              ignore await walletCanister.earnLoveFor(p.uploader, 1);
            };
            case null {};
          };
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func loveThisPhoto(photoId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(photos, Nat.compare, photoId)) {
      case (?p) {
        if (Principal.equal(p.uploader, caller)) { return false };
        if (myLoveGivenFor(photoId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let walletCanister : WalletActor = actor (id);
            await walletCanister.transferLoveBetween(caller, p.uploader, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(loveGiven, Nat.compare, photoId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(loveGiven, Nat.compare, photoId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public query func getPhotoImage(photoId : Nat) : async ?ChatAttachment {
    switch (Map.get(photos, Nat.compare, photoId)) {
      case (?p) { ?p.photo };
      case null { null };
    }
  };

  public shared ({ caller }) func toggleLike(photoId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(photos, Nat.compare, photoId)) {
      case (?p) {
        if (Principal.equal(p.uploader, caller)) {
          Runtime.trap("You can't like your own photo");
        };
        let m = switch (Map.get(likes, Nat.compare, photoId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(likes, Nat.compare, photoId, m);
            m
          };
        };
        let currentlyLiked = Map.get(m, Principal.compare, caller) != null;
        if (currentlyLiked) {
          ignore Map.remove(m, Principal.compare, caller);
        } else {
          Map.add(m, Principal.compare, caller, true);
        };
        not currentlyLiked
      };
      case null { false };
    }
  };
};
