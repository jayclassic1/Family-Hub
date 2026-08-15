export const idlFactory = ({ IDL }) => {
  const RpsChoice = IDL.Variant({ rock: IDL.Null, paper: IDL.Null, scissors: IDL.Null });
  const RpsStatus = IDL.Variant({
    waitingForOpponent: IDL.Null,
    waitingForChoices: IDL.Null,
    finished: IDL.Null,
  });
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const RpsGamePublic = IDL.Record({
    id: IDL.Nat,
    creator: IDL.Principal,
    creatorName: IDL.Text,
    opponent: IDL.Opt(IDL.Principal),
    opponentName: IDL.Opt(IDL.Text),
    status: RpsStatus,
    creatorChoice: IDL.Opt(RpsChoice),
    opponentChoice: IDL.Opt(RpsChoice),
    winner: IDL.Opt(IDL.Principal),
    winnerName: IDL.Opt(IDL.Text),
    isDraw: IDL.Bool,
    round: IDL.Nat,
    name: IDL.Opt(IDL.Text),
    description: IDL.Opt(IDL.Text),
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const RpsComment = IDL.Record({
    id: IDL.Nat,
    gameId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    createGame: IDL.Func([IDL.Principal], [IDL.Nat], []),
    confirmJoin: IDL.Func([IDL.Nat], [IDL.Bool], []),
    makeChoice: IDL.Func([IDL.Nat, RpsChoice], [IDL.Bool], []),
    playAgain: IDL.Func([IDL.Nat], [IDL.Bool], []),
    markImportant: IDL.Func([IDL.Nat, IDL.Text, IDL.Text, IDL.Opt(ChatAttachment)], [IDL.Bool], []),
    listAllGames: IDL.Func([], [IDL.Vec(RpsGamePublic)], ["query"]),
    listImportantGames: IDL.Func([], [IDL.Vec(RpsGamePublic)], ["query"]),
    getGame: IDL.Func([IDL.Nat], [IDL.Opt(RpsGamePublic)], ["query"]),
    getMyChoice: IDL.Func([IDL.Nat], [IDL.Opt(RpsChoice)], ["query"]),
    addComment: IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    getComments: IDL.Func([IDL.Nat], [IDL.Vec(RpsComment)], ["query"]),
  });
};
