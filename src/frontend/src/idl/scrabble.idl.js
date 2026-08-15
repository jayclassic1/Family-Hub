export const idlFactory = ({ IDL }) => {
  const GameStatus = IDL.Variant({ waiting: IDL.Null, active: IDL.Null, finished: IDL.Null });
  const PlayerPublic = IDL.Record({
    id: IDL.Principal,
    name: IDL.Text,
    rackCount: IDL.Nat,
    myRack: IDL.Opt(IDL.Vec(IDL.Text)),
    score: IDL.Nat,
  });
  const PlacedTile = IDL.Record({ row: IDL.Nat, col: IDL.Nat, letter: IDL.Text });
  const Turn = IDL.Record({
    id: IDL.Nat,
    player: IDL.Principal,
    playerName: IDL.Text,
    placements: IDL.Vec(PlacedTile),
    score: IDL.Nat,
    passed: IDL.Bool,
    exchanged: IDL.Bool,
    timestamp: IDL.Int,
    disputed: IDL.Bool,
    resolved: IDL.Bool,
    upheld: IDL.Bool,
  });
  const Dispute = IDL.Record({
    turnId: IDL.Nat,
    raisedBy: IDL.Principal,
    votes: IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Bool)),
    resolved: IDL.Bool,
    outcome: IDL.Opt(IDL.Bool),
    coinFlipped: IDL.Bool,
  });
  const ChatMsg = IDL.Record({
    id: IDL.Nat,
    sender: IDL.Principal,
    senderName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  const GamePublic = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    creator: IDL.Principal,
    maxPlayers: IDL.Nat,
    players: IDL.Vec(PlayerPublic),
    board: IDL.Vec(PlacedTile),
    bagCount: IDL.Nat,
    turnOrder: IDL.Vec(IDL.Principal),
    currentTurnPlayer: IDL.Opt(IDL.Principal),
    turns: IDL.Vec(Turn),
    disputes: IDL.Vec(Dispute),
    status: GameStatus,
    created: IDL.Int,
    chat: IDL.Vec(ChatMsg),
  });
  return IDL.Service({
    createGame: IDL.Func([IDL.Text, IDL.Nat], [IDL.Nat], []),
    setMyName: IDL.Func([IDL.Nat, IDL.Text], [IDL.Bool], []),
    sendGameChat: IDL.Func([IDL.Nat, IDL.Text], [IDL.Bool], []),
    joinGame: IDL.Func([IDL.Nat], [IDL.Bool], []),
    leaveGame: IDL.Func([IDL.Nat], [IDL.Bool], []),
    startGame: IDL.Func([IDL.Nat], [IDL.Bool], []),
    placeTiles: IDL.Func([IDL.Nat, IDL.Vec(PlacedTile)], [IDL.Bool], []),
    passTurn: IDL.Func([IDL.Nat], [IDL.Bool], []),
    exchangeTiles: IDL.Func([IDL.Nat, IDL.Vec(IDL.Text)], [IDL.Bool], []),
    disputeTurn: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Bool], []),
    voteDispute: IDL.Func([IDL.Nat, IDL.Nat, IDL.Bool], [IDL.Bool], []),
    listGames: IDL.Func([], [IDL.Vec(GamePublic)], ["query"]),
    getGame: IDL.Func([IDL.Nat], [IDL.Opt(GamePublic)], ["query"]),
  });
};
