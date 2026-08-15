export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const Poll = IDL.Record({
    id: IDL.Nat,
    creator: IDL.Principal,
    creatorName: IDL.Text,
    title: IDL.Text,
    description: IDL.Text,
    options: IDL.Vec(IDL.Text),
    optionUsers: IDL.Vec(IDL.Opt(IDL.Principal)),
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const PollSummary = IDL.Record({
    poll: Poll,
    counts: IDL.Vec(IDL.Nat),
    myLoveGiven: IDL.Bool,
  });
  const PollComment = IDL.Record({
    id: IDL.Nat,
    pollId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  const PollCommentPublic = IDL.Record({
    id: IDL.Nat,
    pollId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
    thumbsDownCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    myLoveGiven: IDL.Bool,
  });
  return IDL.Service({
    createPoll: IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Text), IDL.Vec(IDL.Opt(IDL.Principal)), IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    vote: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Bool], []),
    hasVoted: IDL.Func([IDL.Nat], [IDL.Bool], ["query"]),
    getPoll: IDL.Func([IDL.Nat], [IDL.Opt(Poll)], ["query"]),
    getResults: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Nat)], ["query"]),
    listPollsWithResults: IDL.Func([], [IDL.Vec(PollSummary)], ["query"]),
    addComment: IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    getComments: IDL.Func([IDL.Nat], [IDL.Vec(PollCommentPublic)], ["query"]),
    reactToComment: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveThisPoll: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getMyPollLoveGiven: IDL.Func([IDL.Nat], [IDL.Bool], ["query"]),
    loveThisPollComment: IDL.Func([IDL.Nat], [IDL.Bool], []),
    deleteComment: IDL.Func([IDL.Nat], [IDL.Bool], []),
    deletePoll: IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};
