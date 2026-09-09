export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const ChatMessagePublic = IDL.Record({
    id: IDL.Nat,
    sender: IDL.Principal,
    senderName: IDL.Text,
    text: IDL.Text,
    attachment: IDL.Opt(ChatAttachment),
    timestamp: IDL.Int,
    thumbsDownCount: IDL.Nat,
    thumbsUpCount: IDL.Nat,
    loveCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    myLoveGiven: IDL.Bool,
    shareType: IDL.Opt(IDL.Text),
    shareTitle: IDL.Opt(IDL.Text),
    shareLink: IDL.Opt(IDL.Text),
    animated: IDL.Bool,
    isBanner: IDL.Bool,
    isPinned: IDL.Bool,
    imageExpired: IDL.Bool,
  });
  const LoveEvent = IDL.Record({
    id: IDL.Nat,
    messageId: IDL.Nat,
    giver: IDL.Principal,
    receiver: IDL.Principal,
    lovedEffect: IDL.Text,
    sendEffect: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    sendMessage: IDL.Func([IDL.Text, IDL.Opt(ChatAttachment), IDL.Bool, IDL.Bool], [IDL.Nat], []),
    sendShareMessage: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Bool], [IDL.Nat], []),
    getMessages: IDL.Func([], [IDL.Vec(ChatMessagePublic)], ["query"]),
    getPinnedMessages: IDL.Func([], [IDL.Vec(ChatMessagePublic)], ["query"]),
    deleteMessage: IDL.Func([IDL.Nat], [IDL.Bool], []),
    unpinMessage: IDL.Func([IDL.Nat], [IDL.Bool], []),
    reactToMessage: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveThisMessage: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getMessagesSince: IDL.Func([IDL.Nat], [IDL.Vec(ChatMessagePublic)], ["query"]),
    getLoveEventsSince: IDL.Func([IDL.Nat], [IDL.Vec(LoveEvent)], ["query"]),
  });
};
