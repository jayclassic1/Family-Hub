export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const WallPostPublic = IDL.Record({
    id: IDL.Nat,
    wallOwner: IDL.Principal,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    attachment: IDL.Opt(ChatAttachment),
    timestamp: IDL.Int,
    thumbsUpCount: IDL.Nat,
    thumbsDownCount: IDL.Nat,
    loveCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    myLoveGiven: IDL.Bool,
  });
  return IDL.Service({
    postToWall: IDL.Func([IDL.Principal, IDL.Text, IDL.Opt(ChatAttachment)], [IDL.Bool], []),
    getWallPosts: IDL.Func([IDL.Principal], [IDL.Vec(WallPostPublic)], ["query"]),
    reactToWallPost: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveWallPost: IDL.Func([IDL.Nat], [IDL.Bool], []),
    deleteWallPost: IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};
