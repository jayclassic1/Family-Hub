export const idlFactory = ({ IDL }) => {
  const ChessStatus = IDL.Variant({
    ongoing: IDL.Null,
    whiteWon: IDL.Null,
    blackWon: IDL.Null,
    draw: IDL.Null,
    resignedWhite: IDL.Null,
    resignedBlack: IDL.Null,
  });
  const ChessGame = IDL.Record({
    id: IDL.Nat,
    white: IDL.Principal,
    whiteName: IDL.Text,
    black: IDL.Opt(IDL.Principal),
    blackName: IDL.Opt(IDL.Text),
    isOpen: IDL.Bool,
    invitedPlayer: IDL.Opt(IDL.Principal),
    invitedName: IDL.Opt(IDL.Text),
    fen: IDL.Text,
    moveHistory: IDL.Vec(IDL.Text),
    status: ChessStatus,
    turnIsWhite: IDL.Bool,
    created: IDL.Int,
    lastMoveAt: IDL.Int,
    wager: IDL.Nat,
    wagerPaidOut: IDL.Bool,
  });
  return IDL.Service({
    createOpenGame: IDL.Func([IDL.Nat], [IDL.Nat], []),
    createInviteGame: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Nat], []),
    cancelOpenGame: IDL.Func([IDL.Nat], [IDL.Bool], []),
    joinGame: IDL.Func([IDL.Nat], [IDL.Bool], []),
    listAllGames: IDL.Func([], [IDL.Vec(ChessGame)], ["query"]),
    listMyGames: IDL.Func([IDL.Principal], [IDL.Vec(ChessGame)], ["query"]),
    getGame: IDL.Func([IDL.Nat], [IDL.Opt(ChessGame)], ["query"]),
    makeMove: IDL.Func([IDL.Nat, IDL.Text, IDL.Text, ChessStatus], [IDL.Bool], []),
    resign: IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};
