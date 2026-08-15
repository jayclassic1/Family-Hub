import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Float "mo:core/Float";
import Types "../shared/Types";

persistent actor {

  type Recipe = Types.Recipe;
  type RecipeSummary = Types.RecipeSummary;
  type RecipeComment = Types.RecipeComment;
  type RecipeCommentPublic = Types.RecipeCommentPublic;
  type ChefSummary = Types.ChefSummary;
  type ChatAttachment = Types.ChatAttachment;
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

  let recipes = Map.empty<Nat, Recipe>();

  let recipeLoveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();
  let commentLoveGiven = Map.empty<Nat, Map.Map<Principal, Bool>>();

  func myRecipeLoveGivenFor(recipeId : Nat, caller : Principal) : Bool {
    switch (Map.get(recipeLoveGiven, Nat.compare, recipeId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };

  func myCommentLoveGivenFor(commentId : Nat, caller : Principal) : Bool {
    switch (Map.get(commentLoveGiven, Nat.compare, commentId)) {
      case (?m) { Map.get(m, Principal.compare, caller) != null };
      case null { false };
    }
  };
  var recipeCounter : Nat = 0;

  let comments = Map.empty<Nat, RecipeComment>();

  // One reaction per user per comment, permanent.
  let commentReactions = Map.empty<Nat, Map.Map<Principal, Bool>>();

  func commentThumbsDownCount(commentId : Nat) : Nat {
    switch (Map.get(commentReactions, Nat.compare, commentId)) {
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

  func myCommentReaction(commentId : Nat, caller : Principal) : ?Bool {
    switch (Map.get(commentReactions, Nat.compare, commentId)) {
      case (?m) { Map.get(m, Principal.compare, caller) };
      case null { null };
    }
  };

  func toPublicComment(c : RecipeComment, caller : Principal) : RecipeCommentPublic {
    {
      id = c.id;
      recipeId = c.recipeId;
      author = c.author;
      authorName = c.authorName;
      text = c.text;
      rating = c.rating;
      timestamp = c.timestamp;
      thumbsDownCount = commentThumbsDownCount(c.id);
      myReaction = myCommentReaction(c.id, caller);
      myLoveGiven = myCommentLoveGivenFor(c.id, caller);
    }
  };
  var commentCounter : Nat = 0;

  let chefPhotos = Map.empty<Principal, ChatAttachment>();

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

  func ratingsFor(recipeId : Nat) : [Nat] {
    let all = Array.filter<RecipeComment>(
      Array.fromIter<RecipeComment>(Map.values(comments)),
      func(c : RecipeComment) : Bool { c.recipeId == recipeId and c.rating != null }
    );
    Array.map<RecipeComment, Nat>(
      all,
      func(c : RecipeComment) : Nat {
        switch (c.rating) {
          case (?r) { r };
          case null { 0 };
        }
      }
    )
  };

  func summarize(r : Recipe, caller : Principal) : RecipeSummary {
    let ratings = ratingsFor(r.id);
    let count = ratings.size();
    let avg = if (count == 0) { 0.0 } else {
      var sum : Nat = 0;
      for (v in ratings.vals()) { sum += v };
      Float.fromInt(sum) / Float.fromInt(count)
    };
    { recipe = r; averageRating = avg; ratingCount = count; myLoveGiven = myRecipeLoveGivenFor(r.id, caller) };
  };

  public shared ({ caller }) func createRecipe(
    title : Text,
    description : Text,
    ingredients : [Text],
    steps : [Text],
    coverPhoto : ?ChatAttachment
  ) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let creatorName = await authUsername(caller);
    let id = recipeCounter;
    let r : Recipe = {
      id;
      creator = caller;
      creatorName;
      title;
      description;
      ingredients;
      steps;
      coverPhoto;
      created = Time.now();
    };
    Map.add(recipes, Nat.compare, id, r);
    recipeCounter += 1;
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

  public shared ({ caller }) func deleteRecipe(recipeId : Nat) : async Bool {
    switch (Map.get(recipes, Nat.compare, recipeId)) {
      case (?r) {
        if (not Principal.equal(r.creator, caller)) {
          if (not (await isCallerAdmin(caller))) { return false };
        };
        ignore Map.remove(recipes, Nat.compare, recipeId);
        let commentsToRemove = Array.filter<RecipeComment>(
          Array.fromIter<RecipeComment>(Map.values(comments)),
          func(c : RecipeComment) : Bool { c.recipeId == recipeId }
        );
        for (c in commentsToRemove.vals()) {
          ignore Map.remove(comments, Nat.compare, c.id);
        };
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func listRecipes() : async [RecipeSummary] {
    Array.map<Recipe, RecipeSummary>(
      Array.fromIter<Recipe>(Map.values(recipes)),
      func(r : Recipe) : RecipeSummary { summarize(r, caller) }
    )
  };

  public query ({ caller }) func getRecipe(recipeId : Nat) : async ?RecipeSummary {
    switch (Map.get(recipes, Nat.compare, recipeId)) {
      case (?r) { ?summarize(r, caller) };
      case null { null };
    }
  };

  public shared ({ caller }) func addComment(recipeId : Nat, text : Text, rating : ?Nat) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    let recipe = switch (Map.get(recipes, Nat.compare, recipeId)) {
      case (?r) { r };
      case null { Runtime.trap("Recipe not found") };
    };
    switch (rating) {
      case (?r) {
        if (r < 1 or r > 5) {
          Runtime.trap("Rating must be between 1 and 5");
        };
        if (Principal.equal(recipe.creator, caller)) {
          Runtime.trap("You can't rate your own recipe");
        };
      };
      case null {};
    };
    let authorName = await authUsername(caller);
    let id = commentCounter;
    let c : RecipeComment = {
      id;
      recipeId;
      author = caller;
      authorName;
      text;
      rating;
      timestamp = Time.now();
    };
    Map.add(comments, Nat.compare, id, c);
    commentCounter += 1;
    switch (rating) {
      case (?r) {
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        switch (walletIdOpt) {
          case (?walletId) {
            let walletCanister : WalletActor = actor (walletId);
            ignore await walletCanister.earnLoveFor(caller, r);
          };
          case null {};
        };
      };
      case null {};
    };
    id
  };

  public query ({ caller }) func getComments(recipeId : Nat) : async [RecipeCommentPublic] {
    let mine = Array.filter<RecipeComment>(
      Array.fromIter<RecipeComment>(Map.values(comments)),
      func(c : RecipeComment) : Bool { c.recipeId == recipeId }
    );
    Array.map<RecipeComment, RecipeCommentPublic>(
      mine,
      func(c : RecipeComment) : RecipeCommentPublic { toPublicComment(c, caller) }
    )
  };

  public shared ({ caller }) func reactToComment(commentId : Nat, isThumbsUp : Bool) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(comments, Nat.compare, commentId)) {
      case (?c) {
        if (Principal.equal(c.author, caller)) { return false };
        let m = switch (Map.get(commentReactions, Nat.compare, commentId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(commentReactions, Nat.compare, commentId, m);
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

  public shared ({ caller }) func setChefPhoto(photo : ChatAttachment) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    Map.add(chefPhotos, Principal.compare, caller, photo);
    true
  };

  func chefIds() : [Principal] {
    let all = Array.fromIter<Recipe>(Map.values(recipes));
    var seen : [Principal] = [];
    for (r in all.vals()) {
      let alreadyIn = switch (Array.find<Principal>(seen, func(p : Principal) : Bool { Principal.equal(p, r.creator) })) {
        case (?_) { true };
        case null { false };
      };
      if (not alreadyIn) {
        seen := Array.concat<Principal>(seen, [r.creator]);
      };
    };
    seen
  };

  func chefSummaryFor(chef : Principal) : ChefSummary {
    let all = Array.fromIter<Recipe>(Map.values(recipes));
    let mine = Array.filter<Recipe>(all, func(r : Recipe) : Bool { Principal.equal(r.creator, chef) });
    var totalRatings = 0;
    var chefName = "Unknown";
    for (r in mine.vals()) {
      totalRatings += ratingsFor(r.id).size();
      chefName := r.creatorName;
    };
    let photo = Map.get(chefPhotos, Principal.compare, chef);
    {
      chef;
      chefName;
      chefPhoto = photo;
      recipeCount = mine.size();
      totalRatings;
    }
  };

  public query func listChefs() : async [ChefSummary] {
    let ids = chefIds();
    Array.map<Principal, ChefSummary>(ids, chefSummaryFor)
  };

  public query func getChefSummary(chef : Principal) : async ?ChefSummary {
    let all = Array.fromIter<Recipe>(Map.values(recipes));
    let mine = Array.filter<Recipe>(all, func(r : Recipe) : Bool { Principal.equal(r.creator, chef) });
    if (mine.size() == 0) {
      let photo = Map.get(chefPhotos, Principal.compare, chef);
      switch (photo) {
        case (?_) {
          return ?{
            chef;
            chefName = "Unknown";
            chefPhoto = photo;
            recipeCount = 0;
            totalRatings = 0;
          };
        };
        case null { return null };
      };
    };
    ?chefSummaryFor(chef)
  };

  public query ({ caller }) func getChefRecipes(chef : Principal) : async [RecipeSummary] {
    let all = Array.fromIter<Recipe>(Map.values(recipes));
    let mine = Array.filter<Recipe>(all, func(r : Recipe) : Bool { Principal.equal(r.creator, chef) });
    Array.map<Recipe, RecipeSummary>(mine, func(r : Recipe) : RecipeSummary { summarize(r, caller) })
  };

  public shared ({ caller }) func loveThisRecipe(recipeId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(recipes, Nat.compare, recipeId)) {
      case (?r) {
        if (Principal.equal(r.creator, caller)) { return false };
        if (myRecipeLoveGivenFor(recipeId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, r.creator, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(recipeLoveGiven, Nat.compare, recipeId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(recipeLoveGiven, Nat.compare, recipeId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func loveThisComment(commentId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(comments, Nat.compare, commentId)) {
      case (?c) {
        if (Principal.equal(c.author, caller)) { return false };
        if (myCommentLoveGivenFor(commentId, caller)) { return false };
        let walletIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:wallet");
        let sent = switch (walletIdOpt) {
          case (?id) {
            let w : WalletActor = actor (id);
            await w.transferLoveBetween(caller, c.author, 1);
          };
          case null { false };
        };
        if (not sent) { return false };
        let m = switch (Map.get(commentLoveGiven, Nat.compare, commentId)) {
          case (?m) { m };
          case null {
            let m = Map.empty<Principal, Bool>();
            Map.add(commentLoveGiven, Nat.compare, commentId, m);
            m
          };
        };
        Map.add(m, Principal.compare, caller, true);
        true
      };
      case null { false };
    }
  };
};
