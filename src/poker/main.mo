import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Random "mo:core/Random";
import Order "mo:core/Order";

persistent actor {

  let MIN_BUY_IN : Nat = 20;
  let MAX_BUY_IN : Nat = 50;
  let MAX_SEATS : Nat = 8;
  let SMALL_BLIND : Nat = 1;
  let BIG_BLIND : Nat = 2;

  type UserProfilePublic = { username : Text; role : { #admin; #member } };

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type WalletActor = actor {
    spendLoveFor : shared (Principal, Nat) -> async Bool;
    earnLoveFor : shared (Principal, Nat) -> async Bool;
  };

  type ChatAttachment = { filename : Text; contentType : Text; data : [Nat8] };

  type DmsActor = actor {
    sendDirectMessage : shared (Principal, Text, ?ChatAttachment) -> async Nat;
  };

  type Suit = { #hearts; #diamonds; #clubs; #spades };
  type Card = { rank : Nat; suit : Suit };

  type Phase = { #waiting; #preflop; #flop; #turn; #river; #showdown; #handComplete };

  type SeatState = {
    player : Principal;
    playerName : Text;
    stack : Nat;
    holeCards : [Card];
    betThisRound : Nat;
    betThisHand : Nat;
    folded : Bool;
    allIn : Bool;
    hasActed : Bool;
    inHand : Bool;
    missedTurns : Nat;
  };

  type Table = {
    id : Nat;
    name : Text;
    creator : Principal;
    maxSeats : Nat;
    seats : [?SeatState];
    community : [Card];
    deck : [Card];
    pot : Nat;
    phase : Phase;
    dealerSeat : Nat;
    toActSeat : Nat;
    currentBet : Nat;
    handNumber : Nat;
    lastAction : Text;
    winnerText : Text;
  };

  let tables = Map.empty<Nat, Table>();
  var tableCounter : Nat = 0;

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

  func emptySeats() : [?SeatState] {
    Array.tabulate<?SeatState>(MAX_SEATS, func(_ : Nat) : ?SeatState { null })
  };

  func maskSeat(s : ?SeatState, caller : Principal, revealAll : Bool) : ?SeatState {
    switch (s) {
      case (?seat) {
        if (revealAll or Principal.equal(seat.player, caller)) { ?seat }
        else { ?{ seat with holeCards = [] } };
      };
      case null { null };
    }
  };

  func toPublicTable(t : Table, caller : Principal) : Table {
    let revealAll = (t.phase == #showdown or t.phase == #handComplete);
    {
      t with
      seats = Array.map<?SeatState, ?SeatState>(t.seats, func(s : ?SeatState) : ?SeatState { maskSeat(s, caller, revealAll) });
    }
  };

  public shared ({ caller }) func createTable(name : Text, maxSeats : Nat) : async Nat {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Not signed in") };
    if (maxSeats != 2 and maxSeats != 8) { Runtime.trap("maxSeats must be 2 (heads-up) or 8 (open table)") };
    let id = tableCounter;
    let t : Table = {
      id;
      name = if (name == "") { "Table " # Nat.toText(id) } else { name };
      creator = caller;
      maxSeats;
      seats = emptySeats();
      community = [];
      deck = [];
      pot = 0;
      phase = #waiting;
      dealerSeat = 0;
      toActSeat = 0;
      currentBet = 0;
      handNumber = 0;
      lastAction = "";
      winnerText = "";
    };
    Map.add(tables, Nat.compare, id, t);
    tableCounter += 1;
    id
  };

  public query ({ caller }) func listTables() : async [Table] {
    let all = Array.fromIter<Table>(Map.values(tables));
    Array.map<Table, Table>(all, func(t : Table) : Table { toPublicTable(t, caller) })
  };

  public query ({ caller }) func getTable(tableId : Nat) : async ?Table {
    switch (Map.get(tables, Nat.compare, tableId)) {
      case (?t) { ?toPublicTable(t, caller) };
      case null { null };
    }
  };

  func isPlayerSeated(seats : [?SeatState], p : Principal) : Bool {
    for (s in seats.vals()) {
      switch (s) {
        case (?seat) { if (Principal.equal(seat.player, p)) { return true } };
        case null {};
      };
    };
    false
  };

  func buildDeck() : [Card] {
    Array.tabulate<Card>(
      52,
      func(i : Nat) : Card {
        let suitIdx = i / 13;
        let rankIdx = i % 13;
        let suit = switch (suitIdx) {
          case (0) { #hearts };
          case (1) { #diamonds };
          case (2) { #clubs };
          case (_) { #spades };
        };
        { rank = rankIdx + 2; suit };
      }
    )
  };

  func shuffleDeck(deck : [Card]) : async* [Card] {
    let rng = Random.crypto();
    let arr = Array.toVarArray<Card>(deck);
    let n = arr.size();
    var i = n;
    while (i > 1) {
      i -= 1;
      let j = await* rng.natRange(0, i + 1);
      let tmp = arr[i];
      arr[i] := arr[j];
      arr[j] := tmp;
    };
    Array.fromVarArray<Card>(arr)
  };

  func countOccupied(seats : [?SeatState]) : Nat {
    var n = 0;
    for (s in seats.vals()) {
      switch (s) { case (?_) { n += 1 }; case null {} };
    };
    n
  };

  func occupiedIndices(seats : [?SeatState]) : [Nat] {
    var result : [Nat] = [];
    var i = 0;
    for (s in seats.vals()) {
      switch (s) {
        case (?_) { result := Array.concat<Nat>(result, [i]) };
        case null {};
      };
      i += 1;
    };
    result
  };

  // Finds the next occupied seat after `from`, wrapping around the table.
  func nextOccupiedSeat(seats : [?SeatState], from : Nat) : ?Nat {
    var i = 1;
    while (i <= MAX_SEATS) {
      let idx = (from + i) % MAX_SEATS;
      switch (seats[idx]) {
        case (?_) { return ?idx };
        case null {};
      };
      i += 1;
    };
    null
  };

  // Next occupied seat that's still live in the CURRENT hand (dealt in,
  // not folded, not all-in) — used to find who acts next during betting.
  func nextLiveSeat(seats : [?SeatState], from : Nat) : ?Nat {
    var i = 1;
    while (i <= MAX_SEATS) {
      let idx = (from + i) % MAX_SEATS;
      switch (seats[idx]) {
        case (?seat) {
          if (seat.inHand and not seat.folded and not seat.allIn) { return ?idx };
        };
        case null {};
      };
      i += 1;
    };
    null
  };

  func countLiveNotFolded(seats : [?SeatState]) : Nat {
    var n = 0;
    for (s in seats.vals()) {
      switch (s) {
        case (?seat) { if (seat.inHand and not seat.folded) { n += 1 } };
        case null {};
      };
    };
    n
  };

  func findHoleCards(i : Nat, arr : [(Nat, Card, Card)]) : ?(Card, Card) {
    for ((idx, c1, c2) in arr.vals()) {
      if (idx == i) { return ?(c1, c2) };
    };
    null
  };

  func dealNewHand(t : Table) : async Table {
    if (countOccupied(t.seats) < 2) {
      return { t with phase = #waiting; lastAction = "Waiting for more players." };
    };

    let dealerSeat = switch (nextOccupiedSeat(t.seats, t.dealerSeat)) {
      case (?idx) { idx };
      case null { Runtime.trap("unreachable: expected an occupied seat") };
    };
    let sbSeat = switch (nextOccupiedSeat(t.seats, dealerSeat)) {
      case (?idx) { idx };
      case null { Runtime.trap("unreachable") };
    };
    let bbSeat = switch (nextOccupiedSeat(t.seats, sbSeat)) {
      case (?idx) { idx };
      case null { Runtime.trap("unreachable") };
    };
    let firstToAct = switch (nextOccupiedSeat(t.seats, bbSeat)) {
      case (?idx) { idx };
      case null { Runtime.trap("unreachable") };
    };

    let shuffled = await* shuffleDeck(buildDeck());
    let occIndices = occupiedIndices(t.seats);
    let holeCardsFor = Array.tabulate<(Nat, Card, Card)>(
      occIndices.size(),
      func(pos : Nat) : (Nat, Card, Card) {
        (occIndices[pos], shuffled[pos * 2], shuffled[pos * 2 + 1]);
      },
    );

    let newSeats = Array.tabulate<?SeatState>(
      MAX_SEATS,
      func(i : Nat) : ?SeatState {
        switch (t.seats[i]) {
          case (?seat) {
            let (c1, c2) = switch (findHoleCards(i, holeCardsFor)) {
              case (?cc) { cc };
              case null { Runtime.trap("unreachable: missing hole cards") };
            };
            let blind = if (i == sbSeat) { Nat.min(SMALL_BLIND, seat.stack) }
              else if (i == bbSeat) { Nat.min(BIG_BLIND, seat.stack) }
              else { 0 };
            ?{
              seat with
              holeCards = [c1, c2];
              betThisRound = blind;
              betThisHand = blind;
              stack = seat.stack - blind : Nat;
              folded = false;
              allIn = (seat.stack - blind : Nat) == 0;
              hasActed = false;
              inHand = true;
            };
          };
          case null { null };
        };
      },
    );

    var potTotal = 0;
    for (idx in occIndices.vals()) {
      let seat = switch (t.seats[idx]) { case (?s) { s }; case null { Runtime.trap("unreachable") } };
      let blind = if (idx == sbSeat) { Nat.min(SMALL_BLIND, seat.stack) }
        else if (idx == bbSeat) { Nat.min(BIG_BLIND, seat.stack) }
        else { 0 };
      potTotal += blind;
    };

    let usedCards = occIndices.size() * 2;
    let restDeck = Array.tabulate<Card>(shuffled.size() - usedCards, func(i : Nat) : Card { shuffled[i + usedCards] });

    {
      t with
      seats = newSeats;
      community = [];
      deck = restDeck;
      pot = potTotal;
      phase = #preflop;
      dealerSeat;
      toActSeat = firstToAct;
      currentBet = BIG_BLIND;
      handNumber = t.handNumber + 1;
      lastAction = "New hand dealt. Blinds posted.";
      winnerText = "";
    }
  };

  func notifyGameStarted(t : Table) : async () {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:dms")) {
      case (?dmsId) {
        let dmsCanister : DmsActor = actor (dmsId);
        for (s in t.seats.vals()) {
          switch (s) {
            case (?seat) {
              ignore await dmsCanister.sendDirectMessage(
                seat.player,
                "🃏 Your poker game at \"" # t.name # "\" has started!",
                null
              );
            };
            case null {};
          };
        };
      };
      case null {};
    };
  };

  func maybeAutoDeal(t : Table) : async Table {
    if (t.phase == #waiting and countOccupied(t.seats) >= 2) {
      let dealt = await dealNewHand(t);
      await notifyGameStarted(dealt);
      dealt;
    } else {
      t;
    }
  };

  func saveOrDeleteTable(tableId : Nat, t : Table) {
    if (countOccupied(t.seats) == 0) {
      ignore Map.remove(tables, Nat.compare, tableId);
    } else {
      Map.add(tables, Nat.compare, tableId, t);
    };
  };

  public shared ({ caller }) func joinTable(tableId : Nat, seatIndex : Nat, buyIn : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (seatIndex >= MAX_SEATS) { return false };
    if (buyIn < MIN_BUY_IN or buyIn > MAX_BUY_IN) { return false };
    switch (Map.get(tables, Nat.compare, tableId)) {
      case (?t) {
        if (seatIndex >= t.maxSeats) { return false };
        if (t.seats[seatIndex] != null) { return false };
        if (isPlayerSeated(t.seats, caller)) { return false };
        switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
          case (?walletId) {
            let w : WalletActor = actor (walletId);
            let paid = await w.spendLoveFor(caller, buyIn);
            if (not paid) { return false };
            let name = await authUsername(caller);
            let newSeat : SeatState = {
              player = caller;
              playerName = name;
              stack = buyIn;
              holeCards = [];
              betThisRound = 0;
              betThisHand = 0;
              folded = false;
              allIn = false;
              hasActed = false;
              inHand = false;
              missedTurns = 0;
            };
            let newSeats = Array.tabulate<?SeatState>(
              MAX_SEATS,
              func(i : Nat) : ?SeatState {
                if (i == seatIndex) { ?newSeat } else { t.seats[i] };
              },
            );
            let updated = { t with seats = newSeats };
            let dealt = await maybeAutoDeal(updated);
            Map.add(tables, Nat.compare, tableId, dealt);
            true
          };
          case null { false };
        }
      };
      case null { false };
    }
  };

  // Auto-folds seat `idx` if it's mid-hand and figures out whose turn/round
  // status follows, without removing the seat. Returns the updated table.
  func autoFoldSeat(t : Table, idx : Nat, seat : SeatState, extraMissed : Nat) : Table {
    let foldedSeat = { seat with folded = true; hasActed = true; missedTurns = seat.missedTurns + extraMissed };
    var working = setSeat(t, idx, ?foldedSeat);
    if (countLiveNotFolded(working.seats) == 1) {
      working := awardPotToLastStanding(working);
    } else if (working.toActSeat == idx and isBettingPhase(working.phase)) {
      if (isRoundComplete(working)) {
        working := advanceStreetOrShowdown(working);
      } else {
        switch (nextLiveSeat(working.seats, idx)) {
          case (?nxt) { working := { working with toActSeat = nxt } };
          case null {};
        };
      };
    };
    working
  };

  func removeSeatAndPayout(t : Table, idx : Nat) : async Table {
    let seat = switch (t.seats[idx]) {
      case (?s) { s };
      case null { Runtime.trap("unreachable") };
    };
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
      case (?walletId) {
        let w : WalletActor = actor (walletId);
        if (seat.stack > 0) { ignore await w.earnLoveFor(seat.player, seat.stack) };
      };
      case null {};
    };
    let newSeats = Array.tabulate<?SeatState>(
      MAX_SEATS,
      func(j : Nat) : ?SeatState { if (j == idx) { null } else { t.seats[j] } },
    );
    { t with seats = newSeats }
  };

  // Leave the table at any time, taking your current stack with you. If
  // you're mid-hand, you're auto-folded first (forfeiting what you've
  // already put in the pot this hand) before your remaining chips are
  // paid back to your Wallet.
  public shared ({ caller }) func leaveTable(tableId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(tables, Nat.compare, tableId)) {
      case (?t) {
        var idx : ?Nat = null;
        var i = 0;
        for (s in t.seats.vals()) {
          switch (s) {
            case (?seat) { if (Principal.equal(seat.player, caller)) { idx := ?i } };
            case null {};
          };
          i += 1;
        };
        switch (idx) {
          case (?ix) {
            let seat = switch (t.seats[ix]) {
              case (?s) { s };
              case null { Runtime.trap("unreachable") };
            };
            var working = t;
            if (seat.inHand and not seat.folded) {
              working := autoFoldSeat(t, ix, seat, 0);
            };
            let paidOut = await removeSeatAndPayout(working, ix);
            saveOrDeleteTable(tableId, paidOut);
            true
          };
          case null { false };
        }
      };
      case null { false };
    }
  };

  // Any seated player can call this when the person on the clock has
  // been unresponsive for a while. It auto-folds them for this hand and
  // adds to their missed-turn count; after 10 misses in a row they're
  // automatically removed from the table with their current stack.
  public shared ({ caller }) func skipInactivePlayer(tableId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(tables, Nat.compare, tableId)) {
      case (?t) {
        if (not isBettingPhase(t.phase)) { return false };
        if (not isPlayerSeated(t.seats, caller)) { return false };
        let idx = t.toActSeat;
        let seat = switch (t.seats[idx]) {
          case (?s) { s };
          case null { return false };
        };
        if (Principal.equal(seat.player, caller)) { return false };
        if (not seat.inHand or seat.folded or seat.allIn) { return false };

        let working = autoFoldSeat(t, idx, seat, 1);
        if ((seat.missedTurns + 1) >= 10) {
          let removed = await removeSeatAndPayout(working, idx);
          saveOrDeleteTable(tableId, removed);
        } else {
          Map.add(tables, Nat.compare, tableId, working);
        };
        true
      };
      case null { false };
    }
  };


  func isBettingPhase(p : Phase) : Bool {
    p == #preflop or p == #flop or p == #turn or p == #river
  };

  func setSeat(t : Table, idx : Nat, seat : ?SeatState) : Table {
    let newSeats = Array.tabulate<?SeatState>(
      MAX_SEATS,
      func(i : Nat) : ?SeatState { if (i == idx) { seat } else { t.seats[i] } },
    );
    { t with seats = newSeats }
  };

  func resetOthersActed(t : Table, exceptIdx : Nat) : Table {
    let newSeats = Array.tabulate<?SeatState>(
      MAX_SEATS,
      func(i : Nat) : ?SeatState {
        if (i == exceptIdx) { t.seats[i] } else {
          switch (t.seats[i]) {
            case (?seat) {
              if (seat.inHand and not seat.folded and not seat.allIn) { ?{ seat with hasActed = false } }
              else { ?seat };
            };
            case null { null };
          };
        };
      },
    );
    { t with seats = newSeats }
  };

  func awardPotToLastStanding(t : Table) : Table {
    var winnerIdx = 0;
    var i = 0;
    while (i < MAX_SEATS) {
      switch (t.seats[i]) {
        case (?seat) { if (seat.inHand and not seat.folded) { winnerIdx := i } };
        case null {};
      };
      i += 1;
    };
    let winnerSeat = switch (t.seats[winnerIdx]) {
      case (?s) { s };
      case null { Runtime.trap("unreachable") };
    };
    let newSeat = { winnerSeat with stack = winnerSeat.stack + t.pot };
    let updated = setSeat(t, winnerIdx, ?newSeat);
    { updated with pot = 0; phase = #handComplete; winnerText = winnerSeat.playerName # " wins! Everyone else folded." }
  };

  func isRoundComplete(t : Table) : Bool {
    var allMatched = true;
    for (s in t.seats.vals()) {
      switch (s) {
        case (?seat) {
          if (seat.inHand and not seat.folded and not seat.allIn) {
            if (not seat.hasActed or seat.betThisRound != t.currentBet) { allMatched := false };
          };
        };
        case null {};
      };
    };
    allMatched
  };

  func countLiveCanAct(seats : [?SeatState]) : Nat {
    var n = 0;
    for (s in seats.vals()) {
      switch (s) {
        case (?seat) { if (seat.inHand and not seat.folded and not seat.allIn) { n += 1 } };
        case null {};
      };
    };
    n
  };

  func dealCommunity(deck : [Card], count : Nat) : ([Card], [Card]) {
    let dealt = Array.tabulate<Card>(count, func(i : Nat) : Card { deck[i] });
    let rest = Array.tabulate<Card>(deck.size() - count, func(i : Nat) : Card { deck[i + count] });
    (dealt, rest)
  };

  func resetForNewStreet(t : Table) : Table {
    let newSeats = Array.tabulate<?SeatState>(
      MAX_SEATS,
      func(i : Nat) : ?SeatState {
        switch (t.seats[i]) {
          case (?seat) { ?{ seat with betThisRound = 0; hasActed = false } };
          case null { null };
        };
      },
    );
    { t with seats = newSeats; currentBet = 0 }
  };

  // ---- 7-card Texas Hold'em hand evaluator ----
  let COMBOS_7_5 : [[Nat]] = [
    [0, 1, 2, 3, 4], [0, 1, 2, 3, 5], [0, 1, 2, 3, 6], [0, 1, 2, 4, 5], [0, 1, 2, 4, 6],
    [0, 1, 2, 5, 6], [0, 1, 3, 4, 5], [0, 1, 3, 4, 6], [0, 1, 3, 5, 6], [0, 1, 4, 5, 6],
    [0, 2, 3, 4, 5], [0, 2, 3, 4, 6], [0, 2, 3, 5, 6], [0, 2, 4, 5, 6], [0, 3, 4, 5, 6],
    [1, 2, 3, 4, 5], [1, 2, 3, 4, 6], [1, 2, 3, 5, 6], [1, 2, 4, 5, 6], [1, 3, 4, 5, 6],
    [2, 3, 4, 5, 6],
  ];

  func compareScores(a : [Nat], b : [Nat]) : Order.Order {
    var i = 0;
    var result : Order.Order = #equal;
    label done loop {
      if (i >= a.size()) { break done };
      if (a[i] > b[i]) { result := #greater; break done };
      if (a[i] < b[i]) { result := #less; break done };
      i += 1;
    };
    result
  };

  func evaluate5(cards : [Card]) : [Nat] {
    let ranksRaw = Array.map<Card, Nat>(cards, func(c : Card) : Nat { c.rank });
    let ranksDesc = Array.sort<Nat>(
      ranksRaw,
      func(a : Nat, b : Nat) : Order.Order {
        if (a > b) { #less } else if (a < b) { #greater } else { #equal };
      },
    );

    let suits = Array.map<Card, Suit>(cards, func(c : Card) : Suit { c.suit });
    let isFlush = suits[0] == suits[1] and suits[0] == suits[2] and suits[0] == suits[3] and suits[0] == suits[4];

    var allDistinct = true;
    var di = 0;
    while (di < 4) {
      if (ranksDesc[di] == ranksDesc[di + 1]) { allDistinct := false };
      di += 1;
    };

    var isStraight = false;
    var straightHigh = 0;
    if (allDistinct) {
      if (ranksDesc[0] - ranksDesc[4] == 4) {
        isStraight := true;
        straightHigh := ranksDesc[0];
      } else if (ranksDesc[0] == 14 and ranksDesc[1] == 5 and ranksDesc[2] == 4 and ranksDesc[3] == 3 and ranksDesc[4] == 2) {
        isStraight := true;
        straightHigh := 5;
      };
    };

    let countsArr = Array.toVarArray<Nat>(Array.tabulate<Nat>(15, func(_ : Nat) : Nat { 0 }));
    for (r in ranksDesc.vals()) { countsArr[r] += 1 };

    var groups : [(Nat, Nat)] = [];
    var r = 14;
    label collect loop {
      if (countsArr[r] > 0) {
        groups := Array.concat<(Nat, Nat)>(groups, [(r, countsArr[r])]);
      };
      if (r == 2) { break collect };
      r -= 1;
    };

    let sortedGroups = Array.sort<(Nat, Nat)>(
      groups,
      func(a : (Nat, Nat), b : (Nat, Nat)) : Order.Order {
        if (a.1 > b.1) { #less } else if (a.1 < b.1) { #greater }
        else if (a.0 > b.0) { #less } else if (a.0 < b.0) { #greater }
        else { #equal };
      },
    );

    if (isFlush and isStraight) {
      [8, straightHigh, 0, 0, 0, 0];
    } else if (sortedGroups.size() == 2 and sortedGroups[0].1 == 4) {
      [7, sortedGroups[0].0, sortedGroups[1].0, 0, 0, 0];
    } else if (sortedGroups.size() == 2 and sortedGroups[0].1 == 3) {
      [6, sortedGroups[0].0, sortedGroups[1].0, 0, 0, 0];
    } else if (isFlush) {
      [5, ranksDesc[0], ranksDesc[1], ranksDesc[2], ranksDesc[3], ranksDesc[4]];
    } else if (isStraight) {
      [4, straightHigh, 0, 0, 0, 0];
    } else if (sortedGroups.size() == 3 and sortedGroups[0].1 == 3) {
      [3, sortedGroups[0].0, sortedGroups[1].0, sortedGroups[2].0, 0, 0];
    } else if (sortedGroups.size() == 3 and sortedGroups[0].1 == 2) {
      [2, sortedGroups[0].0, sortedGroups[1].0, sortedGroups[2].0, 0, 0];
    } else if (sortedGroups.size() == 4) {
      [1, sortedGroups[0].0, sortedGroups[1].0, sortedGroups[2].0, sortedGroups[3].0, 0];
    } else {
      [0, ranksDesc[0], ranksDesc[1], ranksDesc[2], ranksDesc[3], ranksDesc[4]];
    };
  };

  func evaluate7(cards : [Card]) : [Nat] {
    var best : [Nat] = [0, 0, 0, 0, 0, 0];
    for (combo in COMBOS_7_5.vals()) {
      let subset = Array.tabulate<Card>(5, func(i : Nat) : Card { cards[combo[i]] });
      let score = evaluate5(subset);
      if (compareScores(score, best) == #greater) { best := score };
    };
    best
  };

  // Multi-way showdown with proper side pots: pot is split into layers by
  // contribution level, each layer awarded to the best non-folded hand
  // among the players who contributed at least that much.
  func rankName(r : Nat) : Text {
    if (r == 14) { "Ace" }
    else if (r == 13) { "King" }
    else if (r == 12) { "Queen" }
    else if (r == 11) { "Jack" }
    else { Nat.toText(r) }
  };

  func handDescription(score : [Nat]) : Text {
    let cat = score[0];
    if (cat == 8) {
      if (score[1] == 14) { "a Royal Flush" } else { "a Straight Flush, " # rankName(score[1]) # " high" };
    } else if (cat == 7) {
      "Four of a Kind, " # rankName(score[1]) # "s";
    } else if (cat == 6) {
      "a Full House, " # rankName(score[1]) # "s over " # rankName(score[2]) # "s";
    } else if (cat == 5) {
      "a Flush, " # rankName(score[1]) # " high";
    } else if (cat == 4) {
      "a Straight, " # rankName(score[1]) # " high";
    } else if (cat == 3) {
      "Three of a Kind, " # rankName(score[1]) # "s";
    } else if (cat == 2) {
      "Two Pair, " # rankName(score[1]) # "s and " # rankName(score[2]) # "s";
    } else if (cat == 1) {
      "a Pair of " # rankName(score[1]) # "s";
    } else {
      rankName(score[1]) # " High";
    };
  };

  func doShowdown(t : Table) : Table {
    var contributors : [(Nat, Nat, Bool)] = [];
    var i = 0;
    while (i < MAX_SEATS) {
      switch (t.seats[i]) {
        case (?seat) {
          if (seat.inHand) {
            contributors := Array.concat<(Nat, Nat, Bool)>(contributors, [(i, seat.betThisHand, seat.folded)]);
          };
        };
        case null {};
      };
      i += 1;
    };

    let levelsRaw = Array.map<(Nat, Nat, Bool), Nat>(contributors, func(c : (Nat, Nat, Bool)) : Nat { c.1 });
    let levelsSortedAsc = Array.sort<Nat>(levelsRaw, Nat.compare);
    var levels : [Nat] = [];
    for (lv in levelsSortedAsc.vals()) {
      if (levels.size() == 0 or levels[levels.size() - 1] != lv) {
        levels := Array.concat<Nat>(levels, [lv]);
      };
    };

    let payouts = Array.toVarArray<Nat>(Array.tabulate<Nat>(MAX_SEATS, func(_ : Nat) : Nat { 0 }));
    var prevLevel = 0;

    for (level in levels.vals()) {
      let layerContributors = Array.filter<(Nat, Nat, Bool)>(contributors, func(c : (Nat, Nat, Bool)) : Bool { c.1 >= level });
      let layerSize = (level - prevLevel : Nat) * layerContributors.size();
      if (layerSize > 0) {
        let eligible = Array.filter<(Nat, Nat, Bool)>(layerContributors, func(c : (Nat, Nat, Bool)) : Bool { not c.2 });
        if (eligible.size() > 0) {
          var bestScore : [Nat] = [0, 0, 0, 0, 0, 0];
          var bestIdxs : [Nat] = [];
          for ((idx, _, _) in eligible.vals()) {
            let seat = switch (t.seats[idx]) { case (?s) { s }; case null { Runtime.trap("unreachable") } };
            let score = evaluate7(Array.concat<Card>(seat.holeCards, t.community));
            let cmp = compareScores(score, bestScore);
            if (cmp == #greater) { bestScore := score; bestIdxs := [idx] }
            else if (cmp == #equal) { bestIdxs := Array.concat<Nat>(bestIdxs, [idx]) };
          };
          let share = layerSize / bestIdxs.size();
          let remainder = layerSize - share * bestIdxs.size() : Nat;
          var first = true;
          for (idx in bestIdxs.vals()) {
            let extra = if (first) { remainder } else { 0 };
            payouts[idx] += share + extra;
            first := false;
          };
        } else {
          let (fallbackIdx, _, _) = layerContributors[0];
          payouts[fallbackIdx] += layerSize;
        };
      };
      prevLevel := level;
    };

    let newSeats = Array.tabulate<?SeatState>(
      MAX_SEATS,
      func(i2 : Nat) : ?SeatState {
        switch (t.seats[i2]) {
          case (?seat) { ?{ seat with stack = seat.stack + payouts[i2] } };
          case null { null };
        };
      },
    );

    // Headline message: the single best hand among everyone still in
    // (not folded) at showdown — matches the main-pot winner in nearly
    // all cases, including simple multi-way side-pot situations.
    var headlineScore : [Nat] = [0, 0, 0, 0, 0, 0];
    var headlineIdxs : [Nat] = [];
    for ((idx, _, folded) in contributors.vals()) {
      if (not folded) {
        let seat = switch (t.seats[idx]) { case (?s) { s }; case null { Runtime.trap("unreachable") } };
        let score = evaluate7(Array.concat<Card>(seat.holeCards, t.community));
        let cmp = compareScores(score, headlineScore);
        if (cmp == #greater) { headlineScore := score; headlineIdxs := [idx] }
        else if (cmp == #equal) { headlineIdxs := Array.concat<Nat>(headlineIdxs, [idx]) };
      };
    };
    var names = "";
    var firstName = true;
    for (idx in headlineIdxs.vals()) {
      let seat = switch (t.seats[idx]) { case (?s) { s }; case null { Runtime.trap("unreachable") } };
      names := names # (if (firstName) { "" } else { " and " }) # seat.playerName;
      firstName := false;
    };
    let verb = if (headlineIdxs.size() > 1) { " split the pot with " } else { " wins with " };
    let winText = names # verb # handDescription(headlineScore) # "!";

    { t with seats = newSeats; pot = 0; phase = #handComplete; winnerText = winText }
  };

  func advanceStreetOrShowdown(t : Table) : Table {
    var current = resetForNewStreet(t);

    switch (current.phase) {
      case (#preflop) {
        let (newCards, rest) = dealCommunity(current.deck, 3);
        current := { current with community = newCards; deck = rest; phase = #flop };
      };
      case (#flop) {
        let (newCards, rest) = dealCommunity(current.deck, 1);
        current := { current with community = Array.concat<Card>(current.community, newCards); deck = rest; phase = #turn };
      };
      case (#turn) {
        let (newCards, rest) = dealCommunity(current.deck, 1);
        current := { current with community = Array.concat<Card>(current.community, newCards); deck = rest; phase = #river };
      };
      case (_) {};
    };

    switch (nextLiveSeat(current.seats, current.dealerSeat)) {
      case (?idx) { current := { current with toActSeat = idx } };
      case null {};
    };

    if (current.phase == #river) {
      doShowdown(current);
    } else if (countLiveCanAct(current.seats) <= 1) {
      advanceStreetOrShowdown(current);
    } else {
      current;
    };
  };

  public shared ({ caller }) func act(tableId : Nat, actionKind : Text, raiseTo : Nat) : async Bool {
    switch (Map.get(tables, Nat.compare, tableId)) {
      case (?t) {
        if (not isBettingPhase(t.phase)) { return false };
        var mySeatIdx : ?Nat = null;
        var i = 0;
        for (s in t.seats.vals()) {
          switch (s) {
            case (?seat) { if (Principal.equal(seat.player, caller)) { mySeatIdx := ?i } };
            case null {};
          };
          i += 1;
        };
        let myIdx = switch (mySeatIdx) { case (?ix) { ix }; case null { return false } };
        if (myIdx != t.toActSeat) { return false };
        let mySeat = switch (t.seats[myIdx]) { case (?s) { s }; case null { return false } };
        if (mySeat.folded or mySeat.allIn or not mySeat.inHand) { return false };

        var updated = t;
        var handEnded = false;

        if (actionKind == "fold") {
          let newSeat = { mySeat with folded = true; hasActed = true; missedTurns = 0 };
          updated := setSeat(t, myIdx, ?newSeat);
          if (countLiveNotFolded(updated.seats) == 1) {
            updated := awardPotToLastStanding(updated);
            handEnded := true;
          };
        } else if (actionKind == "check") {
          if (mySeat.betThisRound != t.currentBet) { return false };
          let newSeat = { mySeat with hasActed = true; missedTurns = 0 };
          updated := setSeat(t, myIdx, ?newSeat);
        } else if (actionKind == "call") {
          let toCall = if (t.currentBet > mySeat.betThisRound) { t.currentBet - mySeat.betThisRound } else { 0 };
          let actual = Nat.min(toCall, mySeat.stack);
          let newSeat = {
            mySeat with
            stack = mySeat.stack - actual : Nat;
            betThisRound = mySeat.betThisRound + actual;
            betThisHand = mySeat.betThisHand + actual;
            hasActed = true;
            allIn = (mySeat.stack - actual : Nat) == 0;
            missedTurns = 0;
          };
          updated := setSeat(t, myIdx, ?newSeat);
          updated := { updated with pot = updated.pot + actual };
        } else if (actionKind == "bet") {
          if (raiseTo <= t.currentBet) { return false };
          let cap = mySeat.stack + mySeat.betThisRound;
          if (raiseTo > cap) { return false };
          let addAmount = raiseTo - mySeat.betThisRound : Nat;
          let newSeat = {
            mySeat with
            stack = mySeat.stack - addAmount : Nat;
            betThisRound = raiseTo;
            betThisHand = mySeat.betThisHand + addAmount;
            hasActed = true;
            allIn = (mySeat.stack - addAmount : Nat) == 0;
            missedTurns = 0;
          };
          updated := setSeat(t, myIdx, ?newSeat);
          updated := { updated with pot = updated.pot + addAmount; currentBet = raiseTo };
          updated := resetOthersActed(updated, myIdx);
        } else {
          return false;
        };

        if (not handEnded) {
          if (isRoundComplete(updated)) {
            updated := advanceStreetOrShowdown(updated);
          } else {
            switch (nextLiveSeat(updated.seats, myIdx)) {
              case (?nxt) { updated := { updated with toActSeat = nxt } };
              case null {};
            };
          };
        };

        Map.add(tables, Nat.compare, tableId, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func startNextHand(tableId : Nat) : async Bool {
    switch (Map.get(tables, Nat.compare, tableId)) {
      case (?t) {
        if (not isPlayerSeated(t.seats, caller)) { return false };
        if (t.phase != #handComplete) { return false };
        let clearedSeats = Array.tabulate<?SeatState>(
          MAX_SEATS,
          func(i : Nat) : ?SeatState {
            switch (t.seats[i]) {
              case (?seat) {
                if (seat.stack == 0) { null } else {
                  ?{
                    seat with
                    inHand = false;
                    folded = false;
                    allIn = false;
                    holeCards = [];
                    betThisRound = 0;
                    betThisHand = 0;
                    hasActed = false;
                  };
                };
              };
              case null { null };
            };
          },
        );
        let cleared = { t with seats = clearedSeats; phase = #waiting };
        let dealt = await maybeAutoDeal(cleared);
        Map.add(tables, Nat.compare, tableId, dealt);
        true
      };
      case null { false };
    }
  };
};
