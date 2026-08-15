export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const DmMessage = IDL.Record({
    id: IDL.Nat,
    sender: IDL.Principal,
    senderName: IDL.Text,
    recipient: IDL.Principal,
    text: IDL.Text,
    attachment: IDL.Opt(ChatAttachment),
    timestamp: IDL.Int,
  });
  const DmMessagePublic = IDL.Record({
    id: IDL.Nat,
    sender: IDL.Principal,
    senderName: IDL.Text,
    recipient: IDL.Principal,
    text: IDL.Text,
    attachment: IDL.Opt(ChatAttachment),
    timestamp: IDL.Int,
    thumbsDownCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    myLoveGiven: IDL.Bool,
  });
  const ConversationSummary = IDL.Record({
    otherUser: IDL.Principal,
    lastMessage: DmMessage,
    hasUnread: IDL.Bool,
  });
  return IDL.Service({
    sendDirectMessage: IDL.Func([IDL.Principal, IDL.Text, IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    getConversation: IDL.Func([IDL.Principal], [IDL.Vec(DmMessagePublic)], ["query"]),
    deleteDirectMessage: IDL.Func([IDL.Nat], [IDL.Bool], []),
    reactToMessage: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveThisMessage: IDL.Func([IDL.Nat], [IDL.Bool], []),
    markRead: IDL.Func([IDL.Principal], [IDL.Bool], []),
    hasUnread: IDL.Func([], [IDL.Bool], ["query"]),
    listConversations: IDL.Func([], [IDL.Vec(ConversationSummary)], ["query"]),
  });
};
