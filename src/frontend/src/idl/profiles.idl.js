export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const ProfileDetails = IDL.Record({
    owner: IDL.Principal,
    address: IDL.Opt(IDL.Text),
    postalCode: IDL.Opt(IDL.Text),
    telephone: IDL.Opt(IDL.Text),
    whatsapp: IDL.Opt(IDL.Text),
    email: IDL.Opt(IDL.Text),
    description: IDL.Opt(IDL.Text),
    photos: IDL.Vec(ChatAttachment),
    totalLikes: IDL.Nat,
  });
  return IDL.Service({
    updateProfileDetails: IDL.Func([IDL.Opt(IDL.Text), IDL.Opt(IDL.Text), IDL.Opt(IDL.Text), IDL.Opt(IDL.Text), IDL.Opt(IDL.Text), IDL.Opt(IDL.Text)], [IDL.Bool], []),
    addPhoto: IDL.Func([ChatAttachment], [IDL.Bool], []),
    removePhoto: IDL.Func([IDL.Nat], [IDL.Bool], []),
    addLike: IDL.Func([IDL.Principal], [IDL.Bool], []),
    getProfileDetails: IDL.Func([IDL.Principal], [ProfileDetails], ["query"]),
  });
};
