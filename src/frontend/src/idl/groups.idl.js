export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const Group = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    description: IDL.Text,
    creator: IDL.Principal,
    isPublic: IDL.Bool,
    created: IDL.Int,
    restrictedKey: IDL.Opt(IDL.Text),
  });
  const GroupMessagePublic = IDL.Record({
    id: IDL.Nat,
    groupId: IDL.Nat,
    sender: IDL.Principal,
    senderName: IDL.Text,
    text: IDL.Text,
    attachment: IDL.Opt(ChatAttachment),
    timestamp: IDL.Int,
    thumbsDownCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    myLoveGiven: IDL.Bool,
  });
  const GroupLoveEvent = IDL.Record({
    id: IDL.Nat,
    groupId: IDL.Nat,
    messageId: IDL.Nat,
    giver: IDL.Principal,
    receiver: IDL.Principal,
    lovedEffect: IDL.Text,
    sendEffect: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    createGroup: IDL.Func([IDL.Text, IDL.Text, IDL.Bool], [IDL.Nat], []),
    joinGroup: IDL.Func([IDL.Nat], [IDL.Bool], []),
    inviteToGroup: IDL.Func([IDL.Nat, IDL.Principal], [IDL.Bool], []),
    leaveGroup: IDL.Func([IDL.Nat], [IDL.Bool], []),
    listGroups: IDL.Func([], [IDL.Vec(Group)], []),
    getMyGroups: IDL.Func([], [IDL.Vec(Group)], []),
    getGroupMembers: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Principal)], ["query"]),
    sendGroupMessage: IDL.Func([IDL.Nat, IDL.Text, IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    getGroupMessages: IDL.Func([IDL.Nat], [IDL.Vec(GroupMessagePublic)], ["query"]),
    deleteGroupMessage: IDL.Func([IDL.Nat], [IDL.Bool], []),
    reactToGroupMessage: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveThisGroupMessage: IDL.Func([IDL.Nat], [IDL.Bool], []),
    seedDefaultGroups: IDL.Func([], [IDL.Bool], []),
    getGroupLoveEventsSince: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Vec(GroupLoveEvent)], ["query"]),
  });
};
