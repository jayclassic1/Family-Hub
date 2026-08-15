export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const SpinResult = IDL.Record({
    id: IDL.Nat,
    spinner: IDL.Principal,
    spinnerName: IDL.Text,
    options: IDL.Vec(IDL.Text),
    winner: IDL.Text,
    name: IDL.Text,
    description: IDL.Text,
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const SpinComment = IDL.Record({
    id: IDL.Nat,
    spinId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    recordImportantSpin: IDL.Func([IDL.Vec(IDL.Text), IDL.Text, IDL.Text, IDL.Text, IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    listSpins: IDL.Func([], [IDL.Vec(SpinResult)], ["query"]),
    getSpin: IDL.Func([IDL.Nat], [IDL.Opt(SpinResult)], ["query"]),
    addSpinComment: IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    getSpinComments: IDL.Func([IDL.Nat], [IDL.Vec(SpinComment)], ["query"]),
  });
};
