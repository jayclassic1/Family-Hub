import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type ChessGame = Types.ChessGame;
  type ChessStatus = Types.ChessStatus;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  type WalletActor = actor {
    spendLoveFor : shared (Principal, Nat) -> async Bool;
    earnLoveFor : shared (Principal, Nat) -> async Bool;
  };

  let games = Map.empty<Nat, ChessGame>();
  var gameCounter : Nat = 0;

  let STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

  func getWallet() : async ?WalletActor {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:wallet")) {
      case (?walletId) { ?(actor (walletId) : WalletActor) };
      case null { null };
    }
  };

  func isFinished(s : ChessStatus) : Bool {
    switch (s) {
      case (#ongoing) { false };
      case (_) { true };
    }
  };

  // Pays out an already-escrowed wager once a game reaches a terminal
  // status. Draws refund both players their own wager back; a decisive
  // result (win, or opponent resigned) gives the winner both wagers.
  func payoutWager(g : ChessGame) : async () {
    if (g.wager == 0 or g.wagerPaidOut) { return };
    let black = switch (g.black) { case (?b) { b }; case null { return } };
    switch (await getWallet()) {
      case (?w) {
        switch (g.status) {
          case (#whiteWon or #resignedBlack) {
            ignore await w.earnLoveFor(g.white, g.wager * 2);
          };
          case (#blackWon or #resignedWhite) {
            ignore await w.earnLoveFor(black, g.wager * 2);
          };
          case (#draw) {
            ignore await w.earnLoveFor(g.white, g.wager);
            ignore await w.earnLoveFor(black, g.wager);
          };
          case (#ongoing) {};
        };
      };
      case null {};
    };
  };

  public shared ({ caller }) func createOpenGame(wager : Nat) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    if (wager > 0) {
      switch (await getWallet()) {
        case (?w) {
          let paid = await w.spendLoveFor(caller, wager);
          if (not paid) { Runtime.trap("Not enough Love for that wager") };
        };
        case null { Runtime.trap("Wallet unavailable") };
      };
    };
    let whiteName = await authUsername(caller);
    let id = gameCounter;
    let g : ChessGame = {
      id;
      white = caller;
      whiteName;
      black = null;
      blackName = null;
      isOpen = true;
      invitedPlayer = null;
      invitedName = null;
      fen = STARTING_FEN;
      moveHistory = [];
      status = #ongoing;
      turnIsWhite = true;
      created = Time.now();
      lastMoveAt = Time.now();
      wager;
      wagerPaidOut = false;
    };
    Map.add(games, Nat.compare, id, g);
    gameCounter += 1;
    id
  };

  public shared ({ caller }) func createInviteGame(invited : Principal, wager : Nat) : async Nat {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Not signed in");
    };
    if (Principal.equal(caller, invited)) {
      Runtime.trap("Cannot invite yourself");
    };
    if (wager > 0) {
      switch (await getWallet()) {
        case (?w) {
          let paid = await w.spendLoveFor(caller, wager);
          if (not paid) { Runtime.trap("Not enough Love for that wager") };
        };
        case null { Runtime.trap("Wallet unavailable") };
      };
    };
    let whiteName = await authUsername(caller);
    let invitedName = await authUsername(invited);
    let id = gameCounter;
    let g : ChessGame = {
      id;
      white = caller;
      whiteName;
      black = null;
      blackName = null;
      isOpen = false;
      invitedPlayer = ?invited;
      invitedName = ?invitedName;
      fen = STARTING_FEN;
      moveHistory = [];
      status = #ongoing;
      turnIsWhite = true;
      created = Time.now();
      lastMoveAt = Time.now();
      wager;
      wagerPaidOut = false;
    };
    Map.add(games, Nat.compare, id, g);
    gameCounter += 1;
    id
  };

  public shared ({ caller }) func cancelOpenGame(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (not Principal.equal(g.white, caller)) { return false };
        switch (g.black) { case (?_) { return false }; case null {} };
        if (isFinished(g.status)) { return false };
        if (g.wager > 0) {
          switch (await getWallet()) {
            case (?w) { ignore await w.earnLoveFor(g.white, g.wager) };
            case null {};
          };
        };
        let updated = { g with status = #draw : ChessStatus; wagerPaidOut = true };
        Map.add(games, Nat.compare, gameId, updated);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func joinGame(gameId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        switch (g.black) {
          case (?_) { return false };
          case null {};
        };
        if (Principal.equal(g.white, caller)) { return false };
        let allowed = if (g.isOpen) { true } else {
          switch (g.invitedPlayer) {
            case (?p) { Principal.equal(p, caller) };
            case null { false };
          }
        };
        if (not allowed) { return false };

        if (g.wager > 0) {
          switch (await getWallet()) {
            case (?w) {
              let paid = await w.spendLoveFor(caller, g.wager);
              if (not paid) { return false };
            };
            case null { return false };
          };
        };

        let blackName = await authUsername(caller);
        let updated : ChessGame = {
          g with
          black = ?caller;
          blackName = ?blackName;
          lastMoveAt = Time.now();
        };
        Map.add(games, Nat.compare, gameId, updated);
        true
      };
      case null { false };
    }
  };

  public query func listAllGames() : async [ChessGame] {
    Array.fromIter<ChessGame>(Map.values(games))
  };

  public query func listMyGames(caller : Principal) : async [ChessGame] {
    Array.filter<ChessGame>(
      Array.fromIter<ChessGame>(Map.values(games)),
      func(g : ChessGame) : Bool {
        if (Principal.equal(g.white, caller)) { return true };
        switch (g.black) {
          case (?b) { Principal.equal(b, caller) };
          case null { false };
        }
      }
    )
  };

  public query func getGame(gameId : Nat) : async ?ChessGame {
    Map.get(games, Nat.compare, gameId)
  };

  public shared ({ caller }) func makeMove(
    gameId : Nat,
    newFen : Text,
    moveNotation : Text,
    newStatus : ChessStatus
  ) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (isFinished(g.status)) { return false };
        let isWhitePlayer = Principal.equal(g.white, caller);
        let isBlackPlayer = switch (g.black) {
          case (?b) { Principal.equal(b, caller) };
          case null { false };
        };
        if (not isWhitePlayer and not isBlackPlayer) { return false };
        if (g.turnIsWhite and not isWhitePlayer) { return false };
        if (not g.turnIsWhite and not isBlackPlayer) { return false };

        let updated : ChessGame = {
          g with
          fen = newFen;
          moveHistory = Array.concat<Text>(g.moveHistory, [moveNotation]);
          status = newStatus;
          turnIsWhite = not g.turnIsWhite;
          lastMoveAt = Time.now();
        };
        Map.add(games, Nat.compare, gameId, updated);

        if (isFinished(newStatus)) {
          await payoutWager(updated);
          let paidOut = { updated with wagerPaidOut = true };
          Map.add(games, Nat.compare, gameId, paidOut);
        };
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func resign(gameId : Nat) : async Bool {
    switch (Map.get(games, Nat.compare, gameId)) {
      case (?g) {
        if (isFinished(g.status)) { return false };
        let isWhitePlayer = Principal.equal(g.white, caller);
        let isBlackPlayer = switch (g.black) {
          case (?b) { Principal.equal(b, caller) };
          case null { false };
        };
        if (not isWhitePlayer and not isBlackPlayer) { return false };
        let newStatus = if (isWhitePlayer) { #resignedWhite } else { #resignedBlack };
        let updated : ChessGame = {
          g with
          status = newStatus;
          lastMoveAt = Time.now();
        };
        Map.add(games, Nat.compare, gameId, updated);

        await payoutWager(updated);
        let paidOut = { updated with wagerPaidOut = true };
        Map.add(games, Nat.compare, gameId, paidOut);
        true
      };
      case null { false };
    }
  };
};
