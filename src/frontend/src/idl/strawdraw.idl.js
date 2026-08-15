export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const StrawGame = IDL.Record({
    id: IDL.Nat,
    creator: IDL.Principal,
    creatorName: IDL.Text,
    name: IDL.Text,
    description: IDL.Text,
    participants: IDL.Vec(IDL.Principal),
    shortStrawCount: IDL.Nat,
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const StrawResultPublic = IDL.Record({
    participant: IDL.Principal,
    participantName: IDL.Text,
    revealed: IDL.Bool,
    isShort: IDL.Opt(IDL.Bool),
  });
  const StrawComment = IDL.Record({
    id: IDL.Nat,
    gameId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    createGame: IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Principal), IDL.Vec(IDL.Principal), IDL.Nat, IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    listGames: IDL.Func([], [IDL.Vec(StrawGame)], ["query"]),
    getGame: IDL.Func([IDL.Nat], [IDL.Opt(StrawGame)], ["query"]),
    revealMyStraw: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getResults: IDL.Func([IDL.Nat], [IDL.Vec(StrawResultPublic)], ["query"]),
    getMyStraw: IDL.Func([IDL.Nat], [IDL.Opt(IDL.Bool)], ["query"]),
    addComment: IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    getComments: IDL.Func([IDL.Nat], [IDL.Vec(StrawComment)], ["query"]),
  });
};
