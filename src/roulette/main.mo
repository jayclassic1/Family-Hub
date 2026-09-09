import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Nat32 "mo:core/Nat32";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Timer "mo:core/Timer";
import Blob "mo:core/Blob";
import Runtime "mo:core/Runtime";

persistent actor {

  type BetKind = {
    #straight;
    #split;
    #street;
    #corner;
    #line;
    #column;
    #dozen;
    #redBlack;
    #oddEven;
    #highLow;
  };

  type Bet = {
    id : Nat;
    player : Principal;
    playerName : Text;
    numbers : [Nat];
    amount : Nat;
    kind : BetKind;
    betLabel : Text;
  };

  type Phase = { #idle; #betting; #spinning; #result };

  type RoundResult = {
    winningNumber : Nat;
    bets : [Bet];
    winners : [(Principal, Text, Nat)];
    timestamp : Int;
  };

  type ChatMsg = {
    id : Nat;
    sender : Principal;
    senderName : Text;
    text : Text;
    timestamp : Int;
  };

  type TableState = {
    phase : Phase;
    currentBets : [Bet];
    roundEndsAt : Int;
    lastResult : ?RoundResult;
    history : [RoundResult];
  };

  type UserProfilePublic = { username : Text; role : { #admin; #member } };

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type WalletActor = actor {
    spendLoveFor : shared (Principal, Nat) -> async Bool;
    earnLoveFor : shared (Principal, Nat) -> async Bool;
  };

  let RED_NUMBERS : [Nat] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  let BETTING_WINDOW_SECONDS : Nat = 30;
  let SPIN_DURATION_SECONDS : Nat = 5;
  let RESULT_DISPLAY_SECONDS : Nat = 6;
  let MAX_HISTORY : Nat = 20;

  var phase : Phase = #idle;
  var currentBets : [Bet] = [];
  var nextBetId : Nat = 0;
  var roundEndsAt : Int = 0;
  var lastResult : ?RoundResult = null;
  var history : [RoundResult] = [];
  var chat : [ChatMsg] = [];
  var nextChatId : Nat = 0;

  transient let IC : actor { raw_rand : () -> async Blob } = actor "aaaaa-aa";

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
    };
  };

  func getWallet() : async ?WalletActor {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
      case (?walletId) { ?(actor (walletId) : WalletActor) };
      case null { null };
    };
  };

  func isRed(n : Nat) : Bool {
    Array.find<Nat>(RED_NUMBERS, func(x : Nat) : Bool { x == n }) != null;
  };

  func payoutMultiplier(numbersCount : Nat) : Nat {
    if (numbersCount == 1) { 35 } else if (numbersCount == 2) { 17 } else if (numbersCount == 3) {
      11;
    } else if (numbersCount == 4) { 8 } else if (numbersCount == 6) { 5 } else if (numbersCount == 12) {
      2;
    } else if (numbersCount == 18) { 1 } else { 0 };
  };

  func randomWinningNumber() : async Nat {
    let randomBytes = await IC.raw_rand();
    let bytes = Blob.toArray(randomBytes);
    var value : Nat32 = 0;
    var i = 0;
    while (i < 4 and i < bytes.size()) {
      value := (value * 256) + Nat32.fromNat(Nat8.toNat(bytes[i]));
      i += 1;
    };
    Nat32.toNat(value) % 37;
  };

  // These three do the actual phase-transition work. None of them call
  // Timer.setTimer themselves, so none of them need <system> -- scheduling
  // the *next* step is handled by inline closures at the call sites below,
  // which is the pattern Motoko's own timer docs use for self-rescheduling
  // timers (a named function can't be handed around as a system-capable
  // value; an inline closure defined at a system-capable call site can).

  func doCloseBetting() : async () {
    phase := #spinning;
  };

  func doResolveRound() : async () {
    let winningNumber = await randomWinningNumber();

    var winners : [(Principal, Text, Nat)] = [];
    for (b in currentBets.vals()) {
      let hit = Array.find<Nat>(b.numbers, func(n : Nat) : Bool { n == winningNumber }) != null;
      if (hit) {
        let mult = payoutMultiplier(b.numbers.size());
        let payout = b.amount * (mult + 1);
        winners := Array.concat(winners, [(b.player, b.playerName, payout)]);
      };
    };

    switch (await getWallet()) {
      case (?w) {
        for ((p, _, payout) in winners.vals()) {
          ignore await w.earnLoveFor(p, payout);
        };
      };
      case null {};
    };

    let result : RoundResult = {
      winningNumber;
      bets = currentBets;
      winners;
      timestamp = Time.now();
    };
    lastResult := ?result;

    let trimmedHistory = if (history.size() >= MAX_HISTORY) {
      Array.tabulate<RoundResult>(
        MAX_HISTORY - 1,
        func(i : Nat) : RoundResult { history[i + (history.size() - (MAX_HISTORY - 1))] },
      );
    } else { history };
    history := Array.concat(trimmedHistory, [result]);

    phase := #result;
  };

  func doBackToIdle() : async () {
    currentBets := [];
    phase := #idle;
  };

  public shared ({ caller }) func placeBet(numbers : [Nat], amount : Nat, kind : BetKind, betLabel : Text) : async Bool {
    if (phase != #idle and phase != #betting) { return false };
    if (amount == 0) { return false };
    if (numbers.size() == 0) { return false };
    for (n in numbers.vals()) {
      if (n > 36) { return false };
    };

    // Claim the idle table synchronously, before any await point below --
    // Motoko yields control at each await, so without this a second call
    // arriving while the first is mid-flight could also see phase == #idle
    // and start a duplicate round. Doing this check-and-set with no await
    // in between makes it atomic with respect to other calls.
    let wasIdle = phase == #idle;
    if (wasIdle) {
      phase := #betting;
      roundEndsAt := Time.now() + (BETTING_WINDOW_SECONDS * 1_000_000_000);
      ignore Timer.setTimer<system>(
        #seconds BETTING_WINDOW_SECONDS,
        func() : async () {
          await doCloseBetting();
          ignore Timer.setTimer<system>(
            #seconds SPIN_DURATION_SECONDS,
            func() : async () {
              await doResolveRound();
              ignore Timer.setTimer<system>(
                #seconds RESULT_DISPLAY_SECONDS,
                func() : async () { await doBackToIdle() },
              );
            },
          );
        },
      );
    };

    switch (await getWallet()) {
      case (?w) {
        let paid = await w.spendLoveFor(caller, amount);
        if (not paid) { return false };
      };
      case null { return false };
    };

    let name = await authUsername(caller);
    let bet : Bet = {
      id = nextBetId;
      player = caller;
      playerName = name;
      numbers;
      amount;
      kind;
      betLabel;
    };
    nextBetId += 1;
    currentBets := Array.concat(currentBets, [bet]);

    true;
  };

  public query func getTableState() : async TableState {
    { phase; currentBets; roundEndsAt; lastResult; history };
  };

  public shared ({ caller }) func sendChat(text : Text) : async Bool {
    if (text.size() == 0 or text.size() > 500) { return false };
    let name = await authUsername(caller);
    let msg : ChatMsg = {
      id = nextChatId;
      sender = caller;
      senderName = name;
      text;
      timestamp = Time.now();
    };
    nextChatId += 1;
    chat := Array.concat(chat, [msg]);
    true;
  };

  public query func getChat() : async [ChatMsg] {
    chat;
  };

  public query func isRedNumber(n : Nat) : async Bool {
    isRed(n);
  };
};
