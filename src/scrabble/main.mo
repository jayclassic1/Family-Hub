import Map "mo:core/Map";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";

persistent actor {

  type PlacedTile = { row : Nat; col : Nat; letter : Text };

  type Turn = {
    id : Nat;
    player : Principal;
    playerName : Text;
    placements : [PlacedTile];
    score : Nat;
    passed : Bool;
    exchanged : Bool;
    timestamp : Int;
    disputed : Bool;
    resolved : Bool;
    upheld : Bool;
  };

  type Dispute = {
    turnId : Nat;
    raisedBy : Principal;
    votes : [(Principal, Bool)];
    resolved : Bool;
    outcome : ?Bool;
    coinFlipped : Bool;
  };

  type Player = {
    id : Principal;
    name : Text;
    rack : [Text];
    score : Nat;
  };

  type GameStatus = { #waiting; #active; #finished };

  type ChatMsg = {
    id : Nat;
    sender : Principal;
    senderName : Text;
    text : Text;
    timestamp : Int;
  };

  type Game = {
    id : Nat;
    name : Text;
    creator : Principal;
    maxPlayers : Nat;
    players : [Player];
    board : [PlacedTile];
    bag : [Text];
    turnOrder : [Principal];
    currentTurnIndex : Nat;
    turns : [Turn];
    disputes : [Dispute];
    status : GameStatus;
    created : Int;
    chat : [ChatMsg];
  };

  type PlayerPublic = {
    id : Principal;
    name : Text;
    rackCount : Nat;
    myRack : ?[Text];
    score : Nat;
  };

  type GamePublic = {
    id : Nat;
    name : Text;
    creator : Principal;
    maxPlayers : Nat;
    players : [PlayerPublic];
    board : [PlacedTile];
    bagCount : Nat;
    turnOrder : [Principal];
    currentTurnPlayer : ?Principal;
    turns : [Turn];
    disputes : [Dispute];
    status : GameStatus;
    created : Int;
    chat : [ChatMsg];
  };

  let games = Map.empty<Nat, Game>();
  var gameCounter : Nat = 0;

  let LETTER_COUNTS : [(Text, Nat)] = [
    ("E", 12), ("A", 9), ("I", 9), ("O", 8), ("N", 6), ("R", 6), ("T", 6),
    ("L", 4), ("S", 4), ("U", 4), ("D", 4), ("G", 3),
    ("B", 2), ("C", 2), ("M", 2), ("P", 2), ("F", 2), ("H", 2), ("V", 2), ("W", 2), ("Y", 2),
    ("K", 1), ("J", 1), ("X", 1), ("Q", 1), ("Z", 1), ("_", 2),
  ];

  func freshBag() : [Text] {
    var out : [Text] = [];
    for ((letter, count) in LETTER_COUNTS.vals()) {
      var i = 0;
      while (i < count) {
        out := Array.concat(out, [letter]);
        i += 1;
      };
    };
    out;
  };

  // Simple deterministic shuffle seeded off the current time — good enough
  // for a casual family game, not cryptographic.
  func shuffle(arr : [Text], seed : Int) : [Text] {
    var a = arr;
    var s = seed;
    var i = a.size();
    while (i > 1) {
      i -= 1;
      s := (s * 1103515245 + 12345) % 2147483648;
      let j = Int.abs(s) % (i + 1);
      let tmp = a[i];
      a := Array.tabulate<Text>(
        a.size(),
        func(k : Nat) : Text {
          if (k == i) { a[j] } else if (k == j) { tmp } else { a[k] };
        },
      );
    };
    a;
  };

  func drawTiles(bag : [Text], count : Nat) : ([Text], [Text]) {
    let n = if (count < bag.size()) { count } else { bag.size() };
    let drawn = Array.tabulate<Text>(n, func(i : Nat) : Text { bag[i] });
    let remaining = Array.tabulate<Text>(
      bag.size() - n,
      func(i : Nat) : Text { bag[i + n] },
    );
    (drawn, remaining);
  };

  func removeFromRack(rack : [Text], toRemove : [Text]) : ?[Text] {
    var remaining = rack;
    for (letter in toRemove.vals()) {
      var found = false;
      var newRemaining : [Text] = [];
      for (r in remaining.vals()) {
        if ((not found) and r == letter) {
          found := true;
        } else {
          newRemaining := Array.concat(newRemaining, [r]);
        };
      };
      if (not found) { return null };
      remaining := newRemaining;
    };
    ?remaining;
  };

  let LETTER_VALUES : [(Text, Nat)] = [
    ("A", 1), ("B", 3), ("C", 3), ("D", 2), ("E", 1), ("F", 4), ("G", 2), ("H", 4), ("I", 1), ("J", 8),
    ("K", 5), ("L", 1), ("M", 3), ("N", 1), ("O", 1), ("P", 3), ("Q", 10), ("R", 1), ("S", 1), ("T", 1),
    ("U", 1), ("V", 4), ("W", 4), ("X", 8), ("Y", 4), ("Z", 10), ("_", 0),
  ];

  func letterValue(letter : Text) : Nat {
    switch (Array.find<(Text, Nat)>(LETTER_VALUES, func((l, _v) : (Text, Nat)) : Bool { l == letter })) {
      case (?(_l, v)) { v };
      case null { 0 };
    };
  };

  let TW_SQ : [(Int, Int)] = [(0, 0), (0, 7), (0, 14), (7, 0), (7, 14), (14, 0), (14, 7), (14, 14)];
  let DW_SQ : [(Int, Int)] = [
    (1, 1), (2, 2), (3, 3), (4, 4), (1, 13), (2, 12), (3, 11), (4, 10),
    (13, 1), (12, 2), (11, 3), (10, 4), (13, 13), (12, 12), (11, 11), (10, 10),
  ];
  let TL_SQ : [(Int, Int)] = [(1, 5), (1, 9), (5, 1), (5, 5), (5, 9), (5, 13), (9, 1), (9, 5), (9, 9), (9, 13), (13, 5), (13, 9)];
  let DL_SQ : [(Int, Int)] = [
    (0, 3), (0, 11), (2, 6), (2, 8), (3, 0), (3, 7), (3, 14), (6, 2), (6, 6), (6, 8), (6, 12),
    (7, 3), (7, 11), (8, 2), (8, 6), (8, 8), (8, 12), (11, 0), (11, 7), (11, 14), (12, 6), (12, 8), (14, 3), (14, 11),
  ];

  func hasSquare(list : [(Int, Int)], r : Int, c : Int) : Bool {
    Array.find<(Int, Int)>(list, func((rr, cc) : (Int, Int)) : Bool { rr == r and cc == c }) != null;
  };

  func bonusAt(r : Int, c : Int) : Text {
    if (r == 7 and c == 7) { return "STAR" };
    if (hasSquare(TW_SQ, r, c)) { return "TW" };
    if (hasSquare(DW_SQ, r, c)) { return "DW" };
    if (hasSquare(TL_SQ, r, c)) { return "TL" };
    if (hasSquare(DL_SQ, r, c)) { return "DL" };
    "";
  };

  func tileAtRC(board : [PlacedTile], placements : [PlacedTile], r : Int, c : Int) : ?Text {
    if (r < 0 or r > 14 or c < 0 or c > 14) { return null };
    let rn = Int.abs(r);
    let cn = Int.abs(c);
    switch (Array.find<PlacedTile>(placements, func(p : PlacedTile) : Bool { p.row == rn and p.col == cn })) {
      case (?p) { return ?p.letter };
      case null {};
    };
    switch (Array.find<PlacedTile>(board, func(p : PlacedTile) : Bool { p.row == rn and p.col == cn })) {
      case (?p) { ?p.letter };
      case null { null };
    };
  };

  func isNewTileRC(placements : [PlacedTile], r : Int, c : Int) : Bool {
    if (r < 0 or c < 0) { return false };
    let rn = Int.abs(r);
    let cn = Int.abs(c);
    Array.find<PlacedTile>(placements, func(p : PlacedTile) : Bool { p.row == rn and p.col == cn }) != null;
  };

  func wordScore(board : [PlacedTile], placements : [PlacedTile], startR : Int, startC : Int, dR : Int, dC : Int) : Nat {
    var r = startR;
    var c = startC;
    while (tileAtRC(board, placements, r - dR, c - dC) != null) {
      r -= dR;
      c -= dC;
    };
    var wordMult = 1;
    var total = 0;
    var length = 0;
    var keepGoing = true;
    while (keepGoing) {
      switch (tileAtRC(board, placements, r, c)) {
        case (?letter) {
          var letterScore = letterValue(letter);
          if (isNewTileRC(placements, r, c)) {
            let bonus = bonusAt(r, c);
            if (bonus == "DL") { letterScore *= 2 };
            if (bonus == "TL") { letterScore *= 3 };
            if (bonus == "DW" or bonus == "STAR") { wordMult *= 2 };
            if (bonus == "TW") { wordMult *= 3 };
          };
          total += letterScore;
          length += 1;
          r += dR;
          c += dC;
        };
        case null { keepGoing := false };
      };
    };
    if (length <= 1) { return 0 };
    total * wordMult;
  };

  func isStraightLine(placements : [PlacedTile]) : Bool {
    if (placements.size() <= 1) { return true };
    let firstRow = placements[0].row;
    let firstCol = placements[0].col;
    var sameRow = true;
    var sameCol = true;
    for (p in placements.vals()) {
      if (p.row != firstRow) { sameRow := false };
      if (p.col != firstCol) { sameCol := false };
    };
    sameRow or sameCol;
  };

  func computeScore(board : [PlacedTile], placements : [PlacedTile]) : Nat {
    if (placements.size() == 0) { return 0 };
    var total = 0;
    if (placements.size() == 1) {
      let p = placements[0];
      let pr : Int = p.row;
      let pc : Int = p.col;
      total += wordScore(board, placements, pr, pc, 0, 1);
      total += wordScore(board, placements, pr, pc, 1, 0);
    } else {
      let firstRow = placements[0].row;
      let firstCol = placements[0].col;
      var sameRow = true;
      var sameCol = true;
      for (p in placements.vals()) {
        if (p.row != firstRow) { sameRow := false };
        if (p.col != firstCol) { sameCol := false };
      };
      if (sameRow) {
        let pr : Int = firstRow;
        let pc0 : Int = placements[0].col;
        total += wordScore(board, placements, pr, pc0, 0, 1);
        for (p in placements.vals()) {
          let r : Int = p.row;
          let c : Int = p.col;
          total += wordScore(board, placements, r, c, 1, 0);
        };
      } else if (sameCol) {
        let pc : Int = firstCol;
        let pr0 : Int = placements[0].row;
        total += wordScore(board, placements, pr0, pc, 1, 0);
        for (p in placements.vals()) {
          let r : Int = p.row;
          let c : Int = p.col;
          total += wordScore(board, placements, r, c, 0, 1);
        };
      };
    };
    if (placements.size() == 7) { total += 50 };
    total;
  };

  func findPlayer(g : Game, p : Principal) : ?Player {
    Array.find<Player>(g.players, func(pl : Player) : Bool { Principal.equal(pl.id, p) });
  };

  func isInGame(g : Game, p : Principal) : Bool {
    findPlayer(g, p) != null;
  };

  func updatePlayer(players : [Player], id : Principal, f : (Player) -> Player) : [Player] {
    Array.map<Player, Player>(
      players,
      func(pl : Player) : Player {
        if (Principal.equal(pl.id, id)) { f(pl) } else { pl };
      },
    );
  };

  func toPlayerPublic(pl : Player, caller : Principal) : PlayerPublic {
    {
      id = pl.id;
      name = pl.name;
      rackCount = pl.rack.size();
      myRack = if (Principal.equal(pl.id, caller)) { ?pl.rack } else { null };
      score = pl.score;
    };
  };

  func toPublic(g : Game, caller : Principal) : GamePublic {
    let currentTurnPlayer = if (g.status == #active and g.turnOrder.size() > 0) {
      ?g.turnOrder[g.currentTurnIndex % g.turnOrder.size()];
    } else { null };
    {
      id = g.id;
      name = g.name;
      creator = g.creator;
      maxPlayers = g.maxPlayers;
      players = Array.map<Player, PlayerPublic>(g.players, func(pl : Player) : PlayerPublic { toPlayerPublic(pl, caller) });
      board = g.board;
      bagCount = g.bag.size();
      turnOrder = g.turnOrder;
      currentTurnPlayer;
      turns = g.turns;
      disputes = g.disputes;
      status = g.status;
      created = g.created;
      chat = g.chat;
    };
  };

  public shared ({ caller }) func createGame(name : Text, maxPlayers : Nat) : async Nat {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Anonymous callers cannot create games") };
    if (maxPlayers < 2 or maxPlayers > 4) { Runtime.trap("maxPlayers must be 2-4") };
    let id = gameCounter;
    let creatorPlayer : Player = { id = caller; name = "Player"; rack = []; score = 0 };
    let g : Game = {
      id;
      name;
      creator = caller;
      maxPlayers;
      players = [creatorPlayer];
      board = [];
      bag = [];
      turnOrder = [];
      currentTurnIndex = 0;
      turns = [];
      disputes = [];
      status = #waiting;
      created = Time.now();
      chat = [];
    };
    Map.add(games, Nat.compare, id, g);
    gameCounter += 1;
    id;
  };

  public shared ({ caller }) func setMyName(gameId : Nat, name : Text) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not isInGame(g, caller)) { return false };
        let updated = { g with players = updatePlayer(g.players, caller, func(pl : Player) : Player { { pl with name } }) };
        Map.add(games, Nat.compare, gameId, updated);
        true;
      };
      case null { false };
    };
  };

  public shared ({ caller }) func sendGameChat(gameId : Nat, text : Text) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not isInGame(g, caller)) { return false };
        if (Text.size(text) == 0) { return false };
        switch (findPlayer(g, caller)) {
          case (?pl) {
            let msg : ChatMsg = {
              id = g.chat.size();
              sender = caller;
              senderName = pl.name;
              text;
              timestamp = Time.now();
            };
            let updated = { g with chat = Array.concat(g.chat, [msg]) };
            Map.add(games, Nat.compare, gameId, updated);
            true;
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  public shared ({ caller }) func joinGame(gameId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (g.status != #waiting) { return false };
        if (g.players.size() >= g.maxPlayers) { return false };
        if (isInGame(g, caller)) { return false };
        let newPlayer : Player = { id = caller; name = "Player"; rack = []; score = 0 };
        let updated = { g with players = Array.concat(g.players, [newPlayer]) };
        Map.add(games, Nat.compare, gameId, updated);
        true;
      };
      case null { false };
    };
  };

  public shared ({ caller }) func leaveGame(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (g.status == #finished) { return false };
        if (not isInGame(g, caller)) { return false };
        switch (findPlayer(g, caller)) {
          case (?leavingPlayer) {
            let remaining = Array.filter<Player>(g.players, func(pl : Player) : Bool { not Principal.equal(pl.id, caller) });
            if (remaining.size() == 0) {
              ignore Map.remove(games, Nat.compare, gameId);
              return true;
            };
            let newCreator = if (Principal.equal(g.creator, caller)) { remaining[0].id } else { g.creator };
            if (g.status == #waiting) {
              let updated = { g with players = remaining; creator = newCreator };
              Map.add(games, Nat.compare, gameId, updated);
              return true;
            };
            let newBag = Array.concat(g.bag, leavingPlayer.rack);
            let newTurnOrder = Array.filter<Principal>(g.turnOrder, func(p : Principal) : Bool { not Principal.equal(p, caller) });
            if (newTurnOrder.size() < 2) {
              let updated = {
                g with
                players = remaining;
                creator = newCreator;
                bag = newBag;
                turnOrder = newTurnOrder;
                status = #finished;
              };
              Map.add(games, Nat.compare, gameId, updated);
              return true;
            };
            let newIndex = g.currentTurnIndex % newTurnOrder.size();
            let updated = {
              g with
              players = remaining;
              creator = newCreator;
              bag = newBag;
              turnOrder = newTurnOrder;
              currentTurnIndex = newIndex;
            };
            Map.add(games, Nat.compare, gameId, updated);
            true;
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  public shared ({ caller }) func deleteGame(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not Principal.equal(g.creator, caller)) { return false };
        ignore Map.remove(games, Nat.compare, gameId);
        true;
      };
      case null { false };
    };
  };

  public shared ({ caller }) func startGame(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (g.status != #waiting) { return false };
        if (not Principal.equal(g.creator, caller)) { return false };
        if (g.players.size() < 2) { return false };
        var bag = shuffle(freshBag(), Time.now());
        var players : [Player] = [];
        for (pl in g.players.vals()) {
          let (drawn, rest) = drawTiles(bag, 7);
          bag := rest;
          players := Array.concat(players, [{ pl with rack = drawn }]);
        };
        let turnOrder = Array.map<Player, Principal>(players, func(pl : Player) : Principal { pl.id });
        let updated = {
          g with
          players;
          bag;
          turnOrder;
          currentTurnIndex = 0;
          status = #active;
        };
        Map.add(games, Nat.compare, gameId, updated);
        true;
      };
      case null { false };
    };
  };

  public shared ({ caller }) func placeTiles(gameId : Nat, placements : [PlacedTile]) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (g.status != #active) { return false };
        if (g.turnOrder.size() == 0) { return false };
        let currentPlayerId = g.turnOrder[g.currentTurnIndex % g.turnOrder.size()];
        if (not Principal.equal(currentPlayerId, caller)) { return false };
        if (placements.size() == 0) { return false };
        if (not isStraightLine(placements)) { return false };
        for (p in placements.vals()) {
          if (p.row > 14 or p.col > 14) { return false };
          let occupied = Array.find<PlacedTile>(g.board, func(t : PlacedTile) : Bool { t.row == p.row and t.col == p.col }) != null;
          if (occupied) { return false };
        };
        switch (findPlayer(g, caller)) {
          case (?pl) {
            let letters = Array.map<PlacedTile, Text>(placements, func(p : PlacedTile) : Text { p.letter });
            switch (removeFromRack(pl.rack, letters)) {
              case (?newRack) {
                let needed = 7 - newRack.size();
                let (drawn, restBag) = drawTiles(g.bag, needed);
                let filledRack = Array.concat(newRack, drawn);
                let turnScore = computeScore(g.board, placements);
                let players = updatePlayer(g.players, caller, func(p : Player) : Player {
                  { p with rack = filledRack; score = p.score + turnScore };
                });
                let turnId = g.turns.size();
                let turn : Turn = {
                  id = turnId;
                  player = caller;
                  playerName = pl.name;
                  placements;
                  score = turnScore;
                  passed = false;
                  exchanged = false;
                  timestamp = Time.now();
                  disputed = false;
                  resolved = true;
                  upheld = true;
                };
                let board = Array.concat(g.board, placements);
                let nextIndex = (g.currentTurnIndex + 1) % g.turnOrder.size();
                let gameOver = restBag.size() == 0 and filledRack.size() == 0;
                let updated = {
                  g with
                  players;
                  board;
                  bag = restBag;
                  turns = Array.concat(g.turns, [turn]);
                  currentTurnIndex = nextIndex;
                  status = if (gameOver) { #finished } else { #active };
                };
                Map.add(games, Nat.compare, gameId, updated);
                true;
              };
              case null { false };
            };
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  public shared ({ caller }) func passTurn(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (g.status != #active) { return false };
        if (g.turnOrder.size() == 0) { return false };
        let currentPlayerId = g.turnOrder[g.currentTurnIndex % g.turnOrder.size()];
        if (not Principal.equal(currentPlayerId, caller)) { return false };
        switch (findPlayer(g, caller)) {
          case (?pl) {
            let turnId = g.turns.size();
            let turn : Turn = {
              id = turnId;
              player = caller;
              playerName = pl.name;
              placements = [];
              score = 0;
              passed = true;
              exchanged = false;
              timestamp = Time.now();
              disputed = false;
              resolved = true;
              upheld = true;
            };
            let nextIndex = (g.currentTurnIndex + 1) % g.turnOrder.size();
            let updated = {
              g with
              turns = Array.concat(g.turns, [turn]);
              currentTurnIndex = nextIndex;
            };
            Map.add(games, Nat.compare, gameId, updated);
            true;
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  public shared ({ caller }) func exchangeTiles(gameId : Nat, letters : [Text]) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (g.status != #active) { return false };
        if (g.turnOrder.size() == 0) { return false };
        if (letters.size() == 0) { return false };
        if (g.bag.size() < 7) { return false };
        let currentPlayerId = g.turnOrder[g.currentTurnIndex % g.turnOrder.size()];
        if (not Principal.equal(currentPlayerId, caller)) { return false };
        switch (findPlayer(g, caller)) {
          case (?pl) {
            switch (removeFromRack(pl.rack, letters)) {
              case (?rackAfterRemoval) {
                let bagWithReturns = Array.concat(g.bag, letters);
                let shuffledBag = shuffle(bagWithReturns, Time.now());
                let (drawn, restBag) = drawTiles(shuffledBag, letters.size());
                let filledRack = Array.concat(rackAfterRemoval, drawn);
                let players = updatePlayer(g.players, caller, func(p : Player) : Player {
                  { p with rack = filledRack };
                });
                let turnId = g.turns.size();
                let turn : Turn = {
                  id = turnId;
                  player = caller;
                  playerName = pl.name;
                  placements = [];
                  score = 0;
                  passed = false;
                  exchanged = true;
                  timestamp = Time.now();
                  disputed = false;
                  resolved = true;
                  upheld = true;
                };
                let nextIndex = (g.currentTurnIndex + 1) % g.turnOrder.size();
                let updated = {
                  g with
                  players;
                  bag = restBag;
                  turns = Array.concat(g.turns, [turn]);
                  currentTurnIndex = nextIndex;
                };
                Map.add(games, Nat.compare, gameId, updated);
                true;
              };
              case null { false };
            };
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  public shared ({ caller }) func disputeTurn(gameId : Nat, turnId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not isInGame(g, caller)) { return false };
        if (turnId >= g.turns.size()) { return false };
        let t = g.turns[turnId];
        if (t.disputed or t.passed) { return false };
        let alreadyDisputed = Array.find<Dispute>(g.disputes, func(d : Dispute) : Bool { d.turnId == turnId }) != null;
        if (alreadyDisputed) { return false };
        let dispute : Dispute = {
          turnId;
          raisedBy = caller;
          votes = [];
          resolved = false;
          outcome = null;
          coinFlipped = false;
        };
        let turns = Array.map<Turn, Turn>(g.turns, func(tt : Turn) : Turn {
          if (tt.id == turnId) { { tt with disputed = true; resolved = false } } else { tt };
        });
        let updated = { g with turns; disputes = Array.concat(g.disputes, [dispute]) };
        Map.add(games, Nat.compare, gameId, updated);
        true;
      };
      case null { false };
    };
  };

  public shared ({ caller }) func voteDispute(gameId : Nat, turnId : Nat, uphold : Bool) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not isInGame(g, caller)) { return false };
        var found = false;
        var disputes : [Dispute] = [];
        for (d in g.disputes.vals()) {
          if (d.turnId == turnId and not d.resolved) {
            found := true;
            let alreadyVoted = Array.find<(Principal, Bool)>(d.votes, func(v : (Principal, Bool)) : Bool { Principal.equal(v.0, caller) }) != null;
            if (alreadyVoted) {
              disputes := Array.concat(disputes, [d]);
            } else {
              let votes = Array.concat(d.votes, [(caller, uphold)]);
              disputes := Array.concat(disputes, [{ d with votes }]);
            };
          } else {
            disputes := Array.concat(disputes, [d]);
          };
        };
        if (not found) { return false };
        let updated = { g with disputes };
        Map.add(games, Nat.compare, gameId, updated);
        ignore await maybeResolveDispute(gameId, turnId);
        true;
      };
      case null { false };
    };
  };

  func maybeResolveDispute(gameId : Nat, turnId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        let disputeOpt = Array.find<Dispute>(g.disputes, func(d : Dispute) : Bool { d.turnId == turnId and not d.resolved });
        switch (disputeOpt) {
          case (?d) {
            if (d.votes.size() < g.players.size()) { return false };
            var upholdCount = 0;
            var overturnCount = 0;
            for ((_, v) in d.votes.vals()) {
              if (v) { upholdCount += 1 } else { overturnCount += 1 };
            };
            var finalUphold = upholdCount > overturnCount;
            var coinFlipped = false;
            if (upholdCount == overturnCount) {
              coinFlipped := true;
              finalUphold := (Int.abs(Time.now()) % 2) == 0;
            };
            let t = g.turns[turnId];
            let players = if (not finalUphold) {
              updatePlayer(g.players, t.player, func(p : Player) : Player {
                { p with score = if (p.score >= t.score) { p.score - t.score } else { 0 } };
              });
            } else { g.players };
            let turns = Array.map<Turn, Turn>(g.turns, func(tt : Turn) : Turn {
              if (tt.id == turnId) { { tt with resolved = true; upheld = finalUphold } } else { tt };
            });
            let disputes = Array.map<Dispute, Dispute>(g.disputes, func(dd : Dispute) : Dispute {
              if (dd.turnId == turnId) { { dd with resolved = true; outcome = ?finalUphold; coinFlipped } } else { dd };
            });
            let updated = { g with players; turns; disputes };
            Map.add(games, Nat.compare, gameId, updated);
            true;
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  public query ({ caller }) func listGames() : async [GamePublic] {
    Array.map<Game, GamePublic>(
      Array.fromIter<Game>(Map.values(games)),
      func(g : Game) : GamePublic { toPublic(g, caller) },
    );
  };

  public query ({ caller }) func getGame(gameId : Nat) : async ?GamePublic {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) { ?toPublic(g, caller) };
      case null { null };
    };
  };
};
