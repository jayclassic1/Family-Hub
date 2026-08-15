export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const HatAssignment = IDL.Record({
    participant: IDL.Text,
    answer: IDL.Text,
  });
  const HatDraw = IDL.Record({
    id: IDL.Nat,
    drawer: IDL.Principal,
    drawerName: IDL.Text,
    answers: IDL.Vec(IDL.Text),
    assignments: IDL.Vec(HatAssignment),
    name: IDL.Text,
    description: IDL.Text,
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const HatComment = IDL.Record({
    id: IDL.Nat,
    drawId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    recordImportantDraw: IDL.Func([IDL.Vec(IDL.Text), IDL.Vec(HatAssignment), IDL.Text, IDL.Text, IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    listDraws: IDL.Func([], [IDL.Vec(HatDraw)], ["query"]),
    getDraw: IDL.Func([IDL.Nat], [IDL.Opt(HatDraw)], ["query"]),
    addDrawComment: IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    getDrawComments: IDL.Func([IDL.Nat], [IDL.Vec(HatComment)], ["query"]),
  });
};
