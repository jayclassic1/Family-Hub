export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const Album = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    description: IDL.Text,
    creator: IDL.Principal,
    creatorName: IDL.Text,
    contributors: IDL.Vec(IDL.Principal),
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const AlbumSummary = IDL.Record({
    album: Album,
    myLoveGiven: IDL.Bool,
  });
  const AlbumPhotoPublic = IDL.Record({
    id: IDL.Nat,
    albumId: IDL.Nat,
    uploader: IDL.Principal,
    uploaderName: IDL.Text,
    photo: ChatAttachment,
    likeCount: IDL.Nat,
    likedByMe: IDL.Bool,
    timestamp: IDL.Int,
  });
  const AlbumPhotoMeta = IDL.Record({
    id: IDL.Nat,
    albumId: IDL.Nat,
    uploader: IDL.Principal,
    uploaderName: IDL.Text,
    filename: IDL.Text,
    contentType: IDL.Text,
    thumbsDownCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    timestamp: IDL.Int,
    myLoveGiven: IDL.Bool,
  });
  return IDL.Service({
    createAlbum: IDL.Func([IDL.Text, IDL.Text, IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    deleteAlbum: IDL.Func([IDL.Nat], [IDL.Bool], []),
    addContributor: IDL.Func([IDL.Nat, IDL.Principal], [IDL.Bool], []),
    listAlbums: IDL.Func([], [IDL.Vec(AlbumSummary)], ["query"]),
    loveThisAlbum: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getAlbum: IDL.Func([IDL.Nat], [IDL.Opt(Album)], ["query"]),
    uploadPhoto: IDL.Func([IDL.Nat, ChatAttachment], [IDL.Nat], []),
    getAlbumPhotos: IDL.Func([IDL.Nat], [IDL.Vec(AlbumPhotoPublic)], ["query"]),
    getAlbumPhotoMetas: IDL.Func([IDL.Nat], [IDL.Vec(AlbumPhotoMeta)], ["query"]),
    getPhotoImage: IDL.Func([IDL.Nat], [IDL.Opt(ChatAttachment)], ["query"]),
    reactToPhoto: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveThisPhoto: IDL.Func([IDL.Nat], [IDL.Bool], []),
    toggleLike: IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};
