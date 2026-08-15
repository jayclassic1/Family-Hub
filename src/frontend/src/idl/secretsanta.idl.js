export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const SecretSantaExchange = IDL.Record({
    id: IDL.Nat,
    organizer: IDL.Principal,
    organizerName: IDL.Text,
    name: IDL.Text,
    description: IDL.Text,
    participants: IDL.Vec(IDL.Principal),
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const SantaMatch = IDL.Record({
    recipientId: IDL.Principal,
    recipientName: IDL.Text,
  });
  const SantaComment = IDL.Record({
    id: IDL.Nat,
    santaId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    createExchange: IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Principal), IDL.Vec(IDL.Principal), IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    listExchanges: IDL.Func([], [IDL.Vec(SecretSantaExchange)], ["query"]),
    getExchange: IDL.Func([IDL.Nat], [IDL.Opt(SecretSantaExchange)], ["query"]),
    getMyMatch: IDL.Func([IDL.Nat], [IDL.Opt(SantaMatch)], []),
    addSantaComment: IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    getSantaComments: IDL.Func([IDL.Nat], [IDL.Vec(SantaComment)], ["query"]),
  });
};
