import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";

persistent actor {

  type ChatAttachment = { filename : Text; contentType : Text; data : [Nat8] };

  type WalletActor = actor {
    spendLoveFor : shared (Principal, Nat) -> async Bool;
  };

  type ShopProfile = {
    owner : Principal;
    nameColorOwned : Bool;
    nameColor : Text;
    nameFontOwned : Bool;
    nameFont : Text;
    pfpOwned : Bool;
    avatarPhoto : ?ChatAttachment;
    bannerOwned : Bool;
    bannerPhoto : ?ChatAttachment;
    chatBubbleOwned : Bool;
    chatBubbleSkin : Text;
    badgeOwned : Bool;
    badgeText : Text;
    profileThemeOwned : Bool;
    profileTheme : Text;
    lovedEffectsOwned : [Text];
    lovedEffect : Text;
    sendEffectsOwned : [Text];
    sendEffect : Text;
  };

  let PRICE_NAME_COLOR : Nat = 10;
  let PRICE_NAME_FONT : Nat = 10;
  let PRICE_PFP : Nat = 15;
  let PRICE_BANNER : Nat = 15;
  let PRICE_CHAT_BUBBLE : Nat = 15;
  let PRICE_BADGE : Nat = 15;
  let PRICE_PROFILE_THEME : Nat = 15;

  let LOVED_EFFECTS : [(Text, Nat)] = [
    ("confetti", 25),
    ("heartPulse", 38),
    ("sparkleTrail", 50),
    ("glowRipple", 63),
    ("goldenShimmer", 75),
  ];

  let SEND_EFFECTS : [(Text, Nat)] = [
    ("fireworks", 25),
    ("shootingStars", 38),
    ("fallingPetals", 50),
    ("screenFlash", 63),
    ("balloonRise", 75),
  ];

  let profiles = Map.empty<Principal, ShopProfile>();

  func emptyProfile(owner : Principal) : ShopProfile {
    {
      owner;
      nameColorOwned = false;
      nameColor = "";
      nameFontOwned = false;
      nameFont = "";
      pfpOwned = false;
      avatarPhoto = null;
      bannerOwned = false;
      bannerPhoto = null;
      chatBubbleOwned = false;
      chatBubbleSkin = "";
      badgeOwned = false;
      badgeText = "";
      profileThemeOwned = false;
      profileTheme = "";
      lovedEffectsOwned = [];
      lovedEffect = "";
      sendEffectsOwned = [];
      sendEffect = "";
    }
  };

  func getOrEmpty(owner : Principal) : ShopProfile {
    switch (Map.get(profiles, Principal.compare, owner)) {
      case (?p) { p };
      case null { emptyProfile(owner) };
    }
  };

  func findPrice(list : [(Text, Nat)], key : Text) : ?Nat {
    for ((k, price) in list.vals()) {
      if (k == key) { return ?price };
    };
    null
  };

  func isLovedEffectKey(item : Text) : Bool {
    switch (findPrice(LOVED_EFFECTS, item)) {
      case (?_) { true };
      case null { false };
    }
  };

  func isSendEffectKey(item : Text) : Bool {
    switch (findPrice(SEND_EFFECTS, item)) {
      case (?_) { true };
      case null { false };
    }
  };

  func priceFor(item : Text) : ?Nat {
    if (item == "nameColor") { ?PRICE_NAME_COLOR }
    else if (item == "nameFont") { ?PRICE_NAME_FONT }
    else if (item == "pfp") { ?PRICE_PFP }
    else if (item == "banner") { ?PRICE_BANNER }
    else if (item == "chatBubble") { ?PRICE_CHAT_BUBBLE }
    else if (item == "badge") { ?PRICE_BADGE }
    else if (item == "profileTheme") { ?PRICE_PROFILE_THEME }
    else {
      switch (findPrice(LOVED_EFFECTS, item)) {
        case (?pr) { ?pr };
        case null { findPrice(SEND_EFFECTS, item) };
      }
    };
  };

  func alreadyOwned(p : ShopProfile, item : Text) : Bool {
    if (item == "nameColor") { p.nameColorOwned }
    else if (item == "nameFont") { p.nameFontOwned }
    else if (item == "pfp") { p.pfpOwned }
    else if (item == "banner") { p.bannerOwned }
    else if (item == "chatBubble") { p.chatBubbleOwned }
    else if (item == "badge") { p.badgeOwned }
    else if (item == "profileTheme") { p.profileThemeOwned }
    else if (isLovedEffectKey(item)) {
      Array.find<Text>(p.lovedEffectsOwned, func(k) { k == item }) != null
    } else if (isSendEffectKey(item)) {
      Array.find<Text>(p.sendEffectsOwned, func(k) { k == item }) != null
    } else { false };
  };

  func markOwned(p : ShopProfile, item : Text) : ShopProfile {
    if (item == "nameColor") { { p with nameColorOwned = true } }
    else if (item == "nameFont") { { p with nameFontOwned = true } }
    else if (item == "pfp") { { p with pfpOwned = true } }
    else if (item == "banner") { { p with bannerOwned = true } }
    else if (item == "chatBubble") { { p with chatBubbleOwned = true } }
    else if (item == "badge") { { p with badgeOwned = true } }
    else if (item == "profileTheme") { { p with profileThemeOwned = true } }
    else if (isLovedEffectKey(item)) {
      { p with lovedEffectsOwned = Array.concat(p.lovedEffectsOwned, [item]) }
    } else if (isSendEffectKey(item)) {
      { p with sendEffectsOwned = Array.concat(p.sendEffectsOwned, [item]) }
    } else { p };
  };

  public shared ({ caller }) func purchase(item : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let price = switch (priceFor(item)) {
      case (?pr) { pr };
      case null { return false };
    };
    let existing = getOrEmpty(caller);
    if (alreadyOwned(existing, item)) { return false };
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
      case (?walletId) {
        let w : WalletActor = actor (walletId);
        let paid = await w.spendLoveFor(caller, price);
        if (not paid) { return false };
        let updated = markOwned(existing, item);
        Map.add(profiles, Principal.compare, caller, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func setNameColor(hex : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (not p.nameColorOwned) { return false };
    Map.add(profiles, Principal.compare, caller, { p with nameColor = hex });
    true
  };

  public shared ({ caller }) func setNameFont(font : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (not p.nameFontOwned) { return false };
    Map.add(profiles, Principal.compare, caller, { p with nameFont = font });
    true
  };

  public shared ({ caller }) func setAvatarPhoto(photo : ChatAttachment) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (not p.pfpOwned) { return false };
    Map.add(profiles, Principal.compare, caller, { p with avatarPhoto = ?photo });
    true
  };

  public shared ({ caller }) func setBannerPhoto(photo : ChatAttachment) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (not p.bannerOwned) { return false };
    Map.add(profiles, Principal.compare, caller, { p with bannerPhoto = ?photo });
    true
  };

  public shared ({ caller }) func setLovedEffect(effect : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (Array.find<Text>(p.lovedEffectsOwned, func(k) { k == effect }) == null) { return false };
    Map.add(profiles, Principal.compare, caller, { p with lovedEffect = effect });
    true
  };

  public shared ({ caller }) func setSendEffect(effect : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (Array.find<Text>(p.sendEffectsOwned, func(k) { k == effect }) == null) { return false };
    Map.add(profiles, Principal.compare, caller, { p with sendEffect = effect });
    true
  };

  public shared ({ caller }) func setChatBubbleSkin(skin : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (not p.chatBubbleOwned) { return false };
    Map.add(profiles, Principal.compare, caller, { p with chatBubbleSkin = skin });
    true
  };

  public shared ({ caller }) func setBadgeText(text : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (not p.badgeOwned) { return false };
    let trimmed = if (Text.size(text) > 16) { return false } else { text };
    Map.add(profiles, Principal.compare, caller, { p with badgeText = trimmed });
    true
  };

  public shared ({ caller }) func setProfileTheme(theme : Text) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let p = getOrEmpty(caller);
    if (not p.profileThemeOwned) { return false };
    Map.add(profiles, Principal.compare, caller, { p with profileTheme = theme });
    true
  };

  public query ({ caller }) func getMyShopProfile() : async ShopProfile {
    getOrEmpty(caller)
  };

  public query func getShopProfileFor(user : Principal) : async ShopProfile {
    getOrEmpty(user)
  };
};
